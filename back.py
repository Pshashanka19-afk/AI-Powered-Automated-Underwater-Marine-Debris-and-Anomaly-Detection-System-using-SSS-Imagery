"""
Qorvia - Local HTTP Server
Serves static web files with CORS and correct MIME types.
"""

import http.server
import socketserver
import os
import sys

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def guess_type(self, path):
        mime = super().guess_type(path)
        if path.endswith('.js'):
            return 'application/javascript; charset=utf-8'
        elif path.endswith('.css'):
            return 'text/css; charset=utf-8'
        elif path.endswith('.mp4'):
            return 'video/mp4'
        elif path.endswith('.json') or path.endswith('.geojson'):
            return 'application/json'
        return mime

def run_server(port=PORT):
    for p in [port, 8000, 3000, 5000, 8888]:
        try:
            socketserver.TCPServer.allow_reuse_address = True
            with socketserver.TCPServer(("", p), Handler) as httpd:
                print(f"[QORVIA SERVER] Running at http://localhost:{p}")
                print(f"[QORVIA SERVER] Serving directory: {DIRECTORY}")
                sys.stdout.flush()
                httpd.serve_forever()
        except OSError:
            print(f"Port {p} is in use, trying next port...")
            continue

if __name__ == "__main__":
    run_server()
