// context loss and restore: at rest (All sheets), and while playing; base and r3
const B = 'base/test.html', T = 'test.html';
const out = {};
const RCT = `(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) }; })()`;
const diff = (A, Bm) => { let n = 0, m = 0; for (let i = 0; i < A.data.length; i += A.ch * 5) { n++; if (Math.abs(A.data[i] - Bm.data[i]) + Math.abs(A.data[i + 1] - Bm.data[i + 1]) + Math.abs(A.data[i + 2] - Bm.data[i + 2]) > 30) m++; } return +(100 * m / n).toFixed(2); };
for (const page of (globalThis.__xp || [B, T])) {
  const o = out[page === B ? 'base' : 'r3'] = {};
  await ld(page, 'rvx' + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' });
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(4000);
  const r = await ev(RCT);
  const A = await img(r);
  await ev(`window.__lc = document.getElementById('canvasL').getContext('webgl2').getExtension('WEBGL_lose_context'); 1`);
  await ev(GAPON);
  await ev('__lc.loseContext(); 1'); await sleep(800); await ev('__lc.restoreContext(); 1');
  const t0 = Date.now(); let back = null;
  while (Date.now() - t0 < 8000) { const im = await img(r); if (diff(A, im) < 1) { back = Date.now() - t0; break; } await sleep(100); }
  await settle(2500);
  const A2 = await img(r);
  o.rest = { backMs: back, diffAfter3s: diff(A, A2), gaps: (await ev('__gap.gaps')).map((x) => x.join('@')).join(' ') };
  if (page === T) o.rest.refine = await ev(`(() => { const R = GLR.landRefine(false); const f = (q) => q && { N: q.N, evals: q.evals, entries: q.entries }; return { land: f(R.land), sheets: f(R.sheets) }; })()`);
  await shot('ctx-rest-' + (page === B ? 'base' : 'r3'));
  // during play
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(1200);
  await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(700);
  await ev('__lc.loseContext(); 1'); await sleep(500); await ev('__lc.restoreContext(); 1'); await sleep(1500);
  const fr = await ev('await (async () => await __qa.frames(2500))()', 30000);
  await ev('__cmwMorph({ playing: false, T: 1 })'); await settle(3000);
  const Bi = await img(r);
  await ev('__cmwMorph({ open: false })'); await settle(2500);
  const C = await img(r);
  o.play = { framesAfterRestore: fr, diffVsStartAfterClose: diff(A, C) };
  if (page === T) o.play.refine = await ev(`(() => { const R = GLR.landRefine(false); const f = (q) => q && { N: q.N, evals: q.evals, entries: q.entries }; return { land: f(R.land), sheets: f(R.sheets) }; })()`);
  await shot('ctx-play-' + (page === B ? 'base' : 'r3'));
  o.logs = logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 8);
}
return out;
