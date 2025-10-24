# models.py

from sqlalchemy import Boolean, Column, Integer, ForeignKey, String, DateTime, JSON, MetaData, func
from sqlalchemy.orm import declarative_base

metadata = MetaData()
Base = declarative_base(metadata=metadata)


class DocumentTable(Base):
    __tablename__ = 'Document'

    id = Column(String(37), primary_key=True, index=True)
    filename = Column(String(4096), nullable=False)
    storage_path = Column(String, nullable=False)
    created_ts = Column(DateTime(timezone=True), server_default=func.now())
    modified_ts = Column(DateTime(timezone=True), server_default=func.now())


class TaskTable(Base):
    __tablename__ = 'Task'

    id = Column(String(37), primary_key=True, index=True, nullable=False)
    docID = Column(String(37), ForeignKey(DocumentTable.id), index=True, nullable=False)
    status = Column(String)
    output = Column(JSON, index=True, default={}, nullable=False)
    created_ts = Column(DateTime(timezone=True), server_default=func.now())
    modified_ts = Column(DateTime(timezone=True), server_default=func.now())
