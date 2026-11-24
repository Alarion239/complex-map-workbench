// The folded colour key stays clear of the plane's keys under a tall construction bar (#2407). Phone landscape, the steps view on
// example 1, whose tour lane takes y 48–96 under the head, with the Hyperbolic tool picked, so the construction bar is open at its
// tall height (104 px) and the plane above it is short (148 px at 320 tall, 188 px at 360): at 568 × 320, 600 × 320, 640 × 360 and
// 740 × 360. Checked: the folded colour key's 44 px hit area meets none of the plane's keys (Fit view, Sphere, Display), and a press at
// the key's centre finds it.
// In the steps view (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const HIT = 44;   // px: a phone's tap target
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
for (const lang of ['en', 'ru']) for (const [w, h] of [[568, 320], [600, 320], [640, 360], [740, 360]]) {
  const tag = `${lang} ${w}×${h}`;
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=plk${w}${lang}${Date.now() % 100000}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && __cmwSteps().ready.ready' });
  await ev(`__cmwExample(1); 1`);
  await settled({ max: 60000, until: '__cmwSteps().ready.ready' });
  await frames();
  await settled({ max: 20000, until: `!!document.querySelector('#constructTools .tool[data-tool="hyper"]')` });
  await ev(`document.querySelector('#constructTools .tool[data-tool="hyper"]').click(); 1`);
  await settled({ max: 20000, until: `document.documentElement.classList.contains('ph-ctx-tall') && !!document.querySelector('.ph-ctx.in')` });
  await frames(); await frames();
  const m = info[tag] = await ev(`(() => {
    const R = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
    const lg = document.getElementById('leftLegend'), g = R(lg), c = g && [(g.l + g.r) / 2, (g.t + g.b) / 2];
    const hit = g && { l: c[0] - ${HIT} / 2, t: c[1] - ${HIT} / 2, r: c[0] + ${HIT} / 2, b: c[1] + ${HIT} / 2 };
    const keys = { fit: R(document.getElementById('leftFit')), sphere: R(document.querySelector('.ph-sph')), display: R(document.querySelector('.ph-dsp')) };
    const meets = hit ? Object.entries(keys).filter(([, k]) => k && hit.l < k.r && hit.r > k.l && hit.t < k.b && hit.b > k.t).map(([n, k]) => n + ' ' + [k.l, k.t, k.r, k.b].map(Math.round).join(',')) : null;
    const at = c ? document.elementFromPoint(c[0], c[1]) : null;
    return { legend: g && [g.l, g.t, g.r, g.b].map(Math.round), collapsed: !!lg && lg.classList.contains('collapsed'), meets, centreFindsKey: !!at && (at === lg || lg.contains(at)), tall: document.documentElement.classList.contains('ph-ctx-tall') };
  })()`);
  ok(`${tag}: the colour key is folded, in the tall-bar state (control)`, !!m.legend && m.collapsed && m.tall, m);
  ok(`${tag}: the folded colour key's 44 px hit area meets no plane key (Fit view, Sphere, Display)`, !!m.meets && m.meets.length === 0, m);
  ok(`${tag}: a press at the colour key's centre finds it`, m.centreFindsKey, m);
}
return { pass: fails.length === 0, fails, info };
