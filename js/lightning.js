/**
 * Lightning + Clouds + Smoke Background
 * Pure vanilla JS canvas — no dependencies
 */
(function () {
  const canvas = document.getElementById('lightning-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, animId;

  const CFG = {
    hue: 220,
    bolts: 3,
    boltSpeed: 0.6,
    glowLayers: 4,
    cloudCount: 14,
    smokeCount: 55,
  };

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  window.addEventListener('resize', () => { resize(); initParticles(); });
  resize();

  /* ─── Lightning ─────────────────────────────────────── */
  function createBolt(x1, y1, x2, y2, roughness, depth) {
    if (depth === 0) return [[x1, y1], [x2, y2]];
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * roughness;
    const my = (y1 + y2) / 2 + (Math.random() - 0.5) * roughness * 0.4;
    return [
      ...createBolt(x1, y1, mx, my, roughness / 2, depth - 1),
      ...createBolt(mx, my, x2, y2, roughness / 2, depth - 1).slice(1),
    ];
  }

  class Bolt {
    constructor() { this.reset(); }
    reset() {
      this.x1 = W * (0.15 + Math.random() * 0.7);
      this.y1 = H * 0.05;
      this.x2 = this.x1 + (Math.random() - 0.5) * W * 0.35;
      this.y2 = H * (0.35 + Math.random() * 0.4);
      this.life = 0;
      this.maxLife = 18 + Math.random() * 22;
      this.delay = Math.random() * 130;
      this.points = createBolt(this.x1, this.y1, this.x2, this.y2, W * 0.11, 7);
      this.branch = null;
      if (Math.random() > 0.38) {
        const bi = Math.floor(this.points.length * (0.3 + Math.random() * 0.4));
        const bp = this.points[bi];
        const bx2 = bp[0] + (Math.random() - 0.5) * W * 0.22;
        const by2 = bp[1] + H * (0.12 + Math.random() * 0.18);
        this.branch = { points: createBolt(bp[0], bp[1], bx2, by2, W * 0.06, 6) };
      }
    }
    alpha() {
      const t = this.life / this.maxLife;
      if (t < 0.15) return (t / 0.15) * 0.9;
      return (1 - (t - 0.15) / 0.85) * 0.9;
    }
    draw() {
      if (this.delay > 0) { this.delay -= CFG.boltSpeed; return; }
      this.life += CFG.boltSpeed;
      if (this.life > this.maxLife) { this.reset(); return; }
      const a = this.alpha();
      drawBoltPath(this.points, a, 1.5);
      if (this.branch) drawBoltPath(this.branch.points, a * 0.55, 0.8);
    }
  }

  function drawBoltPath(points, alpha, lw) {
    for (let g = CFG.glowLayers; g >= 0; g--) {
      const spread = g === 0 ? lw : lw + g * 7;
      const la = g === 0 ? alpha : alpha * 0.07;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.strokeStyle = g === 0
        ? `hsla(${CFG.hue}, 90%, 88%, ${la})`
        : `hsla(${CFG.hue}, 75%, 65%, ${la})`;
      ctx.lineWidth = spread;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  const bolts = Array.from({ length: CFG.bolts }, () => new Bolt());

  /* ─── Cloud particles ────────────────────────────────── */
  class Cloud {
    constructor(init) { this.reset(init); }
    reset(init) {
      // Spread across full width, cluster in upper 55% of canvas
      this.x = init ? Math.random() * W : -220;
      this.y = H * (0.02 + Math.random() * 0.53);
      this.w = 160 + Math.random() * 260;   // width of the cloud blob
      this.h = this.w * (0.28 + Math.random() * 0.22);
      this.speed = 0.12 + Math.random() * 0.22;
      // Dark stormy cloud colours — very subtle
      const lightness = 12 + Math.random() * 14;
      const alpha = 0.28 + Math.random() * 0.32;
      this.color = `rgba(${lightness + 8}, ${lightness + 10}, ${lightness + 22}, ${alpha})`;
      this.puffs = this._buildPuffs();
    }
    _buildPuffs() {
      // A cloud is 5-9 overlapping circles
      const count = 5 + Math.floor(Math.random() * 5);
      const puffs = [];
      for (let i = 0; i < count; i++) {
        puffs.push({
          ox: (Math.random() - 0.3) * this.w * 0.9,
          oy: (Math.random() - 0.5) * this.h * 0.7,
          r: this.h * (0.45 + Math.random() * 0.65),
        });
      }
      return puffs;
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      for (const p of this.puffs) {
        const grad = ctx.createRadialGradient(p.ox, p.oy, 0, p.ox, p.oy, p.r);
        grad.addColorStop(0, this.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(p.ox, p.oy, p.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();
      this.x += this.speed;
      if (this.x > W + 250) this.reset(false);
    }
  }

  /* ─── Smoke / mist particles ─────────────────────────── */
  class Smoke {
    constructor(init) { this.reset(init); }
    reset(init) {
      this.x = Math.random() * W;
      // spread across full canvas height, not just bottom
      this.y = init ? Math.random() * H : H * (0.4 + Math.random() * 0.6);
      this.r = 120 + Math.random() * 220;
      this.vx = (Math.random() - 0.5) * 0.2;
      this.vy = -(0.08 + Math.random() * 0.15);
      this.alpha = 0.0;
      // bright enough to show on dark bg — blue-white fog
      this.targetAlpha = 0.32 + Math.random() * 0.28;
      this.life = 0;
      this.maxLife = 300 + Math.random() * 250;
      this.hue = 200 + Math.random() * 40;
      this.lightness = 45 + Math.random() * 25; // light blue-grey, visible on dark
    }
    draw() {
      this.life++;
      if (this.life > this.maxLife) { this.reset(false); return; }

      const t = this.life / this.maxLife;
      if (t < 0.2) this.alpha = (t / 0.2) * this.targetAlpha;
      else if (t > 0.6) this.alpha = ((1 - t) / 0.4) * this.targetAlpha;
      else this.alpha = this.targetAlpha;

      this.x += this.vx;
      this.y += this.vy;
      this.r += 0.3;

      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
      grad.addColorStop(0,   `hsla(${this.hue}, 40%, ${this.lightness}%, ${this.alpha})`);
      grad.addColorStop(0.4, `hsla(${this.hue}, 35%, ${this.lightness - 8}%, ${this.alpha * 0.6})`);
      grad.addColorStop(1,   `hsla(${this.hue}, 20%, 15%, 0)`);

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  /* ─── Static fog base layer ──────────────────────────── */
  // Drawn once per frame as a persistent ground fog
  function drawFogLayer() {
    // Bottom fog bank
    const fogH = H * 0.45;
    const grad = ctx.createLinearGradient(0, H - fogH, 0, H);
    grad.addColorStop(0,   'rgba(30, 50, 90, 0)');
    grad.addColorStop(0.4, 'rgba(30, 50, 90, 0.18)');
    grad.addColorStop(0.75,'rgba(40, 60, 100, 0.32)');
    grad.addColorStop(1,   'rgba(50, 70, 110, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - fogH, W, fogH);

    // Mid-screen horizontal fog wisps
    for (let i = 0; i < 3; i++) {
      const y = H * (0.35 + i * 0.15);
      const wispGrad = ctx.createLinearGradient(0, y - 30, 0, y + 30);
      wispGrad.addColorStop(0,   'rgba(60, 90, 140, 0)');
      wispGrad.addColorStop(0.5, `rgba(60, 90, 140, ${0.08 + i * 0.04})`);
      wispGrad.addColorStop(1,   'rgba(60, 90, 140, 0)');
      ctx.fillStyle = wispGrad;
      ctx.fillRect(0, y - 30, W, 60);
    }
  }

  let clouds = [];
  let smoke = [];

  function initParticles() {
    clouds = Array.from({ length: CFG.cloudCount }, () => new Cloud(true));
    smoke  = Array.from({ length: CFG.smokeCount },  () => new Smoke(true));
  }
  initParticles();

  /* ─── Render loop ────────────────────────────────────── */
  function tick() {
    ctx.clearRect(0, 0, W, H);

    // 0. Persistent fog base layer
    drawFogLayer();

    // 1. Smoke / mist particles
    smoke.forEach(s => s.draw());

    // 2. Clouds (mid layer)
    clouds.forEach(c => c.draw());

    // 3. Lightning (top layer)
    bolts.forEach(b => b.draw());

    animId = requestAnimationFrame(tick);
  }

  tick();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(animId);
    else tick();
  });
})();
