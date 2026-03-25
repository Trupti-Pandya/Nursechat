import os
import io
import base64
import traceback
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from mistralai import Mistral
from mistralai.models import HTTPValidationError, SDKError

# Load environment variables
load_dotenv()
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

router = APIRouter(tags=["ocr"])

class OCRResponse(BaseModel):
    """
    Response model for OCR processing.
    
    Attributes:
        markdown (str, optional): Processed text in markdown format
        text (str, optional): Processed text in plain text format
        error (str, optional): Error message if processing failed
    """
    markdown: Optional[str] = None
    text:     Optional[str] = None
    error:    Optional[str] = None

@router.post("/mistral", response_model=OCRResponse)
async def process_mistral_ocr(file: UploadFile = File(...)):
    """
    Process images or PDFs using Mistral's OCR capabilities.
    
    This endpoint extracts text from uploaded images or PDF documents and returns
    both plain text and markdown formatted versions of the content.
    
    Parameters:
    - **file**: Uploaded file (image or PDF) to process
        - Supported formats: images (jpg, png, etc.) and PDF files
        - Maximum file size: Determined by FastAPI configuration
    
    Returns:
    - **OCRResponse**: Object containing:
        - markdown (str): Extracted text in markdown format (preserving document structure)
        - text (str): Extracted text in plain text format
        - error (str, optional): Error message if processing failed
    
    Raises:
    - HTTPException(500): If the Mistral API key is not configured or API error occurs
    - HTTPException(400): If an unsupported file type is provided
    """
    if not MISTRAL_API_KEY:
        raise HTTPException(500, "Mistral API key is not configured")

    content_type = file.content_type
    if not (content_type.startswith("image/") or content_type == "application/pdf"):
        raise HTTPException(400, f"Unsupported file type: {content_type}")

    try:
        raw_bytes = await file.read()

        client = Mistral(api_key=MISTRAL_API_KEY)

        if content_type == "application/pdf":
            # Wrap the PDF bytes in a BufferedReader so Pydantic will accept it
            buffered = io.BufferedReader(io.BytesIO(raw_bytes))

            upload_resp = client.files.upload(
                file={
                    "file_name": file.filename,
                    "content": buffered,                  # now a BufferedReader
                },
                purpose="ocr"
            )                                         # :contentReference[oaicite:5]{index=5}

            signed = client.files.get_signed_url(file_id=upload_resp.id)
            document = {
                "type":         "document_url",
                "document_url": signed.url
            }                                         # :contentReference[oaicite:6]{index=6}

        else:
            data_uri = (
                f"data:{content_type};base64,"
                + base64.b64encode(raw_bytes).decode()
            )
            document = {
                "type":      "image_url",
                "image_url": data_uri
            }

        ocr_res = client.ocr.process(
            model="mistral-ocr-latest",
            document=document,
            include_image_base64=True
        )                                           # :contentReference[oaicite:7]{index=7}

        full_md  = "\n\n".join(page.markdown for page in ocr_res.pages)
        full_txt = "\n\n".join(getattr(page, "text", "") for page in ocr_res.pages)

        return OCRResponse(markdown=full_md, text=full_txt)

    except (HTTPValidationError, SDKError) as sdk_err:
        raise HTTPException(500, f"Mistral SDK error: {sdk_err}")

    except Exception as e:
        tb = traceback.format_exc()
        raise HTTPException(500, f"Unexpected error: {e}\n{tb}")
