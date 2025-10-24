# backend\utils\util
import os
from pydantic import BaseModel
from typing import Any
from uuid import uuid4
from datetime import datetime, timezone

class JasonResponse(BaseModel):
    success: bool = False
    error: dict = {}
    result: Any = {}


def get_unique_number():
    return str(uuid4()).lower()

def get_current_datetime() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def get_storage_absolute_path(projectId: str, documentId: str, documentName: str):
    return os.path.join("Multi_Agent_System", f"{projectId}", f"{documentId}", f"{documentName}")


class Response(BaseModel):
    Id: str
    # createdTs: datetime
    # modifiedTs: datetime
    # execution: bool
