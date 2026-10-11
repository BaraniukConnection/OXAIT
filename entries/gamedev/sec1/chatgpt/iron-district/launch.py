#!/usr/bin/env python3
"""Launch Iron District locally. Python 3 standard library only."""
import argparse
import functools
import http.server
import pathlib
import threading
import webbrowser

parser = argparse.ArgumentParser(description='Run Iron District locally')
parser.add_argument('--port', type=int, default=8000)
parser.add_argument('--no-browser', action='store_true')
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
try:
    server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler)
except PermissionError as exc:
    raise SystemExit(f'Local server permission denied: {exc}\nRun this launcher in a normal terminal on your own computer.')
except OSError as exc:
    raise SystemExit(f'Cannot start port {args.port}: {exc}\nTry: python3 launch.py --port 8001')
url = f'http://localhost:{args.port}'
print(f'Iron District is running at {url}\nPress Ctrl+C to stop.', flush=True)
if not args.no_browser:
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
