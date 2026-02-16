import { AppState } from '../state.js';
import { showToast } from '../utils/toast.js';
// Removed static import of sendMessage to break circular dependency with ai.js
import { saveStateToKV } from './storage.js';
import { processSemanticCommand } from './intents.js';

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
export async function speakText(text) {
    if (!text || !AppState.autoSpeak) return;
    
    // Clean text: strip emojis to prevent TTS from reading them out loud
    const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    
    if (!cleanText) return;

    try {
        console.log('Speaking text (cleaned)...');
        
        // Check if user selected a native voice directly
        const isNativeForce = AppState.selectedVoice.startsWith('native:');
        
        if (!isNativeForce) {
            // Try Puter AI TTS first
            try {
                console.log(`Attempting Cloud TTS: ${AppState.selectedVoice}`);
                // Puter.js v2 txt2speech signature: (text, languageCode, voiceName)
                const audio = await puter.ai.txt2speech(cleanText, 'en-US', AppState.selectedVoice);
                
                return new Promise((resolve) => {
                    audio.onended = () => resolve();
                    audio.onerror = (e) => {
                        console.error('Audio playback error', e);
                        resolve(); 
                    };
                    audio.play().catch(e => {
                         console.error('Play error', e); 
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
                 utterance.onend = () => resolve();
                 utterance.onerror = () => resolve();
                 window.speechSynthesis.speak(utterance);
             });
        } catch (nativeError) {
            console.error('Native TTS error:', nativeError);
        }
    } catch (outerError) {
        console.error('Outer TTS error:', outerError);
    }
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
        
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const silenceThreshold = 10;
        const silenceDelay = 1500;
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
                if (AppState.isVoiceSession) setTimeout(() => startRecording(), 1000);
                return;
            }

            const input = document.getElementById('user-input');
            input.value = (input.value ? input.value + ' ' : '') + text;
            showToast('Transcribed speech', 'success');
            
            if (AppState.isVoiceSession) {
                const { sendMessage } = await import('./ai.js');
                await sendMessage();
            }
        } else {
            showToast('No speech detected', 'warning');
        }
        
        if (AppState.isVoiceSession) setTimeout(() => startRecording(), 500); 
        
    } catch (error) {
        console.error('Transcription error:', error);
        showToast(`Transcription failed`, 'error');
        if (AppState.isVoiceSession) setTimeout(() => startRecording(), 1000);
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
