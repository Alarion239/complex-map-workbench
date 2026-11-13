// With Outlines off the steps view draws no curve on a colour plane, but the selected shape and a curve being drawn
// still show.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'curves_kit.js'), 'utf8'))({ ev, send, go, load, shot, settled, view, fs, DIR, ok, R });
const { BASE, settle } = K;
await view(1440, 900);
await load('curves-outline-off', Object.assign({}, BASE, {
  outline: false,
  shapes: [{ id: 'c0', kind: 'circle', c: [0, 0], r: 1.7, ci: 0, visible: true }],
  targets: [], steps: [{ type: 'pown', params: { n: 2 }, on: true }], srcView: { cx: 0, cy: 0, s: 80 },
}));
await settle();
const W = (x, y) => ev(`__cmwW2S('L', ${x}, ${y})`);
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
// the pixels of a pane's canvas (the colour plane's, or the overlay's with the handles and the draft)
const snap = (id = 'canvasL') => ev(`(() => { const c = document.getElementById('${id}'); const s = document.createElement('canvas'); s.width = c.width; s.height = c.height; const x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0); return Array.from(x.getImageData(0, 0, s.width, s.height).data); })()`);
// the ink the selection adds on plane k: pixels that change by more than 90 (sum of |dRGB|), and how many of them lie
// within 6 px of the circle of radius r about the origin
const selectionInk = async (name, k, r) => {
  await ev(`__cmwSteps({ go: ${k}, now: true })`);
  await ev(`__cmwSelect(null)`);
  await settle();
  const off = await snap();
  await ev(`__cmwSelect('c0')`);
  await settle();
  const on = await snap();
  const g = await ev(`(() => { const c = document.getElementById('canvasL'), b = c.getBoundingClientRect(), o = __cmwW2S('L', 0, 0), e = __cmwW2S('L', 1, 0); return { w: c.width, r: [b.left, b.top], o, s: e[0] - o[0], k: c.width / b.width }; })()`);
  let ink = 0, near = 0;
  for (let i = 0; i < off.length / 4; i++) {
    if (Math.abs(on[4 * i] - off[4 * i]) + Math.abs(on[4 * i + 1] - off[4 * i + 1]) + Math.abs(on[4 * i + 2] - off[4 * i + 2]) <= 90) continue;
    ink++;
    const x = ((i % g.w) + 0.5) / g.k + g.r[0] - g.o[0], y = (Math.floor(i / g.w) + 0.5) / g.k + g.r[1] - g.o[1];
    if (Math.abs(Math.hypot(x, y) - r * g.s) <= 6) near++;
  }
  R[name] = { ink, near };
  return R[name];
};
// (the shape is the circle |z| = 1.7: on plane 0 it is that circle, on the last plane, after z², the circle |w| = 2.89)
const p0 = await selectionInk('selected on plane 0', 0, 1.7);
ok('Outlines off: the selected shape\'s curve shows on its plane', p0.ink > 300 && p0.near >= 0.95 * p0.ink, p0);
const last = Math.max(...(await ev(`__cmwSteps().planes`)));
const p1 = await selectionInk('selected on the last plane', last, 1.7 * 1.7);
ok('Outlines off: the selected shape\'s image shows on the colour plane', p1.ink > 300 && p1.near >= 0.95 * p1.ink, p1);
// a curve being drawn shows too
await ev(`__cmwSteps({ go: 0, now: true })`);
await ev(`__cmwSelect(null)`);
await clickSel('#tools .tool[data-tool="circle"]');
await settle();
const a = await W(-3, 2.2), b = await W(-2.2, 2.2);
await mouse('mouseMoved', a[0], a[1]);
await mouse('mousePressed', a[0], a[1], 1);
await mouse('mouseReleased', a[0], a[1]);
const before = await snap('overlayL');
await mouse('mouseMoved', b[0], b[1]);
await settle({ floor: 300 });
const after = await snap('overlayL');
let changed = 0;
for (let i = 0; i < before.length; i += 4) if (Math.abs(after[i] - before[i]) + Math.abs(after[i + 1] - before[i + 1]) + Math.abs(after[i + 2] - before[i + 2]) > 90) changed++;
R.draft = { changed };
ok('Outlines off: the circle being drawn shows', changed > 100, R.draft);
R.logs = (await logs()).filter((l) => /EXC|error/i.test(l.t));
ok('no page errors (the selected shape, the draft)', !R.logs.length, R.logs);
return { pass: !fails.length, fails, results: R };
