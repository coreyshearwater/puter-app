import { AppState } from '../state.js';
import { showToast } from '../utils/toast.js';

/**
 * Service to interact with the local Grok API server.
 * Requires the Python server in Grok-Api-main to be running.
 */
export async function askGrok(message, model = 'grok-3-auto', stream = false, temperature = 0.7) {
    const url = AppState.grokApiUrl || 'http://127.0.0.1:6969/ask';
    
    try {
        const requestBody = {
            message: message,
            model: model,
            stream: stream,
            temperature: temperature
        };
        if (AppState.grokProxy) requestBody.proxy = AppState.grokProxy;
        if (AppState.grokConversationData) requestBody.extra_data = AppState.grokConversationData;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            keepalive: true // Attempt to keep connection alive in background
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let detail = errorData.detail;
            if (detail && typeof detail === 'object') {
                detail = JSON.stringify(detail);
            }
            throw new Error(detail || `Failed to reach Grok server (${response.status})`);
        }

        if (stream) {
            // Return an async iterable compatible with puter.ai.chat
            return (async function* () {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop(); // Keep incomplete line

                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const data = JSON.parse(line);
                                if (data.error) throw new Error(data.error);

                                if (data.type === 'token') {
                                    // Yield object with 'text' property like Puter API
                                    yield { text: data.content };
                                } else if (data.type === 'final') {
                                    // Update state
                                    if (data.extra_data) AppState.grokConversationData = data.extra_data;
                                }
                            } catch (e) {
                                console.warn('Grok stream parse error:', e?.message || e, '| raw line:', line?.substring(0, 200));
                            }
                        }
                    }
                    // Process remaining buffer
                    if (buffer.trim()) {
                         try {
                            const data = JSON.parse(buffer);
                            if (data.type === 'token') yield { text: data.content };
                         } catch (e) {}
                    }
                } finally {
                    reader.releaseLock();
                }
            })();
        }

        // Legacy Non-Streaming Response
        const data = await response.json();
        
        if (data.status === 'success') {
            // Store conversation data for continuity
            AppState.grokConversationData = data.extra_data;
            return {
                text: data.response,
                images: data.images
            };
        } else {
            let errorMsg = data.error;
            if (errorMsg && typeof errorMsg === 'object') {
                if (errorMsg.message) errorMsg = errorMsg.message;
                else errorMsg = JSON.stringify(errorMsg);
            }
            throw new Error(errorMsg || 'Grok returned an error');
        }
    } catch (error) {
        let errorDetails = error.message;
        
        // If message is missing or is the generic object string
        if (!errorDetails || errorDetails === '[object Object]') {
            errorDetails = JSON.stringify(error, null, 2);
        }
        
        console.error('Grok Service Error:', errorDetails);
        
        const friendlyMsg = (error.message === 'Failed to fetch' || errorDetails.includes('Failed to fetch'))
            ? 'Grok server not reached. Is api_server.py running?' 
            : `Grok error: ${errorDetails.substring(0, 50)}...`;
        showToast(friendlyMsg, 'error');
        throw error;
    }
}
