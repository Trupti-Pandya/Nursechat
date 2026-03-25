# import os
# import time
# import concurrent.futures
# from typing import List, Dict, Any
# from tqdm import tqdm
# from langchain_community.vectorstores import SupabaseVectorStore
# from supabase import create_client, Client
# from langchain_openai import OpenAIEmbeddings
# from langchain.text_splitter import RecursiveCharacterTextSplitter
# from dotenv import load_dotenv

# load_dotenv()

# # Initialize Supabase client
# supabase_url: str = os.getenv("SUPABASE_URL")
# supabase_key: str = os.getenv("SUPABASE_API_KEY")
# supabase: Client = create_client(supabase_url, supabase_key)

# # Initialize OpenAI embeddings with API key
# openai_api_key = os.environ.get("OPENAI_API_KEY")
# embeddings = OpenAIEmbeddings(
#     openai_api_key=openai_api_key,
#     model="text-embedding-3-small",
#     dimensions=1536,  # Explicitly set dimensions
# )

# def fetch_all_markdown_records():
#     """Fetch all markdown records from the knowledge_base table in parallel"""
#     print("Fetching markdown records...")
    
#     all_records = []
#     page_size = 1000
#     start = 0
    
#     # First, count total rows to calculate number of pages
#     count_response = supabase.table("knowledge_base").select("count", count="exact").execute()
#     total_rows = count_response.count if hasattr(count_response, 'count') else 0
    
#     if total_rows == 0:
#         print("No records found in knowledge_base table")
#         return []
    
#     # Calculate number of pages
#     num_pages = (total_rows + page_size - 1) // page_size
#     print(f"Total rows: {total_rows}, fetching in {num_pages} pages")
    
#     # Create page ranges
#     page_ranges = [(i * page_size, min((i + 1) * page_size - 1, total_rows - 1)) for i in range(num_pages)]
    
#     # Function to fetch a single page
#     def fetch_page(page_range):
#         start, end = page_range
#         response = supabase.table("knowledge_base").select("id, markdown").range(start, end).execute()
#         return response.data or []
    
#     # Fetch pages in parallel
#     with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
#         results = list(tqdm(
#             executor.map(fetch_page, page_ranges), 
#             total=len(page_ranges),
#             desc="Fetching pages"
#         ))
    
#     # Combine results
#     for page_data in results:
#         all_records.extend(page_data)
    
#     print(f"Fetched {len(all_records)} markdown records")
#     return all_records

# def split_texts(records: List[Dict[str, Any]]):
#     """Split markdown texts into chunks for better semantic search"""
#     print("Splitting texts into chunks...")
    
#     text_splitter = RecursiveCharacterTextSplitter(
#         chunk_size=1000,
#         chunk_overlap=100,
#         separators=["\n\n", "\n", " ", ""],
#         length_function=len
#     )
    
#     chunks = []
#     metadatas = []
    
#     # Process records in parallel
#     def process_record(record):
#         doc_chunks = text_splitter.split_text(record["markdown"])
#         record_chunks = []
#         record_metadatas = []
        
#         for i, chunk in enumerate(doc_chunks):
#             record_chunks.append(chunk)
#             record_metadatas.append({
#                 "original_id": str(record["id"]),  # Convert to string to handle UUID
#                 "chunk_index": i,
#                 "chunk_count": len(doc_chunks)
#             })
        
#         return record_chunks, record_metadatas
    
#     with concurrent.futures.ThreadPoolExecutor() as executor:
#         results = list(tqdm(
#             executor.map(process_record, records),
#             total=len(records),
#             desc="Splitting texts"
#         ))
    
#     # Combine results
#     for record_chunks, record_metadatas in results:
#         chunks.extend(record_chunks)
#         metadatas.extend(record_metadatas)
    
#     print(f"Created {len(chunks)} chunks from {len(records)} records")
#     return chunks, metadatas

# def process_in_batches(texts: List[str], metadatas:  List[Dict[str, Any]], batch_size: int = 25):
#     """Process texts in batches to handle rate limits and large datasets"""
#     print(f"Processing {len(texts)} chunks in batches of {batch_size}...")
    
#     # Create a custom implementation to add texts to the vector store
#     try:
#         print("Creating vector store...")
        
#         # Initialize embedddings for the first batch to check dimensions
#         sample_texts = texts[:1]
#         sample_embeddings = embeddings.embed_documents(sample_texts)
#         embedding_dim = len(sample_embeddings[0])
#         print(f"Embedding dimensions: {embedding_dim}")
        
#         # Check if table exists, if not create it
#         print("Creating or verifying table structure...")
#         create_table_sql = f"""
#         CREATE TABLE IF NOT EXISTS documents_openai (
#             id BIGSERIAL PRIMARY KEY,
#             content TEXT NOT NULL,
#             metadata JSONB,
#             embedding VECTOR({embedding_dim}) NOT NULL
#         );
        
#         CREATE INDEX IF NOT EXISTS documents_openai_embedding_idx 
#         ON documents_openai USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
#         """
        
#         response = supabase.rpc('exec_sql', {'sql': create_table_sql}).execute()
#         print("Table structure verified/created")
        
#         # Check if function exists, create it if not
#         print("Creating or verifying search function...")
#         create_function_sql = f"""
#         CREATE OR REPLACE FUNCTION match_documents_openai(
#             query_embedding vector({embedding_dim}),
#             match_threshold float,
#             match_count int
#         )
#         RETURNS TABLE (
#             id bigint,
#             content text,
#             metadata jsonb,
#             similarity float
#         )
#         LANGUAGE sql STABLE
#         AS $$
#             SELECT
#                 id,
#                 content,
#                 metadata,
#                 1 - (embedding <=> query_embedding) AS similarity
#             FROM documents_openai
#             WHERE 1 - (embedding <=> query_embedding) > match_threshold
#             ORDER BY similarity DESC
#             LIMIT match_count;
#         $$;
#         """
        
#         response = supabase.rpc('exec_sql', {'sql': create_function_sql}).execute()
#         print("Search function verified/created")
        
#     except Exception as e:
#         print(f"Error setting up database: {str(e)}")
#         print("Falling back to default SupabaseVectorStore implementation")
    
#     vector_store = SupabaseVectorStore(
#         client=supabase,
#         embedding=embeddings,
#         table_name="documents_openai",
#         query_name="match_documents_openai"
#     )
    
#     # Calculate total batches for progress tracking
#     total_batches = (len(texts) + batch_size - 1) // batch_size
#     successful_batches = 0
#     failed_batches = 0
    
#     for i in tqdm(range(0, len(texts), batch_size), total=total_batches, desc="Processing batches"):
#         try:
#             batch_texts = texts[i:i+batch_size]
#             batch_metadatas = metadatas[i:i+batch_size]
            
#             # Log the first batch details for debugging
#             if i == 0:
#                 print(f"Sample text: {batch_texts[0][:100]}...")
#                 print(f"Sample metadata: {batch_metadatas[0]}")
            
#             # Process batch - manual implementation for more control
#             try:
#                 # Get embeddings for the batch
#                 batch_embeddings = embeddings.embed_documents(batch_texts)
                
#                 # Insert directly using Supabase to avoid potential issues with the vector store
#                 for j, (text, metadata, embedding) in enumerate(zip(batch_texts, batch_metadatas, batch_embeddings)):
#                     try:
#                         response = supabase.table("documents_openai").insert({
#                             "content": text,
#                             "metadata": metadata,
#                             "embedding": embedding
#                         }).execute()
#                     except Exception as insert_error:
#                         print(f"Error inserting document {i*batch_size + j}: {str(insert_error)}")
#                         # Try with simplified metadata if complex structure fails
#                         try:
#                             # Simplified metadata with just the chunk index
#                             simple_metadata = {"chunk_index": metadata.get("chunk_index", 0)}
#                             response = supabase.table("documents_openai").insert({
#                                 "content": text,
#                                 "metadata": simple_metadata,
#                                 "embedding": embedding
#                             }).execute()
#                             print(f"Inserted with simplified metadata")
#                         except Exception as simple_insert_error:
#                             print(f"Error with simplified metadata: {str(simple_insert_error)}")
#                             raise
                
#                 successful_batches += 1
#             except Exception as batch_error:
#                 print(f"Error processing batch manually: {str(batch_error)}")
#                 print("Falling back to standard vector store method")
#                 # Fall back to standard method
#                 vector_store.add_texts(batch_texts, metadatas=batch_metadatas)
#                 successful_batches += 1
            
#             # Use a shorter wait time for successful requests
#             time.sleep(0.2)
            
#         except Exception as e:
#             failed_batches += 1
#             print(f"Error processing batch {i//batch_size + 1}/{total_batches}: {str(e)}")
#             print(f"Error type: {type(e).__name__}")
            
#             if str(e) == "{}":
#                 print("Empty APIError received. This could be due to:")
#                 print("1. The 'documents_openai' table might not exist or have incorrect schema")
#                 print("2. The 'match_documents_openai' function might not exist in Supabase")
#                 print("3. The embedding dimensions might not match the expected format")
                
#                 # Skip this batch and continue with the next
#                 continue
            
#             # For rate limits, wait and retry
#             if "rate" in str(e).lower():
#                 print("Rate limit hit, waiting 30 seconds...")
#                 time.sleep(30)
#                 try:
#                     vector_store.add_texts(batch_texts, metadatas=batch_metadatas)
#                     successful_batches += 1
#                     failed_batches -= 1
#                 except Exception as retry_error:
#                     print(f"Retry failed: {str(retry_error)}")
        
#         # Print progress every 10 batches
#         if (i // batch_size) % 10 == 0 and i > 0:
#             print(f"Progress: {i+min(batch_size, len(texts)-i)}/{len(texts)} chunks processed")
#             print(f"Success rate: {successful_batches}/{successful_batches + failed_batches} batches")
    
#     print(f"Completed with {successful_batches} successful batches and {failed_batches} failed batches")
#     return vector_store

# def verify_supabase_connection():
#     """Verify that the Supabase connection is working properly"""
#     try:
#         print("Verifying Supabase connection...")
#         response = supabase.table("knowledge_base").select("id").limit(1).execute()
#         print(f"Supabase connection verified: {response.data is not None}")
#         return True
#     except Exception as e:
#         print(f"Supabase connection error: {str(e)}")
#         print(f"Error type: {type(e).__name__}")
#         return False

# def inspect_database_structure():
#     """Check the database structure to better understand schema issues"""
#     try:
#         print("\n----- Database Structure Inspection -----")
#         # Check knowledge_base table
#         print("Checking knowledge_base table structure...")
#         kb_structure = supabase.rpc('exec_sql', {'sql': "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'knowledge_base';"}).execute()
#         print("Knowledge Base table structure:")
#         if hasattr(kb_structure, 'data'):
#             for col in kb_structure.data:
#                 print(f"  - {col.get('column_name')}: {col.get('data_type')}")
#         else:
#             print("  Could not retrieve structure")
            
#         # Check if documents_openai exists
#         docs_exists = supabase.rpc('exec_sql', {'sql': "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'documents_openai');"}).execute()
#         if hasattr(docs_exists, 'data') and docs_exists.data:
#             print("documents_openai table exists:", docs_exists.data[0].get('exists', False))
#             if docs_exists.data[0].get('exists', False):
#                 docs_structure = supabase.rpc('exec_sql', {'sql': "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documents_openai';"}).execute()
#                 print("Documents table structure:")
#                 if hasattr(docs_structure, 'data'):
#                     for col in docs_structure.data:
#                         print(f"  - {col.get('column_name')}: {col.get('data_type')}")
        
#         print("----------------------------------------\n")
#         return True
#     except Exception as e:
#         print(f"Error inspecting database structure: {str(e)}")
#         return False

# def main():
#     try:
#         start_time = time.time()
        
#         # Verify connection before proceeding
#         if not verify_supabase_connection():
#             print("Aborting due to Supabase connection issues")
#             return
            
#         # Inspect database structure
#         inspect_database_structure()
        
#         print("\nNOTE: This script requires a SQL function named 'match_documents_openai' to be created in your Supabase database.")
#         print("If you're getting empty APIErrors, you may need to create this function. Example SQL:")
#         print("""
# -- Enable the pgvector extension
# CREATE EXTENSION IF NOT EXISTS vector;

# -- Create the documents_openai table with vector column
# CREATE TABLE IF NOT EXISTS documents_openai (
#   id BIGSERIAL PRIMARY KEY,
#   content TEXT NOT NULL,
#   metadata JSONB,
#   embedding VECTOR(1536) NOT NULL
# );

# -- Create a search index for faster similarity searches
# CREATE INDEX IF NOT EXISTS documents_openai_embedding_idx ON documents_openai 
# USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

# -- Create the similarity search function
# CREATE OR REPLACE FUNCTION match_documents_openai(
#   query_embedding vector(1536),
#   match_threshold float,
#   match_count int
# )
# RETURNS TABLE (
#   id bigint,
#   content text,
#   metadata jsonb,
#   similarity float
# )
# LANGUAGE sql STABLE
# AS $$
#   SELECT
#     id,
#     content,
#     metadata,
#     1 - (embedding <=> query_embedding) AS similarity
#   FROM documents_openai
#   WHERE 1 - (embedding <=> query_embedding) > match_threshold
#   ORDER BY similarity DESC
#   LIMIT match_count;
# $$;
#         """)
#         print("----------------------------------------------------------------------------------------\n")
            
#         records = fetch_all_markdown_records()
#         if not records:
#             print("No records found, aborting")
#             return
        
#         # Print sample ID to understand format
#         if len(records) > 0:
#             print(f"Sample record ID: {records[0]['id']} (type: {type(records[0]['id']).__name__})")
#             print(f"Sample record: {records[0]}")
            
#         chunks, metadatas = split_texts(records)
#         # Use a larger batch size for faster processing
#         process_in_batches(chunks, metadatas, batch_size=25)
        
#         elapsed_time = time.time() - start_time
#         print(f"Successfully processed {len(chunks)} chunks from {len(records)} markdown records.")
#         print(f"Total execution time: {elapsed_time:.2f} seconds ({elapsed_time/60:.2f} minutes)")
#     except Exception as e:
#         print(f"An error occurred: {e}")
#         print(f"Error type: {type(e).__name__}")
#         if hasattr(e, 'code'):
#             print(f"Error code: {e.code}")
#         if hasattr(e, 'message'):
#             print(f"Error message: {e.message}")

# if __name__ == "__main__":
#     main()