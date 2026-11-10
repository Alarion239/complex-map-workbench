// The parse hint (#1470), in the built page (dist/test.html), English, desktop 1440 and phone 390 (Android Chrome):
// a formula step whose field holds ^, a number with its optional sign, then / or *, with no bracket after the ^, reads
// z^-1/2 as (z⁻¹)/2 by the usual precedence. The step's Inspector card says so in a quiet hint under the parse preview
// and offers the bracketed power; the reading and the plot do not change.
//  1. z^-1/2: the hint reads "Read as (z⁻¹)/2. For the power −1/2, write z^(-1/2).", it is a polite live region, not an
//     error (no .ierr text), and has one button "Use z^(-1/2)", 44 px or more each way on the phone;
//  2. the button writes z^(-1/2) into the field, the hint goes, and F's plane is the plane of a step that was typed as
//     z^(-1/2) (the negative control: it differs from the plane of z^-1/2, so the comparison can fail);
//  3. typing the bracket takes the hint away at once, before the field is committed;
//  4. controls: z^(-1/2) shows no hint, z^-2 shows no hint, z^-1/2 in a step that is not a formula (a power step) shows none.
// It runs in the steps view (ci/suite_views.js): a step opens in the Inspector from its chip on the thread, and F is the
// last plane of the thread.
// A command file for the CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/inspector_parse_hint_cmd.js
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = (ns, q = '') => `http://localhost:${PORT}/test.html?ns=${ns}${q}`;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const DESKUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
// the least size of a touch target, in CSS px (the phone's buttons)
const TOUCH_MIN = 44;
// the pixels a plane may differ in, per channel, and how many (JPEG-free screenshots of one GPU frame)
const TOL = 8;
const SHAPES = [{ id: 's1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2] }];
const F1 = (expr, cut = 180) => ({ type: 'custom', params: { expr, cut }, on: true });
const HINT = 'Read as (z⁻¹)/2. For the power −1/2, write z^(-1/2).';
async function open(ns, steps, q = '') {
  await go(`http://localhost:${PORT}/blank-${ns}.html`);
  const o = { v3: true, v4: true, shapes: SHAPES, steps, nextId: 50, focus: 0, rightMode: 'image' };
  await ev(`localStorage.clear(); localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await go(U(ns, q)); await settled({ until: `typeof __cmwSteps === 'function'` });
}
// (a step's chip on the thread opens it in the Inspector; F is the last plane of the thread)
const chip = async (k) => { await clickSel(`#svStrip .sv-step[data-k="${k}"] .sv-fchip`); await settled({ until: `!!document.querySelector('#propsPanel .insp-step')` }); };
const toF = () => ev(`(() => { const n = __cmwSteps().planes.length - 1; __cmwSteps({ go: n, now: true, T: n, scope: 'in' }); return 1; })()`);
// the hint of the open step: its text, live region, buttons and their sizes, and the error line's text
const hint = () => ev(`(() => { const card = document.querySelector('#propsPanel .insp-step'); const h = card && card.querySelector('.ihint'); if (!h) return { card: !!card, text: '', live: null, shown: false, buttons: [], err: card ? card.querySelector('.ierr').textContent : null }; const bs = [...h.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, w: r.width, h: r.height }; }); const t = h.querySelector('span'); return { card: true, text: t ? t.textContent : '', live: h.getAttribute('aria-live'), shown: h.getClientRects().length > 0, buttons: bs, err: document.querySelector('#propsPanel .insp-step .ierr').textContent }; })()`);
const field = () => ev(`document.querySelector('#propsPanel .insp-step input[data-pkey="expr"]').value`);
const typed = (v) => ev(`(() => { const i = document.querySelector('#propsPanel .insp-step input[data-pkey="expr"]'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const hideToasts = (on) => ev(`(() => { let s = document.getElementById('qaNoToast'); if (!s) { s = document.createElement('style'); s.id = 'qaNoToast'; document.head.append(s); } s.textContent = ${on} ? '#toastHost{visibility:hidden!important}' : ''; return 1; })()`);
// F's plane pictures, without the colour legend and the thread's strip
const LEGEND_W = 170, STRIP_H = 100;
const planesRect = () => ev(`(() => { const out = []; for (const id of ['paneL', 'paneR']) { const p = document.getElementById(id); if (!p || !p.getClientRects().length) continue; const r = p.getBoundingClientRect(); if (r.width < 10) continue; out.push({ x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width - ${LEGEND_W}), height: Math.round(r.height - ${STRIP_H}) }); } return out; })()`);
async function planes() { await hideToasts(true); await toF(); await settled(); const rs = await planesRect(); const out = []; for (const r of rs) out.push(await img(r)); await hideToasts(false); return out; }
function diff(a, b) {
  if (a.length !== b.length) return -1;
  let n = 0;
  for (let i = 0; i < a.length; i++) { const p = a[i], q = b[i]; if (p.w !== q.w || p.h !== q.h) return -1; for (let j = 0; j < p.data.length; j += p.ch) if (Math.abs(p.data[j] - q.data[j]) > TOL || Math.abs(p.data[j + 1] - q.data[j + 1]) > TOL || Math.abs(p.data[j + 2] - q.data[j + 2]) > TOL) n++; }
  return n;
}

await send('Emulation.setUserAgentOverride', { userAgent: DESKUA, acceptLanguage: 'en-US,en' });
await view(1440, 900, false, false);

// ---- 1, 2, 3: z^-1/2 ----
await open('phA', [F1('z^-1/2')]);
await chip(1); await settled();
{
  const h = await hint();
  info.desktop = h;
  ok('1: z^-1/2: the hint says how it is read and what to write', !!h && h.text === HINT, h);
  ok('1: the hint is a polite live region and is not an error', !!h && h.live === 'polite' && h.shown && h.err === '', h);
  ok('1: one button, "Use z^(-1/2)"', !!h && h.buttons.length === 1 && h.buttons[0].t === 'Use z^(-1/2)', h);
  const before = await planes();
  await chip(1); await settled();
  await clickSel('#propsPanel .insp-step .ihint button'); await settled();
  const h2 = await hint();
  info.after = { field: await field(), hint: h2 };
  ok('2: the button writes z^(-1/2) into the field', (await field()) === 'z^(-1/2)', await field());
  ok('2: the hint is gone', !!h2 && h2.text === '' && h2.buttons.length === 0 && !h2.shown, h2);
  const after = await planes();
  await open('phB', [F1('z^(-1/2)')]);
  const ref = await planes();
  ok('2: F is the plane of z^(-1/2) (0 px)', diff(after, ref) === 0, { n: diff(after, ref) });
  ok('2: negative control: z^-1/2 and z^(-1/2) are different planes', diff(before, ref) > 1000, { n: diff(before, ref) });
}
await open('phC', [F1('z^-1/2')]);
await chip(1); await settled();
{
  ok('3: the hint is there before the bracket is typed', (await hint()).buttons.length === 1, await hint());
  await typed('z^(-1/2)');
  const h = await hint();
  ok('3: typing the bracket takes the hint away before the field is committed', h.text === '' && h.buttons.length === 0 && !h.shown, h);
  await typed('z^-1/2');
  ok('3: and it is back when the bracket goes', (await hint()).text === HINT, await hint());
}

// ---- 4: controls ----
for (const [name, expr, kind] of [['z^(-1/2)', 'z^(-1/2)', 'custom'], ['z^-2', 'z^-2', 'custom'], ['z^{-1/2}', 'z^{-1/2}', 'custom']]) {
  await open('phD', [F1(expr)]);
  await chip(1); await settled();
  const h = await hint();
  ok(`4: control ${name}: the card is open and has no hint`, !!h && h.card && h.text === '' && h.buttons.length === 0 && !h.shown, h);
}
await open('phE', [{ type: 'pown', params: { n: 2 }, on: true }]);
await chip(1); await settled();
{
  const h = await hint();
  ok('4: control: a power step has no hint', !!h && h.card && h.text === '' && !h.shown, h);
}

// ---- phone ----
await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, acceptLanguage: 'en-US,en' });
await view(390, 844, false, true);
await open('phF', [F1('z^-1/2')]);
await chip(1); await settled();
{
  const h = await hint();
  info.phone = h;
  ok('phone: the hint and its button are there', !!h && h.text === HINT && h.buttons.length === 1, h);
  ok(`phone: the button is ${TOUCH_MIN} px or more each way`, !!h && h.buttons.length === 1 && h.buttons[0].w >= TOUCH_MIN && h.buttons[0].h >= TOUCH_MIN, h && h.buttons);
  await shot('parse-hint-phone');
}
await grab();
await send('Emulation.setUserAgentOverride', { userAgent: DESKUA, acceptLanguage: 'en-US,en' });
await view(1440, 900, false, false);
await open('phG', [F1('z^-1/2')]);
await chip(1); await settled();
await shot('parse-hint-desktop');
ok('no console errors or exceptions', errs.length === 0, errs.slice(0, 5));
return { pass, nfail: fails.length, fails, info };
