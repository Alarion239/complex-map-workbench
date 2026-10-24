// The figure export (notes/export-design/AS-BUILT.md): every view x preset x ink x format built by the app itself, the
// Export figure dialog at 360, 760 and 1440 px in light and dark, the remembered settings, the export menu (Export
// figure..., Copy figure again, Save figure again, Cmd/Ctrl+E) and the copy and save paths as far as headless Chrome
// allows. A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/export_cmd.js && python3 test/regress/export/preflight.py --latex
// Round 3 (notes/export-design/ROUND3.md), section 4: the deformation in every view (plane, globe, Phase, Phase on the
// sphere, Landscape) x filmstrip / paths / one frame x PDF, SVG, PNG and their snippets (PNG with its width), the
// display-style F (snippet, short caption, the image's own caption), a video of every view (frames, codec, no long
// task, a decoded frame against the exact render at its t), and the format row of the dialog (remembered, For
// Overleaf with PNG, Save video, Cancel).
// Writes every file to test/regress/export/out/ (<name>.pdf|.svg|.png|.tex and <name>-boxes.json for the preflight)
// and the dialog screenshots to <daemon>/shots/export-dlg-*.png. Prints {pass, fails, ...}.
const BASE = process.env.CMW_BASE || 'http://localhost:8793/'; // (a daemon of your own: CMW_BASE=http://localhost:<port>/)
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
    return { W: f.W, H: f.H, Wtex: f.Wtex, ms: f.ms, view: f.view, name: f.name, cap: f.captionTex, short: f.shortCap, info: f.info, svg: f.svg.length < 4e6 ? f.svg.replace(/xlink:href="data:[^"]*"/g, '') : '', star: f.star, nImg: (f.svg.match(/<image/g) || []).length, nested: (f.svg.match(/<svg/g) || []).length - 1,
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
  // (review r3 verify, editor-13) the display of F follows the phrase that names F: no lead-in of its own ("The map is")
  // far from it, no "where ..., where" («где …, где») in the sentence it ends; F's own display (not the chain's) within
  // 160 characters of the first $F$
  if (r.cap && /\\ifinner/.test(r.cap)) {
    const head = r.cap.split('\\ifinner')[0], plain = head.replace(/\$[^$]*\$/g, ' '), last = plain.split(/\.\s/).pop();
    ok(`${tag}: no "The map is" lead-in, no second "where" before the display`, !/The map is|Отображение задаётся формулой/.test(r.cap) && (last.match(/(^|[^\p{L}])(where|где)(?![\p{L}])/gu) || []).length <= 1, last.slice(-300));
    if (!/\\ifinner\\hskip\\hsize\\else\\\[ \\begin\{gathered\}/.test(r.cap) && head.indexOf('$F$') >= 0) ok(`${tag}: F's display follows the phrase that names F`, head.length - head.indexOf('$F$') <= 160, head.slice(head.indexOf('$F$')));
  }
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
    // (review r3 verify, editor-13: "Landscape of $F$ over ..., where \[ ... \] The height is ...")
    ok('landscape: the height named in the caption', /[Tt]he height is \$\\log\|F\|\$/.test(r.cap), r.cap);
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

// 4. round 3: the deformation in every view, the formats, the display-style F, the video
R.r3 = { figs: {}, videos: {}, dialog: {} };
await open('xvr3');
await ev('__cmwExample(1); 1'); await settle(2200);
await key('m'); await settle(1500);
await ev('__cmwMorph({ playing: false, T: 1.2 }); 1'); await settle(600);
const VIEWS3 = [
  ['plane', async () => { await key('1'); await settle(300); await ev(`__cmwSetView('R', 'plane'); 1`); }],
  ['globe', async () => { await key('1'); await settle(300); await ev(`__cmwSetView('R', 'sphere'); 1`); }],
  ['phase', async () => { await ev(`__cmwSetView('R', 'plane'); 1`); await key('2'); await settle(300); await ev(`__cmwSetView('L', 'plane'); 1`); }],
  ['phaseGlobe', async () => { await key('2'); await settle(300); await ev(`__cmwSetView('L', 'sphere'); 1`); }],
  ['land', async () => { await key('2'); await settle(300); await ev(`__cmwSetView('L', 'plane'); 1`); await key('3'); }],
];
const CAP3 = { plane: /^The deformation \$H_t\$ from the identity/, globe: /^The deformation \$H_t\$ on the Riemann sphere/, phase: /^Phase portraits of \$H_t\$ on \$\[/, phaseGlobe: /^Phase portraits of \$H_t\$ on the Riemann sphere/, land: /^Landscapes of \$H_t\$/ };
// (review r3: F alone, or the chain F(z) = ..., F = f_2 o f_1, f_1(z) = ..., f_2(w_1) = ... when the caption names the steps)
const DISP = /(?:, where|\. Here)\\ifinner\\hskip\\hsize\\else\\\[ (?:\\displaystyle F\(z\)=\\frac\{e\^\{z\}-1\}\{e\^\{z\}\+1\}\. |\\begin\{gathered\}\\displaystyle F\(z\)=\\frac\{e\^\{z\}-1\}\{e\^\{z\}\+1\},[\s\S]*?\\end\{gathered\} )\\\]\\fi/;
const NAMES3 = new Map(); // review r3, editor-2: file name -> the figure it belongs to
const P3 = { article1: { for: 'article', cols: 1 }, article2: { for: 'article', cols: 2 }, homework: { for: 'homework' }, slides: { for: 'slides' } };
const build3 = async (tag, opts) => {
  const r = await build(tag, opts);
  if (!r) return null;
  // the PNG and its snippet (the file name and the width), compiled by the preflight like the PDF's
  const ptag = tag.replace(/-(article1|article2|article2W|homework|slides)(-bw)?$/, '-png-$1$2');
  const q = await ev(`(() => ({ tex: __cmwFig.latex(window.__f, null, 'png', 300), svg: __cmwFig.latex(window.__f, null, 'svg') }))()`);
  fs.writeFileSync(path.join(OUT, `${ptag}.tex`), q.tex.replace(new RegExp(`\\{${r.name}\\.png\\}`, 'g'), `{${ptag}.png}`).replace(new RegExp(`${r.name}\\.png`, 'g'), `${ptag}.png`));
  const b = await ev(b64of('__cmwFig.png(window.__f, 300)'), 120000);
  if (typeof b === 'string') fs.writeFileSync(path.join(OUT, `${ptag}.png`), Buffer.from(b, 'base64'));
  fs.writeFileSync(path.join(OUT, `${ptag}-boxes.json`), JSON.stringify({ target: r.Wtex, W: r.W, H: r.H, boxes: [], lines: [] }));
  const w = +r.Wtex.toFixed(2);
  // (review r3, editor-12: shrink-only in every preset, so the standard article class does not overflow)
  ok(`${tag}: the PNG snippet names ${ptag}.png with its width`, q.tex.includes(`\\includegraphics[width=\\ifdim\\linewidth<${w}pt \\linewidth\\else ${w}pt\\fi]{${r.name}.png}`), q.tex.slice(0, 500));
  const ru = opts.lang === 'ru';
  ok(`${tag}: the PNG snippet says which file to upload`, q.tex.includes(ru ? `% Загрузите ${r.name}.png (PNG, 300\u00a0dpi)` : `% Upload ${r.name}.png (PNG, 300 dpi)`), q.tex.slice(0, 300));
  ok(`${tag}: the SVG snippet uses \\includesvg and names the svg package`, /\\includesvg\[width=/.test(q.svg) && (ru ? /пакет svg вызывает Inkscape/ : /svg runs Inkscape/).test(q.svg), q.svg.slice(0, 400));
  if (opts.for !== 'slides') {
    ok(`${tag}: F is displayed (\\[ \\displaystyle F(z) = ... \\]), not inline`, (ru ? new RegExp(DISP.source.replace(', where|\\. Here', ', где|\\. Здесь')) : DISP).test(r.cap) && !/\$F\(z\)=\(e\^\{z\}-1\)/.test(r.cap), r.cap);
    const sc = /\\caption\[\{([\s\S]*?)\}\]\{/.exec(r.tex);
    ok(`${tag}: a short caption for the list of figures (in braces, no display)`, !!sc && !/\\\[/.test(sc[1]), r.tex.slice(0, 900));
    // (review r3, editor-4) the short caption is short: one line or two in a list of figures
    ok(`${tag}: the short caption is under 100 characters`, !!sc && sc[1].length <= 100, sc && sc[1]);
    // (review r3, editor-1) a caption that names the steps f_1, f_2 defines them in its display
    if (/f_\{1\}/.test(r.cap.split('\\ifinner')[0])) ok(`${tag}: the steps the caption names are displayed (F = f_2 o f_1, f_1(z) = ...)`, /F=f_\{2\}\\circ f_\{1\}/.test(r.cap) && /f_\{1\}\(z\)=e\^\{z\}/.test(r.cap) && /f_\{2\}\(w_\{1\}\)=\\frac\{w_\{1\}-1\}\{w_\{1\}\+1\}/.test(r.cap), r.cap.slice(-700));
    // (review r3, editor-13) not "along the homotopy H_t" after "Here H_t"
    ok(`${tag}: the homotopy sentence is not circular`, !/Here \$H_t\$ deforms[^.]*along the homotopy \$H_t\$/.test(r.cap), r.cap.slice(0, 900));
  }
  // (review r3, editor-2) one name and one label per figure: a name is never shared by two different figures
  const key = `${(opts.view || '')}|${r.view}|${(r.info && (r.info.film || (r.info.globePaths ? 'gpaths' : ''))) || ''}|${opts.deform || 'film'}`;
  if (!opts.lang) { if (!NAMES3.has(r.name)) NAMES3.set(r.name, key); ok(`${tag}: the name ${r.name} belongs to this kind of figure only`, NAMES3.get(r.name) === key, { name: r.name, key, was: NAMES3.get(r.name) }); }
  if (opts.for !== 'slides') ok(`${tag}: the label is the name`, r.tex.includes(`\\label{fig:${r.name}}`), r.tex.slice(-200));
  R.r3.figs[tag] = { W: r.W, H: r.H, ms: r.ms, imgs: r.nImg };
  return r;
};
for (const [kind, go] of VIEWS3) {
  await go(); await settle(2200);
  const dk = await ev('__cmwFig.defoOf()');
  ok(`${kind}: the view exports the deformation (defoOf)`, dk === kind, dk);
  for (const [p, o] of Object.entries(P3)) {
    const r = await build3(`r3-film-${kind}-${p}`, o);
    if (!r) continue;
    ok(`r3-film-${kind}-${p}: four frames titled (a) t = 0 ... (d)`, r.boxes.filter((b) => b.kind === 'title').length === 4, r.boxes.filter((b) => b.kind === 'title').map((b) => b.tex));
    if (p !== 'slides') ok(`r3-film-${kind}-${p}: the caption says what is shown`, CAP3[kind].test(r.cap) && /\(d\) \$t=2\$/.test(r.cap), r.cap.slice(0, 300));
    // (review r3, editor-9) Homework: open boundaries dashed and said so; the boundary at t = 0 is gray and solid
    if (p === 'homework' && (kind === 'plane' || kind === 'globe')) ok(`r3-film-${kind}-homework: open boundaries dashed (3 2), "Dashed: boundary not included", the t = 0 boundary not dashed`, /stroke-dasharray="3 2"/.test(r.svg) && /Dashed: boundary not included/.test(r.cap) && !/stroke="#666666"[^>]*stroke-dasharray/.test(r.svg) && /gray: the boundary at \$t=0\$/.test(r.cap), r.cap.slice(-400));
    if (p !== 'homework' && kind === 'plane') ok(`r3-film-plane-${p}: no dashes outside Homework but the paths' dots`, !/stroke-dasharray="3 2"/.test(r.svg), null);
    // (review r3, editor-3) the globe names the point it tracks, and never lists a point it does not draw
    if (kind === 'globe' && p !== 'slides') ok(`r3-film-globe-${p}: the tracked point is named in the caption`, /of the point \$[^$]*\$ \(dot\)/.test(r.cap) && !/of the marked points/.test(r.cap), r.cap.slice(0, 900));
    // (review r3 verify, editor-3) the other point shape has a marker of its own (a square, never a second kind of dot),
    // and the caption names it and the frames where it is on the far side
    if (kind === 'globe') {
      const mk = (r.info.marks || [])[0];
      ok(`r3-film-globe-${p}: z_0 is marked with a square, named in the caption with the frames that hide it`, !!mk && mk.mk === 1 && mk.hiddenIn.join() === '0,3' && !/<circle[^>]*r="1.6" fill="#000000"/.test(r.svg) && (p === 'slides' || /The square is the image of the point \$(z_0|A)=0\$; in \(a\) and \(d\) it is on the far side of the sphere\./.test(r.cap)), { mk, cap: r.cap.slice(-400) });
      if (p === 'slides') ok('r3-film-globe-slides: a key under the frames says what the dot and the square are', r.boxes.filter((b) => b.kind === 'key' && /H_t\(/.test(b.tex)).length === 2, r.boxes.filter((b) => b.kind === 'key').map((b) => b.tex));
    }
    if (p === 'slides') ok(`r3-film-${kind}-slides: four frames in one row`, (() => { const t = r.boxes.filter((b) => b.kind === 'title'); return t.length === 4 && t.every((b) => Math.abs(b.y0 - t[0].y0) < 1); })(), r.boxes.filter((b) => b.kind === 'title').map((b) => [b.x0, b.y0]));
    if (kind === 'phaseGlobe' && p !== 'slides') ok('r3-film-phaseGlobe: the black curve is explained', /Black: the boundary of \$X\$/.test(r.cap), r.cap.slice(0, 400));
    if (kind === 'land') ok(`r3-film-land-${p}: Re and Im marks on the floor of the reliefs`, r.boxes.filter((b) => b.kind === 'tick').length >= 4, r.boxes.filter((b) => b.kind === 'tick').length);
  }
  if (kind === 'phase') await build3(`r3-film-${kind}-article1-bw`, { for: 'article', ink: 'bw' });
  if (kind === 'plane' || kind === 'globe') {
    for (const p of ['article1', 'homework']) {
      const r = await build3(`r3-paths-${kind}-${p}`, Object.assign({ deform: 'paths' }, P3[p]));
      if (r) ok(`r3-paths-${kind}-${p}: one picture with the paths`, r.nImg === 1 && (kind === 'plane' ? /joined by the homotopy|Arrows/.test(r.cap) : /Arrows are the paths|The arrow is the path/.test(r.cap)), r.cap.slice(0, 400));
      if (r && kind === 'plane') ok(`r3-paths-plane-${p}: X's outline is gray and solid (a dash means "not included")`, !/stroke="#707070"[^>]*stroke-dasharray/.test(r.svg) && !/dashed outline/.test(r.cap), r.cap.slice(0, 400));
      if (r && kind === 'globe') ok(`r3-paths-globe-${p}: a listed point is drawn or said to be hidden`, !/\$(z_0|A)=0\$/.test(r.cap) || /\$(z_0|A)=0\$ is on the far side/.test(r.cap) || (r.info.hidden || []).length === 0, r.cap.slice(0, 700));
    }
  }
  if (kind !== 'plane') {
    const r = await build3(`r3-frame-${kind}-article1`, { for: 'article', deform: 'frame' });
    if (r) ok(`r3-frame-${kind}: one frame, at the current t`, r.boxes.filter((b) => b.kind === 'title').length === 0 && /Shown at \$t=1\.20\$/.test(r.cap), r.cap.slice(0, 300));
  }
  // the image's own caption (For Docs): the formula on a line of its own, centred
  // (review r3 verify, new-1) and its lines never touch: a tall superscript widens its line's spacing (English and Russian)
  for (const lang of ['en', 'ru']) {
    const ci = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'homework', capInImage: true${lang === 'ru' ? ", lang: 'ru'" : ''} }); const c = f.boxes.filter((b) => b.kind === 'caption'), d = c.filter((b) => /displaystyle/.test(b.tex));
      let over = 0; for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) { const a = c[i], b = c[j]; if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.05 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.05) over++; }
      return { n: d.length, W: f.W, b: d.map((b) => [b.x0, b.x1]), over, items: c.length }; })()`, 120000);
    ok(`${kind} ${lang}: the PNG's own caption displays F, centred`, ci && ci.n === 1 && Math.abs(ci.b[0][0] - (ci.W - ci.b[0][1])) < 1.5, ci);
    ok(`${kind} ${lang}: the PNG's own caption: no two pieces of text overlap (lines spaced like TeX's \\lineskip)`, ci && ci.items > 20 && ci.over === 0, ci);
  }
  // the video of this view: frames rendered off-screen one by one, H.264 in MP4, the page keeps its frames
  const vopt = kind === 'plane' ? { size: '1920x1080', fps: 60, secs: 1, ends: 'bounce', look: 'print', paths: true, tlabel: true } : kind === 'globe' ? { size: '1080x1080', fps: 30, secs: 2, ends: 'once', look: 'light', paths: true, tlabel: true } : { size: '1280x720', fps: 30, secs: 2, ends: kind === 'land' ? 'loop' : 'once', look: kind === 'phase' ? 'print' : 'light', tlabel: true };
  const v = await ev(`await (async () => { try {
    window.__lt = []; const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }); po.observe({ entryTypes: ['longtask'] });
    let beats = 0; const hb = setInterval(() => beats++, 16); const t0 = performance.now();
    const r = await __cmwFig.makeVideo({ video: ${JSON.stringify(vopt)}, keepForCheck: true }); clearInterval(hb); po.disconnect();
    const n = __cmwFig.videoTimes(${JSON.stringify(vopt)}, ${await ev('__cmwFig.defoOf() ? 2 : 0')}).length;
    const k = Math.floor(r.frames * 0.4), chk = await __cmwFig.videoCheck(k, 256, 144);
    // (review r3 verify, editor-8) the globe's infinity label: its box, and its darkest pixel in the decoded frame
    let inf = r.labels && r.labels.find((l) => l.lab === '∞'), infInk = null;
    if (inf) { const full = await __cmwFig.videoCheck(k, r.W, r.H), im = new Image(); im.src = full.decoded; await im.decode(); const c = document.createElement('canvas'); c.width = r.W; c.height = r.H; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(Math.floor(inf.x0), Math.floor(inf.y0), Math.ceil(inf.x1 - inf.x0), Math.ceil(inf.y1 - inf.y0)).data; infInk = 255; for (let i = 0; i < d.length; i += 4) infInk = Math.min(infInk, d[i], d[i + 1], d[i + 2]); }
    const u8 = new Uint8Array(await r.blob.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { ext: r.ext, codec: r.codec, frames: r.frames, expect: n, fps: r.fps, secs: r.secs, W: r.W, H: r.H, ms: r.ms, wall: Math.round(performance.now() - t0), beats, longTasks: window.__lt, k, t: chk && chk.t, mad: chk && chk.mad, dec: chk && chk.decoded, b64: btoa(s), labels: r.labels, inf, infInk };
  } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 600000);
  if (!v || v.err) { fails.push({ name: `video ${kind}`, got: v }); continue; }
  fs.writeFileSync(path.join(OUT, `video-${kind}.${v.ext}`), Buffer.from(v.b64, 'base64'));
  fs.writeFileSync(path.join(OUT, `video-${kind}.json`), JSON.stringify({ frames: v.frames, fps: v.fps, W: v.W, H: v.H, codec: v.codec }));
  if (v.dec) fs.writeFileSync(path.join(OUT, `video-${kind}-frame${v.k}.png.dec`), Buffer.from(v.dec.split(',')[1], 'base64'));
  delete v.b64; delete v.dec;
  R.r3.videos[kind] = v;
  ok(`video ${kind}: H.264 in MP4, ${vopt.size} at ${vopt.fps} fps, every frame of the run and its holds`, v.ext === 'mp4' && /^avc1/.test(v.codec) && v.frames === v.expect && v.fps === vopt.fps && `${v.W}x${v.H}` === vopt.size, v);
  ok(`video ${kind}: no main-thread task of 50 ms or more while it is made`, !v.longTasks.some((d) => d >= 50) && v.beats > 0.5 * v.wall / 16 * 0.5, { longTasks: v.longTasks, beats: v.beats, wall: v.wall });
  ok(`video ${kind}: a decoded frame matches the exact render at its t (mean abs difference < 6 of 255)`, v.mad != null && v.mad < 6, { k: v.k, t: v.t, mad: v.mad });
  // (review r3 verify, editor-8) a globe video labels the north pole: dark (darkest pixel under 80 of 255), at least 4 %
  // of H in size, and clear of the frame's edge (2 % of H)
  if (kind === 'globe' || kind === 'phaseGlobe') ok(`video ${kind}: the infinity label is dark, large and inside the frame`, kind === 'phaseGlobe' && !v.inf ? true : !!v.inf && v.infInk != null && v.infInk < 80 && v.inf.fs >= 0.04 * v.H && v.inf.y0 >= 0.02 * v.H && v.inf.x0 >= 0.02 * v.W && v.inf.x1 <= 0.98 * v.W, { inf: v.inf, infInk: v.infInk, labels: v.labels });
}
// the fallback where H.264 cannot be encoded: VP9 in our WebM muxer (forced here), decoded back
{
  const wv = await ev(`await (async () => { try { const r = await __cmwFig.makeVideo({ video: { size: '1280x720', fps: 30, secs: 1, ends: 'once', look: 'print', webm: true }, keepForCheck: true }); const chk = await __cmwFig.videoCheck(20, 256, 144);
    const u8 = new Uint8Array(await r.blob.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { ext: r.ext, codec: r.codec, frames: r.frames, fps: r.fps, W: r.W, H: r.H, mad: chk && chk.mad, b64: btoa(s) }; } catch (e) { return { err: String(e && e.stack || e).slice(0, 500) }; } })()`, 300000);
  if (wv && wv.b64) { fs.writeFileSync(path.join(OUT, `video-webm.${wv.ext}`), Buffer.from(wv.b64, 'base64')); fs.writeFileSync(path.join(OUT, 'video-webm.json'), JSON.stringify({ frames: wv.frames, fps: wv.fps, W: wv.W, H: wv.H, codec: wv.codec })); delete wv.b64; }
  R.r3.videos.webm = wv;
  const n67 = await ev(`__cmwFig.videoTimes({ size: '1280x720', fps: 30, secs: 1, ends: 'once' }, 2).length`);
  ok('the WebM fallback: VP9 in WebM, every frame, a decoded frame matches the exact render', wv && wv.ext === 'webm' && /^vp09/.test(wv.codec) && wv.frames === n67 && wv.mad < 6, { wv, n67 });
  // (review r3, video-4) nothing of a video is kept unless a test asks
  const kept = await ev(`await (async () => { const r = await __cmwFig.makeVideo({ video: { size: '1280x720', fps: 30, secs: 1, ends: 'once' } }); return { frames: r.frames, check: await __cmwFig.videoCheck(5) }; })()`, 300000);
  ok('a video made without keepForCheck keeps nothing (videoCheck finds no last video)', kept && kept.frames > 0 && kept.check === null, kept);
}
// (review r3, editor-7) a lecture's pace: each step eased on its own, a hold at every whole t, 1.2 s holds at the ends,
// a loop that fades back to t = 0 instead of jumping
{
  const pace = await ev(`(() => { const T = __cmwFig.videoTimes({ fps: 30, secs: 4, ends: 'once' }, 2), L = __cmwFig.videoTimes({ fps: 30, secs: 4, ends: 'loop' }, 2);
    const run = (arr, v) => { let best = 0, cur = 0; for (const x of arr) { if (typeof x === 'number' && Math.abs(x - v) < 1e-12) { cur++; best = Math.max(best, cur); } else cur = 0; } return best; };
    const t1 = T.findIndex((x) => x >= 0.5), t2 = T.findIndex((x) => x >= 1.5);
    return { n: T.length, h0: run(T, 0), h1: run(T, 1), h2: run(T, 2), sym: Math.abs((T.indexOf(1) - T.lastIndexOf(0)) - (T.indexOf(2) - T.lastIndexOf(1))) <= 1, fades: L.filter((x) => typeof x === 'object').length, endObj: typeof L[L.length - 1] === 'object' && L[L.length - 1].b === 0 }; })()`);
  ok('video pace: holds of 1.2 s at both ends, 0.6 s at t = 1, equal time per step, the loop fades back to t = 0', pace.h0 >= 36 && pace.h2 >= 36 && pace.h1 >= 18 && pace.sym && pace.fades === 45 && pace.endObj, pace);
  // (review r3 verify, editor-7) the Length is per step: one more step adds its length and a 0.6 s hold, whatever the chain
  const per = await ev(`[1, 2, 5].map((m) => __cmwFig.videoTimes({ fps: 30, secs: 4, ends: 'once' }, m).length)`);
  ok('video pace: the Length is the length of each step (1 step: 4 s + 2.4 s of holds; each further step: 4 s + 0.6 s)', per[0] === 1 + 120 + 72 && per[1] - per[0] === 120 + 18 && per[2] - per[1] === 3 * (120 + 18), per);
}
// (review r3, video-1) the dark theme: an export render does not flip the page's theme, so no frame rebuilds the app
{
  await view(1440, 900, true, false); await settle(800);
  const dk = await ev(`await (async () => { let flips = 0; const mo = new MutationObserver((l) => { flips += l.length; }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.__lt = []; const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }); po.observe({ entryTypes: ['longtask'] });
    const t0 = performance.now(); const r = await __cmwFig.makeVideo({ video: { size: '1280x720', fps: 30, secs: 2, ends: 'once', look: 'light' } }); const ms = performance.now() - t0;
    const f = await __cmwFig.build({ for: 'article' }); await new Promise((q) => setTimeout(q, 50)); po.disconnect(); mo.disconnect();
    return { frames: r.frames, ms: Math.round(ms), flips, lt: window.__lt, dark: matchMedia('(prefers-color-scheme: dark)').matches, fig: !!f }; })()`, 300000);
  ok('dark theme: a video and a filmstrip flip the theme at most once (the light tokens are read once) and make no task of 50 ms or more', dk && dk.dark && dk.flips <= 2 && !dk.lt.some((d) => d >= 50) && dk.fig, dk);
  R.r3.dark = dk;
  await view(1440, 900, false, false); await settle(600);
}
// the dialog: the format row (remembered), For Overleaf with a PNG, the deformation row, Save video, Cancel
const dlg3 = async () => { for (let i = 0; i < 120; i++) { await sleep(150); const r = await ev(`(() => { const d = __cmwFig.dialog(); return !!(d && d.fig && !d.building); })()`); if (r === true) return true; } return false; };
await open('xvr3dlg');
await ev('__cmwExample(1); 1'); await settle(1800);
await key('m'); await settle(1200);
await ev('__cmwMorph({ playing: false, T: 1.2 }); 1');
await key('2'); await settle(1500);
await key('e', 4); await dlg3();
let q3 = await ev(`(() => ({ fmts: [...document.querySelectorAll('#xfFmt button')].map((b) => b.dataset.v), deform: [...document.querySelectorAll('#xfDeform button')].map((b) => b.dataset.v), tex: document.getElementById('xfTex').textContent }))()`);
ok('dialog (Phase, deformation on): PDF, PNG, SVG, Video; Filmstrip and One frame', q3.fmts.join() === 'pdf,png,svg,video' && q3.deform.join() === 'film,frame', q3);
ok('dialog: the LaTeX of the format in view', /\\caption\[/.test(q3.tex) && /\\displaystyle F\(z\)=/.test(q3.tex), q3.tex.slice(0, 300));
await clickSel('#xfFmt button[data-v="png"]'); await settle(300);
q3 = await ev(`(() => ({ tex: document.getElementById('xfTex').textContent, ext: document.querySelector('.xf-ext').textContent, dpi: !document.getElementById('xfDpi').hidden, note: document.getElementById('xfTexNote').textContent }))()`);
ok('dialog PNG: the snippet (shrink-only), the extension, the dpi menu at 600 dpi for Article, PDF advised for a journal', /\\includegraphics\[width=\\ifdim\\linewidth<360pt \\linewidth\\else 360pt\\fi\]\{strip-to-disk-phase-film\.png\}/.test(q3.tex) && q3.ext === '.png' && q3.dpi && /600 dpi/.test(q3.note) && /PDF is better/.test(q3.note), q3);
// (review r3, editor-15) the LaTeX box wraps its long caption
q3 = await ev(`(() => { const p = document.getElementById('xfTex'); return { ws: getComputedStyle(p).whiteSpace, sw: p.scrollWidth, cw: p.clientWidth }; })()`);
ok('dialog: the LaTeX box wraps (no 8000 px line)', q3.ws === 'pre-wrap' && q3.sw <= q3.cw + 2, q3);
await ev('window.__saved.length = 0; window.__copied.length = 0; 1');
await clickSel('#xfOverleaf');
for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('window.__saved.length > 0')) break; }
q3 = await ev(`({ saved: window.__saved.map((s) => s.name), copied: window.__copied.filter((c) => c.type === 'text').map((c) => c.t.slice(0, 600)) })`);
ok('For Overleaf with PNG: the PNG saved, its snippet copied', q3.saved.includes('strip-to-disk-phase-film.png') && q3.copied.some((t) => /\{strip-to-disk-phase-film\.png\}/.test(t)), q3);
await key('Escape'); await settle(300);
await key('e', 4); await dlg3();
q3 = await ev(`(document.querySelector('#xfFmt [aria-checked="true"]') || {}).dataset.v`);
ok('the format is remembered (PNG)', q3 === 'png', q3);
await clickSel('#xfFmt button[data-v="video"]'); await settle(400);
await clickSel('#xfVSize button[data-v="1280x720"]'); await settle(200);
q3 = await ev(`(() => ({ win: [...document.querySelectorAll('#xfVWin button')].map((b) => b.dataset.v + ':' + b.getAttribute('aria-checked')), name: document.getElementById('xfName').value }))()`);
ok('dialog Video: a Window choice (As on screen, the default; Fit the motion), the name of a video', q3.win.join() === 'screen:true,fit:false' && q3.name === 'strip-to-disk-phase-video', q3);
q3 = await ev(`(() => { const s = document.getElementById('xfVLen'); return { aria: s.getAttribute('aria-label'), opts: [...s.options].map((o) => o.value + ':' + o.textContent) }; })()`);
ok('dialog Video: the Length menu says it is per step (2, 3, 4, 6 s per step)', q3.aria === 'Length of each step' && q3.opts.join() === '2:2 s per step,3:3 s per step,4:4 s per step,6:6 s per step', q3);
await ev(`(() => { const s = document.getElementById('xfVLen'); s.value = '2'; s.dispatchEvent(new Event('change')); return 1; })()`);
for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(`!!document.querySelector('.xf-poster').getAttribute('src')`)) break; }
q3 = await ev(`(() => ({ hidden: ['xfOverleaf', 'xfDocs', 'xfMore'].map((id) => document.getElementById(id).hidden), vid: !document.getElementById('xfVideo').hidden, poster: !!document.querySelector('.xf-poster').getAttribute('src'), ext: document.querySelector('.xf-ext').textContent, hint: document.querySelector('.xf-hint').textContent }))()`);
ok('dialog Video: a poster frame, Save video, the destinations put away', q3.hidden.every(Boolean) && q3.vid && q3.poster && q3.ext === '.mp4' && /1280 × 720/.test(q3.hint), q3);
await shot('export-dlg-video-1440');
await ev(`window.__saved.length = 0; window.__lt = []; window.__po = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }); window.__po.observe({ entryTypes: ['longtask'] }); 1`);
await clickSel('#xfVideo');
let sawProg = false;
for (let i = 0; i < 300; i++) { await sleep(200); if (!sawProg) sawProg = await ev(`!document.querySelector('.xf-prog').hidden && /Frame \\d+ of \\d+/.test(document.querySelector('.xf-progtxt').textContent)`); if (await ev('window.__saved.length > 0')) break; }
q3 = await ev(`({ saved: window.__saved.map((s) => s.name), after: document.querySelector('.xf-after2').textContent, lt: window.__lt, video: __cmwFig.dialog().video })`);
ok('Save video: a progress bar, then strip-to-disk-phase-video.mp4 (H.264, 1280 x 720, 30 fps, 2 s per step + holds)', sawProg && q3.saved.includes('strip-to-disk-phase-video.mp4') && /1280 × 720, 30 fps/.test(q3.after) && /H\.264/.test(q3.after), q3);
ok('Save video in the dialog: no main-thread task of 50 ms or more', !q3.lt.some((d) => d >= 50), q3.lt);
await ev('window.__saved.length = 0; 1');
// (a long video, so Cancel comes while it is being made: 1920 x 1080 at 60 fps, 6 s per step)
await clickSel('#xfVSize button[data-v="1920x1080"]'); await clickSel('#xfVFps button[data-v="60"]');
await ev(`(() => { const s = document.getElementById('xfVLen'); s.value = '6'; s.dispatchEvent(new Event('change')); return 1; })()`); await sleep(300);
const box0 = await ev(`(() => { const r = document.querySelector('.modal.xf').getBoundingClientRect(); return [r.top, r.height]; })()`);
await clickSel('#xfVideo');
for (let i = 0; i < 100; i++) { await sleep(100); if (await ev(`!document.querySelector('.xf-prog').hidden && /Frame (\\d+)/.test(document.querySelector('.xf-progtxt').textContent) && +/Frame (\\d+)/.exec(document.querySelector('.xf-progtxt').textContent)[1] > 5`)) break; }
// (review r3, video-7, video-10) during a run: the dialog stays put, the options are locked, the bar has a value, and the
// per-frame text is not a live region
q3 = await ev(`(() => { const r = document.querySelector('.modal.xf').getBoundingClientRect(), pb = document.querySelector('.xf-meter'); return { box: [r.top, r.height], locked: [...document.querySelectorAll('#xfVideoBox button, #xfVideoBox select, #xfVideoBox input')].every((e) => e.disabled), now: pb.getAttribute('aria-valuenow'), min: pb.getAttribute('aria-valuemin'), max: pb.getAttribute('aria-valuemax'), live: document.querySelector('.xf-progtxt').getAttribute('role'), status: [...document.querySelectorAll('.xf-foot [role="status"]')].map((e) => e.textContent) }; })()`);
ok('during a video: the dialog does not move, the options are locked, the progress bar has a value, the frame count is not announced', Math.abs(q3.box[0] - box0[0]) < 1 && Math.abs(q3.box[1] - box0[1]) < 1 && q3.locked && +q3.now > 0 && q3.min === '0' && q3.max === '100' && q3.live == null && q3.status.every((t) => !/Frame/.test(t)), { box0, q3 });
await ev(`(() => { const b = document.getElementById('xfVCancel'); if (b && !b.closest('[hidden]')) b.click(); return !!b; })()`);
for (let i = 0; i < 40; i++) { await sleep(150); if (await ev(`document.querySelector('.xf-prog').hidden`)) break; }
await sleep(400);
q3 = await ev(`({ saved: window.__saved.map((s) => s.name), toasts: [...document.querySelectorAll('.toast, [role="status"]')].map((t) => t.textContent).filter((t) => /cancel/i.test(t)) })`);
ok('Cancel stops the video: nothing saved', q3.saved.length === 0, q3);
ok('after Cancel the options are free again', await ev(`[...document.querySelectorAll('#xfVideoBox button, #xfVideoBox select, #xfVideoBox input')].every((e) => !e.disabled)`), null);
for (const [w, h, dark] of [[760, 900, true], [360, 780, false], [360, 780, true]]) {
  await view(w, h, dark, w < 500); await settle(600);
  const m = await ev(`(() => { const m = document.querySelector('.modal.xf'); const r = m.getBoundingClientRect(); return { box: [r.left, r.width], sw: document.documentElement.scrollWidth, vw: innerWidth, over: m.scrollWidth - m.clientWidth, vid: (() => { const b = document.getElementById('xfVideo').getBoundingClientRect(); return [b.left, b.right, b.bottom]; })(), vh: innerHeight }; })()`);
  await shot(`export-dlg-video-${w}-${dark ? 'dark' : 'light'}`);
  ok(`dialog Video ${w} ${dark ? 'dark' : 'light'}: no horizontal scroll, Save video on screen`, m.sw <= m.vw && m.over <= 0 && m.vid[0] >= 0 && m.vid[1] <= m.vw && m.vid[2] <= m.vh, m);
}
await view(1440, 900, false, false);
await key('Escape'); await settle(300);
// (review r3, video-3) Save figure again after a video opens the dialog on Video; with the deformation off it makes the
// last figure again
{
  await ev(`(() => { const s = __cmwFig.settings(); s.last = { kind: 'video', fmt: 'mp4' }; s.lastFig = { kind: 'save', fmt: 'svg' }; s.fmt = 'video'; __cmwFig.saveSettings(s); return 1; })()`);
  await ev('window.__saved.length = 0; __cmwFig.again("save"); 1'); await settle(1200);
  q3 = await ev(`(() => ({ open: !!document.querySelector('.modal.xf'), fmt: (document.querySelector('#xfFmt [aria-checked="true"]') || {}).dataset.v, saved: window.__saved.length }))()`);
  ok('Save figure again after a video: the dialog opens on Video (progress and Cancel there), nothing is rendered behind it', q3.open && q3.fmt === 'video' && q3.saved === 0, q3);
  await key('Escape'); await settle(300);
  await key('m'); await settle(800);
  await ev('window.__saved.length = 0; 1');
  const ag = await ev(`await (async () => { try { await __cmwFig.again('save'); return { saved: window.__saved.map((s) => s.name) }; } catch (e) { return { err: String(e) }; } })()`, 120000);
  ok('Save figure again after a video, the deformation off: the last figure (SVG) is saved, no error', ag && !ag.err && ag.saved.length === 1 && /\.svg$/.test(ag.saved[0]), ag);
  await key('m'); await settle(1200);
  await ev('__cmwMorph({ playing: false, T: 1.2 }); 1'); await settle(600);
}
// (review r3, video-6, video-5) no video encoder: Video is shown disabled with the reason; H.264 refused: the name says .webm
{
  // (a page of its own: the encoder choice is cached per page)
  await open('xvr3enc');
  await ev('__cmwExample(1); 1'); await settle(1800);
  await key('m'); await settle(1200);
  await ev('__cmwMorph({ playing: false, T: 1.2 }); 1');
  await key('2'); await settle(1500);
  await ev(`(() => { window.__VE = window.VideoEncoder; delete window.VideoEncoder; window.VideoEncoder = undefined; return 1; })()`);
  await key('e', 4); await dlg3();
  q3 = await ev(`(() => { const b = document.querySelector('#xfFmt [data-v="video"]'); return { dis: !!(b && b.disabled), title: b && b.title, fmt: (document.querySelector('#xfFmt [aria-checked="true"]') || {}).dataset.v }; })()`);
  ok('no VideoEncoder: Video is disabled at the format row, with the reason', q3.dis && /cannot encode video/.test(q3.title) && q3.fmt !== 'video', q3);
  await key('Escape'); await settle(300);
  await ev(`(() => { window.VideoEncoder = window.__VE; const ic = VideoEncoder.isConfigSupported.bind(VideoEncoder); window.__ic = VideoEncoder.isConfigSupported; VideoEncoder.isConfigSupported = (c) => (/^avc1/.test(c.codec) ? Promise.resolve({ supported: false, config: c }) : ic(c)); return 1; })()`);
  await key('e', 4); await dlg3();
  await clickSel('#xfFmt button[data-v="video"]');
  for (let i = 0; i < 30; i++) { await sleep(200); if (await ev(`document.querySelector('.xf-ext').textContent === '.webm'`)) break; }
  q3 = await ev(`document.querySelector('.xf-ext').textContent`);
  ok('H.264 refused: the dialog names the file .webm before Save', q3 === '.webm', q3);
  await key('Escape'); await settle(300);
  await ev(`(() => { VideoEncoder.isConfigSupported = window.__ic; return 1; })()`);
}
// (review r3, editor-5) the video As on screen against the screen itself: its window holds the screen's with the same
// centre, and a frame at the screen's t, cropped to the screen's window, matches a capture of the pane
{
  await key('1'); await settle(300); await ev(`__cmwSetView('R', 'plane'); 1`); await settle(2500);
  const rect = await ev(`(() => { const r = document.getElementById('canvasR').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`);
  const f = await shot('r3-screen-paneR', rect);
  const b64 = fs.readFileSync(f).toString('base64');
  const sc = await ev(`await (async () => { try {
    const q = await __cmwFig.videoScreenCheck({ video: { size: '1280x720', look: 'light', win: 'screen', paths: false, tlabel: false } });
    const W = 1280, H = 720, b = q.box, s = q.screen;
    const fr = new Image(); fr.src = q.frame; await fr.decode();
    const sh = new Image(); sh.src = 'data:image/png;base64,${b64}'; await sh.decode();
    const w = 320, h = Math.round(320 * sh.height / sh.width);
    const c1 = document.createElement('canvas'); c1.width = w; c1.height = h; const x1 = c1.getContext('2d');
    x1.drawImage(fr, (s.x0 - b.x0) / (b.x1 - b.x0) * W, (b.y1 - s.y1) / (b.y1 - b.y0) * H, (s.x1 - s.x0) / (b.x1 - b.x0) * W, (s.y1 - s.y0) / (b.y1 - b.y0) * H, 0, 0, w, h);
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const x2 = c2.getContext('2d'); x2.drawImage(sh, 0, 0, w, h);
    const a = x1.getImageData(0, 0, w, h).data, d = x2.getImageData(0, 0, w, h).data;
    let m = 0; for (let i = 0; i < a.length; i += 4) m += Math.abs(a[i] - d[i]) + Math.abs(a[i + 1] - d[i + 1]) + Math.abs(a[i + 2] - d[i + 2]);
    const cx = (v) => (v.x0 + v.x1) / 2, cy = (v) => (v.y0 + v.y1) / 2;
    return { mad: m / (w * h * 3), holds: b.x0 <= s.x0 + 1e-9 && b.x1 >= s.x1 - 1e-9 && b.y0 <= s.y0 + 1e-9 && b.y1 >= s.y1 - 1e-9, centre: Math.hypot(cx(b) - cx(s), cy(b) - cy(s)), t: q.t, crop: c1.toDataURL('image/png') };
  } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 120000);
  if (sc && sc.crop) { fs.writeFileSync(path.join(OUT, 'r3-video-vs-screen.png.dec'), Buffer.from(sc.crop.split(',')[1], 'base64')); delete sc.crop; }
  R.r3.screen = sc;
  ok('video As on screen: its window holds the screen\'s, same centre; the frame at the screen\'s t matches the pane (mean abs difference < 12 of 255)', sc && !sc.err && sc.holds && sc.centre < 1e-6 && sc.mad < 12, sc);
}
// (review r3, video-2) a hidden page: a second tab in front; the video keeps going at its pace
{
  let tg = null;
  try { tg = await send('Target.createTarget', { url: 'about:blank' }); try { await send('Target.activateTarget', { targetId: tg.targetId }); } catch (e) { /* front already */ } } catch (e) { tg = { err: String(e).slice(0, 200) }; }
  await sleep(500);
  const hv = await ev(`await (async () => { const vis = document.visibilityState; const t0 = performance.now(); const r = await __cmwFig.makeVideo({ video: { size: '1280x720', fps: 30, secs: 2, ends: 'once', look: 'light' } }); return { vis, frames: r.frames, ms: Math.round(performance.now() - t0) }; })()`, 300000);
  try { if (tg && tg.targetId) await send('Target.closeTarget', { targetId: tg.targetId }); } catch (e) { /* closed */ }
  await sleep(500);
  const vv = await ev(`await (async () => { const t0 = performance.now(); const r = await __cmwFig.makeVideo({ video: { size: '1280x720', fps: 30, secs: 2, ends: 'once', look: 'light' } }); return { vis: document.visibilityState, frames: r.frames, ms: Math.round(performance.now() - t0) }; })()`, 300000);
  R.r3.hidden = { hidden: hv, visible: vv, tab: tg };
  ok('video in a hidden page: made at a pace close to a visible one (no one-frame-a-second timers)', hv && vv && hv.frames === vv.frames && (hv.vis !== 'hidden' || hv.ms < Math.max(3 * vv.ms, vv.ms + 4000)), { hv, vv });
}
await open('xvr3ru');
// the X -> Y plane in Russian: the displayed F and the film caption in the caption language, for the LaTeX check
await ev('__cmwExample(1); 1'); await settle(1500);
await key('1'); await settle(600);
await build3('r3-ru-xy-strip-homework', { for: 'homework', lang: 'ru', view: 'xy' });
await key('m'); await settle(1500);
await ev('__cmwMorph({ playing: false, T: 1.2 }); 1'); await settle(600);
for (const [p, o] of Object.entries(P3)) await build3(`r3-ru-film-plane-${p}`, Object.assign({ lang: 'ru' }, o));
await build3('r3-ru-xy-strip-article1', { for: 'article', lang: 'ru', view: 'xy' });
await key('2'); await settle(1500);
await build3('r3-ru-film-phase-homework', { for: 'homework', lang: 'ru' });

R.logs = logs().filter((l) => /EXC|error/i.test(l.t) && !/404|favicon/.test(l.m)).slice(0, 12);
ok('no exceptions', !R.logs.some((l) => l.t === 'EXC'), R.logs);
return { pass: fails.length === 0, fails, ...R, figs: Object.keys(R.figs).length };
