import subprocess
import os
import sys
import time
import signal
import webbrowser
import ctypes
from ctypes import wintypes

# --- Windows Job Object (The Guard Rail) ---
def configure_sys_job_object():
    if os.name != 'nt': return None
    try:
        job = ctypes.windll.kernel32.CreateJobObjectW(None, None)
        class JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
            _fields_ = [('PerProcessUserTimeLimit', wintypes.LARGE_INTEGER), ('PerJobUserTimeLimit', wintypes.LARGE_INTEGER), ('LimitFlags', wintypes.DWORD), ('MinimumWorkingSetSize', ctypes.c_size_t), ('MaximumWorkingSetSize', ctypes.c_size_t), ('ActiveProcessLimit', wintypes.DWORD), ('Affinity', ctypes.c_size_t), ('PriorityClass', wintypes.DWORD), ('SchedulingClass', wintypes.DWORD)]
        class IO_COUNTERS(ctypes.Structure):
            _fields_ = [('ReadOperationCount', ctypes.c_ulonglong), ('WriteOperationCount', ctypes.c_ulonglong), ('OtherOperationCount', ctypes.c_ulonglong), ('ReadTransferCount', ctypes.c_ulonglong), ('WriteTransferCount', ctypes.c_ulonglong), ('OtherTransferCount', ctypes.c_ulonglong)]
        class JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
            _fields_ = [('BasicLimitInformation', JOBOBJECT_BASIC_LIMIT_INFORMATION), ('IoInfo', IO_COUNTERS), ('ProcessMemoryLimit', ctypes.c_size_t), ('JobMemoryLimit', ctypes.c_size_t), ('PeakProcessMemoryUsed', ctypes.c_size_t), ('PeakJobMemoryUsed', ctypes.c_size_t)]
        info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
        info.BasicLimitInformation.LimitFlags = 0x2000 # KILL_ON_JOB_CLOSE
        ctypes.windll.kernel32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info))
        ctypes.windll.kernel32.AssignProcessToJobObject(job, ctypes.windll.kernel32.GetCurrentProcess())
        return job
    except Exception as e:
        print(f"⚠️  JobObject Error: {e}")
        return None

def kill_port(port):
    try:
        out = subprocess.check_output(f"netstat -ano", shell=True).decode()
        for line in out.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                pid = line.strip().split()[-1]
                if pid.isdigit() and pid != "0":
                    subprocess.call(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except: pass

def get_venv_python(venv_dir):
    path = os.path.join(os.getcwd(), venv_dir, "Scripts", "python.exe")
    return path if os.path.exists(path) else "python"

def find_chrome_binary():
    # 1. Look for portable chrome (Priority)
    portable = os.path.join(os.getcwd(), "bin", "chrome-win", "chrome.exe")
    if os.path.exists(portable): return portable
    
    # 2. Look for system chrome
    paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
    ]
    for p in paths:
        if os.path.exists(p): return p
    return None

def main():
    print("🚀 Starting GravityChat Logic Core...")
    job = configure_sys_job_object()
    
    # Cleanup ports
    for p in [8000, 8001, 5050, 6969]: kill_port(p)
    
    # Server Flags
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    
    processes = []
    
    try:
        # 1. Grok API
        processes.append(("Grok API", subprocess.Popen([get_venv_python("Grok-Api-main/venv"), "api_server.py"], cwd="Grok-Api-main", creationflags=flags)))
        
        # 2. Grok Driver
        processes.append(("Grok Driver", subprocess.Popen([get_venv_python("Grok-Api-main/venv"), "grok_driver.py"], cwd="Grok-Api-main", creationflags=flags)))
        

        # 3. TTS
        if os.path.exists(os.path.join("backend", "edge_tts_server.py")):
            processes.append(("TTS", subprocess.Popen([get_venv_python("edge_tts_venv"), "edge_tts_server.py"], cwd="backend", creationflags=flags)))

        # 4. Local LLM Engine (New)
        if os.path.exists(os.path.join("backend", "local_llm_server.py")):
             llm_python = get_venv_python("local_llm_venv")
             print("🧠 Starting Local LLM Engine...")
             processes.append(("Local LLM", subprocess.Popen([llm_python, "local_llm_server.py"], cwd="backend", creationflags=flags)))
            
        # 5. Debug Server
        if os.path.exists(os.path.join("backend", "debug_server.py")):
            processes.append(("Debug", subprocess.Popen(["python", "debug_server.py"], cwd="backend", creationflags=flags)))


        print("⏳ Warning up (3s)...")
        time.sleep(3)
        
        # 5. Launch Chrome DIRECTLY (So we can watch it)
        chrome_exe = find_chrome_binary()
        if chrome_exe:
            print(f"🖥️  Launching UI: {chrome_exe}")
            user_data = os.path.join(os.getcwd(), "chrome_data")
            app_url = "http://localhost:8000/index.html"
            
            # Arguments for App Mode
            args = [
                chrome_exe,
                f"--app={app_url}",
                f"--user-data-dir={user_data}",
                "--start-maximized",
                "--no-first-run",
                "--no-default-browser-check"
            ]
            
            # Use separate process group so Ctrl+C in console doesn't kill it immediately (we want graceful exit)
            p_chrome = subprocess.Popen(args)
            processes.append(("Chrome UI", p_chrome))
            
            print("\n✅ GravityChat Running. Close the App Window to exit.")
            
            # Watch Chrome loop
            while p_chrome.poll() is None:
                time.sleep(1)
                
            print("👋 App Window Closed. Shutting down...")
        else:
            print("⚠️  Chrome not found. Opening default browser (Unmonitored Mode).")
            webbrowser.open("http://localhost:8000")
            # Fallback loop
            while True: time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n👋 Stop Signal.")
    finally:
        print("🛑 Terminating processes...")
        for name, p in processes:
            if p.poll() is None:
                p.terminate()
        time.sleep(1)

if __name__ == "__main__":
    if getattr(sys, 'frozen', False): os.chdir(os.path.dirname(sys.executable))
    main()
