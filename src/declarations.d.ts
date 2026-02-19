// Puter.js Global Type Stubs
declare var puter: any;

// Global Libraries (Marked, DOMPurify, Highlight.js)
declare var marked: any;
declare var DOMPurify: any;
declare var hljs: any;

// App-specific global interface
interface Window {
    gravityChat: any;
    webkitSpeechRecognition: any;
}

declare module 'puter-js' {
    const puter: any;
    export default puter;
}
