
import os
import sys
import gc
import json
import logging
from typing import List, Optional, Union
from pydantic import BaseModel, Field
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse
from llama_cpp import Llama

# Configure logging
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("LocalLLM")

app = FastAPI(title="Local LLM Server (OpenAI Compatible)")

# CORS Middleware
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev/electron
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Model State
MODEL: Optional[Llama] = None
MODEL_PATH: Optional[str] = None
# Default Generation Params
DEFAULT_GENERATION_PARAMS = {
    "n_ctx": 4096,         # Context window
    "n_gpu_layers": -1,    # Auto-offload all layers to GPU (if VRAM allows)
    "n_batch": 512,        # Batch size for prompt processing
    "verbose": False       # Cleaner logs
}

# --- Pydantic Models for Request Validation ---

class ModelLoadRequest(BaseModel):
    path: str
    n_ctx: int = 4096
    n_gpu_layers: int = -1  # -1 = All layers

class ChatMessage(BaseModel):
    role: str
    content: str
    name: Optional[str] = None

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = "local-model"
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    max_tokens: Optional[int] = None
    stream: Optional[bool] = False
    stop: Optional[Union[str, List[str]]] = None
    frequency_penalty: Optional[float] = 0.0
    presence_penalty: Optional[float] = 0.0

# --- Helper Functions ---

def unload_model():
    """Forcefully unload the model from VRAM."""
    global MODEL, MODEL_PATH
    if MODEL:
        logger.info("Unloading model...")
        del MODEL
        MODEL = None
        MODEL_PATH = None
        gc.collect() # Python Garbage Collector
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass # No torch installed, likely using pure llama-cpp which manages its own memory via C++ destructors
    logger.info("Model unloaded. VRAM freed.")

def load_model(path: str, n_ctx: int = 4096, n_gpu_layers: int = -1):
    """Load a GGUF model."""
    global MODEL, MODEL_PATH
    
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Model file not found: {path}")
    
    # Unload previous first
    if MODEL:
        unload_model()
        
    logger.info(f"Loading model from: {path}")
    try:
        MODEL = Llama(
            model_path=path,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            n_batch=512,
            verbose=True
        )
        MODEL_PATH = path
        logger.info(f"Model loaded successfully: {path}")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        MODEL = None # Ensure clean state
        raise HTTPException(status_code=500, detail=str(e))

# --- Endpoints ---

@app.get("/health")
def health_check():
    return {"status": "ok", "loaded": MODEL is not None, "model_path": MODEL_PATH}

@app.post("/v1/models/load")
def api_load_model(req: ModelLoadRequest):
    load_model(req.path, req.n_ctx, req.n_gpu_layers)
    return {"status": "loaded", "path": req.path}

@app.post("/v1/models/unload")
def api_unload_model():
    unload_model()
    return {"status": "unloaded"}

@app.get("/v1/models")
def list_models():
    """List available local models (scanned from directory)."""
    models_dir = os.path.join(os.getcwd(), "local_models")
    if not os.path.exists(models_dir):
        os.makedirs(models_dir)
        
    model_files = []
    # Scan directory for .gguf files
    for f in os.listdir(models_dir):
        if f.endswith(".gguf"):
            model_files.append({
                "id": f, 
                "object": "model", 
                "owned_by": "user", 
                "permission": [],
                "meta": {
                    "is_loaded": (MODEL_PATH and f in MODEL_PATH),
                    "size_mb": round(os.path.getsize(os.path.join(models_dir, f)) / (1024 * 1024), 2)
                }
            })
            
    return {"object": "list", "data": model_files}

@app.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    global MODEL
    
    if not MODEL:
        raise HTTPException(status_code=503, detail="No model loaded. Please load a model first via /v1/models/load.")
    
    # Prepare messages format (llama-cpp-python handles chat templates internally usually, 
    # but we pass the raw list of dicts which it supports)
    messages_dicts = [{"role": m.role, "content": m.content} for m in req.messages]
    
    stop_tokens = req.stop if req.stop else []
    if isinstance(stop_tokens, str):
        stop_tokens = [stop_tokens]
        
    # Standard generation params
    gen_params = {
        "messages": messages_dicts,
        "temperature": req.temperature,
        "top_p": req.top_p,
        "max_tokens": req.max_tokens if req.max_tokens else 0, # 0 = infinite (until context limit)
        "stop": stop_tokens,
        "stream": req.stream,
        "frequency_penalty": req.frequency_penalty,
        "presence_penalty": req.presence_penalty
    }

    try:
        if req.stream:
            # Streaming Response
            def stream_generator():
                stream = MODEL.create_chat_completion(**gen_params)
                for chunk in stream:
                    yield json.dumps(chunk) # Llama-cpp returns dicts, need JSON string for SSE? 
                    # Wait, sse-starlette usually takes dict or string. 
                    # But OpenAI SSE format is "data: {...}\n\n". 
                    # Llama-cpp stream yields dicts that mimic OpenAI chunks.
                    # Startlette EventSourceResponse handles the wrapping if we yield dicts?
                    # Let's verify. Usually create_chat_completion with stream=True returns a generator of dicts.
                
            # Using EventSourceResponse for correct SSE formatting
            return EventSourceResponse(MODEL.create_chat_completion(**gen_params))
        else:
            # Non-streaming
            response = MODEL.create_chat_completion(**gen_params)
            return JSONResponse(content=response)
            
    except Exception as e:
        logger.error(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/v1/models/{filename}")
def delete_model_file(filename: str):
    """Delete a local GGUF model file."""
    # Security: Ensure filename is just a filename, not a path traversal
    filename = os.path.basename(filename) 
    models_dir = os.path.join(os.getcwd(), "local_models")
    path = os.path.join(models_dir, filename)
    
    if os.path.exists(path):
        try:
            # If current model, unload it first
            if MODEL_PATH and os.path.abspath(MODEL_PATH) == os.path.abspath(path):
                unload_model()
            os.remove(path)
            return {"status": "deleted", "filename": filename}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/v1/system/info")
def system_info():
    """Get system info for hardware estimation."""
    import platform
    import psutil
    
    info = {
        "platform": platform.platform(),
        "processor": platform.processor(),
        "ram_gb": round(psutil.virtual_memory().total / (1024**3), 2),
        "params_defaults": DEFAULT_GENERATION_PARAMS
    }
    
    # Try to get VRAM via simple methods if possible (often needs external libs or nvml)
    # We will simulate/estimate on frontend mostly, but if we can get it here:
    try:
        from llama_cpp import Llama
        # llama-cpp doesn't expose an easy static gpu check without loading.
        pass
    except:
        pass
        
    return info

@app.get("/v1/models/search")
def search_hf_models(query: str = "GGUF", limit: int = 15):
    """Search Hugging Face for GGUF models."""
    try:
        from huggingface_hub import HfApi
        api = HfApi()
        # Search for models with 'gguf' tag or check name
        models = api.list_models(
            search=query,
            filter="gguf",
            sort="downloads",
            direction=-1,
            limit=limit
        )
        results = []
        for m in models:
            results.append({
                "id": m.modelId,
                "downloads": m.downloads,
                "likes": m.likes,
                "tags": m.tags,
                "pipeline_tag": m.pipeline_tag,
                "last_modified": m.lastModified.isoformat() if m.lastModified else None,
                "author": m.author,
                "siblings_count": len(m.siblings) if m.siblings else 0
            })
        return {"data": results}
    except Exception as e:
        logger.error(f"HF Search failed: {e}")
        return {"data": [], "error": str(e)}

class DownloadRequest(BaseModel):
    repo_id: str
    filename: str

@app.post("/v1/models/download")
async def download_model(req: DownloadRequest):
    """Trigger a download (stub/simple synchronous for now)."""
    # This is a blocking operation in this simple server. 
    # For production, utilize background tasks.
    try:
        from huggingface_hub import hf_hub_download
        
        logger.info(f"Downloading {req.filename} from {req.repo_id}...")
        
        # Download to local_models
        models_dir = os.path.join(os.getcwd(), "local_models")
        
        # hf_hub_download usually downloads to cache -> we want it in our folder
        # We can symlink or move, OR verify where it specifically goes.
        # Actually hf_hub_download(..., local_dir=...) is supported.
        
        path = hf_hub_download(
            repo_id=req.repo_id,
            filename=req.filename,
            local_dir=models_dir,
            local_dir_use_symlinks=False
        )
        
        return {"status": "success", "path": path}
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Run on port 8002
    print("🧠 Local LLM Server starting on port 8003...")
    uvicorn.run(app, host="127.0.0.1", port=8003)
