import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for making authenticated admin requests
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization')
    let token

    // Try to get token from headers first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]
    }
    
    // If no token in headers, try to get it from cookies/session
    if (!token) {
      const { data: { session } } = await adminSupabase.auth.getSession()
      token = session?.access_token
    }
    
    // If still no token, return unauthorized
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - No valid token found' }, { status: 401 })
    }

    // Verify token and get user
    const { data: userData, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
    }

    // Check if user is admin
    const isAdmin = userData.user?.user_metadata?.isAdmin
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get files ordered by upload date (newest first)
    const { data: files, error } = await adminSupabase
      .from('hospital_info_files')
      .select('*')
      .order('uploaded_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching hospital info files:', error)
      return NextResponse.json({ error: error.message || 'Failed to fetch file history' }, { status: 500 })
    }

    return NextResponse.json({ files })
  } catch (error: any) {
    console.error('Error fetching hospital info file history:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
} 