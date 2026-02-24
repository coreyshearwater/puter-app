import { AppState } from '../../state/state.js';
import { sendMessage } from '../../services/ai.js';
import { toggleVoiceSession, stopSpeech } from '../../services/voice.js';
import { renderAttachmentTray } from '../input.js';

export function setupChatListeners() {
    const userInput = document.getElementById('user-input') as HTMLTextAreaElement;
    const sendBtn = document.getElementById('btn-send') as HTMLButtonElement;
    const micBtn = document.getElementById('btn-mic') as HTMLButtonElement;
    const attachBtn = document.getElementById('btn-attach') as HTMLButtonElement;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;

    if (sendBtn) {
        sendBtn.onclick = () => {
            if (sendBtn.dataset.mode === 'stop') {
                stopSpeech();
            } else {
                sendMessage();
            }
        };
    }
    
    if (userInput) {
        userInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        };
    }

    if (micBtn) micBtn.onclick = () => toggleVoiceSession();

    if (attachBtn) attachBtn.onclick = () => fileInput.click();

    if (fileInput) {
        fileInput.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const files = Array.from(target.files || []) as File[];
            for (const file of files) {
                if (AppState.attachedFiles.some((af: any) => af.name === file.name)) continue;
                
                let fileContent: string | null = null;
                if (!file.type.startsWith('image/')) {
                    try {
                        fileContent = await file.text();
                    } catch (err) {
                        console.warn(`Failed to read file ${file.name}`, err);
                    }
                }

                AppState.attachedFiles.push({
                    id: `at_${Date.now()}_${Math.random()}`,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    file: file,
                    content: fileContent
                });
            }
            target.value = '';
        };
    }

    document.addEventListener('renderAttachments', renderAttachmentTray);

    // Shortcut Buttons
    const imgBtn = document.getElementById('btn-shortcut-image');
    if (imgBtn) {
        imgBtn.onclick = () => {
            if (userInput) {
                userInput.value = '/image ' + userInput.value.replace(/^\/image\s*|^\/video\s*/i, '');
                userInput.focus();
            }
        };
    }
    const vidBtn = document.getElementById('btn-shortcut-video');
    if (vidBtn) {
        vidBtn.onclick = () => {
            if (userInput) {
                userInput.value = '/video ' + userInput.value.replace(/^\/image\s*|^\/video\s*/i, '');
                userInput.focus();
            }
        };
    }
    
    // OCR Logic
    const ocrInput = document.getElementById('ocr-input') as HTMLInputElement;
    const ocrBtn = document.getElementById('btn-shortcut-ocr');
    if (ocrBtn && ocrInput) ocrBtn.onclick = () => ocrInput.click();
    if (ocrInput) {
        ocrInput.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const { performOCR } = await import('../../services/ai.js');
                await performOCR(target.files[0]);
                target.value = '';
            }
        };
    }
}
