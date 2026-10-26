// A filmstrip of the user's case (notes/v16-user5/SHEETS-DESIGN.md): sin √z with √ bracketed, Landscape, All sheets,
// height Im, t = 0 … 1 in steps of 0.1, desktop 1440 x 900, light and dark. Frames go to <daemon>/shots/film-*.png.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const sq = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn = { type: 'sin', params: {}, on: true };
const out = { frames: [] };
for (const dark of [false, true]) {
  await view(1440, 900, dark, false);
  const ns = 'sheetsfilm' + (dark ? 'd' : 'l') + Date.now();
  await load(ns, { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' });
  await settle(1500);
  await ev('__cmwSetMain("land")'); await settle(800);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  const r = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) }; })()`);
  for (let i = 0; i <= 10; i++) {
    const T = i / 10;
    await ev(`__cmwMorph({ T: ${T} })`); await settle(900);
    const name = `film-${dark ? 'dark' : 'light'}-${String(i).padStart(2, '0')}`;
    await shot(name, r);
    out.frames.push({ name, T, drawn: (await ev('__cmwLandSheets()')).drawn });
  }
}
await view(1440, 900, false, false);
return out;
