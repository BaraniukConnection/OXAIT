# SKYFRONT — Alpine Intercept

A self-contained, low-poly third-person arcade flight game. No packages, CDN, accounts, build step, or internet connection needed. Requires a modern desktop browser with WebGL and Python 3 for the local web server.

## Run

Open a terminal in this folder:

    python3 serve.py

Then open http://localhost:8072

Windows: double-click start.bat, or run `py serve.py`. Linux/macOS: `sh start.sh`.
If you prefer your own server: `python3 -m http.server 8072 --bind 127.0.0.1`.
You can also open index.html directly in a browser, since all assets are local and the game uses no module imports.

Stop the server with Ctrl+C. Choose Start Operation, select your plane, then Launch.

## Controls

- Up arrow: pitch nose down; Down arrow: pitch nose up (flight-sim convention).
- Left/right arrows: roll. Bank and pull up to turn; bank also adds gentle coordinated turning.
- W/S: increase/decrease throttle. Minimum throttle preserves forward flight for arcade handling.
- A/D: yaw left/right.
- Space: fire selected weapon (hold for repeated fire).
- C: cycle standard missile → machine gun → aircraft special.
- Escape: pause/resume. The game also pauses when focus is lost.
- M: toggle synthesized sound (starts muted).

## Aircraft

| Aircraft | Inspiration | Speed | Maneuverability | Special |
|---|---|---|---|---|
| Thunder | Eurofighter Typhoon | 2/4 | 2/4 | Highspeed AA missile; longer acquisition range and faster flight |
| Vulture | Gripen | 2/4 | 2/4 | Radar guided AA missile; tighter tracking, requires initial lock and continued aim inside lock circle |
| Falcon | Ukrainian blue/yellow Su-27 | 3/4 | 3/4 | Up to four simultaneous target locks and missiles |
| Shadow | F-22 | 3/4 | 3/4 | Highpower missile; one direct hit destroys an undamaged Rogue |

Aircraft are original procedural low-poly interpretations, with canards/delta wings or twin engines/tails, distinct silhouettes, and Falcon's blue/yellow markings.

## Combat

Destroy all eight Su-57-inspired Rogues. Their patrol centers and initial positions change each sortie. Each patrol owns a 1,450-meter territory. Rogues engage only while you are inside their territory and remain within it. Radar shows those territories and enemy positions; orange markers show enemies, green shows you.

Hold enemies inside the aiming circle until LOCKED. Standard and most special missiles can fire without a lock, but then fly unguided. Standard missiles need two hits against a fresh Rogue. Machine-gun fire has no auto-aim. Radar missiles lose guidance permanently if their target leaves the lock cone. Falcon fires one missile per acquired target, up to four; a single visible target yields one missile. Target-lock cone is wider for Falcon's special.

Ammunition is unlimited, balanced by reloads: standard 1.7 seconds, specials 6 seconds, MG 0.075 seconds per round. Enemy missiles can be defeated by sharp turns or terrain. No countermeasure key is required.

## World and collision

18 × 18 km map with faceted mountains, forest, and a runway landmark. Ground collision samples the actual rendered terrain triangles. Swept collision checks cover the fuselage, wingtips, tree volumes, projectiles, and enemy aircraft. Leaving the map ends the sortie after an advance warning. Flight ceiling is 6,500 meters. Rogues use terrain avoidance.

## Files

- index.html — menus and HUD
- style.css — interface design
- game.js — WebGL renderer, models, terrain, flight, AI, weapons, collisions
- serve.py / start.sh / start.bat — local launchers

Everything is rendered procedurally using native WebGL. No third-party runtime dependencies. The server binds only to the local machine by default.
