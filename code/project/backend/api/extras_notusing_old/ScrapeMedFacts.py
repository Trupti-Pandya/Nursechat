import os
import time
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import HTTPException
from supabase import create_client, Client


load_dotenv()


# Supabase setup

supabase_url: str = os.getenv("SUPABASE_URL")
supabase_api_key: str = os.getenv("SUPABASE_API_KEY")

supabase: Client = create_client(supabase_url, supabase_api_key)

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
    """Extract relevant information from a condition page."""
    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")

    title = soup.find("h1").text.strip() if soup.find("h1") else "Unknown"

    # Extract main content
    content = []
    for p in soup.select("main p"):  # Adjust selector if needed
        content.append(p.text.strip())

    return {
        "title": title,
        "url": url,
        "content": " ".join(content)
    }

def save_conditions_to_db(conditions_data):
    """Save scraped data to Supabase"""
    table = "conditions"  # Ensure you have a 'conditions' table in Supabase
    for condition in conditions_data:
        try:
            supabase.table(table).insert(condition).execute()
            print(f"Inserted data for {condition['title']}")
        except Exception as e:
            print(f"Error inserting data: {e}")
            
            
def scrape_conditions():
    """Endpoint to scrape conditions and save to Supabase."""
    try:
        condition_links = get_condition_links()
        conditions_data = []
        
        for index, url in enumerate(condition_links):
            print(f"Scraping {index + 1}/{len(condition_links)}: {url}")
            try:
                data = scrape_condition_page(url)
                conditions_data.append(data)
                time.sleep(1)  # Be respectful to the server
            except Exception as e:
                print(f"Error scraping {url}: {e}")
        
        # Save data to Supabase
        save_conditions_to_db(conditions_data)

        return {"message": "Scraping completed and data saved to Supabase.", "data_count": len(conditions_data)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping: {e}")