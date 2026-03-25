import os
from supabase import create_client
import tiktoken
import pandas as pd
from dotenv import load_dotenv  

load_dotenv()

def count_tokens_in_supabase_vector_store(supabase_url, supabase_key, table_name, content_column="content", model="gpt-3.5-turbo"):
    """
    Count the total number of tokens in a Supabase vector store.
    
    Parameters:
    - supabase_url: Your Supabase project URL
    - supabase_key: Your Supabase secret key
    - table_name: The name of the table containing your vector store
    - content_column: The column name that contains the text content
    - model: The model used for tokenization (default: gpt-3.5-turbo)
    
    Returns:
    - total_tokens: Total number of tokens in the vector store
    - document_count: Number of documents in the vector store
    - avg_tokens_per_doc: Average tokens per document
    """
    # Initialize Supabase client
    supabase = create_client(supabase_url, supabase_key)
    
    # Get all rows from the vector store table with pagination
    documents = []
    page_size = 1000
    start = 0
    
    while True:
        response = supabase.table(table_name).select(content_column).range(start, start + page_size - 1).execute()
        
        # Break if no more data
        if not response.data:
            break
            
        # Extract the content from each row
        batch_docs = [item[content_column] for item in response.data if content_column in item]
        documents.extend(batch_docs)
        
        # Break if less than page_size records were returned (last page)
        if len(response.data) < page_size:
            break
            
        # Move to next page
        start += page_size
        
    print(f"Retrieved {len(documents)} documents from Supabase")
    
    # Initialize the tokenizer
    tokenizer = tiktoken.encoding_for_model(model)
    
    # Count tokens for each document
    token_counts = [len(tokenizer.encode(doc)) for doc in documents]
    
    # Calculate statistics
    total_tokens = sum(token_counts)
    document_count = len(documents)
    avg_tokens_per_doc = total_tokens / document_count if document_count > 0 else 0
    
    # Create a summary dataframe
    summary = pd.DataFrame({
        'Metric': ['Total Tokens', 'Document Count', 'Avg Tokens/Doc'],
        'Value': [total_tokens, document_count, avg_tokens_per_doc]
    })
    
    return {
        'total_tokens': total_tokens,
        'document_count': document_count,
        'avg_tokens_per_doc': avg_tokens_per_doc,
        'summary': summary
    }

if __name__ == "__main__":
    # Set your Supabase credentials
    # SUPABASE_URL = "your-supabase-url"
    # SUPABASE_KEY = "your-supabase-key"
    
    # You can also set these as environment variables
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_API_KEY")
    
    # Set your table name and content column
    TABLE_NAME = "knowledge_base"
    CONTENT_COLUMN = "markdown"  # Change to your content column name
    
    # Count tokens
    result = count_tokens_in_supabase_vector_store(
        SUPABASE_URL, 
        SUPABASE_KEY, 
        TABLE_NAME, 
        CONTENT_COLUMN
    )
    
    # Print results
    print(f"\nToken Count Summary for {TABLE_NAME}:")
    print(f"Total Tokens: {result['total_tokens']:,}")
    print(f"Document Count: {result['document_count']:,}")
    print(f"Average Tokens per Document: {result['avg_tokens_per_doc']:.2f}")
    
    # Display summary table
    print("\nSummary Table:")
    print(result['summary'].to_string(index=False))