export function scrollToBottom(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollTop = element.scrollHeight;
    }
}

export function updateElementContent(id, content) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = content;
}

export function updateElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

export function toggleHidden(id, force) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', force);
}
