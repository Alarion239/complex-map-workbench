'use strict';
// Regions: shapes (points, curves, areas), meshing of areas, adaptive mapping of curves.
const Region = (() => {
  const { C } = CX;
  const DEG = Math.PI / 180;
  const TAU = 2 * Math.PI;
  const P = (a) => C(a[0], a[1]);
  const fmt = (z) => CX.tex(z, 3);
  const num = (x) => CX.fmtNum(x, 3);
  // z - c written the way a person would: z, z - 2, z + 1, z - (1+i)
  const zMinus = (c) => {
    if (CX.isZero(c)) return 'z';
    if (c.im === 0) return c.re < 0 ? `z+${num(-c.re)}` : `z-${num(c.re)}`;
    return `z-(${fmt(c)})`;
  };

  // ---------- parametric curves ----------
  const seg = (a, b, n0 = 48) => ({ f: (s) => C(a.re + s * (b.re - a.re), a.im + s * (b.im - a.im)), n0, closed: false, a, b });
  // A segment that stands for an infinite line or ray: sampled densely near the view, sparsely far away.
  const longSeg = (a, b) => Object.assign(seg(a, b, 160), { long: true });
  // Unbounded objects reach this many window half-sizes beyond the view.
  const FAR = 220;
  // SPEC 9.1 (P4), on settle only: with curvesOf(s, win, {reach: 'sphere'}) a long curve also carries c.reach, its ends
  // clipped to expandBox(win, REACH) (toward the Riemann sphere's point at infinity); sampleCurve(c, win, {tail}) then
  // continues the geometric tails past the FAR ends toward them, stopping where tail(z) says the CPU stage maps left
  // TAIL_LIM (float32 drops those pieces anyway: z^2, exp). The default ({reach: 'far'}) is today's curve.
  // REF_RATIO: the spacing ratio of the samples the refinement adds (tails past FAR, runs toward singular points). The
  // line renderer splits every segment into M = 8 linear pieces, so a segment of ratio 1.25 draws pieces of ratio
  // <= 1 + 0.25 / 8 = 1.031, as fine as today's 1.035 tails, with 6.5x fewer segments (GPU memory, vertex work).
  const REACH = 1e28, TAIL_LIM = 1e19, REF_RATIO = 1.25;
  const circ = (c, r, n0 = 160) => ({ f: (s) => C(c.re + r * Math.cos(TAU * s), c.im + r * Math.sin(TAU * s)), n0, closed: true });
  const arcAng = (c, r, t0, t1, n0 = 96) => ({ f: (s) => { const t = t0 + s * (t1 - t0); return C(c.re + r * Math.cos(t), c.im + r * Math.sin(t)); }, n0, closed: false });
  function poly(pts, closed) {
    const ps = closed ? [...pts, pts[0]] : pts;
    const n = ps.length - 1;
    if (n < 1) return null;
    return {
      f: (s) => {
        const u = Math.min(n - 1e-12, Math.max(0, s * n));
        const i = Math.floor(u), t = u - i;
        const a = ps[i], b = ps[i + 1];
        return C(a.re + t * (b.re - a.re), a.im + t * (b.im - a.im));
      },
      n0: n, minN0: n, closed, pts: ps,
    };
  }
  // circle through three points; returns arc from a to b through m
  function arc3(a, m, b) {
    const ax = a.re, ay = a.im, bx = m.re, by = m.im, cx = b.re, cy = b.im;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const scale = Math.max(CX.abs(CX.sub(a, b)), 1e-9);
    if (Math.abs(d) < 1e-9 * scale * scale) return seg(a, b);
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    const c = C(ux, uy);
    const r = CX.abs(CX.sub(a, c));
    const ta = Math.atan2(ay - uy, ax - ux);
    let tm = Math.atan2(by - uy, bx - ux), tb = Math.atan2(cy - uy, cx - ux);
    // go counterclockwise from a; check whether m comes before b
    const ccw = (t) => ((t - ta) % TAU + TAU) % TAU;
    let t1;
    if (ccw(tm) < ccw(tb)) t1 = ta + ccw(tb);
    else t1 = ta - (TAU - ccw(tb));
    return Object.assign(arcAng(c, r, ta, t1), { center: c, radius: r });
  }
  // clip infinite line p + t d (t in [tmin, tmax]) to a box
  function clipLine(p, d, box, tmin = -Infinity, tmax = Infinity) {
    let t0 = tmin, t1 = tmax;
    const test = (num_, den) => {
      if (Math.abs(den) < 1e-300) return num_ >= 0;
      const t = num_ / den;
      if (den > 0) { if (t < t1) t1 = t; } else if (t > t0) t0 = t;
      return true;
    };
    if (!test(box.x1 - p.re, d.re) || !test(p.re - box.x0, -d.re) || !test(box.y1 - p.im, d.im) || !test(p.im - box.y0, -d.im)) return null;
    if (!(t0 < t1) || !Number.isFinite(t0) || !Number.isFinite(t1)) return null;
    return [CX.add(p, CX.scale(d, t0)), CX.add(p, CX.scale(d, t1))];
  }
  const expandBox = (b, f) => {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, hw = (b.x1 - b.x0) / 2 * f, hh = (b.y1 - b.y0) / 2 * f;
    return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
  };
  const dist = (a, b) => Math.hypot(a.re - b.re, a.im - b.im);
  // the long curve of the line a + t d (t >= tmin) for window win: today's FAR clip, plus c.reach (REACH clip) when
  // o.reach is 'sphere'
  function longOf(a, d, win, tmin, o) {
    const cl = clipLine(a, d, expandBox(win, FAR), tmin);
    if (!cl) return null;
    const c = longSeg(cl[0], cl[1]);
    if (o && o.reach === 'sphere') { const cs = clipLine(a, d, expandBox(win, REACH), tmin); if (cs) c.reach = cs; }
    return c;
  }
  function distSeg(z, a, b) {
    const dx = b.re - a.re, dy = b.im - a.im;
    const L = dx * dx + dy * dy;
    let t = L > 0 ? ((z.re - a.re) * dx + (z.im - a.im) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(z.re - a.re - t * dx, z.im - a.im - t * dy);
  }
  function polyLevel(pts) {
    return (z) => {
      let inside = false, dmin = Infinity;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a.im > z.im) !== (b.im > z.im) && z.re < (b.re - a.re) * (z.im - a.im) / (b.im - a.im) + a.re) inside = !inside;
        dmin = Math.min(dmin, distSeg(z, a, b));
      }
      return inside ? dmin : -dmin;
    };
  }
  const cross = (u, v) => u.re * v.im - u.im * v.re;
  function sectorLevel(c, r, t1, t2) {
    let span = t2 - t1;
    span = ((span % 360) + 360) % 360 || 360;
    const u1 = C(Math.cos(t1 * DEG), Math.sin(t1 * DEG)), u2 = C(Math.cos((t1 + span) * DEG), Math.sin((t1 + span) * DEG));
    return (z) => {
      const v = CX.sub(z, c);
      const a = cross(u1, v), b = -cross(u2, v);
      let ang = span >= 360 ? Math.hypot(v.re, v.im) : (span <= 180 ? Math.min(a, b) : Math.max(a, b));
      if (r > 0) ang = Math.min(ang, r - Math.hypot(v.re, v.im));
      return ang;
    };
  }

  // ---------- shape kinds ----------
  const K = {};
  K.point = {
    type: 'point', label: 'Point',
    handles: (s) => [['p', P(s.p)]],
    points: (s) => [P(s.p)],
    tex: (s) => `${fmt(P(s.p))}`,
  };
  K.segment = {
    type: 'curve', label: 'Segment',
    handles: (s) => [['a', P(s.a)], ['b', P(s.b)]],
    curves: (s) => [seg(P(s.a), P(s.b))],
    tex: (s) => `[${fmt(P(s.a))},\\ ${fmt(P(s.b))}]`,
  };
  K.line = {
    type: 'curve', label: 'Line',
    handles: (s) => [['a', P(s.a)], ['b', P(s.b)]],
    curves: (s, win, o) => {
      const a = P(s.a), d = CX.sub(P(s.b), a);
      const c = longOf(a, d, win, -Infinity, o);
      return c ? [c] : [];
    },
    tex: (s) => `\\text{line through } ${fmt(P(s.a))},\\ ${fmt(P(s.b))}`,
  };
  K.ray = {
    type: 'curve', label: 'Ray',
    handles: (s) => [['a', P(s.a)], ['b', P(s.b)]],
    curves: (s, win, o) => {
      const a = P(s.a), d = CX.sub(P(s.b), a);
      const c = longOf(a, d, win, 0, o);
      return c ? [c] : [];
    },
    tex: (s) => `\\text{ray from } ${fmt(P(s.a))} \\text{ through } ${fmt(P(s.b))}`,
  };
  K.circle = {
    type: 'curve', label: 'Circle',
    handles: (s) => [['c', P(s.c)], ['r', C(s.c[0] + s.r, s.c[1])]],
    curves: (s) => [circ(P(s.c), s.r)],
    tex: (s) => `|${zMinus(P(s.c))}|=${num(s.r)}`,
  };
  K.arc = {
    type: 'curve', label: 'Arc',
    handles: (s) => [['a', P(s.a)], ['m', P(s.m)], ['b', P(s.b)]],
    curves: (s) => [arc3(P(s.a), P(s.m), P(s.b))],
    tex: (s) => `\\text{arc } ${fmt(P(s.a))} \\to ${fmt(P(s.m))} \\to ${fmt(P(s.b))}`,
  };
  K.curve = {
    type: 'curve', label: 'Freehand curve',
    handles: () => [],
    curves: (s) => { const c = poly(s.pts.map(P), false); return c ? [c] : []; },
    tex: (s) => `\\text{curve, ${s.pts.length} points}`,
  };
  K.cgrid = {
    type: 'curve', label: 'Cartesian grid',
    handles: (s) => [['a', P(s.a)], ['b', P(s.b)]],
    curves: (s) => {
      const a = P(s.a), b = P(s.b), n = Math.max(1, Math.min(60, s.n | 0));
      const out = [];
      for (let i = 0; i <= n; i++) {
        const x = a.re + (b.re - a.re) * i / n, y = a.im + (b.im - a.im) * i / n;
        out.push(Object.assign(seg(C(x, a.im), C(x, b.im), 64), { family: 0 }));
        out.push(Object.assign(seg(C(a.re, y), C(b.re, y), 64), { family: 1 }));
      }
      return out;
    },
    tex: (s) => `\\text{grid } [${num(Math.min(s.a[0], s.b[0]))},${num(Math.max(s.a[0], s.b[0]))}]\\times[${num(Math.min(s.a[1], s.b[1]))},${num(Math.max(s.a[1], s.b[1]))}]`,
  };
  K.pgrid = {
    type: 'curve', label: 'Polar grid',
    handles: (s) => [['c', P(s.c)], ['r', C(s.c[0] + s.r, s.c[1])]],
    curves: (s) => {
      const c = P(s.c), out = [];
      const nc = Math.max(1, Math.min(40, s.nc | 0)), nr = Math.max(1, Math.min(72, s.nr | 0));
      for (let i = 1; i <= nc; i++) out.push(Object.assign(circ(c, s.r * i / nc, 128), { family: 0 }));
      for (let j = 0; j < nr; j++) {
        const t = TAU * j / nr;
        out.push(Object.assign(seg(c, C(c.re + s.r * Math.cos(t), c.im + s.r * Math.sin(t)), 64), { family: 1 }));
      }
      return out;
    },
    tex: (s) => `\\text{polar grid}, |${zMinus(P(s.c))}|\\le ${num(s.r)}`,
  };
  // ----- areas -----
  K.disc = {
    type: 'area', label: 'Disc',
    handles: (s) => [['c', P(s.c)], ['r', C(s.c[0] + s.r, s.c[1])]],
    level: (s) => { const c = P(s.c), r = s.r; return (z) => r - Math.hypot(z.re - c.re, z.im - c.im); },
    bbox: (s) => ({ x0: s.c[0] - s.r, x1: s.c[0] + s.r, y0: s.c[1] - s.r, y1: s.c[1] + s.r }),
    boundary: (s) => [circ(P(s.c), s.r)],
    tex: (s) => `|${zMinus(P(s.c))}|<${num(s.r)}`,
  };
  K.rect = {
    type: 'area', label: 'Rectangle',
    handles: (s) => [['a', P(s.a)], ['b', P(s.b)]],
    level: (s) => {
      const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1]);
      return (z) => Math.min(z.re - x0, x1 - z.re, z.im - y0, y1 - z.im);
    },
    bbox: (s) => ({ x0: Math.min(s.a[0], s.b[0]), x1: Math.max(s.a[0], s.b[0]), y0: Math.min(s.a[1], s.b[1]), y1: Math.max(s.a[1], s.b[1]) }),
    boundary: (s) => {
      const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1]);
      // one closed counterclockwise loop (48 points a side, the corners exact), so integrals go around it
      const cs = [C(x0, y0), C(x1, y0), C(x1, y1), C(x0, y1)], pts = [];
      for (let k = 0; k < 4; k++) { const a = cs[k], b = cs[(k + 1) % 4]; for (let i = 0; i < 48; i++) pts.push(i ? C(a.re + (b.re - a.re) * i / 48, a.im + (b.im - a.im) * i / 48) : a); }
      const c = poly(pts, true);
      return c ? [c] : [];
    },
    tex: (s) => `${num(Math.min(s.a[0], s.b[0]))}<\\operatorname{Re}z<${num(Math.max(s.a[0], s.b[0]))},\\ ${num(Math.min(s.a[1], s.b[1]))}<\\operatorname{Im}z<${num(Math.max(s.a[1], s.b[1]))}`,
  };
  K.polygon = {
    type: 'area', label: 'Polygon',
    handles: (s) => (s.pts.length <= 40 ? s.pts.map((p, i) => ['v' + i, P(p)]) : []),
    level: (s) => polyLevel(s.pts.map(P)),
    bbox: (s) => ({ x0: Math.min(...s.pts.map((p) => p[0])), x1: Math.max(...s.pts.map((p) => p[0])), y0: Math.min(...s.pts.map((p) => p[1])), y1: Math.max(...s.pts.map((p) => p[1])) }),
    boundary: (s) => { const c = poly(s.pts.map(P), true); return c ? [c] : []; },
    tex: (s) => `\\text{polygon, ${s.pts.length} vertices}`,
  };
  K.halfplane = {
    type: 'area', label: 'Half-plane',
    handles: (s) => [['a', P(s.a)], ['b', P(s.b)]],
    level: (s) => {
      const a = P(s.a), d = CX.sub(P(s.b), a), L = CX.abs(d) || 1;
      return (z) => cross(d, CX.sub(z, a)) / L;
    },
    bbox: () => null,
    boundary: (s, win, o) => {
      const a = P(s.a), d = CX.sub(P(s.b), a);
      const c = longOf(a, d, win, -Infinity, o);
      return c ? [c] : [];
    },
    tex: (s) => `\\operatorname{Im}\\frac{z-(${fmt(P(s.a))})}{${fmt(CX.sub(P(s.b), P(s.a)))}}>0`,
  };
  K.annulus = {
    type: 'area', label: 'Annulus',
    handles: (s) => [['c', P(s.c)], ['r1', C(s.c[0] + s.r1, s.c[1])], ['r2', C(s.c[0] + s.r2, s.c[1])]],
    level: (s) => { const c = P(s.c), r1 = Math.min(s.r1, s.r2), r2 = Math.max(s.r1, s.r2); return (z) => { const d = Math.hypot(z.re - c.re, z.im - c.im); return Math.min(d - r1, r2 - d); }; },
    bbox: (s) => { const r = Math.max(s.r1, s.r2); return { x0: s.c[0] - r, x1: s.c[0] + r, y0: s.c[1] - r, y1: s.c[1] + r }; },
    boundary: (s) => [circ(P(s.c), s.r1), circ(P(s.c), s.r2)],
    tex: (s) => `${num(Math.min(s.r1, s.r2))}<|${zMinus(P(s.c))}|<${num(Math.max(s.r1, s.r2))}`,
  };
  K.sector = {
    type: 'area', label: 'Sector',
    handles: (s) => {
      const c = P(s.c), R = s.r > 0 ? s.r : 1.5;
      const at = (t, rr) => C(c.re + rr * Math.cos(t * DEG), c.im + rr * Math.sin(t * DEG));
      const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360;
      const h = [['c', c], ['t1', at(s.t1, R * 0.75)], ['t2', at(s.t1 + span, R * 0.75)]];
      if (s.r > 0) h.push(['r', at(s.t1 + span / 2, s.r)]);
      return h;
    },
    level: (s) => sectorLevel(P(s.c), s.r, s.t1, s.t2),
    bbox: (s) => (s.r > 0 ? { x0: s.c[0] - s.r, x1: s.c[0] + s.r, y0: s.c[1] - s.r, y1: s.c[1] + s.r } : null),
    boundary: (s, win, o) => {
      const c = P(s.c);
      const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360;
      const t1 = s.t1 * DEG, t2 = (s.t1 + span) * DEG;
      if (s.r > 0) {
        // bounded: one closed counterclockwise loop c → c + r e^{i t1} → arc → c + r e^{i t2} → c (a full turn: the circle)
        if (span >= 360) return [circ(c, s.r)];
        const at = (t, rr) => C(c.re + rr * Math.cos(t), c.im + rr * Math.sin(t));
        const nr = 24, na = Math.max(8, Math.min(352, Math.ceil(span))), pts = [];
        for (let i = 0; i < nr; i++) pts.push(i ? at(t1, s.r * i / nr) : c);
        for (let i = 0; i < na; i++) pts.push(at(t1 + (t2 - t1) * i / na, s.r));
        for (let i = 0; i < nr; i++) pts.push(at(t2, s.r * (nr - i) / nr));
        const lp = poly(pts, true);
        return lp ? [lp] : [];
      }
      // unbounded: the two rays, open (no closed boundary to go around)
      const out = [];
      const ray = (t) => longOf(c, C(Math.cos(t), Math.sin(t)), win, 0, o);
      if (span < 360) { out.push(ray(t1)); out.push(ray(t2)); }
      return out.filter(Boolean);
    },
    tex: (s) => {
      const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360;
      const c = P(s.c);
      const zc = zMinus(c);
      const ang = `${num(s.t1)}^\\circ<\\arg(${zc})<${num(s.t1 + span)}^\\circ`;
      return s.r > 0 ? `${ang},\\ |${zc}|<${num(s.r)}` : ang;
    },
  };
  K.formula = {
    type: 'area', label: 'Formula',
    handles: () => [],
    level: (s) => Expr.compileLevel(Expr.parse(s.expr, { allowRel: true })),
    bbox: () => null,
    boundary: null,
    tex: (s) => { try { return Expr.toTex(Expr.parse(s.expr, { allowRel: true })).s; } catch (e) { return '\\text{invalid}'; } },
  };

  // ---------- shape API ----------
  function levelOf(s) {
    const L = K[s.kind].level(s);
    return s.complement ? (z) => -L(z) : L;
  }
  function bboxOf(s) {
    if (s.complement) return null;
    const b = K[s.kind].bbox && K[s.kind].bbox(s);
    return b || null;
  }
  // o: {reach: 'far' (default: every caller but the settle-time line refinement) | 'sphere'} (SPEC 9.1)
  function curvesOf(s, win, o) {
    const k = K[s.kind];
    if (k.type === 'curve') return k.curves(s, win, o);
    if (k.type === 'area' && k.boundary) return k.boundary(s, win, o);
    return [];
  }
  function handlesOf(s) { return K[s.kind].handles(s); }
  function setHandle(s, key, z) {
    const xy = [z.re, z.im];
    switch (key) {
      case 'r':
        if (s.kind === 'sector') { s.r = Math.max(1e-3, Math.hypot(z.re - s.c[0], z.im - s.c[1])); }
        else s.r = Math.max(1e-3, Math.hypot(z.re - s.c[0], z.im - s.c[1]));
        return;
      case 'r1': s.r1 = Math.max(1e-3, Math.hypot(z.re - s.c[0], z.im - s.c[1])); return;
      case 'r2': s.r2 = Math.max(1e-3, Math.hypot(z.re - s.c[0], z.im - s.c[1])); return;
      case 't1': case 't2': {
        const t = Math.atan2(z.im - s.c[1], z.re - s.c[0]) / DEG;
        if (key === 't1') {
          const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360;
          s.t1 = round3(t); s.t2 = round3(t + span);
        } else {
          let span = (((t - s.t1) % 360) + 360) % 360;
          if (span < 1) span = 360;
          s.t2 = round3(s.t1 + span);
        }
        return;
      }
      case 'c': {
        if (s.kind === 'disc' || s.kind === 'circle' || s.kind === 'annulus' || s.kind === 'sector' || s.kind === 'pgrid') s.c = xy;
        return;
      }
    }
    if (key[0] === 'v' && s.pts) { s.pts[+key.slice(1)] = xy; return; }
    if (key in s) s[key] = xy;
  }
  const round3 = (x) => Math.round(x * 1000) / 1000;
  function translate(s, dz) {
    const mv = (p) => [p[0] + dz.re, p[1] + dz.im];
    for (const k of ['p', 'a', 'b', 'c', 'm']) if (Array.isArray(s[k])) s[k] = mv(s[k]);
    if (s.pts) s.pts = s.pts.map(mv);
  }
  function hitTest(s, z, tol, win) {
    const k = K[s.kind];
    if (k.type === 'point') return dist(z, P(s.p)) < tol;
    let curves = [];
    try { curves = curvesOf(s, win); } catch (e) { /* invalid */ }
    for (const c of curves) {
      const n = Math.max(64, c.n0 * 2);
      let prev = c.f(0);
      for (let i = 1; i <= n; i++) {
        const q = c.f(i / n);
        if (distSeg(z, prev, q) < tol) return true;
        prev = q;
      }
    }
    if (k.type === 'area' && bboxOf(s)) {
      try { return levelOf(s)(z) > 0; } catch (e) { return false; }
    }
    return false;
  }

  // ---------- meshing of area shapes ----------
  // Returns {src, tri, cent, contours, cell}; src: Float64Array of source vertices (x,y),
  // tri: Uint32Array of vertex indices, contours: [{pts:[C], closed}] (used when no exact boundary)
  // Stretched axis: u in (-1, 1) -> c + h * phi(u). The middle 65% of the cells cover the window
  // (|phi| <= 1); the rest reach out to ~FAR/2 window half-sizes, so unbounded regions extend far past the view.
  const STRETCH_A = 0.35 / 0.65, UMAX = 0.9975;
  const phi = (u) => STRETCH_A * u / (1 - Math.abs(u));
  const phiInv = (x) => x / (STRETCH_A + Math.abs(x));
  function stretchedAxis(c, hw, lo, hi, n) {
    let u0 = -UMAX, u1 = UMAX;
    if (Number.isFinite(lo)) u0 = Math.max(u0, phiInv((lo - c) / hw));
    if (Number.isFinite(hi)) u1 = Math.min(u1, phiInv((hi - c) / hw));
    const X = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) X[i] = c + hw * phi(u0 + (u1 - u0) * i / n);
    return X;
  }
  function uniformAxis(a, b, n) {
    const X = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) X[i] = a + (b - a) * i / n;
    return X;
  }
  // Returns {src, tri, cent, contours, cell, box, stretched, win}. Unbounded shapes, and shapes much larger
  // than the window, are meshed on a stretched grid centred on the window.
  function buildMesh(s, win, Q = 140) {
    const L = levelOf(s);
    let box = bboxOf(s);
    // a degenerate window (zero, negative or non-finite size) would give infinite grid counts
    if (!(win.x1 - win.x0 > 0 && win.y1 - win.y0 > 0 && Number.isFinite(win.x0 + win.x1 + win.y0 + win.y1))) {
      const cx = Number.isFinite(win.x0 + win.x1) ? (win.x0 + win.x1) / 2 : 0, cy = Number.isFinite(win.y0 + win.y1) ? (win.y0 + win.y1) / 2 : 0;
      const hw = Math.max(1e-9, Math.abs(cx) * 1e-12, Number.isFinite(win.x1 - win.x0) ? (win.x1 - win.x0) / 2 : 0, Number.isFinite(win.y1 - win.y0) ? (win.y1 - win.y0) / 2 : 0, Math.abs(cy) * 1e-12);
      win = { x0: cx - hw, x1: cx + hw, y0: cy - hw, y1: cy + hw };
    }
    const ww = win.x1 - win.x0, wh = win.y1 - win.y0;
    const stretched = !box || (box.x1 - box.x0) > 3 * ww || (box.y1 - box.y0) > 3 * wh;
    let X, Y, h, open = null;
    if (stretched) {
      // sides where the grid is cut off far away rather than at the shape's own boundary
      open = { x0: !(box && Number.isFinite(box.x0)), x1: !(box && Number.isFinite(box.x1)), y0: !(box && Number.isFinite(box.y0)), y1: !(box && Number.isFinite(box.y1)) };
      const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2, hw = ww / 2, hh = wh / 2;
      const nx = Math.max(8, Math.round(Q * Math.max(1, ww / wh) ** 0.5)), ny = Math.max(8, Math.round(Q * Math.max(1, wh / ww) ** 0.5));
      X = stretchedAxis(cx, hw, box ? box.x0 : -Infinity, box ? box.x1 : Infinity, nx);
      Y = stretchedAxis(cy, hh, box ? box.y0 : -Infinity, box ? box.y1 : Infinity, ny);
      h = (ww / nx) / (STRETCH_A * 2 / 0.65);
    } else {
      const pad = 1e-3 * Math.max(box.x1 - box.x0, box.y1 - box.y0, 1e-9);
      box = { x0: box.x0 - pad, x1: box.x1 + pad, y0: box.y0 - pad, y1: box.y1 + pad };
      const W = box.x1 - box.x0, H = box.y1 - box.y0;
      if (!(W > 0 && H > 0)) return { src: new Float64Array(0), tri: new Uint32Array(0), cent: new Float64Array(0), contours: [], cell: 1, stretched, win };
      h = Math.max(W, H) / Q;
      X = uniformAxis(box.x0, box.x1, Math.max(4, Math.ceil(W / h)));
      Y = uniformAxis(box.y0, box.y1, Math.max(4, Math.ceil(H / h)));
    }
    const nx = X.length - 1, ny = Y.length - 1;
    const nc = (nx + 1) * (ny + 1);
    const lv = new Float64Array(nc);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      let v = L(C(X[i], Y[j]));
      if (Number.isNaN(v)) v = -Infinity;
      lv[j * (nx + 1) + i] = v;
    }
    const src = [];
    const cornerIdx = new Int32Array(nc).fill(-1);
    const nh = (ny + 1) * nx, nvE = ny * (nx + 1);
    const edgeIdx = new Int32Array(nh + nvE).fill(-1);
    const addV = (x, y) => { src.push(x, y); return src.length / 2 - 1; };
    const corner = (i, j) => {
      const id = j * (nx + 1) + i;
      if (cornerIdx[id] < 0) cornerIdx[id] = addV(X[i], Y[j]);
      return cornerIdx[id];
    };
    const edgePoint = (eid, i0, j0, i1, j1) => {
      if (edgeIdx[eid] >= 0) return edgeIdx[eid];
      const ax = X[i0], ay = Y[j0], bx = X[i1], by = Y[j1];
      const la = lv[j0 * (nx + 1) + i0];
      // bisection on the true level function for an accurate boundary
      let lo = 0, hi = 1;
      const aIn = la > 0;
      for (let it = 0; it < 12; it++) {
        const m = (lo + hi) / 2;
        const v = L(C(ax + m * (bx - ax), ay + m * (by - ay)));
        if ((v > 0) === aIn) lo = m; else hi = m;
      }
      const t = (lo + hi) / 2;
      edgeIdx[eid] = addV(ax + t * (bx - ax), ay + t * (by - ay));
      return edgeIdx[eid];
    };
    const tri = [];
    const segs = [];
    const hE = (i, j) => j * nx + i;
    const vE = (i, j) => nh + j * (nx + 1) + i;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const cs = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const ins = cs.map(([a, b]) => lv[b * (nx + 1) + a] > 0);
        const cnt = ins.filter(Boolean).length;
        if (cnt === 0) continue;
        if (cnt === 4) {
          const a = corner(i, j), b = corner(i + 1, j), c = corner(i + 1, j + 1), d = corner(i, j + 1);
          tri.push(a, b, c, a, c, d);
          continue;
        }
        const eids = [hE(i, j), vE(i + 1, j), hE(i, j + 1), vE(i, j)];
        const polyV = []; // [vertexIndex, isEdge, eid]
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) % 4;
          if (ins[k]) polyV.push([corner(cs[k][0], cs[k][1]), false, -1]);
          if (ins[k] !== ins[k2]) {
            // order endpoints so that edgePoint gets a canonical direction
            const [p0, p1] = k === 0 || k === 1 ? [cs[k], cs[k2]] : [cs[k2], cs[k]];
            polyV.push([edgePoint(eids[k], p0[0], p0[1], p1[0], p1[1]), true, eids[k]]);
          }
        }
        for (let k = 1; k + 1 < polyV.length; k++) tri.push(polyV[0][0], polyV[k][0], polyV[k + 1][0]);
        for (let k = 0; k < polyV.length; k++) {
          const a = polyV[k], b = polyV[(k + 1) % polyV.length];
          if (a[1] && b[1]) segs.push([a[2], b[2]]);
        }
      }
    }
    const srcA = new Float64Array(src);
    const triA = new Uint32Array(tri);
    const cent = new Float64Array(triA.length / 3 * 2);
    for (let t = 0; t < triA.length / 3; t++) {
      const a = triA[3 * t], b = triA[3 * t + 1], c = triA[3 * t + 2];
      cent[2 * t] = (srcA[2 * a] + srcA[2 * b] + srcA[2 * c]) / 3;
      cent[2 * t + 1] = (srcA[2 * a + 1] + srcA[2 * b + 1] + srcA[2 * c + 1]) / 3;
    }
    // chain contour segments
    const contours = [];
    if (!K[s.kind].boundary || s.kind === 'formula') {
      const adj = new Map();
      segs.forEach((sg, idx) => {
        for (const e of sg) { if (!adj.has(e)) adj.set(e, []); adj.get(e).push(idx); }
      });
      const used = new Uint8Array(segs.length);
      const ptOf = (e) => { const v = edgeIdx[e]; return C(srcA[2 * v], srcA[2 * v + 1]); };
      const walk = (startSeg, startE) => {
        const pts = [ptOf(startE)];
        let e = startE, sIdx = startSeg;
        for (;;) {
          used[sIdx] = 1;
          const sg = segs[sIdx];
          const other = sg[0] === e ? sg[1] : sg[0];
          pts.push(ptOf(other));
          const nxt = (adj.get(other) || []).find((q) => !used[q]);
          if (nxt === undefined) return { pts, closed: other === startE };
          e = other; sIdx = nxt;
        }
      };
      for (const [e, list] of adj) if (list.length === 1 && !used[list[0]]) contours.push(walk(list[0], e));
      for (let q = 0; q < segs.length; q++) if (!used[q]) contours.push(walk(q, segs[q][0]));
    }
    const outer = { x0: X[0], x1: X[nx], y0: Y[0], y1: Y[ny] };
    return { src: srcA, tri: triA, cent, contours, cell: h, box, stretched, win, outer, open };
  }

  // Map mesh vertices and triangle centroids through F; drop triangles that straddle discontinuities.
  function mapMesh(mesh, F) {
    const nv = mesh.src.length / 2, nt = mesh.tri.length / 3;
    const pos = new Float64Array(nv * 2);
    for (let i = 0; i < nv; i++) {
      const w = F(C(mesh.src[2 * i], mesh.src[2 * i + 1]));
      pos[2 * i] = w.re; pos[2 * i + 1] = w.im;
    }
    const keep = [];
    const T = mesh.tri;
    const LIM = 1e12;
    for (let t = 0; t < nt; t++) {
      const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
      const ax = pos[2 * a], ay = pos[2 * a + 1], bx = pos[2 * b], by = pos[2 * b + 1], cx = pos[2 * c], cy = pos[2 * c + 1];
      if (!(Math.abs(ax) < LIM && Math.abs(ay) < LIM && Math.abs(bx) < LIM && Math.abs(by) < LIM && Math.abs(cx) < LIM && Math.abs(cy) < LIM)) continue;
      const e = Math.max(Math.hypot(ax - bx, ay - by), Math.hypot(bx - cx, by - cy), Math.hypot(cx - ax, cy - ay));
      if (e > 0) {
        const wc = F(C(mesh.cent[2 * t], mesh.cent[2 * t + 1]));
        const dev = Math.hypot(wc.re - (ax + bx + cx) / 3, wc.im - (ay + by + cy) / 3);
        if (!(dev <= 0.2 * e)) continue;
      }
      keep.push(a, b, c);
    }
    return { pos, tri: new Uint32Array(keep) };
  }

  // Adaptive mapping of a parametric curve. view: {cx, cy, s (px per unit), w, h (px)}
  // Returns array of polylines, each a flat array [x0,y0,x1,y1,...] in world coordinates.
  function mapCurve(curve, F, view, opts = {}) {
    const maxDepth = opts.maxDepth ?? 13;
    let budget = opts.budget ?? 40000;
    const S = view.s;
    const halfW = view.w / 2 / S, halfH = view.h / 2 / S;
    const vx0 = view.cx - halfW * 1.5, vx1 = view.cx + halfW * 1.5, vy0 = view.cy - halfH * 1.5, vy1 = view.cy + halfH * 1.5;
    const out = [];
    let cur = null;
    const fin = (w) => Number.isFinite(w.re) && Number.isFinite(w.im) && Math.abs(w.re) < 1e12 && Math.abs(w.im) < 1e12;
    const outCode = (w) => (w.re < vx0 ? 1 : 0) | (w.re > vx1 ? 2 : 0) | (w.im < vy0 ? 4 : 0) | (w.im > vy1 ? 8 : 0);
    const evalAt = (s) => { budget--; return F(curve.f(s)); };
    const startAt = (w) => { cur = [w.re, w.im]; out.push(cur); };
    const brk = () => { cur = null; };
    function emit(w) {
      if (!fin(w)) { brk(); return; }
      if (!cur) startAt(w); else cur.push(w.re, w.im);
    }
    function refine(sa, wa, sb, wb, depth) {
      const fa = fin(wa), fb = fin(wb);
      if (!fa && !fb) { brk(); return; }
      const sm = (sa + sb) / 2;
      if (depth >= maxDepth || budget <= 0) {
        if (fa && fb) {
          const len = Math.hypot(wb.re - wa.re, wb.im - wa.im) * S;
          if (len > 24 && depth >= maxDepth) { brk(); emit(wb); return; }
        }
        emit(wb);
        return;
      }
      if (fa && fb) {
        const ca = outCode(wa), cb = outCode(wb);
        if ((ca & cb) && depth >= 4) { emit(wb); return; }
      }
      const wm = evalAt(sm);
      if (fa && fb && fin(wm)) {
        const len = Math.hypot(wb.re - wa.re, wb.im - wa.im) * S;
        const dev = Math.hypot(wm.re - (wa.re + wb.re) / 2, wm.im - (wa.im + wb.im) / 2) * S;
        if (dev < 0.35 && len < 60 && depth >= 1) { emit(wm); emit(wb); return; }
      }
      refine(sa, wa, sm, wm, depth + 1);
      refine(sm, wm, sb, wb, depth + 1);
    }
    const n0 = Math.max(curve.minN0 || 0, Math.min(opts.n0 ?? curve.n0, 400));
    let sPrev = 0, wPrev = evalAt(0);
    emit(wPrev);
    for (let i = 1; i <= n0; i++) {
      const s = i / n0;
      const w = evalAt(s);
      refine(sPrev, wPrev, s, w, 0);
      sPrev = s; wPrev = w;
    }
    return out.filter((p) => p.length >= 4);
  }

  // Per-triangle instance data for the GPU: [ax, ay, bx, by, cx, cy] per triangle, relative to out.origin (float64
  // [x, y]): the centre of the dense part of the mesh (the window of a stretched mesh, else the vertices' box), so
  // float32 keeps the mesh exact far from 0 and at deep zoom.
  function meshInstances(mesh) {
    const T = mesh.tri, S = mesh.src, n = T.length / 3;
    let ox = 0, oy = 0;
    if (mesh.stretched && mesh.win) { ox = (mesh.win.x0 + mesh.win.x1) / 2; oy = (mesh.win.y0 + mesh.win.y1) / 2; }
    else {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < S.length; i += 2) if (Number.isFinite(S[i]) && Number.isFinite(S[i + 1])) { x0 = Math.min(x0, S[i]); x1 = Math.max(x1, S[i]); y0 = Math.min(y0, S[i + 1]); y1 = Math.max(y1, S[i + 1]); }
      if (x1 >= x0) { ox = (x0 + x1) / 2; oy = (y0 + y1) / 2; }
    }
    if (!Number.isFinite(ox) || !Number.isFinite(oy)) ox = oy = 0;
    const out = new Float32Array(n * 6);
    for (let t = 0; t < n; t++) {
      for (let k = 0; k < 3; k++) { const v = T[3 * t + k]; out[6 * t + 2 * k] = S[2 * v] - ox; out[6 * t + 2 * k + 1] = S[2 * v + 1] - oy; }
    }
    out.origin = [ox, oy];
    return out;
  }
  // Open sets (spec 6.5: their boundary is drawn dashed): formulas made only of strict inequalities, and
  // complements of drawn shapes (the complement of a formula flips its strictness).
  function isOpen(s) {
    if (!K[s.kind] || K[s.kind].type !== 'area') return false;
    if (s.kind !== 'formula') return !!s.complement;
    let strict = 0, loose = 0;
    const walk = (n, neg) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { for (const x of n) walk(x, neg); return; }
      if (n.t === 'cmp') { if ((n.op === '<' || n.op === '>') !== neg) strict++; else loose++; return; }
      if (n.t === 'not') { walk(n.a, !neg); return; }
      if (n.t === 'and' || n.t === 'or') { walk(n.a, neg); walk(n.b, neg); }
    };
    try { walk(Expr.parse(s.expr, { allowRel: true }), !!s.complement); } catch (e) { return false; }
    return strict > 0 && loose === 0;
  }
  // Source-space sample points of a curve, dense enough for the GPU to subdivide further.
  // o.tail (SPEC 9.1, settle only): a long curve with c.reach continues its geometric tails (ratio REF_RATIO) past its
  // FAR ends toward c.reach until stop(z) is true, stop = o.tail() fresh per tail (the stage maps left TAIL_LIM, or
  // their images stopped moving); the samples up to the FAR ends are today's.
  function sampleCurve(c, win, o) {
    const diag = Math.hypot(win.x1 - win.x0, win.y1 - win.y0);
    const step = diag / 700;
    const out = [];
    const push = (z) => out.push(z.re, z.im);
    if (c.long) {
      // dense inside the (slightly enlarged) window, geometric spacing outside
      const a = c.a, b = c.b, d = CX.sub(b, a), L = CX.abs(d);
      if (!(L > 0)) return new Float64Array(0);
      const inn = clipLine(a, d, expandBox(win, 1.25), 0, 1);
      let t0, t1;
      if (inn) { t0 = CX.abs(CX.sub(inn[0], a)) / L; t1 = CX.abs(CX.sub(inn[1], a)) / L; }
      else { t0 = t1 = 0.5; }
      const ts = [];
      let dt = step / L;
      for (let t = t0; t > 0; ) { ts.push(t); t -= dt; dt *= 1.035; }
      ts.push(0);
      ts.reverse();
      const dtA = dt;
      const n = Math.max(1, Math.ceil((t1 - t0) / (step / L)));
      for (let i = 1; i <= n; i++) ts.push(t0 + (t1 - t0) * i / n);
      dt = step / L;
      for (let t = t1 + dt; t < 1; ) { ts.push(t); dt *= 1.035; t += dt; }
      ts.push(1);
      const mkTail = o && o.tail && c.reach ? o.tail : null;
      if (mkTail) {
        // the same recurrence past the ends (parameters relative to a and d: precise far out), up to the reach ends
        const tr = (z) => ((z.re - a.re) * d.re + (z.im - a.im) * d.im) / (L * L);
        const ext = (tEnd, sgn, dt0, zEnd) => {
          const pts = [];
          let t = sgn < 0 ? 0 : 1, h = dt0;
          if (!(sgn < 0 ? tEnd < 0 : tEnd > 1)) return pts;
          // the stop is seeded with the FAR end, so the first tail segment is judged too
          const tail = mkTail(c.f(t));
          for (let i = 0; i < 4000; i++) {
            h *= REF_RATIO; t += sgn * h;
            const z = (sgn < 0 ? t <= tEnd : t >= tEnd) ? zEnd : c.f(t);
            pts.push(z);
            if (z === zEnd || tail(z)) break;
          }
          return pts;
        };
        const pre = ext(tr(c.reach[0]), -1, dtA, c.reach[0]).reverse(), post = ext(tr(c.reach[1]), 1, dt, c.reach[1]);
        for (const z of pre) push(z);
        for (const t of ts) push(c.f(t));
        for (const z of post) push(z);
        return new Float64Array(out);
      }
      for (const t of ts) push(c.f(t));
      return new Float64Array(out);
    }
    // sample spacing grows with the distance from the window, so far-away parts stay cheap
    const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2, R = diag / 2;
    const stepAt = (z) => step * Math.max(1, Math.hypot(z.re - cx, z.im - cy) / R);
    if (c.pts) {
      const ps = c.pts;
      push(ps[0]);
      for (let i = 1; i < ps.length; i++) {
        const len = CX.abs(CX.sub(ps[i], ps[i - 1]));
        const mid = C((ps[i].re + ps[i - 1].re) / 2, (ps[i].im + ps[i - 1].im) / 2);
        const k = Math.min(256, Math.max(1, Math.ceil(len / stepAt(mid))));
        for (let j = 1; j <= k; j++) push(CX.add(ps[i - 1], CX.scale(CX.sub(ps[i], ps[i - 1]), j / k)));
      }
      return new Float64Array(out);
    }
    // estimate the length, then sample uniformly in the parameter
    const n = paramN(c, step);
    for (let i = 0; i <= n; i++) push(c.f(i / n));
    return new Float64Array(out);
  }
  function paramN(c, step) {
    let len = 0, prev = c.f(0);
    for (let i = 1; i <= 64; i++) { const q = c.f(i / 64); len += CX.abs(CX.sub(q, prev)); prev = q; }
    return Math.min(4096, Math.max(32, Math.ceil(len / step), c.n0 || 0));
  }

  // ---------- settle-time line refinement (SPEC 9.1, P4) ----------
  // Lines.refine(curves, F, sing, caps) -> polylines (Float64Array [x0, y0, x1, y1, ...] in source space), for the
  // line renderer (createLines), built on settle only; motion frames keep sampleCurve's samples.
  // - F: the CPU stage map(s) the lines are drawn under (one function or a list). Long curves with c.reach (curvesOf
  //   with {reach: 'sphere'}) continue their tails until every map leaves TAIL_LIM or every image stops moving (float32
  //   resolution); formula contours with c.outer that
  //   end on an open side of the stretched mesh's outer box continue as rays along their last segment (same reach).
  // - sing: [{z}] the chain's singular points (Inverse.singular, nearest the window first), or null: then the curve is
  //   scanned under F[0] (float64, at most caps.maxEval evaluations): a non-finite value or a jump (midpoint deviation
  //   over 0.25 x chord) is located by 40 bisection steps and becomes a singular point.
  // - A singular point p within one sample step of a curve segment gets samples at distances d_k = step * REF_RATIO^-k on
  //   both sides along the curve, down to 1e-30 R (R: the window's half-diagonal; on a straight curve computed from
  //   p's foot, so far below the coordinates' own size near 0; also not below float32 resolution of the GPU's
  //   origin-relative positions, caps.origin). p itself is excluded: a curve through p is split there (its two sides
  //   map to different places: two circles of z^i, a pole's two ends at infinity), one off p keeps its samples down to
  //   a tenth of its distance. At most caps.maxInsert samples per curve, in the order of sing (distance to the window).
  // caps: {win, origin: [x, y], maxInsert (8192), maxEval (2048)}
  const Lines = (() => {
    const RATIO = REF_RATIO, LN_R = Math.log(RATIO), EPS = 2.220446049250313e-16;
    const add = (a, b) => C(a.re + b.re, a.im + b.im);
    const boxDist = (b, z) => Math.hypot(Math.max(b.x0 - z.re, 0, z.re - b.x1), Math.max(b.y0 - z.im, 0, z.im - b.y1));
    const fin = (w) => !!w && Number.isFinite(w.re) && Number.isFinite(w.im);
    // A fresh run stop (P4 review): fed the samples of a run in order (a tail past FAR toward the reach end, or the
    // samples inserted toward a singular point), it returns true once every map is done with the run (the sample just
    // fed is kept as the run's last). A map is done for good once
    // - its image left TAIL_LIM (float32 drops the pieces) or is not finite;
    // - its image has stopped moving (3 steps in a row under float32 resolution of the image: a Mobius map toward the
    //   image of infinity, exp toward 0);
    // - its image has wrapped: the image chords have turned by more than WRAP since the run began (z^i along a ray
    //   traces |w| = const once per 2 pi of ln|z|: later turns only draw the same circle again).
    // seed: the run's starting point (the FAR end of a tail), so the first step is judged too.
    const WRAP = 2.5 * Math.PI;
    const runStop = (Fs) => (seed) => {
      const st = Fs.map(() => ({ w: null, dir: NaN, turn: 0, still: 0, done: false }));
      const feed = (z) => {
        let all = true;
        Fs.forEach((F, i) => {
          const m = st[i];
          if (m.done) return;
          const w = F(z);
          if (!fin(w) || !(Math.abs(w.re) <= TAIL_LIM && Math.abs(w.im) <= TAIL_LIM)) { m.done = true; return; }
          const p = m.w;
          if (p) {
            const dx = w.re - p.re, dy = w.im - p.im, ch = Math.hypot(dx, dy);
            m.still = ch <= 1.2e-7 * Math.max(Math.hypot(w.re, w.im), 1e-12) ? m.still + 1 : 0;
            if (ch > 0) {
              const dir = Math.atan2(dy, dx);
              if (dir === dir && m.dir === m.dir) { let a = dir - m.dir; a -= 2 * Math.PI * Math.round(a / (2 * Math.PI)); m.turn += Math.abs(a); }
              m.dir = dir;
            }
          }
          m.w = w;
          if (m.still >= 3 || m.turn > WRAP) m.done = true;
          else all = false;
        });
        return all;
      };
      if (seed) feed(seed);
      return feed;
    };
    const tailStop = runStop;
    // the image of the segment za-zb under F is not resolved by its two ends: the midpoint's image is off the chord's
    // midpoint by more than 0.25 x chord (the jump scan's test); a non-finite image counts as resolved here (a pole or
    // an overflow is the other stops' business)
    function unresolved(F, za, zb) {
      const wa = F(za), wb = F(zb), wm = F(C((za.re + zb.re) / 2, (za.im + zb.im) / 2));
      if (!fin(wa) || !fin(wb) || !fin(wm)) return false;
      const ch = Math.hypot(wb.re - wa.re, wb.im - wa.im), dev = Math.hypot(wm.re - (wa.re + wb.re) / 2, wm.im - (wa.im + wb.im) / 2);
      return dev > 0.25 * ch && dev > 1e-9 * Math.max(Math.hypot(wa.re, wa.im), Math.hypot(wb.re, wb.im), Math.hypot(wm.re, wm.im));
    }
    // A long curve (line, ray, half-plane boundary) whose image is no longer resolved by its samples far out (exp of a
    // vertical line, sin and cos: the samples land at unrelated angles of a periodic image and draw chords across it)
    // ends where the run of unresolved segments begins: walking out from the window, the first 3 segments in a row
    // that are unresolved under every map, both ends outside expandBox(win, CUT_BOX). A single unresolved segment (a
    // pole crossed far out: the image continues on the other side) is kept.
    const CUT_BOX = 4;
    function cutUnresolved(pts, Fs, win) {
      const n = pts.length / 2;
      if (!Fs.length || n < 4) return pts;
      const box = expandBox(win, CUT_BOX), cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2;
      const P = (i) => C(pts[2 * i], pts[2 * i + 1]);
      const out = (i) => { const x = pts[2 * i], y = pts[2 * i + 1]; return x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1; };
      let m = 0, best = Infinity;
      for (let i = 0; i < n; i++) { const d = Math.hypot(pts[2 * i] - cx, pts[2 * i + 1] - cy); if (d < best) { best = d; m = i; } }
      const bad = (i, j) => out(i) && out(j) && Fs.every((F) => unresolved(F, P(i), P(j)));
      // the last kept index walking from m in direction sgn
      const walk = (sgn) => {
        let run = 0;
        for (let i = m; sgn > 0 ? i + 1 < n : i > 0; i += sgn) {
          if (bad(i, i + sgn)) { if (++run >= 3) return i - sgn * 2; } else run = 0;
        }
        return sgn > 0 ? n - 1 : 0;
      };
      const hi = walk(1), lo = walk(-1);
      if (lo === 0 && hi === n - 1) return pts;
      return pts.slice(2 * lo, 2 * hi + 2);
    }
    // the smallest offset along u from q that float32 still separates from q in origin-relative GPU coordinates
    function f32Floor(q, u, o) {
      if (!o) return 0;
      let m = Infinity;
      const dx = Math.abs(q.re - o[0]), dy = Math.abs(q.im - o[1]);
      if (Math.abs(u.re) > 1e-12) m = Math.min(m, dx * 1.2e-7 / Math.abs(u.re));
      if (Math.abs(u.im) > 1e-12) m = Math.min(m, dy * 1.2e-7 / Math.abs(u.im));
      return Number.isFinite(m) ? m : 0;
    }
    // a formula contour that ends on an open side of the mesh's outer box continues as a ray (its last segment's
    // direction) toward the reach box, with geometric spacing and the tail stop
    function rayEnds(pts, c, win, mk) {
      const ob = c.outer, op = c.openSides || {}, tol = 2 * (c.cell || 0) + 1e-9 * Math.max(ob.x1 - ob.x0, ob.y1 - ob.y0);
      const onOpen = (z) => (op.x0 && Math.abs(z.re - ob.x0) <= tol) || (op.x1 && Math.abs(z.re - ob.x1) <= tol) || (op.y0 && Math.abs(z.im - ob.y0) <= tol) || (op.y1 && Math.abs(z.im - ob.y1) <= tol);
      const n = pts.length / 2;
      if (n < 2) return pts;
      const P = (i) => C(pts[2 * i], pts[2 * i + 1]);
      const ray = (e, prev) => {
        const d = CX.sub(e, prev), h0 = CX.abs(d), stop = mk ? mk(e) : null;
        if (!(h0 > 0)) return [];
        const u = CX.scale(d, 1 / h0), cl = clipLine(e, u, expandBox(win, REACH), 0);
        if (!cl) return [];
        const tEnd = CX.abs(CX.sub(cl[1], e)), out = [];
        let t = 0, h = h0;
        for (let i = 0; i < 4000; i++) {
          h *= RATIO; t += h;
          if (t >= tEnd) { out.push(cl[1]); break; }
          const z = add(e, CX.scale(u, t));
          out.push(z);
          if (stop && stop(z)) break;
        }
        return out;
      };
      const head = onOpen(P(0)) ? ray(P(0), P(1)).reverse() : [];
      const tailP = onOpen(P(n - 1)) ? ray(P(n - 1), P(n - 2)) : [];
      if (!head.length && !tailP.length) return pts;
      const out = new Float64Array(pts.length + 2 * (head.length + tailP.length));
      let k = 0;
      for (const z of head) { out[k++] = z.re; out[k++] = z.im; }
      out.set(pts, k); k += pts.length;
      for (const z of tailP) { out[k++] = z.re; out[k++] = z.im; }
      return out;
    }
    // the jump scan of an ineligible chain: located singular points [{z, on: true, w (bracket width)}]
    function jumpScan(pts, F, maxEval) {
      const n = pts.length / 2;
      if (n < 2 || !F) return [];
      let ev = 0;
      const at = (u) => { const i = Math.min(n - 2, Math.max(0, Math.floor(u))), f = u - i; return C(pts[2 * i] + f * (pts[2 * i + 2] - pts[2 * i]), pts[2 * i + 1] + f * (pts[2 * i + 3] - pts[2 * i + 1])); };
      const Fz = (u) => { ev++; return F(at(u)); };
      const stride = Math.max(1, Math.ceil((n - 1) / Math.max(1, Math.floor(maxEval / 3))));
      const us = [];
      for (let u = 0; u < n - 1; u += stride) us.push(u);
      us.push(n - 1);
      const W = us.map((u) => Fz(u));
      const found = [];
      for (let k = 0; k + 1 < us.length && ev < maxEval; k++) {
        let u0 = us[k], u1 = us[k + 1], w0 = W[k], w1 = W[k + 1];
        const um = (u0 + u1) / 2, wm = Fz(um);
        let bad = !fin(w0) || !fin(w1) || !fin(wm);
        const chord = bad ? 0 : Math.hypot(w1.re - w0.re, w1.im - w0.im);
        if (!bad) bad = Math.hypot(wm.re - (w0.re + w1.re) / 2, wm.im - (w0.im + w1.im) / 2) > 0.25 * chord && chord > 0;
        if (!bad || ev + 40 > maxEval) continue;
        // 40 bisection steps toward the half with the non-finite value or the larger change
        const big = (a, b) => (!fin(a) || !fin(b) ? Infinity : Math.hypot(b.re - a.re, b.im - a.im));
        let a0 = u0, a1 = u1, wa = w0, wb = w1;
        for (let it = 0; it < 40; it++) {
          const m = (a0 + a1) / 2, w = Fz(m);
          if (big(wa, w) >= big(w, wb)) { a1 = m; wb = w; } else { a0 = m; wa = w; }
        }
        // a real jump keeps a large change (or a non-finite value) over the final bracket; a smooth bend does not
        const jump = big(wa, wb);
        if (!(jump > 0.25 * Math.max(chord, 1e-300)) && Number.isFinite(jump)) continue;
        const za = at(a0), zb = at(a1);
        found.push({ z: C((za.re + zb.re) / 2, (za.im + zb.im) / 2), on: true, w: Math.hypot(zb.re - za.re, zb.im - za.im) });
      }
      return found;
    }
    // insertion on a straight polyline (lines, rays, segments, polygons, formula contours): per segment, the inserted
    // points with their order keys (offset of p's foot in the segment, signed distance); breaks where a curve passes p
    function insertStraight(pts, sps, caps) {
      const n = pts.length / 2;
      const P = (i) => C(pts[2 * i], pts[2 * i + 1]);
      const segs = [];
      for (let i = 0; i + 1 < n; i++) {
        const a = P(i), b = P(i + 1), d = CX.sub(b, a), h = CX.abs(d);
        segs.push({ a, b, h, u: h > 0 ? CX.scale(d, 1 / h) : C(1, 0) });
      }
      const ins = segs.map(() => []);
      const drop = new Uint8Array(n);
      let budget = caps.maxInsert;
      for (const sp of sps) {
        if (budget <= 1) break;
        const { j, p } = sp, sg = segs[j];
        let tq = (p.re - sg.a.re) * sg.u.re + (p.im - sg.a.im) * sg.u.im;
        const on = sp.on || sp.d <= 8 * EPS * (Math.abs(p.re) + Math.abs(p.im) + CX.abs(sg.a) + CX.abs(sg.b)) + 1e-300;
        const tol = 8 * EPS * (Math.abs(p.re) + Math.abs(p.im) + CX.abs(sg.a)) + 1e-300;
        let at = 0;                                   // 0 inside, 1 at the segment's start, 2 at its end
        if (tq <= tol) { tq = 0; at = 1; } else if (tq >= sg.h - tol) { tq = sg.h; at = 2; }
        const q = at === 1 ? sg.a : at === 2 ? sg.b : add(sg.a, CX.scale(sg.u, tq));
        const d0 = Math.min(sg.h, sp.lim);
        const lo = Math.max(1e-30 * caps.R, on ? (sp.w || 0) : sp.d / 10, f32Floor(q, sg.u, caps.origin));
        if (!(d0 > lo)) continue;
        const K = Math.min(Math.floor(Math.log(d0 / lo) / LN_R), Math.floor(budget / 2) - 1);
        if (K < 0) continue;
        budget -= 2 * (K + 1);
        if (on) {
          if (at === 1) drop[j] = 1; else if (at === 2) drop[j + 1] = 1;
          else ins[j].push({ tb: tq, sub: 0, brk: true });
        }
        for (const sgn of [-1, 1]) {
          // the run toward p ends once every map is done with it (its image wrapped, stopped moving or left TAIL_LIM)
          const stop = caps.stop ? caps.stop() : null;
          for (let k = 0, dk = d0; k <= K; k++, dk /= RATIO) {
            // inside segment j: keyed by p's foot and the signed distance (exact order however small dk is)
            const room = sgn < 0 ? tq : sg.h - tq;
            if (dk < room) {
              const z = add(q, CX.scale(sg.u, sgn * dk));
              ins[j].push({ tb: tq, sub: sgn * dk, z });
              if (stop && stop(z)) break;
              continue;
            }
            if (dk === room) continue;               // the vertex itself
            // past it: walk the polyline (corners followed), keyed by the offset in that segment
            let rem = dk - room, i = j + sgn;
            while (i >= 0 && i < segs.length && rem > segs[i].h) { rem -= segs[i].h; i += sgn; }
            if (i < 0 || i >= segs.length || rem === segs[i].h) continue;
            const s2 = segs[i];
            const tb = sgn < 0 ? s2.h - rem : rem;
            const z = sgn < 0 ? add(s2.b, CX.scale(s2.u, -rem)) : add(s2.a, CX.scale(s2.u, rem));
            ins[i].push({ tb, sub: 0, z });
            if (stop && stop(z)) break;
          }
        }
      }
      // assemble, with breaks
      const out = [];
      let cur = [];
      const flush = () => { if (cur.length >= 4) out.push(cur); cur = []; };
      const put = (z) => { const L = cur.length; if (L && cur[L - 2] === z.re && cur[L - 1] === z.im) return; cur.push(z.re, z.im); };
      for (let i = 0; i < n; i++) {
        if (drop[i]) flush(); else put(P(i));
        if (i < segs.length && ins[i].length) {
          ins[i].sort((x, y) => x.tb - y.tb || x.sub - y.sub);
          for (const e of ins[i]) { if (e.brk) flush(); else put(e.z); }
        }
      }
      flush();
      return out;
    }
    // insertion on a smooth parametric curve (circles, arcs): in its parameter, uniform samples i / n as today
    function insertParam(c, n, sps, caps) {
      const ss = [];
      for (let i = 0; i <= n; i++) ss.push({ s: i / n });
      let budget = caps.maxInsert;
      const closed = !!c.closed;
      for (const sp of sps) {
        if (budget <= 1) break;
        const { j, p } = sp;
        // p's foot: a ternary search of |f(s) - p| around the nearest chord
        let s0 = (j - 1) / n, s1 = (j + 2) / n;
        if (!closed) { s0 = Math.max(0, s0); s1 = Math.min(1, s1); }
        const g = (s) => { const z = c.f(s); return Math.hypot(z.re - p.re, z.im - p.im); };
        for (let it = 0; it < 80; it++) { const m1 = s0 + (s1 - s0) / 3, m2 = s1 - (s1 - s0) / 3; if (g(m1) <= g(m2)) s1 = m2; else s0 = m1; }
        let sp0 = (s0 + s1) / 2;
        const dist0 = g(sp0), e = 1e-7 / n, z1 = c.f(sp0 + e), z0 = c.f(sp0 - e);
        const speed = Math.hypot(z1.re - z0.re, z1.im - z0.im) / (2 * e);
        if (!(speed > 0)) continue;
        const on = sp.on || dist0 <= 1e-12 * (CX.abs(p) + caps.R);
        const d0 = Math.min(sp.h, sp.lim);
        const lo = Math.max(1e-30 * caps.R, on ? (sp.w || 0) : dist0 / 10, 4 * EPS * (Math.abs(sp0) + 1) * speed);
        if (!(d0 > lo)) continue;
        const K = Math.min(Math.floor(Math.log(d0 / lo) / LN_R), Math.floor(budget / 2) - 1);
        if (K < 0) continue;
        budget -= 2 * (K + 1);
        if (closed) sp0 = ((sp0 % 1) + 1) % 1;
        // (inserted parameters of a closed curve wrap around; the regular samples keep 0 and 1)
        const wrap = (s) => (closed ? (s < 0 ? s + 1 : s > 1 ? s - 1 : s) : s);
        for (const sgn of [-1, 1]) {
          const stop = caps.stop ? caps.stop() : null;
          for (let k = 0, dk = d0; k <= K; k++, dk /= RATIO) {
            const s1 = wrap(sp0 + sgn * dk / speed);
            ss.push({ s: s1 });
            if (stop && stop(c.f(s1))) break;
          }
        }
        if (on) ss.push({ s: sp0, brk: true });
      }
      const valid = ss.filter((e) => e.brk || (e.s >= 0 && e.s <= 1));
      valid.sort((x, y) => x.s - y.s || (x.brk ? 1 : 0) - (y.brk ? 1 : 0));
      const out = [];
      let cur = [], lastS = NaN;
      const flush = () => { if (cur.length >= 4) out.push(cur); cur = []; lastS = NaN; };
      for (let i = 0; i < valid.length; i++) {
        const e = valid[i];
        if (e.brk) {
          // drop the samples at p itself, then split
          while (cur.length && lastS === e.s) { cur.length -= 2; lastS = NaN; }
          flush();
          // skip samples equal to p's parameter after the break
          while (i + 1 < valid.length && valid[i + 1].s === e.s && !valid[i + 1].brk) i++;
          continue;
        }
        if (e.s === lastS) continue;
        const z = c.f(e.s);
        cur.push(z.re, z.im); lastS = e.s;
      }
      flush();
      // a closed curve split somewhere: join its last piece to its first (they meet where the loop started)
      if (closed && out.length >= 2 && valid.some((e) => e.brk)) {
        const last = out.pop(), first = out.shift();
        out.unshift(last.concat(first.slice(2)));
      }
      return out;
    }
    // the singular points within one sample step of the polyline: [{p, j (nearest segment), d, h, lim}], in sing order
    function nearPoints(pts, sing, R) {
      const n = pts.length / 2, out = [];
      if (n < 2) return out;
      let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity, hmax = 0;
      for (let i = 0; i < n; i++) { const x = pts[2 * i], y = pts[2 * i + 1]; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      for (let i = 0; i + 1 < n; i++) hmax = Math.max(hmax, Math.hypot(pts[2 * i + 2] - pts[2 * i], pts[2 * i + 3] - pts[2 * i + 1]));
      const seen = [];
      for (const e of sing) {
        const p = e.z;
        // one entry per location (a branch point that is also an accumulation point: z^i at 0)
        if (fin(p) && seen.some((q) => Math.hypot(q.re - p.re, q.im - p.im) <= 1e-12 * (1 + Math.abs(p.re) + Math.abs(p.im)))) continue;
        if (fin(p)) seen.push(p);
        if (!fin(p) || p.re < bx0 - hmax || p.re > bx1 + hmax || p.im < by0 - hmax || p.im > by1 + hmax) continue;
        let best = Infinity, bj = -1;
        for (let i = 0; i + 1 < n; i++) {
          const ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[2 * i + 2], by = pts[2 * i + 3];
          const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((p.re - ax) * dx + (p.im - ay) * dy) / L2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dd = Math.hypot(p.re - ax - t * dx, p.im - ay - t * dy);
          if (dd < best) { best = dd; bj = i; }
        }
        if (bj < 0) continue;
        const h = Math.hypot(pts[2 * bj + 2] - pts[2 * bj], pts[2 * bj + 3] - pts[2 * bj + 1]);
        if (!(best <= h) && !e.on) continue;
        out.push({ p, j: bj, d: best, h, on: !!e.on, w: e.w || 0, lim: Infinity });
      }
      // neighbouring points share the room between them (their sample runs do not overlap)
      for (const a of out) for (const b of out) if (a !== b) { const dd = Math.hypot(a.p.re - b.p.re, a.p.im - b.p.im); if (dd / 2 < a.lim) a.lim = dd / 2; }
      return out.filter((a) => a.lim > 0);
    }
    // Dash arc lengths for createLines' segment order (P4 review): per segment, the arc length of the polyline's image
    // under F at the segment start and the segment's image length. A long polyline (a sample farther than LONG_R x R
    // from c: lines, rays, half-plane boundaries, formula contours to the mesh's outer box) is measured from an anchor
    // near the view, the point of the polyline nearest c (the window centre) in the source, instead of its first
    // sample: reach tails start up to 1e19 (image) or 1e28 (source) away, where float32 no longer resolves a dash
    // period. The anchor is a source point, the same for today's samples and the refined ones (they agree near the
    // view), so the dash phase does not move when the refined samples are swapped in. A bounded polyline keeps today's
    // origin, its first sample. R: the window's half-diagonal. -> Float32Array [arc0, len0, arc1, len1, ...]
    const LONG_R = 50;
    function arcs(polys, F, c, R) {
      let n = 0;
      for (const p of polys) n += Math.max(0, p.length / 2 - 1);
      const data = new Float32Array(2 * n);
      let o = 0;
      for (const p of polys) {
        const m = p.length / 2;
        if (m < 2) continue;
        const acc = new Float64Array(m - 1), len = new Float64Array(m - 1);
        let pw = F(C(p[0], p[1]));
        if (!fin(pw)) pw = null;
        let bj = 0, bt = 0, best = Infinity;
        for (let i = 1; i < m; i++) {
          const w = F(C(p[2 * i], p[2 * i + 1])), ok = fin(w);
          len[i - 1] = ok && pw ? Math.hypot(w.re - pw.re, w.im - pw.im) : 0;
          pw = ok ? w : null;
          // the source point nearest c on this segment
          const ax = p[2 * i - 2], ay = p[2 * i - 1], dx = p[2 * i] - ax, dy = p[2 * i + 1] - ay, L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((c[0] - ax) * dx + (c[1] - ay) * dy) / L2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const d = Math.hypot(c[0] - ax - t * dx, c[1] - ay - t * dy);
          if (d < best) { best = d; bj = i - 1; bt = t; }
        }
        let far = 0;
        for (let i = 0; i < m; i++) far = Math.max(far, Math.abs(p[2 * i] - c[0]), Math.abs(p[2 * i + 1] - c[1]));
        if (!(far > LONG_R * R)) { bj = 0; bt = 0; }
        // accumulated outward from the anchor (a sum from the far end would lose the view's lengths in float64 too)
        acc[bj] = -bt * len[bj];
        for (let i = bj + 1; i < m - 1; i++) acc[i] = acc[i - 1] + len[i - 1];
        for (let i = bj - 1; i >= 0; i--) acc[i] = acc[i + 1] - len[i];
        for (let i = 0; i < m - 1; i++) { data[o++] = acc[i]; data[o++] = len[i]; }
      }
      return data;
    }
    function refine(curves, F, sing, caps = {}) {
      const win = caps.win;
      const Fs = (Array.isArray(F) ? F : F ? [F] : []).filter((f) => typeof f === 'function');
      const stop = Fs.length ? tailStop(Fs) : null;
      const R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2;
      const cp = { R, origin: caps.origin || null, maxInsert: caps.maxInsert ?? 8192, stop };
      const maxEval = caps.maxEval ?? 2048;
      const out = [];
      for (const c of curves) {
        if (!c) continue;
        let pts = sampleCurve(c, win, { tail: stop });
        if (c.long && c.reach) pts = cutUnresolved(pts, Fs, win);
        if (c.pts && c.outer && !c.closed) pts = rayEnds(pts, c, win, stop);
        if (pts.length < 4) continue;
        let list = sing ? sing.slice().sort((a, b) => boxDist(win, a.z) - boxDist(win, b.z)) : jumpScan(pts, Fs[0], maxEval);
        const sps = nearPoints(pts, list, R);
        if (!sps.length) { out.push(pts); continue; }
        const straight = !!(c.long || c.pts || (c.a && c.b));
        if (straight) { for (const q of insertStraight(pts, sps, cp)) out.push(new Float64Array(q)); continue; }
        const n = pts.length / 2 - 1;
        for (const q of insertParam(c, n, sps, cp)) out.push(q instanceof Float64Array ? q : new Float64Array(q));
      }
      return out;
    }
    return { refine, REACH, TAIL_LIM, jumpScan, arcs, unresolved };
  })();

  function defaultsFor(kind, z0, z1) {
    const a = [z0.re, z0.im], b = [z1.re, z1.im];
    const r = Math.hypot(z1.re - z0.re, z1.im - z0.im);
    switch (kind) {
      case 'point': return { p: a };
      case 'segment': case 'line': case 'ray': case 'halfplane': case 'rect': case 'cgrid': return { a, b, ...(kind === 'cgrid' ? { n: 8 } : {}) };
      case 'circle': case 'disc': return { c: a, r };
      case 'pgrid': return { c: a, r, nc: 6, nr: 12 };
      case 'annulus': return { c: a, r1: r / 2, r2: r };
      case 'sector': return { c: a, r, t1: 0, t2: 60 };
      case 'arc': {
        const mid = [(z0.re + z1.re) / 2 - (z1.im - z0.im) * 0.35, (z0.im + z1.im) / 2 + (z1.re - z0.re) * 0.35];
        return { a, m: mid, b };
      }
    }
    return {};
  }

  // ---------- shape geometry for the inverse renderer (SPEC 3.8; used by src/inverse.js) ----------
  // Additions only: nothing above calls these. All results are conservative (they may contain more than the shape).

  // The formula recognizer. A comparison of a real constant c with Re z, Im z, |Re z|, |Im z| or |z| (also x, y, r)
  // gives a box: Re z < c -> x1 = c; |Im z| < c -> y in [-c, c]; |z| < c -> x, y in [-c, c]; mirrored for >. 'and'
  // intersects boxes, 'or' takes their hull, 'not' and anything else give the whole plane. convex: the region IS the
  // box (exact and convex): true for the Re/Im/|Re|/|Im| comparisons and their intersections; |z| < c, 'or', 'not' and
  // unrecognised comparisons clear it. Returns {x0, x1, y0, y1, convex} (bounds may be infinite; x0 > x1: empty).
  const BOX_ALL = () => ({ x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity, convex: false });
  function formulaAstBox(ast) {
    const realConst = (n) => {
      if (!n || Expr.depends(n) || Expr.hasBool(n)) return null;
      try { const v = Expr.compile(n)(C(0, 0)); return v.im === 0 && Number.isFinite(v.re) ? v.re : null; } catch (e) { return null; }
    };
    const isZ = (n) => n && n.t === 'var' && n.n === 'z';
    // 'x', 'y', 'ax' (|Re z|), 'ay' (|Im z|), 'r' (|z|) or null
    const coordOf = (n) => {
      if (!n) return null;
      if (n.t === 'var') return n.n === 'x' ? 'x' : n.n === 'y' ? 'y' : n.n === 'r' ? 'r' : null;
      if (n.t !== 'call') return null;
      if (n.f === 're' && isZ(n.a)) return 'x';
      if (n.f === 'im' && isZ(n.a)) return 'y';
      if (n.f === 'abs') {
        if (isZ(n.a)) return 'r';
        const c = coordOf(n.a);
        return c === 'x' ? 'ax' : c === 'y' ? 'ay' : null;
      }
      return null;
    };
    const cmpBox = (n) => {
      let co = coordOf(n.a), c = realConst(n.b), less = n.op === '<' || n.op === '<=';
      if (!(co && c !== null)) { co = coordOf(n.b); c = realConst(n.a); less = !less; }
      if (!(co && c !== null)) return BOX_ALL();
      const b = { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity, convex: true };
      switch (co) {
        case 'x': if (less) b.x1 = c; else b.x0 = c; return b;
        case 'y': if (less) b.y1 = c; else b.y0 = c; return b;
        case 'ax': if (!less) return BOX_ALL(); b.x0 = -c; b.x1 = c; return b;
        case 'ay': if (!less) return BOX_ALL(); b.y0 = -c; b.y1 = c; return b;
        case 'r': if (!less) return BOX_ALL(); b.x0 = b.y0 = -c; b.x1 = b.y1 = c; b.convex = false; return b;
      }
      return BOX_ALL();
    };
    const go = (n) => {
      if (!n) return BOX_ALL();
      if (n.t === 'cmp') return cmpBox(n);
      if (n.t === 'and') {
        const a = go(n.a), b = go(n.b);
        return { x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), y0: Math.max(a.y0, b.y0), y1: Math.min(a.y1, b.y1), convex: a.convex && b.convex };
      }
      if (n.t === 'or') {
        const a = go(n.a), b = go(n.b);
        const ea = !(a.x0 <= a.x1 && a.y0 <= a.y1), eb = !(b.x0 <= b.x1 && b.y0 <= b.y1);
        if (ea) return Object.assign(b, { convex: false });
        if (eb) return Object.assign(a, { convex: false });
        return { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), convex: false };
      }
      return BOX_ALL();
    };
    return go(ast);
  }
  function formulaBox(s) {
    if (!s || s.kind !== 'formula') return BOX_ALL();
    try { return formulaAstBox(Expr.parse(s.expr, { allowRel: true })); } catch (e) { return BOX_ALL(); }
  }
  const boxBounded = (b) => Number.isFinite(b.x0) && Number.isFinite(b.x1) && Number.isFinite(b.y0) && Number.isFinite(b.y1);
  // [inf, sup] of <z, e> over a box with possibly infinite bounds (a zero component of e ignores that axis)
  function boxSupport(b, e) {
    if (!(b.x0 <= b.x1 && b.y0 <= b.y1)) return [Infinity, -Infinity];
    const part = (lo, hi, k) => (k > 0 ? [lo * k, hi * k] : k < 0 ? [hi * k, lo * k] : [0, 0]);
    const px = part(b.x0, b.x1, e.re), py = part(b.y0, b.y1, e.im);
    return [px[0] + py[0], px[1] + py[1]];
  }
  // Region.supportOf(s, e) -> [inf <z, e>, sup <z, e>] over the shape (<z, e> = Re(z conj e), e a unit vector);
  // +-Infinity when unbounded in that direction; conservative (SPEC 3.8 table)
  function supportOf(s, e) {
    const ALLR = [-Infinity, Infinity];
    if (!s || s.complement) return ALLR;
    const dot = (x, y) => x * e.re + y * e.im;
    switch (s.kind) {
      case 'disc': { const c = dot(s.c[0], s.c[1]); return [c - s.r, c + s.r]; }
      case 'annulus': { const c = dot(s.c[0], s.c[1]), r = Math.max(s.r1, s.r2); return [c - r, c + r]; }
      case 'rect': return boxSupport(bboxOf(s), e);
      case 'polygon': {
        if (!s.pts || !s.pts.length) return ALLR;
        let lo = Infinity, hi = -Infinity;
        for (const p of s.pts) { const v = dot(p[0], p[1]); if (v < lo) lo = v; if (v > hi) hi = v; }
        return [lo, hi];
      }
      case 'sector': if (s.r > 0) { const c = dot(s.c[0], s.c[1]); return [c - s.r, c + s.r]; } return ALLR;
      case 'halfplane': {
        const a = P(s.a), d = CX.sub(P(s.b), a), L = CX.abs(d);
        if (!(L > 0)) return ALLR;
        const n = C(-d.im / L, d.re / L), en = e.re * n.re + e.im * n.im, ae = dot(a.re, a.im);
        if (Math.abs(en) >= 1 - 1e-12) return en > 0 ? [ae, Infinity] : [-Infinity, ae];
        return ALLR;
      }
      case 'formula': return boxSupport(formulaBox(s), e);
    }
    return ALLR;
  }
  // convex polygon as the intersection of its edge half-planes (inside = left of a -> d), or null (not convex,
  // self-intersecting or degenerate)
  function convexPolyHalves(pts) {
    const n = pts.length;
    if (n < 3) return null;
    let area = 0, sgn = 0, turn = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    if (!(Math.abs(area) > 0)) return null;
    const or = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], c = pts[(i + 2) % n];
      const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
      const cr = ux * vy - uy * vx;
      if (cr * or < 0) return null;
      if (cr !== 0) sgn = 1;
      turn += Math.atan2(cr, ux * vx + uy * vy);
    }
    if (!sgn || Math.abs(Math.abs(turn) - TAU) > 1e-6) return null;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      out.push(or > 0 ? { t: 'half', a: [a[0], a[1]], d: [b[0] - a[0], b[1] - a[1]] } : { t: 'half', a: [b[0], b[1]], d: [a[0] - b[0], a[1] - b[1]] });
    }
    return out;
  }
  // Region.clipPrimitive(s) -> {in: pieces, hole: pieces | null, exact} | null (none: the whole line).
  // Pieces: {t: 'disc', c: [x, y], r} (|z - c| < r), {t: 'box', x0, x1, y0, y1} (bounds may be infinite),
  // {t: 'half', a: [x, y], d: [dx, dy]} (cross(d, z - a) > 0). The shape lies inside the intersection of the `in`
  // pieces (all of the line when there are none); the intersection of the `hole` pieces lies outside the shape.
  // exact: the shape is exactly (in) minus (hole). Used for member ranges along lines (Region.shapeClip; the GPU's
  // shapeClip implements the same pieces).
  function sectorGeom(s) {
    const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360;
    const u1 = [Math.cos(s.t1 * DEG), Math.sin(s.t1 * DEG)], u2 = [Math.cos((s.t1 + span) * DEG), Math.sin((s.t1 + span) * DEG)];
    return { span, u1, u2 };
  }
  function basePrimitive(s) {
    switch (s.kind) {
      case 'disc': return { in: [{ t: 'disc', c: [s.c[0], s.c[1]], r: s.r }], hole: null, exact: true };
      case 'rect': { const b = bboxOf(s); return { in: [{ t: 'box', x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }], hole: null, exact: true }; }
      case 'polygon': { const b = bboxOf(s); return { in: [{ t: 'box', x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }], hole: null, exact: false }; }
      case 'halfplane': return { in: [{ t: 'half', a: [s.a[0], s.a[1]], d: [s.b[0] - s.a[0], s.b[1] - s.a[1]] }], hole: null, exact: true };
      case 'annulus': {
        const r1 = Math.min(s.r1, s.r2), r2 = Math.max(s.r1, s.r2);
        return { in: [{ t: 'disc', c: [s.c[0], s.c[1]], r: r2 }], hole: [{ t: 'disc', c: [s.c[0], s.c[1]], r: r1 }], exact: true };
      }
      case 'sector': {
        const { span, u1, u2 } = sectorGeom(s), c = [s.c[0], s.c[1]];
        const disc = { t: 'disc', c, r: s.r };
        if (span >= 360) return { in: s.r > 0 ? [disc] : [], hole: null, exact: true };
        if (span <= 180) {
          const pcs = [{ t: 'half', a: c, d: u1 }, { t: 'half', a: c, d: [-u2[0], -u2[1]] }];
          if (s.r > 0) pcs.push(disc);
          return { in: pcs, hole: null, exact: true };
        }
        if (s.r > 0) return { in: [disc], hole: null, exact: false };                       // reflex: the disc as hull
        return { in: [], hole: [{ t: 'half', a: c, d: u2 }, { t: 'half', a: c, d: [-u1[0], -u1[1]] }], exact: true };
      }
      case 'formula': {
        const fb = formulaBox(s);
        if (!boxBounded(fb) && !fb.convex) return null;
        return { in: [{ t: 'box', x0: fb.x0, x1: fb.x1, y0: fb.y0, y1: fb.y1 }], hole: null, exact: !!fb.convex };
      }
    }
    return null;
  }
  function clipPrimitive(s) {
    if (!s || !K[s.kind] || K[s.kind].type !== 'area') return null;
    if (!s.complement) return basePrimitive(s);
    switch (s.kind) {
      case 'halfplane': return { in: [{ t: 'half', a: [s.a[0], s.a[1]], d: [s.a[0] - s.b[0], s.a[1] - s.b[1]] }], hole: null, exact: true };
      case 'polygon': {
        const hv = convexPolyHalves(s.pts || []);
        return hv ? { in: [], hole: hv, exact: true } : { in: [], hole: null, exact: false };
      }
      case 'sector': {
        const { span, u1, u2 } = sectorGeom(s), c = [s.c[0], s.c[1]];
        if (!(s.r > 0)) {
          if (span >= 360) return { in: [{ t: 'box', x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }], hole: null, exact: true };
          if (span > 180) return { in: [{ t: 'half', a: c, d: u2 }, { t: 'half', a: c, d: [-u1[0], -u1[1]] }], hole: null, exact: true };
        }
        break;
      }
    }
    const b = basePrimitive(Object.assign({}, s, { complement: false }));
    if (b && b.exact && !b.hole && b.in.length) return { in: [], hole: b.in, exact: true };
    return { in: [], hole: null, exact: false };
  }
  // Region.convexOf(s): the shape is convex and clipPrimitive describes it exactly (disc, rect, halfplane, sector with
  // span <= 180 deg, a convex formula box, the complement of a half-plane or of a reflex wedge)
  function convexOf(s) {
    const p = clipPrimitive(s);
    return !!(p && p.exact && !p.hole);
  }
  // Region.shapeClip(prim, z0, q, margin = 0) -> {lo, hi, hlo, hhi}: the parameters t with z0 + t q inside the
  // in-pieces form [lo, hi] (lo > hi: empty); (hlo, hhi) is the hole (hlo > hhi: none). prim: a clipPrimitive or a
  // shape. margin (z units, >= 0) grows every in-piece and shrinks every hole piece by that distance, so points within
  // margin of the shape (anti-aliasing) still fall in [lo, hi] and outside the hole.
  const EMPTY_T = { lo: Infinity, hi: -Infinity };
  function clipPiece(pc, z0, q, m) {
    const qq = q.re * q.re + q.im * q.im;
    if (pc.t === 'disc') {
      // projection form (review P1, finding 6): the foot of the perpendicular from c, t_c = <c - z0, q> / |q|^2, and the
      // distance h = |cross(q, c - z0)| / |q| of c from the line; half chord sqrt((r - h)(r + h)) / |q|. The quadratic
      // b^2 - |q|^2 (|z0 - c|^2 - r^2) loses r^2 against |z0 - c|^2 when the line origin is far from the disc (float64:
      // no members at all for |z0 - c| / r ~ 1e8; float32 already at ~1e3). The GLSL shapeClip uses this same form.
      const r = pc.r + m;
      if (!(r > 0) || !(qq > 0)) return EMPTY_T;
      const dx = pc.c[0] - z0.re, dy = pc.c[1] - z0.im, ql = Math.sqrt(qq);
      const tc = (dx * q.re + dy * q.im) / qq, h = Math.abs(q.re * dy - q.im * dx) / ql;
      if (!(h <= r)) return EMPTY_T;
      const half = Math.sqrt((r - h) * (r + h)) / ql;
      return { lo: tc - half, hi: tc + half };
    }
    if (pc.t === 'half') {
      const L0 = pc.d[0] * (z0.im - pc.a[1]) - pc.d[1] * (z0.re - pc.a[0]) + (m ? m * Math.hypot(pc.d[0], pc.d[1]) : 0), cq = pc.d[0] * q.im - pc.d[1] * q.re;
      if (!(Math.abs(cq) > 1e-300)) return L0 > 0 ? { lo: -Infinity, hi: Infinity } : EMPTY_T;
      const t = -L0 / cq;
      return cq > 0 ? { lo: t, hi: Infinity } : { lo: -Infinity, hi: t };
    }
    if (pc.t === 'box') {
      const x0 = pc.x0 - m, x1 = pc.x1 + m, y0 = pc.y0 - m, y1 = pc.y1 + m;
      if (!(x0 <= x1 && y0 <= y1)) return EMPTY_T;
      let lo = -Infinity, hi = Infinity;
      const slab = (p0, dq, a, b) => {
        if (!(Math.abs(dq) > 1e-300)) { if (!(p0 >= a && p0 <= b)) { lo = Infinity; hi = -Infinity; } return; }
        const t1 = (a - p0) / dq, t2 = (b - p0) / dq;
        lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
      };
      slab(z0.re, q.re, x0, x1); slab(z0.im, q.im, y0, y1);
      return { lo, hi };
    }
    return { lo: -Infinity, hi: Infinity };
  }
  function shapeClip(prim, z0, q, margin = 0) {
    if (prim && prim.kind) prim = clipPrimitive(prim);
    const out = { lo: -Infinity, hi: Infinity, hlo: Infinity, hhi: -Infinity };
    if (!prim) return out;
    const m = margin > 0 ? margin : 0;
    for (const pc of prim.in) { const r = clipPiece(pc, z0, q, m); out.lo = Math.max(out.lo, r.lo); out.hi = Math.min(out.hi, r.hi); }
    if (prim.hole) {
      let lo = -Infinity, hi = Infinity;
      for (const pc of prim.hole) { const r = clipPiece(pc, z0, q, -m); lo = Math.max(lo, r.lo); hi = Math.min(hi, r.hi); }
      if (lo < hi) { out.hlo = lo; out.hhi = hi; }
    }
    return out;
  }

  return { KINDS: K, FAR, Lines, meshInstances, isOpen, sampleCurve, polyCurve: poly, levelOf, bboxOf, curvesOf, handlesOf, setHandle, translate, hitTest, buildMesh, mapMesh, mapCurve, defaultsFor, expandBox, clipLine, arc3,
    supportOf, clipPrimitive, shapeClip, convexOf, formulaBox };
})();
// SPEC 9.1: the settle-time line refinement (Region.Lines)
const Lines = Region.Lines;
if (typeof module !== 'undefined') module.exports = Region;
