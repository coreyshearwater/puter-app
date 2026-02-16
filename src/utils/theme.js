import { AppState } from '../state.js';
import { saveStateToKV } from '../services/storage.js';

export function applyTheme(themeName) {
    const theme = themeName || AppState.theme || 'void';
    
    // Remove all theme classes
    document.body.classList.remove('theme-void', 'theme-toxic', 'theme-overdrive');
    
    // Add selected theme class
    document.body.classList.add(`theme-${theme}`);
    
    // Update state and save
    if (themeName) {
        AppState.theme = theme;
        saveStateToKV();
    }
}
