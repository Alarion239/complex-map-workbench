// The figure export (notes/export-design/AS-BUILT.md): every view x preset x ink x format built by the app itself, the
// Export figure dialog at 360, 760 and 1440 px in light and dark, the remembered settings, the export menu (Export
// figure..., Copy figure again, Save figure again, Cmd/Ctrl+E) and the copy and save paths as far as headless Chrome
// allows. A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/export_cmd.js && python3 test/regress/export/preflight.py --latex
// Writes every file to test/regress/export/out/ (<name>.pdf|.svg|.png|.tex and <name>-boxes.json for the preflight)
// and the dialog screenshots to <daemon>/shots/export-dlg-*.png. Prints {pass, fails, ...}.
const BASE = 'http://localhost:8793/';
const OUT = path.join(DIR, '..', 'regress', 'export', 'out');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
const fails = [], R = { files: 0, figs: {} };
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const open = async (ns, w = 1440, h = 900, dark = false) => {
  await view(w, h, dark, w < 500);
  await nav(`${BASE}test.html?ns=${ns}${Date.now()}`);
  await settle(2400);
  await move(5, 5);
  // saved files: test.html saves through a plain download link; record them instead
  await ev(`(() => { window.__saved = []; const click = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__saved.push({ name: this.download, href: this.href }); return; } return click.call(this); };
    window.__copied = []; try { navigator.clipboard.writeText = (t) => { window.__copied.push({ type: 'text', t }); return Promise.resolve(); }; navigator.clipboard.write = async (items) => { for (const it of items) window.__copied.push({ type: 'items', types: it.types }); }; } catch (e) {} return 1; })()`);
};
const b64of = (expr) => `await (async () => { const b = await (${expr}); const u8 = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); })()`;

// 1. every view x preset x ink, in every format
const PRESETS = {
  article1: { for: 'article', cols: 1 },
  article2: { for: 'article', cols: 2 },
  article2W: { for: 'article', cols: 2, sizeId: 'revtexW' },
  homework: { for: 'homework' },
  slides: { for: 'slides' },
};
const build = async (tag, opts, fmts = ['pdf', 'svg', 'png', 'tex']) => {
  const t0 = Date.now();
  const r = await ev(`await (async () => { try {
    const f = await __cmwFig.build(${JSON.stringify(opts)}); if (!f) return { none: 1 };
    window.__f = f;
    return { W: f.W, H: f.H, Wtex: f.Wtex, ms: f.ms, view: f.view, name: f.name, cap: f.captionTex, star: f.star, nImg: (f.svg.match(/<image/g) || []).length, nested: (f.svg.match(/<svg/g) || []).length - 1,
      boxes: f.boxes, lines: f.lines, tex: __cmwFig.latex(f), svgKB: Math.round(f.svg.length / 1024) };
  } catch (e) { return { err: String(e && e.stack || e).slice(0, 800) }; } })()`, 180000);
  if (!r || r.err || r.none) { fails.push({ name: `build ${tag}`, got: r }); return null; }
  const meta = { target: r.Wtex, W: r.W, H: r.H, view: r.view, preset: opts.for, cols: opts.cols || null, ink: opts.ink || 'colour', boxes: r.boxes, lines: r.lines, cap: r.cap };
  fs.writeFileSync(path.join(OUT, `${tag}-boxes.json`), JSON.stringify(meta));
  if (fmts.includes('tex')) { fs.writeFileSync(path.join(OUT, `${tag}.tex`), r.tex.replace(new RegExp(`\\{${r.name}\\}`, 'g'), `{${tag}}`)); R.files++; }
  if (fmts.includes('svg')) { const s = await ev('window.__f.svg', 60000); fs.writeFileSync(path.join(OUT, `${tag}.svg`), s); R.files++; }
  if (fmts.includes('pdf')) {
    const b = await ev(b64of('__cmwFig.pdf(window.__f)'), 120000);
    if (typeof b === 'string') { fs.writeFileSync(path.join(OUT, `${tag}.pdf`), Buffer.from(b, 'base64')); R.files++; } else fails.push({ name: `pdf ${tag}`, got: b });
  }
  if (fmts.includes('png')) {
    const b = await ev(b64of('__cmwFig.png(window.__f, 300)'), 120000);
    if (typeof b === 'string') { fs.writeFileSync(path.join(OUT, `${tag}.png`), Buffer.from(b, 'base64')); R.files++; } else fails.push({ name: `png ${tag}`, got: b });
  }
  R.figs[tag] = { W: r.W, H: r.H, ms: r.ms, wall: Date.now() - t0, imgs: r.nImg, svgKB: r.svgKB };
  ok(`${tag}: width is the layout's (${r.Wtex} pt)`, Math.abs(r.W - Math.round(r.Wtex * 72 / 72.27 * 100) / 100) < 0.011, { W: r.W, Wtex: r.Wtex });
  ok(`${tag}: no nested <svg>`, r.nested === 0, r.nested);
  if (opts.for === 'slides') ok(`${tag}: fits under a 16:9 frame title (height <= half the width)`, r.H <= r.W * 0.5 + 0.5, { W: r.W, H: r.H });
  ok(`${tag}: a caption`, opts.for === 'slides' || (r.cap && r.cap.length > 20 && !/undefined|NaN|null/.test(r.cap)), r.cap);
  ok(`${tag}: snippet`, opts.for === 'homework' ? /\\begin\{figure\}\[H\]/.test(r.tex) && /\\ifdim\\linewidth</.test(r.tex) : opts.for === 'slides' ? /\\begin\{frame\}/.test(r.tex) : (r.star ? /\\begin\{figure\*\}\[tbp\]/.test(r.tex) : /\\begin\{figure\}\[tbp\]/.test(r.tex)) && /\\includegraphics\{/.test(r.tex), r.tex.slice(0, 400));
  return r;
};
await open('xrexport');
// X -> Y: the strip (a formula area, a line, a point), the Cayley map then the cube, the quarter plane squared
for (const [ex, nm] of [[1, 'strip'], [8, 'cayleycube'], [2, 'quarter']]) {
  await ev(`__cmwExample(${ex}); 1`); await settle(2200);
  for (const [p, o] of Object.entries(PRESETS)) {
    const r = await build(`xy-${nm}-${p}`, o);
    if (r && nm === 'strip') {
      if (p === 'homework') {
        ok('homework: open boundaries dashed and said so', /stroke-dasharray="3 2"/.test(await ev('window.__f.svg')) && /Dashed: boundary not included\./.test(r.cap), r.cap);
        ok('homework: points named A, A\'', /\$A=0\$/.test(r.cap) && /goes to \$A'\$/.test(r.cap), r.cap);
        ok('homework: 1 in margins by default, shrink only', /469\.75pt \\linewidth\\else 469\.75pt\\fi/.test(r.tex), r.tex.slice(0, 300));
      }
      if (p === 'article1') ok('article: solid boundaries, (a) (b)', !/stroke-dasharray="3 2"/.test(await ev('window.__f.svg')) && /^\(a\) /.test(r.cap) && / \(b\) /.test(r.cap), r.cap);
    }
    if (p === 'article1' || p === 'homework') await build(`xy-${nm}-${p}-bw`, Object.assign({ ink: 'bw' }, o), nm === 'strip' ? ['pdf', 'svg', 'png', 'tex'] : ['pdf', 'tex']);
  }
}
// Phase (colour and the black-and-white contour portrait) and Landscape of the strip map
await ev('__cmwExample(1); 1'); await settle(2200);
await key('2'); await settle(1500);
for (const [p, o] of Object.entries(PRESETS)) {
  const r = await build(`phase-strip-${p}`, o);
  if (r && p === 'article1') ok('phase: zeros and poles named, level lines', /Zeros \(dots\) at \$0\$/.test(r.cap) && /Poles/.test(r.cap) && /level sets/.test(r.cap), r.cap);
  if (p === 'article1' || p === 'article2') {
    const b = await build(`phase-strip-${p}-bw`, Object.assign({ ink: 'bw' }, o));
    if (b) ok('phase B/W: a contour portrait', /drawn as level sets/.test(b.cap) && /dashed: \$\\arg F=\\pi\$/.test(b.cap), b.cap);
  }
}
await key('3'); await settle(2200);
for (const [p, o] of Object.entries(PRESETS)) {
  const r = await build(`land-strip-${p}`, o);
  if (r && p === 'article1') {
    ok('landscape: the height named in the caption', /the height is \$\\log\|F\|\$/.test(r.cap), r.cap);
    ok('landscape: vector floor labels', r.boxes.filter((b) => b.kind === 'tick').length >= 4 && r.boxes.some((b) => b.kind === 'axis-name'), r.boxes.map((b) => b.kind));
  }
}
await build('land-strip-article1-bw', { for: 'article', ink: 'bw' });
// the deformation: the filmstrip and the paths figure
await key('1'); await settle(800);
await key('m'); await settle(2500);
for (const [p, o] of Object.entries(PRESETS)) {
  const r = await build(`film-strip-${p}`, o);
  if (r && p === 'article2W') ok('filmstrip: four frames titled (a) t = 0 ... (d) t = 2', r.boxes.filter((b) => b.kind === 'title').length === 4 && /\(d\) \$t=2\$/.test(r.cap), { titles: r.boxes.filter((b) => b.kind === 'title').map((b) => b.tex), cap: r.cap });
  const q = await build(`paths-strip-${p}`, Object.assign({ deform: 'paths' }, o), ['pdf', 'svg', 'tex']);
  if (q && p === 'article1') ok('paths: one panel with the arrows, the morph caption', q.nImg === 1 && /joined by the homotopy/.test(q.cap) && !/Dashed boundaries do not belong/.test(q.cap), q.cap);
}
await key('m'); await settle(600);
// the view kinds of a merged plane: X -> Y + the deformation over a d/dz step (one panel of H_t)
R.timing = Object.values(R.figs).map((f) => f.ms).sort((a, b) => a - b);
R.timing = { median: R.timing[R.timing.length >> 1], max: R.timing[R.timing.length - 1] };
ok('a figure builds in under 2.5 s', R.timing.max < 2500, R.timing);

// 2. the dialog: Cmd/Ctrl+E, 360 / 760 / 1440 px, light and dark; no horizontal scroll, everything reachable
const dlgReady = async () => { for (let i = 0; i < 120; i++) { await sleep(150); const r = await ev(`(() => { const d = __cmwFig.dialog(); return !!(d && d.fig && !d.building); })()`); if (r === true) return true; } return false; };
R.dialog = {};
for (const [w, h] of [[1440, 900], [760, 900], [360, 780]]) {
  for (const dark of [false, true]) {
    await open('xrdlg', w, h, dark);
    await ev('__cmwExample(1); 1'); await settle(1800);
    await key('e', 4); // Meta+E (the page also takes Ctrl+E)
    const ready = await dlgReady();
    const m = await ev(`(() => { const m = document.querySelector('.modal.xf'); if (!m) return null; const r = m.getBoundingClientRect(), q = (s) => { const e = m.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      return { box: [r.left, r.top, r.width, r.height], sw: document.documentElement.scrollWidth, vw: innerWidth, vh: innerHeight, over: m.scrollWidth - m.clientWidth,
        ol: q('#xfOverleaf'), docs: q('#xfDocs'), more: q('#xfMore'), forSeg: q('#xfFor'), cols: q('#xfCols'), size: q('#xfSize'), ink: q('#xfInk'), fig: q('.xf-fig'), cap: q('.xf-cap'), bg: getComputedStyle(m).backgroundColor, paper: getComputedStyle(m.querySelector('.xf-paper')).backgroundColor }; })()`);
    const tag = `${w}-${dark ? 'dark' : 'light'}`;
    await shot(`export-dlg-${tag}`);
    R.dialog[tag] = m && { box: m.box.map(Math.round), bg: m.bg };
    ok(`dialog ${tag}: opens on Cmd/Ctrl+E with a preview`, ready && !!m && m.fig && m.fig[2] > 50, m);
    if (!m) continue;
    ok(`dialog ${tag}: inside the viewport, no horizontal scroll`, m.sw <= m.vw && m.box[0] >= -0.5 && m.box[0] + m.box[2] <= m.vw + 0.5 && m.over <= 0, m);
    ok(`dialog ${tag}: the same gutter left and right`, Math.abs(m.box[0] - (m.vw - m.box[0] - m.box[2])) <= 1, { left: m.box[0], right: m.vw - m.box[0] - m.box[2] });
    ok(`dialog ${tag}: destinations on screen`, m.ol && m.docs && m.ol[1] + m.ol[3] <= m.vh && m.ol[0] + m.ol[2] <= m.vw && m.docs[2] > 40, { ol: m.ol, docs: m.docs, vh: m.vh });
    ok(`dialog ${tag}: For, the column switch, Size, Ink`, m.forSeg && m.cols && m.size && m.ink, m);
    ok(`dialog ${tag}: the paper is white in both themes`, /255, 255, 255/.test(m.paper), m.paper);
    await key('Escape'); await settle(300);
    ok(`dialog ${tag}: Escape closes`, await ev('!document.querySelector(".modal.xf")'), null);
  }
}

// 3. remembered settings, the caption on the paper, See in grey, Loupe, the destinations, the export menu
await open('xrmem', 1440, 900, false);
await ev('__cmwExample(1); 1'); await settle(1800);
await key('e', 2); // Ctrl+E
ok('Ctrl+E opens the dialog', await dlgReady(), null);
await clickSel('#xfFor button[data-v="homework"]'); await dlgReady();
await clickSel('#xfInk button[data-v="bw"]'); await dlgReady();
let d = await ev(`(() => { const d = __cmwFig.dialog(); return { for: d.fig.for, ink: d.fig.ink, Wtex: d.fig.Wtex, colsHidden: document.getElementById('xfCols').hidden }; })()`);
ok('Homework: 469.75 pt by default, no column switch', d.for === 'homework' && d.ink === 'bw' && d.Wtex === 469.75 && d.colsHidden, d);
await clickSel('#xfFor button[data-v="article"]'); await dlgReady();
await clickSel('#xfCols button[data-v="2"]'); await dlgReady();
d = await ev(`(() => { const d = __cmwFig.dialog(); return { for: d.fig.for, cols: d.fig.cols, Wtex: d.fig.Wtex, size: document.getElementById('xfSize').textContent }; })()`);
ok('Article Two column: the REVTeX column, 246 pt', d.for === 'article' && d.cols === 2 && d.Wtex === 246 && /REVTeX/.test(d.size), d);
// the caption, edited on the paper, goes into the snippet
await clickSel('.xf-cap'); await settle(200);
const ta = await ev(`(() => { const t = document.querySelector('.xf-capsrc'); return t ? t.value.length : -1; })()`);
ok('the caption opens as its LaTeX source on the paper', ta > 20, ta);
await ev(`(() => { const t = document.querySelector('.xf-capsrc'); t.value = 'My own caption with $w=f(z)$.'; t.dispatchEvent(new Event('input')); t.blur(); return 1; })()`); await settle(400);
await clickSel('#xfOverleaf');
for (let i = 0; i < 60; i++) { await sleep(200); if (await ev('window.__saved.length > 0')) break; }
const ol = await ev(`(() => ({ saved: window.__saved.map((s) => s.name), copied: window.__copied.filter((c) => c.type === 'text').map((c) => c.t), btn: document.getElementById('xfOverleaf').textContent, note: document.querySelector('.xf-after2').textContent }))()`);
ok('For Overleaf: copies the snippet with the edited caption, then saves the PDF', ol.saved.some((n) => /\.pdf$/.test(n)) && ol.copied.some((t) => /My own caption with \$w=f\(z\)\$\./.test(t) && /\\begin\{figure\}\[tbp\]/.test(t)), ol);
R.overleaf = ol;
// the saved PDF is the file a user gets: check it too
const pdfB64 = await ev(`await (async () => { const s = window.__saved.find((x) => /\\.pdf$/.test(x.name)); const b = await (await fetch(s.href)).blob(); const u8 = new Uint8Array(await b.arrayBuffer()); let q = ''; for (let i = 0; i < u8.length; i += 0x8000) q += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(q); })()`, 60000);
if (typeof pdfB64 === 'string') { fs.writeFileSync(path.join(OUT, 'dialog-overleaf.pdf'), Buffer.from(pdfB64, 'base64')); fs.writeFileSync(path.join(OUT, 'dialog-overleaf-boxes.json'), JSON.stringify({ target: 246, boxes: [], lines: [] })); }
// For Docs: the PNG with its size and the caption in the image (headless: the clipboard write is recorded)
await ev('window.__copied.length = 0; window.__saved.length = 0; 1');
await clickSel('#xfDocs');
for (let i = 0; i < 60; i++) { await sleep(200); if (await ev('window.__copied.length > 0 || window.__saved.length > 0')) break; }
const docs = await ev(`({ copied: window.__copied, saved: window.__saved.map((s) => s.name), btn: document.getElementById('xfDocs').textContent })`);
ok('For Docs: image/png + text/html on the clipboard (or a saved PNG)', docs.copied.some((c) => c.type === 'items' && c.types.includes('image/png') && c.types.includes('text/html')) || docs.saved.some((n) => /\.png$/.test(n)), docs);
// See in grey, Loupe
await clickSel('.xf-ico'); await settle(150);
ok('See in grey', await ev(`document.querySelector('.xf-paper').classList.contains('grey')`), null);
await clickSel('.xf-ico:nth-of-type(2)'); await settle(150);
ok('Loupe toggles', await ev(`document.querySelector('.xf-stage').classList.contains('loupe-on')`), null);
// More formats: SVG, PNG, LaTeX as .txt
await ev('window.__saved.length = 0; 1');
for (const label of ['SVG', 'PNG · 300 dpi', 'Save LaTeX (.txt)']) {
  await clickSel('#xfMore'); await sleep(250);
  await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu button, .pop.menu [role="menuitem"]')].find((x) => x.textContent.includes(${JSON.stringify(label)})); if (b) b.click(); return !!b; })()`);
  for (let i = 0; i < 50; i++) { await sleep(200); if (await ev(`window.__saved.length >= ${['SVG', 'PNG · 300 dpi', 'Save LaTeX (.txt)'].indexOf(label) + 1}`)) break; }
}
const mf = await ev('window.__saved.map((s) => s.name)');
ok('More formats: .svg, .png and LaTeX as .txt (the allowed download types)', mf.some((n) => /\.svg$/.test(n)) && mf.some((n) => /\.png$/.test(n)) && mf.some((n) => /-latex\.txt$/.test(n)), mf);
await key('Escape'); await settle(300);
// reopen: the settings are remembered (Article, Two column, B/W); the caption edit is not (a new figure)
await key('e', 4); await dlgReady();
d = await ev(`(() => { const d = __cmwFig.dialog(); const on = (id) => (document.querySelector('#' + id + ' [aria-checked="true"]') || {}).dataset; return { for: on('xfFor').v, cols: on('xfCols').v, ink: on('xfInk').v, cap: d.fig.captionTex.slice(0, 40), key: Object.keys(localStorage).filter((k) => k === 'cmw-figure-v1:' + new URLSearchParams(location.search).get('ns')) }; })()`);
ok('settings remembered across opens (in the namespaced localStorage key)', d.for === 'article' && d.cols === '2' && d.ink === 'bw' && d.key.length === 1, d);
await key('Escape'); await settle(300);
// the export menu: Export figure... (with its shortcut), Copy figure again, Save figure again
await clickSel('#exportBtn'); await sleep(300);
const menu = await ev(`[...document.querySelectorAll('.pop.menu button, .pop.menu [role="menuitem"]')].map((b) => ({ t: b.textContent.trim(), dis: b.disabled || b.getAttribute('aria-disabled') === 'true' }))`);
ok('export menu: Export figure..., Copy figure again, Save figure again', menu.some((m) => /^Export figure…/.test(m.t) && /(⌘E|Ctrl E)/.test(m.t)) && menu.some((m) => /Copy figure again/.test(m.t) && !m.dis) && menu.some((m) => /Save figure again/.test(m.t) && !m.dis), menu);
await ev('window.__saved.length = 0; 1');
await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu button, .pop.menu [role="menuitem"]')].find((x) => /Save figure again/.test(x.textContent)); if (b) b.click(); return !!b; })()`);
for (let i = 0; i < 60; i++) { await sleep(200); if (await ev('window.__saved.length > 0')) break; }
const again = await ev('window.__saved.map((s) => s.name)');
ok('Save figure again saves the last format with the remembered settings', again.length === 1 && /-latex\.txt$/.test(again[0]), again);
// storage blocked: the dialog still works (settings are a convenience)
await ev(`(() => { const p = Storage.prototype; window.__ls = [p.getItem, p.setItem]; p.getItem = () => { throw new Error('blocked'); }; p.setItem = () => { throw new Error('blocked'); }; return 1; })()`);
await key('e', 4);
ok('the dialog opens with storage blocked', await dlgReady(), null);
await key('Escape'); await settle(300);
await ev(`(() => { const p = Storage.prototype; [p.getItem, p.setItem] = window.__ls; return 1; })()`);

R.logs = logs().filter((l) => /EXC|error/i.test(l.t) && !/404|favicon/.test(l.m)).slice(0, 12);
ok('no exceptions', !R.logs.some((l) => l.t === 'EXC'), R.logs);
return { pass: fails.length === 0, fails, ...R, figs: Object.keys(R.figs).length };
