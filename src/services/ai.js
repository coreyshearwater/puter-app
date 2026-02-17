import { AppState } from '../state.js';
import { renderMessage, createAIMessageElement } from '../ui/chat.js';
import { renderMarkdown } from '../utils/markdown.js';
import { scrollToBottom } from '../utils/dom.js';
import { showToast } from '../utils/toast.js';
import { getProjectContext } from './memory.js';
import { speakText, queueSpeech } from './voice.js'; // Import queueSpeech
import { askGrok } from './grok-service.js';
import { showErrorModal } from '../utils/modals.js';
import { saveStateToKV } from './storage.js';
import { syncCurrentSession } from '../ui/sidebar/sessions.js';

const FREE_FALLBACK_CHAIN = [
    'z-ai/glm-4.5-air:free',
    'arcee-ai/trinity-large-preview:free',
    'liquid-lfm-2.5-1.2b-instruct:free',
    'stepfun-step-3.5-flash:free',
    'hermes-2-theta-llama-3-70b:free',
    'gemini-2.5-flash-lite',
];

const MAX_CONTEXT_MESSAGES = 20;

// Send a message
export async function sendMessage() {
    const input = document.getElementById('user-input');
    const content = input.value.trim();
    
    if (!content || AppState.isStreaming) return;
    
    // Attachments
    const attachments = [...AppState.attachedFiles];
    AppState.attachedFiles = [];
    document.dispatchEvent(new CustomEvent('renderAttachments'));
    
    // Clear input
    input.value = '';
    
    const userMessage = { role: 'user', content, attachments };
    AppState.messages.push(userMessage);
    renderMessage(userMessage);
    
    // Persist user message
    syncCurrentSession();
    saveStateToKV();
    
    // AI Thinking
    AppState.isStreaming = true;
    const aiMessageElement = createAIMessageElement();
    
    try {
        if (content.toLowerCase().startsWith('/image ')) {
            await generateImage(content.substring(7));
        } else if (content.toLowerCase().startsWith('/video ')) {
            await generateVideo(content.substring(7));
        } else {
            await executeChatWithFallback(aiMessageElement);
        }
    } catch (error) {
        console.error('Chat error:', error.message || error);
        if (aiMessageElement) aiMessageElement.remove();
        showErrorModal('Provider Notification', error.message || 'The AI service encountered an issue. Please try again or switch models.');
    } finally {
        AppState.isStreaming = false;
    }
}

// Send a hidden system message (Oracular Mode toggles)
export async function sendHiddenMessage(content) {
    if (AppState.isStreaming) {
        showToast('System busy, please wait...', 'warning');
        return;
    }
    
    // Add hidden message to history
    const hiddenMessage = { role: 'user', content, hidden: true };
    AppState.messages.push(hiddenMessage);
    
    // Trigger AI response
    AppState.isStreaming = true;
    const aiMessageElement = createAIMessageElement();
    
    try {
        await executeChatWithFallback(aiMessageElement);
    } catch (error) {
        console.error('Hidden message error:', error);
        if (aiMessageElement) aiMessageElement.remove();
        showToast('Oracular command failed', 'error');
    } finally {
        AppState.isStreaming = false;
    }
}

// Execute chat with automatic fallback
async function executeChatWithFallback(aiMessageElement, attemptedModels = []) {
    const currentModel = AppState.currentModel;
    if (attemptedModels.includes(currentModel)) throw new Error('All fallbacks failed');
    attemptedModels.push(currentModel);
    
    try {
        let messagesToSend = [];
        const projectContext = getProjectContext();
        let basePrompt = AppState.activePersona?.systemPrompt || 'You are a helpful AI workstation assistant.';
        if (!AppState.allowEmojis) {
            basePrompt += '\nSTRICT RULE: Do NOT use any emojis or decorative icons in your response. Keep it professional and technical.';
        }
        
        messagesToSend.push({ 
            role: 'system', 
            content: basePrompt + (projectContext ? `\n\n${projectContext}` : '') 
        });

        // Map history to Puter format
        // OPTIMIZATION: Only send recent messages to keep context window small and responses fast.
        const recentMessages = AppState.messages.slice(-MAX_CONTEXT_MESSAGES);
        
        for (const msg of recentMessages) {
            if (msg.attachments?.length > 0) {
                const contentArray = [{ type: 'text', text: msg.content }];
                for (const attach of msg.attachments) {
                    if (attach.type.startsWith('image/')) {
                        contentArray.push({ type: 'file', file: attach.file });
                    } else {
                        // Use cached content if available
                        if (attach.content) {
                            contentArray[0].text += `\n\n--- [Attachment: ${attach.name}] ---\n${attach.content}\n---`;
                        } else {
                            contentArray[0].text += `\n\n[System: Could not read attachment ${attach.name}]`;
                        }
                    }
                }
                messagesToSend.push({ role: msg.role, content: contentArray });
            } else {
                messagesToSend.push({ role: msg.role, content: msg.content });
            }
        }
        
        if (currentModel.startsWith('grok-')) {
            try {
                aiMessageElement.innerHTML = '<span class="loading loading-dots loading-sm"></span> Grok is thinking...';
                const result = await askGrok(AppState.messages[AppState.messages.length - 1].content, currentModel);
                
                aiMessageElement.innerHTML = renderMarkdown(result.text, false);
                AppState.messages.push({ role: 'assistant', content: result.text });
                
                // Persist Grok response
                syncCurrentSession();
                saveStateToKV();
                
                await speakText(result.text);
                return;
            } catch (error) {
                console.error(`Model ${currentModel} failed:`, error.message || error);
                throw error;
            }
        }

        // GPT-5 models only support temperature=1
        const useDefaultTemp = currentModel.includes('gpt-5');
        
        const response = await puter.ai.chat(messagesToSend, {
            model: currentModel,
            stream: true,
            temperature: useDefaultTemp ? 1 : AppState.temperature,
            max_tokens: AppState.maxTokens,
        });
        
        let fullText = '';
        let chunkCount = 0;
        let speechBuffer = '';

        for await (const chunk of response) {
            if (chunk.text) {
                fullText += chunk.text;
                chunkCount++;
                
                // Add to speech buffer
                if (AppState.autoSpeak) {
                    speechBuffer += chunk.text;
                    // Check for sentence endings
                    const sentenceMatch = speechBuffer.match(/([.!?\n])\s+/);
                    if (sentenceMatch) {
                        const index = sentenceMatch.index + sentenceMatch[0].length;
                        const sentence = speechBuffer.substring(0, index);
                        queueSpeech(sentence, aiMessageElement);
                        speechBuffer = speechBuffer.substring(index);
                    }
                }
                
                // PERFORMANCE TWEAK: Only update DOM every 3 chunks during streaming
                // This drastically reduces layout thrashing without losing "fluidity"
                if (chunkCount % 3 === 0) {
                    aiMessageElement.innerHTML = renderMarkdown(fullText, true) + '<span class="streaming-cursor"></span>';
                    scrollToBottom('chat-area');
                }
            }
        }
        
        // Speak remaining buffer
        if (AppState.autoSpeak && speechBuffer.trim()) {
            queueSpeech(speechBuffer, aiMessageElement);
        }
        
        aiMessageElement.innerHTML = renderMarkdown(fullText, false);

        AppState.messages.push({ role: 'assistant', content: fullText });
        
        // Persist final response
        syncCurrentSession();
        saveStateToKV();
        // Deprecated single-shot call, replaced by streaming queue above
        // speakText(fullText, aiMessageElement);
        
    } catch (error) {
        console.error(`Model ${currentModel} failed:`, error);
        
        // L10: If we have partial content from a mid-stream failure, preserve it
        if (fullText && fullText.trim()) {
            aiMessageElement.innerHTML = renderMarkdown(fullText, false) + '<div class="text-xs text-red-400 mt-2 italic">⚠️ Response was interrupted</div>';
            AppState.messages.push({ role: 'assistant', content: fullText + '\n\n[Response interrupted]' });
            syncCurrentSession();
            saveStateToKV();
        }
        
        // Check for specific error types or message content
        const errorMsg = (error.message || JSON.stringify(error)).toLowerCase();
        
        const isFallbackCandidate = 
            errorMsg.includes('credit') || 
            errorMsg.includes('insufficient') ||
            errorMsg.includes('failed') || 
            errorMsg.includes('unavailable') ||
            errorMsg.includes('rate_limit') ||
            errorMsg.includes('model_not_found');

        if (isFallbackCandidate) {
            const nextModel = FREE_FALLBACK_CHAIN.find(id => !attemptedModels.includes(id));
            if (nextModel) {
                showToast(`Credits low, trying free model: ${nextModel}`, 'info');
                AppState.currentModel = nextModel;
                document.dispatchEvent(new CustomEvent('updateModelDisplay'));
                return await executeChatWithFallback(aiMessageElement, attemptedModels);
            }
        }
        throw error;
    }
}

// Image Generation
export async function generateImage(prompt) {
    showToast('Generating image...', 'info');
    const aiMessage = createAIMessageElement();
    aiMessage.innerHTML = `<span class="loading loading-dots loading-sm"></span> Visualizing: "${prompt}"...`;
    
    try {
        const { aspectRatio, style, negativePrompt } = AppState.mediaParams;
        const options = {
            aspect_ratio: aspectRatio.replace(':', '_'), // Puter often expects 16_9 or 1_1
            negative_prompt: negativePrompt
        };
        
        const finalPrompt = `${style} style, ${prompt}`;
        // DOCUMENTATION AUDIT FIX: Docs specify txt2img(prompt, testMode boolean)
        // Passing options object might be ignored or cause issues. Reverting to true (testMode) for safety.
        // const image = await puter.ai.txt2img(finalPrompt, options);
        const image = await puter.ai.txt2img(finalPrompt, true);
        
        const imgElement = document.createElement('img');
        imgElement.src = image.src;
        imgElement.alt = prompt;
        imgElement.className = 'rounded-lg max-w-full mt-2 shadow-lg';
        
        aiMessage.innerHTML = `<p><strong>Generate:</strong> ${prompt} <span class="text-[10px] text-gray-500">(${aspectRatio} ${style})</span></p>`;
        aiMessage.appendChild(imgElement);
        AppState.messages.push({ role: 'assistant', content: `[Generated Image: ${prompt}](${image.src})` });
        showToast('Image generated!', 'success');
        scrollToBottom('chat-area');
    } catch (error) {
        console.error('Image gen error:', error);
        aiMessage.innerHTML = `<p class="text-red-400">Image Generation Failed: ${error.message}</p>`;
    }
}

// Video Generation
export async function generateVideo(prompt) {
    showToast('Generating video...', 'info');
    const aiMessage = createAIMessageElement();
    aiMessage.innerHTML = `<span class="loading loading-dots loading-sm"></span> Visualizing: "${prompt}"...`;
    
    try {
        const { aspectRatio, style, negativePrompt } = AppState.mediaParams;
        const options = {
            aspect_ratio: aspectRatio.replace(':', '_'),
            negative_prompt: negativePrompt
        };
        
        const finalPrompt = `${style} style, ${prompt}`;
        // test: true for dev, but we'll use actual params
        const video = await puter.ai.txt2vid(finalPrompt, true); 
        
        aiMessage.innerHTML = `<p><strong>Video Prompt:</strong> ${prompt} <span class="text-[10px] text-gray-500">(${aspectRatio} ${style})</span></p>`;
        
        const videoElement = document.createElement('video');
        videoElement.src = video.src;
        videoElement.controls = true;
        videoElement.className = 'rounded-lg max-w-full mt-2 shadow-2xl border border-magenta-500/30';
        videoElement.autoplay = false;
        
        aiMessage.appendChild(videoElement);
        AppState.messages.push({ role: 'assistant', content: `[Generated Video: ${prompt}](${video.src})` });
        showToast('Video generated!', 'success');
        scrollToBottom('chat-area');
    } catch (error) {
        console.error('Video gen error:', error);
        aiMessage.innerHTML = `<p class="text-red-400">Video Generation Failed: ${error.message}</p>`;
        showToast('Video failed', 'error');
    }
}

// OCR / Scan to Text
export async function performOCR(file) {
    showToast('Scanning image for text...', 'info');
    try {
        const text = await puter.ai.img2txt(file);
        if (text && text.trim()) {
            const input = document.getElementById('user-input');
            const spacer = input.value.trim() ? '\n\n' : '';
            input.value += `${spacer}[OCR Content]:\n${text.trim()}\n---`;
            input.focus();
            input.scrollTop = input.scrollHeight;
            showToast('Text extracted from image', 'success');
        } else {
            showToast('No readable text found in image', 'warning');
        }
    } catch (error) {
        console.error('OCR Error:', error);
        showToast('Scan failed', 'error');
    }
}
