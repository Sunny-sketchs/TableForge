from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional


def get_unique_number() -> str:
    """Generates a UUID for use as a unique ID."""
    return str(uuid4())


def get_current_datetime() -> datetime:
    """Returns the current UTC datetime."""
    return datetime.now(timezone.utc)


class Response:
    """
    A simple structure used in service layers to package return data.
    """

    def __init__(self, Id: Optional[str] = None, data: Optional[dict] = None):
        self.Id = Id
        self.data = data

    def __repr__(self):
        return f"Response(Id={self.Id}, data={self.data})"