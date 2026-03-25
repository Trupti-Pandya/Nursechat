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

# Base MedlinePlus Encyclopedia URLs
MAIN_ENCYCLOPEDIA_URL = "https://medlineplus.gov/encyclopedia.html"
ENCYCLOPEDIA_BASE = "https://medlineplus.gov/ency/"

# Table in Supabase where we'll store the results
SUPABASE_TABLE = "conditions2mdByBS"  # or another table name if preferred

def clean_text(text: str) -> str:
    """
    Clean and normalize text for Markdown formatting.
    We keep as much context as possible, but do minimal formatting to prevent breakage.
    """
    # Replace multiple whitespaces with single space
    text = re.sub(r'\s+', ' ', text).strip()
    # Only escape characters that might break markdown lists at line start
    text = re.sub(r'^([*+-])', r'\\\1', text, flags=re.MULTILINE)
    return text

def get_alphabetical_links() -> list:
    """
    Scrape the main encyclopedia page to gather A-Z (and 0-9) links.
    Returns a list of absolute URLs for each letter index page.
    """
    links = []
    try:
        print(f"Fetching main encyclopedia page: {MAIN_ENCYCLOPEDIA_URL}")
        response = requests.get(MAIN_ENCYCLOPEDIA_URL, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # The alphabetical links are typically in a list or table. 
        # We look for anchor tags containing "encyclopedia_"
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "encyclopedia_" in href:
                # Convert relative links to absolute
                if href.startswith("ency/"):
                    link = f"https://medlineplus.gov/{href}"
                elif href.startswith("http"):
                    link = href  # Already absolute
                else:
                    link = f"https://medlineplus.gov/ency/{href}"  # Fix potential missing base

                links.append(link)

        # Remove duplicates
        links = list(set(links))
        print(f"Found {len(links)} letter index links.")
    except requests.RequestException as e:
        print(f"Failed to fetch alphabetical links: {e}")
    return sorted(links)

def get_condition_links(letter_url: str) -> list:
    """
    From a single letter index page (e.g., 'encyclopedia_A.htm'), extract individual condition links.
    Returns a list of absolute URLs.
    """
    condition_links = []
    try:
        print(f"Fetching letter index page: {letter_url}")
        response = requests.get(letter_url, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # Condition links are typically in <ul> or <div> with anchor tags.
        # Adjust this selector if the site structure changes.
        for a in soup.select("ul a[href], div a[href]"):
            href = a["href"]
            if href.startswith("/ency/") and href.endswith(".htm"):
                full_link = "https://medlineplus.gov" + href
                condition_links.append(full_link)
            elif href.startswith("http") and "medlineplus.gov/ency/" in href:
                condition_links.append(href)

        condition_links = list(set(condition_links))
        print(f"Found {len(condition_links)} condition links in {letter_url}")
    except requests.RequestException as e:
        print(f"Failed to fetch condition links from {letter_url}: {e}")
    return condition_links

def extract_sections(soup: BeautifulSoup) -> dict:
    """
    Extract structured sections from a condition page, 
    preserving headings, paragraphs, and lists.
    Returns a dictionary of {section_title: [list_of_content_objects]}.
    """
    sections = {}

    # Attempt to locate a main content area, or fallback to entire body
    main_content = soup.find("div", {"id": "mainContent"}) or soup

    # For MedlinePlus, headings can be h2, h3, or sometimes h1 is repeated
    # Start with a default "Overview" if no headings appear
    current_section = "Overview"
    sections[current_section] = []

    # We'll look for headings and text-based tags in sequence
    # This is flexible; if the structure changes, adjust accordingly
    content_elements = main_content.find_all(["h2", "h3", "h4", "p", "ul", "ol"])

    for element in content_elements:
        if element.name in ["h2", "h3", "h4"]:
            current_section = clean_text(element.get_text())
            sections[current_section] = []
        elif element.name == "p":
            text = clean_text(element.get_text())
            if text:
                sections[current_section].append({"type": "paragraph", "content": text})
        elif element.name in ["ul", "ol"]:
            list_items = [clean_text(li.get_text()) for li in element.find_all("li")]
            if element.name == "ul":
                sections[current_section].append({"type": "unordered_list", "items": list_items})
            else:
                sections[current_section].append({"type": "ordered_list", "items": list_items})

    return sections

def find_sub_links(soup: BeautifulSoup, base_url: str) -> list:
    """
    Optionally find sub-links within a condition page, 
    if you want to recursively scrape deeper content (like "Patient instructions").
    Returns a list of dicts with 'url' and 'text'.
    """
    sub_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        link_text = a.get_text(strip=True)
        if not href or not link_text:
            continue

        # Convert relative to absolute
        if href.startswith("/ency/"):
            full_url = "https://medlineplus.gov" + href
        elif href.startswith("http"):
            full_url = href
        else:
            # Possibly a fragment or something else
            full_url = None

        # Filter out images or irrelevant links
        if full_url and full_url.startswith("https://medlineplus.gov/ency/"):
            sub_links.append({"url": full_url, "text": link_text})

    # Remove duplicates
    unique_sub_links = []
    seen = set()
    for link in sub_links:
        if link["url"] not in seen:
            unique_sub_links.append(link)
            seen.add(link["url"])

    return unique_sub_links

def scrape_condition_page(url: str, depth=0, max_depth=1, visited=None) -> dict:
    """
    Scrape a single MedlinePlus condition page. Returns a dict with:
      {
        "title": ...,
        "url": ...,
        "markdown": ...,
        "sub_links": ...,
        "raw_content": ...
      }
    """
    if visited is None:
        visited = set()

    # Avoid repeated visits or exceeding recursion depth
    if url in visited or depth > max_depth:
        return None

    visited.add(url)

    for attempt in range(3):
        try:
            print(f"Scraping {url} (depth {depth})")
            response = requests.get(url, timeout=20)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            # Grab page title
            title_tag = soup.find("h1")
            title = title_tag.get_text(strip=True) if title_tag else "Untitled"

            # Find sub-links (if you want to recursively scrape them)
            sub_links = find_sub_links(soup, url)

            # Extract structured sections
            sections = extract_sections(soup)

            # Build Markdown
            markdown = f"# {title}\n\n"
            markdown += f"*Source: [{url}]({url})*\n\n"

            # Table of contents for sub-links (only on the top-level page)
            if sub_links and depth == 0:
                markdown += "## Contents\n\n"
                for link in sub_links:
                    link_text = link['text']
                    anchor = link_text.lower().replace(' ', '-').replace('/', '-')
                    markdown += f"* [{link_text}](#{anchor})\n"
                markdown += "\n"

            # Process each section into Markdown
            for section_title, content_list in sections.items():
                if not content_list:
                    continue
                markdown += f"## {section_title}\n\n"
                for item in content_list:
                    if item["type"] == "paragraph":
                        markdown += f"{item['content']}\n\n"
                    elif item["type"] == "unordered_list":
                        for li in item["items"]:
                            markdown += f"* {li}\n"
                        markdown += "\n"
                    elif item["type"] == "ordered_list":
                        for i, li in enumerate(item["items"], 1):
                            markdown += f"{i}. {li}\n"
                        markdown += "\n"

            # Recursively scrape sub-links if desired
            sub_pages_content = ""
            if depth < max_depth:
                for link in sub_links:
                    sub_url = link['url']
                    if sub_url == url or sub_url in visited:
                        continue
                    # Throttle requests
                    time.sleep(random.uniform(0.3, 0.7))
                    sub_page_data = scrape_condition_page(sub_url, depth + 1, max_depth, visited)
                    if sub_page_data:
                        # Insert sub-page content as a new section
                        sub_title = link['text']
                        sub_pages_content += f"## {sub_title}\n\n"
                        # Remove repeated title line from sub-page content
                        sub_markdown_parts = sub_page_data["markdown"].split('\n', 3)
                        if len(sub_markdown_parts) > 3:
                            sub_content = sub_markdown_parts[3]
                        else:
                            sub_content = sub_page_data["markdown"]
                        sub_pages_content += sub_content + "\n\n"

            if sub_pages_content:
                markdown += sub_pages_content

            return {
                "title": title,
                "url": url,
                "markdown": markdown,
                "sub_links": sub_links,
                "raw_content": json.dumps(sections)
            }

        except requests.RequestException as e:
            print(f"Attempt {attempt + 1} failed for {url}: {e}")
            if attempt < 2:
                time.sleep(random.uniform(0.5, 1))
            else:
                print(f"Failed to scrape {url} after 3 attempts.")
                return None

def save_conditions_to_db(conditions_data: list):
    """
    Insert scraped data into Supabase in bulk.
    The table schema must accommodate the 'title', 'url', 'markdown', etc.
    """
    try:
        supabase.table(SUPABASE_TABLE).insert(conditions_data).execute()
        print(f"Inserted {len(conditions_data)} records into Supabase.")
    except Exception as e:
        print(f"Error inserting data into Supabase: {e}")

def save_markdown_files(conditions_data: list, output_dir="markdown_output"):
    """
    Save each condition's markdown content to a separate .md file.
    """
    os.makedirs(output_dir, exist_ok=True)
    for condition in conditions_data:
        safe_filename = re.sub(r'[^\w\s-]', '', condition["title"]).strip().lower()
        safe_filename = re.sub(r'[-\s]+', '-', safe_filename)
        filepath = os.path.join(output_dir, f"{safe_filename}.md")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(condition["markdown"])

    print(f"Saved {len(conditions_data)} markdown files to '{output_dir}'")

def process_medline_factsheet_to_markdown():
    """
    Main function to:
      1. Fetch A-Z index links
      2. Extract condition links
      3. Scrape condition pages (concurrently)
      4. Save data to Supabase
      5. Save to Markdown files
    """
    try:
        start_time = time.time()

        # Step 1: Get all alphabetical index pages
        az_links = get_alphabetical_links()

        # Step 2: Collect condition links from each letter page
        all_condition_links = []
        for link in az_links:
            all_condition_links.extend(get_condition_links(link))
        all_condition_links = list(set(all_condition_links))
        print(f"Total unique condition links across all letters: {len(all_condition_links)}")

        # Step 3: Scrape each condition page concurrently
        conditions_data = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_url = {executor.submit(scrape_condition_page, url): url for url in all_condition_links}
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    data = future.result()
                    if data:
                        conditions_data.append(data)
                except Exception as e:
                    print(f"Error scraping {url}: {e}")

        # Step 4: Save to Supabase
        save_conditions_to_db(conditions_data)

        # Step 5: Save to local Markdown files
        save_markdown_files(conditions_data, output_dir="medline_markdown")

        # Print total time
        elapsed = time.time() - start_time
        if elapsed < 60:
            print(f"Scraping completed in {elapsed:.2f} seconds.")
        else:
            mins = int(elapsed // 60)
            secs = elapsed % 60
            print(f"Scraping completed in {mins} minutes and {secs:.2f} seconds.")

        return {
            "message": "Scraping completed. Data saved to Supabase and Markdown files.",
            "data_count": len(conditions_data),
            "time_taken_seconds": elapsed
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping MedlinePlus: {e}")

