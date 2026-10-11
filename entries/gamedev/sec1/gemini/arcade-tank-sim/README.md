# 🎮 Armored Thunder - Arcade Tank Simulator

A 3D low-poly arcade tank combat simulator set in an open city. Built with **Three.js**, **Web Audio API**, and **Python**.

---

## 🚀 Quick Start (Self-Hosted Local Server)

Run the included zero-dependency Python server:

```bash
cd /home/oleksii/.gemini/antigravity/scratch/arcade-tank-sim
python3 server.py
```

Then open your browser at:
👉 **[http://localhost:8000](http://localhost:8000)**

Optional command flags:
- `python3 server.py --port 8080` (use custom port)
- `python3 server.py --host 0.0.0.0` (allow LAN network access)
- `python3 server.py --open` (automatically open your default web browser)

---

## 🕹️ Controls

| Action | Control | Description |
|---|---|---|
| **Drive Forward** | <kbd>W</kbd> | Acceleration with realistic tank inertia & engine sound |
| **Reverse** | <kbd>S</kbd> | Reverse throttle |
| **Steer Hull** | <kbd>A</kbd> / <kbd>D</kbd> | Neutral track steering (hull pivots in place) |
| **Aim Turret** | **Mouse** | Independent 360° turret traverse & gun elevation |
| **Fire Main Cannon** | **Left Mouse Button (LMB)** | High-velocity shell, muzzle flash, recoil & blast |
| **Gunner Sight Zoom** | **Right Mouse Button (RMB)** | Sniping optic sight with mil-dots & laser rangefinder |
| **Toggle Audio Mute** | <kbd>M</kbd> | Mute/unmute procedural sound engine |

---

## 🛡️ Playable Tanks & Characteristics

Select your tank in the 3D Hangar before deploying:

| Tank | Analog | Speed | Armor | Power | Profile |
|---|---|:---:|:---:|:---:|---|
| **Liberator** | M1A2 Abrams | **1/4** | **3/4** | **3/4** | Heavy armored juggernaut. Devastating kinetic punch with extreme frontal armor. |
| **Hunter** | Leopard 2A6 | **3/4** | **2/4** | **2/4** | Agile hunter-killer with wedge arrowhead turret armor and high reload speed. |
| **Royal** | Challenger 2 | **2/4** | **1/4** | **3/4** | Heavy rifled 120mm cannon platform delivering lethal high-alpha damage strikes. |
| **Bastion** | Ukrainian BM Oplot | **2/4** | **2/4** | **2/4** | Versatile combat tank with layered Duplet ERA protection and panoramic commander periscope. |

---

## 🎯 Enemy Targets: T-80 "Hound"

- **Objective**: Neutralize all static T-80 "Hound" defense tanks positioned across the city.
- **Detection Circle**: Each Hound monitors a perimeter around itself (visible on ground and radar).
- **Behavior**:
  - Hounds remain silent and stationary until the player crosses into their view circle.
  - Upon detection, an audible alarm sounds and a HUD warning triggers: `⚠️ WARNING: TARGET ACQUIRED BY HOUND!`.
  - The Hound traverses its turret, checks direct line of sight (accounting for buildings and obstacles), and opens fire with 125mm shells.
  - When destroyed, the Hound's turret blows off with spectacular physics and its hull becomes a smoking wreck.

---

## 🏙️ Features & Architecture

- **Low-poly City Map**: Wide avenues, crossroads, central plaza with monument, industrial depots with shipping containers, and battle ruins with rubble piles for cover.
- **Smooth Collision Physics**: Tanks slide against building walls rather than getting stuck.
- **Zero External Dependencies**: All 3D models and textures are procedurally generated in WebGL, sound is generated via the Web Audio API, and Three.js is bundled locally.
- **Tactical HUD**:
  - Real-time 2D Minimap radar displaying buildings, player orientation, and enemy view zones.
  - Speedometer & Gear display (N, D, R).
  - Hull integrity & armor gauge.
  - Gunner optic mode (RMB) with stadiametric rangefinder.
  - Floating arcade combat damage numbers & hit markers.
