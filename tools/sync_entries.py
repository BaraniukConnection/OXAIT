#!/usr/bin/env python3
"""Копіює роботи учасників з робочої папки в entries/ і складає entries/manifest.js.

Структура джерела:  <SOURCE>/<раунд>/<учасник>/<проєкт>
  раунд     — Q1, SEC1, Q2, SEC2, Q3, SEC3, SEC4, SEC5, SEC6 (регістр і дефіси не важливі)
  учасник   — Claude, ChatGPT, Gemini, Grok, GLM (або ZAI), QWEN
  проєкт    — файл (.html, зображення, відео, .glb/.gltf, .md/.txt) або папка з index.html
              (у корені чи в static/). Якщо поруч лежить server.py з власним HTTP-обробником,
              у копію index.html підключається assets/js/pybridge.js — сервер запускається
              в браузері через Pyodide, бо GitHub Pages не виконує Python.

Запуск:  python3 tools/sync_entries.py [SOURCE]
"""
import html
import json
import os
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import quote, unquote

SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else "/mnt/a44cd674-0a24-4dfd-97d2-d19af3b984f6/HDDWork/OXAIT")
ROOT = Path(__file__).resolve().parent.parent
ENTRIES = ROOT / "entries"

ROUNDS = {
    "q1": "gamedev/q1", "sec1": "gamedev/sec1",
    "q2": "software/q2", "sec2": "software/sec2",
    "q3": "modeling/q3", "sec3": "modeling/sec3",
    "sec4": "analysis/sec4", "sec5": "writing/sec5", "sec6": "imagegen/sec6",
}
PARTICIPANTS = {
    "claude": "claude", "chatgpt": "chatgpt", "gpt": "chatgpt", "openai": "chatgpt",
    "gemini": "gemini", "grok": "grok", "glm": "glm", "zai": "glm", "qwen": "qwen",
}
TYPES = {
    ".html": "iframe", ".htm": "iframe",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image", ".gif": "image", ".svg": "image",
    ".mp4": "video", ".webm": "video",
    ".glb": "model", ".gltf": "model",
    ".md": "text", ".txt": "text",
}

key = lambda name: re.sub(r"[^a-z0-9]", "", name.lower())


def pretty(stem):
    """snake3D → Snake 3D, tetris_ultimate → Tetris Ultimate"""
    s = re.sub(r"[_\-]+", " ", stem)
    s = re.sub(r"(?<=[a-z])(?=\d)", " ", s)
    return " ".join(w[:1].upper() + w[1:] for w in s.split())


def title_of(path, fallback):
    try:
        m = re.search(r"<title[^>]*>(.*?)</title>", path.read_text(errors="ignore"), re.I | re.S)
    except OSError:
        m = None
    t = html.unescape(m.group(1)).strip() if m else ""
    return t or pretty(fallback)


def find_server(folder):
    """server.py з власним обробником (do_GET/do_POST) — йому потрібен Python, а не лише статика."""
    for py in sorted(list(folder.glob("*.py")) + list(folder.glob("*/*.py"))):
        code = py.read_text(errors="ignore")
        if "http.server" in code and re.search(r"def do_(GET|POST)\b", code):
            return py
    return None


def find_entry(folder):
    for rel in ("index.html", "static/index.html", "public/index.html", "web/index.html"):
        if (folder / rel).exists():
            return folder / rel
    # будь-яка підпапка першого рівня з index.html (наприклад game/), крім бібліотек
    found = [p for p in sorted(folder.glob("*/index.html")) if p.parent.name.lower() not in ("vendor", "node_modules", "lib", "libs")]
    return found[0] if found else None


def rel(target, start):
    return Path(os.path.relpath(target, start)).as_posix()


def prepare_python(entry, server):
    """Копія для GitHub Pages: шляхи від кореня сервера → відносні, плюс pybridge першим скриптом."""
    root = entry.parent
    for f in list(root.rglob("*.html")) + list(root.rglob("*.css")):
        prefix = rel(root, f.parent)
        prefix = "" if prefix == "." else prefix + "/"
        text = f.read_text(errors="ignore")
        text = re.sub(r'((?:src|href)=["\'])/(?!/)', lambda m: m.group(1) + prefix, text)
        text = re.sub(r'(url\(\s*["\']?)/(?!/)', lambda m: m.group(1) + prefix, text)
        f.write_text(text)
    tag = f'<script src="{rel(ROOT / "assets/js/pybridge.js", root)}" data-server="{rel(server, root)}"></script>'
    text = entry.read_text(errors="ignore")
    text, n = re.subn(r"(<head[^>]*>)", lambda m: m.group(1) + "\n" + tag, text, count=1, flags=re.I)
    entry.write_text(text if n else tag + "\n" + text)


def url(path):
    return "/".join(quote(p) for p in path.relative_to(ROOT).parts)


def main():
    if not SOURCE.is_dir():
        sys.exit(f"Немає папки {SOURCE}")
    manifest, copied = {}, 0
    for rdir in sorted(p for p in SOURCE.iterdir() if p.is_dir()):
        target_round = ROUNDS.get(key(rdir.name))
        if not target_round:
            print(f"  пропускаю {rdir.name}: невідомий раунд")
            continue
        for pdir in sorted(p for p in rdir.iterdir() if p.is_dir()):
            pid = PARTICIPANTS.get(key(pdir.name))
            if not pid:
                print(f"  пропускаю {rdir.name}/{pdir.name}: невідомий учасник")
                continue
            dest = ENTRIES / target_round / pid
            shutil.rmtree(dest, ignore_errors=True)
            shutil.copytree(pdir, dest, ignore=shutil.ignore_patterns(".*", "__pycache__", "*.pyc", "*.zip", "*.rar", "*.7z", "*.tar*"))
            items = []
            for item in sorted(dest.iterdir(), key=lambda p: p.name.lower()):
                entry = item.is_dir() and find_entry(item)
                if entry:
                    rec = {"type": "iframe", "title": title_of(entry, item.name), "src": url(entry), "size": sum(f.stat().st_size for f in item.rglob("*") if f.is_file())}
                    server = find_server(item)
                    if server:
                        prepare_python(entry, server)
                        rec["python"] = True
                    items.append(rec)
                elif item.is_file() and item.suffix.lower() in TYPES:
                    kind = TYPES[item.suffix.lower()]
                    rec = {"type": kind, "title": title_of(item, item.stem) if kind == "iframe" else pretty(item.stem), "src": url(item), "size": item.stat().st_size}
                    if kind == "text":
                        rec["text"] = item.read_text(errors="ignore")
                    items.append(rec)
            for i, rec in enumerate(items):
                src = Path(unquote(rec["src"]))
                if src.stem == "index":
                    src = Path(*src.parts[:5])  # entries/<stage>/<round>/<учасник>/<проєкт>
                rec["id"] = key(src.stem if src.suffix else src.name) or str(i)
            manifest.setdefault(target_round, {})[pid] = items
            copied += len(items)
            print(f"  {target_round}/{pid}: {', '.join(r['title'] for r in items) or '—'}")
    (ENTRIES / "manifest.js").write_text(
        "/* Згенеровано tools/sync_entries.py — не редагуй вручну. */\n"
        f"window.OXAIT_ENTRIES = {json.dumps(manifest, ensure_ascii=False, indent=2)};\n")
    print(f"Готово: {copied} проєктів → entries/manifest.js")


if __name__ == "__main__":
    main()
