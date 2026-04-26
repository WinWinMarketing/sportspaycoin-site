// SportsPayCoin — interactive 3D coin
// =====================================
// Loads spc-coin.glb (Meshy / Blender export) via GLTFLoader, frames it in the
// host element, and adds drag-to-spin / wheel / double-click flick physics so
// the coin always feels alive. Three.js loaded via importmap in index.html.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const HOST_ID = 'coin3d-host';
const MODEL_URL = 'spc-coin.glb';

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

  // Environment map — neutral studio so the rim picks up some grey reflection
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

  // Pivot — user rotation is applied here so we can keep the model's own
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
      const box = new THREE.Box3().setFromObject(coin);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      // Recenter
      coin.position.sub(center);
      // Scale so the largest dimension is ~2.2 units (camera at z=4.5, fov=35)
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetSize = 2.2;
      const scale = targetSize / maxDim;
      coin.scale.setScalar(scale);

      // The Meshy export comes face-up (Y up). Tilt it forward so the face
      // points at the camera, then let user rotation take over from there.
      coin.rotation.x = Math.PI / 2;

      // Trust the GLB's authored materials (Blender SPC_Chrome = silver
      // metalness 1.0 / roughness 0.08; SPC_Face = emissive map). Just turn
      // env reflections up a touch so the chrome rim sparkles on bright
      // backgrounds without going chalky.
      coin.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if ('envMapIntensity' in m) m.envMapIntensity = 1.4;
            m.needsUpdate = true;
          });
        }
      });

      pivot.add(coin);
    },
    undefined,
    (err) => {
      console.error('[coin3d] Failed to load', MODEL_URL, err);
      // Fallback — a simple bronze disc so something still renders
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

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - last) / 1000);
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
  window.__spcCoin = { scene, camera, renderer, pivot, state, get coin() { return coin; } };
}
