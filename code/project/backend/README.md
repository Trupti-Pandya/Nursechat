# Medical Screening Assistant Backend API

This document provides an overview of the backend API for the Medical Screening Assistant application, designed to help nurses with medical screening using AI and voice technologies.

## API Overview

The API is built with FastAPI and provides endpoints for:

- Chat processing with AI-powered responses
- Voice processing (speech-to-text and text-to-speech)
- OCR document processing
- Admin functions for hospital information management

## Base URL

Development: `http://localhost:8000`

## API Endpoints

### Chat Endpoints

#### Process a chat message

```
POST /ai/chat
```

Process a chat message and generate an AI response, integrating with uploaded documents.

**Request Body:**
```json
{
  "session_id": "string",
  "message": "string",
  "documents": [
    {
      "content": "string",
      "metadata": {
        "fileName": "string",
        "fileType": "string"
      }
    }
  ]
}
```

**Response:**
```json
{
  "response": "string",
  "references": [
    {
      "title": "string",
      "url": "string",
      "similarity": 0.95
    }
  ],
  "document_count": 0
}
```

### Voice Endpoints

#### Speech to Text (Google Cloud)

```
POST /voice/stt
```

Convert speech audio to text using Google Cloud Speech-to-Text.

**Request Body:**
Raw audio data in WEBM OPUS format

**Response:**
```json
{
  "text": "Transcribed text from the audio"
}
```

#### Text to Speech (Google Cloud)

```
POST /voice/tts
```

Convert text to speech using Google Cloud Text-to-Speech.

**Request Body:**
```json
{
  "text": "string",
  "use_ssml": false
}
```

**Response:**
Audio data in MP3 format

#### Speech to Text (OpenAI Whisper)

```
POST /voice/ai/stt
```

Convert speech audio to text using OpenAI Whisper.

**Request Body:**
Raw audio data in WEBM format

**Response:**
```json
{
  "text": "Transcribed text from the audio"
}
```

#### Text to Speech (ElevenLabs with Streaming)

```
POST /voice/ai/tts
```

Convert text to speech using ElevenLabs with streaming support.

**Request Body:**
```json
{
  "text": "string"
}
```

**Response:**
Streaming audio data in MPEG format

### OCR Endpoints

#### Process Document with OCR

```
POST /ocr/mistral
```

Process images or PDFs using Mistral's OCR capabilities.

**Request Body:**
Multipart form data with a file (supported formats: images, PDFs)

**Response:**
```json
{
  "markdown": "Extracted text in markdown format",
  "text": "Extracted text in plain text format"
}
```

### Admin Endpoints

#### Admin Dashboard

```
GET /admin/dashboard
```

Admin dashboard endpoint that checks if the user has admin privileges.

**Headers:**
- `Authorization: Bearer {token}`

**Response:**
```json
{
  "message": "Welcome to the admin dashboard, admin@example.com!",
  "status": "success"
}
```

#### Get Users

```
GET /admin/users
```

Get all users from the database. Only accessible by admins.

**Headers:**
- `Authorization: Bearer {token}`

**Response:**
```json
[
  {
    "user_id": "string",
    "email": "string",
    "metadata": {}
  }
]
```

#### Update Admin Status

```
POST /admin/update-admin-status
```

Update the admin status of a user. Only accessible by existing admins.

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters:**
- `user_id`: User ID to update
- `is_admin`: Boolean value to set admin status

**Response:**
```json
{
  "message": "Updated admin status for user {user_id} to {is_admin}",
  "status": "success"
}
```

#### Upload Hospital Info

```
POST /admin/hospital-info
```

Upload a new hospital info file. Only accessible by admins.

**Headers:**
- `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "file_content": "string",
  "file_name": "string",
  "notes": "string",
  "is_active": false
}
```

**Response:**
Hospital info file data with auto-generated ID and version

#### Get Hospital Info History

```
GET /admin/hospital-info/history
```

Get hospital info file upload history. Only accessible by admins.

**Headers:**
- `Authorization: Bearer {token}`

**Query Parameters:**
- `file_name`: (optional) Filter by file name
- `limit`: (optional) Maximum number of records to return (default: 10)
- `offset`: (optional) Offset for pagination (default: 0)

**Response:**
```json
{
  "files": [
    {
      "id": "string",
      "file_content": "string",
      "file_name": "string",
      "version": 1,
      "is_active": false,
      "uploaded_by": "string",
      "uploaded_at": "2023-01-01T00:00:00.000Z",
      "notes": "string"
    }
  ],
  "count": 1
}
```

#### Activate Hospital Info

```
PUT /admin/hospital-info/{file_id}/activate
```

Activate a specific hospital info file version. Only accessible by admins.

**Headers:**
- `Authorization: Bearer {token}`

**Path Parameters:**
- `file_id`: ID of the file to activate

**Response:**
Updated hospital info file data

#### Get Active Hospital Info

```
GET /admin/hospital-info/active
```

Get the currently active hospital info file. Only accessible by admins.

**Headers:**
- `Authorization: Bearer {token}`

**Response:**
Currently active hospital info file data, or null if none is active

## Authentication

Admin endpoints require authentication via JWT tokens in the Authorization header:

```
Authorization: Bearer {token}
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200 OK`: Request successful
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses include a detail message:

```json
{
  "detail": "Error message"
}
```

## Swagger Documentation

Interactive API documentation is available at:

```
http://localhost:8000/docs
```

Alternatively, the ReDoc version is available at:

```
http://localhost:8000/redoc
``` 