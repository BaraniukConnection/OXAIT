# IRON DISTRICT
A self-hosted, offline, low-poly 3D arcade tank game. No installation, npm, account, API key, CDN, or internet connection is required. All city geometry, tanks, effects, and sounds are generated locally. Desktop keyboard and mouse required.

## Start
Extract the complete folder, then run inside it:

    python3 launch.py

Windows:

    py launch.py

The launcher opens http://localhost:8000 in your browser. Leave the terminal open. Ctrl+C stops the server. If the port is busy, use `python3 launch.py --port 8001`.

Alternatively run `python3 -m http.server 8000 --bind 127.0.0.1` in this folder, then open http://localhost:8000. Use a modern browser with WebGL and hardware acceleration enabled. Do not open index.html as a file; serve the folder.

## Operation
Select Start Operation, choose your tank, and Deploy Tank. Clear all 12 Hounds to win. Your tank and Hounds spawn at random street locations each mission. Hounds are stationary, T-80-inspired tanks with 64-meter circular detection zones. They turn their turrets and fire when you enter range with a clear sight line. Buildings block detection and shells. Break line of sight to stop enemy fire. Wrecks remain as obstacles. The map shows all targets: muted orange = standby, bright orange = engaging, gray = destroyed.

W / S: forward / reverse. A / D: turn hull (steering reverses while backing up).
Mouse: rotate turret and camera. Left mouse: fire (hold for automatic firing after reload).
Right mouse: hold gunner sight. Escape or P: pause. M: toggle sound.
If the mouse is not captured, click the scene. Resume captures it again. Sensitivity is adjustable in the pause menu. Leaving the tab pauses the game.

Unlimited shells, with a reload delay. Shots have travel time and collide with tanks and buildings. Hulls collide with buildings, map boundaries, and Hounds. Mouse aiming is independent of hull direction, with a limited turret rotation speed. Fire waits for turret alignment. Red screen edges indicate damage. There are no repairs or consumables.

## Tank ratings (as requested)
| Tank | Visual inspiration | Speed | Armor | Power | Top speed | Health | Damage | Reload |
|---|---|---|---|---|---|---|---|---|
| Liberator | Abrams | 1/4 | 3/4 | 3/4 | 36 km/h | 180 | 78 | 2.5 s |
| Hunter | Leopard 2A6 | 3/4 | 2/4 | 2/4 | 79 km/h | 120 | 52 | 2.15 s |
| Royal | Challenger 2 | 2/4 | 1/4 | 3/4 | 58 km/h | 60 | 78 | 2.5 s |
| Bastion | BM Oplot | 2/4 | 2/4 | 2/4 | 58 km/h | 120 | 52 | 2.15 s |

Hounds: 110 health, 15 shell damage, 2.8–4.3-second firing interval after acquiring a target. These are fictional arcade values, not real vehicle specifications. Models are stylized procedural interpretations rather than exact replicas. Armor is represented by health; there is no penetration or armor-angle simulation.

## Files
`index.html` — menus and HUD; `style.css` — interface; `engine.js` — dependency-free WebGL renderer and math; `game.js` — city, vehicle models, combat and controls; `launch.py` — optional Python local server.

The game makes no network requests except for these files from your local server. No telemetry or remote services. A fresh operation starts every launch; there is no save system. Original game code and procedural assets created for this project.
