import requests
from bs4 import BeautifulSoup
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor
import time
import random
from fastapi import HTTPException
import aiodns  # For faster DNS resolution
import socket
import backoff  # For exponential backoff
import os
from supabase import create_client, Client
# Constants
START_URL = "https://www.nhs.uk/conditions/"
BASE_URL = "https://www.nhs.uk"

supabase_url: str = os.getenv("SUPABASE_URL")
supabase_api_key: str = os.getenv("SUPABASE_API_KEY")
supabase: Client = create_client(supabase_url, supabase_api_key)


# More diverse user agents
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.67",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1"
]

def get_random_headers():
    """Generate random headers for each request with more variation."""
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": f"en-US,en;q=0.{random.randint(5, 9)}",
        "Referer": random.choice([START_URL, BASE_URL, "https://www.nhs.uk/search/"]),
        "DNT": "1",
        "Cache-Control": "no-cache",
        "Connection": random.choice(["keep-alive", "close"]),
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": random.choice(["same-origin", "none"]),
        "Sec-Fetch-User": "?1",
        "Pragma": "no-cache",
    }

class Scraper:
    def __init__(self, concurrency=8):
        self.concurrency = concurrency  # Reduced concurrency to avoid detection
        self.semaphore = None
        self.session = None
        self.failed_urls = []
        self.success_count = 0
        self.retry_urls = []
        self.delay_base = 0.5  # Increased base delay
        
    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, asyncio.TimeoutError),
        max_tries=3,
        max_time=30
    )
    async def fetch_url(self, url):
        """Fetch a URL asynchronously with adaptive delay and exponential backoff."""
        async with self.semaphore:
            try:
                # Jittered delay with higher base value
                delay = self.delay_base + random.random() * 0.5
                await asyncio.sleep(delay)
                
                # Get unique headers for this request
                headers = get_random_headers()
                
                async with self.session.get(
                    url, 
                    headers=headers, 
                    timeout=15,
                    allow_redirects=True
                ) as response:
                    if response.status == 200:
                        self.success_count += 1
                        # Dynamically adjust delay based on success/failure patterns
                        if self.success_count % 10 == 0:
                            self.delay_base = max(0.2, self.delay_base * 0.9)  # Gradually decrease if successful
                        return await response.text(), url
                    elif response.status == 429 or response.status == 403:
                        # Rate limited or blocked - increase delay and retry later
                        self.delay_base = min(2.0, self.delay_base * 1.5)
                        self.retry_urls.append(url)
                        print(f"Rate limited on {url}, increasing delay to {self.delay_base}")
                        return None, url
                    else:
                        self.failed_urls.append((url, f"Status: {response.status}"))
                        return None, url
            except Exception as e:
                self.failed_urls.append((url, str(e)))
                return None, url
    
    def parse_condition_page(self, html, url):
        """Parse the HTML of a condition page - optimized version without cchardet."""
        if not html:
            return None
        
        try:
            # Use html.parser instead of lxml
            soup = BeautifulSoup(html, "html.parser")
            title = soup.find("h1").text.strip() if soup.find("h1") else "Unknown"
            
            # Extract main content efficiently
            content_parts = []
            
            # Try different selectors to get content
            selectors = ["main p", ".nhsuk-grid-column-two-thirds p", "article p", ".content-area p"]
            
            for selector in selectors:
                paragraphs = soup.select(selector)
                if paragraphs:
                    content_parts = [p.text.strip() for p in paragraphs if p.text.strip()]
                    break
            
            content = " ".join(content_parts)
            
            return {
                "title": title,
                "url": url,
                "content": content
            }
        except Exception as e:
            print(f"Error parsing {url}: {e}")
            return None
    
    async def process_conditions(self):
        """Process conditions with optimized concurrency and retry mechanism."""
        start_time = time.time()
        
        # Fetch the main page with browser headers
        # Add retry logic for initial page fetch
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.get(
                    START_URL, 
                    headers=get_random_headers(),
                    timeout=10
                )
                response.raise_for_status()
                break
            except requests.RequestException as e:
                if attempt == max_retries - 1:
                    raise Exception(f"Failed to fetch initial page after {max_retries} attempts: {e}")
                print(f"Retrying initial page fetch, attempt {attempt+1}/{max_retries}")
                time.sleep(2 ** attempt)  # Exponential backoff
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Extract all condition links in one go
        condition_links = []
        for a in soup.select("ul.nhsuk-list a"):
            href = a.get("href")
            if href and href.startswith("/conditions/"):
                full_url = BASE_URL + href
                if full_url not in condition_links:  # Avoid duplicates
                    condition_links.append(full_url)
        
        print(f"Found {len(condition_links)} condition links")
        
        # Create semaphore and DNS resolver for speed
        self.semaphore = asyncio.Semaphore(self.concurrency)
        resolver = aiodns.DNSResolver(nameservers=["1.1.1.1", "8.8.8.8"])  # Use Cloudflare and Google DNS
        
        # Configure TCP connector with more reasonable settings
        connector = aiohttp.TCPConnector(
            limit=self.concurrency,
            ttl_dns_cache=300,
            family=socket.AF_INET,  # IPv4 only for speed
            ssl=False,  # No SSL verification for speed
            resolver=resolver,
            force_close=True  # Don't keep connections open
        )
        
        # Create client session with optimal settings
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            self.session = session
            
            # Process in smaller batches to avoid overwhelming the server
            batch_size = 15
            all_results = []
            
            for i in range(0, len(condition_links), batch_size):
                batch = condition_links[i:i+batch_size]
                print(f"Processing batch {i//batch_size + 1}/{(len(condition_links) + batch_size - 1)//batch_size}")
                
                # Create tasks for batch
                tasks = [self.fetch_url(url) for url in batch]
                batch_results = await asyncio.gather(*tasks)
                all_results.extend(batch_results)
                
                # Small pause between batches
                await asyncio.sleep(1)
            
            # Process retry URLs if any
            if self.retry_urls:
                print(f"Retrying {len(self.retry_urls)} URLs with increased delay")
                await asyncio.sleep(5)  # Significant pause before retries
                
                # Retry with higher delay base
                self.delay_base = 2.0
                retry_tasks = [self.fetch_url(url) for url in self.retry_urls]
                retry_results = await asyncio.gather(*retry_tasks)
                all_results.extend(retry_results)
            
            fetch_time = time.time() - start_time
            print(f"Fetched {self.success_count}/{len(condition_links)} pages in {fetch_time:.2f} seconds")
            
            # Process results in parallel with a thread pool
            valid_results = [(html, url) for html, url in all_results if html]
            
            # Use optimized thread pool
            with ThreadPoolExecutor(max_workers=min(16, len(valid_results))) as executor:
                condition_futures = [
                    executor.submit(self.parse_condition_page, html, url)
                    for html, url in valid_results
                ]
                
                conditions_data = [
                    future.result() for future in condition_futures
                    if future.result() is not None
                ]
        
        total_time = time.time() - start_time
        print(f"Processed {len(conditions_data)} conditions in {total_time:.2f} seconds")
        
        if self.failed_urls:
            print(f"Failed to fetch {len(self.failed_urls)} URLs")
            for url, reason in self.failed_urls[:5]:  # Show first 5 failures
                print(f"  - {url}: {reason}")
            
        return conditions_data

async def batch_insert_to_supabase(conditions_data, batch_size=50):
    """Insert data to Supabase in controlled batch sizes."""
    if not conditions_data:
        return
        
    table = "conditions"
    
    for i in range(0, len(conditions_data), batch_size):
        batch = conditions_data[i:i+batch_size]
        try:
            supabase.table(table).insert(batch).execute()
            print(f"Inserted batch {i//batch_size + 1}/{(len(conditions_data) + batch_size - 1)//batch_size}")
            await asyncio.sleep(0.5)  # Small pause between database operations
        except Exception as e:
            print(f"Error inserting batch: {e}")
            # If batch fails, try inserting individually
            for item in batch:
                try:
                    supabase.table(table).insert(item).execute()
                    print(f"Inserted individual item for {item.get('title', 'unknown')}")
                    await asyncio.sleep(0.2)
                except Exception as individual_error:
                    print(f"Failed to insert item: {individual_error}")

async def scrapeFinalClaude():
    """Endpoint to scrape conditions and save to Supabase."""
    try:
        start_time = time.time()
        
        # Create scraper with moderate concurrency
        scraper = Scraper(concurrency=8)
        
        # Get and process conditions
        conditions_data = await scraper.process_conditions()
        
        # Save data to Supabase in moderate batches
        await batch_insert_to_supabase(supabase, conditions_data, batch_size=50)
        
        elapsed_time = time.time() - start_time
        
        return {
            "message": "Scraping completed and data saved to Supabase.",
            "data_count": len(conditions_data),
            "elapsed_time_seconds": elapsed_time,
            "success_rate": f"{len(conditions_data)}/{scraper.success_count} ({len(conditions_data)/max(1, scraper.success_count)*100:.1f}%)"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping: {e}")

# Usage in FastAPI app
# @app.get("/scrape-conditions")
# async def scrape_endpoint():
#     return await scrape_conditions(supabase_client)