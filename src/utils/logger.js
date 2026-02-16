(function() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    async function sendLog(level, args) {
        const msg = Array.from(args).map(arg => {
            if (typeof arg === 'object') {
                try { return JSON.stringify(arg); } catch(e) { return String(arg); }
            }
            return String(arg);
        }).join(' ');
        
        try {
            // Point to local debug server
            await fetch('http://localhost:8000/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, msg, source: 'console' })
            });
        } catch (e) {
            // Silently fail to avoid recursion
        }
    }

    console.log = function() {
        sendLog('INFO', arguments);
        originalLog.apply(console, arguments);
    };
    console.error = function() {
        sendLog('ERROR', arguments);
        originalError.apply(console, arguments);
    };
    console.warn = function() {
        sendLog('WARN', arguments);
        originalWarn.apply(console, arguments);
    };

    window.onerror = function(message, source, lineno, colno, error) {
        const msg = `Unhandled Error: ${message} at ${source}:${lineno}:${colno}`;
        sendLog('CRITICAL', [msg, error ? error.stack : '']);
        return false;
    };

    window.onunhandledrejection = function(event) {
        sendLog('CRITICAL', [`Unhandled Promise Rejection: ${event.reason}`]);
    };

    console.log('📡 Remote Logging Restored');
})();
