import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const canvas = $('canvas'), coinsEl = $('coins'), scoreEl = $('score'), timeEl = $('time'),
  livesEl = $('lives'), messageEl = $('message'), loading = $('loading'),
  progress = $('progress'), loadText = $('loadText');

// ---------- Scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x5c94fc);
scene.fog = new THREE.Fog(0x5c94fc, 40, 100);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

scene.add(new THREE.HemisphereLight(0xffffff, 0x8ecae6, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { near: 0.5, far: 90, left: -40, right: 40, top: 40, bottom: -40 });
scene.add(sun, sun.target);

// Water below the course: gaps are now dangerous
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x1e90ff, roughness: 0.3, transparent: true, opacity: 0.9 })
);
water.rotation.x = -Math.PI / 2;
water.position.y = -2;
water.receiveShadow = true;
scene.add(water);

// ---------- Level (solids use AABBs) ----------
const solids = [];
const platGeoCache = new Map();
function addPlatform(x, z, w, d, y, color = 0xfbd000) {
  const key = w + 'x' + d;
  if (!platGeoCache.has(key)) {
    const g = new THREE.BoxGeometry(w, 0.6, d);
    platGeoCache.set(key, { g, e: new THREE.EdgesGeometry(g), t: new THREE.BoxGeometry(w * 0.98, 0.22, d * 0.98) });
  }
  const { g, e, t } = platGeoCache.get(key);
  const grp = new THREE.Group();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  mesh.castShadow = mesh.receiveShadow = true;
  const top = new THREE.Mesh(t, new THREE.MeshStandardMaterial({ color: 0x2ecc71 }));
  top.position.y = 0.22;
  grp.add(mesh, top, new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: 0 })));
  grp.position.set(x, y, z);
  scene.add(grp);
  const s = { x, z, w, d, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: y - 0.3, y1: y + 0.3, topY: y + 0.3 };
  solids.push(s);
  return s;
}

const start = addPlatform(0, 0, 8, 8, 0);
const p2 = addPlatform(10, -4, 6, 4, 1.2, 0xe67e22);
addPlatform(20, 0, 5, 5, 2.0, 0x3498db);
addPlatform(30, 5, 4, 6, 2.8, 0x9b59b6);
addPlatform(38, -2, 6, 3, 1.6, 0xe67e22);
const island = addPlatform(48, 0, 7, 7, 0.5, 0xf1c40f);
addPlatform(58, 4, 5, 5, 2.2, 0xe74c3c);
const p8 = addPlatform(68, -1, 5, 5, 1.0, 0x3498db);
const finish = addPlatform(80, 0, 10, 8, 0.0);
addPlatform(15, 0, 2, 2, 2.6, 0x8d5524); // floating bricks
addPlatform(25, 5, 2, 2, 3.6, 0x8d5524);
addPlatform(55, 0, 2, 2, 2.0, 0x8d5524);

const pipeMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71 });
function addPipe(x, z, base) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 16), pipeMat);
  body.position.y = 1.1; body.castShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.35, 16), pipeMat);
  rim.position.y = 2.2; rim.castShadow = true;
  g.add(body, rim); g.position.set(x, base, z); scene.add(g);
  solids.push({ x0: x - 1, x1: x + 1, z0: z - 1, z1: z + 1, y0: base, y1: base + 2.4, topY: base + 2.4 });
}
addPipe(4, 4, 0.3); addPipe(78, 3, 0.3); addPipe(48, 3, 0.8);

// ---------- Coins ----------
const coinGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 12);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xfbd000, metalness: 0.4, roughness: 0.35, emissive: 0x332200, emissiveIntensity: 0.2 });
const coins = [];
[[9, -4, 2.4], [11, -4, 2.4], [20, 0, 3.2], [20, 1.5, 3.2], [30, 5, 4], [30, 6.5, 4], [38, -2, 2.8],
[48, 0, 1.7], [48, 2, 1.7], [48, -2, 1.7], [58, 4, 3.4], [68, -1, 2.2], [15, 0, 3.8], [25, 5, 4.8], [55, 0, 3.2], [80, 0, 1.2]
].forEach(([x, z, y]) => {
  const m = new THREE.Mesh(coinGeo, coinMat);
  m.rotation.x = Math.PI / 2; m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z); m.castShadow = true;
  scene.add(m);
  coins.push({ mesh: m, taken: false, baseY: y });
});

// ---------- Goombas (stand on platforms, patrol within their edges) ----------
const goombas = [];
const gBody = new THREE.MeshStandardMaterial({ color: 0x8d5524 });
const gFeet = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
const gWhite = new THREE.MeshStandardMaterial({ color: 0xffffff });
const gBlack = new THREE.MeshStandardMaterial({ color: 0x000000 });
function addGoomba(pl, dz = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.35, 4, 12), gBody);
  body.position.y = 0.65; body.castShadow = true;
  const feet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.6), gFeet);
  feet.position.y = 0.1;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), gWhite); eyeL.position.set(-0.18, 0.85, 0.35);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.18;
  const pL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), gBlack); pL.position.set(-0.18, 0.85, 0.42);
  const pR = pL.clone(); pR.position.x = 0.18;
  g.add(body, feet, eyeL, eyeR, pL, pR);
  const z = pl.z + dz;
  g.position.set(pl.x, pl.topY, z);
  scene.add(g);
  goombas.push({
    group: g, x0: pl.x, z, y: pl.topY, range: Math.max(0.5, pl.w / 2 - 0.9), dir: 1,
    speed: 0.02 + Math.random() * 0.01, alive: true, deadT: null
  });
}
addGoomba(p2); addGoomba(island); addGoomba(p8); addGoomba(finish, 2.5);

// ---------- Player (origin = feet) ----------
const mario = new THREE.Group();   // position + yaw
const model = new THREE.Group();   // squash, stretch, lean
mario.add(model);
const placeholder = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 10), new THREE.MeshStandardMaterial({ color: 0xe52521 }));
placeholder.position.y = 0.8; placeholder.castShadow = true;
model.add(placeholder);
scene.add(mario);
let marioLoaded = false, mixer = null;

const HW = 0.35, H = 1.6;           // player half-width, height
const SPAWN = new THREE.Vector3(0, start.topY, 0);
let lastSafe = SPAWN.clone();

new GLTFLoader().load('assets/mario.glb',
  gltf => {
    progress.style.width = '100%'; loadText.textContent = 'Ready!';
    setTimeout(() => loading.style.display = 'none', 400);
    const root = gltf.scene;
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // normalise height to the hitbox and put feet at y = 0
    let box = new THREE.Box3().setFromObject(root);
    root.scale.setScalar(1.7 / (box.max.y - box.min.y));
    box = new THREE.Box3().setFromObject(root);
    root.position.y -= box.min.y;
    model.remove(placeholder);
    model.add(root);
    marioLoaded = true;
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(root);
      gltf.animations.forEach(c => mixer.clipAction(c).play());
    }
  },
  ev => {
    const pct = ev.total ? Math.round(ev.loaded / ev.total * 100) : 30;
    progress.style.width = pct + '%';
    loadText.textContent = `Loading Mario... ${pct}%`;
  },
  err => {
    console.error(err);
    loadText.textContent = 'Failed to load Mario, using placeholder';
    progress.style.width = '100%';
    setTimeout(() => loading.style.display = 'none', 800);
  }
);
setTimeout(() => { if (!marioLoaded) loading.style.display = 'none'; }, 6000);

// ---------- State ----------
const STEP = 1 / 60;                 // fixed physics timestep
const SPEED = 0.165, RUN = 1.9, GRAVITY = -0.018, JUMP = 0.26;
const vel = new THREE.Vector3();
const p = mario.position;
let onGround = false, coyote = 0, jumpBuf = 0, jumping = false;
let yaw = 0, camYaw = 0, camMode = 0, camDist = 8, camHeight = 4.5;
let coinCount = 0, score = 0, lives = 3, timeLeft = 120, invuln = 0, shake = 0, landSquash = 0;
let gameOver = false, won = false, paused = false, muted = false, stepTime = 0, shownTime = -1, running = false;

// ---------- Input ----------
const keys = {};
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' && !e.repeat) jumpBuf = 0.12;
  if (e.code === 'KeyC') camMode = (camMode + 1) % 2;
  if (e.code === 'KeyR') resetGame();
  if (e.code === 'KeyM') muted = !muted;
  if (e.code === 'KeyP' && !gameOver && !won) {
    paused = !paused;
    paused ? showMessage('<h1>PAUSED</h1><p>Press P to resume</p>') : hideMessage();
  }
  keys[e.code] = true;
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// mouse drag orbits the camera
let dragging = false;
canvas.addEventListener('pointerdown', e => { dragging = true; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => dragging = false);
canvas.addEventListener('pointermove', e => { if (dragging) camYaw -= e.movementX * 0.005; });

// ---------- Mobile / touch controls ----------
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const mobileControls = $('mobileControls'), joyBase = $('joyBase'), joyStick = $('joyStick'),
  btnJump = $('btnJump'), btnRun = $('btnRun'), camPad = $('camPad'), btnPause = $('btnPause');
let joyX = 0, joyY = 0, joyActive = false, touchRun = false, camTouchId = null, joyTouchId = null;
let camPadActive = false;

function showMobileUI() {
  const shouldShow = isTouchDevice || innerWidth <= 900 || innerHeight <= 500;
  if (shouldShow) mobileControls.classList.remove('hidden');
  else mobileControls.classList.add('hidden');
}
showMobileUI();
addEventListener('resize', showMobileUI);

// prevent scrolling / zoom gestures
document.addEventListener('touchmove', e => { if (e.target.closest('#mobileControls, canvas')) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());

// Joystick handling (pointer events for mouse+touch)
if (joyBase && joyStick) {
  const maxR = 44;
  function updateStick(clientX, clientY) {
    const rect = joyBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = clientX - cx, dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
    joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
    joyX = dx / maxR; joyY = dy / maxR;
    // dy positive = down (south) = +mz in game, but game uses mz -=1 for north, so invert dy
    // joyY is +down, so mz = joyY, mx = joyX
  }
  joyBase.addEventListener('pointerdown', e => {
    joyActive = true; joyTouchId = e.pointerId;
    joyBase.setPointerCapture(e.pointerId);
    updateStick(e.clientX, e.clientY);
    e.preventDefault();
  });
  joyBase.addEventListener('pointermove', e => {
    if (!joyActive || e.pointerId !== joyTouchId) return;
    updateStick(e.clientX, e.clientY);
  });
  const endJoy = e => {
    if (e.pointerId !== joyTouchId) return;
    joyActive = false; joyTouchId = null; joyX = 0; joyY = 0;
    joyStick.style.transform = 'translate(0px, 0px)';
  };
  joyBase.addEventListener('pointerup', endJoy);
  joyBase.addEventListener('pointercancel', endJoy);
}

// Camera pad drag (right strip) + canvas single-finger drag fallback
function handleCamMove(dx) { camYaw -= dx * 0.008; }
if (camPad) {
  camPad.addEventListener('pointerdown', e => { camPadActive = true; camTouchId = e.pointerId; camPad.setPointerCapture(e.pointerId); });
  camPad.addEventListener('pointermove', e => { if (camPadActive && e.pointerId === camTouchId) handleCamMove(e.movementX); });
  camPad.addEventListener('pointerup', e => { if (e.pointerId === camTouchId) { camPadActive = false; camTouchId = null; } });
  camPad.addEventListener('pointercancel', () => { camPadActive = false; camTouchId = null; });
}
// allow dragging on canvas on mobile to orbit (without needing right strip) — one finger drag
let lastTouchX = 0;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1 && !joyActive && !camPadActive) lastTouchX = e.touches[0].clientX;
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && !joyActive && !camPadActive) {
    const dx = e.touches[0].clientX - lastTouchX;
    handleCamMove(dx * 0.6); lastTouchX = e.touches[0].clientX;
  }
}, { passive: false });

// Buttons: Jump / Run / Pause
if (btnJump) {
  const doJump = e => { e.preventDefault(); jumpBuf = 0.12; keys.Space = true; setTimeout(() => keys.Space = false, 120); };
  btnJump.addEventListener('pointerdown', doJump);
  btnJump.addEventListener('touchstart', doJump, { passive: false });
}
if (btnRun) {
  btnRun.addEventListener('pointerdown', e => { touchRun = true; e.preventDefault(); });
  btnRun.addEventListener('pointerup', () => touchRun = false);
  btnRun.addEventListener('pointercancel', () => touchRun = false);
  btnRun.addEventListener('pointerleave', () => touchRun = false);
  // also support hold
  btnRun.addEventListener('touchstart', e => { touchRun = true; e.preventDefault(); }, { passive: false });
  btnRun.addEventListener('touchend', () => touchRun = false);
}
if (btnPause) {
  btnPause.addEventListener('click', () => {
    if (gameOver || won) return;
    paused = !paused;
    paused ? showMessage('<h1>PAUSED</h1><p>Tap Resume to continue</p><button onclick="resetGame()">RESTART</button><button onclick="paused=false;hideMessage()" style="margin-left:8px">RESUME</button>') : hideMessage();
  });
}

// Better resize for mobile (visualViewport, orientation)
function onResize() {
  const w = innerWidth, h = innerHeight;
  const mobile = isTouchDevice || w <= 900;
  // cap DPR on mobile for performance/battery
  const dpr = Math.min(devicePixelRatio, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
onResize();

// ---------- Helpers ----------
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const damp = (k, dt) => 1 - Math.exp(-k * dt);

function showMessage(html) { messageEl.innerHTML = html; messageEl.classList.remove('hidden'); }
function hideMessage() { messageEl.classList.add('hidden'); }
function updateHUD() {
  coinsEl.textContent = `${coinCount} / ${coins.length}`;
  scoreEl.textContent = score;
  timeEl.textContent = Math.ceil(timeLeft);
  livesEl.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  shownTime = Math.ceil(timeLeft);
}
function bestScore() {
  try {
    const b = +localStorage.getItem('marioBest') || 0;
    if (score > b) { localStorage.setItem('marioBest', score); return score; }
    return b;
  } catch { return score; }
}
function endGame(title, extra = '') {
  showMessage(`<h1>${title}</h1>${extra}<p>Score ${score}</p><p>Best ${bestScore()}</p><button onclick="resetGame()">TRY AGAIN (R)</button>`);
}

let audioCtx = null;
function blip(freq, dur) {
  if (muted) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.type = 'square'; g.gain.value = 0.18;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur); o.stop(audioCtx.currentTime + dur);
  } catch { }
}

// particles
const pGeo = new THREE.SphereGeometry(0.08, 6, 6);
const parts = [];
function burst(pos, color, n = 8, spd = 3, up = 2) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(pos);
    scene.add(m);
    parts.push({ m, v: new THREE.Vector3((Math.random() - .5) * spd, Math.random() * up + 0.5, (Math.random() - .5) * spd), life: 0.5 });
  }
}

// ---------- Collision (axis-separated AABB) ----------
const hits = b => p.x + HW > b.x0 && p.x - HW < b.x1 && p.z + HW > b.z0 && p.z - HW < b.z1 && p.y + H > b.y0 && p.y < b.y1;

function moveAndCollide() {
  p.x += vel.x;
  for (const b of solids) if (hits(b)) {
    if (vel.x > 0) p.x = b.x0 - HW - 0.001; else if (vel.x < 0) p.x = b.x1 + HW + 0.001;
    vel.x = 0;
  }
  p.z += vel.z;
  for (const b of solids) if (hits(b)) {
    if (vel.z > 0) p.z = b.z0 - HW - 0.001; else if (vel.z < 0) p.z = b.z1 + HW + 0.001;
    vel.z = 0;
  }
  const wasAir = !onGround, impact = vel.y;
  onGround = false;
  p.y += vel.y;
  for (const b of solids) if (hits(b)) {
    if (vel.y <= 0) {
      p.y = b.y1; onGround = true;
      if (b.w) lastSafe.set(THREE.MathUtils.clamp(p.x, b.x0 + 0.6, b.x1 - 0.6), b.topY, THREE.MathUtils.clamp(p.z, b.z0 + 0.6, b.z1 - 0.6));
    } else p.y = b.y0 - H; // bonk head
    vel.y = 0;
  }
  if (onGround && wasAir && impact < -0.1) {
    landSquash = 0.18; burst(p, 0xeeeeee, 6, 2, 0.6); blip(200, 0.05);
  }
}

// ---------- Game events ----------
function hurt(from) {
  if (invuln > 0) return;
  lives--; invuln = 1.5; shake = 0.4; blip(180, 0.3); updateHUD();
  if (lives <= 0) { gameOver = true; endGame('GAME OVER'); return; }
  vel.x = (p.x - from.x) * 0.2; vel.z = (p.z - from.z) * 0.2; vel.y = 0.14;
}
function fellIntoWater() {
  lives--; blip(150, 0.4); burst(new THREE.Vector3(p.x, -1.8, p.z), 0x9fd8ff, 14, 4, 4);
  if (lives <= 0) { gameOver = true; updateHUD(); endGame('GAME OVER', '<p>Fell into the water!</p>'); return; }
  p.copy(lastSafe); p.y += 0.05; vel.set(0, 0, 0);
  timeLeft = Math.max(0, timeLeft - 5); invuln = 1.5; updateHUD();
}

function resetGame() {
  p.copy(SPAWN); lastSafe.copy(SPAWN); vel.set(0, 0, 0);
  yaw = 0; camYaw = 0; mario.rotation.y = 0;
  coinCount = 0; score = 0; lives = 3; timeLeft = 120; invuln = 0; shake = 0;
  gameOver = false; won = false; paused = false; jumping = false;
  coins.forEach(c => { c.taken = false; c.mesh.visible = true; });
  goombas.forEach(g => {
    g.alive = true; g.deadT = null; g.dir = 1;
    g.group.visible = true; g.group.scale.set(1, 1, 1); g.group.position.set(g.x0, g.y, g.z);
  });
  hideMessage(); updateHUD();
}
window.resetGame = resetGame;

// ---------- Fixed-rate simulation ----------
function step() {
  if (gameOver || won) return;
  stepTime += STEP;
  timeLeft -= STEP;
  if (timeLeft <= 0) { timeLeft = 0; gameOver = true; updateHUD(); endGame('TIME UP!'); return; }
  if (Math.ceil(timeLeft) !== shownTime) updateHUD();
  invuln = Math.max(0, invuln - STEP);
  jumpBuf = Math.max(0, jumpBuf - STEP);

  // input (keys + touch joystick, camera-relative via camYaw)
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz -= 1;
  if (keys.KeyS || keys.ArrowDown) mz += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  // merge mobile joystick (joyX = right, joyY = down)
  if (joyActive) { mx += joyX; mz += joyY; }
  running = !!(keys.ShiftLeft || keys.ShiftRight || touchRun || (joyActive && Math.hypot(joyX, joyY) > 0.85));
  const mag = Math.hypot(mx, mz);
  if (mag > 0) {
    mx /= mag; mz /= mag;
    const s = Math.sin(camYaw), c = Math.cos(camYaw);
    const wx = mx * c + mz * s, wz = -mx * s + mz * c;
    const sp = SPEED * (running ? RUN : 1);
    vel.x += wx * sp * 0.48; vel.z += wz * sp * 0.48;
    const maxSp = running ? 0.34 : 0.22, cur = Math.hypot(vel.x, vel.z);
    if (cur > maxSp) { vel.x *= maxSp / cur; vel.z *= maxSp / cur; }
    yaw = Math.atan2(wx, wz);
  }
  vel.x *= 0.82; vel.z *= 0.82;
  if (Math.abs(vel.x) < 0.002) vel.x = 0;
  if (Math.abs(vel.z) < 0.002) vel.z = 0;

  // jump: coyote time + input buffer + variable height
  coyote = onGround ? 0.1 : coyote - STEP;
  if (jumpBuf > 0 && coyote > 0) {
    vel.y = JUMP; onGround = false; coyote = 0; jumpBuf = 0; jumping = true;
    blip(600, 0.1); burst(p, 0xeeeeee, 4, 1.5, 0.5);
  }
  if (jumping) {
    if (vel.y <= 0) jumping = false;
    else if (!keys.Space) { vel.y *= 0.5; jumping = false; }
  }
  vel.y += GRAVITY;

  moveAndCollide();
  if (p.y < -4) fellIntoWater();

  // coins
  for (const c of coins) {
    if (c.taken) continue;
    const dx = p.x - c.mesh.position.x, dy = p.y + 0.8 - c.mesh.position.y, dz = p.z - c.mesh.position.z;
    if (dx * dx + dy * dy + dz * dz < 0.95 * 0.95) {
      c.taken = true; c.mesh.visible = false;
      coinCount++; score += 100;
      burst(c.mesh.position, 0xfbd000, 8, 3, 3); blip(880, 0.08);
      if (coinCount === coins.length) score += 500;
      updateHUD();
    }
  }

  // goombas
  for (const g of goombas) {
    if (!g.alive) continue;
    const gp = g.group.position;
    gp.x += g.dir * g.speed;
    if (Math.abs(gp.x - g.x0) > g.range) g.dir *= -1;
    g.group.rotation.y = g.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    gp.y = g.y + Math.abs(Math.sin(stepTime * 6)) * 0.04;
    if (Math.hypot(p.x - gp.x, p.z - gp.z) < 0.8 && p.y < g.y + 1.0 && p.y + H > g.y) {
      if (vel.y < -0.01 && p.y > g.y + 0.5) {
        g.alive = false; g.deadT = 0; vel.y = JUMP * 0.65; score += 200;
        burst(gp, 0x8d5524, 8, 3, 2); updateHUD(); blip(440, 0.12);
      } else hurt(gp);
    }
  }
  if (gameOver) return;

  // finish
  if (onGround && Math.abs(p.y - finish.y1) < 0.05 &&
    p.x > finish.x0 + 0.5 && p.x < finish.x1 - 0.5 && p.z > finish.z0 + 0.5 && p.z < finish.z1 - 0.5) {
    const all = coinCount === coins.length;
    if (all || coinCount >= 10) {
      won = true; score += Math.ceil(timeLeft) * 10; updateHUD(); blip(1200, 0.4);
      showMessage(`<h1>${all ? 'PERFECT! ★★★' : 'YOU WIN! ★'}</h1><p>Coins ${coinCount}/${coins.length}</p><p>Score ${score}</p><p>Best ${bestScore()}</p><p>Time bonus included!</p><button onclick="resetGame()">PLAY AGAIN (R)</button>`);
    }
  }
}

// ---------- Rendering / visuals ----------
const clock = new THREE.Clock();
const camBase = new THREE.Vector3(6, 5, 10);
let acc = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (!paused) {
    acc += dt;
    for (let n = 0; acc >= STEP && n < 6; n++, acc -= STEP) step();
    if (acc > STEP) acc = 0;
  }
  if (mixer) mixer.update(dt);

  // camera orbit (Q/E or mouse drag)
  if (keys.KeyQ) camYaw += 1.8 * dt;
  if (keys.KeyE) camYaw -= 1.8 * dt;

  const t = performance.now() * 0.001;
  for (const c of coins) if (!c.taken) {
    c.mesh.rotation.y += 3.6 * dt;
    c.mesh.position.y = c.baseY + Math.sin(t * 2 + c.baseY) * 0.12;
  }
  for (const g of goombas) if (g.deadT !== null) {
    g.deadT += dt; g.group.scale.y = 0.2;
    if (g.deadT > 0.4) g.group.visible = false;
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.life -= dt; q.v.y -= 8 * dt; q.m.position.addScaledVector(q.v, dt);
    q.m.material.opacity = Math.max(0, q.life * 2);
    if (q.life <= 0) { scene.remove(q.m); q.m.material.dispose(); parts.splice(i, 1); }
  }

  // player visuals
  mario.rotation.y += angleDiff(yaw, mario.rotation.y) * damp(12, dt);
  mario.visible = invuln <= 0 || Math.floor(invuln * 12) % 2 === 0;
  landSquash = Math.max(0, landSquash - dt);
  const moving = Math.hypot(vel.x, vel.z) > 0.03;
  const ty = onGround ? (landSquash > 0 ? 0.82 : 1) : (vel.y > 0.05 ? 1.12 : 1);
  model.scale.y += (ty - model.scale.y) * damp(18, dt);
  model.scale.x = model.scale.z = 2 - model.scale.y > 1.2 ? 1.2 : 2 - model.scale.y;
  model.rotation.x += ((moving ? (running ? 0.22 : 0.12) : 0) - model.rotation.x) * damp(10, dt);
  model.position.y = onGround && moving ? Math.abs(Math.sin(t * (running ? 16 : 11))) * 0.06 : 0;

  // sun follows the player so shadows cover the whole course
  sun.position.set(p.x + 20, 30, p.z + 15);
  sun.target.position.copy(p);
  water.position.x = p.x; water.position.z = p.z;

  // camera
  const fovT = 62 + (running && moving ? 7 : 0);
  camera.fov += (fovT - camera.fov) * damp(4, dt);
  camera.updateProjectionMatrix();
  if (camMode === 0) {
    const desired = new THREE.Vector3(p.x + Math.sin(camYaw) * camDist, p.y + camHeight, p.z + Math.cos(camYaw) * camDist);
    camBase.lerp(desired, damp(7, dt));
    camera.up.set(0, 1, 0);
    shake = Math.max(0, shake - dt);
    camera.position.copy(camBase).add(new THREE.Vector3((Math.random() - .5) * shake, (Math.random() - .5) * shake, 0));
    camera.lookAt(p.x, p.y + 1, p.z);
  } else {
    camBase.set(p.x, p.y + 28, p.z);
    camera.up.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)); // screen-up = camera forward, so WASD stays intuitive
    camera.position.copy(camBase);
    camera.lookAt(p.x, p.y, p.z);
  }

  renderer.render(scene, camera);
}

resetGame();
animate();