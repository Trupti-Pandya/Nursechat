'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
// Import only what's actually used
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2, Loader2, AlertCircle, X, Eye, Maximize2, CheckCircle, CalendarClock, Download, RefreshCw, Bold, Italic, Heading2, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Highlighter } from 'lucide-react';
import { DashboardLayout } from './dashboard-layout';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import showdown from 'showdown';

// TipTap imports
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';

// Add TypeScript interface for window with showdown
declare global {
  interface Window {
    showdown: typeof showdown;
  }
}

// Create a toast container if it doesn't exist
function createToastContainer() {
  let container = document.getElementById('toast-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none';
    container.style.transition = 'opacity 0.3s';
    document.body.appendChild(container);
  }
  
  return container;
}

// Override console.error to prevent specific messages from being logged
const originalConsoleError = console.error;
console.error = function (...args) {
  // Check if this is one of our toast error messages
  const suppressedErrors = [
    'Cannot load current file. File structure does not match the form.',
    'No active hospital information file found',
    'No draft found. You can load the active file or start fresh.',
    'Failed to save draft',
    'Draft saved successfully',
    'Your draft has been loaded'
  ];
  
  // If any of our suppressed errors are in the message, don't log to console
  if (args.length > 0 && typeof args[0] === 'string') {
    const messageStr = args[0].toString();
    for (const suppressedError of suppressedErrors) {
      if (messageStr.includes(suppressedError)) {
        // Skip logging this error
        return;
      }
    }
  }
  
  // For all other errors, use the original console.error
  originalConsoleError.apply(console, args);
};

// Simple toast/notification function to replace sonner
const toast = {
  success: (message: string) => {
    const toastContainer = createToastContainer();
    const toast = document.createElement('div');
    toast.className = 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm border border-green-100 dark:border-green-800/30 mb-2 pointer-events-auto w-80';
    toast.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
    </svg>
    <span class="line-clamp-3">${message}</span>`;
    toastContainer.appendChild(toast);
    
    // Animate the toast
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    
    // Force a reflow to ensure the transition works
    void toast.offsetWidth;
    
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
    
    console.log('✅ ' + message);
  },
  error: (message: string) => {
    const toastContainer = createToastContainer();
    const toast = document.createElement('div');
    toast.className = 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm border border-red-100 dark:border-red-800/30 mb-2 pointer-events-auto w-80';
    toast.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
    </svg>
    <span class="line-clamp-3">${message}</span>`;
    toastContainer.appendChild(toast);
    
    // Animate the toast
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    
    // Force a reflow to ensure the transition works
    void toast.offsetWidth;
    
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
    
    // Don't use console.error here to avoid duplicate logs
    console.log('❌ ' + message);
  },
  info: (message: string) => {
    const toastContainer = createToastContainer();
    const toast = document.createElement('div');
    toast.className = 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm border border-blue-100 dark:border-blue-800/30 mb-2 pointer-events-auto w-80';
    toast.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 4a1 1 0 01-1 1h-1a1 1 0 010-2h1a1 1 0 011 1zm3 4a1 1 0 01-1 1h-1a1 1 0 010-2h1a1 1 0 011 1z" clip-rule="evenodd" />
    </svg>
    <span class="line-clamp-3">${message}</span>`;
    toastContainer.appendChild(toast);
    
    // Animate the toast
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    
    // Force a reflow to ensure the transition works
    void toast.offsetWidth;
    
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
    
    console.log('ℹ️ ' + message);
  }
};

// Alert component for error message display
const Alert = ({ message }: { message: string }) => (
  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md mb-4 flex items-start">
    <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
    <div>{message}</div>
  </div>
);

// Add this common table styles component at the top of the file, after the Alert component
const tableStyles = {
  table: "border rounded-md overflow-hidden",
  tableHeader: "bg-slate-50 dark:bg-slate-800/50",
  tableHeaderRow: "",
  tableHead: "font-semibold py-3",
  tableRow: "hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors",
  tableCell: "p-2",
  actionCell: "p-2 text-right",
  deleteButton: "p-1.5 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
};

// Preview Modal Component
const PreviewModal = ({ content, isOpen, onClose }: { 
  content: string; 
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [htmlContent, setHtmlContent] = useState('');
  
  useEffect(() => {
    // Only process the markdown when the modal is open
    if (!isOpen || !content) return;
    
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
  }, [content, isOpen]);

  // Add custom styles for the rendered markdown and paper texture
  const customStyles = `
    .preview-container {
      background-color: #faf7f7;
      overflow: auto;
      padding: 2rem;
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
  `;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex justify-center items-center p-4 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <div className="w-full max-w-5xl h-[90vh] max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-gray-200 dark:border-gray-700 gap-3">
          <h2 className="text-xl font-semibold">Hospital Information Preview</h2>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose} 
              className="h-8 px-2"
            >
              <X className="h-4 w-4 mr-1" />
              Close
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto preview-container">
          <div className="markdown-preview">
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Add this component for activation options
const ActivationOptions = ({ 
  activationType, 
  setActivationType, 
  scheduledDate, 
  setScheduledDate, 
  scheduledTime, 
  setScheduledTime,
  onActivate,
  onSchedule,
  isProcessing
}: { 
  activationType: 'now' | 'scheduled',
  setActivationType: (type: 'now' | 'scheduled') => void,
  scheduledDate: string,
  setScheduledDate: (date: string) => void,
  scheduledTime: string,
  setScheduledTime: (time: string) => void,
  onActivate: () => void,
  onSchedule: () => void,
  isProcessing: boolean
}) => {
  // Get current date and time for min values
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  
  return (
    <div className="space-y-6 p-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50">
        <h4 className="font-medium flex items-center gap-2 mb-2 text-gray-800 dark:text-gray-200">
          <AlertCircle size={16} className="text-amber-500" /> 
          Important Note
        </h4>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          This will update the hospital information used by the AI assistant. Activating this content will replace the currently active information.
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
                The content will become active as soon as you confirm, replacing any current information.
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
          onClick={() => setActivationType('scheduled')}
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
                Set a future date and time when this content should become active.
              </p>
            </div>
          </div>
          
          {/* Date/Time Selectors */}
          {activationType === 'scheduled' && (
            <div className="mt-4 ml-8 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="scheduledDate" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                  <Input 
                    id="scheduledDate"
                    type="date" 
                    value={scheduledDate} 
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={currentDate}
                    className="w-full"
                  />
                </div>
                <div>
                  <label htmlFor="scheduledTime" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Time</label>
                  <Input 
                    id="scheduledTime"
                    type="time" 
                    value={scheduledTime} 
                    onChange={(e) => setScheduledTime(e.target.value)}
                    min={scheduledDate === currentDate ? currentTime : undefined}
                    className="w-full"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your local timezone will be used.
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-end gap-3 mt-6">
        {activationType === 'now' ? (
          <Button 
            onClick={onActivate}
            disabled={isProcessing} 
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Activating...</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Activate Now</span>
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={onSchedule}
            disabled={isProcessing || !scheduledDate || !scheduledTime} 
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Scheduling...</span>
              </>
            ) : (
              <>
                <CalendarClock className="h-4 w-4" />
                <span>Schedule Activation</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

// Validation Error Modal Component
const ValidationErrorModal = ({ isOpen, onClose, invalidSections, allSections, onNavigate }: { 
  isOpen: boolean;
  onClose: () => void;
  invalidSections: string[];
  allSections: {id: string; title: string}[];
  onNavigate: (section: string) => void;
}) => {
  if (!isOpen) return null;

  // Get section titles from ids
  const invalidSectionDetails = allSections.filter(section => 
    invalidSections.includes(section.id)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex justify-center items-center p-4 overflow-hidden">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Required Fields Missing
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            className="h-8 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4">
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Please complete all required fields in the following sections before activating:
          </p>
          
          <div className="space-y-2 mb-4">
            {invalidSectionDetails.map((section) => (
              <Button 
                key={section.id} 
                variant="outline" 
                onClick={() => {
                  onNavigate(section.id);
                  onClose();
                }}
                className="w-full justify-start text-left border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700"
              >
                <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                {section.title}
              </Button>
            ))}
          </div>
          
          <Button onClick={onClose} className="w-full mt-2">
            Okay, I'll Fix It
          </Button>
        </div>
      </div>
    </div>
  );
};

// IMPORTANT section component using TipTap for rich text editing
const RichTextEditor = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Heading.configure({
        levels: [1, 2, 3],
        HTMLAttributes: {
          class: 'text-xl font-bold',
        },
      }),
      BulletList.configure({
        HTMLAttributes: {
          class: 'list-disc ml-4',
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'list-decimal ml-4',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none px-4 py-3 focus:outline-none text-gray-800 dark:text-gray-200',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="border rounded-md p-4 h-[300px] bg-white dark:bg-gray-800/50">
        <div className="h-10 border-b mb-4 flex items-center">
          <div className="w-36 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        <div className="space-y-2">
          <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="w-4/5 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="w-3/5 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!editor) {
    return null;
  }

  // Full screen mode layout
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
        {/* Header with title and close button */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-lg font-medium">Edit Important Information</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullScreen(false)}
            className="h-8 px-2"
          >
            <X className="h-4 w-4 mr-1" />
            Exit Full Screen
          </Button>
        </div>
        
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 sticky top-0 z-10">
          {/* Bold */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('bold') }
            )}
            title="Bold"
            type="button"
          >
            <Bold className="h-4 w-4" />
          </button>
          
          {/* Italic */}
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('italic') }
            )}
            title="Italic"
            type="button"
          >
            <Italic className="h-4 w-4" />
          </button>
          
          <div className="h-4 border-r border-gray-300 dark:border-gray-600 mx-1"></div>
          
          {/* Heading */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('heading', { level: 2 }) }
            )}
            title="Heading"
            type="button"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          
          <div className="h-4 border-r border-gray-300 dark:border-gray-600 mx-1"></div>
          
          {/* Bullet List */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('bulletList') }
            )}
            title="Bullet List"
            type="button"
          >
            <List className="h-4 w-4" />
          </button>
          
          {/* Ordered List */}
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('orderedList') }
            )}
            title="Ordered List"
            type="button"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          
          <div className="h-4 border-r border-gray-300 dark:border-gray-600 mx-1"></div>
          
          {/* Text Align Left */}
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive({ textAlign: 'left' }) }
            )}
            title="Align Left"
            type="button"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          
          {/* Text Align Center */}
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive({ textAlign: 'center' }) }
            )}
            title="Align Center"
            type="button"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          
          {/* Text Align Right */}
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive({ textAlign: 'right' }) }
            )}
            title="Align Right"
            type="button"
          >
            <AlignRight className="h-4 w-4" />
          </button>
          
          <div className="h-4 border-r border-gray-300 dark:border-gray-600 mx-1"></div>
          
          {/* Highlight */}
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('highlight') }
            )}
            title="Highlight"
            type="button"
          >
            <Highlighter className="h-4 w-4" />
          </button>
        </div>
        
        {/* Editor - full screen with auto height */}
        <div className="flex-grow overflow-auto bg-white dark:bg-gray-800">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    );
  }

  // Normal mode layout
  return (
    <div className="border rounded-md overflow-hidden shadow-sm bg-white dark:bg-gray-800/30">
      <div className="flex flex-wrap items-center justify-between gap-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 sticky top-0 z-10">
        <div className="flex flex-wrap items-center gap-1">
          {/* Bold */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('bold') }
            )}
            title="Bold"
            type="button"
          >
            <Bold className="h-4 w-4" />
          </button>
          
          {/* Italic */}
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('italic') }
            )}
            title="Italic"
            type="button"
          >
            <Italic className="h-4 w-4" />
          </button>
          
          <div className="h-4 border-r border-gray-300 dark:border-gray-600 mx-1"></div>
          
          {/* Heading */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('heading', { level: 2 }) }
            )}
            title="Heading"
            type="button"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          
          <div className="h-4 border-r border-gray-300 dark:border-gray-600 mx-1"></div>
          
          {/* Bullet List */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('bulletList') }
            )}
            title="Bullet List"
            type="button"
          >
            <List className="h-4 w-4" />
          </button>
          
          {/* Ordered List */}
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('orderedList') }
            )}
            title="Ordered List"
            type="button"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          
          <div className="h-4 border-r border-gray-300 dark:border-gray-600 mx-1 hidden sm:block"></div>
          
          {/* Text Align - Hide on Small Screens */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={cn(
                "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
                { "bg-gray-200 dark:bg-gray-700": editor.isActive({ textAlign: 'left' }) }
              )}
              title="Align Left"
              type="button"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={cn(
                "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
                { "bg-gray-200 dark:bg-gray-700": editor.isActive({ textAlign: 'center' }) }
              )}
              title="Align Center"
              type="button"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={cn(
                "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
                { "bg-gray-200 dark:bg-gray-700": editor.isActive({ textAlign: 'right' }) }
              )}
              title="Align Right"
              type="button"
            >
              <AlignRight className="h-4 w-4" />
            </button>
            
            <div className="h-4 border-r border-gray-300 dark:border-gray-600 mx-1"></div>
          </div>
          
          {/* Highlight */}
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={cn(
              "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700",
              { "bg-gray-200 dark:bg-gray-700": editor.isActive('highlight') }
            )}
            title="Highlight"
            type="button"
          >
            <Highlighter className="h-4 w-4" />
          </button>
        </div>
        
        {/* Fullscreen toggle button */}
        <button
          onClick={() => setIsFullScreen(true)}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ml-auto"
          title="Full Screen Mode"
          type="button"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
      
      {/* Fixed height container with scrollable content */}
      <div className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default function HospitalInfoForm() {
  // Get authenticated user
  const { user, profile } = useAuth();
  
  // Ref to track if we've shown the toast already (won't reset on re-renders)
  const draftToastShownRef = useRef(false);
  
  // Ref to track if we've already attempted to load a draft (to prevent infinite loops)
  const loadingAttemptedRef = useRef(false);
  
  // State for preview modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // State for activation modal
  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [activationType, setActivationType] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  
  // State for loading active file
  const [isLoadingActiveFile, setIsLoadingActiveFile] = useState(false);
  const [activeFileError, setActiveFileError] = useState<string | null>(null);
  
  // State for draft operations
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  
  // Get admin name or identifier
  const getAdminIdentifier = () => {
    if (profile?.fullName) return profile.fullName;
    if (user?.email) return user.email;
    if (user?.user_metadata?.name) return user.user_metadata.name;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.user_metadata?.username) return user.user_metadata.username;
    return "Unknown admin";
  };

  // Metadata
  const [hospitalName, setHospitalName] = useState('');
  const [notes, setNotes] = useState('');
  const [importantInfo, setImportantInfo] = useState('');

  // Wards
  const [wards, setWards] = useState([{ name: '', location: '', head: '', beds: '', dayShift: '', nightShift: '' }]);
  const [referralHospitals, setReferralHospitals] = useState([{ name: '' }]);

  // Labs
  const [labs, setLabs] = useState([{ name: '', location: '', head: '', services: '' }]);
  const [unavailableLabs, setUnavailableLabs] = useState([{ name: '', description: '', referral: '' }]);

  // Specialists
  const [alwaysAvailableSpecialists, setAlwaysAvailableSpecialists] = useState([{ type: '', head: '' }]);
  const [scheduledSpecialists, setScheduledSpecialists] = useState([{ type: '', availability: '', head: '', notes: '' }]);

  // Emergency Procedures
  const [emergencyProcedures, setEmergencyProcedures] = useState([{ name: '', initialResponse: '', secondaryResponse: '', contact: '' }]);

  // Pharmacy
  const [pharmacyLocations, setPharmacyLocations] = useState([{ name: '', location: '', hours: '', services: '' }]);

  // Referrals
  const [partnerHospitals, setPartnerHospitals] = useState([{ name: '', specialization: '', contact: '' }]);

  // Navigation
  const [accessPoints, setAccessPoints] = useState([{ name: '', description: '' }]);
  const [keyLocations, setKeyLocations] = useState([{ name: '', description: '' }]);

  // FAQ
  const [faq, setFaq] = useState([{ question: '', answer: '' }]);

  // UI State
  const [activeSection, setActiveSection] = useState('metadata');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidSections, setInvalidSections] = useState<string[]>([]);
  const [attemptedActivation, setAttemptedActivation] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);

  /**
   * Validates the form data and tracks invalid sections
   * 
   * This memoized function performs validation on all form sections:
   * - Checks required fields in each section
   * - Updates the invalidSections state with names of incomplete sections
   * - Optionally redirects to the first invalid section (when not in auto-validate mode)
   * 
   * The function is memoized to prevent unnecessary re-renders during validation
   * that's triggered by useEffect hooks.
   * 
   * @param autoValidate - When true, only validates without changing active section
   * @returns Boolean indicating if the entire form is valid
   */
  const validateFormData = useCallback((autoValidate = false) => {
    const invalidList: string[] = [];
    
    if (!hospitalName) {
      invalidList.push('metadata');
    }
    
    if (wards.length === 0 || wards.some(ward => !ward.name || !ward.location)) {
      invalidList.push('wards');
    }
    
    if (labs.length === 0 || labs.some(lab => !lab.name || !lab.location)) {
      invalidList.push('labs');
    }
    
    if (alwaysAvailableSpecialists.length === 0 || !alwaysAvailableSpecialists.some(spec => spec.type)) {
      invalidList.push('specialists');
    }
    
    if (emergencyProcedures.length === 0 || emergencyProcedures.some(proc => !proc.name || !proc.initialResponse)) {
      invalidList.push('emergency');
    }
    
    if (pharmacyLocations.length === 0 || !pharmacyLocations.some(pharm => pharm.name && pharm.location)) {
      invalidList.push('pharmacy');
    }
    
    // Removed validation for referrals - this section can be empty
    
    if (accessPoints.length === 0 || !accessPoints.some(point => point.name)) {
      invalidList.push('navigation');
    }
    
    if (faq.length === 0 || !faq.some(item => item.question && item.answer)) {
      invalidList.push('faq');
    }
    
    setInvalidSections(invalidList);
    
    // If there are invalid sections, set the active section to the first invalid one
    // But only do this when manually validating (not during auto-validation from useEffect)
    if (invalidList.length > 0 && !autoValidate) {
      setActiveSection(invalidList[0]);
      return false;
    }
    
    return true;
  }, [
    hospitalName, 
    wards, 
    labs, 
    alwaysAvailableSpecialists, 
    emergencyProcedures,
    pharmacyLocations,
    accessPoints,
    faq,
    setInvalidSections,
    setActiveSection
  ]);

  // Replace the regular validateForm function with the memoized one
  const validateForm = validateFormData;

  // Revalidate form when data changes to update invalid sections
  useEffect(() => {
    if (attemptedActivation) {
      // Only revalidate after first activation attempt, using autoValidation mode
      validateFormData(true);
    }
  }, [
    attemptedActivation, 
    validateFormData
  ]);

  // Helper functions
  const addItem = <T extends Record<string, any>>(
    array: T[], 
    setArray: React.Dispatch<React.SetStateAction<T[]>>, 
    defaultItem: T
  ) => {
    setArray([...array, { ...defaultItem }]);
  };

  const removeItem = <T extends Record<string, any>>(
    array: T[], 
    setArray: React.Dispatch<React.SetStateAction<T[]>>, 
    index: number
  ) => {
    const newArray = [...array];
    newArray.splice(index, 1);
    setArray(newArray);
  };

  const updateItem = <T extends Record<string, any>>(
    array: T[], 
    setArray: React.Dispatch<React.SetStateAction<T[]>>, 
    index: number, 
    field: keyof T, 
    value: any
  ) => {
    const newArray = [...array];
    newArray[index] = { ...newArray[index], [field]: value };
    setArray(newArray);
  };

  /**
   * Determines if a specific section is complete based on its required fields
   * 
   * This function evaluates each section's completion status by checking:
   * - Required fields have values
   * - Arrays have at least one valid entry
   * - All required subfields in objects are filled
   * 
   * Some sections (like important info) are optional but still get visual completion indicators.
   * 
   * @param section - The section identifier to check
   * @returns Boolean indicating if section is complete
   */
  const calculateCompletion = (section: string) => {
    switch (section) {
      case 'metadata':
        return hospitalName ? true : false;
      case 'wards':
        return wards.length > 0 && wards.every(ward => ward.name && ward.location);
      case 'labs':
        return labs.length > 0 && labs.every(lab => lab.name && lab.location);
      case 'specialists':
        return alwaysAvailableSpecialists.length > 0 && alwaysAvailableSpecialists.every(spec => spec.type);
      case 'emergency':
        return emergencyProcedures.length > 0 && emergencyProcedures.every(proc => proc.name && proc.initialResponse);
      case 'pharmacy':
        return pharmacyLocations.length > 0 && pharmacyLocations.every(pharm => pharm.name && pharm.location);
      case 'referrals':
        // For visual display - show green checkmark only if there is content
        // Section is still optional for validation purposes
        return partnerHospitals.length > 0 && partnerHospitals.every(hosp => hosp.name);
      case 'important':
        // Visual display only - section is optional
        return importantInfo.trim().length > 0;
      case 'navigation':
        return accessPoints.length > 0 && accessPoints.every(point => point.name);
      case 'faq':
        return faq.length > 0 && faq.every(item => item.question && item.answer);
      default:
        return false;
    }
  };

  /**
   * Calculates the overall form completion percentage
   * 
   * This function determines what percentage of sections are complete
   * by counting sections that pass the calculateCompletion check
   * and dividing by the total number of sections.
   * 
   * @returns Integer percentage from 0-100 representing form completion
   */
  const calculateCompletionPercentage = () => {
    const sections = ['metadata', 'wards', 'labs', 'specialists', 'emergency', 'pharmacy', 'referrals', 'important', 'navigation', 'faq'];
    const completedSections = sections.filter(calculateCompletion).length;
    return Math.round((completedSections / sections.length) * 100);
  };

  // Generate markdown content
  const generateMarkdown = () => {
    let markdown = '';

    // Metadata is separate from markdown content, but we'll display it in preview
    markdown += `## Hospital Name: ${hospitalName || 'Unknown'}\n\n`;

    // Important information section if it exists
    if (importantInfo.trim()) {
      markdown += '## ⚠️ IMPORTANT INFORMATION ⚠️\n\n';
      // Use the HTML content directly since it's already formatted by the rich text editor
      markdown += importantInfo.trim() + '\n\n';
      markdown += '---\n\n';
    }

    // Wards section
    markdown += '## Hospital Wards\n\n';
    if (wards.length > 0) {
      markdown += '| Ward Name | Location | Head Doctor | Beds | Day Shift | Night Shift |\n';
      markdown += '|-----------|----------|-------------|------|-----------|-------------|\n';
      wards.forEach(ward => {
        markdown += `| ${ward.name} | ${ward.location} | ${ward.head} | ${ward.beds} | ${ward.dayShift} | ${ward.nightShift} |\n`;
      });
    } else {
      markdown += 'No ward information available.\n';
    }
    
    if (referralHospitals.length > 0) {
      markdown += '\n### Specialized Ward Referrals\n\n';
      referralHospitals.forEach(hospital => {
        markdown += `- ${hospital.name}\n`;
      });
    }

    // Labs section
    markdown += '\n## Laboratory Facilities\n\n';
    if (labs.length > 0) {
      markdown += '| Lab Name | Location | Head | Services |\n';
      markdown += '|----------|----------|------|----------|\n';
      labs.forEach(lab => {
        markdown += `| ${lab.name} | ${lab.location} | ${lab.head} | ${lab.services} |\n`;
      });
    } else {
      markdown += 'No laboratory information available.\n';
    }
    
    if (unavailableLabs.length > 0) {
      markdown += '\n### Unavailable Laboratory Services\n\n';
      unavailableLabs.forEach(lab => {
        markdown += `- **${lab.name}**: ${lab.description}. Refer to: ${lab.referral}\n`;
      });
    }

    // Specialists section
    markdown += '\n## Medical Specialists\n\n';
    
    if (alwaysAvailableSpecialists.length > 0) {
      markdown += '### Always Available (24/7)\n\n';
      markdown += '| Specialist Type | Head |\n';
      markdown += '|----------------|------|\n';
      alwaysAvailableSpecialists.forEach(specialist => {
        markdown += `| ${specialist.type} | ${specialist.head} |\n`;
      });
    }
    
    if (scheduledSpecialists.length > 0) {
      markdown += '\n### Scheduled Availability\n\n';
      markdown += '| Specialist Type | Availability | Head | Notes |\n';
      markdown += '|----------------|-------------|------|-------|\n';
      scheduledSpecialists.forEach(specialist => {
        markdown += `| ${specialist.type} | ${specialist.availability} | ${specialist.head} | ${specialist.notes} |\n`;
      });
    }

    // Emergency procedures
    markdown += '\n## Emergency Procedures\n\n';
    emergencyProcedures.forEach(procedure => {
      markdown += `### ${procedure.name}\n\n`;
      markdown += `**Initial Response:** ${procedure.initialResponse}\n\n`;
      markdown += `**Secondary Response:** ${procedure.secondaryResponse}\n\n`;
      markdown += `**Contact:** ${procedure.contact}\n\n`;
    });

    // Pharmacy
    markdown += '\n## Pharmacy & Medication Services\n\n';
    if (pharmacyLocations.length > 0) {
      markdown += '| Pharmacy | Location | Hours | Services |\n';
      markdown += '|----------|----------|-------|----------|\n';
      pharmacyLocations.forEach(pharmacy => {
        markdown += `| ${pharmacy.name} | ${pharmacy.location} | ${pharmacy.hours} | ${pharmacy.services} |\n`;
      });
    }

    // Referrals
    markdown += '\n## Referral and Partner Hospitals\n\n';
    if (partnerHospitals.length > 0) {
      markdown += '| Hospital | Specialization | Contact |\n';
      markdown += '|----------|----------------|--------|\n';
      partnerHospitals.forEach(hospital => {
        markdown += `| ${hospital.name} | ${hospital.specialization} | ${hospital.contact} |\n`;
      });
    }

    // Navigation
    markdown += '\n## Hospital Navigation\n\n';
    
    if (accessPoints.length > 0) {
      markdown += '### Access Points\n\n';
      accessPoints.forEach(point => {
        markdown += `- **${point.name}**: ${point.description}\n`;
      });
    }
    
    if (keyLocations.length > 0) {
      markdown += '\n### Key Locations\n\n';
      keyLocations.forEach(location => {
        markdown += `- **${location.name}**: ${location.description}\n`;
      });
    }

    // FAQ
    markdown += '\n## Frequently Asked Questions\n\n';
    faq.forEach((item, index) => {
      markdown += `### Q: ${item.question}\n\n`;
      markdown += `${item.answer}\n\n`;
    });

    return markdown;
  };

  // Check if scheduled time is valid
  const isScheduledTimeValid = (): boolean => {
    if (activationType !== 'scheduled') return true;
    
    if (!scheduledDate || !scheduledTime) {
      toast.error('Please select both date and time for scheduled activation');
      return false;
    }
    
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const now = new Date();
    
    if (scheduledDateTime <= now) {
      toast.error('Scheduled time must be in the future');
      return false;
    }
    
    return true;
  };

  /**
   * Handles immediate activation of the hospital information
   * 
   * This function:
   * 1. Validates the form content is complete and valid
   * 2. Checks user authentication status
   * 3. Generates markdown content from form data
   * 4. Saves the content to the backend with active status
   * 5. Handles success and error states with appropriate UI feedback
   * 
   * On successful activation, the content is immediately available
   * to the medical chatbot system.
   */
  const handleActivateNow = async () => {
    // Validate form before submitting
    if (!validateForm()) {
      return;
    }
    
    // Check if user is logged in
    if (!user?.id) {
      toast.error('You must be logged in to activate hospital information');
      return;
    }
    
    setSaving(true);
    
    try {
      // Prepare metadata with current date and authenticated user
      const metadata = {
        hospital_name: hospitalName,
        additional_notes: notes
      };
      
      // Create content
      const content = generateMarkdown();

      // Submit to API with is_active set to true
      const response = await fetch('/api/admin/hospital-info/save-structured', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          metadata,
          uploaded_by: user.id, // Send user ID, ensuring it exists
          notes: JSON.stringify({
            metadata: {
              hospital_name: hospitalName,
              additional_notes: notes
            },
            wards,
            referralHospitals,
            labs,
            unavailableLabs,
            alwaysAvailableSpecialists,
            scheduledSpecialists,
            emergencyProcedures,
            pharmacyLocations,
            partnerHospitals,
            accessPoints,
            keyLocations,
            faq,
            importantInfo
          }),
          is_active: true, // Activate immediately
          scheduled_activation_time: null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error: ${response.status} ${response.statusText}`);
      }

      // After successful activation, delete the draft
      if (user?.id) {
        try {
          await fetch(`/api/admin/hospital-info/drafts?userId=${user.id}`, {
            method: 'DELETE'
          });
          // Reset draft loaded state
          setDraftLoaded(false);
        } catch (draftError) {
          console.error('Failed to delete draft after activation:', draftError);
          // Non-blocking error - we still want to show success for the activation
        }
      }

      toast.success('Hospital information saved and activated successfully');
      setIsActivationOpen(false);
      
      // Remove the resetForm call to preserve form data
      // resetForm();
    } catch (err) {
      console.error('Error saving and activating hospital information:', err);
      setError(err instanceof Error ? err.message : 'Failed to save hospital information');
      toast.error('Failed to save and activate hospital information');
    } finally {
      setSaving(false);
    }
  };

  // Handle scheduled activation
  const handleScheduleActivation = async () => {
    if (!isScheduledTimeValid()) return;
    
    // Validate form before submitting
    if (!validateForm()) {
      return;
    }
    
    // Check if user is logged in
    if (!user?.id) {
      toast.error('You must be logged in to schedule hospital information activation');
      return;
    }
    
    setSaving(true);
    
    try {
      // Prepare metadata with current date and authenticated user
      const metadata = {
        hospital_name: hospitalName,
        additional_notes: notes
      };
      
      // Create content
      const content = generateMarkdown();

      // Prepare scheduled activation time
      const scheduledActivationTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

      // Submit to API with scheduled activation time
      const response = await fetch('/api/admin/hospital-info/save-structured', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          metadata,
          uploaded_by: user.id, // Send user ID, ensuring it exists
          notes: JSON.stringify({
            metadata: {
              hospital_name: hospitalName,
              additional_notes: notes
            },
            wards,
            referralHospitals,
            labs,
            unavailableLabs,
            alwaysAvailableSpecialists,
            scheduledSpecialists,
            emergencyProcedures,
            pharmacyLocations,
            partnerHospitals,
            accessPoints,
            keyLocations,
            faq,
            importantInfo
          }),
          is_active: false, // Not active immediately
          scheduled_activation_time: scheduledActivationTime
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error: ${response.status} ${response.statusText}`);
      }

      // After successful scheduling, delete the draft
      if (user?.id) {
        try {
          await fetch(`/api/admin/hospital-info/drafts?userId=${user.id}`, {
            method: 'DELETE'
          });
          // Reset draft loaded state
          setDraftLoaded(false);
        } catch (draftError) {
          console.error('Failed to delete draft after scheduling activation:', draftError);
          // Non-blocking error - we still want to show success for the scheduling
        }
      }

      toast.success(`Hospital information saved and scheduled for activation on ${scheduledDate} at ${scheduledTime}`);
      setIsActivationOpen(false);
      
      // Remove the resetForm call to preserve form data
      // resetForm();
    } catch (err) {
      console.error('Error saving and scheduling hospital information:', err);
      setError(err instanceof Error ? err.message : 'Failed to save hospital information');
      toast.error('Failed to save and schedule hospital information');
    } finally {
      setSaving(false);
    }
  };

  // Regular save without activation
  const handleSaveOnly = async () => {
    setError(null);
    setDraftError(null);
    
    // Validate form before submitting - removed validation for draft save
    // if (!validateForm()) {
    //   return;
    // }
    
    setIsSavingDraft(true);
    
    try {
      // Prepare metadata with current date and authenticated user
      const metadata = {
        hospital_name: hospitalName,
        additional_notes: notes
      };
      
      // Create content
      const content = generateMarkdown();

      // Save as draft instead
      const response = await fetch('/api/admin/hospital-info/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id, // This is used for the user_id column in the drafts table
          content,
          metadata,
          notes: JSON.stringify({
            metadata: {
              hospital_name: hospitalName,
              additional_notes: notes
            },
            wards,
            referralHospitals,
            labs,
            unavailableLabs,
            alwaysAvailableSpecialists,
            scheduledSpecialists,
            emergencyProcedures,
            pharmacyLocations,
            partnerHospitals,
            accessPoints,
            keyLocations,
            faq,
            importantInfo
          })
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error: ${response.status} ${response.statusText}`);
      }

      setDraftLoaded(true);
      toast.success('Draft saved successfully');
    } catch (err) {
      console.error('Error saving draft:', err);
      setDraftError(err instanceof Error ? err.message : 'Failed to save draft');
      toast.error('Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Handle form submission - replace the existing handleSubmit function
  const handleSubmit = async () => {
    // Set activation attempted to true (for red icons)
    setAttemptedActivation(true);
    
    // Validate form
    if (!validateFormData(false)) {
      // Show validation error modal instead of auto-navigating
      setShowValidationModal(true);
      return;
    }
    
    // If valid, open activation modal
    setIsActivationOpen(true);
  };

  // Handle download markdown
  const handleDownloadMarkdown = () => {
    if (!validateForm()) {
      return;
    }
    
    const content = generateMarkdown();
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${hospitalName.replace(/\s+/g, '_').toLowerCase()}_hospital_info.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Markdown file downloaded successfully');
  };

  // Define sections for the sidebar
  const sections = [
    { id: 'metadata', title: 'Metadata', count: 5, isComplete: calculateCompletion('metadata') },
    { id: 'wards', title: 'Wards', count: wards.length, isComplete: calculateCompletion('wards') },
    { id: 'labs', title: 'Labs', count: labs.length, isComplete: calculateCompletion('labs') },
    { id: 'specialists', title: 'Specialists', count: alwaysAvailableSpecialists.length + scheduledSpecialists.length, isComplete: calculateCompletion('specialists') },
    { id: 'emergency', title: 'Emergency', count: emergencyProcedures.length, isComplete: calculateCompletion('emergency') },
    { id: 'pharmacy', title: 'Pharmacy', count: pharmacyLocations.length, isComplete: calculateCompletion('pharmacy') },
    { id: 'referrals', title: 'Referrals', count: partnerHospitals.length, isComplete: calculateCompletion('referrals') },
    { id: 'important', title: 'IMPORTANT', count: importantInfo ? 1 : 0, isComplete: calculateCompletion('important') },
    { id: 'navigation', title: 'Navigation', count: accessPoints.length + keyLocations.length, isComplete: calculateCompletion('navigation') },
    { id: 'faq', title: 'FAQ', count: faq.length, isComplete: calculateCompletion('faq') }
  ];

  // Preview button handler
  const handlePreviewClick = () => {
    setIsPreviewOpen(true);
  };

  // Function to detect if the file data is from structured form
  const isStructuredFormData = (notesStr: string | null): boolean => {
    if (!notesStr) return false;
    
    try {
      const notesObj = JSON.parse(notesStr);
      
      // Check if it has expected form data structures
      return (
        Array.isArray(notesObj.wards) ||
        Array.isArray(notesObj.labs) ||
        Array.isArray(notesObj.emergencyProcedures)
      );
    } catch (e) {
      return false;
    }
  };
  
  /**
   * Fetches the currently active hospital information file
   * 
   * This function:
   * 1. Retrieves the active hospital information from the backend API
   * 2. Validates that the file is structured in the compatible format
   * 3. Parses and populates the form data from the retrieved JSON
   * 4. Handles error cases with appropriate error messages
   * 
   * The function supports loading previously saved structured form data,
   * but will not attempt to load free-form markdown that wasn't created 
   * by the structured form.
   */
  const fetchActiveFile = async () => {
    setIsLoadingActiveFile(true);
    // Don't set activeFileError for toasted messages
    setActiveFileError(null);
    
    try {
      const response = await fetch('/api/admin/hospital-info/active');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: Could not fetch active file`);
      }
      
      const data = await response.json();
      
      if (!data.active) {
        // Only show a toast, don't set activeFileError for this message
        toast.error('No active hospital information file found');
        return;
      }
      
      // Check if the file is from structured form
      if (!isStructuredFormData(data.active.notes)) {
        // Only show a toast, don't set activeFileError for this message
        toast.error('Cannot load current file. File structure does not match the form.');
        return;
      }
      
      // Parse the notes field to get structured data
      const notesData = JSON.parse(data.active.notes);
      
      // Try to find hospital name in different possible locations
      try {
        // First check for the new metadata structure inside notes
        if (notesData.metadata && notesData.metadata.hospital_name) {
          setHospitalName(notesData.metadata.hospital_name);
          
          // Set additional notes if available in metadata
          if (notesData.metadata.additional_notes) {
            setNotes(notesData.metadata.additional_notes);
          }
          
          // Display activation info if available
          if (notesData.metadata.activated_by && notesData.metadata.activation_time) {
            const activationTime = new Date(notesData.metadata.activation_time);
            const formattedTime = activationTime.toLocaleString();
            toast.info(`This hospital info was activated by ${notesData.metadata.activated_by} on ${formattedTime}`);
          } else if (notesData.metadata.scheduled_by) {
            toast.info(`This hospital info was scheduled by ${notesData.metadata.scheduled_by}`);
          }
        } 
        // Then check for old formats
        else if (typeof notesData === 'string') {
          // If notes is a string that contains JSON
          const parsedNotes = JSON.parse(notesData);
          if (parsedNotes.metadata && parsedNotes.metadata.hospital_name) {
            setHospitalName(parsedNotes.metadata.hospital_name);
            if (parsedNotes.metadata.additional_notes) {
              setNotes(parsedNotes.metadata.additional_notes);
            }
          } else if (parsedNotes.hospital_name) {
            setHospitalName(parsedNotes.hospital_name);
          }
        } else if (notesData.hospital_name) {
          // Direct hospital_name property
          setHospitalName(notesData.hospital_name);
        } else if (notesData.hospitalName) {
          // Alternative property name
          setHospitalName(notesData.hospitalName);
        } else {
          // Extract from filename as fallback
          const nameMatch = data.active.file_name.match(/(.+)_info\.md/);
          if (nameMatch && nameMatch[1]) {
            // Convert underscores back to spaces and capitalize words
            const extractedName = nameMatch[1].replace(/_/g, ' ')
              .split(' ')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            setHospitalName(extractedName);
          }
        }
      } catch (e) {
        console.error('Error parsing hospital name from active file:', e);
      }
      
      // Only set notes from these locations if not already set from metadata
      if (!notesData.metadata?.additional_notes) {
        if (notesData.additional_notes) {
          setNotes(notesData.additional_notes);
        } else if (notesData.notes) {
          setNotes(notesData.notes);
        }
      }
      
      // Set all form data
      if (notesData.wards) setWards(notesData.wards);
      if (notesData.referralHospitals) setReferralHospitals(notesData.referralHospitals);
      if (notesData.labs) setLabs(notesData.labs);
      if (notesData.unavailableLabs) setUnavailableLabs(notesData.unavailableLabs);
      if (notesData.alwaysAvailableSpecialists) setAlwaysAvailableSpecialists(notesData.alwaysAvailableSpecialists);
      if (notesData.scheduledSpecialists) setScheduledSpecialists(notesData.scheduledSpecialists);
      if (notesData.emergencyProcedures) setEmergencyProcedures(notesData.emergencyProcedures);
      if (notesData.pharmacyLocations) setPharmacyLocations(notesData.pharmacyLocations);
      if (notesData.partnerHospitals) setPartnerHospitals(notesData.partnerHospitals);
      if (notesData.accessPoints) setAccessPoints(notesData.accessPoints);
      if (notesData.keyLocations) setKeyLocations(notesData.keyLocations);
      if (notesData.faq) setFaq(notesData.faq);
      if (notesData.importantInfo) setImportantInfo(notesData.importantInfo);
      
      toast.success('Active hospital information loaded successfully');
    } catch (err) {
      console.error('Error fetching active hospital info:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch active hospital information';
      // Only set actual errors in the activeFileError, not UI feedback messages
      setActiveFileError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoadingActiveFile(false);
    }
  };

  // Function to check if a user draft exists and load it
  const fetchUserDraft = async () => {
    if (!user?.id) return;
    
    setIsLoadingDraft(true);
    setDraftError(null);
    
    try {
      const response = await fetch(`/api/admin/hospital-info/drafts?userId=${user.id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: Could not fetch draft`);
      }
      
      const data = await response.json();
      
      if (!data.draft) {
        // Only show toast, don't set draftError
        toast.error('No draft found. You can load the active file or start fresh.');
        return;
      }
      
      // Parse the notes field to get structured data
      const notesData = JSON.parse(data.draft.notes);
      
      // Parse the metadata from the draft
      const metadata = data.draft.metadata ? JSON.parse(data.draft.metadata) : null;
      
      // Check for metadata inside notes first (new format)
      if (notesData.metadata && notesData.metadata.hospital_name) {
        setHospitalName(notesData.metadata.hospital_name);
      } 
      // Then check external metadata (old format)
      else if (metadata && metadata.hospital_name) {
        setHospitalName(metadata.hospital_name);
      }
      
      // Set additional notes from wherever available
      if (notesData.metadata && notesData.metadata.additional_notes) {
        setNotes(notesData.metadata.additional_notes);
      } else if (metadata && metadata.additional_notes) {
        setNotes(metadata.additional_notes);
      }
      
      // Set all form data
      if (notesData.wards) setWards(notesData.wards);
      if (notesData.referralHospitals) setReferralHospitals(notesData.referralHospitals);
      if (notesData.labs) setLabs(notesData.labs);
      if (notesData.unavailableLabs) setUnavailableLabs(notesData.unavailableLabs);
      if (notesData.alwaysAvailableSpecialists) setAlwaysAvailableSpecialists(notesData.alwaysAvailableSpecialists);
      if (notesData.scheduledSpecialists) setScheduledSpecialists(notesData.scheduledSpecialists);
      if (notesData.emergencyProcedures) setEmergencyProcedures(notesData.emergencyProcedures);
      if (notesData.pharmacyLocations) setPharmacyLocations(notesData.pharmacyLocations);
      if (notesData.partnerHospitals) setPartnerHospitals(notesData.partnerHospitals);
      if (notesData.accessPoints) setAccessPoints(notesData.accessPoints);
      if (notesData.keyLocations) setKeyLocations(notesData.keyLocations);
      if (notesData.faq) setFaq(notesData.faq);
      if (notesData.importantInfo) setImportantInfo(notesData.importantInfo);
      
      setDraftLoaded(true);
      toast.success('Your draft has been loaded');
    } catch (err) {
      console.error('Error fetching draft:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch draft';
      // Only set actual errors in the draftError, not UI feedback messages
      setDraftError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoadingDraft(false);
    }
  };

  // Function to silently load draft without showing toasts
  const silentlyLoadDraft = async (userId: string | undefined) => {
    if (!userId || draftLoaded || isLoadingDraft) return;
    
    setIsLoadingDraft(true);
    
    try {
      const response = await fetch(`/api/admin/hospital-info/drafts?userId=${userId}`);
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (!data.draft) return;
      
      // Parse the notes field to get structured data
      const notesData = JSON.parse(data.draft.notes);
      
      // Parse the metadata from the draft
      const metadata = data.draft.metadata ? JSON.parse(data.draft.metadata) : null;
      
      // Check for metadata inside notes first (new format)
      if (notesData.metadata && notesData.metadata.hospital_name) {
        setHospitalName(notesData.metadata.hospital_name);
      } 
      // Then check external metadata (old format)
      else if (metadata && metadata.hospital_name) {
        setHospitalName(metadata.hospital_name);
      }
      
      // Set additional notes from wherever available
      if (notesData.metadata && notesData.metadata.additional_notes) {
        setNotes(notesData.metadata.additional_notes);
      } else if (metadata && metadata.additional_notes) {
        setNotes(metadata.additional_notes);
      }
      
      // Set all form data
      if (notesData.wards) setWards(notesData.wards);
      if (notesData.referralHospitals) setReferralHospitals(notesData.referralHospitals);
      if (notesData.labs) setLabs(notesData.labs);
      if (notesData.unavailableLabs) setUnavailableLabs(notesData.unavailableLabs);
      if (notesData.alwaysAvailableSpecialists) setAlwaysAvailableSpecialists(notesData.alwaysAvailableSpecialists);
      if (notesData.scheduledSpecialists) setScheduledSpecialists(notesData.scheduledSpecialists);
      if (notesData.emergencyProcedures) setEmergencyProcedures(notesData.emergencyProcedures);
      if (notesData.pharmacyLocations) setPharmacyLocations(notesData.pharmacyLocations);
      if (notesData.partnerHospitals) setPartnerHospitals(notesData.partnerHospitals);
      if (notesData.accessPoints) setAccessPoints(notesData.accessPoints);
      if (notesData.keyLocations) setKeyLocations(notesData.keyLocations);
      if (notesData.faq) setFaq(notesData.faq);
      if (notesData.importantInfo) setImportantInfo(notesData.importantInfo);
      
      // Set draft loaded status
      setDraftLoaded(true);
      
      // Only show the toast if we haven't shown it before in this session
      if (!draftToastShownRef.current) {
        toast.success('Your draft has been loaded');
        draftToastShownRef.current = true;
      }
    } catch (err) {
      // Silently fail
      console.error('Silent draft loading failed:', err);
    } finally {
      setIsLoadingDraft(false);
    }
  };

  // Check for draft when component loads - silently load draft
  useEffect(() => {
    // Only try to load draft if:
    // 1. We have a valid user ID
    // 2. Draft isn't already loaded
    // 3. Not currently loading a draft
    // 4. Haven't already attempted to load a draft in this component lifecycle
    if (user?.id && !draftLoaded && !isLoadingDraft && !loadingAttemptedRef.current) {
      loadingAttemptedRef.current = true; // Mark that we've attempted loading
      silentlyLoadDraft(user.id);
    }
  }, [user?.id]); // Only depend on user ID changes, not on draftLoaded/isLoadingDraft to prevent loops

  // Reset the form to defaults
  const resetForm = () => {
    // Reset metadata
    setHospitalName('');
    setNotes('');
    setImportantInfo('');

    // Reset all sections to default values
    setWards([{ name: '', location: '', head: '', beds: '', dayShift: '', nightShift: '' }]);
    setReferralHospitals([{ name: '' }]);
    setLabs([{ name: '', location: '', head: '', services: '' }]);
    setUnavailableLabs([{ name: '', description: '', referral: '' }]);
    setAlwaysAvailableSpecialists([{ type: '', head: '' }]);
    setScheduledSpecialists([{ type: '', availability: '', head: '', notes: '' }]);
    setEmergencyProcedures([{ name: '', initialResponse: '', secondaryResponse: '', contact: '' }]);
    setPharmacyLocations([{ name: '', location: '', hours: '', services: '' }]);
    setPartnerHospitals([{ name: '', specialization: '', contact: '' }]);
    setAccessPoints([{ name: '', description: '' }]);
    setKeyLocations([{ name: '', description: '' }]);
    setFaq([{ question: '', answer: '' }]);
    
    // Reset draft loaded state
    setDraftLoaded(false);
    
    // Reset the loading attempted flag to allow loading a new draft if needed
    loadingAttemptedRef.current = false;
    
    toast.success('Form has been reset');
  };

  // Delete user draft
  const deleteDraft = async () => {
    if (!user?.id) return;
    
    setIsSavingDraft(true);
    setDraftError(null);
    
    try {
      const response = await fetch(`/api/admin/hospital-info/drafts?userId=${user.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: Could not delete draft`);
      }
      
      setDraftLoaded(false);
      toast.success('Draft has been deleted');
    } catch (err) {
      console.error('Error deleting draft:', err);
      setDraftError(err instanceof Error ? err.message : 'Failed to delete draft');
      toast.error('Failed to delete draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Render content based on active section
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'metadata':
        return (
          <Card className="bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
            <CardHeader className="py-6 px-6">
              <CardTitle className="text-xl font-semibold">Hospital Information Metadata</CardTitle>
              <CardDescription className="mt-1.5">Basic information about the hospital</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-10 pt-0 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2.5">
                  Hospital Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="Enter hospital name"
                  className={cn(
                    "w-full",
                    attemptedActivation && !hospitalName && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2.5">Last Updated</label>
                  <div className="p-2.5 bg-white/50 dark:bg-gray-800/50 border border-white/30 dark:border-gray-700/30 rounded-md text-sm">
                    {new Date().toLocaleDateString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Current date</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2.5">Updated By</label>
                  <div className="p-2.5 bg-white/50 dark:bg-gray-800/50 border border-white/30 dark:border-gray-700/30 rounded-md text-sm">
                    {getAdminIdentifier()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Current authenticated admin</p>
                </div>
              </div>
              
              <div className="pb-4">
                <label className="block text-sm font-medium mb-2.5">Additional Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about this hospital information"
                  rows={4}
                  className="w-full resize-none"
                />
              </div>

              <div className="pt-2 text-sm text-gray-500 dark:text-gray-400">
                <p>Fields marked with <span className="text-red-500">*</span> are required</p>
              </div>
            </CardContent>
          </Card>
        );
        
      case 'wards':
        return (
          <>
            <Card className="mb-6 bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
              <CardHeader className="py-6 px-6">
                <CardTitle className="text-xl font-semibold">Hospital Wards</CardTitle>
                <CardDescription className="mt-1.5">Information about hospital wards and their details</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-10 pt-0">
                <div className="space-y-4">
                  <div className="flex justify-end mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addItem(wards, setWards, { 
                        name: "", 
                        location: "", 
                        head: "", 
                        beds: "", 
                        dayShift: "", 
                        nightShift: "" 
                      })}
                      className="flex items-center"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Ward
                    </Button>
                  </div>

                  <Table className={tableStyles.table}>
                    <TableHeader className={tableStyles.tableHeader}>
                      <TableRow className={tableStyles.tableHeaderRow}>
                        <TableHead className={tableStyles.tableHead}>Ward Name <span className="text-red-500">*</span></TableHead>
                        <TableHead className={tableStyles.tableHead}>Location <span className="text-red-500">*</span></TableHead>
                        <TableHead className={tableStyles.tableHead}>Head Doctor</TableHead>
                        <TableHead className={tableStyles.tableHead}>Beds</TableHead>
                        <TableHead className={tableStyles.tableHead}>Day Shift</TableHead>
                        <TableHead className={tableStyles.tableHead}>Night Shift</TableHead>
                        <TableHead className={tableStyles.tableHead}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wards.map((ward, index) => (
                        <TableRow key={index} className={tableStyles.tableRow}>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={ward.name} 
                              onChange={(e) => updateItem(wards, setWards, index, 'name', e.target.value)} 
                              placeholder="Ward name"
                              className={cn(
                                "w-full", 
                                attemptedActivation && !ward.name && "border-red-500 focus-visible:ring-red-500"
                              )}
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={ward.location} 
                              onChange={(e) => updateItem(wards, setWards, index, 'location', e.target.value)} 
                              placeholder="Location"
                              className={cn(
                                "w-full",
                                attemptedActivation && !ward.location && "border-red-500 focus-visible:ring-red-500"
                              )}
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={ward.head} 
                              onChange={(e) => updateItem(wards, setWards, index, 'head', e.target.value)} 
                              placeholder="Head doctor"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={ward.beds} 
                              onChange={(e) => updateItem(wards, setWards, index, 'beds', e.target.value)} 
                              placeholder="Number of beds"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={ward.dayShift} 
                              onChange={(e) => updateItem(wards, setWards, index, 'dayShift', e.target.value)} 
                              placeholder="Day shift"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={ward.nightShift} 
                              onChange={(e) => updateItem(wards, setWards, index, 'nightShift', e.target.value)} 
                              placeholder="Night shift"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.actionCell}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeItem(wards, setWards, index)}
                              className={tableStyles.deleteButton}
                              disabled={wards.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  <div className="pt-2 text-sm text-gray-500 dark:text-gray-400">
                    <p>Fields marked with <span className="text-red-500">*</span> are required</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
              <CardHeader className="py-6 px-6">
                <CardTitle className="text-xl font-semibold">Referral Information for Specialized Wards</CardTitle>
                <CardDescription className="mt-1.5">For specialized wards not available in our hospital</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-10 pt-0">
                <div className="space-y-4">
                  <div className="flex justify-end mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addItem(referralHospitals, setReferralHospitals, { name: "" })}
                      className="flex items-center"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Referral Hospital
                    </Button>
                  </div>

                  <Table className={tableStyles.table}>
                    <TableHeader className={tableStyles.tableHeader}>
                      <TableRow className={tableStyles.tableHeaderRow}>
                        <TableHead className={tableStyles.tableHead}>Hospital Name</TableHead>
                        <TableHead className={tableStyles.tableHead}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referralHospitals.map((hospital, index) => (
                        <TableRow key={index} className={tableStyles.tableRow}>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={hospital.name} 
                              onChange={(e) => updateItem(referralHospitals, setReferralHospitals, index, 'name', e.target.value)} 
                              placeholder="Hospital name"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.actionCell}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeItem(referralHospitals, setReferralHospitals, index)}
                              className={tableStyles.deleteButton}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        );
        
      case 'labs':
        return (
          <>
            <Card className="mb-6 bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
              <CardHeader className="py-6 px-6">
                <CardTitle className="text-xl font-semibold">Laboratory Facilities</CardTitle>
                <CardDescription className="mt-1.5">Information about laboratory facilities and services</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-10 pt-0">
                <div className="space-y-4">
                  <div className="flex justify-end mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addItem(labs, setLabs, { 
                        name: "", 
                        location: "", 
                        head: "", 
                        services: "" 
                      })}
                      className="flex items-center"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Lab
                    </Button>
                  </div>

                  <Table className={tableStyles.table}>
                    <TableHeader className={tableStyles.tableHeader}>
                      <TableRow className={tableStyles.tableHeaderRow}>
                        <TableHead className={tableStyles.tableHead}>Lab Name <span className="text-red-500">*</span></TableHead>
                        <TableHead className={tableStyles.tableHead}>Location <span className="text-red-500">*</span></TableHead>
                        <TableHead className={tableStyles.tableHead}>Head</TableHead>
                        <TableHead className={tableStyles.tableHead}>Services</TableHead>
                        <TableHead className={tableStyles.tableHead}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {labs.map((lab, index) => (
                        <TableRow key={index} className={tableStyles.tableRow}>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={lab.name} 
                              onChange={(e) => updateItem(labs, setLabs, index, 'name', e.target.value)} 
                              placeholder="Lab name"
                              className={cn(
                                "w-full",
                                attemptedActivation && !lab.name && "border-red-500 focus-visible:ring-red-500"
                              )}
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={lab.location} 
                              onChange={(e) => updateItem(labs, setLabs, index, 'location', e.target.value)} 
                              placeholder="Location"
                              className={cn(
                                "w-full",
                                attemptedActivation && !lab.location && "border-red-500 focus-visible:ring-red-500"
                              )}
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={lab.head} 
                              onChange={(e) => updateItem(labs, setLabs, index, 'head', e.target.value)} 
                              placeholder="Head doctor"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={lab.services} 
                              onChange={(e) => updateItem(labs, setLabs, index, 'services', e.target.value)} 
                              placeholder="Services provided"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.actionCell}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeItem(labs, setLabs, index)}
                              className={tableStyles.deleteButton}
                              disabled={labs.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  <div className="pt-2 text-sm text-gray-500 dark:text-gray-400">
                    <p>Fields marked with <span className="text-red-500">*</span> are required</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
              <CardHeader className="py-6 px-6">
                <CardTitle className="text-xl font-semibold">Unavailable Laboratory Services</CardTitle>
                <CardDescription className="mt-1.5">Labs we don't have and where to refer patients</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-10 pt-0">
                <div className="space-y-4">
                  <div className="flex justify-end mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addItem(unavailableLabs, setUnavailableLabs, { 
                        name: "", 
                        description: "", 
                        referral: ""
                      })}
                      className="flex items-center"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Unavailable Lab
                    </Button>
                  </div>

                  <Table className={tableStyles.table}>
                    <TableHeader className={tableStyles.tableHeader}>
                      <TableRow className={tableStyles.tableHeaderRow}>
                        <TableHead className={tableStyles.tableHead}>Lab Name</TableHead>
                        <TableHead className={tableStyles.tableHead}>Description</TableHead>
                        <TableHead className={tableStyles.tableHead}>Referral To</TableHead>
                        <TableHead className={tableStyles.tableHead}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unavailableLabs.map((lab, index) => (
                        <TableRow key={index} className={tableStyles.tableRow}>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={lab.name} 
                              onChange={(e) => updateItem(unavailableLabs, setUnavailableLabs, index, 'name', e.target.value)} 
                              placeholder="Lab name"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={lab.description} 
                              onChange={(e) => updateItem(unavailableLabs, setUnavailableLabs, index, 'description', e.target.value)} 
                              placeholder="Description"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={lab.referral} 
                              onChange={(e) => updateItem(unavailableLabs, setUnavailableLabs, index, 'referral', e.target.value)} 
                              placeholder="Referral location"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.actionCell}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeItem(unavailableLabs, setUnavailableLabs, index)}
                              className={tableStyles.deleteButton}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        );
        
      case 'specialists':
        return (
          <>
            <Card className="mb-6 bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
              <CardHeader className="py-6 px-6">
                <CardTitle className="text-xl font-semibold">Always Available Specialists (24/7)</CardTitle>
                <CardDescription className="mt-1.5">Specialists that are available at all times</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-10 pt-0">
                <div className="space-y-4">
                  <div className="flex justify-end mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addItem(alwaysAvailableSpecialists, setAlwaysAvailableSpecialists, { 
                        type: "", 
                        head: "" 
                      })}
                      className="flex items-center"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Specialist Type
                    </Button>
                  </div>

                  <Table className={tableStyles.table}>
                    <TableHeader className={tableStyles.tableHeader}>
                      <TableRow className={tableStyles.tableHeaderRow}>
                        <TableHead className={tableStyles.tableHead}>Specialist Type</TableHead>
                        <TableHead className={tableStyles.tableHead}>Head</TableHead>
                        <TableHead className={tableStyles.tableHead}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alwaysAvailableSpecialists.map((specialist, index) => (
                        <TableRow key={index} className={tableStyles.tableRow}>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={specialist.type} 
                              onChange={(e) => updateItem(alwaysAvailableSpecialists, setAlwaysAvailableSpecialists, index, 'type', e.target.value)} 
                              placeholder="Type of specialist"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={specialist.head} 
                              onChange={(e) => updateItem(alwaysAvailableSpecialists, setAlwaysAvailableSpecialists, index, 'head', e.target.value)} 
                              placeholder="Head doctor"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.actionCell}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeItem(alwaysAvailableSpecialists, setAlwaysAvailableSpecialists, index)}
                              className={tableStyles.deleteButton}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
              <CardHeader className="py-6 px-6">
                <CardTitle className="text-xl font-semibold">Scheduled Specialists</CardTitle>
                <CardDescription className="mt-1.5">Specialists available on a scheduled basis</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-10 pt-0">
                <div className="space-y-4">
                  <div className="flex justify-end mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addItem(scheduledSpecialists, setScheduledSpecialists, { 
                        type: "", 
                        availability: "", 
                        head: "", 
                        notes: "" 
                      })}
                      className="flex items-center"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Scheduled Specialist
                    </Button>
                  </div>

                  <Table className={tableStyles.table}>
                    <TableHeader className={tableStyles.tableHeader}>
                      <TableRow className={tableStyles.tableHeaderRow}>
                        <TableHead className={tableStyles.tableHead}>Specialist Type</TableHead>
                        <TableHead className={tableStyles.tableHead}>Availability</TableHead>
                        <TableHead className={tableStyles.tableHead}>Head</TableHead>
                        <TableHead className={tableStyles.tableHead}>Notes</TableHead>
                        <TableHead className={tableStyles.tableHead}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledSpecialists.map((specialist, index) => (
                        <TableRow key={index} className={tableStyles.tableRow}>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={specialist.type} 
                              onChange={(e) => updateItem(scheduledSpecialists, setScheduledSpecialists, index, 'type', e.target.value)} 
                              placeholder="Type of specialist"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={specialist.availability} 
                              onChange={(e) => updateItem(scheduledSpecialists, setScheduledSpecialists, index, 'availability', e.target.value)} 
                              placeholder="e.g., Monday to Friday"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={specialist.head} 
                              onChange={(e) => updateItem(scheduledSpecialists, setScheduledSpecialists, index, 'head', e.target.value)} 
                              placeholder="Head doctor"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={specialist.notes} 
                              onChange={(e) => updateItem(scheduledSpecialists, setScheduledSpecialists, index, 'notes', e.target.value)} 
                              placeholder="Additional notes"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.actionCell}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeItem(scheduledSpecialists, setScheduledSpecialists, index)}
                              className={tableStyles.deleteButton}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        );
        
      case 'emergency':
        return (
          <Card className="bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
            <CardHeader className="py-6 px-6">
              <CardTitle className="text-xl font-semibold">Emergency Procedures</CardTitle>
              <CardDescription className="mt-1.5">Information about handling priority cases</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-10 pt-0">
              <div className="space-y-4">
                <div className="flex justify-end mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addItem(emergencyProcedures, setEmergencyProcedures, { 
                      name: "", 
                      initialResponse: "", 
                      secondaryResponse: "",
                      contact: "" 
                    })}
                    className="flex items-center"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Emergency Procedure
                  </Button>
                </div>

                {emergencyProcedures.map((procedure, index) => (
                  <Card key={index} className="border border-white/20 dark:border-white/5 p-5 mb-5 bg-white/30 dark:bg-gray-800/20 shadow-sm">
                    <div className="flex justify-between items-center mb-5 border-b pb-3 border-gray-100 dark:border-gray-700/20">
                      <h3 className="font-medium text-base">Procedure {index + 1}</h3>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeItem(emergencyProcedures, setEmergencyProcedures, index)}
                        className={tableStyles.deleteButton}
                        disabled={emergencyProcedures.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-4 pb-2">
                      <div>
                        <label className="block text-sm font-medium mb-2.5">
                          Name/Type <span className="text-red-500">*</span>
                        </label>
                        <Input 
                          value={procedure.name} 
                          onChange={(e) => updateItem(emergencyProcedures, setEmergencyProcedures, index, 'name', e.target.value)} 
                          placeholder="e.g., Heart Attacks & Trauma Cases"
                          className={cn(
                            "w-full",
                            attemptedActivation && !procedure.name && "border-red-500 focus-visible:ring-red-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2.5">
                          Initial Response <span className="text-red-500">*</span>
                        </label>
                        <Textarea 
                          value={procedure.initialResponse} 
                          onChange={(e) => updateItem(emergencyProcedures, setEmergencyProcedures, index, 'initialResponse', e.target.value)} 
                          placeholder="Immediate steps to take"
                          rows={2}
                          className={cn(
                            "w-full resize-none",
                            attemptedActivation && !procedure.initialResponse && "border-red-500 focus-visible:ring-red-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2.5">Secondary Response</label>
                        <Textarea 
                          value={procedure.secondaryResponse} 
                          onChange={(e) => updateItem(emergencyProcedures, setEmergencyProcedures, index, 'secondaryResponse', e.target.value)} 
                          placeholder="Follow-up steps"
                          rows={2}
                          className="w-full resize-none"
                        />
                      </div>
                      <div className="pb-2">
                        <label className="block text-sm font-medium mb-2.5">Contact Information</label>
                        <Input 
                          value={procedure.contact} 
                          onChange={(e) => updateItem(emergencyProcedures, setEmergencyProcedures, index, 'contact', e.target.value)} 
                          placeholder="Who to contact"
                          className="w-full"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
                
                <div className="pt-2 text-sm text-gray-500 dark:text-gray-400">
                  <p>Fields marked with <span className="text-red-500">*</span> are required</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
        
      case 'pharmacy':
        return (
          <Card className="bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
            <CardHeader className="py-6 px-6">
              <CardTitle className="text-xl font-semibold">Pharmacy & Medication Services</CardTitle>
              <CardDescription className="mt-1.5">Information about pharmacy locations and hours</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-10 pt-0">
              <div className="space-y-4">
                <div className="flex justify-end mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addItem(pharmacyLocations, setPharmacyLocations, { 
                      name: "", 
                      location: "", 
                      hours: "",
                      services: "" 
                    })}
                    className="flex items-center"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Pharmacy Location
                  </Button>
                </div>

                <Table className={tableStyles.table}>
                  <TableHeader className={tableStyles.tableHeader}>
                    <TableRow className={tableStyles.tableHeaderRow}>
                      <TableHead className={tableStyles.tableHead}>Name</TableHead>
                      <TableHead className={tableStyles.tableHead}>Location</TableHead>
                      <TableHead className={tableStyles.tableHead}>Hours</TableHead>
                      <TableHead className={tableStyles.tableHead}>Services</TableHead>
                      <TableHead className={tableStyles.tableHead}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pharmacyLocations.map((pharmacy, index) => (
                      <TableRow key={index} className={tableStyles.tableRow}>
                        <TableCell className={tableStyles.tableCell}>
                          <Input 
                            value={pharmacy.name} 
                            onChange={(e) => updateItem(pharmacyLocations, setPharmacyLocations, index, 'name', e.target.value)} 
                            placeholder="Pharmacy name"
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell className={tableStyles.tableCell}>
                          <Input 
                            value={pharmacy.location} 
                            onChange={(e) => updateItem(pharmacyLocations, setPharmacyLocations, index, 'location', e.target.value)} 
                            placeholder="Location"
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell className={tableStyles.tableCell}>
                          <Input 
                            value={pharmacy.hours} 
                            onChange={(e) => updateItem(pharmacyLocations, setPharmacyLocations, index, 'hours', e.target.value)} 
                            placeholder="e.g., Open 24/7"
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell className={tableStyles.tableCell}>
                          <Input 
                            value={pharmacy.services} 
                            onChange={(e) => updateItem(pharmacyLocations, setPharmacyLocations, index, 'services', e.target.value)} 
                            placeholder="Services provided"
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell className={tableStyles.actionCell}>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeItem(pharmacyLocations, setPharmacyLocations, index)}
                            className={tableStyles.deleteButton}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
        
      case 'referrals':
        return (
          <Card className="bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
            <CardHeader className="py-6 px-6">
              <CardTitle className="text-xl font-semibold">Referral and Partner Hospitals</CardTitle>
              <CardDescription className="mt-1.5">Information about specialized services partners</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-10 pt-0">
              <div className="space-y-4">
                <div className="flex justify-end mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addItem(partnerHospitals, setPartnerHospitals, { 
                      name: "", 
                      specialization: "", 
                      contact: ""
                    })}
                    className="flex items-center"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Partner Hospital
                  </Button>
                </div>

                <Table className={tableStyles.table}>
                  <TableHeader className={tableStyles.tableHeader}>
                    <TableRow className={tableStyles.tableHeaderRow}>
                      <TableHead className={tableStyles.tableHead}>Hospital Name</TableHead>
                      <TableHead className={tableStyles.tableHead}>Specialization</TableHead>
                      <TableHead className={tableStyles.tableHead}>Contact</TableHead>
                      <TableHead className={tableStyles.tableHead}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerHospitals.map((hospital, index) => (
                      <TableRow key={index} className={tableStyles.tableRow}>
                        <TableCell className={tableStyles.tableCell}>
                          <Input 
                            value={hospital.name} 
                            onChange={(e) => updateItem(partnerHospitals, setPartnerHospitals, index, 'name', e.target.value)} 
                            placeholder="Hospital name"
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell className={tableStyles.tableCell}>
                          <Input 
                            value={hospital.specialization} 
                            onChange={(e) => updateItem(partnerHospitals, setPartnerHospitals, index, 'specialization', e.target.value)} 
                            placeholder="Specialization"
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell className={tableStyles.tableCell}>
                          <Input 
                            value={hospital.contact} 
                            onChange={(e) => updateItem(partnerHospitals, setPartnerHospitals, index, 'contact', e.target.value)} 
                            placeholder="Contact information"
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell className={tableStyles.actionCell}>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeItem(partnerHospitals, setPartnerHospitals, index)}
                            className={tableStyles.deleteButton}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
        
      case 'important':
        return (
          <Card className="bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
            <CardHeader className="py-6 px-6">
              <CardTitle className="text-xl font-semibold text-amber-600 dark:text-amber-500">IMPORTANT INFORMATION</CardTitle>
              <CardDescription className="mt-1.5">
                Critical information, updates, or alerts that the AI assistant should prioritize
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-10 pt-0">
              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800/50 mb-4">
                  <p className="text-amber-800 dark:text-amber-300 text-sm flex items-start">
                    <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <span>
                      Use this editor to format critical information that will be prominently displayed to the AI assistant. 
                      You can use the formatting options to emphasize important details, create lists for procedures, 
                      and highlight urgent information. Click the maximize button (top-right) for a full-screen editing experience.
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2.5">
                    Important Information
                  </label>
                  <RichTextEditor
                    value={importantInfo}
                    onChange={(value) => setImportantInfo(value)}
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    This information will be displayed at the top of the hospital information with warning symbols to ensure visibility.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
        
      case 'navigation':
        return (
          <>
            <Card className="mb-6 bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
              <CardHeader className="py-6 px-6">
                <CardTitle className="text-xl font-semibold">Hospital Access Points</CardTitle>
                <CardDescription className="mt-1.5">Main entrances and access points to the hospital</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-10 pt-0">
                <div className="space-y-4">
                  <div className="flex justify-end mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addItem(accessPoints, setAccessPoints, { 
                        name: "", 
                        description: ""
                      })}
                      className="flex items-center"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Access Point
                    </Button>
                  </div>

                  <Table className={tableStyles.table}>
                    <TableHeader className={tableStyles.tableHeader}>
                      <TableRow className={tableStyles.tableHeaderRow}>
                        <TableHead className={tableStyles.tableHead}>Name</TableHead>
                        <TableHead className={tableStyles.tableHead}>Description</TableHead>
                        <TableHead className={tableStyles.tableHead}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accessPoints.map((point, index) => (
                        <TableRow key={index} className={tableStyles.tableRow}>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={point.name} 
                              onChange={(e) => updateItem(accessPoints, setAccessPoints, index, 'name', e.target.value)} 
                              placeholder="Access point name"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={point.description} 
                              onChange={(e) => updateItem(accessPoints, setAccessPoints, index, 'description', e.target.value)} 
                              placeholder="Description"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.actionCell}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeItem(accessPoints, setAccessPoints, index)}
                              className={tableStyles.deleteButton}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
              <CardHeader className="py-6 px-6">
                <CardTitle className="text-xl font-semibold">Key Locations</CardTitle>
                <CardDescription className="mt-1.5">Important locations within the hospital</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-10 pt-0">
                <div className="space-y-4">
                  <div className="flex justify-end mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addItem(keyLocations, setKeyLocations, { 
                        name: "", 
                        description: ""
                      })}
                      className="flex items-center"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Key Location
                    </Button>
                  </div>

                  <Table className={tableStyles.table}>
                    <TableHeader className={tableStyles.tableHeader}>
                      <TableRow className={tableStyles.tableHeaderRow}>
                        <TableHead className={tableStyles.tableHead}>Name</TableHead>
                        <TableHead className={tableStyles.tableHead}>Description</TableHead>
                        <TableHead className={tableStyles.tableHead}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keyLocations.map((location, index) => (
                        <TableRow key={index} className={tableStyles.tableRow}>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={location.name} 
                              onChange={(e) => updateItem(keyLocations, setKeyLocations, index, 'name', e.target.value)} 
                              placeholder="Location name"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.tableCell}>
                            <Input 
                              value={location.description} 
                              onChange={(e) => updateItem(keyLocations, setKeyLocations, index, 'description', e.target.value)} 
                              placeholder="Description"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={tableStyles.actionCell}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeItem(keyLocations, setKeyLocations, index)}
                              className={tableStyles.deleteButton}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        );
        
      case 'faq':
        return (
          <Card className="bg-white/60 dark:bg-gray-800/30 border-white/20 dark:border-white/5 shadow-sm">
            <CardHeader className="py-6 px-6">
              <CardTitle className="text-xl font-semibold">Frequently Asked Questions</CardTitle>
              <CardDescription className="mt-1.5">Common questions and answers for patients</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-10 pt-0">
              <div className="space-y-4">
                <div className="flex justify-end mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addItem(faq, setFaq, { 
                      question: "", 
                      answer: ""
                    })}
                    className="flex items-center"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add FAQ Item
                  </Button>
                </div>

                {faq.map((item, index) => (
                  <Card key={index} className="border border-white/20 dark:border-white/5 p-5 mb-5 bg-white/30 dark:bg-gray-800/20 shadow-sm">
                    <div className="flex justify-between items-center mb-5 border-b pb-3 border-gray-100 dark:border-gray-700/20">
                      <h3 className="font-medium text-base">FAQ #{index + 1}</h3>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeItem(faq, setFaq, index)}
                        className={tableStyles.deleteButton}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-4 pb-2">
                      <div>
                        <label className="block text-sm font-medium mb-2.5">Question</label>
                        <Input 
                          value={item.question} 
                          onChange={(e) => updateItem(faq, setFaq, index, 'question', e.target.value)} 
                          placeholder="Enter question"
                          className="w-full"
                        />
                      </div>
                      <div className="pb-2">
                        <label className="block text-sm font-medium mb-2.5">Answer</label>
                        <Textarea 
                          value={item.answer} 
                          onChange={(e) => updateItem(faq, setFaq, index, 'answer', e.target.value)} 
                          placeholder="Enter answer"
                          rows={3}
                          className="w-full resize-none"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        );
        
      default:
        return <div>Select a section from the sidebar to edit</div>;
    }
  };

  return (
    <>
      <DashboardLayout
        sections={sections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        completionPercentage={calculateCompletionPercentage()}
        onSave={handleSubmit}
        onPreviewToggle={handlePreviewClick}
        onDownload={handleDownloadMarkdown}
        isSaving={saving}
        saveButtonText="Activate" // Change "Save Changes" to "Activate"
        invalidSections={attemptedActivation ? invalidSections : []}
      >
        {/* Only show errors for actual system errors, not validation errors */}
        {activeFileError && activeFileError !== 'No active hospital information file found' && 
          activeFileError !== 'Cannot load current file. File structure does not match the form.' && 
          <Alert message={activeFileError} />}
        {draftError && draftError !== 'No draft found. You can load the active file or start fresh.' && 
          <Alert message={draftError} />}
        
        <div className="mb-4 flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={handleSaveOnly} 
            className="flex items-center gap-2"
            disabled={saving || isLoadingActiveFile || isSavingDraft || isLoadingDraft}
          >
            {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Save Only</span>
          </Button>
          
          <Button 
            variant="outline" 
            onClick={fetchActiveFile} 
            className="flex items-center gap-2"
            disabled={saving || isLoadingActiveFile || isSavingDraft || isLoadingDraft}
          >
            {isLoadingActiveFile ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            <span>Load Active File</span>
          </Button>
          
          <Button 
            variant="outline" 
            onClick={resetForm} 
            className="flex items-center gap-2"
            disabled={saving || isLoadingActiveFile || isSavingDraft || isLoadingDraft}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            <span>Reset Form</span>
          </Button>
        </div>
        
        {renderSectionContent()}
      </DashboardLayout>
      
      <PreviewModal 
        content={generateMarkdown()} 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
      />
      
      {/* Validation Error Modal */}
      <ValidationErrorModal 
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        invalidSections={invalidSections}
        allSections={sections}
        onNavigate={(sectionId) => {
          setActiveSection(sectionId);
          setShowValidationModal(false);
        }}
      />
      
      {/* Activation Modal */}
      {isActivationOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex justify-center items-center p-4 overflow-hidden">
          <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Activate Hospital Information</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsActivationOpen(false)} 
                className="h-8 px-2"
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <ActivationOptions 
              activationType={activationType}
              setActivationType={setActivationType}
              scheduledDate={scheduledDate}
              setScheduledDate={setScheduledDate}
              scheduledTime={scheduledTime}
              setScheduledTime={setScheduledTime}
              onActivate={handleActivateNow}
              onSchedule={handleScheduleActivation}
              isProcessing={saving}
            />
          </div>
        </div>
      )}
    </>
  );
} 