import { NextResponse } from 'next/server';
import axios from 'axios';

// This endpoint is now only used as a fallback
// and not for continuous health checking
export async function GET() {
  try {
    // Test connection to the real backend by sending a simple POST request
    // The chat endpoint only accepts POST requests (not GET)
    await axios.post('http://localhost:8000/ai/chat', {
      session_id: 'health-check',
      message: 'ping'
    }, {
      // Prevent credentials which trigger OPTIONS preflight requests
      withCredentials: false
    });
    
    return NextResponse.json({ status: 'ok' }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Backend health check failed:', error);
    // Return 503 status to indicate service unavailability
    return NextResponse.json({ status: 'error' }, { 
      status: 503,
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