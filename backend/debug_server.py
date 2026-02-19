import http.server
import socketserver
import json
import datetime
import os

PORT = 8000
LOG_FILE = "app_debug.log"

class DebugHandler(http.server.SimpleHTTPRequestHandler):
    # Ensure correct MIME types on Windows
    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
    })

    def do_POST(self):
        if self.path == '/log':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                log_data = json.loads(post_data.decode('utf-8'))
                timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                level = log_data.get('level', 'INFO').upper()
                msg = log_data.get('msg', '')
                source = log_data.get('source', 'browser')
                
                log_entry = f"[{timestamp}] [{level}] [{source}] {msg}\n"
                
                with open(LOG_FILE, "a", encoding="utf-8") as f:
                    f.write(log_entry)
                
                print(f"Captured {level}: {msg[:500]}...") # Print to console too
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode())
            except Exception as e:
                print(f"Error handling log: {e}")
                self.send_response(400)
                self.end_headers()
        else:
            super().do_POST()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def run():
    # Ensure log file starts fresh or at least exists
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"\n--- SESSION STARTED AT {datetime.datetime.now()} ---\n")
    
    with socketserver.TCPServer(("", PORT), DebugHandler) as httpd:
        print(f"🚀 Debug Server running at http://localhost:{PORT}")
        print(f"📝 Logging to {LOG_FILE}")
        httpd.serve_forever()

if __name__ == "__main__":
    run()
