// The phone's planes keep their own views (v15.1; notes/ui-redesign-2/build/phone-swap.md).
// At 390 x 844 with touch emulation, for three maps (3z, z/3, the Möbius map (z - 1)/(z + 1)) and the first example
// (e^z then that Möbius map) over an unbounded strip and a line: each plane's world window (its centre and its units per
// pane width) is read after every transition and must come back to its starting value within 0.5 % and never drift.
//   swap   40 taps on the inset; the large plane shows exactly what it showed before; the new inset shows the same
//          region (its units per pane width) as the plane had large; then a pinch-free pan and a wheel zoom on each
//          large plane, and 20 more swaps that keep the user's own view
//   sheet  20 rounds of Display open (X | Y side by side) and closed, with X and with Y large
//   rotate 20 rounds of 390 x 844 -> 844 x 390 -> back
//   urlbar 20 rounds of 390 x 844 -> 390 x 900 -> back (Android Chrome's URL bar hiding and showing)
//   views  20 rounds of X -> Y -> Phase -> X -> Y and X -> Y -> Landscape -> X -> Y
//   deform 20 rounds of the Deformation on and off
//   sphere 20 rounds of Sphere and Plane on the large plane
//   lang   10 rounds of English -> Russian -> English (each a reload) with Y large
//   tablet 20 rounds of a touch tablet's rotation (820 x 1180 <-> 1180 x 820, the desktop layout)
//   review the cases of notes/ui-redesign-2/review-phone-swap.json, 3z, both planes at the user's own views: a tour
//          (3 runs, with X and with Y large), leaving the phone layout in Phase and in the Deformation (3 round trips
//          to the desktop), a save in the Deformation and a reload (3 rounds), the first Phase with X the inset, a
//          sheet and a rotation that end Phase, the language switch in Phase, Y's auto fit after a swap (Re z > 0),
//          a swap during a Fit, the Deformation ended by a bypassed step (CASE 'bypass')
// A command file for a CDP daemon (test/cdp_kit README). One part per run, and one map per run for the longer parts
// (the queue waits 300 s at most):
//   python3 build.py && (echo "const PART = 'swap';"; cat test/phone_swap_cmd.js) | test/<you>_cdp/q.sh -
//   for p in sheet rotate urlbar views deform sphere; do for m in expand contract mobius example; do
//     (echo "const PART = '$p', MAP = '$m';"; cat test/phone_swap_cmd.js) | test/<you>_cdp/q.sh -; done; done
//   for p in lang tablet; do (echo "const PART = '$p';"; cat test/phone_swap_cmd.js) | test/<you>_cdp/q.sh -; done
// Prints {part, pass, fails, info}.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const part = typeof PART !== 'undefined' ? PART : 'swap';
const fails = [], info = {};
const settle = async (ms = 350) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const TOL = 0.005;
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
const open = async (ns, steps, shapes) => {
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  const o = { v3: true, v4: true, shapes: shapes || SHAPES, steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 52 } };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); try { sessionStorage.clear(); } catch (e) {} ; 1`);
  await nav(URL0(ns));
  await settle(900);
};
// each plane's world window: centre and units per pane width (u), the pane's width, and whether Y fits itself
const W = () => ev(`(() => {
  const m = __cmwPlaneMenu(), L = __cmwLayout(), st = Phone._state();
  const f = (s) => { const v = m.view(s), w = s === 'L' ? L.wL : L.wR; return { cx: v.cx, cy: v.cy, u: w / v.s, w: Math.round(w) }; };
  return { big: st.big, split: st.split, land: st.land, main: L.main, deform: L.deform, L: f('L'), R: f('R') };
})()`);
const same = (a, b, tol = TOL) => !!a && !!b && Math.abs(a.u / b.u - 1) <= tol && Math.abs(a.cx - b.cx) <= tol * b.u && Math.abs(a.cy - b.cy) <= tol * b.u;
const fmt = (p) => p && `${p.cx.toFixed(3)},${p.cy.toFixed(3)} u=${p.u.toPrecision(5)} w=${p.w}`;
const ratio = (a, b) => +(a.u / b.u).toFixed(4);
// the inset's tap target, by touch
// (each touch carries its own time, ms apart, as a phone's do: unstamped, the touchEnd took the time it was sent, after
// the touchStart's answer, which waits behind a frame of a second where frames are slow, and the app's long-press rule,
// by the events' times, took the tap for a press)
const touch = async (x, y, ms = 60) => {
  const t0 = Date.now() / 1000;
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }], timestamp: t0 });
  await sleep(ms);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + ms / 1000 });
};
const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const tapSel = async (sel, wait = 450) => { const c = await center(sel); if (!c) { fails.push({ name: 'tap target missing', got: sel }); return false; } await touch(c[0], c[1]); await settle(wait); return true; };
const swapTap = async () => { const st = await W(); return tapSel(st.big === 'L' ? '#paneR.ph-inset > .ph-swap' : '#paneL.ph-inset > .ph-swap', 650); };
// a one-finger pan and a wheel zoom on the large plane (the user's own change)
const panZoom = async (side) => {
  const r = await ev(`(() => { const b = document.getElementById('${side === 'L' ? 'overlayL' : 'overlayR'}').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
  const x = r[0] + r[2] * 0.8, y = r[1] + r[3] * 0.25;
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: -240 });
  await settle(400);
  const x0 = r[0] + r[2] * 0.85, y0 = r[1] + r[3] * 0.15;
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 2 }] });
  for (let i = 1; i <= 8; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - 6 * i, y: y0 + 4 * i, id: 2 }] }); await sleep(16); }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(700);
};
// a round: run the steps, read the window after each one; the last read must equal the start, every read must equal
// the same read of the first round (no drift)
async function rounds(name, n, steps, opt = {}) {
  // one warm-up round first (Y's auto fit may settle once, within the app's 3 px refit rule); its change is reported
  const pre = await W();
  for (const st of steps) await st();
  const start = await W();
  if (!same(start.L, pre.L)) fails.push({ name: `${name}: X changed in the warm-up round`, got: fmt(start.L), want: fmt(pre.L) });
  const first = [];
  let worst = 0, worstMid = 0;
  const reads = [];
  for (let r = 0; r < n; r++) {
    for (let i = 0; i < steps.length; i++) {
      await steps[i]();
      const w = await W();
      if (r === 0) first.push(w);
      else for (const s of opt.mid || ['L', 'R']) {
        const d = Math.abs(w[s].u / first[i][s].u - 1);
        worstMid = Math.max(worstMid, d);
        if (!same(w[s], first[i][s])) fails.push({ name: `${name}: ${s} drifts (round ${r + 1}, step ${i + 1})`, got: fmt(w[s]), want: fmt(first[i][s]) });
      }
      if (i === steps.length - 1) for (const s of ['L', 'R']) {
        const d = Math.abs(w[s].u / start[s].u - 1);
        worst = Math.max(worst, d);
        if (!same(w[s], start[s])) fails.push({ name: `${name}: ${s} not back to its start (round ${r + 1})`, got: fmt(w[s]), want: fmt(start[s]) });
      }
      if (r < 2 || r === n - 1) reads.push(`${r + 1}.${i + 1} ${w.big}${w.split ? ' split' : ''}${w.land ? ' land' : ''} L ${fmt(w.L)} | R ${fmt(w.R)}`);
    }
  }
  const end = await W();
  info[name] = { warmup: { L: ratio(start.L, pre.L), R: ratio(start.R, pre.R) }, start: `L ${fmt(start.L)} | R ${fmt(start.R)}`, end: `L ${fmt(end.L)} | R ${fmt(end.R)}`, uEndOverStart: { L: ratio(end.L, start.L), R: ratio(end.R, start.R) }, worstBack: +(worst * 100).toFixed(4) + ' %', worstDrift: +(worstMid * 100).toFixed(4) + ' %', reads: reads.slice(0, 8) };
  return { start, end };
}
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''))); };

// (always the page just built)
try { await send('Network.enable', {}); await send('Network.setCacheDisabled', { cacheDisabled: true }); } catch (e) { /* the daemon's own cache */ }
await view(390, 844, false, true);
const mapsFor = typeof MAP !== 'undefined' ? [MAP] : part === 'lang' ? ['example'] : part === 'tablet' || part === 'review' ? ['expand'] : Object.keys(MAPS);
for (const mk of mapsFor) {
  const ns = 'phsw-' + mk;
  if (part === 'tablet') await view(820, 1180, false, true);
  await open(ns, MAPS[mk]);
  await logs();
  if (part === 'swap') {
    // the swap: X large, Y the first-ever inset (fitted); then 40 taps
    const s0 = await W();
    const one = [];
    let worstL = 0, worstR = 0;
    for (let i = 1; i <= 40; i++) {
      const before = await W();
      await swapTap();
      const w = await W();
      if (w.big === before.big) { fails.push({ name: `${mk}: tap ${i} did not swap`, got: w.big }); break; }
      if (i === 1) one.push(w);
      // the plane that went small shows the same region as it did large (its units per pane width), when it keeps
      // its own view (Y's auto fit is fitted again)
      const small = before.big, nowBig = w.big;
      if (small === 'L' && !same(w.L, before.L)) fails.push({ name: `${mk}: tap ${i}: X's inset is not the region it showed large`, got: fmt(w.L), want: fmt(before.L) });
      // every even tap is back at the start, every odd one at the first tap's state. (Y fits itself here: its first
      // fit at load may sit up to 3 px off the fit it gets later, the app's rule that skips a refit of 3 px or less
      // (fitRight); its start is its read after the first round trip, and the load-time read is reported)
      if (i === 2) one.push(w);
      const ref = i % 2 === 1 ? one[0] : { L: s0.L, R: one[1].R };
      for (const s of ['L', 'R']) {
        const d = Math.abs(w[s].u / ref[s].u - 1);
        if (s === 'L') worstL = Math.max(worstL, d); else worstR = Math.max(worstR, d);
        if (!same(w[s], ref[s])) fails.push({ name: `${mk}: tap ${i}: ${s} drifts`, got: fmt(w[s]), want: fmt(ref[s]) });
      }
      void nowBig;
    }
    const e = await W();
    info[mk + ' swap x40'] = { start: `L ${fmt(s0.L)} | R ${fmt(s0.R)}`, yLoadFitVsAfterRound1: ratio(one[1].R, s0.R), after1: `L ${fmt(one[0].L)} | R ${fmt(one[0].R)}`, after40: `L ${fmt(e.L)} | R ${fmt(e.R)}`, uRatio40: { L: ratio(e.L, s0.L), R: ratio(e.R, s0.R) }, worst: { L: +(worstL * 100).toFixed(4) + ' %', R: +(worstR * 100).toFixed(4) + ' %' } };
    // the user's own view: pan and zoom X (large), swap, pan and zoom Y (large), then 20 swaps keep both
    await panZoom('L');
    const uL = await W();
    if (same(uL.L, e.L, 1e-6)) fails.push({ name: `${mk}: the pan and zoom on X did nothing`, got: fmt(uL.L) });
    await swapTap();
    await panZoom('R');
    const uR = await W();
    if (same(uR.R, e.R, 1e-6)) fails.push({ name: `${mk}: the pan and zoom on Y did nothing`, got: fmt(uR.R) });
    await swapTap();
    const base = await W();   // X large at the user's view, Y the inset of the user's Y view
    if (!same(base.L, uL.L)) fails.push({ name: `${mk}: X's own view lost after a swap`, got: fmt(base.L), want: fmt(uL.L) });
    if (!same(base.R, uR.R)) fails.push({ name: `${mk}: Y's own view not the same region in the inset`, got: fmt(base.R), want: fmt(uR.R) });
    const r = await rounds(mk + ' user view, swap x20', 10, [swapTap, swapTap]);
    void r;
    await grab();
  } else if (part === 'sheet') {
    // (the planes resize at the end of the sheet's 220 ms; X's new window re-centres the meshing window 200 ms later
    // and Y's auto fit follows in a 260 ms tween: a read waits for all of it)
    const sheet = async () => { await ev(`Phone.open('display')`); await settle(1000); };
    const shut = async () => { await ev(`Phone.close()`); await settle(800); };
    await rounds(mk + ' sheet (X large)', 20, [sheet, shut]);
    await swapTap();
    await rounds(mk + ' sheet (Y large)', 20, [sheet, shut]);
    await grab();
  } else if (part === 'rotate') {
    const land = async () => { await view(844, 390, false, true); await settle(700); };
    const port = async () => { await view(390, 844, false, true); await settle(700); };
    await rounds(mk + ' rotation (X large)', 20, [land, port]);
    await swapTap();
    await rounds(mk + ' rotation (Y large)', 10, [land, port]);
    await grab();
  } else if (part === 'urlbar') {
    // Android Chrome's URL bar showing and hiding: the layout viewport's height changes by its 56 px
    const hide = async () => { await view(390, 900, false, true); await settle(500); };
    const show = async () => { await view(390, 844, false, true); await settle(500); };
    await rounds(mk + ' URL bar (X large)', 20, [hide, show]);
    await swapTap();
    await rounds(mk + ' URL bar (Y large)', 20, [hide, show]);
    await grab();
  } else if (part === 'views') {
    const to = (m) => async () => { await tapSel(`#viewSwitch > button[data-mode="${m}"]`, 600); };
    await rounds(mk + ' Phase and back', 20, [to('phase'), to('xy')], { mid: [] });
    await rounds(mk + ' Landscape and back', 20, [to('land'), to('xy')], { mid: [] });
    // (Phase and Landscape show one panel: only the X -> Y read at the end of each round is compared)
    await swapTap();
    await rounds(mk + ' Phase and back (Y large)', 10, [to('phase'), to('xy')], { mid: [] });
    await grab();
  } else if (part === 'deform') {
    const tog = async () => { await tapSel('#morphBtn', 700); };
    await rounds(mk + ' Deformation (X large)', 20, [tog, tog], { mid: [] });
    await swapTap();
    await rounds(mk + ' Deformation (Y large)', 10, [tog, tog], { mid: [] });
    await grab();
  } else if (part === 'sphere') {
    const sph = async () => { const st = await W(); await tapSel(`#pane${st.big} .ph-sph`, 600); };
    await rounds(mk + ' Sphere and Plane (X large)', 20, [sph, sph], { mid: [] });
    await swapTap();
    await rounds(mk + ' Sphere and Plane (Y large)', 10, [sph, sph], { mid: [] });
    await grab();
  } else if (part === 'lang') {
    const pick = (v) => async () => {
      await ev(`Phone.open('more')`); await settle(400);
      await tapSel(`.ph-sheet .ph-seg button[data-v="${v}"]`, 200);
      await sleep(2600); await settle(600);
      await ev(`Phone.close()`); await settle(400);
    };
    await swapTap();
    await rounds(mk + ' language (Y large)', 10, [pick('ru'), pick('en')]);
    const st = await W();
    if (st.big !== 'R') fails.push({ name: 'the language switch did not keep Y large', got: st.big });
    await grab();
  } else if (part === 'review') {
    const ONLY = typeof CASE !== 'undefined' ? CASE : null;
    const want = (c) => !ONLY || ONLY === c;
    const chk = (name, a, b, tol = TOL) => { if (!same(a, b, tol)) fails.push({ name, got: fmt(a), want: fmt(b) }); };
    const both = (name, w, b) => { chk(name + ': X', w.L, b.L); chk(name + ': Y', w.R, b.R); if (w.big !== b.big) fails.push({ name: name + ': the large plane', got: w.big, want: b.big }); };
    const click = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.click(); return !!e; })()`);
    const to = async (m) => { await click(`#viewSwitch > button[data-mode="${m}"]`); await settle(700); };
    const fresh = async (ns, shapes) => { await view(390, 844, false, true); await open(ns, MAPS.expand, shapes); };
    // the user's own views on both planes, X large at the end
    const userViews = async () => { await panZoom('L'); await swapTap(); await panZoom('R'); await swapTap(); };
    // a tour (swap-1): with X large and with Y large; the tour's step 'x' shows the same X either way
    const tourRun = async () => {
      await ev(`(Tour.start({ chapter: 'basics' }), 1)`); await settle(1500);
      let xu = null;
      for (let i = 0; i < 8; i++) {
        const c = await ev('Tour.current()');
        if (c && c.id === 'x') xu = (await W()).L;
        if (c && c.id === 'y') break;
        await ev('(Tour.next(), 1)'); await settle(1200);
      }
      await ev('Tour.stop()'); await settle(1200);
      return xu;
    };
    if (want('tour')) {
      for (const yBig of [false, true]) {
        await fresh('rv-tour-' + yBig); await userViews();
        if (yBig) await swapTap();
        const b0 = await W();
        const xs = [];
        for (let r = 1; r <= 3; r++) { xs.push(await tourRun()); both(`tour ${r} (${yBig ? 'Y' : 'X'} large)`, await W(), b0); }
        info['tour ' + (yBig ? 'Y' : 'X') + ' large'] = { start: `L ${fmt(b0.L)} | R ${fmt(b0.R)}`, end: `L ${fmt((await W()).L)} | R ${fmt((await W()).R)}`, stepX: xs.map(fmt) };
        if (!xs[0]) fails.push({ name: 'tour: step x not reached' });
        info.tourStepX = (info.tourStepX || []).concat(xs[0] ? [xs[0]] : []);
      }
      if (info.tourStepX.length === 2) chk("tour: step 'x' with Y large shows X as with X large", info.tourStepX[1], info.tourStepX[0]);
      info.tourStepX = info.tourStepX.map(fmt);
    }
    // leaving the phone layout in Phase or in the Deformation (swap-2): 3 round trips to the desktop
    if (want('leave')) {
      for (const how of ['phase', 'deform']) {
        await fresh('rv-leave-' + how); await userViews();
        if (how === 'phase') await swapTap();   // X the inset
        const b0 = await W();
        for (let r = 1; r <= 3; r++) {
          if (how === 'phase') await to('phase'); else { await click('#morphBtn'); await settle(800); }
          await view(1200, 900, false, false); await settle(900);
          if (how === 'phase') await to('xy'); else { await click('#morphBtn'); await settle(800); }
          await view(390, 844, false, true); await settle(900);
          if (how === 'phase' && (await W()).big !== 'R') await swapTap();
          both(`leave in ${how}, round ${r}`, await W(), b0);
        }
        const e = await W();
        info['leave in ' + how] = { start: `L ${fmt(b0.L)} | R ${fmt(b0.R)}`, end: `L ${fmt(e.L)} | R ${fmt(e.R)}` };
      }
    }
    // a save in the Deformation, then a reload (swap-3): X's view (X opens large after a reload)
    if (want('reload')) {
      await fresh('rv-reload'); await userViews();
      const b0 = await W();
      for (let r = 1; r <= 3; r++) {
        await swapTap();
        await click('#morphBtn'); await settle(800);
        await sleep(1500);
        await nav(URL0('rv-reload')); await settle(1500);
        if ((await W()).deform) { await click('#morphBtn'); await settle(800); }
        const w = await W();
        chk(`reload in the Deformation, round ${r}: X`, w.L, b0.L);
        if (w.big !== 'L') fails.push({ name: 'reload: X not large', got: w.big });
      }
      info.reloadInDeform = { start: fmt(b0.L), end: fmt((await W()).L) };
    }
    // the first Phase with X the inset (swap-4) shows X as the first Phase with X large
    if (want('phase1')) {
      await fresh('rv-p1a'); await to('phase'); const a = await W();
      await fresh('rv-p1b'); await swapTap(); await to('phase'); const b = await W();
      chk('first Phase with X the inset', b.L, a.L);
      info.firstPhase = { xLarge: fmt(a.L), xInset: fmt(b.L) };
    }
    // a sheet or a rotation that ends Phase (swap-5): Y side by side shows its large view
    if (want('split')) {
      await fresh('rv-split'); await userViews();
      const b0 = await W();
      await ev(`Phone.open('display')`); await settle(1000); const sA = await W(); await ev('Phone.close()'); await settle(800);
      await to('phase'); await ev(`Phone.open('display')`); await settle(1000); await to('xy'); await settle(800); const sB = await W();
      await ev('Phone.close()'); await settle(900);
      chk('a sheet that ends Phase: Y side by side', sB.R, sA.R); chk('a sheet that ends Phase: X side by side', sB.L, sA.L);
      both('a sheet that ends Phase, then closed', await W(), b0);
      await view(844, 390, false, true); await settle(900); const lA = await W(); await view(390, 844, false, true); await settle(900);
      await to('phase'); await view(844, 390, false, true); await settle(900); await to('xy'); await settle(1500); const lB = await W();
      await view(390, 844, false, true); await settle(900);
      // (the same centre and pixels per unit: after Phase the landscape panes can be a few px narrower, and a resize
      // keeps the pixels per unit)
      const px = (p) => p && Object.assign({}, p, { u: p.u / p.w });
      chk('a rotation that ends Phase: Y', px(lB.R), px(lA.R)); chk('a rotation that ends Phase: X', px(lB.L), px(lA.L));
      both('a rotation that ends Phase, then back', await W(), b0);
      info.split = { sheet: `R ${fmt(sA.R)} vs ${fmt(sB.R)}`, landscape: `R ${fmt(lA.R)} vs ${fmt(lB.R)}` };
    }
    // the language switch in Phase with Y large (swap-5, swap-6)
    if (want('lang')) {
      const pick = async (v) => {
        await ev(`Phone.open('more')`); await settle(400);
        await tapSel(`.ph-sheet .ph-seg button[data-v="${v}"]`, 200);
        await sleep(2600); await settle(600);
        await ev(`Phone.close()`); await settle(400);
      };
      await fresh('rv-lang'); await userViews(); await swapTap();
      const b0 = await W();
      for (const v of ['ru', 'en']) {
        await to('phase'); await pick(v);
        const st = await ev('Phone._state()');
        if (st.big !== 'R') fails.push({ name: `language ${v} in Phase: Y not large`, got: st.big });
        await to('xy');
        both(`language ${v} in Phase, back to X -> Y`, await W(), b0);
      }
      info.langInPhase = { start: `L ${fmt(b0.L)} | R ${fmt(b0.R)}`, end: `L ${fmt((await W()).L)} | R ${fmt((await W()).R)}` };
    }
    // Y's auto fit after a swap, a half-plane (swap-7): no second zoom after the swap
    if (want('auto')) {
      await fresh('rv-auto', [{ id: 's1', kind: 'formula', ci: 0, visible: true, expr: '\\Re z>0' }]);
      const reads = [];
      for (let i = 1; i <= 4; i++) {
        await swapTap(); const a = await W(); await settle(1300); const b = await W();
        chk(`auto fit, swap ${i}: Y one second later`, b.R, a.R); chk(`auto fit, swap ${i}: X one second later`, b.L, a.L);
        reads.push(`${b.big} R ${fmt(a.R)} -> ${fmt(b.R)}`);
      }
      info.autoAfterSwap = reads;
    }
    // a swap during a Fit (swap-8): the Fit lands
    if (want('fit')) {
      await fresh('rv-fitA'); await panZoom('L'); await click('#leftFit'); await settle(900); const a = await W();
      await fresh('rv-fitB'); await panZoom('L'); await click('#leftFit'); await sleep(80); await ev('Phone.swap()'); await settle(900); await ev('Phone.swap()'); await settle(900); const b = await W();
      chk('a swap during a Fit', b.L, a.L);
      info.fitMidSwap = { fit: fmt(a.L), fitThenSwaps: fmt(b.L) };
    }
    // the Deformation ended by the chain (its only step bypassed), not by its button: the inset is drawn small once it
    // ends; the step back on, swaps, a save and a reload: X gets its own view (the Deformation does not reopen by itself)
    if (want('bypass')) {
      await fresh('rv-byp'); await userViews(); await swapTap();   // Y large, X the inset
      const b0 = await W();
      const byp = async () => { await click('.icon-btn.bypass'); await settle(900); };
      await click('#morphBtn'); await settle(800);
      const d0 = await W();
      await byp();
      const a = await W();
      if (!d0.deform || a.deform) fails.push({ name: 'bypass: the Deformation view did not end', got: `${d0.deform} -> ${a.deform}` });
      chk('a bypass that ends the Deformation: X the inset', a.L, b0.L); chk('a bypass that ends the Deformation: Y', a.R, b0.R);
      await swapTap(); await swapTap();
      await byp();
      const c = await W();
      await sleep(1500);
      await nav(URL0('rv-byp')); await settle(1500);
      if ((await W()).deform) { await click('#morphBtn'); await settle(800); }
      const r = await W();
      chk('a save while the Deformation shows again, then a reload: X', r.L, b0.L);
      info.bypass = { start: `L ${fmt(b0.L)} | R ${fmt(b0.R)}`, ended: `L ${fmt(a.L)} | R ${fmt(a.R)}`, again: `${c.deform} L ${fmt(c.L)}`, reload: `L ${fmt(r.L)}` };
    }
    await grab();
  } else if (part === 'tablet') {
    const a = async () => { await view(1180, 820, false, true); await settle(700); };
    const b = async () => { await view(820, 1180, false, true); await settle(700); };
    await rounds(mk + ' tablet rotation', 20, [a, b]);
    await view(390, 844, false, true);
    await grab();
  }
}
if (errs.length) fails.push({ name: 'console errors', got: errs.slice(0, 5) });
await view(1440, 900, false, false);
return { part, pass: !fails.length, fails: fails.slice(0, 30), nFails: fails.length, info };
