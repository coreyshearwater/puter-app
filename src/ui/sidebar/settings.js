import { AppState } from '../../state.js';
import { updateElementText } from '../../utils/dom.js';
import { showToast } from '../../utils/toast.js';
import { saveStateToKV } from '../../services/storage.js';
import { applyTheme } from '../../utils/theme.js';

export function renderSettings() {
    const container = document.getElementById('settings-container');
    if (!container) return;

    container.innerHTML = `
        <div>
            <label class="text-sm font-semibold mb-2 block">Personalization</label>
            <div class="mb-3">
                <label class="text-xs text-gray-400 mb-1 block">Mood Theme</label>
                <select id="theme-selector" class="select select-bordered select-sm w-full">
                    <option value="void" ${AppState.theme === 'void' ? 'selected' : ''}>Void (Classic)</option>
                    <option value="toxic" ${AppState.theme === 'toxic' ? 'selected' : ''}>Toxic (Green)</option>
                    <option value="overdrive" ${AppState.theme === 'overdrive' ? 'selected' : ''}>Overdrive (Bright)</option>
                </select>
            </div>
            <label class="flex items-center justify-between p-3 glass-card cursor-pointer">
                <span class="text-sm">Allow AI Emojis</span>
                <input type="checkbox" id="emoji-toggle" class="toggle toggle-sm toggle-accent" ${AppState.allowEmojis ? 'checked' : ''} />
            </label>
        </div>
        <div class="divider"></div>
        <div>
            <label class="text-sm font-semibold mb-2 block">Voice Settings</label>
            <label class="flex items-center justify-between p-3 glass-card cursor-pointer mb-3">
                <span class="text-sm">Auto-speak responses</span>
                <input type="checkbox" id="auto-speak-toggle" class="toggle toggle-sm toggle-primary" ${AppState.autoSpeak ? 'checked' : ''} />
            </label>
            <div class="mb-3">
                <label class="text-xs text-gray-400 mb-1 block">TTS Voice</label>
                <select id="voice-selector" class="select select-bordered select-sm w-full"></select>
            </div>
        </div>
        <div class="divider"></div>
        <div>
            <label class="text-sm font-semibold mb-2 block">Chat Settings</label>
            <div class="mb-3">
                <label class="text-xs text-gray-400 mb-1 block">Temperature: <span id="temp-value">${AppState.temperature}</span></label>
                <input type="range" id="temperature-slider" min="0" max="2" step="0.1" value="${AppState.temperature}" class="range range-xs range-primary" />
            </div>
            <div>
                <label class="text-xs text-gray-400 mb-1 block">Max Tokens</label>
                <input type="number" id="max-tokens-input" value="${AppState.maxTokens}" class="input input-bordered input-sm w-full" />
            </div>
        </div>
        <div class="divider"></div>
        <div>
            <label class="text-sm font-semibold mb-2 block">Data</label>
            <div class="grid grid-cols-2 gap-3 mt-2">
                <button id="btn-export-chat" class="btn btn-sm btn-outline border-cyan-500/30 text-cyan-400 font-medium text-xs uppercase">Export</button>
                <button id="btn-clear-chat" class="btn btn-sm btn-outline border-red-500/30 text-red-400 font-medium text-xs uppercase">Clear</button>
            </div>
        </div>
    `;

    setupSettingsListeners();
}

function setupSettingsListeners() {
    document.getElementById('theme-selector').onchange = (e) => applyTheme(e.target.value);
    
    document.getElementById('emoji-toggle').onchange = (e) => {
        AppState.allowEmojis = e.target.checked;
        saveStateToKV();
        showToast(`AI Emojis ${AppState.allowEmojis ? 'enabled' : 'disabled'}`, 'info');
    };

    document.getElementById('auto-speak-toggle').onchange = (e) => {
        AppState.autoSpeak = e.target.checked;
        saveStateToKV();
    };
    document.getElementById('temperature-slider').oninput = (e) => {
        AppState.temperature = parseFloat(e.target.value);
        updateElementText('temp-value', e.target.value);
    };
    document.getElementById('temperature-slider').onchange = () => saveStateToKV();
    document.getElementById('max-tokens-input').onchange = (e) => {
        AppState.maxTokens = parseInt(e.target.value);
        saveStateToKV();
    };
    
    document.getElementById('btn-export-chat').onclick = () => window.gravityChat.exportChat();
    document.getElementById('btn-clear-chat').onclick = () => window.gravityChat.clearChat();
}
