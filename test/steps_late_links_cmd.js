// The steps view's waits where programs link in the background and land late, as on a GPU machine (Apple's Metal): each
// program's link reads not complete for LINK_MS after it began (test/lib/late_links.js, installed before every page this
// suite opens), on any back end. A frame drawn while its program links is a stand-in, and every wait below must last
// until the frame drawn with the program:
// - the glide of the partial sums of the exponential (a NEWT step the inverse pass draws, Everywhere, sheets off) held at
//   u = 0.5: the first frame recorded there is the inverse pass's (the glide waits on its first plane for the program its
//   own frame draws with, svLinkHold, of the frame's B class), never the carried mesh's for "inverse pass pending";
// - colour plane 0, plane 1 parked: once __cmwSteps().ready, plane 1 is drawn by the inverse pass (ready counts the
//   chain's programs still linking, those started by a draw included, and the left pane's frame after one lands);
// - control: the links were late (__lateLinks: links made, and status polls answered not yet);
// - on a fresh page, colour plane 0, plane 1 parked at once and ready sampled in the page until plane 1 is the inverse
//   pass's: ready never reads true while plane 1 is the carried meshes' stand-in (ready counts the inverse program that
//   plane's frame asked for), nor before the left pane has drawn plane 1 again after a program landed;
// - on a fresh page whose idle callbacks run only for their timeout, with no time left (as where every frame takes past
//   its deadline: a software renderer's frames under a held play), ▶ pressed at once after loading the partial sums: the
//   play waits on plane 0 for the glide's programs, then for its pole tracks, which no idle moment makes (svLinkHold);
//   the frames that hold it make them, so the play reaches plane 1. Its place is polled in the page (__cmwSvX) with no
//   frame asked for; control: the tracks were made by those frames, none by the idle job.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const names = exampleNames();
// ms a link reads not complete; the waits (ms) for a page, for the chain's programs, for a glide's frame and for a play
// to its end
const LINK_MS = 2500, READY_MS = 60000, WARM_MS = 120000, FRAME_MS = 120000, PLAY_MS = 120000;
const NEWT_EX = 'Partial sums of the exponential', GLIDE_U = 0.5;
const loaded = 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR';
// (a page whose frames leave no idle moment: each idle callback runs for its timeout, at once when it has none, with no
// time left)
const NO_IDLE = 'window.requestIdleCallback = (f, o) => setTimeout(() => f({ didTimeout: true, timeRemaining: () => 0 }), (o && o.timeout) || 0);';
// a fresh page (its storage namespace ns) with the partial sums loaded, sheets off, Everywhere
const partialSums = async (ns) => {
  await go(`${BASE}/test.html?ns=${ns}${Date.now()}&lang=en&view=steps`);
  await settled({ max: READY_MS, until: loaded });
  await ev(`__cmwExample(${names.indexOf(NEWT_EX)}), 1`);
  await ev("__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all' }), 1");
};
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${LINK_MS};\n` + fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8') });
try {
  await view(1440, 900, false, false);
  logs(true);
  // the partial sums: the glide's first frame at GLIDE_U, then plane 1 parked past colour plane 0
  {
    ok(`${NEWT_EX}: the example is found`, names.indexOf(NEWT_EX) >= 0, names.length);
    await partialSums('ll');
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
  const late = await ev('window.__lateLinks || null');
  ok('control: the links were late (links made, and status polls that found one not complete)', !!late && late.links > 0 && late.early > 0, late);
  info.late = late;
  // the partial sums again on a fresh page, colour plane 0, plane 1 parked at once (its inverse program first asked for
  // by that plane's own frame): from just before the park until plane 1 is the inverse pass's and ready, __cmwSteps() is
  // sampled in the page on every animation frame, every few ms and right after each program of the main panes lands
  // (GLR.onReady, after the app's own handler). No sample may read ready while plane 1 is drawn by the carried meshes
  // (the stand-in while its inverse program links), nor while the left pane has drawn no frame of plane 1 since a
  // program landed (__cmwSteps().rest: the record of the last frame at rest, a new object for each such frame)
  {
    await partialSums('llr');
    await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
    await ev('__cmwSteps({ T: 0 }), __cmwSteps({ park: 0 }), 1');
    await settled({ max: READY_MS, until: '__cmwSteps().x === 0 && __cmwSteps().ready.ready' });
    await ev(`(() => {
      const s = window.__llSample = { n: 0, landed: 0, land: null, mesh: [], stale: [], on: true };
      const look = () => {
        const q = __cmwSteps(), r = q.rest;
        s.n++;
        if (!q.ready.ready) return;
        const at = { t: Math.round(performance.now()), x: q.x, rest: r && Object.assign({}, r), parts: JSON.parse(JSON.stringify(q.ready.parts)) };
        if (q.x === 1 && r && r.a === 1 && r.path === 'mesh' && s.mesh.length < 5) s.mesh.push(at);
        if (s.land && r === s.land.rest && s.stale.length < 5) s.stale.push(Object.assign(at, { land: s.land.t }));
      };
      const frame = () => { if (s.on) { look(); requestAnimationFrame(frame); } };
      const onReady = GLR.onReady;
      GLR.onReady = (w) => { const r = onReady(w); if (s.on && (!w || w.main)) { s.landed++; const q = __cmwSteps(); s.land = q.x === 1 && q.rest && q.rest.a === 1 ? { t: Math.round(performance.now()), rest: q.rest } : null; look(); } return r; };
      s.timer = setInterval(() => { if (s.on) look(); }, 4);
      requestAnimationFrame(frame);
      return 1;
    })()`);
    await ev('__cmwSteps({ park: 1 }), 1');
    const r3 = await settled({ max: WARM_MS, until: '(() => { const q = __cmwSteps(); return q.x === 1 && q.ready.ready && !!q.rest && q.rest.a === 1 && q.rest.path === "inverse"; })()' });
    const smp = await ev('(() => { const s = window.__llSample; s.on = false; clearInterval(s.timer); return { n: s.n, landed: s.landed, mesh: s.mesh, stale: s.stale }; })()');
    const got = { samples: smp && { n: smp.n, landed: smp.landed }, wait: r3 };
    ok(`${NEWT_EX}, colour plane 0, plane 1 parked at once: ready never reads true while plane 1 is the carried meshes' stand-in`, r3.ok && !!smp && smp.n > 0 && smp.mesh.length === 0, Object.assign({ mesh: smp && smp.mesh }, got));
    ok(`${NEWT_EX}, colour plane 0, plane 1 parked at once: ready never reads true before the left pane has drawn a frame since a program landed`, r3.ok && !!smp && smp.landed > 0 && smp.stale.length === 0, Object.assign({ stale: smp && smp.stale }, got));
    info.park = got.samples;
  }
  // the partial sums on a fresh page with no idle moment, ▶ pressed at once after loading (sheets off, Everywhere): the
  // play is held on plane 0 while the glide's programs link, then while its pole tracks are not made; the tracks' steps
  // are counted where they are made (__svPathStats: by a frame, by the idle job)
  {
    const noIdle = await send('Page.addScriptToEvaluateOnNewDocument', { source: NO_IDLE });
    try {
      await partialSums('llp');
      await ev('globalThis.__svPathStats = {}, __cmwSteps({ play: true }), 1');
      const r4 = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() === 1' });
      const st = await ev('(() => { const s = globalThis.__svPathStats || {}; globalThis.__svPathStats = null; return { frame: s.poleFrameSteps || 0, idle: s.poleIdleSteps || 0 }; })()');
      const got = { wait: r4, steps: st, x: await ev('__cmwSvX()') };
      ok(`${NEWT_EX}, ▶ at once with no idle moment: the play reaches plane 1 (the frames that hold it for its pole tracks make them)`, r4.ok, got);
      ok(`${NEWT_EX}, ▶ at once with no idle moment, control: the play's pole tracks were made by its held frames, none by the idle job`, st.frame > 0 && st.idle === 0, got);
      info.play = got;
    } finally {
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: noIdle.identifier });
    }
  }
} finally {
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
}
return { pass: fails.length === 0, fails, info };
