import { AppState } from '../../state.js';
import { speakText, stopHardwareAudio, captureAudio, stopHardwareMic } from './engine.js';
import { setVoiceStatus, setSendButtonSpeaking, updateMicButton } from '../../ui/voice-controls.js';
import { processSemanticCommand } from '../intents.js';

let speechQueue = [];
let activeSpeakingBubble = null;

export async function waitForAIIdle(timeout = 5000) {
    if (!AppState.isStreaming) return true;
    const start = Date.now();
    while (AppState.isStreaming) {
        if (Date.now() - start > timeout) return false;
        await new Promise(r => setTimeout(r, 200));
    }
    return true;
}

export async function handleQueueSpeech(text, bubble, startRecording) {
    if (!text || !text.trim()) return;
    if (speechQueue.length === 0) {
        activeSpeakingBubble = bubble;
        setSendButtonSpeaking(true);
    }
    speechQueue.push({ text, bubble });
    if (!AppState.isSpeakingAudio) processSpeechQueue(startRecording);
}

async function processSpeechQueue(startRecording) {
    if (speechQueue.length === 0) {
        AppState.isSpeakingAudio = false;
        if (activeSpeakingBubble) {
            const btn = activeSpeakingBubble.querySelector('.stop-gen-btn');
            if (btn) btn.remove();
        }
        activeSpeakingBubble = null;
        setSendButtonSpeaking(false);
        if (AppState.isVoiceSession && !AppState.isRecording && !AppState.voiceSuspended) {
            setTimeout(() => startRecording(), 500);
        }
        return;
    }

    if (!AppState.isSpeakingAudio) {
        if (AppState.isRecording) {
            stopHardwareMic();
            AppState.isRecording = false;
            updateMicButton(false);
            await new Promise(r => setTimeout(r, 150));
        }
    }
    
    AppState.isSpeakingAudio = true;
    const { text, bubble } = speechQueue.shift();
    
    if (bubble && !bubble.querySelector('.stop-gen-btn')) {
        const btn = document.createElement('button');
        btn.className = 'stop-gen-btn';
        btn.title = 'Stop voice playback';
        btn.onclick = (e) => {
            e.stopPropagation();
            stopAllSpeech();
        };
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
        bubble.appendChild(btn);
    }
    
    await speakText(text, () => {}); 
    processSpeechQueue(startRecording);
}

export function stopAllSpeech() {
    stopHardwareAudio();
    setSendButtonSpeaking(false);
    speechQueue = [];
    AppState.isSpeakingAudio = false;
    if (activeSpeakingBubble) {
        const btn = activeSpeakingBubble.querySelector('.stop-gen-btn');
        if (btn) btn.remove();
    }
    activeSpeakingBubble = null;
}

export async function transcribeAndAction(audioBlob, startRecording) {
    try {
        const response = await puter.ai.speech2txt(audioBlob);
        let text = typeof response === 'string' ? response : (response?.text || response?.transcription || '');
        
        if (text && text.trim()) {
            const isCommand = await processSemanticCommand(text);
            if (isCommand) {
                if (AppState.isVoiceSession && !AppState.isSpeakingAudio && !AppState.voiceSuspended) {
                    setTimeout(() => startRecording(), 1000);
                }
                return;
            }

            const input = document.getElementById('user-input');
            input.value = (input.value ? input.value + ' ' : '') + text;
            setVoiceStatus('TRANSCRIBED', 2000);
            
            const isIdle = await waitForAIIdle();
            if (isIdle) {
                 const { sendMessage } = await import('../ai.js');
                 await sendMessage();
            } else {
                 setVoiceStatus('SYSTEM BUSY', 2000);
                 if (AppState.isVoiceSession && !AppState.voiceSuspended) setTimeout(() => startRecording(), 1000);
            }
        } else {
            setVoiceStatus('NO SPEECH', 2000);
            if (AppState.isVoiceSession && !AppState.voiceSuspended) setTimeout(() => startRecording(), 200);
        }
    } catch (error) {
        console.error('Transcription error:', error);
        setVoiceStatus('ERROR', 2000);
        if (AppState.isVoiceSession && !AppState.voiceSuspended) setTimeout(() => startRecording(), 1000);
    }
}
