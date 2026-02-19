
import { AppState } from '../state/state.js';
import { saveStateToKV } from '../services/storage.js';
import { sendHiddenMessage } from '../services/ai.js';
import { showToast } from '../utils/toast.js';

export function initializeOracularControls() {
    const modesContainer = document.getElementById('oracular-modes');
    if (!modesContainer) return;

    const buttons = modesContainer.querySelectorAll('.mode-btn');
    buttons.forEach(btn => {
        (btn as HTMLElement).onclick = () => {
            const mode = (btn as HTMLElement).dataset.mode;
            if (mode) toggleMode(mode);
        };
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
    if (!AppState.oracularModes) (AppState as any).oracularModes = {};

    buttons.forEach(btn => {
        const mode = (btn as HTMLElement).dataset.mode;
        if (!mode) return;
        const isActive = !!(AppState as any).oracularModes[mode];
        
        if (isActive) {
            btn.classList.add('bg-[#7B2CBF]', 'text-white');
            btn.classList.remove('btn-outline', 'text-[#7B2CBF]');
        } else {
            btn.classList.remove('bg-[#7B2CBF]', 'text-white');
            btn.classList.add('btn-outline', 'text-[#7B2CBF]');
        }
    });
}

async function toggleMode(mode: string) {
    if (!AppState.oracularModes) (AppState as any).oracularModes = {};
    
    const wasActive = !!(AppState as any).oracularModes[mode];
    const newState = !wasActive;
    
    (AppState as any).oracularModes[mode] = newState;
    updateButtonsState();
    saveStateToKV();

    const command = newState 
        ? `Engage ${mode} Mode` 
        : `Disengage ${mode} Mode`;

    try {
        await sendHiddenMessage(command);
        showToast(`${mode} Mode ${newState ? 'Engaged' : 'Disengaged'}`, 'info');
    } catch (error) {
        console.error('Failed to toggle mode:', error);
        showToast(`Failed to toggle ${mode}`, 'error');
        // Revert state on failure
        (AppState as any).oracularModes[mode] = wasActive;
        updateButtonsState();
    }
}
