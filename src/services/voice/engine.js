import { AppState } from '../../state.js';
import { saveStateToKV } from '../storage.js';

let currentAudio = null;
let activeAudioContext = null;

export function loadVoices() {
    const selector = document.getElementById('voice-selector');
    if (!selector) return;
    
    const savedVoice = AppState.selectedVoice || 'Joanna';
    const cloudVoices = [
        { id: 'Joanna', name: 'Cloud: Joanna' },
        { id: 'Matthew', name: 'Cloud: Matthew' },
        { id: 'Amy', name: 'Cloud: Amy' },
        { id: 'Brian', name: 'Cloud: Brian' },
        { id: 'Salli', name: 'Cloud: Salli' },
        { id: 'Joey', name: 'Cloud: Joey' }
    ];
    
    let nativeVoices = [];
    if (window.speechSynthesis) {
        nativeVoices = window.speechSynthesis.getVoices()
            .filter(v => v.lang.startsWith('en'))
            .map(v => ({ id: `native:${v.name}`, name: `Device: ${v.name}` }));
    }
    
    selector.innerHTML = '';
    const cloudGroup = document.createElement('optgroup');
    cloudGroup.label = "High Quality (Cloud)";
    cloudVoices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        cloudGroup.appendChild(opt);
    });
    selector.appendChild(cloudGroup);
    
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
    
    selector.value = savedVoice;
    selector.onchange = (e) => {
        AppState.selectedVoice = e.target.value;
        saveStateToKV();
    };
}

export async function speakText(text, cleanupCallback) {
    if (!text) return;
    const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    if (!cleanText) return;

    const cleanup = () => {
        currentAudio = null;
        if (cleanupCallback) cleanupCallback();
    };

    try {
        const isEdgeForce = AppState.selectedVoice.startsWith('edge:');
        const isNativeForce = AppState.selectedVoice.startsWith('native:');
        
        if (isEdgeForce) {
            try {
                const edgeId = AppState.selectedVoice.substring(5);
                const res = await fetch('http://127.0.0.1:8002/speak', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: cleanText, voice: edgeId }),
                });
                if (!res.ok) throw new Error(`Edge TTS HTTP ${res.status}`);
                const blob = await res.blob();
                currentAudio = new Audio(URL.createObjectURL(blob));
                return new Promise((resolve) => {
                    currentAudio.onended = () => { cleanup(); resolve(); };
                    currentAudio.onerror = () => { cleanup(); resolve(); };
                    currentAudio.play().catch(() => { cleanup(); resolve(); });
                });
            } catch (e) { console.warn('Edge TTS failed:', e); }
        }
        
        if (!isNativeForce && !isEdgeForce) {
            try {
                currentAudio = await puter.ai.txt2speech(cleanText, { language: 'en-US', voice: AppState.selectedVoice });
                return new Promise((resolve) => {
                    currentAudio.onended = () => { cleanup(); resolve(); };
                    currentAudio.onerror = () => { cleanup(); resolve(); };
                    currentAudio.play().catch(() => { cleanup(); resolve(); });
                });
            } catch (e) { console.warn('Puter TTS failed:', e); }
        }
        
        // Native Fallback
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        let voice = null;
        if (isNativeForce) {
            voice = voices.find(v => v.name === AppState.selectedVoice.substring(7));
        }
        if (!voice) voice = voices.find(v => v.name.includes('Google') || v.name.includes('Microsoft')) || voices[0];
        if (voice) utterance.voice = voice;
        
        return new Promise((resolve) => {
            utterance.onend = () => { cleanup(); resolve(); };
            utterance.onerror = () => { cleanup(); resolve(); };
            window.speechSynthesis.speak(utterance);
        });
    } catch (e) {
        console.error('TTS Engine Error:', e);
        cleanup();
    }
}

export function stopHardwareAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

export async function captureAudio(onStart, onStop, onSilence) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    AppState.audioStream = stream;
    
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
    
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    AppState.mediaRecorder = new MediaRecorder(stream, { mimeType });
    AppState.audioChunks = [];
    
    AppState.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) AppState.audioChunks.push(e.data);
    };
    
    AppState.mediaRecorder.onstop = () => onStop(AppState.audioChunks, mimeType);
    
    AppState.mediaRecorder.start();
    onStart();

    const silenceThreshold = 10;
    const silenceDelay = 700;
    let silenceStart = Date.now();
    let isSpeaking = false;

    const checkSilence = () => {
        if (!AppState.isRecording) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        
        if (average > silenceThreshold) {
            silenceStart = Date.now();
            isSpeaking = true;
        } else if (isSpeaking && (Date.now() - silenceStart > silenceDelay)) {
            onSilence();
            return;
        }
        requestAnimationFrame(checkSilence);
    };
    requestAnimationFrame(checkSilence);
}

export function stopHardwareMic() {
    if (AppState.mediaRecorder && AppState.isRecording) {
        AppState.mediaRecorder.stop();
        if (AppState.audioStream) {
            AppState.audioStream.getTracks().forEach(track => track.stop());
        }
        if (activeAudioContext) {
            try { activeAudioContext.close(); } catch (e) {}
            activeAudioContext = null;
        }
    }
}
