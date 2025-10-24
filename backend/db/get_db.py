from fastapi import Depends
import models
from connection import engine, sessionlocal
from typing import Annotated
from sqlalchemy.orm import Session


models.Base.metadata.create_all(bind=engine)


def get_DB():
    db = sessionlocal()
    try:
        yield db
    finally:
        db.close()


db_dependency = Annotated[Session, Depends(get_DB)]

