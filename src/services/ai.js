import { AppState } from '../state.js';
import { renderMessage, createAIMessageElement } from '../ui/chat.js';
import { renderMarkdown } from '../utils/markdown.js';
import { stopSpeech } from './voice.js';
import { scrollToBottom } from '../utils/dom.js';
import { showToast } from '../utils/toast.js';
import { getProjectContext } from './memory.js';
import { speakText, queueSpeech } from './voice.js'; // Import queueSpeech
import { askGrok } from './grok-service.js';
import { askLocalLLM } from './local-llm.js';
import { showErrorModal, showInfoModal } from '../utils/modals.js';
import { saveStateToKV } from './storage.js';
import { syncCurrentSession } from '../ui/sidebar/sessions.js';

const FREE_FALLBACK_CHAIN = [
    'gpt-4o-mini',          // Direct Puter model — very reliable
    'gpt-5-nano',           // Puter's default model
    'claude-3-5-haiku-20241022',
    'openrouter:google/gemma-2-9b-it:free',
    'openrouter:meta-llama/llama-3.1-8b-instruct:free',
    'openrouter:mistralai/mistral-7b-instruct:free',
    'openrouter:microsoft/phi-3-medium-128k-instruct:free',
];

const MAX_CONTEXT_MESSAGES = 20;

// Stop generation & voice
export function stopGeneration() {
    AppState._abortStream = true;
    stopSpeech();
    console.info('[AI] Stop generation requested');
}

// Diagnostic: Test which Puter models actually work
export async function diagnosePuterModels() {
    const testModels = [
        { label: 'GPT-4o-Mini (S)',     opts: { model: 'gpt-4o-mini' } },
        { label: 'DeepSeek R1 (S)',     opts: { model: 'openrouter:deepseek/deepseek-r1-0528:free' } },
        { label: 'Claude 3.5 Haiku (S)', opts: { model: 'claude-3-5-haiku-20241022' } },
        { label: 'Gemini 2.0 Flash (S)', opts: { model: 'google/gemini-2.0-flash-exp:free' } },
        { label: 'Llama 3.3 70B (A)',    opts: { model: 'meta-llama/llama-3.3-70b-instruct:free' } },
    ];

    console.warn('═══ PUTER MODEL DIAGNOSTIC START ═══');
    const results = [];

    for (const test of testModels) {
        try {
            const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout (8s)')), 8000));
            const res = await Promise.race([
                puter.ai.chat('Say "ok" in one word.', { ...test.opts, max_tokens: 5 }),
                timeout
            ]);
            const text = typeof res === 'string' ? res : (res?.message?.content || res?.text || JSON.stringify(res).substring(0, 100));
            console.info(`  ✅ ${test.label}: "${text}"`);
            results.push({ model: test.label, status: 'OK', response: text });
        } catch (err) {
            const msg = err?.error || err?.message || JSON.stringify(err);
            console.error(`  ❌ ${test.label}: ${msg}`);
            results.push({ model: test.label, status: 'FAIL', error: msg });
        }
    }

    const passed = results.filter(r => r.status === 'OK').length;
    console.warn(`═══ DIAGNOSTIC DONE: ${passed}/${results.length} passed ═══`);
    console.table(results);
    return results;
}

// Send a message
export async function sendMessage() {
    const input = document.getElementById('user-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    // Safety: Reset stuck streaming state (e.g. from previous crash)
    if (AppState.isStreaming) {
        const stuckMs = Date.now() - (AppState._streamStartedAt || 0);
        if (stuckMs > 30000) {
            console.warn(`[AI] Force-resetting stuck isStreaming (stuck for ${(stuckMs/1000).toFixed(0)}s)`);
            AppState.isStreaming = false;
        } else {
            console.warn('[AI] sendMessage blocked: isStreaming or isProcessingIntent is true');
            return;
        }
    }

    if (AppState.isProcessingIntent) {
        showToast('System busy...', 'warning');
        return;
    }
    
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
    AppState._streamStartedAt = Date.now();
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
    if (AppState.isStreaming || AppState.isProcessingIntent) {
        showToast('System busy, please wait...', 'warning');
        return;
    }
    
    AppState.isProcessingIntent = true;
    
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
        AppState.isProcessingIntent = false;
    }
}

// Execute chat with automatic fallback
async function executeChatWithFallback(aiMessageElement, attemptedModels = []) {
    const currentModel = AppState.currentModel;
    if (attemptedModels.includes(currentModel) && !AppState.useLocalModel) throw new Error('All fallbacks failed');
    attemptedModels.push(currentModel);
    
    let fullText = '';
    let chunkCount = 0;
    let speechBuffer = '';

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
            // Safety: Skip hidden messages (system commands) and empty content
            if (msg.hidden) continue;
            if (!msg.content || (typeof msg.content === 'string' && !msg.content.trim())) {
                continue;
            }

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
        
        let response;

        // --- ROUTING LOGIC ---
        if (AppState.useLocalModel) {
            console.log('[AI] Routing to Local LLM Engine...');
            response = await askLocalLLM(messagesToSend, AppState.temperature);
        } else if (currentModel.startsWith('grok-')) {
            aiMessageElement.innerHTML = '<span class="loading loading-dots loading-sm"></span>';
            // Grok uses stateful conversation ID on backend, so we pass the latest prompt
            const lastUserMsg = AppState.messages[AppState.messages.length - 1];
            // Pass true for streaming and current temperature
            response = await askGrok(lastUserMsg.content, currentModel, true, AppState.temperature);
        } else {
            // Standard Puter AI (Stateless, sends history)
            const useDefaultTemp = currentModel.includes('gpt-5');
            console.info(`[AI] Calling puter.ai.chat with model=${currentModel}, msgs=${messagesToSend.length}, temp=${useDefaultTemp ? 1 : AppState.temperature}`);
            response = await puter.ai.chat(messagesToSend, {
                model: currentModel,
                stream: true,
                temperature: useDefaultTemp ? 1 : AppState.temperature,
                max_tokens: AppState.maxTokens,
            });
            console.info(`[AI] puter.ai.chat returned response type: ${typeof response}`);
        }
        
        // Unified Streaming Loop
        AppState._abortStream = false;
        for await (const chunk of response) {
            if (AppState._abortStream) {
                console.info(`[AI] Stream aborted by user after ${chunkCount} chunks`);
                break;
            }
            if (chunk.text) {
                fullText += chunk.text;
                chunkCount++;
                
                // Add to speech buffer
                if (AppState.autoSpeak) {
                    speechBuffer += chunk.text;
                    const sentenceMatch = speechBuffer.match(/([.!?\n])\s+/);
                    if (sentenceMatch) {
                        const index = sentenceMatch.index + sentenceMatch[0].length;
                        const sentence = speechBuffer.substring(0, index);
                        queueSpeech(sentence, aiMessageElement);
                        speechBuffer = speechBuffer.substring(index);
                    }
                }
                
                if (!window.updatePending) {
                    window.updatePending = true;
                    requestAnimationFrame(() => {
                        aiMessageElement.innerHTML = renderMarkdown(fullText, true) + '<span class="streaming-cursor"></span>';
                        // Re-add stop button (innerHTML wipes it)
                        if (AppState.isStreaming && !AppState._abortStream) {
                            const btn = document.createElement('button');
                            btn.className = 'stop-gen-btn';
                            btn.title = 'Stop generating';
                            btn.onclick = () => window.gravityChat.stopGeneration();
                            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
                            aiMessageElement.appendChild(btn);
                        }
                        scrollToBottom('chat-area');
                        window.updatePending = false;
                    });
                }
            }
        }
        
        // Speak remaining buffer
        if (AppState.autoSpeak && speechBuffer.trim()) {
            queueSpeech(speechBuffer, aiMessageElement);
        }
        
        // Render final content (wipes everything)
        aiMessageElement.innerHTML = renderMarkdown(fullText, false);
        
        // Re-add stop button if still speaking
        if (AppState.isSpeakingAudio && !AppState._abortStream) {
            const btn = document.createElement('button');
            btn.className = 'stop-gen-btn';
            btn.title = 'Stop voice playback';
            btn.onclick = () => window.gravityChat.stopGeneration();
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
            aiMessageElement.appendChild(btn);
        }

        if (AppState._abortStream) {
            aiMessageElement.innerHTML += '<div class="text-xs text-amber-400 mt-2 italic">⏹ Generation stopped</div>';
        }

        // Only append to history if we actually got a response
        if (fullText.trim()) {
            AppState.messages.push({ role: 'assistant', content: fullText });
        }
        
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
        // Puter returns errors as {success: false, error: "..."} (not Error instances)
        const rawMsg = error.message || error.error || JSON.stringify(error);
        const errorMsg = rawMsg.toLowerCase();
        
        const isFallbackCandidate = 
            errorMsg.includes('credit') || 
            errorMsg.includes('insufficient') ||
            errorMsg.includes('failed') || 
            errorMsg.includes('unavailable') ||
            errorMsg.includes('rate_limit') ||
            errorMsg.includes('model_not_found') ||
            errorMsg.includes('not found') ||
            errorMsg.includes('no fallback') ||
            errorMsg.includes('overloaded');

        if (isFallbackCandidate) {
            
            // SELF-HEALING: Check for moderation loop (persisted bad state)
            if (errorMsg.includes('moderation_failed')) {
                console.warn('⚠️ Moderation Loop Detected. Initiating Self-Healing...');
                showToast('Corruption detected. Auto-repairing...', 'warning');
                
                // Clear state and reload to fix the loop
                await puter.kv.del('appState');
                setTimeout(() => window.location.reload(), 1500);
                return;
            }

            // Standard Fallback Logic
            let candidates = (AppState.freeModels || []).map(m => m.id);
            
            if (candidates.length === 0) candidates = FREE_FALLBACK_CHAIN;
            else candidates = [...new Set([...candidates, ...FREE_FALLBACK_CHAIN])];
            
            console.warn(`[AI Fallback] Attempted: [${attemptedModels.join(', ')}] | Candidates available: ${candidates.length}`);
            
            const nextModel = candidates.find(id => !attemptedModels.includes(id));
            
            if (nextModel) {
                console.warn(`[AI Fallback] Switching to: ${nextModel}`);
                showInfoModal('Model Switch', `The selected model failed to respond. Automatically switched to: ${nextModel}`);
                AppState.currentModel = nextModel;
                document.dispatchEvent(new CustomEvent('updateModelDisplay'));
                return await executeChatWithFallback(aiMessageElement, attemptedModels);
            } else {
                console.error('[AI Fallback] All candidates exhausted!');
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
        // DOCUMENTATION AUDIT FIX: Docs specify txt2img(prompt, options)
        const image = await puter.ai.txt2img(finalPrompt, { style, testMode: true });
        
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
