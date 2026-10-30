// Browser check of the guided tour's spotlight: every step of every chapter, at 1440 × 900 and 1024 × 700, lights its
// anchor whole (the first lit area holds at least 90 % of the anchor's visible box). Catches a patch clipped to a dot
// by an ancestor that cannot clip (display: contents) or a step lighting the wrong place. Drives the app
// (dist/test.html) like test/tour_cmd.js; run with the kit copy: test/<you>_cdp/q.sh test/tour_lit_cmd.js
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
  // (v16.4: and until the step has settled: the strip no longer busy, the spotlight's morph over)
  for (let i = 0; i < 40; i++) { if (await ev(`!Tour.isActive() || (!document.querySelector('.tour-strip[aria-busy]') && !!Tour.lit() && !Tour.lit().moving)`)) break; await sleep(100); } };
const seen = [];
logs();   // the console from earlier commands of this daemon is not ours
for (const [w, h] of [[1440, 900], [1024, 700]]) {
  await view(w, h, false, false);
  await nav(U + `?ns=lit${w}`); await settle(1500);
  await ev('Tour.dismissSuggestion()');
  await ev('Tour.auto(false)');
  await ev(`Tour.start({ chapter: 'basics' })`); await settle(1400);
  for (let k = 0; k < 60 && (await ev('Tour.isActive()')); k++) {
    const g = await ev(`(() => {
      const c = Tour.current(), L = Tour.lit();
      if (!L) return { id: c.chapter + '/' + c.id, none: true };
      const a = L.anchor;
      // (v16.4: the welcome step draws no shade; every step's strip is a window of the shade: the strip is on top there)
      const s = document.querySelector('.tour-strip').getBoundingClientRect(), top = document.elementFromPoint(s.left + s.width / 2, s.top + 12);
      const win = !!top && !!top.closest('.tour-strip');
      if (!a) return { id: c.chapter + '/' + c.id, centred: true, noShade: getComputedStyle(document.querySelector('.tour-root svg')).display === 'none', win };
      const v = { l: Math.max(2, a.l), t: Math.max(2, a.t), r: Math.min(innerWidth - 2, a.r), b: Math.min(innerHeight - 2, a.b) };   // (the tour keeps 2 px from the edges)
      const h = L.holes[0], ar = Math.max(0, v.r - v.l) * Math.max(0, v.b - v.t);
      const ov = Math.max(0, Math.min(h.r, v.r) - Math.max(h.l, v.l)) * Math.max(0, Math.min(h.b, v.b) - Math.max(h.t, v.t));
      return { id: c.chapter + '/' + c.id, win, nHoles: L.holes.length, frac: ar ? ov / ar : 0, area: ar, hole: [h.l, h.t, h.r, h.b].map(Math.round), anchor: [a.l, a.t, a.r, a.b].map(Math.round) };
    })()`);
    seen.push(`${w}:${g.id}`);
    if (!g.centred && !g.none) check(`${w}×${h} ${g.id}: the lit patch holds the anchor`, g.frac >= 0.9 && g.area > 40, g);
    // (issue #34 T2: a step whose control changes a plane or a card lights that too, not the button alone: two lit
    // areas, or one that holds both the control and what it changes)
    if (!g.none && !g.centred && ['basics/formula', 'basics/add', 'basics/chain', 'views/switch', 'deform/toggle', 'deform/paths', 'deform/order', 'deform/range', 'branches/inverse'].includes(g.id) && w === 1440) {
      const more = g.nHoles >= 2 || (g.hole[2] - g.hole[0]) > 3 * (g.anchor[2] - g.anchor[0]);
      check(`${w}×${h} ${g.id}: the control and what it changes are lit`, more, g);
    }
    if (g.centred) check(`${w}×${h} ${g.id}: no shade at all on the welcome step`, g.noShade, g);
    if (!g.none) check(`${w}×${h} ${g.id}: the strip is a window of the shade`, g.win, g);
    const before = JSON.stringify(await ev('Tour.current()'));
    await ev('Tour.next()'); await settle(1100);
    if ((await ev('Tour.isActive()')) && JSON.stringify(await ev('Tour.current()')) === before) { check(`${w}×${h} ${g.id}: Next moves on`, false, before); break; }
  }
}
check('every chapter was walked at both sizes', ['basics', 'views', 'deform', 'analysis', 'branches', 'sound', 'export', 'keys'].every((c) => seen.some((x) => x.startsWith('1440:' + c + '/')) && seen.some((x) => x.startsWith('1024:' + c + '/'))), seen);
const L = logs().filter((l) => /EXC|\[tour\]/i.test(l.t + l.m)).slice(0, 12);
check('no exceptions or tour warnings', !L.length, L);
await view(1440, 900, false, false);
return { pass: R.filter((r) => r[1]).length, of: R.length, fails: R.filter((r) => !r[1]), seen: seen.length, logs: L };
