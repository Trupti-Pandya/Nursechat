import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for making authenticated admin requests
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies or headers (not currently using it since we're using service role key)
    // const token = getCookieOrHeaderToken(request)
    
    // No auth check here as this is public info that can be accessed by the chat application
    // For safety, we only return the active info, not draft documents
    
    // Fetch the active hospital info
    const { data, error } = await adminSupabase
      .from('hospital_info_files')
      .select('*')
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error("Database error fetching active hospital info:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ active: data })
  } catch (error) {
    console.error("Error in GET /api/admin/hospital-info/active:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 