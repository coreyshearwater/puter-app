import { AppState as AppStateImpl, initializeState } from './state/state.js';
import { AppState, Persona, ChatMessage, Session } from './types.js';
import { loadStateFromKV, saveStateToKV } from './services/storage.js';
import { initializeOracularControls } from './components/oracular.js';
import { initializePersonas, selectPersona, deletePersona, createPersona } from './components/sidebar/personas.js';
import { fetchModels, selectModel, renderModelList, toggleGrokMenu, refreshModels } from './components/sidebar/models.js';
import { renderSettings } from './components/sidebar/settings.js';
import { initializeSessions, createNewSession, switchSession, deleteSession, syncCurrentSession } from './components/sidebar/sessions.js';
import { loadVoices } from './services/voice.js';
import { loadFiles, previewFile, deleteFile, createNewFile, createNewFolder } from './services/file-manager.js';
import { removeAttachment } from './components/input.js';
import { clearChat, exportChat } from './components/chat.js';
import { renderMediaLab, initMediaParams, setMediaParam } from './components/media-lab.js';
import { indexProject, loadIndexFromKV } from './services/memory.js';
import { applyTheme } from './utils/theme.js';
import { executeInSandbox } from './services/sandbox.js';
import { showToast } from './utils/toast.js';
import { diagnosePuterModels, stopGeneration } from './services/ai.js';
import { openVoiceBrowser } from './components/voice-browser.js';
import { Logger } from './utils/logger.js';
import { runCodeBlock } from './components/sandbox-ui.js';
import { showAuthOverlay } from './components/auth.js';
import { setupSidebarListeners } from './components/sidebar/sidebar-listeners.js';
import { setupChatListeners } from './components/chat/chat-listeners.js';

// Cast AppState to strictly typed interface for internal usage
const AppState: AppState = AppStateImpl as unknown as AppState;

// Global Window Extension
declare global {
    interface Window {
        gravityChat: any;
        puter: any;
    }
}

// Namespace for global access (legacy support for string templates)
window.gravityChat = Object.assign(window.gravityChat || {}, {
    loadFiles,
    previewFile,
    deleteFile,
    selectPersona,
    deletePersona,
    selectModel,
    toggleGrokMenu,
    refreshModels,
    renderModelList,
    switchSession,
    deleteSession,
    removeAttachment,
    diagnosePuterModels,
    stopGeneration,
    openVoiceBrowser,
    clearChat: () => {
        clearChat(); // Clear DOM
        syncCurrentSession(); // Update session state
    },
    exportChat,
    runCodeBlock,
    setPremium: (enabled: boolean) => {
        AppState.premiumEnabled = enabled;
        renderModelList();
        saveStateToKV();
    },
    openMediaLab: () => renderMediaLab(),
    setMediaParam,
    closeMediaLab: () => {
        const modal = document.getElementById('media-lab-modal');
        if (modal) modal.style.display = 'none';
    }
});

async function init() {
    initializeState();
    Logger.info('Main', 'GravityChat initializing...');
    
    try {
        Logger.info('Main', '1. Calling initMediaParams...');
        initMediaParams();
        Logger.info('Main', '2. initMediaParams done.');
    } catch (e) { Logger.error('Main', 'initMediaParams failed', e); }
    
    // Auth Check
    try {
        if (typeof window.puter === 'undefined') {
             Logger.error('Main', 'CRITICAL: puter is undefined!');
             showToast('Puter API missing', 'error');
             return;
        }

        const signedIn = await window.puter.auth.isSignedIn();
        if (!signedIn) {
            Logger.info('Main', 'User not signed in. Showing Auth Overlay.');
            // Dismiss loading overlay so auth screen is visible
            const loadOverlay = document.getElementById('loading-overlay');
            if (loadOverlay) { loadOverlay.style.opacity = '0'; setTimeout(() => loadOverlay.remove(), 400); }
            showAuthOverlay();
            return; // Stop init until signed in
        }

        const user = await window.puter.auth.getUser();
        Logger.info('Main', `Authenticated as ${user.username}`);
        showToast(`Welcome back, ${user.username}`, 'success');
        
        // Continue with initialization
        await completeInit();
        
    } catch (e) { 
        Logger.warn('Main', 'Puter Auth failed', e);
        showToast('Auth error. Check console.', 'error');
    }
}

async function completeInit() {
    // State & Listeners
    try {
        await loadStateFromKV();
        await loadIndexFromKV();
    } catch (e) { Logger.error('Main', 'State loading failed', e); }

    try {
        setupGlobalListeners();
        setupChatListeners();
    } catch (e: any) { Logger.error('Main', 'Listeners setup failed:', e?.message || e, e?.stack || ''); }
    
    // UI Init
    try {
        Logger.info('Main', 'Applying theme...');
        applyTheme();
    } catch (e) { Logger.error('Main', 'applyTheme failed', e); }

    try {
        Logger.info('Main', 'Initializing personas...');
        initializePersonas();
    } catch (e) { Logger.error('Main', 'initializePersonas failed', e); }

    try {
        Logger.info('Main', 'Initializing oracular controls...');
        initializeOracularControls();
    } catch (e) { Logger.error('Main', 'initializeOracularControls failed', e); }

    try {
        Logger.info('Main', 'Initializing sessions...');
        initializeSessions();
    } catch (e) { Logger.error('Main', 'initializeSessions failed', e); }

    try {
        Logger.info('Main', 'Rendering settings...');
        renderSettings();
    } catch (e) { Logger.error('Main', 'renderSettings failed', e); }

    try {
        Logger.info('Main', 'Loading voices...');
        loadVoices();
    } catch (e) { Logger.error('Main', 'loadVoices failed', e); }

    try {
        Logger.info('Main', 'Loading files...');
        loadFiles(AppState.currentPath);
    } catch (e) { Logger.error('Main', 'loadFiles failed', e); }

    try {
        Logger.info('Main', 'Fetching models...');
        await fetchModels();
    } catch (e) { Logger.error('Main', 'fetchModels failed', e); }
    
    Logger.info('Main', 'GravityChat Ready!');

    // Reveal app and remove loading overlay (prevents FOUC)
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.classList.add('ready');

    // Init Toggles
    if (window.gravityChat?.initToggles) window.gravityChat.initToggles();
    
    // Remove loading overlay
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        (overlay as HTMLElement).style.opacity = '0';
        setTimeout(() => (overlay as HTMLElement).remove(), 400);
    }
}

function setupGlobalListeners() {
    setupSidebarListeners();
}


if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
window.addEventListener('error', (e) => Logger.error('Global', e));
