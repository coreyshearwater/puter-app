import { AppState as IAppState } from '../../types.js';
import { AppState as AppStateImpl } from '../../state/state.js';
import { updateElementText } from '../../utils/dom.js';
import { showToast } from '../../utils/toast.js';
import { showInfoModal } from '../../utils/modals.js';
import { updateTemperatureVisibility } from './settings.js';
import { ModelsUI } from './models-ui.js';
import { 
    checkLocalServerStatus, 
    listLocalModels, 
    loadLocalModel, 
    unloadLocalModel, 
    deleteLocalModel,
    getSystemInfo,
    searchHF
} from '../../services/local-llm.js';

const AppStateByVal = AppStateImpl as any;
const AppState: IAppState = AppStateImpl as any;

interface HardwareProfile {
    cpuCores: number;
    sysRAM: number | string;
    vram: number | string;
    adapter: string;
}

declare global {
    interface Window {
        gravityChat: any;
        puter: any;
    }
}


// --- Polling & Init ---
setInterval(async () => {
    if (AppState.useLocalModel) {
        const status = await checkLocalServerStatus();
        AppState.localServerOnline = status.online;
        AppState.localModelLoaded = status.model;
        
        // Refresh valid model list occasionally to catch external file changes
        // but not too often to flicker UI, and NEVER if we are in search mode (it clears results)
        if (AppState.localServerOnline && Math.random() < 0.1 && AppState.localTab !== 'search') {
            renderModelList();
        } else {
            // Minimal update (just status dot)
            const statusEl = document.getElementById('local-status-dot');
            if (statusEl) statusEl.className = `w-2 h-2 rounded-full ${status.online ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] ring-2 ring-emerald-500/20' : 'bg-red-500'} animate-pulse`;
        }
    }
}, 5000);

// Hardware Profile Cache
let HardwareProfile: HardwareProfile | null = null;

// --- Main Fetch ---
export async function fetchModels() {
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
        const models: any = await Promise.race([(window as any).puter.ai.listModels(), timeout]);
        
        // Add Grok models
        const grokModels = [
            { id: 'grok-3-auto', name: 'Grok 3 (Auto)', cost: { input: 0, output: 0 }, provider: 'xAI' },
            { id: 'grok-3-fast', name: 'Grok 3 (Fast)', cost: { input: 0, output: 0 }, provider: 'xAI' },
            { id: 'grok-4', name: 'Grok 4 (Expert)', cost: { input: 0, output: 0 }, provider: 'xAI' },
            { id: 'grok-4-mini-thinking-tahoe', name: 'Grok 4 Mini (Thinking)', cost: { input: 0, output: 0 }, provider: 'xAI' },
        ];
        
        AppState.allModels = [...grokModels, ...models];
        AppState.freeModels = AppState.allModels.filter(m => m.id.endsWith(':free') || m.provider === 'xAI' || (m.cost?.input === 0 && m.cost?.output === 0));
        
        // Initial Local Check
        const localStatus = await checkLocalServerStatus();
        AppState.localServerOnline = localStatus.online;
        AppState.localModelLoaded = localStatus.model;
        
        // Init Hardware
        await initHardwareDetection();

    } catch (error) {
        console.error('Fetch models failed, using fallbacks');
        AppState.allModels = [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini', cost: { input: 0, output: 0 } }];
        AppState.freeModels = AppState.allModels;
    } finally {
        updateCurrentModelDisplay();
        renderModelList();
    }
}

// --- Hardware Detection ---
async function initHardwareDetection() {
    if (HardwareProfile) return;

    // 1. Try Backend Info first (more reliable for RAM/CPU)
    const backendInfo = await getSystemInfo();
    
    // 2. Client side fallbacks
    const cores = navigator.hardwareConcurrency || 4;
    const gbRAM = backendInfo?.ram_gb || ((navigator as any).deviceMemory || 8); // approximate
    
    // 3. User VRAM Estimation (Quadro P2000 = 4GB, or user rule)
    // We check KV first
    let vram = await (window as any).puter.kv.get('user_hardware_vram');
    if (!vram) {
        // Simple heuristic or default to 4GB as per user context
        // If the user has a specific GPU, we might try to guess webgl, but simpler to default safe.
        vram = 4; // Safe default for "low spec" local llm
    }

    HardwareProfile = {
        cpuCores: cores,
        sysRAM: gbRAM,
        vram: vram,
        adapter: "Simulated / Backend"
    } as HardwareProfile;

    console.info("Hardware Profile:", HardwareProfile);
}

// --- Render Logic ---

export async function renderModelList(searchQuery: string = '') {
    const list = document.getElementById('model-list');
    if (!list) return;

    if (AppState.useLocalModel) {
        await renderLocalModelManager(list, searchQuery);
    } else {
        renderCloudModelList(list, searchQuery);
    }
}

// --- LOCAL MANAGER UI ---

async function renderLocalModelManager(container: HTMLElement, searchQuery: string) {
    const online = AppState.localServerOnline;
    const loadedModel = AppState.localModelLoaded;
    
    // Fetch local models if tab is 'files' or undefined
    let localModels = [];
    if (!AppState.localTab || AppState.localTab === 'files') {
        localModels = await listLocalModels();
    }

    // Use shared UI renderer
    container.innerHTML = ModelsUI.renderLocalModelManager(
        online, 
        loadedModel, 
        localModels, 
        AppState.localTab || 'files'
    );
    
    // Auto-trigger search logical connection if needed
    if (AppState.localTab === 'search') {
        // Handled by ModelsUI via performHFSearch call
         const input = document.getElementById('hf-search-input');
         if(input && AppState.hfSearchQuery) {
             // restore cursor or value if re-rendering
         } else {
             setTimeout(() => window.gravityChat.performHFSearch(AppState.hfSearchQuery), 100);
         }
    }
}

function renderCloudModelList(container: HTMLElement, searchQuery: string) {
    const available = AppState.premiumEnabled ? AppState.allModels : AppState.freeModels;
    const grokModels = available.filter(m => m.provider === 'xAI');
    const otherModels = available.filter(m => m.provider !== 'xAI');
    
    const filterFn = (m: any) => (m.id + (m.name || '')).toLowerCase().includes(searchQuery.toLowerCase());
    const filteredGrok = searchQuery ? grokModels.filter(filterFn) : grokModels;
    const filteredOther = searchQuery ? otherModels.filter(filterFn) : otherModels;

    // Use shared UI renderer (Basic concat for now, or adapt ModelsUI to handle cloud lists fully)
    let html = '';

    // Render Grok Category Toggle
    if (filteredGrok.length > 0) {
        html += `
            <div class="mb-2">
                <div class="glass-card p-2 cursor-pointer flex justify-between items-center bg-cyan-900/10 border-cyan-500/30 hover:bg-cyan-900/20" 
                     onclick="window.gravityChat.toggleGrokMenu()">
                    <span class="text-xs font-bold text-cyan-400">GROK MODELS</span>
                    <span class="text-[10px] transform transition-transform ${AppState.grokMenuExpanded ? 'rotate-180' : ''}">▼</span>
                </div>
                
                <div id="grok-submenu" class="mt-1 space-y-1 pl-2 border-l border-cyan-500/20 ${AppState.grokMenuExpanded || searchQuery ? '' : 'hidden'}">
                    ${ModelsUI.renderCloudModelList(filteredGrok)} 
                </div>
            </div>
        `;
    }

    const sortedOther = [...filteredOther].sort((a, b) => {
        // simple sort by ID length heuristic as proxy for quality if no metadata
        return b.id.length - a.id.length; 
    });
    
    html += ModelsUI.renderCloudModelList(sortedOther);
    
    container.innerHTML = html;
}

export function toggleGrokMenu() {
    AppState.grokMenuExpanded = !AppState.grokMenuExpanded;
    const searchInput = document.getElementById('model-search') as HTMLInputElement;
    renderModelList(searchInput?.value || '');
}

export async function selectModel(modelId: string) {
    AppState.currentModel = modelId;
    updateCurrentModelDisplay();
    const searchInput = document.getElementById('model-search') as HTMLInputElement;
    renderModelList(searchInput?.value || '');
    updateTemperatureVisibility();
    showToast(`Model: ${modelId}`, 'success');

    // "Pre-flight" check
    try {
        const model = AppState.allModels.find(m => m.id === modelId);
        const isGrok = (model as any)?.provider === 'xAI';
        const isFree = model?.id.endsWith(':free') || (model as any)?.cost?.input === 0 || isGrok;
        
        if (isFree && !isGrok) {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
            await Promise.race([
                (window as any).puter.ai.chat('test', { model: modelId, max_tokens: 1 }),
                timeout
            ]);
        }
    } catch (error: any) {
        console.warn(`Model ${modelId} health check failed:`, error?.message || error);
    }
}

export function updateCurrentModelDisplay() {
    if (AppState.useLocalModel) {
        updateElementText('current-model-display', AppState.localModelLoaded || 'NO LOCAL MODEL');
        return;
    }
    const model = AppState.allModels.find(m => m.id === AppState.currentModel);
    const displayName = model ? (model.name || model.id) : AppState.currentModel;
    updateElementText('current-model-display', displayName);
}

export async function refreshModels() {
    const btn = document.getElementById('btn-refresh-models') as HTMLButtonElement;
    const svg = btn?.querySelector('svg');
    
    // Spin animation
    if (svg) svg.classList.add('spin');
    if (btn) btn.disabled = true;
    
    try {
        // If Local Mode, refresh local list
        if (AppState.useLocalModel) {
            await renderModelList();
            showToast('Refreshed local & storage', 'success');
            return;
        }

        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
        const models: any = await Promise.race([(window as any).puter.ai.listModels(), timeout]);
        
        const grokModels = AppState.allModels.filter((m: any) => m.provider === 'xAI');
        AppState.allModels = [...grokModels, ...models];
        AppState.freeModels = AppState.allModels.filter((m: any) => 
            m.id.endsWith(':free') || m.provider === 'xAI' || (m.cost?.input === 0 && m.cost?.output === 0)
        );
        
        updateCurrentModelDisplay();
        const searchInput = document.getElementById('model-search') as HTMLInputElement;
        renderModelList(searchInput?.value || '');
        
        showToast(`Refreshed ${models.length} Cloud Models`, 'success');
    } catch (error: any) {
        console.error('Model refresh failed:', error?.message || error);
        showToast('Refresh failed — check logs', 'error');
    } finally {
        if (svg) svg.classList.remove('spin');
        if (btn) (btn as HTMLButtonElement).disabled = false;
    }
}

// === WINDOW EXPORTS FOR NEW UI ===

window.gravityChat = window.gravityChat || {};
window.gravityChat.toggleGrokMenu = toggleGrokMenu;
window.gravityChat.selectModel = selectModel;
window.gravityChat.retryConnection = async () => {
    // Force check
    const btn = document.querySelector('button[onclick*="retryConnection"]') as HTMLButtonElement;
    if(btn) {
        btn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Connecting...`;
        btn.disabled = true;
    }
    
    const status = await checkLocalServerStatus();
    AppState.localServerOnline = status.online;
    if(status.online) {
        AppState.localModelLoaded = status.model;
        showToast('Backend Online', 'success');
    } else {
        showToast('Backend still offline', 'error');
    }
    renderModelList();
};

// Navigation
window.gravityChat.setLocalTab = (tab: string) => {
    AppState.localTab = tab;
    renderModelList();
};

// Local Actions
window.gravityChat.loadLocalModel = async (id: string) => {
    const btn = document.querySelector(`button[onclick*="loadLocalModel('${id}')"]`) as HTMLButtonElement;
    if (btn) {
         btn.innerHTML = `<span class="loading loading-spinner loading-xs"></span>`;
         btn.disabled = true;
    }
    
    try {
        const success = await loadLocalModel(id);
        if (success) {
            AppState.localModelLoaded = id;
        }
    } finally {
        renderModelList();
    }
};

window.gravityChat.unloadLocalModel = async () => {
    await unloadLocalModel();
    AppState.localModelLoaded = null;
    renderModelList();
};

window.gravityChat.openLocalFolder = async () => {
    showInfoModal("Local Folder", "Open your project folder and look for 'local_models'. Put .gguf files there.");
};

window.gravityChat.performHFSearch = async (overrideQuery?: string) => {
    const input = document.getElementById('hf-search-input') as HTMLInputElement;
    const query = overrideQuery || input?.value || 'GGUF';
    
    // Capture filters
    const quantFilter = (document.getElementById('hf-filter-quant') as HTMLSelectElement)?.value || 'all';
    const sizeFilter = (document.getElementById('hf-filter-size') as HTMLSelectElement)?.value || 'all';
    
    AppState.hfSearchQuery = query;
    AppState.hfSearchFilters = { quant: quantFilter, size: sizeFilter };
    
    const container = document.getElementById('hf-results');
    if (!container) return;
    
    container.innerHTML = `<div class="text-center py-4"><span class="loading loading-dots text-fuchsia-400"></span></div>`;
    
    // Pass filters (need to update searchHF signature or modify query string)
    // For now, simple query modification
    let fullQuery = query;
    if (quantFilter !== 'all') fullQuery += ` ${quantFilter}`;
    // Size filter is harder on HF API side without specific params, so maybe client-side filter
    
    const results = await searchHF(fullQuery);
    
    // Client-side filtering for size if needed, or just display raw
    // The current searchHF implementation returns minimal metadata, 
    // real size filtering would require checking model card or tags.
    // We'll skip complex size filtering for this iteration to keep it fast.
    
    if (!results.length) {
        container.innerHTML = `<div class="text-xs text-gray-500 text-center py-4">No results found.</div>`;
        return;
    }
    
    // Save results for tooltip lookup
    AppState.hfSearchResults = results;
    
    container.innerHTML = ModelsUI.renderHFResults(results);
};

// --- TOOLTIP LOGIC ---
window.gravityChat.showModelTooltip = (event: MouseEvent, modelId: string, isCloud: boolean = false) => {
    let model: any;
    
    if (isCloud) {
        model = AppState.allModels?.find((m: any) => m.id === modelId);
    } else {
        model = AppState.hfSearchResults?.find((m: any) => m.id === modelId);
    }
    
    if (!model) return;

    let tooltip = document.getElementById('global-model-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'global-model-tooltip';
        tooltip.className = 'fixed z-[9999] pointer-events-none hidden';
        document.body.appendChild(tooltip);
    }

    // Determine metadata based on source
    let title = model.id;
    let subtitle = isCloud ? (model.provider || 'Cloud API') : (model.pipeline_tag || 'text-generation');
    
    let content = '';
    
    if (isCloud) {
        // Cloud Model Metadata
        const inputCost = model.cost?.input || 0;
        const outputCost = model.cost?.output || 0;
        const isFree = inputCost === 0 && outputCost === 0;
        
        content = `
            <div class="grid grid-cols-2 gap-2 text-[9px] text-gray-400 mb-2">
                <div><span class="text-gray-600 block">PROVIDER</span> ${model.provider || 'Unknown'}</div>
                <div><span class="text-gray-600 block">CONTEXT</span> ${model.context_window || 'Unknown'}</div>
                <div class="col-span-2 border-t border-white/5 pt-1 mt-1">
                    <span class="text-gray-600 block">PRICING</span> 
                    ${isFree ? '<span class="text-cyan-400">Free</span>' : 
                    `In: $${inputCost}/1M <br> Out: $${outputCost}/1M`}
                </div>
            </div>
        `;
    } else {
        // HF Model Metadata
        const dateStr = model.last_modified ? new Date(model.last_modified).toLocaleDateString() : 'Unknown';
        content = `
            <div class="grid grid-cols-2 gap-2 text-[9px] text-gray-400 mb-2">
                <div><span class="text-gray-600 block">AUTHOR</span> ${model.author || 'Unknown'}</div>
                <div><span class="text-gray-600 block">UPDATED</span> ${dateStr}</div>
                <div><span class="text-gray-600 block">DOWNLOADS</span> ${ModelsUI.formatNumber(model.downloads)}</div>
                <div><span class="text-gray-600 block">LIKES</span> ${ModelsUI.formatNumber(model.likes)}</div>
            </div>
            <div class="flex flex-wrap gap-1">
                ${(model.tags || []).slice(0, 5).map((t: string) => `<span class="text-[8px] px-1 py-0.5 bg-fuchsia-500/10 text-fuchsia-300 rounded border border-fuchsia-500/20">${t}</span>`).join('')}
            </div>
        `;
    }

    tooltip.innerHTML = `
        <div class="bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl w-64 animate-in fade-in zoom-in-95 duration-150">
            <div class="flex items-start justify-between mb-2">
                <div class="text-xs font-bold ${isCloud ? 'text-cyan-400' : 'text-fuchsia-400'} truncate pr-2">${title}</div>
                <span class="text-[8px] px-1.5 py-0.5 bg-white/10 rounded text-gray-300">${subtitle}</span>
            </div>
            ${content}
        </div>
    `;

    // Position logic
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    tooltip.style.left = `${rect.right + 10}px`; 
    tooltip.style.top = `${rect.top}px`;
    
    if (rect.right + 270 > window.innerWidth) {
        tooltip.style.left = `${rect.left - 270}px`; 
    }
    
    tooltip.classList.remove('hidden');
};

window.gravityChat.showHFTooltip = (event: MouseEvent) => {
    let tooltip = document.getElementById('global-model-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'global-model-tooltip';
        tooltip.className = 'fixed z-[9999] pointer-events-none hidden';
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
        <div class="bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl w-64 animate-in fade-in zoom-in-95 duration-150">
            <div class="flex items-center gap-2 mb-2">
                <span class="text-xl">🤗</span>
                <div class="text-xs font-bold text-yellow-400">Hugging Face Hub</div>
            </div>
            <p class="text-[10px] text-gray-400 leading-relaxed">
                The <span class="text-gray-200 font-semibold">Hugging Face Hub</span> is a community-driven platform for hosting machine learning models.
            </p>
            <div class="mt-2 text-[9px] text-gray-500 bg-white/5 rounded p-1.5 border border-white/5">
                ℹ Verified GGUF models are safe to download and run locally on your hardware.
            </div>
        </div>
    `;

    // Position logic (Center below element)
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const tooltipWidth = 256; // w-64
    tooltip.style.left = `${rect.left + (rect.width/2) - (tooltipWidth/2)}px`; 
    tooltip.style.top = `${rect.bottom + 10}px`;
    
    tooltip.classList.remove('hidden');
};

window.gravityChat.hideModelTooltip = () => {
    const tooltip = document.getElementById('global-model-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
};

window.gravityChat.downloadModel = async (repoId: string, filename: string) => {
    showInfoModal("Download Info", `Please download <b class="text-cyan-400">${repoId}</b> manually and place it in <code>local_models</code> folder.<br><br>Direct Browser Download coming soon.`);
};

// ...rest of file (delete confirmation, toggles, etc)


// --- DELETE CONFIRMATION MODAL ---

window.gravityChat.confirmDeleteModel = (modelId: string) => {
    const modalRoot = document.getElementById('modals-root') as HTMLElement;
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200';
    modal.innerHTML = `
        <div class="glass-card max-w-sm w-full p-6 border-red-500/30 shadow-[0_0_50px_rgba(220,38,38,0.1)] scale-in-center">
            <h3 class="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <span class="text-red-500">⚠</span> Delete Model?
            </h3>
            <p class="text-sm text-gray-300 mb-2">
                Are you sure you want to delete <b class="text-white">${modelId}</b>?
            </p>
            <p class="text-[10px] text-gray-500 font-mono mb-6 uppercase tracking-wider">
                This action cannot be undone.
            </p>
            
            <div class="flex gap-3 justify-end">
                <button id="btn-cancel-delete" class="btn btn-ghost btn-sm text-gray-400 hover:text-white">Cancel</button>
                <button id="btn-confirm-delete" class="btn btn-error btn-sm bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500">
                    Delete Model
                </button>
            </div>
        </div>
    `;
    
    modalRoot.appendChild(modal);
    
    // Handlers
    const close = () => {
        modal.classList.add('fade-out');
        setTimeout(() => modal.remove(), 200);
    };
    
    const cancelBtn = modal.querySelector('#btn-cancel-delete') as HTMLElement;
    if (cancelBtn) cancelBtn.onclick = close;
    
    const confirmBtn = modal.querySelector('#btn-confirm-delete') as HTMLElement;
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            const success = await deleteLocalModel(modelId);
            if (success) {
                renderModelList(); // Refresh list
            }
            close();
        };
    }
    
    // Close on click outside
    modal.onclick = (e) => {
        if (e.target === modal) close();
    };
};

// --- TOGGLE LOGIC ---

window.gravityChat = window.gravityChat || {};
window.gravityChat.initToggles = () => {
    const setupToggle = (id: string, onChange: (checked: boolean) => void) => {
        const toggle = document.getElementById(id);
        if (!toggle) return;

        // Init state check based on AppState
        if (id === 'model-source-toggle' && AppState.useLocalModel) toggle.classList.add('checked');
        if (id === 'premium-toggle' && AppState.premiumEnabled) toggle.classList.add('checked');

        const updateState = () => {
            const isChecked = toggle.classList.contains('checked');
            const labels = toggle.querySelectorAll('.toggle-label');
            
            // Left Label (Cloud/Free) - Active when NOT checked
            if (labels[0]) {
                labels[0].classList.toggle('active-text', !isChecked);
                labels[0].classList.toggle('inactive-text', isChecked);
            }
            
            // Right Label (Local/Pro) - Active when checked
            if (labels[1]) {
                labels[1].classList.toggle('active-text', isChecked);
                labels[1].classList.toggle('inactive-text', !isChecked);
            }
        };

        // Initial visual update
        updateState();

        // Click Handler
        toggle.onclick = (e) => {
            toggle.classList.toggle('checked');
            updateState();
            onChange(toggle.classList.contains('checked'));
        };
    };

    // 1. Source Toggle (Cloud vs Local)
    setupToggle('model-source-toggle', (isLocal) => {
        AppState.useLocalModel = isLocal;
        renderModelList();
        updateCurrentModelDisplay();
    });

    // 2. Premium Toggle (Free vs Pro)
    setupToggle('premium-toggle', (isPro) => {
        AppState.premiumEnabled = isPro;
        renderModelList();
        showToast(isPro ? 'Pro Models Unlocked' : 'Free Processors Active', 'info');
    });
};

// Call init on load/render
document.addEventListener('DOMContentLoaded', () => { 
    // Wait for DOM
    setTimeout(() => window.gravityChat?.initToggles(), 500); 
});


