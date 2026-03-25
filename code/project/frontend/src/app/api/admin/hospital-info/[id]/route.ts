import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for making authenticated admin requests
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get file ID from params
    const { id } = await params
    
    if (!id) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }

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

    // Get file by ID
    const { data: file, error } = await adminSupabase
      .from('hospital_info_files')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Error fetching hospital info file:', error)
      return NextResponse.json({ error: error.message || 'Failed to fetch file' }, { status: 500 })
    }

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      id: file.id,
      file_name: file.file_name,
      content: file.file_content,
      is_active: file.is_active,
      uploaded_at: file.uploaded_at,
      uploaded_by: file.uploaded_by,
      activation_time: file.scheduled_activation_time
    })
  } catch (error: any) {
    console.error('Error fetching hospital info file:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
} 