from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from backend.service.document import DocumentServices
import os

document_api = APIRouter(tags=["Document Processing APIs"])

UPLOAD_DIRECTORY = "uploaded_pdfs"


@document_api.post("/documentupload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    # Check the content_type
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only PDF files are allowed."
        )

    try:
        os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

        # CRITICAL FIX: Sanitize filename to prevent directory traversal
        filename = os.path.basename(file.filename)
        if not filename:
             raise HTTPException(status_code=400, detail="Invalid file name.")

        file_location = os.path.join(UPLOAD_DIRECTORY, filename)

        # Write the file content
        with open(file_location, "wb") as buffer:
            buffer.write(await file.read())

        # Call the service layer (must be awaited as DocumentServices().create is now async)
        doc_id = await DocumentServices().create(
            name_file=filename,
            path=file_location
        )
        return JSONResponse(content={"id": doc_id, "success": True})

    except HTTPException:
        # Re-raise explicit HTTPExceptions
        raise
    except Exception as e:
        # General exception handler for internal server errors
        print(f'Exception in uploading document: {e}')
        raise HTTPException(
            status_code=500,
            detail="Internal Server Error during document processing."
        )