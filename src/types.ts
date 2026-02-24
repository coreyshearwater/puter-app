export interface Persona {
    id: string;
    name: string;
    color: string;
    systemPrompt: string;
}

export interface PuterModel {
    id: string;
    name?: string;
    description?: string;
    provider?: string;
    cost?: {
        input: number;
        output: number;
        unit?: string;
    };
    category?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    attachments?: AttachedFile[];
    hidden?: boolean;
}

export interface Session {
    id: string;
    name: string;
    messages: ChatMessage[];
    timestamp: number;
}

export interface AttachedFile {
    id: string;
    name: string;
    type: string;
    size: number;
    file: File;
    content: string | null;
}

export interface ProjectFile {
    name: string;
    path: string;
    size: number;
}

export interface ProjectMap {
    indexedAt: string;
    root: string;
    files: ProjectFile[];
}

export interface HFSearchResult {
    id: string;
    downloads: number;
    likes: number;
    tags: string[];
}

export interface AppState {
    messages: ChatMessage[];
    sessions: Session[];
    activeSessionId: string | null;
    currentModel: string;
    isStreaming: boolean;
    premiumEnabled: boolean;
    theme: string;
    allModels: PuterModel[];
    freeModels: PuterModel[];
    autoSpeak: boolean;
    selectedVoice: string;
    isRecording: boolean;
    isSpeakingAudio: boolean;
    wasSpeakingBeforeModal: boolean;
    isVoiceSession: boolean;
    voiceSuspended: boolean;
    mediaRecorder: MediaRecorder | null;
    audioChunks: Blob[];
    temperature: number;
    maxTokens: number;
    personas: Persona[];
    activePersona: Persona | null;
    oracularModes: Record<string, boolean>;
    currentPath: string;
    files: any[]; // Opaque Puter SDK file objects
    attachedFiles: AttachedFile[];
    grokProxy: any;
    grokApiUrl: string;
    grokConversationData: any;
    grokCookies: { sso: string; 'sso-rw': string };
    grokMenuExpanded: boolean;
    allowEmojis: boolean;
    projectIndex: ProjectMap | null;
    isProcessingIntent: boolean;
    useLocalModel: boolean;
    localServerOnline: boolean;
    localModelLoaded: string | null;
    mediaParams?: {
        aspectRatio: string;
        style: string;
        negativePrompt: string;
    };
    audioStream?: MediaStream | null;
    localTab?: string;
    hfSearchQuery?: string;
    hfSearchFilters?: { quant: string; size: string };
    hfSearchResults?: HFSearchResult[];
    _streamStartedAt?: number;
    _abortStream?: boolean;
}
