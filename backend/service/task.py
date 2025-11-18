import asyncio
from typing import Dict, List
from backend.utils.util import get_unique_number, Response
# CRITICAL FIX: Import 'engine' as it's needed for table_extracter
from backend.db.connection import sessionlocal, engine
from backend.db.models import TaskTable, DocumentTable
# CRITICAL FIX: Import the necessary extraction logic
from backend.service.table_extract import table_extracter
from backend.logger.log_utils import setup_logger
from sqlalchemy.orm import Session
from sqlalchemy.exc import NoResultFound

# Initialize logger
service_logger = setup_logger(name="task_service")


class TaskServices:
    """
    Handles persistence and orchestration logic for task execution (PDF processing).
    """

    # Removed __init__ as its attributes (created_ts, modified_ts) are handled by DB defaults.

    # CRITICAL FIX: Must be async to match task_api.py usage.
    async def create(self, docID: str) -> Response:
        """
        Creates a new Task entry and immediately triggers the PDF table extraction 
        in a non-blocking manner using asyncio.to_thread.
        """
        taskId = get_unique_number()
        db: Session = sessionlocal()

        # 1. Initial Task Creation (Status: PENDING)
        new_task = TaskTable(
            id=taskId,
            docID=docID,
            status='PENDING',
            output={},
        )

        try:
            db.add(new_task)
            db.commit()
            db.refresh(new_task)

            # 2. Retrieve Document Path
            doc = db.query(DocumentTable).filter(DocumentTable.id == docID).first()
            if not doc:
                raise NoResultFound(f"Document with ID {docID} not found.")

            # 3. Update Status to IN_PROCESS (before starting the long task)
            new_task.status = 'IN_PROCESS'
            db.commit()

            # 4. CRITICAL FIX: Run the synchronous table_extracter in a separate thread.
            # This prevents the application from blocking the event loop.
            table_names = await asyncio.to_thread(
                table_extracter,
                pdf_file_path=doc.storage_path,
                doc_id=docID,
                db_engine=engine
            )

            # 5. Final Task Update (Status: COMPLETE or FAILED)
            if table_names:
                new_task.status = 'COMPLETED'
                new_task.output = {'extracted_tables': table_names, 'success': True}
            else:
                new_task.status = 'FAILED'
                new_task.output = {'extracted_tables': [], 'success': False,
                                   'reason': 'No tables found or extraction failed.'}

            db.commit()

        except NoResultFound:
            db.rollback()
            service_logger.error(f'Task creation failed: Document ID {docID} not found.')
            raise Exception(f'Document ID {docID} not found.')
        except Exception as e:
            db.rollback()
            # If an error occurred after the task was created, mark it as FAILED
            if taskId:
                try:
                    failed_task = db.query(TaskTable).filter(TaskTable.id == taskId).first()
                    if failed_task:
                        failed_task.status = 'FAILED'
                        failed_task.output = {'success': False, 'reason': f'Server processing error: {e}'}
                        db.commit()
                except Exception as update_e:
                    service_logger.error(f'Failed to update task status to FAILED: {update_e}')

            service_logger.exception(f'Database or processing error during task execution.')
            raise Exception(f'Server error during task execution: {e}')
        finally:
            db.close()

        return Response(Id=taskId)

    # CRITICAL FIX: Must be async to match task_api.py usage.
    async def fetch(self, task_id: str) -> Dict:
        """
        Fetches the status and output of a task by ID.
        """
        db: Session = sessionlocal()
        try:
            task = db.query(TaskTable).filter(TaskTable.id == task_id).first()

            if task:
                # Return the full status and output data
                return {
                    'status': task.status,
                    'output': task.output
                }
            else:
                raise NoResultFound(f"Task with ID {task_id} not found.")

        except NoResultFound as e:
            service_logger.error(str(e))
            raise Exception(f'Task not found: {task_id}')
        except Exception as e:
            service_logger.exception(f'TaskServices fetch error for ID {task_id}')
            raise Exception(f'TaskServices fetch error : {e}')
        finally:
            db.close()

    # CRITICAL FIX: Renamed for clarity and made async
    async def get_in_process_tasks(self) -> List[TaskTable]:
        """
        Lists all tasks currently marked as 'IN_PROCESS'.
        """
        db: Session = sessionlocal()
        try:
            list_task = db.query(TaskTable).filter(TaskTable.status == "IN_PROCESS").all()
            return list_task
        except Exception as e:
            service_logger.error(f'Error listing in-process tasks: {e}')
            return []
        finally:
            db.close()