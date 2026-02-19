
export function scrollToBottom(elementId: string) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollTop = element.scrollHeight;
    }
}

export function updateElementContent(id: string, content: string) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = content;
}

export function updateElementText(id: string, text: string) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

export function toggleHidden(id: string, force?: boolean) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', force);
}
