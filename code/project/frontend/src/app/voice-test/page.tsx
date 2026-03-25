'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const BACKEND_URL = 'http://localhost:8000';

// Example SSML templates
const SSML_EXAMPLES = {
  basic: `<speak>This is a basic SSML example.</speak>`,
  medical_screening: `<speak>
    <prosody rate="1.0" pitch="0st" volume="+2dB">
      Hello, I'm your medical screening assistant. 
      <break time="0.5s"/>
      I'll be asking you some questions about your health today.
      <break time="0.3s"/>
      <emphasis level="moderate">Please answer each question carefully.</emphasis>
    </prosody>
    <break time="1s"/>
    <prosody rate="0.95" pitch="+1st">
      Have you experienced any of these symptoms in the last 14 days?
      <break time="0.5s"/>
      <say-as interpret-as="cardinal">1</say-as>. Fever or chills
      <break time="0.3s"/>
      <say-as interpret-as="cardinal">2</say-as>. Cough
      <break time="0.3s"/>
      <say-as interpret-as="cardinal">3</say-as>. Shortness of breath
      <break time="0.3s"/>
      <say-as interpret-as="cardinal">4</say-as>. Fatigue
      <break time="0.3s"/>
      <say-as interpret-as="cardinal">5</say-as>. Muscle or body aches
    </prosody>
    <break time="1s"/>
    <prosody rate="1.0" pitch="0st">
      <emphasis level="strong">Please respond with yes or no for each symptom.</emphasis>
    </prosody>
  </speak>`,
  medical_instruction: `<speak>
    <prosody rate="0.9" pitch="0st">
      <emphasis level="moderate">Important medical instruction:</emphasis>
      <break time="0.5s"/>
      Please take your medication <say-as interpret-as="time">08:00</say-as> AM and <say-as interpret-as="time">20:00</say-as> PM.
      <break time="0.3s"/>
      <emphasis level="strong">Do not skip any doses.</emphasis>
    </prosody>
  </speak>`,
  medical_reminder: `<speak>
    <prosody rate="1.0" pitch="+1st" volume="+2dB">
      <emphasis level="moderate">Friendly reminder:</emphasis>
      <break time="0.3s"/>
      Your next appointment is scheduled for 
      <say-as interpret-as="date" format="mdy">04/20/2024</say-as>
      at <say-as interpret-as="time">10:30</say-as> AM.
      <break time="0.5s"/>
      Please arrive 15 minutes early.
    </prosody>
  </speak>`
};

export default function VoiceTestPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [useSSML, setUseSSML] = useState(false);
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        
        try {
          setIsLoading(true);
          const response = await fetch(`${BACKEND_URL}/voice/stt`, {
            method: 'POST',
            body: audioBlob,
            headers: {
              'Accept': 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          setTranscript(data.text);
        } catch (error) {
          console.error('Error transcribing audio:', error);
          setError('Error connecting to the server. Please make sure the backend is running.');
          setTranscript('');
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setError('Error accessing microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const playTTS = async () => {
    if (!ttsText.trim()) return;

    try {
      setError(null);
      setIsLoading(true);
      setIsPlaying(true);
      
      const response = await fetch(`${BACKEND_URL}/voice/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: ttsText,
          use_ssml: useSSML 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        
        audioRef.current.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (error) {
      console.error('Error with TTS:', error);
      setError('Error with text-to-speech. Please try again.');
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExample = (example: string) => {
    setTtsText(SSML_EXAMPLES[example as keyof typeof SSML_EXAMPLES]);
    setSelectedExample(example);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Voice Test Page</h1>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Speech-to-Text Section */}
        <Card>
          <CardHeader>
            <CardTitle>Speech-to-Text Test</CardTitle>
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

        {/* Text-to-Speech Section */}
        <Card>
          <CardHeader>
            <CardTitle>Text-to-Speech Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="ssml-mode"
                  checked={useSSML}
                  onCheckedChange={setUseSSML}
                />
                <Label htmlFor="ssml-mode">Use SSML</Label>
              </div>
              
              {useSSML && (
                <div className="space-y-2">
                  <Label>SSML Examples:</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(SSML_EXAMPLES).map((example) => (
                      <Button
                        key={example}
                        variant={selectedExample === example ? "default" : "outline"}
                        size="sm"
                        onClick={() => loadExample(example)}
                      >
                        {example}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              <Textarea
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder={useSSML ? "Enter SSML markup..." : "Enter text to convert to speech..."}
                className="min-h-[100px] font-mono"
              />
              <Button
                onClick={playTTS}
                disabled={!ttsText.trim() || isPlaying || isLoading}
                className="w-full"
              >
                {isLoading ? 'Processing...' : (isPlaying ? 'Playing...' : 'Play Speech')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
} 