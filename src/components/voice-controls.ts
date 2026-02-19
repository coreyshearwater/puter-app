
let statusTimer: any = null;
let originalSendBtnHTML: string | null = null;

export function setVoiceStatus(text: string | null, autoHideMs: number = 0) {
    const statusEl = document.getElementById('voice-status');
    const textEl = document.getElementById('voice-status-text');
    if (!statusEl || !textEl) return;
    
    if (statusTimer) clearTimeout(statusTimer);
    
    if (text) {
        textEl.textContent = text;
        statusEl.classList.remove('hidden');
        if (autoHideMs > 0) {
            statusTimer = setTimeout(() => {
                statusEl.classList.add('hidden');
            }, autoHideMs);
        }
    } else {
        statusEl.classList.add('hidden');
    }
}

export function setSendButtonSpeaking(isSpeaking: boolean) {
    const btn = document.getElementById('btn-send') as HTMLButtonElement;
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

export function updateMicButton(isRecording: boolean) {
    const micBtn = document.getElementById('btn-mic');
    if (!micBtn) return;
    if (isRecording) {
        micBtn.classList.add('btn-error', 'animate-pulse');
    } else {
        micBtn.classList.remove('btn-error', 'animate-pulse');
    }
}
