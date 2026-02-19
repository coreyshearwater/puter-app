
import { AppState } from '../state/state.js';
import { showToast } from '../utils/toast.js';
import { CONFIG } from '../state/config.js';
import { Logger } from '../utils/logger.js';
import { ChatMessage } from '../types.js';

const LOCAL_LLM_URL = CONFIG.LOCAL_LLM_URL;

interface ServerStatus {
    online: boolean;
    loaded: boolean;
    model: string | null;
}

declare const puter: any;

/**
 * Check if the Local LLM server is reachable
 */
export async function checkLocalServerStatus(): Promise<ServerStatus> {
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
                model: data.model_path ? data.model_path.split('\\').pop()?.split('/').pop() || null : null
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
export async function listLocalModels(): Promise<any[]> {
    try {
        const response = await fetch(`${LOCAL_LLM_URL}/v1/models`);
        if (!response.ok) throw new Error('Server error');
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        Logger.error('LocalLLM', 'List models failed:', error);
        return [];
    }
}

/**
 * Search Hugging Face (proxied via backend)
 */
export async function searchHF(query: string): Promise<any[]> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
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
        Logger.warn('LocalLLM', 'Backend search failed, falling back to direct HF API:', err);
        
        try {
            const hfResponse = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(query)}&filter=gguf&sort=downloads&direction=-1&limit=20`);
            if (!hfResponse.ok) throw new Error('HF API Error');
            
            const models = await hfResponse.json();
            return models.map((m: any) => ({
                id: m.modelId,
                downloads: m.downloads,
                likes: m.likes,
                tags: m.tags
            }));
        } catch (hfErr) {
            Logger.error('LocalLLM', 'Direct HF search failed:', hfErr);
            showToast('Could not search HuggingFace (Offline?)', 'error');
            return [];
        }
    }
}

/**
 * Load a specific model
 */
export async function loadLocalModel(filename: string): Promise<boolean> {
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
    } catch (error: any) {
        Logger.error('LocalLLM', 'Load failed:', error);
        showToast(`Load failed: ${error.message || error}`, 'error');
        return false;
    }
}

/**
 * Unload the current model (Free VRAM)
 */
export async function unloadLocalModel(): Promise<boolean> {
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
export async function deleteLocalModel(filename: string): Promise<boolean> {
    try {
        const response = await fetch(`${LOCAL_LLM_URL}/v1/models/${filename}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Delete failed');
        showToast(`Deleted ${filename}`, 'success');
        return true;
    } catch (error: any) {
        Logger.error('LocalLLM', 'Delete failed:', error);
        showToast(`Failed to delete: ${error.message || error}`, 'error');
        return false;
    }
}

/**
 * Get Backend System Info
 */
export async function getSystemInfo(): Promise<any> {
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
export async function downloadModel(repoId: string, filename: string): Promise<boolean> {
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
    } catch (error: any) {
        showToast(`Download failed: ${error.message || error}`, 'error');
        return false;
    }
}

/**
 * Chat with Local LLM (Streaming)
 */
export async function askLocalLLM(messages: ChatMessage[], temperature: number = 0.7): Promise<any> {
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

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is null');
    const decoder = new TextDecoder();
    
    return {
        [Symbol.asyncIterator]: async function* () {
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line
                
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
