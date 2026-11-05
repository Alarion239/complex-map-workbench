// Renders the 8 scenes (test/pa_scenes.js) of notes/paths-aesthetics in the steps view (x is the glide's position, 0 to the
// last plane): the live plane (light/dark x = half, light x = the last plane), the globe (x = half), and the exported paths figure (Article and Homework, black and white; the globe's
// Article B/W). Prepend: const OUT = '<dir>', ONLY = [] (scene ids), EXTRA = bool (also: Article colour, a play frame).
const SCENES = eval('(() => {' + fs.readFileSync(path.join(DIR, '..', 'pa_scenes.js'), 'utf8').replace(/SCENES;\s*$/, 'return SCENES;') + '})()');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
// waits until `cond` (a page expression) holds and the steps view is at rest, then two frames have drawn
const rest = async (cond = 'true') => {
  for (let k = 0; k < 120 && !(await ev(`(() => { try { return __cmwSteps().on && !__cmwSteps().moving && !!(${cond}); } catch (e) { return false; } })()`)); k++) await sleep(250);
  await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
};
const at = (x) => `Math.abs(__cmwSteps().x - ${x}) < 1e-6`;
const b64of = (expr) => `await (async () => { const b = await (${expr}); const u8 = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); })()`;
const clipOf = async () => ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
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
    await loadView('steps', 'pa' + sc.id + 'F', Object.assign({ pattern: 'checker', homAll: !!sc.homAll }, sc.st));
    await rest();
    await ev('__cmwSteps({ go: 0, now: true })'); await rest(at(0));
    const m = +(await ev('__cmwSteps().planes.length - 1')) || 1;
    R.m = m;
    await ev(`__cmwSteps({ x: ${0.5 * m} })`); await rest(at(0.5 * m));
    await save(`${sc.id}-plane-light-t05`);
    await view(1440, 900, true); await rest();
    await save(`${sc.id}-plane-dark-t05`);
    await view(1440, 900, false); await rest();
    await ev(`__cmwSteps({ x: ${m} })`); await rest(at(m));
    await save(`${sc.id}-plane-light-t1`);
    R.artBW = await exp(`${sc.id}-export-article-bw`, { for: 'article', cols: 1, deform: 'paths', ink: 'bw' });
    R.hwBW = await exp(`${sc.id}-export-homework-bw`, { for: 'homework', deform: 'paths', ink: 'bw' });
    if (typeof EXTRA !== 'undefined' && EXTRA) R.art = await exp(`${sc.id}-export-article-colour`, { for: 'article', cols: 1, deform: 'paths' });
    // the globe
    await ev(`__cmwSteps({ surf: 'sphere' }); 1`); await rest(`__cmwSteps().surf === 'sphere'`);
    await ev(`__cmwSteps({ x: ${0.5 * m} })`); await rest(at(0.5 * m));
    await save(`${sc.id}-globe-light-t05`);
    R.globeBW = await exp(`${sc.id}-export-globe-article-bw`, { for: 'article', cols: 1, deform: 'paths', ink: 'bw' });
    await ev(`__cmwSteps({ surf: 'plane' }); 1`); await rest(`__cmwSteps().surf === 'plane'`);
    if (typeof EXTRA !== 'undefined' && EXTRA) {
      // a play frame (motion should look like rest)
      await ev(`__cmwSteps({ x: 0, play: true })`);
      for (let k = 0; k < 80 && !(await ev('__cmwSteps().x > 0.3')); k++) await sleep(50);
      await save(`${sc.id}-plane-light-playing`);
      await ev(`__cmwSteps({ play: false })`);
    }
    R.logs = logs().filter((x) => x.t === 'EXC' || (x.t === 'error' && !/Failed to load/.test(x.m))).slice(0, 4);
  } catch (e) { R.err = String(e && e.stack || e).slice(0, 500); }
}
await view(1440, 900, false);
return res;
