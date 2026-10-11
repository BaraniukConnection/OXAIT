#!/usr/bin/env python3
"""
CS:GO Case Simulator - Self-hosted Local Python Server
Provides REST API for:
- Economy / User Balance
- Case Buying & Odds-calculated Case Opening
- Dynamic Skin Market with Real-time Price Fluctuations
- Inventory Management & Selling
- SQLite persistence
"""

import json
import math
import os
import random
import sqlite3
import sys
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import parse_qs, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "csgo_sim.db")

# ---------------------------------------------------------------------------
# DATA DEFINITIONS: 10 WEAPONS & SKINS
# ---------------------------------------------------------------------------
# Weapons categorized into case types:
# Assault: M4A1, Ak47
# Pistol: Desert Eagle, Glock
# SMG: MP5, P90
# Shotgun: BenelliM4, Nova
# LMG: M249, Negev

WEAPONS = {
    "M4A1": {"category": "Assault", "label": "M4A1-S", "multiplier": 1.25},
    "Ak47": {"category": "Assault", "label": "AK-47", "multiplier": 1.35},
    "Desert Eagle": {"category": "Pistol", "label": "Desert Eagle", "multiplier": 1.15},
    "Glock": {"category": "Pistol", "label": "Glock-18", "multiplier": 1.0},
    "MP5": {"category": "SMG", "label": "MP5-SD", "multiplier": 1.05},
    "P90": {"category": "SMG", "label": "P90", "multiplier": 1.0},
    "BenelliM4": {"category": "Shotgun", "label": "Benelli M4", "multiplier": 0.95},
    "Nova": {"category": "Shotgun", "label": "Nova", "multiplier": 0.90},
    "M249": {"category": "LMG", "label": "M249", "multiplier": 0.90},
    "Negev": {"category": "LMG", "label": "Negev", "multiplier": 0.95},
}

# 5 Skin Patterns with 2 color variants and 2 unique geometric designs
# Rarity distribution: 2 Common, 2 Rare, 1 Epic, 2 Legendary = 7 distinct skins per weapon!
SKIN_TEMPLATES = [
    {
        "id_suffix": "p1_v1",
        "pattern": "Digital Grid",
        "name": "Urban Ghost",
        "variant": "Urban Silver / Carbon",
        "geom_design": "Hexagonal Grid",
        "rarity": "Common",
        "base_price": 9.50,
        "primary_color": "#2a313d",
        "secondary_color": "#8b9bb4",
        "accent_color": "#4da6ff",
    },
    {
        "id_suffix": "p1_v2",
        "pattern": "Digital Grid",
        "name": "Tundra Splinter",
        "variant": "Forest Moss / Slate",
        "geom_design": "Splinter Triangle Shards",
        "rarity": "Common",
        "base_price": 12.00,
        "primary_color": "#28382c",
        "secondary_color": "#5b755d",
        "accent_color": "#94b88d",
    },
    {
        "id_suffix": "p2_v1",
        "pattern": "Cyber Net",
        "name": "Neon Pulse",
        "variant": "Cyber Cyan / Magenta",
        "geom_design": "Vector Circuit Traces",
        "rarity": "Rare",
        "base_price": 48.00,
        "primary_color": "#0d1b2a",
        "secondary_color": "#00f0ff",
        "accent_color": "#ff007f",
    },
    {
        "id_suffix": "p2_v2",
        "pattern": "Cyber Net",
        "name": "Acid Matrix",
        "variant": "Toxic Lime / Onyx",
        "geom_design": "Chevron Data Glitch",
        "rarity": "Rare",
        "base_price": 62.00,
        "primary_color": "#121914",
        "secondary_color": "#39ff14",
        "accent_color": "#a1ff0a",
    },
    {
        "id_suffix": "p3_v1",
        "pattern": "Dragon Inferno",
        "name": "Solar Flare",
        "variant": "Molten Crimson / Ember",
        "geom_design": "Dragon Scale Waves",
        "rarity": "Epic",
        "base_price": 240.00,
        "primary_color": "#400808",
        "secondary_color": "#ff3b00",
        "accent_color": "#ffae00",
    },
    {
        "id_suffix": "p4_v1",
        "pattern": "Poly-Tech",
        "name": "Hyper Hazard",
        "variant": "Hazard Orange / Ceramic White",
        "geom_design": "Asymmetric Poly Angles",
        "rarity": "Legendary",
        "base_price": 1450.00,
        "primary_color": "#ededed",
        "secondary_color": "#ff6600",
        "accent_color": "#1a1a1a",
    },
    {
        "id_suffix": "p5_v2",
        "pattern": "Royal Damascus",
        "name": "Imperial Obsidian",
        "variant": "Void Gold / Damascus Onyx",
        "geom_design": "Guilloche Damask Lattice",
        "rarity": "Legendary",
        "base_price": 1950.00,
        "primary_color": "#0e1017",
        "secondary_color": "#ffd700",
        "accent_color": "#b8860b",
    },
]

# Generate all 70 unique skins catalogue
ALL_SKINS = {}
for w_id, w_info in WEAPONS.items():
    for tmpl in SKIN_TEMPLATES:
        skin_id = f"{w_id}_{tmpl['id_suffix']}"
        full_name = f"{w_info['label']} | {tmpl['name']}"
        base_val = round(tmpl["base_price"] * w_info["multiplier"], 2)
        ALL_SKINS[skin_id] = {
            "id": skin_id,
            "weapon": w_id,
            "weapon_label": w_info["label"],
            "category": w_info["category"],
            "pattern": tmpl["pattern"],
            "name": tmpl["name"],
            "full_name": full_name,
            "variant": tmpl["variant"],
            "geom_design": tmpl["geom_design"],
            "rarity": tmpl["rarity"],
            "base_price": base_val,
            "primary_color": tmpl["primary_color"],
            "secondary_color": tmpl["secondary_color"],
            "accent_color": tmpl["accent_color"],
        }

CASES = {
    "assault_case": {
        "id": "assault_case",
        "name": "Assault Case",
        "price": 170,
        "category": "Assault",
        "weapons": ["M4A1", "Ak47"],
        "icon_color": "#e056fd",
        "description": "Contains specialized skins for M4A1 and AK-47 rifles.",
        "odds": {"Common": 0.79, "Rare": 0.16, "Epic": 0.04, "Legendary": 0.01},
    },
    "pistol_case": {
        "id": "pistol_case",
        "name": "Pistol Case",
        "price": 100,
        "category": "Pistol",
        "weapons": ["Desert Eagle", "Glock"],
        "icon_color": "#686de0",
        "description": "Sidearm firepower skins for Desert Eagle and Glock.",
        "odds": {"Common": 0.79, "Rare": 0.16, "Epic": 0.04, "Legendary": 0.01},
    },
    "smg_case": {
        "id": "smg_case",
        "name": "SMG Case",
        "price": 130,
        "category": "SMG",
        "weapons": ["MP5", "P90"],
        "icon_color": "#30336b",
        "description": "High cyclic rate submachine gun finishes for MP5 and P90.",
        "odds": {"Common": 0.79, "Rare": 0.16, "Epic": 0.04, "Legendary": 0.01},
    },
    "shotgun_case": {
        "id": "shotgun_case",
        "name": "Shotgun Case",
        "price": 150,
        "category": "Shotgun",
        "weapons": ["BenelliM4", "Nova"],
        "icon_color": "#eb4d4b",
        "description": "Heavy gauge buckshot skins for Benelli M4 and Nova.",
        "odds": {"Common": 0.79, "Rare": 0.16, "Epic": 0.04, "Legendary": 0.01},
    },
    "lmg_case": {
        "id": "lmg_case",
        "name": "LMG Case",
        "price": 160,
        "category": "LMG",
        "weapons": ["M249", "Negev"],
        "icon_color": "#f0932b",
        "description": "Heavy suppressing fire skins for M249 and Negev.",
        "odds": {"Common": 0.79, "Rare": 0.16, "Epic": 0.04, "Legendary": 0.01},
    },
    "legendary_case": {
        "id": "legendary_case",
        "name": "Legendary Case",
        "price": 2500,
        "category": "All",
        "weapons": list(WEAPONS.keys()),
        "icon_color": "#f1c40f",
        "description": "Ultra exclusive crate dropping ONLY Legendary tier skins across all weapons!",
        "odds": {"Legendary": 1.0},
    },
}

WEAR_CONDITIONS = [
    ("Factory New", 1.25),
    ("Minimal Wear", 1.10),
    ("Field-Tested", 1.00),
    ("Well-Worn", 0.88),
    ("Battle-Scarred", 0.75),
]

# ---------------------------------------------------------------------------
# MARKET ENGINE: DYNAMIC PRICING SIMULATION
# ---------------------------------------------------------------------------
class MarketEngine:
    def __init__(self):
        self.lock = threading.Lock()
        self.prices = {}
        self.history = {}
        self.market_events = []
        self.last_tick = time.time()
        self.init_market()

    def init_market(self):
        for skin_id, skin in ALL_SKINS.items():
            base = skin["base_price"]
            # Start with slight natural variance
            init_price = round(base * random.uniform(0.96, 1.04), 2)
            self.prices[skin_id] = init_price
            self.history[skin_id] = [init_price]

    def tick(self):
        with self.lock:
            # 10% chance of a market event on each tick cycle
            if random.random() < 0.12:
                self.trigger_random_event()

            for skin_id, skin in ALL_SKINS.items():
                curr = self.prices[skin_id]
                base = skin["base_price"]
                
                # Volatility higher for rarer skins
                rarity = skin["rarity"]
                volatility = {
                    "Common": 0.018,
                    "Rare": 0.026,
                    "Epic": 0.038,
                    "Legendary": 0.055,
                }.get(rarity, 0.02)

                # Mean reversion towards base price
                pull = (base - curr) / base * 0.05
                drift = random.gauss(pull, volatility)
                new_price = max(1.0, round(curr * (1.0 + drift), 2))
                
                self.prices[skin_id] = new_price
                hist = self.history[skin_id]
                hist.append(new_price)
                if len(hist) > 25:
                    hist.pop(0)

            self.last_tick = time.time()

    def trigger_random_event(self):
        event_types = [
            ("AK-47 Hype", "Pro player ace clutch in Major finals with AK-47!", "Ak47", 1.18),
            ("M4A1 Nerf Rumor", "Community debate on silencer meta cools M4A1 prices.", "M4A1", 0.90),
            ("Collector Buyout", "High roller swept the Legendary market!", "Legendary", 1.25),
            ("Pistol Round Meta", "Deagle highlights trending on esports social media!", "Desert Eagle", 1.15),
            ("LMG Supply Influx", "Large unboxing wave increases heavy gun inventory.", "LMG", 0.92),
            ("Cyber Pattern Surge", "Cyber Net aesthetic featured in new community highlight!", "Cyber Net", 1.14),
            ("Gold Rush", "Imperial Obsidian skins seeing unprecedented collector demand!", "Imperial Obsidian", 1.28),
        ]
        ev_title, ev_desc, target, mult = random.choice(event_types)
        
        # Apply multiplier
        for s_id, s in ALL_SKINS.items():
            hit = False
            if target in [s["weapon"], s["category"], s["rarity"], s["pattern"], s["name"]]:
                hit = True
            elif target == "LMG" and s["category"] == "LMG":
                hit = True
            if hit:
                self.prices[s_id] = round(self.prices[s_id] * mult, 2)

        self.market_events.insert(0, {
            "title": ev_title,
            "desc": ev_desc,
            "multiplier": mult,
            "time": time.strftime("%H:%M:%S"),
        })
        if len(self.market_events) > 8:
            self.market_events.pop()

    def get_summary(self):
        with self.lock:
            data = {}
            for s_id, p in self.prices.items():
                s = ALL_SKINS[s_id]
                hist = self.history[s_id]
                first_p = hist[0] if hist else p
                change_pct = round(((p - first_p) / first_p) * 100, 2) if first_p > 0 else 0.0
                data[s_id] = {
                    "price": p,
                    "change_pct": change_pct,
                    "history": list(hist),
                    "rarity": s["rarity"],
                    "weapon": s["weapon_label"],
                    "name": s["full_name"],
                    "category": s["category"],
                }
            return {
                "prices": data,
                "events": list(self.market_events),
                "timestamp": self.last_tick,
            }

    def get_price(self, skin_id):
        with self.lock:
            return self.prices.get(skin_id, ALL_SKINS.get(skin_id, {}).get("base_price", 10.0))

market_engine = MarketEngine()

def market_worker():
    while True:
        time.sleep(4.5)
        try:
            market_engine.tick()
        except Exception as e:
            print("Market tick error:", e, file=sys.stderr)

# ---------------------------------------------------------------------------
# DATABASE & STORAGE LAYER
# ---------------------------------------------------------------------------
def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY,
                balance REAL DEFAULT 1000.0,
                cases_opened INTEGER DEFAULT 0,
                total_spent REAL DEFAULT 0.0,
                total_earned REAL DEFAULT 0.0
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                skin_id TEXT,
                condition TEXT,
                float_value REAL,
                unboxed_price REAL,
                unboxed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS cases_owned (
                case_id TEXT PRIMARY KEY,
                quantity INTEGER DEFAULT 0
            )
        """)
        # Initialize default user if empty
        c.execute("SELECT COUNT(*) FROM user_profile")
        if c.fetchone()[0] == 0:
            c.execute("INSERT INTO user_profile (id, balance) VALUES (1, 1000.0)")
            # Give 1 of each case to start excitement immediately!
            for cid in CASES.keys():
                c.execute("INSERT OR REPLACE INTO cases_owned (case_id, quantity) VALUES (?, 1)", (cid,))
        conn.commit()

init_db()

def get_user_state():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM user_profile WHERE id=1")
        prof = dict(c.fetchone() or {"balance": 1000.0, "cases_opened": 0, "total_spent": 0.0, "total_earned": 0.0})
        
        c.execute("SELECT * FROM inventory ORDER BY id DESC")
        raw_inv = c.fetchall()
        inventory = []
        for row in raw_inv:
            item = dict(row)
            skin_info = ALL_SKINS.get(item["skin_id"], {})
            current_market_price = market_engine.get_price(item["skin_id"])
            # Apply wear multiplier to market price
            wear_mult = next((m for cond, m in WEAR_CONDITIONS if cond == item["condition"]), 1.0)
            item_val = round(current_market_price * wear_mult, 2)
            item.update({
                "skin_info": skin_info,
                "current_value": item_val,
                "wear_mult": wear_mult,
            })
            inventory.append(item)
            
        c.execute("SELECT case_id, quantity FROM cases_owned")
        cases_owned = {row["case_id"]: row["quantity"] for row in c.fetchall()}
        # Ensure all cases are present
        for cid in CASES.keys():
            if cid not in cases_owned:
                cases_owned[cid] = 0

        return {
            "profile": prof,
            "inventory": inventory,
            "cases_owned": cases_owned,
            "all_skins": ALL_SKINS,
            "cases_catalog": CASES,
        }

# ---------------------------------------------------------------------------
# CASE OPENING LOGIC
# ---------------------------------------------------------------------------
def simulate_case_open(case_id):
    case = CASES.get(case_id)
    if not case:
        raise ValueError(f"Unknown case: {case_id}")

    # Available skins for this case
    eligible_skins = [s for s in ALL_SKINS.values() if s["weapon"] in case["weapons"]]
    if case_id == "legendary_case":
        eligible_skins = [s for s in ALL_SKINS.values() if s["rarity"] == "Legendary"]

    # Pick rarity according to odds
    odds = case["odds"]
    rarities = list(odds.keys())
    weights = list(odds.values())
    chosen_rarity = random.choices(rarities, weights=weights, k=1)[0]

    # Filter skins by chosen rarity
    matching_skins = [s for s in eligible_skins if s["rarity"] == chosen_rarity]
    if not matching_skins:
        # Fallback if specific weapon pool has gap
        matching_skins = [s for s in ALL_SKINS.values() if s["rarity"] == chosen_rarity]

    won_skin = random.choice(matching_skins)
    
    # Random wear condition and float value
    float_val = round(random.random(), 4)
    if float_val < 0.07:
        cond_name, cond_mult = "Factory New", 1.25
    elif float_val < 0.15:
        cond_name, cond_mult = "Minimal Wear", 1.10
    elif float_val < 0.38:
        cond_name, cond_mult = "Field-Tested", 1.00
    elif float_val < 0.45:
        cond_name, cond_mult = "Well-Worn", 0.88
    else:
        cond_name, cond_mult = "Battle-Scarred", 0.75

    base_market = market_engine.get_price(won_skin["id"])
    final_value = round(base_market * cond_mult, 2)

    # Generate roulette items (45-50 items to spin across)
    # The winning item will be at index 38
    reel = []
    pool = list(eligible_skins)
    for i in range(48):
        if i == 38:
            reel.append(won_skin)
        else:
            # Weighted random so the reel has exciting epics/legendaries teasing by
            r_pool = random.choices(rarities, weights=[0.70, 0.20, 0.08, 0.02] if len(rarities) > 1 else [1.0], k=1)[0]
            cand = [s for s in pool if s["rarity"] == r_pool] or pool
            reel.append(random.choice(cand))

    return {
        "won_skin": won_skin,
        "condition": cond_name,
        "float_value": float_val,
        "value": final_value,
        "reel": reel,
        "winner_index": 38,
    }

# ---------------------------------------------------------------------------
# HTTP REQUEST HANDLER
# ---------------------------------------------------------------------------
class CaseSimHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            self.json_response(get_user_state())
        elif parsed.path == "/api/market":
            self.json_response(market_engine.get_summary())
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {}

        if parsed.path == "/api/buy-case":
            self.handle_buy_case(data)
        elif parsed.path == "/api/open-case":
            self.handle_open_case(data)
        elif parsed.path == "/api/sell":
            self.handle_sell_item(data)
        elif parsed.path == "/api/sell-all-common":
            self.handle_sell_all_common(data)
        elif parsed.path == "/api/add-funds":
            self.handle_add_funds(data)
        elif parsed.path == "/api/reset":
            self.handle_reset(data)
        else:
            self.send_error(404, "Endpoint not found")

    def json_response(self, obj, status=200):
        payload = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(payload)

    def handle_buy_case(self, data):
        case_id = data.get("case_id")
        qty = int(data.get("quantity", 1))
        if case_id not in CASES or qty < 1:
            return self.json_response({"error": "Invalid case or quantity"}, 400)

        case = CASES[case_id]
        total_cost = case["price"] * qty

        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("SELECT balance FROM user_profile WHERE id=1")
            balance = c.fetchone()[0]
            if balance < total_cost:
                return self.json_response({"error": f"Insufficient funds. Need ${total_cost:.2f}, you have ${balance:.2f}"}, 400)

            # Deduct balance & add cases
            c.execute("UPDATE user_profile SET balance = balance - ?, total_spent = total_spent + ? WHERE id=1", (total_cost, total_cost))
            c.execute("""
                INSERT INTO cases_owned (case_id, quantity) VALUES (?, ?)
                ON CONFLICT(case_id) DO UPDATE SET quantity = quantity + ?
            """, (case_id, qty, qty))
            conn.commit()

        self.json_response({"success": True, "state": get_user_state(), "purchased": {"case_id": case_id, "qty": qty, "total_cost": total_cost}})

    def handle_open_case(self, data):
        case_id = data.get("case_id")
        if case_id not in CASES:
            return self.json_response({"error": "Invalid case"}, 400)

        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("SELECT quantity FROM cases_owned WHERE case_id=?", (case_id,))
            row = c.fetchone()
            qty = row[0] if row else 0
            if qty < 1:
                return self.json_response({"error": f"You don't own any {CASES[case_id]['name']}. Please buy one from the shop!"}, 400)

            # Open simulation
            result = simulate_case_open(case_id)
            won_skin = result["won_skin"]

            # Deduct case, increment opened counter, add to inventory
            c.execute("UPDATE cases_owned SET quantity = quantity - 1 WHERE case_id=?", (case_id,))
            c.execute("UPDATE user_profile SET cases_opened = cases_opened + 1 WHERE id=1")
            c.execute("""
                INSERT INTO inventory (skin_id, condition, float_value, unboxed_price)
                VALUES (?, ?, ?, ?)
            """, (won_skin["id"], result["condition"], result["float_value"], result["value"]))
            new_inv_id = c.lastrowid
            conn.commit()

        result["inventory_id"] = new_inv_id
        result["user_state"] = get_user_state()
        self.json_response(result)

    def handle_sell_item(self, data):
        inv_id = data.get("inventory_id")
        if not inv_id:
            return self.json_response({"error": "Missing inventory item id"}, 400)

        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT * FROM inventory WHERE id=?", (inv_id,))
            item = c.fetchone()
            if not item:
                return self.json_response({"error": "Item not found in inventory"}, 404)

            # Calculate current dynamic market payout
            skin_id = item["skin_id"]
            curr_market = market_engine.get_price(skin_id)
            wear_mult = next((m for cond, m in WEAR_CONDITIONS if cond == item["condition"]), 1.0)
            payout = round(curr_market * wear_mult, 2)

            # Delete item, credit user
            c.execute("DELETE FROM inventory WHERE id=?", (inv_id,))
            c.execute("UPDATE user_profile SET balance = balance + ?, total_earned = total_earned + ? WHERE id=1", (payout, payout))
            conn.commit()

        self.json_response({"success": True, "payout": payout, "state": get_user_state()})

    def handle_sell_all_common(self, data):
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT * FROM inventory")
            items = c.fetchall()
            
            sold_count = 0
            total_payout = 0.0
            for item in items:
                skin = ALL_SKINS.get(item["skin_id"])
                if skin and skin["rarity"] == "Common":
                    curr_market = market_engine.get_price(item["skin_id"])
                    wear_mult = next((m for cond, m in WEAR_CONDITIONS if cond == item["condition"]), 1.0)
                    val = round(curr_market * wear_mult, 2)
                    total_payout += val
                    sold_count += 1
                    c.execute("DELETE FROM inventory WHERE id=?", (item["id"],))

            if sold_count > 0:
                c.execute("UPDATE user_profile SET balance = balance + ?, total_earned = total_earned + ? WHERE id=1", (total_payout, total_payout))
                conn.commit()

        self.json_response({"success": True, "sold_count": sold_count, "total_payout": round(total_payout, 2), "state": get_user_state()})

    def handle_add_funds(self, data):
        amount = float(data.get("amount", 500.0))
        if amount <= 0:
            return self.json_response({"error": "Invalid amount"}, 400)

        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("UPDATE user_profile SET balance = balance + ? WHERE id=1", (amount,))
            conn.commit()

        self.json_response({"success": True, "added": amount, "state": get_user_state()})

    def handle_reset(self, data):
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("UPDATE user_profile SET balance=1000.0, cases_opened=0, total_spent=0.0, total_earned=0.0 WHERE id=1")
            c.execute("DELETE FROM inventory")
            c.execute("DELETE FROM cases_owned")
            for cid in CASES.keys():
                c.execute("INSERT OR REPLACE INTO cases_owned (case_id, quantity) VALUES (?, 1)", (cid,))
            conn.commit()

        self.json_response({"success": True, "state": get_user_state()})

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

def run_server(port=8000):
    # Start market simulation background worker
    market_thread = threading.Thread(target=market_worker, daemon=True)
    market_thread.start()

    server = ThreadedHTTPServer(("0.0.0.0", port), CaseSimHandler)
    print(f"CS:GO Case Simulator 3D Server running at http://localhost:{port}")
    print(f"Serving static assets from: {STATIC_DIR}")
    print(f"Database located at: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.shutdown()

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
