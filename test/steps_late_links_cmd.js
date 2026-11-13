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
//   is started in map mode 1 (no pane draws one);
// - on a fresh page, the Landscape shown while the warm-up links its programs: ready never reads true while one of
//   them links, from the pane's first frame of it on (they are the pane's now).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const names = exampleNames();
// ms a link reads not complete; the waits (ms) for a page, for the chain's programs and for a glide's frame
const LINK_MS = 2500, READY_MS = 60000, WARM_MS = 120000, FRAME_MS = 120000;
const NEWT_EX = 'Partial sums of the exponential', GLIDE_U = 0.5;
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
    const ex = names.indexOf(NEWT_EX);
    await go(`${BASE}/test.html?ns=llr${Date.now()}&lang=en&view=steps`);
    await settled({ max: READY_MS, until: loaded });
    await ev(`__cmwExample(${ex}), 1`);
    await ev("__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all' }), 1");
    await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
    await ev('__cmwSteps({ T: 0 }), __cmwSteps({ park: 0 }), 1');
    await settled({ max: READY_MS, until: '__cmwSteps().x === 0 && __cmwSteps().ready.ready' });
    await ev(`(() => {
      const s = window.__llSample = { n: 0, landed: 0, land: null, mesh: [], stale: [], on: true, rest: null, flips: [], seen: new Map(), relinked: [], twins: [] };
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
      return { n: s.n, landed: s.landed, mesh: s.mesh, stale: s.stale, rest: !!s.rest, flips: s.flips, relinked: s.relinked, twins: s.twins,
        restLinks: s.rest ? window.__lateLinks.links - s.rest.links : null, restMs: s.rest ? Math.round(performance.now() - s.rest.t) : null }; })()`);
    const got = { samples: smp && { n: smp.n, landed: smp.landed }, wait: r3 };
    ok(`${NEWT_EX}, colour plane 0, plane 1 parked at once: ready never reads true while plane 1 is the carried meshes' stand-in`, r3.ok && !!smp && smp.n > 0 && smp.mesh.length === 0, Object.assign({ mesh: smp && smp.mesh }, got));
    ok(`${NEWT_EX}, colour plane 0, plane 1 parked at once: ready never reads true before the left pane has drawn a frame since a program landed`, r3.ok && !!smp && smp.landed > 0 && smp.stale.length === 0, Object.assign({ stale: smp && smp.stale }, got));
    const rested = { rest: smp && { links: smp.restLinks, ms: smp.restMs }, wait: r4 };
    ok(`${NEWT_EX}, plane 1 parked: at rest ready stays true while the warm-up links the programs of views no pane shows`, r3.ok && r4.ok && !!smp && smp.rest && smp.flips.length === 0, Object.assign({ flips: smp && smp.flips }, rested));
    ok(`${NEWT_EX}, plane 1 parked: at rest no program links twice`, r4.ok && !!smp && smp.rest && smp.relinked.length === 0, Object.assign({ relinked: smp && smp.relinked }, rested));
    ok(`${NEWT_EX}, plane 1 parked: at rest the warm-up starts no other map mode of the Landscape's programs, which no pane draws`, r4.ok && !!smp && smp.rest && smp.twins.length === 0, Object.assign({ twins: smp && smp.twins }, rested));
    info.park = Object.assign({}, got.samples, rested.rest);
  }
  // the partial sums on a fresh page while the warm-up links its Landscape programs (a view no pane shows), then the
  // Landscape shown: from the left pane's first frame of it until its programs have landed and ready, sampled in the
  // page as above, no sample may read ready while one of them links (landTF, land, floor of the chain, in any map
  // mode: they are the pane's now, and what a glide there draws waits for them)
  {
    const ex = names.indexOf(NEWT_EX), landLinking = '/^(landTF|land|floor)\\|/.test(p.id) && p.key === GLR.chainKey';
    await go(`${BASE}/test.html?ns=lll${Date.now()}&lang=en&view=steps`);
    await settled({ max: READY_MS, until: loaded });
    await ev(`__cmwExample(${ex}), 1`);
    await ev("__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all' }), 1");
    const r5 = await settled({ max: WARM_MS, only: true, until: `GLR.pending().some((p) => ${landLinking})` });
    await ev(`(() => {
      const s = window.__llLand = { n: 0, linking: 0, bad: [], on: true, t0: __cmwPaneStatus('L') ? __cmwPaneStatus('L').t : -1 };
      // (a sample counts once the left pane has drawn since the switch: its frame has asked for the Landscape's programs)
      const look = () => {
        const st = __cmwPaneStatus('L');
        if (!st || !(st.t > s.t0)) return;
        s.n++;
        const land = GLR.pending().filter((p) => ${landLinking}).map((p) => p.id.split('|')[0]);
        if (land.length) s.linking++;
        const q = __cmwSteps();
        if (q.ready.ready && land.length && s.bad.length < 5) s.bad.push({ t: Math.round(performance.now()), land, parts: JSON.parse(JSON.stringify(q.ready.parts)) });
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
    ok(`${NEWT_EX}, the Landscape shown while the warm-up links its programs: ready never reads true while one of them links`, r5.ok && r6.ok && !!smp && smp.linking > 0 && smp.bad.length === 0, { bad: smp && smp.bad, samples: smp && { n: smp.n, linking: smp.linking }, wait: [r5, r6] });
    info.land = smp && { n: smp.n, linking: smp.linking };
  }
} finally {
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
}
return { pass: fails.length === 0, fails, info };
