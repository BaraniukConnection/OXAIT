/*
 * OXAIT pybridge — запускає оригінальний server.py учасника прямо в браузері (Pyodide),
 * бо GitHub Pages не виконує Python.
 *
 * Підключається першим скриптом у <head> сторінки проєкту (це робить tools/sync_entries.py):
 *   <script src=".../assets/js/pybridge.js" data-server="../server.py"></script>
 *
 * Що відбувається:
 *  - fetch("/api/...") перехоплюється і передається в HTTP-обробник із server.py
 *    (той самий клас Handler, тільки замість сокета — буфер у пам'яті);
 *  - server.py запускається як __main__, але HTTP-сервер не слухає порт, а фонові потоки
 *    (ринок, тіки) виконуються по одній ітерації через setInterval з тим самим інтервалом;
 *  - файли, які сервер пише поруч із собою (save, SQLite), зберігаються в IndexedDB цього браузера.
 * Код учасника не змінюється.
 */
(() => {
  const me = document.currentScript;
  const SERVER = new URL(me.dataset.server || "../server.py", location.href).href;
  const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/";
  const MOUNT = "/oxait/" + Array.from(SERVER).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  const pageDir = location.pathname.replace(/[^/]*$/, "");
  const realFetch = window.fetch.bind(window);

  /* ── Екран завантаження ── */
  const veil = document.createElement("div");
  veil.innerHTML = `<div style="text-align:center;max-width:420px;padding:24px">
      <div style="width:44px;height:44px;margin:0 auto 18px;border-radius:50%;border:3px solid rgba(19,236,164,.2);border-top-color:#13eca4;animation:oxspin 0.9s linear infinite"></div>
      <div style="font:800 13px/18px system-ui,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#13eca4">OXAIT · Python</div>
      <div id="ox-veil-msg" style="margin-top:8px;font:500 14px/20px system-ui,sans-serif;color:#b6c8d8">Запуск сервера в браузері… / Starting the server in your browser…</div>
    </div><style>@keyframes oxspin{to{transform:rotate(360deg)}}</style>`;
  Object.assign(veil.style, { position: "fixed", inset: "0", zIndex: "2147483647", display: "grid", placeItems: "center", background: "#04070c" });
  const showVeil = () => document.documentElement.append(veil);
  document.body ? showVeil() : document.addEventListener("DOMContentLoaded", showVeil, { once: true });
  const say = t => { const el = veil.querySelector("#ox-veil-msg"); if (el) el.textContent = t; };

  /* ── Python-частина: фейковий сокет, запуск __main__, ітерації фонових потоків ── */
  const PY = String.raw`
import io, sys, time, runpy, threading, socketserver, http.server, webbrowser

class _Stop(BaseException):
    pass

class _Sock:
    def __init__(self, raw):
        self.raw, self.out = raw, bytearray()
    def makefile(self, mode, *a, **k):
        return io.BytesIO(self.raw) if "r" in mode else _W(self.out)
    def sendall(self, b):
        self.out += b
    def settimeout(self, *a): pass
    def setsockopt(self, *a): pass
    def close(self): pass

class _W(io.RawIOBase):
    def __init__(self, buf): self.buf = buf
    def writable(self): return True
    def write(self, b): self.buf += b; return len(b)

_handler, _threads = [None], []

class _Server:
    """Замість HTTP-сервера: запам'ятовує клас обробника і нічого не слухає."""
    daemon_threads = True
    def __init__(self, addr=None, handler=None, *a, **k):
        if handler is not None:
            _handler[0] = handler
        self.server_address = addr or ("127.0.0.1", 8000)
        self.server_name, self.server_port = "localhost", self.server_address[1]
    def serve_forever(self, *a, **k): pass
    def shutdown(self): pass
    def server_close(self): pass
    def __enter__(self): return self
    def __exit__(self, *a): pass

for mod in (http.server, socketserver):
    for name in ("HTTPServer", "ThreadingHTTPServer", "TCPServer", "ThreadingTCPServer"):
        if hasattr(mod, name):
            setattr(mod, name, _Server)
webbrowser.open = lambda *a, **k: False

def _start(self):
    _threads.append(self)
threading.Thread.start = _start

def boot(path):
    sys.argv = [path]
    try:
        runpy.run_path(path, run_name="__main__")
    except SystemExit:
        pass
    return _handler[0] is not None

def tick(i):
    """Одна ітерація фонового потоку: перший sleep — пропускаємо, другий — зупинка."""
    t, real, seen, interval = _threads[i], time.sleep, [0], [None]
    if getattr(t, "_target", None) is None:  # Timer та інші одноразові — не фонові цикли
        return None
    def fake(s=0):
        seen[0] += 1
        if seen[0] > 1:
            raise _Stop
        interval[0] = s
    time.sleep = fake
    try:
        t._target(*t._args, **t._kwargs)
    except _Stop:
        pass
    except Exception as e:
        print("background thread:", repr(e), file=sys.stderr)
    finally:
        time.sleep = real
    return interval[0]

def thread_count():
    return len(_threads)

def request(method, path, headers, body):
    head = f"{method} {path} HTTP/1.1\r\nHost: localhost\r\n"
    for k, v in headers.items():
        head += f"{k}: {v}\r\n"
    raw = head.encode() + f"Content-Length: {len(body)}\r\n\r\n".encode() + bytes(body)
    sock = _Sock(raw)
    _handler[0](sock, ("127.0.0.1", 50000), _Server())
    return bytes(sock.out)
`;

  let py, persistTimer;
  const persist = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => py.FS.syncfs(false, () => {}), 300);
  };

  const ready = (async () => {
    await new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = PYODIDE + "pyodide.js"; s.onload = ok; s.onerror = () => fail(new Error("pyodide.js"));
      document.head.append(s);
    });
    say("Завантаження Python… / Loading Python…");
    py = await loadPyodide({ indexURL: PYODIDE });
    const code = await (await realFetch(SERVER, { cache: "no-store" })).text();
    await py.loadPackagesFromImports(code);

    // Файли сервера живуть в IndexedDB, щоб збереження гри переживали перезавантаження
    py.FS.mkdirTree(MOUNT);
    py.FS.mount(py.FS.filesystems.IDBFS, {}, MOUNT);
    await new Promise(ok => py.FS.syncfs(true, ok));
    const file = MOUNT + "/" + SERVER.split("/").pop();
    py.FS.writeFile(file, code);

    say("Запуск сервера… / Starting the server…");
    py.runPython(PY);
    const ns = py.globals;
    if (!ns.get("boot")(file)) throw new Error("server.py не створив HTTP-сервер");
    persist();

    // Фонові потоки (ринок тощо): одна ітерація з тим інтервалом, який просить сам код
    for (let i = 0, n = ns.get("thread_count")(); i < n; i++) {
      const step = () => ns.get("tick")(i);
      const sec = step();
      if (typeof sec === "number" && sec > 0) setInterval(() => { step(); persist(); }, sec * 1000);
    }
    veil.remove();
    return ns.get("request");
  })();

  ready.catch(err => {
    console.error("[pybridge]", err);
    say("Не вдалося запустити Python-сервер. / Could not start the Python server. " + err.message);
  });

  // Запит до /api/... (або інших адрес, яких немає у статиці) іде в Python
  const isApi = url => {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin) return null;
    if (/^\/api\//.test(u.pathname)) return u.pathname + u.search;
    if (u.pathname.startsWith(pageDir + "api/")) return "/" + u.pathname.slice(pageDir.length) + u.search;
    return null;
  };

  window.fetch = async (input, init = {}) => {
    const req = input instanceof Request ? input : null;
    const path = isApi(req ? req.url : String(input));
    if (!path) return realFetch(input, init);
    const handle = await ready;
    const method = (init.method || req?.method || "GET").toUpperCase();
    const headers = {};
    new Headers(init.headers || req?.headers || {}).forEach((v, k) => { if (k !== "content-length") headers[k] = v; });
    let body = init.body ?? (req && method !== "GET" ? await req.clone().arrayBuffer() : null);
    if (typeof body === "string") body = new TextEncoder().encode(body);
    else if (body instanceof ArrayBuffer) body = new Uint8Array(body);
    else if (body && !(body instanceof Uint8Array)) body = new TextEncoder().encode(String(body));
    const raw = handle(method, path, py.toPy(headers), py.toPy(body || new Uint8Array()));
    const bytes = raw.toJs(); raw.destroy?.();
    if (method !== "GET") persist();

    // Розбір HTTP-відповіді, яку написав обробник
    let split = 0;
    for (; split < bytes.length - 3; split++) if (bytes[split] === 13 && bytes[split + 1] === 10 && bytes[split + 2] === 13 && bytes[split + 3] === 10) break;
    const lines = new TextDecoder().decode(bytes.slice(0, split)).split("\r\n");
    const status = +lines[0].split(" ")[1] || 200;
    const h = new Headers();
    lines.slice(1).forEach(l => { const i = l.indexOf(":"); if (i > 0) h.append(l.slice(0, i).trim(), l.slice(i + 1).trim()); });
    h.delete("content-length");
    const payload = [204, 304].includes(status) ? null : bytes.slice(split + 4);
    return new Response(payload, { status, headers: h });
  };
})();
