// The steps view's one plane keeps its window through the phone's layout changes (the steps view's twin of
// phone_swap_cmd.js's rotate, urlbar, tablet, sheet and lang legs).
// At 390 x 844 with touch emulation, for three maps (3z, z/3, the Möbius map (z - 1)/(z + 1)) and the first example
// (e^z then that Möbius map) over an unbounded strip and a line: the plane's world window (its centre and its units
// per pane width) is read after every transition and must come back to its starting value within 0.5 % and never drift.
//   sheet  20 rounds of a sheet open and closed
//   rotate 20 rounds of 390 x 844 -> 844 x 390 -> back
//   urlbar 20 rounds of 390 x 844 -> 390 x 900 -> back (Android Chrome's URL bar hiding and showing)
//   lang   10 rounds of English -> Russian -> English (each a reload)
//   tablet 20 rounds of a touch tablet's rotation (820 x 1180 <-> 1180 x 820)
// A command file for a CDP daemon (test/cdp_kit README); one part per run. Prints {part, pass, fails, info}.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const part = typeof PART !== 'undefined' ? PART : 'rotate';
const fails = [], info = {};
// the plane's window and the viewport read the same on two polls in a row, and `extra` holds: the page has finished the
// change (a sheet's slide, a resize, a refit) that the step asked for; a reload that destroys the page is waited out
const STABLE = `(() => { const v = __cmwPlaneMenu().view('L'), k = [v.cx, v.cy, v.s, __cmwLayout().wL, innerWidth, innerHeight].join(); const same = window.__pk === k; window.__pk = k; return same; })()`;
const settle = async (extra = 'true', max = 20000) => {
  const t0 = Date.now();
  for (;;) {
    const r = await settled({ max: 4000, until: `${STABLE} && (${extra})` });
    if (r && r.ok) return true;
    if (Date.now() - t0 > max) { fails.push({ name: 'the page did not settle', got: extra }); return false; }
  }
};
const TOL = 0.005;
// the language switch asks for its reload this long after the tap, while the wait that follows the tap is already in
// flight in the old page (a wait in flight when the new page commits is cut off with "Inspected target navigated or closed")
const LANG_RELOAD_LATE_MS = 400;
const SHAPES = [
  { id: 's1', kind: 'formula', ci: 0, visible: true, expr: '|\\Im z|<1' },
  { id: 's2', kind: 'line', ci: 1, visible: true, a: [0, 0.5], b: [1, 0.5] },
  { id: 's3', kind: 'point', ci: 2, visible: true, p: [0.3, 0.2] },
];
const MAPS = {
  expand: [{ type: 'affine', params: { a: '3', b: '0' }, on: true }],
  contract: [{ type: 'affine', params: { a: '0.3333333333333333', b: '0' }, on: true }],
  mobius: [{ type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }],
  example: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }],
};
const URL0 = (ns) => `http://localhost:${PORT}/test.html?ns=${ns}`;
const open = async (ns, steps) => {
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  const o = { v3: true, v4: true, shapes: SHAPES, steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 52 } };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); try { sessionStorage.clear(); } catch (e) { /* a page with no session storage has nothing to clear */ } ; 1`);
  await nav(URL0(ns));
  await settle();
};
// the plane's world window: centre and units per pane width (u), and the pane's width
const W = () => ev(`(() => {
  const v = __cmwPlaneMenu().view('L'), w = __cmwLayout().wL;
  return { steps: document.documentElement.classList.contains('sv'), cx: v.cx, cy: v.cy, u: w / v.s, w: Math.round(w) };
})()`);
const same = (a, b, tol = TOL) => !!a && !!b && Math.abs(a.u / b.u - 1) <= tol && Math.abs(a.cx - b.cx) <= tol * b.u && Math.abs(a.cy - b.cy) <= tol * b.u;
const fmt = (p) => p && `${p.cx.toFixed(3)},${p.cy.toFixed(3)} u=${p.u.toPrecision(5)} w=${p.w}`;
// (a touch lasts ms: the press the app reads, not a wait)
const touch = async (x, y, ms = 60) => {
  const t0 = Date.now() / 1000;
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }], timestamp: t0 });
  await sleep(ms);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + ms / 1000 });
};
const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const tapSel = async (sel) => { const c = await center(sel); if (!c) { fails.push({ name: 'tap target missing', got: sel }); return false; } await touch(c[0], c[1]); return true; };
// rounds: run the steps, read the window after each; the last read of a round equals the start, every read equals the
// same read of the first round (no drift)
async function rounds(name, n, steps) {
  for (const st of steps) await st();   // (a warm-up round)
  const start = await W();
  if (!start.steps) fails.push({ name: `${name}: not the steps view`, got: start });
  const first = [];
  let worst = 0;
  for (let r = 0; r < n; r++) {
    for (let i = 0; i < steps.length; i++) {
      await steps[i]();
      const w = await W();
      if (r === 0) first.push(w);
      else if (!same(w, first[i])) fails.push({ name: `${name}: the plane drifts (round ${r + 1}, step ${i + 1})`, got: fmt(w), want: fmt(first[i]) });
      if (i === steps.length - 1) {
        worst = Math.max(worst, Math.abs(w.u / start.u - 1));
        if (!same(w, start)) fails.push({ name: `${name}: not back to its start (round ${r + 1})`, got: fmt(w), want: fmt(start) });
      }
    }
  }
  info[name] = { start: fmt(start), worstBack: +(worst * 100).toFixed(4) + ' %' };
}
// waits for the page that a reload brings: a document other than the one that began at `old` (performance.timeOrigin),
// loaded, with the phone's sheets. A call in flight when the old page goes away is cut off with "navigated or closed";
// that is the cue to ask again, any other error is the suite's
const NAV = /navigated or closed/;
const reloaded = async (old, max = 20000) => {
  const t0 = Date.now();
  for (;;) {
    try { if ((await ev(`performance.timeOrigin !== ${old} && document.readyState === 'complete' && typeof Phone === 'object'`)) === true) return true; } catch (e) { if (!NAV.test(String((e && e.message) || e))) throw e; }
    if (Date.now() - t0 > max) { fails.push({ name: 'the page did not reload', got: old }); return false; }
    await sleep(50);
  }
};
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''))); };

try { await send('Network.enable', {}); await send('Network.setCacheDisabled', { cacheDisabled: true }); } catch (e) { /* the daemon's own cache */ }
await view(390, 844, false, true);
const mapsFor = typeof MAP !== 'undefined' ? [MAP] : part === 'lang' ? ['example'] : part === 'tablet' ? ['expand'] : Object.keys(MAPS);
for (const mk of mapsFor) {
  const ns = 'phpl-' + mk;
  if (part === 'tablet') await view(820, 1180, false, true);
  await open(ns, MAPS[mk]);
  await logs();
  if (part === 'sheet') {
    const shown = `(() => { const e = document.querySelector('.ph-sheet'); return !!e && e.getClientRects().length > 0; })()`;
    const sheet = async () => { await ev(`Phone.open('display')`); await settle(shown); };
    const shut = async () => { await ev(`Phone.close()`); await settle(`!${shown}`); };
    await rounds(mk + ' sheet', 20, [sheet, shut]);
  } else if (part === 'rotate') {
    const land = async () => { await view(844, 390, false, true); await settle('innerWidth === 844 && innerHeight === 390'); };
    const port = async () => { await view(390, 844, false, true); await settle('innerWidth === 390 && innerHeight === 844'); };
    await rounds(mk + ' rotation', 20, [land, port]);
  } else if (part === 'urlbar') {
    // (each resize is followed by a wait until the page has the new height)
    const hide = async () => { await view(390, 900, false, true); await settle('innerHeight === 900'); };
    const show = async () => { await view(390, 844, false, true); await settle('innerHeight === 844'); };
    await rounds(mk + ' URL bar', 20, [hide, show]);
  } else if (part === 'lang') {
    const pick = (v) => async () => {
      await ev(`Phone.open('more')`);
      await settle(`!!document.querySelector('.ph-sheet .ph-seg button[data-v="${v}"]')`);
      // (the sheet scrolls: the row may start below the fold)
      await ev(`document.querySelector('.ph-sheet .ph-seg button[data-v="${v}"]').scrollIntoView({ block: 'center' }), 1`);
      await settle();
      const old = await ev('performance.timeOrigin');
      await ev(`document.addEventListener('click', (e) => { e.stopImmediatePropagation(); const b = e.target; setTimeout(() => b.click(), ${LANG_RELOAD_LATE_MS}); }, { capture: true, once: true }), 1`);
      await tapSel(`.ph-sheet .ph-seg button[data-v="${v}"]`);
      await reloaded(old);
      await settle(`(document.documentElement.lang || 'en') === '${v}'`);
      await ev(`Phone.close()`);
    };
    await rounds(mk + ' language', 10, [pick('ru'), pick('en')]);
  } else if (part === 'tablet') {
    const a = async () => { await view(1180, 820, false, true); await settle('innerWidth === 1180 && innerHeight === 820'); };
    const b = async () => { await view(820, 1180, false, true); await settle('innerWidth === 820 && innerHeight === 1180'); };
    await rounds(mk + ' tablet rotation', 20, [a, b]);
    await view(390, 844, false, true);
  }
  await grab();
}
if (errs.length) fails.push({ name: 'console errors', got: errs.slice(0, 5) });
await view(1440, 900, false, false);
return { part, pass: !fails.length, fails: fails.slice(0, 30), nFails: fails.length, info };
