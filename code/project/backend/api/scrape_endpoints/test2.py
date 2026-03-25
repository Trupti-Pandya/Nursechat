import os
import logging
import numpy as np
from typing import List, Dict, Optional
from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv
import time

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("retrieval_test_pure_rag.log"),
        logging.StreamHandler()
    ]
)

# ----- Configuration Module -----

class Config:
    """Configuration settings for the retrieval testing"""
    
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

# ----- Embedding Module -----

class EmbeddingService:
    """Generate embeddings using the OpenAI API"""
    
    def __init__(self, clients: Clients, config: Config):
        self.openai = clients.openai
        self.max_tokens = config.max_tokens
        self.model_name = config.model_name
        self.max_retries = 3
    
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
        import tiktoken
        encoding = tiktoken.encoding_for_model(self.model_name)
        token_count = len(encoding.encode(text))
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
                return self.generate_embedding(text, retry_count + 1)
            else:
                logging.error(f"Failed to generate embedding after {self.max_retries} attempts: {str(e)}")
                return None

# ----- Search Module -----

class PureRAGSearchService:
    """Search for similar documents using vector similarity without filters"""
    
    def __init__(self, clients: Clients, embedding_service: EmbeddingService):
        self.supabase = clients.supabase
        self.embedding_service = embedding_service
    
    def find_similar_documents_pure_rag(self, query_text: str, limit: int = 5) -> List[Dict]:
        """Query the vector store for similar embeddings using Supabase RPC (pure RAG)"""
        # Generate embedding for the query text
        query_embedding = self.embedding_service.generate_embedding(query_text)
        if not query_embedding:
            logging.error("Failed to generate embedding for query")
            return []

        # Call the custom RPC function to perform the vector similarity search (pure RAG)
        try:
            response = self.supabase.rpc(
                "find_similar_embeddings_pure_rag",
                {
                    "query_embedding": query_embedding,
                    "min_similarity": 0.7,
                    "result_limit": limit * 2  # Fetch more results to allow for deduplication
                }
            ).execute()
        except Exception as e:
            logging.error(f"Error querying similar embeddings (pure RAG): {str(e)}")
            return []

        if not response.data:
            logging.info("No similar documents found or an error occurred (pure RAG).")
            return []

        return self._process_search_results(response.data, query_text, limit)
    
    def _process_search_results(self, results: List[Dict], query_text: str, limit: int) -> List[Dict]:
        """Process and format search results"""
        # Group results by original document ID
        results_by_doc: Dict[str, List[Dict]] = {}
        for result in results:
            doc_id = result["metadata"]["document_id"]
            if doc_id not in results_by_doc:
                results_by_doc[doc_id] = []
            results_by_doc[doc_id].append({
                "chunk_id": result["id"],
                "similarity": result["similarity"],
                "metadata": result["metadata"]
            })

        # Sort chunks for each document by similarity and take the top chunk
        final_results = []
        for doc_id, chunks in results_by_doc.items():
            best_chunk = max(chunks, key=lambda x: x["similarity"])
            final_results.append(best_chunk)

        # Sort final results by similarity and limit to the requested number
        final_results = sorted(final_results, key=lambda x: x["similarity"], reverse=True)[:limit]

        # Log and print the results
        self._log_search_results(final_results, query_text)
        
        return final_results
    
    def _log_search_results(self, results: List[Dict], query_text: str):
        """Log search results for debugging"""
        print(f"Found {len(results)} similar documents for query (pure RAG): '{query_text}'")
        logging.info(f"Found {len(results)} similar documents for query (pure RAG): '{query_text}'")
        for result in results:
            print(f"Document ID: {result['metadata']['document_id']}")
            print(f"Chunk Index: {result['metadata']['chunk_index']}")
            print(f"Similarity: {result['similarity']:.4f}")
            print(f"Metadata: {result['metadata']}")
            print("-" * 50)
            logging.info(f"Document ID: {result['metadata']['document_id']}")
            logging.info(f"Chunk Index: {result['metadata']['chunk_index']}")
            logging.info(f"Similarity: {result['similarity']:.4f}")

# ----- Retrieval Tester -----

class PureRAGRetrievalTester:
    """Test retrieval from the vector store using pure RAG (no filters)"""
    
    def __init__(self):
        # Initialize configuration and dependencies
        self.config = Config()
        self.clients = Clients(self.config)
        
        # Initialize services
        self.embedding_service = EmbeddingService(self.clients, self.config)
        self.search_service = PureRAGSearchService(self.clients, self.embedding_service)
    
    def run_tests(self):
        """Run test search queries using pure RAG"""
        test_queries = [
            {"query": "I have a bad stomach ache and feel like throwing up"},
            {"query": "I’ve been having chest pain and shortness of breath"},
            {"query": "What is Von Willebrand disease?"},
            {"query": "I have a rash and fever, what could it be?"}
        ]
        
        for test in test_queries:
            query_text = test["query"]
            print(f"\nSearching for documents similar to (pure RAG): '{query_text}'")
            logging.info(f"\nSearching for documents similar to (pure RAG): '{query_text}'")
            self.search_service.find_similar_documents_pure_rag(
                query_text,
                limit=3
            )

# ----- Main Function -----

def test_retrieval_pure_rag():
    """Main entry point for pure RAG retrieval testing"""
    tester = PureRAGRetrievalTester()
    tester.run_tests()
    return {"status": "completed", "message": "Pure RAG retrieval testing completed successfully"}
