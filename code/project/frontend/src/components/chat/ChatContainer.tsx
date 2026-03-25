"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickAction } from './QuickAction';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Button } from "@/components/ui/button";
import { Loader } from '@/components/ui/loader'
import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import dynamic from 'next/dynamic';

// Dynamically import VoiceInterface with no SSR to avoid hydration issues
const VoiceInterface = dynamic(
  () => import('@/app/voice-interface/page'),
  { ssr: false }
);

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: string;
  documentData?: {
    fileName: string;
    fileType: string;
    fileContent?: string;
    markdownContent?: string;
  }[];
}

// Setup axios with default config for backend API
const apiClient = axios.create({
  baseURL: '/api/ai',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false
});

// Setup direct connection to backend for debugging
const backendClient = axios.create({
  baseURL: 'http://localhost:8000/ai',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false
});

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your NurseChat assistant. How can I help with your medical needs today?",
      isBot: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isConnected, setIsConnected] = useState(true); // Default to true to avoid initial red indicator
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [draftMessage, setDraftMessage] = useState('');
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [interfaceType, setInterfaceType] = useState<"chat" | "voice">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const { signOut, user, isAdmin, profile } = useAuth();
  const [documentCount, setDocumentCount] = useState(0);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSignOut = async () => {
    await signOut();
    // Redirect will happen via the auth state change listener
    setShowSignOutDialog(false);
  };

  useEffect(() => {
    // Generate a session ID when component mounts
    setSessionId(uuidv4());
  }, []);

  useEffect(() => {
    // Scroll to bottom of messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string, documentData?: { 
    fileName: string, 
    fileType: string, 
    fileContent?: string,
    markdownContent?: string 
  }[]) => {
    // Add user message to chat
    const userMessage: Message = {
      id: uuidv4(),
      content,
      isBot: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      documentData: documentData,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setShowQuickActions(false); // Hide quick actions when user sends a message

    try {
      // Try direct connection to backend first
      let response;
      try {
        // Prepare request with document metadata
        const requestBody = {
          session_id: sessionId,
          message: content,
          documents: documentData ? documentData.map(doc => ({
            content: doc.markdownContent || null,
            metadata: {
              fileName: doc.fileName,
              fileType: doc.fileType
            }
          })) : []
        };

        response = await backendClient.post('/chat', requestBody);
        setIsConnected(true);
      } catch (directError) {
        // Fall back to Next.js API route if direct connection fails
        const requestBody = {
          session_id: sessionId,
          message: content,
          documents: documentData ? documentData.map(doc => ({
            content: doc.markdownContent || null,
            metadata: {
              fileName: doc.fileName,
              fileType: doc.fileType
            }
          })) : []
        };

        response = await apiClient.post('/chat', requestBody);
        setIsConnected(true);
      }
      
      // Update document count if available in response
      if (response.data.document_count !== undefined) {
        setDocumentCount(response.data.document_count);
      }
      
      // Sanitize AI responses to remove any role prefixes
      const sanitizeResponse = (response: string): string => {
        // Remove "Nurse Assistant:" or "Assistant:" prefixes if present
        return response.replace(/^(Nurse Assistant:|Assistant:)\s*/i, '');
      };

      // Add bot response to chat
      const botMessage: Message = {
        id: uuidv4(),
        content: sanitizeResponse(response.data.response),
        isBot: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsConnected(false);  // Update connection status on error
      
      // Add error message
      const errorMessage: Message = {
        id: uuidv4(),
        content: sanitizeResponse("I'm sorry, I couldn't process your request. The backend appears to be disconnected. Please try again later."),
        isBot: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (text: string) => {
    // Set the draft message instead of sending it directly
    setDraftMessage(text);
  };

  return (
    <div className="w-full max-w-3xl relative">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 via-amber-500/20 to-blue-500/20 dark:from-green-500/10 dark:via-amber-500/5 dark:to-blue-500/10 blur-xl opacity-70 rounded-2xl glow-pulse"></div>
      <Card className="w-full relative shadow-lg h-[calc(100vh-180px)] flex flex-col overflow-hidden bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg border border-white/20 dark:border-gray-800/30 rounded-2xl chat-container-glow">
        <CardHeader className="py-2 px-4 bg-white/30 dark:bg-gray-900/40 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div />
            
            <div className="flex items-center bg-white/20 dark:bg-gray-800/30 rounded-full p-1 shadow-sm">
              <button
                onClick={() => setInterfaceType("chat")}
                className={`px-4 py-1 rounded-full flex items-center gap-2 transition-all ${
                  interfaceType === "chat" 
                    ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm" 
                    : "text-gray-700 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-gray-700/30"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 9h8m-8 4h4m-8.2 7h16.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C22 17.72 22 16.88 22 15.2V8.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C19.72 4 18.88 4 17.2 4H6.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C2 6.28 2 7.12 2 8.8v6.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C4.28 20 5.12 20 6.8 20z" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-medium text-sm">Chat</span>
              </button>
              <button
                onClick={() => setInterfaceType("voice")}
                className={`px-4 py-1 rounded-full flex items-center gap-2 transition-all ${
                  interfaceType === "voice" 
                    ? "bg-white dark:bg-gray-900 text-green-600 dark:text-green-400 shadow-sm" 
                    : "text-gray-700 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-gray-700/30"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 10v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 6v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 8v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18 5v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 10v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-medium text-sm">Voice</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-white/30 dark:hover:bg-gray-700/30 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 2V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M12 20V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M4.93 4.93L6.34 6.34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M17.66 17.66L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M2 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M20 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M6.34 17.66L4.93 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M19.07 4.93L17.66 6.34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-700 dark:text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              
              {user && (
                <button
                  onClick={() => setShowSignOutDialog(true)}
                  className="p-2 rounded-full hover:bg-red-500/20 dark:hover:bg-red-500/10 transition-colors text-red-500/80 dark:text-red-400/80 hover:text-red-600 dark:hover:text-red-400"
                  aria-label="Sign out"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 17L21 12M21 12L16 7M21 12H9M9 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        
        {/* Sign Out Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showSignOutDialog}
          onClose={() => setShowSignOutDialog(false)}
          onConfirm={handleSignOut}
          title="Sign Out Confirmation"
          description="Are you sure you want to sign out of NurseChat?"
          confirmText="Sign Out"
          cancelText="Cancel"
          variant="destructive"
        />
        
        {/* Document status indicator as a floating element above the messages */}
        {/* Option 1: Floating badge (currently disabled, uncomment to use) */}
        {/* {documentCount > 0 && (
          <div className="absolute right-5 top-16 z-10">
            <div className="document-status px-3 py-1.5 bg-blue-500/90 dark:bg-blue-600/90 text-white dark:text-blue-50 rounded-full text-xs font-medium flex items-center shadow-md backdrop-blur-sm">
              <span className="inline-block w-2 h-2 bg-white rounded-full mr-1.5 animate-pulse"></span>
              {documentCount} document{documentCount !== 1 ? 's' : ''} in context
            </div>
          </div>
        )} */}
        
        {interfaceType === "chat" ? (
          <>
        <CardContent className="px-4 py-2 overflow-y-auto flex-grow">
          <div className="flex flex-col gap-2">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message.content}
                isBot={message.isBot}
                timestamp={message.timestamp}
                documentData={message.documentData}
              />
            ))}
            {isLoading && (
              <div className="flex w-full justify-start">
                <div className="flex-shrink-0 mr-3">
                      <div className="w-8 h-8 rounded-full bg-green-100/70 dark:bg-green-900/30 flex items-center justify-center">
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
                <div className="flex flex-col items-start max-w-[75%]">
                  <div className="frosted-bubble-green dark:frosted-bubble-green-dark shadow-sm flex items-center space-x-2 py-2">
                    <div className="typing-animation">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
        {showQuickActions && (
              <div className="flex gap-3 overflow-x-auto px-3 py-2 border-t border-white/10 dark:border-gray-800/30 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent pb-3 bg-white/10 dark:bg-gray-900/30">
            <QuickAction
              icon={
                <svg 
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M21 10H3M21 6H3M21 14H3M21 18H3" />
                </svg>
              }
              text="In the hospital, give me the information about ..."
              onClick={() => handleQuickAction("In the hospital, give me the information about ")}
            />
            <QuickAction
              icon={
                <svg 
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              }
              text="Help me! I think I have ..."
              onClick={() => handleQuickAction("Help me! I think I have ")}
            />
            <QuickAction
              icon={
                <svg 
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
              text="What should I do if I ..."
              onClick={() => handleQuickAction("What should I do if I ")}
            />
          </div>
        )}
            <CardFooter className="p-2 border-t border-white/10 dark:border-gray-800/30 bg-white/20 dark:bg-gray-900/40">
          {/* Option 2: Document indicator above chat input (commented out) */}
          {/* {documentCount > 0 && (
            <div className="absolute top-0 left-0 right-0 transform -translate-y-full">
              <div className="flex justify-center mb-1">
                <div className="document-status px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium flex items-center shadow-sm">
                  <svg className="w-3.5 h-3.5 mr-1 text-blue-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {documentCount} document{documentCount !== 1 ? 's' : ''} in context
                </div>
              </div>
            </div>
          )} */}
          
          {/* Option 3: Document indicator in the chat footer next to input - enabled by default */}
          <div className="w-full flex gap-2">
            {documentCount > 0 && (
              <div className="flex items-center relative group">
                <div className="document-status px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium flex items-center hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors cursor-help">
                  <svg className="w-3 h-3 mr-1 text-blue-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span data-document-count={documentCount}>{documentCount} doc{documentCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )}
            <div className="flex-1">
              <ChatInput 
                onSendMessage={handleSendMessage} 
                isLoading={isLoading} 
                draftMessage={draftMessage}
              />
            </div>
          </div>
        </CardFooter>
          </>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <VoiceInterface embedded={true} />
          </div>
        )}
      </Card>
    </div>
  );
} 