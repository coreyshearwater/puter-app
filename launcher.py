import subprocess
import os
import sys
import time
import signal
import webbrowser

def find_chrome():
    paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    return None

def main():
    print("🚀 Starting GravityChat...")
    
    # 1. Start Debug Server (hidden/minimized)
    # We use CREATE_NO_WINDOW flag to hide console
    kwargs = {}
    if os.name == 'nt':
        kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
        
    # Use the venv python explicitly, NOT sys.executable (which points to this exe itself!)
    venv_python = os.path.join(os.getcwd(), "Grok-Api-main", "venv", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        # Fallback to system python if venv is missing (unlikely but safe)
        venv_python = "python"
        
    debug_server = subprocess.Popen([venv_python, "debug_server.py"], **kwargs)
    print("✅ Debug Server Started")

    # 2. Start Grok API (also hidden)
    grok_cwd = "Grok-Api-main"
    # Ensure correct path for api server python too
    grok_cmd = [venv_python, "api_server.py"] 
    # venv_python is absolute path so it works regardless of cwd
    grok_server = subprocess.Popen(grok_cmd, cwd=grok_cwd, **kwargs)
    print("✅ Grok API Bridge Started")

    # 3. Launch Chrome App Mode via Shortcut or Direct
    # Using the shortcut ensures the icon is correct on taskbar
    chrome_path = find_chrome()
    url = "http://localhost:8000/index_v2.html"
    
    # We launch via the shortcut we created earlier if it exists, otherwise direct chrome
    shortcut_path = os.path.abspath("GravityChat.lnk")
    
    if os.path.exists(shortcut_path):
        print(f"Launching via shortcut: {shortcut_path}")
        os.startfile(shortcut_path)
    elif chrome_path:
        print(f"Launching via Chrome path: {chrome_path}")
        subprocess.Popen([chrome_path, f"--app={url}", f"--user-data-dir={os.path.abspath('chrome_data')}"])
    else:
        print("Chrome not found, opening default browser...")
        webbrowser.open(url)

    print("\n⚠️  GravityChat is running. Close this window to stop servers.")
    try:
        while True:
            time.sleep(1)
            # Check if servers are still alive
            if debug_server.poll() is not None:
                print("Debug server stopped unexpectedly.")
                break
            if grok_server.poll() is not None:
                print("Grok server stopped unexpectedly.")
                break
    except KeyboardInterrupt:
        pass
    finally:
        print("Shutting down servers...")
        debug_server.terminate()
        grok_server.terminate()

if __name__ == "__main__":
    # Ensure current directory is correct when running from EXE
    if getattr(sys, 'frozen', False):
        os.chdir(os.path.dirname(sys.executable))
    
    main()
