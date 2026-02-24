import { setMediaParam } from './media-lab.js';

export function setupMediaLabListeners() {
    const content = document.getElementById('media-lab-content');
    if (!content) return;

    // Use event delegation for buttons, select, and textarea
    content.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const btn = target.closest('button');
        if (btn && btn.dataset.param && btn.dataset.value) {
            setMediaParam(btn.dataset.param, btn.dataset.value);
        }
    });

    content.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLSelectElement;
        if (target.tagName === 'SELECT' && target.dataset.param) {
            setMediaParam(target.dataset.param, target.value);
        }
    });

    content.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        if (target.tagName === 'TEXTAREA' && target.dataset.param) {
            setMediaParam(target.dataset.param, target.value);
        }
    });
}
