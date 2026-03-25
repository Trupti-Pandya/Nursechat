import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    // Extract the request body
    const body = await request.json();
    
    // Prepare request body for backend
    const backendRequest = {
      session_id: body.session_id,
      message: body.message,
    };
    
    // Handle multiple documents if available
    if (body.documents && Array.isArray(body.documents)) {
      backendRequest.documents = body.documents;
      console.log(`Chat API received ${body.documents.length} documents`);
    } 
    // Legacy single document handling
    else if (body.document_content) {
      backendRequest.document_content = body.document_content;
      
      // Add document metadata if available
      if (body.document_metadata) {
        backendRequest.document_metadata = body.document_metadata;
      }
      
      // Add filename and file type if available
      if (body.document_metadata?.fileName) {
        backendRequest.file_name = body.document_metadata.fileName;
      }
      
      if (body.document_metadata?.fileType) {
        backendRequest.file_type = body.document_metadata.fileType;
      }
      
      // Log document content for debugging
      console.log("Chat API received document content:", 
        body.document_content ? `${body.document_content.substring(0, 200)}...` : "None");
    }
    
    // Make a direct POST request to the backend
    const response = await axios.post('http://localhost:8000/ai/chat', backendRequest, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Prevent credentials which trigger OPTIONS preflight requests
      withCredentials: false
    });
    
    // Return the response data with CORS headers
    return NextResponse.json(response.data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Error forwarding request to backend:', error);
    
    // Return appropriate error message
    let status = 500;
    let message = 'Internal server error';
    
    if (error.response) {
      status = error.response.status;
      message = error.response.data?.detail || 'Error from backend service';
    } else if (error.request) {
      status = 503;
      message = 'Backend service unavailable';
    }
    
    // Return error with CORS headers
    return NextResponse.json({ error: message }, { 
      status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
}

// Handle OPTIONS requests to prevent CORS errors
export async function OPTIONS(request: Request) {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
} 