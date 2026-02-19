
import { AppState } from '../state/state.js';
import { sendMessage } from '../services/ai.js';
import { toggleVoiceSession, stopSpeech } from '../services/voice.js';

export function setupInputListeners() {
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
            renderAttachmentTray();
            target.value = '';
        };
    }

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
                const { performOCR } = await import('../services/ai.js');
                await performOCR(target.files[0]);
                target.value = '';
            }
        };
    }

    document.addEventListener('renderAttachments', renderAttachmentTray);
}

export function renderAttachmentTray() {
    const tray = document.getElementById('attachment-tray');
    if (!tray) return;

    if (AppState.attachedFiles.length === 0) {
        tray.classList.add('hidden');
        tray.innerHTML = '';
        return;
    }

    tray.classList.remove('hidden');
    tray.innerHTML = AppState.attachedFiles.map((file: any) => `
        <div class="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full group hover:border-cyan-500/50 transition-all duration-300">
            <span class="text-xs">${file.type.startsWith('image/') ? '🖼️' : '📄'}</span>
            <div class="flex flex-col">
                <span class="text-[10px] font-medium text-gray-300 truncate max-w-[120px]">${file.name}</span>
                <span class="text-[8px] text-gray-500">${(file.size / 1024).toFixed(1)}KB</span>
            </div>
            <button onclick="window.gravityChat.removeAttachment('${file.id}')" class="text-gray-500 hover:text-red-400 p-0.5 rounded-full">×</button>
        </div>
    `).join('');
}

export function removeAttachment(id: string) {
    AppState.attachedFiles = AppState.attachedFiles.filter((f: any) => f.id !== id);
    renderAttachmentTray();
}
