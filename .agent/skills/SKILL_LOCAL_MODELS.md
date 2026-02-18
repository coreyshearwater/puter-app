---
name: Local GGUF Model Integration
description: Detailed implementation plan for adding local GGUF model support to GravityChat.
---

# Local Models Implementation Plan

## 1. Objective
Add support for running local LLMs (GGUF format) using `llama-cpp-python` server. The integration should be seamless, allowing the user to toggle between "Cloud" and "Local" modes and browse/load models from their filesystem.

## 2. Hardware Constraints (Quadro P2000 - 4GB VRAM)
- **Supported Models**: GGUF (Quantized).
- **Recommended**: TinyLlama-1.1B, Qwen-1.5B-Chat, Phi-3-Mini (3.8B), Mistral-7B (heavily quantized).
- **Strategy**: Offload as much layers to GPU as possible, fallback to CPU.

## 3. Architecture

### Backend (`local_llm_server.py`)
A new lightweight FastAPI server that wraps `llama_cpp.server`.
- **Port**: 8002
- **Endpoints**:
    - `POST /v1/chat/completions` (OpenAI compatible)
    - `POST /load_model` (Custom: Loads a GGUF file path)
    - `POST /unload_model` (Custom: Frees VRAM)
    - `GET /status` (Returns loaded model name + VRAM usage)

### File System
- Root Directory: `local_models/`
- User can drop `.gguf` files here.

### Frontend
- **Sidebar Toggle**: "Local Mode" switch next to Premium.
- **Model Selector**:
    - When Local Mode is ON, the standard Model Dropdown is replaced or augmented by a "Local Model Manager".
    - "Load Model" button triggers a file picker (simulated or native via `puter.ui`).
    - Status Indicator: "🟢 Phi-3-Mini running" or "🔴 No Model Loaded".

## 4. Implementation Steps

### Step 1: Environment Setup
- [ ] Add `llama-cpp-python` to `requirements.txt` (or install manually).
    - Command: `pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121` (for CUDA 12).
- [ ] Create `local_models` folder.

### Step 2: Backend Service
- [ ] Create `local_llm_server.py`.
- [ ] Implement `LazyLoader` pattern: The server starts *empty* (0 VRAM usage). It only loads weights when the UI requests it.

### Step 3: Launcher Integration
- [ ] Update `launcher.py` to start `local_llm_server.py` (Port 8002).
- [ ] Ensure it dies cleanly with the Job Object (already handled).

### Step 4: UI Development (`sidebar/models.js`)
- [ ] Add HTML for the "Local vs Cloud" toggle.
- [ ] Create `LocalModelManager` class in JS.
- [ ] Implement `selectLocalModel()` function.

### Step 5: Chat Integration (`ai.js`)
- [ ] In `getGlobalModel()`, check `AppState.useLocalModel`.
- [ ] If true, redirect API calls to `http://localhost:8002`.

## 5. UI Design (Vibecoding)
- **Toggle**: Neon Green (Local) vs Cyan (Cloud).
- **Load Button**: "Import GGUF" (Glassmorphic).
- **Status**: Pulse animation when model is loading (it takes 5-10s).

## 6. Questions & Risks
- **Risk**: User loads a 70B model -> OOM Crash.
    - *Mitigation*: We wrap the load in `try/catch` and report "Out of Memory" to UI.
- **Risk**: `llama-cpp-python` installation issues.
    - *Mitigation*: We try to use the pre-built wheel.

