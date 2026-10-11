// Renders weapon-skin and case thumbnails (data URLs) with an offscreen renderer.
import * as THREE from 'three';
import { buildWeapon, buildCase } from './models.js';

const W = 256, H = 144;
let renderer, scene, camera;
const cache = new Map();

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, W / H, 0.01, 10);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1, 2, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x99bbff, 1.2);
  rim.position.set(-2, 1, -2);
  scene.add(rim);
}

function snapshot(obj, camPos, look = new THREE.Vector3()) {
  if (!renderer) setup();
  scene.add(obj);
  camera.position.copy(camPos);
  camera.lookAt(look);
  renderer.render(scene, camera);
  scene.remove(obj);
  return renderer.domElement.toDataURL('image/png');
}

export function skinThumb(skin, float = 0.03) {
  const key = skin.id + '|' + Math.round(float * 10);
  if (cache.has(key)) return cache.get(key);
  const g = buildWeapon(skin.weapon, skin, float, { fit: 1 });
  g.rotation.set(0.05, -0.12, -0.12);
  const url = snapshot(g, new THREE.Vector3(0, 0.02, 2.05));
  cache.set(key, url);
  return url;
}

export function caseThumb(caseDef) {
  const key = 'case|' + caseDef.id;
  if (cache.has(key)) return cache.get(key);
  const g = buildCase(caseDef);
  g.rotation.set(0.35, -0.5, 0);
  g.position.y = -0.05;
  const url = snapshot(g, new THREE.Vector3(0, 0.12, 1.15));
  cache.set(key, url);
  return url;
}

/** Pre-render thumbnails while the browser is idle. */
export function warmThumbs(skins) {
  const queue = [...skins];
  const idle = window.requestIdleCallback || (f => setTimeout(() => f({ timeRemaining: () => 12 }), 30));
  const step = (deadline) => {
    do skinThumb(queue.shift());
    while (queue.length && deadline.timeRemaining() > 8);
    if (queue.length) idle(step);
  };
  idle(step);
}
