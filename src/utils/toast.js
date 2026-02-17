export function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} shadow-lg fixed bottom-4 right-4 w-auto max-w-sm z-50 slide-in glass-card`;
    
    const icons = {
        success: '',
        error: '',
        warning: '',
        info: ''
    };
    
    toast.innerHTML = `
        <div>
            <span id="toast-msg"></span>
        </div>
    `;
    toast.querySelector('#toast-msg').textContent = `${icons[type] || ''} ${message}`;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
