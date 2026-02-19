"""
Edge TTS Bridge - Free high-quality text-to-speech
Uses Microsoft's Edge TTS API (same voices as Windows 11 Narrator)
Runs on http://127.0.0.1:8002
"""
import http.server
import json
import asyncio
import io
import sys

PORT = 8002

# Windows asyncio fix
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

class EdgeTTSHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        msg = format % args
        if '/health' not in msg:
            print(f"  {msg}")

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self._cors()
            self.end_headers()
            self.wfile.write(b'ok')

        elif self.path == '/voices':
            try:
                import edge_tts
                voices = asyncio.run(edge_tts.list_voices())
                data = json.dumps(voices).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._cors()
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_response(500)
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/speak':
            try:
                import edge_tts
                length = int(self.headers.get('Content-Length', 0))
                body = json.loads(self.rfile.read(length)) if length else {}
                text = body.get('text', 'Hello')[:2000]  # Limit length
                voice = body.get('voice', 'en-US-AriaNeural')

                audio = asyncio.run(self._synth(text, voice))

                self.send_response(200)
                self.send_header('Content-Type', 'audio/mp3')
                self.send_header('Content-Length', str(len(audio)))
                self._cors()
                self.end_headers()
                self.wfile.write(audio)
            except Exception as e:
                print(f"  ❌ TTS error: {e}")
                self.send_response(500)
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    async def _synth(self, text, voice):
        import edge_tts
        comm = edge_tts.Communicate(text, voice)
        buf = io.BytesIO()
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        return buf.getvalue()

if __name__ == '__main__':
    try:
        import edge_tts
    except ImportError:
        print("❌ edge-tts not installed. Run: pip install edge-tts")
        sys.exit(1)

    with http.server.HTTPServer(('127.0.0.1', PORT), EdgeTTSHandler) as httpd:
        print(f"🎤 Edge TTS Bridge running on http://127.0.0.1:{PORT}")
        print(f"   Endpoints: GET /voices, POST /speak, GET /health")
        httpd.serve_forever()
