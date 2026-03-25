import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for making authenticated admin requests
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
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

    // Get file data from request
    const fileData = await request.json()
    
    // Validate request
    if (!fileData.file_name || !fileData.file_content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Set user ID as the uploader
    fileData.uploaded_by = userData.user.id

    // Create a new hospital info file in Supabase
    const { data, error } = await adminSupabase
      .from('hospital_info_files')
      .insert([
        {
          file_name: fileData.file_name,
          file_content: fileData.file_content,
          is_active: fileData.is_active || false,  // Default to inactive if not specified
          uploaded_by: userData.user.id,
          notes: fileData.notes || null,
          scheduled_activation_time: fileData.scheduled_activation_time || null
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Error uploading to Supabase:', error)
      return NextResponse.json({ error: error.message || 'Failed to upload file' }, { status: 500 })
    }

    // If we're setting this file as active now, deactivate all others
    if (fileData.is_active) {
      const { error: updateError } = await adminSupabase
        .from('hospital_info_files')
        .update({ is_active: false })
        .neq('id', data.id)

      if (updateError) {
        console.error('Error deactivating other files:', updateError)
        // Continue anyway as the upload succeeded
      }
    }
    
    // If scheduled activation, make sure all other scheduled files with future dates
    // that were scheduled before this one are deactivated (only most recent schedule wins)
    if (fileData.scheduled_activation_time) {
      const { error: scheduleUpdateError } = await adminSupabase
        .from('hospital_info_files')
        .update({ scheduled_activation_time: null })
        .neq('id', data.id)
        .gt('scheduled_activation_time', new Date().toISOString()) // Only affect future scheduled activations
        .lt('uploaded_at', data.uploaded_at) // Only affect older uploads

      if (scheduleUpdateError) {
        console.error('Error updating other scheduled activations:', scheduleUpdateError)
        // Continue anyway as the upload succeeded
      }
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error uploading hospital info file:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
} 