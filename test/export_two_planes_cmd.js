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
const PAGE_GRID = `window.__grid = async (svg) => { const out = [], re = /<image\\b[^>]*?(?:xlink:)?href="(data:image\\/[^"]+)"/g; let m;
  while ((m = re.exec(svg))) { const im = new Image(); im.src = m[1]; await im.decode(); const cv = document.createElement('canvas'); cv.width = ${GX}; cv.height = ${GY};
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0, ${GX}, ${GY}); out.push(Array.from(g.getImageData(0, 0, ${GX}, ${GY}).data).filter((v, i) => i % 4 < 3)); }
  return out; }; 1`;
const SPEC = { 'F': 'F', 'f_{2}': 'f₂', 'f_{1}': 'f₁' };
const build = async (opts) => {
  await ev(`window.__xtp = null; (async () => { const f = await Figure.build(${JSON.stringify(opts)}); if (!f) return { none: true };
    return { svg: f.svg, cap: String(f.captionTex || ''), view: f.view, info: f.info && { svTwo: f.info.svTwo, from: f.info.from, to: f.info.to, arrow: f.info.arrow, frames: f.info.frames && f.info.frames.map((q) => q.name), ownWin: f.info.ownWin, keyLine: f.info.keyLine, boxes: f.info.boxes } }; })().then((r) => { window.__xtp = r; }, (e) => { window.__xtp = { err: String(e) }; }); 1`);
  await settled({ until: 'window.__xtp != null', max: 120000, panes: false });
  return ev('window.__xtp');
};
const grids = async (svg) => { await ev(PAGE_GRID); await ev(`window.__xtpg = null; window.__grid(${JSON.stringify(svg)}).then((g) => { window.__xtpg = g; }); 1`); await settled({ until: 'window.__xtpg != null', max: 30000, panes: false }); return ev('window.__xtpg'); };
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
const ready = async (ex) => {
  await go(`${base}/test.html?view=steps&ns=xtp${ex}${Date.now() % 1e7}`);
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
// in a column right of the second picture, inside the figure; a To plane that is the colour plane has none
for (const to of [1, 2]) {
  await ev(`(__cmwSteps({ T: 0 }), __cmwSteps({ go: ${to}, now: true }), 1)`);
  await settled({ until: `__cmwSteps().i === ${to} && !__cmwSteps().moving && __cmwSteps().T === 0`, max: 15000 });
  const wk = JSON.parse(await ev(`JSON.stringify(__cmwFig.svKey(${to}))`));
  const r = await build({ svPic: 'two', crop: 'screen', svFrom: 0, svTo: to });
  const carried = wk && wk.carried ? wk.carried.text : null;
  ok(`to plane ${to}: the figure's key line is ${carried ? 'the pane\'s' : 'absent'}`, r && r.info && (r.info.keyLine || null) === carried, { carried, got: r && r.info && r.info.keyLine });
  ok(`to plane ${to}: the ring is ${carried ? 'drawn' : 'absent'}`, r && !!r.svg && /<clipPath id="[^"]*-key"/.test(r.svg) === !!carried, null);
  info[`key to ${to}`] = carried; ok(`to plane ${to}: a carried key is exercised`, to === 1 ? !!carried : true, carried);
}
// the default planes follow the thread: example 18 has z and ζ's values only
await ready(18);
const r18 = await build({ svPic: 'two', crop: 'fit' });
ok('example 18: z and the last plane, joined by F', r18 && r18.info && r18.info.arrow === 'F' && r18.info.frames.length === 2, r18 && (r18.err || r18.info));
// Fit gives each plane its own window (ζ's values near 0 against the camera's [-10,10]x[12.5,27.5]), and the caption says so
ok('example 18: Fit frames each plane, and the caption says so', r18 && r18.info && r18.info.ownWin === true && /own window/.test(r18.cap), r18 && { cap: r18.cap, boxes: r18.info.boxes, ownWin: r18.info.ownWin });
const r18s = await build({ svPic: 'two', crop: 'screen' });
ok('example 18: As on screen keeps the camera window, with no note', r18s && r18s.info && !r18s.info.ownWin && !/own window/.test(r18s.cap), r18s && r18s.cap);

return { pass: fails.length === 0, fails, info };
