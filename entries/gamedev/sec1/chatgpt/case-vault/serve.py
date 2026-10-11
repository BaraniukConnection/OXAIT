#!/usr/bin/env python3
"""Serve Case Vault locally using Python's standard library."""
import argparse
import functools
import http.server
import pathlib
import webbrowser

def main():
    parser = argparse.ArgumentParser(description='Launch Case Vault on this computer.')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parent
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as exc:
        raise SystemExit(f'Cannot start on port {args.port}: {exc}\nTry: python3 serve.py --port 8001')
    url = f'http://127.0.0.1:{args.port}'
    print(f'Case Vault is running at {url}\nPress Ctrl+C to stop.', flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
