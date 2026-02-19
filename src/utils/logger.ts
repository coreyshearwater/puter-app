
/**
 * Centralized Logger Utility
 * Provides structured logging with levels and future-proofing for KV persistence.
 */
export const Logger = {
    LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },

    currentLevel: 1, // Default to INFO

    debug(tag: string, ...args: any[]) {
        if (this.currentLevel <= this.LEVELS.DEBUG) {
            console.debug(`%c[${tag}]`, 'color: #94a3b8; font-weight: bold;', ...args);
        }
    },

    info(tag: string, ...args: any[]) {
        if (this.currentLevel <= this.LEVELS.INFO) {
            console.log(`%c[${tag}]`, 'color: #38bdf8; font-weight: bold;', ...args);
        }
    },

    warn(tag: string, ...args: any[]) {
        if (this.currentLevel <= this.LEVELS.WARN) {
            console.warn(`%c[${tag}]`, 'color: #fbbf24; font-weight: bold;', ...args);
        }
    },

    error(tag: string, ...args: any[]) {
        if (this.currentLevel <= this.LEVELS.ERROR) {
            console.error(`%c[${tag}]`, 'color: #ef4444; font-weight: bold;', ...args);
            // Future: persist critical errors to KV
        }
    }
};

(window as any).Logger = Logger; // Global access for debugging
