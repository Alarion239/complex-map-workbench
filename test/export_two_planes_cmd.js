// The steps view's export Picture "Two planes": plane From and plane To of the thread side by side, each headed by its
// name, with the arrow of the map between them named over it. Each panel is the Shown plane export of its plane: on
// the camera's window (Crop: As on screen) its picture is the one Figure.build({}) makes with that plane shown. The
// arrow's label is the steps view's own name for the map (F, f_2, f_2∘f_1), real text in the SVG; the caption names the
// two planes and the map; From and To outside the thread are clamped, To after From. With cross axes a plane's name and its
// axes' names meet nothing and stay inside the figure, also where a panel's imaginary axis stands at its left edge.
// A command file for a CDP daemon:  <runner> test/export_two_planes_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
await load('xtp' + Date.now(), {});
const base = await ev('location.origin');
// the images of a figure's SVG, each as a GX x GY grid of RGB means (base64), so two figures' pictures can be compared
const GX = 48, GY = 32;
// a box or the key's right edge may overshoot the figure's size by this much (SVG units) to count as inside it
const FIT_SLACK = 0.01;
// pt a label's text may sit from its glyph box (position, width, and the box's top and bottom)
const GLYPH_SLACK_PT = 2;
// ms for the page to settle and for a figure build plus its PDF
const BUILD_TIMEOUT_MS = 120000;
const PAGE_GRID = `window.__grid = async (svg) => { const out = [], re = /<image\\b[^>]*?(?:xlink:)?href="(data:image\\/[^"]+)"/g; let m;
  while ((m = re.exec(svg))) { const im = new Image(); im.src = m[1]; await im.decode(); const cv = document.createElement('canvas'); cv.width = ${GX}; cv.height = ${GY};
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0, ${GX}, ${GY}); out.push(Array.from(g.getImageData(0, 0, ${GX}, ${GY}).data).filter((v, i) => i % 4 < 3)); }
  return out; }; 1`;
const SPEC = { 'F': 'F', 'f_{2}': 'f₂', '\\sqrt{z}': '√z', '\\sqrt{z+1}': '√(z+1)', '\\sqrt[3]{z}': '³√z', '\\sqrt[n]{z}': 'ⁿ√z', '\\sqrt2': '√2', '\\frac{1}{z^{2}}': '1/z^2', '\\frac{1}{e^{-z}+1}': '1/(e^-z+1)', '\\frac{1}{\\sqrt{z}}': '1/√z', '\\frac{\\pi}{2}': 'π/2', 'f_{1}': 'f₁' };
const build = async (opts) => {
  await ev(`window.__xtp = null; (async () => { const f = await Figure.build(${JSON.stringify(opts)}); if (!f) return { none: true };
    return { svg: f.svg, cap: String(f.captionTex || ''), view: f.view, info: f.info && { svTwo: f.info.svTwo, from: f.info.from, to: f.info.to, arrow: f.info.arrow, frames: f.info.frames && f.info.frames.map((q) => q.name), ownWin: f.info.ownWin, keyLine: f.info.keyLine, W: f.W, keyR: Math.max(0, ...f.boxes.filter((b) => b.kind === 'key' || b.kind === 'ring-mark').map((b) => b.x1)), boxes: f.info.boxes } }; })().then((r) => { window.__xtp = r; }, (e) => { window.__xtp = { err: String(e) }; }); 1`);
  await settled({ until: 'window.__xtp != null', max: BUILD_TIMEOUT_MS, panes: false });
  return ev('window.__xtp');
};
const grids = async (svg) => { await ev(PAGE_GRID); await ev(`window.__xtpg = null; window.__grid(${JSON.stringify(svg)}).then((g) => { window.__xtpg = g; }); 1`); await settled({ until: 'window.__xtpg != null', max: 30000, panes: false }); return ev('window.__xtpg'); };
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
const ready = async (ex, lang) => {
  await go(`${base}/test.html?view=steps&ns=xtp${ex}${Date.now() % 1e7}${lang ? `&lang=${lang}` : ''}`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
  await ev(`(__cmwExample(${ex}), __cmwSet('wKey', false), 1)`);
  await settled({ until: '__cmwSteps().planes.length > 1', max: 15000 });
};

// example 1: z, w₁, w₂
await ready(1);
const planes = await ev('__cmwSteps().planes.length');
ok('example 1 has three planes', planes === 3, planes);
const CASES = [
  { opts: {}, from: 0, to: 2, arrow: 'F', names: ['z', 'w_{2}'] },
  { opts: { svFrom: 1, svTo: 2 }, from: 1, to: 2, arrow: 'f_{2}', names: ['w_{1}', 'w_{2}'] },
  { opts: { svFrom: 0, svTo: 1 }, from: 0, to: 1, arrow: 'f_{1}', names: ['z', 'w_{1}'] },
  { opts: { svFrom: 2, svTo: 1 }, from: 1, to: 2, arrow: 'f_{2}', names: ['w_{1}', 'w_{2}'], clamp: true },
];
for (const c of CASES) {
  const tag = `from ${c.opts.svFrom ?? 'default'} to ${c.opts.svTo ?? 'default'}`;
  const r = await build(Object.assign({ svPic: 'two', crop: 'screen' }, c.opts));
  ok(`${tag}: a two-plane figure`, r && !r.err && !r.none && r.view === 'svTwo' && r.info && r.info.svTwo, r && (r.err || r.view));
  if (!r || !r.info) continue;
  ok(`${tag}: the planes ${c.names.join(' and ')}`, JSON.stringify(r.info.frames) === JSON.stringify(c.names) && r.info.from === c.from && r.info.to === c.to, r.info);
  ok(`${tag}: the arrow's label is ${c.arrow}`, r.info.arrow === c.arrow, r.info.arrow);
  ok(`${tag}: the caption names the planes and the map`, /joined by/.test(r.cap) && r.cap.includes(`$${c.arrow}$`) && c.names.every((n) => r.cap.includes(`$${n}$`)), r.cap);
  const plain = (n) => n.replace(/_\{(\d)\}/, (m, d) => '₀₁₂₃₄₅₆₇₈₉'[+d]);
  ok(`${tag}: the SVG has two pictures and a title that names the planes and the map`, (r.svg.match(/<image\b/g) || []).length === 2 && r.svg.includes(`<title>${plain(c.names[0])} and ${plain(c.names[1])}, joined by ${SPEC[c.arrow]}</title>`), { images: (r.svg.match(/<image\b/g) || []).length, title: (/<title>[^<]*<\/title>/.exec(r.svg) || [])[0] });
  ok(`${tag}: the SVG's desc is the caption's sentence`, r.svg.includes(`<desc>The planes ${plain(c.names[0])} and ${plain(c.names[1])}, joined by ${SPEC[c.arrow]}.</desc>`), (/<desc>[^<]*<\/desc>/.exec(r.svg) || [])[0]);
  if (c.clamp) continue;
  // each panel is the Shown plane export of its plane (the camera's window)
  const g2 = await grids(r.svg);
  for (const [k, plane] of [[0, c.from], [1, c.to]]) {
    await ev(`(__cmwSteps({ go: ${plane}, now: true }), 1)`);
    await settled({ until: `__cmwSteps().i === ${plane} && !__cmwSteps().moving`, max: 15000 });
    const one = await build({ crop: 'screen', axes: 'none' });
    const g1 = one && one.svg ? await grids(one.svg) : [];
    const d = g1[0] && g2[k] ? diff(g1[0], g2[k]) : null;
    ok(`${tag}: panel ${k} is plane ${plane}'s Shown plane picture (mean difference under 14 of 255)`, d != null && d < 14, d);
    info[`${tag} panel ${k}`] = d;
  }
}

// a To plane other than the colour plane, before it as well as past it, brings the pane's key: the hue ring and the line saying
// where the colour is carried from, in a column right of the second picture, inside the figure; a To plane that is the colour plane
// (T at that plane, where it is coloured by its own map) has none
const nPlanes = planes;
for (const [T, to] of [[0, 1], [0, 2], [nPlanes - 1, 1], [nPlanes - 1, 2]]) {
  await ev(`(__cmwSteps({ T: ${T} }), __cmwSteps({ go: ${to}, now: true }), 1)`);
  await settled({ until: `__cmwSteps().i === ${to} && !__cmwSteps().moving && __cmwSteps().T === ${T}`, max: 15000 });
  const wk = await evJson(`JSON.stringify(__cmwFig.svKey(${to}))`);
  const r = await build({ svPic: 'two', crop: 'screen', svFrom: 0, svTo: to });
  const carried = wk && wk.carried ? wk.carried.text : null;
  const tag = `T ${T}, to plane ${to}`;
  ok(`${tag}: the figure's key line is ${carried ? 'the pane\'s' : 'absent'}`, r && r.info && (r.info.keyLine || null) === carried, { carried, got: r && r.info && r.info.keyLine });
  // (the ring is the key's group of sectors, <g id="…-key">)
  ok(`${tag}: the ring is ${carried ? 'drawn' : 'absent'}`, r && !!r.svg && /<g id="[^"]*-key"><path\b/.test(r.svg) === !!carried, null);
  info[`key ${tag}`] = carried;
  ok(`${tag}: a carried key is ${to === T ? 'absent' : 'present'}`, !!carried === (to !== T), carried);
}
// the key's words are inside the figure in every language (the Italian line is the widest)
for (const lang of ['en', 'ru', 'it']) {
  await ready(1, lang);
  await ev(`(__cmwSteps({ T: 0 }), __cmwSteps({ go: 1, now: true }), 1)`);
  await settled({ until: `__cmwSteps().i === 1 && !__cmwSteps().moving && __cmwSteps().T === 0`, max: 15000 });
  const r = await build({ svPic: 'two', crop: 'screen', svFrom: 0, svTo: 1 });
  ok(`${lang}: the key stands in the figure and ends inside its width`, r && r.info && !!r.info.keyLine && r.info.keyR > 0 && r.info.keyR <= r.info.W + FIT_SLACK, r && r.info && { keyLine: r.info.keyLine, keyR: r.info.keyR, W: r.info.W });
}
// the default planes follow the thread: example 18 has z and ζ's values only
await ready(18);
const r18 = await build({ svPic: 'two', crop: 'fit' });
ok('example 18: z and the last plane, joined by F', r18 && r18.info && r18.info.arrow === 'F' && r18.info.frames.length === 2, r18 && (r18.err || r18.info));
// Fit gives each plane its own window (ζ's values near 0 against the camera's [-10,10]x[12.5,27.5]), and the caption says so
ok('example 18: Fit frames each plane, and the caption says so', r18 && r18.info && r18.info.ownWin === true && /own window/.test(r18.cap), r18 && { cap: r18.cap, boxes: r18.info.boxes, ownWin: r18.info.ownWin });
const r18s = await build({ svPic: 'two', crop: 'screen' });
ok('example 18: As on screen keeps the camera window, with no note', r18s && r18s.info && !r18s.info.ownWin && !/own window/.test(r18s.cap), r18s && r18s.cap);

// the plane names and the axis names meet nothing, and stay in the figure: in the Homework figure (cross axes) a panel's
// imaginary axis stands at its left edge when its window is right of 0, and its name "Im w" stands over it, centred, where the
// plane's name heads the panel. The scene: z then z², the disc |z − 3| ≤ 1, Fit (each plane its own window, right of 0), the
// figures z → w₂, w₁ → w₂ and z → w₁ (Homework) and z → w₂, z → w₁ (Slides), in en and ru; each 'title' box (a plane's name)
// is clear of every 'axis-name' box, every title, axis name and tick label lies inside the figure's width (the first panel's stand
// left of its edge), and where the To plane carries the key (past the colour plane) its ring and line meet none of them. The
// same for the disc |z − 1| ≤ 1, where z's window straddles 0 and its imaginary axis stands a little way into the panel
// (Homework z → w₂ and z → w₁). (control: example 1 on the camera's window, where the imaginary axes stand mid-panel: each name
// keeps its place at its panel's top left corner)
{
  // how far apart two boxes must be to count as clear, pt; how far a box may sit past the figure's edge, pt
  const GAP = 0.25, EDGE = 0.01;
  const meets = (a, b) => a.x0 < b.x1 + GAP && a.x1 > b.x0 - GAP && a.y0 < b.y1 + GAP && a.y1 > b.y0 - GAP;
  const scene = (c) => ({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image',
    steps: [{ type: 'custom', params: { expr: 'z', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^2', cut: 180 }, on: true }],
    shapes: [{ id: 'd1', kind: 'disc', c, r: 1, visible: true }] });
  const labels = (o) => evJson(`await (async () => { try { const f = await Figure.build(${JSON.stringify(o)}); if (!f) return JSON.stringify({ none: true });
    const imgs = [...f.svg.matchAll(/<image x="([\\d.-]+)" y="([\\d.-]+)" width="([\\d.-]+)"/g)].map((m) => ({ x: +m[1], y: +m[2], w: +m[3] }));
    return JSON.stringify({ W: f.W, ownWin: f.info && f.info.ownWin, keyLine: f.info && f.info.keyLine, imgs, boxes: f.boxes.filter((b) => ['title', 'axis-name', 'tick', 'key', 'ring-mark'].includes(b.kind)).map((b) => ({ kind: b.kind, tex: b.tex, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })) });
  } catch (e) { return JSON.stringify({ err: String(e && e.stack || e).slice(0, 500) }); } })()`, BUILD_TIMEOUT_MS);
  const r1 = (b) => ({ tex: b.tex, box: [b.x0, b.y0, b.x1, b.y1].map((v) => +v.toFixed(1)) });
  // (the disc |z − 3| ≤ 1: every window right of 0; |z − 1| ≤ 1: z's window straddles 0, its imaginary axis a little way in)
  for (const [c, figs] of [[[3, 0], [['homework', 0, 2], ['homework', 1, 2], ['homework', 0, 1], ['slides', 0, 2], ['slides', 0, 1]]], [[1, 0], [['homework', 0, 2], ['homework', 0, 1]]]]) for (const lang of ['en', 'ru']) {
    const ns = 'xtpr' + lang + Date.now();
    await seed(ns, scene(c));
    await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=steps`);
    await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.Figure && typeof __cmwSteps === "function" && __cmwSteps().planes.length > 2', max: 30000 });
    for (const [pre, from, to] of figs) {
      const tag = `disc at ${c[0]}, ${lang}, ${pre}, Fit, plane ${from} → plane ${to}`;
      const f = await labels({ svPic: 'two', for: pre, crop: 'fit', svFrom: from, svTo: to, capInImage: false });
      const titles = (f.boxes || []).filter((b) => b.kind === 'title'), names = (f.boxes || []).filter((b) => b.kind === 'axis-name'), ticks = (f.boxes || []).filter((b) => b.kind === 'tick');
      const hits = titles.flatMap((t) => names.filter((a) => meets(t, a)).map((a) => ({ title: r1(t), axis: r1(a) })));
      const out = [...titles, ...names, ...ticks].filter((b) => b.x0 < -EDGE || b.x1 > f.W + EDGE).map(r1);
      info[`labels ${tag}`] = { err: f.err, W: f.W, titles: titles.map(r1), names: names.map(r1) };
      ok(`${tag}: two plane names and four axis names (control)`, !f.err && titles.length === 2 && names.length === 4, info[`labels ${tag}`]);
      ok(`${tag}: each plane's name meets no axis name`, !f.err && titles.length === 2 && hits.length === 0, hits);
      ok(`${tag}: every plane name, axis name and tick label is inside the figure`, !f.err && out.length === 0, { W: f.W, out });
      // (the key of a To plane past the colour plane: its ring, bounded by its marks 1, i, -1, -i, and its line)
      const marks = (f.boxes || []).filter((b) => b.kind === 'ring-mark'), keyText = (f.boxes || []).filter((b) => b.kind === 'key');
      const ring = marks.length ? { tex: 'ring', x0: Math.min(...marks.map((b) => b.x0)), y0: Math.min(...marks.map((b) => b.y0)), x1: Math.max(...marks.map((b) => b.x1)), y1: Math.max(...marks.map((b) => b.y1)) } : null;
      const keyHits = [...titles, ...names, ...ticks].flatMap((b) => [ring, ...keyText].filter((q) => q && meets(b, q)).map((q) => ({ label: r1(b), key: r1(q) })));
      if (f.keyLine) ok(`${tag}: the key's ring and line meet no plane name, axis name or tick label`, !f.err && !!ring && keyHits.length === 0, keyHits);
    }
  }
  // (control) example 1 on the camera's window: the imaginary axes mid-panel, each name at its panel's top left corner
  await ready(1);
  const c = await labels({ svPic: 'two', for: 'homework', crop: 'screen', capInImage: false });
  const ct = (c.boxes || []).filter((b) => b.kind === 'title');
  info['labels control'] = { err: c.err, titles: ct.map(r1), imgs: c.imgs };
  ok('control, example 1 on the camera\'s window: each plane\'s name stands at its panel\'s top left corner', !c.err && ct.length === 2 && c.imgs.length === 2 && ct.every((t, i) => Math.abs(t.x0 - c.imgs[i].x) < 0.05 && t.y1 < c.imgs[i].y), info['labels control']);
}

// (node) the text layer of a PDF given in base64: the strings shown in render mode 3 (invisible) in content-stream order,
// which is reading order, read back through the font's ToUnicode map (the font is embedded with Identity-H, so a string is
// its glyph ids in hex); whether every font the PDF uses is embedded (no Type 1 font without a file, each font descriptor
// with its font file); and the embedded font file's bytes, base64
const zlib = await import('node:zlib');
const pdfLayer = (b64) => {
  const pdf = Buffer.from(b64, 'base64'), raw = pdf.toString('latin1'), streams = [], toUni = new Map(), shown = [];
  for (const m of raw.matchAll(/stream\r?\n/g)) {
    const from = m.index + m[0].length, to = pdf.indexOf('endstream', from);
    try { streams.push(zlib.inflateSync(pdf.subarray(from, to))); } catch (e) { /* not a deflated stream */ }
  }
  for (const d of streams.map((x) => x.toString('latin1'))) for (const b of d.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const c of b[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) toUni.set(c[1].toLowerCase(), String.fromCodePoint(parseInt(c[2], 16)));
  for (const d of streams.map((x) => x.toString('latin1'))) for (const t of d.matchAll(/3 Tr[^<]*<([0-9a-f]+)> Tj/gi)) shown.push(t[1].toLowerCase().match(/.{4}/g).map((g) => toUni.get(g) || '?').join(''));
  const descriptors = [...raw.matchAll(/\/Type \/FontDescriptor[\s\S]*?>>/g)].map((m) => m[0]);
  const ff = /\/FontFile2 (\d+) 0 R/.exec(raw), fontObj = ff ? new RegExp(`\\n${ff[1]} 0 obj[\\s\\S]*?stream\\r?\\n`).exec(raw) : null;
  let font = null;
  if (fontObj) { const from = fontObj.index + fontObj[0].length; try { font = zlib.inflateSync(pdf.subarray(from, pdf.indexOf('endstream', from))).toString('base64'); } catch (e) { font = pdf.subarray(from, pdf.indexOf('endstream', from)).toString('base64'); } }
  return { shown, font, embedded: !/\/Subtype \/Type1\b/.test(raw) && descriptors.length > 0 && descriptors.every((d) => /\/FontFile[23]?\b/.test(d)), fonts: { type1: raw.match(/\/BaseFont \/[A-Za-z-]+/g) || [], descriptors: descriptors.map((d) => d.slice(0, 200)) } };
};
// (in the page) the figure built with options o, and its PDF made twice, base64 -> JSON { texts, a, b } or { err }
const pdfTwice = (o) => evJson(`await (async () => { try {
  const f = await Figure.build(${JSON.stringify(o)}), out = [];
  for (let n = 0; n < 2; n++) { const buf = new Uint8Array(await (await Figure.pdf(f)).arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192)); out.push(btoa(bin)); }
  return JSON.stringify({ texts: (f.texts || []).map((q) => q.text), a: out[0], b: out[1] });
} catch (e) { return JSON.stringify({ err: String(e && e.stack || e).slice(0, 500) }); } })()`, BUILD_TIMEOUT_MS);

// the labels carry text (#1015): an invisible <text> over each label's glyph box (within GLYPH_SLACK_PT), in the SVG; the same words,
// invisible, in the PDF's text layer, in reading order, in a font the PDF embeds
await ready(1);
const tl = await evJson(`await (async () => { try {
  const f = await Figure.build({ svPic: 'two', crop: 'screen' });
  const buf = new Uint8Array(await (await Figure.pdf(f)).arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  const els = [...new DOMParser().parseFromString(f.svg, 'image/svg+xml').querySelectorAll('g.cmw-text > text')].map((t) => ({ text: t.textContent, x: +t.getAttribute('x'), y: +t.getAttribute('y'), fs: +t.getAttribute('font-size'), len: +t.getAttribute('textLength'), op: t.getAttribute('fill-opacity') }));
  return JSON.stringify({ els, boxes: f.boxes, pdf: btoa(bin) });
} catch (e) { return JSON.stringify({ err: String(e && e.stack || e).slice(0, 500) }); } })()`, BUILD_TIMEOUT_MS);
ok('the two-plane figure builds with its text layer', !tl.err && tl.els.length >= 3, tl.err || tl.els);
if (!tl.err) {
  const words = tl.els.map((t) => t.text);
  ok('the layer has the panel names and the arrow\'s label', ['z', 'w₂', 'F'].every((w) => words.includes(w)), words);
  ok('the figure\'s title is not a text of the layer (it is the <title>)', !words.some((w) => /joined by/.test(w)), words);
  ok('every text is invisible', tl.els.every((t) => t.op === '0'), tl.els);
  const pl = await evJson(`JSON.stringify(Object.fromEntries(['\\\\arg H_{t}', '\\\\sin z', '\\\\zeta(z)', '\\\\bar z', '\\\\frac{1}{z}', '\\\\frac{z+1}{z-1}', 'z \\\\le 1', '\\\\operatorname{Re} z', 'f_{2}', '\\\\sqrt{z}', '\\\\sqrt{z+1}', '\\\\sqrt[3]{z}', '\\\\sqrt[n]{z}', '\\\\sqrt2', '\\\\frac{1}{z^{2}}', '\\\\frac{1}{e^{-z}+1}', '\\\\frac{1}{\\\\sqrt{z}}', '\\\\frac{\\\\pi}{2}', '\\\\text{colour carried from }w_{2}'].map((t) => [t, typeof __cmwFig.XD.plain === 'function' ? __cmwFig.XD.plain(t) : null])))`);
  const WANT = { '\\arg H_{t}': 'arg H_t', '\\sin z': 'sin z', '\\zeta(z)': 'ζ(z)', '\\bar z': 'z\u0304', '\\frac{1}{z}': '1/z', '\\frac{z+1}{z-1}': '(z+1)/(z-1)', 'z \\le 1': 'z ≤ 1', '\\operatorname{Re} z': 'Re z', 'f_{2}': 'f₂', '\\text{colour carried from }w_{2}': 'colour carried from w₂' };
  ok('XD.plain reads TeX as people read it', Object.entries(WANT).every(([k, v]) => pl[k] === v), pl);
  ok('a key\'s ring marks (1, i, -1, -i) carry no text', !words.includes('1') && !words.includes('i') && !words.includes('-1'), words);
  const near = (t) => tl.boxes.some((b) => Math.abs(b.x0 - t.x) <= GLYPH_SLACK_PT && Math.abs((b.x1 - b.x0) - t.len) <= GLYPH_SLACK_PT && b.y0 - GLYPH_SLACK_PT <= t.y && t.y <= b.y1 + GLYPH_SLACK_PT);
  const labels = tl.els.filter((t) => t.len > 0);
  ok('each label\'s text lies within the glyph slack of its glyph box', labels.length >= 3 && labels.every(near), labels.filter((t) => !near(t)));
  const lay = pdfLayer(tl.pdf);
  ok('the PDF shows the panel names, then the arrow\'s label, as invisible text', lay.shown.indexOf('z') >= 0 && lay.shown.indexOf('w₂') > lay.shown.indexOf('z') && lay.shown.indexOf('F') > lay.shown.indexOf('w₂'), lay.shown);
  ok('the PDF embeds every font it uses (no standard 14 font, each descriptor with its font file)', lay.embedded, lay.fonts);
}

// the PDF's text layer holds every character of the labels, as the labels read: the filmstrip's subscripts (w₁=f₁(z)), and a
// Russian figure's key ("на полосу яркости", "×1,69", read in reading order across the key's lines, which may wrap); the
// same figure's PDF made twice embeds the same font bytes
await ready(1);
const film = await pdfTwice({ svPic: 'film' });
ok('the filmstrip\'s PDF builds', !film.err, film.err);
if (!film.err) {
  const la = pdfLayer(film.a), lb = pdfLayer(film.b);
  ok('the filmstrip\'s PDF shows its titles as they read, subscripts and all', ['w₁=f₁(z)', 'w₂=f₂(w₁)'].every((w) => la.shown.includes(w)) && la.embedded, { shown: la.shown, texts: film.texts });
  ok('the same figure\'s PDF made twice embeds the same font file', !!la.font && la.font === lb.font, { a: la.font && la.font.length, b: lb.font && lb.font.length });
}
await ready(1, 'ru');
await ev(`(__cmwSet('wKey', true), 1)`);
await settled({ until: '!__cmwSteps().moving', max: 15000 });
const ru = await pdfTwice({ svPic: 'plane' });
ok('a Russian plane figure\'s PDF builds', !ru.err, ru.err);
if (!ru.err) {
  const lr = pdfLayer(ru.a);
  ok('a Russian figure\'s PDF shows its key\'s words in Cyrillic, and embeds its font', ['на полосу яркости', '×1,69'].every((w) => lr.shown.join(' ').includes(w)) && lr.embedded, { shown: lr.shown, texts: ru.texts });
}
// every tick label stands inside the figure, over its tick: with cross axes (Homework, Slides) a tick near a panel's left edge
// has its label centred under it, which reached past the figure's few points of margin («−8» in example 1, on the camera's
// window). A label whose centred place is inside the figure keeps it; one that would start left of the figure slides right
// just as far as the edge, still over its tick. The steps view's Two planes figure and the classic X → Y figure (X's panel,
// the one it draws, #994; built as the dialog builds it, view xyL), Homework and Slides in en, Homework in ru. (An x tick
// label: a 'tick' box just under its panel's real axis; its tick: the label's value through the panel's window.)
{
  const EDGE = 0.01, CENTRE = 0.05;
  const ticksOf = (o) => evJson(`await (async () => { try { const f = await Figure.build(${JSON.stringify(o)}); if (!f) return JSON.stringify({ none: true });
    const imgs = [...f.svg.matchAll(/<image x="([\\d.-]+)" y="([\\d.-]+)" width="([\\d.-]+)" height="([\\d.-]+)"/g)].map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
    const i = f.info || {}, wins = Array.isArray(i.boxes) ? i.boxes : (i.panels || []).map((sd) => i.boxes && i.boxes[sd]);
    return JSON.stringify({ W: f.W, imgs, wins, ticks: f.boxes.filter((b) => b.kind === 'tick').map((b) => ({ tex: b.tex, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })) });
  } catch (e) { return JSON.stringify({ err: String(e && e.stack || e).slice(0, 500) }); } })()`, BUILD_TIMEOUT_MS);
  const num = (tex) => Number(String(tex).replace(/\{,\}/g, '.').replace(/[−-]/g, '-').replace(/[^\d.\-]/g, ''));
  // -> { outside, off }: the tick labels outside the figure, and the x tick labels not over their tick or moved needlessly
  const check = (f) => {
    const outside = (f.ticks || []).filter((b) => b.x0 < -EDGE || b.x1 > f.W + EDGE);
    const off = [];
    (f.imgs || []).forEach((im, k) => {
      const b = f.wins && f.wins[k];
      if (!b) return;
      const oy = Math.min(im.y + im.h, Math.max(im.y, im.y + (b.y1 / (b.y1 - b.y0)) * im.h));
      for (const q of f.ticks || []) {
        if (q.y0 < oy || q.y0 > oy + 4 || q.x1 < im.x - 20 || q.x0 > im.x + im.w) continue;
        const px = im.x + (num(q.tex) - b.x0) / (b.x1 - b.x0) * im.w, w = q.x1 - q.x0, mid = (q.x0 + q.x1) / 2;
        const covers = q.x0 <= px + EDGE && px <= q.x1 + EDGE;
        const placed = px - w / 2 >= 0 ? Math.abs(mid - px) < CENTRE : Math.abs(q.x0) < CENTRE;
        if (!covers || !placed) off.push({ tex: q.tex, panel: k, px: +px.toFixed(2), box: [q.x0, q.x1].map((v) => +v.toFixed(2)) });
      }
    });
    return { outside, off };
  };
  for (const [pre, lang] of [['homework', 'en'], ['slides', 'en'], ['homework', 'ru']]) {
    // (Slides labels only ±1, which example 1 puts on the panels' edges: its rows hold no label, a control there is none)
    const least = pre === 'homework' ? 8 : 0;
    await ready(1, lang === 'en' ? undefined : lang);
    const sv = await ticksOf({ svPic: 'two', for: pre, crop: 'screen', capInImage: false }), cs = check(sv);
    info[`ticks steps two planes ${pre} ${lang}`] = { err: sv.err, W: sv.W, n: (sv.ticks || []).length, ...cs };
    ok(`steps view, example 1, ${pre} Two planes, ${lang}: every tick label is inside the figure`, !sv.err && (sv.ticks || []).length >= least && cs.outside.length === 0, cs.outside);
    ok(`steps view, example 1, ${pre} Two planes, ${lang}: each x tick label is over its tick, centred where that fits in the figure`, !sv.err && cs.off.length === 0, cs.off);
    await go(`${base}/test.html?view=classic&ns=xtpt${Date.now() % 1e7}${lang === 'en' ? '' : `&lang=${lang}`}`);
    await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.Figure && typeof __cmwExample === "function"', max: 30000 });
    await ev('(__cmwExample(1), 1)'); await settled();
    const cl = await ticksOf({ view: 'xyL', for: pre, cols: 2, crop: 'screen', capInImage: false }), cc = check(cl);
    info[`ticks classic image ${pre} ${lang}`] = { err: cl.err, W: cl.W, n: (cl.ticks || []).length, ...cc };
    ok(`classic view, example 1, ${pre} X → Y figure (X's panel), ${lang}: every tick label is inside the figure`, !cl.err && (cl.ticks || []).length >= least && cc.outside.length === 0, cc.outside);
    ok(`classic view, example 1, ${pre} X → Y figure (X's panel), ${lang}: each x tick label is over its tick, centred where that fits in the figure`, !cl.err && cc.off.length === 0, cc.off);
  }
}
return { pass: fails.length === 0, fails, info };
