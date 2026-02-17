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
                    <option value="void" ${AppState.theme === 'void' ? 'selected' : ''}>Void (Default)</option>
                    <option value="toxic" ${AppState.theme === 'toxic' ? 'selected' : ''}>Toxic (Hacker)</option>
                    <option value="cyberpunk" ${AppState.theme === 'cyberpunk' ? 'selected' : ''}>Cyberpunk (High-Vis)</option>
                    <option value="deepsea" ${AppState.theme === 'deepsea' ? 'selected' : ''}>Deep Sea (Calm)</option>
                    <option value="midnight" ${AppState.theme === 'midnight' ? 'selected' : ''}>Midnight (Sleek Onyx)</option>
                </select>
            </div>
            <label class="flex items-center justify-between p-3 glass-card cursor-pointer">
                <span class="text-sm">Allow AI Emojis</span>
                <input type="checkbox" id="emoji-toggle" class="toggle toggle-sm toggle-accent" ${AppState.allowEmojis ? 'checked' : ''} />
            </label>
        </div>
        <div class="divider"></div>
        <div>
            <label class="text-sm font-semibold mb-2 block">Grok Automation</label>
            <p class="text-[10px] text-gray-400 mb-3 italic leading-tight">
                Grok 4.20 requires a valid session. Log in once via the app browser to enable zero-touch automation.
            </p>
            <div class="space-y-3">
                <button id="btn-grok-login" onclick="window.open('https://grok.com', '_blank')" class="btn btn-xs btn-neon w-full" title="Open Grok in bundled browser to authenticate">
                    🔑 Authenticate in Browser
                </button>
                
                <div class="collapse collapse-arrow bg-black/20 rounded-lg">
                    <input type="checkbox" id="grok-advanced-toggle" class="peer" /> 
                    <div class="collapse-title text-[10px] font-bold py-2 min-h-0 text-gray-400">
                        ADVANCED (MANUAL)
                    </div>
                    <div class="collapse-content space-y-2 !pb-3">
                        <div class="flex items-center gap-2">
                            <input type="text" id="grok-sso" placeholder="sso" value="${AppState.grokCookies?.sso || ''}" 
                                   class="input input-bordered input-xs flex-1 font-mono text-[10px]" />
                            <input type="text" id="grok-sso-rw" placeholder="sso-rw" value="${AppState.grokCookies?.['sso-rw'] || ''}" 
                                   class="input input-bordered input-xs flex-1 font-mono text-[10px]" />
                        </div>
                        <button id="btn-magic-paste-cookies" class="btn btn-xs btn-outline border-fuchsia-500/30 text-fuchsia-400 w-full" title="Parse raw cookies from clipboard">
                            ✨ Magic Paste
                        </button>
                    </div>
                </div>
            </div>
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
                <div class="flex items-center gap-2">
                    <div class="flex-1 glass-card p-2 text-xs truncate" id="current-voice-display">${AppState.selectedVoice || 'Joanna'}</div>
                    <button id="btn-browse-voices" class="btn btn-sm btn-outline border-cyan-500/30 text-cyan-400 text-xs flex-shrink-0" title="Browse all available voices">
                        🎤 Browse
                    </button>
                </div>
                <select id="voice-selector" class="hidden"></select>
            </div>
        </div>
        <div class="divider"></div>
        <div>
            <label class="text-sm font-semibold mb-2 block">Chat Settings</label>
            <div id="temperature-container" class="mb-5 transition-opacity duration-300 relative">
                <div class="flex justify-between items-center mb-1">
                    <label class="text-xs text-gray-400 block">Temperature</label>
                    <span id="temp-value" class="text-[10px] font-mono text-cyan-400 bg-cyan-400/10 px-1.5 rounded">${AppState.temperature.toFixed(1)}</span>
                </div>
                
                <div class="relative pt-4 pb-2">
                    <input type="range" id="temperature-slider" min="0" max="2" step="0.1" value="${AppState.temperature}" list="temp-markers" class="custom-range w-full" />
                    
                    <!-- Default Snap Marker -->
                    <div class="absolute top-0" style="left: 25%; transform: translateX(-50%);">
                        <div class="flex flex-col items-center">
                            <span class="text-[9px] font-bold text-cyan-500/80 leading-none">0.5</span>
                            <span class="text-[7px] text-cyan-500/40 uppercase tracking-tighter mt-0.5">(Optimal)</span>
                            <div class="w-[1px] h-2 bg-cyan-500/30 mt-0.5"></div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-between w-full px-0.5 mt-[-2px]">
                    <span class="text-[8px] text-gray-600">PRECISE</span>
                    <span class="text-[8px] text-gray-600">CREATIVE</span>
                </div>
            </div>
            <div>
                <label class="text-xs text-gray-400 mb-1 block">Max Tokens</label>
                <input type="number" id="max-tokens-input" value="${AppState.maxTokens}" class="input input-bordered input-sm w-full" />
            </div>
        </div>
        <div class="divider"></div>
        <div>
            <label class="text-sm font-semibold mb-2 block">Data</label>
            <div class="space-y-3 mt-2">
                <div class="grid grid-cols-2 gap-3">
                    <button id="btn-export-chat" class="btn btn-sm btn-outline border-cyan-500/30 text-cyan-400 font-medium text-xs uppercase" title="Save current chat as .md file">Export</button>
                    <button id="btn-clear-chat" class="btn btn-sm btn-outline border-red-500/30 text-red-400 font-medium text-xs uppercase" title="Wipe current chat history">Clear</button>
                </div>
                <button id="btn-reset-defaults" class="btn btn-sm btn-outline border-orange-500/30 text-orange-400 font-medium text-xs uppercase w-full">Reboot Core (Reset)</button>
            </div>
            <p class="text-[9px] text-gray-500 mt-3 text-center italic">"Export" saves chat as Markdown. "Clear" wipes history.</p>
        </div>
    `;

    setupSettingsListeners();
    updateTemperatureVisibility();
}

export function updateTemperatureVisibility() {
    const container = document.getElementById('temperature-container');
    if (!container) return;

    const isGrok = AppState.currentModel.toLowerCase().includes('grok');
    
    if (isGrok) {
        container.classList.add('opacity-50', 'pointer-events-none', 'grayscale');
        container.title = "Not supported by Grok models";
    } else {
        container.classList.remove('opacity-50', 'pointer-events-none', 'grayscale');
        container.title = "";
    }
}

function setupSettingsListeners() {
    document.getElementById('btn-reset-defaults').onclick = async () => {
        const { showConfirmModal } = await import('../../utils/modals.js');
        showConfirmModal(
            'Reboot Core Settings', 
            'This will restore all sliders, voices, themes, and models to their factory defaults. Persistant chats and personas will remain, but active state will reset. Continue?', 
            () => {
                // Reset to hardcoded defaults
                AppState.theme = 'void';
                AppState.allowEmojis = false;
                AppState.autoSpeak = false;
                AppState.selectedVoice = 'Joanna';
                AppState.temperature = 0.5;
                AppState.maxTokens = 4096;
                AppState.currentModel = 'z-ai/glm-4.5-air:free';
                AppState.premiumEnabled = false;

                // Apply changes
                applyTheme('void');
                saveStateToKV();
                renderSettings();
                
                // Update specific UI bits
                import('./models.js').then(m => m.updateCurrentModelDisplay());
                import('../../services/voice.js').then(v => v.loadVoices());
                
                showToast('Core settings restored to factory defaults', 'success');
            }
        );
    };
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
        let val = parseFloat(e.target.value);
        
        // Magnetic snap to 0.5 (Default)
        if (val >= 0.4 && val <= 0.6) {
            val = 0.5;
            e.target.value = 0.5;
        }
        
        AppState.temperature = val;
        updateElementText('temp-value', val.toFixed(1));
    };
    document.getElementById('temperature-slider').onchange = () => saveStateToKV();
    document.getElementById('max-tokens-input').onchange = (e) => {
        AppState.maxTokens = parseInt(e.target.value);
        saveStateToKV();
    };
    
    document.getElementById('btn-export-chat').onclick = () => window.gravityChat.exportChat();
    document.getElementById('btn-clear-chat').onclick = () => window.gravityChat.clearChat();
    document.getElementById('btn-browse-voices').onclick = () => window.gravityChat.openVoiceBrowser();

    // Grok Cookie Listeners
    const ssoInput = document.getElementById('grok-sso');
    const ssoRwInput = document.getElementById('grok-sso-rw');
    
    if (ssoInput && ssoRwInput) {
        const saveGrokCookies = () => {
            AppState.grokCookies = {
                sso: ssoInput.value.trim(),
                'sso-rw': ssoRwInput.value.trim()
            };
            saveStateToKV();
        };

        ssoInput.oninput = saveGrokCookies;
        ssoRwInput.oninput = saveGrokCookies;

        const magicPasteBtn = document.getElementById('btn-magic-paste-cookies');
        if (magicPasteBtn) {
            magicPasteBtn.onclick = async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    const ssoMatch = text.match(/sso=([^;]+)/);
                    const ssoRwMatch = text.match(/sso-rw=([^;]+)/);
                    
                    let found = false;
                    if (ssoMatch) {
                        ssoInput.value = ssoMatch[1];
                        found = true;
                    }
                    if (ssoRwMatch) {
                        ssoRwInput.value = ssoRwMatch[1];
                        found = true;
                    }
                    
                    if (found) {
                        saveGrokCookies();
                        showToast('Cookies extracted and applied!', 'success');
                    } else {
                        showToast('No Grok cookies found in clipboard', 'warning');
                    }
                } catch (e) {
                    showToast('Clipboard access denied', 'error');
                }
            };
        }
    }
}
