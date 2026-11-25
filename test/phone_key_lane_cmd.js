// The plane's key column stays below the tour lane under the tall construction bar (#2434). Phone landscape, the steps view on example 1,
// whose tour lane takes y 48–96 under the head, with the Hyperbolic tool picked, so the construction bar is open at its tall height: at
// 568 × 320, 600 × 320, 640 × 360 and 740 × 360, in English and Russian. Checked: none of the plane's keys (Fit view, Sphere, Display,
// and the Look down key where it shows) overlaps the tour lane's box, each keeps its 44 px target on the screen, and the keys stand
// 8 px apart. The overlap with the lane is asked of the 360 px tall windows; at 320 px the keys stand in the row at the head.
// In the steps view (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
for (const lang of ['en', 'ru']) for (const [w, h] of [[568, 320], [600, 320], [640, 360], [740, 360]]) {
  const tag = `${lang} ${w}×${h}`;
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=pkl${w}${lang}${Date.now() % 100000}`);
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
    const A = (o) => o && [o.l, o.t, o.r, o.b].map(Math.round);
    const lane = R(document.querySelector('.tour-lane'));
    const keys = { fit: R(document.getElementById('leftFit')), sphere: R(document.querySelector('.ph-sph')), display: R(document.querySelector('.ph-dsp')), lookdown: R(document.querySelector('#plotL .ld-key')) };
    const shown = Object.entries(keys).filter(([, k]) => k);
    const hits = lane ? shown.filter(([, k]) => k.l < lane.r && k.r > lane.l && k.t < lane.b && k.b > lane.t).map(([n, k]) => n + ' ' + A(k).join(',')) : null;
    const off = shown.filter(([, k]) => k.l < 0 || k.t < 0 || k.r > innerWidth || k.b > innerHeight).map(([n, k]) => n + ' ' + A(k).join(','));
    const small = shown.filter(([, k]) => k.r - k.l < 43.5 || k.b - k.t < 43.5).map(([n, k]) => n + ' ' + A(k).join(','));
    const gaps = [];
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) { const a = shown[i][1], b = shown[j][1]; const dx = Math.max(a.l - b.r, b.l - a.r), dy = Math.max(a.t - b.b, b.t - a.b); if (Math.max(dx, dy) < 7.5) gaps.push(shown[i][0] + ' ' + shown[j][0] + ' ' + Math.round(Math.max(dx, dy))); }
    return { lane: A(lane), keys: Object.fromEntries(shown.map(([n, k]) => [n, A(k)])), hits, off, small, gaps, tall: document.documentElement.classList.contains('ph-ctx-tall') };
  })()`);
  ok(`${tag}: the tour lane and the keys are there, in the tall-bar state (control)`, !!m.lane && !!m.keys.fit && !!m.keys.sphere && m.tall, m);
  // (at 320 px tall the keys stand in the row beside the head, #2398's and #2426's place, and are not asked for here)
  if (h > 340) ok(`${tag}: no plane key overlaps the tour lane`, !!m.hits && m.hits.length === 0, m);
  ok(`${tag}: every key is a 44 px target on the screen`, m.off.length === 0 && m.small.length === 0, m);
  ok(`${tag}: the keys stand 8 px apart`, m.gaps.length === 0, m);
}
return { pass: fails.length === 0, fails, info };
