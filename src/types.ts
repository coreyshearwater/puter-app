export interface Persona {
    id: string;
    name: string;
    color: string;
    systemPrompt: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    attachments?: any[];
    hidden?: boolean;
}

export interface Session {
    id: string;
    name: string;
    messages: ChatMessage[];
    timestamp: number;
}

export interface AppState {
    messages: ChatMessage[];
    sessions: Session[];
    activeSessionId: string | null;
    currentModel: string;
    isStreaming: boolean;
    premiumEnabled: boolean;
    theme: string;
    allModels: any[];
    freeModels: any[];
    autoSpeak: boolean;
    selectedVoice: string;
    isRecording: boolean;
    isSpeakingAudio: boolean;
    wasSpeakingBeforeModal: boolean;
    isVoiceSession: boolean;
    voiceSuspended: boolean;
    mediaRecorder: any | null;
    audioChunks: any[];
    temperature: number;
    maxTokens: number;
    personas: Persona[];
    activePersona: Persona | null;
    oracularModes: Record<string, boolean>;
    currentPath: string;
    files: any[];
    attachedFiles: any[];
    grokProxy: any;
    grokApiUrl: string;
    grokConversationData: any;
    grokCookies: { sso: string; 'sso-rw': string };
    grokMenuExpanded: boolean;
    allowEmojis: boolean;
    projectIndex: any;
    isProcessingIntent: boolean;
    useLocalModel: boolean;
    localServerOnline: boolean;
    localModelLoaded: string | null;
    mediaParams?: {
        aspectRatio: string;
        style: string;
        negativePrompt: string;
    };
    audioStream?: any;
    localTab?: string;
    hfSearchQuery?: string;
    hfSearchFilters?: { quant: string; size: string };
    hfSearchResults?: any[];
    _streamStartedAt?: number;
    _abortStream?: boolean;
}
