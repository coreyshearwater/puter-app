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
    runCodeBlock: async (btn: HTMLButtonElement, lang: string) => {
        const pre = btn.closest('pre');
        if (!pre) return;
        const codeElement = pre.querySelector('code');
        if (!codeElement) return;
        const code = codeElement.innerText;
        
        btn.disabled = true;
        btn.innerText = '⌛...';
        
        const result = await executeInSandbox(code, lang);
        
        btn.disabled = false;
        btn.innerText = '▶ RUN';
        
        if (result) {
            // Remove existing result if any
            const existing = pre.nextElementSibling;
            if (existing && existing.classList.contains('sandbox-output')) {
                existing.remove();
            }
            
            const outputDiv = document.createElement('div');
            outputDiv.className = 'sandbox-output glass-card p-3 mt-2 text-xs font-mono slide-in';
            outputDiv.style.borderLeft = result.exitCode === 0 ? '4px solid var(--neon-green)' : '4px solid var(--neon-orange)';
            
            const contentDiv = document.createElement('div');
            if (result.stdout) {
                const out = document.createElement('div');
                out.className = 'text-gray-300';
                out.innerText = result.stdout;
                contentDiv.appendChild(out);
            }
            if (result.stderr) {
                const err = document.createElement('div');
                err.className = 'text-red-400 mt-1';
                err.innerText = result.stderr;
                contentDiv.appendChild(err);
            }
            if (!result.stdout && !result.stderr) {
                const empty = document.createElement('div');
                empty.className = 'text-gray-500 italic';
                empty.innerText = `Program exited with code ${result.exitCode} (no output)`;
                contentDiv.appendChild(empty);
            }
            
            outputDiv.innerHTML = `
                <div class="flex justify-between mb-1">
                    <span class="text-[8px] uppercase tracking-widest text-gray-500">Output (${lang})</span>
                    <button class="text-gray-500 hover:text-white" onclick="this.closest('.sandbox-output').remove()">×</button>
                </div>
            `;
            outputDiv.appendChild(contentDiv);
            pre.after(outputDiv);
        }
    },
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

function showAuthOverlay() {
    // Create overlay if it doesn't exist
    let overlay = document.getElementById('auth-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0a0f] text-white p-6';
        overlay.innerHTML = `
            <div class="glass-card max-w-md w-full p-8 text-center space-y-6 slide-in border-cyan-500/30">
                <div class="space-y-2">
                    <h1 class="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-magenta-400 bg-clip-text text-transparent">All Seeing Cat</h1>
                    <p class="text-gray-400">Authentication Required</p>
                </div>
                <div class="p-4 bg-cyan-500/5 rounded-lg border border-cyan-500/10 text-sm text-gray-300">
                    All Seeing Cat uses Puter.js for secure storage and AI access. Sign in to continue your session.
                </div>
                <button id="btn-auth-signin" class="btn btn-neon w-full h-14 text-lg">Sign In with Puter</button>
                <p class="text-[10px] text-gray-500 italic">Popups must be allowed for the sign-in window to appear.</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const btnAuth = document.getElementById('btn-auth-signin');
    if (btnAuth) {
        btnAuth.onclick = async () => {
            try {
                showToast('Opening Puter Sign-In...', 'info');
                await window.puter.auth.signIn();
                // If we reach here, user might have signed in (though signIn() sometimes returns before actual completion)
                // Let's just refresh the page to be safe and clean
                window.location.reload();
            } catch (error) {
                Logger.error('Main', 'SignIn failed:', error);
                showToast('SignIn failed. Try again.', 'error');
            }
        };
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
