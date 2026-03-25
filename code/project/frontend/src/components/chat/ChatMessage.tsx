"use client";

import React, { useState } from 'react';
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaperclipIcon, FileIcon, FileTextIcon, ImageIcon, LinkIcon, MinimizeIcon, MaximizeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  message: string;
  isBot: boolean;
  timestamp?: string;
  documentData?: {
    fileName: string;
    fileType: string;
    fileContent?: string;
    markdownContent?: string;
  }[];
}

// Helper function to detect URLs in text
const findUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

// Component for displaying links with thumbnails
const InlineLinkDisplay = ({ url }: { url: string }) => {
  // Extract domain name for display
  const domainMatch = url.match(/^https?:\/\/(?:www\.)?([^\/]+)/i);
  const domain = domainMatch ? domainMatch[1] : url;
  
  // Handle click to open link in new tab
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded my-1 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/30"
      onClick={handleClick}
    >
      <LinkIcon className="h-3.5 w-3.5 text-blue-500" />
      <span className="text-xs text-blue-600 dark:text-blue-300 font-medium">{domain}</span>
    </div>
  );
};

// Enhanced thumbnail link display that appears below message
const ThumbnailLinkDisplay = ({ url, title }: { url: string; title?: string }) => {
  // Extract domain name and path for display
  const domainMatch = url.match(/^https?:\/\/(?:www\.)?([^\/]+)/i);
  const domain = domainMatch ? domainMatch[1] : "website";
  
  // Generate more descriptive title from URL
  const generateDescriptiveTitle = (url: string): string => {
    // For NHS links, extract the condition name from URL
    if (url.includes('nhs.uk')) {
      // Extract condition from URL path
      const conditionMatch = url.match(/conditions\/([^\/]+)/i);
      if (conditionMatch && conditionMatch[1]) {
        // Convert hyphenated condition to title case with spaces
        const condition = conditionMatch[1]
          .replace(/-/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        return `${condition} - NHS`;
      }
      
      // Try to extract symptoms, medicines, etc.
      const topicMatch = url.match(/\/([^\/]+)\/([^\/]+)/i);
      if (topicMatch && topicMatch[1] && topicMatch[2]) {
        const category = topicMatch[1].charAt(0).toUpperCase() + topicMatch[1].slice(1);
        const topic = topicMatch[2]
          .replace(/-/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        return `${topic} - NHS ${category}`;
      }
    }
    
    // For WebMD links
    if (url.includes('webmd.com')) {
      const topicMatch = url.match(/\/([^\/]+)\/([^\/]+)/i);
      if (topicMatch && topicMatch[2]) {
        const topic = topicMatch[2]
          .replace(/-/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        return `${topic} - WebMD`;
      }
    }
    
    // Generic title formation for other medical sites
    const pathSegments = url.split('/').filter(Boolean);
    if (pathSegments.length > 2) {
      const lastSegment = pathSegments[pathSegments.length - 1]
        .replace(/-/g, ' ')
        .replace(/\.html|\.php|\.aspx/g, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      if (lastSegment.length > 3) {
        return lastSegment;
      }
    }
    
    // Default to domain name if we couldn't extract anything meaningful
    return domain;
  };
  
  // Generate title if not provided
  const linkTitle = title || generateDescriptiveTitle(url);
  
  // Determine link category/type for the thumbnail
  const getLinkCategory = (url: string): string => {
    if (url.includes('nhs.uk')) return 'NHS';
    if (url.includes('webmd.com')) return 'WebMD';
    if (url.includes('mayoclinic.org')) return 'Mayo Clinic';
    if (url.includes('medlineplus.gov')) return 'MedlinePlus';
    if (url.includes('health')) return 'Health';
    if (url.includes('med')) return 'Medical';
    return 'Info';
  };
  
  const category = getLinkCategory(url);
  
  // Define background color based on category
  const getBgColor = (category: string): string => {
    switch(category) {
      case 'NHS': return 'bg-blue-100 dark:bg-blue-900/30';
      case 'WebMD': return 'bg-green-100 dark:bg-green-900/30';
      case 'Mayo Clinic': return 'bg-red-100 dark:bg-red-900/30';
      case 'MedlinePlus': return 'bg-purple-100 dark:bg-purple-900/30';
      case 'Health': return 'bg-teal-100 dark:bg-teal-900/30';
      case 'Medical': return 'bg-indigo-100 dark:bg-indigo-900/30';
      default: return 'bg-gray-100 dark:bg-gray-800/30';
    }
  };
  
  // Handle click to open link in new tab
  const handleClick = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // State to track mouse position for gradient effect
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // Handle mouse movement to update the gradient position
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left, // x position within the element
      y: e.clientY - rect.top   // y position within the element
    });
  };

  return (
    <div 
      className="flex items-stretch overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:shadow-md transition-shadow relative"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Animated gradient overlay that follows cursor */}
      {isHovering && (
        <div 
          className="absolute inset-0 opacity-30 pointer-events-none transition-opacity duration-200 z-0"
          style={{
            background: `radial-gradient(circle 100px at ${mousePosition.x}px ${mousePosition.y}px, 
                        rgba(99, 102, 241, 0.4), 
                        rgba(99, 102, 241, 0) 70%)`,
          }}
        />
      )}
      
      {/* Left category indicator */}
      <div className={`flex items-center justify-center w-16 ${getBgColor(category)} p-2 relative z-10`}>
        <span className="text-xs font-medium text-center">{category}</span>
      </div>
      
      {/* Right content area */}
      <div className="flex flex-col justify-between py-2 px-3 flex-1 relative z-10">
        <div className="font-medium text-sm line-clamp-1">{linkTitle}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{url.replace(/^https?:\/\/(?:www\.)?/i, '')}</div>
      </div>
    </div>
  );
};

// Function to process text and replace URLs with link components
const processMessageWithLinks = (message: string): React.ReactNode[] => {
  const urls = findUrls(message);
  if (urls.length === 0) return [message];

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Process each URL found in the message
  urls.forEach((url, index) => {
    const urlIndex = message.indexOf(url, lastIndex);
    
    // Add text before the URL
    if (urlIndex > lastIndex) {
      parts.push(message.substring(lastIndex, urlIndex));
    }
    
    // Add the URL component
    parts.push(<InlineLinkDisplay key={`link-${index}`} url={url} />);
    
    lastIndex = urlIndex + url.length;
  });
  
  // Add any remaining text after the last URL
  if (lastIndex < message.length) {
    parts.push(message.substring(lastIndex));
  }
  
  return parts;
};

/**
 * Extracts URLs from a message string for thumbnail generation
 * 
 * This utility function parses the message text to identify any URLs
 * that could be displayed as thumbnails in the chat interface.
 * 
 * @param message - The chat message text to parse
 * @returns Array of URLs found in the message
 */
const extractLinksForThumbnails = (message: string): string[] => {
  return findUrls(message);
};

export function ChatMessage({ message, isBot, timestamp, documentData }: ChatMessageProps) {
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Process message to display links
  const processedMessage = message; // Just display regular text without inline links
  
  // Extract links for thumbnail display
  const links = extractLinksForThumbnails(message);

  const getDocumentIcon = (doc: ChatMessageProps['documentData'][0]) => {
    if (!doc) return null;
    
    if (doc.fileType.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    } else if (doc.fileType === 'application/pdf') {
      return <FileTextIcon className="h-4 w-4 text-red-500" />;
    } else {
      return <FileIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const openDocument = (index: number) => {
    setCurrentDocumentIndex(index);
    setShowDocumentDialog(true);
  };

  return (
    <div className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'}`}>
      {isBot && (
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded-full bg-green-100/70 dark:bg-green-900/40 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 text-green-500 dark:text-green-400"
            >
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
              <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
              <circle cx="20" cy="10" r="2" />
            </svg>
          </div>
        </div>
      )}
      <div className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} max-w-[75%]`}>
        <div className={`${isBot ? 'frosted-bubble-green dark:frosted-bubble-green-dark' : 'frosted-bubble-blue dark:frosted-bubble-blue-dark'} shadow-sm ${documentData?.length || links.length > 0 ? 'pb-2' : ''}`}>
          <div className="text-sm">{processedMessage}</div>
          
          {/* Links section with gradient border */}
          {links.length > 0 && (
            <div className="mt-3 pt-2 relative">
              {/* Gradient border */}
              <div 
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{
                  background: isBot 
                    ? 'linear-gradient(to right, rgba(134, 239, 172, 0.3), rgba(245, 158, 11, 0.5), rgba(59, 130, 246, 0.5), rgba(134, 239, 172, 0.3))' 
                    : 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(245, 158, 11, 0.5), rgba(168, 85, 247, 0.5), rgba(59, 130, 246, 0.3))'
                }}
              />
              <div className="space-y-2">
                {links.map((url, index) => (
                  <ThumbnailLinkDisplay key={`thumbnail-${index}`} url={url} />
                ))}
              </div>
            </div>
          )}
          
          {/* Document attachment indicators with gradient border */}
          {documentData && documentData.length > 0 && (
            <div className="mt-3 pt-2 relative">
              {/* Gradient border */}
              <div 
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{
                  background: isBot 
                    ? 'linear-gradient(to right, rgba(134, 239, 172, 0.3), rgba(245, 158, 11, 0.5), rgba(59, 130, 246, 0.5), rgba(134, 239, 172, 0.3))' 
                    : 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(245, 158, 11, 0.5), rgba(168, 85, 247, 0.5), rgba(59, 130, 246, 0.3))'
                }}
              />
              {documentData.map((doc, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 cursor-pointer hover:bg-white/10 dark:hover:bg-gray-900/20 p-1 rounded"
                  onClick={() => openDocument(index)}
                >
                  <PaperclipIcon className="h-3.5 w-3.5 text-gray-500" />
                  <div className="flex items-center gap-1.5">
                    {getDocumentIcon(doc)}
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[180px]">
                      {doc.fileName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {timestamp && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
            {timestamp}
          </span>
        )}
      </div>
      {!isBot && (
        <div className="flex-shrink-0 ml-3">
          <div className="w-8 h-8 rounded-full bg-blue-100/70 dark:bg-blue-900/40 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 text-blue-500 dark:text-blue-400"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      )}

      {/* Document preview dialog */}
      {documentData && documentData.length > 0 && (
        <Dialog open={showDocumentDialog} onOpenChange={(open) => {
          if (!open && isFullScreen) {
            // If closing when in fullscreen, just exit fullscreen first
            setIsFullScreen(false);
            return;
          }
          setShowDocumentDialog(open);
          if (!open) {
            setIsFullScreen(false);
          }
        }}>
          <DialogContent className={isFullScreen ? "sm:max-w-[90vw] w-[90vw] h-[85vh] max-h-[85vh] overflow-hidden" : "sm:max-w-lg max-h-[80vh] overflow-hidden"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getDocumentIcon(documentData[currentDocumentIndex])}
                {documentData[currentDocumentIndex].fileName}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col h-full">
              {documentData.length > 1 && (
                <div className="flex justify-between items-center mb-3">
                  <button
                    className="text-sm text-blue-500 hover:underline disabled:opacity-50 disabled:no-underline"
                    disabled={currentDocumentIndex === 0}
                    onClick={() => setCurrentDocumentIndex(prev => Math.max(0, prev - 1))}
                  >
                    Previous Document
                  </button>
                  <span className="text-sm text-gray-500">
                    {currentDocumentIndex + 1} of {documentData.length}
                  </span>
                  <button
                    className="text-sm text-blue-500 hover:underline disabled:opacity-50 disabled:no-underline"
                    disabled={currentDocumentIndex === documentData.length - 1}
                    onClick={() => setCurrentDocumentIndex(prev => Math.min(documentData.length - 1, prev + 1))}
                  >
                    Next Document
                  </button>
                </div>
              )}
              <div className="relative overflow-auto flex-grow border rounded-md p-4 bg-white dark:bg-gray-950 max-h-[60vh]">
                {documentData[currentDocumentIndex].fileType.startsWith('image/') && documentData[currentDocumentIndex].fileContent ? (
                  <div className="flex justify-center relative w-full h-full">
                    <div className="overflow-auto max-h-[58vh] w-full flex items-center justify-center">
                      <img 
                        src={`data:${documentData[currentDocumentIndex].fileType};base64,${documentData[currentDocumentIndex].fileContent}`} 
                        alt={documentData[currentDocumentIndex].fileName}
                        className={`${isFullScreen ? 'max-w-[95%]' : 'max-h-[50vh] max-w-full'} object-contain`}
                      />
                    </div>
                  </div>
                ) : documentData[currentDocumentIndex].markdownContent ? (
                  <div className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown>{documentData[currentDocumentIndex].markdownContent}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Document content is being processed and analyzed by AI
                    </p>
                  </div>
                )}
                
                <Button 
                  variant="secondary" 
                  size="icon"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="absolute top-2 right-2 h-7 w-7 bg-gray-800/70 hover:bg-gray-700/80 text-white shadow-md rounded-full"
                >
                  {isFullScreen ? <MinimizeIcon className="h-3.5 w-3.5" /> : <MaximizeIcon className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 