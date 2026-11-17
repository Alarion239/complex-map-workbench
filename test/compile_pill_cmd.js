// The "Compiling…" pill reads on any backdrop (#1622), behind ?view=steps with the chain's link held (?glhold): while a colour
// plot's program links, the left pane's lower left corner says "Compiling…" in a small pill. Under Inside regions that corner is
// paper (the plane outside the regions), where a pill filled with the surface colour is the paper's own colour in the light theme
// and close to it in the dark one, so the text floats on the plot. The pill reads when its edge or its fill differs from what is
// around it by 1.5 : 1 (contrast ratio of the colours on the page, measured on a screenshot): in the light and dark themes, Inside
// regions (paper) and Everywhere (the colour plot's stand-in).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const MIN_RATIO = 1.5;
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
await view(1440, 900, false);
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
const ns = 'cpl' + Date.now();
const loaded = "typeof __cmwSteps === 'function' && !!window.GLR && typeof __cmwCompileBox === 'function'";
const rectOf = () => ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
// (a disc on z: Inside regions colours only it, the pane's lower left corner is paper)
await seed(ns, { steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }], shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 0, T: 1, scope: 'in', surf: 'plane' } });
await go(`${base}/test.html?ns=${ns}&glhold`);
await settled({ max: 30000, panes: false, until: loaded });
// the pill's pixels: at its left edge and at its top edge, from outside to inside: [outside, on the edge, inside]
const read = async () => {
  const box = await ev('__cmwCompileBox()');
  if (!box) return null;
  const r = await rectOf(), p = await img(r);
  const cy = box.y + box.h / 2, cx = box.x + box.w / 2;
  // (the pixel that holds a point of the pane: the box's edges lie in the middle of a pixel row and column)
  const at = (x, y) => p.at(Math.floor(x), Math.floor(y));
  const left = [at(box.x - 3, cy), at(box.x, cy), at(box.x + 4, cy)], top = [at(cx, box.y - 3), at(cx, box.y), at(cx, box.y + 3)];
  const reads = ([out, edge, inn]) => Math.max(ratio(edge, out), ratio(inn, out));
  return { box, left, top, ratio: Math.min(reads(left), reads(top)) };
};
// (the state read once the frame is the same twice in a row: the theme and scope changes redraw the pane)
const stable = async () => {
  let prev = null, cur = null;
  const w = await settled({ only: true, max: 20000, panes: false, until: `(() => { const s = __cmwPaneStatus('L'); return !!s && !!s.compiling && !!__cmwCompileBox(); })()` });
  if (!w.ok) return null;
  for (let i = 0; i < 40; i++) {
    cur = await read();
    if (cur && prev && JSON.stringify(cur.left) === JSON.stringify(prev.left) && JSON.stringify(cur.top) === JSON.stringify(prev.top)) return cur;
    prev = cur;
    await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  }
  return cur;
};
const setTheme = (t) => ev(`(() => { document.documentElement.setAttribute('data-theme', '${t}'); return 1; })()`);
for (const scope of ['in', 'all']) {
  await ev(`__cmwSteps({ go: 0, now: true, scope: '${scope}' }), 1`);
  for (const theme of ['light', 'dark']) {
    await setTheme(theme);
    const m = await stable();
    const name = `${theme}, ${scope === 'in' ? 'Inside regions' : 'Everywhere'}`;
    info[name] = m && { ratio: +m.ratio.toFixed(2), left: m.left, top: m.top };
    ok(`${name}: the pill is there`, !!m, m);
    ok(`${name}: the pill reads against what is around it (at least ${MIN_RATIO} : 1)`, !!m && m.ratio >= MIN_RATIO, m && { ratio: +m.ratio.toFixed(2), left: m.left, top: m.top });
  }
}
return { pass: fails.length === 0, fails, info };
