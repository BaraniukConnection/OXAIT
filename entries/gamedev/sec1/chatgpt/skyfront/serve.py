"""Serve SKYFRONT locally on port 8072 using only Python's standard library."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    try:
        with ThreadingHTTPServer(('127.0.0.1', 8072), handler) as server:
            print('SKYFRONT ready: http://localhost:8072', flush=True)
            print('Press Ctrl+C to stop.', flush=True)
            server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
    except OSError as exc:
        raise SystemExit(f'Cannot start port 8072: {exc}. If the address is in use, close the other server; if permission is denied, run this launcher in your normal local terminal.')
