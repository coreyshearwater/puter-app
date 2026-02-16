import { AppState } from '../state.js';
import { showToast } from '../utils/toast.js';
import { saveStateToKV } from './storage.js';

// Load files from path with resilient fallback
export async function loadFiles(path) {
    try {
        AppState.currentPath = path;
        saveStateToKV();
        
        const list = document.getElementById('file-list');
        if (!list) return;

        if (typeof puter === 'undefined' || !(await puter.auth.isSignedIn())) {
            list.innerHTML = `<div class="text-center p-4"><p class="text-sm text-gray-400">Sign in to access files</p></div>`;
            return;
        }
        
        list.innerHTML = '<div class="text-center p-4"><span class="loading loading-spinner text-cyan-400"></span></div>';
        
        // Render breadcrumbs first for visual feedback
        renderBreadcrumbs(path);
        
        const entries = await puter.fs.readdir(path);
        
        AppState.files = entries.sort((a, b) => {
            if (a.is_dir && !b.is_dir) return -1;
            if (!a.is_dir && b.is_dir) return 1;
            return a.name.localeCompare(b.name);
        });
        
        renderFileList();
        updateStorageMeter();
    } catch (error) {
        console.error(`Failed to load path: ${path}`, error);
        
        // Fallback or recovery
        if (path === '~/' || path === '~') {
            console.log('Falling back to root /');
            return loadFiles('/');
        }
        
        showToast('Path inaccessible', 'error');
        list.innerHTML = `<div class="text-center p-4 text-xs text-red-400">Error: ${error.message}</div>`;
    }
}

// Render current file list
function renderFileList() {
    const list = document.getElementById('file-list');
    if (!list) return;

    if (AppState.files.length === 0) {
        list.innerHTML = '<p class="text-sm text-gray-500 p-2">Empty directory</p>';
        return;
    }
    
    list.innerHTML = AppState.files.map(file => {
        const typeLabel = file.is_dir ? '[DIR]' : '[FILE]';
        const typeColor = file.is_dir ? 'text-yellow-400' : 'text-blue-400';
        return `
            <div class="glass-card p-2 flex items-center justify-between group">
                <div class="flex items-center gap-2 flex-1 cursor-pointer overflow-hidden" 
                     onclick="${file.is_dir ? `window.gravityChat.loadFiles('${file.path}')` : `window.gravityChat.previewFile('${file.path}')`}" 
                     ${file.is_dir ? '' : `title="Open: ${file.name}"`}>
                    <span class="${typeColor} text-[10px] font-mono">${typeLabel}</span>
                    <span class="text-sm truncate">${file.name}</span>
                </div>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    ${!file.is_dir ? `<button class="btn btn-ghost btn-xs text-blue-300" onclick="window.gravityChat.previewFile('${file.path}', true)" title="Attach to Chat">ATTACH</button>` : ''}
                    <button class="btn btn-ghost btn-xs text-red-400" onclick="window.gravityChat.deleteFile('${file.path}')">×</button>
                </div>
            </div>`;
    }).join('');
}

// Render breadcrumbs with clickable segments
function renderBreadcrumbs(path) {
    const container = document.getElementById('file-path');
    if (!container) return;

    // Handle home and root base cases
    const isHomeBase = path.startsWith('~/');
    const baseIcon = isHomeBase ? '~' : '/';
    const basePath = isHomeBase ? '~/' : '/';
    
    // Split path into parts, removing empty segments
    const parts = path.replace(/^~\//, '').split('/').filter(p => p);
    
    let currentBuildingPath = basePath;
    let html = `<ul><li><a href="#" class="hover:text-cyan-400" onclick="window.gravityChat.loadFiles('${basePath}')">${baseIcon}</a></li>`;
    
    parts.forEach((part, index) => {
        currentBuildingPath += (index === 0 && !isHomeBase ? '' : '/') + part;
        // Fix for multiple slashes
        const targetPath = currentBuildingPath.replace(/\/+/g, '/');
        
        html += `
            <li>
                <span class="mx-1 text-gray-500">/</span>
                <a href="#" class="hover:text-cyan-400 truncate max-w-[80px] inline-block align-bottom" 
                   onclick="window.gravityChat.loadFiles('${targetPath}')">${part}</a>
            </li>`;
    });
    
    html += '</ul>';
    container.innerHTML = html;
}

// File Operations (simplified for module export)
export async function createNewFile() {
    const name = prompt('File name:');
    if (!name || name.includes('/')) return;
    try {
        const fullPath = `${AppState.currentPath}/${name}`.replace(/\/+/g, '/');
        await puter.fs.write(fullPath, '');
        loadFiles(AppState.currentPath);
    } catch (e) { showToast('Failed to create file', 'error'); }
}

export async function createNewFolder() {
    const name = prompt('Folder name:');
    if (!name || name.includes('/')) return;
    try {
        const fullPath = `${AppState.currentPath}/${name}`.replace(/\/+/g, '/');
        await puter.fs.mkdir(fullPath);
        loadFiles(AppState.currentPath);
    } catch (e) { showToast('Failed to create folder', 'error'); }
}

export async function deleteFile(path) {
    if (!confirm('Delete this item?')) return;
    try {
        await puter.fs.delete(path);
        loadFiles(AppState.currentPath);
    } catch (e) { showToast('Delete failed', 'error'); }
}

export async function previewFile(path, attach = false) {
    try {
        const content = await puter.fs.read(path);
        if (typeof content !== 'string') return showToast('Binary files not supported', 'warning');
        
        if (attach) {
            const input = document.getElementById('user-input');
            input.value += `\n\n\`\`\`${path.split('/').pop()}\n${content}\n\`\`\`\n`;
            showToast('Attached file content', 'success');
        } else {
            // OS Mode: Use CreateWindow if available (typical in Puter Desktop)
            if (typeof puter !== 'undefined' && puter.ui && puter.ui.createWindow) {
                const fileName = path.split('/').pop();
                await puter.ui.createWindow({
                    title: `Editor - ${fileName}`,
                    width: 600,
                    height: 500,
                    html: `
                        <div style="background: #0a0a0f; color: #e4e4e7; height: 100%; display: flex; flex-direction: column; font-family: 'Inter', sans-serif;">
                            <div style="padding: 8px 15px; background: #12121a; border-bottom: 1px solid #ffffff10; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                                <span style="color: #71717a;">${path}</span>
                            </div>
                            <textarea id="editor" style="flex: 1; background: transparent; color: #e4e4e7; padding: 20px; border: none; resize: none; font-size: 13px; line-height: 1.6; outline: none; font-family: monospace;">${content}</textarea>
                            <div style="padding: 10px 15px; background: #12121a; border-top: 1px solid #ffffff10; text-align: right;">
                                <button id="save-btn" style="background: #00fff7; color: #000; border: none; padding: 6px 20px; border-radius: 4px; font-weight: 700; cursor: pointer; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Save Changes</button>
                            </div>
                        </div>
                        <script>
                            document.getElementById('save-btn').onclick = async () => {
                                try {
                                    const btn = document.getElementById('save-btn');
                                    btn.innerText = 'SAVING...';
                                    const newContent = document.getElementById('editor').value;
                                    await puter.fs.write('${path}', newContent);
                                    btn.innerText = 'SAVED!';
                                    setTimeout(() => btn.innerText = 'SAVE CHANGES', 2000);
                                } catch(e) { alert('Save failed: ' + e.message); }
                            };
                        </script>
                    `
                });
            } else {
                // Fallback for standalone browser
                alert(`File Content Preview:\n\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}`);
            }
        }
    } catch (e) { showToast('Read failed', 'error'); }
}

// Flag to prevent log spam if auth is stale
let isStorageMeterMuted = false;

export async function updateStorageMeter() {
    const container = document.getElementById('storage-meter-container');
    if (!container || isStorageMeterMuted) return;

    try {
        // Refresh session context
        if (typeof puter === 'undefined') return;
        
        // 1. Identity Check: Ensure session is alive and "fresh"
        const user = await puter.auth.getUser();
        if (!user) {
            container.innerHTML = `<p class="text-[10px] text-gray-500 italic">Sign in to view storage</p>`;
            return;
        }

        // 2. Space Check: Documentation Audit noted this is undocumented/restricted
        if (typeof puter.fs.space !== 'function') {
            container.classList.add('hidden'); // Hide if API doesn't exist
            return;
        }
        
        const space = await puter.fs.space();
        if (!space) throw new Error('No space data returned');

        const used = typeof space.used === 'number' ? space.used : 0;
        const total = typeof space.total === 'number' ? space.total : 1;
        
        if (total === 0) return;
        const percent = Math.round((used / total) * 100);
        const usedGb = (used / (1024 ** 3)).toFixed(2);
        const totalGb = (total / (1024 ** 3)).toFixed(2);

        container.innerHTML = `
            <div class="flex flex-col gap-1">
                <div class="flex justify-between text-[10px] text-gray-400">
                    <span>Cloud Storage: ${usedGb}GB / ${totalGb}GB</span>
                    <span>${percent}%</span>
                </div>
                <div class="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                    <div class="bg-gradient-to-r from-cyan-500 to-magenta-500 h-full" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    } catch (e) {
        if (e?.status === 401 || e?.message?.includes('Unauthorized')) {
            console.warn('Storage meter unauthorized (muting for this session).');
            container.innerHTML = `<p class="text-[10px] text-gray-500 italic">Storage restricted (Unauthorized)</p>`;
            isStorageMeterMuted = true;
            return;
        }
        console.warn('Storage meter update failed:', e);
        container.innerHTML = `<p class="text-[10px] text-gray-600 italic">Metrics unavailable</p>`;
    }
}

export async function selectDirectory() {
    try {
        const dir = await puter.ui.showDirectoryPicker();
        if (dir && dir.path) {
            loadFiles(dir.path);
            showToast(`Project folder set to: ${dir.path}`, 'success');
        }
    } catch (e) {
        // Fallback to prompt if picker fails or cancelled
        const path = prompt('Enter project folder path:', AppState.currentPath);
        if (path) loadFiles(path);
    }
}
