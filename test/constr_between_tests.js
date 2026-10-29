// Section H of test/t_constr.js: "Between z0 and z1", a perpendicular circle K drawn as the true hyperbolic segment from P to
// Q with no tails (issue #70; notes/orthogonal-circle/segments/SPEC.md 12; src/constr.js betweenOf, setBetween). The disc
// model (2000 random pairs inside the unit circle): the ends are P and Q bitwise, the interior is on K, inside C, and
// within the Inside-C-only arc; outside the circle the exterior segment; P and Q on opposite sides undefined
// ('betweenSides'); P = Q ('coincide'); the diameter (K a line); the half-plane model (C a line); P on C; the glider
// parameter; crossings restricted to the segment; the switch (one change, the gliders to their nearer end), save and
// load, validate (a seg and a between together, Region), the earlier build's validate and describe.
// Not a test of its own (no t_ prefix): t_constr.js calls it with its helpers.
'use strict';
const path = require('path');
module.exports = function ({ K, ok }) {
  const K163 = require(path.join(__dirname, '../notes/v16.3-candidate/src/constr.js'));
  const isInf = K.isInf;
  const isXY = (z) => Array.isArray(z) && Number.isFinite(z[0]) && Number.isFinite(z[1]);
  const bits = (a, b) => isXY(a) && isXY(b) && Object.is(a[0], b[0]) && Object.is(a[1], b[1]);
  const fOf = (G, z) => { const u = [z[0] - G.o[0], z[1] - G.o[1]]; return G.A * (u[0] * u[0] + u[1] * u[1]) + 2 * (G.B[0] * u[0] + G.B[1] * u[1]) + G.C; };
  const gr = (G, z) => { const u = [z[0] - G.o[0], z[1] - G.o[1]]; return 2 * Math.hypot(G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]); };
  const dist = (G, z) => Math.abs(fOf(G, z)) / (gr(G, z) || 1);
  let seed = 70;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const UNIT = () => ({ id: 'c', kind: 'circle', c: [0, 0], r: 1, fixed: 'unit' });
  const REAL = () => ({ id: 'c', kind: 'line', a: [0, 0], b: [1, 0], fixed: 'real' });
  const unitG = { A: 1, B: [0, 0], C: -1, o: [0, 0] };
  const kdef = (extra) => Object.assign({ op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p' }, { s: 'q' }], fill: 'none', nk: 'circle' }, extra || {});
  const scene = (C, P, Q, extra, more = []) => ({ shapes: [C, { id: 'p', kind: 'point', p: P }, { id: 'q', kind: 'point', p: Q }, { id: 'k', kind: 'circle', c: [0, 0], r: 1, def: kdef(extra) }].concat(more) });
  const byId = (st, id) => st.shapes.find((x) => x.id === id);
  const rec = (st) => K.recompute(st, { all: true }, {});
  const load = (st) => { K.validate(st); rec(st); return st; };
  const piece = (st, id = 'k') => K.pieces(byId(st, id))[0];
  const BTW = { between: 1 };
  const glider = (id, t, on = 'k') => ({ id, kind: 'point', p: [0, 0], t, def: { op: 'glider', args: [{ s: on, part: 0 }] } });
  const meet = (id, a, b, index) => ({ id, kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: a, part: 0 }, { s: b, part: 0 }], index } });
  const code = (st, id = 'k') => { const s = byId(st, id); return s.cundef ? s.cundef.code : null; };

  // ------------------------------------------------ 1. the disc model: 2000 random P, Q inside the unit circle
  {
    let n = 0, undef = 0, ends = 0, off = 0, onK = 0, inside = 0, sub = 0, noMeet = 0;
    for (let i = 0; i < 2000; i++) {
      const rp = () => { const r = Math.sqrt(rnd()) * 0.98, a = rnd() * 6.283; return [r * Math.cos(a), r * Math.sin(a)]; };
      const P = rp(), Q = rp(), st = load(scene(UNIT(), P, Q, BTW)), k = byId(st, 'k');
      if (k.cundef) { undef++; continue; }
      n++;
      const pc = piece(st), q = pc.seg;
      const e0 = q.ends[0], e1 = q.ends[1];
      if ((bits(e0, P) && bits(e1, Q)) || (bits(e0, Q) && bits(e1, P))) ends++;
      for (let j = 0; j <= 20; j++) {
        const z = K.glide(pc, j / 20);
        if (dist(k._g, z) > 4e-15) off++;
        if (!(Math.hypot(z[0], z[1]) < 1)) inside++;
      }
      onK += K.onPiece(pc, P) && K.onPiece(pc, Q) ? 1 : 0;
      // a sub-arc of the Inside-C-only arc of the same K
      const st2 = load(scene(UNIT(), P, Q, { seg: 1 })), pc2 = piece(st2);
      let all = true;
      for (let j = 0; j <= 10; j++) if (!K.onPiece(pc2, K.glide(pc, j / 10))) all = false;
      if (all) sub++;
      // the segment holds neither of K's meets with C (they are the ends of the Inside arc)
      const mt = pc2.seg.ends;
      if (!mt.some((m) => K.onPiece(pc, m) && !(bits(m, e0) || bits(m, e1)))) noMeet++;
    }
    ok(undef === 0 && n === 2000 && ends === n && off === 0 && inside === 0 && onK === n && sub === n && noMeet === n,
      `between: disc model, 2000 segments: ends bitwise P and Q (${ends}), 0 interior points off K or outside C (${off}, ${inside}), P and Q on the piece (${onK}), a sub-arc of the Inside arc (${sub}), holding no meet (${noMeet}), undefined ${undef}`);
  }

  // ------------------------------------------------ 2. outside the circle: the exterior segment; opposite sides undefined
  {
    let n = 0, undef = 0, ends = 0, off = 0, inside = 0;
    for (let i = 0; i < 400; i++) {
      const rp = () => { const r = 1.05 + rnd() * 3, a = rnd() * 6.283; return [r * Math.cos(a), r * Math.sin(a)]; };
      const P = rp(), Q = rp(), st = load(scene(UNIT(), P, Q, BTW)), k = byId(st, 'k');
      if (k.cundef) { undef++; continue; }
      n++;
      const pc = piece(st), q = pc.seg;
      if ((bits(q.ends[0], P) && bits(q.ends[1], Q)) || (bits(q.ends[0], Q) && bits(q.ends[1], P))) ends++;
      for (let j = 0; j <= 20; j++) { const z = K.glide(pc, j / 20); if (dist(k._g, z) > 1e-12 * Math.max(1, Math.hypot(z[0], z[1]))) off++; if (Math.hypot(z[0], z[1]) < 1 - 4e-15) inside++; }
    }
    ok(n === 400 && undef === 0 && ends === n && off === 0 && inside === 0, `between: both ends outside C, 400 segments: the exterior arc (ends bitwise ${ends}, off K ${off}, inside C ${inside}, undefined ${undef})`);
    let opp = 0, oppOk = 0;
    for (let i = 0; i < 200; i++) {
      const a = rnd() * 6.283, b = rnd() * 6.283, P = [0.7 * rnd() * Math.cos(a), 0.7 * rnd() * Math.sin(a)], Q = [(1.2 + rnd()) * Math.cos(b), (1.2 + rnd()) * Math.sin(b)];
      const st = load(scene(UNIT(), P, Q, BTW));
      opp++;
      if (code(st) === 'betweenSides') oppOk++;
    }
    ok(oppOk === opp, `between: P inside C, Q outside: undefined ('betweenSides') in all ${opp} (${oppOk})`);
    // moving Q across C: undefined, then defined again
    const st = load(scene(UNIT(), [0.3, 0.2], [0.5, 0.6]));
    byId(st, 'k').def.between = 1; byId(st, 'q').p = [0.5, 0.6]; rec(st);
    const a0 = code(st);
    byId(st, 'q').p = [1.4, 0.6]; rec(st);
    const a1 = code(st);
    byId(st, 'q').p = [-0.4, 0.5]; rec(st);
    ok(a0 === null && a1 === 'betweenSides' && code(st) === null, `between: Q dragged across C: defined, undefined (${a1}), defined again`);
  }

  // ------------------------------------------------ 3. P = Q, P on C, the diameter, the half-plane model
  {
    ok(code(load(scene(UNIT(), [0.3, 0.2], [0.3, 0.2], BTW))) === 'coincide', 'between: P = Q is undefined (coincide)');
    // P on C: the segment ends on C
    const st = load(scene(UNIT(), [1, 0], [0.2, 0.3], BTW)), k = byId(st, 'k');
    const pc = piece(st);
    ok(!k.cundef && pc.seg && ((bits(pc.seg.ends[0], [1, 0]) && bits(pc.seg.ends[1], [0.2, 0.3])) || (bits(pc.seg.ends[1], [1, 0]) && bits(pc.seg.ends[0], [0.2, 0.3]))), `between: P on C is an end of the segment (${k.cundef && k.cundef.code})`);
    // the diameter: P, Q and C's centre collinear: K is a line, the segment its chord between P and Q
    const sd = load(scene(UNIT(), [-0.5, 0], [0.3, 0], BTW)), pd = piece(sd), kd = byId(sd, 'k');
    let line = true;
    for (let j = 0; j <= 20; j++) { const z = K.glide(pd, j / 20); if (Math.abs(z[1]) > 1e-15 || z[0] < -0.5 - 1e-15 || z[0] > 0.3 + 1e-15) line = false; }
    ok(!kd.cundef && kd.def.between === 1 && pd.seg && line && ((bits(pd.seg.ends[0], [-0.5, 0]) && bits(pd.seg.ends[1], [0.3, 0])) || (bits(pd.seg.ends[1], [-0.5, 0]) && bits(pd.seg.ends[0], [0.3, 0]))), `between: P, Q and C's centre collinear: the chord of the line from P to Q (${kd.cundef && kd.cundef.code})`);
    // the half-plane model: C the real axis; P, Q above it: the semicircle piece; across it: undefined
    const sh = load(scene(REAL(), [1, 1], [3, 2], BTW)), kh = byId(sh, 'k'), ph = piece(sh);
    let on = true;
    for (let j = 0; j <= 20; j++) { const z = K.glide(ph, j / 20); if (dist(kh._g, z) > 1e-13 || z[1] < 0) on = false; }
    ok(!kh.cundef && ph.seg && on && ((bits(ph.seg.ends[0], [1, 1]) && bits(ph.seg.ends[1], [3, 2])) || (bits(ph.seg.ends[1], [1, 1]) && bits(ph.seg.ends[0], [3, 2]))), `between: the half-plane model: P and Q above the real axis, the arc between them (${kh.cundef && kh.cundef.code})`);
    ok(code(load(scene(REAL(), [1, 1], [3, -2], BTW))) === 'betweenSides', 'between: the half-plane model: P above, Q below: undefined');
    // P and Q on one vertical line above the axis: K a line, the vertical segment
    const sv = load(scene(REAL(), [1, 1], [1, 2], BTW)), pv = piece(sv), kv = byId(sv, 'k');
    let vert = true;
    for (let j = 0; j <= 10; j++) { const z = K.glide(pv, j / 10); if (Math.abs(z[0] - 1) > 1e-15 || z[1] < 1 - 1e-15 || z[1] > 2 + 1e-15) vert = false; }
    ok(!kv.cundef && vert, `between: P, Q on a vertical line above the real axis: the vertical segment (${kv.cundef && kv.cundef.code})`);
  }

  // ------------------------------------------------ 4. gliders and crossings
  {
    const P = [-0.5, 0.1], Q = [0.5, 0.1];
    const st = load(scene(UNIT(), P, Q, BTW, [glider('g0', 0), glider('g1', 1), glider('gm', 0.5)]));
    const pc = piece(st), q = pc.seg;
    ok(bits(K.glide(pc, 0), q.ends[0]) && bits(K.glide(pc, 1), q.ends[1]) && bits(byId(st, 'g0').p, q.ends[0]) && bits(byId(st, 'g1').p, q.ends[1]),
      'between: glider t = 0 and 1 are the segment\'s ends, bitwise');
    const mid = byId(st, 'gm').p;
    ok(dist(byId(st, 'k')._g, mid) < 4e-15 && Math.hypot(mid[0], mid[1]) < 1 && mid[0] > -0.5 && mid[0] < 0.5 && mid[1] < 0.1 && K.onPiece(pc, mid), 'between: the glider at 1/2 is on the segment, between its ends, bulging toward the centre of C');
    // a crossing geodesic (the diameter x = 0, a line) meets the segment once; a line x = 0.8 beyond Q misses it
    const st2 = load(scene(UNIT(), P, Q, BTW, [{ id: 'l', kind: 'line', a: [0, -1], b: [0, 1] }, meet('m0', 'k', 'l', 0), meet('m1', 'k', 'l', 1), { id: 'l2', kind: 'line', a: [0.8, -1], b: [0.8, 1] }, meet('n0', 'k', 'l2', 0), meet('n1', 'k', 'l2', 1)]));
    const m0 = byId(st2, 'm0'), m1 = byId(st2, 'm1');
    const one = [m0, m1].filter((x) => !x.cundef);
    ok(one.length === 1 && Math.abs(one[0].p[0]) < 1e-12 && one[0].p[1] < 0.1 && one[0].p[1] > 0, `between: a crossing inside the segment is a point, the other meet of the circle (off the segment) is undefined (${one.length})`);
    ok(code(st2, 'n0') === 'nomeet' && code(st2, 'n1') === 'nomeet', `between: a crossing off the segment (past Q) is undefined (${code(st2, 'n0')}, ${code(st2, 'n1')})`);
    // Intersect(K, C): the segment does not reach C
    const st3 = load(scene(UNIT(), P, Q, BTW, [meet('c0', 'k', 'c', 0), meet('c1', 'k', 'c', 1)]));
    ok(code(st3, 'c0') === 'nomeet' && code(st3, 'c1') === 'nomeet', 'between: the segment does not meet C (both Intersect points undefined)');
  }

  // ------------------------------------------------ 5. the switch, the gliders, validate, save and load, earlier builds
  {
    const P = [-0.5, 0.1], Q = [0.5, 0.1];
    const mk = (extra) => load(scene(UNIT(), P, Q, extra, [glider('ga', 0.3), glider('gb', 0.9)]));
    const st = mk(null), gaWhole = byId(st, 'ga').p.slice();
    const r = K.setBetween(st, 'k', true, {});
    const pc = piece(st);
    ok(Array.isArray(r) && r.length === 2 && st.shapes.find((x) => x.id === 'k').def.between === 1 && !('seg' in byId(st, 'k').def) && byId(st, 'k').def.fill === 'none', 'between: setBetween(on) sets the flag, no seg, returns the gliders');
    let all = true;
    for (const id of ['ga', 'gb']) { const g = byId(st, id); if (g.cundef || !K.onPiece(pc, g.p)) all = false; }
    ok(all, 'between: on, no glider is off the segment (one outside goes to its nearer end)');
    const rOff = K.setBetween(st, 'k', false, {});
    ok(Array.isArray(rOff) && !('between' in byId(st, 'k').def) && !piece(st).seg && K.setBetween(st, 'k', false, {}).length === 0, 'between: off removes the flag, the whole circle is back, a second off changes nothing');
    // Inside C only and Between are one choice
    const st2 = mk({ seg: 1 });
    K.setBetween(st2, 'k', true, {});
    ok(byId(st2, 'k').def.between === 1 && !('seg' in byId(st2, 'k').def), 'between: on replaces Inside C only');
    K.setSeg(st2, 'k', -1, {});
    ok(byId(st2, 'k').def.seg === -1 && !('between' in byId(st2, 'k').def), 'between: Inside / Outside replace Between');
    K.setBetween(st2, 'k', true, {});
    K.setSeg(st2, 'k', 0, {});
    ok(!('between' in byId(st2, 'k').def) && !('seg' in byId(st2, 'k').def), 'between: Whole turns Between off');
    // validate
    const bad = [
      scene(UNIT(), P, Q, { between: 2 }), scene(UNIT(), P, Q, { between: 1, fill: 'in' }), scene(UNIT(), P, Q, { between: 1, seg: 1 }),
    ].map((s) => { K.validate(s); return byId(s, 'k').def; });
    ok(!('between' in bad[0]) && !('between' in bad[1]) && bad[2].between === 1 && !('seg' in bad[2]), 'between: validate keeps 1 on a perpendicular circle, drops others and Region (fill in), between wins over seg');
    const notPerp = { shapes: [{ id: 'a', kind: 'point', p: [0, 0] }, { id: 'b', kind: 'point', p: [1, 0] }, { id: 'c', kind: 'point', p: [0, 1] }, { id: 'k', kind: 'circle', c: [0, 0], r: 1, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'c' }], fill: 'none', between: 1 } }] };
    K.validate(notPerp);
    ok(!('between' in byId(notPerp, 'k').def), 'between: validate drops between from a circle that is not a perpendicular one');
    // save and load: bitwise
    const a = load(scene(UNIT(), P, Q, BTW)), b = JSON.parse(JSON.stringify(a));
    load(b);
    const qa = piece(a).seg, qb = piece(b).seg;
    ok(bits(qa.ends[0], qb.ends[0]) && bits(qa.ends[1], qb.ends[1]) && qa.u0 === qb.u0 && qa.D === qb.D && byId(b, 'k').def.between === 1, 'between: save, load and recompute are bitwise');
    ok(K.describe && K.describe(a, 'k') && K.describe(a, 'k').between === 1, 'between: describe has between');
    // the build before this one (v16.3): validate keeps the key and recompute draws the whole circle
    const o = scene(UNIT(), P, Q, BTW);
    K163.validate(o); K163.recompute(o, { all: true }, {});
    const ko = byId(o, 'k'), po = K163.pieces(ko)[0];
    ok(ko.def.between === 1 && po && !po.seg && po.kind === 'circle', 'between: the build before reads the saved flag as the whole circle and keeps it');
  }
};
