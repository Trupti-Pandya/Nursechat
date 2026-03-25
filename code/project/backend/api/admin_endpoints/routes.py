from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Dict, Optional, List, Any
import os
from supabase import create_client
from dotenv import load_dotenv
import jwt
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("admin_endpoints")

# Load environment variables
load_dotenv()
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_API_KEY")
jwt_secret = os.getenv("JWT_SECRET")

# Initialize Supabase client
supabase = create_client(supabase_url, supabase_key)

admin_router = APIRouter(tags=["admin"])

class AdminResponse(BaseModel):
    message: str
    status: str = "success"

class UserData(BaseModel):
    user_id: str
    email: str
    metadata: Optional[Dict] = None

class ErrorResponse(BaseModel):
    message: str
    status: str = "error"

class HospitalInfoFile(BaseModel):
    id: Optional[str] = None
    file_content: str
    file_name: str
    version: Optional[int] = None
    is_active: Optional[bool] = None
    uploaded_by: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    notes: Optional[str] = None

class HospitalInfoHistory(BaseModel):
    files: List[HospitalInfoFile]
    count: int
    
# Helper function to verify admin status
async def verify_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.split(" ")[1]
    
    try:
        # Verify the JWT token
        user_data = supabase.auth.get_user(token)
        
        logger.info(f"User data: {user_data}")
        
        if not user_data.user:
            raise HTTPException(status_code=401, detail="Invalid token - no user found")
        
        # Check if user has admin role in metadata (check multiple locations)
        user_metadata = user_data.user.user_metadata
        app_metadata = getattr(user_data.user, 'app_metadata', None)
        raw_user_metadata = getattr(user_data.user, 'raw_user_meta_data', None)
        
        logger.info(f"User metadata: {user_metadata}")
        logger.info(f"App metadata: {app_metadata}")
        logger.info(f"Raw user metadata: {raw_user_metadata}")
        
        is_admin = (
            (user_metadata and user_metadata.get("isAdmin")) or
            (app_metadata and app_metadata.get("isAdmin")) or
            (raw_user_metadata and raw_user_metadata.get("isAdmin"))
        )
        
        if not is_admin:
            raise HTTPException(status_code=403, detail="Access denied: User is not an admin")
        
        return user_data.user
    except Exception as e:
        logger.error(f"Error verifying admin status: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

@admin_router.get("/dashboard", response_model=AdminResponse)
async def admin_dashboard(user = Depends(verify_admin)):
    """
    Admin dashboard endpoint that checks if the user has admin privileges.
    """
    return AdminResponse(message=f"Welcome to the admin dashboard, {user.email}!")

@admin_router.get("/users", response_model=List[UserData])
async def get_users(user = Depends(verify_admin)):
    """
    Get all users from the database. Only accessible by admins.
    """
    try:
        response = supabase.table("users").select("*").execute()
        users = [
            UserData(
                user_id=user["id"], 
                email=user["email"], 
                metadata=user.get("metadata")
            ) 
            for user in response.data
        ]
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

@admin_router.post("/update-admin-status")
async def update_admin_status(user_id: str, is_admin: bool, user = Depends(verify_admin)):
    """
    Update the admin status of a user. Only accessible by existing admins.
    """
    try:
        # Update user metadata in Supabase
        response = supabase.auth.admin.update_user_by_id(
            user_id,
            {"user_metadata": {"isAdmin": is_admin}}
        )
        
        return AdminResponse(
            message=f"Updated admin status for user {user_id} to {is_admin}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to update admin status: {str(e)}"
        )

# Hospital Info File Management Endpoints

@admin_router.post("/hospital-info", response_model=HospitalInfoFile)
async def upload_hospital_info(file_data: HospitalInfoFile, user = Depends(verify_admin)):
    """
    Upload a new hospital info file. Only accessible by admins.
    """
    try:
        # Set the uploaded_by field to the current user's ID
        file_data_dict = file_data.dict(exclude={"id", "version", "uploaded_at", "uploaded_by"})
        file_data_dict["uploaded_by"] = user.id
        
        # Default to inactive unless explicitly set to active
        if file_data_dict.get("is_active") is None:
            file_data_dict["is_active"] = False
            
        # Store in Supabase (the version will be set by DB trigger)
        response = supabase.table("hospital_info_files").insert(file_data_dict).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to upload hospital info file")
            
        logger.info(f"Hospital info file uploaded: {response.data[0]}")
        return response.data[0]
    except Exception as e:
        logger.error(f"Error uploading hospital info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload hospital info: {str(e)}")

@admin_router.get("/hospital-info/history", response_model=HospitalInfoHistory)
async def get_hospital_info_history(
    file_name: Optional[str] = None, 
    limit: int = 10, 
    offset: int = 0,
    user = Depends(verify_admin)
):
    """
    Get hospital info file upload history. Only accessible by admins.
    """
    try:
        query = supabase.table("hospital_info_files").select("*").order("uploaded_at", desc=True)
        
        # Filter by file_name if provided
        if file_name:
            query = query.eq("file_name", file_name)
            
        # Apply pagination
        query = query.range(offset, offset + limit - 1)
        
        # Execute query
        response = query.execute()
        
        # Get total count for pagination
        count_query = supabase.table("hospital_info_files").select("id", count="exact")
        if file_name:
            count_query = count_query.eq("file_name", file_name)
        count_response = count_query.execute()
        
        total_count = count_response.count if hasattr(count_response, 'count') else len(response.data)
        
        return HospitalInfoHistory(files=response.data, count=total_count)
    except Exception as e:
        logger.error(f"Error getting hospital info history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get hospital info history: {str(e)}")

@admin_router.put("/hospital-info/{file_id}/activate", response_model=HospitalInfoFile)
async def activate_hospital_info(file_id: str, user = Depends(verify_admin)):
    """
    Activate a specific hospital info file version. Only accessible by admins.
    """
    try:
        # First verify the file exists
        file_check = supabase.table("hospital_info_files").select("*").eq("id", file_id).execute()
        
        if not file_check.data or len(file_check.data) == 0:
            raise HTTPException(status_code=404, detail="Hospital info file not found")
            
        # Update the file to be active (DB trigger will deactivate all others)
        response = supabase.table("hospital_info_files").update({"is_active": True}).eq("id", file_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to activate hospital info file")
            
        logger.info(f"Hospital info file activated: {response.data[0]}")
        return response.data[0]
    except Exception as e:
        logger.error(f"Error activating hospital info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to activate hospital info: {str(e)}")

@admin_router.get("/hospital-info/active", response_model=Optional[HospitalInfoFile])
async def get_active_hospital_info(user = Depends(verify_admin)):
    """
    Get the currently active hospital info file. Only accessible by admins.
    """
    try:
        response = supabase.table("hospital_info_files").select("*").eq("is_active", True).execute()
        
        if not response.data or len(response.data) == 0:
            return None
            
        return response.data[0]
    except Exception as e:
        logger.error(f"Error getting active hospital info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get active hospital info: {str(e)}")
