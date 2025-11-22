from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path

from backend.api.document_api import document_api
from backend.api.task_api import task_api
from backend.api.chat_api import chat_api
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
        print('Application Started')
    except Exception as e:
        print(f'Exception in startup of application: {e}')


@app.on_event("shutdown")
def shutdown():
    print('on application shutdown')
    return 0


# Health check endpoint for Render
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "tableforge"}


# Using a common '/api' prefix - API ROUTES MUST COME FIRST
app.include_router(document_api, prefix="/api")
app.include_router(task_api, prefix="/api")
app.include_router(chat_api, prefix="/api")

# ============================================
# STATIC FILE SERVING FOR REACT FRONTEND
# ============================================
# Get the frontend dist directory path
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

# Only serve static files if the dist folder exists (production)
if FRONTEND_DIST.exists() and FRONTEND_DIST.is_dir():
    print(f"✓ Serving React frontend from: {FRONTEND_DIST}")

    # Serve static assets (CSS, JS, images)
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


    # Catch-all route for React SPA (MUST BE LAST)
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        """
        Serve React frontend for all non-API routes.
        This enables client-side routing.
        """
        # Don't interfere with API routes
        if full_path.startswith("api/"):
            return {"detail": "Not Found"}

        # Serve specific file if it exists
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))

        # Otherwise serve index.html (React handles routing)
        index_path = FRONTEND_DIST / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))

        return {"detail": "Frontend not found"}
else:
    print(f"⚠ Frontend dist folder not found at: {FRONTEND_DIST}")
    print("  Run 'cd frontend && npm run build' to create it.")

if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")