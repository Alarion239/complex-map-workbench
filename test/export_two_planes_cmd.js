// The steps view's export Picture "Two planes": plane From and plane To of the thread side by side, each headed by its
// name, with the arrow of the map between them named over it. Each panel is the Shown plane export of its plane: on
// the camera's window (Crop: As on screen) its picture is the one Figure.build({}) makes with that plane shown. The
// arrow's label is the steps view's own name for the map (F, f_2, f_2∘f_1), real text in the SVG; the caption names the
// two planes and the map; From and To outside the thread are clamped, To after From.
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
const PAGE_GRID = `window.__grid = async (svg) => { const out = [], re = /<image\\b[^>]*?(?:xlink:)?href="(data:image\\/[^"]+)"/g; let m;
  while ((m = re.exec(svg))) { const im = new Image(); im.src = m[1]; await im.decode(); const cv = document.createElement('canvas'); cv.width = ${GX}; cv.height = ${GY};
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0, ${GX}, ${GY}); out.push(Array.from(g.getImageData(0, 0, ${GX}, ${GY}).data).filter((v, i) => i % 4 < 3)); }
  return out; }; 1`;
const SPEC = { 'F': 'F', 'f_{2}': 'f₂', '\\sqrt{z}': '√z', '\\sqrt{z+1}': '√(z+1)', '\\sqrt[3]{z}': '³√z', '\\sqrt[n]{z}': 'ⁿ√z', '\\sqrt2': '√2', '\\frac{1}{z^{2}}': '1/z^2', '\\frac{1}{e^{-z}+1}': '1/(e^-z+1)', '\\frac{1}{\\sqrt{z}}': '1/√z', '\\frac{\\pi}{2}': 'π/2', 'f_{1}': 'f₁' };
const build = async (opts) => {
  await ev(`window.__xtp = null; (async () => { const f = await Figure.build(${JSON.stringify(opts)}); if (!f) return { none: true };
    return { svg: f.svg, cap: String(f.captionTex || ''), view: f.view, info: f.info && { svTwo: f.info.svTwo, from: f.info.from, to: f.info.to, arrow: f.info.arrow, frames: f.info.frames && f.info.frames.map((q) => q.name), ownWin: f.info.ownWin, keyLine: f.info.keyLine, W: f.W, keyR: Math.max(0, ...f.boxes.filter((b) => b.kind === 'key' || b.kind === 'ring-mark').map((b) => b.x1)), boxes: f.info.boxes } }; })().then((r) => { window.__xtp = r; }, (e) => { window.__xtp = { err: String(e) }; }); 1`);
  await settled({ until: 'window.__xtp != null', max: 120000, panes: false });
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

// a To plane past the colour plane brings the pane's key: the hue ring and the line saying where the colour is carried from,
// in a column right of the second picture, inside the figure; a To plane that is the colour plane (T at the last plane,
// where each plane is coloured by its own map) has none
const nPlanes = planes;
for (const [T, to] of [[0, 1], [0, 2], [nPlanes - 1, 1], [nPlanes - 1, 2]]) {
  await ev(`(__cmwSteps({ T: ${T} }), __cmwSteps({ go: ${to}, now: true }), 1)`);
  await settled({ until: `__cmwSteps().i === ${to} && !__cmwSteps().moving && __cmwSteps().T === ${T}`, max: 15000 });
  const wk = JSON.parse(await ev(`JSON.stringify(__cmwFig.svKey(${to}))`));
  const r = await build({ svPic: 'two', crop: 'screen', svFrom: 0, svTo: to });
  const carried = wk && wk.carried ? wk.carried.text : null;
  const tag = `T ${T}, to plane ${to}`;
  ok(`${tag}: the figure's key line is ${carried ? 'the pane\'s' : 'absent'}`, r && r.info && (r.info.keyLine || null) === carried, { carried, got: r && r.info && r.info.keyLine });
  ok(`${tag}: the ring is ${carried ? 'drawn' : 'absent'}`, r && !!r.svg && /<clipPath id="[^"]*-key"/.test(r.svg) === !!carried, null);
  info[`key ${tag}`] = carried;
  ok(`${tag}: a carried key is ${T === 0 ? 'present' : 'absent'}`, !!carried === (T === 0), carried);
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

// the labels carry text (#1015): an invisible <text> over each label's glyph box (within 2 px), in the SVG; the same words,
// invisible, in the PDF's text layer, in reading order
await ready(1);
const tl = JSON.parse(await ev(`await (async () => { try {
  const f = await Figure.build({ svPic: 'two', crop: 'screen' });
  const buf = new Uint8Array(await (await Figure.pdf(f)).arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  const els = [...new DOMParser().parseFromString(f.svg, 'image/svg+xml').querySelectorAll('g.cmw-text > text')].map((t) => ({ text: t.textContent, x: +t.getAttribute('x'), y: +t.getAttribute('y'), fs: +t.getAttribute('font-size'), len: +t.getAttribute('textLength'), op: t.getAttribute('fill-opacity') }));
  return JSON.stringify({ els, boxes: f.boxes, pdf: btoa(bin) });
} catch (e) { return JSON.stringify({ err: String(e && e.stack || e).slice(0, 500) }); } })()`, 120000));
ok('the two-plane figure builds with its text layer', !tl.err && tl.els.length >= 3, tl.err || tl.els);
if (!tl.err) {
  const words = tl.els.map((t) => t.text);
  ok('the layer has the panel names and the arrow\'s label', ['z', 'w₂', 'F'].every((w) => words.includes(w)), words);
  ok('the figure\'s title is not a text of the layer (it is the <title>)', !words.some((w) => /joined by/.test(w)), words);
  ok('every text is invisible', tl.els.every((t) => t.op === '0'), tl.els);
  const pl = JSON.parse(await ev(`JSON.stringify(Object.fromEntries(['\\\\arg H_{t}', '\\\\sin z', '\\\\zeta(z)', '\\\\bar z', '\\\\frac{1}{z}', '\\\\frac{z+1}{z-1}', 'z \\\\le 1', '\\\\operatorname{Re} z', 'f_{2}', '\\\\sqrt{z}', '\\\\sqrt{z+1}', '\\\\sqrt[3]{z}', '\\\\sqrt[n]{z}', '\\\\sqrt2', '\\\\frac{1}{z^{2}}', '\\\\frac{1}{e^{-z}+1}', '\\\\frac{1}{\\\\sqrt{z}}', '\\\\frac{\\\\pi}{2}', '\\\\text{colour carried from }w_{2}'].map((t) => [t, __cmwFig.XD.plain(t)])))`));
  const WANT = { '\\arg H_{t}': 'arg H_t'.replace('_t', '_t'), '\\sin z': 'sin z', '\\zeta(z)': 'ζ(z)', '\\bar z': 'z\u0304', '\\frac{1}{z}': '1/z', '\\frac{z+1}{z-1}': '(z+1)/(z-1)', 'z \\le 1': 'z ≤ 1', '\\operatorname{Re} z': 'Re z', 'f_{2}': 'f₂', '\\text{colour carried from }w_{2}': 'colour carried from w₂' };
  ok('XD.plain reads TeX as people read it', Object.entries(WANT).every(([k, v]) => k.includes('H_{t}') ? /^arg H/.test(pl[k]) : pl[k] === v), pl);
  ok('a key\'s ring marks (1, i, -1, -i) carry no text', !words.includes('1') && !words.includes('i') && !words.includes('-1'), words);
  const near = (t) => tl.boxes.some((b) => Math.abs(b.x0 - t.x) <= 2 && Math.abs((b.x1 - b.x0) - t.len) <= 2 && b.y0 - 2 <= t.y && t.y <= b.y1 + 2);
  const labels = tl.els.filter((t) => t.len > 0);
  ok('each label\'s text lies within 2 pt of its glyph box', labels.length >= 3 && labels.every(near), labels.filter((t) => !near(t)));
  // the PDF's text layer in content-stream order, which is reading order: the strings shown in render mode 3 (invisible)
  const zlib = await import('node:zlib'), pdf = Buffer.from(tl.pdf, 'base64'), shown = [];
  for (const m of pdf.toString('latin1').matchAll(/stream\r?\n/g)) {
    const from = m.index + m[0].length, to = pdf.indexOf('endstream', from);
    let d = null; try { d = zlib.inflateSync(pdf.subarray(from, to)).toString('latin1'); } catch (e) { continue; }
    for (const t of d.matchAll(/3 Tr[^()]*\(((?:[^()\\]|\\.)*)\) Tj/g)) shown.push(t[1]);
  }
  ok('the PDF shows the panel names, then the arrow\'s label, as invisible text', shown.indexOf('z') >= 0 && shown.indexOf('w2') > shown.indexOf('z') && shown.indexOf('F') > shown.indexOf('w2'), shown);
}

return { pass: fails.length === 0, fails, info };
