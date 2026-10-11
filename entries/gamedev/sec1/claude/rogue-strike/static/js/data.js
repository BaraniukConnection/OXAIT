// Aircraft roster, weapon specs and difficulty settings.

export const PLANES = [
  {
    id: 'thunder', name: 'THUNDER', type: 'Multirole canard-delta fighter', based: 'EF-2000 Typhoon type',
    speed: 2, agility: 2, special: 'hvaa',
    blurb: 'Balanced European canard-delta. Its HVAA missiles are very fast, so they are hard to dodge at long range.',
  },
  {
    id: 'vulture', name: 'VULTURE', type: 'Light canard-delta fighter', based: 'JAS 39 Gripen type',
    speed: 2, agility: 2, special: 'saam',
    blurb: 'Light and nimble. Its SAAM radar missile turns very hard, but only while you keep the target inside the lock circle.',
  },
  {
    id: 'falcon', name: 'FALCON', type: 'Heavy air-superiority fighter', based: 'Su-27 Flanker type, Ukrainian digital camo',
    speed: 3, agility: 3, special: '4aam',
    blurb: 'Big, fast and agile. Its 4AAM locks up to four Rogues and fires one missile at each.',
  },
  {
    id: 'shadow', name: 'SHADOW', type: 'Stealth air-dominance fighter', based: 'F-22 Raptor type',
    speed: 3, agility: 3, special: 'hpaa',
    blurb: 'Stealth fighter with thrust vectoring. Its HPAA warhead is heavy, and the large blast hits anything nearby.',
  },
];

// speed / agility levels (x/4) -> flight numbers
export const SPEED = { 1: 230, 2: 280, 3: 330, 4: 370 };          // max speed m/s (afterburner)
export const AGILITY = {
  1: { pitch: 0.8, roll: 2.1, yaw: 0.28 },
  2: { pitch: 1.05, roll: 2.6, yaw: 0.34 },
  3: { pitch: 1.35, roll: 3.3, yaw: 0.44 },
  4: { pitch: 1.6, roll: 3.9, yaw: 0.52 },
};

// Weapons. cone = lock half-angle (rad); turn = max missile turn rate (rad/s); reload = time per rail.
export const WEAPONS = {
  gun: { name: 'GUN', full: 'Machine gun', rate: 16, speed: 1150, life: 1.5, dmg: 6, ammo: Infinity },
  msl: { name: 'MSL', full: 'Standard AA missile', speed: 520, turn: 2.0, dmg: 60, range: 2600, cone: 0.42, lockTime: 0.7, ammo: 80, rails: 2, reload: 2.4, life: 7, prox: 18 },
  hvaa: { name: 'HVAA', full: 'High-speed AA missile', speed: 980, turn: 1.25, dmg: 100, range: 4400, cone: 0.28, lockTime: 1.0, ammo: 16, rails: 2, reload: 4.5, life: 6, prox: 22,
    desc: 'Very fast, long range. Turns gently, so fire it at targets in front of you.' },
  saam: { name: 'SAAM', full: 'Semi-active radar AA missile', speed: 600, turn: 4.2, dmg: 100, range: 3300, cone: 0.3, lockTime: 0.8, ammo: 18, rails: 1, reload: 3, life: 8, prox: 22, needsCircle: true,
    desc: 'Turns very hard, but only guides while the target stays inside your lock circle.' },
  '4aam': { name: '4AAM', full: '4-target multi-lock missile', speed: 520, turn: 2.4, dmg: 100, range: 2900, cone: 0.62, lockTime: 0.45, ammo: 24, rails: 1, reload: 9, life: 7, prox: 20, multi: 4,
    desc: 'Locks up to 4 targets and fires a missile at each one.' },
  hpaa: { name: 'HPAA', full: 'High-power AA missile', speed: 640, turn: 1.75, dmg: 160, range: 3400, cone: 0.36, lockTime: 0.9, ammo: 12, rails: 2, reload: 5, life: 7, prox: 30, blast: 150,
    desc: 'Heavy warhead with a large blast radius. Can kill several Rogues at once.' },
  emsl: { name: 'MSL', speed: 470, turn: 1.55, dmg: 34, range: 2600, life: 8, prox: 16 },
};

export const DIFFICULTY = {
  easy: { label: 'EASY', count: 6, turn: 0.75, accuracy: 0.045, missileCd: [13, 20], evade: 0.25, gunDmg: 2, aggro: 1.15 },
  normal: { label: 'NORMAL', count: 9, turn: 0.95, accuracy: 0.03, missileCd: [9, 15], evade: 0.5, gunDmg: 3, aggro: 1.25 },
  hard: { label: 'HARD', count: 13, turn: 1.15, accuracy: 0.018, missileCd: [6, 10], evade: 0.75, gunDmg: 4, aggro: 1.35 },
};
