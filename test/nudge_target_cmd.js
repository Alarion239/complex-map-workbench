// A target (a point of the w-plane, the row "Point p") is nudged by the arrow keys the way a shape is (#1907): one press is one step of the
// grid of the plane shown, ten with Shift, and the toast the run ends with names it as its row does and gives its place ("Moved Point p to
// 0.500, 0.000."), not another shape's name ("Moved z₀."). In the steps view the plane on screen is the one camera every plane shares
// (S.srcView); in the classic view a target is in Y's pane, with its own view. The step is read as what the plane's own scale says
// (the page's Constr.gridStep of the pixels a unit takes there), so it holds wherever the view is set.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const WARM_MS = 120000, SAID_MS = 8000;
const ROW = `document.querySelector('#shapeList .shape[data-id="t1"] .shape-name')`;
const STATE = { v3: true, v4: true, v5: true, v6: true, alpha: 1, shapes: [], targets: [{ id: 't1', kind: 'point', p: [0, 0], ci: 2, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 40 } };
const target = () => ev(`(() => { const t = __cmwShapes().targets.find((x) => x.id === 't1'); return t ? t.p : null; })()`);
// the grid step of the plane the target is on: the pixels a unit takes there (the plane menu's w2s on the side) through the page's own gridStep
const stepOf = (side) => ev(`(() => { const m = __cmwPlaneMenu(), a = m.w2s('${side}', 0, 0), b = m.w2s('${side}', 1, 0); return Constr.gridStep(Math.hypot(b[0] - a[0], b[1] - a[1])); })()`);
const said = (want) => ev(`new Promise((res) => { const t0 = performance.now(); let last = null; const f = () => { for (const x of document.querySelectorAll('#toastHost .toast')) { const t = x.textContent; if (/^Moved /.test(t)) { last = t; if (t.indexOf(${JSON.stringify(want)}) >= 0) return res(t); } } if (performance.now() - t0 > ${SAID_MS}) res(last); else setTimeout(f, 50); }; f(); })`);
const leg = async (view) => {
  await seed(`ntg${view}`, STATE);
  await nav(`http://localhost:${PORT}/test.html?ns=ntg${view}&view=${view}`);
  await settled({ max: WARM_MS, only: true, until: `typeof __cmwShapes === 'function' && __cmwShapes().targets.length === 1` });
  if (view === 'steps') { await ev(`(__cmwSteps({ go: 1, now: true }), 1)`); await settled({ max: WARM_MS, until: '__cmwSteps().i === 1 && !__cmwSteps().moving' }); }
  await settled({ only: true, floor: 300, max: WARM_MS });
  const side = view === 'steps' ? 'L' : 'R', step = await stepOf(side), name = await ev(`(() => { const r = ${ROW}, k = r && r.querySelector('.k'); return k ? k.textContent.trim() : null; })()`);
  info[view] = { step, name };
  ok(`${view}: the target's row is "Point p"`, name === 'Point p', name);
  const p0 = await target();
  await ev(`${ROW}.focus(); 1`);
  await key('Enter'); await settled({ only: true, max: WARM_MS, until: `${ROW}.getAttribute('aria-pressed') === 'true'` });
  await key('ArrowRight');
  const p1 = await target();
  info[view].moved = [p0, p1];
  ok(`${view}: one → moves the target by the grid step of its plane (${step})`, !!p1 && Math.abs(p1[0] - p0[0] - step) < 1e-9 && Math.abs(p1[1] - p0[1]) < 1e-9, { p0, p1, step });
  await key('ArrowUp', 8);
  const p2 = await target();
  ok(`${view}: Shift ↑ moves it ten steps`, !!p2 && Math.abs(p2[1] - p1[1] - 10 * step) < 1e-9, { p1, p2, step });
  await key('ArrowDown', 8); await key('ArrowLeft');
  // (the toast of the run's end: its place is the target's now; a toast an earlier press made says another place)
  const back = await target();
  const w = await said(`Moved Point p to ${back[0].toFixed(3)}, ${back[1].toFixed(3)}.`);
  info[view].said = w;
  ok(`${view}: the toast names the target as its row does ("Point p") and gives its place`, w === `Moved Point p to ${back[0].toFixed(3)}, ${back[1].toFixed(3)}.`, { w, back });
};
await view(1280, 800, false, false);
await leg('steps');
await leg('classic');
return { pass: fails.length === 0, fails, info };
