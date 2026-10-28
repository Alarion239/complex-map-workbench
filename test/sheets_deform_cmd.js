// All sheets while the deformation shows (notes/v16-user5/SHEETS-DESIGN.md). A command file for a CDP daemon
// (test/cdp_kit README):  python3 build.py && <runner> test/sheets_deform_cmd.js
// The user's case: chain √, sin with √ bracketed (Only f1, inside F), Landscape, All sheets, height Im, at t = 0, 1/2, 1:
// two surfaces drawn (the deformation's, info.hom), the title "…, both sheets" ("…, оба листа"; the merge with the exact sheet captions), the CPU twin's two
// sheets equal at t = 0 (sin z) and ±sin √z at t = 1, at desktop 1440 x 900 and phone 390 x 844 (Android UA, touch),
// EN and RU, light and dark; the whole chain, focus and all at once; a deformation with no sheet form (its tip, one
// surface); the caption; frame times while playing (BUDGET60: p95 <= 18.4 ms, >= 58 fps), with All sheets off as the
// baseline. Prints {pass, fails, info, shots}; screenshots go to <daemon folder>/shots/sd-*.png.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}/`;
const fails = [], shots = [], info = { frames: [] };
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const setView = async (w, h, dark, phone) => { await view(w, h, dark, phone); await send('Emulation.setUserAgentOverride', phone ? { userAgent: ANDROID, platform: 'Android' } : { userAgent: '' }); };
const snap = async (name) => { await shot('sd-' + name); shots.push('sd-' + name); };
const NS = 'sheetsdeform' + Date.now();
const sq = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn = { type: 'sin', params: {}, on: true };
const RECT = [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }];
const state = (extra) => Object.assign({ shapes: RECT, steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' }, extra || {});
const open = async (ns, st, lang) => {
  await load(ns, st);
  if (lang) await nav(`${BASE}test.html?ns=${ns}&lang=${lang}`);
  await settle(1500);
  await ev('__cmwSetMain("land")'); await settle(800);
};
const ls = () => ev('__cmwLandSheets()');
// the CPU twin of the drawn surfaces at the live chain (Funcs.sheetMapEval of the deformation's map), at z = 4 (zc = z)
const twin = (z) => ev(`(() => { const p = __cmwP(), b = p.steps.map((s) => Funcs.build(s)), m = __cmwState().homView.map; return [0, 1].map((c) => { const w = Funcs.sheetMapEval(p.steps, b, m, CX.C(${z}, 0), CX.C(${z}, 0), c, 2); return [w.re, w.im]; }); })()`);
const near = (u, v, tol = 1e-9) => Math.hypot(u[0] - v[0], u[1] - v[1]) <= tol * (1 + Math.hypot(v[0], v[1]));

// ---------------- 1. the user's case: desktop and phone, EN and RU, light and dark ----------------
for (const [w, h, phone] of [[1440, 900, false], [390, 844, true]]) {
  for (const lang of ['', 'ru']) {
    for (const dark of [false, true]) {
      const tag = `${w}${lang ? '-ru' : '-en'}${dark ? '-dark' : '-light'}`;
      await setView(w, h, dark, phone);
      await open(`${NS}u${tag}`, state(), lang);
      const before = await ls();
      ok(`${tag}: static All sheets draws F's two sheets`, before.drawn && before.drawn.K === 2 && !before.drawn.hom, before.drawn);
      await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(800);
      for (const T of [0, 0.5, 1]) {
        await ev(`__cmwMorph({ T: ${T} })`); await settle(1000);
        const s = await ls(), map = await ev('__cmwState().homView && __cmwState().homView.map');
        ok(`${tag} t=${T}: the bracket's map (mode 1, hi 1, post 2)`, map && map.mode === 1 && map.hi === 1 && map.post === 2 && map.t === T, map);
        ok(`${tag} t=${T}: two surfaces of H_t drawn`, s.drawn && s.drawn.K === 2 && s.drawn.hom === true, s.drawn);
        // (v16.1 review math-1: the title names F's sheets as the carrier, not sheets of H_t)
        ok(`${tag} t=${T}: title says on both sheets of F`, lang ? /, на обоих листах <i>F<\/i>/.test(s.title) && /H/.test(s.title) : /, on both sheets of <i>F<\/i>/.test(s.title) && /<i>H<\/i><sub><i>t<\/i><\/sub>/.test(s.title), s.title);
        // (v16.1 review user-7: a phone has no title; its chip says the same)
        if (phone) { const chip = await ev(`(() => { const e = document.querySelector('#leftReadout .rhint'); return e ? e.innerHTML : null; })()`); ok(`${tag} t=${T}: the phone's chip names the sheets`, lang ? /на обоих листах/.test(chip || '') : /on both sheets of/.test(chip || ''), chip); }
        if (!phone || T === 0.5 || !dark) await snap(`${tag}-t${T}`);
        if (tag === '1440-en-light') {
          const tw = await twin(4);
          info['twin' + T] = tw;
          if (T === 0) ok('twin t=0: both sheets sin 4', near(tw[0], [Math.sin(4), 0]) && near(tw[1], [Math.sin(4), 0]), tw);
          if (T === 1) ok('twin t=1: sin 2 and -sin 2', near(tw[0], [Math.sin(2), 0]) && near(tw[1], [-Math.sin(2), 0]), tw);
          if (T === 0.5) ok('twin t=1/2: sheet 1 = -i sinh 4^(3/4)', near(tw[1], [0, -Math.sinh(Math.pow(4, 0.75))], 1e-12), tw);
        }
      }
      // no overflow at a phone width, nothing new over the plane
      if (phone) ok(`${tag}: no page overflow`, await ev('document.documentElement.scrollWidth <= innerWidth'), await ev('[document.documentElement.scrollWidth, innerWidth]'));
      await ev('__cmwMorph({ open: false })'); await settle(400);
      const after = await ls();
      ok(`${tag}: closed again: F's sheets`, after.drawn && after.drawn.K === 2 && !after.drawn.hom, after.drawn);
      await grab();
    }
  }
}

// ---------------- 2. the whole chain, all at once, focus; a log window; no sheet form ----------------
await setView(1440, 900, false, false);
{
  await open(`${NS}whole`, state());
  await ev('__cmwMorph({ open: true, playing: false })'); await settle(700);
  const rows = {};
  for (const T of [0.5, 1, 1.5, 2]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(700); const s = await ls(); rows[T] = { K: s.drawn && s.drawn.K, hom: s.drawn && s.drawn.hom, map: await ev('__cmwState().homView.map') }; }
  info.whole = rows;
  ok('whole chain: √ at t, then sin at t on both sheets', rows[0.5].K === 2 && rows[1.5].K === 2 && rows[2].K === 2 && rows[0.5].hom, rows);
  await ev('__cmwMorph({ open: false })'); await settle(300);
  // focus f1 (√ from the z-plane)
  await open(`${NS}focus`, state({ focus: 1 }));
  await ev('__cmwMorph({ open: true, playing: false, T: 0.5 })'); await settle(800);
  const f = await ls();
  info.focus1 = { drawn: f.drawn, map: await ev('__cmwState().homView && __cmwState().homView.map') };
  ok('focus f1: √ alone on its two sheets', f.drawn && f.drawn.K === 2 && f.drawn.hom, info.focus1);
  await snap('focus1-t0.5');
  await ev('__cmwMorph({ open: false })'); await settle(300);
  await grab();
}
{
  // log then sin, log bracketed: a window of 2W + 1 = 5 sheets out of one
  await open(`${NS}log`, state({ steps: [{ type: 'log', params: {}, on: true }, sn] }));
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(700);
  const r = {};
  for (const T of [0, 0.5, 1]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(900); const s = await ls(); r[T] = s.drawn; await snap(`log-t${T}`); }
  info.log = r;
  ok('log window: 5 surfaces at every t', [0, 0.5, 1].every((T) => r[T] && r[T].K === 5 && r[T].infinite), r);
  // (the merge: the window's caption and title are exact, k = -2...2 of F, not "all sheets")
  const capW = await ev(`__cmwCapText(['L'])`), titW = (await ls()).title;
  info.logCaption = { cap: capW, title: titW };
  ok('log window: the caption names the window of F', /; \$H_t\$ is drawn on 5 surfaces, one for each of the sheets \$k=-2,\\dots,2\$ of \$F\$\. Each deformed logarithm runs along/.test(capW || '') && !/principal branch/.test(capW || '') && /on every sheet/.test(capW || ''), capW);
  ok('log window: the title names the window', /, on the sheets <i>k<\/i> = −2…2 of <i>F<\/i>/.test(titW || '') && !/all sheets/.test(titW || ''), titW);
  await ev('__cmwMorph({ open: false })'); await settle(300);
  await grab();
}
{
  // a formula with branch points that is not catalog steps, deformed: one surface, the check's tip says why
  await open(`${NS}pair`, state({ steps: [{ type: 'custom', params: { expr: '\\log z+\\sqrt{z}', cut: 180 }, on: true }, sn] }));
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(800);
  await ev('__cmwMorph({ T: 0.5 })'); await settle(800);
  const s = await ls();
  // (v16.5 UX20: on a desktop the pane's options, All sheets among them, are in its Display options popover)
  const opts = (open) => ev(`(() => { const b = document.querySelector('#leftFoot .opts-btn'); if (b && (b.getAttribute('aria-expanded') === 'true') !== ${open}) b.click(); return 1; })()`);
  await opts(true); await settle(300);
  const tip = await ev(`(() => { const c = document.getElementById('sheetsChk'); const l = c && c.closest('label'); return l ? l.dataset.tip || '' : null; })()`);
  await opts(false); await settle(200);
  info.pair = { drawn: s.drawn, title: s.title, tip };
  ok('no sheet form: one surface, no sheet clause in the title', !s.drawn && !/sheet/.test(s.title), info.pair);
  ok('no sheet form: the check says why', /one sheet is drawn/.test(tip || ''), tip);
  await ev('__cmwMorph({ open: false })'); await settle(300);
  await grab();
}
{
  // the on-screen caption while deforming with All sheets
  await open(`${NS}cap`, state());
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 }, T: 0.5 })'); await settle(800);
  const cap = await ev(`__cmwCapText(['L'])`);
  info.caption = cap;
  ok('caption: H_t on one surface per sheet of F, the root on its sheet, no principal branch', /; \$H_t\$ is drawn on 2 surfaces, one for each sheet of \$F\$\. Each deformed root or power \$z\^\{\\alpha\}\$ runs along \$z\^\{\\sigma\}e\^\{2\\pi ik\\sigma\}\$/.test(cap || '') && !/principal branch/.test(cap || '') && /\(on every sheet\)/.test(cap || ''), cap);
  await ev('__cmwMorph({ open: false })'); await settle(300);
  const cap0 = await ev(`__cmwCapText(['L'])`);
  info.captionStatic = cap0;
  ok('caption static: both sheets (exact, never "all sheets of the Riemann surface")', /; both sheets are shown\./.test(cap0 || '') && !/Riemann surface/.test(cap0 || ''), cap0);
  await grab();
}

// ---------------- 3. frame times while playing (desktop and phone), All sheets on and off ----------------
// (v16.2, review rv162-2: one 3 s window per state failed at random on a busy machine. Now 3 windows each, alternating
// sheets, plain, sheets, plain, sheets, plain at each size, and the medians are compared, as perf_rerun.js does)
const med = (a) => { const b = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[(b.length - 1) >> 1] : NaN; };
for (const [w, h, phone] of [[1440, 900, false], [390, 844, true]]) {
  await setView(w, h, false, phone);
  for (let rep = 0; rep < 3; rep++) for (const sheets of [true, false]) {
    await open(`${NS}fps${w}${sheets}${rep}${Date.now()}`, state({ sheets }));
    await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
    await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(500);
    const fr = await ev('await (async () => await __qa.frames(3000))()', 30000);
    const s = await ls();
    await ev('__cmwMorph({ playing: false })');
    info.frames.push({ size: `${w}x${h}`, sheets, rep, drawn: s.drawn && s.drawn.K, frames: fr });
    await ev('__cmwMorph({ open: false })'); await settle(300);
  }
}
// the gate: 60 fps (>= 58) with All sheets, and its p95 no worse than the plain deformation's (All sheets off, the same
// chain and size, alternated with the sheet runs) by more than 0.5 ms, medians of the 3 windows each; the AS-BUILT bar
// p95 <= 18.4 ms is reported (the Mac is shared: the plain runs miss it too under load)
const gate = ['1440x900', '390x844'].map((k) => {
  const on = info.frames.filter((r) => r.sheets && r.size === k), off = info.frames.filter((r) => !r.sheets && r.size === k);
  const p95 = med(on.map((r) => r.frames.p95)), fps = med(on.map((r) => r.frames.fps)), baseP95 = med(off.map((r) => r.frames.p95));
  return { k, p95, fps, baseP95, p95s: on.map((r) => r.frames.p95), baseP95s: off.map((r) => r.frames.p95), under184: p95 <= 18.4, ok: fps >= 58 && (!Number.isFinite(baseP95) || p95 <= baseP95 + 0.5) };
});
info.gate = gate;
ok('BUDGET60 while playing with All sheets (60 fps, median p95 within 0.5 ms of the plain deformation\'s, 3 alternating windows)', gate.every((g) => g.ok), gate);
await setView(1440, 900, false, false);
await grab();
ok('no console errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info, shots };
