// @ts-check
'use strict';
// Regions: shapes (points, curves, areas), meshing of areas, adaptive mapping of curves.
const Region = (() => {
  const { C } = CX;
  const DEG = Math.PI / 180;
  const TAU = 2 * Math.PI;
  const P = (a) => C(a[0], a[1]);
  const fmt = (z) => CX.tex(z, 3);
  // [a,b]; in Russian and Italian a semicolon when an endpoint has a decimal comma: [0{,}5;\\,1] (GLOSSARY 2.3)
  const iv = (a, b) => `[${a}${I18N.comma() && /\{,\}/.test(a + b) ? ';\\,' : ','}${b}]`;
  // (a rational multiple of pi with a small denominator, exactly as stored, is written symbolically: pi, 3pi/2)
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const num = (x) => {
    if (Number.isFinite(x) && Math.abs(x) > 1e-12) {
      for (const d of [1, 2, 3, 4, 6]) {
        const k = Math.round(x * d / Math.PI);
        if (k && Math.abs(k) <= 24 && Math.abs(x - k * Math.PI / d) <= 1e-9 * Math.abs(x)) {
          const g = gcd(Math.abs(k), d), a = Math.abs(k) / g, dd = d / g, nu = a === 1 ? '\\pi' : `${a}\\pi`;
          return (k < 0 ? '-' : '') + (dd === 1 ? nu : `\\tfrac{${nu}}{${dd}}`);
        }
      }
    }
    // the decimal comma of Russian and Italian print, as CX.tex writes it (0{,}5; also the mantissa of 1{,}5×10⁻⁴)
    const s = CX.fmtNum(x, 3);
    return I18N.comma() ? s.replace(/^-?[\d.]+/, (m) => I18N.texNum(m)) : s;
  };
  // the normal form of a line or half-plane whose direction b - a is a unit vector (one stored from a cap on a globe,
  // panels.md 9.3: a on the edge nearest 0, b = a - iB/|B|): the left side is Re(conj(n) z) > t with n = i(b - a) and
  // t = Re(conj(n) a), written as Re z or Im z against t when n is an axis, else as Re(e^{-i phi} z) (the chip's form).
  // rel: '>' (half-plane) or '=' (line). null for another length (two points drawn in the plane keep their form)
  function normalTex(s, rel) {
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l = Math.hypot(dx, dy);
    if (!(Math.abs(l - 1) < 1e-9)) return null;
    const n = [-dy / l, dx / l], t = n[0] * s.a[0] + n[1] * s.a[1], rev = rel === '>' ? '<' : rel;
    if (Math.abs(n[0]) < 1e-12) return `\\operatorname{Im}z${n[1] > 0 ? rel : rev}${num(t * Math.sign(n[1]))}`;
    if (Math.abs(n[1]) < 1e-12) return `\\operatorname{Re}z${n[0] > 0 ? rel : rev}${num(t * Math.sign(n[0]))}`;
    const ang = Math.atan2(n[1], n[0]) * 180 / Math.PI;
    return `\\operatorname{Re}\\left(e^{${ang > 0 ? '-' : ''}${num(Math.abs(ang))}^\\circ i}z\\right)${rel}${num(t)}`;
  }
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
    type: 'point', label: $t('Point'),
    handles: (s) => [['p', P(s.p)]],
    points: (s) => [P(s.p)],
    tex: (s) => `${fmt(P(s.p))}`,
  };
  K.segment = {
    type: 'curve', label: $t('Segment'),
    handles: (s) => [['a', P(s.a)], ['b', P(s.b)]],
    curves: (s) => [seg(P(s.a), P(s.b))],
    tex: (s) => `[${fmt(P(s.a))},\\ ${fmt(P(s.b))}]`,
  };
  K.line = {
    type: 'curve', label: $t('Line'),
    handles: (s) => [['a', P(s.a)], ['b', P(s.b)]],
    curves: (s, win, o) => {
      const a = P(s.a), d = CX.sub(P(s.b), a);
      const c = longOf(a, d, win, -Infinity, o);
      return c ? [c] : [];
    },
    tex: (s) => normalTex(s, '=') || $t('\\text{line through } %{a},\\ %{b}', { a: fmt(P(s.a)), b: fmt(P(s.b)) }),
  };
  K.ray = {
    type: 'curve', label: $t('Ray'),
    handles: (s) => [['a', P(s.a)], ['b', P(s.b)]],
    curves: (s, win, o) => {
      const a = P(s.a), d = CX.sub(P(s.b), a);
      const c = longOf(a, d, win, 0, o);
      return c ? [c] : [];
    },
    tex: (s) => $t('\\text{ray from } %{a} \\text{ through } %{b}', { a: fmt(P(s.a)), b: fmt(P(s.b)) }),
  };
  K.circle = {
    type: 'curve', label: $t('Circle'),
    handles: (s) => [['c', P(s.c)], ['r', C(s.c[0] + s.r, s.c[1])]],
    curves: (s) => [circ(P(s.c), s.r)],
    tex: (s) => `|${zMinus(P(s.c))}|=${num(s.r)}`,
  };
  K.arc = {
    type: 'curve', label: $t('Arc'),
    handles: (s) => [['a', P(s.a)], ['m', P(s.m)], ['b', P(s.b)]],
    curves: (s) => [arc3(P(s.a), P(s.m), P(s.b))],
    tex: (s) => $t('\\text{arc } %{a} \\to %{m} \\to %{b}', { a: fmt(P(s.a)), m: fmt(P(s.m)), b: fmt(P(s.b)) }),
  };
  K.curve = {
    type: 'curve', label: $t('Freehand curve'),
    handles: () => [],
    curves: (s) => { const c = poly(s.pts.map(P), false); return c ? [c] : []; },
    tex: (s) => $tn('\\text{curve, %{n} points}', '\\text{curve, %{n} points}', s.pts.length),
  };
  K.cgrid = {
    type: 'curve', label: $t('Cartesian grid'),
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
    tex: (s) => $t('\\text{grid } %{x}\\times%{y}', { x: iv(num(Math.min(s.a[0], s.b[0])), num(Math.max(s.a[0], s.b[0]))), y: iv(num(Math.min(s.a[1], s.b[1])), num(Math.max(s.a[1], s.b[1]))) }),
  };
  K.pgrid = {
    type: 'curve', label: $t('Polar grid'),
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
    tex: (s) => $t('\\text{polar grid}, |%{c}|\\le %{r}', { c: zMinus(P(s.c)), r: num(s.r) }),
  };
  // ----- [issue #260] external rays and equipotentials of the Mandelbrot set (s.c null) or of the Julia set of
  // z² + c (s.c = [re, im], the step's c; a shared number's name in s.bind.c, as every bound field) -----
  // dhray: s.theta '1/3' (exact: the angle doubles in integers) or a decimal turn; the ray from |z| = 10⁴ down to 2^−40
  // of that potential, then its landing point (CX.dhLanding) when it has one. dheq: s.r = |Φ| > 1 (> e^{G_c(0)})
  // dhAngle('1/3') -> {p, q}, '0.25' -> 0.25, else null
  function dhAngle(t) {
    const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(String(t ?? ''));
    if (m) { const p = +m[1], q = +m[2]; return q >= 1 && q <= 2 ** 30 && p < q ? { p, q } : null; }
    const x = Number(t);
    return String(t ?? '').trim() !== '' && Number.isFinite(x) && x >= 0 && x < 1 ? x : null;
  }
  const dhC = (s) => (s.c == null ? null : Array.isArray(s.c) && Number.isFinite(s.c[0]) && Number.isFinite(s.c[1]) ? C(s.c[0], s.c[1]) : undefined);
  // The traces, by shape (its kind, angle or level and c): DH_MEMO holds each key's best result so far, {curve, full}.
  // Synchronously (node, or before the app turns on Region.dhAsync) a key is traced in full at once. In the app a key
  // not yet traced gets a quick curve of exact points at once (the shape's previous curve moved to the new c by
  // CX.dhFollow, thinned to DH_FOLLOW points; else a coarse trace), and its full trace runs in slices of DH_SLICE_MS
  // once c has rested for DH_REST_MS (#299 review: a c on Play re-traced every curve on the main thread, 300 ms
  // frames); Region.dhAsync.ready() then redraws, and dhStamp (part of the app's shape key) tells it the curve changed
  const DH_MEMO = new Map(), DH_LAST = new Map();
  const DH_S = 16, DH_LEVELS = 40, DH_FOLLOW = 160, DH_REST_MS = 200, DH_SLICE_MS = 8;
  const dhMemoSet = (key, v) => { DH_MEMO.delete(key); DH_MEMO.set(key, v); while (DH_MEMO.size > 48) DH_MEMO.delete(DH_MEMO.keys().next().value); };
  // the key of a shape's trace, and what to trace for it: {key, kindKey (the shape without its c), gen(o), quick}
  function dhJob(s) {
    const c = dhC(s);
    if (c === undefined) return null;
    const ck = c && [c.re, c.im];
    if (s.kind === 'dhray') {
      const th = dhAngle(s.theta);
      if (th == null) return null;
      return {
        key: JSON.stringify(['ray', th, ck]), kindKey: JSON.stringify(['ray', th, s.id]),
        gen: () => CX.dhRayGen(th, { c, R0: CX.DH_R, S: DH_S, levels: DH_LEVELS }),
        coarse: () => CX.dhRay(th, { c, R0: CX.DH_R, S: 2, levels: 16 }), c,
      };
    }
    const r = Number(s.r);
    if (!(r > 1)) return null;
    return {
      key: JSON.stringify(['eq', r, ck]), kindKey: JSON.stringify(['eq', r, s.id]),
      gen: () => CX.dhEquipotentialGen(Math.log(r), { c, tol: 0.01 * r, R0: CX.DH_R }),
      coarse: () => CX.dhEquipotential(Math.log(r), { c, K: 16, S: 2, tol: Infinity, R0: CX.DH_R }), c,
    };
  }
  // every n-th point of a traced curve (the ends kept), with its angles and potentials, for dhFollow
  function dhEvery(curve, max) {
    const P = curve.pts || curve, n = P.length, k = Math.max(1, Math.ceil(n / max));
    if (k === 1) return curve;
    const idx = [];
    for (let i = 0; i < n; i += k) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    if (curve.pts) return Object.assign({}, curve, { pts: idx.map((i) => P[i]), pot: idx.map((i) => curve.pot[i]), landed: null, full: false });
    return Object.assign(idx.map((i) => P[i]), { th: idx.map((i) => curve.th[i]), L: curve.L, c: curve.c });
  }
  let dhQueue = [], dhTimer = null;
  function dhSchedule(job) {
    dhQueue = dhQueue.filter((q) => q.kindKey !== job.kindKey);
    dhQueue.push(job);
    clearTimeout(dhTimer);
    dhTimer = setTimeout(dhRun, DH_REST_MS);
  }
  // the full traces, a slice at a time; a trace whose key a newer request replaced is dropped
  function dhRun() {
    dhTimer = null;
    const t0 = performance.now();
    while (dhQueue.length && performance.now() - t0 < DH_SLICE_MS) {
      const q = dhQueue[0];
      if (!q.it) q.it = q.gen();
      let r;
      while (!(r = q.it.next()).done && performance.now() - t0 < DH_SLICE_MS) { /* trace */ }
      if (!r.done) break;
      dhQueue.shift();
      dhMemoSet(q.key, { curve: r.value, full: true });
      DH_LAST.set(q.kindKey, r.value);
      if (Region.dhAsync && Region.dhAsync.ready) Region.dhAsync.ready();
    }
    if (dhQueue.length) dhTimer = setTimeout(dhRun, 0);
  }
  // the best curve for shape s now: the full trace, else (in the app) a quick one, with the full trace scheduled
  function dhCurve(s) {
    const job = dhJob(s);
    if (!job) return null;
    const have = DH_MEMO.get(job.key);
    if (have && have.full) return have.curve;
    if (!Region.dhAsync) {
      const g = job.gen();
      let r;
      while (!(r = g.next()).done) { /* trace */ }
      dhMemoSet(job.key, { curve: r.value, full: true });
      DH_LAST.set(job.kindKey, r.value);
      return r.value;
    }
    if (!have) {
      const last = DH_LAST.get(job.kindKey);
      let quick = last ? CX.dhFollow(dhEvery(last, DH_FOLLOW), job.c) : null;
      if (!quick) quick = job.coarse();
      dhMemoSet(job.key, { curve: quick, full: false });
      DH_LAST.set(job.kindKey, quick);
    }
    dhSchedule(job);
    return DH_MEMO.get(job.key).curve;
  }
  // 'f' when shape s's curve is its full trace, 'q' while it is a quick one ('' for other kinds): the app's shape key
  // holds it, so a full trace that lands redraws the shape
  function dhStamp(s) {
    if (s.kind !== 'dhray' && s.kind !== 'dheq') return '';
    const job = dhJob(s), have = job && DH_MEMO.get(job.key);
    return have ? (have.full ? 'f' : 'q') : '';
  }
  // the points a view can tell apart: each kept point at least tol from the last one kept (the ends always), so a
  // ray's thousand points near its landing point are not all mapped and drawn at every frame (the line renderer
  // evaluates the chain at every vertex)
  function dhThin(pts, tol) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) { const a = out[out.length - 1], b = pts[i]; if (Math.hypot(b.re - a.re, b.im - a.im) >= tol) out.push(b); }
    if (pts.length > 1) out.push(pts[pts.length - 1]);
    return out;
  }
  // (a fifth of a pixel of the 1440-pixel view)
  const dhTol = (win) => (win ? Math.max(win.x1 - win.x0, win.y1 - win.y0) / 7200 : 0);
  function dhRayCurves(s, win) {
    const r = dhCurve(s);
    if (!r || !r.pts.length) return [];
    // (the landing point, of a full trace that reached it)
    const L = r.full || r.landed ? CX.dhLanding(r, DH_S) : null;
    const pts = L && !(r.landed && CX.abs(CX.sub(L.z, r.pts[r.pts.length - 1])) === 0) ? r.pts.concat([L.z]) : r.pts;
    const k = poly(dhThin(pts, dhTol(win)), false);
    return k ? [k] : [];
  }
  function dhEqCurves(s) {
    const pts = dhCurve(s);
    const k = pts && pts.length > 2 ? poly(pts, true) : null;
    return k ? [k] : [];
  }
  // arg Φ_M(z) = 2π·θ, arg φ_c(z) = 2π·θ (c by its name when it has one), |Φ_M(z)| = r
  const dhFn = (s) => {
    if (s.c == null) return '\\Phi_M(z)';
    let t = null;
    if (s.bind && typeof s.bind.c === 'string') { try { t = Expr.toTex(Expr.parse(s.bind.c)).s; } catch (e) { t = null; } }
    const c = dhC(s);
    return `\\varphi_{${t || (c ? fmt(c) : 'c')}}(z)`;
  };
  const dhTheta = (t) => { const a = dhAngle(t); return a == null ? '?' : typeof a === 'number' ? num(a) : `\\tfrac{${a.p}}{${a.q}}`; };
  K.dhray = {
    type: 'curve', label: $t('External ray'),
    handles: () => [],
    curves: dhRayCurves,
    tex: (s) => `\\arg ${dhFn(s)}=2\\pi\\cdot ${dhTheta(s.theta)}`,
  };
  K.dheq = {
    type: 'curve', label: $t('Equipotential'),
    handles: () => [],
    curves: dhEqCurves,
    tex: (s) => `|${dhFn(s)}|=${num(Number(s.r))}`,
  };
  // ----- areas -----
  K.disc = {
    type: 'area', label: $t('Disc'),
    handles: (s) => [['c', P(s.c)], ['r', C(s.c[0] + s.r, s.c[1])]],
    level: (s) => { const c = P(s.c), r = s.r; return (z) => r - Math.hypot(z.re - c.re, z.im - c.im); },
    bbox: (s) => ({ x0: s.c[0] - s.r, x1: s.c[0] + s.r, y0: s.c[1] - s.r, y1: s.c[1] + s.r }),
    boundary: (s) => [circ(P(s.c), s.r)],
    tex: (s) => `|${zMinus(P(s.c))}|<${num(s.r)}`,
  };
  K.rect = {
    type: 'area', label: $t('Rectangle'),
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
    type: 'area', label: $t('Polygon'),
    handles: (s) => (s.pts.length <= 40 ? s.pts.map((p, i) => ['v' + i, P(p)]) : []),
    level: (s) => polyLevel(s.pts.map(P)),
    bbox: (s) => ({ x0: Math.min(...s.pts.map((p) => p[0])), x1: Math.max(...s.pts.map((p) => p[0])), y0: Math.min(...s.pts.map((p) => p[1])), y1: Math.max(...s.pts.map((p) => p[1])) }),
    boundary: (s) => { const c = poly(s.pts.map(P), true); return c ? [c] : []; },
    tex: (s) => $tn('\\text{polygon, %{n} vertices}', '\\text{polygon, %{n} vertices}', s.pts.length),
  };
  K.halfplane = {
    type: 'area', label: $t('Half-plane'),
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
    // (a half-plane with no unit normal is said in words: the side to the left of the line from a to b)
    tex: (s) => normalTex(s, '>') || $t('\\text{left of the line from } %{a} \\text{ to } %{b}', { a: fmt(P(s.a)), b: fmt(P(s.b)) }),
  };
  K.annulus = {
    type: 'area', label: $t('Annulus'),
    handles: (s) => [['c', P(s.c)], ['r1', C(s.c[0] + s.r1, s.c[1])], ['r2', C(s.c[0] + s.r2, s.c[1])]],
    level: (s) => { const c = P(s.c), r1 = Math.min(s.r1, s.r2), r2 = Math.max(s.r1, s.r2); return (z) => { const d = Math.hypot(z.re - c.re, z.im - c.im); return Math.min(d - r1, r2 - d); }; },
    bbox: (s) => { const r = Math.max(s.r1, s.r2); return { x0: s.c[0] - r, x1: s.c[0] + r, y0: s.c[1] - r, y1: s.c[1] + r }; },
    boundary: (s) => [circ(P(s.c), s.r1), circ(P(s.c), s.r2)],
    tex: (s) => `${num(Math.min(s.r1, s.r2))}<|${zMinus(P(s.c))}|<${num(Math.max(s.r1, s.r2))}`,
  };
  K.sector = {
    type: 'area', label: $t('Sector'),
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
    type: 'area', label: $t('Formula'),
    handles: () => [],
    level: (s) => Expr.compileLevel(Expr.parse(s.expr, { allowRel: true })),
    bbox: () => null,
    boundary: null,
    tex: (s) => { try { return Expr.toTex(Expr.parse((s.bind && s.bind.expr) || s.expr, { allowRel: true })).s; } catch (e) { return $t('\\text{invalid}'); } },
  };

  // A curve formula (an equation: Re z^2 = 1, |\sin z| = 1, Im(1/z) = 1 and z\bar z = 1 or ...): the curve of
  // Curves.fromFormula(s.expr) (notes/curves-design.md). The app adds formulas whose every piece Curves recognizes
  // exactly as its own line / ray / segment / circle / arc / point shapes (with handles); this kind holds the source
  // text of the rest (traced curves, mixed ones), whose exact pieces are still drawn exactly. Traced pieces are traced
  // in traceWin(win), so pans and small zooms reuse a trace.
  const curveDescs = new Map();
  function curveDesc(s) {
    const src = String(s.expr);
    let d = curveDescs.get(src);
    if (d) { curveDescs.delete(src); curveDescs.set(src, d); return d; }
    d = Curves.fromFormula(src);
    curveDescs.set(src, d);
    while (curveDescs.size > 32) curveDescs.delete(curveDescs.keys().next().value);
    return d;
  }
  // the window a curve formula is traced in for the window win: its size rounded up to a power of 2 and its centre
  // snapped to an eighth of that, half-size 9/16 of it (so it holds win)
  function traceWin(win) {
    const m = Math.max(win.x1 - win.x0, win.y1 - win.y0);
    if (!(m > 0) || !Number.isFinite(m) || !Number.isFinite(win.x0 + win.y0)) return win;
    const S = Math.pow(2, Math.ceil(Math.log2(m))), q = S / 8, h = S * 9 / 16;
    const cx = Math.round((win.x0 + win.x1) / 2 / q) * q, cy = Math.round((win.y0 + win.y1) / 2 / q) * q;
    return { x0: cx - h, x1: cx + h, y0: cy - h, y1: cy + h };
  }
  // The trace window of a description for win: the last one while it still holds win and win is at least a third
  // of its size (a pan or zoom of the pane re-traces only when it leaves that), else traceWin(win). The curve
  // objects of a trace window are kept too (hit tests and the w-plane's strokes ask every frame). Samples are spaced
  // at most the trace window's diagonal / 1600 (Curves' default is / 700), so even at a third of its size the window
  // gets samples as fine as a trace of its own.
  const inWin = (a, b) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1;
  function fcurveWin(d, win) {
    const m = Math.max(win.x1 - win.x0, win.y1 - win.y0);
    let tw = d._tw;
    if (!tw || !inWin(win, tw) || m < (tw.x1 - tw.x0) / 3) tw = d._tw = traceWin(win);
    return tw;
  }
  // (a trace stops after 2 s with a note: parts may be missing)
  const fcOpt = (tw) => ({ maxMs: 2000, step: Math.hypot(tw.x1 - tw.x0, tw.y1 - tw.y0) / 1600 });
  // the trace a curve formula is drawn from in the window win (its notes: budget, touching zeros)
  function fcurveTrace(s, win) { const d = curveDesc(s), tw = fcurveWin(d, win); return Curves.trace(d, tw, fcOpt(tw)); }
  function fcurveCurves(s, win, o) {
    const d = curveDesc(s);
    const tw = fcurveWin(d, win);
    const key = [tw.x0, tw.x1, tw.y0, tw.y1, o && o.reach === 'sphere' ? 's' : 'f'].join(',');
    const memo = d._cm || (d._cm = new Map());
    let cs = memo.get(key);
    if (!cs) {
      cs = Curves.curvesOf(d, tw, Object.assign(fcOpt(tw), o));
      memo.set(key, cs);
      while (memo.size > 6) memo.delete(memo.keys().next().value);
    }
    return cs;
  }
  K.fcurve = {
    type: 'curve', label: $t('Curve formula'),
    handles: () => [],
    curves: fcurveCurves,
    tex: (s) => { try { return Expr.toTex(Expr.parse((s.bind && s.bind.expr) || s.expr, { allowRel: true })).s; } catch (e) { return $t('\\text{invalid}'); } },
  };

  // ---------- v16: the exact gcircle form (notes/constructions-v16/SPEC.md 2.2) ----------
  // Region.formOf(s): the runtime form s._g of a constructed circle, line, disc or half-plane ({o, A, B, C}: f(z) =
  // A|z - o|^2 + 2 Re(conj(B)(z - o)) + C, f < 0 on its left side, the region), else the form of the shape's own
  // fields (Constr.formOfFields: disc, circle, half-plane, line), else null (other kinds, or no constr.js)
  function formOf(s) {
    if (s && s._g) return s._g;
    return Constr.formOfFields ? Constr.formOfFields(s) : null;
  }
  // the level -f/2 of a form: positive inside, the signed distance near the curve at any radius (float64, relative
  // to the anchor o, so no centre far away enters)
  function formLevel(G) {
    const ox = G.o[0], oy = G.o[1], A = G.A, bx = G.B[0], by = G.B[1], c0 = G.C;
    return (z) => { const ux = z.re - ox, uy = z.im - oy; return -0.5 * (A * (ux * ux + uy * uy) + 2 * (bx * ux + by * uy) + c0); };
  }
  // a gcircle disc (or its complement) or half-plane: its region is the form's left side (the complement is in the form)
  const gArea = (s) => !!(s && s._g && (s.kind === 'disc' || s.kind === 'halfplane'));
  // circles far larger than the window (r > MR_RATIO x its diagonal), and gcircles, are drawn as M(R) (SPEC 2.2 [C7]):
  // dense near the view, geometric beyond, the far arc through the antipode present (160 equal angles would put no
  // sample in the window, and 1/z maps the far arc next to 0)
  const MR_RATIO = 50;
  function mrCurve(G, win) {
    const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2, diag = Math.hypot(win.x1 - win.x0, win.y1 - win.y0);
    const H = Constr.reanchor(G, [cx, cy]), H0 = Object.assign({}, H, { C: 0 });
    const f = (s) => { const z = Constr.mR(H0, diag * Math.tan(Math.PI * (s - 0.5))); return z === Constr.INF ? C(NaN, NaN) : C(z[0], z[1]); };
    return { f, n0: 400, closed: true, gform: G, gsamp: (w, step) => Constr.sampleMR(G, w || win, step) };
  }
  // (review regress-2: constructions only, s._g; a plain v15 circle or disc keeps v15.1's sampling and cost)
  function bigCircle(s, win) {
    if (!win || !s._g || !(s.kind === 'circle' || s.kind === 'disc') || !Constr.sampleMR) return null;
    const G = formOf(s);
    if (!G || G.A === 0) return null;
    const diag = Math.hypot(win.x1 - win.x0, win.y1 - win.y0);
    if (!(1 / Math.abs(G.A) > MR_RATIO * diag) || !Number.isFinite(diag)) return null;
    return mrCurve(G, win);
  }

  // ---------- shape API ----------
  function levelOf(s) {
    if (gArea(s)) return formLevel(s._g);
    const L = K[s.kind].level(s);
    return s.complement ? (z) => -L(z) : L;
  }
  function bboxOf(s) {
    if (s.complement) return null;
    const b = K[s.kind].bbox && K[s.kind].bbox(s);
    return b || null;
  }
  // (v16.4: a perpendicular circle drawn inside its curve only, notes/orthogonal-circle/segments) the arc's open curves:
  // a circle's from Constr.segCurves; on a line (review math-1, math-4) the chord is a segment, and the ray, or the two
  // rays through infinity, are the line kinds' long rays (the FAR clip and, with {reach: 'sphere'}, c.reach), so the
  // settle refinement, its tails and curvePieces' clip treat them as a whole line; each runs from the arc's start toward
  // its end, the finite ends bitwise
  function segCurvesOf(q, win, o) {
    if (q.G.A !== 0) return Constr.segCurves(q, win);
    const fin = (z) => Array.isArray(z), Pz = (z) => C(z[0], z[1]), [e0, e1] = q.ends;
    if (!win || !(win.x1 - win.x0 > 0)) { const c = q.ends.find(fin) || [0, 0], h = Math.max(1, q.L); win = { x0: c[0] - h, x1: c[0] + h, y0: c[1] - h, y1: c[1] + h }; }
    const exact = (c) => { if (!c) return null; const f = c.f, a = c.a, b = c.b; return Object.assign(c, { cap: 'butt', gform: q.G, seg: true, f: (x) => (x === 0 ? C(a.re, a.im) : x === 1 ? C(b.re, b.im) : f(x)) }); };   // (past 0 and 1: the refinement's tails)
    const rev = (c) => { if (!c) return null; const r = longSeg(c.b, c.a); if (c.reach) r.reach = [c.reach[1], c.reach[0]]; return r; };
    if (fin(e0) && fin(e1)) {
      const a = Pz(e0), b = Pz(e1), m = q.fields && q.fields.m;
      // (the chord holds the arc's middle; the outside of a diameter passes through infinity: two rays)
      if (m && (m[0] - e0[0]) * (m[0] - e1[0]) + (m[1] - e0[1]) * (m[1] - e1[1]) <= 0) return [exact(seg(a, b))];
      return [exact(longOf(a, CX.sub(a, b), win, 0, o)), exact(rev(longOf(b, CX.sub(b, a), win, 0, o)))].filter(Boolean);
    }
    const e = fin(e0) ? e0 : e1, m = q.fields && q.fields.b;
    if (!fin(e) || !fin(m)) return [];
    const c = longOf(Pz(e), CX.sub(Pz(m), Pz(e)), win, 0, o);
    return c ? [exact(fin(e0) ? c : rev(c))] : [];
  }
  // o: {reach: 'far' (default: every caller but the settle-time line refinement) | 'sphere'} (SPEC 9.1)
  function curvesOf(s, win, o) {
    if (s._seg && s._g && Constr.segCurves) return segCurvesOf(s._seg, win, o);
    const k = K[s.kind];
    const big = bigCircle(s, win);
    if (big) return [big];
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
      if (c.traced && c.pts) {
        // a traced curve formula: its own samples (thousands), skipping runs of chords far from z
        const ps = c.pts;
        for (let i = 1; i < ps.length; i++) {
          const a = ps[i - 1], b = ps[i];
          if (Math.min(a.re, b.re) - tol > z.re || Math.max(a.re, b.re) + tol < z.re || Math.min(a.im, b.im) - tol > z.im || Math.max(a.im, b.im) + tol < z.im) continue;
          if (distSeg(z, a, b) < tol) return true;
        }
        continue;
      }
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
    /** @type {Float32Array & {origin?: number[]}} */
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
  // ([#325] the line job's work is resumable: its generators yield wherever o.pc / caps.pc says the time slice is
  // spent, pc.due(); the synchronous forms drain them with NOPACE, which never is: the same evaluations in the same
  // order, so the same polylines)
  const NOPACE = { due: () => false };
  const drain = (g) => { for (;;) { const r = g.next(); if (r.done) return r.value; } };
  function sampleCurve(c, win, o) { return drain(sampleCurveGen(c, win, o)); }
  function* sampleCurveGen(c, win, o) {
    const pc = (o && o.pc) || NOPACE;
    const diag = Math.hypot(win.x1 - win.x0, win.y1 - win.y0);
    const step = diag / 700;
    if (c.gsamp) return c.gsamp(win, step);
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
        const ext = function* (tEnd, sgn, dt0, zEnd) {
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
            if (pc.due()) yield;
          }
          return pts;
        };
        const pre = (yield* ext(tr(c.reach[0]), -1, dtA, c.reach[0])).reverse(), post = yield* ext(tr(c.reach[1]), 1, dt, c.reach[1]);
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

  // (issue #20) the settle-time line refinement lives in src/regionlines.js
  const { Lines, defaultsFor } = RegionLines({ NOPACE, REACH, REF_RATIO, TAIL_LIM, clipLine, drain, expandBox, sampleCurveGen });

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
          /** @type {any[]} */
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
    // a gcircle disc: the form itself ('g': {f < 0}, A > 0); its complement: the flipped form as the hole (v16)
    if (gArea(s) && s._g.A !== 0) {
      const G = s._g;
      if (G.A > 0) return { in: [{ t: 'g', G }], hole: null, exact: true };
      return { in: [], hole: [{ t: 'g', G: { o: G.o, A: -G.A, B: [-G.B[0], -G.B[1]], C: -G.C } }], exact: true };
    }
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
    if (pc.t === 'g') {
      // {t : f(z0 + t q) < 2m} (f / 2 is the signed distance near the curve): a t^2 + b t + c < 0 with a = A|q|^2 >= 0,
      // in coordinates relative to the anchor (v16, SPEC 2.2)
      const G = pc.G, ux = z0.re - G.o[0], uy = z0.im - G.o[1];
      const a = G.A * qq, b = 2 * (G.A * (ux * q.re + uy * q.im) + G.B[0] * q.re + G.B[1] * q.im);
      const c = G.A * (ux * ux + uy * uy) + 2 * (G.B[0] * ux + G.B[1] * uy) + G.C - 2 * m;
      if (!(a > 0)) {
        if (!(Math.abs(b) > 1e-300)) return c < 0 ? { lo: -Infinity, hi: Infinity } : EMPTY_T;
        const t = -c / b;
        return b > 0 ? { lo: -Infinity, hi: t } : { lo: t, hi: Infinity };
      }
      const D = b * b - 4 * a * c;
      if (!(D > 0)) return EMPTY_T;
      const qr = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(D)), t1 = qr / a, t2 = c / qr;
      return { lo: Math.min(t1, t2), hi: Math.max(t1, t2) };
    }
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

  // ---------- the Riemann sphere: shapes edited on the globes (panels.md 9.3-9.6, phase P3b) ----------
  // The conjugate lift of panels.md 9.0: P(z) = (2x, -2y, |z|^2 - 1) / (|z|^2 + 1), 0 at the south pole and infinity
  // at N = (0, 0, 1); seen from outside, the globe keeps the plane's orientation.
  function lift(x, y) {
    const q2 = x * x + y * y;
    if (!(q2 < Infinity)) return [0, 0, 1];
    if (q2 > 1) { const iq = 1 / q2; return [2 * x * iq / (1 + iq), -2 * y * iq / (1 + iq), (1 - iq) / (1 + iq)]; }
    return [2 * x / (q2 + 1), -2 * y / (q2 + 1), (q2 - 1) / (q2 + 1)];
  }
  // its inverse: the z of a point of the sphere (normalised first), null at N itself (pickGlobe treats the 1e-9 around
  // N as ∞, panels.md 9.5). Near N, 1 - P_z loses its digits; (P_x^2 + P_y^2) / (1 + P_z) is the same number without
  // the cancellation.
  function unlift(P) {
    const l = Math.hypot(P[0], P[1], P[2]);
    if (!(l > 0)) return null;
    const x = P[0] / l, y = P[1] / l, z = P[2] / l;
    const d = z > 0 ? (x * x + y * y) / (1 + z) : 1 - z;
    if (!(d > 1e-300)) return null;
    const w = C(x / d, -y / d);
    return CX.isFin(w) ? w : null;
  }
  // a planar point of P that can hold a point, a vertex or a planar handle: none within 1e-9 of N (panels.md 9.5, 9.7)
  function finiteOf(P) {
    const l = Math.hypot(P[0], P[1], P[2]);
    return l > 0 && P[2] / l <= 1 - 1e-9 ? unlift(P) : null;
  }
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : null; };
  // the kinds that are caps of the sphere (the disc family) or their rims (circles and lines): edited on the globe in
  // (C, h) only (panels.md 9.3); the family a kind belongs to decides the kinds its cap may become
  const CAP_FAMILY = { disc: 'disc', halfplane: 'disc', circle: 'circle', line: 'circle' };
  const capFamily = (s) => (s && CAP_FAMILY[s.kind]) || null;
  // the cap {P : P.C >= h} of a disc (its complement), half-plane, circle or line (panels.md 9.3: the region
  // a|z|^2 + 2 Re(conj(b) z) + d > 0, then mu = 1 / sqrt(|b|^2 + (a - d)^2 / 4), C = mu (Re b, -Im b, (a - d) / 2),
  // h = -mu (a + d) / 2); a circle is the rim of the disc it bounds, a line the edge of the half-plane on its left.
  // null for another kind or a degenerate shape
  function capOf(s) {
    let a, b, d;
    if (s._g && (s.kind === 'disc' || s.kind === 'circle' || s.kind === 'halfplane' || s.kind === 'line')) {
      // the region a|z|^2 + 2 Re(conj(b) z) + d > 0 of the form (-f > 0, expanded about 0; v16 [C8])
      const G = s._g, ox = G.o[0], oy = G.o[1];
      a = -G.A; b = [-(G.B[0] - G.A * ox), -(G.B[1] - G.A * oy)];
      d = -(G.A * (ox * ox + oy * oy) - 2 * (G.B[0] * ox + G.B[1] * oy) + G.C);
      const mu0 = 1 / Math.sqrt(b[0] * b[0] + b[1] * b[1] + (a - d) * (a - d) / 4);
      if (!Number.isFinite(mu0)) return null;
      return { C: [mu0 * b[0], -mu0 * b[1], mu0 * (a - d) / 2], h: -mu0 * (a + d) / 2 };
    }
    if (s.kind === 'disc' || s.kind === 'circle') {
      if (!(s.r > 0)) return null;
      a = -1; b = [s.c[0], s.c[1]]; d = s.r * s.r - (s.c[0] * s.c[0] + s.c[1] * s.c[1]);
      if (s.kind === 'disc' && s.complement) { a = 1; b = [-b[0], -b[1]]; d = -d; }
    } else if (s.kind === 'halfplane' || s.kind === 'line') {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l = Math.hypot(dx, dy);
      if (!(l > 0)) return null;
      const n = [-dy / l, dx / l];
      a = 0; b = n; d = -2 * (n[0] * s.a[0] + n[1] * s.a[1]);
    } else return null;
    const mu = 1 / Math.sqrt(b[0] * b[0] + b[1] * b[1] + (a - d) * (a - d) / 4);
    if (!Number.isFinite(mu)) return null;
    return { C: [mu * b[0], -mu * b[1], mu * (a - d) / 2], h: -mu * (a + d) / 2 };
  }
  // ∞ on the rim to within this (|C_z - h|): the half-plane or line exactly (the app's ∞ snap keeps every other cap
  // at least 8 px of arc away from it, panels.md 9.3)
  const CAP_INF_EPS = 1e-12;
  // the stored shape of a cap (panels.md 9.3; the inverse of capOf). family 'disc': a disc (∞ outside), the complement
  // of a disc (∞ inside) or a half-plane (∞ on the rim); 'circle': its rim, a circle or a line. Returns the shape's
  // geometric fields with its kind ({kind, c, r, complement} or {kind, a, b}), or null (a cap of no size)
  function shapeOfCap(Cv, h, family) {
    const Cn = norm3(Cv);
    if (!Cn || !(Math.abs(h) < 1)) return null;
    const A = Cn[2] - h, Bx = Cn[0], By = -Cn[1], sa = Math.sqrt(Math.max(0, 1 - h * h));
    const curve = family === 'circle';
    if (Math.abs(A) <= CAP_INF_EPS) {
      const nb = Bx * Bx + By * By;
      if (!(nb > 0)) return null;
      // Re(conj(B) z) > h: a = B h / |B|^2 on the edge (its point nearest 0), b = a - iB/|B| (the region on the left of
      // a -> b; a unit direction, so the shape list writes it as Re z > t, Im z > t or Re(e^{-i phi} z) > t)
      const lb = Math.sqrt(nb), a = [Bx * h / nb, By * h / nb], b = [a[0] + By / lb, a[1] - Bx / lb];
      return { kind: curve ? 'line' : 'halfplane', a, b };
    }
    const k = h - Cn[2];
    const c = [Bx / k, By / k], r = sa / Math.abs(k);
    if (!(r > 0) || !Number.isFinite(r) || !Number.isFinite(c[0] + c[1])) return null;
    return curve ? { kind: 'circle', c, r } : { kind: 'disc', c, r, complement: A > 0 };
  }
  // puts a cap into shape s (same family), dropping the fields of its old kind; false when the cap has no stored form
  function applyCap(s, Cv, h) {
    const fam = capFamily(s);
    const g = fam ? shapeOfCap(Cv, h, fam) : null;
    if (!g) return false;
    for (const k of ['a', 'b', 'c', 'r', 'complement']) delete s[k];
    Object.assign(s, g);
    if (g.kind !== 'disc') delete s.complement;
    else if (!g.complement) delete s.complement;
    return true;
  }
  // rotation matrices (row-major 3x3): the one about P0 x P1 that takes P0 to P1 (the identity when they agree;
  // a half turn about any axis normal to P0 when they are opposite)
  function rotationTo(P0, P1) {
    const a = norm3(P0), b = norm3(P1);
    if (!a || !b) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    let ax = cross3(a, b);
    const s = Math.hypot(ax[0], ax[1], ax[2]), c = dot3(a, b);
    if (s < 1e-15) {
      if (c > 0) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
      ax = norm3(cross3(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
      return rotAxis(ax, Math.PI);
    }
    return rotAxis([ax[0] / s, ax[1] / s, ax[2] / s], Math.atan2(s, c));
  }
  function rotAxis(u, t) {
    const c = Math.cos(t), s = Math.sin(t), k = 1 - c, [x, y, z] = u;
    return [c + x * x * k, x * y * k - z * s, x * z * k + y * s,
      y * x * k + z * s, c + y * y * k, y * z * k - x * s,
      z * x * k - y * s, z * y * k + x * s, c + z * z * k];
  }
  const rot3 = (R, p) => [R[0] * p[0] + R[1] * p[1] + R[2] * p[2], R[3] * p[0] + R[4] * p[1] + R[5] * p[2], R[6] * p[0] + R[7] * p[1] + R[8] * p[2]];
  // the sphere rotated by R, applied to a point, a circle or line, or a cap (h kept: the kind follows the geometry, so a
  // disc slid over ∞ becomes the complement of a disc, panels.md 9.4). Other kinds are planar and do not rotate.
  // Returns false when nothing changed (another kind, or a point that would land on ∞)
  function rotateShape(s, R) {
    if (s.kind === 'point') {
      const z = finiteOf(rot3(R, lift(s.p[0], s.p[1])));
      if (!z) return false;
      s.p = [z.re, z.im];
      return true;
    }
    const cap = capFamily(s) ? capOf(s) : null;
    if (!cap) return false;
    return applyCap(s, rot3(R, cap.C), cap.h);
  }
  // a frame of the tangent plane at C: e1 = N x C normalised (the x axis at the poles), e2 = C x e1
  function capFrame(Cv) {
    const Cn = norm3(Cv) || [0, 0, -1];
    const e1 = norm3(cross3([0, 0, 1], Cn)) || [1, 0, 0];
    return { C: Cn, e1, e2: cross3(Cn, e1) };
  }
  // the rim point of the cap (C, h) at angle phi about C, and the angle of a point about C
  function rimPoint(Cv, h, phi) {
    const f = capFrame(Cv), s = Math.sqrt(Math.max(0, 1 - h * h)), c = Math.cos(phi), sn = Math.sin(phi);
    return [0, 1, 2].map((k) => h * f.C[k] + s * (c * f.e1[k] + sn * f.e2[k]));
  }
  function rimAngle(Cv, P) { const f = capFrame(Cv); return Math.atan2(dot3(P, f.e2), dot3(P, f.e1)); }
  // a handle further than this from 0 is at ∞ to within a pixel on any globe: not shown (panels.md 9.4)
  const HANDLE_FAR = 1e6;
  // the handles of a shape on the globe, as [key, P (on the sphere)]: a cap's centre 'C' and its rim handle 'rim' at
  // angle phi about C; every other kind its planar handles lifted (panels.md 9.4)
  function globeHandlesOf(s, phi = 0) {
    if (capFamily(s)) {
      const cap = capOf(s);
      return cap ? [['C', cap.C], ['rim', rimPoint(cap.C, cap.h, phi)]] : [];
    }
    const out = [];
    for (const [k, z] of handlesOf(s)) if (CX.isFin(z) && Math.hypot(z.re, z.im) <= HANDLE_FAR) out.push([k, lift(z.re, z.im)]);
    return out;
  }
  // smallest angular radius of a cap made by a handle (radians): the plane keeps r >= 1e-3 the same way
  const CAP_MIN = 1e-4;
  // moves a handle of s to the point P of the sphere: 'C' moves a cap's centre (h kept), 'rim' sets h = P.C; other
  // handles take the planar point of P (none at ∞). opts.h: the h to use (the app's ∞ snap sets h = C_z).
  // opts.infSnap(C, h): the ∞ snap of a moved centre (the app's infSnapC: a centre whose rim passes within 8 px of arc
  // of N, moved so that the rim passes N; null otherwise), so that no edit stores the huge r of a rim next to N
  // (panels.md 9.3). Returns false when nothing changed
  function setGlobeHandle(s, key, P, opts = {}) {
    if (capFamily(s) && (key === 'C' || key === 'rim')) {
      const cap = capOf(s);
      if (!cap) return false;
      if (key === 'C') {
        const Cn = norm3(P);
        if (!Cn) return false;
        const Cs = opts.infSnap ? opts.infSnap(Cn, cap.h) : null;
        return Cs ? applyCap(s, Cs, Cs[2]) : applyCap(s, Cn, cap.h);
      }
      const lim = Math.cos(CAP_MIN);
      const h = opts.h != null ? opts.h : Math.max(-lim, Math.min(lim, dot3(norm3(P) || cap.C, cap.C)));
      return applyCap(s, cap.C, h);
    }
    const z = finiteOf(P);
    if (!z) return false;
    setHandle(s, key, z);
    return true;
  }
  // the curves of a shape sampled on the sphere: [{pts: [[x, y, z], ...], closed}]. Caps' rims (circles, lines,
  // half-plane edges) are circles of the sphere sampled by angle, so lines pass through N; rays (and the edges of
  // unbounded sectors) are sampled at t = tan(theta / 2), theta in [0, pi], and end at N; every other curve is its
  // planar curve lifted, n samples or more. Formula sets have no curves.
  function sphereCurvesOf(s, n = 192, win) {
    const out = [];
    const cap = capFamily(s) ? capOf(s) : null;
    if (cap) {
      const f = capFrame(cap.C), sa = Math.sqrt(Math.max(0, 1 - cap.h * cap.h)), pts = [];
      for (let i = 0; i < n; i++) {
        const t = TAU * i / n, c = Math.cos(t), sn = Math.sin(t);
        pts.push([0, 1, 2].map((k) => cap.h * f.C[k] + sa * (c * f.e1[k] + sn * f.e2[k])));
      }
      out.push({ pts, closed: true });
      return out;
    }
    const ray = (p, d) => {
      const L = Math.hypot(d.re, d.im);
      if (!(L > 0)) return null;
      const pts = [];
      for (let i = 0; i < n; i++) { const t = Math.tan(Math.PI / 2 * i / n); pts.push(lift(p.re + t * d.re / L, p.im + t * d.im / L)); }
      pts.push([0, 0, 1]);
      return { pts, closed: false };
    };
    if (s.kind === 'ray') { const r = ray(P(s.a), CX.sub(P(s.b), P(s.a))); return r ? [r] : []; }
    if (s.kind === 'sector' && !(s.r > 0)) {
      const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360;
      if (span >= 360) return [];
      for (const t of [s.t1, s.t1 + span]) { const r = ray(P(s.c), C(Math.cos(t * DEG), Math.sin(t * DEG))); if (r) out.push(r); }
      return out;
    }
    let curves = [];
    try { curves = curvesOf(s, win || { x0: -4, x1: 4, y0: -4, y1: 4 }); } catch (e) { curves = []; }
    for (const c of curves) {
      if (c.traced && c.pts) {
        // a traced curve formula: its own samples (every one on the curve), ends at infinity at N
        const m = c.closed ? c.pts.length - 1 : c.pts.length, pts = [];
        for (let i = 0; i < m; i++) { const z = c.pts[i]; pts.push(CX.isFin(z) ? lift(z.re, z.im) : [0, 0, 1]); }
        if (!c.closed && c.ends) { if (c.ends[0] === 'inf') pts.unshift([0, 0, 1]); if (c.ends[1] === 'inf') pts.push([0, 0, 1]); }
        out.push({ pts, closed: !!c.closed });
        continue;
      }
      const m = Math.max(n, Math.min(4 * n, (c.n0 || 64) * 2)), pts = [];
      for (let i = 0; i <= m; i++) {
        if (c.closed && i === m) break;
        const z = c.f(i / m);
        pts.push(CX.isFin(z) ? lift(z.re, z.im) : [0, 0, 1]);
      }
      out.push({ pts, closed: !!c.closed });
    }
    return out;
  }
  // inside the area of s at the point P of the sphere: the disc family exactly by P.C > h (∞ included); other areas
  // by their level where P is finite (panels.md 9.5)
  function globeInside(s, Pt) {
    if (K[s.kind].type !== 'area') return false;
    if (s.kind === 'disc' || s.kind === 'halfplane') { const cap = capOf(s); return !!cap && dot3(Pt, cap.C) > cap.h; }
    const z = unlift(Pt);
    if (!z) return false;
    try { return levelOf(s)(z) > 0; } catch (e) { return false; }
  }
  const Globe = { lift, unlift, finiteOf, capFamily, capOf, shapeOfCap, applyCap, rotationTo, rotAxis, rot3, rotateShape, capFrame, rimPoint, rimAngle,
    globeHandlesOf, setGlobeHandle, sphereCurvesOf, globeInside, CAP_INF_EPS, CAP_MIN, HANDLE_FAR, dot3, cross3, norm3 };

  return { KINDS: K, FAR, Lines, meshInstances, isOpen, sampleCurve, formOf, formLevel, MR_RATIO, polyCurve: poly, levelOf, bboxOf, curvesOf, segCurvesOf, handlesOf, setHandle, translate, hitTest, buildMesh, mapMesh, mapCurve, defaultsFor, expandBox, clipLine, arc3,
    supportOf, clipPrimitive, shapeClip, convexOf, formulaBox, Globe, curveDesc, traceWin, fcurveTrace,
    capOf, shapeOfCap, rotateShape, globeHandlesOf, setGlobeHandle, sphereCurvesOf, dhAngle, dhStamp, dhAsync: null };
})();
// SPEC 9.1: the settle-time line refinement (Region.Lines)
const Lines = Region.Lines;
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { Constr } from './constr.js';
import { Curves } from './curves.js';
import { RegionLines } from './regionlines.js';
export { Lines, Region, Region as 'module.exports' };
