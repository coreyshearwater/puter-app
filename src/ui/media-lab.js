import { AppState } from '../state.js';

export function renderMediaLab() {
    let modal = document.getElementById('media-lab-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'media-lab-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm hidden';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="glass-card w-full max-w-md p-6 slide-in relative overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-magenta-500/5 pointer-events-none"></div>
            
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold bg-gradient-to-r from-cyan-400 to-magenta-400 bg-clip-text text-transparent">🎨 Media Lab</h3>
                <button onclick="document.getElementById('media-lab-modal').classList.add('hidden')" class="text-gray-400 hover:text-white">✕</button>
            </div>

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
                        <option value="cinematic">🎬 Cinematic</option>
                        <option value="anime">🌸 Anime</option>
                        <option value="digital-art">💻 Digital Art</option>
                        <option value="photorealistic">📸 Photorealistic</option>
                        <option value="cyberpunk">🌃 Cyberpunk</option>
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

            <button onclick="document.getElementById('media-lab-modal').classList.add('hidden')" 
                    class="btn btn-neon w-full mt-8">Apply Settings</button>
        </div>
    `;

    modal.classList.remove('hidden');
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
