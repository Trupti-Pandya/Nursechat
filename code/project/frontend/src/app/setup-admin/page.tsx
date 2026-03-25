'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Loader } from '@/components/ui/loader'

export default function SetupAdminPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success?: string; error?: string }>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResult({})

    try {
      const response = await fetch('/api/admin/create-first-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set admin rights')
      }

      setResult({ success: data.message })
    } catch (error) {
      setResult({ error: error.message || 'An error occurred' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-purple-500/30 to-green-500/30 blur-xl opacity-70 rounded-2xl"></div>
        
        <Card className="w-full relative shadow-lg flex flex-col overflow-hidden bg-white/20 backdrop-blur-md border-2 border-white/30 rounded-2xl">
          <CardHeader className="py-3 px-6 bg-white/15 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100/70 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none" 
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6 text-blue-500"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <path d="M16 6.37A4 4 0 1 1 12 4a4 4 0 0 1 4 2.37" />
                  <path d="M17 11h.01" />
                  <path d="M19 14h.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Setup First Admin User</h1>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="bg-white/30 backdrop-blur-md border border-white/20 rounded-xl shadow-sm p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter user email to grant admin rights"
                    className="w-full px-3 py-2 border border-white/30 rounded-lg shadow-sm placeholder-gray-400/70 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white/40 backdrop-blur-sm text-gray-800"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full flex justify-center py-2 px-4 rounded-full text-sm font-medium text-white bg-blue-500/80 hover:bg-blue-600/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm transition-colors"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : 'Grant Admin Rights'}
                </button>
              </form>

              {result.success && (
                <div className="mt-4 frosted-bubble-green">
                  {result.success}
                  <div className="mt-2">
                    <Link href="/login" className="text-blue-700 hover:text-blue-900 font-medium underline">
                      Go to Login
                    </Link>
                  </div>
                </div>
              )}

              {result.error && (
                <div className="mt-4 frosted-bubble-blue text-red-700 border-red-300 bg-red-100/60">
                  {result.error}
                </div>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="py-3 px-6 border-t border-white/10 bg-white/10 flex justify-center">
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Back to home
            </Link>
          </CardFooter>
        </Card>
      </div>

      {isLoading && (
        <div className="fixed inset-0 z-50 bg-white/30 backdrop-blur-sm dark:bg-gray-900/30 flex items-center justify-center">
          <Loader size="medium" color="primary" />
        </div>
      )}
    </div>
  )
} 