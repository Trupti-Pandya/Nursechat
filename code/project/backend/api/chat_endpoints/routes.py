import asyncio
from fastapi import APIRouter
# from .chat import chat_endpoint, ChatRequest, ChatResponse
from .chat import NurseAssistantService, ChatRequest, ChatResponse
chat_router = APIRouter(tags=["chat"])

# @chat_router.post("/chat", response_model=ChatResponse)
# async def chat(request: ChatRequest):
#     return await chat_endpoint(request)

chat_service = NurseAssistantService()

@chat_router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process a chat message and generate an AI response.
    
    This endpoint handles user chat messages, integrates with uploaded documents,
    and provides contextually relevant responses using the NurseAssistant service.
    
    Parameters:
    - **request**: ChatRequest object containing:
        - session_id (str): Unique identifier for the chat session
        - message (str): User's message text
        - documents (List[DocumentItem], optional): List of documents to include with the message
          
    Returns:
    - **ChatResponse**: Object containing:
        - response (str): AI-generated response to the user's message
        - references (List[Dict]): Metadata about referenced information sources
        - document_count (int): Number of active documents in the current session
    
    Raises:
    - HTTPException(500): If there's an error processing the message
    """
    return await chat_service.chat(request)



















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