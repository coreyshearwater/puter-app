import { executeInSandbox } from '../services/sandbox.js';

export async function runCodeBlock(btn: HTMLButtonElement, lang: string) {
    const pre = btn.closest('pre');
    if (!pre) return;
    const codeElement = pre.querySelector('code');
    if (!codeElement) return;
    
    const code = codeElement.innerText;
    btn.disabled = true;
    btn.innerText = '⌛...';
    
    const result = await executeInSandbox(code, lang);
    btn.disabled = false;
    btn.innerText = '▶ RUN';
    
    if (result) {
        // Remove existing result if any
        const existing = pre.nextElementSibling;
        if (existing && existing.classList.contains('sandbox-output')) {
            existing.remove();
        }
        
        const outputDiv = document.createElement('div');
        outputDiv.className = 'sandbox-output glass-card p-3 mt-2 text-xs font-mono slide-in';
        outputDiv.style.borderLeft = result.exitCode === 0 ? '4px solid var(--neon-green)' : '4px solid var(--neon-orange)';
        
        const contentDiv = document.createElement('div');
        if (result.stdout) {
            const out = document.createElement('div');
            out.className = 'text-gray-300';
            out.innerText = result.stdout;
            contentDiv.appendChild(out);
        }
        if (result.stderr) {
            const err = document.createElement('div');
            err.className = 'text-red-400 mt-1';
            err.innerText = result.stderr;
            contentDiv.appendChild(err);
        }
        if (!result.stdout && !result.stderr) {
            const empty = document.createElement('div');
            empty.className = 'text-gray-500 italic';
            empty.innerText = `Program exited with code ${result.exitCode} (no output)`;
            contentDiv.appendChild(empty);
        }
        
        outputDiv.innerHTML = `
            <div class="flex justify-between mb-1">
                <span class="text-[8px] uppercase tracking-widest text-gray-500">Output (\${lang})</span>
                <button class="text-gray-500 hover:text-white" onclick="this.closest('.sandbox-output').remove()">×</button>
            </div>
        `;
        outputDiv.appendChild(contentDiv);
        pre.after(outputDiv);
    }
}
