'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/components/theme-provider'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader, FullScreenLoader } from '@/components/ui/loader'
import { Provider } from '@supabase/supabase-js'

// Alert component for displaying messages
function AlertPopup({ message, type, onClose, redirectTimer, onLoginClick }: { 
  message: string; 
  type: 'success' | 'error'; 
  onClose: () => void;
  redirectTimer?: number;
  onLoginClick?: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/20 backdrop-blur-sm">
      <div className={`relative w-full max-w-sm rounded-xl shadow-lg overflow-hidden transition-all duration-300 transform scale-100 opacity-100 animate-fade-in
        ${type === 'success' ? 'bg-gradient-to-br from-green-400/90 to-green-600/90' : 'bg-gradient-to-br from-red-400/90 to-red-600/90'}
        border border-white/30 p-0.5
      `}>
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 relative">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="ml-3 w-0 flex-1 pr-8">
              <h3 className={`text-lg font-medium ${type === 'success' ? 'text-green-900' : 'text-red-900'}`}>
                {type === 'success' ? 'Success' : 'Error'}
              </h3>
              <p className="mt-1 text-sm text-gray-700">{message}</p>
              
              {redirectTimer !== undefined && (
                <p className="mt-2 text-sm font-medium text-gray-700">
                  You will be redirected to login in {redirectTimer} second{redirectTimer !== 1 ? 's' : ''}
                </p>
              )}
              
              {onLoginClick && (
                <div className="mt-3">
                  <Button 
                    type="button"
                    variant="outline"
                    className="text-green-700 border-green-600/30 hover:bg-green-50 text-sm"
                    onClick={onLoginClick}
                  >
                    Login Now
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Social login button component
function SocialButton({ provider, icon, label }: { provider: Provider; icon: React.ReactNode; label: string }) {
  const signInWithProvider = async () => {
    const redirectUrl = `${window.location.origin}/login`;
    console.log("Redirecting to:", redirectUrl); // For debugging
    
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        redirectTo: redirectUrl,
      },
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-12 h-12 rounded-full flex items-center justify-center bg-white/40 hover:bg-white/60 hover:scale-105 transition-all duration-200 shadow-sm"
      onClick={signInWithProvider}
      aria-label={`Continue with ${label}`}
    >
      {icon}
    </Button>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading, isAdmin } = useAuth()
  const { setTheme } = useTheme()
  const [authView, setAuthView] = useState<'sign_in' | 'sign_up'>('sign_in')
  
  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Alert state
  const [alert, setAlert] = useState<{message: string; type: 'success' | 'error'} | null>(null)
  const [redirectTimer, setRedirectTimer] = useState<number | undefined>(undefined)
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Check for query param message on load
  useEffect(() => {
    const message = searchParams.get('message')
    if (message) {
      setAlert({
        message,
        type: 'success'
      })
      // Clean up the URL
      router.replace('/login')
    }
  }, [searchParams, router])
  
  // Force light mode on login page
  useEffect(() => {
    // Set theme to light mode when login page loads
    setTheme('light')
    
    // Remove any dark mode classes that might be applied
    document.documentElement.classList.remove('dark')
    document.documentElement.setAttribute('data-theme', 'light')
  }, [setTheme])
  
  useEffect(() => {
    // If user is logged in, redirect based on role
    if (user && !isLoading) {
      if (isAdmin) {
        // If admin, redirect to admin dashboard
        router.push('/admin/dashboard')
      } else {
        // If regular user, redirect to main nursechat page
        router.push('/')
      }
    }
  }, [user, isLoading, isAdmin, router])

  // Timer effect for auto-redirect countdown
  useEffect(() => {
    if (redirectTimer !== undefined && redirectTimer > 0) {
      const timer = setTimeout(() => {
        setRedirectTimer(redirectTimer - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (redirectTimer === 0) {
      // When timer reaches 0, reset timer and close alert
      setRedirectTimer(undefined);
      setAlert(null);
      setAuthView('sign_in');
    }
  }, [redirectTimer]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
    } catch (err: any) {
      setAlert({
        message: err.message || 'Failed to sign in',
        type: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (password !== confirmPassword) {
      setAlert({
        message: 'Passwords do not match',
        type: 'error'
      })
      setIsSubmitting(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (error) throw error
      
      // Show success message with timer
      setAlert({
        message: 'Check your email to confirm your account',
        type: 'success'
      })
      setRedirectTimer(5);
      
      // Clear form fields after successful signup
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setFirstName('')
      setLastName('')
    } catch (err: any) {
      setAlert({
        message: err.message || 'An error occurred during signup',
        type: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle immediate login button click
  const handleLoginClick = () => {
    setAlert(null);
    setRedirectTimer(undefined);
    setAuthView('sign_in');
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-white/30 backdrop-blur-sm flex items-center justify-center">
        <Loader size="medium" color="primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 py-8 overflow-auto">
      {alert && (
        <AlertPopup
          message={alert.message}
          type={alert.type}
          onClose={() => {
            setAlert(null);
            setRedirectTimer(undefined);
          }}
          redirectTimer={alert.type === 'success' && authView === 'sign_up' ? redirectTimer : undefined}
          onLoginClick={alert.type === 'success' && authView === 'sign_up' ? handleLoginClick : undefined}
        />
      )}
      
      <div className="w-full max-w-md relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/30 via-amber-500/30 to-blue-500/30 blur-xl opacity-70 rounded-2xl"></div>
        
        <Card className="w-full relative shadow-lg flex flex-col overflow-hidden bg-white/60 backdrop-blur-md border-2 border-white/30 rounded-2xl">
          <CardHeader className="py-2 px-4 bg-white/40 border-b border-white/30">
            <div className="flex justify-center">
              <Link href="/" className="text-center inline-flex items-center justify-center hover:opacity-80 transition-opacity">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none" 
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6 text-green-600 mr-2 flex-shrink-0"
                >
                  <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
                  <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
                  <circle cx="20" cy="10" r="2" />
                </svg>
                <h1 className="text-xl font-bold text-gray-800 flex items-center">NurseChat</h1>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <div className="bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl shadow-sm p-4">
              <div className="mb-4 text-center">
                <h2 className="text-xl font-semibold text-gray-800 mb-1">
                  {authView === 'sign_in' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-sm text-gray-600">
                  {authView === 'sign_in' 
                    ? 'Enter your credentials to continue' 
                    : 'Join NurseChat to access all features'}
                </p>
              </div>
              
              {authView === 'sign_in' ? (
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="backdrop-blur-sm bg-white/40 text-gray-900 shadow-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="backdrop-blur-sm bg-white/40 text-gray-900 shadow-sm pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        onMouseDown={() => setShowPassword(true)}
                        onMouseUp={() => setShowPassword(false)}
                        onMouseLeave={() => setShowPassword(false)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-500/60 to-green-500/60 hover:from-blue-500/80 hover:to-green-500/80 text-white font-semibold backdrop-blur-md shadow-md border border-white/30 transition-all duration-200 py-5 rounded-xl hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <Loader size="small" color="white" />
                        <span className="ml-2">Signing in...</span>
                      </span>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
                  
                  <div className="text-center mt-2">
                    <button
                      type="button"
                      onClick={() => setAuthView('sign_up')}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Need an account? Register here
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="firstName" className="text-sm">First Name</Label>
                      <Input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        className="backdrop-blur-sm bg-white/40 text-gray-900 shadow-sm h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lastName" className="text-sm">Last Name</Label>
                      <Input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        className="backdrop-blur-sm bg-white/40 text-gray-900 shadow-sm h-9"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="signupEmail" className="text-sm">Email Address</Label>
                    <Input
                      id="signupEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="backdrop-blur-sm bg-white/40 text-gray-900 shadow-sm h-9"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="signupPassword" className="text-sm">Password</Label>
                    <div className="relative">
                      <Input
                        id="signupPassword"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="backdrop-blur-sm bg-white/40 text-gray-900 shadow-sm h-9 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        onMouseDown={() => setShowPassword(true)}
                        onMouseUp={() => setShowPassword(false)}
                        onMouseLeave={() => setShowPassword(false)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="confirmPassword" className="text-sm">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="backdrop-blur-sm bg-white/40 text-gray-900 shadow-sm h-9 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        onMouseDown={() => setShowConfirmPassword(true)}
                        onMouseUp={() => setShowConfirmPassword(false)}
                        onMouseLeave={() => setShowConfirmPassword(false)}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-500/60 to-green-500/60 hover:from-blue-500/80 hover:to-green-500/80 text-white font-semibold backdrop-blur-md shadow-md border border-white/30 transition-all duration-200 py-5 rounded-xl hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] mt-2"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <Loader size="small" color="white" />
                        <span className="ml-2">Creating Account...</span>
                      </span>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                  
                  <div className="text-center mt-1">
                    <button
                      type="button"
                      onClick={() => setAuthView('sign_in')}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Already have an account? Sign in
                    </button>
                  </div>
                </form>
              )}
              
              <div className="mt-5">
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-white/40"></div>
                  <span className="mx-3 flex-shrink text-xs text-gray-600 px-2">or continue with</span>
                  <div className="flex-grow border-t border-white/40"></div>
                </div>
                
                <div className="mt-4 flex justify-center gap-4">
                  <SocialButton 
                    provider="google" 
                    label="Google"
                    icon={
                      <svg viewBox="0 0 24 24" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                          <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                          <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                          <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                          <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                        </g>
                      </svg>
                    }
                  />
                  
                  <SocialButton 
                    provider="github" 
                    label="GitHub"
                    icon={
                      <svg viewBox="0 0 24 24" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="py-2 px-4 border-t border-white/30 bg-white/40 flex justify-center">
            <p className="text-xs text-gray-500">
                ✨ Empowering healthcare professionals with AI ✨
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 