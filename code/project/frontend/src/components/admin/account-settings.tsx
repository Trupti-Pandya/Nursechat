'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader } from '@/components/ui/loader'
import { User } from '@supabase/supabase-js'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function AccountSettings({ user }: { user: User }) {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Handle password change
  const handlePasswordChange = async () => {
    try {
      // Validate password
      if (password.length < 6) {
        setPasswordError('Password must be at least 6 characters')
        return
      }
      
      if (password !== confirmPassword) {
        setPasswordError('Passwords do not match')
        return
      }
      
      setPasswordError('')
      setIsLoading(true)
      setMessage({ text: '', type: '' })
      
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      })
      
      if (error) throw error
      
      setMessage({ 
        text: 'Password changed successfully', 
        type: 'success' 
      })
      
      // Close dialog and reset form
      setShowPasswordDialog(false)
      setPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      setMessage({ 
        text: error.message || 'Failed to change password', 
        type: 'error' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPasswordDialog(false)
          setPassword('')
          setConfirmPassword('')
          setPasswordError('')
        }
      }}>
        <DialogContent className="bg-white/80 backdrop-blur-md border border-white/40 shadow-lg dark:bg-gray-800/80 dark:border-gray-700/40">
          <DialogHeader>
            <DialogTitle className="text-gray-800 font-semibold dark:text-gray-200">Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                New Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white/50 border border-white/40 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700/30 dark:border-gray-600/30 dark:text-gray-200"
                placeholder="Enter new password"
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white/50 border border-white/40 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700/30 dark:border-gray-600/30 dark:text-gray-200"
                placeholder="Confirm new password"
              />
            </div>
            
            {passwordError && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {passwordError}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false)
                setPassword('')
                setConfirmPassword('')
                setPasswordError('')
              }}
              className="bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-300 hover:bg-gray-100/90 dark:hover:bg-gray-700/90 border border-gray-200/70 dark:border-gray-700/50"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={isLoading || !password || !confirmPassword || !!passwordError}
              className="bg-amber-500/70 hover:bg-amber-500/80 text-white backdrop-blur-md shadow-sm border border-amber-400/40 dark:border-amber-500/30 dark:bg-amber-600/30 dark:hover:bg-amber-600/40"
            >
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Account Info Card */}
      <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-xl shadow-sm p-5 dark:bg-gray-800/20 dark:border-gray-700/30">
        <h3 className="text-lg font-medium text-gray-800 mb-4 dark:text-gray-200">Account Information</h3>
        
        {message.text && (
          <div className={`mb-4 p-3 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50' 
              : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50'
          }`}>
            {message.text}
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 bg-gray-100/50 border border-white/40 rounded-md shadow-sm text-gray-500 cursor-not-allowed dark:bg-gray-800/30 dark:border-gray-700/30 dark:text-gray-400"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Email address cannot be changed</p>
          </div>
        </div>
      </div>
      
      {/* Account Actions */}
      <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-xl shadow-sm p-5 dark:bg-gray-800/20 dark:border-gray-700/30">
        <h3 className="text-lg font-medium text-red-600 mb-4 dark:text-red-400">Account Actions</h3>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">Change your account password</p>
            <button
              onClick={() => setShowPasswordDialog(true)}
              disabled={isLoading}
              className="mt-2 px-4 py-2 bg-amber-500/70 backdrop-blur-sm text-white rounded-lg hover:bg-amber-600/70 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors dark:bg-amber-600/70 dark:hover:bg-amber-500/70 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 z-50 bg-white/30 backdrop-blur-sm dark:bg-gray-900/30 flex items-center justify-center">
          <Loader size="large" color="primary" />
        </div>
      )}
    </div>
  )
} 