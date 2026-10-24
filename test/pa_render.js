// Renders the 8 scenes (test/pa_scenes.js) of notes/paths-aesthetics: live merged plane (light/dark t = 0.5, light
// t = 1), the merged globe (t = 0.5), and the exported paths figure (Article and Homework, black and white; the globe's
// Article B/W). Prepend: const OUT = '<dir>', ONLY = [] (scene ids), EXTRA = bool (also: Article colour, a play frame).
const SCENES = eval('(() => {' + fs.readFileSync(path.join(DIR, '..', 'pa_scenes.js'), 'utf8').replace(/SCENES;\s*$/, 'return SCENES;') + '})()');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const b64of = (expr) => `await (async () => { const b = await (${expr}); const u8 = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); })()`;
const clipOf = async () => ev(`(() => { const b = document.getElementById('canvasR').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
const ready = async () => { await ev('await __cmwMorphSel()', 60000); await settle(400); };
const exp = async (name, opts) => {
  const r = await ev(`await (async () => { try { const f = await __cmwFig.build(${JSON.stringify(opts)}); if (!f) return { none: 1 }; window.__f = f; return { W: f.W, H: f.H, info: f.info && { kept: f.info.kept }, cap: (f.captionTex || '').slice(0, 300) }; } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 180000);
  if (!r || r.err || r.none) return r;
  const b = await ev(b64of('__cmwFig.png(window.__f, 300)'), 120000);
  if (typeof b === 'string') fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(b, 'base64'));
  const s = await ev('window.__f.svg', 60000);
  if (typeof s === 'string') fs.writeFileSync(path.join(OUT, name + '.svg'), s);
  return { W: r.W, H: r.H, kept: r.info && r.info.kept };
};
const save = async (name) => { const c = await clipOf(); const f = await shot('_tmp', c); fs.copyFileSync(f, path.join(OUT, name + '.png')); };
for (const sc of SCENES) {
  if (typeof ONLY !== 'undefined' && ONLY.length && !ONLY.includes(sc.id)) continue;
  const R = res[sc.id] = {};
  try {
    await view(1440, 900, false);
    await load('pa' + sc.id + 'F', Object.assign({ pattern: 'checker', homAll: !!sc.homAll }, sc.st));
    await settle(900);
    await ev('__cmwMorph({ open: true, playing: false })'); await settle(700);
    const m = +(await ev(`document.getElementById('morphRange').max`)) || 1;
    R.m = m;
    await ev(`__cmwMorph({ T: ${0.5 * m} })`); await settle(600); await ready();
    await save(`${sc.id}-plane-light-t05`);
    await view(1440, 900, true); await settle(900); await ready();
    await save(`${sc.id}-plane-dark-t05`);
    await view(1440, 900, false); await settle(700);
    await ev(`__cmwMorph({ T: ${m} })`); await settle(600); await ready();
    await save(`${sc.id}-plane-light-t1`);
    R.artBW = await exp(`${sc.id}-export-article-bw`, { for: 'article', cols: 1, deform: 'paths', ink: 'bw' });
    R.hwBW = await exp(`${sc.id}-export-homework-bw`, { for: 'homework', deform: 'paths', ink: 'bw' });
    if (typeof EXTRA !== 'undefined' && EXTRA) R.art = await exp(`${sc.id}-export-article-colour`, { for: 'article', cols: 1, deform: 'paths' });
    // the globe
    await ev(`__cmwSetView('R', 'sphere'); 1`); await settle(1500);
    await ev(`__cmwMorph({ T: ${0.5 * m} })`); await settle(900); await ready(); await settle(600);
    await save(`${sc.id}-globe-light-t05`);
    R.globeBW = await exp(`${sc.id}-export-globe-article-bw`, { for: 'article', cols: 1, deform: 'paths', ink: 'bw' });
    await ev(`__cmwSetView('R', 'plane'); 1`); await settle(600);
    if (typeof EXTRA !== 'undefined' && EXTRA) {
      // a play frame (motion should look like rest)
      await ev(`__cmwMorph({ T: 0, playing: true })`); await sleep(1100);
      await save(`${sc.id}-plane-light-playing`);
      await ev(`__cmwMorph({ playing: false })`);
    }
    R.logs = logs().filter((x) => x.t === 'EXC' || (x.t === 'error' && !/Failed to load/.test(x.m))).slice(0, 4);
  } catch (e) { R.err = String(e && e.stack || e).slice(0, 500); }
}
await view(1440, 900, false);
return res;
