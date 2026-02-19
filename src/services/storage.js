import { AppState } from '../state/state.js';

let saveTimeout = null;

// Save state to puter.kv
export async function saveStateToKV() {
    // Clear any pending save
    if (saveTimeout) clearTimeout(saveTimeout);
    
    // Simple state object for comparison
    const stateSnapshot = {
        temperature: AppState.temperature,
        maxTokens: AppState.maxTokens,
        autoSpeak: AppState.autoSpeak,
        selectedVoice: AppState.selectedVoice,
        premiumEnabled: AppState.premiumEnabled,
        currentModel: AppState.currentModel,
        theme: AppState.theme,
        mediaParams: AppState.mediaParams,
        currentPath: AppState.currentPath,
        allowEmojis: AppState.allowEmojis,
        grokMenuExpanded: AppState.grokMenuExpanded,
        grokApiUrl: AppState.grokApiUrl,
        sessions: AppState.sessions,
        activeSessionId: AppState.activeSessionId,
        oracularModes: AppState.oracularModes
    };

    saveTimeout = setTimeout(async () => {
        try {
            await puter.kv.set('gravitychat_personas', JSON.stringify(AppState.personas));
            await puter.kv.set('gravitychat_active_persona', AppState.activePersona?.id || null);
            await puter.kv.set('gravitychat_settings', JSON.stringify(stateSnapshot));
            
            console.log('✅ State saved to puter.kv [Debounced]');
        } catch (error) {
            console.warn('Failed to save to puter.kv:', error);
            
            try {
                // Fallback to localStorage
                localStorage.setItem('gravitychat_personas', JSON.stringify(AppState.personas));
                localStorage.setItem('gravitychat_active_persona', AppState.activePersona?.id || null);
                localStorage.setItem('gravitychat_settings', JSON.stringify(stateSnapshot));
            } catch (localError) {
                console.error('LocalStorage failed:', localError);
            }
        }
    }, 1000); // 1-second debounce
}

// Load state from puter.kv
export async function loadStateFromKV() {
    // 1. Immediate heuristic load from localStorage for instant UI responsiveness
    try {
        const settingsData = localStorage.getItem('gravitychat_settings');
        if (settingsData) {
            const settings = JSON.parse(settingsData);
            if (settings.theme) {
                AppState.theme = settings.theme;
                // Apply theme immediately (sync)
                [document.documentElement, document.body].forEach(el => {
                    const existing = Array.from(el.classList).filter(c => c.startsWith('theme-'));
                    el.classList.remove(...existing);
                    el.classList.add('theme-' + settings.theme);
                });
            }
        }
    } catch (e) {}

    try {
        // 2. Load settings from cloud (Puter KV)
        const settingsData = await puter.kv.get('gravitychat_settings');
        if (settingsData) {
            const settings = JSON.parse(settingsData);
            // Whitelist: Only assign known safe keys to avoid corrupting runtime state
            const SAFE_KEYS = [
                'temperature', 'maxTokens', 'autoSpeak', 'selectedVoice',
                'premiumEnabled', 'currentModel', 'theme', 'mediaParams',
                'currentPath', 'allowEmojis', 'grokMenuExpanded', 'grokApiUrl',
                'sessions', 'activeSessionId', 'oracularModes'
            ];
            for (const key of SAFE_KEYS) {
                if (settings[key] !== undefined) AppState[key] = settings[key];
            }
            
            // Re-apply if KV differs from local
            if (settings.theme) {
                [document.documentElement, document.body].forEach(el => {
                    const themeClasses = Array.from(el.classList).filter(c => c.startsWith('theme-'));
                    el.classList.remove(...themeClasses);
                    el.classList.add(`theme-${settings.theme}`);
                });
            }
        }

        // 3. Load personas and other data
        const personasData = await puter.kv.get('gravitychat_personas');
        if (personasData) AppState.personas = JSON.parse(personasData);
        
        const activePersonaId = await puter.kv.get('gravitychat_active_persona');
        if (activePersonaId && activePersonaId !== 'null') {
            AppState.activePersona = AppState.personas.find(p => p.id === activePersonaId);
        } else {
            AppState.activePersona = null;
        }
        
        console.log('✅ State loaded from puter.kv');
    } catch (error) {
        console.warn('Failed to load from puter.kv, trying localStorage:', error);
        // Fallback to localStorage
        try {
            const personasData = localStorage.getItem('gravitychat_personas');
            if (personasData) AppState.personas = JSON.parse(personasData);
            
            const activePersonaId = localStorage.getItem('gravitychat_active_persona');
            if (activePersonaId && activePersonaId !== 'null') {
                AppState.activePersona = AppState.personas.find(p => p.id === activePersonaId);
            } else {
                AppState.activePersona = null;
            }
            
            const settingsData = localStorage.getItem('gravitychat_settings');
            if (settingsData) {
                const settings = JSON.parse(settingsData);
                AppState.temperature = settings.temperature !== undefined ? settings.temperature : 0.7;
                AppState.maxTokens = settings.maxTokens || 4096;
                AppState.autoSpeak = settings.autoSpeak || false;
                AppState.selectedVoice = settings.selectedVoice || 'Joanna';
                AppState.premiumEnabled = settings.premiumEnabled || false;
                if (settings.currentModel) AppState.currentModel = settings.currentModel;
                if (settings.theme) AppState.theme = settings.theme;
                if (settings.mediaParams) AppState.mediaParams = settings.mediaParams;
                if (settings.currentPath) AppState.currentPath = settings.currentPath;
                if (settings.allowEmojis !== undefined) AppState.allowEmojis = settings.allowEmojis;
                if (settings.grokMenuExpanded !== undefined) AppState.grokMenuExpanded = settings.grokMenuExpanded;
                if (settings.grokApiUrl) AppState.grokApiUrl = settings.grokApiUrl;
                
                if (settings.sessions) AppState.sessions = settings.sessions;
                if (settings.activeSessionId) AppState.activeSessionId = settings.activeSessionId;
                if (settings.oracularModes) AppState.oracularModes = settings.oracularModes;
            }
        } catch (localError) {
            console.warn('localStorage fallback also failed:', localError);
        }
    }
}
