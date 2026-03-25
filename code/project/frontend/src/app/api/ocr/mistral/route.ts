import { NextRequest, NextResponse } from 'next/server';

// Backend API endpoint for Mistral OCR
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  console.log("OCR endpoint called");
  
  try {
    // Get form data with the uploaded file
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error("No file provided");
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    const fileType = file.type;
    console.log(`File received: ${file.name}, type: ${fileType}, size: ${file.size / 1024} KB`);
    
    if (!fileType.startsWith('image/') && fileType !== 'application/pdf') {
      console.error(`Invalid file type: ${fileType}`);
      return NextResponse.json(
        { error: 'File must be an image or PDF' },
        { status: 400 }
      );
    }
    
    // Create a new FormData to send to the backend
    const backendFormData = new FormData();
    backendFormData.append('file', file);
    
    // Forward the request to the backend service
    console.log(`Sending request to backend: ${BACKEND_URL}/ocr/mistral`);
    const backendResponse = await fetch(`${BACKEND_URL}/ocr/mistral`, {
      method: 'POST',
      body: backendFormData,
    });

    console.log(`Backend response status: ${backendResponse.status}`);
    
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => null);
      const errorText = errorData?.detail || await backendResponse.text() || "Unknown error";
      console.error('Backend OCR API error:', errorText);
      return NextResponse.json(
        { error: `OCR processing error: ${errorText}` },
        { status: backendResponse.status }
      );
    }

    // Return the results from the backend
    const data = await backendResponse.json();
    console.log("OCR processing successful");
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('OCR frontend API error:', errorMessage);
    return NextResponse.json(
      { error: `Failed to process document: ${errorMessage}` },
      { status: 500 }
    );
  }
} 