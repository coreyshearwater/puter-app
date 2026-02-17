import { AppState } from '../../state.js';
import { updateElementText } from '../../utils/dom.js';
import { showToast } from '../../utils/toast.js';
import { showInfoModal } from '../../utils/modals.js';
import { updateTemperatureVisibility } from './settings.js';

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
            { id: 'grok-4-20', name: 'Grok 4.20 (Beta)', cost: { input: 0, output: 0 }, provider: 'xAI' },
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

    // Render Other Models — sorted by quality (best first) when showing free models
    const sortedOther = [...filteredOther].sort((a, b) => getModelQuality(b.id) - getModelQuality(a.id));
    html += sortedOther.map(model => renderModelItem(model)).join('');
    
    list.innerHTML = html;
}

function renderModelItem(model) {
    const isFree = model.id.endsWith(':free') || (model.cost?.input === 0);
    const isSelected = model.id === AppState.currentModel;
    const quality = getModelQuality(model.id);
    const tier = quality >= 90 ? 'S' : quality >= 70 ? 'A' : quality >= 50 ? 'B' : 'C';
    const tierColor = { S: 'text-emerald-400 bg-emerald-500/15', A: 'text-cyan-400 bg-cyan-500/15', B: 'text-amber-400 bg-amber-500/15', C: 'text-gray-400 bg-gray-500/15' }[tier];
    return `
        <div class="model-item glass-card p-2 cursor-pointer hover:bg-opacity-20 transition ${isSelected ? 'ring-1 ring-cyan-400 bg-cyan-400/5' : ''}" 
             onclick="window.gravityChat.selectModel('${model.id}')">
            <div class="flex justify-between items-start gap-1 overflow-hidden">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-semibold truncate" title="${model.name || model.id}">${model.name || model.id}</div>
                    <div class="text-[9px] text-gray-500 font-mono truncate opacity-70">${model.id}</div>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                    <span class="text-[8px] px-1 rounded font-bold ${tierColor}" title="Quality tier">${tier}</span>
                    <span class="text-[8px] px-1 rounded ${isFree ? 'bg-cyan-500/20 text-cyan-400' : 'bg-orange-500/20 text-orange-400'}">${isFree ? 'FREE' : 'PAID'}</span>
                </div>
            </div>
        </div>`;
}

// Quality rankings for free models (higher = better)
// Based on real-world benchmarks, parameter count, and reliability
function getModelQuality(id) {
    const lower = id.toLowerCase();
    
    // Tier S (90-100): Best-in-class free models
    const tierS = [
        ['gpt-4o-mini', 98],
        ['gpt-5-nano', 96],
        ['claude-3-5-haiku', 95], ['claude-3.5-haiku', 95],
        ['deepseek-r1', 93], ['deepseek/deepseek-r1', 93],
        ['deepseek-v3', 91], ['deepseek/deepseek-v3', 91],
        ['gemini-2.0-flash', 90], ['gemini-flash', 90],
    ];
    
    // Tier A (70-89): Strong capable models
    const tierA = [
        ['qwen/qwen3', 85], ['qwen3-', 85], ['qwen-2.5', 83],
        ['llama-3.1-70b', 82], ['llama-3.3-70b', 82],
        ['mistral-large', 80], ['mistral-nemo', 78],
        ['gemma-2-27b', 77], ['gemma-3-27b', 77],
        ['command-r', 75], ['command-r-plus', 78],
        ['phi-4', 74], ['phi-3-medium', 73],
        ['llama-3.1-8b', 72],
    ];
    
    // Tier B (50-69): Decent but limited
    const tierB = [
        ['gemma-2-9b', 65], ['gemma-3-12b', 67],
        ['mistral-7b', 60],
        ['llama-3.2', 58],
        ['phi-3-mini', 55],
        ['yi-', 53],
    ];

    // Check all tiers
    for (const [pattern, score] of [...tierS, ...tierA, ...tierB]) {
        if (lower.includes(pattern)) return score;
    }
    
    // Provider-based fallback scoring
    if (lower.includes('openai') || lower.includes('gpt')) return 85;
    if (lower.includes('anthropic') || lower.includes('claude')) return 83;
    if (lower.includes('google') || lower.includes('gemini')) return 75;
    if (lower.includes('meta-llama') || lower.includes('llama')) return 65;
    if (lower.includes('mistral')) return 62;
    if (lower.includes('microsoft') || lower.includes('phi-')) return 60;
    if (lower.includes('deepseek')) return 70;
    if (lower.includes('qwen')) return 68;

    return 40; // Unknown models ranked lowest
}

export function toggleGrokMenu() {
    AppState.grokMenuExpanded = !AppState.grokMenuExpanded;
    renderModelList(document.getElementById('model-search')?.value || '');
}

export async function selectModel(modelId) {
    AppState.currentModel = modelId;
    updateCurrentModelDisplay();
    renderModelList(document.getElementById('model-search')?.value || '');
    updateTemperatureVisibility();
    showToast(`Model: ${modelId}`, 'success');

    // "Pre-flight" check: Verify the model is actually online
    // This is informational only — don't auto-switch, let actual chat handle fallback
    try {
        const model = AppState.allModels.find(m => m.id === modelId);
        const isGrok = model?.provider === 'xAI';
        const isFree = model?.id.endsWith(':free') || model?.cost?.input === 0 || isGrok;
        
        if (isFree && !isGrok) {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
            await Promise.race([
                puter.ai.chat('test', { model: modelId, max_tokens: 1 }),
                timeout
            ]);
        }
    } catch (error) {
        // Just log — don't auto-switch. The actual chat call has robust fallback logic.
        console.warn(`Model ${modelId} health check failed:`, error?.message || error);
    }
}

export function updateCurrentModelDisplay() {
    const model = AppState.allModels.find(m => m.id === AppState.currentModel);
    const displayName = model ? (model.name || model.id) : AppState.currentModel;
    updateElementText('current-model-display', displayName);
}

export async function refreshModels() {
    const btn = document.getElementById('btn-refresh-models');
    const svg = btn?.querySelector('svg');
    
    // Spin animation
    if (svg) svg.classList.add('spin');
    if (btn) btn.disabled = true;
    
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
        const models = await Promise.race([puter.ai.listModels(), timeout]);
        
        // Preserve Grok models (hardcoded, different routing)
        const grokModels = AppState.allModels.filter(m => m.provider === 'xAI');
        
        AppState.allModels = [...grokModels, ...models];
        AppState.freeModels = AppState.allModels.filter(m => 
            m.id.endsWith(':free') || m.provider === 'xAI' || (m.cost?.input === 0 && m.cost?.output === 0)
        );
        
        updateCurrentModelDisplay();
        renderModelList(document.getElementById('model-search')?.value || '');
        
        const puterCount = models.length;
        showToast(`Models refreshed: ${puterCount} Puter + ${grokModels.length} Grok`, 'success');
        console.info(`[Models] Refreshed: ${puterCount} from Puter, ${grokModels.length} Grok preserved`);
    } catch (error) {
        console.error('Model refresh failed:', error?.message || error);
        showToast('Model refresh failed — check connection', 'error');
    } finally {
        if (svg) svg.classList.remove('spin');
        if (btn) btn.disabled = false;
    }
}
