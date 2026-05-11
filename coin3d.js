// SportsPayCoin: interactive 3D coin
// =====================================
// Loads spc-coin.glb (Meshy / Blender export) via GLTFLoader, frames it in the
// host element, and adds drag-to-spin / wheel / double-click flick physics so
// the coin always feels alive. Three.js loaded via importmap in index.html.
//
// Performance guards:
//   1. If WebGL falls back to a software renderer (e.g. hardware acceleration
//      off in Chrome, SwiftShader / llvmpipe / Microsoft Basic Render Driver),
//      we skip 3D entirely and show a CSS-animated static logo.
//   2. After init, a short frame-time probe catches slow GPUs that aren't
//      flagged as "software" but still can't keep up — same fallback.
//   3. The render loop pauses when the coin is off-screen or the tab is
//      hidden, so we don't burn frames behind the rest of the page.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const HOST_ID = 'coin3d-host';
const MODEL_URL = 'spc-coin.glb';
const FALLBACK_IMG = 'spc-logo.png';

const SOFTWARE_RENDERER_HINTS = [
  'swiftshader',
  'llvmpipe',
  'software',
  'microsoft basic render',
  'mesa offscreen',
];

function showStaticFallback(host) {
  if (host.querySelector('.coin-fallback')) return;
  const wrap = document.createElement('div');
  wrap.className = 'coin-fallback';
  const img = document.createElement('img');
  img.src = FALLBACK_IMG;
  img.alt = 'Sports Pay Coin';
  img.decoding = 'async';
  img.loading = 'eager';
  wrap.appendChild(img);
  host.appendChild(wrap);
}

function detectSoftwareRenderer() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl', { failIfMajorPerformanceCaveat: true })
            || c.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true });
    if (!gl) return true; // no WebGL or browser flagged a major perf caveat
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false; // can't tell — assume hardware
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
    return SOFTWARE_RENDERER_HINTS.some(h => renderer.includes(h));
  } catch {
    return true;
  }
}

// ---------- Main entry ----------
export function initCoin3D() {
  const host = document.getElementById(HOST_ID);
  if (!host) return;

  // Fast path: known-bad GPU → static fallback, no Three.js at all.
  if (detectSoftwareRenderer()) {
    showStaticFallback(host);
    return;
  }

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

  // Environment map: neutral studio so the rim picks up some grey reflection
  // detail but stays in the deep-chrome look from the original render.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  // Three-point lighting + brand-coloured rim glints.
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(-4, 2, 3);
  scene.add(fillLight);

  const cyanRim = new THREE.PointLight(0x22d3ee, 4, 20);
  cyanRim.position.set(-3, 2, 2);
  scene.add(cyanRim);

  const purpleRim = new THREE.PointLight(0xa855f7, 4, 20);
  purpleRim.position.set(3, -2, 2);
  scene.add(purpleRim);

  const pinkRim = new THREE.PointLight(0xf472b6, 3, 20);
  pinkRim.position.set(0, -3, 3);
  scene.add(pinkRim);

  // Pivot: user rotation is applied here so we can keep the model's own
  // orientation (set after loading) untouched.
  const pivot = new THREE.Group();
  scene.add(pivot);

  // ---------- Interaction state ----------
  // Idle spin = small constant Y velocity. Drag overrides; release imparts velocity.
  const state = {
    velY: 0.6,           // radians/sec, idle baseline
    velX: 0.0,           // gentle tilt drift on release
    targetIdleY: 0.6,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    sampleVelY: 0,
    sampleVelX: 0,
  };

  const FRICTION = 0.985;
  const TILT_FRICTION = 0.93;
  const SENS = 0.0078;
  const MIN_VEL_FOR_IDLE = 0.65;

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
    const dt = Math.max(1, now - state.lastT) / 1000;
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;

    pivot.rotation.y += dx * SENS;
    pivot.rotation.x += dy * SENS * 0.65;

    state.sampleVelY = (dx * SENS) / dt;
    state.sampleVelX = (dy * SENS * 0.65) / dt;

    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.lastT = now;
  }

  function pointerUp() {
    if (!state.dragging) return;
    state.dragging = false;
    renderer.domElement.style.cursor = 'grab';
    state.velY = state.sampleVelY;
    state.velX = state.sampleVelX;
    state.velY = Math.max(-60, Math.min(60, state.velY));
    state.velX = Math.max(-30, Math.min(30, state.velX));
  }

  renderer.domElement.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointermove', pointerMove, { passive: true });
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);

  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.velY += e.deltaY * 0.002;
    state.velY = Math.max(-60, Math.min(60, state.velY));
  }, { passive: false });

  renderer.domElement.addEventListener('dblclick', () => {
    state.velY = 18;
  });

  // ---------- Load the GLB ----------
  // While loading, show a quick procedural fallback so the area isn't empty.
  let coin = null;
  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      coin = gltf.scene;

      // Center & scale the model to fit the host's view nicely.
      // Authored orientation and materials are preserved as-is.
      const box = new THREE.Box3().setFromObject(coin);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      coin.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetSize = 2.2;
      coin.scale.setScalar(targetSize / maxDim);

      pivot.add(coin);
    },
    undefined,
    (err) => {
      console.error('[coin3d] Failed to load', MODEL_URL, err);
      // Fallback: a simple bronze disc so something still renders
      const fallback = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 0.16, 96),
        new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.7, roughness: 0.3 })
      );
      fallback.rotation.x = Math.PI / 2;
      pivot.add(fallback);
      coin = fallback;
    }
  );

  // ---------- Animate ----------
  let last = performance.now();
  let resizeRAF = 0;
  let rafId = 0;
  let running = true;

  // Frame-time probe: average over ~30 frames once the GLB has rendered.
  // If it's bad (≥ ~28ms avg → < ~36fps), tear down and use the static fallback.
  let probeFrames = 0;
  let probeAccum = 0;
  const PROBE_SAMPLES = 30;
  const SLOW_AVG_MS = 28;
  let probed = false;

  function fallbackToStatic() {
    running = false;
    cancelAnimationFrame(rafId);
    try {
      renderer.dispose();
      pmrem.dispose();
      envTex.dispose();
    } catch {}
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    showStaticFallback(host);
  }

  function animate(now) {
    if (!running) return;
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - last) / 1000);
    const frameMs = now - last;
    last = now;

    if (!state.dragging) {
      pivot.rotation.y += state.velY * dt;
      pivot.rotation.x += state.velX * dt;
      state.velY *= FRICTION;
      state.velX *= TILT_FRICTION;
      pivot.rotation.x *= 0.98;
      if (Math.abs(state.velY) < MIN_VEL_FOR_IDLE) {
        state.velY += (state.targetIdleY - state.velY) * 0.02;
      }
    }

    renderer.render(scene, camera);

    // Only sample after the GLB has loaded and the scene has had a chance to
    // settle — first frame is often inflated by shader compile / texture upload.
    if (!probed && coin && frameMs < 200) {
      probeAccum += frameMs;
      probeFrames++;
      if (probeFrames >= PROBE_SAMPLES) {
        probed = true;
        const avg = probeAccum / probeFrames;
        if (avg >= SLOW_AVG_MS) {
          console.warn(`[coin3d] Slow GPU detected (${avg.toFixed(1)}ms/frame avg) — falling back to static logo`);
          fallbackToStatic();
        }
      }
    }
  }

  function start() {
    if (running && rafId) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(animate);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // Pause unless the coin is both on-screen AND the tab is visible.
  let onScreen = true;
  let pageVisible = !document.hidden;
  function reconcile() {
    if (onScreen && pageVisible) start(); else stop();
  }
  rafId = requestAnimationFrame(animate);

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) onScreen = entry.isIntersecting;
      reconcile();
    }, { threshold: 0.01 });
    io.observe(host);
  }

  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
    reconcile();
  });

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
  window.__spcCoin = { scene, camera, renderer, pivot, state, get coin() { return coin; } };
}
