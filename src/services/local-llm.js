import { AppState } from '../state.js';
import { showToast } from '../utils/toast.js';
import { CONFIG } from '../config.js';

const LOCAL_LLM_URL = CONFIG.LOCAL_LLM_URL;

/**
 * Check if the Local LLM server is reachable
 * Attempts to connect with retries if needed (optional implementation detail, keeping it simple for now)
 */
export async function checkLocalServerStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.CONNECT_TIMEOUT_MS);
        
        const response = await fetch(`${LOCAL_LLM_URL}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            return {
                online: true,
                loaded: data.loaded,
                model: data.model_path ? data.model_path.split('\\').pop().split('/').pop() : null
            };
        }
    } catch (error) {
        // Offline
    }
    return { online: false, loaded: false, model: null };
}

/**
 * List available GGUF models from the backend
 */
export async function listLocalModels() {
    try {
        const response = await fetch(`${LOCAL_LLM_URL}/v1/models`);
        if (!response.ok) throw new Error('Server error');
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('[LocalLLM] List models failed:', error);
        return [];
    }
}

/**
 * Search Hugging Face (proxied via backend to avoid CORS/RateLimits if needed, or direct)
 * We implemented a backend proxy at /v1/models/search
 */
export async function searchHF(query) {
    // Try Backend Proxy first (avoids CORS if configured, handles rate limits)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for backend search
        
        const response = await fetch(`${LOCAL_LLM_URL}/v1/models/search?query=${encodeURIComponent(query)}&limit=20`, { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return data.data || [];
        }
        throw new Error('Backend unavailable');
    } catch (err) {
        console.warn('[LocalLLM] Backend search failed, falling back to direct HF API:', err);
        
        // Fallback: Direct HF API (Client-side)
        // Note: HF API allows direct CORS for read-only public endpoints usually.
        try {
            const hfResponse = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(query)}&filter=gguf&sort=downloads&direction=-1&limit=20`);
            if (!hfResponse.ok) throw new Error('HF API Error');
            
            const models = await hfResponse.json();
            return models.map(m => ({
                id: m.modelId,
                downloads: m.downloads,
                likes: m.likes,
                tags: m.tags
            }));
        } catch (hfErr) {
            console.error('[LocalLLM] Direct HF search failed:', hfErr);
            showToast('Could not search HuggingFace (Offline?)', 'error');
            return [];
        }
    }
}

/**
 * Load a specific model
 */
export async function loadLocalModel(filename) {
    const modelsDir = `${await puter.fs.pwd()}/local_models`.replace(/\\/g, '/'); // Helper to guess path, backend usually knows its own root
    // Actually, backend scanning uses its own CWD/local_models.
    // We just pass the filename or relative path?
    // Our backend list_models returns "id": "filename.gguf".
    // AND the backend load_model expects a full path or relative?
    // Let's modify backend to accept just filename and look in local_models dir, OR send full path.
    // Ideally, we send the full path constructed by the backend's knowledge.
    
    // Simplification: The backend `list_models` returns the filename as ID.
    // The backend `load_model` expects `path`. 
    // Let's assume we construct the path on the backend or frontend.
    // For now, let's send the relative path "local_models/filename" 
    
    const path = `local_models/${filename}`;
    
    showToast(`Loading ${filename}... (This may take 10-20s)`, 'info');
    
    try {
        const response = await fetch(`${LOCAL_LLM_URL}/v1/models/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: path,
                n_ctx: 4096,
                n_gpu_layers: -1 // Auto
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Load failed');
        }
        
        showToast('Local Model Loaded!', 'success');
        return true;
    } catch (error) {
        console.error('[LocalLLM] Load failed:', error);
        showToast(`Load failed: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Unload the current model (Free VRAM)
 */
export async function unloadLocalModel() {
    try {
        await fetch(`${LOCAL_LLM_URL}/v1/models/unload`, { method: 'POST' });
        showToast('Model unloaded (VRAM freed)', 'success');
        return true;
    } catch (error) {
        showToast('Unload failed', 'error');
        return false;
    }
}

/**
 * Delete a local model file
 */
export async function deleteLocalModel(filename) {
    try {
        const response = await fetch(`${LOCAL_LLM_URL}/v1/models/${filename}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Delete failed');
        showToast(`Deleted ${filename}`, 'success');
        return true;
    } catch (error) {
        console.error('[LocalLLM] Delete failed:', error);
        showToast(`Failed to delete: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Get Backend System Info
 */
export async function getSystemInfo() {
    try {
        const response = await fetch(`${LOCAL_LLM_URL}/v1/system/info`);
        return await response.json();
    } catch {
        return null;
    }
}



/**
 * Trigger Download
 */
export async function downloadModel(repoId, filename) {
    showToast(`Downloading ${filename}... This will take a while.`, 'info');
    try {
        const response = await fetch(`${LOCAL_LLM_URL}/v1/models/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo_id: repoId, filename: filename })
        });
        if (!response.ok) throw new Error('Download request failed');
        showToast('Download completed/cached!', 'success');
        return true;
    } catch (error) {
        showToast(`Download failed: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Chat with Local LLM (Streaming)
 */
export async function askLocalLLM(messages, temperature = 0.7) {
    const response = await fetch(`${LOCAL_LLM_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: messages,
            temperature: temperature,
            stream: true,
            max_tokens: -1
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Local Inference Failed');
    }

    // Convert fetch stream to Async Iterable that mimics Puter's format
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    return {
        [Symbol.asyncIterator]: async function* () {
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        if (jsonStr === '[DONE]') continue;
                        try {
                            const json = JSON.parse(jsonStr);
                            const text = json.choices[0]?.delta?.content || '';
                            if (text) yield { text };
                        } catch (e) {
                            // ignore parse errors
                        }
                    }
                }
            }
        }
    };
}
