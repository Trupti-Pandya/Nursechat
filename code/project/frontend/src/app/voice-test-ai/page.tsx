"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function VoiceTestAI() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Example templates for medical scenarios with a nurse's tone
  const medicalTemplates = [
    { 
      label: "Vital Signs Check", 
      text: "Hi there, I'm going to check your vital signs now. Could you please sit comfortably while I take your blood pressure and temperature? This will only take a moment." 
    },
    { 
      label: "Medication Instructions", 
      text: "I want to make sure you understand your medication schedule. Please take one tablet with food, twice daily - once in the morning and once in the evening. If you notice any unusual side effects, please don't hesitate to call us." 
    },
    { 
      label: "Pre-procedure Preparation", 
      text: "For your procedure tomorrow, remember that you'll need to fast after midnight tonight. No food or drinks, not even water. And please make sure you have someone to drive you home afterward, as you won't be able to drive yourself." 
    },
    { 
      label: "Pain Assessment", 
      text: "I'd like to understand your pain better. On a scale from 0 to 10, where 0 means no pain and 10 is the worst pain imaginable, how would you rate your pain right now? Can you also describe when it started and if anything makes it better or worse?" 
    },
    {
      label: "Discharge Instructions",
      text: "Before you head home today, I want to go over your discharge instructions. Change your dressing once a day and keep the area clean and dry. If you notice increased redness, swelling, or any discharge, please contact us immediately. Do you have any questions about your care at home?"
    },
    {
      label: "Reassurance",
      text: "I understand this can feel overwhelming, but we're going to take good care of you. The doctor will be in shortly to discuss your treatment plan, and I'll be checking on you regularly. Is there anything I can do to make you more comfortable right now?"
    }
  ];

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Release microphone access
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setError('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/voice/ai/stt`, {
        method: 'POST',
        body: audioBlob,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTranscript(data.text);
      setInputText(data.text); // Set the TTS input to the transcribed text
    } catch (error) {
      console.error('Error processing audio:', error);
      setError(String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const playTTS = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to convert to speech.');
      return;
    }

    setIsLoading(true);
    try {
      setError(null);
      console.log("Calling ElevenLabs TTS API with streaming...");
      
      // Clean up previous audio URL if it exists
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      // Create MediaSource with appropriate MIME types
      const mediaSource = new MediaSource();
      const url = URL.createObjectURL(mediaSource);
      setAudioUrl(url);

      if (audioRef.current) {
        audioRef.current.src = url;
      }

      // Set up SourceBuffer when MediaSource is opened
      mediaSource.addEventListener('sourceopen', async () => {
        try {
          console.log("MediaSource opened, setting up SourceBuffer");
          
          // Create SourceBuffer with MP3 MIME type
          const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
          
          // Queue to handle sourceBuffer updates in sequence
          const bufferQueue: ArrayBuffer[] = [];
          let updating = false;
          
          const processQueue = () => {
            if (bufferQueue.length > 0 && !updating && mediaSource.readyState !== 'ended') {
              updating = true;
              const buffer = bufferQueue.shift();
              if (buffer) {
                try {
                  sourceBuffer.appendBuffer(buffer);
                } catch (e) {
                  console.error("Error appending buffer:", e);
                }
              }
            }
          };
          
          sourceBuffer.addEventListener('updateend', () => {
            updating = false;
            processQueue();
          });

          // Make the API request with streaming response
          const response = await fetch(`${BACKEND_URL}/voice/ai/tts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: inputText,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('TTS API Error:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
          }

          // Get a reader for the stream
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("Response body is not readable");
          }

          let receivedLength = 0;
          let segments = 0;
          let firstSegment = true;

          // Start playing automatically when we get the first segment
          const startPlayback = () => {
            if (audioRef.current && firstSegment) {
              console.log("Starting playback of streaming audio");
              audioRef.current.play().catch(e => {
                console.error("Error playing audio:", e);
                setError(`Error playing audio: ${e.message}`);
              });
              firstSegment = false;
            }
          };

          // Process the audio stream
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log(`Stream complete. Received ${receivedLength} bytes in ${segments} segments.`);
              mediaSource.endOfStream();
              break;
            }
            
            if (value) {
              segments++;
              receivedLength += value.length;
              console.log(`Received segment ${segments}: ${value.length} bytes (total: ${receivedLength})`);
              
              // Add the chunk to the queue
              bufferQueue.push(value.buffer);
              processQueue();
              
              // Start playback after receiving the first segment
              startPlayback();
            }
          }
        } catch (error) {
          console.error("MediaSource processing error:", error);
          setError(String(error));
        }
      });

    } catch (error) {
      console.error('Error generating speech:', error);
      setError(String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTemplate = medicalTemplates.find(template => template.label === e.target.value);
    if (selectedTemplate) {
      setInputText(selectedTemplate.text);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Voice Test - AI Options</h1>
      <p className="mb-4 text-gray-600">
        Test OpenAI Whisper for Speech-to-Text and ElevenLabs for Text-to-Speech APIs.
      </p>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* STT Section */}
        <Card>
          <CardHeader>
            <CardTitle>Speech-to-Text with OpenAI Whisper</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={isRecording ? stopRecording : startRecording}
                className="w-full"
                variant={isRecording ? "destructive" : "default"}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : (isRecording ? 'Stop Recording' : 'Start Recording')}
              </Button>
              <Textarea
                value={transcript}
                readOnly
                placeholder="Transcribed text will appear here..."
                className="min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* TTS Section */}
        <Card>
          <CardHeader>
            <CardTitle>Text-to-Speech with Nurse Voice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select a template (optional):</Label>
                <select 
                  className="w-full p-2 border rounded-md bg-background" 
                  onChange={handleTemplateChange}
                >
                  <option value="">Choose a template</option>
                  {medicalTemplates.map((template, index) => (
                    <option key={index} value={template.label}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </div>

              <Textarea 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                placeholder="Enter text to convert to speech..."
                className="min-h-[100px]"
              />
              
              <Button 
                onClick={playTTS}
                className="w-full"
                variant="default"
                disabled={isLoading || !inputText.trim()}
              >
                {isLoading ? 'Generating...' : 'Generate & Play Speech'}
              </Button>
              
              {audioUrl && (
                <div className="mt-4">
                  <audio ref={audioRef} controls src={audioUrl} className="w-full" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 