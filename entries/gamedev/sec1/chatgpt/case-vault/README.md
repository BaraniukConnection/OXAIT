# Case Vault — Storage 07

A local, offline-ready 3D case-opening simulator inspired by CS:GO. All models, room details and skin textures are generated in the browser. No accounts, paid APIs, build step, npm install, Steam integration or internet connection are needed.

## Start

1. Extract the complete `case-vault` folder.
2. Open a terminal in that folder.
3. Run `python3 serve.py` (Windows: `py serve.py`).
4. Open http://127.0.0.1:8000 if the browser does not open automatically.

Requires Python 3 and a modern browser with WebGL hardware acceleration. Keep the terminal running. Ctrl+C stops the server. Use `python3 serve.py --port 8001` if port 8000 is occupied. Alternatively run `python3 -m http.server 8000 --bind 127.0.0.1` inside the folder. Do not open `index.html` directly; JavaScript modules require an HTTP server.

## Play

- Click the left workbench to open cases; click the right terminal to buy cases or sell skins.
- The numbered navigation buttons (or keys 1–4) take you to each station.
- WASD / arrow keys move around the front aisle; drag the room to look around. E interacts with the station you are looking at (or the nearest side if no station is targeted).
- Open a case to see its lid lift and a 3D weapon emerge. Drag a revealed or inspected weapon to rotate it; scroll to zoom.
- Inspect owned skins in Collection. The catalog previews all 120 skins.
- Escape returns from inspection, closes settings, or returns to the room.
- Settings provides sound, graphics quality, save export/import and free practice credit refills.

## Collection

10 weapons: M4A1, AK-47, Desert Eagle, Glock, MP5, P90, Benelli M4, Nova, M249, Negev. The weapon models are original stylized procedural interpretations, not Valve assets or exact replicas.

Each weapon has 7 designs / 12 skins:

| Design | Rarity | Variants |
| --- | --- | --- |
| Fieldwork | Common | Sage, Sand |
| Hazard Tape | Common | Amber, Ice |
| Digital Ghost | Rare | Arctic, Jungle |
| Circuit Breaker | Rare | Volt, Cyan |
| Nebula | Epic | Orchid, Solar |
| Prismatic | Legendary | Aurora — unique triangular geometry pattern |
| Aurum | Legendary | Obsidian — unique gold chevron / faceted pattern |

The five regular patterns each have two color variants; the two unique geometric designs each have one signature palette. This interprets the requested rarity split as two common designs, two rare designs, one epic design, and two legendary designs.

## Cases and market

| Case | Cost (CR) | Contents |
| --- | ---: | --- |
| Assault | 170 | M4A1 / AK-47 |
| Pistol | 100 | Desert Eagle / Glock |
| SMG | 130 | MP5 / P90 |
| Shotgun | 150 | Benelli M4 / Nova |
| LMG | 160 | M249 / Negev |
| Legendary | 2,500 | Legendary skins from all 10 weapons |

Standard cases: Common 60%, Rare 27%, Epic 10%, Legendary 3%. Legendary cases: Legendary 100%. Within each rarity, every eligible skin has an equal chance. Outcomes use browser pseudorandomness and are independent; there is no pity mechanic. Keys are included.

Start with 5,000 virtual credits plus one Assault and one Pistol case. Practice credits can be topped back up to 5,000 whenever the balance falls below that amount.

Prices change every 15 seconds while the app is active. Each weapon has its own base multiplier; rarity sets the base value and volatility. Weapon-category demand, individual fluctuation and gentle mean reversion move quotes within 40–250% of base. Selling uses the current quote and has no fee. The chart shows the average legendary quote over recent ticks. These are fictional simulated prices, not live Steam data. The market pauses when the app is closed; background browser throttling may delay ticks.

## Saves and portability

Browser localStorage saves credits, cases, inventory and market state automatically. Each drop is saved before its reveal animation, so reloading does not reroll or lose it. Saves are specific to your browser, host and port; keep using the same URL. Export a JSON backup before clearing browser data, switching browsers/ports, or moving computers. Import validates the save and asks before replacing existing progress. Private browsing may discard progress after closing.

## Files

- `index.html`, `style.css`: interface
- `app.js`: scene, interaction and animation
- `models.js`: procedural weapons, cases and skin textures
- `economy.js`: catalog, drops, market and state validation
- `serve.py`: standard-library local launcher
- `vendor/three.module.js`: bundled Three.js 0.160.1 (MIT; license included)

No requests are made to external services at runtime. This is a fan-made simulator, unaffiliated with Valve. All currency and trades remain inside the simulation.
