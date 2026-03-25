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
    """Extract all condition links from the main conditions page (exact original logic)."""
    response = requests.get(START_URL)
    soup = BeautifulSoup(response.text, "html.parser")

    condition_links = []
    for a in soup.select("ul.nhsuk-list a"):  # Exact selector from original script
        href = a.get("href")
        if href and href.startswith("/conditions/"):
            condition_links.append(BASE_URL + href)

    # Deduplicate while preserving order
    seen = set()
    condition_links = [x for x in condition_links if not (x in seen or seen.add(x))]

    print(f"Found {len(condition_links)} unique condition links")
    with open("condition_links.txt", "w") as f:
        f.write("\n".join(condition_links))
    return condition_links

def html_to_markdown(soup):
    """Convert HTML content to Markdown, rewritten for robustness."""
    markdown = []
    content_area = soup.select_one("#main-content") or soup.find("main") or soup.body
    if not content_area:
        print("No content area found in HTML")
        return ""

    current_heading_level = 0
    current_section = None

    for element in content_area.find_all(["h1", "h2", "h3", "p", "ul", "ol", "li"], recursive=True):
        if element.name == "h1":
            title = element.get_text(strip=True).replace("Overview-", "").strip()
            markdown.append(f"# {title}")
            current_heading_level = 1
            current_section = None
        elif element.name == "h2":
            if "contents" not in element.get_text(strip=True).lower():
                current_section = element.get_text(strip=True)
                markdown.append(f"## {current_section}")
                current_heading_level = 2
            else:
                current_section = None
        elif element.name == "h3":
            markdown.append(f"### {element.get_text(strip=True)}")
            current_heading_level = 3
        elif element.name == "p":
            text = element.get_text(strip=True)
            if text:  # Only append non-empty paragraphs
                markdown.append(text)
        elif element.name == "ul":
            for li in element.find_all("li", recursive=False):
                text = li.get_text(strip=True)
                if text:
                    markdown.append(f"- {text}")
        elif element.name == "ol":
            for idx, li in enumerate(element.find_all("li", recursive=False), 1):
                text = li.get_text(strip=True)
                if text:
                    markdown.append(f"{idx}. {text}")

    markdown_text = "\n\n".join(filter(None, markdown))  # Remove empty lines and join
    if not markdown_text:
        print("Generated Markdown is empty")
    else:
        print(f"Generated Markdown sample: {markdown_text[:200]}...")
    return markdown_text

def scrape_condition_page(url):
    """Extract relevant information from a condition page and return Markdown."""
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=20)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            title = soup.find("h1").text.strip().replace("Overview-", "").strip() if soup.find("h1") else "Unknown"
            markdown_content = html_to_markdown(soup)

            if not markdown_content:
                print(f"No Markdown content for {url}")

            return {
                "title": title,
                "url": url,
                "markdown": markdown_content
            }
        except requests.RequestException as e:
            print(f"Attempt {attempt + 1} failed for {url}: {e}")
            if attempt < 2:
                time.sleep(random.uniform(0.5, 1))
            else:
                print(f"Failed to scrape {url} after 3 attempts.")
                return None

def save_conditions_to_db(conditions_data):
    """Save scraped data to Supabase in bulk."""
    table = "conditions2mdByBS"
    try:
        valid_data = [d for d in conditions_data if d is not None and d["markdown"]]
        if not valid_data:
            print("No valid data to insert into Supabase")
            return
        print(f"Saving {len(valid_data)} records to Supabase")
        supabase.table(table).insert(valid_data).execute()
        print(f"Inserted {len(valid_data)} records.")
    except Exception as e:
        print(f"Error inserting data: {e}")

def scrape2md():
    """Scrape conditions concurrently, convert to Markdown, and save to Supabase."""
    try:
        start_time = time.time()

        condition_links = get_condition_links()
        links_time = time.time() - start_time
        print(f"Getting links took {links_time:.2f} seconds")

        conditions_data = []
        start_scrape_time = time.time()
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_url = {executor.submit(scrape_condition_page, url): url for url in condition_links}

            for future in as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    data = future.result()
                    if data and data["markdown"]:
                        conditions_data.append(data)
                    else:
                        print(f"Skipping {url} - no valid data")
                except Exception as e:
                    print(f"Error processing {url}: {e}")
        scrape_time = time.time() - start_scrape_time
        print(f"Scraping took {scrape_time:.2f} seconds")

        start_db_time = time.time()
        save_conditions_to_db(conditions_data)
        db_time = time.time() - start_db_time
        print(f"Database insertion took {db_time:.2f} seconds")

        elapsed_time = time.time() - start_time
        time_str = f"{elapsed_time:.2f} seconds" if elapsed_time < 60 else f"{int(elapsed_time // 60)} minutes and {elapsed_time % 60:.2f} seconds"
        print(f"Total scraping process took {time_str}")

        return {
            "message": "Scraping completed and data saved to Supabase. - iss basee 1100 par",
            "data_count": len(conditions_data),
            "time_taken": time_str
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping: {e}")

