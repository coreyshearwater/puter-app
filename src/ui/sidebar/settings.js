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
                <div class="custom-toggle" id="emoji-toggle-btn" style="width: 60px; height: 20px;">
                     <div class="flex h-full items-center relative z-10 w-full">
                        <span class="toggle-label active-text text-[8px]" data-val="off">OFF</span>
                        <span class="toggle-label inactive-text text-[8px]" data-val="on">ON</span>
                    </div>
                </div>
            </label>
        </div>

        <div class="divider"></div>
        <div>
            <label class="text-sm font-semibold mb-2 block">Voice Settings</label>
            <label class="flex items-center justify-between p-3 glass-card cursor-pointer mb-3">
                <span class="text-sm">Auto-speak responses</span>
                <div class="custom-toggle" id="auto-speak-toggle-btn" style="width: 60px; height: 20px;">
                     <div class="flex h-full items-center relative z-10 w-full">
                        <span class="toggle-label active-text text-[8px]" data-val="mute">MUTE</span>
                        <span class="toggle-label inactive-text text-[8px]" data-val="talk">TALK</span>
                    </div>
                </div>
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
            </div>
            <p class="text-[9px] text-gray-500 mt-3 text-center italic">"Export" saves chat as Markdown. "Clear" wipes history.</p>
        </div>
        <div class="divider"></div>
        <div class="collapse collapse-arrow rounded-lg border" style="background: var(--bg-elevated); border-color: var(--glass-border); opacity: 0.8;">
            <input type="checkbox" /> 
            <div class="collapse-title text-sm font-semibold min-h-0 py-2" style="color: #9ca3af;">
                Advanced / Debug
            </div>
            <div class="collapse-content px-2 pb-2">
                <div class="space-y-2 pt-2">
                    <button id="btn-reset-defaults" class="btn btn-xs btn-outline font-medium text-[10px] uppercase w-full h-auto py-1" style="border-color: var(--neon-orange); color: var(--neon-orange);">Reboot Core (Reset)</button>
                    
                    <div class="p-2 rounded-lg border" style="background: var(--bg-dark); border-color: var(--glass-border);">
                        <label class="text-[9px] font-bold block mb-1 uppercase tracking-widest leading-none" style="color: var(--text-muted);">Manual Cookies</label>
                        <div class="flex flex-col gap-1 mb-1">
                            <input type="text" id="grok-sso" placeholder="sso token" value="${AppState.grokCookies?.sso || ''}" 
                                   class="input input-bordered input-xs w-full h-6 font-mono text-[9px] px-1" 
                                   style="background: var(--bg-void); border-color: var(--glass-border); color: var(--text-bright);" />
                            <input type="text" id="grok-sso-rw" placeholder="sso-rw" value="${AppState.grokCookies?.['sso-rw'] || ''}" 
                                   class="input input-bordered input-xs w-full h-6 font-mono text-[9px] px-1" 
                                   style="background: var(--bg-void); border-color: var(--glass-border); color: var(--text-bright);" />
                        </div>
                        <button id="btn-magic-paste-cookies" class="btn btn-xs btn-outline w-full h-6 min-h-0 text-[10px]" 
                                style="border-color: var(--neon-primary); color: var(--neon-primary); opacity: 0.7;"
                                title="Parse raw cookies from clipboard">
                            ✨ Magic Paste Cookies
                        </button>
                    </div>
                </div>
            </div>
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
    
    // --- NEW TOGGLE LOGIC ---
    const setupToggle = (id, initialState, onToggle) => {
        const toggle = document.getElementById(id);
        if (!toggle) return;
        
        // Initial State
        if (initialState) toggle.classList.add('checked');
        
        const updateVisuals = () => {
            const isChecked = toggle.classList.contains('checked');
            const labels = toggle.querySelectorAll('.toggle-label');
            if (labels[0]) { // Off/Mute
                labels[0].classList.toggle('active-text', !isChecked);
                labels[0].classList.toggle('inactive-text', isChecked);
            }
            if (labels[1]) { // On/Talk
                labels[1].classList.toggle('active-text', isChecked);
                labels[1].classList.toggle('inactive-text', !isChecked);
            }
        };
        updateVisuals();

        toggle.onclick = () => {
             toggle.classList.toggle('checked');
             updateVisuals();
             onToggle(toggle.classList.contains('checked'));
        };
    };

    setupToggle('emoji-toggle-btn', AppState.allowEmojis, (isChecked) => {
        AppState.allowEmojis = isChecked;
        saveStateToKV();
    });

    setupToggle('auto-speak-toggle-btn', AppState.autoSpeak, (isChecked) => {
        AppState.autoSpeak = isChecked;
        saveStateToKV();
        if (isChecked && !AppState.selectedVoice) showToast('Auto-speak enabled (Voice: Joanna)', 'info');
    });
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
