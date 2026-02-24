
import { AppState } from '../../state/state.js';
import { renderModelList, refreshModels } from './models.js';
import { createPersona } from './personas.js';
import { loadFiles, createNewFile, createNewFolder } from '../../services/file-manager.js';
import { indexProject } from '../../services/memory.js';
import { saveStateToKV } from '../../services/storage.js';
import { debounce } from '../../utils/performance.js';

export function setupSidebarListeners() {
    // 1. Sidebar Nav Tabs (Delegated)
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
            if (wasActive) return;

            // Otherwise, activate it
            tab.classList.add('active');
            tab.setAttribute('aria-expanded', 'true');
            
            const targetContent = document.getElementById(`tab-${tabName}`);
            if (targetContent) {
                targetContent.classList.remove('hidden');
                targetContent.style.display = 'flex';
                targetContent.style.flexDirection = 'column';
            }
        });
    }

    // 2. Toggle UI Logic (Cloud/Local, Premium/Free)
    // ... existing visuals logic ...
    const updateToggleVisuals = () => {
        const isLocal = AppState.useLocalModel;
        const isPremium = AppState.premiumEnabled;

        const lblCloud = document.getElementById('lbl-cloud');
        const lblLocal = document.getElementById('lbl-local');
        const lblFree = document.getElementById('lbl-free');
        const lblPro = document.getElementById('lbl-pro');
        const containerPrem = document.getElementById('container-premium-toggle');

        if (lblCloud && lblLocal) {
            if (isLocal) {
                lblCloud.className = 'text-[9px] font-bold text-gray-600 uppercase tracking-tighter transition-colors duration-300';
                lblLocal.className = 'text-[9px] font-bold text-emerald-400 uppercase tracking-tighter transition-colors duration-300';
            } else {
                lblCloud.className = 'text-[9px] font-bold text-cyan-400 uppercase tracking-tighter transition-colors duration-300';
                lblLocal.className = 'text-[9px] font-bold text-gray-600 uppercase tracking-tighter transition-colors duration-300';
            }
        }

        if (lblFree && lblPro && containerPrem) {
            if (isLocal) {
                containerPrem.style.opacity = '0.3';
                containerPrem.style.pointerEvents = 'none';
                containerPrem.style.filter = 'grayscale(100%)';
                lblFree.className = 'text-[9px] font-bold text-gray-600 uppercase tracking-tighter transition-colors duration-300';
                lblPro.className = 'text-[9px] font-bold text-gray-600 uppercase tracking-tighter transition-colors duration-300';
            } else {
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

    const premToggle = document.getElementById('premium-toggle') as HTMLInputElement | null;
    if (premToggle) {
        premToggle.checked = AppState.premiumEnabled;
        premToggle.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            if ((window as any).gravityChat?.setPremium) (window as any).gravityChat.setPremium(target.checked);
            updateToggleVisuals();
        };
    }

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
    
    updateToggleVisuals();

    // 4. Model Management
    const modelSearch = document.getElementById('model-search') as HTMLInputElement | null;
    if (modelSearch) {
        modelSearch.oninput = debounce((e: Event) => {
            const target = e.target as HTMLInputElement;
            renderModelList(target.value);
        }, 150);
    }

    const setupHFSearchListener = () => {
        const hfInput = document.getElementById('hf-search-input') as HTMLInputElement | null;
        if (hfInput && !hfInput.dataset.listened) {
            hfInput.dataset.listened = 'true';
            hfInput.oninput = debounce(() => {
                if ((window as any).gravityChat?.performHFSearch) (window as any).gravityChat.performHFSearch();
            }, 600);
        }
    };
    document.addEventListener('localTabChanged', setupHFSearchListener);

    const btnRefreshModels = document.getElementById('btn-refresh-models');
    if (btnRefreshModels) btnRefreshModels.onclick = () => refreshModels();

    // 5-7 rest
    const btnAddPersona = document.getElementById('btn-add-persona');
    if (btnAddPersona) btnAddPersona.onclick = createPersona;
    const btnNewFile = document.getElementById('btn-new-file');
    if (btnNewFile) btnNewFile.onclick = createNewFile;
    const btnNewFolder = document.getElementById('btn-new-folder');
    if (btnNewFolder) btnNewFolder.onclick = createNewFolder;
    const btnRefreshFiles = document.getElementById('btn-refresh-files');
    if (btnRefreshFiles) btnRefreshFiles.onclick = () => loadFiles(AppState.currentPath);
    const btnIndexMemory = document.getElementById('btn-index-memory');
    if (btnIndexMemory) btnIndexMemory.onclick = () => indexProject();

    document.addEventListener('updateModelDisplay', () => {
        const currentModelDisplay = document.getElementById('current-model-display');
        if (currentModelDisplay) currentModelDisplay.textContent = AppState.currentModel;
    });
}
