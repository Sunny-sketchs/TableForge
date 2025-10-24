# backend\main
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.document_api import document_api
from backend.api.task_api import task_api
from backend.middlewares.exception_handlers import catch_exception_middleware
import uvicorn


app = FastAPI(
    title="Multi Agent System API",
    description="",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# middleware exception handler
app.middleware("http")(catch_exception_middleware)


@app.on_event("startup")
def start():
    print(f'Starting application...')
    try:
        print(f'Application Stated')
    except Exception as e:
        print(f'Exception in startup of application: {e}')


@app.on_event("shutdown")
def shutdown():
    print(f'on application shutdown')
    return 0

# CRITICAL FIX: Changed prefix from /api/document to /api
# This assumes document_api.py contains the full path /documentupload_pdf
app.include_router(document_api, prefix="/api")

# CRITICAL FIX: Changed prefix from /api/task to /api
# This assumes task_api.py contains the full paths /tasktrigger_task and /taskfetch_output
app.include_router(task_api, prefix="/api")


if __name__ == '__main__':
    # CRITICAL FIX: Changed port from 8080 to 8000 to match frontend's BASE_URL
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
