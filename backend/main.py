from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.document_api import document_api
from backend.api.task_api import task_api
# --- NEW IMPORT ---
from backend.api.chat_api import chat_api
# ------------------
from backend.middlewares.exception_handlers import catch_exception_middleware
import uvicorn


app = FastAPI(
    title="Multi Agent System API",
    description="Backend API for document processing and task orchestration.",
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
    print('Starting application...')
    try:
        print('Application Stated')
    except Exception as e:
        print(f'Exception in startup of application: {e}')


@app.on_event("shutdown")
def shutdown():
    print('on application shutdown')
    return 0

# Using a common '/api' prefix
app.include_router(document_api, prefix="/api")
app.include_router(task_api, prefix="/api")
# --- NEW ROUTER INCLUSION ---
app.include_router(chat_api, prefix="/api")
# ----------------------------


if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")