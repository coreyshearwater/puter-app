
import asyncio
import json
import logging
import os
import sys
from playwright.async_api import async_playwright
import uvicorn
from fastapi import FastAPI, Request
from starlette.responses import JSONResponse

# Setup simple logging
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("GrokDriver")

app = FastAPI()
BROWSER_CTX = None # Context
PAGE = None

# Custom User Data Dir to persist session
USER_DATA_DIR = os.path.join(os.getcwd(), "playwright_profile")
if not os.path.exists(USER_DATA_DIR):
    os.makedirs(USER_DATA_DIR)

async def init_browser():
    global BROWSER_CTX, PAGE
    p = await async_playwright().start()
    
    logger.info(f"Using Profile: {USER_DATA_DIR}")
    
    # Launch persistent context
    # This keeps cookies/localStorage between restarts!
    context = await p.chromium.launch_persistent_context(
        user_data_dir=USER_DATA_DIR,
        headless=True, # Set to False if you need to solve a CAPTCHA manually
        channel="chrome", # Use installed chrome
        args=[
            "--disable-blink-features=AutomationControlled", 
            "--no-sandbox", 
            "--disable-infobars"
        ],
        viewport={"width": 1280, "height": 850},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    
    # Try to load injected cookies if they exist (override)
    if os.path.exists("grok_session.json"):
        try:
            with open("grok_session.json", "r") as f:
                cookie_dict = json.load(f)
                
            # Convert to list of dicts for Playwright
            pw_cookies = []
            for k, v in cookie_dict.items():
                domain = ".grok.com"
                if k == "auth_token": domain = ".x.com"
                
                pw_cookies.append({
                    "name": k, "value": v, "domain": domain, "path": "/"
                })
                
            await context.add_cookies(pw_cookies)
            logger.info("Injected manual cookies into browser context.")
        except Exception as e:
            logger.error(f"Cookie injection failed: {e}")

    page = context.pages[0] if context.pages else await context.new_page()
    await page.goto("https://grok.com")
    
    logger.info("Browser Launched. Waiting for manual login if needed...")
    
    BROWSER_CTX = context
    PAGE = page

@app.on_event("startup")
async def startup_event():
    # Don't block startup, launch in background task? No, fastAPI supports async startup
    asyncio.create_task(init_browser())

@app.post("/ask")
async def ask_grok(request: Request):
    global PAGE
    if not PAGE:
        return JSONResponse({"error": "Browser not ready"}, status_code=503)

    body = await request.json()
    msg = body.get("message", "")
    
    if not msg:
        return JSONResponse({"error": "No message provided"}, status_code=400)
    
    try:
        # Ensure we are on grok
        if "grok.com" not in PAGE.url:
             await PAGE.goto("https://grok.com")
        
        # Identify textarea
        # Use reliable selector
        selector = "textarea" 
        try:
            await PAGE.wait_for_selector(selector, timeout=5000)
        except:
             return JSONResponse({"error": "Input box not found. Please log in manually in the popup window."}, status_code=401)
             
        # Look for the last message in the chat that is from the AI
        # This is tricky because the DOM is dynamic.
        # Simple heuristic: wait for the "stop generating" button to disappear?
        # Or wait for a new message bubble to appear.
        
        # 1. Get initial message count
        # initial_count = await PAGE.evaluate("document.querySelectorAll('.message-bubble').length")
        
        await PAGE.fill(selector, msg)
        await PAGE.keyboard.press("Enter")
        
        # 2. Dynamic Wait: Poll for content stability
        # We check the last bubble every 0.5s. If length is same for 3 checks, we assume done.
        last_len = 0
        stable_count = 0
        max_waits = 40 # 20 seconds max (40 * 0.5s)
        
        for _ in range(max_waits):
            await asyncio.sleep(0.5)
            
            try:
                current_text = await PAGE.evaluate("""
                    () => {
                        const bubbles = Array.from(document.querySelectorAll('.prose, div[class*="message"], div[class*="bubble"]'));
                        return bubbles.length > 0 ? bubbles[bubbles.length - 1].innerText : "";
                    }
                """)
                curr_len = len(str(current_text))
                
                if curr_len > 0 and curr_len == last_len:
                    stable_count += 1
                else:
                    stable_count = 0
                
                last_len = curr_len
                
                # If stable for 1.5 seconds (3 polls), it's likely finished
                if stable_count >= 3 and curr_len > 10:
                    break
            except:
                pass

        response_text = "Init Default"
        try:
            # Final Scrape
            js_code = """
            () => {
                const bubbles = Array.from(document.querySelectorAll('.prose, div[class*="message"], div[class*="bubble"]'));
                if (bubbles.length > 0) {
                    let text = bubbles[bubbles.length - 1].innerText;
                    // Clean up any common artifacts
                    return text.trim();
                }
                const ps = Array.from(document.querySelectorAll('p'));
                if (ps.length > 0) {
                     return ps[ps.length - 1].innerText.trim();
                }
                return document.body.innerText.slice(-2000).trim();
            }
            """
            response_text = await PAGE.evaluate(js_code)
        except Exception as e:
            response_text = f"Scrape Error in Driver: {e}"
        
        print(f"[Driver] Scraped response length: {len(str(response_text))}")
        print(f"[Driver] First 100 chars: {str(response_text)[:100]}")
        
        return {"status": "sent", "response": str(response_text)}
        
    except Exception as e:
        logger.error(f"Error executing browser action: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

if __name__ == "__main__":
    uvicorn.run("grok_driver:app", host="127.0.0.1", port=8001, reload=False)
