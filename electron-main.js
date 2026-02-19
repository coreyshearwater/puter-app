import fs from 'fs';
import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'path';
import { spawn, exec } from 'child_process';
import treeKill from 'tree-kill';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
let pythonProcess = null;
let backendOutput = '';
const pythonProcesses = []; // Retaining original array for now, as the instruction only changed the `pythonProcess` variable, not the usage.

const rootDir = __dirname;
// For packaging:
// If dist, resources are in resources/
// If dev, they are local.

// Simple logger
function log(msg) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`console.log("[Main] ${msg.replace(/"/g, '\\"')}")`);
    } else {
        console.log(`[Main] ${msg}`);
    }
}

function killZombieProcesses() {
    return new Promise((resolve) => {
        log('Checking for zombie Python processes...');
        // Execute the dedicated cleanup script
        const cleanupScript = path.join(__dirname, 'cleanup_backend.ps1');
        const cmd = `powershell -ExecutionPolicy Bypass -File "${cleanupScript}"`;
        
        exec(cmd, (err, stdout, stderr) => {
            if (stdout) console.log(stdout); // Log script output to Electron console
            if (stderr) console.error(stderr);
            
            if (err) {
                log('Cleanup script finished with error (or no permission). Proceeding.');
            } else {
                log('Cleanup complete.');
            }
            resolve();
        });
    });
}


function spawnPythonProcess(command, args, cwd) {
    log(`Spawning: ${command} ${args.join(' ')} (CWD: ${cwd || '.'})`);
    
    // On Windows, use shell: true to avoid issues with path resolution for some executables,
    // but specific paths to python.exe are usually safer without it.
    // We will use full paths where possible.
    const proc = spawn(command, args, {
        cwd: cwd || __dirname,
        shell: true, // Helpful for Windows path parsing
        stdio: 'pipe', // Capture output
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' } // Force UTF-8 for emojis
    });

    proc.stdout.on('data', (data) => {
        console.log(`[${args[0] || command}] stdout: ${data}`);
    });

    proc.stderr.on('data', (data) => {
        console.error(`[${args[0] || command}] stderr: ${data}`);
    });

    proc.on('close', (code) => {
        log(`Process ${command} exited with code ${code}`);
    });

    pythonProcesses.push(proc);
    return proc;
}

function startBackend() {
    const rootDir = __dirname;
    const grokDir = path.join(rootDir, 'Grok-Api-main');
    
    // Path to Python executables (Windows specific based on start.bat)
    const grokPython = path.join(grokDir, 'venv', 'Scripts', 'python.exe');
    const edgeTtsPython = path.join(rootDir, 'edge_tts_venv', 'Scripts', 'python.exe');
    
    // 1. Grok API Server
    if (fs.existsSync(grokPython)) {
        spawnPythonProcess(grokPython, ['api_server.py'], grokDir);
        spawnPythonProcess(grokPython, ['grok_driver.py'], grokDir);
    } else {
        log('WARN: Grok virtual environment not found.');
    }

    // 2. Edge TTS Server
    const edgeTtsScript = path.join(rootDir, 'backend', 'edge_tts_server.py');
    if (fs.existsSync(edgeTtsPython)) {
        spawnPythonProcess(edgeTtsPython, ['edge_tts_server.py'], path.join(rootDir, 'backend')); 
    } else {
        log('WARN: Edge TTS virtual environment not found.');
    }

    // 3. Local LLM Server (New)

    const localLlmPython = path.join(rootDir, 'local_llm_venv', 'Scripts', 'python.exe');
    const localLlmScript = path.join(rootDir, 'backend', 'local_llm_server.py');
    
    log(`Checking for Local LLM at: ${localLlmScript}`);
    if (fs.existsSync(localLlmScript)) {
        log('Local LLM script found.');
        if (fs.existsSync(localLlmPython)) {
            log(`Found Local LLM venv at: ${localLlmPython}`);
            spawnPythonProcess(localLlmPython, ['local_llm_server.py'], path.join(rootDir, 'backend'));
        } else {
            log('WARN: Local LLM venv not found. Trying system python...');
            spawnPythonProcess('python', ['local_llm_server.py'], path.join(rootDir, 'backend'));
        }
    } else {
        log('Local LLM script NOT found.');
    }

    // 4. Debug Server (runs with system python usually, or we can use one of the venvs)
    // start.bat uses 'python' from PATH for debug_server
    spawnPythonProcess('python', ['debug_server.py'], path.join(rootDir, 'backend'));
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false, // Don't show until ready to avoid white flash
        backgroundColor: '#0a0a0f', // Matches --bg-void
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true, // Protect against prototype pollution
            // preload: path.join(__dirname, 'preload.js') // Optional if needed later
        },
        autoHideMenuBar: true, // Hides the default menu bar (File, Edit, etc.)
        icon: path.join(__dirname, 'icon.ico')
    });

    // Completely remove the menu (optional, but ensures it's gone)
    mainWindow.removeMenu();

    // Maximize window
    mainWindow.maximize();

    // Prevent white flash: Show only when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Load the local server URL
    // We wait a bit in createApplication, so server should be up.
    mainWindow.loadURL('http://localhost:8000/index.html');

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    // Stream Console Logs to Terminal
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        const levelName = levels[level] || 'INFO';
        console.log(`[Renderer][${levelName}] ${message} (${sourceId}:${line})`);
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object
        mainWindow = null;
    });
}

function cleanupProcesses() {
    log('Cleaning up background processes...');
    pythonProcesses.forEach((proc) => {
        if (proc.pid) {
            log(`Killing PID ${proc.pid}...`);
            treeKill(proc.pid, 'SIGKILL', (err) => {
                if (err) log(`Error killing PID ${proc.pid}: ${err.message}`);
            });
        }
    });
}

// Ensure cleanup on various exit signals
app.on('before-quit', cleanupProcesses);

app.on('ready', async () => {
    await killZombieProcesses();
    startBackend();

    // Warmup delay (6 seconds as per start.bat)
    log('Warming up engines (6s)...');
    setTimeout(createWindow, 6000);
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});
