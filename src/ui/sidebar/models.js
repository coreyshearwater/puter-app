import { AppState } from '../../state.js';
import { updateElementText } from '../../utils/dom.js';
import { showToast } from '../../utils/toast.js';
import { showInfoModal } from '../../utils/modals.js';

export async function fetchModels() {
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
        const models = await Promise.race([puter.ai.listModels(), timeout]);
        
        // Add Grok models
        const grokModels = [
            { id: 'grok-3-auto', name: 'Grok 3 (Auto)', cost: { input: 0, output: 0 }, provider: 'xAI' },
            { id: 'grok-3-fast', name: 'Grok 3 (Fast)', cost: { input: 0, output: 0 }, provider: 'xAI' },
            { id: 'grok-4', name: 'Grok 4 (Expert)', cost: { input: 0, output: 0 }, provider: 'xAI' },
            { id: 'grok-4-mini-thinking-tahoe', name: 'Grok 4 Mini (Thinking)', cost: { input: 0, output: 0 }, provider: 'xAI' },
        ];
        
        AppState.allModels = [...grokModels, ...models];
        AppState.freeModels = AppState.allModels.filter(m => m.id.endsWith(':free') || m.provider === 'xAI' || (m.cost?.input === 0 && m.cost?.output === 0));
    } catch (error) {
        console.error('Fetch models failed, using fallbacks');
        AppState.allModels = [
            { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)', cost: { input: 0, output: 0 } },
            { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)', cost: { input: 0, output: 0 } }
        ];
        AppState.freeModels = AppState.allModels.filter(m => m.cost.input === 0);
    } finally {
        updateCurrentModelDisplay();
        renderModelList();
    }
}

export function renderModelList(searchQuery = '') {
    const list = document.getElementById('model-list');
    if (!list) return;

    const available = AppState.premiumEnabled ? AppState.allModels : AppState.freeModels;
    
    // Split available models into Grok and non-Grok
    const grokModels = available.filter(m => m.provider === 'xAI');
    const otherModels = available.filter(m => m.provider !== 'xAI');
    
    // Apply search filter to both
    const filterFn = m => (m.id + (m.name || '')).toLowerCase().includes(searchQuery.toLowerCase());
    const filteredGrok = searchQuery ? grokModels.filter(filterFn) : grokModels;
    const filteredOther = searchQuery ? otherModels.filter(filterFn) : otherModels;

    let html = '';

    // Render Grok Category Toggle
    if (filteredGrok.length > 0) {
        const isCurrentModelGrok = AppState.currentModel.startsWith('grok-');
        html += `
            <div class="mb-2">
                <div class="glass-card p-2 cursor-pointer flex justify-between items-center bg-cyan-900/10 border-cyan-500/30 hover:bg-cyan-900/20" 
                     onclick="window.gravityChat.toggleGrokMenu()">
                    <span class="text-xs font-bold text-cyan-400">GROK MODELS</span>
                    <span class="text-[10px] transform transition-transform ${AppState.grokMenuExpanded ? 'rotate-180' : ''}">▼</span>
                </div>
                
                <div id="grok-submenu" class="mt-1 space-y-1 pl-2 border-l border-cyan-500/20 ${AppState.grokMenuExpanded || searchQuery ? '' : 'hidden'}">
                    ${filteredGrok.map(model => renderModelItem(model)).join('')}
                </div>
            </div>
        `;
    }

    // Render Other Models
    html += filteredOther.map(model => renderModelItem(model)).join('');
    
    list.innerHTML = html;
}

function renderModelItem(model) {
    const isFree = model.id.endsWith(':free') || (model.cost?.input === 0);
    const isSelected = model.id === AppState.currentModel;
    return `
        <div class="model-item glass-card p-2 cursor-pointer hover:bg-opacity-20 transition ${isSelected ? 'ring-1 ring-cyan-400 bg-cyan-400/5' : ''}" 
             onclick="window.gravityChat.selectModel('${model.id}')">
            <div class="flex justify-between items-start gap-1 overflow-hidden">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-semibold truncate" title="${model.name || model.id}">${model.name || model.id}</div>
                    <div class="text-[9px] text-gray-500 font-mono truncate opacity-70">${model.id}</div>
                </div>
                <span class="text-[8px] px-1 rounded flex-shrink-0 ${isFree ? 'bg-cyan-500/20 text-cyan-400' : 'bg-orange-500/20 text-orange-400'}">${isFree ? 'FREE' : 'PAID'}</span>
            </div>
        </div>`;
}

export function toggleGrokMenu() {
    AppState.grokMenuExpanded = !AppState.grokMenuExpanded;
    renderModelList(document.getElementById('model-search')?.value || '');
}

export async function selectModel(modelId) {
    AppState.currentModel = modelId;
    updateCurrentModelDisplay();
    renderModelList(document.getElementById('model-search')?.value || '');
    showToast(`Model: ${modelId}`, 'success');

    // "Pre-flight" check: Verify the model is actually online
    // This addresses user feedback about needing to know *before* typing
    try {
        const model = AppState.allModels.find(m => m.id === modelId);
        // Only check free models, or if cost is zero. Avoid generating costs for paid models.
        const isFree = model?.id.endsWith(':free') || model?.cost?.input === 0 || model?.provider === 'xAI';
        
        if (isFree) {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
            // Send empty/minimal prompt
            await Promise.race([
                puter.ai.chat('test', { model: modelId, max_tokens: 1 }),
                timeout
            ]);
        }
    } catch (error) {
        console.warn(`Model ${modelId} health check failed:`, error);
        
        // Find a fallback (Simple logic: first reliable free model that isn't the broken one)
        let candidates = (AppState.freeModels || []).map(m => m.id);
        const fallback = candidates.find(id => id !== modelId);
        
        if (fallback) {
            showInfoModal('Model Unavailable', `The selected model (${modelId}) failed a connection test. Switched to ${fallback} to ensure stability.`);
            selectModel(fallback);
        }
    }
}

export function updateCurrentModelDisplay() {
    const model = AppState.allModels.find(m => m.id === AppState.currentModel);
    const displayName = model ? (model.name || model.id) : AppState.currentModel;
    updateElementText('current-model-display', displayName);
}
