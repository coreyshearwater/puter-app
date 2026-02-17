import { AppState } from '../state.js';
import { sendMessage } from '../services/ai.js';
import { toggleVoiceSession, stopSpeech } from '../services/voice.js';

export function setupInputListeners() {
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('btn-send');
    const micBtn = document.getElementById('btn-mic');
    const attachBtn = document.getElementById('btn-attach');
    const fileInput = document.getElementById('file-input');

    sendBtn.onclick = () => {
        if (sendBtn.dataset.mode === 'stop') {
            stopSpeech();
        } else {
            sendMessage();
        }
    };
    
    userInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    micBtn.onclick = () => toggleVoiceSession();

    attachBtn.onclick = () => fileInput.click();

    fileInput.onchange = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (AppState.attachedFiles.some(af => af.name === file.name)) continue;
            
            let fileContent = null;
            if (!file.type.startsWith('image/')) {
                try {
                    fileContent = await file.text();
                } catch (err) {
                    console.warn(`Failed to read file ${file.name}`, err);
                    // We'll still add it, but content will be null (handled in ai.js)
                }
            }

            AppState.attachedFiles.push({
                id: `at_${Date.now()}_${Math.random()}`,
                name: file.name,
                type: file.type,
                size: file.size,
                file: file,
                content: fileContent // CACHE: Store content immediately
            });
        }
        renderAttachmentTray();
        e.target.value = '';
    };

    // Shortcut Buttons
    document.getElementById('btn-shortcut-image').onclick = () => {
        userInput.value = '/image ' + userInput.value.replace(/^\/image\s*|^\/video\s*/i, '');
        userInput.focus();
    };
    document.getElementById('btn-shortcut-video').onclick = () => {
        userInput.value = '/video ' + userInput.value.replace(/^\/image\s*|^\/video\s*/i, '');
        userInput.focus();
    };
    
    // OCR Logic
    const ocrInput = document.getElementById('ocr-input');
    document.getElementById('btn-shortcut-ocr').onclick = () => ocrInput.click();
    ocrInput.onchange = async (e) => {
        if (e.target.files.length > 0) {
            const { performOCR } = await import('../services/ai.js');
            await performOCR(e.target.files[0]);
            e.target.value = '';
        }
    };

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
    tray.innerHTML = AppState.attachedFiles.map(file => `
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

export function removeAttachment(id) {
    AppState.attachedFiles = AppState.attachedFiles.filter(f => f.id !== id);
    renderAttachmentTray();
}
