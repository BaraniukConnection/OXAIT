#!/usr/bin/env python3
"""Rogue Strike - self-hosted local server.

Serves the game from ./static and a tiny JSON API for best mission times:
  GET  /api/scores   best run per plane
  POST /api/scores   {"plane": id, "time": s, "kills": n, "accuracy": %}
                     -> {"newRecord": bool, "scores": {...}}

Best runs are stored in scores.json next to this file.
"""
import argparse
import json
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
SCORES = ROOT / "scores.json"
PLANES = {"thunder", "vulture", "falcon", "shadow"}
lock = threading.Lock()


def load_scores():
    try:
        return json.loads(SCORES.read_text())
    except (OSError, ValueError):
        return {}


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".mjs": "text/javascript"}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(STATIC), **kw)

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/scores":
            with lock:
                return self._json(load_scores())
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/scores":
            return self._json({"error": "not found"}, 404)
        try:
            data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0)) or 0))
            plane, t = data["plane"], float(data["time"])
            if plane not in PLANES or not 0 < t < 36000:
                raise ValueError
            run = {"time": round(t, 2), "kills": int(data.get("kills", 0)),
                   "accuracy": int(data.get("accuracy", 0)), "difficulty": str(data.get("difficulty", ""))[:12],
                   "date": time.strftime("%Y-%m-%d")}
        except (KeyError, ValueError, TypeError):
            return self._json({"error": "bad request"}, 400)
        with lock:
            scores = load_scores()
            new = plane not in scores or run["time"] < scores[plane]["time"]
            if new:
                scores[plane] = run
                SCORES.write_text(json.dumps(scores, indent=2))
        return self._json({"newRecord": new, "scores": scores})

    def end_headers(self):
        # always serve fresh files while developing / after updates
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser(description="Rogue Strike local server")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8071)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    url = f"http://{'127.0.0.1' if args.host == '0.0.0.0' else args.host}:{args.port}"
    print(f"Rogue Strike running at {url}  (Ctrl+C to stop)")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
