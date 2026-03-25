import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for making authenticated admin requests
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get user drafts
export async function GET(request: NextRequest) {
  try {
    // Get user ID from query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get user's draft
    const { data, error } = await adminSupabase
      .from('hospital_info_drafts')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
      console.error('Error fetching hospital info draft:', error);
      return NextResponse.json({ error: error.message || 'Failed to fetch draft' }, { status: 500 });
    }

    // If no draft found, return empty response
    if (!data) {
      return NextResponse.json({ draft: null });
    }

    return NextResponse.json({ draft: data });
  } catch (error: any) {
    console.error('Error fetching hospital info draft:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// Save or update user draft
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { userId, content, metadata, notes } = await request.json();

    if (!userId || !content) {
      return NextResponse.json(
        { error: "Missing required fields (userId, content)" },
        { status: 400 }
      );
    }

    // Check if user already has a draft
    const { data: existingDraft, error: fetchError } = await adminSupabase
      .from('hospital_info_drafts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing draft:', fetchError);
      return NextResponse.json({ error: 'Failed to check for existing draft' }, { status: 500 });
    }

    let result;
    
    if (existingDraft) {
      // Update existing draft
      const { data, error } = await adminSupabase
        .from('hospital_info_drafts')
        .update({
          content,
          metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDraft.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating hospital info draft:', error);
        return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
      }

      result = data;
    } else {
      // Insert new draft
      const { data, error } = await adminSupabase
        .from('hospital_info_drafts')
        .insert([{
          user_id: userId,
          content,
          metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
          notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error inserting hospital info draft:', error);
        return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
      }

      result = data;
    }

    return NextResponse.json({
      success: true,
      message: "Draft saved successfully",
      draft: result
    });
  } catch (error: any) {
    console.error('Error in hospital info drafts API:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// Delete user draft
export async function DELETE(request: NextRequest) {
  try {
    // Get user ID from query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Delete the user's draft
    const { error } = await adminSupabase
      .from('hospital_info_drafts')
      .delete()
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting hospital info draft:', error);
      return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Draft deleted successfully"
    });
  } catch (error: any) {
    console.error('Error deleting hospital info draft:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
} 