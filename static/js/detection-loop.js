import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ================= helpers ================= */
const V = THREE.Vector3;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const back = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const pop = (t, a, d = .45) => t < a ? 0 : back(clamp((t - a) / d));
const win = (t, a, b, f = .3) => Math.min(seg(t, a, a + f), 1 - seg(t, b - f, b)); // fade-in/out window
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const D = 8;            // seconds per step
const N = 4;            // steps
const INK = 0x201c17;

/* ================= renderers (one per station) ================= */
const loopEl = document.getElementById('dl-loop');
const stage = loopEl;
const cells = [...loopEl.querySelectorAll('.dl-cell')];
const renderers = [];
try {
  cells.forEach(cell => {
    const r = new THREE.WebGLRenderer({ canvas: cell.querySelector('canvas'), antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; renderers.push(r);
  });
} catch (e) { document.getElementById('dl-fallback').style.display = 'grid'; throw e; }
const cams = cells.map(() => new THREE.PerspectiveCamera(30, 1.6, 0.1, 120));

const scene = new THREE.Scene();

scene.add(new THREE.HemisphereLight(0xfffaf0, 0xb7a684, 1.35));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(5, 11, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
sun.shadow.bias = -0.0006;
sun.shadow.radius = 5;
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.17, color: 0x3a2d18 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* ================= materials (hand-drawn look) ================= */
const grad = new THREE.DataTexture(new Uint8Array([105, 105, 105, 255, 182, 182, 182, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;

const STIP = (() => {
  const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const x = cv.getContext('2d'), r = rng(7);
  x.fillStyle = '#fff'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(40,30,18,${0.05 + r() * 0.13})`; x.beginPath(); x.arc(r() * s, r() * s, 0.4 + r() * 1.1, 0, 7); x.fill(); }
  x.save(); x.beginPath(); x.rect(0, s * 0.6, s, s * 0.4); x.clip();
  x.strokeStyle = 'rgba(40,30,18,0.12)'; x.lineWidth = 1;
  for (let k = -s; k < s * 2; k += 4) { x.beginPath(); x.moveTo(k, s); x.lineTo(k + s * 0.55, s * 0.45); x.stroke(); }
  x.restore();
  x.strokeStyle = 'rgba(40,30,18,0.10)';
  for (let k = 0; k < s; k += 5) { x.beginPath(); x.moveTo(s - 26 + (k % 3), k); x.lineTo(s, k + 3); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
})();
const matCache = {};
function toon(hex, unique = false) {
  if (!unique && matCache[hex]) return matCache[hex];
  const m = new THREE.MeshToonMaterial({ color: new THREE.Color(hex), map: STIP, gradientMap: grad });
  if (!unique) matCache[hex] = m;
  return m;
}
const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const inkFlat = new THREE.MeshBasicMaterial({ color: INK });
const whiteFlat = new THREE.MeshBasicMaterial({ color: 0xfbf8ef });

/** mesh + inverted-hull ink outline (geometry must be roughly centred) */
function outlined(geo, mat, t = 0.035, shadow = true) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = false; g.add(m);
  geo.computeBoundingBox();
  const s = new V(), c = new V(); geo.boundingBox.getSize(s); geo.boundingBox.getCenter(c);
  const o = new THREE.Mesh(geo, inkMat);
  const f = (d) => d > 1e-4 ? (d + 2 * t) / d : 1;
  o.scale.set(f(s.x), f(s.y), f(s.z));
  o.position.set(c.x * (1 - o.scale.x), c.y * (1 - o.scale.y), c.z * (1 - o.scale.z));
  g.add(o); g.userData.main = m; g.userData.outline = o;
  return g;
}
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }

/* ================= the SwarmHarm robot ================= */
const COLORS = { blue: '#8fb1da', green: '#8ec4ae', tan: '#d3bd8e', grey: '#babcc1' };
const MOODS = {
  happy:     { tilt: 0,     by: 0,     eye: 1,    mouth: 1,    o: 0 },
  neutral:   { tilt: 0,     by: 0,     eye: 1,    mouth: .45,  o: 0 },
  surprised: { tilt: -.05,  by: .07,   eye: 1.12, mouth: .3,   o: 1 },
  worried:   { tilt: .4,    by: .02,   eye: 1,    mouth: -.75, o: 0 },
  focused:   { tilt: -.24,  by: -.035, eye: .6,   mouth: .25,  o: 0 },
  talking:   { tilt: -.05,  by: .03,   eye: 1,    mouth: .3,   o: 1 },
};
let robotSeed = 1;
class Robot {
  constructor(kind) {
    const col = COLORS[kind];
    const r = rng(robotSeed++ * 97);
    this.root = new THREE.Group();
    this.bob = new THREE.Group(); this.root.add(this.bob);
    this.head = new THREE.Group(); this.head.position.y = 0.6; this.bob.add(this.head);
    const W = 1.6, H = 1.15, Dp = 1.08;
    this.head.add(outlined(new RoundedBoxGeometry(W, H, Dp, 5, 0.27), toon(col), 0.042));
    const dark = toon('#' + new THREE.Color(col).multiplyScalar(0.83).getHexString());
    for (const s of [-1, 1]) {
      const ear = outlined(new THREE.CylinderGeometry(0.21, 0.21, 0.2, 28), dark, 0.035);
      ear.rotation.z = Math.PI / 2; ear.position.set(s * (W / 2 + 0.09), 0.02, -0.03); this.head.add(ear);
    }
    const ant = outlined(new THREE.CylinderGeometry(0.13, 0.145, 0.24, 24), dark, 0.035);
    ant.position.set(0.04, H / 2 + 0.11, 0); this.head.add(ant);

    const face = new THREE.Group(); face.position.z = Dp / 2 + 0.006; this.head.add(face);
    this.eyes = []; this.pupils = []; this.brows = [];
    for (const s of [-1, 1]) {
      const eg = new THREE.Group(); eg.position.set(s * 0.32, 0.02, 0); face.add(eg);
      eg.add(new THREE.Mesh(new THREE.CircleGeometry(0.19, 36), whiteFlat));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.228, 40), inkFlat); ring.position.z = 0.001; eg.add(ring);
      const pg = new THREE.Group(); pg.position.z = 0.003; eg.add(pg);
      pg.add(new THREE.Mesh(new THREE.CircleGeometry(0.088, 24), inkFlat));
      const glint = new THREE.Mesh(new THREE.CircleGeometry(0.026, 12), whiteFlat); glint.position.set(0.03, 0.032, 0.002); pg.add(glint);
      this.eyes.push(eg); this.pupils.push(pg);
      const bg = new THREE.Group(); bg.position.set(s * 0.32, 0.3, 0.002); face.add(bg);
      const arc = Math.PI * 0.5;
      const brow = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.024, 8, 18, arc), inkFlat);
      brow.rotation.z = Math.PI / 2 - arc / 2; brow.position.y = -0.17 * (1 + Math.cos(arc / 2)) / 2; bg.add(brow);
      bg.userData.side = s; this.brows.push(bg);
    }
    this.mouthG = new THREE.Group(); this.mouthG.position.set(0.02, -0.25, 0.002); face.add(this.mouthG);
    const ma = Math.PI * 0.72, R = 0.15;
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(R, 0.025, 8, 22, ma), inkFlat);
    this.mouth.rotation.z = -Math.PI / 2 - ma / 2; this.mouth.position.y = R * (1 + Math.cos(ma / 2)) / 2; this.mouthG.add(this.mouth);
    this.mouthO = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), inkFlat); this.mouthO.scale.set(0.85, 1, 1); face.add(this.mouthO);
    this.mouthO.position.set(0.02, -0.24, 0.003);

    this.m = { ...MOODS.happy }; this.mt = { ...MOODS.happy };
    this.yaw = 0; this.pitch = 0; this.tyaw = 0; this.tpitch = 0;
    this.gx = 0; this.gy = 0; this.tgx = 0; this.tgy = 0;
    this.blinkAt = 1 + r() * 3; this.phase = r() * 10;
  }
  mood(name) { this.mt = { ...MOODS[name] }; return this; }
  look(p) {
    this.root.updateWorldMatrix(true, false);
    const l = this.root.worldToLocal(p.clone());
    const sc = this.root.getWorldScale(new V()).x || 1;
    const dy = l.y - (0.6 + this.bob.position.y);
    const yaw = Math.atan2(l.x, l.z), pitch = Math.atan2(dy, Math.hypot(l.x, l.z));
    this.tyaw = clamp(yaw, -1.05, 1.05) * 0.55; this.tpitch = clamp(pitch, -0.7, 0.7) * 0.55;
    this.tgx = clamp(yaw * 1.1, -1, 1); this.tgy = clamp(pitch * 1.4, -1, 1);
    return this;
  }
  lookAhead() { this.tyaw = 0; this.tpitch = 0; this.tgx = 0; this.tgy = 0; return this; }
  hop(h, squash = 0) { this.bob.position.y = h; const s = squash; this.bob.scale.set(1 + s, 1 - s, 1 + s); return this; }
  update(dt, time) {
    const k = 1 - Math.exp(-dt * 9), kk = 1 - Math.exp(-dt * 6);
    for (const key in this.m) this.m[key] = lerp(this.m[key], this.mt[key], k);
    this.yaw = lerp(this.yaw, this.tyaw, kk); this.pitch = lerp(this.pitch, this.tpitch, kk);
    this.gx = lerp(this.gx, this.tgx, k); this.gy = lerp(this.gy, this.tgy, k);
    this.head.rotation.set(-this.pitch, this.yaw, Math.sin(time * 1.3 + this.phase) * 0.035);
    if (time > this.blinkAt + 0.14) this.blinkAt = time + 2 + Math.random() * 3.5;
    const blink = time > this.blinkAt ? 0.08 : 1;
    for (const e of this.eyes) e.scale.set(1, this.m.eye * blink, 1);
    for (const p of this.pupils) p.position.set(this.gx * 0.075, this.gy * 0.07, 0.003);
    for (const b of this.brows) { b.rotation.z = -b.userData.side * this.m.tilt; b.position.y = 0.3 + this.m.by; }
    const mo = this.m.mouth; this.mouthG.scale.set(1, Math.sign(mo || 1) * Math.max(0.14, Math.abs(mo)), 1);
    this.mouthG.visible = this.m.o < 0.5;
    const os = clamp(this.m.o); this.mouthO.visible = os > 0.05; this.mouthO.scale.set(0.85 * os, os, 1);
  }
}
const faceTo = (r, x, z) => { r.root.rotation.y = Math.atan2(x - r.root.position.x, z - r.root.position.z); };

/* ================= labels (HTML pills tracked in 3D) ================= */
const LBL = [];
function addLabel(si, html, cls, posFn, visFn) {
  const el = document.createElement('div'); el.className = 'dl-lbl ' + (cls || ''); el.innerHTML = html;
  cells[si].querySelector('.dl-labels').appendChild(el); LBL.push({ si, el, posFn, visFn });
}
const tmpV = new V();
function updateLabels(si, t) {
  const cv = cells[si].querySelector('canvas'), w = cv.clientWidth, h = cv.clientHeight, cam = cams[si];
  for (const L of LBL) {
    if (L.si !== si) continue;
    const o = L.visFn(t);
    if (o <= 0.01) { L.el.style.opacity = 0; continue; }
    L.posFn(t, tmpV); tmpV.project(cam);
    L.el.style.opacity = o.toFixed(3);
    L.el.style.transform = `translate(${((tmpV.x * .5 + .5) * w).toFixed(1)}px,${((-tmpV.y * .5 + .5) * h).toFixed(1)}px) translate(-50%,-100%) scale(${(0.85 + 0.15 * o).toFixed(3)})`;
  }
}

/* ================= props ================= */
function paperLines(color = '#fbf8ef', lineCol = '#bdb29b', chip = null) {
  return canvasTex(128, 160, (x, w, h) => {
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    x.fillStyle = lineCol;
    const r = rng(lineCol.length * 13 + (chip ? 5 : 0));
    for (let y = 26; y < h - 14; y += 18) { rr(x, 16, y, 40 + r() * 64, 7, 3.5); x.fill(); }
    if (chip) { x.fillStyle = chip; rr(x, 14, 8, 26, 10, 4); x.fill(); }
  });
}
function makeKey() {
  const g = new THREE.Group(), gold = toon('#e6b84f');
  const ring = outlined(new THREE.TorusGeometry(0.12, 0.045, 10, 26), gold, 0.025); ring.position.x = -0.2; g.add(ring);
  const shaft = outlined(new THREE.BoxGeometry(0.34, 0.07, 0.07), gold, 0.025); shaft.position.x = 0.06; g.add(shaft);
  for (const [x, h] of [[0.15, 0.13], [0.22, 0.09]]) { const tth = outlined(new THREE.BoxGeometry(0.05, h, 0.07), gold, 0.022); tth.position.set(x, -h / 2, 0); g.add(tth); }
  return g;
}
function makeCloud() {
  const g = new THREE.Group(), w = toon('#fdfbf5');
  for (const [x, y, r] of [[0, 0, .42], [.4, .02, .32], [-.4, 0, .32], [.18, .26, .32], [-.18, .24, .3], [.62, -.1, .2], [-.62, -.1, .2]]) {
    const b = outlined(new THREE.SphereGeometry(r, 24, 16), w, 0.03); b.position.set(x, y, 0); b.scale.z = 0.55; g.add(b);
  }
  for (const [x, y, r] of [[-.25, -.55, .1], [-.4, -.78, .065]]) { const b = outlined(new THREE.SphereGeometry(r, 16, 12), w, 0.025); b.position.set(x, y, 0); g.add(b); }
  return g;
}
function makeBubble() {
  const g = new THREE.Group(), w = toon('#fdfbf5');
  g.add(outlined(new RoundedBoxGeometry(1.0, 0.72, 0.16, 3, 0.07), w, 0.03));
  const tail = outlined(new THREE.ConeGeometry(0.12, 0.3, 4), w, 0.03); tail.rotation.z = Math.PI * 0.82; tail.position.set(-0.32, -0.42, 0); tail.scale.z = 0.4; g.add(tail);
  return g;
}

/* ================= SCENES ================= */
const scenes = [];
function newScene(cam, info) { const g = new THREE.Group(); g.visible = false; scene.add(g); const s = { group: g, cam, info, robots: [], update() { } }; scenes.push(s); return s; }

/* ---------- 1. Recorded run: agents gather around their shared channels, everything is recorded ---------- */
(() => {
  const si = 0;
  const S = newScene({ pos: new V(0.3, 6.2, 13.0), target: new V(0.2, 0.9, 0.4) }, {
    title: 'Recorded run', text: 'Agents in separate sandboxes find shared channels and talk through them. Every action and artifact is recorded for replay.', tag: 'record', color: '#201c17'
  });
  const g = S.group;
  // the agents stand in a ring around the shared channels
  const P = [new V(-3.0, 0, 0.5), new V(3.0, 0, 0.5), new V(-1.75, 0, -2.25), new V(1.75, 0, -2.25)];
  const R = [new Robot('blue'), new Robot('green'), new Robot('tan'), new Robot('grey')];
  R.forEach((r, i) => { r.root.position.copy(P[i]); faceTo(r, 0, 1.6); g.add(r.root); });
  S.robots = R;

  // --- channel 1: shared artifact service (package shelf used as a message board) ---
  const ART = new V(0, 0, -0.55);
  const art = new THREE.Group(); art.position.copy(ART); g.add(art);
  const shelf = outlined(new RoundedBoxGeometry(1.9, 1.25, 0.9, 3, 0.08), toon('#7f93a8'), 0.03); shelf.position.y = 0.63; art.add(shelf);
  const pkM = [toon('#d3bd8e'), toon('#c9a46a'), toon('#d8c9a5')];
  [[-0.55, 0.2], [0.05, -0.1], [0.55, 0.15]].forEach(([x, z], k) => {
    const pk = outlined(new RoundedBoxGeometry(0.42, 0.34, 0.42, 2, 0.04), pkM[k], 0.025); pk.position.set(x, 1.43, z); pk.rotation.y = k * 0.3; art.add(pk);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.02, 0.08), inkFlat); tape.position.set(x, 1.61, z); tape.rotation.y = k * 0.3; art.add(tape);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), toon('#f4ecd8')); board.position.set(0, 0.66, 0.456); art.add(board);
  const boardRing = new THREE.Mesh(new THREE.RingGeometry(0.001, 0.001, 4), inkFlat); art.add(boardRing);
  const noteCols = ['#8fb1da', '#8ec4ae', '#d3bd8e', '#babcc1'];
  const notes = [];
  for (let k = 0; k < 6; k++) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    n.position.set(-0.5 + (k % 3) * 0.5, 0.86 - Math.floor(k / 3) * 0.38, 0.462); n.rotation.z = (k % 2 ? 1 : -1) * 0.08; art.add(n);
    const pin = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), new THREE.MeshBasicMaterial({ color: 0xd9443a })); pin.position.set(0, 0.09, 0.002); n.add(pin);
    notes.push(n);
  }
  // --- channel 2: a shared index page (messages hidden in directory names / URL paths) ---
  const IDX = new V(-1.2, 0, 1.25);
  const idx = new THREE.Group(); idx.position.copy(IDX); idx.rotation.y = 0.35; g.add(idx);
  const stand = outlined(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 10), toon('#6b7078'), 0.02); stand.position.y = 0.25; idx.add(stand);
  const page = outlined(new RoundedBoxGeometry(1.15, 0.85, 0.07, 2, 0.03), toon('#fdfbf5'), 0.025); page.position.y = 0.88; idx.add(page);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.11, 0.12), new THREE.MeshBasicMaterial({ color: 0xcfd6de })); bar.position.set(0, 1.23, 0.038); idx.add(bar);
  [0, 1, 2].forEach(k => { const d = new THREE.Mesh(new THREE.CircleGeometry(0.025, 8), inkFlat); d.position.set(-0.48 + k * 0.08, 1.23, 0.04); idx.add(d); });
  const idxLines = [];
  for (let k = 0; k < 4; k++) {
    const gL = new THREE.PlaneGeometry(0.8, 0.07); gL.translate(0.4, 0, 0);
    const l = new THREE.Mesh(gL, new THREE.MeshBasicMaterial({ color: k % 2 ? 0x8fb1da : 0xb7ab92 })); l.position.set(-0.46, 1.06 - k * 0.15, 0.04); idx.add(l); idxLines.push(l);
  }
  // --- channel 3: an external file-sharing service ---
  const FS = new V(1.2, 0, 1.25);
  const fs = new THREE.Group(); fs.position.copy(FS); fs.rotation.y = -0.35; g.add(fs);
  const back = outlined(new RoundedBoxGeometry(1.1, 0.8, 0.12, 2, 0.04), toon('#e3b962'), 0.025); back.position.y = 0.48; fs.add(back);
  const tab = outlined(new RoundedBoxGeometry(0.4, 0.14, 0.12, 2, 0.03), toon('#e3b962'), 0.022); tab.position.set(-0.32, 0.92, 0); fs.add(tab);
  const sheets = [];
  for (let k = 0; k < 3; k++) { const sh = outlined(new RoundedBoxGeometry(0.8, 0.62, 0.02, 1, 0.01), toon('#fdfbf5'), 0.015); sh.position.set(0.02 * k, 0.55 + k * 0.03, 0.08 + k * 0.02); fs.add(sh); sheets.push(sh); }
  const front = outlined(new RoundedBoxGeometry(1.1, 0.62, 0.06, 2, 0.03), toon('#f0c96f'), 0.022); front.position.set(0, 0.4, 0.16); front.rotation.x = -0.12; fs.add(front);

  const CH = { art: { obj: art, top: new V(ART.x, 1.75, ART.z + 0.3) }, idx: { obj: idx, top: new V(IDX.x, 1.45, IDX.z) }, fs: { obj: fs, top: new V(FS.x, 1.15, FS.z) } };
  // messages: who writes to which channel, and who reads it back
  const EV = [
    { from: 0, ch: 'art', to: 1, t: 0.35 }, { from: 2, ch: 'idx', to: 0, t: 1.45 }, { from: 1, ch: 'art', to: 3, t: 2.55 },
    { from: 3, ch: 'fs', to: 2, t: 3.65 }, { from: 0, ch: 'art', to: 2, t: 4.75 }, { from: 1, ch: 'idx', to: 3, t: 5.85 },
  ];
  const SEND = 0.6, READ = 0.6, GAP = 0.15;
  const cards = EV.map(e => {
    const c = outlined(new RoundedBoxGeometry(0.42, 0.06, 0.3, 2, 0.02), toon(noteCols[e.from]), 0.02);
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), whiteFlat); flap.rotation.x = -Math.PI / 2; flap.position.y = 0.032; c.add(flap);
    g.add(c); return c;
  });
  // recorder camera on a tripod, taping everything
  const rec = new THREE.Group(); rec.position.set(4.3, 0, 2.6); g.add(rec);
  rec.rotation.y = Math.atan2(0 - 4.3, 0 - 2.6);
  const metal = toon('#5d6269'), dmetal = toon('#3f4349');
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3, leg = outlined(new THREE.CylinderGeometry(0.035, 0.045, 1.55, 8), dmetal, 0.02);
    leg.position.set(Math.sin(a) * 0.32, 0.72, Math.cos(a) * 0.32); leg.rotation.set(Math.cos(a) * 0.22, 0, -Math.sin(a) * 0.22); rec.add(leg);
  }
  const body = outlined(new RoundedBoxGeometry(0.62, 0.6, 0.95, 3, 0.08), metal, 0.03); body.position.y = 1.72; rec.add(body);
  const lens = outlined(new THREE.CylinderGeometry(0.22, 0.25, 0.36, 28), dmetal, 0.03); lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.72, 0.62); rec.add(lens);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.17, 28), new THREE.MeshBasicMaterial({ color: 0x9cc6da })); glass.position.set(0, 1.72, 0.805); rec.add(glass);
  const reels = [];
  for (const z of [-0.26, 0.24]) {
    const reel = new THREE.Group(); reel.position.set(0, 2.32, z); rec.add(reel);
    const disc = outlined(new THREE.CylinderGeometry(0.29, 0.29, 0.1, 30), toon('#868b92'), 0.025); disc.rotation.z = Math.PI / 2; reel.add(disc);
    for (let k = 0; k < 3; k++) { const hole = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), inkFlat); const a = k * 2.094; hole.position.set(0.052, Math.sin(a) * 0.15, Math.cos(a) * 0.15); hole.rotation.y = Math.PI / 2; reel.add(hole); }
    reels.push(reel);
  }
  const recLight = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10), new THREE.MeshBasicMaterial({ color: 0xe0402f })); recLight.position.set(0.2, 2.06, 0.38); rec.add(recLight);

  addLabel(si, 'artifact service', 'small', (t, v) => v.set(ART.x, 2.0, ART.z - 0.2), t => win(t, 0.3, D - 0.2));
  addLabel(si, 'index page', 'small', (t, v) => v.set(IDX.x - 0.1, -0.45, IDX.z + 0.5), t => win(t, 0.3, D - 0.2));
  addLabel(si, 'file share', 'small', (t, v) => v.set(FS.x + 0.1, -0.45, FS.z + 0.5), t => win(t, 0.3, D - 0.2));
  addLabel(si, 'REC · every action', 'rec', (t, v) => v.set(4.3, 3.05, 2.6), t => win(t, 0.6, D - 0.2));

  const head = i => new V(P[i].x, 1.45 + R[i].bob.position.y, P[i].z);
  S.update = (t, dt, time) => {
    const hops = [0, 0, 0, 0];
    let focus = CH.art.top;
    EV.forEach((e, n) => {
      const c = cards[n], a = e.t, b = a + SEND, r0 = b + GAP, r1 = r0 + READ;
      const top = CH[e.ch].top;
      c.visible = t >= a && t <= r1;
      if (c.visible) {
        if (t < b) { const q = seg(t, a, b); c.position.lerpVectors(head(e.from), top, ease(q)); c.position.y += 0.9 * Math.sin(Math.PI * q); c.rotation.set(0, q * 3, Math.sin(Math.PI * q) * 0.4); focus = c.position; }
        else if (t < r0) { c.position.copy(top); }
        else { const q = seg(t, r0, r1); c.position.lerpVectors(top, head(e.to), ease(q)); c.position.y += 0.9 * Math.sin(Math.PI * q); c.rotation.set(0, -q * 3, -Math.sin(Math.PI * q) * 0.4); focus = c.position; }
      }
      // sender hops as it posts, reader hops when the message lands
      const hq = seg(t, a - 0.25, a + 0.05); if (hq > 0 && hq < 1) hops[e.from] = Math.max(hops[e.from], 0.3 * Math.sin(Math.PI * hq));
      const rq = seg(t, r1 - 0.05, r1 + 0.25); if (rq > 0 && rq < 1) hops[e.to] = Math.max(hops[e.to], 0.22 * Math.sin(Math.PI * rq));
      // channel reacts when a message arrives
      const bump = 1 + 0.08 * Math.sin(Math.PI * seg(t, b - 0.02, b + 0.3));
      if (t > b - 0.02 && t < b + 0.3) CH[e.ch].obj.scale.setScalar(bump);
    });
    for (const k in CH) if (!EV.some(e => t > e.t + SEND - 0.02 && t < e.t + SEND + 0.3 && e.ch === k)) CH[k].obj.scale.setScalar(1);
    // what each channel has accumulated
    let nArt = 0, nIdx = 0, nFs = 0;
    EV.forEach(e => { if (t >= e.t + SEND) { if (e.ch === 'art') nArt++; else if (e.ch === 'idx') nIdx++; else nFs++; } });
    notes.forEach((n, k) => { const on = k < nArt; n.visible = on; if (on) n.material.color.set(noteCols[EV.filter(e => e.ch === 'art')[k].from]); });
    idxLines.forEach((l, k) => l.scale.set(k < 2 + nIdx ? 1 : 0.001, 1, 1));
    sheets.forEach((s, k) => s.visible = k < 1 + nFs);
    R.forEach((r, i) => {
      r.hop(hops[i], 0);
      const sending = EV.find(e => e.from === i && t >= e.t - 0.3 && t < e.t + SEND);
      const reading = EV.find(e => e.to === i && t >= e.t + SEND + GAP && t < e.t + SEND + GAP + READ + 0.3);
      if (sending) r.mood('talking').look(CH[sending.ch].top.clone());
      else if (reading) r.mood(t < reading.t + SEND + GAP + READ ? 'surprised' : 'happy').look(focus.clone());
      else r.mood('happy').look(focus.clone());
    });
    reels.forEach((r, i) => r.rotation.x = time * (i ? 2.4 : 2.0));
    recLight.visible = Math.floor(time * 2) % 2 === 0;
  };
})();

/* ---------- 2. Action-only monitor: an eye with binoculars watches the protected systems ---------- */
(() => {
  const si = 1;
  const S = newScene({ pos: new V(-0.6, 7.2, 11.6), target: new V(0.2, 0.9, -0.5) }, {
    title: 'Action-only monitor', text: 'Ignores the chatter. It watches only what the agents actually changed in protected state, and flags each change.', tag: 'actions', color: '#9a6c1d'
  });
  const g = S.group;
  const C = new V(-0.6, 0, -0.4), TOPY = 0.14;
  // protected zone: an external model hub's production workers and its secrets
  const base = outlined(new RoundedBoxGeometry(4.2, 0.14, 2.3, 3, 0.05), toon('#6b7078'), 0.03); base.position.set(C.x, 0.07, C.z); g.add(base);
  base.userData.main.receiveShadow = true;
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.06), new THREE.MeshBasicMaterial({ color: 0xe3b84f })); stripe.rotation.x = -Math.PI / 2; stripe.position.set(C.x, 0.145, C.z + 1.02); g.add(stripe);
  const rackM = toon('#4a4f57');
  function makeRack(x) {
    const rk = new THREE.Group(); rk.position.set(x, TOPY, C.z - 0.35); g.add(rk);
    { const bx = outlined(new RoundedBoxGeometry(0.85, 1.55, 0.8, 3, 0.06), rackM, 0.03); bx.position.y = 0.78; rk.add(bx); }
    for (let k = 0; k < 4; k++) { const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.05), new THREE.MeshBasicMaterial({ color: 0x2c2f34 })); sl.position.set(-0.03, 1.25 - k * 0.27, 0.405); rk.add(sl); }
    const lights = [];
    for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), new THREE.MeshBasicMaterial({ color: 0x7fd39a })); l.position.set(0.32, 1.25 - k * 0.27, 0.41); rk.add(l); lights.push(l); }
    rk.userData.lights = lights; return rk;
  }
  const racks = [makeRack(C.x - 1.45), makeRack(C.x - 0.3)];
  // secrets vault
  const vault = new THREE.Group(); vault.position.set(C.x + 1.15, TOPY, C.z - 0.3); g.add(vault);
  { const bx = outlined(new RoundedBoxGeometry(1.0, 0.95, 0.85, 3, 0.07), toon('#9aa0a7'), 0.03); bx.position.y = 0.48; vault.add(bx); }
  const hinge = new THREE.Group(); hinge.position.set(-0.42, 0.48, 0.43); vault.add(hinge);
  const door = outlined(new RoundedBoxGeometry(0.84, 0.8, 0.07, 2, 0.03), toon('#b8bdc3'), 0.025); door.position.x = 0.42; hinge.add(door);
  const dial = outlined(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 20), toon('#5d6269'), 0.02); dial.rotation.x = Math.PI / 2; dial.position.set(0.42, 0, 0.06); hinge.add(dial);
  const vkey = makeKey(); vkey.scale.setScalar(0.9); g.add(vkey);
  const VKEY0 = new V(vault.position.x, TOPY + 0.5, vault.position.z + 0.1);

  const A = new Robot('blue'), B = new Robot('green');
  g.add(A.root, B.root); S.robots = [A, B];
  const SA = new V(-3.9, 0, 1.4), SB = new V(3.5, 0, 0.9);
  const beside = (obj, side) => new V(obj.position.x + side * 0.15, 0, C.z + 1.55);
  const PA = new V(C.x - 2.45, 0, C.z + 0.6), PB = new V(C.x + 2.45, 0, C.z + 0.7);
  const keysA = [[0, SA], [1.0, SA], [1.6, PA], [6.3, PA], [6.9, SA]];
  const keysB = [[0, SB], [2.9, SB], [3.5, PB], [5.9, PB], [6.5, SB]];
  const EVENTS = [
    { obj: racks[0], t: 1.75, who: A, label: '⚑ code exec on a worker' },
    { obj: vault, t: 3.75, who: B, label: '⚑ secrets read' },
    { obj: racks[1], t: 5.0, who: A, label: '⚑ spread to next worker' },
  ];
  function path(keys, t, out) {
    for (let n = 0; n < keys.length - 1; n++) {
      const [t0, p0] = keys[n], [t1, p1] = keys[n + 1];
      if (t >= t0 && t < t1) {
        if (p0.equals(p1)) { out.copy(p0); return 0; }
        const q = (t - t0) / (t1 - t0); out.lerpVectors(p0, p1, ease(q)); out.y += 1.1 * Math.sin(Math.PI * q);
        return { q, dir: p1.clone().sub(p0) };
      }
    }
    out.copy(keys[keys.length - 1][1]); return 0;
  }
  // command "zap" from an agent into the system it is acting on
  const zapM = new THREE.MeshBasicMaterial({ color: 0xe2645a, transparent: true, opacity: 0, depthWrite: false });
  const zap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), zapM); g.add(zap);

  // watch-tower with binoculars — an eye peers through each lens
  const tower = new THREE.Group(); tower.position.set(2.75, 0, -2.3); g.add(tower);
  const wood = toon('#9a7b56');
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 0.4, leg = outlined(new THREE.CylinderGeometry(0.05, 0.065, 1.7, 8), wood, 0.022);
    leg.position.set(Math.sin(a) * 0.4, 0.8, Math.cos(a) * 0.4); leg.rotation.set(Math.cos(a) * 0.17, 0, -Math.sin(a) * 0.17); tower.add(leg);
  }
  const head = new THREE.Group(); head.position.set(0, 1.85, 0); head.scale.setScalar(1.1); tower.add(head);
  const bin = new THREE.Group(); head.add(bin);
  const bodyM = toon('#3d4148'), rimM = toon('#2c2f34');
  const eyeParts = [];
  for (const s of [-1, 1]) {
    const barrel = outlined(new THREE.CylinderGeometry(0.31, 0.27, 0.9, 30), bodyM, 0.032); barrel.rotation.x = Math.PI / 2; barrel.position.set(s * 0.36, 0, 0.05); bin.add(barrel);
    const rim = outlined(new THREE.TorusGeometry(0.3, 0.05, 10, 30), rimM, 0.02); rim.position.set(s * 0.36, 0, 0.5); bin.add(rim);
    const ep = outlined(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 20), rimM, 0.025); ep.rotation.x = Math.PI / 2; ep.position.set(s * 0.33, 0, -0.52); bin.add(ep);
    const eye = new THREE.Group(); eye.position.set(s * 0.36, 0, 0.505); bin.add(eye);
    eye.add(new THREE.Mesh(new THREE.CircleGeometry(0.255, 36), whiteFlat));
    const iris = new THREE.Group(); iris.position.z = 0.002; eye.add(iris);
    iris.add(new THREE.Mesh(new THREE.CircleGeometry(0.135, 30), new THREE.MeshBasicMaterial({ color: 0xd9a03f })));
    const ir2 = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.137, 30), inkFlat); ir2.position.z = 0.001; iris.add(ir2);
    const pu = new THREE.Mesh(new THREE.CircleGeometry(0.068, 20), inkFlat); pu.position.z = 0.002; iris.add(pu);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), whiteFlat); gl.position.set(0.04, 0.045, 0.003); iris.add(gl);
    const lid = new THREE.Mesh(new THREE.CircleGeometry(0.26, 36, 0, Math.PI), toon('#c99f7b')); lid.position.z = 0.004; eye.add(lid);
    const lidLine = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.012, 6, 30, Math.PI), inkFlat); lidLine.position.z = 0.005; eye.add(lidLine);
    eyeParts.push({ iris, lid, lidLine });
  }
  const bridge = outlined(new RoundedBoxGeometry(0.34, 0.22, 0.5, 2, 0.05), bodyM, 0.025); bin.add(bridge);
  const knob = outlined(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 14), rimM, 0.02); knob.position.set(0, 0.16, -0.05); bin.add(knob);
  const coneGeo = new THREE.ConeGeometry(0.62, 1, 32, 1, true); coneGeo.translate(0, -0.5, 0);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x6fb6c9, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
  g.add(cone);
  const ringT = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 40), new THREE.MeshBasicMaterial({ color: 0xd9443a, transparent: true, opacity: 0, depthWrite: false }));
  ringT.rotation.x = -Math.PI / 2; g.add(ringT);
  const flags = EVENTS.map(ev => {
    const f = new THREE.Group(); f.position.set(ev.obj.position.x + 0.34, TOPY, ev.obj.position.z - 0.25); g.add(f);
    const pole = outlined(new THREE.CylinderGeometry(0.025, 0.025, 2.0, 8), toon('#3d4148'), 0.015); pole.position.y = 1.0; f.add(pole);
    const cloth = outlined(new THREE.BoxGeometry(0.42, 0.26, 0.02), toon('#e04c40'), 0.02); cloth.position.set(0.22, 1.86, 0); f.add(cloth);
    return f;
  });
  addLabel(si, 'model hub · protected', 'small', (t, v) => v.set(C.x, -0.4, C.z + 1.35), t => win(t, 0.4, D - 0.2));
  addLabel(si, 'watches actions only', 'action', (t, v) => v.copy(tower.position).add(new V(4.1, 1.3, 0.3)), t => win(t, 0.5, D - 0.2));
  EVENTS.forEach((ev, n) => addLabel(si, ev.label, 'warn', (t, v) => v.copy(ev.obj.position).add(new V(0.1, 2.05, -0.3)), t => win(t, ev.t + 0.55, D - 0.2) * (n === EVENTS.length - 1 || t < EVENTS[n + 1].t + 0.5 ? 1 : 0)));
  const chat = makeBubble(); chat.scale.setScalar(0.55); g.add(chat);
  addLabel(si, 'messages: not read here', 'small', (t, v) => v.copy(chat.position).add(new V(0, 0.45, 0)), t => win(t, 5.5, 7.5) * 0.9);

  const tmp = new V(), tgt = new V(), curT = new V(C.x, 1, C.z), q = new THREE.Quaternion();
  const green = new THREE.Color(0x7fd39a), red = new THREE.Color(0xe2645a);
  const lightPos = obj => obj === vault ? new V(vault.position.x, TOPY + 0.5, vault.position.z + 0.45) : new V(obj.position.x + 0.32, TOPY + 0.95, obj.position.z + 0.41);
  S.update = (t, dt, time) => {
    for (const [r, keys] of [[A, keysA], [B, keysB]]) {
      const res = path(keys, t, tmp); r.root.position.copy(tmp);
      if (res && res.dir) r.root.rotation.y = Math.atan2(res.dir.x, res.dir.z);
      else r.root.rotation.y = lerp(r.root.rotation.y, Math.atan2(C.x - tmp.x, C.z + 2.5 - tmp.z), 0.2);
      r.hop(0, 0);
    }
    let latest = null;
    for (const ev of EVENTS) if (t >= ev.t) latest = ev;
    // workers turn red when an agent runs commands on them
    racks.forEach(rk => {
      const ev = EVENTS.find(e => e.obj === rk), k = ev ? seg(t, ev.t, ev.t + 0.5) : 0;
      rk.userData.lights.forEach((l, i) => { l.material.color.copy(green).lerp(red, k); l.visible = k > 0.5 ? (Math.floor(time * 6 + i) % 2 === 0) : true; });
      rk.rotation.z = ev ? 0.04 * Math.sin(Math.PI * seg(t, ev.t, ev.t + 0.35)) * Math.sin(time * 40) : 0;
    });
    // vault opens, a secret flies to the agent
    const ve = EVENTS[1], vo = ease(seg(t, ve.t - 0.1, ve.t + 0.35)) * (1 - ease(seg(t, ve.t + 1.9, ve.t + 2.3)));
    hinge.rotation.y = -1.7 * vo;
    const kq = seg(t, ve.t + 0.25, ve.t + 0.85);
    vkey.visible = t > ve.t + 0.2 && t < keysB[4][0] - 0.1;
    if (vkey.visible) { const to = B.root.position.clone().add(new V(0, 1.55 + B.bob.position.y, 0)); vkey.position.lerpVectors(VKEY0, to, ease(kq)); vkey.position.y += 0.8 * Math.sin(Math.PI * kq); vkey.rotation.set(0, time * 2, 0.3); }
    // zap from agent to the system it is acting on
    const act = EVENTS.find(e => t >= e.t - 0.1 && t < e.t + 0.55);
    if (act) {
      const from = act.who.root.position.clone().add(new V(0, 1.0, 0)), to = lightPos(act.obj), d = to.clone().sub(from);
      zap.position.copy(from).add(to).multiplyScalar(0.5); zap.quaternion.setFromUnitVectors(new V(0, 1, 0), d.clone().normalize()); zap.scale.set(1, d.length(), 1);
      zapM.opacity = 0.75 * (0.6 + 0.4 * Math.sin(time * 50));
    } else zapM.opacity = 0;
    flags.forEach((f, n) => { const s = pop(t, EVENTS[n].t + 0.5); f.scale.setScalar(Math.max(0.001, s)); f.children[1].rotation.y = Math.sin(time * 4 + n) * 0.25; });
    // binoculars sweep the zone, then lock onto the newest change
    if (latest && t > latest.t + 0.15) tgt.copy(lightPos(latest.obj)).setY(TOPY + 0.6);
    else tgt.set(C.x + Math.sin(time * 0.9) * 1.6, TOPY + 0.6, C.z + Math.cos(time * 0.6) * 0.5);
    curT.lerp(tgt, 1 - Math.exp(-dt * 5));
    const sc = g.scale.x || 1;
    q.copy(head.quaternion); head.lookAt(curT.clone().multiplyScalar(sc));
    const want = head.quaternion.clone(); head.quaternion.copy(q).slerp(want, 1 - Math.exp(-dt * 8)); head.updateMatrixWorld(true);
    const locked = latest && t > latest.t + 0.2 && t < latest.t + 1.2;
    eyeParts.forEach(({ iris, lid, lidLine }, n) => {
      iris.position.x = Math.sin(time * 1.7 + n) * 0.03; iris.position.y = -0.04 + (locked ? 0 : Math.cos(time * 1.3) * 0.03);
      iris.scale.setScalar(locked ? 1.12 : 1);
      const bl = (time % 3.6) < 0.14 ? 1 : 0, lidS = lerp(locked ? 0 : 0.38, 1, bl);
      lid.scale.set(1, Math.max(0.001, lidS), 1); lidLine.scale.set(1, Math.max(0.001, lidS), 1);
    });
    const from = new V(0, 0, 0.6).applyMatrix4(bin.matrixWorld).divideScalar(sc);
    const dir = curT.clone().sub(from); const len = dir.length();
    cone.position.copy(from); cone.quaternion.setFromUnitVectors(new V(0, -1, 0), dir.normalize()); cone.scale.set(1, len, 1);
    cone.material.opacity = 0.14 + (locked ? 0.14 : 0) + Math.sin(time * 6) * 0.03;
    ringT.position.set(curT.x, TOPY + 0.02, (latest && t > latest.t + 0.15 ? latest.obj.position.z + 0.6 : curT.z));
    ringT.material.opacity = locked ? 0.65 : 0.25; ringT.scale.setScalar(1 + (locked ? Math.sin(time * 10) * 0.08 : 0));
    for (const r of [A, B]) {
      const mine = EVENTS.filter(e => e.who === r && t >= e.t), ev = mine[mine.length - 1];
      if (ev && t < ev.t + 0.5) r.mood('focused');
      else if (ev && t < ev.t + 1.6) r.mood('surprised');
      else r.mood('happy');
      if (ev && t >= ev.t + 0.5 && t < ev.t + 1.8) r.look(head.getWorldPosition(new V()));
      else { const nx = EVENTS.find(e => e.who === r && t < e.t + 0.5); r.look(nx ? lightPos(nx.obj) : new V(C.x, 1, C.z)); }
    }
    chat.position.set(SB.x + 0.3, 1.9 + Math.sin(time * 2) * 0.05, SB.z);
    const cs = 0.55 * pop(t, 5.6) * (1 - seg(t, 7.3, 7.6)); chat.scale.setScalar(Math.max(0.001, cs)); chat.visible = cs > 0.002;
  };
})();

/* ---------- 3. Transcript & reasoning monitor: inferred → shared → adopted ---------- */
(() => {
  const si = 2;
  const S = newScene({ pos: new V(0, 4.7, 13.6), target: new V(0, 2.05, -0.4) }, {
    title: 'Transcript & reasoning monitor', text: 'Reads the messages and the reasoning: what one agent inferred, shared with its peers, and what they adopted.', tag: 'messages', color: '#2f7f94'
  });
  const g = S.group;
  const P = [new V(-2.7, 0, 1.0), new V(0, 0, 1.25), new V(2.7, 0, 1.0)];
  const R = [new Robot('blue'), new Robot('green'), new Robot('tan')];
  R.forEach((r, i) => { r.root.position.copy(P[i]); faceTo(r, 0, 8); g.add(r.root); });
  S.robots = R;
  // transcript board
  const board = new THREE.Group(); board.position.set(0, 2.55, -1.7); g.add(board);
  const BW = 6.2, BH = 2.7;
  board.add(outlined(new RoundedBoxGeometry(BW, BH, 0.12, 3, 0.05), toon('#fdfbf5'), 0.03));
  for (const y of [BH / 2 + 0.02, -BH / 2 - 0.02]) { const rl = outlined(new THREE.CylinderGeometry(0.1, 0.1, BW + 0.4, 18), toon('#9a7b56'), 0.02); rl.rotation.z = Math.PI / 2; rl.position.set(0, y, 0.05); board.add(rl); }
  for (let i = 0; i < 2; i++) { const leg = outlined(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 8), toon('#9a7b56'), 0.02); leg.position.set((i ? 1 : -1) * 2.6, -BH / 2 - 0.6, -0.05); board.add(leg); }
  const ROWS = [
    { who: 0, t: 0.15, w: 3.2 }, { who: 1, t: 0.5, w: 2.4 },
    { who: 0, t: 1.05, w: 3.6, ev: 'inferred' },
    { who: 0, t: 2.15, w: 2.9, ev: 'shared' },
    { who: 1, t: 3.35, w: 3.3, ev: 'adopted' },
    { who: 1, t: 4.35, w: 2.6, ev: 'shared' },
    { who: 2, t: 5.55, w: 3.4, ev: 'adopted' },
  ];
  const chipCol = ['#8fb1da', '#8ec4ae', '#d3bd8e'];
  const barM = toon('#cfc5ae'), rowObjs = [];
  const hiMat = () => new THREE.MeshBasicMaterial({ color: 0xe3655a, transparent: true, opacity: 0, depthWrite: false });
  ROWS.forEach((row, n) => {
    const y = BH / 2 - 0.34 - n * 0.33;
    const chip = outlined(new RoundedBoxGeometry(0.34, 0.2, 0.05, 2, 0.04), toon(chipCol[row.who]), 0.018); chip.position.set(-BW / 2 + 0.45, y, 0.08); board.add(chip);
    const barGeo = new RoundedBoxGeometry(row.w, 0.12, 0.04, 2, 0.04); barGeo.translate(row.w / 2, 0, 0);
    const bar = new THREE.Mesh(barGeo, barM); bar.position.set(-BW / 2 + 0.75, y, 0.08); board.add(bar);
    let hi = null;
    if (row.ev) { const hg = new THREE.PlaneGeometry(row.w + 0.3, 0.26); hg.translate((row.w + 0.3) / 2, 0, 0); hi = new THREE.Mesh(hg, hiMat()); hi.position.set(-BW / 2 + 0.62, y, 0.071); board.add(hi); }
    rowObjs.push({ chip, bar, hi, y });
  });
  // magnifying glass
  const mag = new THREE.Group(); g.add(mag);
  const magRim = outlined(new THREE.TorusGeometry(0.42, 0.07, 12, 40), toon('#3d4148'), 0.02); mag.add(magRim);
  const lensM = new THREE.Mesh(new THREE.CircleGeometry(0.4, 40), new THREE.MeshBasicMaterial({ color: 0xbfe3ec, transparent: true, opacity: 0.32, depthWrite: false })); mag.add(lensM);
  const lensGl = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 30, 1, 0.6, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); lensGl.position.z = 0.01; mag.add(lensGl);
  const handle = outlined(new THREE.CylinderGeometry(0.075, 0.09, 0.85, 14), toon('#7a5a3a'), 0.02); handle.position.set(0.55, -0.6, 0); handle.rotation.z = 0.75; mag.add(handle);

  // thoughts & messages
  const clouds = R.map(() => { const c = makeCloud(); c.scale.setScalar(0.001); g.add(c); const k = makeKey(); k.position.z = 0.26; k.scale.setScalar(1.15); c.add(k); return c; });
  const bubbles = [makeBubble(), makeBubble()];
  bubbles.forEach(b => { b.scale.setScalar(0.001); g.add(b); const k = makeKey(); k.position.z = 0.12; b.add(k); });
  const cloudPos = i => new V(P[i].x + 0.55, 2.35, P[i].z);
  const cloudOn = [[0.8, 2.3], [3.25, D + 1], [5.45, D + 1]];
  const sends = [[1.95, 3.15, 0, 1], [4.15, 5.35, 1, 2]];
  addLabel(si, '① inferred', 'transcript', (t, v) => v.copy(cloudPos(0)).add(new V(0, 0.75, 0)), t => win(t, 1.0, 2.2));
  addLabel(si, '② shared', 'transcript', (t, v) => v.copy(bubbles[0].position).add(new V(0, 0.55, 0)), t => win(t, 2.05, 3.2));
  addLabel(si, '③ adopted', 'transcript', (t, v) => v.copy(cloudPos(1)).add(new V(0, 0.75, 0)), t => win(t, 3.4, 4.9));
  addLabel(si, '② shared', 'transcript', (t, v) => v.copy(bubbles[1].position).add(new V(0, 0.55, 0)), t => win(t, 4.25, 5.4));
  addLabel(si, '③ adopted', 'transcript', (t, v) => v.copy(cloudPos(2)).add(new V(0, 0.75, 0)), t => win(t, 5.6, D - 0.2));
  addLabel(si, '⚑ flagged message', 'warn', (t, v) => { const r = rowObjs[6]; v.set(BW / 2 - 0.25, r.y + 2.55 + 0.05, -1.6); }, t => win(t, 6.3, D - 0.15));

  const tmp = new V();
  S.update = (t, dt, time) => {
    // transcript rows appear as things are said/thought
    ROWS.forEach((row, n) => {
      const o = rowObjs[n], k = easeOut(seg(t, row.t, row.t + 0.5));
      o.bar.scale.set(Math.max(0.001, k), 1, 1); o.chip.scale.setScalar(Math.max(0.001, pop(t, row.t, 0.3)));
      if (o.hi) o.hi.material.opacity = 0.42 * seg(t, row.t + 0.55, row.t + 0.85) * (0.8 + 0.2 * Math.sin(time * 6));
    });
    // magnifier hops to the newest reasoning/message line
    let target = rowObjs[0], tr = ROWS[0];
    ROWS.forEach((row, n) => { if (row.ev && t >= row.t - 0.1) { target = rowObjs[n]; tr = row; } });
    const along = clamp((t - tr.t) / 0.9) * tr.w * 0.75;
    tmp.set(-BW / 2 + 1.0 + along, 2.55 + target.y, -1.7 + 0.45);
    if (!mag.userData.init) { mag.position.copy(tmp); mag.userData.init = true; }
    mag.position.lerp(tmp, 1 - Math.exp(-dt * 6)); mag.position.y += Math.sin(time * 3) * 0.004;
    mag.rotation.z = Math.sin(time * 1.5) * 0.06;
    // thought clouds
    clouds.forEach((c, i) => {
      const [a, b] = cloudOn[i]; const s = 0.62 * pop(t, a) * (1 - seg(t, b - 0.25, b));
      c.scale.setScalar(Math.max(0.001, s)); c.position.copy(cloudPos(i)); c.position.y += Math.sin(time * 2 + i) * 0.05;
      c.children[c.children.length - 1].rotation.z = Math.sin(time * 3 + i) * 0.2;
      c.visible = s > 0.002;
    });
    // speech bubbles carrying the idea between agents
    bubbles.forEach((b, n) => {
      const [a, e, from, to] = sends[n]; const q = seg(t, a, e);
      const s = 0.85 * pop(t, a, 0.3) * (1 - seg(t, e - 0.2, e));
      b.scale.setScalar(Math.max(0.001, s)); b.visible = s > 0.002;
      const p0 = new V(P[from].x + 0.5, 1.85, P[from].z + 0.3), p1 = new V(P[to].x - 0.4, 1.85, P[to].z + 0.3);
      b.position.lerpVectors(p0, p1, ease(q)); b.position.y += 0.9 * Math.sin(Math.PI * q);
      b.rotation.z = Math.sin(Math.PI * q) * -0.15;
    });
    // faces
    const look = (i, p) => R[i].look(p);
    if (t < 0.8) { R.forEach((r, i) => r.mood('happy')); look(0, new V(0, 1, 6)); look(1, R[0].root.position.clone().setY(1)); look(2, R[1].root.position.clone().setY(1)); }
    else {
      // agent A
      if (t < 1.95) { R[0].mood('focused').look(cloudPos(0)); }
      else if (t < 3.2) { R[0].mood('talking').look(bubbles[0].position.clone().multiplyScalar(g.scale.x)); }
      else R[0].mood('happy').look(R[1].root.getWorldPosition(new V()).setY(1));
      // agent B
      if (t < 1.95) R[1].mood('neutral').look(R[0].root.getWorldPosition(new V()).setY(1));
      else if (t < 3.2) R[1].mood(t > 2.7 ? 'surprised' : 'neutral').look(bubbles[0].position.clone().multiplyScalar(g.scale.x));
      else if (t < 4.15) R[1].mood('focused').look(cloudPos(1).multiplyScalar(g.scale.x));
      else if (t < 5.4) R[1].mood('talking').look(bubbles[1].position.clone().multiplyScalar(g.scale.x));
      else R[1].mood('happy').look(R[2].root.getWorldPosition(new V()).setY(1));
      // agent C
      if (t < 4.15) R[2].mood('neutral').look(R[1].root.getWorldPosition(new V()).setY(1));
      else if (t < 5.4) R[2].mood(t > 4.9 ? 'surprised' : 'neutral').look(bubbles[1].position.clone().multiplyScalar(g.scale.x));
      else R[2].mood('focused').look(cloudPos(2).multiplyScalar(g.scale.x));
    }
    // tiny bounce when speaking / adopting
    R.forEach((r, i) => {
      const beats = i === 0 ? [1.95] : i === 1 ? [3.2, 4.15] : [5.4];
      let h = 0; for (const b of beats) { const q = seg(t, b - 0.05, b + 0.3); if (q > 0 && q < 1) h = Math.max(h, 0.22 * Math.sin(Math.PI * q)); }
      r.hop(h, 0);
    });
  };
})();

/* ---------- 4. Human-checked finding: flags are linked, a person verifies ---------- */
(() => {
  const si = 3;
  const S = newScene({ pos: new V(0, 7.8, 9.6), target: new V(0, 0.8, -0.1) }, {
    title: 'Human-checked finding', text: 'Flags from both monitors are linked to the same agents and events. A human then verifies the flagged events before anything counts as a finding.', tag: 'verify', color: '#2f7a48'
  });
  const g = S.group;
  const CB = new V(0, 0, 0.5);
  const board = new THREE.Group(); board.position.copy(CB); board.rotation.y = 0.04; g.add(board);
  const bm = outlined(new RoundedBoxGeometry(4.0, 0.14, 2.7, 3, 0.08), toon('#c49b6b'), 0.03); bm.position.y = 0.07; bm.userData.main.receiveShadow = true; board.add(bm);
  const paper = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.02, 2.35), toon('#fdfbf5')); paper.position.set(0, 0.15, 0.05); paper.receiveShadow = true; board.add(paper);
  const clip = outlined(new RoundedBoxGeometry(1.3, 0.16, 0.36, 2, 0.06), toon('#9aa0a7'), 0.025); clip.position.set(0, 0.2, -1.2); board.add(clip);

  function cardTex(kind) {
    const col = kind === 'a' ? '#8ec5d3' : '#f4a49b', title = kind === 'a' ? 'ACTION' : 'TRANSCRIPT';
    return canvasTex(256, 320, (x, w, h) => {
      x.fillStyle = '#fffdf8'; x.fillRect(0, 0, w, h);
      x.fillStyle = col; x.fillRect(0, 0, w, 58);
      x.strokeStyle = '#201c17'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
      x.fillStyle = '#201c17'; x.font = '700 26px Inter, system-ui, sans-serif'; x.textAlign = 'left'; x.fillText(title, 20, 39);
      x.fillStyle = '#d9443a'; x.beginPath(); x.arc(w - 30, 30, 11, 0, 7); x.fill();
      if (kind === 'a') { // a worker that turned red, and a secret taken
        x.fillStyle = '#4a4f57'; rr(x, 34, 80, 78, 104, 8); x.fill(); x.stroke();
        for (let k = 0; k < 4; k++) { x.fillStyle = '#e2645a'; x.beginPath(); x.arc(96, 96 + k * 24, 6, 0, 7); x.fill(); x.fillStyle = '#2c2f34'; x.fillRect(44, 92 + k * 24, 40, 6); }
        x.fillStyle = '#e6b84f'; x.lineWidth = 5; x.beginPath(); x.arc(160, 132, 18, 0, 7); x.fill(); x.stroke(); x.fillRect(176, 126, 52, 12); x.strokeRect(176, 126, 52, 12);
      } else { // speech bubble with a key
        x.fillStyle = '#fffdf8'; x.lineWidth = 5; rr(x, 30, 84, 196, 92, 18); x.fill(); x.stroke();
        x.fillStyle = '#e6b84f'; x.beginPath(); x.arc(92, 130, 18, 0, 7); x.fill(); x.stroke(); x.fillRect(108, 124, 70, 12); x.strokeRect(108, 124, 70, 12);
      }
      x.fillStyle = '#c9bfa7'; for (let i = 0; i < 4; i++) { rr(x, 24, 200 + i * 26, 120 + ((i * 53) % 90), 10, 5); x.fill(); }
    });
  }
  function makeCard(kind) {
    const side = toon('#fdfbf5'); const topM = new THREE.MeshToonMaterial({ map: cardTex(kind), gradientMap: grad });
    const c = outlined(new RoundedBoxGeometry(1.25, 0.06, 1.56, 2, 0.025), [side, side, topM, side, side, side], 0.025);
    const pin = outlined(new THREE.SphereGeometry(0.09, 16, 10), toon('#d9443a'), 0.02); pin.position.set(0, 0.1, -0.12); c.add(pin);
    return c;
  }
  const cardA = makeCard('a'), cardB = makeCard('b'); g.add(cardA, cardB);
  const LA = new V(-0.95, 0.2, 0.55), LB = new V(0.95, 0.2, 0.6);
  // thread linking the two flags
  const pinA = LA.clone().add(new V(0, 0.12, -0.12)), pinB = LB.clone().add(new V(0, 0.12, -0.12));
  const curve = new THREE.CatmullRomCurve3([pinA, new V(0, 0.6, 0.35), pinB]);
  const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.028, 8, false);
  const thread = new THREE.Mesh(tubeGeo, toon('#d9443a')); thread.castShadow = true; g.add(thread);
  const perSeg = 8 * 6, totalIdx = tubeGeo.index.count;
  // decal
  const decalTex = canvasTex(512, 220, (x, w, h) => {
    x.strokeStyle = '#c8352a'; x.fillStyle = '#c8352a'; x.lineWidth = 14; rr(x, 12, 12, w - 24, h - 24, 26); x.stroke();
    x.font = '800 92px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✓ VERIFIED', w / 2, h / 2 + 4);
    x.globalCompositeOperation = 'destination-out'; const r = rng(3);
    for (let i = 0; i < 900; i++) { x.beginPath(); x.arc(r() * w, r() * h, r() * 2.4, 0, 7); x.fill(); }
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.73), new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  decal.rotation.set(-Math.PI / 2, 0, 0.13); decal.position.set(0, 0.245, 0.75); g.add(decal);
  // the human: a hand holding a rubber stamp
  const stamp = new THREE.Group(); g.add(stamp);
  const sBase = outlined(new RoundedBoxGeometry(1.15, 0.26, 0.62, 3, 0.06), toon('#a8442f'), 0.028); sBase.position.y = 0.13; stamp.add(sBase);
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.04, 0.52), inkFlat); rubber.position.y = 0.01; stamp.add(rubber);
  const handleS = outlined(new THREE.CylinderGeometry(0.11, 0.15, 0.6, 16), toon('#9a7b56'), 0.025); handleS.position.y = 0.55; stamp.add(handleS);
  const knobS = outlined(new THREE.SphereGeometry(0.24, 20, 14), toon('#9a7b56'), 0.025); knobS.position.y = 0.95; knobS.scale.y = 0.8; stamp.add(knobS);
  const skin = toon('#e9c39e');
  const palm = outlined(new RoundedBoxGeometry(0.62, 0.42, 0.56, 3, 0.18), skin, 0.03); palm.position.set(0, 1.18, 0.02); stamp.add(palm);
  const thumb = outlined(new THREE.CapsuleGeometry(0.09, 0.22, 6, 12), skin, 0.025); thumb.position.set(-0.34, 1.02, 0.12); thumb.rotation.z = -0.5; stamp.add(thumb);
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 5, 12, Math.PI), inkFlat); f.position.set(0.31, 1.12 + i * 0.1 - 0.05, 0.12); f.rotation.y = Math.PI / 2; stamp.add(f); }
  const cuff = outlined(new THREE.CylinderGeometry(0.31, 0.31, 0.16, 22), toon('#f4f1e8'), 0.025); cuff.position.set(0.08, 1.48, -0.05); cuff.rotation.z = -0.18; stamp.add(cuff);
  const sleeve = outlined(new THREE.CylinderGeometry(0.34, 0.38, 3.2, 22), toon('#5a7fb0'), 0.03); sleeve.position.set(0.38, 3.05, -0.1); sleeve.rotation.z = -0.18; stamp.add(sleeve);

  // the agents involved
  const G = new Robot('green'), Bl = new Robot('blue'), Tn = new Robot('tan');
  G.root.position.set(-3.6, 0, -1.0); Bl.root.position.set(3.4, 0, -1.4); Tn.root.position.set(4.3, 0, 0.2);
  [G, Bl, Tn].forEach(r => { faceTo(r, 0, 1.5); g.add(r.root); });
  S.robots = [G, Bl, Tn];
  const spot = new THREE.Mesh((() => { const c = new THREE.ConeGeometry(1.0, 4.2, 32, 1, true); c.translate(0, -2.1, 0); return c; })(), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.0, depthWrite: false }));
  spot.position.set(-3.6, 4.3, -1.0); g.add(spot);
  const spotPool = new THREE.Mesh(new THREE.CircleGeometry(1.0, 36), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, depthWrite: false }));
  spotPool.rotation.x = -Math.PI / 2; spotPool.position.set(-3.6, 0.01, -1.0); g.add(spotPool);

  addLabel(si, 'from action monitor', 'action', (t, v) => v.copy(cardA.position).add(new V(-0.2, 0.25, -0.85)), t => win(t, 1.3, 3.2));
  addLabel(si, 'from transcript monitor', 'transcript', (t, v) => v.copy(cardB.position).add(new V(0.2, 0.25, -0.85)), t => win(t, 1.7, 3.2));
  addLabel(si, 'linked to the same agent', '', (t, v) => v.set(0, 1.0, 0.35), t => win(t, 2.55, 3.6));
  addLabel(si, 'human reviewer', 'small', (t, v) => v.copy(stamp.position).add(new V(1.1, 1.0, 0.2)), t => win(t, 2.9, 4.3));
  addLabel(si, '✓ verified finding', 'ok', (t, v) => v.set(0, 1.25, 1.0), t => win(t, 4.3, D - 0.15));

  S.update = (t, dt, time) => {
    // cards fly in
    const fly = (c, from, to, a, spin) => {
      const q = seg(t, a, a + 0.95), e = easeOut(q);
      c.visible = t > a; c.position.lerpVectors(from, to, e); c.position.y += 2.0 * Math.sin(Math.PI * q);
      c.rotation.set((1 - e) * 2.2, spin * (1 - e) * 3 + (to.x < 0 ? -0.08 : 0.07), (1 - e) * 1.4 * spin);
    };
    fly(cardA, new V(-6.5, 2.5, -1.5), LA, 0.35, -1);
    fly(cardB, new V(6.5, 2.5, -1.5), LB, 0.75, 1);
    // thread draws itself
    const tq = easeOut(seg(t, 2.0, 2.7));
    tubeGeo.setDrawRange(0, Math.floor(tq * totalIdx / perSeg) * perSeg);
    thread.visible = tq > 0;
    // stamp comes down
    let sy = 4.6;
    if (t < 2.6) sy = lerp(7.5, 4.4, easeOut(seg(t, 0.0, 1.5)));
    else if (t < 3.6) sy = lerp(4.4, 2.6, ease(seg(t, 2.6, 3.5)));
    if (t >= 3.5 && t < 3.72) sy = lerp(2.6, 0.245, seg(t, 3.5, 3.68) ** 2);
    if (t >= 3.72 && t < 4.0) sy = 0.245;
    if (t >= 4.0) sy = lerp(0.245, 3.0, easeOut(seg(t, 4.0, 4.7)));
    stamp.position.set(0.0, sy, 0.75); stamp.rotation.set(0, 0.13, Math.sin(time * 1.4) * 0.02 * (sy > 1 ? 1 : 0));
    const squash = (t > 3.68 && t < 4.0) ? 0.06 * Math.sin(Math.PI * seg(t, 3.68, 4.0)) : 0;
    stamp.scale.set(1 + squash, 1 - squash, 1 + squash);
    const ds = pop(t, 3.7, 0.35); decal.scale.setScalar(Math.max(0.001, ds)); decal.visible = t > 3.7;
    // spotlight on the flagged agent
    const so = seg(t, 2.4, 2.9) * (1 - seg(t, D - 0.6, D));
    spot.material.opacity = 0.1 * so; spotPool.material.opacity = 0.4 * so;
    // faces
    const mid = new V(0, 0.4, 0.6).multiplyScalar(g.scale.x);
    if (t < 2.4) { G.mood('neutral').look(cardA.getWorldPosition(new V())); }
    else if (t < 3.7) { G.mood('worried').look(stamp.getWorldPosition(new V())); }
    else if (t < 5.0) { G.mood('surprised').look(mid); }
    else { G.mood('worried').look(new V(0, 1, 6)); }
    Bl.mood(t > 3.7 ? 'focused' : 'neutral').look(t < 3.0 ? cardB.getWorldPosition(new V()) : G.root.getWorldPosition(new V()).setY(1));
    Tn.mood(t > 3.7 ? 'surprised' : 'neutral').look(t < 3.0 ? cardB.getWorldPosition(new V()) : mid);
    const hopq = seg(t, 3.72, 4.05);
    [G, Bl, Tn].forEach((r, i) => r.hop((hopq > 0 && hopq < 1) ? (i === 0 ? 0.32 : 0.16) * Math.sin(Math.PI * hopq) : 0, 0));
  };
})();

/* ================= loop: four stations, one highlighted ================= */
// station framing for the compact layout (no caption overlay any more)
const FRAMES = [   // fit = world width/height that must stay in view
  { pos: new V(0.3, 9.6, 10.4), target: new V(0.85, 0.6, 0.1), fit: [10.9, 5.4] },
  { pos: new V(-0.3, 8.6, 10.6), target: new V(0.0, 0.55, -0.3), fit: [8.4, 5.6] },
  { pos: new V(0, 4.4, 12.8), target: new V(0, 1.75, 0.0), fit: [7.4, 5.6] },
  { pos: new V(0, 8.2, 8.6), target: new V(0.45, 0.75, -0.2), fit: [11.0, 4.8] },
];
scenes.forEach((s, i) => s.cam = FRAMES[i]);

const playBtn = document.getElementById('dl-play'), playIcon = document.getElementById('dl-playIcon');
const arrowsSvg = document.getElementById('dl-arrows');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let T = 0.001, playing = true, lastIdx = -1;

function setActive(i) {
  cells.forEach((c, k) => { c.classList.toggle('is-active', k === i); c.setAttribute('aria-current', k === i ? 'step' : 'false'); });
  arrowsSvg.querySelectorAll('path[data-step]').forEach(p => p.classList.toggle('on', p.dataset.step.split(' ').includes(String(i))));
}
function jump(i) { T = ((i + N) % N) * D + 0.001; }
cells.forEach((c, i) => {
  c.addEventListener('click', () => jump(i));
  c.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); jump(i); } });
});
document.getElementById('dl-prev').addEventListener('click', e => { e.stopPropagation(); jump(Math.floor(T / D) - 1); });
document.getElementById('dl-next').addEventListener('click', e => { e.stopPropagation(); jump(Math.floor(T / D) + 1); });
function setPlaying(p) {
  playing = p;
  playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
  playIcon.innerHTML = p ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>' : '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>';
}
playBtn.addEventListener('click', e => { e.stopPropagation(); setPlaying(!playing); });
loopEl.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
  if (e.code === 'ArrowRight') jump(Math.floor(T / D) + 1);
  if (e.code === 'ArrowLeft') jump(Math.floor(T / D) - 1);
});

// hand-drawn-ish arrows between the stations (like the sketch)
function drawArrows() {
  const box = loopEl.getBoundingClientRect();
  const r = cells.map(c => { const b = c.getBoundingClientRect(); return { l: b.left - box.left, r: b.right - box.left, t: b.top - box.top, b: b.bottom - box.top, cx: (b.left + b.right) / 2 - box.left, cy: (b.top + b.bottom) / 2 - box.top }; });
  arrowsSvg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  const [rec, act, trn, hum] = r;
  const g = 10;
  const p = {
    ra: `M${rec.r - 18} ${rec.cy - 26} Q${rec.r + 4} ${act.cy} ${act.l + g} ${act.cy}`,
    rt: `M${rec.r - 18} ${rec.cy + 26} Q${rec.r + 4} ${trn.cy} ${trn.l + g} ${trn.cy}`,
    ah: `M${act.r - g} ${act.cy} Q${hum.l - 4} ${act.cy} ${hum.l + 18} ${hum.cy - 26}`,
    th: `M${trn.r - g} ${trn.cy} Q${hum.l - 4} ${trn.cy} ${hum.l + 18} ${hum.cy + 26}`,
  };
  for (const k in p) arrowsSvg.querySelector(`[data-k="${k}"]`).setAttribute('d', p[k]);
}

function resize() {
  cells.forEach((c, i) => {
    const cv = c.querySelector('canvas'), w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
    renderers[i].setSize(w, h, false); cams[i].aspect = w / h; cams[i].updateProjectionMatrix();
  });
  drawArrows();
}
new ResizeObserver(resize).observe(loopEl); resize();

let onScreen = true;
new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }, { rootMargin: '200px' }).observe(loopEl);
let last = performance.now();
function frame(now) {
  if (!onScreen || document.hidden) { last = now; requestAnimationFrame(frame); return; }
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
  const time = now / 1000;
  if (playing) T = (T + dt * (reduce ? 0.7 : 1)) % (D * N);
  const idx = Math.min(N - 1, Math.floor(T / D)), t = T - idx * D;
  if (idx !== lastIdx) { setActive(idx); lastIdx = idx; }
  const dk = document.documentElement.dataset.theme === 'dark';
  ground.material.opacity = dk ? 0.55 : 0.17; ground.material.color.setHex(dk ? 0x000000 : 0x3a2d18);
  // stations 1 & 4 frame themselves; the two monitors copy their robot scale (same pixels per world unit)
  const th0 = Math.tan(THREE.MathUtils.degToRad(15));
  const fitDist = i => { const a = cams[i].aspect, f = scenes[i].cam.fit; return Math.max(f[0] / 2 / (th0 * a), f[1] / 2 / th0); };
  const ch = i => cells[i].querySelector('canvas').clientHeight || 1;
  const pxU = (ch(0) / fitDist(0) + ch(3) / fitDist(3)) / 2;
  scenes.forEach((S, i) => {
    scenes.forEach((s, k) => s.group.visible = k === i);
    S.group.scale.setScalar(1); S.group.updateMatrixWorld(true);
    S.update(t, dt, time);
    S.robots.forEach(r => r.update(dt, time));
    const cam = cams[i], a = cam.aspect;
    const tp = S.cam.target, dir = S.cam.pos.clone().sub(tp), th = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dist = (i === 1 || i === 2) ? ch(i) / pxU : fitDist(i);
    const pp = dir.normalize().multiplyScalar(dist).add(tp);
    pp.x += Math.sin(time * 0.25 + i) * 0.25; pp.y += Math.sin(time * 0.31 + i) * 0.12;
    cam.position.copy(pp); cam.lookAt(tp);
    renderers[i].render(scene, cam);
    updateLabels(i, t);
  });
  document.getElementById('dl-tl').style.width = ((t / D) * 100).toFixed(2) + '%';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
