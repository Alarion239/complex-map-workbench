// The deformation range at the gl.js level (notes/deform-range/SPEC.md 13.3): GLR.evalMap (the vertex program's
// mapPoint, through transform feedback) against the CPU twin __cmwEval('cpuMap') at 64 probes, for chain3, sin∘√ and
// Möbius-log, every bracket, t in {0, end/2, end}, one after another and all at once; mapKeyOf, isIdent and mapFor
// with the post. A command file for a CDP daemon:  <runner> test/deform_range_gl_cmd.js
const fails = [], info = { rows: 0, worst: 0, worstAt: null };
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const MOB = { a: '1', b: '-1', c: '1', d: '1' };
const CHAINS = {
  chain3: { steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: MOB, on: true }, { type: 'pown', params: { n: 2 }, on: true }], box: [-2, 2, -1.5, 1.5] },
  sinsqrt: { steps: [{ type: 'root', params: { n: 2 }, on: true }, { type: 'sin', params: {}, on: true }], box: [0.2, 30, -2, 2] },
  moblog: { steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'log', params: {}, on: true }], box: [-2, 2, 0.05, 2.5] },
};
let s = 9;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
await view(1440, 900, false);
for (const [name, ch] of Object.entries(CHAINS)) {
  await load('drgl' + name + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [ch.box[0], ch.box[2]], b: [ch.box[1], ch.box[3]] }], steps: ch.steps, srcView: { cx: 0, cy: 0, s: 60 } });
  await sleep(900);
  await ev('__cmwMorph({ open: true, playing: false })'); await sleep(300);
  const pts = Array.from({ length: 64 }, () => [ch.box[0] + (ch.box[1] - ch.box[0]) * rnd(), ch.box[2] + (ch.box[3] - ch.box[2]) * rnd()]);
  const n = ch.steps.length;
  for (let a = 1; a <= n; a++) for (let b = a; b <= n; b++) for (const all of [false, true]) {
    const r = await ev(`(() => { __cmwMorph({ range: { a: ${a}, b: ${b} } }); const sel = document.getElementById('homOrderSel'); if (sel && !sel.disabled) { sel.value = '${all ? 'all' : 'steps'}'; sel.dispatchEvent(new Event('change')); } const len = +document.getElementById('morphLabel').textContent.split('/')[1]; const out = []; for (const T of [0, len / 2, len]) { __cmwMorph({ T }); const m = __cmwState().homView.imageMap; const g = GLR.evalMap(m, ${JSON.stringify(pts)}); const c = __cmwEval('cpuMap', m, ${JSON.stringify(pts)}); let worst = 0, k = 0, nf = 0; c.forEach((w, i) => { const gx = g[2 * i], gy = g[2 * i + 1]; if (!w) { if (isFinite(gx) && isFinite(gy) && Math.hypot(gx, gy) < 1e30) nf++; return; } if (!isFinite(gx) || !isFinite(gy)) { nf++; return; } k++; worst = Math.max(worst, Math.hypot(gx - w[0], gy - w[1]) / (1 + Math.hypot(w[0], w[1]))); }); out.push({ T, m, worst, k, nf }); } return out; })()`, 60000);
    for (const q of r) {
      info.rows++;
      if (q.worst > info.worst) { info.worst = q.worst; info.worstAt = { name, a, b, all, T: q.T, m: q.m }; }
      // (tolerance as glsl_test: 2e-4 relative; a point the GPU cannot evaluate in float32 is counted, not failed, when few)
      ok(`${name} ${a}…${b}${all ? ' all' : ''} T ${q.T}: GPU = CPU (64 probes)`, q.worst <= 2e-4 && q.nf <= 2, q);
    }
  }
  await ev('__cmwMorph({ open: false, range: null })');
}
// mapKeyOf, isIdent, mapFor with the post
await load('drglk' + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-1, -1], b: [1, 1] }], steps: [{ type: 'exp', params: {}, on: false }, { type: 'mobius', params: MOB, on: true }, { type: 'pown', params: { n: 2 }, on: true }] });
await sleep(900);
const k = await ev(`(() => { const M = GLR._map; return {
  keys: [M.mapKeyOf({ mode: 1, hi: 1, t: 0.5, b: 1 }), M.mapKeyOf({ mode: 1, hi: 1, t: 0.5, b: 1, post: 3 })],
  ident: M.isIdent({ mode: 1, hi: 1, t: 0.5, b: 1, post: 3 }), identNoPost: M.isIdent({ mode: 1, hi: 1, t: 0.5 }),
  mapFor: (() => { try { return M.mapFor({ mode: 1, hi: 1, t: 0.5, b: 1, post: 3 }, ['x', 'y', 'z']); } catch (e) { return { err: String(e) }; } })(),
  mapFor3: (() => { try { return M.mapFor({ mode: 3, a: 0, b: 2, t: 0.5, post: 3 }, ['x', 'y', 'z']); } catch (e) { return { err: String(e) }; } })() }; })()`);
info.mapHelpers = k;
ok('mapKeyOf differs for two specs that differ only in post', k.keys[0] !== k.keys[1], k.keys);
ok('isIdent is false with a live post when f1 is off', k.ident === false, k);
ok('isIdent without the post: true (f1 off)', k.identNoPost === true, k);
ok('mapFor with a changed step inside the post: the mode-0 fallback', k.mapFor && k.mapFor.mode === 0 && !k.mapFor.err, k.mapFor);
ok('mapFor (mode 3) with a changed step inside the post: the mode-0 fallback', k.mapFor3 && k.mapFor3.mode === 0 && !k.mapFor3.err, k.mapFor3);
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
