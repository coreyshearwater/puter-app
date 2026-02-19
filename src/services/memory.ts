
import { AppState } from '../state/state.js';
import { showToast } from '../utils/toast.js';
import { Logger } from '../utils/logger.js';

interface ProjectFile {
    name: string;
    path: string;
    size: number;
}

interface ProjectMap {
    indexedAt: string;
    root: string;
    files: ProjectFile[];
}

declare const puter: any;

/**
 * Recursively indexes the current project path.
 * Stores a structural map in puter.kv to persist context.
 */
export async function indexProject(path: string = AppState.currentPath) {
    showToast(`Indexing: ${path}`, 'info');
    Logger.info('Memory', `Starting index for [${path}]`);

    const projectMap: ProjectMap = {
        indexedAt: new Date().toISOString(),
        root: path,
        files: []
    };

    const MAX_FILES = 200;
    const EXCLUDED_DIRS = ['node_modules', '.git', '.agent', '.system_generated', 'Grok-Api-main', 'dist', 'build'];
    const ALLOWED_EXTS = ['js', 'css', 'html', 'py', 'md', 'txt', 'json', 'bat', 'sh', 'sql'];

    async function walk(targetPath: string) {
        if (projectMap.files.length >= MAX_FILES) return;

        try {
            const entries = await puter.fs.readdir(targetPath);
            if (!entries || !Array.isArray(entries)) return;

            for (const entry of entries) {
                if (projectMap.files.length >= MAX_FILES) break;

                if (entry.is_dir) {
                    if (EXCLUDED_DIRS.includes(entry.name)) continue;
                    await walk(entry.path);
                } else {
                    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
                    if (ALLOWED_EXTS.includes(ext)) {
                        projectMap.files.push({
                            name: entry.name,
                            path: entry.path,
                            size: entry.size
                        });
                    }
                }
            }
        } catch (e) { 
            Logger.warn('Memory', `Access denied or failed for ${targetPath}`); 
        }
    }

    try {
        await walk(path);
        
        if (projectMap.files.length === 0) {
            showToast('No indexable files found in this path!', 'warning');
            return;
        }

        await puter.kv.set('gravitychat_project_index', JSON.stringify(projectMap));
        AppState.projectIndex = projectMap;
        showToast(`Indexed ${projectMap.files.length} files in ${path}`, 'success');
        Logger.info('Memory', `Index complete. Found ${projectMap.files.length} files.`);
    } catch (error) {
        Logger.error('Memory', 'Indexing Error:', error);
        showToast('Indexing failed. Check console.', 'error');
    }
}

/**
 * Returns a summary of the project to be injected into system prompts.
 */
export function getProjectContext(): string {
    const idx = AppState.projectIndex as ProjectMap;
    if (!idx || !idx.files || !idx.files.length) return '';

    const fileList = idx.files.map(f => f.path.replace(idx.root, '')).join(', ');
    return `

[NEURAL MEMORY]
The user's project is at: ${idx.root}
Indexed Files: ${fileList}
(End of Project Context)`;
}

export async function loadIndexFromKV() {
    try {
        const data = await puter.kv.get('gravitychat_project_index');
        if (data) {
            AppState.projectIndex = JSON.parse(data);
            Logger.info('Memory', 'Neural Memory loaded from KV');
        }
    } catch (e) { /* ignore quiet fail */ }
}
