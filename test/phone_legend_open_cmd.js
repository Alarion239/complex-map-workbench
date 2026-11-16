// A phone's open legend key stays above the context bar (#1534): the bar overlays the foot of the plane, and the key, once unfolded, ran under it when the
// bar was tall (568 × 320: key bottom 166, bar top 154). With the key unfolded and the bar opened for a construction tool (the tall bar) or a selected
// shape (the Edit row), the key ends above the bar and stays inside the plane and clear of the readout; when the bar goes the key is back where it was.
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
const still = async () => { let a = JSON.stringify(await measure()); for (let i = 0; i < SETTLE_MAX / STILL_MS; i++) { await sleep(STILL_MS); const b = JSON.stringify(await measure()); if (a === b) return JSON.parse(b); a = b; } return JSON.parse(a); };
const inter = (a, b) => !!a && !!b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > EPS && Math.min(a.b, b.b) - Math.max(a.t, b.t) > EPS;
for (const lang of ['en', 'ru']) for (const [w, h] of VIEWPORTS) for (const mode of ['tall', 'edit']) {
  const tag = `${lang} ${w}×${h} ${mode === 'tall' ? 'tall bar' : 'Edit row'}`;
  await view(w, h, false, true);
  const ns = 'plo' + w + lang + mode + (Date.now() % 1000000);
  await load(ns, ST);
  await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}&view=steps` });
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
  ok(`${tag}: the key is clear of the readout`, !inter(m.legend, m.readout), { legend: m.legend, readout: m.readout });
  await ev(mode === 'tall' ? `document.querySelector('[data-tool="select"]').click(), 1` : `__cmwSelect(null), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!document.querySelector('.ph-ctx.in')` });
  const back = await still();
  ok(`${tag}: with the bar gone the key is back where it was`, !!back.legend && Math.abs(back.legend.t - home.legend.t) <= 1 && Math.abs(back.legend.l - home.legend.l) <= 1, { back: back.legend, home: home.legend });
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
return { pass: fails.length === 0, fails, info };
