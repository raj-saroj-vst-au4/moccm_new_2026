// Home intro: one particle system that morphs, as the visitor scrolls, between
//   0  a Monte Carlo fan of simulated price paths     (Industry-defined.)
//   1  an implied volatility surface                   (Academia-led.)
//   2  the MOCCM network graph from the logo           (Action-focused.)
// Skipped entirely for reduced motion, ?static, or no WebGL; the SVG graph stays as the fallback.
import * as THREE from './vendor/three.module.min.js';

const intro = document.querySelector('.intro');
const canvas = intro && intro.querySelector('.intro-canvas');
const params = new URLSearchParams(location.search);
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const loader = window.__loader;          // set by the inline script in <head> (home page only)
window.__introStarted = true;
if (loader) loader.progress(0.45);        // the 3D engine has downloaded and parsed

if (canvas) {
  let running = false;
  if (!reduce && !params.has('static') && webglAvailable()) {
    try {
      running = start() !== false;
    } catch (e) {
      console.warn('MOCCM intro: showing the static graph instead', e);
    }
  }
  if (!running) {
    intro.classList.add('no-gl');
    if (loader) loader.done();            // static graph: nothing to wait for
  }
}

function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return false;
  }
  if (!renderer.getContext()) return false;
  let lost = false, failed = false;
  const kick = () => { if (!raf && !lost && !failed) raf = requestAnimationFrame(frame); };
  const fallBack = () => {
    failed = true;
    intro.classList.remove('has-gl');
    intro.classList.add('no-gl');
  };
  renderer.debug.onShaderError = fallBack;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; intro.classList.remove('has-gl'); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; if (!failed) { intro.classList.add('has-gl'); kick(); } });

  const small = window.matchMedia('(max-width: 760px)').matches;
  const COUNT = small ? 7200 : 15000;
  const rand = mulberry32(20261027);
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const NAVY = new THREE.Color('#3a6596'), BLUE = new THREE.Color('#7fa6d6'),
        GOLD = new THREE.Color('#e8c65c'), GOLD_HI = new THREE.Color('#fff0b8'), DEEP = new THREE.Color('#24476f');

  const pA = new Float32Array(COUNT * 3), pB = new Float32Array(COUNT * 3), pC = new Float32Array(COUNT * 3);
  const cA = new Float32Array(COUNT * 3), cB = new Float32Array(COUNT * 3), cC = new Float32Array(COUNT * 3);
  const aR = new Float32Array(COUNT);
  const tmp = new THREE.Color();
  const put = (arr, i, x, y, z) => { arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z; };
  const putC = (arr, i, c) => { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; };

  // ---- 0: Monte Carlo fan (geometric Brownian motion, log scale) ----
  const PATHS = small ? 80 : 130, STEPS = Math.ceil(COUNT / PATHS);
  const paths = [];
  for (let p = 0; p < PATHS; p++) {
    let y = 0;
    const pts = [];
    for (let s = 0; s < STEPS; s++) { pts.push(y); y += 0.014 + 0.06 * gauss(); }
    paths.push({ pts, end: y, z: (rand() - 0.5) * 1.4 });
  }
  const ends = paths.map((p) => p.end).sort((a, b) => a - b);
  const lo = ends[Math.floor(PATHS * 0.05)], hi = ends[Math.floor(PATHS * 0.95)];
  for (let i = 0; i < COUNT; i++) {
    const p = paths[i % PATHS], s = Math.floor(i / PATHS) % STEPS;
    const t = s / (STEPS - 1);
    put(pA, i, -3.0 + t * 6.2, -0.8 + p.pts[s] * 0.95, p.z);
    const rank = Math.min(1, Math.max(0, (p.end - lo) / (hi - lo)));
    tmp.copy(DEEP).lerp(BLUE, Math.min(1, rank * 1.4));
    if (rank > 0.78) tmp.lerp(GOLD, (rank - 0.78) / 0.22);
    tmp.multiplyScalar(0.8 + 0.4 * t);
    putC(cA, i, tmp);
    aR[i] = rand();
  }

  // ---- 1: implied volatility surface (smile + skew, flattening with maturity) ----
  const GX = Math.ceil(Math.sqrt(COUNT * 1.25)), GZ = Math.ceil(COUNT / GX);
  for (let i = 0; i < COUNT; i++) {
    const u = (i % GX) / (GX - 1), v = Math.floor(i / GX) / (GZ - 1);
    const k = u * 2 - 1;
    const iv = 0.2 + (0.62 * k * k) / (0.42 + 1.6 * v) - 0.16 * k * (1 - 0.6 * v);
    put(pB, i, k * 2.5 + (rand() - 0.5) * 0.02, (iv - 0.42) * 2.1, (v - 0.5) * 3.0 + (rand() - 0.5) * 0.02);
    const h = Math.min(1, Math.max(0, (iv - 0.12) / 0.75));
    tmp.copy(NAVY).lerp(BLUE, Math.min(1, h * 1.8));
    if (h > 0.5) tmp.lerp(GOLD, (h - 0.5) / 0.5);
    putC(cB, i, tmp);
  }

  // ---- 2: the MOCCM network (same nodes and edges as the SVG graph) ----
  const N = [[20,600,8],[110,470,9],[210,500,8],[235,585,9],[320,380,10],[380,455,9],[470,520,9],[520,350,10],[600,410,9],[640,250,10],[730,300,9],[760,170,10],[880,70,14],[905,215,11]];
  const GOLDSET = new Set([9, 10, 11, 12, 13]);
  const E = [[0,1],[0,2],[1,2],[1,3],[2,3],[2,4],[3,4],[4,5],[4,7],[5,6],[5,7],[6,7],[6,8],[7,8],[7,9],[8,9],[8,10],[9,10],[9,11],[10,12],[10,13],[11,12],[11,13],[12,13],[8,12]];
  const P = N.map(([x, y]) => [(x / 1000 - 0.5) * 6.2, -(y / 620 - 0.5) * 3.84, 0]);
  const lens = E.map(([a, b]) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]));
  const totalLen = lens.reduce((s, l) => s + l, 0);
  const nodeShare = 0.34, nodeWeights = N.map((n) => n[2] * n[2]), nodeTotal = nodeWeights.reduce((s, w) => s + w, 0);
  const pickWeighted = (weights, total) => {
    let r = rand() * total;
    for (let j = 0; j < weights.length; j++) { r -= weights[j]; if (r <= 0) return j; }
    return weights.length - 1;
  };
  for (let i = 0; i < COUNT; i++) {
    if (rand() < nodeShare) {
      const n = pickWeighted(nodeWeights, nodeTotal), rad = N[n][2] * 0.0085;
      put(pC, i, P[n][0] + gauss() * rad, P[n][1] + gauss() * rad, gauss() * rad);
      tmp.copy(GOLDSET.has(n) ? GOLD_HI : BLUE);
    } else {
      const e = pickWeighted(lens, totalLen), [a, b] = E[e], t = rand();
      put(pC, i,
        P[a][0] + (P[b][0] - P[a][0]) * t + gauss() * 0.012,
        P[a][1] + (P[b][1] - P[a][1]) * t + gauss() * 0.012,
        gauss() * 0.02);
      tmp.copy(GOLDSET.has(b) ? GOLD : NAVY).multiplyScalar(0.8);
    }
    putC(cC, i, tmp);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pA, 3));
  geo.setAttribute('pB', new THREE.BufferAttribute(pB, 3));
  geo.setAttribute('pC', new THREE.BufferAttribute(pC, 3));
  geo.setAttribute('cA', new THREE.BufferAttribute(cA, 3));
  geo.setAttribute('cB', new THREE.BufferAttribute(cB, 3));
  geo.setAttribute('cC', new THREE.BufferAttribute(cC, 3));
  geo.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
  if (loader) loader.progress(0.65);

  const uniforms = {
    uP: { value: 0 }, uTime: { value: 0 }, uFade: { value: 0 },
    uSize: { value: small ? 26 : 30 }, uPR: { value: 1 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 pB; attribute vec3 pC;
      attribute vec3 cA; attribute vec3 cB; attribute vec3 cC;
      attribute float aR;
      uniform float uP, uTime, uSize, uPR;
      varying vec3 vC; varying float vA;
      float io(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }
      void main() {
        float t1 = io(clamp((uP - aR * 0.35) / 0.65, 0.0, 1.0));
        float t2 = io(clamp((uP - 1.0 - aR * 0.35) / 0.65, 0.0, 1.0));
        vec3 p = mix(mix(position, pB, t1), pC, t2);
        float arc = sin(t1 * 3.14159) + sin(t2 * 3.14159);
        p.z += arc * (aR - 0.5) * 2.2;
        p.y += arc * sin(aR * 40.0) * 0.25;
        p += vec3(sin(uTime * 0.6 + aR * 31.0), cos(uTime * 0.5 + aR * 17.0), sin(uTime * 0.4 + aR * 23.0)) * 0.022;
        vC = mix(mix(cA, cB, t1), cC, t2);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPR * (0.5 + aR * 0.9) * (1.0 + 0.3 * t2) / -mv.z;
        vA = 0.5 + 0.5 * fract(aR * 7.31);
      }`,
    fragmentShader: /* glsl */`
      uniform float uFade;
      varying vec3 vC; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vC * (0.7 + 0.6 * a), a * vA * uFade);
      }`
  });

  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.add(new THREE.Points(geo, material));
  scene.add(group);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 10.5);

  let baseY = 0, dropY = 0.55;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    uniforms.uPR.value = pr * (h / 900);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const narrow = w < 760;
    // phones: the copy sits at the bottom, so the shapes take the space above it
    baseY = narrow ? 2.0 : 0.35;
    dropY = narrow ? 0.2 : 0.55;
    group.position.set(narrow ? 0 : 1.75, baseY, 0);
    group.scale.setScalar(narrow ? 0.5 : Math.min(1, w / 1300));
  }
  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);

  // ---- Sequence: 0..1 through the three chapters, from scroll (pinned) or a timed loop ----
  // Each chapter owns a third of the sequence; the shape holds mid-chapter and morphs across the boundary.
  const shape = (p) => {
    if (p < 0.22) return 0;
    if (p < 0.44) return (p - 0.22) / 0.22;
    if (p < 0.56) return 1;
    if (p < 0.78) return 1 + (p - 0.56) / 0.22;
    return 2;
  };
  const chapters = Array.from(intro.querySelectorAll('.chapters li'));
  const forced = params.has('p') ? parseFloat(params.get('p')) : null;
  const LOOP = 18;                     // seconds per cycle when the intro isn't pinned
  let mode = forced !== null ? 'forced' : 'loop';
  let seq = forced !== null ? forced / 2 : 0;
  let current = forced ?? 0;
  const { gsap, ScrollTrigger } = window;
  const header = document.querySelector('.site-header');
  const stage = intro.querySelector('.intro-stage');
  const copy = intro.querySelector('.intro-copy');
  const skip = intro.querySelector('.skip-intro');

  // particles fade in and the camera eases forward as the loader lifts
  const enter = () => {
    if (gsap) {
      gsap.to(uniforms.uFade, { value: 1, duration: 1.8, ease: 'power2.out', delay: 0.1 });
      gsap.fromTo(camera.position, { z: 14 }, { z: 10.5, duration: 2.6, ease: 'expo.out' });
    } else {
      uniforms.uFade.value = 1;
    }
  };
  if (loader) loader.ready.then(enter); else enter();
  let pinDecided = Promise.resolve();

  // Pin only when the copy, buttons and chapter row all fit in one screen; otherwise the page
  // scrolls normally and the shapes loop. Decided once the web fonts are loaded (so heights are
  // final) and re-checked whenever the window changes size or zoom.
  let pin = null;
  const createPin = () => ScrollTrigger.create({
    trigger: intro,
    start: () => 'top ' + (header ? header.offsetHeight : 0),
    end: () => '+=' + Math.round(window.innerHeight * (small ? 1.4 : 1.8)),
    pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 1,
    onUpdate: (self) => { seq = self.progress; }
  });
  const evaluatePin = () => {
    if (failed) return;
    const was = !!pin;
    // Make the intro fit one screen rather than give up the pin: on short windows drop the
    // Centre-name line (the header shows it), then the tagline. Only if even that can't fit
    // (a very short window) does the page scroll normally with the shapes playing on a loop.
    const fitsNow = () => copy.offsetHeight <= stage.clientHeight;
    intro.classList.add('is-pinned');
    intro.classList.remove('is-compact', 'is-tight');
    let fits = fitsNow();
    if (!fits) { intro.classList.add('is-compact'); fits = fitsNow(); }
    if (!fits) { intro.classList.add('is-tight'); fits = fitsNow(); }
    if (!fits) intro.classList.remove('is-compact', 'is-tight');
    intro.classList.toggle('is-pinned', fits);
    if (fits && !pin) { pin = createPin(); mode = 'scroll'; }
    if (!fits && pin) { pin.kill(); pin = null; mode = 'loop'; }
    if (was !== !!pin) { ScrollTrigger.sort(); ScrollTrigger.refresh(); }
  };
  if (forced === null && gsap && ScrollTrigger) {
    const fontsIn = document.fonts
      ? Promise.all([document.fonts.load('850 1em Archivo'), document.fonts.load('1em "Source Serif 4"')]).catch(() => {}).then(() => document.fonts.ready)
      : Promise.resolve();
    // don't wait forever on a slow font: decide after 2.5 s, and again once fonts do arrive
    pinDecided = Promise.race([fontsIn, new Promise((r) => setTimeout(r, 2500))]).then(() => { evaluatePin(); fontsIn.then(evaluatePin); });
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    let lastW = window.innerWidth, timer = 0;
    window.addEventListener('resize', () => {
      // phones resize the viewport as the address bar slides; only a width change counts there
      if (coarse && window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(evaluatePin, 250);
    });
    if (skip) {
      skip.addEventListener('click', () => {
        // land on the section after the intro, just below the sticky header
        const holder = intro.parentElement.classList.contains('pin-spacer') ? intro.parentElement : intro;
        const next = holder.nextElementSibling;
        const offset = header ? header.offsetHeight : 0;
        const y = next ? next.getBoundingClientRect().top + window.scrollY - offset : (pin ? Math.ceil(pin.end) + 2 : 0);
        if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.6 });
        else window.scrollTo({ top: y, behavior: 'smooth' });
      });
    }
  }
  // the shader failing to compile on some GPU also undoes the pin, so nothing waits on a blank screen
  renderer.debug.onShaderError = () => {
    fallBack();
    if (pin) { pin.kill(); pin = null; intro.classList.remove('is-pinned'); ScrollTrigger.refresh(); }
  };

  // read-only state for diagnosing the intro from the console: __intro.state()
  window.__intro = { state: () => ({ mode, seq: +seq.toFixed(3), shape: +current.toFixed(3), pinned: !!pin, failed, lost, visible, frames, fade: +uniforms.uFade.value.toFixed(2) }) };

  // ---- Pointer parallax ----
  let mx = 0, my = 0;
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  // ---- Render only while the intro is on screen ----
  let visible = true, raf = 0, frames = 0;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) kick();
  }).observe(intro);
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;            // returning via the back button: resume drawing
    visible = true;
    kick();
    if (ScrollTrigger) ScrollTrigger.refresh();
  });

  const clock = new THREE.Clock();
  let lastChapter = -1, t = 0;
  let curtain = !!loader;                 // the loader covers the canvas: no need to draw yet
  if (loader) loader.ready.then(() => { curtain = false; clock.getDelta(); });
  function frame() {
    raf = 0;
    if (!visible || lost || failed) return;
    if (curtain) { raf = requestAnimationFrame(frame); return; }
    try {
      draw();
    } catch (e) {
      console.warn('MOCCM intro: frame skipped', e);
    }
    raf = requestAnimationFrame(frame);
  }
  function draw() {
    const dt = Math.min(clock.getDelta(), 0.1);
    t += dt;
    if (mode === 'loop') seq = (t % LOOP) / LOOP;
    const target = mode === 'forced' ? forced : shape(seq);
    current += (target - current) * (1 - Math.exp(-dt * 5));   // same feel at any frame rate
    uniforms.uP.value = current;
    uniforms.uTime.value = t;

    const b = smooth(Math.min(current, 1)), c = smooth(Math.max(current - 1, 0));
    group.position.y = baseY - dropY * b * (1 - c);
    group.rotation.x = 0.5 * b * (1 - c) + my * 0.12;
    group.rotation.y = -0.18 * (1 - b) - 0.5 * b * (1 - c) + mx * 0.3 + Math.sin(t * 0.15) * 0.05;
    group.rotation.z = 0.04 * (1 - b);

    chapters.forEach((li, i) => li.style.setProperty('--fill', Math.min(1, Math.max(0, seq * 3 - i)).toFixed(3)));
    const ch = Math.min(2, Math.floor(seq * 3));
    if (ch !== lastChapter) {
      chapters.forEach((li, i) => li.classList.toggle('is-active', i === ch));
      lastChapter = ch;
    }
    renderer.render(scene, camera);
    frames++;
  }
  renderer.compile(scene, camera);       // surfaces shader errors before the first frame
  if (failed) return false;
  renderer.render(scene, camera);        // warm-up frame while the particles are still transparent
  if (loader) loader.progress(0.85);
  intro.classList.add('has-gl');
  kick();
  if (loader) pinDecided.then(() => { loader.progress(1); setTimeout(loader.done, 300); });
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();        // release the probe at once
    return true;
  } catch (e) {
    return false;
  }
}

function smooth(t) { return t * t * (3 - 2 * t); }

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
