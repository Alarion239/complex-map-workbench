// v16.2 release smoke, the user's case with hooks (test.html): sin √z with √ bracketed, Landscape, All sheets, height
// Im. At t = 0 the drawn surfaces of H_0 = sin z coincide (one surface), at t = 1 they are sin √z and −sin √z (two):
// __cmwLandSheets() for what is drawn and the CPU twin (Funcs.sheetMapEval of the deformation's map) on a 7 x 7 grid.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}/`;
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const sq = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn = { type: 'sin', params: {}, on: true };
const st = { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' };
const spread = () => ev(`(() => { const p = __cmwP(), b = p.steps.map((s) => Funcs.build(s)), m = __cmwState().homView.map; const d = [];
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) { const z = CX.C(-3 + i, -3 + j); if (Math.hypot(z.re, z.im) < 1e-9) continue; const a = Funcs.sheetMapEval(p.steps, b, m, z, z, 0, 2), c = Funcs.sheetMapEval(p.steps, b, m, z, z, 1, 2); d.push(Math.hypot(a.re - c.re, a.im - c.im) / (1 + Math.hypot(a.re, a.im))); }
  d.sort((x, y) => x - y); return { n: d.length, max: d[d.length - 1], median: d[d.length >> 1], min: d[0] }; })()`);
for (const [w, h, phone] of [[1440, 900, false], [390, 844, true]]) {
  await view(w, h, false, phone);
  await send('Emulation.setUserAgentOverride', phone ? { userAgent: ANDROID, platform: 'Android' } : { userAgent: '' });
  await load('rel162sh' + w + Date.now(), st); await settle(1500);
  await ev('__cmwSetMain("land")'); await settle(800);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(800);
  for (const T of [0, 1]) {
    await ev(`__cmwMorph({ T: ${T} })`); await settle(1200);
    const s = await ev('__cmwLandSheets()'), d = await spread();
    info[`${w} t=${T}`] = { drawn: s.drawn, d };
    await shot(`rel162-sheets-${w}-t${T}`);
    ok(`${w} t=${T}: 2 surfaces of H_t drawn (F's two sheets)`, s.drawn && s.drawn.K === 2 && s.drawn.hom === true, s.drawn);
    if (T === 0) ok(`${w} t=0: the two surfaces coincide (H_0 = sin z): one surface`, d.n === 48 && d.max < 1e-9, d);
    else ok(`${w} t=1: the two surfaces differ (sin √z and −sin √z): two surfaces`, d.n === 48 && d.median > 0.1 && d.min > 1e-6, d);
  }
}
const l = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', l.length === 0, l.slice(0, 4));
await view(1440, 900, false, false); await send('Emulation.setUserAgentOverride', { userAgent: '' });
return { pass: fails.length === 0, fails, info };
