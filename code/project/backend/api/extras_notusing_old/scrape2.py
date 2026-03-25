import requests
from bs4 import BeautifulSoup
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor
import time
from fastapi import HTTPException
import os
from supabase import create_client, Client

# Constants
START_URL = "https://www.nhs.uk/conditions/"  # Assuming this is your starting URL
BASE_URL = "https://www.nhs.uk"  # Assuming this is your base URL

async def fetch_url(session, url):
    """Fetch a URL asynchronously."""
    try:
        async with session.get(url) as response:
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
    
    # Extract main content - concatenate all paragraph text at once
    content = " ".join(p.text.strip() for p in soup.select("main p"))
    
    return {
        "title": title,
        "url": url,
        "content": content
    }

async def process_conditions():
    """Process all conditions in parallel."""
    # Fetch the main page first
    response = requests.get(START_URL)
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Extract all condition links in one go
    condition_links = [
        BASE_URL + href for href in 
        (a.get("href") for a in soup.select("ul.nhsuk-list a"))
        if href and href.startswith("/conditions/")
    ]
    
    # Set up batch processing with concurrency limits
    async with aiohttp.ClientSession() as session:
        # Fetch all pages asynchronously
        tasks = [fetch_url(session, url) for url in condition_links]
        results = await asyncio.gather(*tasks)
        
        # Process all results with ThreadPoolExecutor for CPU-bound parsing
        with ThreadPoolExecutor(max_workers=10) as executor:
            # Process the HTML in parallel
            conditions_data = list(filter(None, executor.map(
                lambda x: parse_condition_page(x[0], x[1]), 
                results
            )))
    
    return conditions_data

async def batch_insert_to_supabase(supabase, conditions_data, batch_size=15):
    """Insert data to Supabase in batches to reduce API calls."""
    table = "conditionsFast"
    
    for i in range(0, len(conditions_data), batch_size):
        batch = conditions_data[i:i+batch_size]
        try:
            # Insert multiple records in one API call
            supabase.table(table).insert(batch).execute()
            print(f"Inserted batch {i//batch_size + 1}/{(len(conditions_data) + batch_size - 1)//batch_size}")
        except Exception as e:
            print(f"Error inserting batch: {e}")

async def scrape_conditions_second():
    """Endpoint to scrape conditions and save to Supabase."""
    try:
        # Time the operation
        start_time = time.time()
        
        # Get and process all conditions
        conditions_data = await process_conditions()

        supabase_url: str = os.getenv("SUPABASE_URL")
        supabase_api_key: str = os.getenv("SUPABASE_API_KEY")

        supabase: Client = create_client(supabase_url, supabase_api_key)

        # Save data to Supabase in batches
        await batch_insert_to_supabase(supabase, conditions_data)
        
        elapsed_time = time.time() - start_time
        
        return {
            "message": "Scraping completed and data saved to Supabase.",
            "data_count": len(conditions_data),
            "elapsed_time_seconds": elapsed_time
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping: {e}")
