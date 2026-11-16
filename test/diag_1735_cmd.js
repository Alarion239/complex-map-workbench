// TEMPORARY (#1735 diagnosis, deleted before the pull request): each chainAt variant (localStorage cmw1735var, read
// by GLChain.build) against the CPU twin, at the mode-1 maps that Zen 4/5's llvmpipe (LLVM 21) drew as NaN, and at
// the other modes and chains as a check; each row is reported. A command file for a CDP daemon.
const rows = [];
const note = (name, got) => rows.push({ name, got });
let s = 9;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
await view(1440, 900, false);
note('renderer', await ev("(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : null; })()"));
const CH = {
  sinsqrt: [{ type: 'root', params: { n: 2 }, on: true }, { type: 'sin', params: {}, on: true }],
  sinsqrt90: [{ type: 'root', params: { n: 2, cut: -90 }, on: true }, { type: 'sin', params: {}, on: true }],
  sincbrt: [{ type: 'root', params: { n: 3 }, on: true }, { type: 'sin', params: {}, on: true }],
  chain3: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'pown', params: { n: 2 }, on: true }],
  moblog: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'log', params: {}, on: true }],
};
const cmp = (m, pts) => ev(`(() => { const m = ${JSON.stringify(m)}, pts = ${JSON.stringify(pts)}; let g = null; try { g = GLR.evalMap(m, pts); } catch (e) { return { err: String(e) }; } const c = __cmwEval('cpuMap', m, pts); if (!g) return { err: 'no gpu' }; let worst = 0, k = 0, nf = 0; c.forEach((w, i) => { const gx = g[2 * i], gy = g[2 * i + 1]; if (!isFinite(gx) || !isFinite(gy)) { nf++; return; } if (!w) return; k++; worst = Math.max(worst, Math.hypot(gx - w[0], gy - w[1]) / (1 + Math.hypot(w[0], w[1]))); }); return { k, nf, worst: +worst.toPrecision(3) }; })()`);
for (const v of [0, 1, 2]) {
  for (const [name, steps] of Object.entries(CH)) {
    await ev(`localStorage.setItem('cmw1735var', '${v}'), 1`);
    const box = /sqrt|cbrt/.test(name) ? [0.2, 30, -2, 2] : name === 'moblog' ? [-2, 2, 0.05, 2.5] : [-2, 2, -1.5, 1.5];
    await load('d1735' + v + name + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [box[0], box[2]], b: [box[1], box[3]] }], steps, srcView: { cx: 0, cy: 0, s: 60 } });
    await sleep(900);
    note(`v${v} ${name}: variant read`, await ev("localStorage.getItem('cmw1735var')"));
    const pts = Array.from({ length: 32 }, () => [box[0] + (box[1] - box[0]) * rnd(), box[2] + (box[3] - box[2]) * rnd()]);
    const n = steps.length;
    for (let hi = 1; hi <= n; hi++) for (const t of [0.25, 0.5, 1]) note(`v${v} ${name}: mode 1 hi ${hi} t ${t}`, await cmp({ mode: 1, hi, t }, pts));
    note(`v${v} ${name}: mode 3 0..${n} t 0.5`, await cmp({ mode: 3, a: 0, b: n, t: 0.5 }, pts));
  }
}
await ev("localStorage.removeItem('cmw1735var'), 1");
return { pass: false, nfails: rows.length, fails: rows, info: {} };
