// Figure export, the axes' tick labels: on every axis of a figure panel the labels are pairwise different, and each
// reads back to its tick's value (to the precision it prints). The composer's panel (XD.panel) over boxes of span 1, 0.1
// and 0.01, around 0 and off it, and a sliver 1.5·10⁻¹⁰ wide (what a figure framing one point made); and the classic Image
// figure of points only (e^z then z², the point 0.4 + 0.3i on z and 1 + 0.5i on w₁, no other shape), at focus 0 and 2,
// in en and ru (the decimal comma), whose panel (b) printed "2 2 2 2" and "1 1 1": a lone point is framed by a window
// of its own size, not by a sliver around it.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
// a frame of a lone point at least this wide, a share of the larger of its value's size and 1
const LONE_MIN = 1e-3;
// a label reads back to its tick: |value − tick| at most half a unit in its last printed place
const readsBack = (lab, t) => { const s = lab.replace('{,}', '.').replace('−', '-'), d = (s.split('.')[1] || '').length; return Math.abs(parseFloat(s) - t) <= 0.5 * 10 ** -d + 1e-12; };
const distinct = (labs) => new Set(labs).size === labs.length;
const axisOk = (a) => !!a && a.labels.length > 1 && distinct(a.labels) && a.labels.every((l, i) => readsBack(l, a.ticks[i]));
const STEPS = [{ type: 'custom', params: { expr: 'e^z', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^2', cut: 180 }, on: true }];
const open = async (ns, focus, lang) => {
  await view(1440, 900, false);
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus, rightMode: 'image', steps: STEPS,
    shapes: [{ id: 'p0', kind: 'point', p: [0.4, 0.3], visible: true }, { id: 'p1', kind: 'point', p: [1, 0.5], stage: 1, visible: true }] });
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=classic`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwFig', max: 30000 });
};
// ---- the composer's panel over boxes of given spans
await open('ftk' + Date.now(), 0, 'en');
const BOXES = [
  ['span 1 around 0', { x0: -0.5, x1: 0.5, y0: -0.5, y1: 0.5 }],
  ['span 1 off 0', { x0: 2.3, x1: 3.3, y0: 1.1, y1: 2.1 }],
  ['span 0.1', { x0: 1.83, x1: 1.93, y0: 1.2, y1: 1.3 }],
  ['span 0.01', { x0: 1.832, x1: 1.842, y0: 1.252, y1: 1.262 }],
  ['a sliver 1.5e-10 wide', { x0: 1.8368181906499998, x1: 1.8368181907999999, y0: 1.2566349344499999, y1: 1.2566349345749999 }],
];
const comp = await ev(`(() => { const XD = __cmwFig.XD, out = {};
  for (const [tag, box] of ${JSON.stringify(BOXES)}) {
    const step = XD.niceStep(Math.max(box.x1 - box.x0, box.y1 - box.y0), 4);
    const p = XD.panel({ x: 0, y: 0, w: 160, h: 160, box, step, art: [], curves: [], points: [], axes: 'box', ylab: 'left', tickPt: 7, labelPt: 8, ink: '#000000', lw: { frame: 0.5, tick: 0.5 } });
    out[tag] = { x: { ticks: p.xt, labels: p.labels ? p.labels.x : [] }, y: { ticks: p.yt, labels: p.labels ? p.labels.y : [] } };
  }
  return out; })()`);
info.composer = comp;
for (const [tag] of BOXES) ok(`the panel over ${tag}: on each axis the labels differ and read back to their ticks`, axisOk(comp[tag] && comp[tag].x) && axisOk(comp[tag] && comp[tag].y), comp[tag]);
// ---- the classic Image figure of points only
for (const [focus, lang] of [[0, 'en'], [0, 'ru'], [2, 'en']]) {
  await open(`ftf${focus}${lang}${Date.now()}`, focus, lang);
  const f = await ev(`await (async () => { try { const f = await __cmwFig.build({ for: 'article', cols: 2, capInImage: false }); return f ? { panels: f.info.panels, boxes: f.info.boxes, ticks: f.info.ticks } : null; } catch (e) { return { err: String(e).slice(0, 300) }; } })()`, 180000);
  const n = `points only, focus ${focus}, ${lang}`;
  info[n] = f;
  ok(`${n}: the figure has two panels (control)`, !!f && !f.err && JSON.stringify(f.panels) === JSON.stringify(['L', 'R']), f);
  for (const sd of ['L', 'R']) {
    const t = f && f.ticks && f.ticks[sd], b = f && f.boxes && f.boxes[sd];
    const lab = (a) => a && { ticks: a.ticks, labels: a.labels.map((l) => (lang === 'ru' ? l.replace('{,}', '.') : l)) };
    ok(`${n}: panel ${sd === 'L' ? '(a)' : '(b)'}'s axes print different labels, each reading back to its tick`, !!t && axisOk(lab({ ticks: t.x, labels: t.labels.x })) && axisOk(lab({ ticks: t.y, labels: t.labels.y })), t);
    ok(`${n}: panel ${sd === 'L' ? '(a)'  : '(b)'}'s window is not a sliver`, !!b && Math.min(b.x1 - b.x0, b.y1 - b.y0) >= LONE_MIN * Math.max(1, Math.abs(b.x0), Math.abs(b.y0)), b);
    if (lang === 'ru' && t) ok(`${n}: panel ${sd === 'L' ? '(a)' : '(b)'}'s labels have a decimal comma where they have decimals`, [...t.labels.x, ...t.labels.y].every((l) => !/\./.test(l)), t.labels);
  }
}
return { pass: fails.length === 0, fails, info };
