// The steps view between two planes: the scale badge and the axes read the view the frame is drawn with (#2321). A glide frozen
// between the planes with the clock hook, All at once (mode 3) and a step at a time (mode 1), each frozen once the thread is past u = 0.7 (the frozen frames lie a little past it, so the two are
// not at one and the same u), at the source view's
// scale 80 and 400: the window the pane's labels read (__cmwSteps().win, which is leftView()), the view the frame was drawn with (the
// glide record's view) and the scale badge ("N / div"; the badge is `scaleText(pane)`, Axes.niceStep(110 / the view's scale)) are
// the source view's in both modes: the badge reads "1 / div" at scale 80 and "0.2 / div" at scale 400, the same in the two modes.
// (A frame held between two planes by __cmwSteps({ x }) is a different state: the hook moves the thread's position and nothing else,
// so the frame is drawn with the source view while the labels read the plane's own view, V.left; steps_all_exact compares such frames
// with frozen glide frames and relies on that. The glide is frozen with `clock` to read labels against the picture.)
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const MUL = (c) => ({ type: 'mul', params: { c }, on: true });
const GLIDE_CLOCK_MS = 20, FREEZE_CLOCK_MS = 1e-9;   // the glide's time a frame while it runs, and once frozen
const START_WAIT = 30000, GLIDE_WAIT = 180000, DRAWN_WAIT = 120000;   // ms
await view(1200, 800, false, false);
const drawn = `(() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()`;
const rec = () => ev('(() => { const q = __cmwSteps(); return { x: q.x, all: q.all, mode: q.between && q.between.mode, rec: q.glide && { all: q.glide.all, u: q.glide.u, path: q.glide.path, reason: q.glide.reason } }; })()');
const open = async (steps, s, homAll, alpha = 1) => {
  const ns = 'svae' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, alpha: 1, shapes: [], steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s }, homAll };
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ max: START_WAIT, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')` });
  await adopted();
  await ev(`__cmwSet('alpha', ${alpha}), __cmwSet('morphPaths', false), 1`);
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true })`); await settled({});
  await ev('__cmwSteps({ T: 0 })'); await settled({});
  return ev('__cmwSteps().planes.length - 1');
};
// at rest on plane i, its frame drawn
const rest = async (i) => { await ev(`__cmwSteps({ clock: 0 }), __cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: DRAWN_WAIT, until: `!__cmwSteps().moving && __cmwSvFixed() && ${drawn}` }); };
// the All-at-once glide from plane z to plane n frozen once the thread is past x
const frozenPast = async (n, x) => {
  await rest(0);
  await ev(`__cmwSteps({ clock: ${GLIDE_CLOCK_MS} })`); await ev(`__cmwSteps({ go: ${n} })`);
  await settled({ max: GLIDE_WAIT, until: `__cmwSteps().x > ${x}`, only: true });
  await ev(`__cmwSteps({ clock: ${FREEZE_CLOCK_MS} })`);
  await settled({ max: DRAWN_WAIT, until: drawn });
  return rec();
};
const POLY = { type: 'poly', params: { co: '1, 0, 0, 0, 1, 0' }, on: true };
// the labels' window, the view the frame was drawn with, the scale badge and where the thread is
const READ = `(() => {
  const q = __cmwSteps(), r3 = (v) => v && [v.cx, v.cy, v.s].map((x) => +(+x).toFixed(3));
  return { x: +q.x.toFixed(4), mode: q.between && q.between.mode, win: q.win.map((x) => +x.toFixed(3)), drawn: q.glide && r3(q.glide.view), badge: [...document.querySelectorAll('.rv')].map((e) => e.textContent.trim()).find((t) => / \\/ div$/.test(t)) || null };
})()`;
const SCALES = [80, 400], U = 0.7;
const BADGE = { 80: '1 / div', 400: '0.2 / div' };   // Axes.niceStep(110 / 80) = 1, niceStep(110 / 400) = 0.2
const sameView = (a, b) => !!a && !!b && a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) < 1e-6);
for (const s of SCALES) {
  // the glide frozen between the planes, both modes past u (All at once: [f, 1 z], the span's progress x / 2; a step at a time: [f])
  await open([POLY, MUL('1')], s, true, 1);
  const g = await frozenPast(2, 2 * U);
  await settled({ max: DRAWN_WAIT, until: drawn });
  const all = await ev(READ);
  await open([POLY], s, false, 1);
  await frozenPast(1, U);
  await settled({ max: DRAWN_WAIT, until: drawn });
  const one = await ev(READ);
  info[`frozen, s ${s}`] = { g: g.mode, all, one };
  ok(`s ${s}, a glide frozen between the planes: All at once is mode 3 and a step at a time mode 1`, all.mode === 3 && one.mode === 1, [all.mode, one.mode]);
  ok(`s ${s}, All at once frozen: the labels' window and the drawn view are the source view`, sameView(all.win, [0, 0, s]) && sameView(all.drawn, [0, 0, s]), all);
  ok(`s ${s}, a step at a time frozen: the labels' window and the drawn view are the source view`, sameView(one.win, [0, 0, s]) && sameView(one.drawn, [0, 0, s]), one);
  ok(`s ${s}, the scale badge reads "${BADGE[s]}" in All at once and in a step at a time`, all.badge === BADGE[s] && one.badge === BADGE[s], [all.badge, one.badge]);
}
return { pass: fails.length === 0, fails, info };
