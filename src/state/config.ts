
export const CONFIG = {
    // Local Backend
    LOCAL_LLM_PORT: 8003,
    get LOCAL_LLM_URL(): string { return `http://localhost:${this.LOCAL_LLM_PORT}`; },
    
    // Connection Params
    CONNECT_TIMEOUT_MS: 3000,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,

    // App Info
    VERSION: '2.6.3', // Updated for latest release
    APP_NAME: 'All Seeing Cat'
};
