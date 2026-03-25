'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader } from '@/components/ui/loader'
import { useToast } from '@/components/ui/toast-context'
import { User } from '@supabase/supabase-js'

type UserData = {
  user_id: string
  email: string
  created_at?: string
  metadata?: {
    isAdmin?: boolean
  }
  status?: string
}

type UserManagementProps = {
  users: UserData[]
  isLoading: boolean
  fetchUsers: () => void
  confirmAdminAction: (userId: string, currentStatus: boolean) => void
  currentUser: User | null
}

export function UserManagement({ 
  users, 
  isLoading, 
  fetchUsers,
  confirmAdminAction,
  currentUser
}: UserManagementProps) {
  const { showToast } = useToast()

  const updateAdminStatus = async (userId: string, currentStatus: boolean | undefined) => {
    // Call the confirm action handler
    confirmAdminAction(userId, currentStatus || false);
  }
  
  return (
    <div className="space-y-6">
      {/* User Statistics Section */}
      <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-xl shadow-sm p-4 dark:bg-gray-800/20 dark:border-gray-700/30">
        <h3 className="text-lg font-medium text-gray-800 mb-4 dark:text-gray-200">User Statistics</h3>
        <div className="flex justify-evenly">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium dark:text-gray-300">Total Users</p>
              <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">{users.length || '-'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6 text-green-600 dark:text-green-400"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M22 9h-6"></path>
                <path d="M19 12h-3"></path>
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium dark:text-gray-300">Admin Users</p>
              <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                {users.filter(u => u.metadata?.isAdmin).length || '-'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center dark:bg-amber-900/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6 text-amber-600 dark:text-amber-400"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium dark:text-gray-300">New Users (30d)</p>
              <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                {users.filter(u => {
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  return u.created_at && new Date(u.created_at) >= thirtyDaysAgo;
                }).length || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* User Management Section */}
      <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-xl shadow-sm dark:bg-gray-800/20 dark:border-gray-700/30">
        <div className="border-b border-white/30 px-4 py-3 bg-white/30 flex justify-between items-center dark:bg-gray-800/10 dark:border-gray-700/20">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">User Management</h3>
          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 shadow-sm hover:bg-blue-200 transition-colors border border-blue-200 disabled:opacity-70 text-sm dark:bg-blue-900/30 dark:border-blue-800/50 dark:hover:bg-blue-800/50"
            aria-label="Fetch Users"
          >
            {isLoading ? (
              <div className="flex items-center gap-1.5">
                <svg 
                  className="animate-spin w-4 h-4 text-blue-600 dark:text-blue-400" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-blue-600 font-medium text-sm dark:text-blue-400">Loading...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-blue-600 dark:text-blue-400"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span className="text-blue-600 font-medium text-sm dark:text-blue-400">Refresh Users</span>
              </div>
            )}
          </button>
        </div>
        
        <div className="p-4">
          <div className="overflow-x-auto bg-white/70 backdrop-blur-sm rounded-lg shadow-sm border border-white/40 dark:bg-gray-800/30 dark:border-gray-700/30">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700/40">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-300">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-300">
                    Admin Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/80 divide-y divide-gray-200 dark:bg-gray-800/20 dark:divide-gray-700/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <svg 
                          className="animate-spin w-8 h-8 text-blue-600 mb-3 dark:text-blue-400" 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-gray-600 dark:text-gray-400">Loading users...</p>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-gray-600 dark:text-gray-400">
                      No users to display. Click the refresh button to load user data.
                    </td>
                  </tr>
                ) : (
                  users.map((userData) => (
                    <tr key={userData.user_id} className="hover:bg-gray-50 transition-colors dark:hover:bg-gray-800/70">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-gray-200">
                        {userData.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full shadow-sm ${
                          userData.metadata?.isAdmin 
                            ? 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800/50' 
                            : 'bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                        }`}>
                          {userData.metadata?.isAdmin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          onClick={() => updateAdminStatus(userData.user_id, userData.metadata?.isAdmin)}
                          disabled={isLoading || (currentUser?.id === userData.user_id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium shadow-sm ${
                            userData.metadata?.isAdmin
                              ? 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/50 dark:hover:bg-amber-800/60'
                              : 'bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/50 dark:hover:bg-blue-800/60'
                          } ${(isLoading || (currentUser?.id === userData.user_id)) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'} transition-colors`}
                        >
                          {userData.metadata?.isAdmin 
                            ? (userData.user_id === currentUser?.id ? 'Forfeit Admin' : 'Remove Admin')
                            : 'Make Admin'
                          }
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
} 