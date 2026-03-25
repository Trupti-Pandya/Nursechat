"use client";

import React, { FormEvent, useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaperclipIcon, XIcon, FileIcon, FileTextIcon, ImageIcon, MaximizeIcon, MinimizeIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ChatInputProps {
  onSendMessage: (message: string, documentData?: { fileName: string, fileType: string, fileContent: string, markdownContent?: string }[]) => void;
  isLoading?: boolean;
  draftMessage?: string;
}

export function ChatInput({ onSendMessage, isLoading = false, draftMessage = '' }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [totalExistingFiles, setTotalExistingFiles] = useState(0);

  const MAX_FILES_PER_MESSAGE = 3;
  const MAX_TOTAL_FILES = 6;

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevLoadingState = useRef(isLoading);

  // Update message when draftMessage changes and focus the input
  useEffect(() => {
    if (draftMessage) {
      setMessage(draftMessage);
      // Focus the input field with a small delay to ensure the value is set
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Set cursor position at the end of the text
          const length = draftMessage.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 50);
    }
  }, [draftMessage]);

  // Focus input field after AI response is received (when loading state changes from true to false)
  useEffect(() => {
    // If loading state changes from true to false (AI finished responding)
    if (prevLoadingState.current === true && isLoading === false) {
      // Set focus back to input field after a short delay
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
    
    // Update ref for next render
    prevLoadingState.current = isLoading;
  }, [isLoading]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      if (uploadedFiles.length > 0) {
        setIsUploading(true);
        setUploadingProgress(10);
        try {
          const documentDataArray = [];
          
          // Process each file
          for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            // Update progress based on file processing progress
            const progressPerFile = 80 / uploadedFiles.length;
            setUploadingProgress(10 + i * progressPerFile);
            
          // Create FormData with the file
          const formData = new FormData();
            formData.append('file', file);
          
          // Send to backend API for OCR processing
          const response = await fetch('/api/ocr/mistral', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error(`OCR request failed with status: ${response.status}`);
          }
          
          const data = await response.json();
            setUploadingProgress(10 + (i + 0.5) * progressPerFile);
          
          // For images, also create a base64 representation to display in the UI
          let fileContent = '';
          
            if (file.type.startsWith('image/')) {
            // Create base64 representation for image preview
            const reader = new FileReader();
            fileContent = await new Promise((resolve) => {
              reader.onloadend = () => {
                const result = reader.result as string;
                // Get the base64 part after the data:image/xxx;base64, prefix
                const base64 = result.split(',')[1];
                resolve(base64);
              };
                reader.readAsDataURL(file);
            });
          }
          
            documentDataArray.push({
              fileName: file.name,
              fileType: file.type,
            fileContent: fileContent, // Base64 content for images
            markdownContent: data.markdown || data.text || ''  // Separate field for OCR content
            });
            
            setUploadingProgress(10 + (i + 1) * progressPerFile);
          }
          
          setUploadingProgress(90);
          onSendMessage(message, documentDataArray);
        } catch (error) {
          console.error('Error processing documents:', error);
          // Still send the message even if OCR fails
          onSendMessage(message);
        } finally {
          setIsUploading(false);
          setUploadingProgress(0);
          setUploadedFiles([]);
          setFilePreview(null);
          setCurrentPreviewIndex(0);
        }
      } else {
        onSendMessage(message);
      }
      setMessage('');
    }
  };

  const handleFileSelect = (file: File) => {
    setFileError(null);
    
    // Check file limits
    if (uploadedFiles.length >= MAX_FILES_PER_MESSAGE) {
      setFileError(`You can only upload ${MAX_FILES_PER_MESSAGE} files per message`);
      return;
    }
    
    if (uploadedFiles.length + totalExistingFiles >= MAX_TOTAL_FILES) {
      setFileError(`You can only have ${MAX_TOTAL_FILES} files total in the conversation`);
      return;
    }
    
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setFileError('Please upload an image or PDF file only');
        return;
      }
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setFileError('File size must be less than 10MB');
        return;
      }
      
      // Add to uploaded files array
      const newFiles = [...uploadedFiles, file];
      setUploadedFiles(newFiles);
      
      // Create preview for the newly added file
      const newIndex = newFiles.length - 1;
      setCurrentPreviewIndex(newIndex);
      
      // Create preview for the newest file
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        // For PDFs, create a data URL to use in the PDF viewer
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Function to reset file input
  const resetFileInput = () => {
    if (fileInputRef.current) {
      // Create a new input element
      const newInput = document.createElement('input');
      newInput.type = 'file';
      newInput.id = 'file-upload-input';
      newInput.className = 'hidden';
      newInput.multiple = true;
      newInput.accept = 'image/*,.pdf';
      
      // Add event listener
      newInput.addEventListener('change', (e) => {
        // Need to cast because TypeScript doesn't recognize this as a file input
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          console.log("Files selected:", target.files.length);
          handleFilesSelected(target.files);
        }
      });
      
      // Replace the old input with the new one
      const parent = fileInputRef.current.parentNode;
      if (parent) {
        parent.replaceChild(newInput, fileInputRef.current);
        // Update the ref
        fileInputRef.current = newInput;
      }
    }
  };
  
  // New function to process selected files
  const handleFilesSelected = (files: FileList) => {
    // Calculate how many more files we can add based on our limits
    const remainingSlots = Math.min(
      MAX_FILES_PER_MESSAGE - uploadedFiles.length,
      MAX_TOTAL_FILES - (uploadedFiles.length + totalExistingFiles)
    );
    
    // Only process up to the remaining slot count
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    // Show warning if some files were skipped
    if (files.length > remainingSlots) {
      setFileError(`Only ${remainingSlots} more file(s) can be added`);
    }
    
    // Store current files
    const newFiles = [...uploadedFiles];
    const startIndex = newFiles.length;
    
    // Process and add all files first
    filesToProcess.forEach(file => {
      // Check file type
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setFileError('Please upload image or PDF files only');
        return;
      }
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setFileError('File size must be less than 10MB');
        return;
      }
      
      // Add to array
      newFiles.push(file);
    });
    
    // Update state with all new files
    setUploadedFiles(newFiles);
    
    // If we added at least one file, update the preview to show the first new file
    if (newFiles.length > startIndex) {
      setCurrentPreviewIndex(startIndex);
      
      // Create preview for the first new file
      const fileToPreview = newFiles[startIndex];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(fileToPreview);
    }
    
    // Reset the file input
    resetFileInput();
  };

  // Update file change handler to use the new function
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input changed", e.target.files);
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Handle all dropped files
      Array.from(e.dataTransfer.files).forEach(file => {
        handleFileSelect(file);
      });
    }
  };

  // Get appropriate icon for file type
  const getFileIcon = () => {
    if (!uploadedFiles.length) return null;
    
    const file = uploadedFiles[currentPreviewIndex];
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="h-3 w-3 text-blue-500 flex-shrink-0" />;
    } else if (file.type === 'application/pdf') {
      return <FileTextIcon className="h-3 w-3 text-red-500 flex-shrink-0" />;
    } else {
      return <FileIcon className="h-3 w-3 text-gray-500 flex-shrink-0" />;
    }
  };
  
  // Get truncated filename
  const getTruncatedFileName = () => {
    if (!uploadedFiles.length) return '';
    
    const maxLength = 15;
    const fileName = uploadedFiles[currentPreviewIndex].name;
    
    if (fileName.length <= maxLength) return fileName;
    
    const extension = fileName.split('.').pop() || '';
    const nameWithoutExt = fileName.substring(0, fileName.length - extension.length - 1);
    
    if (nameWithoutExt.length <= maxLength - 3 - extension.length) {
      return fileName;
    }
    
    const truncatedName = nameWithoutExt.substring(0, maxLength - 3 - extension.length) + '...';
    return truncatedName + '.' + extension;
  };

  // Update UI based on document count with improved detection
  useEffect(() => {
    // This function checks for document count in the DOM
    const checkDocumentCount = () => {
      if (typeof window !== 'undefined') {
        // Get document count from the data attribute
        const docCountElement = document.querySelector('[data-document-count]');
        if (docCountElement) {
          const count = parseInt(docCountElement.getAttribute('data-document-count') || '0', 10);
          setTotalExistingFiles(count);
        }
      }
    };

    // Check initially
    checkDocumentCount();

    // Set up a MutationObserver to detect changes to the document count
    if (typeof window !== 'undefined' && window.MutationObserver) {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && 
              mutation.attributeName === 'data-document-count') {
            checkDocumentCount();
          }
        }
      });

      // Look for the document count element
      const docCountContainer = document.querySelector('.document-status');
      if (docCountContainer) {
        observer.observe(docCountContainer, { 
          attributes: true,
          subtree: true,
          childList: true
        });
      }

      // Cleanup
      return () => observer.disconnect();
    }
  }, []);

  // Fix for the Add More Files button
  const handleAddMoreFiles = (e: React.MouseEvent) => {
    // Prevent default behavior
    e.preventDefault();
    e.stopPropagation();
    
    // Reset any previous errors
    setFileError(null);
    
    // Check if we've reached the limits
    if (uploadedFiles.length >= MAX_FILES_PER_MESSAGE) {
      setFileError(`You can only upload ${MAX_FILES_PER_MESSAGE} files per message`);
      return;
    }
    
    if (uploadedFiles.length + totalExistingFiles >= MAX_TOTAL_FILES) {
      setFileError(`You can only have ${MAX_TOTAL_FILES} files total in the conversation`);
      return;
    }
    
    // Directly trigger the hidden file input
    // Add a small delay to ensure the click is processed
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 50);
  };

  // Add debugging to make sure the file input is accessible
  useEffect(() => {
    // Check if the file input ref is available
    console.log("File input ref available:", !!fileInputRef.current);
  }, []);

  // A more direct approach to trigger file selection
  const openFileSelector = () => {
    // Create a completely new file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf';
    
    // Add event listener
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        console.log("Files selected via direct input:", target.files.length);
        handleFilesSelected(target.files);
      }
    };
    
    // Trigger click
    input.click();
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex items-center w-full gap-2">
        <div className="relative flex-1">
          {/* Attachment button - moved to left */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setShowUploadModal(true)}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 h-8 w-8 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 z-10"
            disabled={isLoading || isUploading}
          >
            <PaperclipIcon className="h-4 w-4" />
          </Button>
          
          <div className="relative">
            {uploadedFiles.length > 0 && (
              <div 
                className="absolute left-0 -top-9 flex items-center max-w-[200px] bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full py-1 px-2.5 text-xs border border-blue-200 dark:border-blue-800 z-20 shadow-sm cursor-pointer hover:bg-blue-200/80 dark:hover:bg-blue-800/40 transition-colors"
                onClick={() => setShowUploadModal(true)}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate">{uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} selected</span>
                </div>
                <button 
                  type="button"
                  className="ml-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setUploadedFiles([]);
                    setFilePreview(null);
                    setCurrentPreviewIndex(0);
                    setFileError(null);
                  }}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            
            <Input
              placeholder={isLoading ? "Processing your question..." : "Type your medical question..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`pl-10 pr-10 frosted-input focus:border-green-300/50 focus:ring-green-200/50 dark:focus:border-green-500/30 dark:focus:ring-green-500/20 ${isLoading ? 'text-gray-500 dark:text-gray-400' : ''}`}
              disabled={isLoading || isUploading}
              autoFocus
              ref={inputRef}
            />
          </div>
          
          {/* Send button */}
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 text-gray-400 dark:text-gray-500"
            disabled={!message.trim() || isLoading || isUploading}
          >
            {isLoading || isUploading ? (
              <svg 
                className="animate-spin w-5 h-5 text-green-500 dark:text-green-400" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                ></circle>
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <svg 
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`w-5 h-5 ${message.trim() && !isLoading ? 'text-green-500 dark:text-green-400' : ''}`}
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            )}
          </Button>
        </div>
      </form>

      {/* File Upload Dialog */}
      <Dialog open={showUploadModal} onOpenChange={(open) => {
        if (!isUploading) {
          if (!open && isFullScreen) {
            // If closing when in fullscreen, just exit fullscreen instead
            setIsFullScreen(false);
            return;
          }
          
          setShowUploadModal(open);
          if (!open) {
            // Don't clear files when dialog is closed
            setFileError(null);
            setIsFullScreen(false);
          }
        }
      }}>
        <DialogContent className={isFullScreen ? "sm:max-w-[90vw] w-[90vw] h-[85vh] max-h-[85vh] overflow-hidden" : "sm:max-w-md"}>
          <DialogHeader className="flex flex-row justify-between items-center">
            <DialogTitle>Upload Documents</DialogTitle>
          </DialogHeader>
          
          {/* File limits indicator */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">
            {uploadedFiles.length > 0 && (
              <p>
                {uploadedFiles.length} of {MAX_FILES_PER_MESSAGE} files selected 
                ({totalExistingFiles + uploadedFiles.length} of {MAX_TOTAL_FILES} total files)
              </p>
            )}
          </div>
          
          {/* Loading progress indicator */}
          {isUploading && (
            <div className="my-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                  style={{width: `${uploadingProgress}%`}}
                ></div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                Processing documents... {uploadingProgress}%
              </p>
            </div>
          )}
          
          {/* File preview area */}
          {!isUploading && (
            <div 
              className={`relative w-full ${dragActive ? 'border-2 border-dashed border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''} rounded-lg`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              {uploadedFiles.length > 0 ? (
                <div className="flex flex-col">
                  {/* Current file indicator */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md mb-3">
                    <div className="text-sm font-medium mb-1">
                      {currentPreviewIndex + 1} of {uploadedFiles.length} files
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm">
                      {uploadedFiles[currentPreviewIndex].type.startsWith('image/') ? (
                        <ImageIcon className="h-4 w-4 text-blue-500" />
                      ) : (
                        <FileTextIcon className="h-4 w-4 text-red-500" />
                      )}
                      <span className="truncate max-w-[200px]">{uploadedFiles[currentPreviewIndex].name}</span>
                      <button
                        type="button"
                        className="ml-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => {
                          // Remove this file
                          const newFiles = [...uploadedFiles];
                          newFiles.splice(currentPreviewIndex, 1);
                          setUploadedFiles(newFiles);
                          
                          // Update preview if needed
                          if (newFiles.length > 0) {
                            const newIndex = Math.min(currentPreviewIndex, newFiles.length - 1);
                            setCurrentPreviewIndex(newIndex);
                            // Generate preview for the new current file
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFilePreview(reader.result as string);
                            };
                            reader.readAsDataURL(newFiles[newIndex]);
                          } else {
                            setFilePreview(null);
                            setCurrentPreviewIndex(0);
                          }
                        }}
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                </div>
                  
                  {/* Quick file overview list */}
                  <div className="flex gap-1 flex-wrap justify-center mb-3">
                    {uploadedFiles.map((file, index) => (
                      <div 
                        key={index}
                        onClick={() => {
                          if (index !== currentPreviewIndex) {
                            setCurrentPreviewIndex(index);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFilePreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className={`px-2 py-1 text-xs rounded-full cursor-pointer flex items-center gap-1
                          ${index === currentPreviewIndex 
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                      >
                        {file.type.startsWith('image/') ? (
                          <ImageIcon className="h-3 w-3" />
                        ) : (
                          <FileTextIcon className="h-3 w-3" />
                        )}
                        <span className="truncate max-w-[80px]">{file.name}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Preview of the current file */}
                  {uploadedFiles.length > 0 && filePreview && (
                    <div className="flex flex-col items-center">
                      <div className="flex justify-between w-full mb-2">
                        <button
                          type="button"
                          className="text-sm text-blue-500 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline"
                          disabled={uploadedFiles.length <= 1 || currentPreviewIndex === 0}
                          onClick={() => {
                            if (currentPreviewIndex > 0) {
                              const newIndex = currentPreviewIndex - 1;
                              setCurrentPreviewIndex(newIndex);
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setFilePreview(reader.result as string);
                              };
                              reader.readAsDataURL(uploadedFiles[newIndex]);
                            }
                          }}
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          className="text-sm text-blue-500 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline"
                          disabled={uploadedFiles.length <= 1 || currentPreviewIndex === uploadedFiles.length - 1}
                          onClick={() => {
                            if (currentPreviewIndex < uploadedFiles.length - 1) {
                              const newIndex = currentPreviewIndex + 1;
                              setCurrentPreviewIndex(newIndex);
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setFilePreview(reader.result as string);
                              };
                              reader.readAsDataURL(uploadedFiles[newIndex]);
                            }
                          }}
                        >
                          Next
                        </button>
                      </div>
                      
                      {uploadedFiles[currentPreviewIndex]?.type.startsWith('image/') ? (
                    <div className="relative w-full flex items-center justify-center">
                      <div className={isFullScreen ? "w-full h-full flex items-center justify-center overflow-auto" : "w-full"}>
                        <div className={`${isFullScreen ? 'overflow-auto max-h-[65vh] w-full' : ''}`}>
                          <img 
                            src={filePreview} 
                            alt="Preview" 
                            className={`${isFullScreen ? 'max-w-[90%] object-contain' : 'max-h-40 max-w-full'} mb-4 rounded-lg shadow-md mx-auto`} 
                          />
                        </div>
                      </div>
                          {(uploadedFiles[currentPreviewIndex]?.type.startsWith('image/') || uploadedFiles[currentPreviewIndex]?.type === 'application/pdf') && (
                        <Button 
                          variant="secondary" 
                          size="icon"
                          onClick={() => setIsFullScreen(!isFullScreen)}
                          className="absolute top-2 right-2 h-7 w-7 bg-gray-800/70 hover:bg-gray-700/80 text-white shadow-md rounded-full"
                        >
                          {isFullScreen ? <MinimizeIcon className="h-3.5 w-3.5" /> : <MaximizeIcon className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                      ) : (
                    <div className={`relative mb-4 rounded-lg shadow-md ${isFullScreen ? 'h-[65vh] w-full' : 'h-[200px] w-full max-w-[300px]'}`}>
                      <div className="w-full h-full overflow-auto">
                        <object 
                          data={filePreview} 
                          type="application/pdf" 
                          className="w-full h-full"
                        >
                          <div className="flex items-center justify-center w-full h-full bg-gray-100 dark:bg-gray-800 p-4 text-center">
                            <div>
                              <FileTextIcon className="w-10 h-10 text-red-500 mx-auto mb-2" />
                              <p className="text-sm text-gray-600 dark:text-gray-300">PDF preview not available</p>
                            </div>
                          </div>
                        </object>
                      </div>
                          {(uploadedFiles[currentPreviewIndex]?.type.startsWith('image/') || uploadedFiles[currentPreviewIndex]?.type === 'application/pdf') && (
                        <Button 
                          variant="secondary" 
                          size="icon"
                          onClick={() => setIsFullScreen(!isFullScreen)}
                          className="absolute top-2 right-2 h-7 w-7 bg-gray-800/70 hover:bg-gray-700/80 text-white shadow-md rounded-full"
                        >
                          {isFullScreen ? <MinimizeIcon className="h-3.5 w-3.5" /> : <MaximizeIcon className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                      )}
                    </div>
                  )}
                  
                  {/* Add more files button - use a more direct approach */}
                  <div className="text-center mt-2">
                      <Button 
                      variant="outline" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (uploadedFiles.length >= MAX_FILES_PER_MESSAGE || 
                            (uploadedFiles.length + totalExistingFiles) >= MAX_TOTAL_FILES) {
                          return;
                        }
                        openFileSelector();
                      }}
                        size="sm" 
                      disabled={uploadedFiles.length >= MAX_FILES_PER_MESSAGE || 
                               (uploadedFiles.length + totalExistingFiles) >= MAX_TOTAL_FILES}
                      >
                      Add More Files
                      </Button>
                    {fileError && <p className="text-sm text-red-500 mt-2">{fileError}</p>}
                  </div>
                </div>
              ) : (
                <>
                  <svg className="w-12 h-12 text-gray-400 mb-3 mx-auto mt-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-lg font-medium mb-2 text-center">Drop files here or click to upload</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
                    Upload PDF or image files (JPG, PNG, etc.)
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 text-center">
                    Maximum file size: 10MB each
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">
                    Limits: {MAX_FILES_PER_MESSAGE} files per message, {MAX_TOTAL_FILES} total files in chat
                  </p>
                  <div className="text-center mb-6">
                  <Button 
                    variant="outline" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (totalExistingFiles >= MAX_TOTAL_FILES) {
                          return;
                        }
                        openFileSelector();
                      }}
                      disabled={totalExistingFiles >= MAX_TOTAL_FILES}
                  >
                      Select Files
                  </Button>
                  </div>
                  
                  {fileError && <p className="text-sm text-red-500 mt-2 text-center">{fileError}</p>}
                </>
              )}
            </div>
          )}
          
          {/* Ensure the file input is present */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.pdf"
            className="hidden"
            multiple
            id="file-upload-input"
          />
          
          <DialogFooter className="flex justify-between items-center gap-2 mt-4 px-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowUploadModal(false);
              }}
              disabled={isUploading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setShowUploadModal(false);
              }}
              disabled={uploadedFiles.length === 0 || isUploading}
              className="flex-1"
            >
              Use Documents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 