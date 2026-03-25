"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, User, Circle, MessageSquare, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface VoiceInterfaceProps {
  embedded?: boolean;
}

// Function to format timestamp for display
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  // Format as hour:minute AM/PM
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function VoiceInterface({ embedded = false }: VoiceInterfaceProps) {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Transcript and response
  const [transcript, setTranscript] = useState('');
  const [responseText, setResponseText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{message: string, isUser: boolean, timestamp: string}>>([]);
  const [pendingResponse, setPendingResponse] = useState<string | null>(null);
  
  // Error handling
  const [hasError, setHasError] = useState(false);
  
  // Set error with auto-clear timer
  const setErrorWithTimeout = (errorMessage: string) => {
    setError(errorMessage);
    // Clear error after 5 seconds
    setTimeout(() => {
      setError(null);
    }, 5000);
  };
  
  // Global error handler to catch unhandled errors
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error("Global error caught:", event.error);
      
      // Handle specific MediaSource errors
      if (event.error?.message?.includes("SourceBuffer") || 
          event.error?.message?.includes("MediaSource") ||
          event.error?.name === "InvalidStateError") {
        event.preventDefault();
        
        // Only setError for media errors if we're currently playing audio
        if (isPlaying) {
          setHasError(true);
          // Don't show technical errors to users - use friendly message
          setErrorWithTimeout("There was an issue with audio playback. The message will still be displayed.");
          
          // If there's a pending response, still show it
          if (pendingResponse) {
            setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
            setPendingResponse(null);
          }
          
          // Stop playing state
          setIsPlaying(false);
        }
      }
      
      return false;
    };
    
    window.addEventListener('error', handleGlobalError);
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, [isPlaying, pendingResponse]);
  
  // Dark mode detection
  const [darkMode, setDarkMode] = useState(false);
  
  // Check for dark mode on mount and when theme changes
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setDarkMode(isDarkMode);
    
    // Setup observer for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDarkMode = document.documentElement.classList.contains('dark');
          setDarkMode(isDarkMode);
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  // Microphone permission state
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  
  // Audio processing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Focus scrolling state
  const [currentFocusIndex, setCurrentFocusIndex] = useState(0);
  const [listTranslateY, setListTranslateY] = useState(0);
  const isThrottled = useRef(false);
  const throttleDelay = 200;
  
  // Session management
  const sessionIdRef = useRef<string>(uuidv4());
  
  // Request microphone permission when component mounts
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      try {
        // This will trigger the browser permission prompt
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // If we get here, permission is granted
        setMicPermission("granted");
        
        // Clean up the stream since we're not using it yet
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Microphone permission error:", err);
        setMicPermission("denied");
        setError("Microphone access is required for voice interaction. Please allow microphone access and reload the page.");
      }
    };
    
    // Check for permission when the component loads
    checkMicrophonePermission();
  }, []);
  
  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        message: "Hello! I'm NurseChat. How are you feeling today?",
        isUser: false,
        timestamp: new Date().toISOString()
      }]);
    }
  }, []);
  
  // Visualizer references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Message scrolling references
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Array<HTMLDivElement | null>>([]);
  
  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    };
  }, [audioUrl]);
  
  // Scroll to the bottom of messages when they update
  useEffect(() => {
    // Set focus to the newest message when messages are updated
    if (messages.length > 0) {
      // Short delay to allow for element creation
      setTimeout(() => {
        setCurrentFocusIndex(messages.length - 1);
      }, 100);
    }
  }, [messages.length]);
  
  // Handle keyboard navigation through messages
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentFocusIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentFocusIndex(prev => Math.min(prev + 1, messages.length - 1));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messages.length]);
  
  // Update playing state when audio ends
  useEffect(() => {
    const audioElement = audioRef.current;
    let playTimeout: NodeJS.Timeout | null = null;
    
    const handleEnded = () => {
      console.log("Audio playback ended");
      setIsPlaying(false);
      // Auto-focus on the newest message when speaking ends
      if (messages.length > 0) {
        setCurrentFocusIndex(messages.length - 1);
      }
      if (playTimeout) {
        clearTimeout(playTimeout);
        playTimeout = null;
      }
    };
    
    const handlePlay = () => {
      console.log("Audio playback started");
      // Ensure playback rate is set to slow down speech
      if (audioRef.current) {
        audioRef.current.playbackRate = 0.97;
      }
      
      setIsPlaying(true);
      // When audio starts playing, show the response text
      if (pendingResponse) {
        setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
        setPendingResponse(null);
      }
      
      // Set a safety timeout - if audio is playing for more than 30 seconds,
      // assume something went wrong and reset the state
      if (playTimeout) clearTimeout(playTimeout);
      playTimeout = setTimeout(() => {
        console.warn("Audio playback timeout reached - forcing reset");
        setIsPlaying(false);
        // Ensure the message is displayed
        if (pendingResponse) {
          setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
          setPendingResponse(null);
        }
      }, 30000);
    };
    
    const handlePause = () => {
      console.log("Audio playback paused");
      setIsPlaying(false);
      if (playTimeout) {
        clearTimeout(playTimeout);
        playTimeout = null;
      }
    };
    
    const handleError = () => {
      console.error("Audio playback error");
      setIsPlaying(false);
      if (playTimeout) {
        clearTimeout(playTimeout);
        playTimeout = null;
      }
      // Ensure the message is displayed
      if (pendingResponse) {
        setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
        setPendingResponse(null);
      }
    };
    
    if (audioElement) {
      audioElement.addEventListener('ended', handleEnded);
      audioElement.addEventListener('play', handlePlay);
      audioElement.addEventListener('pause', handlePause);
      audioElement.addEventListener('error', handleError);
    }
    
    return () => {
      if (audioElement) {
        audioElement.removeEventListener('ended', handleEnded);
        audioElement.removeEventListener('play', handlePlay);
        audioElement.removeEventListener('pause', handlePause);
        audioElement.removeEventListener('error', handleError);
      }
      if (playTimeout) {
        clearTimeout(playTimeout);
      }
    };
  }, [messages, pendingResponse]);
  
  // Set up audio visualizer
  const setupVisualizer = (stream: MediaStream) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    analyserRef.current = analyser;
    
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    
    const draw = () => {
      if (!canvas || !analyser) return;
      
      const width = canvas.width;
      const height = canvas.height;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      analyser.getByteFrequencyData(dataArray);
      canvasCtx.clearRect(0, 0, width, height);
      
      // Only draw if we're recording
      if (isRecording) {
        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        canvasCtx.fillRect(0, 0, width, height);
        
        // Create circular visualizer
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 3;
        
        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i] / 255;
          const angle = (i / bufferLength) * Math.PI * 2;
          
          // Draw lines from center outward
          const x1 = centerX + Math.cos(angle) * radius;
          const y1 = centerY + Math.sin(angle) * radius;
          const x2 = centerX + Math.cos(angle) * (radius + value * radius);
          const y2 = centerY + Math.sin(angle) * (radius + value * radius);
          
          canvasCtx.beginPath();
          canvasCtx.moveTo(x1, y1);
          canvasCtx.lineTo(x2, y2);
          
          // Medical theme colors - use teal/blue gradient
          const gradient = canvasCtx.createLinearGradient(x1, y1, x2, y2);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)'); // Teal
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.8)'); // Blue
          
          canvasCtx.strokeStyle = gradient;
          canvasCtx.lineWidth = 2;
          canvasCtx.stroke();
        }
        
        // Draw pulsing circle in center
        const pulseSize = 1 + 0.2 * Math.sin(Date.now() / 200);
        canvasCtx.beginPath();
        canvasCtx.arc(centerX, centerY, radius * 0.2 * pulseSize, 0, Math.PI * 2);
        canvasCtx.fillStyle = 'rgba(16, 185, 129, 0.7)'; // Teal
        canvasCtx.fill();
      }
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
  };
  
  // Clean up visualizer
  const cleanupVisualizer = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    analyserRef.current = null;
    
    const canvas = canvasRef.current;
    if (canvas) {
      const canvasCtx = canvas.getContext('2d');
      if (canvasCtx) {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };
  
  // Reset isPlaying after audio finishes or on any error
  useEffect(() => {
    if (!isProcessing && !pendingResponse) {
      // If processing completed and no pending response, ensure isPlaying is reset
      if (isPlaying) {
        setTimeout(() => {
          console.log("Safety reset of isPlaying after processing");
          setIsPlaying(false);
        }, 500);
      }
    }
  }, [isProcessing, pendingResponse, isPlaying]);
  
  // Start recording
  const startRecording = async () => {
    try {
      // Check if microphone permission is denied
      if (micPermission === "denied") {
        setError("Microphone access is required. Please allow microphone access in your browser settings and reload the page.");
        return;
      }
      
      setError(null);
      setTranscript('');
      setResponseText('');
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // If we get here, permission is granted
      setMicPermission("granted");
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Track recording duration to detect too-short recordings
      const recordingStartTime = Date.now();
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Stop visualizer
        cleanupVisualizer();
        
        // Process recorded audio
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Calculate recording duration
        const recordingDuration = Date.now() - recordingStartTime;
        
        // Check if recording was extremely short (likely an accidental click)
        if (recordingDuration < 300) {
          setErrorWithTimeout("Your recording was too short. Please record for a longer duration.");
          // Release microphone access
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        // Only process if there's actual audio data
        if (audioBlob.size > 0) {
          await processAudio(audioBlob);
        } else {
          setErrorWithTimeout("No audio was recorded. Please make sure your microphone is working and try again.");
        }
        
        // Release microphone access
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Set up visualizer before starting
      setupVisualizer(stream);
      
      mediaRecorder.start();
      setIsRecording(true);
      
      // Set a max recording time (30 seconds)
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && isRecording) {
          stopRecording();
        }
      }, 30000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setError('Unable to access microphone. Please check permissions.');
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  // Process the recorded audio with Whisper
  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Check if the audio is too short (less than 0.1 seconds)
      if (audioBlob.size < 1000) {
        setErrorWithTimeout("Audio recording is too short. Please record for longer.");
        return;
      }
      
      // Send to OpenAI Whisper for transcription
      const response = await fetch(`${BACKEND_URL}/voice/ai/stt`, {
        method: 'POST',
        body: audioBlob,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        // Check for specific error types
        if (response.status === 400 && errorData?.error?.code === 'audio_too_short') {
          setErrorWithTimeout("Your recording was too short. Please record for longer and speak clearly.");
          return;
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      
      const data = await response.json();
      const transcriptText = data.text;
      setTranscript(transcriptText);
      
      // Add user message to chat
      setMessages(prev => [...prev, { message: transcriptText, isUser: true, timestamp: new Date().toISOString() }]);
      
      // Send the transcribed text to the AI chat endpoint
      const aiResponse = await getAIResponse(transcriptText);
      setResponseText(aiResponse);
      
      // Store response but don't show it yet
      setPendingResponse(aiResponse);
      
      // Generate speech from the response text
      // Message will be displayed when audio starts playing
      await generateSpeech(aiResponse);
    } catch (error) {
      console.error('Error processing audio:', error);
      setErrorWithTimeout(String(error));
      setIsPlaying(false);
      // If there's an error, still show the message
      if (pendingResponse) {
        setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
        setPendingResponse(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Get AI response from the chat endpoint
  const getAIResponse = async (userMessage: string): Promise<string> => {
    try {
      const response = await fetch(`${BACKEND_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          message: userMessage
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.response || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error('Error getting AI response:', error);
      setError(`Failed to get AI response: ${error}`);
      return "I'm having trouble connecting to my knowledge base. Please try again.";
    }
  };
  
  // Generate speech from text using ElevenLabs
  const generateSpeech = async (text: string) => {
    try {
      // Clean up previous audio if any
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      
      const response = await fetch(`${BACKEND_URL}/voice/ai/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text,
          // Slow down the speech rate by 3%
          speech_rate: 0.97
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Create MediaSource with appropriate MIME types
      const mediaSource = new MediaSource();
      const url = URL.createObjectURL(mediaSource);
      setAudioUrl(url);
      
      if (audioRef.current) {
        audioRef.current.src = url;
      }
      
      // Set a timeout to handle cases where sourceopen never fires
      const sourceOpenTimeout = setTimeout(() => {
        // Display message even if audio fails
        if (pendingResponse) {
          setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
          setPendingResponse(null);
        }
        throw new Error("MediaSource took too long to open");
      }, 5000);
      
      // Set up MediaSource buffer when opened
      mediaSource.addEventListener('sourceopen', async () => {
        // Clear timeout since sourceopen fired
        clearTimeout(sourceOpenTimeout);
        
        try {
          // Create SourceBuffer with MP3 MIME type
          const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
          
          // Queue to handle sourceBuffer updates
          const bufferQueue: ArrayBuffer[] = [];
          let updating = false;
          
          const processQueue = () => {
            if (bufferQueue.length > 0 && !updating && mediaSource.readyState !== 'ended') {
              updating = true;
              const buffer = bufferQueue.shift();
              if (buffer) {
                try {
                  sourceBuffer.appendBuffer(buffer as ArrayBuffer);
                } catch (e) {
                  console.error("Error appending buffer:", e);
                  // Continue processing queue despite error
                  updating = false;
                  processQueue();
                }
              }
            }
          };
          
          sourceBuffer.addEventListener('updateend', () => {
            updating = false;
            processQueue();
          });
          
          // Get reader for streaming
          const reader = response.body?.getReader();
          if (!reader) {
            setIsPlaying(false);
            throw new Error("Response body is not readable");
          }
          
          let receivedLength = 0;
          let segments = 0;
          let firstSegment = true;
          
          // Auto-play first segment
          const startPlayback = () => {
            if (audioRef.current && firstSegment) {
              // Slow down speech by setting the playback rate
              audioRef.current.playbackRate = 0.97;
              
              audioRef.current.play().catch(e => {
                console.error("Error playing audio:", e);
                // Show a friendly error message
                setErrorWithTimeout("Unable to play audio. Displaying the response as text instead.");
                
                // Reset playing state
                setIsPlaying(false);
                
                // Always show the message if playback fails
                if (pendingResponse) {
                  setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
                  setPendingResponse(null);
                }
              });
              firstSegment = false;
            }
          };
          
          // Process the stream
          let retryCount = 0;
          const MAX_RETRIES = 3;
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                // Create a function to end the stream safely
                const endStreamSafely = () => {
                  try {
                    if (mediaSource.readyState !== 'ended' && !sourceBuffer.updating) {
                      mediaSource.endOfStream();
                      // Ensure playing state is reset
                      setTimeout(() => {
                        if (isPlaying) {
                          console.log("Force resetting isPlaying after endOfStream");
                          setIsPlaying(false);
                        }
                      }, 300);
                    }
                  } catch (error) {
                    console.warn("Error ending media stream:", error);
                    // If we can't end the stream, make sure the message is still displayed
                    if (pendingResponse) {
                      setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
                      setPendingResponse(null);
                    }
                    // Reset playing state
                    setIsPlaying(false);
                  }
                };

                // If sourceBuffer is updating, wait for it to finish
                if (sourceBuffer.updating) {
                  sourceBuffer.addEventListener('updateend', endStreamSafely, { once: true });
                } else {
                  endStreamSafely();
                }
                break;
              }
              
              if (value) {
                segments++;
                receivedLength += value.length;
                
                try {
                  // Add chunk to buffer queue
                  bufferQueue.push(value.buffer as ArrayBuffer);
                  processQueue();
                } catch (error) {
                  console.warn("Error processing audio chunk:", error);
                  // If we encounter an error with this chunk, try to continue
                  // But increment retry count
                  retryCount++;
                  
                  if (retryCount >= MAX_RETRIES) {
                    // Too many errors, abandon audio playback but still show message
                    if (pendingResponse) {
                      setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
                      setPendingResponse(null);
                    }
                    throw new Error("Too many errors during audio processing");
                  }
                }
                
                // Start playback when first segment arrives
                startPlayback();
              }
            }
          } catch (error) {
            console.error("Error in audio streaming:", error);
            // Ensure message is displayed even if streaming fails
            if (pendingResponse) {
              setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
              setPendingResponse(null);
            }
          }
        } catch (error) {
          console.error("MediaSource error:", error);
          setErrorWithTimeout(`There was an issue with audio playback. The message will still be displayed.`);
          setIsPlaying(false);
          // If there's an error, still show the message
          if (pendingResponse) {
            setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
            setPendingResponse(null);
          }
        }
      });
    } catch (error) {
      console.error('Error generating speech:', error);
      setErrorWithTimeout(`Unable to generate speech. Displaying the response as text.`);
      setIsPlaying(false);
      // If there's an error, still show the message
      if (pendingResponse) {
        setMessages(prev => [...prev, { message: pendingResponse, isUser: false, timestamp: new Date().toISOString() }]);
        setPendingResponse(null);
      }
    }
  };
  
  // Ensure messageRefs array has the correct size
  useEffect(() => {
    messageRefs.current = messageRefs.current.slice(0, messages.length);
  }, [messages]);

  // Calculate and update positions for focused scrolling
  useLayoutEffect(() => {
    if (messages.length === 0 || !chatContainerRef.current || !messageListRef.current) return;

    const containerCenterY = chatContainerRef.current.clientHeight / 2;
    let focusedElement = messageRefs.current[currentFocusIndex];

    if (!focusedElement) {
      const firstElement = messageRefs.current[0];
      if (!firstElement) return;
      focusedElement = firstElement;
    }

    if (focusedElement) {
      const focusedElementRect = focusedElement.getBoundingClientRect();
      const messageListRect = messageListRef.current.getBoundingClientRect();
      const focusedElementCenterY_relative = (focusedElementRect.top - messageListRect.top) + (focusedElementRect.height / 2);
      const targetTranslateY = containerCenterY - focusedElementCenterY_relative;
      
      // Set the translateY directly on the element for smoother transitions
      if (messageListRef.current) {
        setListTranslateY(targetTranslateY);
      }
    }
  }, [currentFocusIndex, messages.length]);

  // Scroll event handler for focused scrolling
  const handleScroll = useCallback((event: WheelEvent) => {
    event.preventDefault();
    if (isThrottled.current || messages.length === 0) {
      return;
    }
    
    isThrottled.current = true;
    setTimeout(() => {
      isThrottled.current = false;
    }, throttleDelay);

    const delta = Math.sign(event.deltaY);
    setCurrentFocusIndex(prevIndex => {
      let nextIndex = prevIndex;
      if (delta > 0) {
        nextIndex = Math.min(prevIndex + 1, messages.length - 1);
      } else if (delta < 0) {
        nextIndex = Math.max(prevIndex - 1, 0);
      }
      return nextIndex;
    });
  }, [messages.length]);

  // Attach scroll and touch listeners for focused scrolling
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      // Mouse wheel events
      container.addEventListener('wheel', handleScroll, { passive: false });
      
      // Touch events for mobile
      let touchStartY = 0;
      
      const handleTouchStart = (e: TouchEvent) => {
        touchStartY = e.touches[0].clientY;
      };
      
      const handleTouchMove = (e: TouchEvent) => {
        if (isThrottled.current) return;
        
        const touchY = e.touches[0].clientY;
        const diff = touchStartY - touchY;
        
        if (Math.abs(diff) > 5) {  // Small threshold to prevent accidental scrolls
          e.preventDefault();
          
          isThrottled.current = true;
          setTimeout(() => {
            isThrottled.current = false;
          }, throttleDelay);
          
          // Determine scroll direction (up or down)
          const direction = diff > 0 ? 1 : -1;
          
          setCurrentFocusIndex(prevIndex => {
            let nextIndex = prevIndex;
            if (direction > 0) {
              nextIndex = Math.min(prevIndex + 1, messages.length - 1);
            } else {
              nextIndex = Math.max(prevIndex - 1, 0);
            }
            return nextIndex;
          });
          
          touchStartY = touchY;
        }
      };
      
      container.addEventListener('touchstart', handleTouchStart);
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      
      return () => {
        container.removeEventListener('wheel', handleScroll);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
      };
    }
  }, [handleScroll, messages.length]);
  
  return (
    <div className={`flex flex-col justify-center items-center ${embedded ? 'h-full pt-2' : 'min-h-screen'} overflow-auto text-gray-800 dark:text-white`}>
      {/* Main container when not embedded - provides backdrop and styling */}
      {!embedded ? (
        <div className="w-full max-w-6xl mx-auto my-8 rounded-2xl overflow-hidden backdrop-blur-lg bg-white/60 dark:bg-gray-900/60 border border-white/20 dark:border-gray-800/30 shadow-xl">
          {/* Centered content with frosted glass effect */}
          <div 
            className="w-full mx-auto flex flex-col items-center justify-center relative p-8"
            style={{
              minHeight: "80vh"
            }}
          >
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-8 left-0 right-0 mx-auto w-full max-w-md p-3 bg-red-100/80 backdrop-blur-sm border border-red-400 text-red-700 rounded-md dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
              >
                {error}
              </motion.div>
            )}
            
            {/* Logo and Title */}
            <motion.div
              className="flex items-center gap-2 mb-10"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-[#00c853]">
                <Stethoscope className="h-9 w-9" strokeWidth={2} />
              </div>
              <h1 className="text-4xl font-bold text-black dark:text-white">
                NurseChat
              </h1>
            </motion.div>
            
            {/* Voice interface content */}
            {renderVoiceInterfaceContent()}
          </div>
        </div>
      ) : (
        /* Direct content when embedded */
        renderVoiceInterfaceContent()
      )}
      
      {/* Hidden Audio Element */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
  
  // Helper function to render the voice interface content
  function renderVoiceInterfaceContent() {
    // Show microphone permission prompt if needed
    if (micPermission === "prompt") {
      return (
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl">
          <div className="text-center p-4 bg-blue-100/80 dark:bg-blue-900/30 backdrop-blur-sm border border-blue-400 dark:border-blue-800 rounded-lg shadow-lg">
            <svg className="mx-auto w-16 h-16 text-blue-500 mb-4 animate-pulse" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 18.5a3 3 0 0 1 3 3v.5H9v-.5a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-400 mb-2">Requesting Microphone Access</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Please allow microphone access when prompted by your browser to use the voice interface.
            </p>
            <div className="flex space-x-2 justify-center">
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
      );
    }
    
    if (micPermission === "denied") {
      return (
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl">
          <div className="text-center p-4 bg-red-100/80 dark:bg-red-900/30 backdrop-blur-sm border border-red-400 dark:border-red-800 rounded-lg shadow-lg">
            <svg className="mx-auto w-16 h-16 text-red-500 mb-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 18.5a3 3 0 0 1 3 3v.5H9v-.5a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 2L22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">Microphone Access Required</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Voice interface requires microphone access to function. Please allow access in your browser settings and reload the page.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
              >
                Reload Page
              </button>
              <a
                href="https://support.google.com/chrome/answer/2693767?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                Help
              </a>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl">
        {error && embedded && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md p-3 mb-4 bg-red-100/80 backdrop-blur-sm border border-red-400 text-red-700 rounded-md dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
          >
            {error}
          </motion.div>
        )}
        
        {/* Messages display with focused scrolling */}
        <div 
          ref={chatContainerRef}
          className={`w-full mb-auto overflow-hidden ${embedded ? 'px-6' : 'px-10'} relative cursor-ns-resize`}
          style={{ height: embedded ? '360px' : '480px' }}
        >
          <div 
            ref={messageListRef}
            className="absolute left-0 right-0 transition-transform duration-700 ease-out px-8"
            style={{ 
              transform: `translateY(${listTranslateY}px)`,
              width: 'calc(100% - 16px)', 
              margin: '0 auto' 
            }}
          >
            {/* Placeholder message when loading (before welcome message is added) */}
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-20 mb-4">
                <p>Loading...</p>
              </div>
            )}
            
            {/* Map through messages and display them */}
            {messages.map((message, index) => (
              <motion.div
                key={index}
                ref={(el) => { messageRefs.current[index] = el; }}
                className="flex my-3"
                style={{ justifyContent: message.isUser ? 'flex-end' : 'flex-start' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  duration: 0.3
                }}
              >
                <div 
                  className={`${index === currentFocusIndex ? 'z-10' : 'z-0'} relative`}
                  style={{
                    transform: `scale(${index === currentFocusIndex ? 1 : 0.85})`,
                    transformOrigin: message.isUser ? 'right center' : 'left center',
                    opacity: index === currentFocusIndex ? 1 : 0.7,
                    transition: 'transform 0.7s ease, opacity 0.7s ease'
                  }}
                >
                  {index !== currentFocusIndex && (
                    <div 
                      className={`absolute inset-0 rounded-2xl pointer-events-none ${
                        Math.abs(index - currentFocusIndex) === 1 
                          ? 'bg-white/20 dark:bg-gray-900/20 backdrop-blur-[1px]'
                          : 'bg-white/30 dark:bg-gray-900/30 backdrop-blur-[2px]'
                      }`}
                      style={{
                        opacity: Math.min(0.6, 0.2 + (Math.abs(index - currentFocusIndex) * 0.1))
                      }}
                    />
                  )}
                  <div 
                    className={`frosted-bubble-${message.isUser ? 'blue' : 'green'} ${
                      darkMode ? `frosted-bubble-${message.isUser ? 'blue' : 'green'}-dark` : ''
                    } relative inline-block px-4 py-2 rounded-2xl max-w-[85%] text-sm md:text-base ${
                      index === messages.length - 1 && isPlaying && !message.isUser ? 'animate-pulse-subtle' : ''
                    }`}
                  >
                    {/* Icon for sender */}
                    <div className="flex items-start mb-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center mr-2 ${
                        message.isUser ? 'bg-blue-600 dark:bg-blue-700' : 'bg-green-600 dark:bg-green-700'
                      }`}>
                        {message.isUser ? (
                          <User size={12} className="text-white" />
                        ) : (
                          <Stethoscope size={12} className="text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        {message.message}
                      </div>
                    </div>
                    
                    <div className={`text-[10px] mt-1 ${message.isUser ? 'text-right text-blue-100/70 dark:text-blue-200/50' : 'text-left text-green-900/50 dark:text-green-100/50'}`}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} className="h-0" />
          </div>
        </div>
        
        {/* Visual separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-teal-500/50 dark:via-teal-400/40 to-transparent my-2 shadow-sm"></div>
        
        {/* Center section with mic button */}
        <div className={`flex flex-col items-center justify-center ${embedded ? 'mb-2 py-2' : 'mb-4 py-3'}`}>
          {/* Subtitle when not recording */}
          {!isRecording && !isProcessing && !isPlaying && (
            <motion.h2 
              className={`${embedded ? 'text-base' : 'text-lg'} text-gray-600 dark:text-blue-200 mb-2 drop-shadow text-center`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Click to start recording
            </motion.h2>
          )}
          
          {/* Status text when recording/processing */}
          {(isRecording || isProcessing || isPlaying) && (
            <motion.div 
              className={`${embedded ? 'text-sm' : 'text-base'} text-teal-600 dark:text-teal-300 mb-2 flex items-center justify-center drop-shadow`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {isRecording && (
                <>
                  <Circle className="h-2 w-2 fill-red-500 text-red-500 mr-2 animate-pulse" />
                  Recording... Click to stop
                </>
              )}
              {isProcessing && "Processing..."}
              {isPlaying && (
                <>
                  <Volume2 className="h-3 w-3 mr-2 text-teal-500 animate-pulse" />
                  AI is speaking... Please wait
                </>
              )}
            </motion.div>
          )}
          
          {/* Button state indicator */}
          {process.env.NODE_ENV === 'development' && (
            <div className="absolute bottom-1 right-1 text-xs text-gray-500">
              {isPlaying ? 'Playing' : isProcessing ? 'Processing' : isRecording ? 'Recording' : 'Ready'}
            </div>
          )}
          
          {/* Recording guidance notification when error contains specific message */}
          {error && error.includes("too short") && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`absolute ${embedded ? 'bottom-16' : 'bottom-24'} left-0 right-0 mx-auto w-80 p-3 bg-amber-100 dark:bg-amber-900/80 backdrop-blur-sm text-amber-800 dark:text-amber-200 rounded-lg border border-amber-300 dark:border-amber-800 text-center font-medium shadow-lg`}
            >
              <div className="flex items-center justify-center mb-1">
                <Circle className="h-3 w-3 mr-2 text-amber-500" />
                <span className="font-semibold">Recording Too Short</span>
              </div>
              <p className="text-xs">
                Please record for at least a second to ensure your message is captured.
              </p>
            </motion.div>
          )}
          
          {/* Frosted glass background for button with concentric circles */}
          <div className="flex items-center justify-center mt-0">
            <div className="relative">
              {/* Concentric circles - only visible when recording */}
              {isRecording && (
                <>
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${embedded ? 'w-[90px] h-[90px]' : 'w-[110px] h-[110px]'} bg-red-500/20 dark:bg-red-500/15 animate-pulse-fast`}></div>
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${embedded ? 'w-[70px] h-[70px]' : 'w-[90px] h-[90px]'} bg-red-500/30 dark:bg-red-500/25 animate-spin-slow`}></div>
                </>
              )}
              <div className="rounded-full p-1 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md relative z-10">
                {/* Large centered microphone button */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => {
                      if (isRecording) {
                        stopRecording();
                      } else if (!isProcessing && !isPlaying) {
                        startRecording();
                      }
                    }}
                    disabled={isProcessing || isPlaying}
                    className={`rounded-full p-3 ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : isPlaying || isProcessing
                          ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed opacity-70'
                          : 'bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700 text-white'
                    } shadow-lg flex items-center justify-center border-0 select-none touch-none`}
                    style={{ width: embedded ? '60px' : '70px', height: embedded ? '60px' : '70px' }}
                  >
                    <AnimatePresence mode="wait">
                      {isRecording ? (
                        <motion.div
                          key="recording"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 360 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Mic className="animate-pulse" size={embedded ? 30 : 36} />
                        </motion.div>
                      ) : isPlaying ? (
                        <motion.div
                          key="speaking"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: -360 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Mic className="opacity-60" size={embedded ? 30 : 36} />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="idle"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: -360 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Mic size={embedded ? 30 : 36} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
          
          {/* Audio visualizer (only visible when recording) */}
          {isRecording && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`${embedded ? 'w-64 h-64' : 'w-80 h-80'} absolute -z-10`}
              style={{ 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)' 
              }}
            >
              <canvas 
                ref={canvasRef} 
                className="w-full h-full" 
                width={400} 
                height={400}
              />
            </motion.div>
          )}
        </div>
      </div>
    );
  }
} 