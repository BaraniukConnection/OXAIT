# Case Simulator (CS-style)

A self-hosted 3D case-opening game. You stand in an old storage room:

- **Right:** a desk with a PC. Its ARMS//NET app has the **Case Shop**, the **Skin Market** (sell skins at live prices), **Inventory** and **Stats** tabs.
- **Left:** a workbench with a rack holding your cases. Click a stack to open one: the case flies to the mat, unlatches, the reel spins, and the skin rises out in 3D.
- **Front:** the *Hall of Drops* wall shows your 8 most valuable skins.

## Run

Needs Python 3.8+ only (standard library). No internet needed: three.js is vendored in `static/vendor/`.

```bash
python3 server.py            # http://127.0.0.1:8777
python3 server.py --host 0.0.0.0 --port 9000   # expose on LAN
```

Progress is saved to `savegame.json` next to `server.py`. Delete it, or use Stats → Reset, to start over.

## Controls

| Input | Action |
|---|---|
| Drag mouse | look around |
| `A` / `D` | turn to cases / PC |
| `W` | walk up to the Hall of Drops |
| Click | use the monitor / open a case |
| `Esc` | back |
| `M` | mute |

## Content

10 weapons: M4A1, AK-47, Desert Eagle, Glock-18, MP5, P90, Benelli M4, Nova, M249, Negev.

Each weapon has 7 designs, and each design comes in 2 color variants, so there are 14 skins per weapon and 140 in total:

| Rarity | Designs per weapon | Pattern style |
|---|---|---|
| Common | 2 | camo, digital |
| Rare | 2 | tiger stripes, carbon weave |
| Epic | 1 | metallic fade |
| Legendary | 2 | unique geometric designs (prism mosaic, hex core, mandala, isometric cubes, Voronoi shards, spiral, op-art waves, kaleidoscope, circuit) |

All textures are procedural. Every skin also rolls a wear level (Factory New → Battle-Scarred) and a float. Wear shows up as scratches on the texture and lowers the sale price.

| Case | Price | Contents |
|---|---|---|
| Assault | $170 | M4A1, AK-47 |
| Pistol | $100 | Desert Eagle, Glock-18 |
| SMG | $130 | MP5, P90 |
| Shotgun | $150 | Benelli M4, Nova |
| LMG | $160 | M249, Negev |
| Legendary | $2,500 | legendary skins only, from every weapon |

Weapon-case drop odds: Common 65% · Rare 24% · Epic 8% · Legendary 3%.

## Market pricing

Prices are simulated on the server, which ticks every 4 seconds:

`price = base × typeDemand[weapon type] × rarityDemand[rarity] × skinFactor × wearMultiplier`

- `base` depends on rarity, weapon type (rifles > LMGs > shotguns > SMGs > pistols) and weapon popularity.
- Every weapon type and every rarity has its own mean-reverting demand index, each with its own volatility (legendaries swing the most).
- Random market events ("Balance patch nerfs SMGs −9%", "Collectors buying Epic skins +12%") push whole categories up or down.
- Selling a skin pushes its own price down slightly (supply pressure).

The opening result is decided on the server, so the client can't fake drops.

## Files

```
server.py              HTTP server, catalog, market simulation, game API
static/index.html      page shell + overlays
static/css/style.css   HUD / PC app / reel styles
static/js/main.js      scene, camera, interaction, case-opening sequence
static/js/room.js      storage room geometry & lighting
static/js/models.js    procedural weapon & case models
static/js/textures.js  procedural skin patterns + environment textures
static/js/ui.js        PC app (shop, market, inventory, stats), reel, reveal
static/js/thumbs.js    offscreen thumbnail renderer
static/js/store.js     client state + API calls
static/js/audio.js     synthesized sound effects
```
