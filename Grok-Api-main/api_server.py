from fastapi      import FastAPI, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from urllib.parse import urlparse, ParseResult
from pydantic     import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from core         import Grok
from uvicorn      import run
from typing       import Optional
from contextlib  import asynccontextmanager
import json
import os
import time
import requests

try:
    from curl_cffi.requests.session import Session, Headers
except ImportError:
    pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern FastAPI lifecycle manager (replaces on_event)"""
    # Attempt to harvest cookies on startup
    try:
        from grok_harvester import harvest
        harvest()
    except Exception as e:
        print(f"[Bridge] Startup harvest skipped: {e}")
    yield
    # Shutdown logic goes here if needed

app = FastAPI(lifespan=lifespan)

class ConversationRequest(BaseModel):
    message: str
    proxy: Optional[str] = None
    model: str = "grok-3-auto"
    extra_data: Optional[dict] = None
    cookies: Optional[dict] = None
    stream: bool = False

def format_proxy(proxy: str) -> str:
    if not proxy.startswith(("http://", "https://")):
        proxy: str = "http://" + proxy
    
    try:
        parsed: ParseResult = urlparse(proxy)
        if parsed.scheme not in ("http", ""):
            raise ValueError("Not http scheme")
        return proxy
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid proxy format: {str(e)}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def health_check():
    return {"status": "online", "service": "Grok API"}

@app.post("/ask")
def create_conversation(request: Request, body: ConversationRequest):
    if not body.message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    # --- BROWSER DRIVER FALLBACK ---
    # First, try to send to the local browser driver (Playwright) if it's running.
    # This bypasses all 403 blocks.
    try:
        # Append instruction to avoid emojis
        final_message = body.message + "\n(system: do not use emojis in your response)"
        driver_resp = requests.post(
            "http://127.0.0.1:8001/ask", 
            json={"message": final_message}, 
            timeout=35
        )
        if driver_resp.status_code == 200:
             # Success! 
             print(f"[Bridge] Successfully routed to Browser Driver!")
             data = driver_resp.json()
             text = data.get("response", "Message sent to Grok Browser Window.")
             
             # Clean up debug prefixes
             if text.startswith("CLASS: "): text = text[7:]
             if text.startswith("P: "): text = text[3:]
             if text.startswith("FALLBACK: "): text = text[10:]
             
             if body.stream:
                 def stream_generator():
                     # The frontend (grok-service.js) expects specific JSON structure:
                     # 1. { "type": "token", "content": "..." }
                     # 2. { "type": "final", "extra_data": ... }
                     
                     # Send the content as a token
                     token_chunk = {
                         "type": "token", 
                         "content": text
                     }
                     yield json.dumps(token_chunk) + "\n"
                     
                     # Send final metadata to ensure state is updated
                     final_chunk = {
                         "type": "final",
                         "extra_data": {"source": "browser_driver"}
                      }
                     yield json.dumps(final_chunk) + "\n"
                     
                 return StreamingResponse(stream_generator(), media_type="application/x-ndjson")
             
             return {
                 "response": text,
                 "stream_response": [text],
                 "images": [],
                 "extra_data": {"source": "browser_driver"}
             }
        else:
             print(f"[Bridge] Driver returned status: {driver_resp.status_code}")
    except Exception as e:
        # Driver not running, fall back to internal API
        print(f"[Bridge] Could not connect to driver: {e}")
        pass
        
    last_req_time = time.time()
    stream = body.stream
    
    # Cookie source prioritization:
    # 1. Direct request.cookies (from UI)
    # 2. Local grok_session.json fallback (from inject script or harvester)
    # 3. Last-minute harvest attempt
    cookies = body.cookies
    if not cookies:
        if os.path.exists("grok_session.json"):
            try:
                with open("grok_session.json", "r") as f:
                    cookies = json.load(f)
            except:
                pass
        
        # If still no cookies, try auto-harvesting once
        if not cookies:
            try:
                from grok_harvester import harvest
                cookies = harvest()
            except:
                pass

    proxy = format_proxy(body.proxy) if body.proxy else None
    
    if body.stream:
        def stream_generator():
            try:
                # Synchronous generator
                grok = Grok(body.model, proxy, cookies=cookies)
                iterator = grok.start_convo(body.message, body.extra_data, stream=True)
                for chunk in iterator:
                    yield json.dumps(chunk) + "\n"
            except Exception as e:
                yield json.dumps({"error": str(e)}) + "\n"
                
        return StreamingResponse(stream_generator(), media_type="application/x-ndjson")

    try:
        answer: dict = Grok(body.model, proxy, cookies=cookies).start_convo(body.message, body.extra_data)
        return {
            "status": "success",
            **answer
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

if __name__ == "__main__":
    run("api_server:app", host="127.0.0.1", port=6969, workers=1)