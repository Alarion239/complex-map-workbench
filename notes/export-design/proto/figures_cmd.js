// Round 2: builds the prototype figures (proto/figures.js on proto/compose.js) in the app copy and writes SVG, PDF,
// PNG, a grey proof per figure (M3) and the typeset boxes for the preflight (M4) to proto/out/.
// Run: cdp/q.sh proto/figures_cmd.js   (globalThis.XD_ONLY = ['cayley', ...] to limit)
const OUT = path.join(DIR, '..', 'proto', 'out');
const PROTO = path.join(DIR, '..', 'proto');
fs.mkdirSync(OUT, { recursive: true });
const evp = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? { __exc: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text } : r.result.value; };
const write = (name, data) => {
  const f = path.join(OUT, name);
  if (/^data:/.test(data)) fs.writeFileSync(f, Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
  else fs.writeFileSync(f, data);
  return fs.statSync(f).size;
};
const inject = async () => evp(fs.readFileSync(path.join(PROTO, 'compose.js'), 'utf8') + '\n' + fs.readFileSync(path.join(PROTO, 'figures.js'), 'utf8') + '\n1');
const R = {};
const emit = async (name, call, fmt = {}) => {
  const t0 = Date.now();
  const r = await evp(`(async () => { XD.rec = []; const f = await ${call}; window.__fig = f; const labels = XD.rec; XD.rec = null; return { W: f.W, H: f.H, labels, boxes: f.boxes, lines: f.lines }; })()`);
  if (!r || r.__exc) { R[name] = r; return; }
  const o = R[name] = { W: r.W, H: r.H, in: [+(r.W / 72).toFixed(3), +(r.H / 72).toFixed(3)], buildMs: Date.now() - t0 };
  fs.writeFileSync(path.join(OUT, name + '-boxes.json'), JSON.stringify({ W: r.W, H: r.H, boxes: r.boxes, lines: r.lines, target: fmt.target || null }));
  o.svg = write(name + '.svg', await evp('__fig.svg'));
  if (fmt.pdf !== false) o.pdf = write(name + '.pdf', await evp(`XD.pdf(__fig, Object.assign({ title: ${JSON.stringify(name)} }, __fig.meta))`));
  if (fmt.png) { const p = await evp(`XD.png(__fig, ${fmt.png}, __fig.meta, ${!!fmt.grey})`); o.png = [write(name + `-${fmt.png}dpi.png`, p.url), p.w, p.h]; }
  const g = await evp('XD.greyProof(__fig, 200)'); o.grey = write(name + '-grey.png', g.url);
  if (fmt.labels) fs.writeFileSync(path.join(OUT, name + '-labels.json'), JSON.stringify({ W: r.W, H: r.H, labels: r.labels }, null, 1));
  o.ms = Date.now() - t0;
};
const only = globalThis.XD_ONLY || null;
const want = (n) => !only || only.includes(n);
await send('Network.enable', {}); await send('Network.setCacheDisabled', { cacheDisabled: true });
await view(1440, 900, false);
await load('xdproto2', { shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }], steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], pattern: 'checker' });
await sleep(1200);
await inject();
await evp('__xdArt(true); __cmwHideStrokes(true); 1');
R.check = await evp('XF.check()');
if (want('cayley')) {
  await emit('cayley', 'XF.cayley("cayley", 246)', { png: 600, labels: true, target: 246 });
  if (R.cayley && !R.cayley.__exc) { // the overlay format: the same figure without text
    await evp('(async () => { XD.textOff = true; window.__art = await XF.cayley("cayley-art", 246); XD.textOff = false; return 1; })()');
    R.cayley.artPdf = write('cayley-art.pdf', await evp('XD.pdf(__art, { title: "cayley (art, labels in LaTeX)" })'));
  }
}
if (want('cayley-bw')) await emit('cayley-bw', 'XF.cayley("cayley-bw", 246, "mono")', { png: 600, grey: true, target: 246 });
if (want('cayley-amsart')) await emit('cayley-amsart', 'XF.cayley("cayley-amsart", 360)', { target: 360 });
if (want('cayley-wide')) await emit('cayley-wide', 'XF.cayleyWide()', { png: 300, target: 510 });
if (want('cayley-hw')) await emit('cayley-hw', 'XF.homework(false)', { target: 360 });
if (want('cayley-hw-docs')) await emit('cayley-hw-docs', 'XF.homework(true)', { pdf: false, png: 300, target: 360 });
if (want('filmstrip')) {
  await evp('__cmwMorph({ open: true })'); await sleep(600);
  await emit('cayley-deformation', 'XF.filmstrip()', { target: 510 });
  await evp('__cmwMorph({ open: false })');
}
if (want('phase')) {
  // the key: the app's own colouring of f(z) = z; then the portrait of f
  const phaseScene = (expr) => ({ shapes: [], steps: [{ type: 'custom', params: { expr, cut: 180 }, on: true }], pattern: 'checker' });
  await load('xdproto2', phaseScene('z')); await move(5, 5); await key('2'); await sleep(1500);
  await inject(); await evp('__xdArt(true); 1');
  R.keyRender = await evp('(async () => { const r = await __xdRender("L", { x0: -1, x1: 1, y0: -1, y1: 1 }, 60, 300); const a = await XD.art(r.url, null, { mode: "rgb" }); window.__key = a.url; return [a.w, a.h, a.bytes]; })()');
  const keyData = R.keyRender && !R.keyRender.__exc ? await evp('window.__key') : null;
  if (keyData) write('phase-key-raw.png', keyData);
  await load('xdproto2', phaseScene('(z^3-1)/(z^2+1)')); await move(5, 5); await key('2'); await sleep(1500);
  await inject(); await evp('__xdArt(true); 1');
  if (keyData) await evp(`window.__keyUrl = ${JSON.stringify(keyData)}; 1`);
  R.phaseView = await evp('__xdView("L")');
  await emit('phase', 'XF.phase(false, window.__keyUrl)', { target: 246 });
  await emit('phase-bw', 'XF.phase(true)', { target: 246 });
}
R.stats = await evp('XF.stats');
R.captions = await evp('({ cayley: XF.capTex("article"), wide: XF.capTex("wide"), homework: XF.capTex("homework"), film: XF.capTex("film"), phase: XF.capTex("phase"), phaseBW: XF.capTex("phaseBW") })');
if (R.captions && !R.captions.__exc) fs.writeFileSync(path.join(OUT, 'captions.json'), JSON.stringify(R.captions, null, 1));
await evp('try { __xdArt(false); __cmwHideStrokes(false); } catch (e) {} document.documentElement.className = ""; 1');
R.logs = logs().filter((l) => l.t === 'EXC' || l.t === 'error').slice(0, 8);
fs.writeFileSync(path.join(OUT, 'run.json'), JSON.stringify(R, null, 1));
return R;
