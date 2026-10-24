// node tools/verify.js: the mathematical checks behind the fixes of review-math.json and review-sound.json, run on the
// page's own controller code (proto/core.js) at the laptop layout (386 px portrait) and the phone layout (309 px).
// Prints one line per check; "ok" or "FAIL".
const path = require('path'), H = path.resolve(__dirname, '..');
const C = require(path.join(H, 'proto', 'core.js'));
let fails = 0;
const say = (ok, what) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + what); };
const NOTE = (n) => C.NOTE_OF_H[n] || 'h' + n;
// run a gesture through a session; collect the commands
function sim(opt, fn, kind, css = 386, set = {}) {
  const g = C.gesture(fn, kind); if (!g) return null;
  const cmds = [], out = { eng: (c) => cmds.push(c), voice() {}, drone() {} }, ss = new C.Session(out, opt, set), ppu = css / (2 * fn.view[2]);
  ss.start(0, fn, g); const frames = [];
  for (let u = 0; u <= g.dur + 1e-9; u += 1 / 60) { const p = g.at(Math.min(u, g.dur)); const fr = ss.frame(u, p, ppu); frames.push({ u, info: ss.info, p, fr }); }
  ss.end(g.dur + 1 / 60);
  return { g, cmds, frames, info: ss.info };
}
const top = (A) => { let n = 1; for (let i = 0; i < A.length; i++) if (A[i] > A[n - 1]) n = i + 1; return n; };

// hfmath-1: the harp on the deformation plays, in the direction the probe's arg H_t turns
for (const css of [386, 309]) for (const fn of C.FUNCS) {
  if (fn.cut) continue;
  const r = sim('harp', fn, 'deform', css), df = C.deformFacts(fn);
  const strs = r.cmds.filter((c) => c.k === 'cue' && c.str);
  say(strs.length >= 2 && /[↑↓]/.test(r.info) && (df.dphi > 0 ? /↑/ : /↓/).test(r.info), `harp deform ${fn.id} @${css}px: ${strs.length} strings, last ${r.info.split('  ·  ')[0]}, arg H turns ${df.dphi.toFixed(3)}`);
}
// hfmath-2: "Loop: a zero" exists only for a simple zero (or √z's branch point)
for (const fn of C.FUNCS) { const t = C.target(fn, 'zero'); say(!t || t[2] === 1 || t[2] < 1, `loop-a-zero target on ${fn.id}: ${t ? 'order ' + t[2] : 'none (disabled)'}`); }
// hfmath-3: option 4's growing circle: the strongest harmonic is 4 + W at every radius (λ-compressed)
for (const id of ['exp', 'sin', 'mob', 'z2m1', 'z3', 'dz']) {
  const fn = C.byId[id], hw = fn.view[2]; let bad = 0, n = 0, minShare = 1;
  for (let k = 1; k <= 40; k++) { const r = Math.SQRT2 * hw * k / 40, sp = C.curveSpectrum(fn, null, C.circlePts([0, 0, r], 256), 512, 386 / (2 * hw)); if (!sp || !sp.ok) continue; const A = C.toAmps(sp.b, -8, 20, { centre: sp.W }); n++; let e = 0; for (const a of A) e += a * a; const t = top(A); minShare = Math.min(minShare, A[t - 1] * A[t - 1] / e); if (t !== 4 + sp.W) bad++; }
  say(bad === 0, `hear the view on ${id}: strongest harmonic = 4 + W at ${n - bad}/${n} radii (lowest share ${Math.round(100 * minShare)} %)`);
}
// hfmath-4: the ring's note is W of the ring, so a zero and a pole outside sound the same note (D5), and the order is
// exact inside
for (const [id, kind] of [['mob', 'zero'], ['mob', 'pole'], ['z2m1', 'zero'], ['dz', 'dzero'], ['z3', 'dzero']]) {
  const fn = C.byId[id], g = C.gesture(fn, kind), p = g.at(1), sp = C.ringSpectrum(fn, null, p.x, p.y, 20 / (386 / (2 * fn.view[2]))), R = C.ringAmps(sp, false);
  say(top(R.A) === 4 && R.W === 0, `ring on the ${id} ${kind} loop (outside the ring): ${NOTE(top(R.A))}, W = ${R.W}`);
}
// hfmath-5 / snd-2: the ring beside each point of the visit, and on the sweep, gives the order
for (const css of [386, 309]) for (const fn of C.FUNCS) {
  const g = C.gesture(fn, 'visit'); if (!g) continue;
  for (const [i, tg] of g.targets.entries()) {
    const W = tg[2] < 1 ? null : fn.poles.includes(tg) ? -tg[2] : tg[2];
    const r = sim('ring', fn, 'visit', css), u = i === 0 ? 1.85 : 1.2 + 1.3 + 1.6 + 0.65, f = r.frames.find((x) => x.u >= u);
    const hv = r.cmds.filter((c) => c.k === 'hv' && c.amps && c.at <= u + 1e-6).pop();
    if (W === null) { say(/no exact count/.test(f.info), `visit ${fn.id} @${css}: beside the branch point: ${f.info}`); continue; }
    say(top(hv.amps) === 4 + W, `visit ${fn.id} @${css}: beside the ${tg[2] > 1 ? 'order-' + tg[2] + ' ' : ''}${W < 0 ? 'pole' : 'zero'}: ${NOTE(top(hv.amps))} (expected ${NOTE(4 + W)})`);
  }
}
for (const id of ['dz', 'z3', 'mob']) {
  const fn = C.byId[id], r = sim('ring', fn, 'sweep'), seen = new Set(r.cmds.filter((c) => c.k === 'hv' && c.amps).map((c) => NOTE(top(c.amps))));
  const want = id === 'dz' ? ['A5', 'A4'] : id === 'z3' ? ['C6'] : ['F♯5', 'A4'];
  say(want.every((w) => seen.has(w)), `ring on the ${id} sweep sounds ${[...seen].join(', ')} (needs ${want.join(', ')})`);
}
// hfmath-6: option 4's live loop: W steps at half a lap and a lap and a half, never a spurious value
for (const [id, kind, want] of [['z2m1', 'zero', [0, 1, 2]], ['mob', 'pole', [0, -1, -2]], ['z3', 'dzero', [0, 3, 6]], ['dz', 'dzero', [0, 2, 4]]]) {
  const fn = C.byId[id], r = sim('curve', fn, kind), seq = [], at = [];
  for (const f of r.frames) { const m = /W = ([+−]?\d+)/.exec(f.info); if (!m) continue; const w = +m[1].replace('−', '-').replace('+', ''); if (seq[seq.length - 1] !== w) { seq.push(w); at.push((f.u / 2).toFixed(2)); } }
  say(JSON.stringify(seq) === JSON.stringify(want), `curve live ${id} ${kind}: W ${seq.join(' → ')} at laps ${at.join(', ')}`);
}
// hfmath-7: no false D3 below a simple pole (the fold is gone)
{ const fn = C.byId.mob, sp = C.ringSpectrum(fn, null, -1 + 0.01, 0.06, 20 / 96.5), R = C.ringAmps(sp, false); say(R.A[0] < 0.3 * R.A[2], `ring just off the pole of (z − 1)/(z + 1): D3 ${(20 * Math.log10(R.A[0] / R.A[2])).toFixed(1)} dB re A4`); }
// hfmath-9: the sweep comes within the ping radius
for (const id of ['z2m1', 'mob', 'dz', 'sin', 'z3']) { const r = sim('today', C.byId[id], 'sweep', 309), pings = r.cmds.filter((c) => c.k === 'cue' && (c.wet === 0.2 || c.wet === 0.14) && c.parts.length > 3).length; say(pings > 0, `sweep pings on ${id} @309px: ${pings}`); }
// hfmath-8: √z: the sweep crosses the cut once (one tick, no turn bell for the jump)
{ const r = sim('today', C.byId.sqrt, 'sweep'), ticks = r.cmds.filter((c) => c.k === 'cue' && c.wet === 0.08).length; say(ticks === 1, `√z sweep: ${ticks} cut tick(s)`); }
{ const r = sim('harp', C.byId.sqrt, 'zero'); say(/net/.test(r.info), `√z loop on the harp: ${r.info}`); }
{ const r = sim('curve', C.byId.sqrt, 'zero'); say(/cut/.test(r.frames[r.frames.length - 1].info), `√z loop on option 4: ${r.frames[r.frames.length - 1].info}`); }
// the harp's exact count on the loops (PROTOTYPE's check, after the changes)
for (const [id, kind, W] of [['z2m1', 'zero', 2], ['mob', 'pole', -2], ['dz', 'dzero', 4], ['z3', 'dzero', 6]]) { const r = sim('harp', C.byId[id], kind); const m = /net ([+−]?\d+)/.exec(r.info); say(m && +m[1].replace("−", "-") === W, `harp D count on ${id} ${kind}: ${m ? m[1] : '?'} (W = ${W})`); }
// snd-6: the glass harp's zero ping is wood
{ const r = sim('harp', C.byId.mob, 'visit', 386, { mat: 'glass' }), z = r.cmds.filter((c) => c.k === 'cue' && c.wet === 0.16).length; say(z >= 1, `glass harp zero ping in wood: ${z}`); }
console.log(fails ? fails + ' FAILED' : 'all checks pass');
