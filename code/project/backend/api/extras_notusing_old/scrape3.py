import requests
from bs4 import BeautifulSoup
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor
import time
import random
from fastapi import HTTPException
import os
from supabase import create_client, Client

# Constants
START_URL = "https://www.nhs.uk/conditions/"  # Assuming this is your starting URL
BASE_URL = "https://www.nhs.uk"  # Assuming this is your base URL

# Browser-like headers to avoid detection
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

async def fetch_url(session, url, semaphore):
    """Fetch a URL asynchronously with rate limiting."""
    async with semaphore:  # Use semaphore to limit concurrent requests
        try:
            # Small random delay (0.5-1.5 seconds) to appear more human-like
            await asyncio.sleep(0.5 + random.random())
            
            async with session.get(url, headers=HEADERS, timeout=20) as response:
                if response.status == 403 or response.status == 429:
                    print(f"Access denied for {url}. Status: {response.status}")
                    # Back off and retry once with a longer delay
                    await asyncio.sleep(5 + random.random() * 3)
                    async with session.get(url, headers=HEADERS, timeout=20) as retry_response:
                        if retry_response.status == 200:
                            return await retry_response.text(), url
                        return None, url
                
                return await response.text(), url
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return None, url

def parse_condition_page(html, url):
    """Parse the HTML of a condition page."""
    if not html:
        return None
    
    soup = BeautifulSoup(html, "html.parser")
    title = soup.find("h1").text.strip() if soup.find("h1") else "Unknown"
    
    # Extract main content more efficiently
    content = " ".join(p.text.strip() for p in soup.select("main p"))
    
    return {
        "title": title,
        "url": url,
        "content": content
    }

async def process_conditions():
    """Process conditions with balanced rate limiting."""
    # Fetch the main page with browser headers
    response = requests.get(START_URL, headers=HEADERS)
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Extract all condition links in one go
    condition_links = [
        BASE_URL + href for href in 
        (a.get("href") for a in soup.select("ul.nhsuk-list a"))
        if href and href.startswith("/conditions/")
    ]
    
    # Use a moderate concurrency level - not too high, not too low
    concurrency_limit = 8
    
    # Create a semaphore to limit concurrent requests
    semaphore = asyncio.Semaphore(concurrency_limit)
    
    # Set up connection pooling with reasonable limits
    connector = aiohttp.TCPConnector(limit=concurrency_limit)
    timeout = aiohttp.ClientTimeout(total=30)
    
    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        # Create tasks for all URLs but they'll be limited by the semaphore
        tasks = [fetch_url(session, url, semaphore) for url in condition_links]
        results = await asyncio.gather(*tasks)
        
        # Process results in a thread pool
        with ThreadPoolExecutor(max_workers=concurrency_limit) as executor:
            condition_futures = [
                executor.submit(parse_condition_page, html, url)
                for html, url in results if html
            ]
            
            conditions_data = [
                future.result() for future in condition_futures
                if future.result() is not None
            ]
    
    return conditions_data

async def batch_insert_to_supabase(supabase, conditions_data, batch_size=25):
    """Insert data to Supabase in batches."""
    table = "conditions3"
    
    for i in range(0, len(conditions_data), batch_size):
        batch = conditions_data[i:i+batch_size]
        try:
            supabase.table(table).insert(batch).execute()
            print(f"Inserted batch {i//batch_size + 1}/{(len(conditions_data) + batch_size - 1)//batch_size}")
        except Exception as e:
            print(f"Error inserting batch: {e}")

async def scrape3():
    """Endpoint to scrape conditions and save to Supabase."""
    try:
        start_time = time.time()
        
        # Get and process conditions
        conditions_data = await process_conditions()
        
        supabase_url: str = os.getenv("SUPABASE_URL")
        supabase_api_key: str = os.getenv("SUPABASE_API_KEY")
        supabase: Client = create_client(supabase_url, supabase_api_key)
        
        print(f"Scraped {len(conditions_data)} conditions in {time.time() - start_time:.2f} seconds")
        
        # Save data to Supabase
        await batch_insert_to_supabase(supabase, conditions_data)
        
        elapsed_time = time.time() - start_time
        
        return {
            "message": "Scraping completed and data saved to Supabase.",
            "data_count": len(conditions_data),
            "elapsed_time_seconds": elapsed_time
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping: {e}")

# Usage in FastAPI app
# @app.get("/scrape-conditions")
# async def scrape_endpoint():
#     return await scrape_conditions(supabase_client)