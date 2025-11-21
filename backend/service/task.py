import asyncio
from backend.utils.util import get_unique_number, Response
from backend.db.connection import sessionlocal, engine
from backend.db.models import TaskTable, DocumentTable
from backend.service.table_extract import table_extracter
from backend.logger.log_utils import setup_logger
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

# Initialize logger
service_logger = setup_logger(name="task_service")


class TaskServices:
    """
    Manages the lifecycle of PDF extraction tasks, including creation,
    triggering background processing, and fetching results.
    """

    # --- Task Creation & Trigger (Executed on API POST /tasktrigger_task) ---

    async def create(self, docID: str) -> Response:
        """
        Creates a new task in the database and immediately triggers the
        heavy lifting (PDF extraction) in a separate thread.
        """
        task_id = get_unique_number()
        db: Session = sessionlocal()

        # 1. Look up Document path
        doc = db.query(DocumentTable).filter(DocumentTable.id == docID).first()
        if not doc:
            db.close()
            raise Exception(f'Document not found with ID: {docID}')

        # 2. Create and commit the task immediately (Status: PENDING)
        new_task = TaskTable(
            id=task_id,
            docID=docID,
            status='PENDING',
            output={},
        )

        try:
            db.add(new_task)
            # CRITICAL FIX: Commit the task immediately so the polling function can find it.
            db.commit()
            db.refresh(new_task)
            service_logger.info(f"Task {task_id} created for Doc {docID}. Status: PPENDING.")

            # 3. Trigger asynchronous background processing
            # We use asyncio.to_thread to run the synchronous table_extracter function
            # without blocking the main FastAPI event loop.
            await asyncio.create_task(
                self._run_extraction_in_background(task_id, doc.storage_path)
            )

            # 4. Return the new Task ID immediately
            return Response(Id=task_id)

        except IntegrityError as e:
            db.rollback()
            service_logger.error(f'Database integrity error during task creation: {e}')
            raise Exception("A database constraint was violated during task creation.")
        except Exception as e:
            db.rollback()
            service_logger.exception(f'Database error during task creation.')
            raise Exception(f'Database error during task creation: {e}')
        finally:
            db.close()

    # --- Background Extraction Daemon Logic (Runs in worker thread) ---

    async def _run_extraction_in_background(self, task_id: str, pdf_path: str):
        """
        Manages the asynchronous execution and status update of the extraction.
        """
        db: Session = sessionlocal()

        # 1. Update status to IN_PROCESS
        try:
            db.query(TaskTable).filter(TaskTable.id == task_id).update({'status': 'IN_PROCESS'}, synchronize_session=False)
            db.commit()
            service_logger.info(f"Task {task_id} status updated to IN_PROCESS.")

            # 2. Execute the synchronous extraction in a separate thread
            extracted_tables = await asyncio.to_thread(
                table_extracter,
                pdf_file_path=pdf_path,
                doc_id=task_id,
                db_engine=engine
            )

            # 3. Determine final status and output
            final_status = 'COMPLETED' if extracted_tables else 'FAILED'
            output_data = {
                "extracted_tables": extracted_tables,
                "success": bool(extracted_tables),
                "reason": "Extraction successful." if extracted_tables else "No tables found or extraction failed."
            }

            service_logger.info(f"Task {task_id} finished. Status: {final_status}.")

        except Exception as e:
            service_logger.exception(f"Critical error during background extraction for Task {task_id}: {e}")
            final_status = 'FAILED'
            output_data = {"extracted_tables": [], "success": False, "reason": f"Critical server error: {e}"}

        finally:
            # 4. Update final status and output
            try:
                db.query(TaskTable).filter(TaskTable.id == task_id).update({
                    'status': final_status,
                    'output': output_data
                }, synchronize_session=False)
                db.commit()
            except Exception as e:
                service_logger.error(f"Failed to update final status for Task {task_id}: {e}")
            finally:
                db.close()


    # --- Task Fetch (Executed on API POST /taskfetch_output) ---

    async def fetch(self, task_id: str) -> dict:
        """
        Fetches the current status and output for a given task ID.
        """
        db: Session = sessionlocal()

        # CRITICAL: Since database read is synchronous, run it in a thread as well.
        task = await asyncio.to_thread(
            db.query(TaskTable).filter(TaskTable.id == task_id).first
        )

        try:
            if not task:
                service_logger.error(f"Task with ID {task_id} not found.")
                raise Exception(f'Task not found: {task_id}')

            output_data = {
                'status': task.status,
                'output': task.output,
            }
            return output_data

        except Exception as e:
            service_logger.exception(f'TaskServices fetch error: {e}')
            raise
        finally:
            db.close()