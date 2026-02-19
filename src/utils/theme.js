import { AppState } from '../state/state.js';
import { saveStateToKV } from '../services/storage.js';

export function applyTheme(themeName) {
    const theme = themeName || AppState.theme || 'void';
    
    // Remove all existing theme classes dynamically from both HTML and Body
    const targets = [document.documentElement, document.body];
    targets.forEach(el => {
        const themeClasses = Array.from(el.classList).filter(c => c.startsWith('theme-'));
        el.classList.remove(...themeClasses);
    });
    
    // Add selected theme class to both for maximum robustness
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);
    
    // Update state and save
    if (themeName) {
        AppState.theme = theme;
        
        // Save to localStorage synchronously to prevent flash on next reload
        try {
            const settingsStr = localStorage.getItem('gravitychat_settings');
            const settings = settingsStr ? JSON.parse(settingsStr) : {};
            settings.theme = theme;
            localStorage.setItem('gravitychat_settings', JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to sync theme to localStorage:', e);
        }
        
        saveStateToKV();
    }
}
