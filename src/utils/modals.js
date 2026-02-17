export function showErrorModal(title, message) {
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 slide-in';
    backdrop.id = 'error-modal-backdrop';

    // Modal Content
    const modal = document.createElement('div');
    modal.className = 'glass-card max-w-md w-full p-6 shadow-2xl border-magenta-500/30 slide-in';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 20, 30, 0.9) 0%, rgba(10, 10, 15, 0.95) 100%)';

    modal.innerHTML = `
        <div class="flex items-start justify-between mb-4">
            <h3 class="text-xl font-bold text-magenta-400 tracking-tight">${title}</h3>
            <button class="btn btn-sm btn-ghost btn-square text-gray-500 hover:text-white" id="close-modal-x">×</button>
        </div>
        <div class="text-gray-300 text-sm leading-relaxed mb-6">
            ${message}
        </div>
        <div class="flex justify-end gap-3">
            <button class="btn btn-sm px-6 btn-outline border-gray-600 text-gray-400 hover:bg-gray-800" id="close-modal-btn">Dismiss</button>
            <button class="btn btn-sm px-6 btn-neon" id="retry-modal-btn" style="display: none;">Retry</button>
        </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const closeHandler = () => {
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.2s ease';
        setTimeout(() => backdrop.remove(), 200);
    };

    backdrop.querySelector('#close-modal-x').onclick = closeHandler;
    backdrop.querySelector('#close-modal-btn').onclick = closeHandler;
    
    // Close on backdrop click
    backdrop.onclick = (e) => {
        if (e.target === backdrop) closeHandler();
    };

    return { close: closeHandler };
}

export function showCustomPersonaModal(existingName, existingPrompt, onSave) {
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 slide-in';
    backdrop.id = 'custom-persona-modal';

    // Modal Content
    const modal = document.createElement('div');
    modal.className = 'glass-card max-w-lg w-full p-6 shadow-2xl border-cyan-500/30 slide-in';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)';

    modal.innerHTML = `
        <div class="flex items-start justify-between mb-4">
            <h3 class="text-xl font-bold bg-gradient-to-r from-cyan-400 to-magenta-400 bg-clip-text text-transparent tracking-tight">Custom Persona</h3>
            <button class="btn btn-sm btn-ghost btn-square text-gray-500 hover:text-white" id="close-cp-x">×</button>
        </div>
        
        <div class="space-y-4 mb-6">
            <div>
                <label class="text-xs text-gray-500 uppercase font-bold tracking-wider">Persona Name</label>
                <input type="text" id="cp-name" class="w-full mt-1 bg-black/20 border border-white/10 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none" placeholder="e.g. Rate My Code" value="${existingName || ''}">
            </div>
            
            <div>
                <label class="text-xs text-gray-500 uppercase font-bold tracking-wider">System Prompt</label>
                <textarea id="cp-prompt" class="w-full mt-1 bg-black/20 border border-white/10 rounded p-2 text-sm text-gray-300 focus:border-cyan-500 outline-none h-32 resize-none" placeholder="You are a strict code reviewer...">${existingPrompt || ''}</textarea>
            </div>
        </div>

        <div class="flex justify-end gap-3">
            <button class="btn btn-sm px-6 btn-outline border-gray-600 text-gray-400 hover:bg-gray-800" id="close-cp-btn">Cancel</button>
            <button class="btn btn-sm px-6 btn-neon" id="save-cp-btn">Save Persona</button>
        </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const closeHandler = () => {
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.2s ease';
        setTimeout(() => backdrop.remove(), 200);
    };

    const saveHandler = () => {
        const name = document.getElementById('cp-name').value.trim() || 'Custom';
        const prompt = document.getElementById('cp-prompt').value.trim();
        if (!prompt) {
            showToast('System prompt is required', 'error');
            return;
        }
        onSave(name, prompt);
        closeHandler();
    };

    backdrop.querySelector('#close-cp-x').onclick = closeHandler;
    backdrop.querySelector('#close-cp-btn').onclick = closeHandler;
    backdrop.querySelector('#save-cp-btn').onclick = saveHandler;
    
    // Close on backdrop click
    backdrop.onclick = (e) => {
        if (e.target === backdrop) closeHandler();
    };

    return { close: closeHandler };
}

export function showConfirmModal(title, message, onConfirm) {
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 slide-in';
    
    const modal = document.createElement('div');
    modal.className = 'glass-card max-w-sm w-full p-6 shadow-2xl border-orange-500/30 slide-in';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)';

    modal.innerHTML = `
        <div class="mb-4">
            <h3 class="text-xl font-bold text-orange-400 tracking-tight">${title}</h3>
        </div>
        <div class="text-gray-300 text-sm leading-relaxed mb-6">
            ${message}
        </div>
        <div class="flex justify-end gap-3">
            <button class="btn btn-sm px-6 btn-outline border-gray-600 text-gray-400 hover:bg-gray-800" id="confirm-cancel">Cancel</button>
            <button class="btn btn-sm px-6 bg-orange-600 hover:bg-orange-500 text-white border-none" id="confirm-ok">Delete</button>
        </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const closeHandler = () => {
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.2s ease';
        setTimeout(() => backdrop.remove(), 200);
    };

    backdrop.querySelector('#confirm-cancel').onclick = closeHandler;
    backdrop.querySelector('#confirm-ok').onclick = () => {
        onConfirm();
        closeHandler();
    };

    backdrop.onclick = (e) => {
        if (e.target === backdrop) closeHandler();
    };
}


