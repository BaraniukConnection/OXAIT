// Procedural textures: weapon skins (patterns, color variants, wear) and
// environment surfaces (concrete, brick, wood, cardboard, metal).
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// --- value noise --------------------------------------------------------
function makeNoise(seed) {
  const r = rng(seed);
  const p = new Float32Array(256 * 256);
  for (let i = 0; i < p.length; i++) p[i] = r();
  const at = (x, y) => p[((y & 255) << 8) | (x & 255)];
  const smooth = t => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  n.fbm = (x, y, oct = 4) => {
    let v = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { v += amp * n(x * f, y * f); amp *= 0.5; f *= 2; }
    return v / (1 - Math.pow(0.5, oct));
  };
  return n;
}

const hex2rgb = h => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const rgbStr = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function pixelPass(ctx, w, h, fn) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const c = fn(x, y, [d[i], d[i + 1], d[i + 2]]);
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// --- skin patterns ------------------------------------------------------
const PATTERNS = {
  camo(ctx, w, h, C, r) {
    ctx.fillStyle = C[0]; ctx.fillRect(0, 0, w, h);
    for (let layer = 1; layer < C.length; layer++) {
      ctx.fillStyle = C[layer];
      const n = 26 - layer * 5;
      for (let i = 0; i < n; i++) {
        const cx = r() * w, cy = r() * h, s = 18 + r() * 40;
        ctx.beginPath();
        for (let k = 0; k < 7; k++) {
          const ox = cx + (r() - 0.5) * s * 2.2, oy = cy + (r() - 0.5) * s;
          ctx.moveTo(ox + s * 0.6, oy);
          ctx.ellipse(ox, oy, s * (0.4 + r() * 0.5), s * (0.25 + r() * 0.35), r() * 3, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
  },
  digital(ctx, w, h, C, r, seed) {
    const n = makeNoise(seed), px = 8;
    for (let y = 0; y < h; y += px) for (let x = 0; x < w; x += px) {
      const v = n.fbm(x / 70, y / 70, 3) + (r() - 0.5) * 0.12;
      ctx.fillStyle = v < 0.38 ? C[2] : v < 0.5 ? C[0] : v < 0.62 ? C[1] : C[3];
      ctx.fillRect(x, y, px, px);
    }
  },
  tiger(ctx, w, h, C, r) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, C[2]); g.addColorStop(0.5, C[0]); g.addColorStop(1, C[0]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C[1];
    for (let i = 0; i < 26; i++) {
      const x0 = r() * w, len = h * (0.4 + r() * 0.7), wd = 5 + r() * 12;
      const fromTop = r() < 0.5, y0 = fromTop ? -5 : h + 5, dir = fromTop ? 1 : -1;
      const bend = (r() - 0.5) * 60;
      ctx.beginPath();
      ctx.moveTo(x0 - wd, y0);
      ctx.quadraticCurveTo(x0 + bend, y0 + dir * len * 0.5, x0 + bend * 0.6, y0 + dir * len);
      ctx.quadraticCurveTo(x0 + bend + wd * 0.6, y0 + dir * len * 0.5, x0 + wd, y0);
      ctx.fill();
    }
  },
  carbon(ctx, w, h, C, r) {
    const s = 8;
    const a = hex2rgb(C[0]), b = hex2rgb(C[1]);
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const horiz = ((x / s + y / s) & 1) === 0;
      const g = horiz ? ctx.createLinearGradient(x, y, x, y + s) : ctx.createLinearGradient(x, y, x + s, y);
      g.addColorStop(0, rgbStr(a)); g.addColorStop(0.5, rgbStr(b)); g.addColorStop(1, rgbStr(a));
      ctx.fillStyle = g; ctx.fillRect(x, y, s, s);
    }
    // accent racing stripes
    ctx.fillStyle = C[2];
    const y = h * (0.3 + r() * 0.3);
    ctx.globalAlpha = 0.9; ctx.fillRect(0, y, w, 10); ctx.fillRect(0, y + 16, w, 4);
    ctx.globalAlpha = 1;
  },
  fade(ctx, w, h, C, r, seed) {
    const n = makeNoise(seed);
    const c = C.map(hex2rgb);
    pixelPass(ctx, w, h, (x, y) => {
      let t = (x / w) * 0.8 + (y / h) * 0.2 + (n.fbm(x / 120, y / 120, 3) - 0.5) * 0.25;
      t = Math.min(1, Math.max(0, t));
      const col = t < 0.5 ? mix(c[0], c[1], t * 2) : mix(c[1], c[2], (t - 0.5) * 2);
      const sheen = 1 + 0.18 * Math.sin(y / 9 + x / 40);
      return col.map(v => Math.min(255, v * sheen));
    });
  },
  // ---- legendary geometric designs ----
  prism(ctx, w, h, C, r) {
    const c = C.map(hex2rgb);
    ctx.fillStyle = C[0]; ctx.fillRect(0, 0, w, h);
    const s = 48, cols = Math.ceil(w / s) + 2, rows = Math.ceil(h / s) + 2, P = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++)
      P.push([(i - 0.5) * s + (r() - 0.5) * s * 0.6, (j - 0.5) * s + (r() - 0.5) * s * 0.6]);
    const at = (i, j) => P[j * cols + i];
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const tris = [[at(i, j), at(i + 1, j), at(i, j + 1)], [at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]];
      for (const t of tris) {
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
        const k = (Math.sin(cx / 60 + r()) + 1) / 2;
        const col = mix(mix(c[0], c[1], 0.25 + k * 0.75), c[2], r() * 0.35);
        ctx.fillStyle = rgbStr(col);
        ctx.beginPath(); ctx.moveTo(...t[0]); ctx.lineTo(...t[1]); ctx.lineTo(...t[2]); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgbStr(c[2], 0.5); ctx.lineWidth = 1; ctx.stroke();
      }
    }
  },
  hexcore(ctx, w, h, C, r) {
    ctx.fillStyle = C[0]; ctx.fillRect(0, 0, w, h);
    const R = 22, hw = Math.sqrt(3) * R;
    const hexPath = (x, y, rad) => {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 3 * k + Math.PI / 6;
        ctx[k ? 'lineTo' : 'moveTo'](x + rad * Math.cos(a), y + rad * Math.sin(a));
      }
      ctx.closePath();
    };
    const cx = w * (0.3 + r() * 0.4), cy = h / 2;
    for (let row = -1; row * R * 1.5 < h + R; row++) for (let col = -1; col * hw < w + hw; col++) {
      const x = col * hw + (row & 1 ? hw / 2 : 0), y = row * R * 1.5;
      const d = Math.hypot(x - cx, y - cy);
      const glow = Math.max(0, 1 - d / 260);
      hexPath(x, y, R - 2);
      ctx.fillStyle = C[1]; ctx.globalAlpha = 0.08 + glow * 0.6 * r(); ctx.fill();
      ctx.globalAlpha = 0.5 + glow * 0.5;
      ctx.shadowColor = C[1]; ctx.shadowBlur = 8;
      ctx.strokeStyle = glow > 0.5 ? C[2] : C[1]; ctx.lineWidth = 2; ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    for (let k = 5; k > 0; k--) {
      hexPath(cx, cy, k * 14);
      ctx.strokeStyle = k & 1 ? C[2] : C[1]; ctx.lineWidth = 3; ctx.shadowColor = C[1]; ctx.shadowBlur = 14; ctx.stroke();
    }
    ctx.shadowBlur = 0;
  },
  mandala(ctx, w, h, C, r) {
    ctx.fillStyle = C[0]; ctx.fillRect(0, 0, w, h);
    const draw = (cx, cy, scale) => {
      for (let ring = 7; ring >= 1; ring--) {
        const rad = ring * 17 * scale, petals = 6 + ring * 2, col = ring & 1 ? C[1] : C[2];
        ctx.save(); ctx.translate(cx, cy);
        for (let p = 0; p < petals; p++) {
          ctx.rotate(Math.PI * 2 / petals);
          ctx.beginPath();
          ctx.ellipse(rad * 0.75, 0, rad * 0.3, rad * Math.PI / petals * 0.85, 0, 0, Math.PI * 2);
          ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
          if ((p + ring) % 2 === 0) { ctx.fillStyle = col; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1; }
        }
        ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.strokeStyle = C[2]; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.restore();
      }
    };
    draw(w * 0.5, h * 0.5, 1.0 + r() * 0.2);
    draw(0, 0, 0.7); draw(w, h, 0.7); draw(w, 0, 0.7); draw(0, h, 0.7);
  },
  isocube(ctx, w, h, C, r) {
    const c = C.map(hex2rgb);
    const s = 26, dx = s * Math.sqrt(3);
    const faces = [mix(c[1], c[2], 0.5), c[1], mix(c[0], c[1], 0.35)];
    for (let row = -1; row * s * 1.5 < h + s; row++) for (let col = -1; col * dx < w + dx; col++) {
      const x = col * dx + (row & 1 ? dx / 2 : 0), y = row * s * 1.5;
      const hi = r() < 0.12;
      const quad = (pts, color) => {
        ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](x + p[0], y + p[1])); ctx.closePath();
        ctx.fillStyle = rgbStr(hi ? mix(color, c[2], 0.5) : color); ctx.fill();
        ctx.strokeStyle = rgbStr(c[0]); ctx.lineWidth = 1.5; ctx.stroke();
      };
      quad([[0, -s], [dx / 2, -s / 2], [0, 0], [-dx / 2, -s / 2]], faces[0]);
      quad([[-dx / 2, -s / 2], [0, 0], [0, s], [-dx / 2, s / 2]], faces[1]);
      quad([[dx / 2, -s / 2], [dx / 2, s / 2], [0, s], [0, 0]], faces[2]);
    }
  },
  shards(ctx, w, h, C, r) {
    // Voronoi cells with glowing edges
    const c = C.map(hex2rgb);
    const pts = Array.from({ length: 40 }, () => [r() * w, r() * h, r()]);
    const img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let b1 = 1e9, b2 = 1e9, bi = 0;
      for (let i = 0; i < pts.length; i++) {
        let ddx = Math.abs(x - pts[i][0]); ddx = Math.min(ddx, w - ddx);
        const dd = ddx * ddx + (y - pts[i][1]) ** 2;
        if (dd < b1) { b2 = b1; b1 = dd; bi = i; } else if (dd < b2) b2 = dd;
      }
      const edge = Math.sqrt(b2) - Math.sqrt(b1);
      const k = pts[bi][2];
      let col = mix(c[0], c[1], 0.2 + k * 0.7);
      col = mix(col, c[2], (y / h) * 0.25 * k);
      if (edge < 2.5) col = c[2]; else if (edge < 7) col = mix(c[2], col, (edge - 2.5) / 4.5);
      const i = (y * w + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  },
  spiral(ctx, w, h, C, r) {
    const c = C.map(hex2rgb), cx = w * (0.35 + r() * 0.3), cy = h / 2, arms = 3 + ((r() * 4) | 0);
    pixelPass(ctx, w, h, (x, y) => {
      const dx = x - cx, dy = y - cy, rad = Math.hypot(dx, dy) + 1;
      const v = Math.sin(Math.atan2(dy, dx) * arms + Math.log(rad) * 9);
      const t = (v + 1) / 2;
      const col = t > 0.5 ? mix(c[1], c[2], (t - 0.5) * 2) : mix(c[0], c[1], t * 2);
      return mix(col, c[0], Math.min(1, rad / 600));
    });
  },
  opwave(ctx, w, h, C, r) {
    const c = C.map(hex2rgb), f = 0.012 + r() * 0.01;
    pixelPass(ctx, w, h, (x, y) => {
      const warp = Math.sin(x * f) * 22 + Math.sin(x * f * 2.3 + 1) * 8;
      const band = Math.sin((y + warp) * 0.35);
      const band2 = Math.sin((x + Math.sin(y * 0.03) * 20) * 0.08);
      const t = band > 0 ? 1 : 0;
      return t ? (band2 > 0.6 ? c[2] : c[1]) : c[0];
    });
  },
  kaleido(ctx, w, h, C, r, seed) {
    const c = C.map(hex2rgb), n = makeNoise(seed), seg = 6 + ((r() * 3) | 0) * 2;
    const tile = h;
    pixelPass(ctx, w, h, (x, y) => {
      const lx = (x % tile) - tile / 2, ly = y - h / 2;
      let a = Math.atan2(ly, lx), rad = Math.hypot(lx, ly);
      const wedge = Math.PI * 2 / seg;
      a = Math.abs(((a % wedge) + wedge) % wedge - wedge / 2);
      const u = Math.cos(a) * rad, v = Math.sin(a) * rad;
      const p = Math.sin(u * 0.09) * Math.cos(v * 0.12) + n(u / 25, v / 25) * 0.8;
      const t = (Math.sin(p * 4) + 1) / 2;
      const col = t > 0.7 ? c[2] : mix(c[0], c[1], t / 0.7);
      return mix(col, c[0], Math.min(0.6, rad / (tile * 0.9)));
    });
  },
  circuit(ctx, w, h, C, r) {
    ctx.fillStyle = C[0]; ctx.fillRect(0, 0, w, h);
    const g = 16;
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      let x = Math.round(r() * w / g) * g, y = Math.round(r() * h / g) * g;
      ctx.beginPath(); ctx.moveTo(x, y);
      const steps = 3 + ((r() * 8) | 0);
      for (let s = 0; s < steps; s++) {
        const dir = (r() * 8) | 0, len = g * (1 + ((r() * 3) | 0));
        const ang = dir * Math.PI / 4;
        x += Math.round(Math.cos(ang)) * len; y += Math.round(Math.sin(ang)) * len;
        ctx.lineTo(x, y);
      }
      const hot = r() < 0.3;
      ctx.strokeStyle = hot ? C[2] : C[1]; ctx.lineWidth = hot ? 3 : 2;
      ctx.shadowColor = C[1]; ctx.shadowBlur = hot ? 10 : 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = C[2]; ctx.fill();
    }
    ctx.shadowBlur = 0;
    for (let i = 0; i < 6; i++) {
      const x = r() * w, y = r() * h;
      ctx.fillStyle = C[0]; ctx.strokeStyle = C[1]; ctx.lineWidth = 2;
      ctx.fillRect(x, y, 40, 26); ctx.strokeRect(x, y, 40, 26);
    }
  },
};

function applyWear(ctx, w, h, float, seed) {
  if (float <= 0.02) return;
  const r = rng(seed ^ 0x9e3779b9);
  // scratches
  ctx.lineCap = 'round';
  const scratches = Math.floor(float * 520);
  for (let i = 0; i < scratches; i++) {
    const x = r() * w, y = r() * h, len = 4 + r() * 30 * float + 3, a = r() * Math.PI;
    ctx.strokeStyle = `rgba(${200 + r() * 40},${200 + r() * 40},${200 + r() * 40},${0.15 + r() * 0.45 * float})`;
    ctx.lineWidth = 0.6 + r() * 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  // worn-off paint patches revealing dark metal
  const patches = Math.floor(float * 60);
  for (let i = 0; i < patches; i++) {
    ctx.fillStyle = `rgba(55,55,58,${0.35 + r() * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(r() * w, r() * h, 2 + r() * 16 * float + 2, 1 + r() * 7 * float + 1, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // grime
  ctx.fillStyle = `rgba(20,15,10,${float * 0.25})`;
  ctx.fillRect(0, 0, w, h);
}

const skinCache = new Map();

export function skinCanvas(skin, float = 0, w = 512, h = 256) {
  const wearBucket = Math.round(float * 10) / 10;
  const key = `${skin.id}|${wearBucket}|${w}`;
  if (skinCache.has(key)) return skinCache.get(key);
  const c = canvas(w, h), ctx = c.getContext('2d', { willReadFrequently: true });
  const seed = skin.seed || hashStr(skin.id);
  PATTERNS[skin.pattern](ctx, w, h, skin.colors, rng(seed), seed);
  applyWear(ctx, w, h, wearBucket, seed);
  skinCache.set(key, c);
  return c;
}

const texCache = new Map();
export function skinTexture(skin, float = 0) {
  const key = `${skin.id}|${Math.round(float * 10)}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.CanvasTexture(skinCanvas(skin, float));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// --- environment textures -------------------------------------------------
function envTex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  return t;
}
function grayTex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  return t;
}

export function concreteTextures(seed = 7, base = [118, 114, 106], size = 512) {
  const c = canvas(size, size), ctx = c.getContext('2d');
  const b = canvas(size, size), bctx = b.getContext('2d');
  const n = makeNoise(seed), r = rng(seed);
  pixelPass(ctx, size, size, (x, y) => {
    const v = n.fbm(x / 60, y / 60, 5), s = n.fbm(x / 9 + 50, y / 9, 2);
    const stain = Math.max(0, n.fbm(x / 140 + 9, y / 140 + 3, 3) - 0.55) * 2.2;
    const k = 0.72 + v * 0.45 + (s - 0.5) * 0.12 - stain * 0.45;
    return base.map(ch => Math.max(0, Math.min(255, ch * k)));
  });
  // cracks
  ctx.strokeStyle = 'rgba(30,28,25,0.5)';
  for (let i = 0; i < 7; i++) {
    let x = r() * size, y = r() * size;
    ctx.lineWidth = 0.6 + r();
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 14; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  bctx.drawImage(c, 0, 0);
  return { map: c, bump: b };
}

export function makeConcrete(rx, ry, seed, base) {
  const { map, bump } = concreteTextures(seed, base);
  return { map: envTex(map, rx, ry), bumpMap: grayTex(bump, rx, ry) };
}

export function makeBrick(rx, ry) {
  const W = 512, H = 512, c = canvas(W, H), ctx = c.getContext('2d');
  const n = makeNoise(11), r = rng(3);
  ctx.fillStyle = '#5b544c'; ctx.fillRect(0, 0, W, H);
  const bw = 128, bh = 48;
  for (let row = 0; row < H / bh; row++) for (let col = -1; col < W / bw + 1; col++) {
    const x = col * bw + (row & 1 ? bw / 2 : 0), y = row * bh;
    const t = r();
    const base = [120 + t * 40, 62 + t * 18, 48 + t * 12];
    for (let yy = 3; yy < bh - 3; yy += 2) for (let xx = 3; xx < bw - 3; xx += 2) {
      const v = n.fbm((x + xx) / 25, (y + yy) / 25, 3);
      ctx.fillStyle = rgbStr(base.map(ch => ch * (0.7 + v * 0.5)));
      ctx.fillRect(x + xx, y + yy, 2, 2);
    }
  }
  // grime: darker towards the bottom and blotches
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(10,8,5,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(20,18,14,${r() * 0.15})`;
    ctx.beginPath(); ctx.arc(r() * W, r() * H, 10 + r() * 60, 0, 7); ctx.fill();
  }
  const b = canvas(W, H), bctx = b.getContext('2d');
  bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, W, H);
  bctx.fillStyle = '#222';
  for (let row = 0; row <= H / bh; row++) {
    bctx.fillRect(0, row * bh - 3, W, 6);
    for (let col = -1; col < W / bw + 1; col++) bctx.fillRect(col * bw + (row & 1 ? bw / 2 : 0) - 3, row * bh, 6, bh);
  }
  return { map: envTex(c, rx, ry), bumpMap: grayTex(b, rx, ry) };
}

export function makeWood(rx = 1, ry = 1, tint = [140, 98, 60], planks = 4, seed = 5) {
  const W = 512, H = 512, c = canvas(W, H), ctx = c.getContext('2d');
  const n = makeNoise(seed), r = rng(seed);
  const ph = H / planks, shades = Array.from({ length: planks }, () => 0.75 + r() * 0.35);
  pixelPass(ctx, W, H, (x, y) => {
    const p = Math.floor(y / ph);
    const grain = Math.sin(y * 0.8 + n.fbm(x / 160, y / 25 + p * 10, 3) * 12) * 0.5 + 0.5;
    let k = shades[p] * (0.75 + grain * 0.25) * (0.85 + n(x / 4, y / 4) * 0.15);
    if (y % ph < 3) k *= 0.35;
    return tint.map(ch => ch * k);
  });
  // nails
  ctx.fillStyle = '#2a2622';
  for (let p = 0; p < planks; p++) for (const x of [24, W - 24]) {
    ctx.beginPath(); ctx.arc(x, p * ph + ph / 2, 4, 0, 7); ctx.fill();
  }
  return { map: envTex(c, rx, ry) };
}

export function makeCardboard(label) {
  const W = 256, H = 256, c = canvas(W, H), ctx = c.getContext('2d');
  const n = makeNoise(21);
  pixelPass(ctx, W, H, (x, y) => {
    const v = 0.85 + n.fbm(x / 30, y / 30, 3) * 0.2 + Math.sin(y * 1.2) * 0.02;
    return [168 * v, 128 * v, 82 * v];
  });
  ctx.fillStyle = 'rgba(160,140,90,0.85)';
  ctx.fillRect(0, H / 2 - 18, W, 36);
  if (label) {
    ctx.fillStyle = 'rgba(30,25,20,0.75)';
    ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, 60);
    ctx.font = '16px monospace'; ctx.fillText('↑ THIS SIDE UP ↑', W / 2, 210);
  }
  return envTex(c);
}

export function makeMetal(color = [120, 124, 128], rust = 0.3, seed = 9) {
  const W = 256, H = 256, c = canvas(W, H), ctx = c.getContext('2d');
  const n = makeNoise(seed);
  pixelPass(ctx, W, H, (x, y) => {
    const brushed = 0.9 + n(x / 60, y * 2) * 0.12;
    const rv = Math.max(0, n.fbm(x / 40 + 3, y / 40, 4) - (1 - rust)) * 3;
    const base = color.map(ch => ch * brushed);
    return mix(base, [120, 62, 28], Math.min(1, rv));
  });
  return envTex(c);
}

export function caseLabelTexture(caseDef) {
  const W = 512, H = 256, c = canvas(W, H), ctx = c.getContext('2d');
  const col = hex2rgb(caseDef.color);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, rgbStr(mix(col, [0, 0, 0], 0.15)));
  g.addColorStop(1, rgbStr(mix(col, [0, 0, 0], 0.55)));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // chevrons
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 18;
  for (let x = -H; x < W + H; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H / 2, H / 2); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
  ctx.font = 'bold 64px Impact, "Arial Black", sans-serif';
  ctx.fillText(caseDef.name.replace(' Case', '').toUpperCase(), W / 2, H / 2 + 6);
  ctx.font = 'bold 28px "Arial Black", sans-serif';
  ctx.fillText('WEAPON CASE', W / 2, H / 2 + 52);
  ctx.font = '22px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('★ ARMS DEAL ★', W / 2, 56);
  return envTex(c);
}

export function makeDustSprite() {
  const c = canvas(32, 32), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,240,210,1)'); g.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function makeGlowSprite(color = '#ffffff') {
  const c = canvas(128, 128), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color); g.addColorStop(0.25, color + 'aa'); g.addColorStop(1, color + '00');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makePoster(lines, bg = '#d8cfb8') {
  const c = canvas(256, 360), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 360);
  const n = makeNoise(4);
  pixelPass(ctx, 256, 360, (x, y, p) => p.map(ch => ch * (0.8 + n.fbm(x / 40, y / 40, 3) * 0.25)));
  ctx.fillStyle = '#7a1a12'; ctx.fillRect(16, 16, 224, 70);
  ctx.fillStyle = '#f0e6d0'; ctx.font = 'bold 40px Impact, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(lines[0], 128, 66);
  ctx.fillStyle = '#2a2420'; ctx.font = 'bold 22px monospace';
  lines.slice(1).forEach((l, i) => ctx.fillText(l, 128, 130 + i * 34));
  return envTex(c);
}
