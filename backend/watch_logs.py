import time
import os

LOG_FILE = "app_debug.log"

def tail_f(filename):
    print(f"👀 Watching {filename} for logs. Press Ctrl+C to stop.\n")
    if not os.path.exists(filename):
        with open(filename, 'w') as f:
            pass
            
    with open(filename, 'r', encoding='utf-8') as f:
        # Move to the end of the file
        f.seek(0, 2)
        while True:
            line = f.readline()
            if not line:
                time.sleep(0.1)
                continue
            print(line, end='')

if __name__ == "__main__":
    try:
        tail_f(LOG_FILE)
    except KeyboardInterrupt:
        print("\nStopping log watcher.")
