import { AppState } from '../state.js';

export function renderMediaLab() {
    const modal = document.getElementById('media-lab-modal');
    const content = document.getElementById('media-lab-content');
    if (!modal || !content) return;

    content.innerHTML = `
        <div class="space-y-6">
            <!-- Aspect Ratio -->
            <div>
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 block">Aspect Ratio</label>
                <div class="grid grid-cols-3 gap-2">
                    ${['1:1', '16:9', '9:16'].map(ratio => `
                        <button onclick="window.gravityChat.setMediaParam('aspectRatio', '${ratio}')" 
                                class="btn btn-sm btn-outline ${AppState.mediaParams?.aspectRatio === ratio ? 'border-cyan-500 text-cyan-400' : 'border-white/10'}">
                            ${ratio}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Artistic Style -->
            <div>
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 block">Artistic Style</label>
                <select onchange="window.gravityChat.setMediaParam('style', this.value)" class="select select-bordered select-sm w-full bg-black/20">
                    <option value="cinematic" ${AppState.mediaParams?.style === 'cinematic' ? 'selected' : ''}>🎬 Cinematic</option>
                    <option value="anime" ${AppState.mediaParams?.style === 'anime' ? 'selected' : ''}>🌸 Anime</option>
                    <option value="digital-art" ${AppState.mediaParams?.style === 'digital-art' ? 'selected' : ''}>💻 Digital Art</option>
                    <option value="photorealistic" ${AppState.mediaParams?.style === 'photorealistic' ? 'selected' : ''}>📸 Photorealistic</option>
                    <option value="cyberpunk" ${AppState.mediaParams?.style === 'cyberpunk' ? 'selected' : ''}>🌃 Cyberpunk</option>
                </select>
            </div>

            <!-- Negative Prompt -->
            <div>
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 block">Negative Prompt</label>
                <textarea oninput="window.gravityChat.setMediaParam('negativePrompt', this.value)" 
                          class="textarea textarea-bordered textarea-sm w-full bg-black/20" 
                          placeholder="What to exclude...">${AppState.mediaParams?.negativePrompt || ''}</textarea>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
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
