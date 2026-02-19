
export const ModelsUI = {
    renderLocalModelManager(container, online, loadedModel, localModels, activeTab) {
        const profile = { vram: 4 }; // Default for now, could be passed in

        // Header: Status & VRAM
        let html = `
            <div class="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <!-- Hardware Stats -->
                ${this.renderHardwareStats(online, loadedModel, profile)}
                
                <!-- Connection Error -->
                ${!online ? this.renderOfflineMessage() : ''}

                <!-- Loaded Model Card -->
                ${loadedModel ? this.renderLoadedModelCard(loadedModel) : ''}

                <!-- Tabs -->
                ${this.renderTabs(activeTab)}
                
                <!-- Tab Content -->
                <div id="local-tab-content">
                    ${this.renderTabContent(activeTab, localModels, loadedModel)}
                </div>
            </div>
        `;
        return html;
    },

    renderHardwareStats(online, loadedModel, profile) {
        return `
            <div class="glass-card p-3 bg-black/40 border-white/5 relative overflow-hidden group">
                <div class="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                         <div id="local-status-dot" class="w-2 h-2 rounded-full ${online ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] ring-2 ring-emerald-500/20' : 'bg-red-500'} animate-pulse"></div>
                         <span class="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                            ${online ? 'ENGINE ACTIVE' : 'ENGINE OFFLINE'}
                         </span>
                    </div>
                    <span class="text-[9px] font-mono text-gray-500">VRAM: ${profile.vram}GB</span>
                </div>

                <!-- VRAM Visual -->
                <div class="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden flex">
                    <div class="h-full bg-emerald-500" style="width: ${loadedModel ? '70%' : '5%'}; transition: width 0.5s ease;"></div>
                </div>
                <div class="flex justify-between mt-1 text-[8px] text-gray-500 font-mono">
                    <span>IDLE</span>
                    <span>${loadedModel ? 'LOADED (~3.2GB)' : '0GB'}</span>
                    <span>MAX</span>
                </div>
                
                ${!online ? `
                <div class="mt-2 text-center">
                    <button onclick="window.gravityChat.retryConnection()" class="btn btn-xs btn-error btn-outline border-red-500/50 text-red-400 hover:bg-red-500/10">
                        Retry Connection
                    </button>
                </div>` : ''}
            </div>
        `;
    },

    renderOfflineMessage() {
        return `
            <div class="text-xs text-red-400 text-center bg-red-500/10 p-2 rounded border border-red-500/20 mb-2">
                Backend offline. Run <code>start.bat</code> to enable model running.
            </div>
        `;
    },

    renderLoadedModelCard(loadedModel) {
        return `
            <div class="glass-card p-3 border-emerald-500/30 bg-emerald-500/5 relative">
                 <div class="flex justify-between items-start">
                    <div>
                        <div class="text-[10px] text-emerald-400 uppercase tracking-wider font-bold mb-0.5">RUNNING NOW</div>
                        <div class="text-xs text-white font-mono truncate w-40" title="${loadedModel}">${loadedModel}</div>
                    </div>
                    <button onclick="window.gravityChat.unloadLocalModel()" class="btn btn-xs btn-outline border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500">
                        UNLOAD
                    </button>
                 </div>
            </div>
        `;
    },

    renderTabs(activeTab) {
        return `
            <div class="flex gap-1 border-b border-white/10 pb-1">
                <button onclick="window.gravityChat.setLocalTab('files')" class="flex-1 text-[10px] font-bold py-1 hover:text-cyan-400 transition ${(!activeTab || activeTab === 'files') ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500'}">MY MODELS</button>
                <button onclick="window.gravityChat.setLocalTab('search')" 
                    onmouseenter="window.gravityChat.showHFTooltip(event)"
                    onmouseleave="window.gravityChat.hideModelTooltip()"
                    class="flex-1 text-[10px] font-bold py-1 hover:text-fuchsia-400 transition ${activeTab === 'search' ? 'text-fuchsia-400 border-b-2 border-fuchsia-400' : 'text-gray-500'}">
                    DOWNLOAD (HF)
                </button>
            </div>
        `;
    },

    renderTabContent(activeTab, localModels, loadedModel) {
        if (!activeTab || activeTab === 'files') {
            return this.renderFileList(localModels, loadedModel);
        } else {
            return this.renderSearchUI();
        }
    },

    renderFileList(localModels, loadedModel) {
        if (localModels.length === 0) {
            return `
                <div class="py-8 text-center space-y-3 opacity-60">
                    <svg class="w-8 h-8 mx-auto text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                    <p class="text-xs text-gray-500">No GGUF models found</p>
                    <button onclick="window.gravityChat.openLocalFolder()" class="btn btn-xs btn-ghost text-cyan-400">Open Folder</button>
                </div>
            `;
        }

        let html = '';
        
        // Recommendation
        const recommended = localModels.find(m => m.id.includes('Phi-3') || m.id.includes('Qwen') || m.meta?.size_mb < 3500);
        if (recommended && !loadedModel) {
             html += `
                <div class="p-2 bg-gradient-to-r from-cyan-500/10 to-transparent border-l-2 border-cyan-500 mb-2">
                    <div class="text-[9px] text-cyan-300 font-bold mb-1">✨ RECOMMENDED FOR YOUR GPU</div>
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-gray-300 truncate">${recommended.id}</span>
                        <button onclick="window.gravityChat.loadLocalModel('${recommended.id}')" class="text-[10px] text-cyan-400 hover:text-cyan-300 underline">LOAD</button>
                    </div>
                </div>
             `;
        }

        // List
        html += `<div class="space-y-1.5 mt-2 custom-scrollbar overflow-y-auto max-h-[300px]">`;
        for (const m of localModels) {
            const isActive = m.id === loadedModel;
            const sizeGB = (m.meta.size_mb / 1024).toFixed(1);
            const sizeColor = parseFloat(sizeGB) > 5 ? 'text-red-400' : parseFloat(sizeGB) > 3.5 ? 'text-amber-400' : 'text-emerald-400';

            html += `
                <div class="group relative glass-card p-2 flex items-center justify-between hover:bg-white/5 transition border-white/5 hover:border-white/10 ${isActive ? 'ring-1 ring-emerald-500/50 bg-emerald-500/5' : ''}">
                    <div class="min-w-0 flex-1 pr-2">
                        <div class="text-[11px] font-semibold text-gray-200 truncate" title="${m.id}">${m.id}</div> 
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-[9px] font-mono ${sizeColor}">${sizeGB} GB</span>
                            <span class="text-[8px] text-gray-600 uppercase tracking-wider">Q4_K_M</span>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-1">
                        ${isActive ? 
                            `<span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">ACTIVE</span>` :
                            `<button onclick="window.gravityChat.loadLocalModel('${m.id}')" class="btn btn-xs btn-ghost text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">LOAD</button>`
                        }
                        <button onclick="window.gravityChat.confirmDeleteModel('${m.id}')" 
                            class="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition ml-1"
                            title="Delete File">
                            ×
                        </button>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
        return html;
    },

    renderSearchUI(lastQuery = '') {
        // AppState access via closure or passed param would be better, but assuming global for now or we rely on controller passing it.
        // Actually, we can read DOM if re-rendering, or just default empty.
        // Let's rely on the controller re-rendering with state, but this function signature doesn't take state.
        // We'll stick to basic structure.
        
        return `
            <div class="mt-2 space-y-2">
                <div class="flex gap-2">
                    <input type="text" id="hf-search-input" value="${lastQuery}" 
                           class="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-fuchsia-500 outline-none" 
                           placeholder="Search HuggingFace..." onkeydown="if(event.key === 'Enter') window.gravityChat.performHFSearch()">
                    <button onclick="window.gravityChat.performHFSearch()" class="btn btn-xs btn-square btn-ghost border border-white/10">🔍</button>
                </div>
                
                <!-- Filters -->
                <div class="flex gap-2 px-1">
                    <select id="hf-filter-quant" onchange="window.gravityChat.performHFSearch()" class="bg-black/20 text-[10px] text-gray-400 border border-white/5 rounded px-1 py-0.5 outline-none hover:border-white/20">
                        <option value="all">Any Quant</option>
                        <option value="q4_k_m">Q4_K_M (Recommended)</option>
                        <option value="q5_k_m">Q5_K_M</option>
                        <option value="q8_0">Q8_0 (High Quality)</option>
                    </select>
                    
                    <select id="hf-filter-size" onchange="window.gravityChat.performHFSearch()" class="bg-black/20 text-[10px] text-gray-400 border border-white/5 rounded px-1 py-0.5 outline-none hover:border-white/20">
                        <option value="all">Any Size</option>
                        <option value="small">&lt; 4GB</option>
                        <option value="medium">4-8GB</option>
                        <option value="large">&gt; 8GB</option>
                    </select>
                </div>
                
                <div id="hf-results" class="space-y-1.5 overflow-y-auto max-h-[300px] min-h-[100px] relative">
                    <div class="text-center pt-8 text-gray-600 text-[10px] animate-pulse">
                         Use search to find free GGUF models...
                    </div>
                </div>
            </div>`;
    },

    renderHFResults(results) {
        if (!results || results.length === 0) {
            return `<div class="text-xs text-gray-500 text-center py-4">No results found.</div>`;
        }
        
        return results.map(m => {
            const dateStr = m.last_modified ? new Date(m.last_modified).toLocaleDateString() : 'Unknown';
            const pipeline = m.pipeline_tag || 'text-generation';
            
            return `
            <div class="glass-card p-2 flex items-center justify-between hover:bg-white/5 border-white/5 group relative"
                 onmouseenter="window.gravityChat.showModelTooltip(event, '${m.id}')"
                 onmouseleave="window.gravityChat.hideModelTooltip()">
                 <div class="min-w-0 flex-1 pr-2">
                     <div class="text-[10px] font-bold text-gray-200 truncate">${m.id}</div>
                     <div class="text-[8px] text-gray-500 flex gap-2">
                         <span>⬇ ${this.formatNumber(m.downloads)}</span>
                         <span>❤ ${this.formatNumber(m.likes)}</span>
                         <span>${m.siblings_count || '?'} files</span>
                     </div>
                 </div>
                 <button onclick="window.gravityChat.downloadModel('${m.id}', '${m.id.split('/').pop()}.gguf')" 
                    class="btn btn-xs btn-outline border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/10 z-10 relative">
                    GET
                 </button>
            </div>
        `}).join('');
    },

    formatNumber(num) {
        if (!num) return '0';
        return new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(num);
    },

    renderCloudModelList(models) {
        return models.map(model => this.renderCloudModelItem(model)).join('');
    },

    renderCloudModelItem(model) {
        // Helper to get quality (duplicated logic, ideally shared)
        const getQuality = (id) => {
            if(id.includes('gpt-4') || id.includes('claude-3-5') || id.includes('deepseek-r1')) return 'S';
            if(id.includes('llama-3.1-70b') || id.includes('qwen-2.5')) return 'A';
            if(id.includes('7b') || id.includes('mini')) return 'B';
            return 'C';
        };

        const isFree = model.id.endsWith(':free') || (model.cost?.input === 0);
        // We can't easily check 'isSelected' without passing app state, 
        // but we can add conditional class via JS in controller or just render generic item.
        // Let's assume controller handles selection state or we pass it? 
        // For now, render item and let controller highlight via DOM update or re-render.
        
        const tier = getQuality(model.id);
        const tierColor = { S: 'text-emerald-400 bg-emerald-500/15', A: 'text-cyan-400 bg-cyan-500/15', B: 'text-amber-400 bg-amber-500/15', C: 'text-gray-400 bg-gray-500/15' }[tier];

        return `
            <div class="model-item glass-card p-2 cursor-pointer hover:bg-opacity-20 transition" 
                 onclick="window.gravityChat.selectModel('${model.id}')" data-id="${model.id}"
                 onmouseenter="window.gravityChat.showModelTooltip(event, '${model.id}', true)"
                 onmouseleave="window.gravityChat.hideModelTooltip()">
                <div class="flex justify-between items-start gap-1 overflow-hidden">
                    <div class="flex-1 min-w-0">
                        <div class="text-xs font-semibold truncate">${model.name || model.id}</div>
                        <div class="text-[9px] text-gray-500 font-mono truncate opacity-70">${model.id}</div>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <span class="text-[8px] px-1 rounded font-bold ${tierColor}" title="Quality tier">${tier}</span>
                        <span class="text-[8px] px-1 rounded ${isFree ? 'bg-cyan-500/20 text-cyan-400' : 'bg-orange-500/20 text-orange-400'}">${isFree ? 'FREE' : 'PAID'}</span>
                    </div>
                </div>
            </div>`;
    }
};
