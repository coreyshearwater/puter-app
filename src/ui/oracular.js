import { AppState } from '../state.js';
import { saveStateToKV } from '../services/storage.js';
import { sendHiddenMessage } from '../services/ai.js';
import { showToast } from '../utils/toast.js';

export function initializeOracularControls() {
    const modesContainer = document.getElementById('oracular-modes');
    if (!modesContainer) return;

    const buttons = modesContainer.querySelectorAll('.mode-btn');
    buttons.forEach(btn => {
        btn.onclick = () => toggleMode(btn.dataset.mode);
    });
}

export function updatePersonaHeader() {
    const header = document.getElementById('persona-header');
    const label = document.getElementById('persona-label');
    const oracularModes = document.getElementById('oracular-modes');
    
    if (!header || !label || !oracularModes) return;

    const persona = AppState.activePersona || { name: 'Default', color: '#71717a', id: 'default' };
    
    // Always show header now to maintain layout consistency
    header.classList.remove('hidden');
    header.style.display = 'flex';
    
    // Update label text and color
    label.textContent = `Persona: ${persona.name}`;
    label.style.color = persona.color;
    
    const dot = document.getElementById('persona-dot');
    if (dot) dot.style.background = persona.color;
    
    // Handle Oracular-specific buttons
    if (persona.id === 'oracular') {
        oracularModes.classList.remove('hidden');
        oracularModes.style.display = 'flex';
        updateButtonsState();
    } else {
        oracularModes.classList.add('hidden');
        oracularModes.style.display = 'none';
    }
}

function updateButtonsState() {
    const modesContainer = document.getElementById('oracular-modes');
    if (!modesContainer) return;
    const buttons = modesContainer.querySelectorAll('.mode-btn');
    
    // Ensure oracularModes exists
    if (!AppState.oracularModes) AppState.oracularModes = {};

    buttons.forEach(btn => {
        const mode = btn.dataset.mode;
        const isActive = !!AppState.oracularModes[mode];
        
        if (isActive) {
            btn.classList.add('bg-[#7B2CBF]', 'text-white');
            btn.classList.remove('btn-outline', 'text-[#7B2CBF]');
        } else {
            btn.classList.remove('bg-[#7B2CBF]', 'text-white');
            btn.classList.add('btn-outline', 'text-[#7B2CBF]');
        }
    });
}

async function toggleMode(mode) {
    if (!AppState.oracularModes) AppState.oracularModes = {};
    
    const wasActive = !!AppState.oracularModes[mode];
    const newState = !wasActive;
    
    AppState.oracularModes[mode] = newState;
    updateButtonsState();
    saveStateToKV();

    const command = newState 
        ? `Engage ${mode} Mode` 
        : `Disengage ${mode} Mode`;

    // Special handling for parameterized modes (just basic activation for now as per instructions)
    // "Soul Tether Mode" might need entity name, but instructions say: 
    // "Soul Tether Mode: 'Engage Soul Tether Mode' (note: this may need user-provided entity name in chat later, but send basic activation)"
    
    try {
        await sendHiddenMessage(command);
        showToast(`${mode} Mode ${newState ? 'Engaged' : 'Disengaged'}`, 'info');
    } catch (error) {
        console.error('Failed to toggle mode:', error);
        showToast(`Failed to toggle ${mode}`, 'error');
        // Revert state on failure
        AppState.oracularModes[mode] = wasActive;
        updateButtonsState();
    }
}
