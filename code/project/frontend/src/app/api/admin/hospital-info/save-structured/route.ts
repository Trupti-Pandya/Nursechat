import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    // Parse request body
    const { 
      content, 
      metadata, 
      notes, 
      is_active = false, 
      scheduled_activation_time = null,
      uploaded_by = null // Extract uploaded_by from request
    } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Missing required content field" },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse metadata
    let parsedMetadata;
    try {
      parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    } catch (e) {
      console.error("Error parsing metadata:", e);
      return NextResponse.json(
        { error: "Invalid metadata format" },
        { status: 400 }
      );
    }

    // Generate filename from metadata or use timestamp
    const filename = parsedMetadata?.hospital_name 
      ? `${parsedMetadata.hospital_name.replace(/\s+/g, '_').toLowerCase()}_info.md` 
      : `hospital_info_${Date.now()}.md`;

    // Prepare the data object to insert
    const insertData = {
      file_name: filename,
      file_content: content,
      version: parseInt(parsedMetadata?.version) || 1,
      is_active: is_active, // Use the provided activation status
      scheduled_activation_time: scheduled_activation_time,
      notes: notes || null,
    };

    // Only add uploaded_by if it's provided
    if (uploaded_by) {
      insertData.uploaded_by = uploaded_by;
    } else {
      // Skip trying to get user from session to avoid profile queries
      // Just log that no user ID was provided
      console.warn("No user ID provided in the request");
    }

    // Insert the new file
    const { data, error } = await supabase
      .from("hospital_info_files")
      .insert([insertData])
      .select();

    if (error) {
      console.error("Error inserting hospital info:", error);
      console.error("Attempted to insert data:", insertData);
      return NextResponse.json(
        { error: `Failed to save hospital information: ${error.message}` },
        { status: 500 }
      );
    }

    // If file is set as active, deactivate all other files
    if (is_active && data && data.length > 0) {
      const fileId = data[0].id;
      
      const { error: deactivateError } = await supabase
        .from("hospital_info_files")
        .update({ is_active: false })
        .neq('id', fileId);
      
      if (deactivateError) {
        console.error("Error deactivating other files:", deactivateError);
        // Continue anyway as the upload succeeded
      }
    }
    
    // If a scheduled activation time is set, make sure any previously scheduled activations are cleared
    if (scheduled_activation_time && data && data.length > 0) {
      const fileId = data[0].id;
      
      const { error: scheduleUpdateError } = await supabase
        .from("hospital_info_files")
        .update({ scheduled_activation_time: null })
        .neq('id', fileId)
        .gt('scheduled_activation_time', new Date().toISOString()); // Only affect future scheduled activations
      
      if (scheduleUpdateError) {
        console.error("Error updating other scheduled activations:", scheduleUpdateError);
        // Continue anyway as the upload succeeded
      }
    }

    return NextResponse.json({
      success: true,
      message: is_active 
        ? "Hospital information saved and activated successfully" 
        : scheduled_activation_time 
          ? "Hospital information saved and scheduled for activation" 
          : "Hospital information saved successfully",
      data,
    });
  } catch (error) {
    console.error("Error in save-structured API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 