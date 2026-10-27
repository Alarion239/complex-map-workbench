// Section G of test/t_constr.js: Inside C only, a perpendicular circle K drawn as its arc on one side of its curve C
// (notes/orthogonal-circle/segments/SPEC.md 11; src/constr.js). The proto's 8 checks on the real graph (the disc model,
// the diameter, the half-plane model, continuity through K's line case and through infinity, P across C), Intersect(K, C)
// bitwise, the restriction of crossings, every case of SPEC 3 on each side, Use complement on C, C through its own line
// case, the glider remap, and the plumbing (save and load, validate, v16.3's validate, describe, speed).
// Not a test of its own (no t_ prefix): t_constr.js calls it with its helpers.
'use strict';
// the absolute speed limits are set on the development Mac; CMW_SPEED_SCALE (CI: ci/README.md) scales them for slower machines
const SPEED = +(process.env.CMW_SPEED_SCALE || 1) || 1;
const path = require('path');
module.exports = function ({ K, ok }) {
  // (v16.3's constr.js, frozen: the build before this one reading a saved seg)
  const K163 = require(path.join(__dirname, '../notes/v16.3-candidate/src/constr.js'));
  const note = (t) => { if (process.argv.includes('-v')) console.log('     ' + t); };
  const INF = K.INF, isInf = K.isInf;
  const isXY = (z) => Array.isArray(z) && Number.isFinite(z[0]) && Number.isFinite(z[1]);
  const hyp = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const fOf = (G, z) => { const u = [z[0] - G.o[0], z[1] - G.o[1]]; return G.A * (u[0] * u[0] + u[1] * u[1]) + 2 * (G.B[0] * u[0] + G.B[1] * u[1]) + G.C; };
  const gr = (G, z) => { const u = [z[0] - G.o[0], z[1] - G.o[1]]; return 2 * Math.hypot(G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]); };
  const dist = (G, z) => Math.abs(fOf(G, z)) / (gr(G, z) || 1);
  const chord = (a, b) => { const q = (z) => (isInf(z) ? 0 : 1 / Math.sqrt(1 + z[0] * z[0] + z[1] * z[1])); if (isInf(a) && isInf(b)) return 0; if (isInf(a) || isInf(b)) return 2 * q(isInf(a) ? b : a); return 2 * hyp(a, b) * q(a) * q(b); };
  const bits = (a, b) => (isInf(a) && isInf(b)) || (isXY(a) && isXY(b) && Object.is(a[0], b[0]) && Object.is(a[1], b[1]));
  const f1 = (x) => (x === 0 ? '0' : Number(x).toExponential(1));
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

  const UNIT = () => ({ id: 'c', kind: 'circle', c: [0, 0], r: 1, fixed: 'unit' });
  const REAL = () => ({ id: 'c', kind: 'line', a: [0, 0], b: [1, 0], fixed: 'real' });
  const unitG = { A: 1, B: [0, 0], C: -1, o: [0, 0] };
  const kdef = (seg, extra) => Object.assign({ op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p' }, { s: 'q' }], fill: 'none', nk: 'circle' }, seg ? { seg } : {}, extra || {});
  const scene = (C, P, Q, seg, extra = []) => ({ shapes: [C, { id: 'p', kind: 'point', p: P }, { id: 'q', kind: 'point', p: Q }, { id: 'k', kind: 'circle', c: [0, 0], r: 1, def: kdef(seg) }].concat(extra), targets: [], steps: [] });
  const byId = (st, id) => st.shapes.find((x) => x.id === id);
  const rec = (st) => K.recompute(st, { all: true }, {});
  const load = (st) => { K.validate(st); rec(st); return st; };
  const piece = (st, id = 'k') => K.pieces(byId(st, id))[0];
  const meet = (id, a, b, index) => ({ id, kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: a, part: 0 }, { s: b, part: 0 }], index } });
  const glider = (id, t, on = 'k') => ({ id, kind: 'point', p: [0, 0], t, def: { op: 'glider', args: [{ s: on, part: 0 }] } });
  const WIN = { x0: -2, x1: 2, y0: -1.5, y1: 1.5 };
  // (Region.curvesOf: a circle's arc from K.segCurves; a line's (review math-1) the chord or the line kinds' long rays)
  const samplesOf = (s, win = WIN) => { const out = []; for (const c of Region.curvesOf(s, win)) { const a = Region.sampleCurve(c, win); const run = []; for (let i = 0; i < a.length; i += 2) run.push([a[i], a[i + 1]]); out.push(run); } return out; };

  // ------------------------------------------------ 1. the disc model: 2000 random P, Q in |z| < 1
  {
    let worstEnd = 0, offSide = 0, offSamp = 0, through = 0, undef = 0, n = 0, endsBits = 0;
    for (let i = 0; i < 2000; i++) {
      const rp = () => { const r = Math.sqrt(rnd()) * 0.98, a = rnd() * 6.283; return [r * Math.cos(a), r * Math.sin(a)]; };
      const P = rp(), Q = rp(), st = load(scene(UNIT(), P, Q, 1)), k = byId(st, 'k');
      if (k.cundef) { undef++; continue; }
      n++;
      const pc = piece(st), q = pc.seg;
      for (const e of q.ends) worstEnd = Math.max(worstEnd, dist(unitG, e), dist(k._g, e));
      for (let j = 1; j < 20; j++) { const z = K.glide(pc, j / 20); if (!(Math.hypot(z[0], z[1]) < 1)) offSide++; }
      if (bits(K.glide(pc, 0), q.ends[0]) && bits(K.glide(pc, 1), q.ends[1])) endsBits++;
      if (i % 20 === 0) for (const run of samplesOf(k)) for (const z of run) if (Math.hypot(z[0], z[1]) > 1 + 4e-15) offSamp++;
      if (K.onPiece(pc, P) && K.onPiece(pc, Q)) through++;
    }
    note(`disc model: ${n} geodesics, worst end distance ${f1(worstEnd)}, interior glides off the side ${offSide}, samples off ${offSamp}, through P and Q ${through}`);
    ok(undef === 0 && worstEnd < 4e-15 && offSide === 0 && offSamp === 0 && through === n && endsBits === n, `seg: disc model, 2000 geodesics: ends within 4e-15 of both curves (${f1(worstEnd)}), 0 glides or samples outside, every arc through P and Q, glide(0), glide(1) the ends bitwise`);
  }

  // ------------------------------------------------ 2. Intersect(K, C): the drawn ends, bitwise, both orders
  {
    const st = load(scene(UNIT(), [0.3, 0.2], [-0.4, 0.1], 1, [meet('a0', 'k', 'c', 0), meet('a1', 'k', 'c', 1), meet('b0', 'c', 'k', 0), meet('b1', 'c', 'k', 1)]));
    const q = byId(st, 'k')._seg, P = (id) => byId(st, id).p;
    const whole = load(scene(UNIT(), [0.3, 0.2], [-0.4, 0.1], 0, [meet('a0', 'k', 'c', 0), meet('b0', 'c', 'k', 0)]));
    ok(bits(P('a0'), q.m[0]) && bits(P('a1'), q.m[1]) && bits(P('b0'), q.m[1]) && bits(P('b1'), q.m[0]) && [q.ends[0], q.ends[1]].every((e) => ['a0', 'a1'].some((id) => bits(P(id), e))),
      'seg: Intersect(K, C) gives the drawn ends bitwise; order (C, K) reverses the index (i <-> 1 - i)');
    ok(hyp(byId(whole, 'a0').p, P('a0')) < 1e-15 && hyp(byId(whole, 'b0').p, P('b0')) < 1e-15, 'seg: the indices keep their meaning: the same meets as on the whole circle');
  }

  // ------------------------------------------------ 3. the restriction of crossings
  {
    // K1 on the carrier centred (1.25, 0), radius 0.75 (orthogonal to |z| = 1): it crosses the real axis at 0.5 and 2
    const on = (th) => [1.25 + 0.75 * Math.cos(th * Math.PI / 180), 0.75 * Math.sin(th * Math.PI / 180)];
    const L = { id: 'L', kind: 'line', a: [-2, 0], b: [2, 0] };
    const st = load({ shapes: [UNIT(), { id: 'p', kind: 'point', p: on(150) }, { id: 'q', kind: 'point', p: on(200) }, { id: 'k', kind: 'circle', c: [0, 0], r: 1, def: kdef(1) }, L,
      meet('x0', 'k', 'L', 0), meet('x1', 'k', 'L', 1),
      { id: 'p2', kind: 'point', p: [0.3, 0.3] }, { id: 'q2', kind: 'point', p: [0.9, -0.2] },
      { id: 'k2', kind: 'circle', c: [0, 0], r: 1, def: { op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p2' }, { s: 'q2' }], fill: 'none', nk: 'circle', seg: 1 } },
      meet('y0', 'k', 'k2', 0), meet('y1', 'k', 'k2', 1),
      { id: 'p3', kind: 'point', p: [-0.6, 0.1] }, { id: 'q3', kind: 'point', p: [-0.5, -0.4] },
      { id: 'k3', kind: 'circle', c: [0, 0], r: 1, def: { op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p3' }, { s: 'q3' }], fill: 'none', nk: 'circle', seg: 1 } },
      meet('w0', 'k', 'k3', 0), meet('w1', 'k', 'k3', 1)], targets: [], steps: [] });
    const X = ['x0', 'x1'].map((id) => byId(st, id)), Y = ['y0', 'y1'].map((id) => byId(st, id)), W = ['w0', 'w1'].map((id) => byId(st, id));
    const xin = X.filter((x) => !x.cundef), yin = Y.filter((x) => !x.cundef);
    ok(xin.length === 1 && Math.abs(xin[0].p[0] - 0.5) < 1e-15 && X.some((x) => x.cundef && x.cundef.code === 'nomeet'), 'seg: a line through the disc meets K inside only; its crossing outside is undefined (nomeet)');
    ok(yin.length === 1 && Math.hypot(...yin[0].p) < 1 && Y.some((x) => x.cundef && x.cundef.code === 'nomeet'), 'seg: two crossing geodesics meet inside the disc only');
    ok(W.every((x) => x.cundef && x.cundef.code === 'nomeet'), 'seg: ultraparallel geodesics: no meet (nomeet)');
  }

  // ------------------------------------------------ 4. the cases of SPEC 3, each side
  {
    const cases = [
      ['circle C, circle K', UNIT, [0.3, 0.2], [-0.4, 0.1]],
      ['circle C, K a diameter (0.3+0.2i, 0.6+0.4i)', UNIT, [0.3, 0.2], [0.6, 0.4]],
      ['line C, circle K (a semicircle)', REAL, [0.5, 1], [2, 0.5]],
      ['line C, K a vertical line (1+i, 1+2i)', REAL, [1, 1], [1, 2]],
      ['a segment of C: clipped by its carrier', () => ({ id: 'c', kind: 'segment', a: [-0.2, 0], b: [0.2, 0] }), [0.5, 1], [2, 0.5]],
      ['an arc of C: clipped by its carrier', () => ({ id: 'c', kind: 'arc', a: [1, 0], m: [Math.SQRT1_2, Math.SQRT1_2], b: [0, 1] }), [-0.3, -0.2], [-0.5, 0.4]],
    ];
    for (const [name, C, P, Q] of cases) {
      let good = true;
      const why = [];
      for (const side of [1, -1]) {
        const st = load(scene(C(), P, Q, side)), k = byId(st, 'k');
        if (k.cundef) { good = false; why.push(side + ': undefined ' + k.cundef.code); continue; }
        const pc = piece(st), q = pc.seg, Gc = q.Gc;
        if (!(bits(K.glide(pc, 0), q.ends[0]) && bits(K.glide(pc, 1), q.ends[1]))) { good = false; why.push(side + ': glide ends'); }
        // every interior glide and every sample on the side (f < 0 times side), at a relative margin
        for (let j = 1; j < 40; j++) { const z = K.glide(pc, j / 40); if (isXY(z) && !(side * fOf(Gc, z) < 0)) { good = false; why.push(side + ': glide ' + j); break; } }
        for (const run of samplesOf(k, { x0: -6, x1: 6, y0: -4, y1: 4 })) for (const z of run.slice(1, -1)) if (!(side * fOf(Gc, z) < 1e-12 * (1 + Math.hypot(...z)))) { good = false; why.push(side + ': sample'); break; }
        for (const e of q.ends) if (isXY(e) && !(dist(Gc, e) < 4e-15 * (1 + Math.hypot(...e)) && dist(k._g, e) < 4e-15 * (1 + Math.hypot(...e)))) { good = false; why.push(side + ': end off a curve'); }
        note(`${name}, side ${side}: kind ${k.kind}, ends ${q.ends.map((e) => (isInf(e) ? '∞' : e.map((x) => +x.toFixed(6)).join(','))).join(' | ')}, ${Region.segCurvesOf(q, WIN).length} curve(s)`);
      }
      ok(good, `seg: ${name}: each side drawn on its side, glide(0), glide(1) the ends bitwise, the ends on both curves` + (why.length ? ' ' + why.join('; ') : ''));
    }
    // the shapes: inside a circle, less than a semicircle; the diameter's outside, two rays through infinity (two runs, all
    // outside); the vertical ray up to infinity (kind ray, an end at infinity), t = 1/2 at 1 + 1.414i
    const a = load(scene(UNIT(), [0.3, 0.2], [-0.4, 0.1], 1)), ka = byId(a, 'k'), gK = K.geomOf(ka._g);
    const ch = hyp(ka._seg.ends[0], ka._seg.ends[1]);
    ok(ka.kind === 'arc' && Math.hypot(...K.glide(piece(a), 0.5)) < 1 && Math.hypot(gK.c[0] - (ka._seg.ends[0][0] + ka._seg.ends[1][0]) / 2, gK.c[1] - (ka._seg.ends[0][1] + ka._seg.ends[1][1]) / 2) > 0 && ch < 2 * gK.r && hyp(K.glide(piece(a), 0.5), gK.c) === hyp(K.glide(piece(a), 0.5), gK.c) && Math.hypot(...gK.c) > 1,
      'seg: circle C, circle K inside: an arc (kind arc), less than a semicircle (K\'s centre outside C)');
    const d = load(scene(UNIT(), [0.3, 0.2], [0.6, 0.4], -1)), kd = byId(d, 'k'), runs = samplesOf(kd, { x0: -3, x1: 3, y0: -3, y1: 3 });
    ok(kd._g.A === 0 && runs.length === 2 && runs.every((r) => r.slice(1).concat(r.slice(0, -1)).every((z) => Math.hypot(...z) >= 1 - 1e-15)) && bits(runs[0][0], kd._seg.ends[0]) && bits(runs[1][runs[1].length - 1], kd._seg.ends[1]),
      'seg: the diameter\'s outside: two runs through infinity (no chord), every sample outside, the ends first and last bitwise');
    const v = load(scene(REAL(), [1, 1], [1, 2], 1)), kv = byId(v, 'k'), mv = K.glide(piece(v), 0.5);
    ok(kv.kind === 'ray' && kv._seg.ends.some(isInf) && kv._seg.ends.some((e) => isXY(e) && e[0] === 1 && e[1] === 0) && Math.abs(mv[0] - 1) < 1e-15 && Math.abs(mv[1] - Math.SQRT2) < 1e-14,
      `seg: half-plane, P = 1+i, Q = 1+2i: the vertical ray (kind ray) from 1 to infinity, t = 1/2 at ${mv.map((x) => +x.toFixed(6)).join(' + ')}i`);
  }

  // ------------------------------------------------ 5. continuity through K's line case and through infinity
  for (const [name, C, Pf, Q] of [
    ['disc, P across the diameter through Q', UNIT, (x) => [0.3 + x, 0.2 - 1.5 * x], [0.6, 0.4]],
    ['half-plane, Q across the vertical through P', REAL, (x) => [1 + x, 2], [1, 1]],
  ]) {
    const st = load(scene(C(), Pf(-0.02), Q, 1, [glider('g', 0.3)]));
    let worst = 0, worstE = 0, prev = null, bad = 0;
    for (let k = -200; k <= 200; k++) {
      byId(st, 'p').p = Pf(k * 1e-4);
      rec(st);
      const K1 = byId(st, 'k');
      if (K1.cundef) { bad++; continue; }
      const g = byId(st, 'g').p, ends = K1._seg.ends;
      if (prev) { worst = Math.max(worst, hyp(g, prev.g)); for (let j = 0; j < 2; j++) worstE = Math.max(worstE, chord(ends[j], prev.ends[j])); }
      prev = { g, ends };
    }
    note(`${name}: glider step ${f1(worst)}, end step (chordal) ${f1(worstE)}`);
    ok(bad === 0 && worst < 5e-3 && worstE < 5e-3, `seg: ${name}: no undefined frame, a glider at t = 0.3 moves at most ${f1(worst)} and the ends ${f1(worstE)} (chordal) per step`);
  }

  // ------------------------------------------------ 6. P across C, the side fixed
  {
    const st = load(scene(UNIT(), [0.9 * Math.cos(1), 0.9 * Math.sin(1)], [0.2, -0.3], 1));
    let bad = 0;
    for (let k = 0; k <= 400; k++) {
      const r = 0.9 + k * 0.0005;
      byId(st, 'p').p = [r * Math.cos(1), r * Math.sin(1)];
      rec(st);
      const pc = piece(st);
      if (byId(st, 'k').cundef || !pc.seg || ![0.2, 0.5, 0.8].every((t) => Math.hypot(...K.glide(pc, t)) < 1)) bad++;
    }
    ok(bad === 0, 'seg: P dragged across C (r 0.9 to 1.1): no undefined frame, the arc stays inside');
  }

  // ------------------------------------------------ 7. Use complement on C; C through its own line case
  {
    const ends = (st) => byId(st, 'k')._seg.ends;
    const same = (a, b) => a.every((e, i) => hyp(e, b[i]) < 1e-15);
    const disc = load(scene({ id: 'c', kind: 'disc', c: [0, 0], r: 1 }, [0.3, 0.2], [-0.4, 0.1], 1)), comp = load(scene({ id: 'c', kind: 'disc', c: [0, 0], r: 1, complement: true }, [0.3, 0.2], [-0.4, 0.1], 1));
    const c3 = (flip) => load({ shapes: [{ id: 'a1', kind: 'point', p: [1, 0] }, { id: 'a2', kind: 'point', p: [0, 1] }, { id: 'a3', kind: 'point', p: [-1, 0] },
      { id: 'c', kind: 'disc', c: [0, 0], r: 1, def: { op: 'circle3', args: [{ s: 'a1' }, { s: 'a2' }, { s: 'a3' }], fill: 'in', flip } },
      { id: 'p', kind: 'point', p: [0.3, 0.2] }, { id: 'q', kind: 'point', p: [-0.4, 0.1] }, { id: 'k', kind: 'circle', c: [0, 0], r: 1, def: kdef(1) }], targets: [], steps: [] });
    const f0 = c3(false), f1s = c3(true);
    ok(same(ends(disc), ends(comp)) && same(ends(f0), ends(f1s)) && same(ends(disc), ends(f0)), 'seg: Use complement on C (a v15 complement, a 3-point circle\'s flip) never moves the arc');
    // C a perpendicular circle K' of the unit circle, dragged through its line case: K on K' stays continuous, the word
    // for its side changes (inside -> a line's word -> outside)
    const st = load({ shapes: [{ id: 'u', kind: 'circle', c: [0, 0], r: 1, fixed: 'unit' }, { id: 'p1', kind: 'point', p: [0.3, 0.2] }, { id: 'q1', kind: 'point', p: [0.6, 0.4] },
      { id: 'c', kind: 'circle', c: [0, 0], r: 1, def: { op: 'perp', args: [{ s: 'u', part: 0 }, { s: 'p1' }, { s: 'q1' }], fill: 'none', nk: 'circle' } },
      { id: 'p', kind: 'point', p: [0.45, 0.6] }, { id: 'q', kind: 'point', p: [0.62, 0.05] }, { id: 'k', kind: 'circle', c: [0, 0], r: 1, def: kdef(1) }], targets: [], steps: [] });
    const words = [];
    let worstE = 0, prev = null, bad = 0;
    for (let k = -100; k <= 100; k++) {
      byId(st, 'p1').p = [0.3 + k * 2e-4, 0.2 - k * 3e-4];
      rec(st);
      const kk = byId(st, 'k');
      if (kk.cundef) { bad++; continue; }
      const w = K.segSides(st, 'k', {}).word;
      if (words[words.length - 1] !== w) words.push(w);
      if (prev) for (let j = 0; j < 2; j++) worstE = Math.max(worstE, chord(kk._seg.ends[j], prev[j]));
      prev = kk._seg.ends;
    }
    note(`C through its line case: words ${words.join(' -> ')}, end step ${f1(worstE)}`);
    ok(bad === 0 && worstE < 5e-3 && words.length >= 2 && words.includes('in') && words.includes('out'), `seg: C through its own line case: continuous (end step ${f1(worstE)}), the side's word changes (${words.join(' -> ')})`);
  }

  // ------------------------------------------------ 8. the glider remap (SPEC 4)
  {
    const st = load(scene(UNIT(), [0.3, 0.2], [-0.4, 0.1], 0, [glider('g1', 0.05), glider('g2', 0.5)]));
    const p0 = ['g1', 'g2'].map((id) => byId(st, id).p.slice());
    const ins = p0.map((z) => Math.hypot(...z) < 1);
    const mir = (z) => { const d = z[0] * z[0] + z[1] * z[1]; return [z[0] / d, z[1] / d]; };
    K.setSeg(st, 'k', 1, {});
    const p1 = ['g1', 'g2'].map((id) => byId(st, id).p.slice()), pc = piece(st);
    const okOn = p0.every((z, i) => (ins[i] ? hyp(p1[i], z) < 1e-14 : hyp(p1[i], mir(z)) < 1e-13)) && p1.every((z) => K.onPiece(pc, z) && Math.hypot(...z) <= 1) && ['g1', 'g2'].every((id) => byId(st, id).t >= 0 && byId(st, id).t <= 1);
    K.setSeg(st, 'k', -1, {});
    const p2 = ['g1', 'g2'].map((id) => byId(st, id).p.slice()), pc2 = piece(st);
    const okOther = p1.every((z, i) => hyp(p2[i], mir(z)) < 1e-12 * (1 + Math.hypot(...p2[i]))) && p2.every((z) => K.onPiece(pc2, z));
    K.setSeg(st, 'k', 0, {});
    const p3 = ['g1', 'g2'].map((id) => byId(st, id).p.slice());
    const okOff = p2.every((z, i) => hyp(p3[i], z) < 1e-12 * (1 + Math.hypot(...z))) && !byId(st, 'k')._seg && byId(st, 'k').kind === 'circle';
    note(`remap: inside ${ins}, on ${p1.map((z) => z.map((x) => +x.toFixed(4)))}, other ${p2.map((z) => z.map((x) => +x.toFixed(4)))}`);
    ok(ins.includes(true) && ins.includes(false) && okOn, 'seg: on: a glider inside keeps its point, one outside goes to its mirror image in C, both on the arc');
    ok(okOther, 'seg: Other side: every glider goes to its mirror image, on the other arc');
    ok(okOff, 'seg: off: every glider keeps its point; K is the whole circle again');
    // Region turns it off: validate drops seg with fill 'in'
  }

  // ------------------------------------------------ 9. plumbing
  {
    const st = load(scene(UNIT(), [0.3, 0.2], [-0.4, 0.1], -1, [glider('g', 0.4), meet('m', 'k', 'c', 1)]));
    const js = JSON.stringify(st, K.idReplacer(st));
    const st2 = load(JSON.parse(js));
    ok(JSON.stringify(st2, K.idReplacer(st2)) === js && bits(byId(st2, 'k')._seg.ends[0], byId(st, 'k')._seg.ends[0]) && !/_seg|"sg"/.test(js), 'seg: save, load and recompute are bitwise; runtime data is not saved');
    const bad = (def, fill) => { const s = load(scene(UNIT(), [0.3, 0.2], [-0.4, 0.1], 0)); const k = byId(s, 'k'); Object.assign(k.def, def); if (fill) k.def.fill = fill; K.validate(s); return k.def; };
    ok(!('seg' in bad({ seg: 2 })) && !('seg' in bad({ seg: '1' })) && !('seg' in bad({ seg: 1 }, 'in')) && bad({ seg: -1 }).seg === -1 && bad({ seg: 1 }, 'in').fill === 'in',
      'seg: validate drops a bad seg, and drops seg together with fill \'in\' (Region wins), keeping the rest');
    const c3 = load({ shapes: [{ id: 'a', kind: 'point', p: [1, 0] }, { id: 'b', kind: 'point', p: [0, 1] }, { id: 'd', kind: 'point', p: [-1, 0] }, { id: 'c', kind: 'circle', c: [0, 0], r: 1, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'd' }], fill: 'none', seg: 1 } }], targets: [], steps: [] });
    ok(!('seg' in byId(c3, 'c').def), 'seg: validate drops seg on any op but perp');
    const old = JSON.parse(js);
    const v = K163.validate(old);
    K163.recompute(old, { all: true }, {});
    ok(v.freed === 0 && byId(old, 'k').def.seg === -1 && byId(old, 'k').kind === 'circle', 'seg: v16.3\'s validate keeps seg and recomputes the whole circle');
    ok(K.describe(st, 'k').seg === -1 && K.describe(st2, 'k').seg === -1 && K.describe(load(scene(UNIT(), [0.3, 0.2], [-0.4, 0.1], 0)), 'k').seg === 0, 'seg: describe has seg');
    // speed: a seg K adds at most 10 us per recompute
    const time = (seg) => { const s = load(scene(UNIT(), [0.3, 0.2], [-0.4, 0.1], seg, [glider('g', 0.3)])); for (let i = 0; i < 300; i++) rec(s); const t0 = process.hrtime.bigint(); for (let i = 0; i < 3000; i++) { byId(s, 'p').p = [0.3 + i * 1e-6, 0.2]; rec(s); } return Number(process.hrtime.bigint() - t0) / 3000 / 1000; };
    let a = Infinity, b = Infinity;
    for (let r = 0; r < 3; r++) { a = Math.min(a, time(0)); b = Math.min(b, time(1)); }
    ok(b - a <= 10 * SPEED, `seg: a seg K adds ${(b - a).toFixed(1)} us per recompute (whole ${a.toFixed(1)} us, seg ${b.toFixed(1)} us; budget 10 us)`);
  }

  // ------------------------------------------------ 10. the review fixes (notes/orthogonal-circle/segments/ledger.json)
  {
    // math-1, math-4: a line's arc is the line kinds' long rays: long and reach, refined as a whole line, f finite to its
    // clipped end; the two rays run outward from each end, with no jump back across the plane
    const W8 = { x0: -4, x1: 4, y0: -3, y1: 3 };
    const v = load(scene(REAL(), [1, 1], [1, 2], 1)), w = load(scene(REAL(), [1, 1], [1, 2], 0));
    const cv = Region.curvesOf(byId(v, 'k'), W8, { reach: 'sphere' }), cw = Region.curvesOf(byId(w, 'k'), W8, { reach: 'sphere' });
    const refd = (cs, F, win = W8) => Region.Lines.refine(cs, [F], null, { win, origin: [0, 0] });
    const imStep = (rs) => { let m = 0; for (const p of rs) for (let i = 2; i < p.length; i += 2) m = Math.max(m, Math.abs(p[i + 1] - p[i - 1])); return m; };
    const near0 = (rs) => { let m = Infinity; for (const p of rs) for (let i = 0; i < p.length; i += 2) m = Math.min(m, 1 / Math.hypot(p[i], p[i + 1])); return m; };
    const ex = (z) => CX.exp(z), inv = (z) => CX.inv(z);
    const sv = imStep(refd(cv, ex)), sw = imStep(refd(cw, ex)), nv = near0(refd(cv, inv)), nw = near0(refd(cw, inv));
    const small = { x0: 1 - 0.0884, x1: 1 + 0.0884, y0: 1 - 0.0884, y1: 1 + 0.0884 };
    const ns = near0(refd(Region.curvesOf(byId(v, 'k'), small, { reach: 'sphere' }), inv, small));
    note(`math-1: vertical ray: Im step under exp ${f1(sv)} (whole ${f1(sw)}); nearest image to 0 under 1/z ${f1(nv)} (whole ${f1(nw)}), small window ${f1(ns)}`);
    ok(cv.length === 1 && cv[0].long && cv[0].reach && bits([cv[0].f(0).re, cv[0].f(0).im], byId(v, 'k')._seg.ends[0]) && Number.isFinite(cv[0].f(1).re) && sv <= 2 * sw && sv < 0.5 && nv < 1e-12 && ns < 1e-12,
      `seg (math-1, math-4): the vertical ray is a long ray with reach: Im step under exp ${f1(sv)}, its 1/z image reaches 0 (${f1(nv)}; window 0.25: ${f1(ns)}), f(1) finite`);
    const d = load(scene(UNIT(), [0.3, 0.2], [0.6, 0.4], -1)), kd = byId(d, 'k'), cd = Region.curvesOf(kd, W8, { reach: 'sphere' });
    const dirOk = cd.length === 2 && cd.every((c) => { const a = c.f(0), b = c.f(0.999), e = c.f(1); return [a, b, e].every((z) => Number.isFinite(z.re) && Number.isFinite(z.im)) && (b.re - a.re) * (e.re - a.re) + (b.im - a.im) * (e.im - a.im) > 0; });
    ok(dirOk && cd.every((c) => c.long && c.reach) && bits([cd[0].f(0).re, cd[0].f(0).im], kd._seg.ends[0]) && bits([cd[1].f(1).re, cd[1].f(1).im], kd._seg.ends[1]),
      'seg (math-1, math-4): the two rays through infinity: long rays with reach, f finite and straight to their clipped ends, the ends bitwise');
    const ch = load(scene(UNIT(), [0.3, 0.2], [0.6, 0.4], 1)), cc = Region.curvesOf(byId(ch, 'k'), W8);
    ok(cc.length === 1 && !cc[0].long && bits([cc[0].f(0).re, cc[0].f(0).im], byId(ch, 'k')._seg.ends[0]) && bits([cc[0].f(1).re, cc[0].f(1).im], byId(ch, 'k')._seg.ends[1]), 'seg (math-1): the diameter inside is its chord, a segment, the ends bitwise');

    // math-2: a glider at infinity keeps infinity through on and off; projectPiece(seg, INF) gives infinity's t
    const at = (st, id = 'g') => byId(st, id);
    const r1 = load(scene(REAL(), [1, 1], [1, 2], 1, [glider('g', 1)]));
    const t0 = at(r1).t, inf0 = !!at(r1)._atInf;
    K.setSeg(r1, 'k', 0, {});
    const off = { t: at(r1).t, inf: !!at(r1)._atInf };
    K.setSeg(r1, 'k', 1, {});
    const on = { t: at(r1).t, inf: !!at(r1)._atInf };
    ok(inf0 && t0 === 1 && off.inf && off.t === 0.5 && on.inf && on.t === byId(r1, 'k')._seg.ends.findIndex(isInf), `seg (math-2): a glider at the ray's infinite end stays at infinity off (t ${off.t}) and on again (t ${on.t})`);
    const r2 = load(scene(REAL(), [1, 1], [1, 2], 0, [glider('g', 0.5)]));
    const i2 = !!at(r2)._atInf;
    K.setSeg(r2, 'k', K.segSideOf(byId(r2, 'c'), piece(r2, 'c'), [1, 1], [1, 2]), {});
    ok(i2 && at(r2)._atInf && !at(r2).cundef, 'seg (math-2): a glider at infinity on the whole line K stays at infinity, an end of the drawn ray');
    const pc = piece(d), pr = K.projectPiece(pc, INF);
    ok(pr && pr.t > 0 && pr.t < 1 && isInf(K.glide(pc, pr.t)), `seg (math-2): two rays: projectPiece(infinity) is infinity's t on the arc (${pr && pr.t.toFixed(4)}), not an end`);
    const r3 = load(scene(UNIT(), [0.3, 0.2], [0.6, 0.4], 0, [glider('g', 0.5)]));
    const i3 = !!at(r3)._atInf;
    K.setSeg(r3, 'k', 1, {});
    const ctr = at(r3).p;
    K.setSeg(r3, 'k', -1, {});
    ok(i3 && isXY(ctr) && Math.hypot(...ctr) < 1e-15 && at(r3)._atInf, 'seg (math-2): on the chord a glider at infinity goes to its mirror image, the centre; Other side brings it back to infinity');

    // math-5: limiting parallels (a common end on C) have no meet, at either index, in both models
    const two = (C, P1, Q1, P2, Q2, seg) => load({ shapes: [C, { id: 'p', kind: 'point', p: P1 }, { id: 'q', kind: 'point', p: Q1 }, { id: 'p2', kind: 'point', p: P2 }, { id: 'q2', kind: 'point', p: Q2 },
      { id: 'k', kind: 'circle', c: [0, 0], r: 1, def: kdef(seg) }, { id: 'k2', kind: 'circle', c: [0, 0], r: 1, def: Object.assign(kdef(seg), { args: [{ s: 'c', part: 0 }, { s: 'p2' }, { s: 'q2' }] }) },
      meet('m0', 'k', 'k2', 0), meet('m1', 'k', 'k2', 1)], targets: [], steps: [] });
    const h = two(REAL(), [1, 1], [1, 2], [2, 1], [2, 2], 1), e7 = [Math.cos(0.7), Math.sin(0.7)], u = two(UNIT(), [0.2, 0.1], e7, [-0.3, 0.2], e7, 1);
    const none = (st) => ['m0', 'm1'].every((id) => byId(st, id).cundef && byId(st, id).cundef.code === 'nomeet');
    const crossing = two(UNIT(), [0.3, 0.2], [-0.4, 0.1], [0.1, -0.5], [0.0, 0.6], 1);
    ok(none(h) && none(u) && ['m0', 'm1'].some((id) => !byId(crossing, id).cundef), 'seg (math-5): limiting parallels (two vertical rays; two disc geodesics with a common end on C) have no meet at either index; crossing geodesics still meet');
  }
};
