import os
import time
import random
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import HTTPException
from supabase import create_client, Client
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re

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

def clean_text(text):
    """Clean and normalize text for markdown formatting."""
    # Remove extra whitespace and normalize line breaks
    text = re.sub(r'\s+', ' ', text).strip()
    # Escape markdown special characters
    text = re.sub(r'([\\`*_{}[\]()#+.!-])', r'\\\1', text)
    return text

def extract_sections(soup):
    """Extract structured sections from the page."""
    sections = {}
    
    # Try to find main sections using NHS website structure
    section_headers = soup.select("main h2, main h3")
    
    current_section = "Overview"
    sections[current_section] = []
    
    # Process elements sequentially to organize content by sections
    for element in soup.select("main p, main h2, main h3, main ul, main ol"):
        if element.name in ['h2', 'h3']:
            current_section = element.text.strip()
            sections[current_section] = []
        elif element.name == 'p':
            sections[current_section].append({"type": "paragraph", "content": element.text.strip()})
        elif element.name == 'ul':
            list_items = [li.text.strip() for li in element.find_all('li')]
            sections[current_section].append({"type": "unordered_list", "items": list_items})
        elif element.name == 'ol':
            list_items = [li.text.strip() for li in element.find_all('li')]
            sections[current_section].append({"type": "ordered_list", "items": list_items})
    
    return sections

def scrape_condition_page(url):
    """Extract relevant information from a condition page with retries and format as markdown."""
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=20)  # Timeout set to 20 seconds
            response.raise_for_status()  # Raise exception for bad status codes
            soup = BeautifulSoup(response.text, "html.parser")

            title = soup.find("h1").text.strip() if soup.find("h1") else "Unknown"
            
            # Extract structured sections
            sections = extract_sections(soup)
            
            # Create markdown content
            markdown = f"# {title}\n\n"
            markdown += f"*Source: [{url}]({url})*\n\n"
            
            # Add metadata if available
            metadata = {}
            metadata["url"] = url
            metadata["title"] = title
            
            # Process each section into markdown
            for section_title, content in sections.items():
                if content:  # Only add sections with content
                    markdown += f"## {section_title}\n\n"
                    
                    for item in content:
                        if item["type"] == "paragraph":
                            markdown += f"{clean_text(item['content'])}\n\n"
                        elif item["type"] == "unordered_list":
                            for li in item["items"]:
                                markdown += f"* {clean_text(li)}\n"
                            markdown += "\n"
                        elif item["type"] == "ordered_list":
                            for i, li in enumerate(item["items"], 1):
                                markdown += f"{i}. {clean_text(li)}\n"
                            markdown += "\n"
            
            return {
                "title": title,
                "url": url,
                "markdown": markdown,
                "raw_content": json.dumps(sections)  # Store structured data for potential other uses
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
    table = "conditions2mdByBS"  # Ensure this table exists in Supabase
    try:
        # Ensure the table has the right schema for markdown content
        supabase.table(table).insert(conditions_data).execute()
        print(f"Inserted {len(conditions_data)} records.")
    except Exception as e:
        print(f"Error inserting data: {e}")

def save_markdown_files(conditions_data, output_dir="markdown_output"):
    """Save each condition as an individual markdown file."""
    os.makedirs(output_dir, exist_ok=True)
    
    for condition in conditions_data:
        # Create a safe filename from the title
        safe_filename = re.sub(r'[^\w\s-]', '', condition["title"]).strip().lower()
        safe_filename = re.sub(r'[-\s]+', '-', safe_filename)
        
        # Write to file
        filepath = os.path.join(output_dir, f"{safe_filename}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(condition["markdown"])
    
    print(f"Saved {len(conditions_data)} markdown files to {output_dir} directory")

def scrape2mdByClaude():
    """Scrape conditions concurrently, format as markdown, and save results."""
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
        
        # Step 4: Save individual markdown files
        start_md_time = time.time()
        save_markdown_files(conditions_data)
        md_time = time.time() - start_md_time
        print(f"Markdown file creation took {md_time:.2f} seconds")

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
            "message": "Scraping completed. Data saved to Supabase and as markdown files.",
            "data_count": len(conditions_data),
            "time_taken": time_str
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping: {e}")

