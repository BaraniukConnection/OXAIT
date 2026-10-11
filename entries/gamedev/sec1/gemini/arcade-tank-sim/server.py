#!/usr/bin/env python3
"""
Arcade Tank Sim - Local Game Server
Zero-dependency HTTP server for hosting the WebGL 3D Tank Simulator.
"""

import os
import sys
import argparse
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler

class TankGameRequestHandler(SimpleHTTPRequestHandler):
    """Custom HTTP request handler with proper MIME types and no-cache headers."""
    
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript; charset=utf-8',
        '.mjs': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.wasm': 'application/wasm',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
    }

    def end_headers(self):
        # Disable caching for instant local updates during gameplay and development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Enable CORS just in case
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        # Clean logging: filter out noisy requests if needed
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

def run(host='127.0.0.1', port=8000, auto_open=False):
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)
    
    server_address = (host, port)
    
    try:
        httpd = HTTPServer(server_address, TankGameRequestHandler)
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"[!] Port {port} is already in use. Trying port {port + 1}...")
            run(host=host, port=port + 1, auto_open=auto_open)
            return
        raise e

    url = f"http://{host if host != '0.0.0.0' else 'localhost'}:{port}"
    
    print("=" * 60)
    print("  ARCADE TANK SIMULATOR - LOCAL SERVER")
    print("=" * 60)
    print(f"  Serving directory: {web_dir}")
    print(f"  Game URL:          {url}")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 60)

    if auto_open:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Shutting down server...")
        httpd.server_close()
        print("[✓] Server stopped cleanly. Goodbye commander!")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Run Arcade Tank Sim local web server")
    parser.add_argument('--host', default='127.0.0.1', help='Host address (default: 127.0.0.1, use 0.0.0.0 for LAN)')
    parser.add_argument('--port', type=int, default=8000, help='Port to listen on (default: 8000)')
    parser.add_argument('--open', action='store_true', help='Open browser automatically')
    args = parser.parse_args()
    
    run(host=args.host, port=args.port, auto_open=args.open)
