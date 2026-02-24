import { AppState as AppStateImpl } from './state/state.js';
import { AppState, Persona, ChatMessage, Session } from './types.js';
import { loadStateFromKV, saveStateToKV } from './services/storage.js';
import { initializeOracularControls } from './components/oracular.js';
import { initializePersonas, selectPersona, deletePersona, createPersona } from './components/sidebar/personas.js';
import { fetchModels, selectModel, renderModelList, toggleGrokMenu, refreshModels } from './components/sidebar/models.js';
import { renderSettings } from './components/sidebar/settings.js';
import { initializeSessions, createNewSession, switchSession, deleteSession, syncCurrentSession } from './components/sidebar/sessions.js';
import { loadVoices } from './services/voice.js';
import { loadFiles, previewFile, deleteFile, createNewFile, createNewFolder } from './services/file-manager.js';
import { setupInputListeners, removeAttachment } from './components/input.js';
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

    // Event Listeners
    try {
        setupGlobalListeners();
        setupInputListeners();
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
    // Tabs (Delegated for better reliability)
    const nav = document.querySelector('aside nav');
    if (nav) {
        nav.addEventListener('click', (e: Event) => {
            const target = e.target as HTMLElement;
            const tab = target.closest('.nav-tab') as HTMLElement;
            if (!tab) return;
            
            const tabName = tab.dataset.tab;
            const wasActive = tab.classList.contains('active');
            
            // Always hide everything first
            const allTabs = nav.querySelectorAll('.nav-tab');
            allTabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-expanded', 'false');
            });

            document.querySelectorAll('.gchat-tab-panel').forEach(tc => {
                const element = tc as HTMLElement;
                element.classList.add('hidden');
                element.style.display = 'none';
            });

            // If it was already active, we just finished "deactivating" it
            if (wasActive) {
                console.log(`Tab toggled off: ${tabName}`);
                return;
            }

            // Otherwise, activate it
            tab.classList.add('active');
            tab.setAttribute('aria-expanded', 'true');
            
            const targetContent = document.getElementById(`tab-${tabName}`);
            if (targetContent) {
                targetContent.classList.remove('hidden');
                targetContent.style.display = 'flex';
                targetContent.style.flexDirection = 'column';
                console.log(`Tab switch confirmed: ${tabName}`);
            }
        });

        nav.addEventListener('keydown', (e: Event) => {
            const keyboardEvent = e as KeyboardEvent;
            if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                const target = e.target as HTMLElement;
                const tab = target.closest('.nav-tab') as HTMLElement;
                if (tab) {
                    e.preventDefault();
                    tab.click();
                }
            }
        });
    }

    // --- Toggle UI Logic ---
    const updateToggleVisuals = () => {
        const isLocal = localToggle ? localToggle.checked : false;
        const isPremium = premToggle ? premToggle.checked : false;

        // Cloud/Local Labels
        const lblCloud = document.getElementById('lbl-cloud');
        const lblLocal = document.getElementById('lbl-local');
        
        if (lblCloud && lblLocal) {
            if (isLocal) {
                lblCloud.className = 'text-[9px] font-bold text-gray-600 uppercase tracking-tighter transition-colors duration-300';
                lblLocal.className = 'text-[9px] font-bold text-emerald-400 uppercase tracking-tighter transition-colors duration-300';
            } else {
                lblCloud.className = 'text-[9px] font-bold text-cyan-400 uppercase tracking-tighter transition-colors duration-300';
                lblLocal.className = 'text-[9px] font-bold text-gray-600 uppercase tracking-tighter transition-colors duration-300';
            }
        }

        // Premium/Free Labels & Container State
        const lblFree = document.getElementById('lbl-free');
        const lblPro = document.getElementById('lbl-pro');
        const containerPrem = document.getElementById('container-premium-toggle');

        if (lblFree && lblPro && containerPrem) {
            if (isLocal) {
                // Dim/Disable entire container
                containerPrem.style.opacity = '0.3';
                containerPrem.style.pointerEvents = 'none';
                containerPrem.style.filter = 'grayscale(100%)';
                
                // Set both labels to gray if disabled, or keep state but dimmed
                lblFree.className = 'text-[9px] font-bold text-gray-600 uppercase tracking-tighter transition-colors duration-300';
                lblPro.className = 'text-[9px] font-bold text-gray-600 uppercase tracking-tighter transition-colors duration-300';
            } else {
                // Active State
                containerPrem.style.opacity = '1';
                containerPrem.style.pointerEvents = 'auto';
                containerPrem.style.filter = 'none';

                if (isPremium) {
                    lblFree.className = 'text-[9px] font-bold text-gray-600 uppercase tracking-tighter transition-colors duration-300';
                    lblPro.className = 'text-[9px] font-bold text-cyan-400 uppercase tracking-tighter transition-colors duration-300 shadow-cyan-glow';
                } else {
                    lblFree.className = 'text-[9px] font-bold text-cyan-400 uppercase tracking-tighter transition-colors duration-300';
                    lblPro.className = 'text-[9px] font-bold text-gray-600 uppercase tracking-tighter transition-colors duration-300';
                }
            }
        }
    };

    // Premium Toggle
    const premToggle = document.getElementById('premium-toggle') as HTMLInputElement | null;
    if (premToggle) {
        premToggle.checked = AppState.premiumEnabled;
        premToggle.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            window.gravityChat.setPremium(target.checked);
            updateToggleVisuals();
        };
    }

    // Local Toggle (New)
    const localToggle = document.getElementById('local-toggle') as HTMLInputElement | null;
    if (localToggle) {
        localToggle.checked = AppState.useLocalModel;
        localToggle.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            AppState.useLocalModel = target.checked;
            renderModelList();
            saveStateToKV();
            document.dispatchEvent(new CustomEvent('updateModelDisplay'));
            updateToggleVisuals();
        };
    }
    
    // Initial Run
    updateToggleVisuals();

    // Folder select
    const folderIndicator = document.getElementById('folder-indicator-container');
    if (folderIndicator) {
        folderIndicator.onclick = async () => {
            const { selectDirectory } = await import('./services/file-manager.js');
            await selectDirectory();
        };
    }

    // Media Lab
    const btnMediaLab = document.getElementById('btn-open-medialab');
    if (btnMediaLab) btnMediaLab.onclick = () => window.gravityChat.openMediaLab();

    // Model search
    const modelSearch = document.getElementById('model-search') as HTMLInputElement | null;
    if (modelSearch) {
        modelSearch.oninput = (e: Event) => {
            const target = e.target as HTMLInputElement;
            renderModelList(target.value);
        }
    }
    const btnRefreshModels = document.getElementById('btn-refresh-models');
    if (btnRefreshModels) btnRefreshModels.onclick = () => refreshModels();

    // Add Persona
    const btnAddPersona = document.getElementById('btn-add-persona');
    if (btnAddPersona) btnAddPersona.onclick = createPersona;

    // File buttons
    const btnNewFile = document.getElementById('btn-new-file');
    if (btnNewFile) btnNewFile.onclick = createNewFile;
    const btnNewFolder = document.getElementById('btn-new-folder');
    if (btnNewFolder) btnNewFolder.onclick = createNewFolder;
    const btnRefreshFiles = document.getElementById('btn-refresh-files');
    if (btnRefreshFiles) btnRefreshFiles.onclick = () => loadFiles(AppState.currentPath);
    const btnIndexMemory = document.getElementById('btn-index-memory');
    if (btnIndexMemory) btnIndexMemory.onclick = () => indexProject();

    // Update model display event
    document.addEventListener('updateModelDisplay', () => {
        const currentModelDisplay = document.getElementById('current-model-display');
        if (currentModelDisplay) currentModelDisplay.textContent = AppState.currentModel;
    });
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
window.addEventListener('error', (e) => Logger.error('Global', e));
