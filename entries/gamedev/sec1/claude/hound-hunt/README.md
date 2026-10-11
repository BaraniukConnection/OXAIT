# Hound Hunt

A self-hosted, low-poly arcade tank game. You drive through an open procedural city and hunt down every **Hound** — parked enemy T-80-style tanks that sit still and watch a ring around themselves. Enter a ring while a Hound has line of sight on you and it starts shooting.

## Run

Needs Python 3.8+ only (standard library). No internet needed: three.js is vendored in `static/vendor/`.

```bash
python3 server.py                               # http://127.0.0.1:8780, opens your browser
python3 server.py --host 0.0.0.0 --port 9000    # expose on LAN
python3 server.py --no-browser
```

Best times per tank are saved to `scores.json` next to `server.py` (delete it to reset).

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` | drive the hull (A/D pivot) |
| Mouse | aim the turret (it traverses toward the crosshair at its own speed) |
| Left click | fire |
| Right click (hold) | gunner sight · mouse wheel = 3× / 6× / 10× zoom |
| `Esc` / `P` | pause |
| `M` | mute |

**Mouse modes.** When the browser allows pointer lock, the mouse works as classic mouse-look: the cursor is hidden and the crosshair stays in the center. If the browser refuses pointer lock (embedded views, some Linux setups, or briefly after pressing Esc), the game switches to **free aim** on its own. In free aim the turret aims at whatever is under the cursor, and pushing the cursor toward a screen edge turns the view.

White circle = where you are aiming. Small square = where the gun actually points (red while reloading, green when loaded). Shots are drop-compensated, so put the crosshair on the target.

## Tanks

Stats are in quarters, as specified:

| Tank | Pattern | Speed | Armor | Power | Top speed | Eff. HP | Shell dmg |
|---|---|---|---|---|---|---|---|
| Liberator | Abrams | ¼ | ¾ | ¾ | 32 km/h | 139 | 52 |
| Hunter | Leopard 2A6 | ¾ | 2/4 | 2/4 | 61 km/h | 100 | 40 |
| Royal | Challenger 2 | 2/4 | ¼ | ¾ | 47 km/h | 77 | 52 |
| Bastion | BM Oplot | 2/4 | 2/4 | 2/4 | 47 km/h | 100 | 40 |

Power also raises shell velocity. All tanks reload in 3.2 s.

## Hounds

- 8 per match, spawned at random spots (as is the player), always outside their ring at the start.
- Vision ring 150 m. Buildings block line of sight. Rings: yellow = idle, orange = searching, red = engaging.
- After spotting you they need ~1.4 s to react, then fire every ~5.5 s. Each shot is more accurate than the last; moving makes you harder to hit.
- Shooting one (or landing shells near one) alerts it, and its ring grows. Destroying one makes nearby Hounds turn toward you.
- Hits on the side deal ×1.25 damage and on the rear ×1.6 — for you and for them.

## Files

```
server.py            static server + /api/scores
static/index.html    screens + HUD markup
static/css/style.css
static/js/main.js    menus, tank select garage, input, game loop
static/js/game.js    session rules: player, hounds AI, shells, damage
static/js/world.js   procedural city, collisions, raycasts
static/js/models.js  low-poly tank models
static/js/effects.js particles, craters, muzzle flash
static/js/hud.js     HUD, minimap, markers
static/js/audio.js   synthesized WebAudio sounds (no audio files)
```
