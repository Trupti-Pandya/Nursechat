import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for making authenticated admin requests
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get file ID from params
    const { id } = params
    
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

    // Check if file exists
    const { data: fileExists, error: fileExistsError } = await adminSupabase
      .from('hospital_info_files')
      .select('id')
      .eq('id', id)
      .single()
    
    if (fileExistsError || !fileExists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Start a transaction
    // First deactivate all files
    const { error: deactivateError } = await adminSupabase
      .from('hospital_info_files')
      .update({ is_active: false })
      .neq('id', 'none') // This will update all rows
    
    if (deactivateError) {
      console.error('Error deactivating other files:', deactivateError)
      return NextResponse.json({ error: 'Failed to deactivate other files' }, { status: 500 })
    }
    
    // Then activate the specified file
    const { data: activatedFile, error: activateError } = await adminSupabase
      .from('hospital_info_files')
      .update({ 
        is_active: true,
        scheduled_activation_time: null // Clear any scheduled time since it's active now
      })
      .eq('id', id)
      .select()
      .single()
    
    if (activateError) {
      console.error('Error activating file:', activateError)
      return NextResponse.json({ error: 'Failed to activate file' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      file: activatedFile
    })
  } catch (error: any) {
    console.error('Error activating hospital info file:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
} 