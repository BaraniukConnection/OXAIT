# Rogue Strike

Low-poly arcade jet combat in the browser (Three.js, bundled locally, so no internet is needed).
Shoot down every **Rogue** (Su-57-style enemy). Each Rogue patrols its own airspace, attacks you when
you enter it, and never leaves it.

## Run

```bash
python3 server.py            # http://127.0.0.1:8071 (listens on 0.0.0.0:8071)
python3 server.py --no-browser --port 8071 --host 127.0.0.1
```

Python 3 standard library only. Best mission times per aircraft are saved to `scores.json`.

## Controls

| Key | Action |
| --- | --- |
| ↑ / ↓ | Pitch (default: ↓ = nose up, like a flight stick. Toggle on the title screen or with **I**) |
| ← / → | Roll |
| W / S | Throttle up / down (above 85% = afterburner) |
| A / D | Yaw |
| Space | Fire (hold for gun; tap for missiles) |
| C | Change weapon: GUN → MSL → special |
| V | Camera: chase / far / nose |
| P / Esc | Pause · **M** mute |

## Aircraft

| Name | Look | Speed | Maneuverability | Special |
| --- | --- | --- | --- | --- |
| THUNDER | EF-2000 Typhoon type | 2/4 | 2/4 | **HVAA**: very fast, long range, gentle turns |
| VULTURE | Gripen type | 2/4 | 2/4 | **SAAM**: radar-guided, turns very hard, but only guides while the target stays in the lock circle |
| FALCON | Su-27, Ukrainian digital camo | 3/4 | 3/4 | **4AAM**: locks up to 4 targets and fires a missile at each |
| SHADOW | F-22 type | 3/4 | 3/4 | **HPAA**: heavy warhead with a large blast radius |

Every aircraft also has the machine gun (unlimited) and 80 standard missiles.

## Notes

- The terrain collision uses the exact rendered triangles. Trees, water, the border mountain wall and mid-air collisions are all solid.
- Rogue zones are shown as red circles on the radar. Difficulty (Easy 6 / Normal 9 / Hard 13 Rogues) changes how many Rogues there are and how aggressive they are.
- Code: `static/js/` contains `world.js` (terrain, forest, collisions), `models.js` (aircraft built from code),
  `game.js` (flight model, AI, weapons), `hud.js`, `effects.js`, `audio.js` and `main.js` (menus, camera, loop).
