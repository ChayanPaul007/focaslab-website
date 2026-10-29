// Spatiotemporal tube hero: a funnel Γ(t) that avoids unsafe sets U_i and reaches target T at t = T_c.
(function () {
  const cv = document.getElementById('tube');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = 10, R0 = 0.62, Rinf = 0.1, LAM = 0.42, N = 240;
  const rho = t => Rinf + (R0 - Rinf) * Math.exp(-LAM * t);
  let W = 0, H = 0, dpr = 1, scene = null, t0 = performance.now(), mouse = null;

  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rnd = (a, b) => a + Math.random() * (b - a);

  function spline(pts, t) { // Catmull-Rom in t on sorted points
    let i = 0; while (i < pts.length - 2 && pts[i + 1][0] < t) i++;
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    const u = (t - p1[0]) / ((p2[0] - p1[0]) || 1), u2 = u * u, u3 = u2 * u;
    return 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
  }

  function make() {
    for (let k = 0; k < 120; k++) {
      const n = 2 + (Math.random() < 0.5 ? 1 : 0), obs = [];
      const slots = [[1.6, 3.6], [4.2, 6.2], [6.8, 8.4]].slice(0, n);
      slots.forEach(([a, b]) => { const w = rnd(0.7, 1.3), ts = rnd(a, b - w * 0.5), h = rnd(0.35, 0.7); obs.push({ t0: ts, t1: ts + w, x0: rnd(-0.85, 0.85 - h), h }); });
      const pts = [[0, rnd(-0.25, 0.25)]];
      obs.forEach(o => {
        const tm = (o.t0 + o.t1) / 2, r = rho(o.t0) + 0.08, top = o.x0 + o.h;
        const upX = top + r, dnX = o.x0 - r, up = upX < 0.92 - r * 0.2, dn = dnX > -0.92 + r * 0.2;
        if (!up && !dn) return;
        const x = up && dn ? (Math.abs(upX) < Math.abs(dnX) ? upX : dnX) : up ? upX : dnX;
        pts.push([o.t0 - 0.25, x], [tm, x], [o.t1 + 0.25, x]);
      });
      const xT = rnd(-0.35, 0.35); pts.push([T - 0.6, xT], [T, xT]);
      pts.sort((a, b) => a[0] - b[0]);
      if (pts.some((p, i) => i && p[0] - pts[i - 1][0] < 0.15)) continue;
      const c = [], ok = (() => {
        for (let i = 0; i <= N; i++) {
          const t = i / N * T, x = spline(pts, t), r = rho(t); c.push(x);
          if (x + r > 1.02 || x - r < -1.02) return false;
          for (const o of obs) if (t >= o.t0 - 0.05 && t <= o.t1 + 0.05 && x + r > o.x0 - 0.02 && x - r < o.x0 + o.h + 0.02) return false;
        }
        return true;
      })();
      if (!ok) continue;
      const ph = rnd(0, 6), e0 = rnd(0.55, 0.85) * (Math.random() < .5 ? -1 : 1), om = rnd(1.6, 2.6);
      const traj = c.map((x, i) => { const t = i / N * T; return x + rho(t) * (e0 * Math.exp(-0.35 * t) * Math.cos(om * t + ph) * 0.95); });
      return { obs, c, traj, xT };
    }
    const c = Array.from({ length: N + 1 }, () => 0);
    return { obs: [], c, traj: c.map((_, i) => rho(i / N * T) * 0.5 * Math.cos(i / 20)), xT: 0 };
  }

  function size() {
    const r = cv.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const PX = () => ({ l: 8, r: W - 8, t: 22, b: H - 40 });
  const X = t => { const p = PX(); return p.l + (t / T) * (p.r - p.l); };
  const Y = x => { const p = PX(); return p.t + (1 - (x + 1) / 2) * (p.b - p.t); };

  function hatch(x, y, w, h, col) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = col; ctx.globalAlpha = .45; ctx.lineWidth = 1;
    for (let s = -h; s < w; s += 7) { ctx.beginPath(); ctx.moveTo(x + s, y + h); ctx.lineTo(x + s + h, y); ctx.stroke(); }
    ctx.restore();
  }

  function draw(now) {
    if (!scene) scene = make();
    const ink = css('--ink'), muted = css('--muted'), line = css('--line'), acc = css('--accent'), safe = css('--safe');
    const dur = 7500, hold = 2600, el = reduce ? 1e9 : now - t0;
    let p = Math.min(el / dur, 1), fade = 1;
    if (el > dur + hold) { const f = (el - dur - hold) / 600; fade = Math.max(0, 1 - f); if (f >= 1) { scene = make(); t0 = now; } }
    ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1;
    const P = PX();
    // grid
    ctx.strokeStyle = line; ctx.lineWidth = 1;
    for (let k = 0; k <= 10; k++) { const x = X(k); ctx.beginPath(); ctx.moveTo(x, P.b); ctx.lineTo(x, P.b + 5); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(P.l, P.b + .5); ctx.lineTo(P.r, P.b + .5); ctx.stroke();
    ctx.font = '11px "JetBrains Mono", monospace'; ctx.fillStyle = muted;
    ctx.fillText('t →', P.r - 26, P.b + 20);
    ctx.globalAlpha = fade;
    // obstacles
    scene.obs.forEach((o, i) => {
      const x = X(o.t0), y = Y(o.x0 + o.h), w = X(o.t1) - x, h = Y(o.x0) - y;
      hatch(x, y, w, h, ink); ctx.strokeStyle = ink; ctx.globalAlpha = .7 * fade; ctx.strokeRect(x + .5, y + .5, w, h);
      ctx.globalAlpha = fade; ctx.fillStyle = ink; ctx.fillText('U' + String.fromCharCode(8321 + i), x + 6, y - 6);
    });
    // target
    const tx = X(T - 0.45), tw = X(T) - tx, ty = Y(scene.xT + Rinf * 2.2), th = Y(scene.xT - Rinf * 2.2) - ty;
    ctx.fillStyle = safe; ctx.globalAlpha = .16 * fade; ctx.fillRect(tx, ty, tw, th);
    ctx.globalAlpha = fade; ctx.strokeStyle = safe; ctx.setLineDash([4, 3]); ctx.strokeRect(tx + .5, ty + .5, tw - 1, th); ctx.setLineDash([]);
    ctx.fillStyle = safe; ctx.fillText('T', tx - 12, ty + 10);
    // tube (planned, faint) + revealed
    const upto = Math.floor(p * N);
    const band = (n, alpha) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { const t = i / N * T; ctx.lineTo(X(t), Y(scene.c[i] + rho(t))); }
      for (let i = n; i >= 0; i--) { const t = i / N * T; ctx.lineTo(X(t), Y(scene.c[i] - rho(t))); }
      ctx.closePath(); ctx.fillStyle = acc; ctx.globalAlpha = alpha * fade; ctx.fill();
    };
    band(N, .05); band(upto, .14);
    ctx.globalAlpha = fade; ctx.strokeStyle = acc; ctx.lineWidth = 1.4;
    [1, -1].forEach(s => { ctx.beginPath(); for (let i = 0; i <= upto; i++) { const t = i / N * T; ctx.lineTo(X(t), Y(scene.c[i] + s * rho(t))); } ctx.stroke(); });
    ctx.globalAlpha = .35 * fade; ctx.setLineDash([2, 4]);
    [1, -1].forEach(s => { ctx.beginPath(); for (let i = upto; i <= N; i++) { const t = i / N * T; ctx.lineTo(X(t), Y(scene.c[i] + s * rho(t))); } ctx.stroke(); });
    ctx.setLineDash([]);
    // trajectory
    ctx.globalAlpha = fade; ctx.strokeStyle = ink; ctx.lineWidth = 1.8; ctx.beginPath();
    for (let i = 0; i <= upto; i++) ctx.lineTo(X(i / N * T), Y(scene.traj[i])); ctx.stroke();
    const hx = X(upto / N * T), hy = Y(scene.traj[upto]);
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, 7); ctx.fill();
    ctx.strokeStyle = ink; ctx.globalAlpha = .25 * fade; ctx.beginPath(); ctx.arc(hx, hy, 9 + 3 * Math.sin(now / 200), 0, 7); ctx.stroke();
    ctx.globalAlpha = fade; ctx.fillStyle = acc; ctx.fillText('Γ(t)', X(0.15), Y(scene.c[6] + rho(0.25)) - 8);
    // cursor readout
    if (mouse && mouse.x > P.l && mouse.x < P.r) {
      const t = (mouse.x - P.l) / (P.r - P.l) * T, i = Math.round(t / T * N);
      ctx.globalAlpha = 1; ctx.strokeStyle = muted; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(mouse.x + .5, P.t); ctx.lineTo(mouse.x + .5, P.b); ctx.stroke(); ctx.setLineDash([]);
      [1, -1].forEach(s => { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(mouse.x, Y(scene.c[i] + s * rho(t)), 3, 0, 7); ctx.fill(); });
      const txt = `t=${t.toFixed(2)}  ρ(t)=${rho(t).toFixed(3)}`, tw2 = ctx.measureText(txt).width;
      const bx = Math.min(mouse.x + 10, P.r - tw2 - 14);
      ctx.fillStyle = css('--paper'); ctx.fillRect(bx, P.t - 4, tw2 + 12, 20);
      ctx.fillStyle = ink; ctx.fillText(txt, bx + 6, P.t + 10);
    }
    ctx.globalAlpha = 1;
    if (!reduce || mouse) requestAnimationFrame(draw);
  }

  new ResizeObserver(() => { size(); if (reduce) requestAnimationFrame(draw); }).observe(cv);
  cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; if (reduce) requestAnimationFrame(draw); });
  cv.addEventListener('pointerleave', () => { mouse = null; });
  cv.addEventListener('click', () => { scene = make(); t0 = performance.now(); });
  size(); requestAnimationFrame(draw);
})();
