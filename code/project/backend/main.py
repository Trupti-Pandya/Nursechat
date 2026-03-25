from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from api.scrape_endpoints.routes import scrape_router
from api.chat_endpoints.routes import chat_router
from api.admin_endpoints.routes import admin_router
from api.voice_endpoints.routes import router as voice_router
from api.ocr_endpoints.mistral_ocr import router as ocr_router
import logging
import os
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
import time
import asyncio
from datetime import datetime
import uvicorn
from supabase import create_client
from fastapi.background import BackgroundTasks

# from api.chat_endpoints.chat import cache_document
# from contextlib import asynccontextmanager

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     # Startup: Cache the document
#     try:
#         cache_document()
#     except Exception as e:
#         print(f"Failed to cache document at startup: {e}")
#     print("Document cached at startup.")
    
#     yield  # Application runs here      
    
#     # Shutdown: Optional cleanup (e.g., clear memory, close connections)
#     print("Application shutting down.")

# Load environment variables
load_dotenv()
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_API_KEY")

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

version = "1.0.0"
# Initialize FastAPI with documentation information
app = FastAPI(
    title="Medical Screening Assistant API",
    description="""
    # Medical Screening Assistant

    This API powers a chatbot application designed to help nurses with medical screening using AI and voice technologies.
    
    ## Features
    
    * **AI-powered chat** for answering medical questions
    * **Multi-document context** for referencing patient information
    * **Voice interfaces** with multiple technology options
    * **OCR capabilities** for document processing
    * **Hospital information management** for administrators
    
    ## Authentication
    
    Admin endpoints require JWT authentication via the Authorization header.
    """,
    version=version,
    contact={
        "name": "Medical Screening Assistant Team",
        "email": "support@example.com"
    },
    license_info={
        "name": "Private License",
    },
    openapi_tags=[
        {
            "name": "chat",
            "description": "Operations for interacting with the AI assistant through text"
        },
        {
            "name": "voice",
            "description": "Speech-to-text and text-to-speech services with multiple technology options"
        },
        {
            "name": "ocr",
            "description": "Document processing capabilities for extracting text from images and PDFs"
        },
        {
            "name": "admin",
            "description": "Administrative operations for managing users and hospital information"
        },
        {
            "name": "scraping",
            "description": "Utilities for retrieving and processing medical information"
        }
    ]
)

# Configure CORS to allow frontend connections
# This is important for local development where frontend and backend
# run on different ports
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Initialize Supabase client for database operations
supabase = create_client(supabase_url, supabase_key)

# Include API routers for all feature areas
app.include_router(scrape_router, prefix="/scrape", tags=["scraping"])
app.include_router(chat_router, prefix="/ai", tags=["chat"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])
app.include_router(voice_router, prefix="/voice", tags=["voice"])
app.include_router(ocr_router, prefix="/ocr", tags=["ocr"])

# Background task to check for scheduled hospital info activations
async def check_scheduled_activations():
    """
    Check for hospital info files scheduled for activation and activate them if it's time.
    
    This background task runs continuously, checking every 60 seconds for hospital
    information files that have been scheduled for activation. When a file's scheduled
    time is reached, it is activated and becomes the current hospital information source.
    """
    while True:
        try:
            logger.info("Checking for scheduled hospital info activations...")
            
            if not supabase:
                logger.warning("Supabase client not initialized - skipping scheduled activations check")
                continue
                
            # Get currently active file for reference
            active_response = supabase.table("hospital_info_files") \
                .select("*") \
                .eq("is_active", True) \
                .execute()
            
            active_file = None
            if active_response.data and len(active_response.data) > 0:
                active_file = active_response.data[0]
                logger.info(f"Current active file: ID: {active_file['id']}, " +
                           f"Name: {active_file['file_name']}, Version: {active_file['version']}")
            else:
                logger.info("No currently active file found")
            
            # Get files scheduled for activation where scheduled time is in the past
            now = datetime.now().isoformat()
            response = supabase.table("hospital_info_files") \
                .select("*") \
                .lt("scheduled_activation_time", now) \
                .is_("is_active", "false") \
                .not_.is_("scheduled_activation_time", "null") \
                .execute()
            
            if response.data and len(response.data) > 0:
                logger.info(f"Found {len(response.data)} files to activate")
                
                for file in response.data:
                    scheduled_time = datetime.fromisoformat(file['scheduled_activation_time'].replace('Z', '+00:00')) \
                        if file['scheduled_activation_time'] else None
                    logger.info(f"Activating file: {file['file_name']} (ID: {file['id']}, Version: {file['version']})")
                    logger.info(f"Scheduled time was: {scheduled_time.isoformat() if scheduled_time else 'None'}")
                    
                    # First, deactivate all currently active files
                    logger.info("Deactivating currently active files...")
                    supabase.table("hospital_info_files") \
                        .update({"is_active": False}) \
                        .eq("is_active", True) \
                        .execute()
                    
                    # Activate this file and clear its scheduled time
                    logger.info(f"Setting file {file['id']} as active...")
                    supabase.table("hospital_info_files") \
                        .update({
                            "is_active": True,
                            "scheduled_activation_time": None
                        }) \
                        .eq("id", file["id"]) \
                        .execute()
                    
                    logger.info(f"Successfully activated file: {file['file_name']} (ID: {file['id']})")
            else:
                # Get all scheduled files for information
                scheduled_files = supabase.table("hospital_info_files") \
                    .select("*") \
                    .not_.is_("scheduled_activation_time", "null") \
                    .execute()
                
                if scheduled_files.data and len(scheduled_files.data) > 0:
                    logger.info(f"Found {len(scheduled_files.data)} scheduled files, but none ready for activation yet:")
                    for file in scheduled_files.data:
                        scheduled_time = datetime.fromisoformat(file['scheduled_activation_time'].replace('Z', '+00:00')) \
                            if file['scheduled_activation_time'] else None
                        logger.info(f"  - {file['file_name']} (ID: {file['id']}, Version: {file['version']})")
                        logger.info(f"    Scheduled for: {scheduled_time.isoformat() if scheduled_time else 'None'}")
                else:
                    logger.info("No files scheduled for activation at this time")
        
        except Exception as e:
            logger.error(f"Error checking for scheduled activations: {str(e)}")
        
        # Wait for 60 seconds before checking again
        await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    """
    Execute tasks when the application starts up.
    
    This initializes background tasks and performs any necessary startup operations.
    """
    logger.info("Starting up the application...")
    asyncio.create_task(check_scheduled_activations())
    logger.info("Started background task for checking scheduled hospital info activations")

@app.get("/")
def read_root():
    """
    Root endpoint that returns basic API information.
    
    This endpoint provides basic information about the API including version, 
    documentation links, and available endpoints.
    
    Returns:
        dict: Information about the API including:
            - message: Welcome message
            - version: Current API version
            - docs: Links to API documentation
            - endpoints: List of main API endpoint categories
    """
    return {
        "message": "Welcome to the Medical Screening Assistant API",
        "version": version,
        "docs": {
            "swagger": "/docs",
            "redoc": "/redoc"
        },
        "endpoints": {
            "chat": "/ai/chat",
            "voice": {
                "speech_to_text": ["/voice/stt", "/voice/ai/stt"],
                "text_to_speech": ["/voice/tts", "/voice/ai/tts"]
            },
            "ocr": "/ocr/mistral",
            "admin": ["/admin/dashboard", "/admin/users", "/admin/hospital-info"]
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

