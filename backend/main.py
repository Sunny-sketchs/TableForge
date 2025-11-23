from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path

# Import routers
from backend.api.document_api import document_api
from backend.api.task_api import task_api
from backend.api.chat_api import chat_api
from backend.middlewares.exception_handlers import catch_exception_middleware
import uvicorn

app = FastAPI(
    title="TableForge API",
    description="Backend API for document processing, task orchestration, and LLM chat.",
)

# --- 1. Middleware Setup ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(catch_exception_middleware)


# --- 2. Application Events ---
@app.on_event("startup")
def start():
    print('Starting application...')
    try:
        # Database tables are created in get_db.py (imported via routers)
        print('Application Started')
    except Exception as e:
        print(f'Exception in startup of application: {e}')


@app.on_event("shutdown")
def shutdown():
    print('Application shutting down...')


# --- 3. API Routes (MUST be defined before StaticFiles) ---
# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "tableforge"}


# Register Routers
app.include_router(document_api, prefix="/api")
app.include_router(task_api, prefix="/api")
app.include_router(chat_api, prefix="/api")

# --- 4. Static File Serving (Frontend) ---
# This allows FastAPI to serve the React app built into 'frontend/dist'

# Resolve the path to the 'frontend/dist' directory relative to this file
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

if FRONTEND_DIST.exists() and FRONTEND_DIST.is_dir():
    print(f"✓ Serving React frontend from: {FRONTEND_DIST}")

    # Mount the static files directory to the root
    # 'html=True' ensures that index.html is served for the root path
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")
else:
    print(f"⚠ Frontend build not found at: {FRONTEND_DIST}")
    print("  (This is expected during local dev if you haven't run 'npm run build')")
    print("  For local development, run the React frontend separately via 'npm run dev'.")

if __name__ == '__main__':
    # Determine port from environment variable (Render uses PORT) or default to 8000
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")