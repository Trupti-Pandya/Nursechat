import os
import uuid
import tiktoken
import time
import json
import logging
import numpy as np
import re
from tqdm import tqdm
from typing import List, Dict, Tuple, Optional
from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv
# import scispacy  # Commented out spacy imports
# import spacy

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("embeddings_process.log"),
        logging.StreamHandler()
    ]
)

# ----- Configuration Module -----

class Config:
    """Configuration settings for the embedding pipeline"""
    
    def __init__(self):
        # Load environment variables
        load_dotenv()
        
        # Environment variables
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_API_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        
        # Model settings
        self.model_name = "text-embedding-ada-002"
        self.max_tokens = 8192  # Token limit for text-embedding-ada-002
        self.chunk_token_limit = 7500  # Slightly less than max to account for padding
        
        # Processing settings
        self.batch_size = 50  # Number of embeddings to process in a batch
        self.max_retries = 3  # Maximum number of retries for failed API calls
        
        # Validate environment variables
        if not all([self.supabase_url, self.supabase_key, self.openai_api_key]):
            logging.error("Missing required environment variables. Please check your .env file.")
            raise ValueError("Missing required environment variables")

# ----- Clients Module -----

class Clients:
    """API clients for external services"""
    
    def __init__(self, config: Config):
        # Initialize Supabase client
        self.supabase: Client = create_client(config.supabase_url, config.supabase_key)
        
        # Initialize OpenAI client
        self.openai = OpenAI(api_key=config.openai_api_key)
        
        # Initialize tiktoken encoder for the specified model
        self.encoding = tiktoken.encoding_for_model(config.model_name)

# ----- Statistics Module -----

class Stats:
    """Track statistics during the embedding process"""
    
    def __init__(self):
        self.data = {
            "total_documents": 0,
            "total_chunks": 0,
            "successful_embeddings": 0,
            "failed_embeddings": 0,
            "empty_documents": 0,
            "failed_documents": [],
            "retry_success": 0
        }
    
    def update(self, stat_name: str, increment: int = 1):
        """Update a numeric statistic by the given increment"""
        if stat_name in self.data and isinstance(self.data[stat_name], int):
            self.data[stat_name] += increment
    
    def add_failed_document(self, doc_id: str):
        """Add a document ID to the failed documents list"""
        if doc_id not in self.data["failed_documents"]:
            self.data["failed_documents"].append(doc_id)
    
    def log_summary(self):
        """Log a summary of all statistics"""
        logging.info("\n" + "="*50)
        logging.info("PROCESSING COMPLETE")
        logging.info("="*50)
        logging.info(f"Total documents: {self.data['total_documents']}")
        logging.info(f"Empty documents: {self.data['empty_documents']}")
        logging.info(f"Total chunks generated: {self.data['total_chunks']}")
        logging.info(f"Successful embeddings: {self.data['successful_embeddings']}")
        logging.info(f"Failed embeddings: {self.data['failed_embeddings']}")
        logging.info(f"Retry successes: {self.data['retry_success']}")
        
        # Calculate success rates
        success_rate = (self.data['successful_embeddings'] / self.data['total_chunks']) * 100 if self.data['total_chunks'] > 0 else 0
        document_success_rate = ((self.data['total_documents'] - len(self.data['failed_documents'])) / self.data['total_documents']) * 100 if self.data['total_documents'] > 0 else 0
        
        logging.info(f"Embedding success rate: {success_rate:.2f}%")
        logging.info(f"Document success rate: {document_success_rate:.2f}%")
        
        # Save failed document IDs if any
        if self.data['failed_documents']:
            logging.info(f"Failed document count: {len(self.data['failed_documents'])}")
            with open("failed_documents.json", "w") as f:
                json.dump(self.data['failed_documents'], f)
            logging.info("Failed document IDs saved to failed_documents.json")

# ----- Text Chunking Module -----

class TextChunker:
    """Split large text documents into smaller chunks for embedding"""
    
    def __init__(self, clients: Clients, config: Config, stats: Stats):
        self.encoding = clients.encoding
        self.max_tokens = config.chunk_token_limit
        self.stats = stats
    
    def chunk_markdown(self, markdown: str, doc_id: str) -> List[str]:
        """
        Split markdown content into chunks that are under the max token limit.
        Uses tiktoken to count tokens accurately.
        """
        if not markdown or not markdown.strip():
            logging.warning(f"Document ID {doc_id} has empty content, skipping")
            self.stats.update("empty_documents")
            return []

        try:
            # Encode the entire markdown to get tokens
            tokens = self.encoding.encode(markdown)
            total_tokens = len(tokens)
            logging.info(f"Document ID {doc_id} has {total_tokens} tokens")

            if total_tokens <= self.max_tokens:
                return [markdown]  # No chunking needed if under the limit

            return self._split_into_chunks(markdown, doc_id)
            
        except Exception as e:
            logging.error(f"Error chunking markdown for document ID {doc_id}: {e}")
            return []
    
    def _split_into_chunks(self, markdown: str, doc_id: str) -> List[str]:
        """Internal method to split text into chunks based on paragraphs"""
        # Split by paragraphs for natural boundaries
        paragraphs = markdown.split("\n\n")
        chunks = []
        current_chunk = []
        current_tokens = 0

        for paragraph in paragraphs:
            if not paragraph.strip():
                continue  # Skip empty paragraphs

            paragraph_tokens = len(self.encoding.encode(paragraph))

            if current_tokens + paragraph_tokens > self.max_tokens:
                # Save the current chunk if it exists
                if current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                    current_chunk = [paragraph]
                    current_tokens = paragraph_tokens
                else:
                    # If a single paragraph is too long, split it into smaller pieces
                    chunks.extend(self._split_paragraph(paragraph))
            else:
                current_chunk.append(paragraph)
                current_tokens += paragraph_tokens

        # Add the last chunk if it exists
        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        # Validate and finalize chunks
        valid_chunks = self._validate_chunks(chunks, doc_id)
        
        return valid_chunks
    
    def _split_paragraph(self, paragraph: str) -> List[str]:
        """Split an oversized paragraph into word-based chunks"""
        words = paragraph.split()
        sub_chunk = []
        sub_tokens = 0
        chunks = []
        
        for word in words:
            word_tokens = len(self.encoding.encode(word))
            if sub_tokens + word_tokens > self.max_tokens:
                if sub_chunk:
                    chunks.append(" ".join(sub_chunk))
                sub_chunk = [word]
                sub_tokens = word_tokens
            else:
                sub_chunk.append(word)
                sub_tokens += word_tokens
                
        if sub_chunk:
            chunks.append(" ".join(sub_chunk))
            
        return chunks
    
    def _validate_chunks(self, chunks: List[str], doc_id: str) -> List[str]:
        """Validate all chunks are within token limit and further split if needed"""
        valid_chunks = []
        
        for chunk in chunks:
            chunk_tokens = len(self.encoding.encode(chunk))
            if chunk_tokens <= self.max_tokens:
                valid_chunks.append(chunk)
            else:
                logging.warning(f"Chunk with {chunk_tokens} tokens exceeds limit and will be split further")
                # Split the oversized chunk further
                valid_chunks.extend(self._split_paragraph(chunk))

        # Final validation check
        for i, chunk in enumerate(valid_chunks):
            chunk_tokens = len(self.encoding.encode(chunk))
            if chunk_tokens > self.max_tokens:
                logging.error(f"Chunk {i} still exceeds token limit with {chunk_tokens} tokens")

        logging.info(f"Document ID {doc_id} split into {len(valid_chunks)} chunks")
        return valid_chunks

# ----- Embedding Module -----

class EmbeddingService:
    """Generate and manage embeddings using the OpenAI API"""
    
    def __init__(self, clients: Clients, config: Config, stats: Stats):
        self.openai = clients.openai
        self.encoding = clients.encoding
        self.max_tokens = config.max_tokens
        self.max_retries = config.max_retries
        self.model_name = config.model_name
        self.stats = stats
    
    def normalize_embedding(self, embedding: List[float]) -> List[float]:
        """Normalize the embedding to unit length for accurate cosine similarity"""
        norm = np.linalg.norm(embedding)
        if norm == 0:
            return embedding
        return (np.array(embedding) / norm).tolist()
    
    def generate_embedding(self, text: str, retry_count: int = 0) -> Optional[List[float]]:
        """Generate embedding with retry mechanism and exponential backoff"""
        if not text or not text.strip():
            logging.warning("Empty text provided for embedding")
            return None
            
        # Double-check token count before sending to OpenAI
        token_count = len(self.encoding.encode(text))
        if token_count > self.max_tokens:
            logging.error(f"Text exceeds token limit of {self.max_tokens}: {token_count} tokens")
            return None
        
        try:
            response = self.openai.embeddings.create(
                model=self.model_name,
                input=text
            )
            embedding = response.data[0].embedding
            return self.normalize_embedding(embedding)
        except Exception as e:
            if retry_count < self.max_retries:
                # Exponential backoff
                wait_time = 2 ** retry_count
                logging.warning(f"Error generating embedding, retrying in {wait_time}s: {str(e)}")
                time.sleep(wait_time)
                result = self.generate_embedding(text, retry_count + 1)
                if result is not None:
                    self.stats.update("retry_success")
                return result
            else:
                logging.error(f"Failed to generate embedding after {self.max_retries} attempts: {str(e)}")
                return None

# ----- Database Module -----

class DatabaseService:
    """Handle database operations for document processing and embedding storage"""
    
    def __init__(self, clients: Clients, config: Config, stats: Stats):
        self.supabase = clients.supabase
        self.max_retries = config.max_retries
        self.stats = stats
    
    def fetch_markdown_data(self, page_size: int = 500, page: int = 0) -> Tuple[List[Dict], int]:
        """
        Fetch data from knowledge_base table with pagination
        Returns: (data, total_count)
        """
        try:
            # First get the total count
            count_response = self.supabase.table("knowledge_base").select("id", count="exact").execute()
            total_count = count_response.count if hasattr(count_response, 'count') else 0
            
            # Then fetch the page
            response = self.supabase.table("knowledge_base").select("*").range(
                page * page_size, (page + 1) * page_size - 1
            ).execute()
            
            logging.info(f"Fetched {len(response.data)} markdown entries for page {page}")
            return response.data, total_count
        except Exception as e:
            logging.error(f"Error fetching data from Supabase: {str(e)}")
            return [], 0

    def store_embeddings_batch(self, embeddings_batch: List[Dict], retry_count: int = 0) -> Tuple[int, Optional[str]]:
        """
        Store multiple embeddings in a single transaction with retry mechanism
        Returns: (success_count, error_message)
        """
        if not embeddings_batch:
            return 0, None
            
        try:
            response = self.supabase.table("embeddings").insert(embeddings_batch).execute()
            if response.data:
                return len(response.data), None
            else:
                return 0, "No data returned from insert operation"
        except Exception as e:
            if retry_count < self.max_retries:
                wait_time = 2 ** retry_count
                logging.warning(f"Error storing embeddings batch, retrying in {wait_time}s: {str(e)}")
                time.sleep(wait_time)
                return self.store_embeddings_batch(embeddings_batch, retry_count + 1)
            else:
                error_msg = str(e)
                logging.error(f"Error storing embeddings batch after {self.max_retries} attempts: {error_msg}")
                return 0, error_msg

    def check_if_document_processed(self, doc_id: str) -> bool:
        """Check if a document has already been processed by checking if any chunks exist"""
        try:
            response = self.supabase.table("embeddings").select(
                "id"
            ).eq("metadata->>document_id", doc_id).limit(1).execute()
            
            return len(response.data) > 0
        except Exception as e:
            logging.error(f"Error checking if document was processed: {str(e)}")
            return False

    def count_embeddings(self) -> Optional[int]:
        """Count total embeddings in the database"""
        try:
            response = self.supabase.table("embeddings").select("id", count="exact").execute()
            return response.count if hasattr(response, 'count') else None
        except Exception as e:
            logging.error(f"Error counting embeddings: {e}")
            return None

# ----- Document Processing Module -----

class DocumentProcessor:
    """Process documents and generate embeddings"""
    
    def __init__(self, 
                 text_chunker: TextChunker,
                 embedding_service: EmbeddingService,
                 db_service: DatabaseService,
                 stats: Stats):
        self.text_chunker = text_chunker
        self.embedding_service = embedding_service
        self.db_service = db_service
        self.stats = stats
        # Commented out spacy model loading
        # self.nlp = spacy.load("en_ner_bc5cdr_md")
    
    def extract_keywords(self, text: str) -> str:
        """Extract medical entities using simple keyword matching instead of spacy"""
        # Simplified keyword extraction without spacy
        text = text.lower()
        keywords = []
        common_medical_terms = ["disease", "pain", "infection", "syndrome", "disorder", "treatment", "medication"]
        for term in common_medical_terms:
            if term in text:
                keywords.append(term)
        return ", ".join(keywords) if keywords else "no entities"
    
    def process_document(self, doc_data: Dict) -> List[Dict]:
        """Process a single document and return embeddings to be inserted"""
        doc_id = doc_data["id"]
        markdown_content = doc_data.get("markdown", "")
        url = doc_data.get("url", "")
        sub_links = doc_data.get("sub_links", "")
        title = doc_data.get("title", "")
        
        # Skip if already processed
        if self.db_service.check_if_document_processed(doc_id):
            logging.info(f"Document ID {doc_id} already processed, skipping")
            return []
        
        # Skip if empty content
        if not markdown_content or len(markdown_content.strip()) < 10:
            logging.warning(f"Document ID {doc_id} has insufficient content, skipping")
            self.stats.update("empty_documents")
            return []
        
        # Chunk the markdown content
        chunks = self.text_chunker.chunk_markdown(markdown_content, doc_id)
        if not chunks:
            return []
                
        self.stats.update("total_chunks", len(chunks))
        
        # Process each chunk and prepare for insertion
        return self._process_chunks(chunks, doc_id, title, url, sub_links)
    
    def _process_chunks(self, chunks: List[str], doc_id: str, title: str, url: str, sub_links: str) -> List[Dict]:
        """Process individual chunks and generate embeddings"""
        embeddings_to_insert = []
        
        for chunk_index, chunk in enumerate(chunks):
            chunk_tokens = len(self.embedding_service.encoding.encode(chunk))
            logging.info(f"Chunk {chunk_index} of document ID {doc_id} has {chunk_tokens} tokens")

            # Generate embedding
            embedding = self.embedding_service.generate_embedding(chunk)
            if embedding is None:
                self.stats.update("failed_embeddings")
                self.stats.add_failed_document(doc_id)
                continue
                
            # Generate a unique UUID for this chunk
            chunk_id = str(uuid.uuid4())
            
            # Extract section titles from markdown
            section_titles = self._extract_section_titles(chunk)
            section_summary = "; ".join(section_titles) if section_titles else "No headings found"
            
            # Extract keywords using SciSpaCy NER
            keywords = self.extract_keywords(chunk)
            
            # Prepare metadata
            metadata = {
                "document_id": doc_id,
                "chunk_index": chunk_index,
                "title": title,
                "url": url,
                "sub_links": sub_links,
                "token_count": chunk_tokens,
                "chunk_text": chunk[:200],  # Store first 200 chars for debugging only
                "section_titles": section_summary[:500],  # Limit section summary length
                "keywords": keywords  # Add keywords for filtering
            }
            
            # Add to batch
            embeddings_to_insert.append({
                "id": chunk_id,
                "embedding": embedding,
                "metadata": metadata
            })
            
            self.stats.update("successful_embeddings")
        
        return embeddings_to_insert
        
    def _extract_section_titles(self, markdown_text: str) -> List[str]:
        """Extract section titles (headings) from markdown text"""
        titles = []
        
        # Match markdown headings (# Title, ## Title, etc.)
        heading_pattern = re.compile(r'^(#{1,6})\s+(.+?)$', re.MULTILINE)
        
        for match in heading_pattern.finditer(markdown_text):
            heading_level = len(match.group(1))
            heading_text = match.group(2).strip()
            
            # Skip if heading is empty
            if not heading_text:
                continue
                
            # Add heading to list with level indicator (H1, H2, etc.) instead of "#" characters
            titles.append(f"H{heading_level}: {heading_text}")
            
            # Limit number of headings to avoid overly large metadata
            if len(titles) >= 10:
                titles.append("...")
                break
                
        return titles

# ----- Pipeline Orchestrator -----

class EmbeddingPipeline:
    """Orchestrate the entire embedding process"""
    
    def __init__(self):
        # Initialize configuration and dependencies
        self.config = Config()
        self.stats = Stats()
        self.clients = Clients(self.config)
        
        # Initialize services
        self.text_chunker = TextChunker(self.clients, self.config, self.stats)
        self.embedding_service = EmbeddingService(self.clients, self.config, self.stats)
        self.db_service = DatabaseService(self.clients, self.config, self.stats)
        self.document_processor = DocumentProcessor(
            self.text_chunker,
            self.embedding_service,
            self.db_service,
            self.stats
        )
    
    def run(self):
        """Run the embedding pipeline"""
        page_size = 50
        page = 0
        total_processed = 0
        
        # Fetch total count for progress tracking
        _, total_count = self.db_service.fetch_markdown_data(page_size=1)
        self.stats.data["total_documents"] = total_count
        logging.info(f"Found {total_count} total documents to process")
        
        # Use tqdm for progress tracking
        progress_bar = tqdm(total=total_count, desc="Processing documents")
        
        while True:
            # Fetch a page of documents
            data, _ = self.db_service.fetch_markdown_data(page_size=page_size, page=page)
            if not data:
                break
                
            # Process documents and collect embeddings
            all_embeddings = []
            
            for doc_data in data:
                embeddings = self.document_processor.process_document(doc_data)
                all_embeddings.extend(embeddings)
                
                # Update progress
                total_processed += 1
                progress_bar.update(1)
                
                # Store in batches to reduce API calls
                if len(all_embeddings) >= self.config.batch_size:
                    success_count, _ = self.db_service.store_embeddings_batch(all_embeddings)
                    logging.info(f"Stored {success_count} embeddings")
                    all_embeddings = []
            
            # Store any remaining embeddings
            if all_embeddings:
                success_count, _ = self.db_service.store_embeddings_batch(all_embeddings)
                logging.info(f"Stored {success_count} embeddings")
            
            # Move to next page
            page += 1
            
            # Log progress
            logging.info(f"Processed {total_processed}/{total_count} documents " +
                       f"({(total_processed/total_count)*100:.2f}%)")
        
        progress_bar.close()
        
        # Generate final report
        self.stats.log_summary()
        
        # Verify the number of embeddings in the table
        embedding_count = self.db_service.count_embeddings()
        if embedding_count is not None:
            print(f"Total entries in embeddings table: {embedding_count}")
            logging.info(f"Total entries in embeddings table: {embedding_count}")

# ----- Public API Function -----

def vectorMain():
    """Main entry point for the embedding pipeline"""
    pipeline = EmbeddingPipeline()
    pipeline.run()
    return {"status": "completed", "message": "Vector embedding process completed successfully"}
