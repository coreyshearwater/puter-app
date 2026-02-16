import requests
import re
import os
import time

BASE_URL = "https://docs.puter.com"
OUTPUT_FILE = "puter-docs-manual.html"

def get_links(html):
    # Regex to find links in the sidebar or main content
    # Looking for hrefs that start with / and have at least 2 segments like /FS/write
    # or fully qualified https://docs.puter.com/...
    links = set()
    
    # Match relative links
    rel_pattern = re.compile(r'href="(/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?)"')
    for match in rel_pattern.finditer(html):
        links.add(match.group(1))
        
    # Match absolute links
    abs_pattern = re.compile(r'href="' + re.escape(BASE_URL) + r'(/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?)"')
    for match in abs_pattern.finditer(html):
        links.add(match.group(1))
        
    return sorted(list(links))

def clean_content(html):
    # Extract content between <div class="docs-content ..."> and footer/sidebar
    # This is rough without BS4, but let's try to grab header to footer or specific div
    
    # Try to find the start of the content
    start_marker = '<div id="docs-content-'
    end_marker = '<div class="next-prev-buttons">'
    
    start_idx = html.find(start_marker)
    if start_idx == -1:
        # Fallback: look for <h1> or similar
        start_idx = html.find('<h1')
    
    end_idx = html.find(end_marker)
    if end_idx == -1:
        end_idx = html.find('<footer')
        
    if start_idx != -1 and end_idx != -1:
        return html[start_idx:end_idx]
    
    # If extraction fails, return body content if possible
    body_start = html.find('<body')
    body_end = html.find('</body>')
    if body_start != -1 and body_end != -1:
        return html[body_start:body_end]
        
    return html

def main():
    print(f"Fetching index from {BASE_URL}...")
    try:
        resp = requests.get(BASE_URL)
        resp.raise_for_status()
        index_html = resp.text
    except Exception as e:
        print(f"Failed to fetch index: {e}")
        return

    links = get_links(index_html)
    print(f"Found {len(links)} pages to fetch.")
    
    # Filter links to likely documentation pages (simple heuristic)
    # We want /FS/..., /AI/..., etc.
    # Exclude styles, assets, etc.
    doc_links = [l for l in links if not l.startswith('/assets') and not l.startswith('/_')]
    
    full_content = []
    
    # Add CSS/Head for basic styling
    full_content.append("""
    <html>
    <head>
        <meta charset="utf-8">
        <title>Puter.js Full Documentation</title>
        <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
            pre { background: #f4f4f4; padding: 10px; overflow-x: auto; border-radius: 4px; }
            code { font-family: monospace; background: #eee; padding: 2px 4px; border-radius: 2px; }
            h1, h2, h3 { color: #333; margin-top: 2em; }
            a { color: #0066cc; }
            .section-break { border-bottom: 2px solid #ccc; margin: 40px 0; }
        </style>
    </head>
    <body>
        <h1>Puter.js Documentation</h1>
        <p>Generated on """ + time.strftime("%Y-%m-%d") + """</p>
        <div id="toc">
            <h2>Table of Contents</h2>
            <ul>
    """)
    
    # Add TOC entries
    for link in doc_links:
        full_content.append(f'<li><a href="#{link}">{link}</a></li>')
    
    full_content.append("""
            </ul>
        </div>
        <div class="content">
    """)
    
    # Fetch content
    for link in doc_links:
        url = BASE_URL + link
        print(f"Fetching {url}...")
        try:
            p_resp = requests.get(url)
            p_resp.raise_for_status()
            content = clean_content(p_resp.text)
            
            # Add an anchor for TOC
            full_content.append(f'<div class="section-break" id="{link}"></div>')
            full_content.append(f'<h2>Section: {link}</h2>')
            full_content.append(content)
            
            time.sleep(0.5) # Be nice to the server
        except Exception as e:
            print(f"Error fetching {link}: {e}")
            full_content.append(f'<p style="color:red">Error fetching {link}</p>')

    full_content.append("""
        </div>
    </body>
    </html>
    """)
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(full_content))
        
    print(f"Done! Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
