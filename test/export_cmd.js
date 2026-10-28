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
// Section 5 (notes/export-design/VIDEO-PREVIEW.md): the video preview in the dialog; 5b, the review's findings (vp-1 to
// vp-8). CMW_ONLY=preview runs them alone; CMW_ONLY=1-3, 4 and user5 run sections 1 to 3, section 4 and section 6
// alone, and 4a and 4b the two halves of section 4 (the CI runs it in parts: ci/browser_suites.js).
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

if (process.env.CMW_ONLY !== 'preview' && process.env.CMW_ONLY !== 'user5') { // (CMW_ONLY=preview: section 5 only; CMW_ONLY=user5: section 6 only)
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
// (CMW_ONLY=1-3: sections 1 to 3 alone; CMW_ONLY=4, 4a or 4b: section 4 or its half alone. Section 4 shares only
// build with them)
if (!['4', '4a', '4b'].includes(process.env.CMW_ONLY)) {
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
  // (paths-aesthetics) the paths as vectors: 0.5 pt black lines, a ring per path at z and a dot at F(z), the caption's
  // marks sentence, every start inside the frame (chosen in the figure's own window)
  if (q && p === 'article1') {
    const nr = ((q.svg.match(/class="mf-rings">([\s\S]*?)<\/g>/) || ['', ''])[1].match(/<circle/g) || []).length;
    const ne = ((q.svg.match(/class="mf-ends">([\s\S]*?)<\/g>/) || ['', ''])[1].match(/<circle/g) || []).length;
    ok('paths: vector paths at 0.5 pt with a ring and an end dot each', /stroke-width="0.5"[^>]*class="mf-paths"/.test(q.svg) && nr === q.info.kept && ne > 0 && ne <= q.info.kept && q.info.kept >= 2 && q.info.kept <= 12, { kept: q.info.kept, nr, ne });
    // (Strip to disk is two steps one after another: an arrowhead in the middle of each step and a bar where they meet,
    // no time dots, review fix path-1; most of its paths double back at t = 1 and are left out, so 2 paths can be all)
    ok('paths: the caption names the marks', /Curves are the paths/.test(q.cap) && (/small dots at/.test(q.cap) || /\(the middle of each step\) and a bar at/.test(q.cap)) && /arrowhead at/.test(q.cap), q.cap.slice(-300));
  }
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

} // (CMW_ONLY=4, 4a and 4b skip sections 1 to 3)
if (process.env.CMW_ONLY !== '1-3') {
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
    ok(`${tag}: F is displayed (\\[ \\displaystyle F(z) = ... \\]), not inline`, (ru ? new RegExp(DISP.source.replace(', where|\\. Here', ', где|\\. При этом')) : DISP).test(r.cap) && !/\$F\(z\)=\(e\^\{z\}-1\)/.test(r.cap), r.cap);
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
// (CMW_ONLY=4a: the figures and videos of every view and the Russian captions; 4b: the dialog's videos. 4: both)
if (process.env.CMW_ONLY !== '4b') {
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
      if (r) ok(`r3-paths-${kind}-${p}: one picture with the paths`, r.nImg === 1 && (kind === 'plane' ? /joined by the homotopy|Curves are the paths/.test(r.cap) : /Curves are the paths|The curve is the path/.test(r.cap)), r.cap.slice(0, 400));
      if (r && kind === 'plane') ok(`r3-paths-plane-${p}: X's outline is gray and solid (a dash means "not included")`, !/stroke="#707070"[^>]*stroke-dasharray/.test(r.svg) && !/dashed outline/.test(r.cap), r.cap.slice(0, 400));
      if (r && kind === 'globe') ok(`r3-paths-globe-${p}: a listed point is drawn or said to be hidden`, !/\$(z_0|A)=0\$/.test(r.cap) || /\$(z_0|A)=0\$ is on the far side/.test(r.cap) || (r.info.hidden || []).length === 0, r.cap.slice(0, 700));
      // (review r3 verify2, new-1) a hidden point is not in the list of what the figure shows: only the sentence that
      // says it is on the far side names it
      if (r && kind === 'globe' && (r.info.hidden || []).length) { const shows = ((c) => { const i = c.indexOf('The figure shows'); if (i < 0) return ''; let m = false, q = i; for (; q < c.length; q++) { if (c[q] === '$') m = !m; else if (!m && c[q] === '.' && (q + 1 === c.length || /\s/.test(c[q + 1]))) break; } return c.slice(i, q + 1); })(r.cap); ok(`r3-paths-globe-${p}: the hidden point is not in "The figure shows ..."`, !!shows && !/\$(z_0|A)=0\$/.test(shows) && /\$(z_0|A)=0\$ is on the far side/.test(r.cap), { shows, hidden: r.info.hidden }); }
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
} // (CMW_ONLY=4b skips the figures and the views' videos)
if (process.env.CMW_ONLY !== '4a') {
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
} // (CMW_ONLY=4a skips the dialog's videos)
if (process.env.CMW_ONLY !== '4b') {
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
} // (CMW_ONLY=4b skips the figures, the views' videos and the Russian captions)

} // (CMW_ONLY=1-3 skips section 4)
} // (CMW_ONLY=preview skips sections 1 to 4)

// 5. (2026-10-24, notes/export-design/VIDEO-PREVIEW.md) the video preview: with Format = Video the dialog plays the video
// as it will be saved. It advances by itself at the video's frame rate, its pictures are the saved video's frames at
// the same index (Once, a fade of Loop, Bounce on the globe on its way back), it pauses (button and keyboard), it waits on the poster with reduced
// motion, it restarts on an option change, it stops when the format changes and when the dialog closes, and the page
// keeps its frames while it fills and plays (no task of 50 ms or more; the animation frames on time)
R.pv = {};
if (!['user5', '1-3', '4', '4a', '4b'].includes(process.env.CMW_ONLY)) {
  const pvState = () => ev(`(() => { const d = __cmwFig.dialog(); if (!d || !d.preview) return null; const sk = document.getElementById('xfPvSeek');
    return Object.assign(d.preview.state(), { note: d.preview.note(), poster: !document.querySelector('.xf-poster').hidden, canvas: !document.querySelector('.xf-pvcv').hidden, btn: document.getElementById('xfPvPlay').getAttribute('aria-label'),
      seek: [+sk.value, +sk.max, sk.getAttribute('aria-valuetext')], time: document.querySelector('.xf-pvtime').textContent, hint: document.querySelector('.xf-hint').textContent, stats: __cmwFig.previewStats() }); })()`);
  const until = async (expr, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return Date.now() - t0; await sleep(100); } return -1; };
  const filled = `(() => { const d = __cmwFig.dialog(); const s = d && d.preview && d.preview.state(); return !!(s && s.total > 0 && s.ready === s.total); })()`;
  // (in the page: the preview's picture at timeline index k against the saved video's frame k, decoded, and against the
  // exact render at its t, all at the preview's size; mean abs difference of 255)
  const VS = `async (k) => { const d = __cmwFig.dialog(), s = d.preview.state(), o = Object.assign(d.preview.opts(), { keepForCheck: true, alive: null });
    const r = await __cmwFig.makeVideo(o); const chk = await __cmwFig.videoCheck(k, s.pw, s.ph), pf = await d.preview.frame(k);
    const px = async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = s.pw; c.height = s.ph; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, s.pw, s.ph).data; };
    const mad = (a, b) => { let q = 0; for (let i = 0; i < a.length; i += 4) q += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return +(q / (a.length / 4 * 3)).toFixed(3); };
    const P = await px(pf), D = await px(chk.decoded), X = await px(chk.exact);
    const e = d.preview.entry(k); let blank = 0; { let lo = 255, hi = 0; for (let i = 0; i < P.length; i += 4) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); } blank = hi - lo; }
    return { k, entry: e, frames: r.frames, n: s.n, pw: s.pw, ph: s.ph, madVideo: mad(P, D), madExact: mad(P, X), range: blank, png: pf }; }`;
  await open('xvpv');
  await ev('__cmwExample(1); 1'); await settle(1800);
  await key('m'); await settle(1200);
  await ev('__cmwMorph({ playing: false, T: 1.2 }); 1');
  await key('2'); await settle(1500);
  await ev(`(() => { const s = __cmwFig.settings(); s.fmt = 'video'; s.video = { size: '1280x720', fps: 30, secs: 2, ends: 'once', paths: true, tlabel: true, look: 'light', win: 'screen' }; __cmwFig.saveSettings(s); return 1; })()`);
  // long tasks, and the animation frames (performance.now() in each callback), from the moment the dialog opens
  await ev(`(() => { window.__lt = []; window.__po = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }); window.__po.observe({ entryTypes: ['longtask'] }); window.__rf = []; window.__rfOn = true; (function f() { window.__rf.push(performance.now()); if (window.__rfOn) requestAnimationFrame(f); })(); return 1; })()`);
  const t0 = Date.now();
  await key('e', 4);
  const tPoster = await until(`!!document.querySelector('.xf-poster').getAttribute('src')`, 20000);
  const tMoving = await until(`(() => { const d = __cmwFig.dialog(); const s = d && d.preview && d.preview.state(); return !!(s && s.playing && s.shown && s.i > 0); })()`, 20000);
  // (the animation frames are timed from here: the preview fills and plays; the dialog's own opening is not counted)
  await ev('window.__rf = []; 1');
  // it advances by itself: the index after a second, at the video's frame rate
  const adv = await ev(`await (async () => { const d = __cmwFig.dialog(), a = d.preview.state(), d0 = __cmwFig.previewStats().draws, t = performance.now(); await new Promise((r) => setTimeout(r, 1000)); const b = d.preview.state(); const dt = performance.now() - t; return { i0: a.i, i1: b.i, n: b.n, fps: b.fps, rate: +(((b.i - a.i + b.n) % b.n) / dt * 1000).toFixed(1), draws: __cmwFig.previewStats().draws - d0 }; })()`);
  const tFilled = await until(filled, 40000);
  await sleep(1200);
  const perf = await ev(`(() => { window.__rfOn = false; window.__po.disconnect(); const r = window.__rf, d = []; for (let i = 1; i < r.length; i++) d.push(r[i] - r[i - 1]); const s = d.slice().sort((a, b) => a - b); return { lt: window.__lt, frames: d.length, med: +s[s.length >> 1].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), max: +s[s.length - 1].toFixed(1), over20: d.filter((x) => x > 20).length }; })()`);
  let st = await pvState();
  R.pv.open = { tPoster, tMoving, tFilled: tFilled < 0 ? -1 : tFilled + tMoving, adv, perf, state: st };
  await shot('export-pv-playing-1440');
  ok('preview: the poster shows first, then the video plays in the dialog by itself', tPoster >= 0 && tMoving >= 0 && st.playing && st.canvas && !st.poster && st.btn === 'Pause', R.pv.open);
  ok('preview: it advances at the video\'s frame rate (30 fps: 24 to 36 frames a second), drawing as it goes', adv.rate >= 24 && adv.rate <= 36 && adv.draws >= 15, adv);
  ok('preview: every frame is drawn (the whole timeline, holds and all), the note says at what size', tFilled >= 0 && st.ready === st.total && st.n === 211 && /^Preview: the frames of the video itself/.test(st.note) && /1280 × 720 · 30 fps · 7\.0 s/.test(st.hint), st);
  ok('preview: no main-thread task of 50 ms or more while it fills and plays', !perf.lt.some((d) => d >= 50), perf);
  ok('preview: the animation frames keep time while it fills and plays (median under 18 ms, 95 % under 25 ms, none of 50 ms)', perf.med < 18 && perf.p95 < 25 && perf.max < 50, perf);
  ok('preview: the scrubber follows, with the time and t for a screen reader', st.seek[1] === 210 && /^\d+\.\d s of 7\.0 s, t = \d\.\d\d$/.test(st.seek[2]) && /\/ 7\.0 s/.test(st.time), st);
  // its frames are the saved video's: frame k of the preview against frame k decoded from the MP4 (and the exact render)
  const kOnce = Math.floor(211 * 0.45);
  const m1 = await ev(`await (${VS})(${kOnce})`, 300000);
  if (m1 && m1.png) { fs.writeFileSync(path.join(OUT, 'pv-once-frame.png'), Buffer.from(m1.png.split(',')[1], 'base64')); delete m1.png; }
  R.pv.once = m1;
  ok('preview Once: its frame k is the video\'s frame k (decoded MP4: mean abs difference < 4 of 255; the exact render: < 2)', m1 && m1.frames === m1.n && typeof m1.entry === 'number' && m1.madVideo < 4 && m1.madExact < 2 && m1.range > 100, m1);
  // pause: the button, then the keyboard on the scrubber (one frame, the end) and on the button
  await clickSel('#xfPvPlay'); await sleep(150);
  const p0 = await pvState(); await sleep(700); const p1 = await pvState();
  ok('preview: Pause stops it (the index and the picture stay), the button says Play', !p0.playing && p1.i === p0.i && p1.stats.draws === p0.stats.draws && p1.btn === 'Play', { p0, p1 });
  await ev(`document.getElementById('xfPvSeek').focus(); 1`);
  await key('ArrowRight'); await sleep(100); const k1 = await pvState();
  // (End and Home are not in the kit's key table: raw key events)
  const navKey = async (k, vk) => { await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: vk }); };
  await navKey('End', 35); await sleep(100); const k2 = await pvState();
  await navKey('Home', 36); await sleep(100); const k3 = await pvState();
  ok('preview: the scrubber takes the keyboard (Right: one frame on; End; Home), paused', k1.i === p1.i + 1 && !k1.playing && k2.i === 210 && k3.i === 0 && k3.seek[0] === 0, { p1: p1.i, k1: k1.i, k2: k2.i, k3: k3.i });
  await ev(`document.getElementById('xfPvPlay').focus(); 1`); await key(' '); await sleep(600);
  const k4 = await pvState();
  ok('preview: Space on the button plays again', k4.playing && k4.i > 0 && k4.btn === 'Pause', k4);
  // Save video: the preview keeps its frames and keeps playing (after the save, and after the button's "Saved" ends)
  const sv0 = await pvState();
  await ev('window.__saved.length = 0; 1');
  await clickSel('#xfVideo');
  const svMs = await until('window.__saved.length > 0', 90000); await sleep(3200);
  const sv1 = await pvState();
  ok('preview: Save video leaves it be (the same frames, not drawn again; still playing)', svMs >= 0 && sv1.id === sv0.id && sv1.stats.renders === sv0.stats.renders && sv1.playing && sv1.canvas, { svMs, sv0: [sv0.id, sv0.stats], sv1: [sv1.id, sv1.stats, sv1.playing] });
  // Loop: a fade frame of the preview against the video's
  const id0 = k4.id;
  await clickSel('#xfVEnds button[data-v="loop"]');
  await until(`(() => { const d = __cmwFig.dialog(); const s = d && d.preview && d.preview.state(); return !!(s && s.id > ${id0}); })()`, 20000);
  st = await pvState();
  ok('preview: an option change starts it again with the new frames (one preview alive)', st.id > id0 && st.stats.live === 1 && st.n > 211, st);
  await until(filled, 60000);
  const kFade = await ev(`(() => { const d = __cmwFig.dialog(); for (let i = 0; i < d.preview.state().n; i++) { const e = d.preview.entry(i); if (e && typeof e === 'object' && e.k > 0.4) return i; } return -1; })()`);
  const m2 = await ev(`await (${VS})(${kFade})`, 300000);
  if (m2 && m2.png) { fs.writeFileSync(path.join(OUT, 'pv-loop-fade-frame.png'), Buffer.from(m2.png.split(',')[1], 'base64')); delete m2.png; }
  R.pv.loop = m2;
  ok('preview Loop: a fade frame is the video\'s fade frame (decoded MP4: < 4 of 255; the exact blend: < 2)', m2 && m2.frames === m2.n && m2.entry && typeof m2.entry === 'object' && m2.madVideo < 4 && m2.madExact < 2, m2);
  await clickSel('#xfVEnds button[data-v="once"]'); await sleep(400);
  // the format changes: the preview stops; back to Video: it starts again
  await clickSel('#xfFmt button[data-v="pdf"]'); await sleep(300);
  const f0 = await ev('__cmwFig.previewStats()'); await sleep(800); const f1 = await ev('__cmwFig.previewStats()');
  ok('preview: Format PDF stops it (nothing alive, nothing drawn)', f0.live === 0 && f1.renders === f0.renders && f1.draws === f0.draws, { f0, f1 });
  await clickSel('#xfFmt button[data-v="video"]');
  const back = await until(`(() => { const d = __cmwFig.dialog(); const s = d && d.preview && d.preview.state(); return !!(s && s.playing && s.shown); })()`, 20000);
  ok('preview: back on Video it plays again', back >= 0, back);
  // the dialog closes: the preview stops
  await key('Escape'); await sleep(300);
  const c0 = await ev('__cmwFig.previewStats()'); await sleep(900); const c1 = await ev('__cmwFig.previewStats()');
  R.pv.close = { c0, c1 };
  ok('preview: closing the dialog stops it (nothing alive; no frame drawn or shown after)', c0.live === 0 && c1.live === 0 && c1.renders === c0.renders && c1.draws === c0.draws && !(await ev(`!!document.querySelector('.xf-pvcv')`)), R.pv.close);
  // Bounce on the globe (X -> Y on the sphere): a frame on the way back is the video's frame
  await key('1'); await settle(300); await ev(`__cmwSetView('R', 'sphere'); 1`); await settle(800);
  await ev(`(() => { const s = __cmwFig.settings(); s.fmt = 'video'; s.video = Object.assign({}, s.video, { size: '1280x720', fps: 30, secs: 2, ends: 'bounce' }); __cmwFig.saveSettings(s); return 1; })()`);
  await key('e', 4);
  const gb = await until(filled, 60000);
  const kBack = await ev(`(() => { const d = __cmwFig.dialog(), n = d.preview.state().n; return Math.floor(n * 0.7); })()`);
  const m3 = await ev(`await (${VS})(${kBack})`, 300000);
  if (m3 && m3.png) { fs.writeFileSync(path.join(OUT, 'pv-globe-bounce-frame.png'), Buffer.from(m3.png.split(',')[1], 'base64')); delete m3.png; }
  R.pv.globeBounce = Object.assign({ filledMs: gb }, m3);
  ok('preview Bounce on the globe: a frame on the way back is the video\'s frame (decoded MP4: < 4 of 255; the exact render: < 2)', gb >= 0 && m3 && m3.frames === m3.n && typeof m3.entry === 'number' && m3.madVideo < 4 && m3.madExact < 2 && m3.range > 100, R.pv.globeBounce);
  await key('Escape'); await sleep(300);
  // reduced motion: paused on the poster frame (the screen's t), with Play; Play plays it
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await key('e', 4);
  await until(`(() => { const d = __cmwFig.dialog(); const s = d && d.preview && d.preview.state(); return !!(s && s.n > 0 && s.ready >= 1); })()`, 20000);
  const r0 = await pvState(); await sleep(800); const r1 = await pvState();
  const rt = await ev(`(() => { const d = __cmwFig.dialog(); return d.preview.entry(d.preview.state().i); })()`);
  await shot('export-pv-reduced-1440');
  R.pv.reduced = { r0, r1, rt };
  ok('preview, reduced motion: paused on the poster frame (t = 1.2), Play offered, the note says why', !r0.playing && r0.poster && !r0.canvas && r0.btn === 'Play' && r1.i === r0.i && Math.abs(rt - 1.2) < 0.05 && /reduced motion is on/.test(r0.note), R.pv.reduced);
  await clickSel('#xfPvPlay');
  await until(`(() => { const s = __cmwFig.dialog().preview.state(); return s.playing && s.shown; })()`, 5000); await sleep(600);
  const r2 = await pvState();
  ok('preview, reduced motion: Play plays it', r2.playing && r2.canvas && !r2.poster && r2.i !== r1.i, r2);
  await key('Escape'); await sleep(300);
  await view(1440, 900, false, false);
}

// 5b. (notes/export-design/review-video-preview.json, vp-1 to vp-8) the kept frames follow the screen (DPR 1 and 2, a
// 60 fps Loop beyond the memory for plain frames: compressed, still the video's frames), the start at the poster's
// frame, the button and the scrubber during a restart, a bigger window, reduced motion drawing only what is seen, the
// scrubber quiet for a screen reader while it plays, a hidden page, a small device
R.pv2 = {};
if (!['user5', '1-3', '4', '4a', '4b'].includes(process.env.CMW_ONLY)) {
  const pvState = () => ev(`(() => { const d = __cmwFig.dialog(); if (!d || !d.preview) return null; const sk = document.getElementById('xfPvSeek'), cv = document.querySelector('.xf-pvcv');
    return Object.assign(d.preview.state(), { note: d.preview.note(), poster: !document.querySelector('.xf-poster').hidden, canvas: !cv.hidden, cssW: Math.round(cv.getBoundingClientRect().width || parseFloat(cv.style.width) || 0), dpr: devicePixelRatio, btn: document.getElementById('xfPvPlay').getAttribute('aria-label'),
      seek: [+sk.value, +sk.max, sk.getAttribute('aria-valuetext')], time: document.querySelector('.xf-pvtime').textContent, stats: __cmwFig.previewStats() }); })()`);
  const until = async (expr, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return Date.now() - t0; await sleep(100); } return -1; };
  const shownE = `(() => { const d = __cmwFig.dialog(); const s = d && d.preview && d.preview.state(); return !!(s && s.id && s.shown); })()`;
  const VS = `async (k) => { const d = __cmwFig.dialog(), s = d.preview.state(), o = Object.assign(d.preview.opts(), { keepForCheck: true, alive: null });
    const r = await __cmwFig.makeVideo(o); const chk = await __cmwFig.videoCheck(k, s.pw, s.ph), pf = await d.preview.frame(k);
    const px = async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = s.pw; c.height = s.ph; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, s.pw, s.ph).data; };
    const mad = (a, b) => { let q = 0; for (let i = 0; i < a.length; i += 4) q += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return +(q / (a.length / 4 * 3)).toFixed(3); };
    const P = await px(pf), D = await px(chk.decoded), X = await px(chk.exact);
    return { k, entry: d.preview.entry(k), frames: r.frames, n: s.n, pw: s.pw, ph: s.ph, madVideo: mad(P, D), madExact: mad(P, X), png: pf }; }`;
  // long tasks and animation frames over a window
  const perfOn = () => ev(`(() => { window.__lt2 = []; if (window.__po2) window.__po2.disconnect(); window.__po2 = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt2.push(Math.round(e.duration)); }); window.__po2.observe({ entryTypes: ['longtask'] }); window.__rf2 = []; window.__rf2On = true; (function f() { window.__rf2.push(performance.now()); if (window.__rf2On) requestAnimationFrame(f); })(); return 1; })()`);
  const perfOff = () => ev(`(() => { window.__rf2On = false; const f = window.__rf2, d = []; for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]); d.sort((a, b) => a - b); const q = (p) => +(d[Math.min(d.length - 1, Math.floor(p * d.length))] || 0).toFixed(1); return { lt: window.__lt2.slice(), frames: d.length, med: q(0.5), p95: q(0.95), max: q(1) }; })()`);
  const rate = () => ev(`await (async () => { const d = __cmwFig.dialog(), a = d.preview.state(), t = performance.now(); await new Promise((r) => setTimeout(r, 1000)); const b = d.preview.state(); const dt = performance.now() - t; return +(((b.i - a.i + b.n) % b.n) / dt * 1000).toFixed(1); })()`);
  const setV = (v) => ev(`(() => { const s = __cmwFig.settings(); s.fmt = 'video'; s.video = Object.assign({ size: '1920x1080', fps: 30, secs: 3, ends: 'once', paths: true, tlabel: true, look: 'light', win: 'screen' }, ${JSON.stringify(v)}); __cmwFig.saveSettings(s); return 1; })()`);
  const scene = async (ns, w, h) => { await open(ns, w, h); await ev('__cmwExample(1); 1'); await settle(1800); await key('m'); await settle(1200); await ev('__cmwMorph({ playing: false, T: 1.2 }); 1'); await key('2'); await settle(1500); };
  const firstShownOn = () => ev(`(() => { window.__fs = null; (function f() { const d = __cmwFig.dialog(); const s = d && d.preview && d.preview.state(); if (s && s.id && s.shown) { const e = d.preview.entry(s.i); window.__fs = { i: s.i, t: typeof e === 'number' ? e : e && e.a }; return; } requestAnimationFrame(f); })(); return 1; })()`);

  // (a) DPR 2, the default options (1920 x 1080, 30 fps, 3 s, Once): kept at the shown size in device pixels, which is
  // more than plain frames may take, so compressed; the first picture is the poster's frame; frame k is the video's
  await scene('xvpb', 1440, 900);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false }); await settle(400);
  await setV({});
  await firstShownOn();
  await key('e', 4);
  // (the animation frames are timed once the preview shows: it fills and plays; the dialog's opening is not counted)
  await until(shownE, 20000); await perfOn(); await sleep(2500);
  let a = await pvState(); const pa = await perfOff(), fs0 = await ev('window.__fs'), ra = await rate();
  R.pv2.dpr2 = { a, pa, fs0, ra };
  ok('preview DPR 2 (vp-1): frames kept at the shown size in device pixels (not below it), compressed, the note says the video is 1920 × 1080', a.dpr === 2 && a.pw >= Math.min(1920, a.cssW * 2) - 2 && a.raw === false && /^image\/(webp|jpeg)$/.test(a.mime) && a.hot <= 40, R.pv2.dpr2);
  ok('preview (vp-4): the first picture is the poster\'s frame (t = 1.2), not t = 0', fs0 && Math.abs(fs0.t - 1.2) < 0.15, fs0);
  ok('preview DPR 2: plays at 30 fps from compressed frames, no task of 50 ms, frames on time', ra >= 24 && ra <= 36 && !pa.lt.some((d) => d >= 50) && pa.p95 < 25 && pa.max < 50, { ra, pa });
  await until(`(() => { const s = __cmwFig.dialog().preview.state(); return s.ready === s.total; })()`, 90000); await sleep(400);
  const an = await ev('__cmwFig.dialog().preview.note()');
  ok('preview DPR 2: filled, the note says the frames are scaled and compressed, and that the video is 1920 × 1080', /^Preview: the frames of the video itself, scaled to fit here and lightly compressed \(the video is 1920 × 1080\)$/.test(an), an);
  const kq = await ev(`(() => { const d = __cmwFig.dialog(), n = d.preview.state().n; for (let i = Math.floor(n * 0.45); i < n; i++) if (typeof d.preview.entry(i) === 'number') return i; return 0; })()`);
  const m = await ev(`await (${VS})(${kq})`, 300000);
  if (m && m.png) { fs.writeFileSync(path.join(OUT, 'pv-dpr2-compressed-frame.png'), Buffer.from(m.png.split(',')[1], 'base64')); delete m.png; }
  R.pv2.dpr2match = m;
  ok('preview DPR 2, compressed: frame k is the video\'s frame k (decoded MP4: < 4 of 255; the exact render: < 2)', m && m.frames === m.n && m.pw >= 1480 && m.madVideo < 4 && m.madExact < 2, m);
  await key('Escape'); await sleep(300);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await settle(300);

  // (b) 60 fps, 6 s per step, Loop (721 different frames): kept at the shown size, compressed; plays at 60 fps while it
  // fills; a hidden page draws nothing (vp-7)
  await setV({ fps: 60, secs: 6, ends: 'loop', look: 'print' });
  await key('e', 4);
  await until(shownE, 20000); await perfOn(); await sleep(2000);
  const b = await pvState(), rb = await rate(), pb = await perfOff();
  R.pv2.loop60 = { b, rb, pb };
  ok('preview 60 fps Loop (vp-1, vp-8): 721 frames kept at the shown size (743 px, not 344), compressed', b.total === 721 && b.pw >= Math.min(1920, b.cssW) - 2 && b.pw >= 700 && b.raw === false, b);
  ok('preview 60 fps Loop: plays at 60 fps while it fills (48 to 66 a second), no task of 50 ms, frames on time', rb >= 48 && rb <= 66 && !pb.lt.some((d) => d >= 50) && pb.p95 < 25 && pb.max < 50, { rb, pb });
  await ev(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); return 1; })()`);
  await sleep(300); const h0 = await ev('__cmwFig.previewStats().renders'); await sleep(900); const h1 = await ev('__cmwFig.previewStats().renders');
  await ev(`(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); return 1; })()`);
  await sleep(900); const h2 = await ev('__cmwFig.previewStats().renders');
  R.pv2.hidden = { h0, h1, h2 };
  ok('preview (vp-7): a hidden page draws no frames; shown again, the drawing goes on', h1 === h0 && h2 > h1, R.pv2.hidden);
  await key('Escape'); await sleep(300);

  // (c) a restart after an option change (vp-2): Pause, change the ends, Play during the restart: the wish holds
  await setV({ size: '1280x720', secs: 2 });
  await key('e', 4);
  await until(shownE, 20000); await sleep(500);
  await clickSel('#xfPvPlay'); await sleep(100);
  const id1 = (await pvState()).id;
  await clickSel('#xfVEnds button[data-v="bounce"]'); await sleep(40);
  const c0 = await pvState();
  await clickSel('#xfPvPlay'); await sleep(30);
  const c1 = await pvState();
  await until(`(() => { const s = __cmwFig.dialog().preview.state(); return s.id > ${id1} && s.shown; })()`, 20000); await sleep(300);
  const c2 = await pvState();
  R.pv2.restart = { c0, c1, c2 };
  ok('preview (vp-2): during a restart the bar is cleared and the button shows the wish; Play there is kept', c0.id === 0 && c0.btn === 'Play' && c0.seek[1] === 0 && c0.time === '' && /drawing the frames, 0 %/.test(c0.note) && c1.btn === 'Pause' && c2.id > id1 && c2.playing && c2.btn === 'Pause', R.pv2.restart);
  // (vp-1/vp-2 residual, review-video-preview-verify; v15.1 assembly) a restart while paused shows the new run's own
  // frames, not the 960 px poster, and stays paused; then Play again for (vp-6)
  await clickSel('#xfPvPlay'); await sleep(100);
  const id2 = (await pvState()).id;
  await clickSel('#xfVEnds button[data-v="loop"]'); await sleep(40);
  const tp = await until(`(() => { const s = __cmwFig.dialog().preview.state(); return s.id > ${id2} && s.shown; })()`, 20000); await sleep(200);
  const c3 = await pvState();
  R.pv2.pausedRestart = { tp, c3: { id: c3.id, shown: c3.shown, playing: c3.playing, canvas: c3.canvas, poster: c3.poster, btn: c3.btn, pw: c3.pw } };
  ok('preview (vp-2 residual): a restart while paused shows its own frames, not the poster, and stays paused', tp >= 0 && c3.shown && c3.canvas && !c3.poster && !c3.playing && c3.btn === 'Play', R.pv2.pausedRestart);
  await clickSel('#xfPvPlay'); await until(`__cmwFig.dialog().preview.state().playing`, 5000); await sleep(300);
  // (vp-6) the scrubber with focus stands still for a screen reader while the video plays; a key moves from the frame in view
  await ev(`document.getElementById('xfPvSeek').focus(); 1`); await sleep(150);
  const f0 = await pvState(); await sleep(1300); const f1 = await pvState();
  await key('ArrowRight'); await sleep(150); const f2 = await pvState();
  R.pv2.focus = { f0: [f0.i, f0.seek], f1: [f1.i, f1.seek], f2: [f2.i, f2.seek, f2.playing] };
  ok('preview (vp-6): while it plays, the focused scrubber and its text stay still; Right steps from the frame in view and pauses', f0.playing && f1.playing && f1.i !== f0.i && f1.seek[0] === f0.seek[0] && f1.seek[2] === f0.seek[2] && !f2.playing && Math.abs(f2.i - f1.i) <= 12 && f2.seek[0] === f2.i, R.pv2.focus);
  await key('Escape'); await sleep(300);

  // (d) a bigger window (vp-3): opened at 390 px, then 1440 px: drawn again at the new size, same play state
  await view(390, 844, false, true); await settle(500);
  await key('e', 4);
  await until(shownE, 20000); await sleep(600);
  const d0 = await pvState();
  await view(1440, 900, false, false); await sleep(250);
  const d1 = await pvState(); await sleep(900); const d2 = await pvState();
  R.pv2.resize = { d0, d1, d2 };
  ok('preview (vp-3): a bigger window draws the frames again at its size, the picture stays in view, the play state holds', d2.id > d0.id && d2.pw >= Math.min(1280, d2.cssW) - 2 && d2.pw > d0.pw * 1.25 && d1.canvas && d2.canvas && d2.playing === d0.playing && d2.stats.live === 1, { d0: [d0.id, d0.pw, d0.cssW, d0.playing], d1: [d1.id, d1.canvas], d2: [d2.id, d2.pw, d2.cssW, d2.playing, d2.note] });
  await key('Escape'); await sleep(300);

  // (e) reduced motion (vp-5): only the frame in view is drawn until Play; a scrub draws its frames and the note stops
  // asking for Play; Play draws them all
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await key('e', 4);
  await until(`(() => { const d = __cmwFig.dialog(); const s = d && d.preview && d.preview.state(); return !!(s && s.id && s.ready >= 1); })()`, 20000); await sleep(1500);
  const e0 = await pvState();
  await ev(`document.getElementById('xfPvSeek').focus(); 1`); await key('ArrowRight'); await sleep(400);
  const e1 = await pvState();
  await clickSel('#xfPvPlay'); await until(`(() => { const s = __cmwFig.dialog().preview.state(); return s.ready === s.total; })()`, 30000);
  const e2 = await pvState();
  R.pv2.reduced = { e0, e1, e2 };
  ok('preview, reduced motion (vp-5): only the frame in view is drawn; a scrub draws its frames and the note drops "Press Play"; Play draws them all', e0.lazy && e0.ready === 1 && !e0.canvas && /Press Play/.test(e0.note) && e1.canvas && e1.ready <= 7 && !/Press Play/.test(e1.note) && e2.ready === e2.total && e2.playing, { e0: [e0.ready, e0.note], e1: [e1.ready, e1.note], e2: [e2.ready, e2.total, e2.playing] });
  await key('Escape'); await sleep(300);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // (f) a device with 4 GB or less (vp-7): plain frames get 64 MB, so 121 frames of 743 x 418 (150 MB) are compressed
  await ev(`(() => { Object.defineProperty(Navigator.prototype, 'deviceMemory', { configurable: true, get: () => 2 }); return 1; })()`);
  await key('e', 4);
  await until(shownE, 20000); await sleep(300);
  const g0 = await pvState();
  R.pv2.lowmem = g0;
  ok('preview (vp-7): with 4 GB or less, a timeline that fits 192 MB but not 64 MB is kept compressed', g0.raw === false && g0.total === 121, g0);
  await key('Escape'); await sleep(300);
  await view(1440, 900, false, false);
}

// 6. (v16.1, the user's requests 4 and 5, notes/v16-user5/AS-BUILT-export.md; CMW_ONLY=user5 runs it alone)
// (a) the Landscape with All sheets says exactly which sheets it draws, in the LaTeX caption (English and Russian),
// the figure's own caption and the pane title: both / all n sheets for a finite covering, the window of infinitely
// many (log, z^i) or of N (a 30th root), n of the infinitely many for several pieces, K of the total combinations when
// capped; never "all sheets of the Riemann surface". While deforming (the merge with work/xvsh) the landscape draws H_t
// on the sheets that become F's: the clause says so, exactly.
// (b) the Export figure dialog's menus (More formats, Size) open over the dialog, inside the viewport, take the focus,
// move with the arrows, close with Esc (the dialog stays) and with a press outside (the dialog stays); an item works
// with a real click. At 1440 and 390 px (phone), light and dark.
if (!['preview', '1-3', '4', '4a', '4b'].includes(process.env.CMW_ONLY)) {
  R.u5 = { caps: {}, menus: {} };
  // (as the daemon's load(): the state is written from another page of the origin, so the app cannot save over it)
  const loadSt = async (ns, st) => {
    await nav(`${BASE}gl-helpers.html`);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(Object.assign({ v3: true, v4: true, nextId: 50, focus: 0 }, st)))}); 1`);
    await nav(`${BASE}test.html?ns=${ns}`); await settle(1500);
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
  for (const [nm, steps, en, ru, title] of CASES) {
    await loadSt(`u5s${nm}${Date.now()}`, { steps, rightMode: '3d', sheets: true, height: 'im', shapes: disc });
    const t = await ev(`(() => { const e = document.querySelector('.prole .rf') || document.querySelector('.prole'); return e ? e.textContent : null; })()`);
    const fmts = nm === 'log' || nm === 'capped' || nm === 'logsqrt' ? ['pdf', 'tex'] : [];
    const e = await build(`u5-sheets-${nm}-article1`, { for: 'article' }, fmts);
    const r = await build(`u5-sheets-ru-${nm}-article1`, { for: 'article', lang: 'ru' }, fmts);
    // (the figure's own caption: the PNG for Docs, set from the same template)
    const own = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'homework', capInImage: true }); return f ? f.boxes.filter((b) => b.kind === 'caption').map((b) => b.tex || b.text || '').join(' ') : null; })()`, 120000);
    R.u5.caps[nm] = { title: t, en: e && e.cap.slice(-200), ru: r && r.cap.slice(-200) };
    ok(`sheets ${nm}: the English caption says which sheets`, e && en.test(e.cap) && !OLD.test(e.cap), e && e.cap.slice(-260));
    ok(`sheets ${nm}: the Russian caption says which sheets`, r && ru.test(r.cap) && !OLD.test(r.cap), r && r.cap.slice(-260));
    ok(`sheets ${nm}: the Landscape title says which sheets`, title.test(t || ''), t);
    ok(`sheets ${nm}: the figure's own caption has no "all sheets"`, own != null && !OLD.test(own), own && own.slice(-200));
    if (nm === 'log') {
      ok('sheets log: the Russian display writes the multivalued Ln (GLOSSARY 2.2)', r && /\\operatorname\{Ln\} z/.test(r.cap) && !/\\ln z/.test(r.cap), r && r.cap.slice(0, 260));
      ok('sheets log: the English display keeps log', e && /F\(z\)=\\log z/.test(e.cap), e && e.cap.slice(0, 200));
      await build('u5-sheets-log-homework', { for: 'homework' }, ['pdf', 'tex']);
      await build('u5-sheets-ru-log-homework', { for: 'homework', lang: 'ru' }, ['pdf', 'tex']);
    }
  }
  // the deformation on: the landscape draws H_t on the sheets that become F's (work/xvsh), so the clause names them
  // (both of √z's), with no Ln (the map is H_t) and never "all sheets of the Riemann surface"
  await loadSt(`u5smorph${Date.now()}`, { steps: [RT(2)], rightMode: '3d', sheets: true, height: 'im', shapes: disc });
  await key('m'); await settle(2000);
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
  await key('m'); await settle(600);
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
  // (v16.1 review math-6) √ then z²: F = z is single-valued, so All sheets draws one surface and says nothing of sheets
  await loadSt(`u5ssv${Date.now()}`, { steps: [RT(2), { type: 'powa', params: { alpha: '2', cut: 180, k: 0 } }], rightMode: '3d', sheets: true, height: 'im', shapes: disc });
  const sv = await ev('__cmwLandSheets()'), se = await build('u5-sheets-single-article1', { for: 'article' }, []);
  R.u5.caps.single = { ls: sv, en: se && se.cap.slice(-300) };
  ok('sheets, √ then z²: one surface, no sheets in the title or the caption', sv && !sv.drawn && !sv.shown && !/sheet/.test(sv.title) && se && !/sheet/.test(se.cap), R.u5.caps.single);
  // (b) the dialog's menus
  const MP = `(() => { const p = document.querySelector('#popHost .pop.menu'), m = document.querySelector('.modal.xf'); if (!p) return { open: false, dialog: !!m };
    const r = p.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), e2 = document.elementFromPoint(r.left + 8, r.top + 8);
    return { open: true, dialog: !!m, rect: [r.left, r.top, r.width, r.height].map(Math.round), z: +getComputedStyle(p).zIndex, zm: +getComputedStyle(document.querySelector('.modal-bg')).zIndex,
      onTop: !!(e && p.contains(e)) && !!(e2 && p.contains(e2)), hit: [e, e2].map((x) => x && (x.tagName + '.' + String(x.className).slice(0, 30) + '#' + x.id)), inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, focus: p.contains(document.activeElement) ? document.activeElement.textContent.trim() : null }; })()`;
  const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.hidden) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
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
  await view(1440, 900, false, false);
}

R.logs = logs().filter((l) => /EXC|error/i.test(l.t) && !/404|favicon/.test(l.m)).slice(0, 12);
ok('no exceptions', !R.logs.some((l) => l.t === 'EXC'), R.logs);
return { pass: fails.length === 0, fails, ...R, figs: Object.keys(R.figs).length };
