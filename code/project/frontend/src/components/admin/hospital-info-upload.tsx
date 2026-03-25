'use client'

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Loader } from '@/components/ui/loader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FileText, AlertCircle, CheckCircle, Calendar, Clock, Upload, Eye, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { Particles } from './particles'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Maximum file size in MB
const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Particle effect component for upload animation
const Particle = ({ delay }: { delay: number }) => (
  <motion.div
    className="absolute rounded-full w-1 h-1 bg-gradient-to-r from-blue-400 to-purple-500"
    initial={{ opacity: 0, scale: 0.5 }}
    animate={{
      x: Math.random() * 60 - 30, // Random horizontal spread
      y: Math.random() * -150 - 50, // Move upwards
      opacity: [0, 1, 0],
      scale: [0.5, 1, 0.5],
    }}
    transition={{ duration: 1.5, delay, ease: "easeOut" }}
    style={{
      left: '50%', // Start from center
      bottom: '0', // Start from bottom of container
    }}
  />
);

// Status step indicator
const StatusItem = ({ 
  icon: Icon, 
  title, 
  description, 
  isActive, 
  isCompleted 
}: { 
  icon: any, 
  title: string, 
  description: string, 
  isActive: boolean, 
  isCompleted: boolean 
}) => (
  <motion.div
    className={`flex items-start space-x-3 p-3 rounded-lg transition-all duration-300 ${isActive ? 'bg-blue-900/20 scale-105' : 'opacity-60'}`}
    initial={{ opacity: 0, x: 10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-600 dark:bg-gray-700'}`}>
      <Icon size={16} className="text-white" />
    </div>
    <div>
      <h4 className={`font-semibold ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>{title}</h4>
      <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  </motion.div>
);

// Add a UserData interface to properly type the API response
interface UserData {
  id: string;
  name?: string;
  email?: string;
}

/**
 * Safely retrieves a user's name from the uploader mapping
 * 
 * This helper function safely gets the user name by ID from the uploader map,
 * providing a fallback "Unknown User" when the ID is missing or not found.
 * 
 * @param id - User ID to lookup in the mapping
 * @param uploaderMap - Dictionary of user IDs to display names
 * @returns User's display name or "Unknown User" if not found
 */
function getUploaderName(id: string, uploaderMap: Record<string, string>): string {
  if (!id) return 'Unknown User';
  if (!uploaderMap) return 'Unknown User';
  return uploaderMap[id as keyof typeof uploaderMap] || 'Unknown User';
}

export function HospitalInfoUpload() {
  const { user } = useAuth()
  const { showToast } = useToast()
  
  // File and upload states
  const [file, setFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  
  // Modal view state (preview or activate)
  const [modalView, setModalView] = useState<'preview' | 'activate'>('preview')
  
  // Status tracking
  const [currentStep, setCurrentStep] = useState(1) // 1: Upload, 2: Preview, 3: Activate
  const [activationStatus, setActivationStatus] = useState<'processing' | 'success' | 'scheduled' | 'error' | null>(null)
  const [statusMessage, setStatusMessage] = useState('Upload hospital information to update the AI assistant.')
  
  // Activation options
  const [activationType, setActivationType] = useState<'now' | 'scheduled'>('now')
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<string>('')
  const [scheduledTime, setScheduledTime] = useState<string>('')
  
  // Animation states
  const [showParticles, setShowParticles] = useState(false)
  
  // Added state for fullscreen mode
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Get current date and time for min values
  const now = new Date()
  const currentDate = now.toISOString().split('T')[0] // YYYY-MM-DD
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM
  
  // Fetch file history on component mount
  useEffect(() => {
    // Don't automatically fetch on mount
    // Only fetch when user clicks the history button
  }, []);
  
  // Fetch file history after successful upload/activation
  useEffect(() => {
    if (activationStatus === 'success' || activationStatus === 'scheduled') {
      fetchFileHistory();
    }
  }, [activationStatus]);
  
  // Simplified fetchFileHistory function - just refresh data in the background
  const fetchFileHistory = async () => {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) {
        throw new Error('You must be signed in to view file history');
      }
      
      // Just send request to refresh cache, we don't need to process the response here
      await fetch('/api/admin/hospital-info/history', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
    } catch (error) {
      console.error('Error fetching file history:', error);
      showToast('Failed to refresh file history', 'error');
    }
  };
  
  // Handle file drop or selection
  const handleFileDrop = useCallback((selectedFile: File) => {
    setIsUploading(true);
    setActivationStatus(null);
    setStatusMessage('Processing file...');
    setCurrentStep(1);
    
    // Simulate processing delay
    setTimeout(() => {
      // Check file size
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        showToast(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`, 'error');
        setStatusMessage(`Error: File exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
        setActivationStatus('error');
        setIsUploading(false);
        return;
      }
      
      // Check file type
      if (!['text/plain'].includes(selectedFile.type) && !selectedFile.name.endsWith('.txt')) {
        showToast('Only text (.txt) files are supported', 'error');
        setStatusMessage('Error: Please upload a valid .txt file.');
        setActivationStatus('error');
        setIsUploading(false);
        return;
      }
      
      // File is valid, process it
      setFile(selectedFile);
      setStatusMessage(`${selectedFile.name} ready for preview.`);
      setCurrentStep(2);
      
      // Trigger particle effect
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 1600);
      
      setIsUploading(false);
    }, 1000);
  }, [showToast]);
  
  // Handle file selection via input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    handleFileDrop(selectedFile);
  };
  
  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileDrop(droppedFile);
    }
  };
  
  // Open file preview
  const handlePreviewClick = async () => {
    if (!file) return;
    
    setIsLoadingPreview(true);
    setShowPreview(true);
    setModalView('preview'); // Make sure we start with preview view
    setShowScheduler(false);
    setStatusMessage(`Previewing ${file.name}...`);
    
    // Read file content
    try {
      const reader = new FileReader();
      const contentPromise = new Promise<string>((resolve) => {
        reader.onload = (event) => {
          if (event.target?.result) {
            resolve(event.target.result as string);
          } else {
            resolve('');
          }
        };
      });
      
      reader.readAsText(file);
      const content = await contentPromise;
      
      setFileContent(content);
      setStatusMessage('Review content and configure activation options.');
      setCurrentStep(2);
    } catch (error) {
      console.error("Error reading file:", error);
      setFileContent("Error: Could not read file content.");
      setStatusMessage('Error: Could not read file content.');
      setActivationStatus('error');
    } finally {
      setIsLoadingPreview(false);
    }
  };
  
  // Navigate from preview to activation screen
  const handleNavigateToActivate = () => {
    setModalView('activate');
    setStatusMessage('Choose activation method.');
  };
  
  // Navigate back from activation to preview screen
  const handleNavigateToPreview = () => {
    setModalView('preview');
    setStatusMessage('Reviewing content.');
  };
  
  // Remove uploaded file
  const removeFile = () => {
    setFile(null);
    setFileContent('');
    setActivationStatus(null);
    setCurrentStep(1);
    setStatusMessage('Upload hospital information to update the AI assistant.');
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Validate scheduled datetime
  const isScheduledTimeValid = (): boolean => {
    if (activationType !== 'scheduled') return true;
    
    if (!scheduledDate || !scheduledTime) {
      showToast('Please select both date and time for scheduled activation', 'error');
      return false;
    }
    
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
    const now = new Date();
    
    if (scheduledDateTime <= now) {
      showToast('Scheduled time must be in the future', 'error');
      return false;
    }
    
    return true;
  };
  
  // Handle immediate activation
  const handleActivateNow = async () => {
    setActivationStatus('processing');
    setStatusMessage(`Activating ${file?.name} immediately...`);
    setCurrentStep(3);
    setShowPreview(false);
    
    try {
      await uploadFile('now');
      setActivationStatus('success');
      setStatusMessage(`${file?.name} activated successfully!`);
    } catch (error: any) {
      setActivationStatus('error');
      setStatusMessage(`Error: ${error.message || 'Failed to upload file'}`);
    }
  };
  
  // Handle scheduled activation
  const handleScheduleActivation = async () => {
    if (!isScheduledTimeValid()) return;
    
    setActivationStatus('processing');
    setStatusMessage(`Scheduling activation for ${file?.name} on ${scheduledDate} at ${scheduledTime}...`);
    setCurrentStep(3);
    setShowPreview(false);
    
    try {
      await uploadFile('scheduled');
      setActivationStatus('scheduled');
      setStatusMessage(`${file?.name} scheduled for activation on ${scheduledDate} at ${scheduledTime}.`);
    } catch (error: any) {
      setActivationStatus('error');
      setStatusMessage(`Error: ${error.message || 'Failed to schedule activation'}`);
    }
  };
  
  // Upload file to server
  const uploadFile = async (type: 'now' | 'scheduled') => {
    if (!file || !fileContent.trim()) {
      throw new Error('No file selected');
    }
    
    if (type === 'scheduled' && !isScheduledTimeValid()) {
      throw new Error('Invalid scheduled time');
    }
    
    try {
      setIsUploading(true);
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) {
        throw new Error('You must be signed in to upload files');
      }

      // Prepare scheduled activation time if selected
      let scheduledActivationTime = null;
      if (type === 'scheduled' && scheduledDate && scheduledTime) {
        scheduledActivationTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      }

      const response = await fetch('/api/admin/hospital-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          file_name: file.name,
          file_content: fileContent,
          is_active: type === 'now',
          scheduled_activation_time: scheduledActivationTime
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }
      
      // Reset date and time fields
      setScheduledDate('');
      setScheduledTime('');
      
      return response.json();
    } finally {
      setIsUploading(false);
    }
  };
  
  // Generate particles for animation
  const particles = useMemo(() => {
    if (!showParticles) return [];
    return Array.from({ length: 15 }).map((_, i) => <Particle key={i} delay={i * 0.05} />);
  }, [showParticles]);
  
  return (
    <div className="w-full space-y-8 max-h-[calc(100vh-120px)] overflow-auto pr-2">
      {/* Main Content Area with two-column layout */}
      <div className="flex flex-col lg:flex-row w-full rounded-xl overflow-hidden border-2 border-blue-100/50 dark:border-blue-900/30 shadow-lg bg-white dark:bg-gray-900">
        {/* Left Column - Upload Area (2/3 width) */}
        <div className="w-full lg:w-2/3 p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg">
              <FileText size={28} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Hospital Information</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Upload and manage hospital information for the AI assistant
              </p>
            </div>
          </div>
          
          {/* Upload Area */}
          <div className="mb-6 relative">
            {/* Empty State - Dropzone */}
            {!file && !isUploading && (
              <motion.div
            className={`
                  relative flex flex-col items-center justify-center w-full min-h-[350px] 
                  border-2 border-dashed rounded-xl cursor-pointer overflow-hidden
                  transition-all duration-300 ease-in-out
              ${isDragging 
                    ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/20 shadow-lg' 
                    : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 bg-gray-50/50 dark:bg-gray-800/20'
                  }
                `}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                whileHover={{ 
                  scale: 1.01, 
                  boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)'
                }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
                {/* Background pattern */}
                <div 
                  className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none" 
                  style={{ 
                    backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', 
                    backgroundSize: '20px 20px' 
                  }}
                ></div>
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/30 dark:from-blue-900/10 dark:via-transparent dark:to-purple-900/10 pointer-events-none"></div>
                
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
                  accept=".txt,text/plain"
              onChange={handleFileChange}
            />
            
                <motion.div
                  className="flex flex-col items-center justify-center z-10 p-6 text-center"
                  animate={{ y: isDragging ? -10 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <motion.div animate={{ scale: isDragging ? 1.1 : 1 }} transition={{ duration: 0.2 }}>
                    <FileText 
                      className={`w-20 h-20 mb-4 transition-colors duration-300 ${
                        isDragging ? 'text-blue-500 drop-shadow-md' : 'text-gray-400 dark:text-gray-500'
                      }`} 
                    />
                  </motion.div>
                  
                  <h3 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-200">
                    {isDragging ? 'Release to Upload' : 'Drag and Drop Your File Here'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-3">
                    or click to browse your files
                  </p>
                  <div className="inline-block px-4 py-2 rounded-full text-xs text-blue-800 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50">
                    Supported files: .txt only (max {MAX_FILE_SIZE_MB}MB)
              </div>
                </motion.div>
              </motion.div>
            )}
            
            {/* Processing State */}
            {isUploading && (
              <motion.div
                className="flex flex-col items-center justify-center w-full min-h-[350px] bg-gray-50 dark:bg-gray-800/20 rounded-xl border-2 border-gray-200 dark:border-gray-700"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="w-16 h-16 mb-4 relative">
                  <div className="w-full h-full rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
              </div>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Processing file...</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Please wait a moment</p>
              </motion.div>
            )}
            
            {/* File Selected State */}
            {file && !isUploading && (
              <motion.div
                className="w-full p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border-2 border-blue-200 dark:border-blue-800/50 shadow-md"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, type: 'spring' }}
              >
                <div className="relative flex items-center justify-center mb-4">
                  <div className="w-20 h-20 bg-blue-100/70 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <FileText className="w-10 h-10 text-blue-500 dark:text-blue-400" />
              </div>
                  {/* Particles container */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {particles}
            </div>
          </div>
          
                <div className="text-center mb-5">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-1">{file.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                
                <div className="flex justify-center space-x-4">
                <Button 
                    onClick={handlePreviewClick}
                    className="px-6 py-2.5 flex items-center gap-2"
                >
                    <FileText size={18} />
                    <span>Preview & Activate</span>
                </Button>
                  
              <Button 
                    onClick={removeFile}
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300"
                    title="Remove File"
                  >
                    <X size={18} />
              </Button>
            </div>
              </motion.div>
            )}
          </div>
          
          {/* Important Note (moved from status panel) */}
          <div className="mt-2 mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/50">
            <h4 className="font-medium flex items-center gap-2 mb-2 text-gray-800 dark:text-gray-200">
              <AlertCircle size={16} className="text-amber-500" /> 
              Important Note
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Uploading a new file will replace the existing hospital information used by the AI assistant. Make sure the file is accurate and complete.
            </p>
          </div>
        </div>
        
        {/* Right Column - Status Panel (1/3 width) */}
        <div className="w-full lg:w-1/3 bg-gray-50 dark:bg-gray-800/50 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
              Status Updates
            </h3>
            
            {/* Status Message */}
            <motion.div
              key={statusMessage} // Re-animate when message changes
              className={`mb-6 p-3 rounded-lg text-sm flex items-center space-x-2 border ${
                activationStatus === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200' :
                activationStatus === 'scheduled' ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200' :
                activationStatus === 'error' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200' :
                activationStatus === 'processing' ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200 animate-pulse' :
                'bg-gray-100 border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200'
              }`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {activationStatus === 'success' && <CheckCircle size={18} className="text-green-600 dark:text-green-400" />}
              {activationStatus === 'scheduled' && <Calendar size={18} className="text-blue-600 dark:text-blue-400" />}
              {activationStatus === 'error' && <AlertCircle size={18} className="text-red-600 dark:text-red-400" />}
              {activationStatus === 'processing' && (
                <div className="w-4 h-4 mr-2 relative flex-shrink-0">
                  <div className="w-full h-full rounded-full border-2 border-yellow-500 border-t-transparent animate-spin"></div>
                </div>
              )}
              {!activationStatus && <FileText size={18} className="text-gray-600 dark:text-gray-400" />}
              <span>{statusMessage}</span>
            </motion.div>
            
            {/* Workflow Steps */}
            <div className="space-y-3">
              <StatusItem
                icon={FileText}
                title="Upload File"
                description="Select or drag a .txt knowledge file"
                isActive={currentStep === 1}
                isCompleted={currentStep > 1}
              />
              <StatusItem
                icon={FileText}
                title="Preview & Configure"
                description="Review and set activation options"
                isActive={currentStep === 2}
                isCompleted={currentStep > 2}
              />
              <StatusItem
                icon={CheckCircle}
                title="Activation"
                description="File is active or scheduled"
                isActive={currentStep === 3}
                isCompleted={activationStatus === 'success' || activationStatus === 'scheduled'}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Preview Modal Dialog */}
      <AnimatePresence>
        {showPreview && (
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-white dark:bg-gray-900 border-2 border-blue-100/50 dark:border-blue-900/30 shadow-xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <DialogHeader className="border-b border-gray-200 dark:border-gray-800 p-6">
                  <DialogTitle className="flex items-center gap-2 text-xl text-gray-800 dark:text-gray-100">
                    <FileText size={22} className="text-blue-500" />
                    {modalView === 'preview' ? `Preview: ${file?.name}` : 'Configure Activation'}
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 dark:text-gray-400">
                    {modalView === 'preview' 
                      ? 'Review the content before proceeding to activation' 
                      : 'Set how and when the file should be activated'}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="p-6">
                  {isLoadingPreview ? (
                    <div className="flex justify-center items-center py-10">
                      <div className="w-10 h-10 relative">
                        <div className="w-full h-full rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                      </div>
                    </div>
                  ) : modalView === 'preview' ? (
                    // Preview View
                    <div className="relative">
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800 p-4 overflow-auto max-h-[40vh] custom-scrollbar">
                        <div className="flex justify-end mb-2">
                          <Button
                            onClick={() => setIsFullScreen(true)}
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 hover:bg-gray-100"
                            title="Full Screen View"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                            </svg>
                          </Button>
                        </div>
                        <pre className="text-sm whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-300">
                          {fileContent}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    // Activation Options View
                    <div className="space-y-6">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50">
                        <h4 className="font-medium flex items-center gap-2 mb-2 text-gray-800 dark:text-gray-200">
                          <AlertCircle size={16} className="text-amber-500" /> 
                          Important Note
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          This will update the hospital information used by the AI assistant. Activating a new file will replace the currently active information.
                        </p>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Choose Activation Method</h3>
                        
                        {/* Immediate Activation Option */}
                        <div 
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                            activationType === 'now' 
                              ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800/70'
                          }`}
                          onClick={() => setActivationType('now')}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              activationType === 'now' 
                                ? 'border-blue-500 bg-white dark:bg-gray-800' 
                                : 'border-gray-400 dark:border-gray-500'
                            }`}>
                              {activationType === 'now' && (
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-800 dark:text-gray-200">Activate Immediately</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                The file will become active as soon as you confirm, replacing any current information.
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Scheduled Activation Option */}
                        <div 
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                            activationType === 'scheduled' 
                              ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800/70'
                          }`}
                          onClick={() => {
                            setActivationType('scheduled');
                            setShowScheduler(true);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              activationType === 'scheduled' 
                                ? 'border-blue-500 bg-white dark:bg-gray-800' 
                                : 'border-gray-400 dark:border-gray-500'
                            }`}>
                              {activationType === 'scheduled' && (
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-800 dark:text-gray-200">Schedule for Later</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Set a future date and time when this file should become active.
                              </p>
                            </div>
                          </div>
                          
                          {/* Date/Time Selectors */}
                          {activationType === 'scheduled' && (
                            <div className="mt-4 pl-8 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor="activation-date" className="block mb-1 text-sm">Activation Date</Label>
                                  <Input 
                                    id="activation-date"
                                    type="date" 
                                    value={scheduledDate}
                                    min={currentDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    className="w-full"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="activation-time" className="block mb-1 text-sm">Activation Time</Label>
                                  <Input 
                                    id="activation-time"
                                    type="time" 
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="w-full"
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                The file will automatically activate at the specified time.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
          
                <div className="border-t border-gray-200 dark:border-gray-800 p-6 flex justify-between items-center">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      if (modalView === 'activate') {
                        handleNavigateToPreview();
                      } else {
                        setShowPreview(false);
                      }
                    }}
                    className="border-gray-300 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:border-gray-500"
                  >
                    {modalView === 'activate' ? 'Back to Preview' : 'Cancel'}
                  </Button>
                  
                  {modalView === 'preview' ? (
                    <Button 
                      onClick={handleNavigateToActivate}
                      className="flex items-center gap-2"
                      disabled={isLoadingPreview}
                    >
                      <span>Continue to Activation</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8.66667 3.33333L13.3333 8L8.66667 12.6667M13.3333 8L2.66667 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Button>
                  ) : (
                    <Button 
                      onClick={activationType === 'now' ? handleActivateNow : handleScheduleActivation}
                      className="flex items-center gap-2"
                      disabled={activationType === 'scheduled' && (!scheduledDate || !scheduledTime)}
                    >
                      {activationType === 'now' ? 'Activate Now' : 'Schedule Activation'}
                    </Button>
                  )}
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
      
      {/* Full Screen Preview Modal */}
      <AnimatePresence>
        {isFullScreen && (
          <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-white dark:bg-gray-900 border-2 border-blue-100/50 dark:border-blue-900/30 shadow-xl">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative h-[95vh] flex flex-col"
              >
                {/* Full Screen Header */}
                <DialogHeader className="border-b border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center">
                    <FileText size={20} className="text-blue-500 mr-2" />
                    <DialogTitle className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      {file?.name}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
                    Full screen view - Press ESC or click X to exit
                  </DialogDescription>
                </DialogHeader>
                
                {/* Close Button - Positioned absolute in the DialogContent to avoid header conflicts */}
                <div className="absolute top-3 right-3 z-10">
                  <motion.button
                    onClick={() => setIsFullScreen(false)}
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={20} className="text-gray-700 dark:text-gray-300" />
                  </motion.button>
                </div>
                
                {/* File Content - Full Height */}
                <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-900/50 custom-scrollbar">
                  <pre className="text-sm whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-300">
                    {fileContent}
                  </pre>
            </div>
              </motion.div>
        </DialogContent>
      </Dialog>
        )}
      </AnimatePresence>
    </div>
  )
}

{/* Add custom scrollbar styles */}
<style jsx global>{`
  .custom-scrollbar::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(15, 23, 42, 0.1);
    border-radius: 8px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(100, 116, 139, 0.5);
    border-radius: 8px;
    border: 3px solid transparent;
    background-clip: content-box;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(100, 116, 139, 0.7);
  }
  
  /* Dark mode styles */
  .dark .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(17, 24, 39, 0.6);
    border-radius: 8px;
  }
  
  .dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(55, 65, 81, 0.7);
    border: 3px solid transparent;
    background-clip: content-box;
  }
  
  .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(75, 85, 99, 0.8);
  }
`}</style> 