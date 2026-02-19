import { AppState as IAppState, Persona } from '../../types.js';
import { AppState as AppStateImpl, DEFAULT_PERSONAS } from '../../state/state.js';
import { saveStateToKV } from '../../services/storage.js';
import { showToast } from '../../utils/toast.js';
import { updatePersonaHeader } from '../oracular.js';
import { showCustomPersonaModal, showConfirmModal } from '../../utils/modals.js';

const AppState: IAppState = AppStateImpl as any;

declare global {
    interface Window {
        gravityChat: any;
    }
}

export function initializePersonas() {
    // Ensure all default personas are present
    const existingIds = new Set(AppState.personas.map(p => p.id));
    
    DEFAULT_PERSONAS.forEach((def: Persona) => {
        if (!existingIds.has(def.id)) {
            AppState.personas.push({...def}); // Clone to allow local edits
        }
    });

    // Final validation & Sync
    if (!AppState.activePersona || !AppState.personas.find(p => p.id === AppState.activePersona?.id)) {
        console.log('⚡ Persona Logic: Reverting to Default');
        AppState.activePersona = null;
    } else {
        console.log(`⚡ Persona Logic: Active = ${AppState.activePersona?.name}`);
    }

    renderPersonasList();
    updatePersonaHeader(); 

    // Attach global handlers
    if (window.gravityChat) {
        window.gravityChat.handleEditPersona = function(id: string) {
            const persona = AppState.personas.find(p => p.id === id);
            if (!persona) return;
            
            showCustomPersonaModal(persona.name, persona.systemPrompt, (newName: string, newPrompt: string) => {
                persona.name = newName;
                persona.systemPrompt = newPrompt;
                if (AppState.activePersona?.id === id) {
                    AppState.activePersona = persona;
                }
                renderPersonasList();
                updatePersonaHeader();
                saveStateToKV();
                showToast('Persona updated', 'success');
            });
        };
        
        window.gravityChat.selectPersona = selectPersona;
        window.gravityChat.deletePersona = deletePersona;
    }
}

export function renderPersonasList() {
    const list = document.getElementById('personas-list');
    if (!list) return;

    // Helper to escape HTML entities for safe innerHTML injection
    const esc = (str: string) => str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

    // 1. Default Option (No Persona)
    const isDefaultActive = !AppState.activePersona;
    let html = `
        <div class="glass-card p-2 cursor-pointer transition mb-2 ${isDefaultActive ? 'ring-2 ring-cyan-400' : 'hover:bg-white/5 opacity-70 hover:opacity-100'}"
             onclick="window.gravityChat.selectPersona(null)">
            <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full" style="background: #94a3b8; box-shadow: 0 0 8px #94a3b880; border: 1px solid #ffffff20;"></div>
                <span class="font-semibold text-xs ${isDefaultActive ? 'text-white' : 'text-gray-400'}">Default (No persona)</span>
            </div>
        </div>
        <div class="h-px bg-white/10 my-2"></div>
    `;

    // 2. Render All Personas
    html += AppState.personas.map(persona => {
        const isActive = AppState.activePersona?.id === persona.id;
        
        return `
            <div class="glass-card p-2 cursor-pointer transition mb-2 group relative ${isActive ? 'ring-2 ring-cyan-400' : 'hover:bg-white/5'}" 
                 onclick="window.gravityChat.selectPersona('${persona.id}')">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-2.5 h-2.5 rounded-full" style="background: ${esc(persona.color)}; box-shadow: 0 0 10px ${esc(persona.color)};"></div>
                        <span class="font-semibold text-xs text-gray-200">${esc(persona.name)}</span>
                    </div>
                    
                    <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="text-[9px] font-bold text-gray-400 hover:text-cyan-400 tracking-tighter" 
                                onclick="event.stopPropagation(); window.gravityChat.handleEditPersona('${persona.id}')">EDIT</button>
                        <button class="text-xs text-gray-400 hover:text-red-400 font-bold" 
                                onclick="event.stopPropagation(); window.gravityChat.deletePersona('${persona.id}')">×</button>
                    </div>
                </div>
            </div>`;
    }).join('');

    list.innerHTML = html;
}

export function selectPersona(personaId: string | null) {
    // Handle "Default" selection (null)
    if (!personaId) {
        let dc = 'Return to default assistance mode.';
        if (AppState.activePersona?.id === 'oracular') {
            dc = 'Disengage Oracular Function. Reset all operational frameworks. Return to default assistance mode. Clear all previous output formatting.';
            AppState.oracularModes = {};
        }

        AppState.activePersona = null;
        renderPersonasList();
        showToast('Persona cleared (Default)', 'info');
        updatePersonaHeader(); 
        saveStateToKV();
        
        // Notify AI with consolidated command
        import('../../services/ai.js').then(m => m.sendHiddenMessage(dc)).catch(e => console.error('Hidden message failed:', e));
        return;
    }

    const persona = AppState.personas.find(p => p.id === personaId);
    if (persona) {
        let command = '';
        
        // Handle transition logic
        if (AppState.activePersona?.id === 'oracular' && personaId !== 'oracular') {
            // Forceful reset when leaving Oracular
            command = `Disengage Oracular Function. Reset all operational frameworks. Persona "${persona.name}" engaged. Clear all previous output formatting.`;
            AppState.oracularModes = {};
        } else if (personaId === 'oracular') {
            command = 'Engage Oracular Function';
        } else {
            command = `Persona "${persona.name}" engaged.`;
        }

        AppState.activePersona = persona;
        renderPersonasList();
        showToast(`Persona: ${persona.name}`, 'success');
        updatePersonaHeader(); 
        saveStateToKV();

        // Notify AI with a SINGLE consolidated command to avoid "System busy" race conditions
        import('../../services/ai.js').then(m => m.sendHiddenMessage(command)).catch(e => console.error('Hidden message failed:', e));
    }
}

export async function createPersona() {
    showCustomPersonaModal('', '', (name: string, prompt: string) => {
        const id = `persona_${Date.now()}`;
        const color = generateUniqueColor();
        
        const newPersona: Persona = { id, name, color, systemPrompt: prompt };
        AppState.personas.push(newPersona);
        // AppState.activePersona = newPersona; // Don't auto-select
        
        renderPersonasList();
        updatePersonaHeader();
        saveStateToKV();
        showToast('New Persona Created', 'success');
    });
}

function generateUniqueColor() {
    const existingColors = new Set(AppState.personas.map(p => p.color.toLowerCase()));
    const presets = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#FF8000', '#8000FF', '#00FF80', '#FF0080', '#80FF00', '#0080FF'
    ];
    
    // Try presets first
    for (const c of presets) {
        if (!existingColors.has(c.toLowerCase())) return c;
    }
    
    // Fallback to random neon
    return `hsl(${Math.random() * 360}, 100%, 70%)`;
}

export function deletePersona(personaId: string) {
    const persona = AppState.personas.find(p => p.id === personaId);
    const name = persona ? persona.name : 'this persona';
    
    showConfirmModal('Delete Persona', `Are you sure you want to delete "${name}"? This action cannot be undone.`, () => {
        AppState.personas = AppState.personas.filter(p => p.id !== personaId);
        if (AppState.activePersona?.id === personaId) AppState.activePersona = null;
        renderPersonasList();
        updatePersonaHeader();
        saveStateToKV();
        showToast('Persona deleted', 'info');
    });
}
