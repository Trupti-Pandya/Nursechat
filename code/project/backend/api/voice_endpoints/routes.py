from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from google.cloud import speech_v1
from google.cloud import texttospeech_v1
import os
from dotenv import load_dotenv
import json
from google.oauth2 import service_account
from google.auth import credentials
import requests
import io
import httpx
import logging
import asyncio

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

router = APIRouter()

# Initialize Speech-to-Text client with credentials
credentials_path = os.getenv("GOOGLE_CLOUD_CREDENTIALS_PATH")
if credentials_path:
    try:
        credentials = service_account.Credentials.from_service_account_file(
            credentials_path,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        speech_client = speech_v1.SpeechClient(credentials=credentials)
        # Initialize Text-to-Speech client with the same credentials
        tts_client = texttospeech_v1.TextToSpeechClient(credentials=credentials)
        logger.info("Google Cloud clients initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing Google Cloud clients: {str(e)}")
        speech_client = None
        tts_client = None
else:
    logger.warning("GOOGLE_CLOUD_CREDENTIALS_PATH not set in environment variables")
    speech_client = None
    tts_client = None

# Get API keys for alternative services
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVEN_LABS_API_KEY = os.getenv("ELEVEN_LABS_API_KEY", "")

# Log API key status
if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY not set in environment variables")
if not ELEVEN_LABS_API_KEY:
    logger.warning("ELEVEN_LABS_API_KEY not set in environment variables")

@router.post("/stt")
async def speech_to_text(request: Request):
    """
    Convert speech audio to text using Google Cloud Speech-to-Text.
    
    This endpoint accepts an audio file in WEBM OPUS format and returns the transcribed text.
    
    Parameters:
    - **request**: Request object containing audio data in the body
    
    Returns:
    - **dict**: Object containing:
        - text (str): Transcribed text from the audio
    
    Raises:
    - HTTPException(500): If the Google Cloud Speech client is not initialized or there's an error processing the audio
    """
    try:
        if not speech_client:
            raise HTTPException(status_code=500, detail="Google Cloud Speech client not initialized")
            
        audio_data = await request.body()
        audio = speech_v1.RecognitionAudio(content=audio_data)
        config = speech_v1.RecognitionConfig(
            encoding=speech_v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            sample_rate_hertz=48000,
            language_code="en-US",
            enable_automatic_punctuation=True,
        )
        response = speech_client.recognize(config=config, audio=audio)
        if response.results:
            transcript = response.results[0].alternatives[0].transcript
            return {"text": transcript}
        return {"text": "No speech detected"}
    except Exception as e:
        logger.error(f"STT Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tts")
async def text_to_speech(request: Request):
    """
    Convert text to speech using Google Cloud Text-to-Speech.
    
    This endpoint accepts text or SSML and returns synthesized audio.
    
    Parameters:
    - **request**: Request object containing JSON with:
        - text (str): Text to convert to speech
        - use_ssml (bool, optional): Whether the text is in SSML format
    
    Returns:
    - **Response**: Response object containing:
        - content: Audio data in MP3 format
        - media_type: "audio/mp3"
    
    Raises:
    - HTTPException(500): If the Google Cloud TTS client is not initialized
    - HTTPException(400): If no text is provided
    """
    try:
        if not tts_client:
            raise HTTPException(status_code=500, detail="Google Cloud TTS client not initialized")
            
        data = await request.json()
        text = data.get("text", "")
        use_ssml = data.get("use_ssml", False)
        
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        # Create synthesis input based on whether SSML is used
        if use_ssml:
            synthesis_input = texttospeech_v1.SynthesisInput(ssml=text)
        else:
            synthesis_input = texttospeech_v1.SynthesisInput(text=text)
        
        # Use a more natural, professional voice
        voice = texttospeech_v1.VoiceSelectionParams(
            language_code="en-US",
            name="en-US-Neural2-F",  # Using a more natural voice
            ssml_gender=texttospeech_v1.SsmlVoiceGender.FEMALE,
        )
        
        # Configure audio settings for more natural speech
        audio_config = texttospeech_v1.AudioConfig(
            audio_encoding=texttospeech_v1.AudioEncoding.MP3,
            speaking_rate=1.0,  # Normal speaking rate
            pitch=0.0,  # Natural pitch
            volume_gain_db=2.0,  # Slightly increased volume
        )
        
        response = tts_client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )
        
        return Response(
            content=response.audio_content,
            media_type="audio/mp3"
        )
    except Exception as e:
        logger.error(f"TTS Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# New AI routes
@router.post("/ai/stt")
async def whisper_speech_to_text(request: Request):
    """
    Convert speech audio to text using OpenAI Whisper.
    
    This endpoint provides an alternative to Google Cloud Speech-to-Text with 
    potentially better accuracy for medical terminology.
    
    Parameters:
    - **request**: Request object containing audio data in the body (WEBM format)
    
    Returns:
    - **dict**: Object containing:
        - text (str): Transcribed text from the audio
    
    Raises:
    - HTTPException(500): If the OpenAI API key is not configured or there's an error processing the audio
    """
    try:
        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        logger.info("Processing audio with OpenAI Whisper")
        audio_data = await request.body()
        
        # Save audio data to a temporary file
        temp_audio = io.BytesIO(audio_data)
        temp_audio.name = "audio.webm"  # OpenAI needs a filename with extension
        
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        }
        
        async with httpx.AsyncClient() as client:
            files = {
                "file": temp_audio,
                "model": (None, "whisper-1"),
                "language": (None, "en"),
            }
            
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=headers,
                files=files,
                timeout=30.0  # Increase timeout for larger files
            )
            
            if response.status_code != 200:
                error_detail = f"OpenAI API error: {response.text}"
                logger.error(error_detail)
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            result = response.json()
            return {"text": result.get("text", "No speech detected")}
    except HTTPException as e:
        raise e
    except Exception as e:
        error_msg = f"Whisper STT Error: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/ai/tts")
async def eleven_labs_text_to_speech(request: Request):
    """
    Convert text to speech using ElevenLabs with streaming support.
    
    This endpoint provides an alternative to Google Cloud Text-to-Speech with
    more natural voice quality and real-time streaming capabilities.
    
    Parameters:
    - **request**: Request object containing JSON with:
        - text (str): Text to convert to speech
    
    Returns:
    - **StreamingResponse**: Streaming response with audio data chunks
        - media_type: "audio/mpeg"
    
    Raises:
    - HTTPException(400): If no text is provided
    - HTTPException(500): If there's an error communicating with ElevenLabs
    """
    try:
        if not ELEVEN_LABS_API_KEY:
            logger.warning("ElevenLabs API key not set, using demo mode")
        
        logger.info("Generating speech with ElevenLabs (streaming) - Nurse Voice")
        data = await request.json()
        text = data.get("text", "")
        
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        # Use ElevenLabs streaming endpoint
        # Grace voice - a warm, professional female voice (good for a nurse)
        voice_id = "oWAxZDx7w5VEj9dCyTzz"  
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
        }
        
        if ELEVEN_LABS_API_KEY:
            headers["xi-api-key"] = ELEVEN_LABS_API_KEY
        
        # Optimize voice settings for a nurse persona:
        # - Lower stability for more natural variations
        # - Moderate similarity boost to maintain voice characteristics
        # - Low style value for professional tone
        payload = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.65,         # Slightly lower for more natural variations
                "similarity_boost": 0.7,    # Moderate to maintain consistent voice
                "style": 0.1,              # Low style for professional tone
                "use_speaker_boost": True
            },
            "output_format": "mp3_44100_128"
        }
        
        logger.info(f"Streaming request to ElevenLabs API with text: {text[:30]}...")
        
        # This function will stream the chunks directly from ElevenLabs to the client
        async def stream_generator():
            async with httpx.AsyncClient() as client:
                try:
                    # Use real streaming for better performance
                    async with client.stream("POST", url, json=payload, headers=headers, timeout=30.0) as response:
                        if response.status_code != 200:
                            error_text = await response.aread()
                            error_detail = f"ElevenLabs API error {response.status_code}: {error_text.decode('utf-8', errors='replace')}"
                            logger.error(error_detail)
                            raise HTTPException(status_code=response.status_code, detail=error_detail)
                        
                        logger.info("Started receiving audio stream from ElevenLabs")
                        chunk_count = 0
                        async for chunk in response.aiter_bytes():
                            if chunk:
                                chunk_count += 1
                                logger.debug(f"Forwarding chunk #{chunk_count}, size: {len(chunk)} bytes")
                                yield chunk
                        
                        logger.info(f"Completed streaming {chunk_count} chunks from ElevenLabs")
                except httpx.RequestError as e:
                    error_msg = f"Error communicating with ElevenLabs: {str(e)}"
                    logger.error(error_msg)
                    raise HTTPException(status_code=500, detail=error_msg)
        
        # Use StreamingResponse for true streaming
        return StreamingResponse(
            stream_generator(),
            media_type="audio/mpeg",
            headers={
                "Transfer-Encoding": "chunked",
                "Cache-Control": "no-cache"
            }
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        error_msg = f"ElevenLabs TTS Error: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg) 