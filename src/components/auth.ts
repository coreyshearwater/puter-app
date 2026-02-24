import { showToast } from '../utils/toast.js';
import { Logger } from '../utils/logger.js';

export function showAuthOverlay() {
    // Create overlay if it doesn't exist
    let overlay = document.getElementById('auth-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0a0f] text-white p-6';
        overlay.innerHTML = `
            <div class="glass-card max-w-md w-full p-8 text-center space-y-6 slide-in border-cyan-500/30">
                <div class="space-y-2">
                    <h1 class="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-magenta-400 bg-clip-text text-transparent">All Seeing Cat</h1>
                    <p class="text-gray-400">Authentication Required</p>
                </div>
                <div class="p-4 bg-cyan-500/5 rounded-lg border border-cyan-500/10 text-sm text-gray-300">
                    All Seeing Cat uses Puter.js for secure storage and AI access. Sign in to continue your session.
                </div>
                <button id="btn-auth-signin" class="btn btn-neon w-full h-14 text-lg">Sign In with Puter</button>
                <p class="text-[10px] text-gray-500 italic">Popups must be allowed for the sign-in window to appear.</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    const btnAuth = document.getElementById('btn-auth-signin');
    if (btnAuth) {
        btnAuth.onclick = async () => {
            try {
                showToast('Opening Puter Sign-In...', 'info');
                await window.puter.auth.signIn();
                // If we reach here, user might have signed in (though signIn() sometimes returns before actual completion)
                // Let's just refresh the page to be safe and clean
                window.location.reload();
            }
            catch (error) {
                Logger.error('Auth', 'SignIn failed:', error);
                showToast('SignIn failed. Try again.', 'error');
            }
        };
    }
}
