const BASE = 'http://localhost:9709/';
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const out = {};
const RECT = [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }];
const st = (steps) => ({ shapes: RECT, steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' });
await view(1440, 900, false, false);
await send('Emulation.setUserAgentOverride', { userAgent: '' });
for (const [nm, steps] of [['logk3', [{ type: 'log', params: { cut: 180, k: 3 }, on: true }]], ['logk0', [{ type: 'log', params: { cut: 180, k: 0 }, on: true }]], ['root30k3', [{ type: 'root', params: { n: 30, cut: 180, k: 3 }, on: true }]], ['sqrtcut90', [{ type: 'root', params: { n: 2, cut: -90 }, on: true }, { type: 'sin', params: {}, on: true }]]]) {
  for (const lang of ['', 'ru']) {
    const ns = `vy${nm}${lang}${Date.now()}`;
    await load(ns, st(steps)); if (lang) await nav(`${BASE}test.html?ns=${ns}&lang=${lang}`);
    await settle(1500); await ev('__cmwSetMain("land")'); await settle(900);
    const L = await ev('__cmwLandSheets()');
    const cap = await ev(`__cmwCapText(['L'])`);
    const f = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'article'${lang ? ", lang: 'ru'" : ''} }); return f ? f.captionTex : null; })()`, 120000);
    out[nm + (lang || 'en')] = { K: L.drawn && L.drawn.K, title: L.title.replace(/<[^>]+>/g, ''), cap: cap.slice(0, 700), tex: f && f.slice(0, 700) };
    if (!lang) await shot('vy-' + nm);
  }
}
out.logs = (await logs()).filter((x) => /EXC|error/.test(x.t));
return out;
