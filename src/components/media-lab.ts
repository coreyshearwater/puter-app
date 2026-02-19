
import { AppState } from '../state/state.js';
import { saveStateToKV } from '../services/storage.js';

export function renderMediaLab() {
    const modal = document.getElementById('media-lab-modal');
    const content = document.getElementById('media-lab-content');
    if (!modal || !content) return;

    const params = AppState.mediaParams || { aspectRatio: '1:1', style: 'cinematic', negativePrompt: '' };

    content.innerHTML = `
        <div class="space-y-6">
            <!-- Aspect Ratio -->
            <div>
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 block">Aspect Ratio</label>
                <div class="grid grid-cols-3 gap-2">
                    ${['1:1', '16:9', '9:16'].map(ratio => `
                        <button onclick="window.gravityChat.setMediaParam('aspectRatio', '${ratio}')" 
                                class="btn btn-sm btn-outline ${params.aspectRatio === ratio ? 'border-cyan-500 text-cyan-400' : 'border-white/10'}">
                            ${ratio}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Artistic Style -->
            <div>
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 block">Artistic Style</label>
                <select onchange="window.gravityChat.setMediaParam('style', (this as HTMLSelectElement).value)" class="select select-bordered select-sm w-full bg-black/20">
                    <option value="cinematic" ${params.style === 'cinematic' ? 'selected' : ''}>🎬 Cinematic</option>
                    <option value="anime" ${params.style === 'anime' ? 'selected' : ''}>🌸 Anime</option>
                    <option value="digital-art" ${params.style === 'digital-art' ? 'selected' : ''}>💻 Digital Art</option>
                    <option value="photorealistic" ${params.style === 'photorealistic' ? 'selected' : ''}>📸 Photorealistic</option>
                    <option value="cyberpunk" ${params.style === 'cyberpunk' ? 'selected' : ''}>🌃 Cyberpunk</option>
                </select>
            </div>

            <!-- Negative Prompt -->
            <div>
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 block">Negative Prompt</label>
                <textarea oninput="window.gravityChat.setMediaParam('negativePrompt', (this as HTMLTextAreaElement).value)" 
                          class="textarea textarea-bordered textarea-sm w-full bg-black/20" 
                          placeholder="What to exclude...">${params.negativePrompt || ''}</textarea>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

export function setMediaParam(key: string, value: any) {
    if (!AppState.mediaParams) initMediaParams();
    if (AppState.mediaParams) {
        (AppState.mediaParams as any)[key] = value;
    }
    saveStateToKV();
    // Re-render UI to update button states
    renderMediaLab();
}

export function initMediaParams() {
    if (!AppState.mediaParams) {
        AppState.mediaParams = {
            aspectRatio: '1:1',
            style: 'cinematic',
            negativePrompt: ''
        };
    }
}
