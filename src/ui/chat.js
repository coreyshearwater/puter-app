import { AppState } from '../state.js';
import { renderMarkdown } from '../utils/markdown.js';
import { scrollToBottom } from '../utils/dom.js';

export function renderMessage(message) {
    const container = document.getElementById('messages-container');
    if (!container) return;

    // Hidden messages (e.g., Oracular system commands) should not be rendered
    if (message.hidden) return;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble message-${message.role} slide-in`;
    
    let html = message.role === 'user' ? message.content : renderMarkdown(message.content);

    if (message.attachments?.length > 0) {
        html += '<div class="mt-2 flex flex-wrap gap-2 pt-2 border-t border-black/10">';
        message.attachments.forEach(att => {
            const label = att.type.startsWith('image/') ? '[IMG]' : '[FILE]';
            html += `<div class="text-[10px] bg-black/5 px-2 py-1 rounded-md border border-black/5 flex items-center gap-1"><span class="opacity-50">${label}</span> ${att.name}</div>`;
        });
        html += '</div>';
    }
    
    bubble.innerHTML = html;
    container.appendChild(bubble);
    scrollToBottom('chat-area');
}

export function createAIMessageElement() {
    const container = document.getElementById('messages-container');
    if (!container) return null;

    if (container.children.length > 50) {
        container.removeChild(container.firstChild);
        console.log('💬 DOM limit: oldest message bubble pruned (>50 visible)');
    }
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble message-ai slide-in';
    bubble.innerHTML = '<span class="streaming-cursor"></span>';
    
    container.appendChild(bubble);
    scrollToBottom('chat-area');
    return bubble;
}

export async function clearChat() {
    const { showConfirmModal } = await import('../utils/modals.js');
    const { syncCurrentSession } = await import('./sidebar/sessions.js');
    
    showConfirmModal(
        'Clear Chat History', 
        'This will wipe all messages from the current workspace. This action cannot be undone.', 
        () => {
            AppState.messages = [];
            const container = document.getElementById('messages-container');
            if (container) container.innerHTML = '';
            syncCurrentSession();
        }
    );
}

export function exportChat() {
    if (AppState.messages.length === 0) return;
    let md = `# Export - ${new Date().toLocaleString()}\n\n`;
    AppState.messages.forEach(m => {
        if (m.hidden) return; // Skip hidden messages
        md += `${m.role === 'user' ? '👤 **User**' : '🤖 **AI**'}:\n${m.content}\n\n---\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
}
