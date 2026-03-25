import os
import re
import json
import time
import random
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from concurrent.futures import ThreadPoolExecutor, as_completed

# Load environment variables from a .env file
load_dotenv()

# Set up Supabase client using environment variables
supabase_url: str = os.getenv("SUPABASE_URL")
supabase_api_key: str = os.getenv("SUPABASE_API_KEY")
supabase: Client = create_client(supabase_url, supabase_api_key)

# Define base URLs for MedlinePlus website
MEDLINE_URL = "https://medlineplus.gov"
BASE_URL = "https://medlineplus.gov/ency/"

# Define alphabet list for navigation
ALPHABET_LINKS = {
    "0-9": "https://medlineplus.gov/ency/encyclopedia_0-9.htm",
    "A": "https://medlineplus.gov/ency/encyclopedia_A.htm",
    "B": "https://medlineplus.gov/ency/encyclopedia_B.htm",
    "C": "https://medlineplus.gov/ency/encyclopedia_C.htm",
    "D": "https://medlineplus.gov/ency/encyclopedia_D.htm",
    "E": "https://medlineplus.gov/ency/encyclopedia_E.htm",
    "F": "https://medlineplus.gov/ency/encyclopedia_F.htm",
    "G": "https://medlineplus.gov/ency/encyclopedia_G.htm",
    "H": "https://medlineplus.gov/ency/encyclopedia_H.htm",
    "I": "https://medlineplus.gov/ency/encyclopedia_I.htm",
    "J": "https://medlineplus.gov/ency/encyclopedia_J.htm",
    "K": "https://medlineplus.gov/ency/encyclopedia_K.htm",
    "L": "https://medlineplus.gov/ency/encyclopedia_L.htm",
    "M": "https://medlineplus.gov/ency/encyclopedia_M.htm",
    "N": "https://medlineplus.gov/ency/encyclopedia_N.htm",
    "O": "https://medlineplus.gov/ency/encyclopedia_O.htm",
    "P": "https://medlineplus.gov/ency/encyclopedia_P.htm",
    "Q": "https://medlineplus.gov/ency/encyclopedia_Q.htm",
    "R": "https://medlineplus.gov/ency/encyclopedia_R.htm",
    "S": "https://medlineplus.gov/ency/encyclopedia_S.htm",
    "T": "https://medlineplus.gov/ency/encyclopedia_T.htm",
    "U": "https://medlineplus.gov/ency/encyclopedia_U.htm",
    "V": "https://medlineplus.gov/ency/encyclopedia_V.htm",
    "W": "https://medlineplus.gov/ency/encyclopedia_W.htm",
    "X": "https://medlineplus.gov/ency/encyclopedia_X.htm",
    "Y": "https://medlineplus.gov/ency/encyclopedia_Y.htm",
    "Z": "https://medlineplus.gov/ency/encyclopedia_Z.htm"
}

def get_article_links():
    """Extract all article links from the encyclopedia pages by letter."""
    all_article_links = []
    
    for letter, letter_url in ALPHABET_LINKS.items():
        try:
            print(f"Getting links for letter {letter}...")
            response = requests.get(letter_url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            
                     
            for a in soup.find("ul", id="index").find_all("a"):
                href = a.get("href")
                print(href)
                
                if not href.startswith('/'):
                    full_url = BASE_URL + href
                    all_article_links.append(full_url)
                
                # if href:
                #     # Handle relative URLs
                #     if href.startswith('/'):
                #         full_url = MEDLINE_URL + href
                #     else:
                #         full_url = href
                        
                #     all_article_links.append(full_url)
                    
            # Add a small delay between requests to be nice to the server
            time.sleep(random.uniform(0.5, 1.0))
            
        except requests.RequestException as e:
            print(f"Error fetching links for letter {letter}: {e}")
           
    return all_article_links

def clean_text(text):
    """Clean and normalize text for markdown formatting."""
    if not text:
        return ""
        
    # Remove extra whitespace and normalize line breaks
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Don't escape all markdown characters as it causes issues
    # Only escape characters that would interfere with markdown structure
    text = re.sub(r'^([*+-])', r'\\\1', text)  # Only escape at start of string or line
    
    return text

def extract_sections(soup):
    """Extract structured sections from the page."""
    sections = {}
    
    # Get the main content area
    main_content = soup.select_one("#topic-summary") or soup.select_one("#d-article")
    if not main_content:
        return {"Overview": []}
    
    # Extract article title
    title_element = soup.select_one("h1.with-also") or soup.select_one("h1")
    article_title = title_element.text.strip() if title_element else "Unknown"
    
    # Initialize with Overview section
    current_section = "Overview"
    sections[current_section] = []
    
    # First, add summary paragraph if it exists
    summary = soup.select_one(".card-summary")
    if summary:
        summary_text = summary.text.strip()
        sections[current_section].append({"type": "paragraph", "content": summary_text})
    
    # Process the main content elements sequentially to organize by sections
    for element in main_content.select("h2, h3, p, ul, ol"):
        # Check if it's a header (new section)
        if element.name in ['h2', 'h3']:
            current_section = element.text.strip()
            if current_section not in sections:
                sections[current_section] = []
        elif element.name == 'p':
            # Skip empty paragraphs
            if element.text.strip():
                sections[current_section].append({"type": "paragraph", "content": element.text.strip()})
        elif element.name == 'ul':
            list_items = [li.text.strip() for li in element.find_all('li') if li.text.strip()]
            if list_items:
                sections[current_section].append({"type": "unordered_list", "items": list_items})
        elif element.name == 'ol':
            list_items = [li.text.strip() for li in element.find_all('li') if li.text.strip()]
            if list_items:
                sections[current_section].append({"type": "ordered_list", "items": list_items})
    
    return sections

def find_sub_links(soup):
    """Extract related links from the page."""
    sub_links = []
    
    # Look for "Related topics" section and other navigation elements
    related_sections = soup.select(".nlm-related-links, .nlm-see-also")
    
    for section in related_sections:
        links = section.find_all('a')
        for link in links:
            href = link.get('href')

            # Skip if href is missing
            if not href:
                continue

            # Handle relative URLs 
            if href.startswith('/'):
                full_url = MEDLINE_URL + href
            elif href.startswith('http'):
                full_url = href
            else:
                full_url = MEDLINE_URL + '/' + href
            
            # Only include MedlinePlus links
            if "medlineplus.gov" in full_url:
                link_text = link.text.strip()
                if link_text:
                    sub_links.append({
                        'url': full_url,
                        'text': link_text
                    })
    
    return sub_links

def scrape_article_page(url, depth=0, max_depth=1, visited=None):
    """Extract relevant information from an article page with retries and format as markdown."""
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

            # Get the article title
            title_element = soup.select_one("h1.with-also") or soup.select_one("h1")
            title = title_element.text.strip() if title_element else "Unknown"
            
            # Find related links
            sub_links = find_sub_links(soup)
            
            # Extract structured sections
            sections = extract_sections(soup)
            
            # Create markdown content
            markdown = f"# {title}\n\n"
            markdown += f"*Source: [{url}]({url})*\n\n"
            
            # Add a table of contents if we have related links
            if sub_links and depth == 0:
                markdown += "## Related Topics\n\n"
                for link in sub_links:
                    markdown += f"* [{link['text']}]({link['url']})\n"
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
            
            # Process related links if we haven't reached the depth limit
            sub_pages_content = ""
            if depth < max_depth:
                for link in sub_links:
                    sub_url = link['url']
                    # Skip if it's just an anchor on the same page or if we've already visited
                    if sub_url == url or sub_url in visited:
                        continue
                        
                    # Add a small delay to be gentle on the server
                    time.sleep(random.uniform(0.3, 0.7))
                    
                    sub_page = scrape_article_page(sub_url, depth + 1, max_depth, visited)
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

def save_articles_to_db(articles_data):
    """Save scraped data to Supabase in bulk."""
    table = "knowledge_base"  # Ensure this table exists in Supabase
    try:
        # Insert the data in batches to avoid request size limitations
        batch_size = 50
        for i in range(0, len(articles_data), batch_size):
            batch = articles_data[i:i + batch_size]
            supabase.table(table).insert(batch).execute()
            print(f"Inserted batch {i//batch_size + 1} with {len(batch)} records.")
    except Exception as e:
        print(f"Error inserting data: {e}")
        
def save_markdown_files(articles_data, output_dir="medlineplus_markdown"):
    """Save each article as an individual markdown file."""
    os.makedirs(output_dir, exist_ok=True)
    
    for article in articles_data:
        # Create a safe filename from the title
        safe_filename = re.sub(r'[^\w\s-]', '', article["title"]).strip().lower()
        safe_filename = re.sub(r'[-\s]+', '-', safe_filename)
        
        # Write to file
        filepath = os.path.join(output_dir, f"{safe_filename}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(article["markdown"])
    
    print(f"Saved {len(articles_data)} markdown files to {output_dir} directory")
    
def process_medlineplus_to_markdown(sample_size=None):
    """Scrape articles concurrently, format as markdown, and save results."""
    try:
        # Record start time
        start_time = time.time()

        # Step 1: Fetch list of article links
        article_links = get_article_links()
        
        # For testing, we can limit to a sample
        if sample_size and isinstance(sample_size, int) and sample_size > 0:
            if sample_size < len(article_links):
                article_links = random.sample(article_links, sample_size)
                print(f"Using a random sample of {sample_size} articles for testing")
        
        links_time = time.time() - start_time
        print(f"Getting {len(article_links)} links took {links_time:.2f} seconds")

        articles_data = []

        # Step 2: Scrape pages concurrently with 10 workers
        start_scrape_time = time.time()
        with ThreadPoolExecutor(max_workers=32) as executor:
            # Map each URL to a future
            future_to_url = {executor.submit(scrape_article_page, url): url for url in article_links}

            # Process completed futures as they finish
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    data = future.result()
                    if data:  # Only append successful results
                        articles_data.append(data)
                except Exception as e:
                    print(f"Error processing {url}: {e}")
        scrape_time = time.time() - start_scrape_time
        print(f"Scraping took {scrape_time:.2f} seconds")

        # Step 3: Save all data to Supabase in batches
        start_db_time = time.time()
        save_articles_to_db(articles_data)
        db_time = time.time() - start_db_time
        print(f"Database insertion took {db_time:.2f} seconds")
        
        # Step 4: Save individual markdown files
        start_md_time = time.time()
        save_markdown_files(articles_data)
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
            "data_count": len(articles_data),
            "time_taken": time_str
        }

    except Exception as e:
        print(f"Error scraping: {e}")
        return {
            "message": f"Error: {e}",
            "data_count": 0,
            "time_taken": "0 seconds"
        }


    