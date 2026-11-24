// A phone's open legend key stays above the context bar, which overlays the foot of the plane. With the key unfolded and the bar opened for a
// construction tool (the tall bar) or a selected shape (the Edit row), the key ends above the bar and stays inside the plane and clear of the readout;
// when the bar goes the key is back where it was. The keyboard folds it: Escape, and a focus on a plane key it lies over.
// In the steps view at 568 × 320, 667 × 375, 740 × 360 and 360 × 640, in English and Russian. In the steps view (ci/suite_views.js).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const VIEWPORTS = [[568, 320], [667, 375], [740, 360], [360, 640]], STILL_MS = 150, SETTLE_MAX = 5000, EPS = 0.5;
const measure = () => ev(`(() => {
  const rect = (e) => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const lg = document.getElementById('leftLegend'), bar = document.querySelector('.ph-ctx.in');
  return { legend: rect(lg), open: !!lg && !lg.classList.contains('collapsed'), bar: rect(bar), plot: rect(document.getElementById('plotL')), readout: rect(document.querySelector('#plotL > .chip.readout')), roHidden: !!document.querySelector('#plotL > .chip.readout') && getComputedStyle(document.querySelector('#plotL > .chip.readout')).visibility === 'hidden', drop: lg ? lg.style.getPropertyValue('--lg-drop') : null, scrollH: lg ? lg.scrollHeight : 0, clientH: lg ? lg.clientHeight : 0, overflowY: lg ? getComputedStyle(lg).overflowY : '' };
})()`);
const kit = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails });
const still = () => kit.still(measure, STILL_MS, SETTLE_MAX);
const inter = (a, b) => !!a && !!b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > EPS && Math.min(a.b, b.b) - Math.max(a.t, b.t) > EPS;
// (clear of the readout: not on it, and, under it in its column, at least READOUT_GAP below its foot; a readout that gives way to the key (hidden,
// .over-readout: the key takes the plane's top to show all its lines) is no readout on screen)
const READOUT_GAP = 4;
const clearOf = (k, ro, hidden) => !!hidden || !inter(k, ro) && !(k && ro && Math.min(k.r, ro.r) - Math.max(k.l, ro.l) > EPS && k.t >= ro.t && k.t - ro.b < READOUT_GAP - EPS);
for (const lang of ['en', 'ru']) for (const [w, h] of VIEWPORTS) for (const mode of ['tall', 'edit']) {
  const tag = `${lang} ${w}×${h} ${mode === 'tall' ? 'tall bar' : 'Edit row'}`;
  await view(w, h, false, true);
  const ns = 'plo' + w + lang + mode + (Date.now() % 1000000);
  await load(ns, ST);
  await go(`${U}?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && !!document.getElementById('leftLegend') && !document.getElementById('leftLegend').hidden && !!document.querySelector('#shapeList .shape[data-id="s1"]')` });
  await ev(`document.getElementById('leftLegend').click(), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
  const home = await still();
  ok(`${tag}: the key is unfolded, with no bar open (control)`, home.open && !home.bar && !!home.legend, home);
  if (mode === 'tall') await ev(`document.querySelector('[data-tool="perp"]').click(), 1`); else await ev(`__cmwSelect('s1'), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('.ph-ctx.in')` });
  const m = await still();
  info[tag] = { home: home.legend, m };
  ok(`${tag}: the bar is open and the key is still unfolded`, !!m.bar && m.open, m);
  if (!m.bar || !m.legend) continue;
  ok(`${tag}: the key ends above the bar`, m.legend.b <= m.bar.t + EPS, { legend: m.legend, bar: m.bar, drop: m.drop });
  ok(`${tag}: the key is inside the plane`, !!m.plot && m.legend.t >= m.plot.t - EPS && m.legend.r <= m.plot.r + EPS, { legend: m.legend, plot: m.plot });
  ok(`${tag}: the key is clear of the readout, ${READOUT_GAP} px below it where it lies under it`, clearOf(m.legend, m.readout, m.roHidden), { legend: m.legend, readout: m.readout, hidden: m.roHidden });
  ok(`${tag}: what does not fit scrolls, so the whole key is in reach`, m.scrollH <= m.clientH + EPS || m.overflowY === 'auto', { scrollH: m.scrollH, clientH: m.clientH, overflowY: m.overflowY });
  await ev(mode === 'tall' ? `document.querySelector('[data-tool="select"]').click(), 1` : `__cmwSelect(null), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!document.querySelector('.ph-ctx.in')` });
  const back = await still();
  ok(`${tag}: with the bar gone the key is back where it was`, !!back.legend && Math.abs(back.legend.t - home.legend.t) <= 1 && Math.abs(back.legend.l - home.legend.l) <= 1, { back: back.legend, home: home.legend });
}
// (standards-ok: the classic view's Y's open Regions key under the tall bar, below Y's two-line readout, goes with Y's pane,
// which the classic view does not draw, #994. The steps view's tall-bar rows above read the one key under the same bar:
// where it ends, and that what does not fit scrolls. The control that the room above the bar is less than the key's
// height, and the key whole again at its height with the bar gone, are not read)
// The open key is operated by the keyboard: Escape folds it (the focus stays on the key, which is the folded one, aria-expanded false), and Enter
// unfolds it again; a plane key the open key lies over folds it when the key takes focus (the focus is never hidden under the card). With real key
// events, in the steps view at 568 × 320 and 360 × 640 (the key), and at 568 × 320 and 600 × 320 under the tall bar (the plane's keys).
const keyState = (id) => ev(`(() => { const lg = document.getElementById(${JSON.stringify(id)}); return { open: !lg.classList.contains('collapsed'), expanded: lg.getAttribute('aria-expanded'), focused: document.activeElement === lg, role: lg.getAttribute('role') }; })()`);
for (const [w, h] of [[568, 320], [360, 640]]) {
  const tag = `${w}×${h} key by keyboard`;
  await view(w, h, false, true);
  const ns = 'plok' + w + (Date.now() % 1000000);
  await load(ns, ST);
  await go(`${U}?ns=${ns}&lang=en&view=steps`);
  const up = await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && !!document.getElementById('leftLegend') && !document.getElementById('leftLegend').hidden` });
  await ev(`document.getElementById('leftLegend').click(), document.getElementById('leftLegend').focus(), 1`);
  const wOpen = await settled({ max: SETTLE_MAX, panes: false, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
  const op = await keyState('leftLegend');
  ok(`${tag}: the key is unfolded, a button with the focus on it (control)`, up.ok && wOpen.ok && op.open && op.expanded === 'true' && op.focused && op.role === 'button', { up, wOpen, op });
  await key('Escape');
  const wEsc = await settled({ max: SETTLE_MAX, panes: false, until: `document.getElementById('leftLegend').classList.contains('collapsed')` });
  const esc = await keyState('leftLegend');
  info[tag] = { op, esc };
  ok(`${tag}: Escape folds the key, and the focus stays on it`, wEsc.ok && !esc.open && esc.expanded === 'false' && esc.focused, { wEsc, esc });
  await key('Enter');
  const wEnter = await settled({ max: SETTLE_MAX, panes: false, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
  const ent = await keyState('leftLegend');
  ok(`${tag}: Enter unfolds it again`, wEnter.ok && ent.open && ent.expanded === 'true' && ent.focused, { wEnter, ent });
}
// (focus events reach a page only while it has focus: a headless page is made to, until the rows end)
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
for (const w of [568, 600]) {
  const tag = `${w}×320 tall bar, the plane's keys`;
  await view(w, 320, false, true);
  const ns = `plokt${w}${Date.now() % 1000000}`;
  await load(ns, ST);
  await go(`${U}?ns=${ns}&lang=en&view=steps`);
  const up = await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && !!document.getElementById('leftLegend') && !document.getElementById('leftLegend').hidden && !!document.querySelector('[data-tool="perp"]')` });
  await ev(`document.querySelector('[data-tool="perp"]').click(), 1`);
  const bar = await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('.ph-ctx.in')` });
  // (the key unfolded: a tap on it, and the wait for it. The keys it lies over that can take the focus: a readout that gives way to the key, hidden, takes none)
  const open = async () => {
    await ev(`(() => { const lg = document.getElementById('leftLegend'); if (lg.classList.contains('collapsed')) lg.click(); return 1; })()`);
    return settled({ max: SETTLE_MAX, panes: false, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
  };
  const opened = await open();
  const covered = await ev(`(() => { const lg = document.getElementById('leftLegend'), a = lg.getBoundingClientRect();
    return [...lg.parentNode.querySelectorAll('button, [tabindex]')].filter((e) => e !== lg && !lg.contains(e) && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e, i) => { const b = e.getBoundingClientRect(); e.setAttribute('data-kk', i);
      return { i, name: e.id || String(e.className), meets: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top }; }).filter((q) => q.meets); })()`);
  info[tag] = covered;
  ok(`${tag}: the open key lies over at least one of the plane's keys (control)`, up.ok && bar.ok && opened.ok && covered.length > 0, { up, bar, opened, covered });
  for (const c of covered) {
    const w = await open();
    // (focus() runs the page's focusin handlers before it returns: the key's fold is there to read at once)
    await ev(`document.querySelector('[data-kk="${c.i}"]').focus(), 1`);
    const st = await keyState('leftLegend');
    ok(`${tag}: the focus on ${c.name}, under the open key, folds the key`, w.ok && !st.open && st.expanded === 'false', { w, st });
  }
}
await send('Emulation.setFocusEmulationEnabled', { enabled: false });
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
return { pass: fails.length === 0, fails, info };
