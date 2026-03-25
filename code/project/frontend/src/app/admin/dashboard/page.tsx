'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/components/theme-provider'
import { supabase } from '@/lib/supabase'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { AdminSidebar } from '@/components/ui/admin-sidebar'
import { AdminHeader } from '@/components/ui/admin-header'
import { DashboardOverview } from '@/components/admin/dashboard-overview'
import { UserManagement } from '@/components/admin/user-management'
import { AccountSettings } from "@/components/admin/account-settings"
import { HospitalInfoUpload } from '@/components/admin/hospital-info-upload'
import { HospitalInfoStructured } from '@/components/admin/hospital-info-structured'
import { FullScreenLoader } from '@/components/ui/loader'
import { useToast } from '@/components/ui/toast-context'
import { FileHistory } from '@/components/admin/file-history'

export default function AdminDashboard() {
  const router = useRouter()
  const { user, isLoading, isAdmin, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [users, setUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isUpdatingUser, setIsUpdatingUser] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const { showToast } = useToast()
  const [showForfeitDialog, setShowForfeitDialog] = useState(false)
  const [pendingUserId, setPendingUserId] = useState(null)
  const [pendingCurrentStatus, setPendingCurrentStatus] = useState(null)
  const [dialogTitle, setDialogTitle] = useState('')
  const [dialogDescription, setDialogDescription] = useState('')
  const [dialogConfirmText, setDialogConfirmText] = useState('OK')
  const [dialogVariant, setDialogVariant] = useState<'default' | 'destructive'>('default')
  
  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')

  // Tabs for different sections of the dashboard
  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "users", label: "Users" },
    { id: "hospital", label: "Upload Doc" },
    { id: "filehistory", label: "File History" },
    { id: "structured", label: "Update Hospital Info" },
    { id: "account", label: "Account Settings" },
  ]

  useEffect(() => {
    // If not loading and either not logged in or not admin, redirect
    if (!isLoading) {
      if (!user) {
        router.push('/login')
      } else if (!isAdmin) {
        router.push('/unauthorized')
      }
    }
  }, [user, isLoading, isAdmin, router])

  // Add new useEffect to load users data when users tab is selected
  useEffect(() => {
    if (activeTab === 'users' && user && isAdmin && !isLoadingUsers && users.length === 0) {
      fetchUsers();
    }
  }, [activeTab, user, isAdmin]);

  const fetchUsers = async () => {
    try {
      // Show loading state in the button only, not full screen
      setIsLoadingUsers(true)
      setError('')
      
      // Remove success message timeout
      setSuccessMessage('')
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      
      if (!accessToken) {
        throw new Error('No access token available')
      }
      
      const controller = new AbortController();
      // Reduce timeout from 10 seconds to 5 seconds
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Cache-Control': 'no-store'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch users')
      }
      
      const data = await response.json()
      setUsers(data)
      showToast('Users loaded', 'success')
    } catch (error) {
      if (error.name === 'AbortError') {
        showToast('Request timed out. Please try again.', 'error')
      } else {
        showToast(error.message || 'Failed to fetch users', 'error')
      }
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const performAdminStatusUpdate = async (userId, currentStatus) => {
    try {
      setIsUpdatingUser(true)
      setError('')
      setSuccessMessage('')
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      
      if (!accessToken) {
        throw new Error('No access token available')
      }
      
      const newStatus = !currentStatus
      
      const controller = new AbortController();
      // Reduce timeout from 8 seconds to 5 seconds
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/admin/update-admin-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Cache-Control': 'no-store'
        },
        body: JSON.stringify({
          userId,
          isAdmin: newStatus
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user')
      }
      
      // Update local state
      setUsers(users.map(u => 
        u.user_id === userId 
          ? { ...u, metadata: { ...u.metadata, isAdmin: newStatus } } 
          : u
      ))
      
      const isSelfDemotion = userId === user?.id && currentStatus === true;
      const message = isSelfDemotion 
        ? "Admin privileges forfeited. You will be redirected." 
        : `User admin status updated to ${newStatus ? 'admin' : 'user'}`;
      
      showToast(message, 'success')
      
      // If admin forfeited their role, redirect them after a short delay
      if (isSelfDemotion) {
        // Reduce redirect delay from 2000ms to 1000ms
        setTimeout(() => {
          router.push('/');
        }, 1000);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        showToast('Request timed out. Please try again.', 'error')
      } else {
        showToast(error.message || 'Failed to update user status', 'error')
      }
    } finally {
      setIsUpdatingUser(false)
      // Reset the pending user data
      setPendingUserId(null);
      setPendingCurrentStatus(null);
    }
  }

  const handleConfirmForfeit = () => {
    if (pendingUserId !== null && pendingCurrentStatus !== null) {
      performAdminStatusUpdate(pendingUserId, pendingCurrentStatus);
    }
  }

  // Only render when authenticated and admin
  if (isLoading || !user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/5 via-white/5 to-purple-50/5 dark:from-gray-900/5 dark:via-gray-900/5 dark:to-gray-800/5">
      {/* Confirmation Dialog Component */}
      <ConfirmationDialog
        isOpen={showForfeitDialog}
        onClose={() => setShowForfeitDialog(false)}
        onConfirm={handleConfirmForfeit}
        title={dialogTitle}
        description={dialogDescription}
        confirmText={dialogConfirmText}
        cancelText="Cancel"
        variant={dialogVariant}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar 
          user={user}
          signOut={signOut}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminHeader 
            title={
              activeTab === 'dashboard' ? 'Dashboard Overview' :
              activeTab === 'users' ? 'User Management' :
              activeTab === 'account' ? 'Account Settings' :
              activeTab === 'hospital' ? 'Upload Doc' :
              activeTab === 'structured' ? 'Update Hospital Info' :
              activeTab === 'filehistory' ? 'File History' : ''
            } 
            user={user} 
          />
          
          <main className="flex-1 overflow-y-auto p-6">
            {/* Tab content */}
            <div className="flex-1 px-4 py-6 md:px-8 overflow-auto">
              {activeTab === 'dashboard' && <DashboardOverview />}
            {activeTab === 'users' && (
                <UserManagement
                  users={users}
                  isLoading={isLoadingUsers}
                  fetchUsers={fetchUsers}
                  confirmAdminAction={performAdminStatusUpdate}
                  currentUser={user}
                />
              )}
              {activeTab === 'hospital' && <HospitalInfoUpload />}
              {activeTab === 'filehistory' && <FileHistory />}
              {activeTab === 'structured' && <div className="h-[calc(100vh-10rem)]"><HospitalInfoStructured /></div>}
              {activeTab === 'account' && <AccountSettings />}
              </div>
          </main>
            </div>
      </div>
    </div>
  )
} 