// The figure export (notes/export-design/AS-BUILT.md), in the steps view: the shown plane on each surface and the
// filmstrip of the thread x preset x ink x format built by the app itself, the classic X -> Y figure's own checks on a
// page that asks for the classic view, the Export figure dialog at 360, 760 and 1440 px in light and dark, the
// remembered settings, the export menu (Export figure..., Copy figure again, Save figure again, Cmd/Ctrl+E) and the copy
// and save paths as far as headless Chrome allows; section 6, the user's requests 4 and 5. The deformation's export is
// export_deform_cmd.js. A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/export_cmd.js && python3 test/regress/export/preflight.py --latex
// Writes every file to test/regress/export/out/ (<name>.pdf|.svg|.png|.tex and <name>-boxes.json for the preflight)
// and the dialog screenshots to <daemon>/shots/export-dlg-*.png. Prints {pass, fails, ...}.
// CMW_ONLY=1-3 runs sections 1 to 3 alone and CMW_ONLY=user5 section 6 (the CI runs these parts: ci/browser_suites.js).
// CMW_ONLY=user5-classic and user5-deform are the parts of section 6 that only the classic views have: the Landscape's pane
// title naming the sheets, and the Deformation's film on them; the CI runs each on the classic views (CMW_VIEW empty).
const BASE = process.env.CMW_BASE || 'http://localhost:8793/'; // (a daemon of your own: CMW_BASE=http://localhost:<port>/)
const OUT = path.join(DIR, '..', 'regress', 'export', 'out');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
const fails = [], R = { files: 0, figs: {} };
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// (view: 'classic' asks the page for the classic view; the suite's pin opens every other page in the steps view)
const open = async (ns, w = 1440, h = 900, dark = false, view0 = null) => {
  await view(w, h, dark, w < 500);
  await nav(`${BASE}test.html?ns=${ns}${Date.now()}${view0 ? '&view=' + view0 : ''}`);
  await settle(2400);
  await move(5, 5);
  // saved files: test.html saves through a plain download link; record them instead
  await ev(`(() => { window.__saved = []; const click = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__saved.push({ name: this.download, href: this.href }); return; } return click.call(this); };
    window.__copied = []; try { navigator.clipboard.writeText = (t) => { window.__copied.push({ type: 'text', t }); return Promise.resolve(); }; navigator.clipboard.write = async (items) => { for (const it of items) window.__copied.push({ type: 'items', types: it.types }); }; } catch (e) {} return 1; })()`);
};
const b64of = (expr) => `await (async () => { const b = await (${expr}); const u8 = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); })()`;

const USER5_CLASSIC = process.env.CMW_ONLY === 'user5-classic', USER5_DEFORM = process.env.CMW_ONLY === 'user5-deform';
if (!/^user5/.test(process.env.CMW_ONLY || '')) { // (CMW_ONLY=user5, user5-classic, user5-deform: section 6 only)
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
    // (review r3 verify2, editor-13: the display's lead-in never repeats the word that starts the sentence before it,
    // «… Здесь $H_t$ …, где … . Здесь \[ … \]»)
    const sents = head.replace(/\$[^$]*\$/g, ' ').split(/\.\s+/).map((x) => x.trim());
    ok(`${tag}: no two sentences in a row start with "Here" («Здесь»)`, !sents.some((x, q) => q > 0 && /^(Here|Здесь)(?![\p{L}])/u.test(x) && /^(Here|Здесь)(?![\p{L}])/u.test(sents[q - 1])), sents.slice(-3));
    if (!/\\ifinner\\hskip\\hsize\\else\\\[ \\begin\{gathered\}/.test(r.cap) && head.indexOf('$F$') >= 0) ok(`${tag}: F's display follows the phrase that names F`, head.length - head.indexOf('$F$') <= 160, head.slice(head.indexOf('$F$')));
  }
  ok(`${tag}: snippet`, opts.for === 'homework' ? /\\begin\{figure\}\[H\]/.test(r.tex) && /\\ifdim\\linewidth</.test(r.tex) : opts.for === 'slides' ? /\\begin\{frame\}/.test(r.tex) : (r.star ? /\\begin\{figure\*\}\[tbp\]/.test(r.tex) : /\\begin\{figure\}\[tbp\]/.test(r.tex)) && /\\includegraphics\{/.test(r.tex), r.tex.slice(0, 400));
  return r;
};
await open('xrexport');
ok('the page is the steps view', await ev('!!window.__cmwSteps && __cmwSteps().on'), null);
const svSet = async (o) => { await ev(`(__cmwSteps(${JSON.stringify(o)}), 1)`); await settle(1500); };
// the plane: z coloured by F, with the shapes, for the strip (a formula area, a line, a point), the Cayley map then the
// cube, the quarter plane squared
for (const [ex, nm] of [[1, 'strip'], [8, 'cayleycube'], [2, 'quarter']]) {
  await ev(`__cmwExample(${ex}); 1`); await settle(2200);
  await adopted();
  await svSet({ surf: 'plane', go: 0, now: true });
  for (const [p, o] of Object.entries(PRESETS)) {
    const r = await build(`plane-${nm}-${p}`, o);
    if (r && p === 'article1') ok(`plane ${nm}: the phase portrait of F in the z-plane, one panel`, r.view === 'xyL' || r.view === 'phase' ? /Phase portrait of \$F\$/.test(r.cap) && !/^\(a\) /.test(r.cap) : false, { view: r.view, cap: r.cap.slice(0, 160) });
    if (p === 'article1' || p === 'homework') await build(`plane-${nm}-${p}-bw`, Object.assign({ ink: 'bw' }, o), nm === 'strip' ? ['pdf', 'svg', 'png', 'tex'] : ['pdf', 'tex']);
  }
}
// the strip map on the sphere and as a landscape
await ev('__cmwExample(1); 1'); await settle(2200);
await adopted();
await svSet({ surf: 'sphere', go: 0, now: true });
for (const [p, o] of Object.entries(PRESETS)) await build(`sphere-strip-${p}`, o, p === 'article1' ? ['pdf', 'svg', 'png', 'tex'] : ['pdf', 'tex']);
await svSet({ surf: 'land' });
for (const [p, o] of Object.entries(PRESETS)) {
  const r = await build(`land-strip-${p}`, o);
  if (r && p === 'article1') {
    // (review r3 verify, editor-13: "Landscape of $F$ over ..., where \[ ... \] The height is ...")
    ok('landscape: the height named in the caption', /[Tt]he height is \$\\log\|F\|\$/.test(r.cap), r.cap);
    ok('landscape: vector floor labels', r.boxes.filter((b) => b.kind === 'tick').length >= 4 && r.boxes.some((b) => b.kind === 'axis-name'), r.boxes.map((b) => b.kind));
  }
}
await build('land-strip-article1-bw', { for: 'article', ink: 'bw' });
// the filmstrip of the thread: a frame per plane, each titled with its plane
await svSet({ surf: 'plane' });
const nPlanes = (await ev('__cmwSteps().planes')).length;
for (const [p, o] of Object.entries(PRESETS)) {
  const r = await build(`svfilm-strip-${p}`, Object.assign({ svPic: 'film' }, o));
  if (r && p === 'article2W') ok('filmstrip: a frame per plane, each titled', r.boxes.filter((b) => b.kind === 'title').length === nPlanes && /The planes along/.test(r.cap), { titles: r.boxes.filter((b) => b.kind === 'title').map((b) => b.tex), planes: nPlanes, cap: r.cap });
}
// the classic X -> Y figure: two panels (a) and (b), the open boundaries dashed and the images of the points named A',
// and the Phase view's zeros and poles, which the steps view's one plane does not draw; on a page that asks for the
// classic view
await open('xrexportc', 1440, 900, false, 'classic');
await ev('__cmwExample(1); 1'); await settle(2200);
for (const p of ['article1', 'homework']) {
  const r = await build(`xy-strip-${p}`, PRESETS[p]);
  if (r && p === 'homework') {
    ok('homework: open boundaries dashed and said so', /stroke-dasharray="3 2"/.test(await ev('window.__f.svg')) && /Dashed: boundary not included\./.test(r.cap), r.cap);
    ok('homework: points named A, A\'', /\$A=0\$/.test(r.cap) && /goes to \$A'\$/.test(r.cap), r.cap);
    ok('homework: 1 in margins by default, shrink only', /469\.75pt \\linewidth\\else 469\.75pt\\fi/.test(r.tex), r.tex.slice(0, 300));
  }
  if (r && p === 'article1') ok('article: solid boundaries, (a) (b)', !/stroke-dasharray="3 2"/.test(await ev('window.__f.svg')) && /^\(a\) /.test(r.cap) && / \(b\) /.test(r.cap), r.cap);
}
await ev(`__cmwSetMain('phase'); 1`); await settled({ until: `__cmwView().main === 'phase'` });
for (const p of ['article1', 'article2']) {
  const r = await build(`phase-strip-${p}`, PRESETS[p]);
  if (r && p === 'article1') ok('phase: zeros and poles named, level lines', /Zeros \(dots\) at \$0\$/.test(r.cap) && /Poles/.test(r.cap) && /level sets/.test(r.cap), r.cap);
  const b = await build(`phase-strip-${p}-bw`, Object.assign({ ink: 'bw' }, PRESETS[p]));
  if (b) ok('phase B/W: a contour portrait', /drawn as level sets/.test(b.cap) && /dashed: \$\\arg F=\\pi\$/.test(b.cap), b.cap);
}
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
// the plain Save names the format and copies nothing (D12 #33); Copy image and the LaTeX button are beside it
const sv = await ev(`(() => ({ save: document.getElementById('xfSave').textContent, docs: document.getElementById('xfDocs').textContent, ol: document.getElementById('xfOverleaf').textContent, order: [...document.querySelectorAll('.xf-foot .xf-dest')].filter((b) => !b.hidden).map((b) => b.id), share: document.getElementById('xfShare').hidden }))()`);
ok('the footer says Save PDF first, then Copy image and Save + copy LaTeX', /^Save PDF$/.test(sv.save) && sv.docs === 'Copy image' && /^Save \+ copy LaTeX for/.test(sv.ol) && sv.order.join() === 'xfSave,xfDocs,xfOverleaf' && sv.share, sv);
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

} // (CMW_ONLY=user5, user5-classic and user5-deform skip sections 1 to 3)
// 6. (the user's requests 4 and 5, notes/v16-user5/AS-BUILT-export.md; CMW_ONLY=user5 runs it alone)
// (a) the Landscape with All sheets says exactly which sheets it draws, in the LaTeX caption (English and Russian),
// the figure's own caption and the pane title: both / all n sheets for a finite covering, the window of infinitely
// many (log, z^i) or of N (a 30th root), n of the infinitely many for several pieces, K of the total combinations when
// capped; never "all sheets of the Riemann surface". While deforming (the merge with work/xvsh) the landscape draws H_t
// on the sheets that become F's: the clause says so, exactly.
// (b) the Export figure dialog's menus (More formats, Size) open over the dialog, inside the viewport, take the focus,
// move with the arrows, close with Esc (the dialog stays) and with a press outside (the dialog stays); an item works
// with a real click. At 1440 and 390 px (phone), light and dark.
if (process.env.CMW_ONLY !== '1-3') {
  R.u5 = { caps: {}, menus: {} };
  // (as the daemon's load(): the state is written from another page of the origin, so the app cannot save over it)
  const loadSt = async (ns, st) => {
    await nav(`${BASE}gl-helpers.html`);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(Object.assign({ v3: true, v4: true, nextId: 50, focus: 0 }, st)))}); 1`);
    await nav(`${BASE}test.html?ns=${ns}${USER5_CLASSIC || USER5_DEFORM ? '&view=classic' : ''}`); await settled();
  };
  // (sections 1 to 4 keep their helpers in their own block: this section's own, the same files for the preflight)
  const dlgReady = async () => { for (let i = 0; i < 120; i++) { await sleep(150); const r = await ev(`(() => { const d = __cmwFig.dialog(); return !!(d && d.fig && !d.building); })()`); if (r === true) return true; } return false; };
  const build = async (tag, opts, fmts) => {
    const r = await ev(`await (async () => { try { const f = await __cmwFig.build(${JSON.stringify(opts)}); if (!f) return null; window.__f = f;
      return { W: f.W, H: f.H, Wtex: f.Wtex, view: f.view, name: f.name, cap: f.captionTex, boxes: f.boxes, lines: f.lines, tex: __cmwFig.latex(f) }; } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 180000);
    if (!r || r.err) { fails.push({ name: `build ${tag}`, got: r }); return null; }
    if (fmts.includes('tex')) {
      fs.writeFileSync(path.join(OUT, `${tag}-boxes.json`), JSON.stringify({ target: r.Wtex, W: r.W, H: r.H, view: r.view, preset: opts.for, cols: opts.cols || null, ink: 'colour', boxes: r.boxes, lines: r.lines, cap: r.cap }));
      fs.writeFileSync(path.join(OUT, `${tag}.tex`), r.tex.replace(new RegExp(`\\{${r.name}\\}`, 'g'), `{${tag}}`));
    }
    if (fmts.includes('pdf')) {
      const b = await ev(b64of('__cmwFig.pdf(window.__f)'), 120000);
      if (typeof b === 'string') fs.writeFileSync(path.join(OUT, `${tag}.pdf`), Buffer.from(b, 'base64')); else fails.push({ name: `pdf ${tag}`, got: b });
    }
    return r;
  };
  await view(1440, 900, false, false);
  const RT = (n) => ({ type: 'root', params: { n, cut: 180 } }), LG = { type: 'log', params: { cut: 180, k: 0 } }, CU = (expr) => ({ type: 'custom', params: { expr, cut: 180 } });
  const CASES = [
    ['log', [LG], /; the sheets \$k=-2,\\dots,2\$ of infinitely many are shown\./, /; из бесконечного множества листов показаны листы \$k=-2,\\dots,2\$\./, /, sheets k = −2…2$/],
    ['sqrt', [RT(2)], /; both sheets are shown\./, /; показаны оба листа\./, /, both sheets$/],
    ['cube', [RT(3)], /; all 3 sheets are shown\./, /; показаны все 3 листа\./, /, all 3 sheets$/],
    ['sinsqrt', [RT(2), CU('\\sin(z)')], /; both sheets are shown\./, /; показаны оба листа\./, /, both sheets$/],
    ['capped', [RT(5), RT(6)], /; 24 of the 30 sheet combinations are shown\./, /; показаны сочетания листов: 24 из 30\./, /, 24 of 30 sheet combinations$/],
    ['logsqrt', [CU('\\log(z)+\\sqrt{z}')], /; 10 of the infinitely many sheets are shown \(the window \$k=-2,\\dots,2\$\)\./, /; показаны листы: 10 из бесконечного множества \(окно \$k=-2,\\dots,2\$\)\./, /, 10 sheets, k = −2…2$/],
    ['root30', [RT(30)], /; the sheets \$k=-2,\\dots,2\$ of 30 are shown\./, /; показаны листы \$k=-2,\\dots,2\$ \(всего листов: 30\)\./, /, sheets k = −2…2$/],
    ['powi', [CU('z^{i}')], /; the sheets \$k=-2,\\dots,2\$ of infinitely many are shown\./, /; из бесконечного множества листов показаны листы \$k=-2,\\dots,2\$\./, /, sheets k = −2…2$/],
    // (v16.1 review math-7: a typed near-fraction is not 1/3: a window of its infinitely many sheets)
    ['nearthird', [{ type: 'powa', params: { alpha: '0.333333333', cut: 180, k: 0 } }], /; the sheets \$k=-2,\\dots,2\$ of infinitely many are shown\./, /; из бесконечного множества листов показаны листы \$k=-2,\\dots,2\$\./, /, sheets k = −2…2$/],
  ];
  const disc = [{ id: 's1', kind: 'disc', c: [0.3, 0.2], r: 1, ci: 0, visible: true }];
  const OLD = /all sheets of the Riemann surface|все листы римановой поверхности/;
  for (const [nm, steps, en, ru, title] of USER5_DEFORM ? [] : CASES) {
    await loadSt(`u5s${nm}${Date.now()}`, { steps, rightMode: '3d', sheets: true, height: 'im', shapes: disc });
    const t = await ev(`(() => { const e = document.querySelector('.prole .rf') || document.querySelector('.prole'); return e ? e.textContent : null; })()`);
    if (USER5_CLASSIC) {
      let tt = t;   // (the title is set after the page settles: the builds below gave the steps part that time)
      for (let i = 0; i < 20 && !title.test(tt || ''); i++) { await settle(300); tt = await ev(`(() => { const e = document.querySelector('.prole .rf') || document.querySelector('.prole'); return e ? e.textContent : null; })()`); }
      ok(`sheets ${nm}: the Landscape title says which sheets`, title.test(tt || ''), tt);
      continue;
    }
    const fmts = nm === 'log' || nm === 'capped' || nm === 'logsqrt' ? ['pdf', 'tex'] : [];
    const e = await build(`u5-sheets-${nm}-article1`, { for: 'article' }, fmts);
    const r = await build(`u5-sheets-ru-${nm}-article1`, { for: 'article', lang: 'ru' }, fmts);
    // (the figure's own caption: the PNG for Docs, set from the same template)
    const own = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'homework', capInImage: true }); return f ? f.boxes.filter((b) => b.kind === 'caption').map((b) => b.tex || b.text || '').join(' ') : null; })()`, 120000);
    R.u5.caps[nm] = { title: t, en: e && e.cap.slice(-200), ru: r && r.cap.slice(-200) };
    ok(`sheets ${nm}: the English caption says which sheets`, e && en.test(e.cap) && !OLD.test(e.cap), e && e.cap.slice(-260));
    ok(`sheets ${nm}: the Russian caption says which sheets`, r && ru.test(r.cap) && !OLD.test(r.cap), r && r.cap.slice(-260));
    ok(`sheets ${nm}: the figure's own caption has no "all sheets"`, own != null && !OLD.test(own), own && own.slice(-200));
    if (nm === 'log') {
      ok('sheets log: the Russian display writes the multivalued Ln (GLOSSARY 2.2)', r && /\\operatorname\{Ln\} z/.test(r.cap) && !/\\ln z/.test(r.cap), r && r.cap.slice(0, 260));
      ok('sheets log: the English display keeps log', e && /F\(z\)=\\log z/.test(e.cap), e && e.cap.slice(0, 200));
      await build('u5-sheets-log-homework', { for: 'homework' }, ['pdf', 'tex']);
      await build('u5-sheets-ru-log-homework', { for: 'homework', lang: 'ru' }, ['pdf', 'tex']);
    }
  }
  if (USER5_DEFORM) {
  // the deformation on: the landscape draws H_t on the sheets that become F's (work/xvsh), so the clause names them
  // (both of √z's), with no Ln (the map is H_t) and never "all sheets of the Riemann surface"
  await loadSt(`u5smorph${Date.now()}`, { steps: [RT(2)], rightMode: '3d', sheets: true, height: 'im', shapes: disc });
  await ev('__cmwMorph({ open: true }); 1'); await settled({ until: '__cmwMorph().open === true' });
  const mt = await ev(`(() => { const e = document.querySelector('.prole .rf') || document.querySelector('.prole'); return e ? e.textContent : null; })()`);
  const mc = await build('u5-sheets-morph-article1', { for: 'article', deform: 'frame' }, []);
  const mr = await build('u5-sheets-ru-morph-article1', { for: 'article', deform: 'frame', lang: 'ru' }, []);
  R.u5.caps.morph = { title: mt, en: mc && mc.cap.slice(-260), ru: mr && mr.cap.slice(-260) };
  // (v16.1 review user-1, user-2, math-2: one surface of H_t per sheet of F, the deformed root's path on its sheet, and
  // the homotopy not called the principal branch)
  const homEN = /; \$H_t\$ is drawn on 2 surfaces, one for each sheet of \$F\$\. Each deformed root or power \$z\^\{\\alpha\}\$ runs along \$z\^\{\\sigma\}e\^\{2\\pi ik\\sigma\}\$, \$\\sigma=1\+\(\\alpha-1\)t\$, where \$k\$ is its branch number on that surface\./;
  const homRU = /; деформация \$H_t\$ показана на 2 поверхностях, по одной для каждого листа \$F\$\. Каждый деформируемый корень и[~ ]каждая степень/;
  ok('sheets, deformation on: the English caption: one surface per sheet of F, the path on a sheet', mc && homEN.test(mc.cap) && !OLD.test(mc.cap) && !/\\operatorname\{Ln\}/.test(mc.cap) && !/principal branch/.test(mc.cap) && /\(on every sheet\)/.test(mc.cap), mc && mc.cap.slice(-700));
  ok('sheets, deformation on: the Russian caption names them', mr && homRU.test(mr.cap) && !OLD.test(mr.cap) && !/главная ветвь/.test(mr.cap) && /\(на каждом листе\)/.test(mr.cap), mr && mr.cap.slice(-700));
  ok('sheets, deformation on: the title says on both sheets of F', /, on both sheets of F$/.test(mt || ''), mt);
  // (v16.1 review user-1) the default figure while deforming is the four-panel film: its caption has the same clause
  const fe = await build('u5-sheets-film-article1', { for: 'article' }, []), fr = await build('u5-sheets-ru-film-article1', { for: 'article', lang: 'ru' }, []);
  R.u5.caps.film = { en: fe && fe.cap.slice(-900), ru: fr && fr.cap.slice(-900), view: fe && fe.view };
  ok('sheets, film: the English caption has the sheets clause and no principal branch', fe && /Landscapes of \$H_t\$/.test(fe.cap) && homEN.test(fe.cap) && !/principal branch/.test(fe.cap) && /\(on every sheet\)/.test(fe.cap), fe && fe.cap.slice(0, 900));
  ok('sheets, film: the Russian caption too', fr && homRU.test(fr.cap) && !/главная ветвь/.test(fr.cap) && /\(на каждом листе\)/.test(fr.cap), fr && fr.cap.slice(0, 900));
  await ev('__cmwMorph({ open: false }); 1'); await settled({ until: '__cmwMorph().open === false' });
  // (v16.1 review user-1) the user's case: sin √z, √ bracketed; the film and the single frame
  await loadSt(`u5susr${Date.now()}`, { steps: [RT(2), CU('\\sin(z)')], rightMode: '3d', sheets: true, height: 'im', shapes: disc });
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 }, T: 0.5 })'); await settle(2000);
  const ue = await build('u5-sheets-user-film', { for: 'article' }, ['tex']), ur = await build('u5-sheets-ru-user-film', { for: 'article', lang: 'ru' }, []);
  R.u5.caps.user = { en: ue && ue.cap, ru: ur && ur.cap };
  ok('sheets, the user\'s case: the film caption names the sheets and G_t on every sheet', ue && homEN.test(ue.cap) && !/principal branch/.test(ue.cap) && /G_t/.test(ue.cap), ue && ue.cap.slice(0, 1200));
  ok('sheets, the user\'s case: Russian', ur && homRU.test(ur.cap) && !/главная ветвь/.test(ur.cap) && /G_t/.test(ur.cap), ur && ur.cap.slice(0, 1200));
  // (v16.1 verify-1) the whole chain, √ then sin in turn (0 <= t <= 2): the path is written in the step's own time s,
  // with sigma the exponent, not in the global t
  await ev('__cmwMorph({ open: true, playing: false, range: null, T: 1.5 })'); await settle(2000);
  const we = await build('u5-sheets-whole-film', { for: 'article' }, []), wr = await build('u5-sheets-ru-whole-film', { for: 'article', lang: 'ru' }, []);
  R.u5.caps.whole = { en: we && we.cap, ru: wr && wr.cap };
  const turnEN = /Each deformed root or power \$z\^\{\\alpha\}\$ runs along \$z\^\{\\sigma\}e\^\{2\\pi ik\\sigma\}\$, \$\\sigma=1\+\(\\alpha-1\)s\$, where \$s\$ \(\$0\\le s\\le 1\$\) is the time of the step it belongs to/;
  ok('sheets, whole chain in turn: the path in the step\'s own time s', we && turnEN.test(we.cap) && !/\(\\alpha-1\)t\$/.test(we.cap) && /runs the steps in turn/.test(we.cap), we && we.cap.slice(0, 1400));
  ok('sheets, whole chain in turn: Russian', wr && /\\sigma=1\+\(\\alpha-1\)s\$, где \$s\$ \(\$0\\le s\\le 1\$\)(?:~---|\s—) время соответствующего шага/.test(wr.cap) && !/\(\\alpha-1\)t\$/.test(wr.cap), wr && wr.cap.slice(0, 1400));
  await ev('__cmwMorph({ open: false })'); await settle(600);
  } else if (!USER5_CLASSIC) {
  // (v16.1 review math-6) √ then z²: F = z is single-valued, so All sheets draws one surface and says nothing of sheets
  await loadSt(`u5ssv${Date.now()}`, { steps: [RT(2), { type: 'powa', params: { alpha: '2', cut: 180, k: 0 } }], rightMode: '3d', sheets: true, height: 'im', shapes: disc });
  const sv = await ev('__cmwLandSheets()'), se = await build('u5-sheets-single-article1', { for: 'article' }, []);
  R.u5.caps.single = { ls: sv, en: se && se.cap.slice(-300) };
  ok('sheets, √ then z²: one surface, no sheets in the title or the caption', sv && !sv.drawn && !sv.shown && !/sheet/.test(sv.title) && se && !/sheet/.test(se.cap), R.u5.caps.single);
  // (b) the dialog's menus
  const MP = `(() => { const p = document.querySelector('#popHost .pop.menu'), m = document.querySelector('.modal.xf'); if (!p) return { open: false, dialog: !!m };
    const r = p.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), e2 = document.elementFromPoint(r.left + 8, r.top + 8);
    return { open: true, dialog: !!m, rect: [r.left, r.top, r.width, r.height].map(Math.round), z: +getComputedStyle(p).zIndex, zm: +getComputedStyle(document.querySelector('.modal-bg')).zIndex,
      onTop: !!(e && p.contains(e)) && !!(e2 && p.contains(e2)), hit: [e, e2].map((x) => x && (x.tagName + '.' + String(x.className).slice(0, 30) + '#' + x.id)), toasts: [...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.slice(0, 60) + '@' + Math.round(t.getBoundingClientRect().top)), inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, focus: p.contains(document.activeElement) ? document.activeElement.textContent.trim() : null }; })()`;
  const center = (sel) => ev(`(() => { const pb = document.getElementById('xfPrintBtn'); if (pb && pb.getAttribute('aria-expanded') === 'false') pb.click(); const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.hidden) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const dark of [false, true]) {
      const tag = `${w}-${dark ? 'dark' : 'light'}`;
      await open('xu5menu', w, h, dark);
      await ev('__cmwExample(1); 1'); await settle(1800);
      await key('e', 2); await dlgReady();
      for (const id of ['xfMore', 'xfSize']) {
        const c = await center('#' + id);
        if (!c) { ok(`menus ${tag} ${id}: the button is there`, false, null); continue; }
        await click(c[0], c[1]); await sleep(350);
        const a = await ev(MP);
        await shot(`u5-menu-${id}-${tag}`);
        await key('ArrowDown'); await sleep(80);
        const b = await ev(MP);
        await key('Escape'); await sleep(250);
        const x = await ev(`({ menu: !!document.querySelector('#popHost .pop.menu'), dialog: !!document.querySelector('.modal.xf'), focus: document.activeElement && document.activeElement.id })`);
        R.u5.menus[`${tag}-${id}`] = { a, b, x };
        ok(`menus ${tag} ${id}: opens over the dialog (elementFromPoint at its centre is inside it), inside the viewport`, a.open && a.z > a.zm && a.onTop && a.inView, a);
        ok(`menus ${tag} ${id}: the focus is in the menu and moves with the arrows`, !!a.focus && !!b.focus && a.focus !== b.focus, { a: a.focus, b: b.focus });
        ok(`menus ${tag} ${id}: Esc closes the menu, the dialog stays, the focus is back on the button`, !x.menu && x.dialog && x.focus === id, x);
      }
      // the keyboard alone: the button focused, Enter opens the menu, Esc closes it
      await ev(`document.getElementById('xfMore').focus(); 1`); await key('Enter'); await sleep(300);
      const kb = await ev(MP);
      ok(`menus ${tag}: Enter on More formats opens it with the focus inside`, kb.open && kb.onTop && !!kb.focus, kb);
      await key('Escape'); await sleep(250);
      // a press outside the open menu, on the backdrop, closes the menu only
      let c = await center('#xfMore'); await click(c[0], c[1]); await sleep(300);
      await click(4, 4); await sleep(300);
      const po = await ev(`({ menu: !!document.querySelector('#popHost .pop.menu'), dialog: !!document.querySelector('.modal.xf') })`);
      ok(`menus ${tag}: a press outside the menu closes the menu, not the dialog`, !po.menu && po.dialog, po);
      // an item, clicked with the mouse where it is drawn: SVG is saved
      if (!dark) {
        await ev('window.__saved.length = 0; 1');
        c = await center('#xfMore'); await click(c[0], c[1]); await sleep(300);
        const it = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .pop.menu .mi')].find((x) => /^SVG/.test(x.textContent.trim())); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
        if (it) await click(it[0], it[1]);
        for (let i = 0; i < 50; i++) { await sleep(200); if (await ev('window.__saved.length > 0')) break; }
        const sv = await ev('window.__saved.map((s) => s.name)');
        ok(`menus ${tag}: a real click on SVG in More formats saves the SVG`, !!it && sv.some((n) => /\.svg$/.test(n)), { it, sv });
      }
      await key('Escape'); await settle(300);
      ok(`menus ${tag}: Esc closes the dialog afterwards`, await ev('!document.querySelector(".modal.xf")'), null);
    }
  }
  }
  await view(1440, 900, false, false);
}

R.logs = logs().filter((l) => /EXC|error/i.test(l.t) && !/404|favicon/.test(l.m)).slice(0, 12);
ok('no exceptions', !R.logs.some((l) => l.t === 'EXC'), R.logs);
return { pass: fails.length === 0, fails, ...R, figs: Object.keys(R.figs).length };
