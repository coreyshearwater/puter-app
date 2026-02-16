import { AppState, DEFAULT_PERSONAS } from '../../state.js';
import { saveStateToKV } from '../../services/storage.js';
import { showToast } from '../../utils/toast.js';
import { updatePersonaHeader } from '../oracular.js';
import { showCustomPersonaModal } from '../../utils/modals.js';

export function initializePersonas() {
    // Ensure all default personas are present
    const existingIds = new Set(AppState.personas.map(p => p.id));
    
    DEFAULT_PERSONAS.forEach(def => {
        if (!existingIds.has(def.id)) {
            AppState.personas.push({...def}); // Clone to allow local edits
        }
    });

    // Force Default (null) if no valid persona is saved or if we're in a fresh state
    if (!AppState.activePersona) {
        AppState.activePersona = null;
    } else if (!AppState.personas.some(p => p.id === AppState.activePersona.id)) {
        AppState.activePersona = null;
    }

    renderPersonasList();
    updatePersonaHeader(); 

    // Attach global handlers
    if (window.gravityChat) {
        window.gravityChat.handleEditPersona = function(id) {
            const persona = AppState.personas.find(p => p.id === id);
            if (!persona) return;
            
            showCustomPersonaModal(persona.name, persona.systemPrompt, (newName, newPrompt) => {
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
    }
}

export function renderPersonasList() {
    const list = document.getElementById('personas-list');
    if (!list) return;

    // 1. Default Option (No Persona)
    const isDefaultActive = !AppState.activePersona;
    let html = `
        <div class="glass-card p-3 cursor-pointer transition mb-2 ${isDefaultActive ? 'ring-2 ring-cyan-400' : 'hover:bg-white/5 opacity-70 hover:opacity-100'}"
             onclick="window.gravityChat.selectPersona(null)">
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background: #94a3b8; box-shadow: 0 0 8px #94a3b880; border: 1px solid #ffffff20;"></div>
                <span class="font-semibold text-sm ${isDefaultActive ? 'text-white' : 'text-gray-400'}">Default (No persona)</span>
            </div>
        </div>
        <div class="h-px bg-white/10 my-2"></div>
    `;

    // 2. Render All Personas
    html += AppState.personas.map(persona => {
        const isActive = AppState.activePersona?.id === persona.id;
        
        return `
            <div class="glass-card p-3 cursor-pointer transition mb-2 group relative ${isActive ? 'ring-2 ring-cyan-400' : 'hover:bg-white/5'}" 
                 onclick="window.gravityChat.selectPersona('${persona.id}')">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background: ${persona.color}; box-shadow: 0 0 10px ${persona.color};"></div>
                        <span class="font-semibold text-sm text-gray-200">${persona.name}</span>
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

export function selectPersona(personaId) {
    // Handle "Default" selection (null)
    if (!personaId) {
        AppState.activePersona = null;
        renderPersonasList();
        showToast('Persona cleared (Default)', 'info');
        updatePersonaHeader(); 
        saveStateToKV();
        return;
    }

    const persona = AppState.personas.find(p => p.id === personaId);
    if (persona) {
        AppState.activePersona = persona;
        renderPersonasList();
        showToast(`Persona: ${persona.name}`, 'success');
        updatePersonaHeader(); 
        saveStateToKV();

        // ORACULAR AUTO-ENGAGEMENT
        // If user selects Oracular and it's not already engaged, send activation command
        if (personaId === 'oracular') {
            const { sendHiddenMessage } = import('../../services/ai.js').then(m => {
                const isAlreadyEngaged = AppState.oracularModes && AppState.oracularModes['Oracle'];
                if (!isAlreadyEngaged) {
                    // Update UI state first
                    if (!AppState.oracularModes) AppState.oracularModes = {};
                    AppState.oracularModes['Oracle'] = true;
                    const { updateButtonsState } = import('../oracular.js').then(om => {
                        om.updateButtonsState();
                    });
                    
                    // Send the command user requested
                    m.sendHiddenMessage('Engage Oracle Mode');
                }
            });
        }
    }
}

export async function createPersona() {
    showCustomPersonaModal('', '', (name, prompt) => {
        const id = `persona_${Date.now()}`;
        const color = generateUniqueColor();
        
        const newPersona = { id, name, color, systemPrompt: prompt };
        AppState.personas.push(newPersona);
        AppState.activePersona = newPersona;
        
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

export function deletePersona(personaId) {
    if (!confirm('Delete this persona?')) return;
    AppState.personas = AppState.personas.filter(p => p.id !== personaId);
    if (AppState.activePersona?.id === personaId) AppState.activePersona = null;
    renderPersonasList();
    saveStateToKV();
}
