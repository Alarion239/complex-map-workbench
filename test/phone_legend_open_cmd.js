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
  return { legend: rect(lg), open: !!lg && !lg.classList.contains('collapsed'), bar: rect(bar), plot: rect(document.getElementById('plotL')), readout: rect(document.querySelector('#plotL > .chip.readout')), drop: lg ? lg.style.getPropertyValue('--lg-drop') : null };
})()`);
const kit = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails });
const still = () => kit.still(measure, STILL_MS, SETTLE_MAX);
const inter = (a, b) => !!a && !!b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > EPS && Math.min(a.b, b.b) - Math.max(a.t, b.t) > EPS;
// (clear of the readout: not on it, and, under it in its column, at least READOUT_GAP below its foot)
const READOUT_GAP = 4;
const clearOf = (k, ro) => !inter(k, ro) && !(k && ro && Math.min(k.r, ro.r) - Math.max(k.l, ro.l) > EPS && k.t >= ro.t && k.t - ro.b < READOUT_GAP - EPS);
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
  ok(`${tag}: the key is clear of the readout, ${READOUT_GAP} px below it where it lies under it`, clearOf(m.legend, m.readout), { legend: m.legend, readout: m.readout });
  await ev(mode === 'tall' ? `document.querySelector('[data-tool="select"]').click(), 1` : `__cmwSelect(null), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!document.querySelector('.ph-ctx.in')` });
  const back = await still();
  ok(`${tag}: with the bar gone the key is back where it was`, !!back.legend && Math.abs(back.legend.t - home.legend.t) <= 1 && Math.abs(back.legend.l - home.legend.l) <= 1, { back: back.legend, home: home.legend });
}
// the classic view at 568 × 320, a construction tool in hand: Y's open Regions key (#rightLegend) lies below Y's two-line
// readout, with less room above the bar than the key is tall. The key ends above the bar, inside the plane and clear of
// the readout, and what does not fit scrolls (its whole height is in reach); with the bar gone it is whole again
{
  const tag = 'classic 568×320 tall bar, Y\'s key';
  await view(568, 320, false, true);
  const ns = 'ploc' + (Date.now() % 1000000);
  await go(`${U}?ns=${ns}&lang=en&view=classic`);
  await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && !!document.getElementById('rightLegend') && !document.getElementById('rightLegend').hidden` });
  const measureY = () => ev(`(() => {
    const rect = (e) => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const lg = document.getElementById('rightLegend'), cs = getComputedStyle(lg);
    return { legend: rect(lg), open: !lg.classList.contains('collapsed'), bar: rect(document.querySelector('.ph-ctx.in')), plot: rect(document.getElementById('plotR')), readout: rect(document.querySelector('#plotR > .chip.readout')),
      scrollH: lg.scrollHeight, clientH: lg.clientHeight, overflowY: cs.overflowY };
  })()`);
  const stillY = () => kit.still(measureY, STILL_MS, SETTLE_MAX);
  await ev(`document.getElementById('rightLegend').click(), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!document.getElementById('rightLegend').classList.contains('collapsed')` });
  const home = await stillY();
  ok(`${tag}: the key is unfolded, with no bar open (control)`, home.open && !home.bar && !!home.legend, home);
  await ev(`document.querySelector('[data-tool="perp"]').click(), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('.ph-ctx.in')` });
  const m = await stillY();
  info[tag] = { home, m };
  ok(`${tag}: the bar is open and the key is still unfolded`, !!m.bar && m.open, m);
  if (m.bar && m.legend) {
    ok(`${tag}: the room above the bar is less than the key's height (control)`, !!m.readout && m.bar.t - m.readout.b < home.legend.b - home.legend.t, { home: home.legend, readout: m.readout, bar: m.bar });
    ok(`${tag}: the key ends above the bar`, m.legend.b <= m.bar.t + EPS, { legend: m.legend, bar: m.bar });
    ok(`${tag}: the key is inside the plane`, !!m.plot && m.legend.t >= m.plot.t - EPS && m.legend.r <= m.plot.r + EPS, { legend: m.legend, plot: m.plot });
    ok(`${tag}: the key is clear of the readout, ${READOUT_GAP} px below it where it lies under it`, clearOf(m.legend, m.readout), { legend: m.legend, readout: m.readout });
    ok(`${tag}: what does not fit scrolls, so the whole key is in reach`, m.scrollH <= m.clientH + EPS || m.overflowY === 'auto', { scrollH: m.scrollH, clientH: m.clientH, overflowY: m.overflowY });
  }
  await ev(`document.querySelector('[data-tool="select"]').click(), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!document.querySelector('.ph-ctx.in')` });
  const back = await stillY();
  ok(`${tag}: with the bar gone the key is whole again`, !!back.legend && Math.abs(back.legend.b - back.legend.t - (home.legend.b - home.legend.t)) <= 1 && back.scrollH <= back.clientH + EPS, { back, home: home.legend });
}
// The open key is operated by the keyboard: Escape folds it (the focus stays on the key, which is the folded one, aria-expanded false), and Enter
// unfolds it again; a plane key the open key lies over folds it when the key takes focus (the focus is never hidden under the card). With real key
// events, in the steps view at 568 × 320 and 360 × 640 (the key) and in the classic view at 568 × 320 and 600 × 320 under the tall bar (Y's keys).
const keyState = (id) => ev(`(() => { const lg = document.getElementById(${JSON.stringify(id)}); return { open: !lg.classList.contains('collapsed'), expanded: lg.getAttribute('aria-expanded'), focused: document.activeElement === lg, role: lg.getAttribute('role') }; })()`);
for (const [w, h] of [[568, 320], [360, 640]]) {
  const tag = `${w}×${h} key by keyboard`;
  await view(w, h, false, true);
  const ns = 'plok' + w + (Date.now() % 1000000);
  await load(ns, ST);
  await go(`${U}?ns=${ns}&lang=en&view=steps`);
  await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && !!document.getElementById('leftLegend') && !document.getElementById('leftLegend').hidden` });
  await ev(`document.getElementById('leftLegend').click(), document.getElementById('leftLegend').focus(), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
  const op = await keyState('leftLegend');
  ok(`${tag}: the key is unfolded, a button with the focus on it (control)`, op.open && op.expanded === 'true' && op.focused && op.role === 'button', op);
  await key('Escape');
  await settled({ max: SETTLE_MAX, panes: false, until: `document.getElementById('leftLegend').classList.contains('collapsed')` });
  const esc = await keyState('leftLegend');
  info[tag] = { op, esc };
  ok(`${tag}: Escape folds the key, and the focus stays on it`, !esc.open && esc.expanded === 'false' && esc.focused, esc);
  await key('Enter');
  await settled({ max: SETTLE_MAX, panes: false, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
  const ent = await keyState('leftLegend');
  ok(`${tag}: Enter unfolds it again`, ent.open && ent.expanded === 'true' && ent.focused, ent);
}
// (focus events reach a page only while it has focus: a headless page is made to)
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
for (const w of [568, 600]) {
  const tag = `classic ${w}×320 tall bar, Y's keys`;
  await view(w, 320, false, true);
  await go(`${U}?ns=plokc${w}${Date.now() % 1000000}&lang=en&view=classic`);
  await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && !!document.getElementById('rightLegend') && !document.getElementById('rightLegend').hidden && !!document.querySelector('[data-tool="perp"]')` });
  await ev(`document.querySelector('[data-tool="perp"]').click(), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('.ph-ctx.in')` });
  // (the plane's keys the open key's box meets)
  const open = () => ev(`(() => { const lg = document.getElementById('rightLegend'); if (lg.classList.contains('collapsed')) lg.click(); return 1; })()`);
  await open();
  await settled({ max: SETTLE_MAX, panes: false, until: `!document.getElementById('rightLegend').classList.contains('collapsed')` });
  const covered = await ev(`(() => { const lg = document.getElementById('rightLegend'), a = lg.getBoundingClientRect();
    return [...lg.parentNode.querySelectorAll('button, [tabindex]')].filter((e) => e !== lg && !lg.contains(e) && e.getClientRects().length).map((e, i) => { const b = e.getBoundingClientRect(); e.setAttribute('data-kk', i);
      return { i, name: e.id || String(e.className), meets: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top }; }).filter((q) => q.meets); })()`);
  info[tag] = covered;
  ok(`${tag}: the open key lies over at least one of Y's keys (control)`, covered.length > 0, covered);
  for (const c of covered) {
    await open();
    await settled({ max: SETTLE_MAX, panes: false, until: `!document.getElementById('rightLegend').classList.contains('collapsed')` });
    await ev(`document.querySelector('[data-kk="${c.i}"]').focus(), 1`);
    await sleep(100);
    const st = await keyState('rightLegend');
    ok(`${tag}: the focus on ${c.name}, under the open key, folds the key`, !st.open && st.expanded === 'false', st);
  }
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
return { pass: fails.length === 0, fails, info };
