#!/usr/bin/env node
// The Trolls' Hall: "In the Hall of the Mountain King" (Edvard Grieg, Peer Gynt, 1875; public domain), our own
// adaptation for the phase harp, played by Listen along on ONE closed route in the hall of
//   F(z) = a (z^6 - 1) / z^3,  a = 0.0001     (the zeros-and-poles step: zeros the 6th roots of 1, poles 0, 0, 0)
// Six trolls (the zeros) stand on the unit circle round the Mountain King (a triple pole at 0). Near the King
// F ~ -a / z^3: arg F turns three times round him (clockwise = up the strings) and |F| grows as 1/r^3, so the route
// sneaks clockwise round the King and spirals in toward him as the tune speeds up: the register rises by itself.
//   node make.js          -> route.json (the example's data: the curve, its listen tempo and dynamics)
// The melody, tempo and dynamics live in score.js; change them there and run this again.
//
// How: every crossing k of the score is a knot zeta_k = rho_k + i theta_k (rho = ln|F|, theta = arg F, the string's
// own line) at time t_k. Between two knots the route is, in the log-F plane: a quick tangential run at rho_k off the
// line (so the Schmitt band is passed within a few ms and the onset is where the line is), a "petal" (rho dips by e,
// toward the trolls) and a quick tangential run onto the next line. Each piece is lifted to z exactly (Newton
// continuation on F(z) = e^zeta). Listen along plays the curve uniformly in arc length, so the arc between knots must
// be V (t_{k+1} - t_k): e is found by bisection on the lifted length. The knots' rho follow a plan (far from the King,
// low and dark, at the start; close to him, high and bright, at the frenzy) capped where the fast notes need it.
'use strict';
const fs = require('fs'), path = require('path');
const SC = require('./score.js');
const { thr, H } = SC;
const TAU = 2 * Math.PI;

// ---------------------------------------------------------------- complex arithmetic on [re, im]
const cm = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cs = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cabs = (a) => Math.hypot(a[0], a[1]);
const cexp = (a) => { const r = Math.exp(a[0]); return [r * Math.cos(a[1]), r * Math.sin(a[1])]; };
const clog = (a) => [Math.log(cabs(a)), Math.atan2(a[1], a[0])];

// ---------------------------------------------------------------- the hall
const HALL = { a: 1e-4, zeros: [0, 1, 2, 3, 4, 5].map((k) => [Math.cos(k * TAU / 6), Math.sin(k * TAU / 6)]), poles: [[0, 0], [0, 0], [0, 0]] };
const A = HALL.a;
const z3 = (z) => cm(z, cm(z, z));
const F = (z) => { const c = z3(z); return cdv(cs(cm(c, c), [1, 0]), c).map((v) => A * v); };   // a (z^6 - 1)/z^3
const G = (z) => { const c = z3(z), z6 = cm(c, c); return cs(cdv(cm([6, 0], cdv(z6, z)), cs(z6, [1, 0])), cdv([3, 0], z)); };   // F'/F
const rhoOfR = (r) => Math.log(A) - 3 * Math.log(r);   // near the King
const rOfRho = (rho) => Math.exp((Math.log(A) - rho) / 3);

function solve(z, zeta) {
  for (let it = 0; it < 40; it++) {
    const r = clog(cm(F(z), cexp([-zeta[0], -zeta[1]])));
    if (cabs(r) < 1e-13) return z;
    const dz = cdv(r, G(z)), s = Math.min(1, 0.2 * cabs(z) / Math.max(1e-15, cabs(dz)));
    z = [z[0] - s * dz[0], z[1] - s * dz[1]];
  }
  const r = clog(cm(F(z), cexp([-zeta[0], -zeta[1]])));
  return cabs(r) < 1e-10 ? z : null;
}
// lift the zeta path P(u), u in [0, 1], from z0 (F(z0) = e^P(0)): {pts (z0 not included), L}
function lift(P, z0) {
  const pts = [];
  let z = z0, u = 0, h = 1 / 64, L = 0, zp = P(0);
  while (u < 1) {
    const u1 = Math.min(1, u + h), zt = P(u1), pr = cdv(cs(zt, zp), G(z)), zg = [z[0] + pr[0], z[1] + pr[1]];
    const maxDz = Math.min(0.004, 0.06 * cabs(z));
    const z1 = cabs(pr) > maxDz ? null : solve(zg, zt);
    if (!z1 || cabs(cs(z1, zg)) > 0.1 * cabs(pr) + 1e-12) { h /= 2; if (h < 1e-10) throw new Error('lift failed'); continue; }
    L += cabs(cs(z1, z)); z = z1; u = u1; zp = zt; pts.push(z);
    if (cabs(pr) < 0.4 * maxDz) h = Math.min(2 * h, 1 / 8);
  }
  return { pts, L };
}

// ---------------------------------------------------------------- the route
const V = 0.6;                 // plane units a second (Listen along: uniform in arc length)
const M_RATE = 128;            // Listen along's samples a second (900 over 7 s today): the example keeps that density
const MARG = H + 0.004;        // how far past a line (turns) the run goes before the petal: the band and 1.4 degrees
const R0 = 0.33, R1 = 0.075;   // the plan: the route's radius at the first note and at the end of the third statement
const RMAX = 0.86;             // petals stay inside the hall (the trolls at radius 1)
const FEAS = 0.55;             // a knot's radius leaves this share of the shortest interval round it to its runs

function build(o = {}) {
  const S = SC.score(o), ev = S.ev, K = ev.length, W = S.W;
  const dur = S.tEnd, Tth = SC.timeOf(SC.BEATS);
  // knots: theta (turns) on the line; the plan for r, then capped by the intervals round it
  const th = ev.map((e) => thr(e.line));
  const dtOf = (k) => (k + 1 < K ? ev[k + 1].t - ev[k].t : dur - ev[k].t + ev[0].t);
  const angOf = (k) => { const b = k + 1 < K ? k + 1 : 0, tb = th[b] + (k + 1 < K ? 0 : W); return tb === th[k] ? 2 * MARG : Math.abs(tb - th[k]); };
  const r = ev.map((e) => { const u = Math.min(1, Math.max(0, (e.t - SC.LEAD) / (Tth - SC.LEAD))); return R0 * Math.pow(R1 / R0, Math.pow(u, 1.15)); });
  for (let k = 0; k < K; k++) {
    // (r/3) * TAU * ang is the arc of the runs at radius r (F ~ -a/z^3 near the King)
    const cap = (j) => FEAS * V * dtOf(j) * 3 / (TAU * angOf(j));
    r[k] = Math.min(r[k], cap(k), cap((k - 1 + K) % K));
  }
  // and the radial move between two knots costs arc too: (max r / 3) TAU ang + |rA - rB| <= FEAS V dt
  for (let pass = 0; pass < 200; pass++) {
    let moved = false;
    for (let k = 0; k < K; k++) {
      const b = (k + 1) % K, c = TAU * angOf(k) / 3, B = FEAS * V * dtOf(k);
      const iL = r[k] >= r[b] ? k : b, iS = iL === k ? b : k;
      if (r[iS] * c > B) { r[iS] = B / c; moved = true; }
      const lim = (B + r[iS]) / (1 + c);
      if (r[iL] > lim + 1e-12) { r[iL] = lim; moved = true; }
    }
    if (!moved) break;
  }
  const rho = r.map(rhoOfR);
  // seat the first knot: z^3 = -a e^{-zeta}, refined
  const zeta0 = [rho[0], TAU * th[0]];
  const m0 = Math.exp((Math.log(A) - zeta0[0]) / 3), a0 = (Math.PI - zeta0[1]) / 3;
  let z = solve([m0 * Math.cos(a0), m0 * Math.sin(a0)], zeta0);
  const knots = [z], segs = [];
  for (let k = 0; k < K; k++) {
    const last = k + 1 === K, b = last ? 0 : k + 1;
    const dA = ev[k].dir, dB = ev[b].dir;
    const tA = TAU * th[k], tB = TAU * (th[b] + (last ? W : 0));
    const rA = rho[k], rB = rho[b];
    const hair = tA === tB;
    if (hair && dA === dB) throw new Error('bad walk at ' + k);
    const t1 = tA + dA * TAU * MARG, t2 = hair ? t1 : tB - dB * TAU * MARG;
    // the two runs
    const run1 = lift((u) => [rA, tA + (t1 - tA) * u], z);
    const zr1 = run1.pts[run1.pts.length - 1];
    const want = V * dtOf(k);
    // the petal: rho dips by e (toward the trolls) between the runs; in a hairpin it also leans 0.35 of the cell's
    // free depth into the cell and back (an open loop, not a line traced twice)
    const cell = dA > 0 ? ev[k].line : ev[k].line - 1, free = TAU * (thr(cell + 1) - thr(cell) - 2 * MARG);
    const lean = hair ? Math.min(0.35 * free, 0.2 * want * 3 / (1.6 * rOfRho(Math.max(rA, rB)))) : 0;
    const petal = (e) => (u) => [rA + (rB - rA) * u - e * Math.sin(Math.PI * u), t1 + (t2 - t1) * u + dA * lean * 2 * Math.sin(Math.PI * u) * (1 - u)];
    const tryE = (e) => {
      const p = lift(petal(e), zr1), zp = p.pts[p.pts.length - 1];
      const run2 = lift((u) => [rB, t2 + (tB - t2) * u], zp);
      const rmax = Math.max(...p.pts.map(cabs));
      return { L: run1.L + p.L + run2.L, p, run2, rmax };
    };
    let lo = 0, hi = 0.5, q0 = tryE(0);
    if (q0.L > want) throw new Error(`interval ${k} (${ev[k].nm}${dA > 0 ? '+' : '-'} -> ${ev[b].nm}) too short: needs ${q0.L.toFixed(4)} has ${want.toFixed(4)}`);
    let qh = tryE(hi);
    while (qh.L < want) { hi *= 1.6; if (hi > 14) throw new Error(`interval ${k} too long`); qh = tryE(hi); }
    let q = qh;
    for (let it = 0; it < 50; it++) { const m = 0.5 * (lo + hi); q = tryE(m); if (q.L < want) lo = m; else hi = m; if (Math.abs(q.L - want) < 1e-9) break; }
    if (q.rmax > RMAX) throw new Error(`interval ${k}: the petal leaves the hall (r ${q.rmax.toFixed(3)})`);
    const pts = run1.pts.concat(q.p.pts, q.run2.pts);
    segs.push({ k, pts, L: q.L, e: 0.5 * (lo + hi), rmax: q.rmax });
    z = pts[pts.length - 1];
    knots.push(z);
  }
  const gap = cabs(cs(knots[K], knots[0]));
  return { S, ev, K, W, dur, rho, r, knots, segs, gap, Ltot: segs.reduce((s, x) => s + x.L, 0) };
}

// the closed polyline, starting V t_0 before the first note (on the closing petal)
function polyline(R) {
  const dense = [R.knots[0]];
  for (const s of R.segs) for (const p of s.pts) dense.push(p);
  dense.pop();   // the last point is the first knot again
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + cabs(cs(dense[i], dense[i - 1])));
  const L = cum[cum.length - 1] + cabs(cs(dense[0], dense[dense.length - 1])), s0 = L - V * R.ev[0].t;
  let j = 0; while (j < cum.length - 1 && cum[j + 1] <= s0) j++;
  const a = dense[j], b = dense[(j + 1) % dense.length], u = (s0 - cum[j]) / cabs(cs(b, a));
  const out = [[a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]];
  for (let i = j + 1; i < dense.length; i++) out.push(dense[i]);
  for (let i = 0; i <= j; i++) out.push(dense[i]);
  return { pts: out, L };
}

module.exports = { HALL, F, G, V, M_RATE, build, polyline };

if (require.main === module) {
  const t0 = Date.now();
  const R = build();
  const P = polyline(R);
  const M = Math.ceil(M_RATE * R.dur);
  console.log('events', R.K, 'W', R.W, 'gap', R.gap.toExponential(2), 'length', R.Ltot.toFixed(4), 'dur', R.dur.toFixed(4), 'L/V', (P.L / V).toFixed(4), 'pts', P.pts.length, 'M', M, 'r', Math.min(...P.pts.map(cabs)).toFixed(4), '…', Math.max(...P.pts.map(cabs)).toFixed(4), 'ms', Date.now() - t0);
  // 6 decimals: at the King's throne (r ~ 0.02) a 5-decimal grid would move arg F by up to 0.05 degrees
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  // the per-crossing velocities (the proposed per-example dynamics), in the order the harp meets the crossings
  const vel = R.ev.map((e) => e.vel);
  fs.writeFileSync(path.join(__dirname, 'route.json'), JSON.stringify({
    fn: { step: 'zp', a: '0.0001', zeros: 'the 6th roots of 1', poles: '0 (triple)', A: HALL.a },
    V, dur: +R.dur.toFixed(6), M, W: R.W, closed: true,
    score: R.ev.map((e) => ({ nm: e.nm, line: e.line, dir: e.dir, t: +e.t.toFixed(6), kind: e.kind, vel: e.vel, grieg: e.grieg || null, beat: e.beat })),
    vel, pts: P.pts.map((p) => [r6(p[0]), r6(p[1])]),
  }));
}
