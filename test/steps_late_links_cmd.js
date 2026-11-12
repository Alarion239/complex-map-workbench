// The steps view's waits where programs link in the background and land late, as on a GPU machine (Apple's Metal): each
// program's link reads not complete for LINK_MS after it began (test/lib/late_links.js, installed before every page this
// suite opens), on any back end. A frame drawn while its program links is a stand-in, and every wait below must last
// until the frame drawn with the program:
// - the glide of the partial sums of the exponential (a NEWT step the inverse pass draws, Everywhere, sheets off) held at
//   u = 0.5: the first frame recorded there is the inverse pass's (the glide waits on its first plane for the program its
//   own frame draws with, svLinkHold, of the frame's B class), never the carried mesh's for "inverse pass pending";
// - colour plane 0, plane 1 parked: once __cmwSteps().ready, plane 1 is drawn by the inverse pass (ready counts the
//   chain's programs still linking, those started by a draw included, and the left pane's frame after one lands);
// - Newton's method for z³ − 1 repeated twenty times (a REPT plan, Inside regions), plane 1 parked: once the parked
//   settle is met (ready and the left pane's frame not pending), the REPT draw has composed its picture
//   (__cmwRept({ tileStats }): a composite) and no inverse pass threw (its query program links late too);
// - control: the links were late (__lateLinks: links made, and status polls answered not yet).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const names = exampleNames();
// ms a link reads not complete; the waits (ms) for a page, for the chain's programs, for a glide's frame and for the parked plane
const LINK_MS = 2500, READY_MS = 60000, WARM_MS = 120000, FRAME_MS = 120000, PARKED_MS = 60000;
const NEWT_EX = 'Partial sums of the exponential', REPT_EX = 'Newton’s method for z³ − 1', GLIDE_U = 0.5;
const PARKED_DRAWN = "__cmwSteps().ready && __cmwSteps().ready.ready && !(__cmwPaneStatus('L') || { pending: true }).pending";
const loaded = 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR';
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${LINK_MS};\n` + fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8') });
try {
  await view(1440, 900, false, false);
  logs(true);
  // the partial sums: the glide's first frame at GLIDE_U, then plane 1 parked past colour plane 0
  {
    const ex = names.indexOf(NEWT_EX);
    ok(`${NEWT_EX}: the example is found`, ex >= 0, names.length);
    await go(`${BASE}/test.html?ns=ll${Date.now()}&lang=en&view=steps`);
    await settled({ max: READY_MS, until: loaded });
    await ev(`__cmwExample(${ex}), 1`);
    await ev("__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all' }), 1");
    const r0 = await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
    await ev('__cmwSteps({ park: 0 }), 1');
    await settled({ max: READY_MS, until: '__cmwSteps().x === 0 && __cmwSteps().ready.ready' });
    await ev(`__cmwSteps({ x: ${GLIDE_U} }), 1`);
    const r1 = await settled({ max: FRAME_MS, until: `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${GLIDE_U}) < 1e-9; })()` });
    const g = await ev('(() => { const g = __cmwSteps().glide; return g ? { b: g.b, u: g.u, path: g.path, reason: g.reason } : null; })()');
    ok(`${NEWT_EX} at u = ${GLIDE_U}: the first frame there is the inverse pass's, not a stand-in`, r1.ok && !!g && g.path === 'inverse' && g.b === 1, { g, wait: r1 });
    await ev('__cmwSteps({ T: 0 }), 1');
    await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
    await ev('__cmwSteps({ park: 1 }), 1');
    const r2 = await settled({ max: READY_MS, until: '__cmwSteps().x === 1 && __cmwSteps().ready.ready' });
    const rest = await ev('JSON.parse(JSON.stringify(__cmwSteps().rest))');
    ok(`${NEWT_EX}, colour plane 0: once ready, the parked plane 1 is drawn by the inverse pass`, r2.ok && !!rest && rest.a === 1 && rest.path === 'inverse', { rest, wait: r2 });
    info.newt = { ready: r0, glide: g, rest };
  }
  // the repeated Newton step, Inside regions, plane 1 parked
  {
    const ex = names.indexOf(REPT_EX);
    ok(`${REPT_EX}: the example is found`, ex >= 0, names.length);
    await go(`${BASE}/test.html?ns=lr${Date.now()}&lang=en&view=steps`);
    await settled({ max: READY_MS, until: loaded });
    await ev(`__cmwExample(${ex}), 1`); await settled({ max: READY_MS, panes: false });
    await ev("__cmwSteps({ scope: 'in' }), 1"); await settled({ max: READY_MS, panes: false });
    await ev('__cmwRept({ tileStats: true })');
    await ev('__cmwSteps({ go: 1, now: true }), 1'); await settled({ max: READY_MS, until: '!__cmwSteps().anim && !__cmwSteps().play' });
    const st = await settled({ max: PARKED_MS, until: PARKED_DRAWN });
    const tiles = await ev('__cmwRept({ tileStats: true })');
    const threw = logs(false).map((l) => String(l.m || '')).filter((m) => /inverse pass failed/.test(m)).map((m) => m.slice(0, 200));
    ok(`${REPT_EX}, Inside regions: the parked settle is met within ${PARKED_MS} ms`, st.ok, st.busy);
    ok(`${REPT_EX}, Inside regions: once settled, the REPT draw has composed the parked plane`, !!tiles && tiles.composites >= 1, tiles);
    ok(`${REPT_EX}, Inside regions: no inverse pass threw`, threw.length === 0, threw);
    info.rept = { settle: st, tiles };
  }
  const late = await ev('window.__lateLinks || null');
  ok('control: the links were late (links made, and status polls that found one not complete)', !!late && late.links > 0 && late.early > 0, late);
  info.late = late;
} finally {
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
}
return { pass: fails.length === 0, fails, info };
