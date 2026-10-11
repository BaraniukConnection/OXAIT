#!/usr/bin/env python3
"""CS Case Simulator - self-hosted local server.

Serves the 3D client from ./static and a small JSON API:
  GET  /api/catalog   weapons, skins, cases (static data)
  GET  /api/state     balance, owned cases, inventory, stats
  GET  /api/market    live skin prices + history + news
  POST /api/buy       {"case": id, "qty": n}
  POST /api/open      {"case": id}
  POST /api/sell      {"uids": [...]}
  POST /api/reset

Market prices drift in a background thread. Every weapon type and every
rarity tier has its own demand factor (with its own volatility) and every
skin has a small individual factor, so prices move up and down depending on
weapon type and rarity. Selling pushes a skin's price down a little.
"""
import argparse
import hashlib
import json
import os
import random
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
SAVE_FILE = ROOT / "savegame.json"

START_BALANCE = 1500.0
TICK_SECONDS = 4.0
HISTORY_LEN = 90

# ---------------------------------------------------------------- catalog

WEAPONS = [
    # id, display name, type, popularity multiplier
    ("m4a1", "M4A1", "rifle", 1.05),
    ("ak47", "AK-47", "rifle", 1.12),
    ("deagle", "Desert Eagle", "pistol", 1.30),
    ("glock", "Glock-18", "pistol", 0.90),
    ("mp5", "MP5", "smg", 0.95),
    ("p90", "P90", "smg", 1.05),
    ("benelli", "Benelli M4", "shotgun", 1.05),
    ("nova", "Nova", "shotgun", 0.92),
    ("m249", "M249", "lmg", 1.00),
    ("negev", "Negev", "lmg", 0.95),
]

TYPE_MULT = {"rifle": 1.35, "pistol": 0.75, "smg": 0.90, "shotgun": 1.00, "lmg": 1.10}
TYPE_LABEL = {"rifle": "Rifles", "pistol": "Pistols", "smg": "SMGs", "shotgun": "Shotguns", "lmg": "LMGs"}
TYPE_VOL = {"rifle": 0.010, "pistol": 0.007, "smg": 0.008, "shotgun": 0.008, "lmg": 0.011}

RARITIES = {
    #             base price, drop weight, market volatility
    "common":    {"base": 18,   "weight": 65, "vol": 0.004, "label": "Common"},
    "rare":      {"base": 75,   "weight": 24, "vol": 0.007, "label": "Rare"},
    "epic":      {"base": 320,  "weight": 8,  "vol": 0.011, "label": "Epic"},
    "legendary": {"base": 2600, "weight": 3,  "vol": 0.016, "label": "Legendary"},
}

WEARS = [
    # name, short, float range, drop weight, price multiplier
    ("Factory New", "FN", 0.00, 0.07, 15, 1.00),
    ("Minimal Wear", "MW", 0.07, 0.15, 25, 0.88),
    ("Field-Tested", "FT", 0.15, 0.38, 35, 0.75),
    ("Well-Worn", "WW", 0.38, 0.45, 12, 0.65),
    ("Battle-Scarred", "BS", 0.45, 1.00, 13, 0.55),
]
WEAR_MULT = {w[0]: w[5] for w in WEARS}

# 7 designs per weapon: 5 patterns (2 common, 2 rare, 1 epic) and
# 2 unique geometric designs (legendary). Each design has 2 color variants.
SLOTS = [("common", "camo"), ("common", "digital"), ("rare", "tiger"),
         ("rare", "carbon"), ("epic", "fade"), ("legendary", None), ("legendary", None)]

DESIGNS = {
    "m4a1":    ["Urban Patrol", "Byte Storm", "Night Prowler", "Kevlar Ghost", "Ocean Fade",
                ("Sacred Orbit", "mandala"), ("Cubic Matrix", "isocube")],
    "ak47":    ["Jungle Drift", "Static Grid", "Sabretooth", "Blackweave", "Molten Core",
                ("Prism Tyrant", "prism"), ("Hex Reactor", "hexcore")],
    "deagle":  ["Sandstorm", "Pixel Mirage", "Tiger King", "Obsidian Mesh", "Sunset Blaze",
                ("Shattered Glass", "shards"), ("Hypnotica", "spiral")],
    "glock":   ["Forest Floor", "Bitcrush", "Feral", "Carbon Rush", "Candy Fade",
                ("Op Art", "opwave"), ("Kaleidoscope", "kaleido")],
    "mp5":     ["Swamp Runner", "Low Res", "Stripe Hunter", "Graphite", "Toxic Fade",
                ("Circuit Breaker", "circuit"), ("Prism Shift", "prism")],
    "p90":     ["Wasteland", "Glitch", "Scratch", "Woven Steel", "Nebula Fade",
                ("Honeycomb Fury", "hexcore"), ("Shard Storm", "shards")],
    "benelli": ["Marsh", "Blockade", "Predator", "Fibre Optic", "Ember Fade",
                ("Mandala Bloom", "mandala"), ("Vortex", "spiral")],
    "nova":    ["Bog Walker", "Mosaic", "Wildcat", "Dark Weave", "Aurora Fade",
                ("Isometric Dream", "isocube"), ("Wave Theory", "opwave")],
    "m249":    ["Overgrowth", "Datastream", "Bengal", "Ballistic", "Lava Fade",
                ("Kaleido Burst", "kaleido"), ("Neural Net", "circuit")],
    "negev":   ["Thicket", "8-Bit War", "Clawmark", "Monolith Weave", "Plasma Fade",
                ("Crystal Lattice", "shards"), ("Infinite Rings", "mandala")],
}

PALETTES = {
    "camo": [
        ("Woodland", ["#3b4a2a", "#5c6b3a", "#2a2a1e", "#8a8558"]),
        ("Desert", ["#c2a878", "#9c7b4f", "#6e5638", "#e0cfa4"]),
        ("Arctic", ["#e8edf0", "#b8c4cc", "#7d8a94", "#4a555c"]),
        ("Urban", ["#5a5e63", "#8a8f94", "#2e3135", "#b5b9bd"]),
        ("Jungle", ["#1f3d1f", "#3f6b2a", "#7a9a3a", "#13241a"]),
        ("Midnight", ["#1a1d2e", "#2e3350", "#0c0d14", "#474e78"]),
        ("Bloodline", ["#5a0f12", "#8a1a1e", "#2a0a0a", "#c03030"]),
    ],
    "digital": [
        ("Cobalt", ["#1d3b6e", "#2e5aa8", "#0f1c33", "#6a8fd0"]),
        ("Dune", ["#b89a6a", "#8a6e44", "#d8c49a", "#5a4a30"]),
        ("Forest", ["#2a4a2a", "#3e6a3a", "#1a2a18", "#6a8a4a"]),
        ("Ash", ["#3a3a3a", "#5a5a5a", "#1e1e1e", "#8a8a8a"]),
        ("Red Alert", ["#7a1010", "#b02020", "#2a0808", "#e05050"]),
        ("Toxic", ["#2a4a10", "#5a9a10", "#0e1a06", "#a0e020"]),
        ("Glacier", ["#a8d0e8", "#6aa0c8", "#e8f4fa", "#3a6a8a"]),
    ],
    "tiger": [
        ("Amber", ["#e8902a", "#151008", "#ffb84d"]),
        ("Snow", ["#e9eef2", "#1b1f24", "#9fb1c0"]),
        ("Crimson", ["#a8141c", "#0e0a0a", "#ff4a4a"]),
        ("Jade", ["#1f8a5a", "#08140e", "#4fe0a0"]),
        ("Violet", ["#6a2ab0", "#0d0814", "#b07aff"]),
        ("Gold", ["#d4a020", "#1a1206", "#ffe080"]),
        ("Azure", ["#2a7ad0", "#06101c", "#7ac0ff"]),
    ],
    "carbon": [
        ("Stealth", ["#151515", "#2c2c2c", "#4a4a4a"]),
        ("Cobalt", ["#0e1830", "#1d3260", "#3a64c0"]),
        ("Inferno", ["#2a0b0b", "#5a1414", "#c02a2a"]),
        ("Venom", ["#0b2010", "#145a22", "#2ac050"]),
        ("Gilded", ["#2a2010", "#5a4518", "#d4a838"]),
        ("Chrome", ["#3a3e44", "#6a7078", "#c8d0d8"]),
        ("Amethyst", ["#1a0b2a", "#3a1a5a", "#9a5ae0"]),
    ],
    "fade": [
        ("Sunset", ["#ff5e3a", "#ff2a68", "#ffcb3a"]),
        ("Ocean", ["#00c6ff", "#0072ff", "#7a2aff"]),
        ("Candy", ["#ff7ad9", "#a07aff", "#7af0ff"]),
        ("Acid", ["#a8ff3a", "#00d48a", "#00406a"]),
        ("Ember", ["#ff3a1a", "#ff9a1a", "#2a0a0a"]),
        ("Aurora", ["#3affc8", "#3a8aff", "#c03aff"]),
        ("Nebula", ["#2a0a5a", "#ff3ad0", "#3ad0ff"]),
    ],
    "legendary": [
        ("Gilded", ["#0b0b0f", "#e4ae39", "#fff3c4"]),
        ("Emerald", ["#04140e", "#1ee08a", "#c8ffe8"]),
        ("Crimson", ["#120406", "#ff2a3a", "#ffd0d4"]),
        ("Neon", ["#04101a", "#00e5ff", "#ff2ad4"]),
        ("Royal", ["#0c0618", "#8a4aff", "#ffd23a"]),
        ("Glacier", ["#e8f6ff", "#4ab0ff", "#0a2a4a"]),
        ("Solar", ["#1a0a00", "#ff8a00", "#ffe600"]),
        ("Radioactive", ["#0a1200", "#9aff00", "#00ffb0"]),
        ("Vaporwave", ["#1a0830", "#ff6ad5", "#26f7fd"]),
        ("Blood Moon", ["#050000", "#b0001a", "#ff7a00"]),
        ("Obsidian", ["#000000", "#ffffff", "#7a7a7a"]),
    ],
}

CASES = [
    {"id": "assault", "name": "Assault Case", "price": 170, "weapons": ["m4a1", "ak47"], "color": "#c0392b"},
    {"id": "pistol", "name": "Pistol Case", "price": 100, "weapons": ["deagle", "glock"], "color": "#2980b9"},
    {"id": "smg", "name": "SMG Case", "price": 130, "weapons": ["mp5", "p90"], "color": "#27ae60"},
    {"id": "shotgun", "name": "Shotgun Case", "price": 150, "weapons": ["benelli", "nova"], "color": "#d35400"},
    {"id": "lmg", "name": "LMG Case", "price": 160, "weapons": ["m249", "negev"], "color": "#7f8c8d"},
    {"id": "legendary", "name": "Legendary Case", "price": 2500, "weapons": [w[0] for w in WEAPONS],
     "color": "#e4ae39", "legendaryOnly": True},
]
CASE_BY_ID = {c["id"]: c for c in CASES}


def seeded(key: str) -> random.Random:
    return random.Random(int(hashlib.md5(key.encode()).hexdigest()[:12], 16))


def build_skins():
    skins = []
    for wi, (wid, wname, wtype, pop) in enumerate(WEAPONS):
        for di, (rarity, pattern) in enumerate(SLOTS):
            design = DESIGNS[wid][di]
            if isinstance(design, tuple):
                design, pattern = design
                pool = PALETTES["legendary"]
                # two distinct legendary palettes per design, different per weapon
                picks = [pool[(wi * 3 + di * 5) % len(pool)], pool[(wi * 3 + di * 5 + 4) % len(pool)]]
            else:
                pool = PALETTES[pattern]
                picks = [pool[(wi * 2 + di) % len(pool)], pool[(wi * 2 + di + 3) % len(pool)]]
            for vi, (vname, colors) in enumerate(picks):
                sid = f"{wid}_{di}_{vi}"
                rng = seeded(sid)
                base = RARITIES[rarity]["base"] * TYPE_MULT[wtype] * pop * rng.uniform(0.85, 1.3)
                skins.append({
                    "id": sid, "weapon": wid, "weaponName": wname, "type": wtype,
                    "design": design, "variant": vname, "pattern": pattern,
                    "colors": colors, "rarity": rarity, "seed": rng.randint(1, 10 ** 6),
                    "name": f"{wname} | {design} ({vname})",
                    "basePrice": round(base, 2),
                })
    return skins


SKINS = build_skins()
SKIN_BY_ID = {s["id"]: s for s in SKINS}


def case_pool(case):
    pool = [s for s in SKINS if s["weapon"] in case["weapons"]]
    if case.get("legendaryOnly"):
        pool = [s for s in pool if s["rarity"] == "legendary"]
    return pool


def case_odds(case):
    pool = case_pool(case)
    present = {s["rarity"] for s in pool}
    total = sum(RARITIES[r]["weight"] for r in present)
    return {r: RARITIES[r]["weight"] / total for r in RARITIES if r in present}


CATALOG = {
    "weapons": [{"id": w[0], "name": w[1], "type": w[2]} for w in WEAPONS],
    "types": TYPE_LABEL,
    "rarities": {k: {"label": v["label"]} for k, v in RARITIES.items()},
    "wears": [{"name": w[0], "short": w[1], "min": w[2], "max": w[3], "mult": w[5]} for w in WEARS],
    "skins": SKINS,
    "cases": [dict(c, odds=case_odds(c), pool=[s["id"] for s in case_pool(c)]) for c in CASES],
}

# ---------------------------------------------------------------- state

LOCK = threading.RLock()


def new_market():
    return {
        "type": {t: 1.0 for t in TYPE_MULT},
        "rarity": {r: 1.0 for r in RARITIES},
        "skin": {s["id"]: 1.0 for s in SKINS},
        "history": {},
        "index": {},
        "news": [],
        "tick": 0,
    }


def new_state():
    return {
        "balance": START_BALANCE,
        "cases": {c["id"]: 0 for c in CASES},
        "inventory": [],
        "stats": {"opened": 0, "spent": 0.0, "earned": 0.0, "best": None},
        "market": new_market(),
    }


def load_state():
    if SAVE_FILE.exists():
        try:
            st = json.loads(SAVE_FILE.read_text())
            base = new_state()
            for k, v in base.items():
                st.setdefault(k, v)
            for k, v in base["market"].items():
                st["market"].setdefault(k, v)
            for sid in SKIN_BY_ID:
                st["market"]["skin"].setdefault(sid, 1.0)
            for cid in CASE_BY_ID:
                st["cases"].setdefault(cid, 0)
            st["inventory"] = [i for i in st["inventory"] if i["skin"] in SKIN_BY_ID]
            return st
        except Exception as e:  # corrupt save -> start fresh
            print("Could not read save file, starting fresh:", e)
    return new_state()


STATE = load_state()
_dirty = False


def save_state():
    global _dirty
    tmp = SAVE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(STATE))
    os.replace(tmp, SAVE_FILE)
    _dirty = False


def price_of(sid):
    m = STATE["market"]
    s = SKIN_BY_ID[sid]
    return round(s["basePrice"] * m["type"][s["type"]] * m["rarity"][s["rarity"]] * m["skin"][sid], 2)


def item_value(item):
    return round(price_of(item["skin"]) * WEAR_MULT[item["wear"]], 2)


def add_news(text, kind="info"):
    news = STATE["market"]["news"]
    news.insert(0, {"t": time.time(), "text": text, "kind": kind})
    del news[30:]


def record_history():
    m = STATE["market"]
    for sid in SKIN_BY_ID:
        h = m["history"].setdefault(sid, [])
        h.append(price_of(sid))
        del h[:-HISTORY_LEN]
    for key, val in list(m["type"].items()) + list(m["rarity"].items()):
        h = m["index"].setdefault(key, [])
        h.append(round(val, 4))
        del h[:-HISTORY_LEN]


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def market_tick():
    """One step of the price simulation (mean-reverting random walks + shocks)."""
    global _dirty
    m = STATE["market"]
    for t in m["type"]:
        f = m["type"][t]
        m["type"][t] = clamp(f + 0.04 * (1 - f) + random.gauss(0, TYPE_VOL[t]), 0.5, 2.0)
    for r in m["rarity"]:
        f = m["rarity"][r]
        m["rarity"][r] = clamp(f + 0.04 * (1 - f) + random.gauss(0, RARITIES[r]["vol"]), 0.5, 2.2)
    for sid in m["skin"]:
        f = m["skin"][sid]
        vol = 0.005 + RARITIES[SKIN_BY_ID[sid]["rarity"]]["vol"] * 0.4
        m["skin"][sid] = clamp(f + 0.07 * (1 - f) + random.gauss(0, vol), 0.6, 1.6)

    # occasional market events
    if random.random() < 0.035:
        up = random.random() < 0.5
        size = random.uniform(0.05, 0.15)
        if random.random() < 0.6:
            t = random.choice(list(TYPE_MULT))
            m["type"][t] = clamp(m["type"][t] * (1 + size if up else 1 - size), 0.5, 2.0)
            msg = random.choice(
                ["Pro team switches to {x}", "Tournament meta favours {x}", "Streamers hyping {x}"] if up else
                ["Balance patch nerfs {x}", "{x} market flooded", "Players dumping {x}"]).format(x=TYPE_LABEL[t])
        else:
            r = random.choice(list(RARITIES))
            m["rarity"][r] = clamp(m["rarity"][r] * (1 + size if up else 1 - size), 0.5, 2.2)
            msg = random.choice(
                ["Collectors buying {x} skins", "{x} skins trending"] if up else
                ["Sell-off hits {x} skins", "{x} skins lose appeal"]).format(x=RARITIES[r]["label"])
        add_news(f"{msg} ({'+' if up else '-'}{size * 100:.0f}%)", "up" if up else "down")
    m["tick"] += 1
    record_history()
    _dirty = True


def market_loop():
    last_save = time.time()
    while True:
        time.sleep(TICK_SECONDS)
        with LOCK:
            market_tick()
            if time.time() - last_save > 20:
                save_state()
                last_save = time.time()


# ---------------------------------------------------------------- game logic

def roll_wear():
    w = random.choices(WEARS, weights=[x[4] for x in WEARS])[0]
    return w[0], round(random.uniform(w[2], w[3]), 6)


def roll_skin(case):
    pool = case_pool(case)
    odds = case_odds(case)
    rarity = random.choices(list(odds), weights=list(odds.values()))[0]
    return random.choice([s for s in pool if s["rarity"] == rarity])


def public_state():
    inv = [dict(i, value=item_value(i)) for i in STATE["inventory"]]
    return {
        "balance": round(STATE["balance"], 2),
        "cases": STATE["cases"],
        "inventory": inv,
        "inventoryValue": round(sum(i["value"] for i in inv), 2),
        "stats": STATE["stats"],
    }


def api_buy(body):
    case = CASE_BY_ID.get(body.get("case"))
    qty = int(body.get("qty", 1))
    if not case or not 1 <= qty <= 100:
        return 400, {"error": "Invalid case or quantity"}
    cost = case["price"] * qty
    if STATE["balance"] + 1e-9 < cost:
        return 400, {"error": "Not enough funds"}
    STATE["balance"] -= cost
    STATE["cases"][case["id"]] += qty
    STATE["stats"]["spent"] += cost
    return 200, {"ok": True, "state": public_state()}


def api_open(body):
    case = CASE_BY_ID.get(body.get("case"))
    if not case:
        return 400, {"error": "Invalid case"}
    if STATE["cases"].get(case["id"], 0) < 1:
        return 400, {"error": "You don't own this case"}
    STATE["cases"][case["id"]] -= 1
    skin = roll_skin(case)
    wear, flt = roll_wear()
    item = {"uid": uuid.uuid4().hex[:12], "skin": skin["id"], "wear": wear, "float": flt,
            "case": case["id"], "ts": time.time()}
    STATE["inventory"].append(item)
    STATE["stats"]["opened"] += 1
    value = item_value(item)
    best = STATE["stats"]["best"]
    if not best or value > best["value"]:
        STATE["stats"]["best"] = {"skin": skin["id"], "wear": wear, "value": value}
    if skin["rarity"] == "legendary":
        add_news(f"Someone unboxed {skin['name']}!", "drop")
    # reel for the opening animation; the winner sits at index WIN
    reel = [roll_skin(case)["id"] for _ in range(60)]
    win = 52
    reel[win] = skin["id"]
    return 200, {"item": dict(item, value=value), "reel": reel, "win": win, "state": public_state()}


def api_sell(body):
    uids = set(body.get("uids") or [])
    if not uids:
        return 400, {"error": "Nothing to sell"}
    keep, earned, sold = [], 0.0, 0
    m = STATE["market"]
    for item in STATE["inventory"]:
        if item["uid"] in uids:
            earned += item_value(item)
            sold += 1
            s = SKIN_BY_ID[item["skin"]]
            m["skin"][s["id"]] = clamp(m["skin"][s["id"]] * 0.985, 0.6, 1.6)  # supply pressure
            m["rarity"][s["rarity"]] = clamp(m["rarity"][s["rarity"]] * 0.999, 0.5, 2.2)
        else:
            keep.append(item)
    STATE["inventory"] = keep
    STATE["balance"] += earned
    STATE["stats"]["earned"] += earned
    return 200, {"ok": True, "sold": sold, "earned": round(earned, 2), "state": public_state()}


def api_market():
    m = STATE["market"]
    return {
        "prices": {sid: price_of(sid) for sid in SKIN_BY_ID},
        "history": m["history"],
        "factors": {"type": m["type"], "rarity": m["rarity"]},
        "index": m["index"],
        "news": m["news"],
        "tick": m["tick"],
        "tickSeconds": TICK_SECONDS,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(STATIC), **kw)

    def log_message(self, fmt, *args):
        if not self.path.startswith("/api/"):
            return
        super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/catalog":
            return self.send_json(200, CATALOG)
        if path == "/api/state":
            with LOCK:
                return self.send_json(200, public_state())
        if path == "/api/market":
            with LOCK:
                return self.send_json(200, api_market())
        return super().do_GET()

    def do_POST(self):
        global STATE
        path = self.path.split("?")[0]
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self.send_json(400, {"error": "Bad JSON"})
        routes = {"/api/buy": api_buy, "/api/open": api_open, "/api/sell": api_sell}
        with LOCK:
            if path == "/api/reset":
                market = STATE["market"]
                STATE = new_state()
                STATE["market"] = market
                save_state()
                return self.send_json(200, {"ok": True, "state": public_state()})
            if path not in routes:
                return self.send_json(404, {"error": "Not found"})
            code, res = routes[path](body)
            if code == 200:
                save_state()
            return self.send_json(code, res)


def main():
    ap = argparse.ArgumentParser(description="CS Case Simulator server")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8777)
    args = ap.parse_args()
    with LOCK:
        if not STATE["market"]["history"]:
            for _ in range(40):  # warm up a little price history
                market_tick()
    threading.Thread(target=market_loop, daemon=True).start()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"CS Case Simulator running at http://{args.host}:{args.port}  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        with LOCK:
            save_state()


if __name__ == "__main__":
    main()
