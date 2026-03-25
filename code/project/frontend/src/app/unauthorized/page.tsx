'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardFooter } from "@/components/ui/card"

export default function UnauthorizedPage() {
  const { signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    // Redirect to login page after signing out
    setTimeout(() => {
      router.push('/login')
    }, 100)
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md relative">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/30 via-amber-500/30 to-blue-500/30 blur-xl opacity-70 rounded-2xl"></div>
        
        <Card className="w-full relative shadow-lg flex flex-col overflow-hidden bg-white/20 backdrop-blur-md border-2 border-white/30 rounded-2xl">
          <CardContent className="p-8 flex flex-col items-center">
            <div className="text-red-500 dark:text-red-400 mb-6 w-16 h-16 rounded-full bg-red-100/50 flex items-center justify-center backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Access Denied</h1>
            
            <div className="frosted-bubble-blue text-center mb-6 bg-red-100/20 border-red-300/20 text-gray-800">
              You do not have permission to access the admin dashboard. 
              This area is restricted to users with administrator privileges.
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 w-full">
              <Link 
                href="/"
                className="px-4 py-2 text-center bg-blue-500/80 hover:bg-blue-600/80 text-white rounded-full text-sm font-medium backdrop-blur-sm transition-colors"
              >
                Return Home
              </Link>
              
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-center bg-white/30 hover:bg-white/40 text-gray-800 rounded-full text-sm font-medium backdrop-blur-sm transition-colors border border-white/30"
              >
                Sign Out
              </button>
            </div>
          </CardContent>
          
          <CardFooter className="px-8 pb-6 pt-0">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center w-full">
              If you believe you should have access to this page, please contact your system administrator.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 