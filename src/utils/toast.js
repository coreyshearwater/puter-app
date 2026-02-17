export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    
    const styles = {
        success: { icon: '✓', border: '#00e6a0', bg: 'rgba(0, 230, 160, 0.12)' },
        error:   { icon: '✕', border: '#ff4466', bg: 'rgba(255, 68, 102, 0.12)' },
        warning: { icon: '⚠', border: '#ffaa00', bg: 'rgba(255, 170, 0, 0.12)' },
        info:    { icon: 'ℹ', border: '#00c8ff', bg: 'rgba(0, 200, 255, 0.12)' },
    };
    const s = styles[type] || styles.info;
    
    toast.className = 'fixed top-20 right-4 z-50 slide-in';
    toast.style.cssText = `
        background: ${s.bg};
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid ${s.border}44;
        border-left: 3px solid ${s.border};
        border-radius: 8px;
        padding: 10px 16px;
        max-width: 360px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 12px ${s.border}22;
        font-size: 13px;
        color: #e4e4e7;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    toast.innerHTML = `
        <span style="color:${s.border}; font-weight:700; font-size:14px; flex-shrink:0">${s.icon}</span>
        <span></span>
    `;
    toast.querySelector('span:last-child').textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
