# Services/task.py
from backend.utils.util import get_current_datetime, Response, get_unique_number, JasonResponse
from backend.db.connection import sessionlocal
from backend.db.models import TaskTable

class TaskServices:
    def __init__(self):
        self.created_ts = get_current_datetime()
        self.modified_ts = get_current_datetime()

    def create(self, docID: str):
        id=get_unique_number()
        db = sessionlocal()
        new_task = TaskTable(
            id=id,
            docID=docID,
            status='Not Started',
            output=None,
        )

        try:
            db.add(new_task)

            res = Response(
                Id=id,
            )
            db.commit()
            db.refresh(new_task)
            return res
        except Exception as e:
            raise Exception(f'Database error during task creation: {e}')
        finally:
            db.close()

    def fetch(self, task_id):

        db = sessionlocal()
        task_output = None
        try:
            # Query the database for the specific task ID
            task = db.query(TaskTable).filter(TaskTable.id == task_id).first()

            if task:
                task_output = task.output
        except Exception as e:
            raise Exception(f'TaskServices fetch error : {e}')
        finally:
            db.close()

        return task_output


    def list_trigger(self, task_id: str):

        db = sessionlocal()
        list_task=[]
        try:
            list_task = db.query(TaskTable).filter(TaskTable.status == "in process").all()
            return list_task
        except Exception as e:
            print(f'{e}')
        finally:
            db.close()
            return []
