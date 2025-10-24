# Services/document.py
from backend.utils.util import get_unique_number, get_current_datetime, Response
from backend.db.connection import sessionlocal
from backend.db.models import DocumentTable, TaskTable


class DocumentServices:
    def __init__(self):
        self.created_ts = get_current_datetime()
        self.modified_ts = get_current_datetime()

    async def create(self, name_file: str, path: str):
        response = None
        documentId = get_unique_number()
        db = sessionlocal()
        new_doc = DocumentTable(
            id=documentId,
            filename=name_file,
            storage_path=path,
        )
        try:
            db.add(new_doc)

            db.commit()

            db.refresh(new_doc)
            response = Response(
                Id=documentId,
            )
        except Exception as e:
            db.rollback()
            raise Exception(f'Database error during document creation: {e}')
        finally:
            db.close()

        return response.Id
