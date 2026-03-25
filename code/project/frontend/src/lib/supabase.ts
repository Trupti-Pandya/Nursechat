import { createClient } from '@supabase/supabase-js'

// Create a Supabase client using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function to check if a user is an admin
export async function isUserAdmin() {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false
  
  console.log('Checking admin status for user:', user)
  console.log('User metadata:', user.user_metadata)
  console.log('App metadata:', user.app_metadata)
  
  // Check in multiple possible locations
  return user.user_metadata?.isAdmin === true || 
         user.app_metadata?.isAdmin === true || 
         user.raw_user_meta_data?.isAdmin === true
}

// Helper function to get the current user
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
} 