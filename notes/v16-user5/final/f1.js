const BASE = 'http://127.0.0.1:9710/';
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const out = {};
const RECT = [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }];
const st = (steps) => ({ shapes: RECT, steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' });
const RT = (n) => ({ type: 'root', params: { n, cut: 180 }, on: true }), LG = { type: 'log', params: { cut: 180, k: 0 }, on: true }, CU = (expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true });
await view(1440, 900, false, false);
await send('Emulation.setUserAgentOverride', { userAgent: '' });
const cases = [['user', [RT(2), CU('\\sin(z)')], { a: 1, b: 1 }, [0, 0.25, 0.5, 1]], ['logsin', [LG, CU('\\sin(z)')], { a: 1, b: 1 }, [0, 0.5, 1]], ['whole', [RT(2), CU('\\sin(z)')], null, [0.5, 1.5, 2]]];
for (const [nm, steps, range, Ts] of cases) {
  const ns = `xvf${nm}${Date.now()}`;
  await load(ns, st(steps)); await settle(1500); await ev('__cmwSetMain("land")'); await settle(900);
  out[nm] = {};
  await ev(`__cmwMorph({ open: true, playing: false, range: ${JSON.stringify(range)}, T: 0 })`); await settle(1200);
  for (const T of Ts) {
    await ev(`__cmwMorph({ T: ${T} })`); await settle(900);
    const L = await ev('__cmwLandSheets()');
    out[nm][T] = { K: L.drawn && L.drawn.K, title: (L.title || '').replace(/<[^>]+>/g, '') };
    await shot(`f1-${nm}-T${T}`);
  }
  out[nm].cap = (await ev(`__cmwCapText(['L'])`) || '').slice(-700);
  if (nm === 'user') {
    await ev('__cmwMorph({ T: 0, playing: true })');
    out.userFrames = await ev('__qa.frames(3000)', 20000);
    await ev('__cmwMorph({ playing: false })');
  }
  if (nm === 'whole') {
    out.wholeTex = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'article' }); return f ? f.captionTex : null; })()`, 180000);
    out.wholeTexRu = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'article', lang: 'ru' }); return f ? f.captionTex : null; })()`, 180000);
  }
}
out.logs = (await logs()).filter((x) => /EXC|error/.test(x.t));
return out;
