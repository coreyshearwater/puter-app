import { AppState } from '../state/state.js';
import { showToast } from '../utils/toast.js';
import { loadVoices as loadEngineVoices, speakText as engineSpeakText, stopHardwareAudio, captureAudio, stopHardwareMic } from './voice/engine.js';
import { handleQueueSpeech, stopAllSpeech, transcribeAndAction, waitForAIIdle } from './voice/logic.js';
import { setVoiceStatus, updateMicButton } from '../components/voice-controls.js';
import { Logger } from '../utils/logger.js';

export function loadVoices() {
    loadEngineVoices();
}

// Global voices change listener
if (window.speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

export async function queueSpeech(text, bubble) {
    return handleQueueSpeech(text, bubble, startRecording);
}

export async function speakText(text, bubble, isInternal = false) {
    if (!isInternal) stopSpeech();
    return engineSpeakText(text);
}

export function stopSpeech() {
    stopAllSpeech();
    // Resume recording if in voice session
    if (AppState.isVoiceSession && !AppState.isRecording && !AppState.voiceSuspended) {
        setVoiceStatus('RESUMING MIC...', 1000);
        setTimeout(() => startRecording(), 500);
    }
}

export async function startRecording() {
    if (AppState.isRecording) {
        stopRecording();
        return;
    }
    if (AppState.voiceSuspended) return;

    try {
        await captureAudio(
            () => {
                AppState.isRecording = true;
                updateMicButton(true);
                setVoiceStatus('LISTENING...');
            },
            async (chunks, mimeType) => {
                if (chunks.length > 0) {
                    const blob = new Blob(chunks, { type: mimeType });
                    const file = new File([blob], "voice.webm", { type: mimeType });
                    setVoiceStatus('PROCESSING...');
                    await transcribeAndAction(file, startRecording);
                }
            },
            () => {
                stopRecording();
            }
        );
    } catch (error) {
        Logger.error('Voice', 'Mic failed:', error);
        showToast('Microphone access denied', 'error');
        AppState.isRecording = false;
        updateMicButton(false);
    }
}

export function stopRecording() {
    if (AppState.isRecording) {
        stopHardwareMic();
        AppState.isRecording = false;
        updateMicButton(false);
        setVoiceStatus(null);
    }
}

export function toggleVoiceSession() {
    const micBtn = document.getElementById('btn-mic');
    if (AppState.isVoiceSession) {
        AppState.isVoiceSession = false;
        stopRecording();
        micBtn?.classList.remove('btn-secondary');
        setVoiceStatus('CONTINUOUS: OFF', 2000);
    } else {
        AppState.isVoiceSession = true;
        if (!AppState.isRecording) startRecording();
        micBtn?.classList.add('btn-secondary');
        setVoiceStatus('CONTINUOUS: ON', 2000);
    }
}
