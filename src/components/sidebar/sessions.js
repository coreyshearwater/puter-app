import { AppState } from '../../state/state.js';
import { clearChat, renderMessage } from '../chat.js';
import { saveStateToKV } from '../../services/storage.js';
import { showConfirmModal } from '../../utils/modals.js';
import { showToast } from '../../utils/toast.js';

export function initializeSessions() {
    console.log('🔹 initializing Sessions...');
    const sessionList = document.getElementById('session-list');
    const btnNew = document.getElementById('btn-new-session');

    if (!sessionList) console.error('❌ session-list not found in DOM');
    if (!btnNew) console.error('❌ btn-new-session not found in DOM');

    if (!sessionList || !btnNew) return;

    btnNew.onclick = createNewSession;

    // Default session check
    if (!AppState.sessions || AppState.sessions.length === 0) {
        console.log('🔸 No sessions found, creating default...');
        // Migration: If messages exist but no sessions, create a default session with current messages
        const initialMessages = AppState.messages.length > 0 ? [...AppState.messages] : [];
        const defaultSession = {
            id: 'default_' + Date.now(),
            name: 'New Chat',
            messages: initialMessages,
            timestamp: Date.now()
        };
        AppState.sessions = [defaultSession];
        AppState.activeSessionId = defaultSession.id;
        AppState.messages = initialMessages; // Ensure sync
        saveStateToKV(); // Persist immediately
    } else {
        console.log(`🔹 Found ${AppState.sessions.length} sessions.`);
        // Restore active session
        const active = AppState.sessions.find(s => s.id === AppState.activeSessionId);
        if (active) {
            AppState.messages = active.messages;
            renderCurrentSessionMessages(); 
        } else {
            console.warn('⚠️ Active session ID not found, resetting to first.');
            AppState.activeSessionId = AppState.sessions[0].id;
            AppState.messages = AppState.sessions[0].messages;
            renderCurrentSessionMessages();
            saveStateToKV();
        }
    }

    renderSessionList();
}

function renderCurrentSessionMessages() {
    // Manually clear DOM and render all messages in current AppState.messages
    const container = document.getElementById('messages-container');
    if (container) container.innerHTML = '';
    
    if (AppState.messages.length === 0) {
         container.innerHTML = '';
    } else {
        AppState.messages.forEach(msg => renderMessage(msg));
    }
}

function renderSessionList() {
    const list = document.getElementById('session-list');
    if (!list) return;

    list.innerHTML = AppState.sessions.map(session => {
        const isActive = session.id === AppState.activeSessionId;
        // Visual: Active session gets a highlight border/bg
        const activeClasses = isActive 
            ? 'bg-gradient-to-r from-cyan-900/40 to-transparent border-l-2 border-cyan-400' 
            : 'hover:bg-white/5 border-l-2 border-transparent';
            
        return `
            <div class="group relative flex items-center justify-between p-2 cursor-pointer transition-all rounded-r focus-within:bg-white/10 outline-none ${activeClasses}"
                 tabindex="0"
                 onkeydown="if(event.key==='Enter') window.gravityChat.switchSession('${session.id}')"
                 onclick="window.gravityChat.switchSession('${session.id}')">
                <div class="flex flex-col overflow-hidden min-w-0">
                    <span class="text-xs font-medium truncate ${isActive ? 'text-white' : 'text-gray-400'}">${session.name}</span>
                    <span class="text-[9px] text-gray-600 truncate">${new Date(session.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                
                <button onclick="event.stopPropagation(); window.gravityChat.deleteSession('${session.id}')"
                        class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-gray-600 transition-opacity"
                        title="Delete Chat">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        `;
    }).join('');
}

export function createNewSession() {
    const newSession = {
        id: 'chat_' + Date.now(),
        name: 'New Chat',
        messages: [],
        timestamp: Date.now()
    };
    
    // Auto-save current session state before switching?
    // Actually simpler: Since AppState.messages IS the reference, we just ensure we push changes.
    // BUT: AppState.messages is an array. If we replace it, we lose the ref in the OLD session object if it wasn't updated.
    // CRITICAL: We must sync AppState.messages back to the session object before switching.
    syncCurrentSession();

    AppState.sessions.unshift(newSession); // Add to top
    AppState.activeSessionId = newSession.id;
    AppState.messages = newSession.messages;
    
    renderSessionList();
    renderCurrentSessionMessages();
    saveStateToKV();
}

export function switchSession(sessionId) {
    if (sessionId === AppState.activeSessionId) return;

    syncCurrentSession();

    const target = AppState.sessions.find(s => s.id === sessionId);
    if (!target) return;

    AppState.activeSessionId = target.id;
    AppState.messages = target.messages;
    
    renderSessionList();
    renderCurrentSessionMessages();
    saveStateToKV();
}

export function deleteSession(sessionId) {
    const session = AppState.sessions.find(s => s.id === sessionId);
    const sessionName = session ? session.name : 'this chat';

    showConfirmModal('Delete Chat', `Are you sure you want to delete "${sessionName}"? All messages in this thread will be permanently removed.`, async () => {
        const { stopSpeech } = await import('../../services/voice.js');
        stopSpeech();
        
        // specific logic: if it's the only session, just clear it
        if (AppState.sessions.length <= 1) {
            AppState.messages = [];
            syncCurrentSession();
            renderCurrentSessionMessages();
            renderSessionList(); // FIX: Re-render list to update name/time
            saveStateToKV();
            showToast('Chat cleared', 'info');
            return;
        }

        // Filter out
        const idx = AppState.sessions.findIndex(s => s.id === sessionId);
        if (idx === -1) return;

        // If deleting active session, switch to another
        if (sessionId === AppState.activeSessionId) {
            // Try next, or prev
            const nextSession = AppState.sessions[idx + 1] || AppState.sessions[idx - 1];
            AppState.sessions.splice(idx, 1);
            if (nextSession) {
                switchSession(nextSession.id); // This will handle sync/render/save
            }
        } else {
            AppState.sessions.splice(idx, 1);
            renderSessionList();
            saveStateToKV();
        }
        showToast('Chat deleted', 'info');
    });
}

// Helper to ensure AppState.messages is saved into the correct session object
// This is needed because `AppState.messages = []` breaks the reference to the session's message array
// So we re-assign the current `AppState.messages` array back to the session object
export function syncCurrentSession() {
    if (!AppState.activeSessionId) return;
    const session = AppState.sessions.find(s => s.id === AppState.activeSessionId);
    if (session) {
        session.messages = AppState.messages;
        // Update timestamp/name based on last message?
        if (session.messages.length > 0) {
            // Update name snippet from first user message if name is default
            if (session.name === 'New Chat') {
                const firstUser = session.messages.find(m => m.role === 'user');
                if (firstUser) {
                     session.name = firstUser.content.substring(0, 20) + (firstUser.content.length > 20 ? '...' : '');
                }
            }
            session.timestamp = Date.now();
        } else {
            // Reset if empty
            session.name = 'New Chat';
            session.timestamp = Date.now();
        }
    }
}
