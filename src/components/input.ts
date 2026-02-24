import { AppState } from '../state/state.js';

export function renderAttachmentTray() {

    const tray = document.getElementById('attachment-tray');
    if (!tray) return;

    if (AppState.attachedFiles.length === 0) {
        tray.classList.add('hidden');
        tray.innerHTML = '';
        return;
    }

    // Check for cached state to avoid layout thrashing
    const stateId = AppState.attachedFiles.map(f => f.id).join('|');
    if (tray.dataset.stateId === stateId) return;
    tray.dataset.stateId = stateId;

    tray.classList.remove('hidden');
    tray.innerHTML = AppState.attachedFiles.map((file: any) => `
        <div class="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full group hover:border-cyan-500/50 transition-all duration-300">
            <span class="text-xs">${file.type.startsWith('image/') ? '🖼️' : '📄'}</span>
            <div class="flex flex-col">
                <span class="text-[10px] font-medium text-gray-300 truncate max-w-[120px]">${file.name}</span>
                <span class="text-[8px] text-gray-500">${(file.size / 1024).toFixed(1)}KB</span>
            </div>
            <button onclick="window.gravityChat.removeAttachment('${file.id}')" class="text-gray-500 hover:text-red-400 p-0.5 rounded-full transition-colors">×</button>
        </div>
    `).join('');
}

export function removeAttachment(id: string) {
    AppState.attachedFiles = AppState.attachedFiles.filter((f: any) => f.id !== id);
    renderAttachmentTray();
}
