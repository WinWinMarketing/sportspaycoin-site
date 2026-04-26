// SportsPayCoin — interactive 3D coin
// =====================================
// Uses Three.js (loaded via importmap in index.html).
// Procedurally generates the coin face texture from canvas, builds a thin
// cylinder geometry with metallic edge, and adds drag-to-spin with
// momentum-based physics so flicks keep going and decay naturally.

import * as THREE from 'three';

const HOST_ID = 'coin3d-host';

// ---------- Face texture (procedural canvas) ----------
function buildCoinFaceTexture(side = 1024) {
  const c = document.createElement('canvas');
  c.width = side; c.height = side;
  const ctx = c.getContext('2d');
  const cx = side / 2, cy = side / 2;

  // 1. Outer metallic ring — silver gradient
  const ringGrad = ctx.createLinearGradient(0, 0, side, side);
  ringGrad.addColorStop(0.0, '#dbdbe2');
  ringGrad.addColorStop(0.3, '#9499a2');
  ringGrad.addColorStop(0.5, '#f3f4f6');
  ringGrad.addColorStop(0.7, '#7c8290');
  ringGrad.addColorStop(1.0, '#c5c8d0');
  ctx.fillStyle = ringGrad;
  ctx.beginPath(); ctx.arc(cx, cy, side * 0.49, 0, Math.PI * 2); ctx.fill();

  // 2. Inner dark navy face — radial gradient
  const faceGrad = ctx.createRadialGradient(cx - side*0.05, cy - side*0.07, side*0.02, cx, cy, side*0.45);
  faceGrad.addColorStop(0.0, '#2a1f6b');
  faceGrad.addColorStop(0.5, '#15113f');
  faceGrad.addColorStop(1.0, '#070424');
  ctx.fillStyle = faceGrad;
  ctx.beginPath(); ctx.arc(cx, cy, side * 0.43, 0, Math.PI * 2); ctx.fill();

  // 3. Inner ring outline (cyan→purple→pink gradient)
  const outlineGrad = ctx.createConicGradient(0, cx, cy);
  outlineGrad.addColorStop(0.00, '#22d3ee');
  outlineGrad.addColorStop(0.33, '#8b5cf6');
  outlineGrad.addColorStop(0.66, '#f472b6');
  outlineGrad.addColorStop(1.00, '#22d3ee');
  ctx.lineWidth = side * 0.012;
  ctx.strokeStyle = outlineGrad;
  ctx.beginPath(); ctx.arc(cx, cy, side * 0.42, 0, Math.PI * 2); ctx.stroke();

  // 4. "SPORTS PAY COIN" arched along upper rim
  drawArcText(ctx, 'SPORTS PAY', cx, cy, side * 0.355, -Math.PI / 2, side * 0.058, outlineGrad);
  drawArcText(ctx, 'COIN', cx, cy, side * 0.355, Math.PI / 2, side * 0.058, outlineGrad, true);

  // 5. Center inner circle
  ctx.lineWidth = side * 0.006;
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.beginPath(); ctx.arc(cx, cy, side * 0.20, 0, Math.PI * 2); ctx.stroke();

  // 6. Big "SPC" text
  ctx.save();
  const spcGrad = ctx.createLinearGradient(cx - side*0.18, cy, cx + side*0.18, cy);
  spcGrad.addColorStop(0, '#22d3ee');
  spcGrad.addColorStop(0.5, '#8b5cf6');
  spcGrad.addColorStop(1, '#f472b6');
  ctx.fillStyle = spcGrad;
  ctx.font = `bold ${side * 0.16}px "Space Grotesk", "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Glow underneath
  ctx.shadowColor = 'rgba(139,92,246,0.6)';
  ctx.shadowBlur = side * 0.04;
  ctx.fillText('SPC', cx, cy + side * 0.005);
  ctx.restore();

  // 7. Subtle highlight to suggest a polished surface
  const hi = ctx.createRadialGradient(cx - side*0.18, cy - side*0.20, 0, cx - side*0.18, cy - side*0.20, side * 0.30);
  hi.addColorStop(0, 'rgba(255,255,255,0.18)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hi;
  ctx.beginPath(); ctx.arc(cx, cy, side * 0.43, 0, Math.PI * 2); ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function drawArcText(ctx, text, cx, cy, radius, centerAngle, fontSize, fillStyle, flip = false) {
  ctx.save();
  ctx.font = `bold ${fontSize}px "Space Grotesk", "Inter", sans-serif`;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Add letter spacing manually
  const letterSpacing = fontSize * 0.06;
  let totalWidth = 0;
  const widths = [];
  for (const ch of text) {
    const w = ctx.measureText(ch).width + letterSpacing;
    widths.push(w);
    totalWidth += w;
  }
  const arcLength = totalWidth;
  const angularSpan = arcLength / radius;
  let angle = centerAngle - angularSpan / 2;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const w = widths[i];
    const charAngle = angle + (w / radius) / 2;
    ctx.save();
    const x = cx + Math.cos(charAngle) * radius;
    const y = cy + Math.sin(charAngle) * radius;
    ctx.translate(x, y);
    ctx.rotate(flip ? charAngle - Math.PI / 2 : charAngle + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += w / radius;
  }
  ctx.restore();
}

// ---------- Edge (rim) texture: brushed-metal stripe ----------
function buildEdgeTexture(w = 2048, h = 64) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  // Vertical metallic gradient
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, '#5a5e6a');
  g.addColorStop(0.5, '#e2e3e7');
  g.addColorStop(1.0, '#3a3d46');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Fine vertical brush striations
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * w;
    const a = 0.04 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},${a})`;
    ctx.fillRect(x, 0, 1, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.anisotropy = 8;
  return tex;
}

// ---------- Main entry ----------
export function initCoin3D() {
  const host = document.getElementById(HOST_ID);
  if (!host) return;

  const W = () => host.clientWidth;
  const H = () => host.clientHeight;

  // Scene
  const scene = new THREE.Scene();
  scene.background = null;

  // Camera
  const camera = new THREE.PerspectiveCamera(35, W() / H(), 0.1, 100);
  camera.position.set(0, 0, 4.5);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H(), false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'grab';

  // Lighting — three-point setup with brand-color rims
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const cyanRim = new THREE.PointLight(0x22d3ee, 4, 20);
  cyanRim.position.set(-3, 2, 2);
  scene.add(cyanRim);

  const purpleRim = new THREE.PointLight(0xa855f7, 4, 20);
  purpleRim.position.set(3, -2, 2);
  scene.add(purpleRim);

  const pinkRim = new THREE.PointLight(0xf472b6, 3, 20);
  pinkRim.position.set(0, -3, 3);
  scene.add(pinkRim);

  // Coin geometry — slightly thick disc
  const RADIUS = 1.1;
  const HEIGHT = 0.16;
  const SEG = 96;
  const geo = new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, SEG, 1);

  // Materials: [side, top, bottom]
  const faceTexFront = buildCoinFaceTexture(1024);
  const faceTexBack  = buildCoinFaceTexture(1024); // same — looks like both sides match
  const edgeTex = buildEdgeTexture();

  const faceMatFront = new THREE.MeshPhysicalMaterial({
    map: faceTexFront,
    metalness: 0.55,
    roughness: 0.32,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    reflectivity: 0.6,
  });
  const faceMatBack = new THREE.MeshPhysicalMaterial({
    map: faceTexBack,
    metalness: 0.55,
    roughness: 0.32,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    reflectivity: 0.6,
  });
  const edgeMat = new THREE.MeshPhysicalMaterial({
    map: edgeTex,
    metalness: 0.95,
    roughness: 0.22,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  });

  const coin = new THREE.Mesh(geo, [edgeMat, faceMatFront, faceMatBack]);
  // Lay the cylinder flat (face the camera)
  coin.rotation.x = Math.PI / 2;

  // Wrap in a pivot so we can apply user rotation cleanly without losing the X-flip
  const pivot = new THREE.Group();
  pivot.add(coin);
  scene.add(pivot);

  // ---------- Interaction: drag to spin with momentum ----------
  // Idle spin = small constant Y velocity. Drag overrides; release imparts velocity.
  const state = {
    velY: 0.6,           // radians/sec, idle baseline
    velX: 0.0,           // gentle tilt drift on release
    targetIdleY: 0.6,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    sampleVelY: 0,       // running sample of velocity during drag
    sampleVelX: 0,
  };

  const FRICTION = 0.985;          // per frame friction toward idle (high → keeps spinning)
  const TILT_FRICTION = 0.93;      // x-axis tilt decays faster
  const SENS = 0.0078;             // pixel→radian sensitivity
  const MIN_VEL_FOR_IDLE = 0.65;   // below this we re-engage idle baseline

  function pointerDown(e) {
    state.dragging = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.lastT = performance.now();
    state.sampleVelY = 0;
    state.sampleVelX = 0;
    renderer.domElement.style.cursor = 'grabbing';
    renderer.domElement.setPointerCapture && renderer.domElement.setPointerCapture(e.pointerId);
  }

  function pointerMove(e) {
    if (!state.dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - state.lastT) / 1000; // seconds
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;

    // Apply rotation immediately
    pivot.rotation.y += dx * SENS;
    pivot.rotation.x += dy * SENS * 0.65;

    // Track velocity (rad/s)
    state.sampleVelY = (dx * SENS) / dt;
    state.sampleVelX = (dy * SENS * 0.65) / dt;

    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.lastT = now;
  }

  function pointerUp(e) {
    if (!state.dragging) return;
    state.dragging = false;
    renderer.domElement.style.cursor = 'grab';
    // Impart sampled velocity — flick momentum
    state.velY = state.sampleVelY;
    state.velX = state.sampleVelX;
    // Cap absurd velocities (protect against tiny dt spikes)
    state.velY = Math.max(-60, Math.min(60, state.velY));
    state.velX = Math.max(-30, Math.min(30, state.velX));
  }

  renderer.domElement.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointermove', pointerMove, { passive: true });
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);

  // Wheel = spin by scrolling
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.velY += e.deltaY * 0.002;
    state.velY = Math.max(-60, Math.min(60, state.velY));
  }, { passive: false });

  // Double-click = big flick
  renderer.domElement.addEventListener('dblclick', () => {
    state.velY = 18;
  });

  // ---------- Animate ----------
  let last = performance.now();
  let resizeRAF = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (!state.dragging) {
      // Apply velocity
      pivot.rotation.y += state.velY * dt;
      pivot.rotation.x += state.velX * dt;
      // Friction
      state.velY *= FRICTION;
      state.velX *= TILT_FRICTION;
      // Pull rotation.x slowly back to 0 (level out tilt)
      pivot.rotation.x *= 0.98;
      // Idle floor
      if (Math.abs(state.velY) < MIN_VEL_FOR_IDLE) {
        // Ease into idle baseline
        state.velY += (state.targetIdleY - state.velY) * 0.02;
      }
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  // ---------- Resize ----------
  function onResize() {
    cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(() => {
      const w = W(), h = H();
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
  }
  window.addEventListener('resize', onResize);
  if ('ResizeObserver' in window) {
    new ResizeObserver(onResize).observe(host);
  }

  // Expose for debugging
  window.__spcCoin = { scene, camera, renderer, pivot, state };
}
