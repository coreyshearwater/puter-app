import { AppState } from '../state.js';
import { showToast } from '../utils/toast.js';

/**
 * Service to interact with the local Grok API server.
 * Requires the Python server in Grok-Api-main to be running.
 */
export async function askGrok(message, model = 'grok-3-auto') {
    const url = AppState.grokApiUrl || 'http://127.0.0.1:6969/ask';
    
    try {
        const requestBody = {
            message: message,
            model: model
        };
        if (AppState.grokProxy) requestBody.proxy = AppState.grokProxy;
        if (AppState.grokConversationData) requestBody.extra_data = AppState.grokConversationData;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            let detail = errorData.detail;
            if (detail && typeof detail === 'object') {
                detail = JSON.stringify(detail);
            }
            throw new Error(detail || 'Failed to reach Grok server');
        }

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
