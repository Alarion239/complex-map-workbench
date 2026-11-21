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
//   plane's frame asked for), nor before the left pane has drawn plane 1 again after a program landed; then at rest,
//   until the app's warm-up has gone through its groups and nothing links: ready stays true (the programs of views no
//   pane shows, the globes' and the Landscape's, are no part of it), no program links twice, and no Landscape program
//   is started in map mode 1 (no pane draws one). Twice: with the warm-up of the glides at rest off (__cmwSteps' warmInv),
//   so that plane 1's inverse program is first asked for by its own frame and lands after the park; and as shipped, the
//   park once that warm-up has linked the glide 0 -> 1's programs at rest: plane 1's first frame is then already the
//   inverse pass's;
// - on a fresh page, the Landscape shown while the warm-up links its programs: from the pane's first frame of it on,
//   they are the pane's (GLR.pending() reads none of them offView) and ready counts them (its programs part is never
//   complete while one of them links);
// - on a fresh page whose idle callbacks run only for their timeout, with no time left (as where every frame takes past
//   its deadline: a software renderer's frames under a held play), ▶ pressed at once after loading the poles of the Gamma
//   function (a Newton step whose poles move with t, Inside regions): the play waits on plane 0 for the glide's
//   programs, then for its pole tracks, which no idle moment makes (svLinkHold); the frames that hold it make them, so
//   the play reaches plane 1, and every glide frame the inverse pass draws after the hold has the whole tracks' key (none
//   the poles a frame's own search found before them). Its place is polled in the page (__cmwSvX) with no frame asked
//   for; control: those frames made the tracks;
// - on a fresh page with no idle moment for the app's jobs, ▶ pressed on the poles of Γ with a frame's pole budget of a
//   microsecond, so that the play stays held for its pole tracks: while nothing changes, the browser's idle callbacks
//   are given time and the left pane draws at most a tenth of the animation frames (the held frame stays on the pane),
//   the frame kept there is the one a frame asked for with no change draws afresh, and once the budget is given back
//   the play reaches plane 1;
// - z + 1/z, then z⁴ + z, on a fresh page whose links land seconds late, ▶ pressed from plane 0: the play goes through the
//   first glide and is held a second time, for the programs of the glide into plane 2; while that hold lasts with
//   nothing changed (the play waiting where it is), the browser's idle callbacks are given time and the left pane draws
//   at most a tenth of the animation frames, and once the links land the play reaches plane 2; a glide from plane 2 to
//   plane 0 on such a page waits for its glides' programs, its thread never going back, and reaches plane 0; and a play
//   put on the globe half way through the first glide and back on the plane past plane 1 never goes back either;
// - exp(sin z) typed over z² + 1, the glide to plane 1 waiting half way for a program its later frames ask for (landing a
//   minute late): it waits where it is (its thread never goes back), the browser's idle callbacks are given time and the
//   left pane draws at most a tenth of the animation frames, › pressed then starts a glide from where it is in its stead
//   (its thread still never goes back), and it ends within seconds of the link landing;
// - on a fresh page, the Landscape shown and the warm-up run to its end: no landTF, land or floor of the chain in
//   another map mode than 0 (the steps view draws them in mode 0 only), and the programs the Landscape's glide draws with
//   linked before ▶;
// - a chain with sheets (z, Möbius, √), the Landscape shown with All sheets off and the warm-up run to its end, then All
//   sheets ticked by its check, or set as a tour step's look sets it: the program that places the sheets under the
//   glide's carry (landCarryPlace) linked before ▶;
// - z + 1/z, then z⁴ + z, on a fresh page whose links land 20 s late, with the Play gate on: ▶, then the main thread stalled
//   for longer than the play lasts in the same task (a link or compile blocking it): the gate starts no play, so the thread
//   stays on plane 0 through the stall, no live region says "Stopped at", and the play's first frame moves it only after the
//   chain has been ready; it reaches plane 2.
// Every other leg switches the Play gate (svplay_gate_cmd.js) off (__cmwSteps({ gate: false })): it waits before any motion
// starts, and those legs watch the hold that follows one.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const names = exampleNames();
// ms a link reads not complete; the waits (ms) for a page, for the chain's programs, for a glide's frame and for a play
// to its end
const LINK_MS = 2500, READY_MS = 60000, WARM_MS = 120000, FRAME_MS = 120000, PLAY_MS = 120000;
// the longest a hold in the middle of a play may take to show on ▶ (the gate's 300 ms threshold and a slow frame)
const HOLD_SHOWN_MS = 5000;
// where a hold's ring may start at most (a share of the full ring)
const RING_START_MAX = 0.5;
const NEWT_EX = 'Partial sums of the exponential', POLES_EX = 'Poles of the Gamma function', GLIDE_U = 0.5;
// (z + 1/z)
const POLE_EX = 'Cauchy: a regular part and a pole';
// a play held with nothing changed: a frame's pole budget (ms) that keeps it held for its tracks, the animation frames it
// is watched over, the idle callbacks given time in them, and the largest share of them the left pane may draw (the
// frames other code asks for: the pane's status notes, the labels once still; the held frames themselves draw none)
const HELD_POLE_MS = 0.001, HELD_TICKS = 60, HELD_IDLE = 20, HELD_SHARE = 0.1;
// the motion's time (ms) each frame adds where a play or a glide has to go through the glides frame by frame
// (__cmwSteps({ clock })), so that no frame of it lands on a plane exactly: only a hold puts the thread there
const PLAY_STEP_MS = 47;
// ms a link reads not complete where a play is to wait for a later glide's programs long enough to be watched, and
// where a glide is to wait half way for a program its later frames ask for
const SECOND_LINK_MS = 15000, LATER_LINK_MS = 60000;
// the gate leg: ms its links read not complete, and the main-thread stall after ▶ (longer than the play's 1800 ms)
const GATE_LINK_MS = 20000, STALL_MS = 2000, GATE_STEP_MS = 300;
// the animation frames in a row the thread of a held motion stays put, and the most ms from a held glide's last link
// landing to its end
const STILL_FRAMES = 3, ENDS_MS = 5000;
const loaded = 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR';
// (a page whose frames leave no idle moment: each idle callback runs for its timeout, at once when it has none, with no
// time left; the browser's own requestIdleCallback is kept as window.__browserIdle)
const NO_IDLE = 'window.__browserIdle = window.requestIdleCallback.bind(window); window.requestIdleCallback = (f, o) => setTimeout(() => f({ didTimeout: true, timeRemaining: () => 0 }), (o && o.timeout) || 0);';
// a fresh page (its storage namespace ns) with the example ex loaded, sheets off, in scope ('all': Everywhere)
const example = async (ns, ex, scope) => {
  await go(`${BASE}/test.html?ns=${ns}${Date.now()}&lang=en&view=steps`);
  await settled({ max: READY_MS, until: loaded });
  await ev(`__cmwExample(${names.indexOf(ex)}), 1`);
  await adopted();
  await ev(`__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: '${scope}', gate: false }), 1`);
};
// in the page, from now on: the animation frames, the left pane's frames drawn (GLR.blit into #canvasL), a chain of idle
// callbacks of `idle` (requestIdleCallback, or __browserIdle where NO_IDLE gives the app's none) each with the time it
// was given, and the thread's first places the frames see, counted while __llHeld.count is set; at every frame, the
// thread's moves up and down and the frames in a row it has stayed put (still); __llHeld.grab() reads the left pane
const record = (idle) => ev(`(() => {
  const s = window.__llHeld = { ticks: 0, drawn: 0, idle: 0, withTime: 0, count: false, xs: [], up: 0, down: 0, still: 0, last: __cmwSvX() };
  const blit = GLR.blit, ric = (f) => window.${idle}(f);
  GLR.blit = function (c) { if (s.count && c && c.canvas && c.canvas.id === 'canvasL') s.drawn++; return blit.apply(this, arguments); };
  const tick = () => {
    const x = __cmwSvX();
    if (x > s.last) s.up++; if (x < s.last) s.down++;
    s.still = x === s.last ? s.still + 1 : 0; s.last = x;
    if (s.count) { s.ticks++; if (s.xs.length < 8 && (!s.xs.length || s.xs[s.xs.length - 1] !== x)) s.xs.push(x); }
    if (!s.done) requestAnimationFrame(tick);
  };
  const each = (dl) => { if (s.count) { s.idle++; if (dl.timeRemaining() > 0) s.withTime++; } if (!s.done) ric(each); };
  requestAnimationFrame(tick); ric(each);
  s.grab = () => { const c = document.querySelector('#canvasL'), k = document.createElement('canvas'); k.width = c.width; k.height = c.height; k.getContext('2d').drawImage(c, 0, 0); return k.getContext('2d').getImageData(0, 0, k.width, k.height).data; };
  return 1; })()`);
// the counts over the next HELD_TICKS animation frames: { wait, got: { ticks, drawn, idle, withTime, xs, x } }
const recorded = async () => {
  await ev('window.__llHeld.count = true, 1');
  const wait = await settled({ only: true, max: PLAY_MS, until: `window.__llHeld.ticks >= ${HELD_TICKS}` });
  const got = await ev('(() => { const s = window.__llHeld; s.count = false; return { ticks: s.ticks, drawn: s.drawn, idle: s.idle, withTime: s.withTime, xs: s.xs, x: __cmwSvX() }; })()');
  return { wait, got };
};
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${LINK_MS};\n` + fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8') });
try {
  await view(1440, 900, false, false);
  logs(true);
  // the partial sums: the glide's first frame at GLIDE_U, then plane 1 parked past colour plane 0
  {
    ok(`${NEWT_EX}, ${POLES_EX} and ${POLE_EX}: the examples are found`, [NEWT_EX, POLES_EX, POLE_EX].every((n) => names.indexOf(n) >= 0), names.length);
    await example('ll', NEWT_EX, 'all');
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
  // program landed (__cmwSteps().rest: the record of the last frame at rest, a new object for each such frame).
  // First with the warm-up of the glides at rest off: it links plane 1's inverse program, which the glide 0 -> 1 draws
  // with, while plane 0 rests, so no program would land after the park. Then as shipped, parked once that warm-up is done
  // (__cmwSteps().invWarm): plane 1's first frame is the inverse pass's (s.first), no stand-in before it
  for (const warm of [false, true]) {
    const tag = warm ? 'as shipped, the glides made ready at rest' : 'the warm-up of the glides off';
    await example('llr', NEWT_EX, 'all');
    if (!warm) await ev('__cmwSteps({ warmInv: false }), 1');
    await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
    await ev('__cmwSteps({ T: 0 }), __cmwSteps({ park: 0 }), 1');
    await settled({ max: READY_MS, until: '__cmwSteps().x === 0 && __cmwSteps().ready.ready' });
    const rw = warm ? await settled({ max: WARM_MS, until: '__cmwSteps().invWarm && __cmwSteps().ready.ready && GLR.pendingLinks === 0' }) : null;
    if (warm) ok(`${NEWT_EX}, ${tag}: plane 0 rests with its glides made ready`, rw.ok, rw);
    await ev(`(() => {
      const s = window.__llSample = { n: 0, landed: 0, land: null, mesh: [], stale: [], on: true, rest: null, first: null, flips: [], seen: new Map(), relinked: [], twins: [] };
      // (at rest: each program linking is recorded; one that was linked or landed before, linking again, is a relink, and
      // a Landscape program of the chain in map mode 1 is another map mode of a view no pane shows)
      const links = () => {
        const now = new Set(GLR.pending().map((p) => p.id)), short = (id) => id.replace('|' + GLR.chainKey, '');
        for (const id of now) {
          if (s.seen.get(id) === 'linked' && s.relinked.length < 5) s.relinked.push(short(id));
          s.seen.set(id, 'linking');
          if (/^(landTF|land|floor)\\|/.test(id) && /\\|m1(\\||$)/.test(id) && !s.twins.includes(short(id))) s.twins.push(short(id));
        }
        for (const [id, st] of s.seen) if (st === 'linking' && !now.has(id)) s.seen.set(id, 'linked');
      };
      const look = () => {
        const q = __cmwSteps(), r = q.rest;
        s.n++;
        // (the first frame of plane 1 at rest after the park)
        if (!s.first && q.x === 1 && r && r.a === 1) s.first = { path: r.path, reason: r.reason || null };
        // (the rest: from the first sample where plane 1 is the inverse pass's and ready, every program the table holds)
        if (!s.rest && q.ready.ready && q.x === 1 && r && r.a === 1 && r.path === 'inverse') {
          s.rest = { t: performance.now(), links: window.__lateLinks.links };
          for (const p of GLR.landProgs()) s.seen.set(p.slice(0, p.lastIndexOf(' ')), p.endsWith(' pending') ? 'linking' : 'linked');
        }
        if (s.rest) {
          links();
          if (!q.ready.ready && s.flips.length < 5) s.flips.push({ t: Math.round(performance.now() - s.rest.t), parts: JSON.parse(JSON.stringify(q.ready.parts)) });
        }
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
    // (the rest goes on until the warm-up has gone through its groups and nothing links)
    const r4 = await settled({ max: WARM_MS, until: '__cmwWarm().phase === "done" && GLR.pendingLinks === 0' });
    const smp = await ev(`(() => { const s = window.__llSample; s.on = false; clearInterval(s.timer);
      return { n: s.n, landed: s.landed, mesh: s.mesh, stale: s.stale, rest: !!s.rest, first: s.first, flips: s.flips, relinked: s.relinked, twins: s.twins,
        restLinks: s.rest ? window.__lateLinks.links - s.rest.links : null, restMs: s.rest ? Math.round(performance.now() - s.rest.t) : null }; })()`);
    const got = { samples: smp && { n: smp.n, landed: smp.landed, first: smp.first }, wait: r3 };
    ok(`${NEWT_EX}, ${tag}, colour plane 0, plane 1 parked at once: ready never reads true while plane 1 is the carried meshes' stand-in`, r3.ok && !!smp && smp.n > 0 && smp.mesh.length === 0, Object.assign({ mesh: smp && smp.mesh }, got));
    if (!warm) ok(`${NEWT_EX}, ${tag}, colour plane 0, plane 1 parked at once: ready never reads true before the left pane has drawn a frame since a program landed`, r3.ok && !!smp && smp.landed > 0 && smp.stale.length === 0, Object.assign({ stale: smp && smp.stale }, got));
    else ok(`${NEWT_EX}, ${tag}, colour plane 0, plane 1 parked at once: plane 1's first frame is the inverse pass's, and ready never reads true before the left pane has drawn a frame since a program landed`, r3.ok && !!smp && !!smp.first && smp.first.path === 'inverse' && smp.stale.length === 0, Object.assign({ stale: smp && smp.stale }, got));
    const rested = { rest: smp && { links: smp.restLinks, ms: smp.restMs }, wait: r4 };
    ok(`${NEWT_EX}, ${tag}, plane 1 parked: at rest ready stays true while the warm-up links the programs of views no pane shows`, r3.ok && r4.ok && !!smp && smp.rest && smp.flips.length === 0, Object.assign({ flips: smp && smp.flips }, rested));
    ok(`${NEWT_EX}, ${tag}, plane 1 parked: at rest no program links twice`, r4.ok && !!smp && smp.rest && smp.relinked.length === 0, Object.assign({ relinked: smp && smp.relinked }, rested));
    ok(`${NEWT_EX}, ${tag}, plane 1 parked: at rest the warm-up starts no other map mode of the Landscape's programs, which no pane draws`, r4.ok && !!smp && smp.rest && smp.twins.length === 0, Object.assign({ twins: smp && smp.twins }, rested));
    info[warm ? 'parkWarm' : 'park'] = Object.assign({}, got.samples, rested.rest, warm ? { warm: rw } : {});
  }
  // the partial sums on a fresh page while the warm-up links its Landscape programs (a view no pane shows), then the
  // Landscape shown: from the left pane's first frame of it until its programs have landed and ready, sampled in the
  // page as above, no sample may find one of them that links (landTF, land, floor of the chain, in any map mode) set
  // aside as a view's no pane shows, nor ready's programs part complete while one links: they are the pane's now, and
  // what a glide there draws waits for them
  {
    const landLinking = '/^(landTF|land|floor)\\|/.test(p.id) && p.key === GLR.chainKey';
    await example('lll', NEWT_EX, 'all');
    const r5 = await settled({ max: WARM_MS, only: true, until: `GLR.pending().some((p) => ${landLinking})` });
    await ev(`(() => {
      const s = window.__llLand = { n: 0, linking: 0, bad: [], on: true, t0: __cmwPaneStatus('L') ? __cmwPaneStatus('L').t : -1 };
      // (a sample counts once the left pane has drawn since the switch: its frame has asked for the Landscape's programs)
      const look = () => {
        const st = __cmwPaneStatus('L');
        if (!st || !(st.t > s.t0)) return;
        s.n++;
        const linking = GLR.pending().filter((p) => ${landLinking}), land = linking.map((p) => p.id.split('|')[0] + (p.offView ? ' (offView)' : ''));
        if (land.length) s.linking++;
        const q = __cmwSteps(), pr = q.ready.parts.programs;
        if (land.length && (pr && pr.done === pr.total || linking.some((p) => p.offView)) && s.bad.length < 5) s.bad.push({ t: Math.round(performance.now()), land, parts: JSON.parse(JSON.stringify(q.ready.parts)) });
      };
      const frame = () => { if (s.on) { look(); requestAnimationFrame(frame); } };
      const onReady = GLR.onReady;
      GLR.onReady = (w) => { const r = onReady(w); if (s.on) look(); return r; };
      s.timer = setInterval(() => { if (s.on) look(); }, 4);
      requestAnimationFrame(frame);
      __cmwSteps({ surf: 'land' });
      return 1;
    })()`);
    const r6 = await settled({ max: WARM_MS, until: `window.__llLand.n > 0 && __cmwSteps().ready.ready && !GLR.pending().some((p) => ${landLinking})` });
    const smp = await ev('(() => { const s = window.__llLand; s.on = false; clearInterval(s.timer); return { n: s.n, linking: s.linking, bad: s.bad }; })()');
    ok(`${NEWT_EX}, the Landscape shown while the warm-up links its programs: they are the pane's, and ready counts them while one links`, r5.ok && r6.ok && !!smp && smp.linking > 0 && smp.bad.length === 0, { bad: smp && smp.bad, samples: smp && { n: smp.n, linking: smp.linking }, wait: [r5, r6] });
    info.land = smp && { n: smp.n, linking: smp.linking };
  }
  // the poles of Γ on a fresh page with no idle moment, ▶ pressed at once after loading (sheets off, Inside regions): the
  // play is held on plane 0 while the glide's programs link, then while its pole tracks are not made; the tracks' steps
  // are counted where they are made (__svPathStats: by a frame, by the idle job), and each glide frame the inverse pass
  // draws is recorded with the key it was prepared with (prep.sing, GLR.drawInverse's argument), to be compared once
  // the play is over with the whole tracks' key at its place (__cmwSvKey(1, x))
  {
    const noIdle = await send('Page.addScriptToEvaluateOnNewDocument', { source: NO_IDLE });
    try {
      await example('llp', POLES_EX, 'in');
      await ev(`(() => { const draw = GLR.drawInverse, rec = window.__llKeys = [];
        GLR.drawInverse = function (o) { const x = __cmwSvX(); if (x > 0 && x < 1) rec.push({ x, sing: o && o.prep ? o.prep.sing.map((p) => [p.re, p.im]) : null }); return draw.apply(this, arguments); };
        return 1; })()`);
      await ev('globalThis.__svPathStats = {}, __cmwSteps({ play: true }), 1');
      const r4 = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() === 1' });
      const st = await ev('(() => { const s = globalThis.__svPathStats || {}; globalThis.__svPathStats = null; return { frame: s.poleFrameSteps || 0, idle: s.poleIdleSteps || 0 }; })()');
      const keys = await ev(`(() => { const near = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) <= 1e-9 * (1 + Math.hypot(q[0], q[1]));
        const out = window.__llKeys.map((f) => { const k = __cmwSvKey(1, f.x); return { x: f.x, whole: k.tracks.k === k.tracks.of, same: !!f.sing && f.sing.length === k.sing.length && f.sing.every((p) => k.sing.some((q) => near(p, q))), used: f.sing, tracks: k.sing }; });
        return { n: out.length, off: out.filter((f) => !f.whole || !f.same).slice(0, 3) }; })()`);
      const got = { wait: r4, steps: st, x: await ev('__cmwSvX()'), keys };
      ok(`${POLES_EX}, ▶ at once with no idle moment: the play reaches plane 1 (the frames that hold it for its pole tracks make them)`, r4.ok, got);
      ok(`${POLES_EX}, ▶ at once with no idle moment, control: the frames that held the play made its pole tracks`, st.frame > 0, got);
      ok(`${POLES_EX}, ▶ at once with no idle moment: every glide frame the inverse pass draws after the hold has the whole tracks' key`, keys.n > 0 && keys.off.length === 0, got);
      info.play = got;
    } finally {
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: noIdle.identifier });
    }
  }
  // the poles of Γ on a fresh page whose idle callbacks give the app's jobs no time (NO_IDLE), ▶ pressed with a frame's
  // pole budget of HELD_POLE_MS (__cmwSteps({ poleFrameMs })): the play waits on plane 0 for its pole tracks, which each
  // held frame advances by a step of the search, and nothing changes its picture. Counted (record) once the hold is on,
  // with the browser's own idle callbacks (__browserIdle); the pane is read before and after a frame asked for with no
  // change. Then the budget is given back: the play goes on
  {
    const noIdle = await send('Page.addScriptToEvaluateOnNewDocument', { source: NO_IDLE });
    try {
      await example('llh', POLES_EX, 'in');
      await record('__browserIdle');
      await ev(`__cmwSteps({ poleFrameMs: ${HELD_POLE_MS} }), __cmwSteps({ play: true }), 1`);
      const h0 = await settled({ only: true, max: PLAY_MS, until: '__cmwSteps().hold === 1' });
      const h1 = await recorded();
      const held = Object.assign(h1.got, await ev('(() => { window.__llHeld.kept = window.__llHeld.grab(); return { hold: __cmwSteps().hold }; })()'));
      // (a frame asked for with no change: the held frame drawn afresh, which the frames kept must show)
      await ev('window.__llHeld.count = true, window.__llHeld.drawn = 0, __cmwSteps({ bare: true }), 1');
      const h2 = await settled({ only: true, max: READY_MS, until: 'window.__llHeld.drawn > 0' });
      const same = await ev('(() => { const s = window.__llHeld, a = s.kept, b = s.grab(); s.count = false; let off = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) off++; return { n: a.length, off, hold: __cmwSteps().hold }; })()');
      await ev('__cmwSteps({ poleFrameMs: 0 }), 1');
      const h3 = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() === 1' });
      await ev('window.__llHeld.done = true, 1');
      const got = { held, same, waits: { h0, h1: h1.wait, h2, h3 } }, still = h0.ok && h1.wait.ok && held.hold === 1;
      ok(`${POLES_EX}, ▶ held for its pole tracks with nothing changed: the browser's idle callbacks are given time (${HELD_IDLE} in ${HELD_TICKS} animation frames)`, still && held.withTime >= HELD_IDLE, got);
      ok(`${POLES_EX}, ▶ held for its pole tracks with nothing changed: the left pane draws at most ${HELD_SHARE} of the animation frames`, still && held.drawn <= HELD_SHARE * held.ticks, got);
      ok(`${POLES_EX}, ▶ held for its pole tracks: the frame kept on the pane is the one a frame asked for with no change draws afresh`, h2.ok && same.hold === 1 && same.off === 0, got);
      ok(`${POLES_EX}, ▶ held for its pole tracks, then the frames' pole budget given back: the play reaches plane 1`, h3.ok, got);
      info.held = got;
    } finally {
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: noIdle.identifier });
    }
  }
  // z + 1/z, then z⁴ + z, on fresh pages whose links land SECOND_LINK_MS late (a second late_links.js over the suite's),
  // the motion's time a frame PLAY_STEP_MS (__cmwSteps({ clock })), so that its frames go through the glides step by step:
  // - ▶ pressed from plane 0: the play goes through the first glide, then waits where it is (the thread still for frames
  //   in a row, past the first glide's middle) for the programs of the glide into plane 2, counted (record) while it
  //   does; then the links land and the play reaches plane 2;
  // - a glide from plane 2 to plane 0 (the motion the other way): it waits for each glide's programs, its thread never
  //   going back, and reaches plane 0
  {
    const slow = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${SECOND_LINK_MS};\n` + fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8') });
    const chain = async (ns) => {
      await example(ns, POLE_EX, 'all');
      await ev("__cmwAddStep('custom', { expr: 'z^4+z', cut: 180 }, 1), 1");
      await settled({ max: READY_MS, until: '__cmwSteps().planes.length === 3' });
    };
    try {
      await chain('llq');
      await record('requestIdleCallback');
      // (what ▶ and the live region say through the play: ▶'s aria-busy, name and description, and each text the polite regions get)
      await ev(`(window.__playLog = [], window.__liveLog = [], window.__fillLog = [], (() => {
        const b = document.querySelector('.sv-play');
        new MutationObserver(() => window.__playLog.push({ busy: b.hasAttribute('aria-busy'), label: b.getAttribute('aria-label'), desc: b.getAttribute('aria-description') })).observe(b, { attributes: true, childList: true });
        // (the ring's fill before each change of it: the value a change replaces, since the last one is replaced as ▶ goes back)
        new MutationObserver((ms) => { for (const m of ms) window.__fillLog.push(+((/--wait:\\s*([\\d.]+)/.exec(m.oldValue || '') || [0, 0])[1])); }).observe(b, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
        new MutationObserver((ms) => { for (const m of ms) { const r = m.target.nodeType === 1 ? m.target : m.target.parentElement, l = r && r.closest('[aria-live]'); if (l && l.textContent) window.__liveLog.push(l.textContent); } }).observe(document.body, { subtree: true, childList: true, characterData: true });
      })(), 1)`);
      await ev(`__cmwSteps({ clock: ${PLAY_STEP_MS} }), __cmwSteps({ play: true }), 1`);
      const q0 = await settled({ only: true, max: PLAY_MS, until: `window.__llHeld.still >= ${STILL_FRAMES} && __cmwSvX() > 0.5 && !!__cmwSteps().play` });
      // (the hold has gone past the gate's threshold: ▶ is the gate's Cancel, said once)
      const busyW = await settled({ only: true, max: HOLD_SHOWN_MS, until: '!!document.querySelector(".sv-play[aria-busy]")' });
      const busy = await ev(`(() => { const b = document.querySelector('.sv-play'); return { busy: b.hasAttribute('aria-busy'), label: b.getAttribute('aria-label'), desc: b.getAttribute('aria-description'), wait: b.dataset.wait, play: !!__cmwSteps().play }; })()`);
      const q1 = await recorded();
      const second = Object.assign(q1.got, await ev('({ links: GLR.pendingLinks })'));
      const q2 = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() === 2' });
      const said = await ev('({ btn: window.__playLog, live: window.__liveLog, fills: window.__fillLog })');
      // (the play meets more than one hold in this scene: each is said once, and each is followed by the play's words, with nothing between)
      const seq = said.live.filter((t, i, a) => t !== a[i - 1]), preps = seq.flatMap((t, i) => (t === 'Preparing the glide…' ? [i] : []));
      ok(`${POLE_EX}, then z⁴ + z: a hold in the middle of the play for ${HOLD_SHOWN_MS / 1000} s: ▶ is the gate's Cancel (busy, named Cancel, described "Preparing the glide…") while the play is still on`, busyW.ok && busy.busy && busy.label === 'Cancel' && busy.desc === 'Preparing the glide…' && busy.play, { busyW, busy });
      // (each hold's ring is its own: it starts below half, never goes back, and is full as the hold ends, not at the programs' share
      // before the play: a hold's values run from the first one set to the 1 it holds when ▶ goes back)
      const runs = said.fills.reduce((rs, v) => { rs.open.push(v); if (v === 1) { rs.all.push(rs.open); rs.open = []; } return rs; }, { all: [], open: [] }).all;
      ok(`${POLE_EX}, then z⁴ + z: in each hold ▶'s ring starts below half, never goes back and is full as the hold ends`, runs.length > 0 && runs.every((r) => r.length > 1 && r[1] < RING_START_MAX && r.every((v, i) => i === 0 || v >= r[i - 1])), runs);
      ok(`${POLE_EX}, then z⁴ + z: the hold ends: ▶ is Pause again while the play goes on`, said.btn.some((e, i) => e.busy && said.btn.slice(i + 1).some((f) => !f.busy && f.label === 'Pause')), said.btn);
      ok(`${POLE_EX}, then z⁴ + z: the live region says "Preparing the glide…" once for each hold, and the play's words ("Playing from …") the next time it is written`, preps.length > 0 && preps.every((i) => /^Playing from /.test(seq[i + 1] || '')), seq);
      await ev('window.__llHeld.done = true, 1');
      const got = { second, waits: { q0, q1: q1.wait, q2 } }, still = q0.ok && q1.wait.ok && second.xs.length === 1;
      ok(`${POLE_EX}, then z⁴ + z: ▶ held a second time, for the programs of the glide into plane 2: the play waits where it is`, still, got);
      ok(`${POLE_EX}, then z⁴ + z: ▶ held a second time: the browser's idle callbacks are given time (${HELD_IDLE} in ${HELD_TICKS} animation frames)`, still && second.withTime >= HELD_IDLE, got);
      ok(`${POLE_EX}, then z⁴ + z: ▶ held a second time: the left pane draws at most ${HELD_SHARE} of the animation frames`, still && second.drawn <= HELD_SHARE * second.ticks, got);
      ok(`${POLE_EX}, then z⁴ + z: ▶ held a second time, then the links land: the play reaches plane 2`, q2.ok, got);
      info.second = got;
      await chain('llv');
      await ev(`__cmwSteps({ go: 2, now: true }), 1`);
      await record('requestIdleCallback');
      await ev(`__cmwSteps({ clock: ${PLAY_STEP_MS} }), __cmwSteps({ go: 0 }), 1`);
      const v0 = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() === 0 && !__cmwSteps().anim' });
      const back = await ev('(() => { const s = window.__llHeld; s.done = true; return { up: s.up, down: s.down }; })()');
      ok(`${POLE_EX}, then z⁴ + z: a glide from plane 2 to plane 0 waits for its glides' programs with its thread never going back, and reaches plane 0`, v0.ok && back.up === 0 && back.down > 0, { v0, back });
      info.back = { v0, back };
      // (▶ from plane 0, put on the globe half way through the first glide and back on the plane past plane 1: the
      // globe's frames move the play on, and the hold for the glide into plane 2 waits where the play is)
      await chain('llg');
      await record('requestIdleCallback');
      await ev(`__cmwSteps({ clock: ${PLAY_STEP_MS} }), __cmwSteps({ play: true }), 1`);
      const w0 = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() >= 0.47' });
      await ev("__cmwSteps({ surf: 'sphere' }), 1");
      const w1 = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() >= 1.3' });
      await ev("__cmwSteps({ surf: 'plane' }), 1");
      const w2 = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() === 2' });
      const globe = await ev('(() => { const s = window.__llHeld; s.done = true; return { up: s.up, down: s.down }; })()');
      ok(`${POLE_EX}, then z⁴ + z: ▶ put on the globe and back on the plane mid-play: its thread never goes back, and it reaches plane 2`, w0.ok && w1.ok && w2.ok && globe.down === 0, { globe, waits: { w0, w1, w2 } });
      info.globe = { globe, waits: { w0, w1, w2 } };
    } finally {
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: slow.identifier });
    }
  }
  // z + 1/z, then z⁴ + z, on a fresh page whose links land GATE_LINK_MS late, the Play gate left on (the suite's others switch
  // it off): ▶ pressed, then the main thread stalled for STALL_MS (longer than the play lasts) in the same task, standing for
  // a link or compile that blocks it. The press starts no play (the gate waits for the programs: the first frame after the
  // stall finds no clock running), so while the links are pending the thread stays on plane 0, the live region never says
  // "Stopped at", and the play begins, with the chain ready, only once its links have landed, and reaches plane 2
  {
    const slow = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${GATE_LINK_MS};\n` + fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8') });
    try {
      await go(`${BASE}/test.html?ns=llw${Date.now()}&lang=en&view=steps`);
      await settled({ max: READY_MS, until: loaded });
      await ev(`__cmwExample(${names.indexOf(POLE_EX)}), 1`);
      await adopted();
      await ev("__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all' }), __cmwAddStep('custom', { expr: 'z^4+z', cut: 180 }, 1), 1");
      await settled({ only: true, max: READY_MS, until: '__cmwSteps().planes.length === 3' });
      await ev('__cmwSteps({ go: 0, now: true }), 1');
      // (at every animation frame: the thread's moves, whether the chain has been ready by its first, and whether a live region has said "Stopped at")
      await ev(`(() => { const s = window.__llGate = { stopped: 0, moved: 0, last: __cmwSvX(), done: false }; const t = () => { const x = __cmwSvX(); const rd = __cmwSteps().ready.ready; if (rd) s.everReady = true; if (x !== s.last) { s.moved++; if (!s.first) s.first = { ready: !!s.everReady, pending: GLR.pendingLinks }; } s.last = x; if ([...document.querySelectorAll('.sr-only[aria-live]')].some((e) => /Stopped at/.test(e.textContent))) s.stopped++; if (!s.done) requestAnimationFrame(t); }; requestAnimationFrame(t); return 1; })()`);
      // (the idle callbacks of a page whose frames are slow are given time, as in the legs above)
      await record('requestIdleCallback');
      const pending = await ev('GLR.pendingLinks');
      const stalled = await ev(`(() => { __cmwSteps({ clock: ${GATE_STEP_MS} }); __cmwSteps({ play: true }); const t0 = performance.now(); while (performance.now() - t0 < ${STALL_MS}); return { pending: GLR.pendingLinks, x: __cmwSvX() }; })()`);
      const settledOn = await settled({ only: true, max: PLAY_MS, until: 'GLR.pendingLinks === 0 || __cmwSvX() > 0' });
      const mid = await ev('({ x: __cmwSvX(), pending: GLR.pendingLinks, stopped: window.__llGate.stopped, busy: !!document.querySelector(".sv-play[aria-busy]"), play: __cmwSteps().play })');
      const reached = await settled({ only: true, max: 2 * PLAY_MS, until: '__cmwSvX() === 2 && !__cmwSteps().anim' });
      const fin = await ev('({ x: __cmwSvX(), pending: GLR.pendingLinks, moved: window.__llGate.moved, first: window.__llGate.first, stopped: window.__llGate.stopped, play: __cmwSteps().play })');
      await ev('window.__llGate.done = true, 1');
      const got = { pending, stalled, mid, fin, waits: { settledOn, reached } };
      ok(`${POLE_EX}, then z⁴ + z, links ${GATE_LINK_MS} ms late: ▶ then a ${STALL_MS} ms stall leaves the thread on plane 0 with the links pending`, pending > 0 && stalled.pending > 0 && stalled.x === 0, got);
      ok(`${POLE_EX}, then z⁴ + z, ▶ then a ${STALL_MS} ms stall: no live region says "Stopped at" while the play waits for the links`, mid.stopped === 0 && (mid.x === 0 || !mid.busy), got);
      ok(`${POLE_EX}, then z⁴ + z, ▶ then a ${STALL_MS} ms stall: the play begins only once the chain has been ready, and arrives at plane 2`, reached.ok && fin.x === 2 && !!fin.first && fin.first.ready === true, got);
      info.gateStall = got;
    } finally {
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: slow.identifier });
    }
  }
  // exp(sin z) typed over z² + 1 (a disc, Inside regions), on a fresh page whose links land late (the suite's), the glide
  // to plane 1 with its time a frame PLAY_STEP_MS; from its second frame on, the links it starts land LATER_LINK_MS late
  // (__lateLinkMs): the program its frames ask for past about two fifths of the way. While the glide waits for it
  // (the thread still for frames in a row, between the planes), counted (record); then the link lands and the glide ends
  {
    await loadView('steps', 'lls' + Date.now(), { v3: true, v4: true, shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }], steps: [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 }, on: true }], nextId: 50, focus: 0 });
    await settled({ max: READY_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector(\'input[data-pkey="expr"]\')' });
    await ev(`(() => { const i = document.querySelector('input[data-pkey="expr"]'); i.focus(); i.value = 'exp(sin(z))'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); return 1; })()`);
    await adopted();
    await ev('__cmwSteps({ gate: false }), 1');
    await settled({ only: true, max: WARM_MS, until: 'GLR.pendingLinks === 0' });
    await record('requestIdleCallback');
    await ev(`__cmwSteps({ clock: ${PLAY_STEP_MS} }), __cmwSteps({ go: 1 }), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => { window.__lateLinkMs = ${LATER_LINK_MS}; r(1); })))`);
    const s0 = await settled({ only: true, max: PLAY_MS, until: `window.__llHeld.still >= ${STILL_FRAMES} && __cmwSvX() > 0 && __cmwSvX() < 1 && GLR.pendingLinks > 0` });
    const s1 = await recorded();
    // (› while it waits: a glide from where it is to the next plane in its place, with no hold record of its own)
    const k0 = await ev('window.__llAnim = __cmwSteps().anim, 1');
    await key('ArrowRight');
    const k1 = await ev('(() => { const a = __cmwSteps().anim; return { replaced: !!a && a !== window.__llAnim, to: a && a.to, x: __cmwSvX() }; })()');
    const s2 = await settled({ only: true, max: PLAY_MS, until: 'GLR.pendingLinks === 0' });
    const t2 = Date.now();
    const s3 = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() === 1 && !__cmwSteps().anim' });
    const moves = await ev('(() => { const s = window.__llHeld; s.done = true; return { up: s.up, down: s.down }; })()');
    const got = { held: s1.got, moves, step: { k0, k1 }, endMs: Date.now() - t2, waits: { s0, s1: s1.wait, s2, s3 } }, still = s0.ok && s1.wait.ok && s1.got.xs.length === 1;
    ok('exp(sin z), the glide waiting half way for a program its later frames ask for: it waits where it is, its thread never going back', still && moves.down === 0, got);
    ok(`exp(sin z), the glide waiting half way: the browser's idle callbacks are given time (${HELD_IDLE} in ${HELD_TICKS} animation frames)`, still && s1.got.withTime >= HELD_IDLE, got);
    ok(`exp(sin z), the glide waiting half way: the left pane draws at most ${HELD_SHARE} of the animation frames`, still && s1.got.drawn <= HELD_SHARE * s1.got.ticks, got);
    ok(`exp(sin z), the glide waiting half way, › pressed: the glide is replaced by one from where it is, and its thread still never goes back`, still && k1.replaced && k1.x >= s1.got.x && moves.down === 0, got);
    ok(`exp(sin z), the glide waiting half way: it ends within ${ENDS_MS} ms of the link landing`, s2.ok && s3.ok && got.endMs <= ENDS_MS, got);
    info.half = got;
  }
  // the partial sums with the Landscape shown in the steps view, the warm-up run to its end: the steps view draws
  // the Landscape's heights in map mode 0 only (at rest, and under a glide's carry), so the warm-up links no landTF, land
  // or floor of the chain in another map mode; and the programs the Landscape's glide draws with (landCarryTF and
  // landCarry in mode 1, landCarryNrm, and lineFC for the floor's outlines) are linked before ▶, from that idle time
  {
    const ex = names.indexOf(NEWT_EX), GLIDE_LAND = ['landCarryTF|m1', 'landCarry|m1', 'landCarryNrm|m0', 'lineFC|m0'];
    await go(`${BASE}/test.html?ns=llg${Date.now()}&lang=en&view=steps`);
    await settled({ max: READY_MS, until: loaded });
    await ev(`__cmwExample(${ex}), 1`);
    await adopted();
    await ev("__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all', surf: 'land' }), 1");
    const r7 = await settled({ max: WARM_MS, until: '__cmwWarm().phase === "done" && GLR.pendingLinks === 0 && __cmwSteps().ready.ready' });
    // (each program as name|mode and its state; the chain's own, and the programs of no chain)
    const progs = await ev(`(() => { const k = '|' + GLR.chainKey + '|m'; return GLR.landProgs().map((x) => {
      const sp = x.lastIndexOf(' '), id = x.slice(0, sp), st = x.slice(sp + 1), name = id.slice(0, id.indexOf('|')), at = id.indexOf(k);
      if (id.endsWith('|static')) return name + '|m0 ' + st;
      return at > 0 ? name + '|m' + id.slice(at + k.length).split('|')[0] + ' ' + st : null; }).filter(Boolean); })()`);
    const twins = progs.filter((x) => /^(landTF|land|floor)\|m[1-9]/.test(x));
    ok(`${NEWT_EX}, the Landscape shown in the steps view: the warm-up links no landTF, land or floor in another map mode than 0`, r7.ok && twins.length === 0, { twins, wait: r7 });
    const missing = GLIDE_LAND.filter((n) => !progs.includes(n + ' ready'));
    ok(`${NEWT_EX}, the Landscape shown in the steps view: the programs its glide draws with are linked before ▶`, r7.ok && missing.length === 0, { missing, wait: r7 });
    info.landGlide = { programs: progs.length, twins: twins.length, missing };
  }
  // a chain with sheets (z, Möbius, √) with the Landscape shown in the steps view, All sheets off, the warm-up run to its
  // end; All sheets then ticked, by its check (in the plane's options) or set as a tour step's look sets it (the option
  // alone, __cmwSet): the glide's carry places the sheets (landCarryPlace), linked from the idle time after the tick as
  // the glide's other programs are; control: the option is on
  info.landSheets = {};
  const TICK = {
    'by its check': `(() => {
      if (!document.getElementById('sheetsChk')) { const b = document.querySelector('#leftFoot .opts-btn:not(.pat-btn)'); if (b) b.click(); }
      const c = document.getElementById('sheetsChk'); if (!c) return false; c.click(); return c.checked; })()`,
    'as a tour step sets it': "(__cmwSet('sheets', true), __cmwFigureState().sheets === true)",
  };
  for (const [how, tick] of Object.entries(TICK)) {
    const CHAIN = [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }];
    await loadView('steps', 'llsheets' + Date.now(), { shapes: [], steps: CHAIN, sheets: false, height: 'im' });
    await settled({ max: READY_MS, until: loaded });
    await adopted();
    await ev("__cmwSteps({ scope: 'all', surf: 'land' }), 1");
    const r8 = await settled({ max: WARM_MS, until: '__cmwWarm().phase === "done" && GLR.pendingLinks === 0 && __cmwSteps().ready.ready' });
    const ticked = await ev(tick);
    const r9 = await settled({ max: WARM_MS, until: 'GLR.pendingLinks === 0 && __cmwSteps().ready.ready' });
    const place = await ev(`GLR.landProgs().filter((x) => x.startsWith('landCarryPlace|') && x.includes('|' + GLR.chainKey + '|m1'))`);
    ok(`z, Möbius, √, the Landscape shown in the steps view, All sheets ticked after the warm-up ${how}, control: the option is on`, r8.ok && ticked, { ticked, wait: r8 });
    ok(`z, Möbius, √, the Landscape shown in the steps view, All sheets ticked after the warm-up ${how}: the sheets' places its glide draws with are linked before ▶`, ticked && r9.ok && place.some((x) => x.endsWith(' ready')), { place, wait: r9 });
    info.landSheets[how] = { ticked, place };
  }
} finally {
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
}
return { pass: fails.length === 0, fails, info };
