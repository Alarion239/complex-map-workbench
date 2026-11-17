// A bare glide frame records the pane's GL status (#1566): in the steps view a frame in bare mode (the colour layer alone) records the pane's status
// (glStatusNote), so __cmwPaneStatus('L'), and settled() with it, read the frame being held, not the last frame at rest, through a scrub.
// With the links landing late (test/lib/late_links.js: a program reads not complete for 2.5 s after its link, as on a GPU machine), the partial sums
// of the exponential (a NEWT step the inverse pass draws), Everywhere and sheets off, bare:
// - a scrub to 0.5 and, 1.2 s later, to 0.7, then held: each frame of the hold records the pane's status (its record is newer than the scrub that
//   asked for the frame);
// - the record of the hold is not the old "compiling": once the links have landed and the frame is drawn with the program, the status reads
//   neither pending nor compiling while the glide is held;
// - control: the links were late (links made, and polls answered not yet).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }. In the steps view (ci/suite_views.js).
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const names = exampleNames();
const LINK_MS = 2500, READY_MS = 60000, WARM_MS = 120000, FRAME_MS = 120000, SECOND_SCRUB_AFTER_MS = 1200, HOLD_MS = 20000;
const EX = 'Partial sums of the exponential', U1 = 0.5, U2 = 0.7;
const loaded = 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwPaneStatus === "function" && !!window.GLR';
const glideAt = (u) => `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${u}) < 1e-9; })()`;
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${LINK_MS};\n` + fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8') });
try {
  await view(1440, 900, false, false);
  logs(true);
  const ex = names.indexOf(EX);
  ok(`${EX}: the example is found`, ex >= 0, names.length);
  await go(`${BASE}/test.html?ns=bst${Date.now()}&lang=en&view=steps`);
  await settled({ max: READY_MS, until: loaded });
  await ev(`__cmwExample(${ex}), 1`);
  await adopted();
  await ev("__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all' }), 1");
  await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
  await ev('__cmwSteps({ park: 0 }), 1');
  await settled({ max: READY_MS, until: '__cmwSteps().x === 0 && __cmwSteps().ready.ready' });
  // the scrub to U1 at once, to U2 1.2 s later; each asks at a time of the page's clock, and the status of the hold must be newer than the last
  const t1 = await ev(`(() => { const t = performance.now(); __cmwSteps({ x: ${U1} }); return t; })()`);
  await settled({ max: FRAME_MS, until: glideAt(U1) });
  const s1 = await ev(`__cmwPaneStatus('L')`);
  ok(`a bare glide frame at u = ${U1} records the pane's status (the record is newer than the scrub)`, !!s1 && s1.t >= t1, { t1, status: s1 });
  await sleep(SECOND_SCRUB_AFTER_MS);
  const t2 = await ev(`(() => { const t = performance.now(); __cmwSteps({ x: ${U2} }); return t; })()`);
  await settled({ max: FRAME_MS, until: glideAt(U2) });
  const s2 = await ev(`__cmwPaneStatus('L')`);
  ok(`a bare glide frame at u = ${U2} records the pane's status (the record is newer than the second scrub)`, !!s2 && s2.t >= t2, { t2, status: s2 });
  // held: the programs link and land, the frame is drawn with them, and the status of that frame is the pane's
  const hold = await settled({ max: HOLD_MS, panes: false, until: `(() => { const s = __cmwPaneStatus('L'); return !!s && !s.pending && !s.compiling && __cmwSteps().glide && __cmwSteps().glide.path === 'inverse'; })()` });
  const s3 = await ev(`__cmwPaneStatus('L')`);
  const g = await ev(`(() => { const g = __cmwSteps().glide; return g ? { u: g.u, path: g.path } : null; })()`);
  ok('held at the scrub, the pane\'s status reads neither pending nor compiling once the frame is the inverse pass\'s', hold.ok, { status: s3, glide: g, wait: hold });
  info.status = { s1, s2, s3, g };
  const late = await ev('window.__lateLinks || null');
  ok('control: the links were late (links made, and status polls that found one not complete)', !!late && late.links > 0 && late.early > 0, late);
  info.late = late;
  const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
  ok('no errors', !errs.length, errs);
} finally {
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
}
return { pass: fails.length === 0, fails, info };
