from fastapi import HTTPException
from pydantic import BaseModel, Field
import google.generativeai as genai
from supabase import create_client
from openai import OpenAI
from typing import List, Dict, Optional
import os
import logging
from datetime import datetime
from dotenv import load_dotenv
import time
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("medical_chat.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("medical_chat")

# ----- Configuration Module -----
class Config:
    def __init__(self):
        load_dotenv()
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_API_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.document_path = os.getenv(
            "DOCUMENT_PATH", 
            os.path.join(os.path.dirname(__file__), "hospital_info.txt")
        )
        
        self.vector_retrieval_count = int(os.getenv("VECTOR_RETRIEVAL_COUNT", "3"))
        self._validate_config()

    def _validate_config(self):
        missing_vars = []
        for var, name in [
            (self.gemini_api_key, "GEMINI_API_KEY"),
            (self.supabase_url, "SUPABASE_URL"),
            (self.supabase_key, "SUPABASE_API_KEY"),
            (self.openai_api_key, "OPENAI_API_KEY")
        ]:
            if not var:
                missing_vars.append(name)
        if missing_vars:
            raise ValueError(f"Missing environment variables: {', '.join(missing_vars)}")

# ----- Service Initialization -----
config = Config()
genai.configure(api_key=config.gemini_api_key)
supabase_client = create_client(config.supabase_url, config.supabase_key)
openai_client = OpenAI(api_key=config.openai_api_key)

# ----- Models -----
class DocumentItem(BaseModel):
    """
    Model representing a document provided with a chat message.
    
    Documents can be processed by OCR and include both content and metadata.
    """
    content: Optional[str] = Field(None, description="OCR-extracted content from uploaded document")
    metadata: Optional[Dict] = Field(None, description="Metadata about the uploaded document")

class ChatRequest(BaseModel):
    """
    Model representing a chat request from the user.
    
    This includes the user's message, session information, and any documents
    they've uploaded for context.
    """
    session_id: str = Field(..., description="Unique identifier for the chat session")
    message: str = Field(..., min_length=1, max_length=4000, description="User message")
    # For backward compatibility
    document_content: Optional[str] = Field(None, description="OCR-extracted content from uploaded document (legacy)")
    document_metadata: Optional[Dict] = Field(None, description="Metadata about the uploaded document (legacy)")
    file_name: Optional[str] = Field(None, description="Name of the uploaded file (legacy)")
    file_type: Optional[str] = Field(None, description="MIME type of the uploaded file (legacy)")
    # New multi-document support
    documents: Optional[List[DocumentItem]] = Field(default_factory=list, description="List of documents provided with the message")

class ChatResponse(BaseModel):
    """
    Model representing the response to a chat request.
    
    Includes the AI-generated response and metadata about sources and documents.
    """
    response: str = Field(..., description="AI response to the user message")
    references: List[Dict] = Field(default_factory=list, description="Metadata about context sources")
    document_count: Optional[int] = Field(0, description="Number of active documents in session")

# ----- Memory Management -----
class UnifiedSessionManager:
    """
    Manages chat sessions including message history and documents.
    
    This in-memory store maintains conversation history and document references
    for each chat session. In a production environment, this should be replaced
    with persistent storage.
    """
    def __init__(self):
        # Single in-memory store for all session data
        self.sessions: Dict[str, Dict] = {}
        
    def get_session(self, session_id: str) -> Dict:
        """
        Get or create a session for the given session ID.
        
        If the session doesn't exist, a new one is created with empty message history.
        
        Args:
            session_id: Unique identifier for the session
            
        Returns:
            Dict containing session data including messages and documents
        """
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "messages": [],  # Chat history
                "documents": [],  # Document list
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat()
            }
        return self.sessions[session_id]
    
    def add_message_exchange(self, session_id: str, user_message: str, ai_response: str):
        """
        Add a message exchange (user message and AI response) to the session history.
        
        Args:
            session_id: Unique identifier for the session
            user_message: Message sent by the user
            ai_response: Response generated by the AI
        """
        session = self.get_session(session_id)
        
        # Create message pair
        message_pair = {
            "user": user_message,
            "ai": ai_response,
            "timestamp": datetime.now().isoformat()
        }
        
        # Add to messages list
        session["messages"].append(message_pair)
        
        # Update last_updated timestamp
        session["last_updated"] = datetime.now().isoformat()
    
    def get_message_history(self, session_id: str) -> List[Dict]:
        """
        Get message history for a session.
        
        Args:
            session_id: Unique identifier for the session
            
        Returns:
            List of message pairs including user messages and AI responses
        """
        session = self.get_session(session_id)
        return session["messages"]
        
    def add_document(self, session_id: str, content: str, metadata: Dict = None):
        """
        Add a document to the session.
        
        Documents provide additional context for the conversation and can be
        referenced in future messages.
        
        Args:
            session_id: Unique identifier for the session
            content: Text content of the document (e.g., OCR-extracted text)
            metadata: Additional information about the document (filename, type, etc.)
            
        Returns:
            str: Unique ID assigned to the document
        """
        session = self.get_session(session_id)
        
        # Create document object
        document = {
            "id": str(uuid.uuid4()),
            "content": content,
            "metadata": metadata or {},
            "added_at": datetime.now().isoformat()
        }
        
        # Add to documents list
        session["documents"].append(document)
        
        # Update last_updated timestamp
        session["last_updated"] = datetime.now().isoformat()
        
        return document["id"]
    
    def get_documents(self, session_id: str) -> List[Dict]:
        """
        Get all documents for a session.
        
        Args:
            session_id: Unique identifier for the session
            
        Returns:
            List of document objects with their content and metadata
        """
        session = self.get_session(session_id)
        return session["documents"]
    
    def get_all_sessions(self) -> Dict[str, Dict]:
        """
        Get all sessions.
        
        This can be used for database synchronization or administrative purposes.
        
        Returns:
            Dictionary mapping session IDs to session data
        """
        return self.sessions
    
    def serialize_session(self, session_id: str) -> Dict:
        """
        Serialize a session for database storage.
        
        Args:
            session_id: Unique identifier for the session
            
        Returns:
            Dictionary representation of the session suitable for storage
        """
        session = self.get_session(session_id)
        return {
            "session_id": session_id,
            "messages": session["messages"],
            "documents": session["documents"],
            "created_at": session["created_at"],
            "last_updated": session["last_updated"]
        }
    
    def load_from_database(self, session_data: Dict):
        """
        Load a session from database into memory.
        
        Args:
            session_data: Dictionary containing session data from database
        """
        session_id = session_data["session_id"]
        self.sessions[session_id] = {
            "messages": session_data.get("messages", []),
            "documents": session_data.get("documents", []),
            "created_at": session_data.get("created_at", datetime.now().isoformat()),
            "last_updated": session_data.get("last_updated", datetime.now().isoformat())
        }

# ----- Document Cache (CAG) -----
class HospitalDocumentCache:
    """
    Caches hospital information documents for quick access.
    
    This class fetches and caches the active hospital information document from
    Supabase, refreshing periodically to ensure data is current.
    """
    def __init__(self):
        self.supabase = supabase_client
        self.cached_content = None
        self.document_text = ""
        self.last_refresh_time = 0
        self.cache_refresh_interval = 300  # Refresh cache every 5 minutes (changed from 1 hour)
        self.active_file_info = {"source": "none", "id": None, "version": None, "file_name": None}
        self.hospital_info_available = False
        self.cache_document()

    def cache_document(self):
        """
        Fetch and cache the active hospital information document.
        
        This retrieves the currently active document from Supabase and caches it
        for future use, including creating a cached context with Gemini if needed.
        """
        try:
            # Try to get from Supabase
            current_time = time.time()
            if current_time - self.last_refresh_time < self.cache_refresh_interval and self.document_text and self.hospital_info_available:
                logger.info(f"Using cached hospital document from {self.active_file_info['source']} " +
                           (f"[ID: {self.active_file_info['id']}, Version: {self.active_file_info['version']}, " +
                            f"File: {self.active_file_info['file_name']}]" 
                            if self.active_file_info['source'] == 'supabase' else 
                            f"[Hospital information unavailable]"))
                return

            # Get the active hospital info file from Supabase
            logger.info("Fetching hospital info from Supabase...")
            response = self.supabase.table("hospital_info_files") \
                .select("*") \
                .eq("is_active", True) \
                .order("uploaded_at", desc=True) \
                .limit(1) \
                .execute()
            
            if response.data and len(response.data) > 0:
                file_data = response.data[0]
                self.document_text = file_data["file_content"]
                self.active_file_info = {
                    "source": "supabase",
                    "id": file_data["id"],
                    "version": file_data["version"],
                    "file_name": file_data["file_name"]
                }
                self.hospital_info_available = True
                logger.info(f"Retrieved hospital info from Supabase - " +
                           f"ID: {file_data['id']}, Version: {file_data['version']}, " +
                           f"File: {file_data['file_name']}")
                self.last_refresh_time = current_time
            else:
                # No active document found in Supabase
                logger.warning("No active hospital info file found in Supabase")
                self.document_text = "Hospital information is currently unavailable."
                self.active_file_info = {
                    "source": "unavailable",
                    "id": None,
                    "version": None,
                    "file_name": None
                }
                self.hospital_info_available = False
                self.last_refresh_time = current_time
            
            # Cache with Gemini if document is large enough and hospital info is available
            if not self.hospital_info_available:
                logger.info("Hospital information unavailable, skipping Gemini caching")
                return
                
            token_count = len(self.document_text.split())
            if token_count < 32768:
                logger.info(f"Document too small for caching: {token_count} tokens, using directly")
                return
                
            system_prompt = """
            You are a nurse assistant with access to hospital information. Use this document to answer hospital-related questions, provide details about hospital services, and direct patients to specific facilities based on their needs.
            """
            
            self.cached_content = genai.CachedContent.create(
                # model="gemini-1.5-pro-001",
                model="gemini-2.5-pro-preview-05-06",
                system_instruction=system_prompt,
                contents=[{"role": "user", "parts": [{"text": self.document_text}]}],
                ttl="24h"
            )
            logger.info("Hospital document cached with Gemini API")
        except Exception as e:
            logger.error(f"Failed to cache hospital document: {str(e)}")
            self.document_text = "Hospital information is currently unavailable."
            self.active_file_info = {
                "source": "error",
                "id": None,
                "version": None,
                    "file_name": None
                }
            self.hospital_info_available = False
            self.cached_content = None
            self.last_refresh_time = current_time

    def get_document_content(self) -> tuple[Optional[any], str, bool]:
        """
        Get the current hospital document content, refreshing the cache if needed.
        
        This method checks if the cached document needs to be refreshed based on
        the configured refresh interval. If it does, it calls cache_document() to
        fetch the latest version from Supabase.
        
        Returns:
            Tuple containing:
                - Cached content object for Gemini API (or None if not cached)
                - Document text as a string
                - Boolean indicating whether hospital information is available
        """
        # Check if we need to refresh the cache
        current_time = time.time()
        if current_time - self.last_refresh_time >= self.cache_refresh_interval:
            logger.info("Cache expired, refreshing hospital document...")
            self.cache_document()
        
        return self.cached_content, self.document_text, self.hospital_info_available
        
    def check_hospital_document_completeness(self, document_text: str) -> str:
        """
        Check if the hospital document has missing or placeholder information.
        
        This method scans the hospital information document for common placeholder
        patterns that might indicate incomplete information, such as "[insert...]",
        "TBD", etc.
        
        Args:
            document_text: The hospital document text to check
            
        Returns:
            String containing warnings about incomplete information, or an empty string
            if no issues were found
        """
        # Define patterns that indicate missing or placeholder information
        placeholder_patterns = [
            r"\[([^\]]+)\]",  # Text in square brackets [like this]
            r"\<([^\>]+)\>",  # Text in angle brackets <like this>
            r"(?i)TBD",       # Case-insensitive "TBD"
            r"(?i)to be determined",
            r"(?i)to be updated",
            r"(?i)to be confirmed",
            r"(?i)placeholder",
            r"(?i)insert .+ here",
            r"(?i)add .+ here",
            r"(?i)fill in .+",
            r"(?i)pending .+",
            r"(?i)awaiting .+",
            r"(?i)not yet .+",
        ]
        
        warnings = []
        
        # Check for each pattern
        for pattern in placeholder_patterns:
            import re
            matches = re.finditer(pattern, document_text)
            for match in matches:
                context = document_text[max(0, match.start() - 30):min(len(document_text), match.end() + 30)]
                context = context.replace("\n", " ").strip()
                warnings.append(f"- Possible placeholder: '...{context}...'")
                
        if warnings:
            warning_message = "WARNING: The hospital information document appears to have incomplete or placeholder information:\n\n"
            warning_message += "\n".join(warnings[:5])  # Limit to first 5 warnings to avoid overwhelming
            
            if len(warnings) > 5:
                warning_message += f"\n\nAnd {len(warnings) - 5} more potential issues.\n"
                
            warning_message += "\n\nWhen providing hospital-specific information, note these potential gaps and suggest that the user verify with hospital staff."
            
            return warning_message
            
        return ""

# ----- Vector Store (Pure RAG) -----
class VectorStore:
    """
    Manages vector embeddings for medical information retrieval.
    
    This class handles the generation of embeddings using OpenAI's text-embedding-ada-002
    model and retrieval of relevant medical context through Supabase vector search.
    """
    def __init__(self):
        self.supabase = supabase_client
        self.openai = openai_client
        self.top_k = config.vector_retrieval_count

    def get_embedding(self, text: str) -> List[float]:
        """
        Generate an embedding vector for the given text.
        
        This method uses OpenAI's text-embedding-ada-002 model to create
        vector representations of text that can be used for semantic search.
        
        Args:
            text: The text to generate an embedding for
            
        Returns:
            List of floating point values representing the embedding vector
            
        Raises:
            HTTPException: If embedding generation fails
        """
        try:
            response = self.openai.embeddings.create(model="text-embedding-ada-002", input=text)
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Failed to get embedding: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

    def retrieve_relevant_context(self, query: str) -> tuple[str, List[Dict]]:
        """
        Retrieve context relevant to the query using vector similarity search.
        
        This method finds medical information chunks that are semantically similar
        to the query by comparing embedding vectors.
        
        Args:
            query: The user query or message to find relevant context for
            
        Returns:
            Tuple containing:
              - String of combined context chunks
              - List of metadata dictionaries for the retrieved chunks
            
        Raises:
            HTTPException: If retrieval from vector store fails
        """
        try:
            query_embedding = self.get_embedding(query)
            response = self.supabase.rpc(
                "find_similar_embeddings_medical",
                {
                    "query_embedding": query_embedding,
                    "min_similarity": 0.7,
                    "result_limit": self.top_k * 2
                }
            ).execute()
            if not response.data:
                logger.info("No similar documents found in vector store")
                return "", []
            retrieved_items = response.data[:self.top_k]
            context_chunks = []
            metadata_list = []
            for item in retrieved_items:
                metadata = item.get("metadata", {})
                chunk_text = metadata.get("chunk_text", "")
                if chunk_text.strip():
                    context_chunks.append(chunk_text)
                    metadata_list.append({
                        "title": metadata.get("title", ""),
                        "url": metadata.get("url", ""),
                        "similarity": item.get("similarity", 0.0)
                    })
            combined_context = "\n\n".join(context_chunks)
            logger.info(f"Retrieved {len(metadata_list)} relevant chunks from vector store")
            return combined_context, metadata_list
        except Exception as e:
            logger.error(f"Error retrieving from vector store: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Vector retrieval failed: {str(e)}")

# ----- Chat Service -----
class NurseAssistantService:
    """
    Core service for the nurse assistant chatbot.
    
    This class orchestrates the chat process, combining:
    - Session management for conversation history
    - Document processing for uploaded files
    - Vector search for relevant medical context
    - Hospital information integration
    - AI response generation
    
    It handles the entire lifecycle of a chat message, from receiving the user
    input to generating the final AI response.
    """
    def __init__(self):
        self.vector_store = VectorStore()
        self.document_cache = HospitalDocumentCache()
        self.session_manager = UnifiedSessionManager()

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """
        Process a chat request and generate an AI response.
        
        This method:
        1. Extracts session ID and user message from the request
        2. Processes any uploaded documents
        3. Retrieves conversation history
        4. Finds relevant medical context using vector search
        5. Gets hospital information if available
        6. Constructs a prompt combining all context
        7. Generates an AI response using Gemini
        8. Stores the message exchange in the session history
        
        Args:
            request: ChatRequest object containing session ID, user message, and optional documents
            
        Returns:
            ChatResponse object with AI-generated response and metadata
            
        Raises:
            HTTPException: If response generation fails
        """
        session_id = request.session_id
        user_message = request.message
        
        # Process documents (handle both new and legacy formats)
        if request.documents:
            # New multi-document format
            for doc in request.documents:
                if doc.content:
                    self.session_manager.add_document(
                        session_id, 
                        doc.content, 
                        doc.metadata or {}
                    )
                    logger.info(f"Added document to session {session_id}: {doc.metadata.get('fileName', 'Unnamed document') if doc.metadata else 'Unnamed document'}")
        elif request.document_content:
            # Legacy single document format
            document_metadata = request.document_metadata or {}
            
            # Ensure metadata includes filename and type if available
            if "fileName" not in document_metadata and request.file_name:
                document_metadata["fileName"] = request.file_name
            if "fileType" not in document_metadata and request.file_type:
                document_metadata["fileType"] = request.file_type
                
            self.session_manager.add_document(
                session_id, 
                request.document_content, 
                document_metadata
            )
            
            logger.info(f"Added document to session {session_id}: {document_metadata.get('fileName', 'Unnamed document')}")
        
        # Get message history
        history = self.session_manager.get_message_history(session_id)
        
        # Get all documents for this session
        session_documents = self.session_manager.get_documents(session_id)
        
        # Build query with conversation history for vector context
        recent_messages = history[-5:] if len(history) > 5 else history
        full_query = " ".join([msg["user"] for msg in recent_messages] + [user_message])
        vector_context, metadata = self.vector_store.retrieve_relevant_context(full_query)
        
        # Get hospital document content
        cached_content, document_text, hospital_info_available = self.document_cache.get_document_content()
        
        # Check for missing information in hospital document
        hospital_document_warnings = ""
        if hospital_info_available:
            hospital_document_warnings = self.document_cache.check_hospital_document_completeness(document_text)
        
        # Format document context section - no truncation or prioritization
        document_context = ""
        if session_documents:
            document_context += "\nUploaded Document Context:\n"
            
            for i, doc in enumerate(session_documents, 1):
                doc_name = doc.get("metadata", {}).get("fileName", f"Document {i}")
                doc_type = doc.get("metadata", {}).get("fileType", "Unknown type")
                
                document_context += f"--- DOCUMENT {i}: {doc_name} ({doc_type}) ---\n"
                document_context += doc["content"]
                document_context += f"\n--- END OF DOCUMENT {i} ---\n\n"
        else:
            document_context = "\nNo documents have been uploaded in this session.\n"
        
        # Hospital info status note for the prompt
        hospital_availability_note = ""
        if not hospital_info_available:
            hospital_availability_note = """
IMPORTANT: Hospital specific information is currently unavailable. You cannot provide any specific details about:
- Hospital ward locations or names
- Specific doctor names or schedules
- Hospital department locations or hours
- Hospital facilities or their locations
- Hospital directions or navigation instructions

If the user asks about any hospital-specific information:
1. Clearly explain that you currently don't have access to specific hospital information
2. Suggest that they contact the hospital's main reception desk for the most accurate information
3. Provide general guidance if possible (e.g., "Most hospitals have neurology departments that operate during standard business hours")
4. NEVER use phrases like "[Insert appropriate timings]" or "[Add specific location]"
5. NEVER leave placeholders or template text in your responses
"""

        # Build prompt with updated document context
        system_prompt = f"""
You are a concise nurse assistant, assisting patients with empathy and efficiency. 

CRITICAL INSTRUCTION: NEVER use placeholder text like "[Insert X]" or "[Specify Y]" in your responses.
If you don't know specific information, provide a helpful alternative instead.

Follow these guidelines:

Key Communication Guidelines:
- Keep responses concise (3-5 sentences total) using short sentences or bullet points when appropriate
- Use professional medical terminology
- Focus on essential information, prioritizing critical symptoms
- Ask direct, specific follow-up questions to clarify symptoms
- Avoid unnecessary explanations or definitive diagnoses
- Recommend seeing a specialist when appropriate
- Use a professional but warm tone; show empathy through phrases like "I understand this must be difficult" but remain focused and efficient
- Do not book appointments, instead suggest contacting the reception for scheduling if you don't have specific timings

{hospital_availability_note}

Handling Missing Information:
- If asked about specialist availability that isn't specified in the hospital document, say: "I recommend contacting the hospital reception to inquire about specialist availability."
- If asked about department locations not listed in the hospital document, say: "You can ask at the reception desk for directions to this department."
- If asked about services or facilities not mentioned, say: "Please check with the hospital's information desk for details about this service."
- NEVER make up information when specific details aren't available
- ALWAYS provide a useful alternative rather than leaving information gaps

Multiple Document Handling:
- You'll be provided with potentially multiple uploaded documents
- Use your judgment to focus on documents most relevant to the current question
- If a question clearly relates to a specific document, prioritize that document
- You don't need to reference all documents in each response, only the relevant ones
- For follow-up questions, maintain context from the previous conversation

Response Format:
- Use plain text only - no formatting, no markdown, no HTML
- Summarize symptoms quickly
- Suggest potential conditions briefly (if relevant)
- Recommend immediate actions if urgent
- Provide hospital directions when asked
- When providing links, include the full URL (e.g., https://www.nhs.uk/conditions/common-cold/)
- If no links are found, respond with "NHS probably has no links for this topic."
- If hospital document warnings are present, incorporate relevant warnings into your response when discussing hospital services

Sensitive Topics:
- For mental health concerns, respond with extra empathy and emphasize professional help
- For sensitive physical conditions, maintain clinical professionalism without judgment
- For end-of-life or serious diagnosis questions, acknowledge emotional impact while providing factual information

Medical Disclaimer:
- When discussing specific medical conditions, briefly note that your responses don't substitute for professional medical advice and diagnosis

Information Priority (highest to lowest):
1. Uploaded patient documents specific to current query
2. Hospital document information for facility-specific questions
3. Medical context from vector store for general medical questions
4. General medical knowledge when no specific context is available

Medical Context (from vector store):
{vector_context if vector_context else "No medical context available."}

Hospital Document (for hospital-related questions and directions):
{document_text if hospital_info_available and not cached_content else "[Using cached hospital document for hospital-related information and directions.]" if hospital_info_available else 
"Hospital specific information is currently unavailable."}

{hospital_document_warnings}

{document_context}
"""
        # Add conversation history to the prompt
        conversation_history = ""
        if history:
            conversation_history = "\nConversation History:\n"
            for msg in history:
                conversation_history += f"User: {msg['user']}\nAssistant: {msg['ai']}\n"
        
        # Add current query
        system_prompt += f"{conversation_history}\nUser: {user_message}\n"
        
        # Generate response with Gemini
        try:
            model = genai.GenerativeModel("gemini-2.5-pro-preview-05-06")
            
            if cached_content and hospital_info_available:
                response = model.generate_content(
                    contents=[{"role": "user", "parts": [{"text": system_prompt}]}],
                    cached_content=cached_content.name
                )
            else:
                response = model.generate_content(
                    contents=[{"role": "user", "parts": [{"text": system_prompt}]}]
                )
                
            ai_response = response.text if hasattr(response, 'text') else ''.join(
                part.text for part in response.candidates[0].content.parts if hasattr(part, 'text')
            )
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Response generation failed: {str(e)}")
        
        # Store exchange in session history
        self.session_manager.add_message_exchange(session_id, user_message, ai_response)
        
        # Return response with document count
        return ChatResponse(
            response=ai_response, 
            references=metadata,
            document_count=len(session_documents)
        )
