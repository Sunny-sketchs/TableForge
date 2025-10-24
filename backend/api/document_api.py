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

        file_location = os.path.join(UPLOAD_DIRECTORY, file.filename)

        with open(file_location, "wb") as buffer:
            buffer.write(await file.read())

        doc_id = await DocumentServices().create(
            name_file=file.filename,
            path=file_location
        )
        return JSONResponse(content={"id": doc_id, "success": True})

    except Exception as e:
        print(f'Exception in uploading document: {e}')
        raise HTTPException(
            status_code=500,
            detail=f"Error processing document service: {e}"
        )
