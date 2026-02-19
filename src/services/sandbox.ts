
import { showToast } from '../utils/toast.js';

interface SandboxResult {
    stdout?: string;
    stderr: string;
    exitCode: number;
}

/**
 * Executes code in a Puter worker.
 * Supports python, javascript
 */
export async function executeInSandbox(code: string, language: string): Promise<SandboxResult | null> {
    const lang = language.toLowerCase();
    const isSupported = ['python', 'javascript', 'js', 'py'].includes(lang);
    
    if (!isSupported) {
        showToast(`Execution not supported for ${language}`, 'warning');
        return null;
    }

    const normalizedLang = (lang === 'js') ? 'javascript' : (lang === 'py') ? 'python' : lang;

    showToast(`Initializing ${normalizedLang} worker...`, 'info');

    try {
        // DOCUMENTATION AUDIT FIX: puter.workers.run is not documented in V2.
        // It appears V2 workers are Node.js based services created via puter.workers.create()
        // and do not support ephemeral execution of arbitrary Python/JS code strings directly.
        // const result = await puter.workers.run(code, { language: normalizedLang });
        
        return {
            stdout: '',
            stderr: `Execution unavailable: 'puter.workers.run' is not supported in Puter.js V2. \nTarget language: ${normalizedLang}`,
            exitCode: 1
        };
    } catch (error: any) {
        console.error('Sandbox Execution Failed:', error);
        return {
            stderr: error.message || 'Worker execution failed',
            exitCode: 1
        };
    }
}
