import asyncio
from fastapi import APIRouter
from .vector_creation import vectorMain
from .process_nhs_factsheet_to_markdown import process_nhs_factsheet_to_markdown
from .test_retrieval import test_retrieval
from .test2 import test_retrieval_pure_rag


scrape_router = APIRouter()

@scrape_router.post("/get-health-content")
async def scrape_health_content():
    """
    Scrape health information from NHS factsheets and convert to markdown format.
    
    This endpoint processes NHS factsheets, extracting medical information and 
    formatting it into structured markdown documents that can be used as reference
    material for the chat system.
    
    Returns:
        dict: Results of the scraping process including:
            - file_count: Number of files processed
            - file_list: List of processed file names
            - total_size: Total size of the processed content in bytes
            - execution_time: Time taken to process all files in seconds
    
    Raises:
        HTTPException(500): If there's an error during the scraping process
    """  
    result = await asyncio.to_thread(process_nhs_factsheet_to_markdown)
    return result   

@scrape_router.post("/vector-creation")
async def createVectorStore():
    """
    Create vector embeddings from medical text data for the retrieval system.
    
    This endpoint processes medical text data, creating vector embeddings that
    enable semantic search functionality in the chat system. This is a resource-intensive
    operation that should be run periodically to update the knowledge base.
    
    Returns:
        dict: Results of the vector creation process including:
            - document_count: Number of documents processed
            - embedding_count: Number of embeddings created
            - execution_time: Time taken for the process in seconds
            - status: Success or error message
    
    Raises:
        HTTPException(500): If there's an error during the vector creation process
    """  
    result = await asyncio.to_thread(vectorMain)
    return result

@scrape_router.post("/test-retrieval")
def test_retrieval_endpoint():
    """
    Test the vector retrieval system with sample medical queries.
    
    This endpoint runs a set of predefined medical queries against the vector store
    to evaluate the quality of retrieval results. It uses filtering mechanisms to
    improve relevance of returned information.
    
    Returns:
        dict: Results of the test queries including:
            - queries: List of test queries used
            - results: Retrieved text and metadata for each query
            - metrics: Performance metrics including relevance scores
    """  
    return test_retrieval()


@scrape_router.post("/test-retrieval-nofilters")
def test_2_endpoint():
    """
    Test the vector retrieval system without content filtering.
    
    This endpoint is similar to the test-retrieval endpoint but uses a "pure RAG" 
    (Retrieval Augmented Generation) approach without additional filtering mechanisms.
    Useful for comparing the quality of results with and without filtering.
    
    Returns:
        dict: Results of the unfiltered test queries including:
            - queries: List of test queries used
            - results: Raw retrieved text and metadata for each query
            - metrics: Performance metrics for unfiltered retrieval
    """  
    return test_retrieval_pure_rag()



















# async def scrape_health_content():
    
    # start_time = time.time()
    
    # # Run both scraping functions in parallel
    # nhs_task = asyncio.create_task(asyncio.to_thread(process_nhs_factsheet_to_markdown))
    # medlineplus_task = asyncio.create_task(asyncio.to_thread(process_medlineplus_to_markdown))
    
    # # Wait for both tasks to complete
    # nhs_result, medlineplus_result = await asyncio.gather(nhs_task, medlineplus_task)
    
    # elapsed_time = round(time.time() - start_time, 2)
    
    # return {
    #     "nhs_content": nhs_result,
    #     "medlineplus_content": medlineplus_result,
    #     "execution_time_seconds": elapsed_time
    # }