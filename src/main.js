import { AppState } from './state.js';
import { loadStateFromKV, saveStateToKV } from './services/storage.js';
import { initializeOracularControls } from './ui/oracular.js';
import { initializePersonas, selectPersona, deletePersona, createPersona } from './ui/sidebar/personas.js';
import { fetchModels, selectModel, renderModelList, toggleGrokMenu } from './ui/sidebar/models.js';
import { renderSettings } from './ui/sidebar/settings.js';
import { initializeSessions, createNewSession, switchSession, deleteSession, syncCurrentSession } from './ui/sidebar/sessions.js';
import { loadVoices } from './services/voice.js';
import { loadFiles, previewFile, deleteFile, createNewFile, createNewFolder } from './services/file-manager.js';
import { setupInputListeners, removeAttachment } from './ui/input.js';
import { clearChat, exportChat } from './ui/chat.js';
import { renderMediaLab, initMediaParams } from './ui/media-lab.js';
import { indexProject, loadIndexFromKV } from './services/memory.js';
import { applyTheme } from './utils/theme.js';
import { executeInSandbox } from './services/sandbox.js';
import { showToast } from './utils/toast.js';

// Namespace for global access (legacy support for string templates)
window.gravityChat = {
    loadFiles,
    previewFile,
    deleteFile,
    selectPersona,
    deletePersona,
    selectModel,
    toggleGrokMenu,
    renderModelList,
    switchSession,
    deleteSession,
    removeAttachment,
    clearChat: () => {
        clearChat(); // Clear DOM
        syncCurrentSession(); // Update session state
    },
    exportChat,
    runCodeBlock: async (btn, lang) => {
        const pre = btn.closest('pre');
        const codeElement = pre.querySelector('code');
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
            
            let content = '';
            if (result.stdout) content += `<div class="text-gray-300">${result.stdout}</div>`;
            if (result.stderr) content += `<div class="text-red-400 mt-1">${result.stderr}</div>`;
            if (!result.stdout && !result.stderr) content += `<div class="text-gray-500 italic">Program exited with code ${result.exitCode} (no output)</div>`;
            
            outputDiv.innerHTML = `
                <div class="flex justify-between mb-1">
                    <span class="text-[8px] uppercase tracking-widest text-gray-500">Output (${lang})</span>
                    <button class="text-gray-500 hover:text-white" onclick="this.closest('.sandbox-output').remove()">×</button>
                </div>
                ${content}
            `;
            pre.after(outputDiv);
        }
    },
    setPremium: (enabled) => {
        AppState.premiumEnabled = enabled;
        renderModelList();
        saveStateToKV();
    },
    setMediaParam: (param, value) => {
        AppState.mediaParams[param] = value;
        console.log(`🎨 Media Param: ${param} = ${value}`);
    },
    openMediaLab: () => renderMediaLab(),
    closeMediaLab: () => {
        const modal = document.getElementById('media-lab-modal');
        if (modal) modal.style.display = 'none';
    }
};

async function init() {
    console.log('GravityChat initializing...');
    
    try {
        console.log('1. Calling initMediaParams...');
        initMediaParams();
        console.log('2. initMediaParams done.');
    } catch (e) { console.error('initMediaParams failed', e); }
    
    // Auth Check
    try {
        if (typeof puter === 'undefined') {
             console.error('CRITICAL: puter is undefined!');
             showToast('Puter API missing', 'error');
             return;
        }

        const signedIn = await puter.auth.isSignedIn();
        if (!signedIn) {
            console.log('User not signed in. Showing Auth Overlay.');
            // Dismiss loading overlay so auth screen is visible
            const loadOverlay = document.getElementById('loading-overlay');
            if (loadOverlay) { loadOverlay.style.opacity = '0'; setTimeout(() => loadOverlay.remove(), 400); }
            showAuthOverlay();
            return; // Stop init until signed in
        }

        const user = await puter.auth.getUser();
        console.log(`Authenticated as ${user.username}`);
        showToast(`Welcome back, ${user.username}`, 'success');
        
        // Continue with initialization
        await completeInit();
        
    } catch (e) { 
        console.warn('Puter Auth failed', e);
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
                    <h1 class="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-magenta-400 bg-clip-text text-transparent">GravityChat</h1>
                    <p class="text-gray-400">Authentication Required</p>
                </div>
                <div class="p-4 bg-cyan-500/5 rounded-lg border border-cyan-500/10 text-sm text-gray-300">
                    GravityChat uses Puter.js for secure storage and AI access. Sign in to continue your session.
                </div>
                <button id="btn-auth-signin" class="btn btn-neon w-full h-14 text-lg">Sign In with Puter</button>
                <p class="text-[10px] text-gray-500 italic">Popups must be allowed for the sign-in window to appear.</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    document.getElementById('btn-auth-signin').onclick = async () => {
        try {
            showToast('Opening Puter Sign-In...', 'info');
            await puter.auth.signIn();
            // If we reach here, user might have signed in (though signIn() sometimes returns before actual completion)
            // Let's just refresh the page to be safe and clean
            window.location.reload();
        } catch (error) {
            console.error('SignIn failed:', error);
            showToast('SignIn failed. Try again.', 'error');
        }
    };
}

async function completeInit() {
    // State & Listeners
    try {
        setupGlobalListeners();
        setupInputListeners();
    } catch (e) { console.error('Listeners setup failed', e); }

    try {
        await loadStateFromKV();
        await loadIndexFromKV();
    } catch (e) { console.error('State loading failed', e); }
    
    // UI Init
    try {
        console.log('Applying theme...');
        applyTheme();
    } catch (e) { console.error('applyTheme failed', e); }

    try {
        console.log('Initializing personas...');
        initializePersonas();
    } catch (e) { console.error('initializePersonas failed', e); }

    try {
        console.log('Initializing oracular controls...');
        initializeOracularControls();
    } catch (e) { console.error('initializeOracularControls failed', e); }

    try {
        console.log('Initializing sessions...');
        initializeSessions();
    } catch (e) { console.error('initializeSessions failed', e); }

    try {
        console.log('Rendering settings...');
        renderSettings();
    } catch (e) { console.error('renderSettings failed', e); }

    try {
        console.log('Loading voices...');
        loadVoices();
    } catch (e) { console.error('loadVoices failed', e); }

    try {
        console.log('Loading files...');
        loadFiles(AppState.currentPath);
    } catch (e) { console.error('loadFiles failed', e); }

    try {
        console.log('Fetching models...');
        await fetchModels();
    } catch (e) { console.error('fetchModels failed', e); }
    
    console.log('GravityChat Ready!');

    // Reveal app and remove loading overlay (prevents FOUC)
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.classList.add('ready');

    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 400);
    }
}

function setupGlobalListeners() {
    // Tabs (Delegated for better reliability)
    const nav = document.querySelector('aside nav');
    if (nav) {
        nav.addEventListener('click', (e) => {
            const tab = e.target.closest('.nav-tab');
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
                tc.classList.add('hidden');
                tc.style.display = 'none';
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

        nav.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const tab = e.target.closest('.nav-tab');
                if (tab) {
                    e.preventDefault();
                    tab.click();
                }
            }
        });
    }

    // Premium Toggle
    const premToggle = document.getElementById('premium-toggle');
    premToggle.checked = AppState.premiumEnabled;
    premToggle.onchange = (e) => window.gravityChat.setPremium(e.target.checked);

    // Folder select
    document.getElementById('folder-indicator-container').onclick = async () => {
        const { selectDirectory } = await import('./services/file-manager.js');
        await selectDirectory();
    };

    // Media Lab
    document.getElementById('btn-open-medialab').onclick = () => window.gravityChat.openMediaLab();

    // Model search
    document.getElementById('model-search').oninput = (e) => renderModelList(e.target.value);

    // Add Persona
    document.getElementById('btn-add-persona').onclick = createPersona;

    // File buttons
    document.getElementById('btn-new-file').onclick = createNewFile;
    document.getElementById('btn-new-folder').onclick = createNewFolder;
    document.getElementById('btn-refresh-files').onclick = () => loadFiles(AppState.currentPath);
    document.getElementById('btn-index-memory').onclick = () => indexProject();

    // Update model display event
    document.addEventListener('updateModelDisplay', () => {
        document.getElementById('current-model-display').textContent = AppState.currentModel;
    });
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
window.addEventListener('error', (e) => console.error('Global error:', e));
