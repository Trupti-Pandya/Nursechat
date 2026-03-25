'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/toast-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Clock, Info, CheckCircle, Eye, ArrowUpDown, User } from 'lucide-react'
import showdown from 'showdown'

// Define HospitalInfoFile interface
interface HospitalInfoFile {
  id: string;
  file_name: string;
  file_content?: string;
  is_active: boolean;
  uploaded_at: string;
  uploaded_by: string;
  scheduled_activation_time: string | null;
}

export function FileHistory() {
  const { user } = useAuth()
  const { showToast } = useToast()
  
  // File history state
  const [fileHistory, setFileHistory] = useState<HospitalInfoFile[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [selectedHistoryFile, setSelectedHistoryFile] = useState<string | null>(null)
  const [showHistoryPreview, setShowHistoryPreview] = useState(false)
  const [historyFileContent, setHistoryFileContent] = useState('')
  const [fileHistoryRows, setFileHistoryRows] = useState<React.ReactNode[]>([])
  
  // Helper function to format dates
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
    return new Date(dateString).toLocaleDateString(undefined, options)
  }
  
  // Load file history when component mounts
  useEffect(() => {
    fetchFileHistory()
  }, [])
  
  // Fetch file history function
  const fetchFileHistory = async () => {
    try {
      setIsLoadingHistory(true)
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !session.access_token) {
        throw new Error('You must be signed in to view file history')
      }
      
      // Create a timeout for the request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      let files: HospitalInfoFile[] = []
      
      try {
        const response = await fetch('/api/admin/hospital-info/history', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Error fetching history (${response.status}):`, errorText)
          throw new Error(`Failed to fetch file history (${response.status})`)
        }
        
        const data = await response.json()
        files = (data.files || []) as HospitalInfoFile[]
        setFileHistory(files)
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.')
        }
        throw fetchError
      }
      
      // Get uploader display names
      const userIds = Array.from(new Set(files.map(file => file.uploaded_by).filter(Boolean)))
      const userNames: Record<string, { name: string | null; email: string | null }> = {}
      
      if (userIds.length > 0) {
        try {
          // Skip direct Supabase profile query since the table doesn't exist
          // Go directly to API fallback method
          console.log('Fetching user information via API fallback')
          
          // Process in batches to avoid overwhelming the API
          const batchSize = 5
          for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize)
            
            await Promise.all(
              batch.map(async (userId) => {
                if (!userId) return
                
                try {
                  const controller = new AbortController()
                  const timeoutId = setTimeout(() => controller.abort(), 3000) // Shorter timeout
                  
                  const userResponse = await fetch(`/api/admin/users/${userId}`, {
                    headers: {
                      'Authorization': `Bearer ${session.access_token}`
                    },
                    signal: controller.signal
                  })
                  
                  clearTimeout(timeoutId)
                  
                  if (userResponse.ok) {
                    const userData = await userResponse.json()
                    // Store both name and email for the user
                    userNames[userId] = {
                      name: userData.name || null,
                      email: userData.email || null
                    }
                  } else {
                    console.warn(`Failed to fetch user ${userId}:`, await userResponse.text())
                    userNames[userId] = { name: null, email: null }
                  }
                } catch (err) {
                  // Don't throw, just log and continue
                  console.warn(`Error fetching user ${userId}:`, 
                    err instanceof Error ? err.message : 'Unknown error')
                  userNames[userId] = { name: null, email: null }
                }
              })
            )
          }
        } catch (apiError) {
          console.error('Error fetching user details via API:', 
            apiError instanceof Error ? apiError.message : 'Unknown error')
          
          // Make sure all user IDs have at least a fallback name
          userIds.forEach(id => {
            if (!userNames[id]) userNames[id] = { name: null, email: null }
          })
        }
      }
      
      // Generate the table rows as React elements
      const rows = files.map((item, index) => {
        // Use type assertion to safely access the property
        const uploaderId = item.uploaded_by || ''
        
        // Display logic: show name if available, otherwise show email, fallback to "Unknown User"
        let uploaderDisplay = 'Unknown User'
        if (uploaderId && userNames[uploaderId]) {
          if (userNames[uploaderId].name) {
            uploaderDisplay = userNames[uploaderId].name
          } else if (userNames[uploaderId].email) {
            uploaderDisplay = userNames[uploaderId].email
          }
        }
        
        return (
          <tr 
            key={item.id} 
            className={`${index % 2 === 0 ? 'bg-white/30 dark:bg-gray-900/20' : 'bg-gray-50/30 dark:bg-gray-800/20'} hover:bg-blue-50/60 dark:hover:bg-blue-900/30 transition-colors backdrop-blur-sm`}
          >
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-500" />
                <span className="truncate max-w-[300px]">{item.file_name}</span>
                {item.is_active && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle size={10} />
                    Active
                  </span>
                )}
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
              {formatDate(item.uploaded_at)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
              {uploaderDisplay}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <Button
                onClick={() => handleViewHistoryFile(item.id)}
                variant="outline"
                size="sm"
                className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <Eye size={14} className="mr-1" />
                View
              </Button>
            </td>
          </tr>
        )
      })
      
      setFileHistoryRows(rows)
    } catch (error) {
      console.error('Error fetching file history:', error)
      showToast(`Failed to load file history: ${error.message || 'Unknown error'}`, 'error')
      setFileHistory([])
      setFileHistoryRows([])
    } finally {
      setIsLoadingHistory(false)
    }
  }
  
  // Handle viewing a historical file
  const handleViewHistoryFile = async (fileId: string) => {
    try {
      setSelectedHistoryFile(fileId)
      setShowHistoryPreview(true)
      setHistoryFileContent('Loading...')
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !session.access_token) {
        throw new Error('You must be signed in to view file content')
      }
      
      const controller = new AbortController()
      // Set a timeout of 10 seconds
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      try {
        const response = await fetch(`/api/admin/hospital-info/${fileId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Error response from API (${response.status}):`, errorText)
          throw new Error(`Failed to fetch file content (${response.status})`)
        }
        
        const data = await response.json()
        setHistoryFileContent(data.content || 'No content available')
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.')
        }
        throw fetchError
      }
    } catch (error) {
      console.error('Error fetching file content:', error)
      setHistoryFileContent(`Error: ${error.message || 'Failed to load file content'}`)
      showToast(`Failed to load file content: ${error.message || 'Unknown error'}`, 'error')
    }
  }
  
  return (
    <div className="space-y-6 w-full relative z-10">
      <div className="border-2 border-purple-100/50 dark:border-purple-900/30 rounded-xl shadow-lg bg-white/60 dark:bg-gray-900/50 overflow-hidden mb-6 backdrop-blur-sm">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-900/40 p-2 rounded-lg">
              <Clock size={22} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Hospital Information File History</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                View and access previous versions of hospital information files
              </p>
            </div>
          </div>
        </div>
        
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 m-6">
          {isLoadingHistory ? (
            <div className="py-16 flex items-center justify-center bg-white/40 dark:bg-gray-900/30 backdrop-blur-sm">
              <div className="w-10 h-10 relative">
                <div className="w-full h-full rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
              </div>
            </div>
          ) : fileHistory.length === 0 ? (
            <div className="py-12 text-center bg-white/40 dark:bg-gray-900/30 backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <Info size={24} className="text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">No File History Found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                No hospital information files have been uploaded yet. Upload documents through the "Upload Doc" section to see your file history here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white/40 dark:bg-gray-900/30 backdrop-blur-sm" style={{ maxHeight: '60vh' }}>
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-sm z-10">
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                      <div className="flex items-center gap-1">
                        <span>File Name</span>
                        <ArrowUpDown size={14} />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '160px' }}>
                      <div className="flex items-center gap-1">
                        <span>Uploaded</span>
                        <ArrowUpDown size={14} />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '160px' }}>
                      <div className="flex items-center gap-1">
                        <span>Uploaded By</span>
                        <User size={14} />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {fileHistoryRows}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* History File Preview Modal */}
      <AnimatePresence>
        {showHistoryPreview && (
          <Dialog open={showHistoryPreview} onOpenChange={setShowHistoryPreview}>
            <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden bg-white/90 dark:bg-gray-800/90 border-2 border-purple-100/50 dark:border-purple-900/30 shadow-xl backdrop-blur-sm flex flex-col">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="relative flex flex-col h-full"
              >
                <DialogHeader className="border-b border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
                  <DialogTitle className="flex items-center gap-2 text-xl text-gray-800 dark:text-gray-100">
                    <Clock size={22} className="text-purple-500" />
                    Historical File Version
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 dark:text-gray-400">
                    Viewing a previous version of hospital information
                  </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-hidden">
                  <MarkdownPreview content={historyFileContent} />
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  )
}

// Markdown Preview Component - reused from hospital-info-form.tsx
const MarkdownPreview = ({ content }: { content: string }) => {
  const [htmlContent, setHtmlContent] = useState('');
  
  useEffect(() => {
    if (!content) return;
    
    try {
      // Create converter with all options at once
      const converter = new showdown.Converter({
        tables: true,
        tasklists: true,
        strikethrough: true,
        openLinksInNewWindow: true,
        simplifiedAutoLink: true,
        simpleLineBreaks: true,
        literalMidWordUnderscores: true,
        literalMidWordAsterisks: true
      });
      
      // Convert markdown to HTML immediately
      setHtmlContent(converter.makeHtml(content));
    } catch (error) {
      console.error('Error converting markdown:', error);
      setHtmlContent(`<p class="text-red-500">Error rendering markdown content.</p>
                      <pre class="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">${content}</pre>`);
    }
  }, [content]);

  // Add custom styles for the rendered markdown and paper texture
  const customStyles = `
    .preview-container {
      background-color: #faf7f7;
      overflow: auto;
      padding: 2rem;
      max-height: 70vh;
    }
    
    .markdown-preview {
      background-color: #f7f5f4;
      background-image: url("https://www.transparenttextures.com/patterns/groovepaper.png");
      background-attachment: scroll;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
      color: #222222;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      line-height: 1.6;
      padding: 2rem;
      border-radius: 0.5rem;
      max-width: 48rem;
      margin: 0 auto;
    }
    
    .markdown-preview h1, .markdown-preview h2 {
      border-bottom: 1px solid rgba(0,0,0,0.1);
      padding-bottom: 0.3em;
      margin-bottom: 0.75em;
      color: #111111;
    }
    
    .markdown-preview h1 {
      font-size: 2rem;
    }
    
    .markdown-preview h2 {
      font-size: 1.5rem;
    }
    
    .markdown-preview h3 {
      font-size: 1.25rem;
      color: #111111;
    }
    
    .markdown-preview table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    
    .markdown-preview th, .markdown-preview td {
      border: 1px solid rgba(0,0,0,0.1);
      padding: 0.5em 0.75em;
    }
    
    .markdown-preview th {
      background-color: rgba(0,0,0,0.02);
      font-weight: 600;
    }
    
    .markdown-preview code {
      background-color: rgba(0,0,0,0.04);
      padding: 0.2em 0.4em;
      border-radius: 3px;
    }
    
    .markdown-preview img {
      max-width: 100%;
    }
    
    .markdown-preview blockquote {
      border-left: 4px solid rgba(0,0,0,0.1);
      padding-left: 1em;
      margin-left: 0;
      color: rgba(0,0,0,0.7);
    }
    
    .markdown-preview p {
      margin-bottom: 1em;
    }
    
    .markdown-preview strong {
      font-weight: 600;
    }
    
    /* Dark mode styles - use class-based approach instead of media query */
    html.dark .preview-container {
      background-color: #2c2c2c;
    }
    
    html.dark .markdown-preview {
      background-color: #252525;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      color: #e0e0e0;
    }
    
    html.dark .markdown-preview h1, 
    html.dark .markdown-preview h2, 
    html.dark .markdown-preview h3 {
      color: #f0f0f0;
      border-bottom-color: rgba(255,255,255,0.1);
    }
    
    html.dark .markdown-preview th {
      background-color: rgba(255,255,255,0.05);
    }
    
    html.dark .markdown-preview code {
      background-color: rgba(255,255,255,0.1);
    }
    
    html.dark .markdown-preview blockquote {
      color: rgba(255,255,255,0.7);
      border-left-color: rgba(255,255,255,0.2);
    }
  `;

  return (
    <div className="p-0 relative">
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <div className="preview-container overflow-y-auto" style={{ maxHeight: "70vh" }}>
        <div className="markdown-preview">
          <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>
      </div>
    </div>
  );
}; 