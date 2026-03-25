'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isUserAdmin } from './supabase'
import { Session, User } from '@supabase/supabase-js'

// Define user profile interface
interface UserProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
}

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  signOut: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Process user metadata and extract profile information
  const processUserMetadata = (user: User | null) => {
    if (!user) {
      setProfile(null)
      return
    }
    
    const metadata = user.user_metadata || {};
    const firstName = metadata.first_name || metadata.given_name || '';
    const lastName = metadata.last_name || metadata.family_name || '';
    
    // For social logins, the names might come from different places
    const fullName = metadata.full_name || metadata.name || `${firstName} ${lastName}`.trim();
    
    setProfile({
      firstName,
      lastName,
      fullName: fullName || user.email || 'User',
      email: user.email || '',
    });
  };

  useEffect(() => {
    // Initial session check
    const initializeAuth = async () => {
      try {
        // Check for existing session in browser storage first for a faster response
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          setSession(session)
          setUser(session.user ?? null)
          processUserMetadata(session.user)
          
          // Simplified admin check
          const adminStatus = 
            session.user.user_metadata?.isAdmin === true || 
            session.user.app_metadata?.isAdmin === true ||
            session.user.raw_user_meta_data?.isAdmin === true;
          
          setIsAdmin(adminStatus)
        }
      } catch (error) {
        console.error('Error loading auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        processUserMetadata(session?.user ?? null)
        
        if (session?.user) {
          // Simplified admin check to avoid extra API call
          const adminStatus = 
            session.user.user_metadata?.isAdmin === true || 
            session.user.app_metadata?.isAdmin === true ||
            session.user.raw_user_meta_data?.isAdmin === true;
          
          setIsAdmin(adminStatus)
        } else {
          setIsAdmin(false)
        }
        
        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      // Clear local state on signout
      setUser(null)
      setSession(null)
      setProfile(null)
      setIsAdmin(false)
      
      // Redirect will happen via the auth state change listener
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
} 