/* Research-page animations. Each canvas[data-viz] gets one of the scenes below.
   Scenes only run while visible, follow the light/dark theme, and draw a single
   still frame when the visitor prefers reduced motion. */
(() => {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const palette = () => ({ ink: css('--ink'), ink2: css('--ink-2'), muted: css('--muted'), line: css('--line'), acc: css('--accent'), safe: css('--safe'), navy: css('--navy'), paper: css('--paper') });
  const TAU = Math.PI * 2, CAP = 26; // bottom strip reserved for the caption
  const smooth = u => (u = Math.min(1, Math.max(0, u)), u * u * (3 - 2 * u));
  const rng = seed => () => (seed = (seed + 0x6d2b79f5) | 0, ((t => (t ^ (t >>> 14)) >>> 0)(Math.imul(seed ^ (seed >>> 15), 1 | seed) ^ seed)) / 4294967296);
  const hatch = (c, col) => {
    c._h ??= {};
    if (c._h[col]) return c._h[col];
    const p = document.createElement('canvas'); p.width = p.height = 7;
    const x = p.getContext('2d'); x.strokeStyle = col; x.globalAlpha = .55; x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, 7); x.lineTo(7, 0); x.moveTo(-1, 1); x.lineTo(1, -1); x.moveTo(6, 8); x.lineTo(8, 6); x.stroke();
    return (c._h[col] = c.createPattern(p, 'repeat'));
  };
  const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); };
  const obstacle = (c, P, x, y, r) => { circle(c, x, y, r); c.fillStyle = hatch(c, P.ink); c.fill(); c.strokeStyle = P.ink; c.lineWidth = 1.2; c.stroke(); };
  const label = (c, P, s, x, y, col = P.muted, align = 'left') => { c.font = '500 11px "IBM Plex Mono", monospace'; c.fillStyle = col; c.textAlign = align; c.fillText(s, x, y); };
  const bez = (p, s) => { const u = 1 - s; return [0, 1].map(k => u * u * u * p[0][k] + 3 * u * u * s * p[1][k] + 3 * u * s * s * p[2][k] + s * s * s * p[3][k]); };

  const scenes = {
    /* 01: a ball-shaped tube moves through a 2D workspace, dodges moving obstacles and shrinks onto the target by the deadline */
    tubes() {
      const L = 9, TF = 7, path = [[.08, .78], [.35, .05], [.62, 1.0], [.88, .24]];
      const obs = [.3, .55, .78].map(s => {
        let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; smooth(m) < s ? lo = m : hi = m; }
        const c0 = bez(path, s); return { x: c0[0], y: c0[1], ti: lo * TF, sg: c0[1] > .5 ? -1 : 1 };
      });
      return (c, W, H, t, P, say) => {
        const h = H - CAP, m = Math.min(W, h), pad = 22, X = x => pad + x * (W - 2 * pad), Y = y => pad + y * (h - 2 * pad);
        const tau = t % L, s = smooth(tau / TF), rad = k => m * (.15 * (1 - k) + .045);
        const g = path[3], ts = m * .13;
        c.fillStyle = P.safe; c.globalAlpha = .16; c.fillRect(X(g[0]) - ts / 2, Y(g[1]) - ts / 2, ts, ts); c.globalAlpha = 1;
        c.strokeStyle = P.safe; c.lineWidth = 1.4; c.strokeRect(X(g[0]) - ts / 2, Y(g[1]) - ts / 2, ts, ts);
        label(c, P, 'T', X(g[0]) + ts / 2 + 5, Y(g[1]) - ts / 2 + 10, P.safe);
        c.setLineDash([3, 5]); c.strokeStyle = P.muted; c.lineWidth = 1; c.beginPath();
        for (let k = 0; k <= 60; k++) { const q = bez(path, k / 60); c.lineTo(X(q[0]), Y(q[1])); } c.stroke(); c.setLineDash([]);
        c.strokeStyle = P.acc;
        for (let k = 0; k <= s; k += .035) { const q = bez(path, k); c.globalAlpha = .22; circle(c, X(q[0]), Y(q[1]), rad(k)); c.stroke(); }
        c.globalAlpha = 1;
        obs.forEach(o => obstacle(c, P, X(o.x), Y(o.y + o.sg * .3 * Math.cos(1.6 * (tau - o.ti))), m * .065));
        const q = bez(path, s), cx = X(q[0]), cy = Y(q[1]), r = rad(s);
        circle(c, cx, cy, r); c.fillStyle = P.acc; c.globalAlpha = .16; c.fill(); c.globalAlpha = 1; c.lineWidth = 2; c.stroke();
        c.lineWidth = 1.4; c.strokeStyle = P.navy; c.beginPath();
        for (let k = Math.max(0, tau - 2); k <= tau; k += .03) {
          const sk = smooth(k / TF), qk = bez(path, sk), rk = rad(sk) * .55;
          c.lineTo(X(qk[0]) + rk * Math.sin(3.1 * k), Y(qk[1]) + rk * Math.cos(4.3 * k));
        } c.stroke();
        const rr = r * .55; circle(c, cx + rr * Math.sin(3.1 * tau), cy + rr * Math.cos(4.3 * tau), 4.5); c.fillStyle = P.navy; c.fill();
        say(`t = ${tau.toFixed(1)} s of ${TF.toFixed(1)} s · ${tau < TF ? 'inside tube Γ(t), obstacles avoided' : 'target reached on time ✓'}`);
      };
    },

    /* 02: a robot satisfies φ = ◇[0,4] A ∧ ◇[4,8] B ∧ □¬C; a timeline ticks off each part of the formula */
    logic() {
      const L = 10, wp = [[0, .08, .86], [3, .24, .3], [4.3, .42, .14], [5.7, .7, .18], [7.3, .84, .66], [10, .84, .66]];
      const at = tau => {
        let i = 0; while (i < wp.length - 2 && tau > wp[i + 1][0]) i++;
        const u = (tau - wp[i][0]) / (wp[i + 1][0] - wp[i][0]), p = k => wp[Math.min(wp.length - 1, Math.max(0, k))];
        const [a, b, d, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
        return [1, 2].map(k => .5 * (2 * b[k] + (-a[k] + d[k]) * u + (2 * a[k] - 5 * b[k] + 4 * d[k] - e[k]) * u * u + (-a[k] + 3 * b[k] - 3 * d[k] + e[k]) * u * u * u));
      };
      let doneA = null, doneB = null, last = 0;
      return (c, W, H, t, P, say) => {
        const h = (H - CAP) * .7, pad = 22, X = x => pad + x * (W - 2 * pad), Y = y => pad * .6 + y * (h - pad), m = Math.min(W, h);
        const tau = t % L; if (tau < last) doneA = doneB = null; last = tau;
        const A = [.24, .3], B = [.84, .66], rA = m * .11;
        [[A, 'A', P.acc], [B, 'B', P.navy]].forEach(([q, n, col]) => {
          circle(c, X(q[0]), Y(q[1]), rA); c.fillStyle = col; c.globalAlpha = .14; c.fill(); c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 1.4; c.stroke();
          label(c, P, n, X(q[0]) + rA + 4, Y(q[1]) - rA + 8, col);
        });
        const cx0 = X(.47), cy0 = Y(.36), cw = X(.62) - cx0, ch = Y(1.02) - cy0;
        c.fillStyle = hatch(c, P.ink); c.fillRect(cx0, cy0, cw, ch); c.strokeStyle = P.ink; c.lineWidth = 1.2; c.strokeRect(cx0, cy0, cw, ch);
        label(c, P, 'C', cx0 + cw + 5, cy0 + 12, P.ink);
        c.strokeStyle = P.ink2; c.lineWidth = 1.6; c.beginPath();
        for (let k = 0; k <= tau; k += .04) { const q = at(k); c.lineTo(X(q[0]), Y(q[1])); } c.stroke();
        const q = at(tau), px = X(q[0]), py = Y(q[1]);
        if (doneA == null && tau <= 4 && Math.hypot(px - X(A[0]), py - Y(A[1])) < rA) doneA = tau;
        if (doneB == null && tau >= 4 && tau <= 8 && Math.hypot(px - X(B[0]), py - Y(B[1])) < rA) doneB = tau;
        circle(c, px, py, 5); c.fillStyle = P.ink; c.fill();
        // timeline
        const top = h + 10, x0 = pad + 70, x1 = W - pad, TX = s => x0 + s / L * (x1 - x0);
        const rows = [['◇[0,4] A', 0, 4, doneA != null, P.acc], ['◇[4,8] B', 4, 8, doneB != null, P.navy], ['□ ¬C', 0, 10, tau > 9.6, P.ink2]];
        rows.forEach(([n, a, b, ok, col], i) => {
          const y = top + i * 20;
          label(c, P, n, pad, y + 4, P.ink2);
          c.fillStyle = P.line; c.fillRect(x0, y - 2, x1 - x0, 4);
          c.fillStyle = col; c.globalAlpha = ok ? .9 : .35; c.fillRect(TX(a), y - 3, TX(b) - TX(a), 6); c.globalAlpha = 1;
          if (ok) label(c, P, '✓', TX(b) + 6 > x1 - 8 ? x1 - 8 : TX(b) + 6, y + 4, P.safe);
        });
        c.strokeStyle = P.ink; c.lineWidth = 1; c.beginPath(); c.moveTo(TX(tau), top - 10); c.lineTo(TX(tau), top + 50); c.stroke();
        say(`φ = ◇[0,4] A ∧ ◇[4,8] B ∧ □ ¬C · t = ${tau.toFixed(1)} s${tau > 9.6 ? ' · φ satisfied ✓' : ''}`);
      };
    },

    /* 03: data points appear, a neural barrier certificate is fitted to them, then trajectories stay inside the certified set */
    learning() {
      const L = 13, r = rng(7), pts = Array.from({ length: 150 }, (_, i) => [r() * 2.6 - 1.3, r() * 2.6 - 1.3, i / 150 * 3]);
      const shape = th => 1 + .17 * Math.sin(3 * th + .5) + .08 * Math.cos(5 * th);
      return (c, W, H, t, P, say) => {
        const h = H - CAP, cx = W / 2, cy = h / 2 + 4, R = Math.min(W, h) * .34, tau = t % L;
        const e = smooth((tau - 3) / 4), learned = th => R * (.72 + (shape(th) - .72) * e + (1 - e) * .1 * Math.sin(7 * th + tau * 3) * (tau > 3));
        pts.forEach(([x, y, a]) => {
          if (tau < a) return;
          const d = Math.hypot(x, y) * R, th = Math.atan2(y, x), safe = d < R * shape(th);
          circle(c, cx + x * R, cy + y * R, 2.4); c.fillStyle = safe ? P.navy : P.acc; c.globalAlpha = Math.min(1, (tau - a) * 3) * .75; c.fill();
        });
        c.globalAlpha = 1;
        if (tau > 3) {
          [1, .66, .36].forEach((k, j) => {
            c.beginPath(); for (let i = 0; i <= 120; i++) { const th = i / 120 * TAU, rr = learned(th) * k; c.lineTo(cx + rr * Math.cos(th), cy + rr * Math.sin(th)); }
            c.closePath();
            if (!j) { c.fillStyle = P.navy; c.globalAlpha = .07; c.fill(); c.globalAlpha = 1; c.strokeStyle = P.ink; c.lineWidth = 2; c.setLineDash(tau < 7 ? [6, 4] : []); }
            else { c.strokeStyle = P.muted; c.lineWidth = 1; c.setLineDash([2, 4]); }
            c.stroke(); c.setLineDash([]);
          });
        }
        if (tau > 7) {
          for (let k = 0; k < 7; k++) {
            c.strokeStyle = P.acc; c.lineWidth = 1.6; c.beginPath();
            let x, y;
            for (let s = Math.max(7, tau - 1.6); s <= tau; s += .02) {
              const th = k / 7 * TAU + .7 * (s - 7), rr = Math.min(.92 * learned(th), R * (.25 + .5 * (1 + Math.sin(1.7 * s + k)) * .8));
              x = cx + rr * Math.cos(th); y = cy + rr * Math.sin(th); c.lineTo(x, y);
            }
            c.stroke(); circle(c, x, y, 3.2); c.fillStyle = P.acc; c.fill();
          }
        }
        say(tau < 3 ? `sampling states · ${pts.filter(p => p[2] <= tau).length} labelled safe / unsafe`
          : tau < 7 ? `training neural barrier B(x) · epoch ${Math.round(e * 400)}`
            : 'verified: the set B(x) ≥ 0 is forward invariant ✓');
      };
    },

    /* 04: five robots keep a rigid formation, shrink it to pass through a gap, and stay within sensing range */
    swarm() {
      const L = 11, n = 5, off = Array.from({ length: n }, (_, i) => [Math.cos(i / n * TAU - Math.PI / 2), Math.sin(i / n * TAU - Math.PI / 2)]);
      let ag = null, ts = 0;
      const lead = s => { const u = (s % L) / L; return [-.12 + 1.24 * u, .5 + .05 * Math.sin(u * TAU * 1.5)]; };
      const scale = x => 1 - .5 * Math.exp(-(((x - .55) / .12) ** 2));
      return (c, W, H, t, P, say) => {
        const h = H - CAP, X = x => x * W, Y = y => y * h, f = h * .17;
        const goal = s => { const [x, y] = lead(s), k = scale(x); return off.map(([a, b]) => [X(x) + a * f * k, Y(y) + b * f * k]); };
        if (!ag || t < ts || (t % L) < (ts % L)) { ag = goal(t); ts = t; }
        while (ts < t) { ts = Math.min(t, ts + 1 / 120); const g = goal(ts); ag = ag.map((p, i) => [p[0] + (g[i][0] - p[0]) * .06, p[1] + (g[i][1] - p[1]) * .06]); }
        const gapY = .5, gr = h * .11;
        obstacle(c, P, X(.55), Y(gapY) - f * .78 - gr, gr); obstacle(c, P, X(.55), Y(gapY) + f * .78 + gr, gr);
        const sense = f * 2.2; let links = 0;
        c.strokeStyle = P.ink2; c.lineWidth = 1.2;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const d = Math.hypot(ag[i][0] - ag[j][0], ag[i][1] - ag[j][1]);
          if (d < sense) { links++; c.globalAlpha = .55 * (1 - d / sense) + .2; c.beginPath(); c.moveTo(...ag[i]); c.lineTo(...ag[j]); c.stroke(); }
        }
        c.globalAlpha = 1;
        ag.forEach((p, i) => {
          c.setLineDash([2, 4]); c.strokeStyle = P.muted; c.globalAlpha = .45; c.lineWidth = 1; circle(c, p[0], p[1], sense / 2); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
          c.save(); c.translate(p[0], p[1]); c.beginPath(); c.moveTo(8, 0); c.lineTo(-5, 5); c.lineTo(-3, 0); c.lineTo(-5, -5); c.closePath();
          c.fillStyle = i ? P.navy : P.acc; c.fill(); c.restore();
        });
        say(`5 robots · ${links} links in sensing range · scale ${scale(lead(t)[0]).toFixed(2)}`);
      };
    },

    /* 05: trajectories from scattered initial states of a switched system converge onto one another (incremental stability) */
    contraction() {
      const L = 12, n = 14, modes = [[1, .9], [2.3, 1.3]];
      let st = null, trails, ts = 0, seed = 3;
      const reset = () => { const r = rng(seed++); st = Array.from({ length: n }, () => [r() * 6 - 3, r() * 5 - 2.5]); trails = st.map(() => []); };
      return (c, W, H, t, P, say) => {
        const h = H - CAP, cx = W / 2, cy = h / 2, sc = Math.min(W, h) / 9;
        if (!st || t < ts || Math.floor(t / L) !== Math.floor(ts / L)) { reset(); ts = Math.floor(t / L) * L; }
        while (ts < t) {
          const dt = 1 / 120, [k, d] = modes[Math.floor(ts / 2.5) % 2], u = 1.4 * Math.sin(1.1 * ts);
          st.forEach(p => { p[0] += p[1] * dt; p[1] += (-k * p[0] - d * p[1] + u) * dt; });
          ts += dt;
          if (Math.round(ts * 120) % 4 === 0) st.forEach((p, i) => { trails[i].push([p[0], p[1]]); if (trails[i].length > 70) trails[i].shift(); });
        }
        c.strokeStyle = P.line; c.lineWidth = 1; c.beginPath(); c.moveTo(18, cy); c.lineTo(W - 18, cy); c.moveTo(cx, 12); c.lineTo(cx, h - 6); c.stroke();
        label(c, P, 'x', W - 26, cy - 6); label(c, P, 'ẋ', cx + 6, 22);
        const toS = p => [cx + p[0] * sc, cy - p[1] * sc];
        trails.forEach(tr => {
          for (let j = 1; j < tr.length; j++) { c.strokeStyle = P.acc; c.globalAlpha = j / tr.length * .8; c.lineWidth = 1.5; c.beginPath(); c.moveTo(...toS(tr[j - 1])); c.lineTo(...toS(tr[j])); c.stroke(); }
        });
        c.globalAlpha = 1;
        st.forEach(p => { circle(c, ...toS(p), 3.6); c.fillStyle = P.navy; c.fill(); });
        let spread = 0; st.forEach(a => st.forEach(b => spread = Math.max(spread, Math.hypot(a[0] - b[0], a[1] - b[1]))));
        say(`mode σ(t) = ${Math.floor(ts / 2.5) % 2 + 1} · largest gap between trajectories ${spread.toFixed(2)}`);
      };
    },

    /* 06: noisy (mixed-skill) demonstrations give a learned path and a tube; a two-link arm tracks it inside the tube */
    arm() {
      const r = rng(11), demos = Array.from({ length: 6 }, (_, i) => ({ a: (r() - .5) * .12, b: (r() - .5) * .1, w: i > 3 ? .05 : .012, f: 4 + r() * 5 }));
      return (c, W, H, t, P, say) => {
        const h = H - CAP, bx = W / 2, by = h - 10, R = h * .66, kx = Math.min(1.35, W * .44 / R), l = h * .47;
        // the taught motion sweeps an arc over the arm's base, from left to right
        const at = (s, dr = 0, da = 0) => { const q = -Math.PI + .38 + s * (Math.PI - .76) + da; return [bx + R * (1 + dr) * Math.cos(q) * kx, by + R * (1 + dr) * Math.sin(q)]; };
        const bump = s => Math.sin(Math.PI * s), width = s => .02 + .09 * bump(s);
        const line = f => { c.beginPath(); for (let i = 0; i <= 80; i++) c.lineTo(...f(i / 80)); };
        c.beginPath();
        for (let i = 0; i <= 60; i++) c.lineTo(...at(i / 60, -width(i / 60)));
        for (let i = 60; i >= 0; i--) c.lineTo(...at(i / 60, width(i / 60)));
        c.closePath(); c.fillStyle = P.acc; c.globalAlpha = .14; c.fill(); c.globalAlpha = .6; c.strokeStyle = P.acc; c.lineWidth = 1; c.stroke();
        c.strokeStyle = P.muted; c.globalAlpha = .55;
        demos.forEach(d => { line(s => at(s, (d.a + d.w * Math.sin(d.f * s * TAU)) * bump(s), d.b * bump(s))); c.stroke(); });
        c.globalAlpha = 1; c.setLineDash([5, 4]); c.strokeStyle = P.acc; c.lineWidth = 1.6; line(s => at(s)); c.stroke(); c.setLineDash([]);
        const s = .5 - .5 * Math.cos(t * TAU / 8), [ex, ey] = at(s, width(s) * .45 * Math.sin(t * 2.3));
        // equal links: the elbow sits at ±acos(d/2l) from the base→hand line; always bend the same way
        const dx = ex - bx, dy = ey - by, d = Math.min(Math.hypot(dx, dy), 2 * l - 1), q = Math.atan2(dy, dx) - Math.acos(d / (2 * l));
        const elx = bx + l * Math.cos(q), ely = by + l * Math.sin(q);
        c.fillStyle = P.ink; c.fillRect(bx - 24, by, 48, 8);
        c.lineCap = 'round'; c.strokeStyle = P.ink; c.lineWidth = 9; c.beginPath(); c.moveTo(bx, by); c.lineTo(elx, ely); c.lineTo(ex, ey); c.stroke(); c.lineCap = 'butt';
        [[bx, by], [elx, ely]].forEach(([x, y]) => { circle(c, x, y, 5); c.fillStyle = P.paper; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2; c.stroke(); });
        circle(c, ex, ey, 6); c.fillStyle = P.navy; c.fill();
        say(`${demos.length} mixed-skill demos → learned tube · arm stays inside`);
      };
    }
  };

  function mount(cv) {
    if (cv._viz || !scenes[cv.dataset.viz]) return;
    const draw = scenes[cv.dataset.viz](), c = cv.getContext('2d'), cap = cv.parentElement.querySelector('[data-cap]');
    let W = 0, H = 0, T = 0, prev = null, run = false, said = '';
    const say = s => { if (cap && s !== said) cap.textContent = said = s; };
    const frame = now => {
      if (prev != null) T += Math.min(.05, (now - prev) / 1000);
      prev = now;
      c.clearRect(0, 0, W, H);
      draw(c, W, H, reduce ? 5.2 : T, palette(), say);
      if (run && !reduce) requestAnimationFrame(frame); else prev = null;
    };
    const size = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; c.setTransform(d, 0, 0, d, 0, 0);
      if (!run) frame(performance.now());
    };
    cv._viz = true; size();
    new ResizeObserver(size).observe(cv);
    new IntersectionObserver(es => {
      const vis = es[0].isIntersecting;
      if (vis && !run) { run = true; prev = null; requestAnimationFrame(frame); } else if (!vis) run = false;
    }).observe(cv);
    new MutationObserver(() => { if (!run) frame(performance.now()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  window.FOCAS_VIZ = () => document.querySelectorAll('canvas[data-viz]').forEach(mount);
  window.FOCAS_VIZ();
})();
