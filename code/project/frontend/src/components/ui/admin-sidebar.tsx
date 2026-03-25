'use client'

import React, { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/components/theme-provider'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { TiDocumentText } from "react-icons/ti"
import { CircleUserRound, FileUp } from "lucide-react"

interface AdminSidebarProps {
  user: any;
  signOut: () => Promise<void>;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function AdminSidebar({ 
  user, 
  signOut, 
  isCollapsed, 
  setIsCollapsed, 
  activeTab, 
  setActiveTab 
}: AdminSidebarProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isHovering, setIsHovering] = useState(false)
  const [showSignOutDialog, setShowSignOutDialog] = useState(false)

  // Auto-collapse behavior
  useEffect(() => {
    const shouldBeExpanded = isHovering
    
    const timer = setTimeout(() => {
      setIsCollapsed(!shouldBeExpanded)
    }, shouldBeExpanded ? 0 : 500)
    
    return () => clearTimeout(timer)
  }, [isHovering, setIsCollapsed])

  const handleSignOutClick = () => {
    setShowSignOutDialog(true)
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      // Force navigation to the login page
      router.push('/login');
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  }

  return (
    <>
      <div 
        className={`bg-white/30 backdrop-blur-sm border-r border-white/40 flex flex-col justify-center h-screen transition-all duration-300 ease-in-out overflow-hidden dark:bg-gray-800/20 dark:border-gray-700/30 ${isCollapsed ? 'w-16' : 'w-64'}`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Main menu - now centered vertically */}
        <div className="flex-grow flex items-center justify-center overflow-x-hidden">
          <div className="w-full px-3 space-y-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'dashboard' 
                  ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30' 
                  : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-700/20'
              }`}
            >
              <svg className={`${activeTab === 'dashboard' ? 'w-7 h-7' : 'w-6 h-6'} flex-shrink-0`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="5" rx="2" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="12" width="7" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="16" width="7" height="5" rx="2" stroke="currentColor" strokeWidth="2" />
              </svg>
              
              {!isCollapsed && (
                <span className="ml-3 truncate">Dashboard</span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'users' 
                  ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30' 
                  : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-700/20'
              }`}
            >
              <svg className={`${activeTab === 'users' ? 'w-7 h-7' : 'w-6 h-6'} flex-shrink-0`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              
              {!isCollapsed && (
                <span className="ml-3 truncate">Users</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('hospital')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'hospital' 
                  ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30' 
                  : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-700/20'
              }`}
            >
              <FileUp className={`${activeTab === 'hospital' ? 'w-7 h-7' : 'w-6 h-6'} flex-shrink-0`} />
              
              {!isCollapsed && (
                <span className="ml-3 truncate">Upload Doc</span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('filehistory')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'filehistory' 
                  ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30' 
                  : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-700/20'
              }`}
            >
              <svg className={`${activeTab === 'filehistory' ? 'w-7 h-7' : 'w-6 h-6'} flex-shrink-0`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              
              {!isCollapsed && (
                <span className="ml-3 truncate">File History</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('structured')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'structured' 
                  ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30' 
                  : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-700/20'
              }`}
            >
              <svg className={`${activeTab === 'structured' ? 'w-7 h-7' : 'w-6 h-6'} flex-shrink-0`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M7 8h10M7 12h10M7 16h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              
              {!isCollapsed && (
                <span className="ml-3 truncate">Update Hospital Info</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'account' 
                  ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30' 
                  : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-gray-700/20'
              }`}
            >
              <CircleUserRound className={`${activeTab === 'account' ? 'w-7 h-7' : 'w-6 h-6'} flex-shrink-0`} />
              
              {!isCollapsed && (
                <span className="ml-3 truncate">Account</span>
              )}
            </button>

            <button
              onClick={handleSignOutClick}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} px-3 py-2 rounded-lg transition-colors text-gray-700 hover:bg-white/30 dark:text-gray-300 dark:hover:bg-gray-700/20`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6 flex-shrink-0 text-red-500 dark:text-red-400"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              
              {!isCollapsed && (
                <span className="ml-3 truncate">Sign Out</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sign Out Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showSignOutDialog}
        onClose={() => setShowSignOutDialog(false)}
        onConfirm={handleSignOut}
        title="Sign Out Confirmation"
        description="Are you sure you want to sign out from the admin dashboard?"
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  )
} 