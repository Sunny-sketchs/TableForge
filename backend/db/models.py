from sqlalchemy import Column, ForeignKey, String, DateTime, JSON, func
# CRITICAL FIX: Import Base from connection.py to ensure all models use the same declarative base.
from backend.db.connection import Base


class DocumentTable(Base):
    __tablename__ = 'Document'

    id = Column(String(37), primary_key=True, index=True)
    filename = Column(String(4096), nullable=False)
    storage_path = Column(String(2048), nullable=False)
    created_ts = Column(DateTime(timezone=True), server_default=func.now())
    # Added onupdate for automatic timestamp updating
    modified_ts = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TaskTable(Base):
    __tablename__ = 'Task'

    id = Column(String(37), primary_key=True, index=True, nullable=False)

    # CRITICAL FIX: Corrected ForeignKey target name to the table name 'Document'
    docID = Column(String(37), ForeignKey('Document.id'), index=True, nullable=False)

    # Added length constraint and default status
    status = Column(String(50), default='PENDING', nullable=False)

    # Removed index on JSON column (inefficient)
    output = Column(JSON, default={}, nullable=False)

    created_ts = Column(DateTime(timezone=True), server_default=func.now())
    # Added onupdate for automatic timestamp updating
    modified_ts = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())