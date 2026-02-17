import { AppState } from '../state.js';
import { showToast } from '../utils/toast.js';
// Removed static import of sendMessage to break circular dependency with ai.js
import { saveStateToKV } from './storage.js';
import { processSemanticCommand } from './intents.js';

// Helper to wait for AI to finish streaming (e.g. processing background commands)
async function waitForAIIdle(timeout = 5000) {
    if (!AppState.isStreaming) return true;
    
    const start = Date.now();
    while (AppState.isStreaming) {
        if (Date.now() - start > timeout) return false;
        await new Promise(r => setTimeout(r, 200));
    }
    return true;
}

let currentAudio = null; // Track active Cloud TTS
let speechQueue = [];
let isSpeakingAudio = false;
let activeSpeakingBubble = null; // Track which bubble is currently speaking
let activeAudioContext = null; // Track AudioContext to prevent leaks

// Queue speech chunk
// Store original send button innerHTML for restoration
let originalSendBtnHTML = null;

// Transform #btn-send into stop mode or restore it
function setSendButtonSpeaking(isSpeaking) {
    const btn = document.getElementById('btn-send');
    if (!btn) return;

    if (isSpeaking) {
        if (!originalSendBtnHTML) originalSendBtnHTML = btn.innerHTML;
        btn.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>`;
        btn.classList.add('btn-speaking');
        btn.setAttribute('aria-label', 'Stop voice playback');
        btn.dataset.mode = 'stop';
    } else {
        if (originalSendBtnHTML) btn.innerHTML = originalSendBtnHTML;
        btn.classList.remove('btn-speaking');
        btn.setAttribute('aria-label', 'Send');
        btn.dataset.mode = 'send';
    }
}

export async function queueSpeech(text, bubble) {
    if (!text || !text.trim()) return;
    
    // Transform send button into stop button on first chunk
    if (speechQueue.length === 0) {
        activeSpeakingBubble = bubble;
        setSendButtonSpeaking(true);
    }
    
    speechQueue.push({ text, bubble });
    if (!isSpeakingAudio) processSpeechQueue();
}

async function processSpeechQueue() {
    if (speechQueue.length === 0) {
        isSpeakingAudio = false;
        activeSpeakingBubble = null;
        setSendButtonSpeaking(false);
        // Resume recording if in voice session
        if (AppState.isVoiceSession && !AppState.isRecording) {
            console.log('🎙️ Resuming recording after speech...');
            setTimeout(() => startRecording(), 500);
        }
        return;
    }

    // Stop recording BEFORE starting to speak (only on first chunk)
    if (!isSpeakingAudio) {
        if (AppState.isRecording) {
            console.log('🔇 Stopping mic before speech...');
            stopRecording();
            await new Promise(r => setTimeout(r, 150)); // Brief pause
        } else {
            console.log('⚠️ Mic not recording, skipping stop');
        }
    }
    
    isSpeakingAudio = true;
    const { text, bubble } = speechQueue.shift();
    await speakText(text, bubble, true); // true = internal call
    processSpeechQueue();
}

// Load available voices (Cloud + Native)
export function loadVoices() {
    const selector = document.getElementById('voice-selector');
    if (!selector) return;
    
    const savedVoice = AppState.selectedVoice || 'Joanna';
    
    // Cloud Voices (Puter)
    const cloudVoices = [
        { id: 'Joanna', name: 'Cloud: Joanna' },
        { id: 'Matthew', name: 'Cloud: Matthew' },
        { id: 'Amy', name: 'Cloud: Amy' },
        { id: 'Brian', name: 'Cloud: Brian' },
        { id: 'Salli', name: 'Cloud: Salli' },
        { id: 'Joey', name: 'Cloud: Joey' }
    ];
    
    // Native Voices
    let nativeVoices = [];
    if (window.speechSynthesis) {
        nativeVoices = window.speechSynthesis.getVoices()
            .filter(v => v.lang.startsWith('en')) // Filter English
            .map(v => ({ id: `native:${v.name}`, name: `Device: ${v.name}` }));
    }
    
    // Render options
    selector.innerHTML = '';
    
    // Group Cloud
    const cloudGroup = document.createElement('optgroup');
    cloudGroup.label = "High Quality (Cloud)";
    cloudVoices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        cloudGroup.appendChild(opt);
    });
    selector.appendChild(cloudGroup);
    
    // Group Native
    if (nativeVoices.length > 0) {
        const nativeGroup = document.createElement('optgroup');
        nativeGroup.label = "Device Native (Free/Offline)";
        nativeVoices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.name;
            nativeGroup.appendChild(opt);
        });
        selector.appendChild(nativeGroup);
    }
    
    // Restore selection
    selector.value = savedVoice;
    
    // Update state on change
    selector.onchange = (e) => {
        AppState.selectedVoice = e.target.value;
        saveStateToKV();
    };
}

// Ensure voices are loaded when they change (common in Chrome)
if (window.speechSynthesis) {
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }
}

// Speak text using Puter.js txt2speech with fallback
export async function speakText(text, bubble, isInternal = false) {
    if (!text || !AppState.autoSpeak) return;
    
    // If external call (e.g. manual play), clear queue and stop current
    if (!isInternal) {
        stopSpeech();
    }
    
    // Clean text: strip emojis to prevent TTS from reading them out loud
    const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    
    if (!cleanText) return;

    // Stop button is now on #btn-send, not on the bubble
    // No per-bubble stop button creation needed

    const cleanup = () => {
        currentAudio = null;
    };

    try {
        console.log('Speaking text (cleaned)...');
        
        // Check if user selected a native voice directly
        const isNativeForce = AppState.selectedVoice.startsWith('native:');
        
        if (!isNativeForce) {
            // Try Puter AI TTS first
            try {
                console.log(`Attempting Cloud TTS: ${AppState.selectedVoice}`);
                currentAudio = await puter.ai.txt2speech(cleanText, 'en-US', AppState.selectedVoice);
                
                return new Promise((resolve) => {
                    currentAudio.onended = () => {
                        cleanup();
                        resolve();
                    };
                    currentAudio.onerror = (e) => {
                        console.error('Audio playback error', e);
                        cleanup();
                        resolve(); 
                    };
                    currentAudio.play().catch(e => {
                         console.error('Play error', e); 
                         cleanup();
                         resolve();
                    });
                });
            } catch (puterError) {
                console.warn('Puter TTS failed:', puterError);
                if (!isNativeForce) showToast(`Cloud Voice Failed, using device backup`, 'warning');
            }
        }
        
        // Native Browser TTS Fallback
        try {
             const utterance = new SpeechSynthesisUtterance(cleanText);
             const voices = window.speechSynthesis.getVoices();
             
             let voice = null;
             if (isNativeForce) {
                 const targetName = AppState.selectedVoice.substring(7);
                 voice = voices.find(v => v.name === targetName);
             }
             
             if (!voice) {
                voice = voices.find(v => v.name.includes('Google') || v.name.includes('Microsoft')) || voices[0];
             }
             
             if (voice) utterance.voice = voice;
             
             return new Promise((resolve) => {
                 utterance.onend = () => {
                     cleanup();
                     resolve();
                 };
                 utterance.onerror = () => {
                     cleanup();
                     resolve();
                 };
                 window.speechSynthesis.speak(utterance);
             });
        } catch (nativeError) {
            console.error('Native TTS error:', nativeError);
            cleanup();
        }
    } catch (outerError) {
        console.error('Outer TTS error:', outerError);
        cleanup();
    }
}

// Global Stop Speech
export function stopSpeech() {
    // Stop Cloud TTS
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    
    // Stop Native TTS
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    // Restore send button
    setSendButtonSpeaking(false);
    
    // Clear Queue
    speechQueue = [];
    isSpeakingAudio = false;
    activeSpeakingBubble = null;
}

// Start recording audio (with VAD option)
export async function startRecording() {
    try {
        if (AppState.isRecording) {
            stopRecording();
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        AppState.audioStream = stream;
        
        const micBtn = document.getElementById('btn-mic');
        micBtn.classList.add('btn-error', 'animate-pulse');
        
        // Close any prior AudioContext to prevent leaks
        if (activeAudioContext) {
            try { activeAudioContext.close(); } catch (e) {}
        }
        const audioContext = new AudioContext();
        activeAudioContext = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const silenceThreshold = 10;
        const silenceDelay = 700; // optimized for speed
        let silenceStart = Date.now();
        let isSpeaking = false;
        
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
        AppState.mediaRecorder = new MediaRecorder(stream, { mimeType });
        AppState.audioChunks = [];
        
        AppState.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) AppState.audioChunks.push(e.data);
        };
        
        AppState.mediaRecorder.onstop = async () => {
             if (AppState.audioChunks.length > 0) {
                const blob = new Blob(AppState.audioChunks, { type: mimeType });
                const file = new File([blob], "voice.webm", { type: mimeType });
                showToast('Processing speech...', 'info');
                await transcribeAudio(file);
             }
        };
        
        AppState.mediaRecorder.start();
        AppState.isRecording = true;
        
        const checkSilence = () => {
            if (!AppState.isRecording) {
                audioContext.close();
                return;
            }
            
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
            const average = sum / bufferLength;
            
            if (average > silenceThreshold) {
                silenceStart = Date.now();
                isSpeaking = true;
            } else {
                if (isSpeaking && (Date.now() - silenceStart > silenceDelay)) {
                    stopRecording();
                    return;
                }
            }
            requestAnimationFrame(checkSilence);
        };
        
        checkSilence();
        showToast('Listening...', 'info');
        
    } catch (error) {
        console.error('Failed to start recording:', error);
        showToast('Microphone access denied', 'error');
        if (AppState.audioStream) {
            AppState.audioStream.getTracks().forEach(track => track.stop());
            AppState.audioStream = null;
        }
    }
}

// Stop recording audio
export function stopRecording() {
    if (AppState.mediaRecorder && AppState.isRecording) {
        AppState.mediaRecorder.stop();
        AppState.isRecording = false;
        
        const micBtn = document.getElementById('btn-mic');
        micBtn.classList.remove('btn-error', 'animate-pulse');
        
        if (AppState.audioStream) {
            AppState.audioStream.getTracks().forEach(track => track.stop());
        }
        // Close AudioContext to free resources
        if (activeAudioContext) {
            try { activeAudioContext.close(); } catch (e) {}
            activeAudioContext = null;
        }
    }
}

// Transcribe audio
async function transcribeAudio(audioBlob) {
    try {
        const response = await puter.ai.speech2txt(audioBlob);
        let text = typeof response === 'string' ? response : (response?.text || response?.transcription || '');
        
        if (text && text.trim()) {
            // Check for semantic commands (e.g. "Computer, switch theme...")
            const isCommand = await processSemanticCommand(text);
            if (isCommand) {
                if (AppState.isVoiceSession && !isSpeakingAudio) setTimeout(() => startRecording(), 1000);
                return;
            }

            const input = document.getElementById('user-input');
            input.value = (input.value ? input.value + ' ' : '') + text;
            showToast('Transcribed speech', 'success');
            
            // Wait for any background tasks (like mode switching) to finish
            const isIdle = await waitForAIIdle();
            
            if (isIdle) {
                 const { sendMessage } = await import('./ai.js');
                 await sendMessage();
            } else {
                 showToast('AI busy, please press send', 'warning');
            }
        } else {
            showToast('No speech detected', 'warning');
        }
        
        if (AppState.isVoiceSession && !isSpeakingAudio) setTimeout(() => startRecording(), 200); // optimized restart
        
    } catch (error) {
        console.error('Transcription error:', error);
        showToast(`Transcription failed`, 'error');
        if (AppState.isVoiceSession && !isSpeakingAudio) setTimeout(() => startRecording(), 1000);
    }
}

// Toggle Voice Session
export function toggleVoiceSession() {
    const micBtn = document.getElementById('btn-mic');
    if (AppState.isVoiceSession) {
        AppState.isVoiceSession = false;
        stopRecording();
        micBtn.classList.remove('btn-secondary');
        showToast('Continuous Mode: OFF', 'info');
    } else {
        AppState.isVoiceSession = true;
        if (!AppState.isRecording) {
            // Lazy load recording logic if needed, but startRecording is local
            startRecording();
        }
        micBtn.classList.add('btn-secondary');
        showToast('Continuous Mode: ON', 'success');
    }
}
