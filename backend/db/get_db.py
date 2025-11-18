from fastapi import Depends
import backend.db.models as models
from backend.db.connection import engine, sessionlocal
from typing import Annotated
from sqlalchemy.orm import Session


# --- Database Initialization ---
try:
    # This creates the tables if they don't exist. Added try/except for resilience.
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Warning: Could not create database tables on startup. Error: {e}")


def get_DB():
    """
    Dependency function to get a SQLAlchemy session.
    The session is automatically closed after the request is finished (even on exceptions).
    """
    db = sessionlocal()
    try:
        yield db
    finally:
        # Ensure the database session is closed
        db.close()


# Type hint for the database dependency injection in FastAPI routers
db_dependency = Annotated[Session, Depends(get_DB)]