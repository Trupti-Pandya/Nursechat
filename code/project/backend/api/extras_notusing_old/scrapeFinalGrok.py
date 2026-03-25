import os
import time
import random
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import HTTPException
from supabase import create_client, Client
from concurrent.futures import ThreadPoolExecutor, as_completed

# Load environment variables from a .env file
load_dotenv()

# Set up Supabase client using environment variables
supabase_url: str = os.getenv("SUPABASE_URL")
supabase_api_key: str = os.getenv("SUPABASE_API_KEY")
supabase: Client = create_client(supabase_url, supabase_api_key)

# Define base URLs for NHS website
BASE_URL = "https://www.nhs.uk"
START_URL = "https://www.nhs.uk/conditions/"

def get_condition_links():
    """Extract all condition links from the main conditions page."""
    response = requests.get(START_URL)
    soup = BeautifulSoup(response.text, "html.parser")

    condition_links = []
    for a in soup.select("ul.nhsuk-list a"):  # Adjust selector if needed
        href = a.get("href")
        if href and href.startswith("/conditions/"):
            condition_links.append(BASE_URL + href)

    return condition_links

def scrape_condition_page(url):
    """Extract relevant information from a condition page with retries."""
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=20)  # Timeout set to 20 seconds
            response.raise_for_status()  # Raise exception for bad status codes
            soup = BeautifulSoup(response.text, "html.parser")

            title = soup.find("h1").text.strip() if soup.find("h1") else "Unknown"
            content = [p.text.strip() for p in soup.select("main p")]

            return {
                "title": title,
                "url": url,
                "content": " ".join(content)
            }
        except requests.RequestException as e:
            print(f"Attempt {attempt + 1} failed for {url}: {e}")
            if attempt < 2:  # Retry up to 3 times
                time.sleep(random.uniform(0.5, 1))  # Delay between 0.5 and 1 second
            else:
                print(f"Failed to scrape {url} after 3 attempts.")
                return None

def save_conditions_to_db(conditions_data):
    """Save scraped data to Supabase in bulk."""
    table = "con"  # Ensure this table exists in Supabase
    try:
        supabase.table(table).insert(conditions_data).execute()
        print(f"Inserted {len(conditions_data)} records.")
    except Exception as e:
        print(f"Error inserting data: {e}")

def scrapeFinalGrok():
    """Scrape conditions concurrently and save to Supabase, with timing."""
    try:
        # Record start time
        start_time = time.time()

        # Step 1: Fetch list of condition links
        condition_links = get_condition_links()
        links_time = time.time() - start_time
        print(f"Getting links took {links_time:.2f} seconds")

        conditions_data = []

        # Step 2: Scrape pages concurrently with 10 workers
        start_scrape_time = time.time()
        with ThreadPoolExecutor(max_workers=10) as executor:
            # Map each URL to a future
            future_to_url = {executor.submit(scrape_condition_page, url): url for url in condition_links}

            # Process completed futures as they finish
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    data = future.result()
                    if data:  # Only append successful results
                        conditions_data.append(data)
                except Exception as e:
                    print(f"Error processing {url}: {e}")
        scrape_time = time.time() - start_scrape_time
        print(f"Scraping took {scrape_time:.2f} seconds")

        # Step 3: Save all data to Supabase in one bulk insert
        start_db_time = time.time()
        save_conditions_to_db(conditions_data)
        db_time = time.time() - start_db_time
        print(f"Database insertion took {db_time:.2f} seconds")

        # Calculate total duration
        end_time = time.time()
        elapsed_time = end_time - start_time

        # Format the time for readability
        if elapsed_time < 60:
            time_str = f"{elapsed_time:.2f} seconds"
        else:
            minutes = elapsed_time // 60
            seconds = elapsed_time % 60
            time_str = f"{int(minutes)} minutes and {seconds:.2f} seconds"

        print(f"Total scraping process took {time_str}")

        return {
            "message": "Scraping completed and data saved to Supabase.",
            "data_count": len(conditions_data),
            "time_taken": time_str
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping: {e}")

