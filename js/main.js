/* ═══════════════════════════════════════════════════════════════════
   LEGACY — the loom.
   One persistent particle field plays six roles as you scroll:
   disc (hero) → thread (descent) → rings (method) → wave (listening,
   audio-reactive) → arcs (chapters/keepsake/promise) → embers (finale).
   Hand-rolled 3D: polar particles, axis rotation, perspective divide.
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  /* ── palette (rgb mirrors of the oklch tokens) ─────────────────── */
  const BG = {
    parchment: [242, 236, 221],
    dark:      [23, 19, 16],
    ember:     [29, 21, 14],
  };
  const DOT = {
    ink:    'rgba(62, 52, 42,',
    gold:   'rgba(224, 178, 98,',
    copper: 'rgba(196, 126, 79,',
  };

  /* ── canvas setup ──────────────────────────────────────────────── */
  const canvas = document.getElementById('loom');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1, R = 300;

  /* sprite factory: soft radial dot, pre-rendered for speed */
  function makeSprite(rgbaPrefix, core, halo) {
    const s = document.createElement('canvas');
    const px = 32;
    s.width = s.height = px;
    const c = s.getContext('2d');
    const g = c.createRadialGradient(px/2, px/2, 0, px/2, px/2, px/2);
    g.addColorStop(0, rgbaPrefix + core + ')');
    g.addColorStop(0.35, rgbaPrefix + halo + ')');
    g.addColorStop(1, rgbaPrefix + '0)');
    c.fillStyle = g;
    c.fillRect(0, 0, px, px);
    return s;
  }
  const SPRITES = {
    ink:    makeSprite(DOT.ink,    0.95, 0.28),
    gold:   makeSprite(DOT.gold,   0.95, 0.30),
    copper: makeSprite(DOT.copper, 0.9,  0.26),
  };

  /* ── particles ─────────────────────────────────────────────────── */
  const RINGS = 14;
  let parts = [];
  function buildParticles() {
    const target = Math.max(700, Math.min(2400, Math.round((W * H) / 950)));
    parts = new Array(target);
    for (let i = 0; i < target; i++) {
      const ring = (i % RINGS) / (RINGS - 1);                 // 0..1
      const theta = Math.random() * TAU;
      parts[i] = {
        ring,
        theta,
        seed: Math.random() * TAU,
        drift: 0.35 + Math.random() * 0.65,
        v: Math.random() < 0.14 ? 'copper' : 'gold',          // dark-world tint
        size: 0.6 + Math.random() * 0.5,
      };
    }
  }

  /* ── cheap layered-sine "voice" noise ──────────────────────────── */
  function voice(u, t) {
    return (
      Math.sin(u * 9.0 + t * 1.7) * 0.5 +
      Math.sin(u * 23.0 - t * 2.6) * 0.3 +
      Math.sin(u * 5.0 + t * 0.9) * 0.2
    );
  }

  /* real audio level bins, fed by the player (0..1) */
  const BINS = 48;
  const audioBins = new Float32Array(BINS);
  let audioLive = false;

  /* ── scenes ────────────────────────────────────────────────────
     Each writes [x, y, z, alpha] into out for particle p at time t.
     Coordinates are world units where 1 ≈ R px. ─────────────────── */
  const out = [0, 0, 0, 0];

  const scenes = {
    disc(p, t) {
      const r = 0.2 + p.ring * 0.85;
      const th = p.theta + t * 0.05 * (0.35 + p.ring * 0.65);
      const breathe = Math.sin(t * 0.7 + p.ring * 6.0) * 0.035;
      const px = Math.cos(th) * r;
      const py = Math.sin(th) * r;
      // ripple from pointer (in disc space)
      const dx = px - pointer.wx, dy = py - pointer.wy;
      const d = Math.hypot(dx, dy);
      const ripple = Math.exp(-d * 3.2) * 0.22 * pointer.energy;
      const tilt = 0.78; // rad, disc leaned back
      const z0 = breathe + ripple;
      out[0] = px;
      out[1] = py * Math.cos(tilt) - z0 * Math.sin(tilt);
      out[2] = py * Math.sin(tilt) + z0 * Math.cos(tilt);
      // coherent per-ring shimmer, sharpened so grooves read as grooves
      const g = 0.5 + 0.5 * Math.sin(t * 0.8 - p.ring * 5.5);
      out[3] = (0.18 + 0.82 * g * g) * (0.75 + 0.25 * Math.sin(p.seed));
    },

    thread(p, t) {
      const u = ((p.theta / TAU) + p.ring * 0.13) % 1;        // 0..1 across
      const x = (u - 0.5) * 3.4;
      const sag = Math.pow(x / 1.7, 2) * 0.22;
      const shimmer = Math.sin(u * 40 + t * 2.2 + p.seed) * 0.02;
      out[0] = x;
      out[1] = 0.12 + sag + shimmer * p.drift;
      out[2] = Math.sin(p.seed + u * 12) * 0.05;
      out[3] = 0.25 + 0.75 * Math.pow(Math.sin(u * Math.PI), 1.5);
    },

    rings(p, t) {
      const base = 0.16 + p.ring * 0.9;
      const mod = voice(p.ring, t) * 0.05 * (0.3 + p.ring);
      const r = base + mod;
      const th = p.theta + t * 0.04;
      const tilt = 0.32;
      const px = Math.cos(th) * r;
      const py = Math.sin(th) * r;
      out[0] = px;
      out[1] = py * Math.cos(tilt);
      out[2] = py * Math.sin(tilt);
      // a pulse travels outward through the grooves, like a spoken word
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 - p.ring * 9);
      out[3] = (0.25 + 0.65 * pulse) * (0.7 + 0.3 * Math.sin(p.seed));
    },

    wave(p, t) {
      const u = ((p.theta / TAU) + p.ring * 0.31) % 1;
      const bin = Math.min(BINS - 1, Math.floor(u * BINS));
      const live = audioLive ? audioBins[bin] : 0;
      const idle = (voice(u, t) * 0.5 + 0.5) * 0.16;
      const amp = idle + live * 0.85;
      const x = (u - 0.5) * 3.2;
      const lane = (p.ring - 0.5) * 0.16;
      out[0] = x;
      out[1] = lane - amp * Math.sin(p.seed + t * 3 + u * 6) * 0.9;
      out[2] = Math.cos(p.seed) * 0.06;
      out[3] = 0.3 + 0.7 * Math.pow(Math.sin(u * Math.PI), 0.8);
    },

    arcs(p, t) {
      const g = Math.floor(p.ring * 7.999);                    // 8 chapters
      const r = 0.3 + (g / 8) * 0.95;
      const span = TAU * 0.72;
      const u = (p.theta / TAU + t * 0.012 * (g % 2 ? 1 : -1)) % 1;
      const th = -span / 2 + u * span - Math.PI / 2;
      const tilt = 0.5;
      const px = Math.cos(th) * r;
      const py = Math.sin(th) * r;
      out[0] = px;
      out[1] = py * Math.cos(tilt);
      out[2] = py * Math.sin(tilt);
      out[3] = 0.22 + 0.4 * (0.5 + 0.5 * Math.sin(p.seed + t * 0.5));
    },

    embers(p, t) {
      const speed = 0.05 + p.drift * 0.075;
      const life = ((t * speed + p.seed) % 1.6) / 1.6;         // 0..1 rising
      const x = ((p.theta / TAU) - 0.5) * 3.0 + Math.sin(life * 9 + p.seed) * 0.08;
      out[0] = x;
      out[1] = 0.9 - life * 2.0;
      out[2] = Math.cos(p.seed * 3) * 0.15;
      // sparse: most particles sit this scene out
      const active = p.ring < 0.45 ? 1 : 0.12;
      out[3] = Math.sin(life * Math.PI) * 0.7 * active;
    },
  };

  /* per-scene framing: [cx, cy, scale, world-alpha, palette 0=ink 1=warm] */
  const FRAMES = {
    desktop: {
      disc:   [0.70, 0.42, 0.80, 0.95, 0],
      thread: [0.50, 0.58, 1.05, 0.80, 1],
      rings:  [0.62, 0.55, 1.05, 0.50, 1],
      wave:   [0.55, 0.62, 1.00, 0.42, 1],
      arcs:   [0.72, 0.52, 1.15, 0.42, 1],
      embers: [0.50, 0.55, 1.10, 0.40, 0],
    },
    mobile: {
      disc:   [0.50, 0.24, 0.85, 0.65, 0],
      thread: [0.50, 0.66, 1.00, 0.75, 1],
      rings:  [0.50, 0.70, 0.95, 0.45, 1],
      wave:   [0.50, 0.72, 0.95, 0.38, 1],
      arcs:   [0.55, 0.60, 1.05, 0.35, 1],
      embers: [0.50, 0.55, 1.05, 0.35, 0],
    },
  };
  let FRAME = FRAMES.desktop;

  /* ── scroll → scene/background timeline ────────────────────────── */
  let segs = [];        // [{from, scene}]
  let bgStops = [];     // [{at, c:[r,g,b]}]
  let stageStops = [];  // [{at, name}]
  let vh = innerHeight;

  function measure() {
    vh = innerHeight;
    const secs = [...document.querySelectorAll('[data-scene]')];
    segs = secs.map(el => ({
      from: el.offsetTop - vh * 0.55,
      scene: el.dataset.scene,
    }));
    // collapse consecutive duplicates
    segs = segs.filter((s, i) => i === 0 || s.scene !== segs[i - 1].scene);
    segs[0].from = -1;

    const top = sel => document.querySelector(sel).offsetTop;
    const descent = top('.descent'), promise = top('.promise'), finale = top('.finale');
    bgStops = [
      { at: descent - vh * 0.75, c: BG.parchment },
      { at: descent - vh * 0.1,  c: BG.dark },
      { at: promise - vh * 0.4,  c: BG.dark },
      { at: promise + vh * 0.1,  c: BG.ember },
      { at: finale - vh * 0.45,  c: BG.ember },
      { at: finale + vh * 0.05,  c: BG.parchment },
    ];
    stageStops = [
      { at: -1, name: 'dawn' },
      { at: descent - vh * 0.42, name: 'night' },
      { at: promise - vh * 0.15, name: 'ember' },
      { at: finale - vh * 0.25, name: 'dawn2' },
    ];
  }

  function bgAt(s) {
    if (s <= bgStops[0].at) return bgStops[0].c;
    for (let i = 0; i < bgStops.length - 1; i++) {
      const a = bgStops[i], b = bgStops[i + 1];
      if (s >= a.at && s < b.at) {
        const u = (s - a.at) / (b.at - a.at);
        const e = u * u * (3 - 2 * u);
        return [
          a.c[0] + (b.c[0] - a.c[0]) * e,
          a.c[1] + (b.c[1] - a.c[1]) * e,
          a.c[2] + (b.c[2] - a.c[2]) * e,
        ];
      }
    }
    return bgStops[bgStops.length - 1].c;
  }

  /* ── pointer (lerped, in world coords) ─────────────────────────── */
  const pointer = { x: 0.5, y: 0.5, wx: 0, wy: 0, energy: 0 };
  addEventListener('pointermove', e => {
    pointer.x = e.clientX / W;
    pointer.y = e.clientY / H;
    pointer.energy = Math.min(1, pointer.energy + 0.15);
  }, { passive: true });

  /* ── stage machine ─────────────────────────────────────────────── */
  let currentStage = 'dawn';
  function setStage(s) {
    let name = 'dawn';
    for (const st of stageStops) if (s >= st.at) name = st.name;
    if (name !== currentStage) {
      currentStage = name;
      document.body.dataset.stage = name;
    }
  }

  /* ── render loop ───────────────────────────────────────────────── */
  let scroll = 0, smooth = 0, t = 0, last = performance.now(), booted = false, ramp = 0;

  function sceneBlend(s) {
    let i = 0;
    for (let k = 0; k < segs.length; k++) if (s >= segs[k].from) i = k;
    const cur = segs[i];
    const nxt = segs[i + 1];
    if (!nxt) return [cur.scene, cur.scene, 0];
    const zone = vh * 0.9;
    const d = nxt.from - s;
    if (d > zone) return [cur.scene, cur.scene, 0];
    const u = 1 - d / zone;
    return [cur.scene, nxt.scene, u * u * (3 - 2 * u)];
  }

  /* engraved groove underdrawing for disc/rings scenes */
  function drawGrooves(cx, cy, sc, tilt, alpha, warm, t) {
    if (alpha <= 0.01) return;
    const ink = `rgba(62,52,42,`;
    const gold = `rgba(224,178,98,`;
    ctx.lineWidth = 1;
    for (let k = 0; k < RINGS; k++) {
      const u = k / (RINGS - 1);
      const r = (0.2 + u * 0.85) * sc * (1 + Math.sin(t * 0.7 + u * 6.0) * 0.012);
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.8 - u * 5.5);
      const a = alpha * (0.10 + 0.30 * pulse * pulse);
      if (a <= 0.008) continue;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * Math.cos(tilt), 0, 0, TAU);
      if (warm < 0.999) { ctx.strokeStyle = ink + (a * (1 - warm)) + ')'; ctx.stroke(); }
      if (warm > 0.001) { ctx.strokeStyle = gold + (a * warm) + ')'; ctx.stroke(); }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    scroll = scrollY;
    smooth += (scroll - smooth) * (1 - Math.pow(0.001, dt));
    pointer.energy *= Math.pow(0.35, dt);

    setStage(scroll);
    const bg = bgAt(smooth);
    document.body.style.backgroundColor =
      `rgb(${bg[0] | 0},${bg[1] | 0},${bg[2] | 0})`;

    ctx.clearRect(0, 0, W, H);

    const [sa, sb, w] = sceneBlend(smooth);
    const fa = FRAME[sa], fb = FRAME[sb];
    const cx = (fa[0] + (fb[0] - fa[0]) * w) * W;
    const cy = (fa[1] + (fb[1] - fa[1]) * w) * H;
    const sc = (fa[2] + (fb[2] - fa[2]) * w) * R;
    if (booted) ramp = Math.min(1, ramp + dt * 0.7);
    const bootEase = 1 - Math.pow(1 - ramp, 3);
    const ga = (fa[3] + (fb[3] - fa[3]) * w) * bootEase;
    const warm = fa[4] + (fb[4] - fa[4]) * w;   // 0 ink → 1 gold

    // pointer in disc-world coords for ripple
    pointer.wx = (pointer.x * W - cx) / sc;
    pointer.wy = (pointer.y * H - cy) / sc * 2.2;

    // engraved grooves under the particles (disc + rings scenes only)
    const gw = { disc: 0, rings: 0 };
    if (sa in gw) gw[sa] += (1 - w);
    if (sb in gw) gw[sb] += w;
    if (gw.disc > 0)  drawGrooves(cx, cy, sc, 0.78, gw.disc * ga, warm, t);
    if (gw.rings > 0) drawGrooves(cx, cy, sc, 0.32, gw.rings * ga * 0.8, warm, t);

    // subtle global parallax
    const rotY = (pointer.x - 0.5) * 0.22;
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const f = 3.4;

    const A = scenes[sa], B = scenes[sb];
    const blending = w > 0.001 && sa !== sb;

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      A(p, t);
      let x = out[0], y = out[1], z = out[2], al = out[3];
      if (blending) {
        const x0 = x, y0 = y, z0 = z, a0 = al;
        B(p, t);
        x = x0 + (out[0] - x0) * w;
        y = y0 + (out[1] - y0) * w;
        z = z0 + (out[2] - z0) * w;
        al = a0 + (out[3] - a0) * w;
      }
      // yaw parallax + perspective
      const xr = x * cosY + z * sinY;
      const zr = -x * sinY + z * cosY;
      const per = f / (f + zr);
      const px = cx + xr * sc * per;
      const py = cy + y * sc * per;
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;

      const sz = p.size * per * 3.1;
      const alpha = al * ga * per;
      if (alpha <= 0.01) continue;

      if (warm < 0.999) {
        ctx.globalAlpha = alpha * (1 - warm);
        ctx.drawImage(SPRITES.ink, px - sz, py - sz, sz * 2, sz * 2);
      }
      if (warm > 0.001) {
        ctx.globalAlpha = alpha * warm;
        ctx.drawImage(SPRITES[p.v], px - sz, py - sz, sz * 2, sz * 2);
      }
    }
    ctx.globalAlpha = 1;

    if (!reduceMotion) requestAnimationFrame(frame);
  }

  /* ── resize ────────────────────────────────────────────────────── */
  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    R = Math.min(W, H) * 0.42;
    FRAME = W < 700 ? FRAMES.mobile : FRAMES.desktop;
    buildParticles();
    measure();
  }
  addEventListener('resize', resize, { passive: true });

  /* ── reveals ───────────────────────────────────────────────────── */
  function initReveals() {
    const els = [...document.querySelectorAll('.reveal')];
    // stagger within each parent section
    const byParent = new Map();
    for (const el of els) {
      const key = el.closest('section, blockquote, footer') || document.body;
      if (!byParent.has(key)) byParent.set(key, 0);
      const n = byParent.get(key);
      el.style.setProperty('--d', (n * 0.09) + 's');
      byParent.set(key, n + 1);
    }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
  }

  /* ── the listening room ────────────────────────────────────────── */
  function initPlayer() {
    const audio = document.getElementById('answerAudio');
    const btn = document.getElementById('playBtn');
    const playerEl = document.getElementById('player');
    const waveC = document.getElementById('waveCanvas');
    const wctx = waveC.getContext('2d');
    const timeNow = document.getElementById('timeNow');
    const timeEnd = document.getElementById('timeEnd');
    const transcriptEl = document.getElementById('transcript');
    const ringEl = document.getElementById('ringProgress');

    const TEXT = 'I was born in the winter of 1946, in my grandmother’s ' +
      'farmhouse, in the same room where my own mother was born. We didn’t ' +
      'have much in those days. But I remember the kitchen was always warm, ' +
      'and my father whistled while he worked. That is the first sound I ever loved.';
    const words = TEXT.split(' ').map(wd => {
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = wd + ' ';
      transcriptEl.appendChild(s);
      return s;
    });

    let actx = null, analyser = null, fdata = null;

    function fmt(s) {
      s = Math.max(0, Math.floor(s));
      return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`;
    }

    function sizeWave() {
      const r = waveC.getBoundingClientRect();
      waveC.width = r.width * DPR;
      waveC.height = r.height * DPR;
      wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    sizeWave();
    addEventListener('resize', sizeWave, { passive: true });

    function drawWave() {
      const rW = waveC.getBoundingClientRect().width;
      const rH = waveC.getBoundingClientRect().height;
      wctx.clearRect(0, 0, rW, rH);
      const n = BINS;
      const bw = rW / n;
      const progress = audio.duration ? audio.currentTime / audio.duration : 0;
      for (let i = 0; i < n; i++) {
        const lv = audioLive ? audioBins[i]
          : reduceMotion ? 0.08
          : 0.06 + 0.05 * Math.sin(i * 0.7 + performance.now() / 900);
        const h = Math.max(2, lv * rH * 0.92);
        const x = i * bw + bw * 0.25;
        const played = (i / n) < progress;
        wctx.fillStyle = played ? 'rgba(224,178,98,0.95)' : 'rgba(233,223,201,0.28)';
        wctx.fillRect(x, (rH - h) / 2, bw * 0.5, h);
      }
      timeNow.textContent = fmt(audio.currentTime);
      if (audio.duration) timeEnd.textContent = fmt(audio.duration);
      ringEl.style.strokeDashoffset = 100 - progress * 100;
      const lit = audio.duration
        ? Math.floor((audio.currentTime / audio.duration) * words.length * 1.04)
        : 0;
      for (let i = 0; i < words.length; i++)
        words[i].classList.toggle('lit', i < lit);
    }

    let waveRaf = 0;
    function waveLoop() {
      if (analyser) {
        analyser.getByteFrequencyData(fdata);
        // compress 128 bins → BINS with a gentle log curve
        for (let i = 0; i < BINS; i++) {
          const j = Math.floor(Math.pow(i / BINS, 1.4) * (fdata.length * 0.72));
          audioBins[i] = audioBins[i] * 0.6 + (fdata[j] / 255) * 0.4;
        }
      }
      drawWave();
      waveRaf = requestAnimationFrame(waveLoop);
    }
    waveLoop(); // idle shimmer even before play

    btn.addEventListener('click', async () => {
      if (audio.paused) {
        if (!actx) {
          try {
            actx = new (window.AudioContext || window.webkitAudioContext)();
            const src = actx.createMediaElementSource(audio);
            analyser = actx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.82;
            fdata = new Uint8Array(analyser.frequencyBinCount);
            src.connect(analyser);
            analyser.connect(actx.destination);
          } catch (e) { /* play without visualization */ }
        }
        if (actx && actx.state === 'suspended') await actx.resume();
        await audio.play();
        audioLive = true;
        playerEl.classList.add('playing');
        btn.setAttribute('aria-label', 'Pause Henry’s answer');
      } else {
        audio.pause();
      }
    });
    const stop = () => {
      audioLive = false;
      playerEl.classList.remove('playing');
      btn.setAttribute('aria-label', 'Play Henry’s answer');
      audioBins.fill(0);
    };
    audio.addEventListener('pause', stop);
    audio.addEventListener('ended', () => {
      stop();
      setTimeout(() => words.forEach(w => w.classList.remove('lit')), 1800);
    });
  }

  /* ── living portrait: load video only when near, honor motion ──── */
  function initPortrait() {
    const v = document.getElementById('portraitVideo');
    if (!v) return;
    if (reduceMotion) return; // poster only
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          if (!v.src) {
            v.src = '/assets/img/portrait-live.mp4';
            v.play().catch(() => {});
          } else {
            v.play().catch(() => {});
          }
        } else if (v.src) v.pause();
      }
    }, { rootMargin: '35% 0px' });
    io.observe(v);
  }

  /* ── boot ──────────────────────────────────────────────────────── */
  function boot() {
    resize();
    initReveals();
    initPlayer();
    initPortrait();
    last = performance.now();
    if (reduceMotion) {
      booted = true;
      frame(performance.now());        // single static frame
      // keep bg/stage correct while scrolling, without animation
      addEventListener('scroll', () => {
        smooth = scrollY;
        frame(performance.now());
      }, { passive: true });
    } else {
      requestAnimationFrame(now => {
        booted = true;
        frame(now);
      });
    }
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
