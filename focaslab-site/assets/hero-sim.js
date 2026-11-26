/* Home hero background: a small multi-robot simulation, drawn like the plots
   the lab produces. Robots visit goal regions A, B, C in turn; a safety filter
   (a control-barrier-function projection of each robot's desired velocity)
   keeps every robot clear of obstacles, walls and the other robots. Robot 1
   also carries its spatiotemporal tube, which never reaches into an obstacle.
   The simulation runs only while visible and draws one still frame for
   visitors who prefer reduced motion. */
(() => {
  const cv = document.getElementById('sim');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = n => getComputedStyle(cv).getPropertyValue(n).trim();

  const R = 0.2;          // robot radius [m]
  const MARGIN = 0.14;    // clearance the safety filter keeps [m]
  const VMAX = 0.85;      // speed limit [m/s]
  const ALPHA = 2.5;      // barrier-function gain
  const DT = 1 / 60;

  // layout in fractions of the workspace, so it adapts to any screen size
  const OBST = [[.57, .64, .62], [.73, .30, .78], [.89, .70, .55], [.98, .16, .45], [.40, .14, .42], [.82, .92, .4]];
  const GOALS = [['A', .50, .30, '--c3'], ['B', .86, .44, '--c2'], ['C', .68, .84, '--c5']];
  const COLS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c1'];

  let W = 0, H = 0, ppm = 60, WX = 16, WY = 9, obs = [], goals = [], bots = [], t = 0, frame = 0;
  const stat = { pair: Infinity, h: Infinity };

  const free = (x, y, pad) => obs.every(o => Math.hypot(x - o.x, y - o.y) > o.r + R + pad) && x > R + .3 && x < WX - R - .3 && y > R + .3 && y < WY - R - .3;

  function build() {
    const n = W < 720 ? 3 : 7, nObs = W < 720 ? 3 : OBST.length;
    obs = OBST.slice(0, nObs).map(([fx, fy, r]) => ({ x: fx * WX, y: fy * WY, r }));
    goals = GOALS.map(([name, fx, fy, col]) => ({ name, x: fx * WX, y: fy * WY, col }));
    bots = [];
    let tries = 0;
    while (bots.length < n && tries++ < 4000) {
      const x = WX * (.45 + .53 * Math.random()), y = WY * (.08 + .84 * Math.random());
      if (free(x, y, MARGIN + .1) && bots.every(b => Math.hypot(b.x - x, b.y - y) > 2 * R + MARGIN + .2))
        bots.push({ x, y, vx: 0, vy: 0, g: bots.length % goals.length, slow: 0, col: COLS[bots.length], trail: [] });
    }
  }

  function size() {
    const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return;
    const first = !W;
    W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    ppm = Math.max(36, Math.min(68, H / 9.5)); WX = W / ppm; WY = H / ppm;
    build(); if (first) for (let k = 0; k < 240; k++) step(); // start mid-motion, not frozen in place
  }

  /* one safety-filtered control step for every robot */
  function step() {
    const vs = bots.map((b, i) => {
      const g = goals[b.g], ex = g.x - b.x, ey = g.y - b.y, dg = Math.hypot(ex, ey) || 1e-6;
      const sp = Math.min(VMAX, .9 * dg);
      let vx = ex / dg * sp, vy = ey / dg * sp;
      const cons = [];   // constraints  n·v ≥ b
      obs.forEach(o => {
        const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy), h = d - (o.r + R + MARGIN);
        if (h > 2) return;
        const nx = dx / d, ny = dy / d;
        cons.push([nx, ny, -ALPHA * h]);
        if (h < 1) { // slide around the obstacle instead of stopping in front of it
          let px = -ny, py = nx; if (px * ex + py * ey < 0) { px = -px; py = -py; }
          const k = .5 * VMAX * (1 - h);
          vx += px * k; vy += py * k;
        }
      });
      bots.forEach((c, j) => {
        if (i === j) return;
        const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy) || 1e-6, h = d - (2 * R + MARGIN);
        if (h < 2) cons.push([dx / d, dy / d, -ALPHA * h / 2]); // each robot takes half of the pair constraint
      });
      const wall = R + .1;
      cons.push([1, 0, -ALPHA * (b.x - wall)], [-1, 0, -ALPHA * (WX - wall - b.x)], [0, 1, -ALPHA * (b.y - wall)], [0, -1, -ALPHA * (WY - wall - b.y)]);
      const s0 = Math.hypot(vx, vy); if (s0 > VMAX) { vx *= VMAX / s0; vy *= VMAX / s0; }
      for (let it = 0; it < 8; it++) cons.forEach(([nx, ny, lb]) => { const s = nx * vx + ny * vy - lb; if (s < 0) { vx -= s * nx; vy -= s * ny; } });
      return [vx, vy];
    });
    stat.pair = Infinity; stat.h = Infinity;
    bots.forEach((b, i) => {
      [b.vx, b.vy] = vs[i]; b.x += b.vx * DT; b.y += b.vy * DT;
      // numerical guard: never let a body overlap an obstacle
      obs.forEach(o => {
        const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy), min = o.r + R + .02;
        if (d < min) { b.x = o.x + dx / d * min; b.y = o.y + dy / d * min; }
        stat.h = Math.min(stat.h, d - o.r - R);
      });
      const g = goals[b.g], dg = Math.hypot(g.x - b.x, g.y - b.y);
      b.slow = Math.hypot(b.vx, b.vy) < .05 ? b.slow + DT : 0;
      if (dg < .4 || b.slow > 2.5) { b.g = (b.g + 1) % goals.length; b.slow = 0; }
    });
    for (let i = 0; i < bots.length; i++) for (let j = i + 1; j < bots.length; j++) {
      const a = bots[i], c = bots[j], dx = a.x - c.x, dy = a.y - c.y, d = Math.hypot(dx, dy) || 1e-6;
      if (d < 2 * R + .02) { const p = (2 * R + .02 - d) / 2; a.x += dx / d * p; a.y += dy / d * p; c.x -= dx / d * p; c.y -= dy / d * p; }
      stat.pair = Math.min(stat.pair, d);
    }
    t += DT;
    if (++frame % 3 === 0) bots.forEach(b => { b.trail.push([b.x, b.y]); if (b.trail.length > 90) b.trail.shift(); });
  }

  const X = x => x * ppm, Y = y => H - y * ppm;
  const hatch = col => {
    const p = document.createElement('canvas'); p.width = p.height = 8;
    const x = p.getContext('2d'); x.strokeStyle = col; x.lineWidth = 1; x.globalAlpha = .5;
    x.beginPath(); x.moveTo(0, 8); x.lineTo(8, 0); x.moveTo(-2, 2); x.lineTo(2, -2); x.moveTo(6, 10); x.lineTo(10, 6); x.stroke();
    return ctx.createPattern(p, 'repeat');
  };

  function draw() {
    const ink = css('--sim-ink'), grid = css('--sim-grid'), muted = css('--sim-muted'), paper = css('--sim-paper');
    ctx.clearRect(0, 0, W, H);
    // metric grid with axis ticks, like a plot
    ctx.lineWidth = 1; ctx.strokeStyle = grid; ctx.beginPath();
    for (let x = 1; x < WX; x++) { ctx.moveTo(Math.round(X(x)) + .5, 0); ctx.lineTo(Math.round(X(x)) + .5, H); }
    for (let y = 1; y < WY; y++) { ctx.moveTo(0, Math.round(Y(y)) + .5); ctx.lineTo(W, Math.round(Y(y)) + .5); }
    ctx.stroke();
    ctx.font = '500 10px "Geist Mono", ui-monospace, monospace'; ctx.fillStyle = muted; ctx.textAlign = 'center';
    for (let x = 2; x < WX - .5; x += 2) ctx.fillText(String(x), X(x), H - 8);
    ctx.textAlign = 'right'; for (let y = 2; y < WY - .5; y += 2) ctx.fillText(String(y), W - 8, Y(y) + 3);
    ctx.fillText('x [m]', W - 8, H - 8);
    // goal regions
    goals.forEach(g => {
      const s = .55 * ppm, col = css(g.col);
      ctx.fillStyle = col; ctx.globalAlpha = .1; ctx.fillRect(X(g.x) - s, Y(g.y) - s, 2 * s, 2 * s);
      ctx.globalAlpha = .8; ctx.strokeStyle = col; ctx.setLineDash([5, 4]); ctx.strokeRect(X(g.x) - s + .5, Y(g.y) - s + .5, 2 * s, 2 * s); ctx.setLineDash([]);
      ctx.globalAlpha = 1; ctx.font = 'italic 17px "STIX Two Text", "Cambria Math", serif'; ctx.fillStyle = col; ctx.textAlign = 'left';
      ctx.fillText(g.name, X(g.x) + s + 6, Y(g.y) - s + 14);
    });
    // obstacles
    const pat = hatch(ink);
    obs.forEach((o, i) => {
      ctx.beginPath(); ctx.arc(X(o.x), Y(o.y), o.r * ppm, 0, 7); ctx.fillStyle = paper; ctx.fill();
      ctx.fillStyle = pat; ctx.fill(); ctx.strokeStyle = ink; ctx.globalAlpha = .55; ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.font = 'italic 14px "STIX Two Text", "Cambria Math", serif'; ctx.fillStyle = muted; ctx.textAlign = 'center';
      ctx.fillText('O' + String.fromCharCode(8321 + i), X(o.x), Y(o.y + o.r) - 7);
    });
    // robot 1's spatiotemporal tube: shrinks towards its goal, never reaches into an obstacle
    const b0 = bots[0];
    if (b0) {
      const g = goals[b0.g], clear = Math.min(...obs.map(o => Math.hypot(b0.x - o.x, b0.y - o.y) - o.r - .05));
      const rho = Math.max(R + .05, Math.min(.35 + .12 * Math.hypot(g.x - b0.x, g.y - b0.y), 1.1, clear));
      ctx.beginPath(); ctx.arc(X(b0.x), Y(b0.y), rho * ppm, 0, 7);
      ctx.fillStyle = css(b0.col); ctx.globalAlpha = .1; ctx.fill(); ctx.globalAlpha = .55; ctx.strokeStyle = css(b0.col); ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.font = 'italic 15px "STIX Two Text", "Cambria Math", serif'; ctx.fillStyle = css(b0.col); ctx.textAlign = 'left';
      ctx.fillText('Γ(t)', X(b0.x) + rho * ppm * .72 + 4, Y(b0.y) - rho * ppm * .72 - 2);
    }
    // trails and robots
    bots.forEach(b => {
      const col = css(b.col);
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      for (let k = 1; k < b.trail.length; k++) {
        ctx.globalAlpha = .5 * k / b.trail.length; ctx.beginPath();
        ctx.moveTo(X(b.trail[k - 1][0]), Y(b.trail[k - 1][1])); ctx.lineTo(X(b.trail[k][0]), Y(b.trail[k][1])); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const px = X(b.x), py = Y(b.y), sp = Math.hypot(b.vx, b.vy), hx = sp > .02 ? b.vx / sp : 1, hy = sp > .02 ? b.vy / sp : 0;
      ctx.beginPath(); ctx.arc(px, py, R * ppm, 0, 7); ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = paper; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + hx * R * ppm * .85, py - hy * R * ppm * .85); ctx.stroke();
    });
    // read-out, as a simulation tool would print it (skipped on phones, where it would sit behind the text)
    if (W < 720) return;
    const lines = [`t = ${t.toFixed(2)} s`, `robots ${bots.length} · obstacles ${obs.length}`, `min ‖pᵢ − pⱼ‖ = ${(isFinite(stat.pair) ? stat.pair : 0).toFixed(2)} m`, `min clearance = ${Math.max(0, stat.h).toFixed(2)} m`, 'φ = □ safe ∧ □◇A ∧ □◇B ∧ □◇C'];
    ctx.font = '500 11px "Geist Mono", ui-monospace, monospace'; ctx.textAlign = 'left';
    const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 24, bx = W - bw - 22, by = 22;
    ctx.fillStyle = paper; ctx.globalAlpha = .86; ctx.beginPath(); ctx.roundRect(bx, by, bw, lines.length * 17 + 16, 8); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = muted; lines.forEach((l, i) => ctx.fillText(l, bx + 12, by + 22 + i * 17));
  }

  let on = true, queued = false;
  const loop = () => { queued = false; if (!on || document.hidden) return; step(); draw(); if (!reduce) { queued = true; requestAnimationFrame(loop); } };
  const kick = () => { if (!queued) { queued = true; requestAnimationFrame(loop); } };
  new IntersectionObserver(es => { on = es[0].isIntersecting; if (on) kick(); }).observe(cv);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(() => { size(); draw(); }).observe(cv);
  new MutationObserver(() => draw()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  cv._sim = { step, stat, bots: () => bots, obs: () => obs }; // inspection handle for checks in the browser console
})();
