from backend.utils.util import get_unique_number
from backend.db.connection import sessionlocal
from backend.db.models import DocumentTable
from backend.logger.log_utils import setup_logger
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

# Initialize logger
service_logger = setup_logger(name="document_service")


class DocumentServices:
    """
    Handles persistence logic for document data.
    """

    async def create(self, name_file: str, path: str) -> str:
        """
        Creates a new Document entry in the database.

        Returns:
            str: The unique ID of the created document.
        """
        documentId = get_unique_number()
        db: Session = sessionlocal()

        new_doc = DocumentTable(
            id=documentId,
            filename=name_file,
            storage_path=path,
        )

        try:
            db.add(new_doc)
            db.commit()
            db.refresh(new_doc)

            return documentId

        except IntegrityError as e:
            db.rollback()
            service_logger.error(f'Database integrity error during document creation: {e}')
            raise Exception("A database constraint was violated (e.g., duplicate ID).")
        except Exception as e:
            db.rollback()
            service_logger.exception(f'Database error during document creation.')
            # Re-raise the exception to be caught by the API layer/middleware
            raise Exception(f'Database error during document creation: {e}')
        finally:
            db.close()