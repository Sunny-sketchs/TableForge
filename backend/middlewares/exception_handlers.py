from fastapi import Request
from fastapi.responses import JSONResponse
# CRITICAL FIX: Import and instantiate logger using the utility function.
from backend.logger.log_utils import setup_logger

# Initialize the logger for this module
app_logger = setup_logger(name="fastapi_middleware")


async def catch_exception_middleware(request: Request, call_next):
    """
    Middleware to catch all unhandled exceptions and return a consistent JSON 500 response.
    """
    try:
        return await call_next(request)
    except Exception as exc:
        # Log the full traceback for the unhandled exception
        app_logger.exception(f"UNHANDLED EXCEPTION on {request.url.path}")

        # Return a generic 500 error response to the client
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "An unexpected server error occurred."
            }
        )