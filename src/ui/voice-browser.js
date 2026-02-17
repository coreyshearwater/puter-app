import { AppState } from '../state.js';
import { saveStateToKV } from '../services/storage.js';
import { showToast } from '../utils/toast.js';

const EDGE_TTS_URL = 'http://127.0.0.1:8002';

// Expanded Polly voices with metadata
const POLLY_VOICES = [
    // US English
    { id: 'Joanna', name: 'Joanna', gender: 'Female', lang: 'en-US', accent: 'American' },
    { id: 'Matthew', name: 'Matthew', gender: 'Male', lang: 'en-US', accent: 'American' },
    { id: 'Salli', name: 'Salli', gender: 'Female', lang: 'en-US', accent: 'American' },
    { id: 'Joey', name: 'Joey', gender: 'Male', lang: 'en-US', accent: 'American' },
    { id: 'Kendra', name: 'Kendra', gender: 'Female', lang: 'en-US', accent: 'American' },
    { id: 'Kimberly', name: 'Kimberly', gender: 'Female', lang: 'en-US', accent: 'American' },
    { id: 'Ruth', name: 'Ruth', gender: 'Female', lang: 'en-US', accent: 'American' },
    { id: 'Stephen', name: 'Stephen', gender: 'Male', lang: 'en-US', accent: 'American' },
    { id: 'Gregory', name: 'Gregory', gender: 'Male', lang: 'en-US', accent: 'American' },
    { id: 'Danielle', name: 'Danielle', gender: 'Female', lang: 'en-US', accent: 'American' },
    { id: 'Ivy', name: 'Ivy', gender: 'Female', lang: 'en-US', accent: 'American (Child)' },
    { id: 'Justin', name: 'Justin', gender: 'Male', lang: 'en-US', accent: 'American (Child)' },
    { id: 'Kevin', name: 'Kevin', gender: 'Male', lang: 'en-US', accent: 'American (Child)' },
    // UK English
    { id: 'Amy', name: 'Amy', gender: 'Female', lang: 'en-GB', accent: 'British' },
    { id: 'Brian', name: 'Brian', gender: 'Male', lang: 'en-GB', accent: 'British' },
    { id: 'Emma', name: 'Emma', gender: 'Female', lang: 'en-GB', accent: 'British' },
    { id: 'Arthur', name: 'Arthur', gender: 'Male', lang: 'en-GB', accent: 'British' },
    // Australian
    { id: 'Olivia', name: 'Olivia', gender: 'Female', lang: 'en-AU', accent: 'Australian' },
    // Indian
    { id: 'Kajal', name: 'Kajal', gender: 'Female', lang: 'en-IN', accent: 'Indian' },
    // South African
    { id: 'Ayanda', name: 'Ayanda', gender: 'Female', lang: 'en-ZA', accent: 'South African' },
    // Other Languages
    { id: 'Léa', name: 'Léa', gender: 'Female', lang: 'fr-FR', accent: 'French' },
    { id: 'Rémi', name: 'Rémi', gender: 'Male', lang: 'fr-FR', accent: 'French' },
    { id: 'Vicki', name: 'Vicki', gender: 'Female', lang: 'de-DE', accent: 'German' },
    { id: 'Daniel', name: 'Daniel', gender: 'Male', lang: 'de-DE', accent: 'German' },
    { id: 'Lucia', name: 'Lucia', gender: 'Female', lang: 'es-ES', accent: 'Spanish' },
    { id: 'Sergio', name: 'Sergio', gender: 'Male', lang: 'es-ES', accent: 'Spanish' },
    { id: 'Lupe', name: 'Lupe', gender: 'Female', lang: 'es-MX', accent: 'Mexican' },
    { id: 'Bianca', name: 'Bianca', gender: 'Female', lang: 'it-IT', accent: 'Italian' },
    { id: 'Adriano', name: 'Adriano', gender: 'Male', lang: 'it-IT', accent: 'Italian' },
    { id: 'Camila', name: 'Camila', gender: 'Female', lang: 'pt-BR', accent: 'Brazilian' },
    { id: 'Suvi', name: 'Suvi', gender: 'Female', lang: 'fi-FI', accent: 'Finnish' },
    { id: 'Sofie', name: 'Sofie', gender: 'Female', lang: 'da-DK', accent: 'Danish' },
    { id: 'Elin', name: 'Elin', gender: 'Female', lang: 'sv-SE', accent: 'Swedish' },
    { id: 'Ida', name: 'Ida', gender: 'Female', lang: 'nb-NO', accent: 'Norwegian' },
    { id: 'Laura', name: 'Laura', gender: 'Female', lang: 'nl-NL', accent: 'Dutch' },
    { id: 'Ola', name: 'Ola', gender: 'Female', lang: 'pl-PL', accent: 'Polish' },
    { id: 'Seoyeon', name: 'Seoyeon', gender: 'Female', lang: 'ko-KR', accent: 'Korean' },
    { id: 'Kazuha', name: 'Kazuha', gender: 'Female', lang: 'ja-JP', accent: 'Japanese' },
    { id: 'Tomoko', name: 'Tomoko', gender: 'Female', lang: 'ja-JP', accent: 'Japanese' },
    { id: 'Zhiyu', name: 'Zhiyu', gender: 'Female', lang: 'cmn-CN', accent: 'Chinese' },
    { id: 'Hala', name: 'Hala', gender: 'Female', lang: 'ar-001', accent: 'Arabic' },
];

let edgeVoicesCache = null;
let previewAudio = null;

async function fetchEdgeVoices() {
    if (edgeVoicesCache) return edgeVoicesCache;
    try {
        const res = await fetch(`${EDGE_TTS_URL}/voices`);
        if (!res.ok) throw new Error('Bridge not available');
        const raw = await res.json();
        edgeVoicesCache = raw.map(v => ({
            id: `edge:${v.ShortName}`,
            name: v.ShortName.split('-').slice(2).join(' ').replace('Neural', '').trim(),
            gender: v.Gender,
            lang: v.Locale,
            accent: v.Locale,
        }));
        return edgeVoicesCache;
    } catch {
        return null;
    }
}

function getNativeVoices() {
    if (!window.speechSynthesis) return [];
    return window.speechSynthesis.getVoices().map(v => ({
        id: `native:${v.name}`,
        name: v.name,
        gender: v.name.includes('Zira') || v.name.includes('Helena') || v.name.includes('Hazel') ? 'Female' : 'Male',
        lang: v.lang,
        accent: v.lang,
    }));
}

async function previewVoice(voiceId) {
    stopPreview();
    const sample = 'Hello! This is a preview of my voice. How does it sound?';

    try {
        if (voiceId.startsWith('edge:')) {
            const edgeId = voiceId.substring(5);
            const res = await fetch(`${EDGE_TTS_URL}/speak`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: sample, voice: edgeId }),
            });
            if (!res.ok) throw new Error('Edge TTS failed');
            const blob = await res.blob();
            previewAudio = new Audio(URL.createObjectURL(blob));
            previewAudio.play();
        } else if (voiceId.startsWith('native:')) {
            const name = voiceId.substring(7);
            const utterance = new SpeechSynthesisUtterance(sample);
            const voice = window.speechSynthesis.getVoices().find(v => v.name === name);
            if (voice) utterance.voice = voice;
            window.speechSynthesis.speak(utterance);
        } else {
            // Polly via Puter
            previewAudio = await puter.ai.txt2speech(sample, { voice: voiceId });
            previewAudio.play();
        }
    } catch (err) {
        console.error('Preview failed:', err);
        showToast('Voice preview failed', 'error');
    }
}

function stopPreview() {
    if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

let previousVoice = null; // For cancel/revert

function selectVoice(voiceId, displayName) {
    AppState.selectedVoice = voiceId;
    saveStateToKV();
    
    // Update settings display
    const display = document.getElementById('current-voice-display');
    if (display) display.textContent = displayName;
    
    // Update hidden selector
    const sel = document.getElementById('voice-selector');
    if (sel) sel.value = voiceId;
    
    renderVoiceList();
}

// State
let activeTab = 'edge';
let searchQuery = '';
let langFilter = '';

function renderVoiceList() {
    const list = document.getElementById('vb-voice-list');
    if (!list) return;

    let voices = [];
    if (activeTab === 'edge') {
        voices = edgeVoicesCache || [];
    } else if (activeTab === 'polly') {
        voices = POLLY_VOICES;
    } else {
        voices = getNativeVoices();
    }

    // Filters
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        voices = voices.filter(v => (v.name + v.accent + v.lang + v.gender).toLowerCase().includes(q));
    }
    if (langFilter) {
        voices = voices.filter(v => v.lang.startsWith(langFilter));
    }

    if (voices.length === 0) {
        if (activeTab === 'edge' && !edgeVoicesCache) {
            list.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <div class="text-2xl mb-2">🔇</div>
                    <div class="text-sm font-semibold mb-1">Edge TTS Bridge Not Running</div>
                    <div class="text-xs text-gray-500">Start it with: <code class="text-cyan-400">python edge_tts_server.py</code></div>
                    <div class="text-xs text-gray-500 mt-1">First install: <code class="text-cyan-400">pip install edge-tts</code></div>
                </div>`;
        } else {
            list.innerHTML = '<div class="text-center py-8 text-gray-500 text-sm">No voices found</div>';
        }
        return;
    }

    // Build unique languages for filter
    const langs = [...new Set(voices.map(v => v.lang.split('-')[0]))].sort();
    const filterBar = document.getElementById('vb-lang-filter');
    if (filterBar) {
        filterBar.innerHTML = `<option value="">All Languages</option>` +
            langs.map(l => `<option value="${l}" ${langFilter === l ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('');
    }

    list.innerHTML = voices.map(v => {
        const isSelected = AppState.selectedVoice === v.id;
        const genderIcon = v.gender === 'Female' ? '♀' : '♂';
        const genderColor = v.gender === 'Female' ? 'text-pink-400' : 'text-blue-400';
        return `
            <div class="vb-voice-card ${isSelected ? 'vb-selected' : ''}" data-id="${v.id}">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="text-sm ${genderColor}">${genderIcon}</span>
                    <div class="min-w-0 flex-1">
                        <div class="text-xs font-semibold truncate">${v.name}</div>
                        <div class="text-[10px] text-gray-500">${v.accent || v.lang}</div>
                    </div>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">${v.lang}</span>
                    <button class="vb-btn-preview" onclick="event.stopPropagation(); window._vbPreview('${v.id}')" title="Preview">
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    ${isSelected ? '<span class="text-emerald-400 text-sm">✓</span>' : ''}
                </div>
            </div>`;
    }).join('');

    // Attach click-to-select
    list.querySelectorAll('.vb-voice-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const name = card.querySelector('.text-xs.font-semibold')?.textContent || id;
            selectVoice(id, name);
        });
    });

    // Show count
    const countEl = document.getElementById('vb-count');
    if (countEl) countEl.textContent = `${voices.length} voices`;
}

export async function openVoiceBrowser() {
    previousVoice = AppState.selectedVoice; // Save for cancel
    const edgePromise = fetchEdgeVoices();

    const existing = document.getElementById('voice-browser-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'voice-browser-modal';
    modal.className = 'fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md';
    modal.onclick = (e) => { if (e.target === modal) closeVoiceBrowser(); };

    modal.innerHTML = `
        <div class="glass-card w-full max-w-xl slide-in relative" onclick="event.stopPropagation()" style="max-height: 80vh; display: flex; flex-direction: column;">
            <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-fuchsia-500/5 pointer-events-none rounded-xl"></div>
            
            <!-- Header -->
            <div class="flex justify-between items-center p-6 pb-4 relative z-10">
                <div>
                    <h3 class="text-xl font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">🎤 VOICE BROWSER</h3>
                    <span id="vb-count" class="text-[10px] text-gray-500"></span>
                </div>
                <button onclick="window._vbClose()" class="p-2 text-gray-400 hover:text-white transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            
            <!-- Tabs -->
            <div class="flex gap-1 px-6 relative z-10">
                <button class="vb-tab active" data-tab="edge">🌐 Edge TTS</button>
                <button class="vb-tab" data-tab="polly">☁️ Cloud (Puter)</button>
                <button class="vb-tab" data-tab="native">💻 Device</button>
            </div>
            
            <!-- Search + Filter -->
            <div class="flex gap-2 px-6 pt-3 relative z-10">
                <input id="vb-search" type="text" placeholder="Search voices..." class="flex-1 input input-sm bg-black/30 border-white/10 text-xs focus:border-cyan-400" />
                <select id="vb-lang-filter" class="select select-sm bg-black/30 border-white/10 text-xs w-24"></select>
            </div>
            
            <!-- Voice List -->
            <div id="vb-voice-list" class="flex-1 overflow-y-auto px-6 py-3 space-y-1 relative z-10" style="min-height: 200px;">
                <div class="text-center py-8 text-gray-500 text-sm">Loading voices...</div>
            </div>
            
            <!-- Footer -->
            <div class="flex justify-end gap-2 px-6 py-4 border-t border-white/5 relative z-10">
                <button id="vb-cancel" class="btn btn-sm btn-ghost text-gray-400 hover:text-white text-xs">Cancel</button>
                <button id="vb-confirm" class="btn btn-sm bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 text-xs">✓ Confirm</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Wire globals
    window._vbPreview = previewVoice;
    window._vbClose = closeVoiceBrowser;

    // Wire tabs
    modal.querySelectorAll('.vb-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            modal.querySelectorAll('.vb-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.dataset.tab;
            langFilter = '';
            renderVoiceList();
        });
    });

    // Wire search
    const searchEl = document.getElementById('vb-search');
    searchEl.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderVoiceList();
    });

    // Wire lang filter
    document.getElementById('vb-lang-filter').addEventListener('change', (e) => {
        langFilter = e.target.value;
        renderVoiceList();
    });

    // Wire footer buttons
    document.getElementById('vb-cancel').addEventListener('click', () => {
        // Revert to previous voice
        if (previousVoice) {
            AppState.selectedVoice = previousVoice;
            saveStateToKV();
            const display = document.getElementById('current-voice-display');
            if (display) display.textContent = previousVoice;
        }
        closeVoiceBrowser();
    });
    document.getElementById('vb-confirm').addEventListener('click', () => {
        showToast(`Voice: ${AppState.selectedVoice}`, 'success');
        closeVoiceBrowser();
    });

    // Load Edge voices
    await edgePromise;
    renderVoiceList();
}

export function closeVoiceBrowser() {
    stopPreview();
    const modal = document.getElementById('voice-browser-modal');
    if (modal) modal.remove();
}
