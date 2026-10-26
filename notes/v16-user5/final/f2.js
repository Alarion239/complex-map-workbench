// frame times while playing with All sheets (verify-2's scale samples are computed during play): the user's case
// (√ then sin, √ bracketed) at 1440 and 390 phone, and the capped chain (5th root then 6th root, 24 surfaces) at 1440
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const setView = async (w, h, dark, phone) => { await view(w, h, dark, phone); await send('Emulation.setUserAgentOverride', phone ? { userAgent: ANDROID, platform: 'Android' } : { userAgent: '' }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const base = { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, height: 'im', sheets: true };
const R = (n) => ({ type: 'root', params: { n, cut: 180 }, on: true });
const out = [];
for (const [nm, steps, range, w, h, phone] of [['user', [R(2), { type: 'sin', params: {}, on: true }], { a: 1, b: 1 }, 1440, 900, false], ['user', [R(2), { type: 'sin', params: {}, on: true }], { a: 1, b: 1 }, 390, 844, true], ['capped', [R(5), R(6)], null, 1440, 900, false]]) {
  await setView(w, h, false, phone);
  for (let rep = 0; rep < 2; rep++) {
    await load(`xvf2${nm}${w}${rep}${Date.now()}`, Object.assign({}, base, { steps })); await settle(1500);
    await ev('__cmwSetMain("land")'); await settle(800);
    await ev(`__cmwMorph({ open: true, playing: false, range: ${JSON.stringify(range)} })`); await settle(900);
    await ev('__cmwMorph({ T: 0, playing: true })');
    const f = await ev('await (async () => await __qa.frames(3000))()', 30000);
    const L = await ev('__cmwLandSheets()');
    await ev('__cmwMorph({ playing: false })');
    out.push({ nm, w, rep, K: L.drawn && L.drawn.K, f });
  }
}
out.push({ logs: (await logs()).filter((x) => x.t === 'EXC' || x.t === 'error') });
return out;
