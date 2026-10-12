# Elatra — E-Alpha website

Static site with a scroll-driven 3D phone (Three.js r170, vendored in `vendor/`, no build step).

## Run locally

```bash
cd elatra
python3 -m http.server 5173
```

Open http://localhost:5173. A server is required because ES modules don't load from `file://`.

## Files

- `index.html`: page structure and story text (one `<article class="step">` per scroll stage)
- `styles.css`: layout and theme (colour tokens in `:root`)
- `main.js`: procedural 3D phone, modules, and the scroll timeline
  - `slots[]`: each slot's standard and upgrade module, label text, and `swap: [start, end]` window
  - `update(s)`: everything is a function of `s` (0–7 = scroll position in steps), so scrolling back reverses the animation
- `assets/`: logo (keyed to transparent PNG) and module photos cropped from the product sheet
