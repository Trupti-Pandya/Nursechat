import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Apply to both /api and /ai routes
  if (request.nextUrl.pathname.startsWith('/api/') || request.nextUrl.pathname.startsWith('/ai/')) {
    // Clone the request headers
    const requestHeaders = new Headers(request.headers);
    
    // Add CORS headers to the response
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  }
  
  return NextResponse.next();
}

// Run the middleware on both API and AI routes
export const config = {
  matcher: ['/api/:path*', '/ai/:path*'],
}; 