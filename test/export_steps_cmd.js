// The steps view's Export → Image is the shown plane (#633): for Strip to disk and the zeta function, a coloured plane
// in Plane, Sphere and Landscape and a plane past the colour plane, the figure's picture is the stage's. A grid of cells
// over the stage, each the median of 3 x 3 samples (so a thin line or label does not decide it), is compared with the
// same points of the figure's raster: by world coordinate on a plane (the figure's window, Figure.build's box), by
// position in the frame on the sphere (the same camera and aspect), and on the Landscape, which the figure crops to the
// relief, by the share of each of 12 hue bins. Only cells the stage colours count. The caption names the plane's map.
// A command file for a CDP daemon:  <runner> test/export_steps_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// a cell agrees when every channel is within TOL of the stage (on the sphere: its hue within HUE degrees); a case passes when AGREE of its coloured cells agree
// (the figure is drawn on white paper in the light theme, the stage in the light theme: the colours are the same map's)
const TOL = 40, HUE = 25, AGREE = 0.85, GRID = [40, 28];
await view(1440, 900, false);
await load('xsv' + Date.now(), {});
const base = await ev('location.origin');
const CASES = [
  { ex: 1, go: 1, surf: 'plane', cap: /f_\{2\}/ },
  { ex: 1, go: 0, surf: 'plane', cap: /\$F\$/ },
  { ex: 1, go: 1, surf: 'sphere', cap: /f_\{2\}/ },
  { ex: 1, go: 0, surf: 'land', cap: /\$F\$/ },
  { ex: 1, go: 2, T: 1, surf: 'plane', cap: /images of/ },
  { ex: 18, go: 0, surf: 'plane', cap: /\$F\$/ },
  { ex: 18, go: 0, surf: 'sphere', cap: /\$F\$/ },
  { ex: 18, go: 0, surf: 'land', cap: /\$F\$/ },
];
// the stage as the screen shows it: its pixels, and which cells of the grid the plane's canvas shows uncovered
async function stageShot() {
  const BIG = `[...document.querySelectorAll('#plotL canvas')].map((e) => [e, e.getBoundingClientRect()]).sort((p, q) => q[1].width * q[1].height - p[1].width * p[1].height)[0]`;
  const pane = await ev(`(() => { const r = ${BIG}[1]; return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const free = await ev(`(() => { const p = ${JSON.stringify(pane)}, G = ${JSON.stringify(GRID)}, out = [];
    const host = document.querySelector('#plotL');
    // (what lies over the canvas without taking the pointer, the key among it, counts as covering too)
    const over = [...document.querySelectorAll('#paneL *')].filter((e) => !(e.tagName === 'CANVAS' && host.contains(e)) && !e.contains(host) && !e.querySelector('#plotL canvas') && e.checkVisibility && e.checkVisibility()).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    // (the plane's key sits on the plot, a canvas of its own)
    const lg = document.getElementById('leftLegend'); if (lg && !lg.hidden) over.push(lg.getBoundingClientRect());
    for (let j = 0; j < G[1]; j++) for (let i = 0; i < G[0]; i++) {
      const x0 = p.x + i * p.w / G[0], y0 = p.y + j * p.h / G[1], x1 = x0 + p.w / G[0], y1 = y0 + p.h / G[1];
      const e = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2);
      out.push(!!e && e.tagName === 'CANVAS' && host.contains(e) && !over.some((r) => r.left < x1 && r.right > x0 && r.top < y1 && r.bottom > y0) ? 1 : 0);
    }
    return out; })()`);
  const shotImg = await img({ x: pane.x, y: pane.y, width: pane.w, height: pane.h });
  const scr = { w: shotImg.w, h: shotImg.h, ch: shotImg.ch, data: shotImg.data };
  return { scr, free };
}
// pixels: an image's RGB at (x, y); the median of 3 x 3 samples r apart (a line or a label does not decide it)
const px = (im, x, y) => { const i = (Math.min(im.h - 1, Math.max(0, Math.round(y))) * im.w + Math.min(im.w - 1, Math.max(0, Math.round(x)))) * (im.ch || 3); return [im.data[i], im.data[i + 1], im.data[i + 2]]; };
const med = (im, x, y, r) => { const s = [[], [], []]; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const q = px(im, x + a * r, y + b * r); for (let k = 0; k < 3; k++) s[k].push(q[k]); } return s.map((v) => v.sort((p, q) => p - q)[4]); };
const chroma = (q) => Math.max(...q) - Math.min(...q);
const hueOf = (q) => { const [r, g, b] = q.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 0; const h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); return ((h * 60) + 360) % 360; };
const hueDiff = (a, b) => { const d = Math.abs(hueOf(a) - hueOf(b)) % 360; return Math.min(d, 360 - d); };
let ns = 0;
for (const c of CASES) {
  const tag = `ex ${c.ex} plane ${c.go} ${c.surf}${c.T != null ? ' T ' + c.T : ''}`;
  await go(`${base}/test.html?view=steps&ns=xsv${Date.now() % 1e7}${ns++}`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
  await ev(`(__cmwExample(${c.ex}), 1)`);
  await settled({ until: '__cmwSteps().planes.length > 0', max: 15000, floor: 300 });
  await ev(`(__cmwSteps({ surf: '${c.surf}' }), ${c.T != null ? `__cmwSteps({ T: ${c.T} }),` : ''} __cmwSteps({ go: ${c.go}, now: true }), 1)`);
  // (the key drawn on the plane is a screen aid the figure leaves out)
  await ev(`(__cmwSet('wKey', false), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: 15000, floor: 400 });
  // the stage: the cells the left pane's canvas shows (not covered by the plane's controls or its key)
  const { scr, free } = await stageShot();
  const st = await ev(`(() => { const s = __cmwSteps(); return { main: s.main, stage: s.stage, T: s.T }; })()`);
  // the figure: its raster (the first image) as a downsampled RGB array, its window, its caption
  // (built in the page, the result kept on window: a figure can take longer than one evaluation's timeout)
  await ev(`window.__xsv = null; (async () => {
    const f = await Figure.build({}); if (!f) return { none: true };
    const m = /<image\\b[^>]*?(?:xlink:)?href="(data:image\\/[^"]+)"/.exec(f.svg); if (!m) return { cap: String(f.captionTex || ''), view: f.view, box: f.box, art: null };
    const im = new Image(); im.src = m[1]; await im.decode();
    const W = Math.min(240, im.naturalWidth), H = Math.round(W * im.naturalHeight / im.naturalWidth), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
    let bin = ''; for (let i = 0; i < W * H; i++) bin += String.fromCharCode(d[4 * i], d[4 * i + 1], d[4 * i + 2]);
    return { cap: String(f.captionTex || ''), view: f.view, box: f.box, art: { w: W, h: H, b64: btoa(bin) } };
  })().then((r) => { window.__xsv = r; }, (e) => { window.__xsv = { err: String(e) }; }); 1`);
  await settled({ until: 'window.__xsv != null', max: 90000, panes: false });
  const fig = await ev('window.__xsv');
  ok(`${tag}: a figure builds`, !!fig && !!fig.art, fig && (fig.__exc || fig.err || { view: fig.view, cap: String(fig.cap).slice(0, 80) }));
  if (!fig || !fig.art) continue;
  ok(`${tag}: the caption names the plane's map`, c.cap.test(fig.cap), fig.cap.slice(0, 160));
  const art = { w: fig.art.w, h: fig.art.h, data: Buffer.from(fig.art.b64, 'base64'), ch: 3 };
  if (c.surf === 'land') {
    // the hue shares of the coloured pixels: the figure's crop is the relief's, the stage's the camera's
    const hues = (im, sel) => { const b = new Array(12).fill(0); let n = 0; for (let y = 0; y < im.h; y += 3) for (let x = 0; x < im.w; x += 3) { if (sel && !sel(x, y)) continue; const q = px(im, x, y); if (chroma(q) < 50) continue; b[Math.floor(hueOf(q) / 30) % 12]++; n++; } return b.map((v) => v / Math.max(1, n)); };
    const a = hues(scr, (x, y) => free[Math.min(GRID[1] - 1, Math.floor(y / scr.h * GRID[1])) * GRID[0] + Math.min(GRID[0] - 1, Math.floor(x / scr.w * GRID[0]))] === 1), b = hues(art), l1 = a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
    info[tag] = { l1: +l1.toFixed(3) };
    ok(`${tag}: the figure's hues are the stage's (L1 of the 12 hue shares under 0.35)`, l1 < 0.35, { l1: +l1.toFixed(3), stage: a.map((v) => +v.toFixed(2)), fig: b.map((v) => +v.toFixed(2)) });
    continue;
  }
  // a plane: the cell's world point in the figure's window; the sphere: the same place relative to the coloured part of
  // each picture (the figure frames the globe tighter than the stage does)
  const scrBox = c.surf === 'plane' ? await ev(`__cmwStageBox()`) : null;
  if (scrBox) {
    // the figure's window is the stage's (As on screen; the axes snap it to their ticks, so a little of it may go)
    const ar = (b) => (b.x1 - b.x0) * (b.y1 - b.y0), ix = fig.box && { x0: Math.max(scrBox.x0, fig.box.x0), x1: Math.min(scrBox.x1, fig.box.x1), y0: Math.max(scrBox.y0, fig.box.y0), y1: Math.min(scrBox.y1, fig.box.y1) };
    const cover = ix && ix.x1 > ix.x0 && ix.y1 > ix.y0 ? ar(ix) / ar(scrBox) : 0;
    ok(`${tag}: the figure shows the stage's window (80% of it or more)`, cover >= 0.8, { cover: +cover.toFixed(3), stage: scrBox, fig: fig.box });
  }
  const cbox = (im, sel) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let y = 0; y < im.h; y += 2) for (let x = 0; x < im.w; x += 2) { if (sel && !sel(x, y)) continue; if (chroma(px(im, x, y)) >= 50) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } } return { x0, y0, x1, y1 }; };
  const freeAt = (x, y) => free[Math.min(GRID[1] - 1, Math.floor(y / scr.h * GRID[1])) * GRID[0] + Math.min(GRID[0] - 1, Math.floor(x / scr.w * GRID[0]))] === 1;
  const bS = c.surf === 'sphere' ? cbox(scr, freeAt) : null, bA = c.surf === 'sphere' ? cbox(art) : null;
  let n = 0, agree = 0;
  const bad = [];
  for (let j = 0; j < GRID[1]; j++) for (let i = 0; i < GRID[0]; i++) {
    if (!free[j * GRID[0] + i]) continue;
    const sx = (i + 0.5) * scr.w / GRID[0], sy = (j + 0.5) * scr.h / GRID[1], q = med(scr, sx, sy, 2);
    if (chroma(q) < 50) continue;
    let ax, ay;
    if (scrBox && fig.box) {
      const wx = scrBox.x0 + (i + 0.5) / GRID[0] * (scrBox.x1 - scrBox.x0), wy = scrBox.y1 - (j + 0.5) / GRID[1] * (scrBox.y1 - scrBox.y0);
      if (wx < fig.box.x0 || wx > fig.box.x1 || wy < fig.box.y0 || wy > fig.box.y1) continue;
      ax = (wx - fig.box.x0) / (fig.box.x1 - fig.box.x0) * art.w; ay = (fig.box.y1 - wy) / (fig.box.y1 - fig.box.y0) * art.h;
    } else if (bS) { ax = bA.x0 + (sx - bS.x0) / (bS.x1 - bS.x0) * (bA.x1 - bA.x0); ay = bA.y0 + (sy - bS.y0) / (bS.y1 - bS.y0) * (bA.y1 - bA.y0); }
    else continue;
    const a = med(art, ax, ay, 1);
    n++;
    // (the sphere: the hue, within HUE degrees; the figure's globe is lit and shaded as print, the stage's as the screen)
    const same = bS ? hueDiff(a, q) <= HUE : a.every((v, k) => Math.abs(v - q[k]) <= TOL);
    if (same) agree++; else if (bad.length < 4) bad.push({ cell: [i, j], stage: q, fig: a });
  }
  info[tag] = { cells: n, agree: n ? +(agree / n).toFixed(3) : null };
  ok(`${tag}: the figure's picture is the stage's (${Math.round(AGREE * 100)}% of the coloured cells within ${TOL} per channel)`, n >= 12 && agree / n >= AGREE, { cells: n, agree: n ? +(agree / n).toFixed(3) : 0, bad });
}
// the captions in Russian and Italian too: each formula in them parses with no error and no unknown command (the scan
// of export_tex_cmd, #546), and they name the plane's map
await go(`${base}/test.html?view=steps&ns=xsvl${Date.now() % 1e7}`);
await settled({ until: 'window.MathJax && typeof MathJax.tex2mml === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
await ev(`(__cmwExample(1), 1)`);
await settled({ until: '__cmwSteps().planes.length > 2', max: 15000, floor: 300 });
for (const [go1, T] of [[1, null], [2, 1]]) for (const lang of ['ru', 'it']) {
  await ev(`(${T != null ? `__cmwSteps({ T: ${T} }),` : ''} __cmwSteps({ go: ${go1}, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: 15000, floor: 300 });
  await ev(`window.__xsv = null; Figure.build({ lang: '${lang}' }).then((f) => { const cap = String(f && f.captionTex || ''), bad = [];
    for (const m of cap.match(/\$[^$]+\$|\\\[[\s\S]*?\\\]/g) || []) { const t = m.replace(/^\$|\$$|^\\\[|\\\]$/g, ''); try { const d = new DOMParser().parseFromString(MathJax.tex2mml(t, { display: false }), 'application/xml'); if (d.querySelector('merror') || d.querySelector('[mathcolor="red"]')) bad.push(t.slice(0, 60)); } catch (e) { bad.push('throws ' + t.slice(0, 40)); } }
    window.__xsv = { cap: cap.slice(0, 200), bad }; }, (e) => { window.__xsv = { err: String(e) }; }); 1`);
  await settled({ until: 'window.__xsv != null', max: 90000, panes: false });
  const r = await ev('window.__xsv');
  const tag = `${lang}, plane ${go1}${T != null ? ', past the colour plane' : ''}`;
  ok(`${tag}: the caption's formulas parse (no raw TeX)`, r && !r.err && r.bad.length === 0, r);
  ok(`${tag}: the caption names the plane's map`, r && /f_\{2\}|\$F\$|F\(z\)/.test(r.cap), r && r.cap);
}
// the filmstrip (#634): one frame per plane of the thread, each the stage's picture of that plane over its window
for (const ex of [1, 18]) {
  await go(`${base}/test.html?view=steps&ns=xsvf${ex}${Date.now() % 1e7}`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
  await ev(`(__cmwExample(${ex}), __cmwSet('wKey', false), 1)`);
  await settled({ until: '__cmwSteps().planes.length > 0', max: 15000, floor: 300 });
  const planes = await ev('__cmwSteps().planes');
  await ev(`window.__xsv = null; Figure.build({ svPic: 'film' }).then(async (f) => {
    const urls = [...f.svg.matchAll(/<image\\b[^>]*?(?:xlink:)?href="(data:image\\/[^"]+)"/g)].map((m) => m[1]), arts = [];
    for (const u of urls) { const im = new Image(); im.src = u; await im.decode(); const W = Math.min(240, im.naturalWidth), H = Math.round(W * im.naturalHeight / im.naturalWidth), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data; let bin = ''; for (let i = 0; i < W * H; i++) bin += String.fromCharCode(d[4 * i], d[4 * i + 1], d[4 * i + 2]); arts.push({ w: W, h: H, b64: btoa(bin) }); }
    window.__xsv = { cap: String(f.captionTex || ''), view: f.view, name: f.name, bytes: f.svg.length, arts }; }, (e) => { window.__xsv = { err: String(e) }; }); 1`);
  await settled({ until: 'window.__xsv != null', max: 120000, panes: false });
  const fig = await ev('window.__xsv');
  const tag = `filmstrip of example ${ex}`;
  ok(`${tag}: it builds, one frame per plane`, fig && !fig.err && fig.view === 'svFilm' && fig.arts.length === planes.length, fig && (fig.err || { view: fig.view, frames: fig.arts.length, planes }));
  if (!fig || fig.err) continue;
  ok(`${tag}: the caption names the thread`, /xrightarrow\{f_\{1\}\}/.test(fig.cap), fig.cap);
  info[tag] = { frames: fig.arts.length, svgBytes: fig.bytes, name: fig.name };
  for (let i = 0; i < Math.min(planes.length, fig.arts.length); i++) {
    await ev(`(__cmwSteps({ go: ${i}, now: true }), 1)`);
    await settled({ until: '!__cmwSteps().moving', max: 15000, floor: 400 });
    const { scr, free } = await stageShot(), a = fig.arts[i], art = { w: a.w, h: a.h, ch: 3, data: Buffer.from(a.b64, 'base64') };
    // (the frame is the stage's window at the pane's aspect: the same place in both pictures)
    let n = 0, agree = 0;
    for (let j = 0; j < GRID[1]; j++) for (let k = 0; k < GRID[0]; k++) {
      if (!free[j * GRID[0] + k]) continue;
      const q = med(scr, (k + 0.5) * scr.w / GRID[0], (j + 0.5) * scr.h / GRID[1], 2);
      if (chroma(q) < 50) continue;
      const f = med(art, (k + 0.5) * art.w / GRID[0], (j + 0.5) * art.h / GRID[1], 1);
      n++; if (f.every((v, c) => Math.abs(v - q[c]) <= TOL)) agree++;
    }
    ok(`${tag}, frame ${i}: the frame is that plane's stage (${Math.round(AGREE * 100)}% of the coloured cells within ${TOL} per channel)`, n >= 12 && agree / n >= AGREE, { cells: n, agree: n ? +(agree / n).toFixed(3) : 0 });
  }
}
return { pass: fails.length === 0, fails, info };
