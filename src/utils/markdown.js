// Render markdown with optional delayed highlighting
export function renderMarkdown(text, skipHighlight = false) {
    if (!text) return '';
    
    // Use marked.js (expected to be loaded via script tag globally or imported if we had a bundler)
    // Since we are vanilla, we assume 'marked' and 'DOMPurify' and 'hljs' are global.
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
        return text;
    }

    const rawHtml = marked.parse(text);
    
    // Sanitize HTML (XSS Protection)
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    
    // If skipping highlight (during streaming), just return sanitized HTML
    if (skipHighlight || typeof hljs === 'undefined') {
        return cleanHtml;
    }

    // Apply syntax highlighting and inject RUN buttons
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanHtml;
    
    tempDiv.querySelectorAll('pre').forEach((pre) => {
        const codeElement = pre.querySelector('code');
        if (!codeElement) return;

        // Syntax highlighting
        try { hljs.highlightElement(codeElement); } catch (e) {}

        // Execution button injection
        const langClass = Array.from(codeElement.classList).find(c => c.startsWith('language-'));
        if (langClass) {
            const lang = langClass.replace('language-', '').toLowerCase();
            const isExecutable = ['python', 'javascript', 'js', 'py'].includes(lang);
            
            if (isExecutable) {
                pre.style.position = 'relative';
                // Add execution button (using a data attribute for delegation or global access)
                const codeText = codeElement.innerText.replace(/'/g, "\\'");
                const btnHtml = `<button class="btn btn-xs btn-primary btn-run-code" 
                                   style="position: absolute; top: 0.5rem; right: 0.5rem; font-size: 8px; height: 1.5rem; min-height: 1.5rem;"
                                   onclick="window.gravityChat.runCodeBlock(this, '${lang}')">▶ RUN</button>`;
                pre.insertAdjacentHTML('beforeend', btnHtml);
            }
        }
    });
    
    return tempDiv.innerHTML;
}
