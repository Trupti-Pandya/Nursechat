import os
import re
import json
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
def clean_text(text):
    """Clean and normalize text for markdown formatting."""
    # Remove extra whitespace and normalize line breaks
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Don't escape all markdown characters as it causes issues
    # Only escape characters that would interfere with markdown structure
    # (like asterisks at the beginning of lines that might be interpreted as lists)
    text = re.sub(r'^([*+-])', r'\\\1', text)  # Only escape at start of string or line
    
    return text
def extract_sections(soup):
    """Extract structured sections from the page, filtering out image attribution links."""
    sections = {}

    # Extract only figcaption content from figure tags
    for figure_tag in soup.find_all('figure'):
        figcaption = figure_tag.find('figcaption')
        if figcaption:
            figure_text = figcaption.get_text(strip=True)  # Get clean text
            figure_tag.replace_with(BeautifulSoup(f"<p>{figure_text}</p>", "html.parser"))  # Replace <figure> with <p>

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
def find_sub_links(soup, base_url):
    """Extract sub-links from navigation elements on the page, excluding image links."""
    sub_links = []
    
    # Look for navigation menus, content indexes, and other link collections
    nav_elements = soup.select("nav.nhsuk-contents-list, .nhsuk-nav-a-z, ul.nhsuk-list--border")

    for nav in nav_elements:
        links = nav.find_all('a')
        for link in links:
            href = link.get('href')

            # Skip if href is missing
            if not href:
                continue

            # Skip if the href contains an image file extension
            if href.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp')):
                continue

            # Handle relative URLs before checking the domain
            if href.startswith('/'):
                full_url = BASE_URL + href
            elif href.startswith('http'):
                full_url = href
            else:
                # Handle page fragments
                if '#' in href:
                    full_url = base_url + href
                else:
                    full_url = BASE_URL + '/' + href
            
            # Skip known image-hosting domains
            if any(domain in full_url for domain in [
                'alamy.com', 'sciencephoto.com', 'getty', 'shutterstock',
                'istockphoto', 'stock-photo', 'fotolia', 'dreamstime',
                'depositphotos', '123rf.com', 'pexels', 'unsplash', 'pixabay'
            ]):
                continue

            # Avoid duplicates and external links
            if full_url.startswith(BASE_URL) and full_url not in sub_links:
                # Ensure the link has meaningful text and isn't just an image alt text
                link_text = link.text.strip()
                if link_text and not link_text.lower().startswith('image:'):
                    sub_links.append({
                        'url': full_url,
                        'text': link_text
                    })

    return sub_links
def scrape_condition_page(url, depth=0, max_depth=1, visited=None):
    """Extract relevant information from a condition page with retries and format as markdown."""
    if visited is None:
        visited = set()
    
    # Avoid infinite recursion
    if url in visited or depth > max_depth:
        return None
    
    visited.add(url)
    
    for attempt in range(3):
        try:
            print(f"Scraping {url} (depth {depth})")
            response = requests.get(url, timeout=20)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            title = soup.find("h1").text.strip() if soup.find("h1") else "Unknown"
            
            # Find sub-links before extracting content
            sub_links = find_sub_links(soup, url)
            
            # Extract structured sections
            sections = extract_sections(soup)
            
            # Create markdown content
            markdown = f"# {title}\n\n"
            markdown += f"*Source: [{url}]({url})*\n\n"
            
            # Add a table of contents if we have sub-links
            if sub_links and depth == 0:
                markdown += "## Contents\n\n"
                for link in sub_links:
                    link_text = link['text']
                    # Create anchor links for the markdown document
                    anchor = link_text.lower().replace(' ', '-').replace('/', '-')
                    markdown += f"* [{link_text}](#{anchor})\n"
                markdown += "\n"
            
            # Add metadata 
            metadata = {
                "url": url,
                "title": title
            }
            
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
            
            # Rest of the function remains the same
            sub_pages_content = ""
            if depth < max_depth:
                for link in sub_links:
                    sub_url = link['url']
                    # Skip if it's just an anchor on the same page or if we've already visited
                    if sub_url == url or sub_url in visited:
                        continue
                        
                    # Add a small delay to be gentle on the server
                    time.sleep(random.uniform(0.3, 0.7))
                    
                    sub_page = scrape_condition_page(sub_url, depth + 1, max_depth, visited)
                    if sub_page:
                        # Add the sub-page content as a new section
                        sub_title = link['text']
                        sub_pages_content += f"## {sub_title}\n\n"
                        # Remove the title from sub-page content to avoid duplication
                        sub_content = sub_page['markdown'].split('\n', 3)[-1] if len(sub_page['markdown'].split('\n')) > 3 else ""
                        sub_pages_content += sub_content + "\n\n"
            
            # Append sub-page content
            if sub_pages_content:
                markdown += "\n" + sub_pages_content
            
            return {
                "title": title,
                "url": url,
                "markdown": markdown,
                "sub_links": sub_links,
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
    table = "knowledge_base"  # Ensure this table exists in Supabase
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
    
def process_nhs_factsheet_to_markdown():
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
        with ThreadPoolExecutor(max_workers=32) as executor:
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
        save_markdown_files(conditions_data)

        start_md_time = time.time()
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