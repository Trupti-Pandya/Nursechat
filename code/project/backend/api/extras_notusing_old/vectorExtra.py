# import uuid
# import tiktoken
# from supabase import create_client, Client
# from openai import OpenAI
# import numpy as np
# from typing import List, Dict
# from dotenv import load_dotenv
# import os

# load_dotenv()

# # Step 1: Set up environment variables and clients

# SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_KEY = os.getenv("SUPABASE_API_KEY")
# OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


# # Initialize Supabase client
# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# # Initialize OpenAI client
# openai_client = OpenAI(api_key=OPENAI_API_KEY)

# # Initialize tiktoken encoder for text-embedding-ada-002
# encoding = tiktoken.encoding_for_model("text-embedding-ada-002")
# MAX_TOKENS = 8192  # Token limit for text-embedding-ada-002
# CHUNK_TOKEN_LIMIT = 7500  # Slightly less than the max to account for padding

# # Step 2: Chunk the markdown content based on token count
# def chunk_markdown(markdown: str, max_tokens: int = CHUNK_TOKEN_LIMIT) -> List[str]:
#     """
#     Split markdown content into chunks that are under the max token limit.
#     Uses tiktoken to count tokens accurately.
#     """
#     # Encode the entire markdown to get tokens
#     tokens = encoding.encode(markdown)
#     total_tokens = len(tokens)

#     if total_tokens <= max_tokens:
#         return [markdown]  # No chunking needed if under the limit

#     # Split by paragraphs for natural boundaries
#     paragraphs = markdown.split("\n\n")
#     chunks = []
#     current_chunk = []
#     current_tokens = 0

#     for paragraph in paragraphs:
#         paragraph_tokens = len(encoding.encode(paragraph))

#         if current_tokens + paragraph_tokens > max_tokens:
#             # Save the current chunk if it exists
#             if current_chunk:
#                 chunks.append("\n\n".join(current_chunk))
#                 current_chunk = [paragraph]
#                 current_tokens = paragraph_tokens
#             else:
#                 # If a single paragraph is too long, split it into smaller pieces
#                 words = paragraph.split()
#                 sub_chunk = []
#                 sub_tokens = 0
#                 for word in words:
#                     word_tokens = len(encoding.encode(word))
#                     if sub_tokens + word_tokens > max_tokens:
#                         chunks.append(" ".join(sub_chunk))
#                         sub_chunk = [word]
#                         sub_tokens = word_tokens
#                     else:
#                         sub_chunk.append(word)
#                         sub_tokens += word_tokens
#                 if sub_chunk:
#                     chunks.append(" ".join(sub_chunk))
#         else:
#             current_chunk.append(paragraph)
#             current_tokens += paragraph_tokens

#     # Add the last chunk if it exists
#     if current_chunk:
#         chunks.append("\n\n".join(current_chunk))

#     # Double-check that each chunk is under the token limit
#     final_chunks = []
#     for chunk in chunks:
#         chunk_tokens = len(encoding.encode(chunk))
#         if chunk_tokens > max_tokens:
#             # If a chunk is still too long, split it further
#             words = chunk.split()
#             sub_chunk = []
#             sub_tokens = 0
#             for word in words:
#                 word_tokens = len(encoding.encode(word))
#                 if sub_tokens + word_tokens > max_tokens:
#                     final_chunks.append(" ".join(sub_chunk))
#                     sub_chunk = [word]
#                     sub_tokens = word_tokens
#                 else:
#                     sub_chunk.append(word)
#                     sub_tokens += word_tokens
#             if sub_chunk:
#                 final_chunks.append(" ".join(sub_chunk))
#         else:
#             final_chunks.append(chunk)

#     return final_chunks

# # Step 3: Fetch data from the existing table
# def fetch_markdown_data():
#     response = supabase.table("knowledge_base").select("*").execute()  # Replace "markdown_files" with your actual table name
#     return response.data

# # Step 4: Generate embeddings using OpenAI
# def generate_embedding(text: str):
#     # Double-check token count before sending to OpenAI
#     token_count = len(encoding.encode(text))
#     if token_count > MAX_TOKENS:
#         raise ValueError(f"Text exceeds token limit of {MAX_TOKENS}: {token_count} tokens")
    
#     response = openai_client.embeddings.create(
#         model="text-embedding-ada-002",
#         input=text
#     )
#     embedding = response.data[0].embedding
#     return embedding

# # Step 5: Store embeddings in the new Supabase table
# def store_embedding(chunk_id: str, embedding: list, metadata: dict):
#     embedding_vector = embedding
#     response = supabase.table("embeddings").insert({
#         "id": chunk_id,  # Unique UUID for the chunk
#         "embedding": embedding_vector,
#         "metadata": metadata
#     }).execute()

#     if response.data:
#         print(f"Successfully stored embedding for chunk ID {chunk_id}")
#     else:
#         print(f"Failed to store embedding for chunk ID {chunk_id}: {response.error}")

# # Step 6: Query the vector store for similar embeddings
# def find_similar_documents(query_text: str, limit: int = 5) -> List[Dict]:
#     # Generate embedding for the query text
#     query_embedding = generate_embedding(query_text)

#     # Call the custom PostgreSQL function to find similar embeddings
#     response = supabase.rpc("find_similar_embeddings", {
#         "query_embedding": query_embedding,
#         "limit_count": limit * 2  # Fetch more results to account for multiple chunks per document
#     }).execute()

#     if not response.data:
#         print("No similar documents found or an error occurred.")
#         return []

#     # Group results by original document ID and select the best chunk per document
#     results_by_doc: Dict[str, List[Dict]] = {}
#     for result in response.data:
#         doc_id = result["metadata"]["document_id"]
#         if doc_id not in results_by_doc:
#             results_by_doc[doc_id] = []
#         results_by_doc[doc_id].append({
#             "chunk_id": result["id"],
#             "similarity": result["similarity"],
#             "metadata": result["metadata"]
#         })

#     # Sort chunks for each document by similarity and take the top chunk
#     final_results = []
#     for doc_id, chunks in results_by_doc.items():
#         best_chunk = max(chunks, key=lambda x: x["similarity"])
#         final_results.append(best_chunk)

#     # Sort final results by similarity and limit to the requested number
#     final_results = sorted(final_results, key=lambda x: x["similarity"], reverse=True)[:limit]

#     # Print the results
#     print(f"Found {len(final_results)} similar documents for query: '{query_text}'")
#     for result in final_results:
#         print(f"Document ID: {result['metadata']['document_id']}")
#         print(f"Chunk Index: {result['metadata']['chunk_index']}")
#         print(f"Similarity: {result['similarity']:.4f}")
#         print(f"Metadata: {result['metadata']}")
#         print("-" * 50)

#     return final_results

# # Step 7: Main function to process the data and test similarity search
# def vectorMain():
#     # Step 7.1: Generate and store embeddings
#     print("Fetching markdown data...")
#     markdown_data = fetch_markdown_data()
#     print(f"Fetched {len(markdown_data)} markdown records.")

#     for row in markdown_data:
#         doc_id = row["id"]  # Original document UUID
#         markdown_content = row["markdown"]
#         url = row["url"]
#         sub_links = row["sub_links"]
#         title = row["title"]

#         # Check total token count
#         total_tokens = len(encoding.encode(markdown_content))
#         print(f"Document ID {doc_id} has {total_tokens} tokens.")

#         # Chunk the markdown content
#         chunks = chunk_markdown(markdown_content, max_tokens=CHUNK_TOKEN_LIMIT)
#         print(f"Document ID {doc_id} split into {len(chunks)} chunks.")

#         # Generate and store an embedding for each chunk
#         for chunk_index, chunk in enumerate(chunks):
#             chunk_tokens = len(encoding.encode(chunk))
#             print(f"Chunk {chunk_index} of document ID {doc_id} has {chunk_tokens} tokens.")

#             try:
#                 embedding = generate_embedding(chunk)
#             except Exception as e:
#                 print(f"Error generating embedding for chunk {chunk_index} of document ID {doc_id}: {e}")
#                 continue

#             # Generate a unique UUID for this chunk
#             chunk_id = str(uuid.uuid4())

#             # Prepare metadata for the chunk
#             metadata = {
#                 "document_id": doc_id,  # Reference to the original document
#                 "chunk_index": chunk_index,  # Position of the chunk in the document
#                 "title": title,
#                 "url": url,
#                 "sub_links": sub_links
#             }

#             try:
#                 store_embedding(chunk_id, embedding, metadata)
#             except Exception as e:
#                 print(f"Error storing embedding for chunk {chunk_index} of document ID {doc_id}: {e}")

#     # Step 7.2: Test similarity search with a query
#     query_text = "What is the Alexander technique?"
#     print(f"\nSearching for documents similar to: '{query_text}'")
#     find_similar_documents(query_text, limit=3)



import uuid
import tiktoken
from supabase import create_client, Client
from openai import OpenAI
import numpy as np
from typing import List, Dict, Tuple, Optional
from dotenv import load_dotenv
import os
import logging
import time
from tqdm import tqdm
import json

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("embeddings_process.log"),
        logging.StreamHandler()
    ]
)

# Load environment variables
load_dotenv()

# Step 1: Set up environment variables and clients
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Validate environment variables
if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY]):
    logging.error("Missing required environment variables. Please check your .env file.")
    raise ValueError("Missing required environment variables")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize OpenAI client
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Initialize tiktoken encoder for text-embedding-ada-002
encoding = tiktoken.encoding_for_model("text-embedding-ada-002")
MAX_TOKENS = 8192  # Token limit for text-embedding-ada-002
CHUNK_TOKEN_LIMIT = 7500  # Slightly less than the max to account for padding
BATCH_SIZE = 20  # Number of embeddings to process in a batch
MAX_RETRIES = 3  # Maximum number of retries for failed API calls

# Statistics tracking
stats = {
    "total_documents": 0,
    "total_chunks": 0,
    "successful_embeddings": 0,
    "failed_embeddings": 0,
    "empty_documents": 0,
    "failed_documents": [],
    "retry_success": 0
}

def chunk_markdown(markdown: str, doc_id: str, max_tokens: int = CHUNK_TOKEN_LIMIT) -> List[str]:
    """
    Split markdown content into chunks that are under the max token limit.
    Uses tiktoken to count tokens accurately.
    """
    if not markdown or not markdown.strip():
        logging.warning(f"Document ID {doc_id} has empty content, skipping")
        stats["empty_documents"] += 1
        return []

    # Encode the entire markdown to get tokens
    tokens = encoding.encode(markdown)
    total_tokens = len(tokens)
    logging.info(f"Document ID {doc_id} has {total_tokens} tokens")

    if total_tokens <= max_tokens:
        return [markdown]  # No chunking needed if under the limit

    # Split by paragraphs for natural boundaries
    paragraphs = markdown.split("\n\n")
    chunks = []
    current_chunk = []
    current_tokens = 0

    for paragraph in paragraphs:
        if not paragraph.strip():
            continue  # Skip empty paragraphs
            
        paragraph_tokens = len(encoding.encode(paragraph))

        if current_tokens + paragraph_tokens > max_tokens:
            # Save the current chunk if it exists
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = [paragraph]
                current_tokens = paragraph_tokens
            else:
                # If a single paragraph is too long, split it into smaller pieces
                words = paragraph.split()
                sub_chunk = []
                sub_tokens = 0
                for word in words:
                    word_tokens = len(encoding.encode(word))
                    if sub_tokens + word_tokens > max_tokens:
                        chunks.append(" ".join(sub_chunk))
                        sub_chunk = [word]
                        sub_tokens = word_tokens
                    else:
                        sub_chunk.append(word)
                        sub_tokens += word_tokens
                if sub_chunk:
                    chunks.append(" ".join(sub_chunk))
        else:
            current_chunk.append(paragraph)
            current_tokens += paragraph_tokens

    # Add the last chunk if it exists
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    # Validate all chunks are within token limit
    valid_chunks = []
    for chunk in chunks:
        chunk_tokens = len(encoding.encode(chunk))
        if chunk_tokens <= max_tokens:
            valid_chunks.append(chunk)
        else:
            logging.warning(f"Chunk with {chunk_tokens} tokens exceeds limit and will be split further")
            # Split the oversized chunk further
            words = chunk.split()
            sub_chunk = []
            sub_tokens = 0
            for word in words:
                word_tokens = len(encoding.encode(word))
                if sub_tokens + word_tokens > max_tokens:
                    valid_chunks.append(" ".join(sub_chunk))
                    sub_chunk = [word]
                    sub_tokens = word_tokens
                else:
                    sub_chunk.append(word)
                    sub_tokens += word_tokens
            if sub_chunk:
                valid_chunks.append(" ".join(sub_chunk))

    for i, chunk in enumerate(valid_chunks):
        chunk_tokens = len(encoding.encode(chunk))
        if chunk_tokens > max_tokens:
            logging.error(f"Chunk {i} still exceeds token limit with {chunk_tokens} tokens")

    logging.info(f"Document ID {doc_id} split into {len(valid_chunks)} chunks")
    return valid_chunks

def fetch_markdown_data(page_size: int = 100, page: int = 0) -> Tuple[List[Dict], int]:
    """
    Fetch data from knowledge_base table with pagination
    Returns: (data, total_count)
    """
    try:
        # First get the total count
        count_response = supabase.table("knowledge_base").select("id", count="exact").execute()
        total_count = count_response.count if hasattr(count_response, 'count') else 0
        
        # Then fetch the page
        response = supabase.table("knowledge_base").select("*").range(
            page * page_size, (page + 1) * page_size - 1
        ).execute()
        
        return response.data, total_count
    except Exception as e:
        logging.error(f"Error fetching data from Supabase: {str(e)}")
        return [], 0

def generate_embedding(text: str, retry_count: int = 0) -> Optional[List[float]]:
    """
    Generate embedding with retry mechanism
    """
    if not text or not text.strip():
        logging.warning("Empty text provided for embedding")
        return None
        
    # Double-check token count before sending to OpenAI
    token_count = len(encoding.encode(text))
    if token_count > MAX_TOKENS:
        logging.error(f"Text exceeds token limit of {MAX_TOKENS}: {token_count} tokens")
        return None
    
    try:
        response = openai_client.embeddings.create(
            model="text-embedding-ada-002",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        if retry_count < MAX_RETRIES:
            # Exponential backoff
            wait_time = 2 ** retry_count
            logging.warning(f"Error generating embedding, retrying in {wait_time}s: {str(e)}")
            time.sleep(wait_time)
            result = generate_embedding(text, retry_count + 1)
            if result is not None:
                stats["retry_success"] += 1
            return result
        else:
            logging.error(f"Failed to generate embedding after {MAX_RETRIES} attempts: {str(e)}")
            return None

def store_embeddings_batch(embeddings_batch: List[Dict]) -> Tuple[int, Optional[str]]:
    """
    Store multiple embeddings in a single transaction
    Returns: (success_count, error_message)
    """
    if not embeddings_batch:
        return 0, None
        
    try:
        response = supabase.table("embeddings").insert(embeddings_batch).execute()
        if response.data:
            return len(response.data), None
        else:
            return 0, "No data returned from insert operation"
    except Exception as e:
        error_msg = str(e)
        logging.error(f"Error storing embeddings batch: {error_msg}")
        return 0, error_msg

def check_if_document_processed(doc_id: str) -> bool:
    """
    Check if a document has already been processed by checking if any chunks exist
    """
    try:
        response = supabase.table("embeddings").select(
            "id"
        ).eq("metadata->>document_id", doc_id).limit(1).execute()
        
        return len(response.data) > 0
    except Exception as e:
        logging.error(f"Error checking if document was processed: {str(e)}")
        return False

def find_similar_documents(query_text: str, limit: int = 5) -> List[Dict]:
    """
    Query the vector store for similar embeddings
    """
    # Generate embedding for the query text
    query_embedding = generate_embedding(query_text)
    if not query_embedding:
        logging.error("Failed to generate embedding for query")
        return []

    # Call the custom PostgreSQL function to find similar embeddings
    try:
        response = supabase.rpc("find_similar_embeddings", {
            "query_embedding": query_embedding,
            "limit_count": limit * 2  # Fetch more results to account for multiple chunks per document
        }).execute()
    except Exception as e:
        logging.error(f"Error querying similar embeddings: {str(e)}")
        return []

    if not response.data:
        logging.info("No similar documents found or an error occurred.")
        return []

    # Group results by original document ID and select the best chunk per document
    results_by_doc: Dict[str, List[Dict]] = {}
    for result in response.data:
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

    # Log the results
    logging.info(f"Found {len(final_results)} similar documents for query: '{query_text}'")
    for result in final_results:
        logging.info(f"Document ID: {result['metadata']['document_id']}")
        logging.info(f"Title: {result['metadata']['title']}")
        logging.info(f"Similarity: {result['similarity']:.4f}")

    return final_results

def process_document(doc_data: Dict) -> List[Dict]:
    """
    Process a single document and return embeddings to be inserted
    """
    doc_id = doc_data["id"]
    markdown_content = doc_data.get("markdown", "")
    url = doc_data.get("url", "")
    sub_links = doc_data.get("sub_links", "")
    title = doc_data.get("title", "")
    
    # Skip if already processed
    if check_if_document_processed(doc_id):
        logging.info(f"Document ID {doc_id} already processed, skipping")
        return []
    
    # Skip if empty content
    if not markdown_content or len(markdown_content.strip()) < 10:
        logging.warning(f"Document ID {doc_id} has insufficient content, skipping")
        stats["empty_documents"] += 1
        return []
    
    # Chunk the markdown content
    chunks = chunk_markdown(markdown_content, doc_id, max_tokens=CHUNK_TOKEN_LIMIT)
    if not chunks:
        return []
        
    stats["total_chunks"] += len(chunks)
    
    # Prepare batch for insertion
    embeddings_to_insert = []
    
    # Process each chunk
    for chunk_index, chunk in enumerate(chunks):
        # Generate embedding
        embedding = generate_embedding(chunk)
        if embedding is None:
            stats["failed_embeddings"] += 1
            if doc_id not in stats["failed_documents"]:
                stats["failed_documents"].append(doc_id)
            continue
            
        # Generate a unique UUID for this chunk
        chunk_id = str(uuid.uuid4())
        
        # Prepare metadata
        metadata = {
            "document_id": doc_id,
            "chunk_index": chunk_index,
            "title": title,
            "url": url,
            "sub_links": sub_links,
            "chunk_text": chunk[:200]  # Store first 200 chars for debugging
        }
        
        # Add to batch
        embeddings_to_insert.append({
            "id": chunk_id,
            "embedding": embedding,
            "metadata": metadata
        })
        
        stats["successful_embeddings"] += 1
    
    return embeddings_to_insert

def vectorMain():
    """
    Main function to process all documents
    """
    page_size = 50
    page = 0
    total_processed = 0
    
    # # Create or verify the embeddings table
    # try:
    #     # Check if vector extension is installed
    #     supabase.query("CREATE EXTENSION IF NOT EXISTS vector;").execute()
        
    #     # Create embeddings table if not exists
    #     supabase.query("""
    #     CREATE TABLE IF NOT EXISTS embeddings (
    #         id UUID PRIMARY KEY,
    #         embedding vector(1536),
    #         metadata JSONB
    #     );
    #     """).execute()
        
    #     # Create similarity search function if not exists
    #     supabase.query("""
    #     CREATE OR REPLACE FUNCTION find_similar_embeddings(
    #         query_embedding vector(1536),
    #         limit_count int DEFAULT 10
    #     ) RETURNS TABLE (
    #         id UUID,
    #         similarity float,
    #         metadata JSONB
    #     )
    #     LANGUAGE plpgsql
    #     AS $$
    #     BEGIN
    #         RETURN QUERY
    #         SELECT
    #             embeddings.id,
    #             1 - (embeddings.embedding <=> query_embedding) as similarity,
    #             embeddings.metadata
    #         FROM
    #             embeddings
    #         ORDER BY
    #             embeddings.embedding <=> query_embedding
    #         LIMIT limit_count;
    #     END;
    #     $$;
    #     """).execute()
        
    #     logging.info("Database setup completed successfully")
    # except Exception as e:
    #     logging.error(f"Error setting up database: {str(e)}")
    #     return
    
    # Fetch total count for progress tracking
    _, total_count = fetch_markdown_data(page_size=1)
    stats["total_documents"] = total_count
    logging.info(f"Found {total_count} total documents to process")
    
    # Use tqdm for progress tracking
    progress_bar = tqdm(total=total_count, desc="Processing documents")
    
    while True:
        # Fetch a page of documents
        data, _ = fetch_markdown_data(page_size=page_size, page=page)
        if not data:
            break
            
        # Process documents in batches
        all_embeddings = []
        
        for doc_data in data:
            embeddings = process_document(doc_data)
            all_embeddings.extend(embeddings)
            
            # Update progress
            total_processed += 1
            progress_bar.update(1)
            
            # Store in batches to reduce API calls
            if len(all_embeddings) >= BATCH_SIZE:
                success_count, error = store_embeddings_batch(all_embeddings)
                logging.info(f"Stored {success_count} embeddings")
                all_embeddings = []
        
        # Store any remaining embeddings
        if all_embeddings:
            success_count, error = store_embeddings_batch(all_embeddings)
            logging.info(f"Stored {success_count} embeddings")
        
        # Move to next page
        page += 1
        
        # Log progress
        logging.info(f"Processed {total_processed}/{total_count} documents " +
                   f"({(total_processed/total_count)*100:.2f}%)")
    
    progress_bar.close()
    
    # Generate final report
    logging.info("\n" + "="*50)
    logging.info("PROCESSING COMPLETE")
    logging.info("="*50)
    logging.info(f"Total documents: {stats['total_documents']}")
    logging.info(f"Empty documents: {stats['empty_documents']}")
    logging.info(f"Total chunks generated: {stats['total_chunks']}")
    logging.info(f"Successful embeddings: {stats['successful_embeddings']}")
    logging.info(f"Failed embeddings: {stats['failed_embeddings']}")
    logging.info(f"Retry successes: {stats['retry_success']}")
    
    success_rate = (stats['successful_embeddings'] / stats['total_chunks']) * 100 if stats['total_chunks'] > 0 else 0
    document_success_rate = ((stats['total_documents'] - len(stats['failed_documents'])) / stats['total_documents']) * 100 if stats['total_documents'] > 0 else 0
    
    logging.info(f"Embedding success rate: {success_rate:.2f}%")
    logging.info(f"Document success rate: {document_success_rate:.2f}%")
    
    if stats['failed_documents']:
        logging.info(f"Failed document count: {len(stats['failed_documents'])}")
        # Save failed document IDs to a file for later processing
        with open("failed_documents.json", "w") as f:
            json.dump(stats['failed_documents'], f)
        logging.info("Failed document IDs saved to failed_documents.json")

    # Optional: Test search functionality 
    query_text = "What is the Alexander technique?"
    logging.info(f"\nSearching for documents similar to: '{query_text}'")
    results = find_similar_documents(query_text, limit=3)
    
    for i, result in enumerate(results):
        logging.info(f"\nResult {i+1}:")
        logging.info(f"Title: {result['metadata']['title']}")
        logging.info(f"URL: {result['metadata']['url']}")
        logging.info(f"Similarity: {result['similarity']:.4f}")
    
    return stats
