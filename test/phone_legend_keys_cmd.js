// The folded colour key stays clear of the plane's keys under a tall construction bar (#2407). Phone landscape, the steps view on
// example 1, whose tour lane takes y 48–96 under the head, with the Hyperbolic tool picked, so the construction bar is open at its
// tall height (104 px) and the plane above it is short (148 px at 320 tall, 188 px at 360): at 568 × 320, 600 × 320, 640 × 360 and
// 740 × 360. Checked: the folded colour key's 44 px hit area meets none of the plane's keys (Fit view, Sphere, Display), and a press at
// the key's centre finds it; the key stands 8 px clear of the row's first key (Fit view), its centre on the row's centre line (within 2 px),
// and the readout and the construction chip stop 8 px short of it; the card it unfolds into lies inside the plane and the screen.
// The Stack's row has the Tilt key too (#2415): the same checks on it, the Tilt key among the keys the colour key must clear (the left
// plane's construction chip does not show on the Stack, so its row is the flat plane's alone). The readout is measured at its widest.
// In the steps view (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const HIT_PAD = 8, GAP = 8, LINE = 2;   // px: the key's hit area past its glyph (phone.css), the gap kept to what stands beside it, the centre line's slack
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
// the folded colour key's place, measured and checked (the plane keys: Fit view, Sphere, Display, and the Tilt key where the Stack shows it)
const legend = async (tag, stack = false) => {
  const m = info[tag] = await ev(`(() => {
    const R = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
    const A = (o) => o && [o.l, o.t, o.r, o.b].map(Math.round);
    const lg = document.getElementById('leftLegend'), g = R(lg), c = g && [(g.l + g.r) / 2, (g.t + g.b) / 2];
    const hit = g && { l: g.l - ${HIT_PAD}, t: g.t - ${HIT_PAD}, r: g.r + ${HIT_PAD}, b: g.b + ${HIT_PAD} };
    const keys = { fit: R(document.getElementById('leftFit')), tilt: R(document.querySelector('.ph-tilt')), sphere: R(document.querySelector('.ph-sph')), display: R(document.querySelector('.ph-dsp')) };
    const meets = hit ? Object.entries(keys).filter(([, k]) => k && hit.l < k.r && hit.r > k.l && hit.t < k.b && hit.b > k.t).map(([n, k]) => n + ' ' + A(k).join(',')) : null;
    const at = c ? document.elementFromPoint(c[0], c[1]) : null, fit = keys.fit, ro = R(document.querySelector('#plotL > .chip.readout')), chip = R(document.querySelector('#draftChipL.cm-on'));
    return { legend: A(g), collapsed: !!lg && lg.classList.contains('collapsed'), meets, centreFindsKey: !!at && (at === lg || lg.contains(at)), tall: document.documentElement.classList.contains('ph-ctx-tall'),
      gapToFit: fit && hit ? Math.round(fit.l - hit.r) : null, offLine: fit && c ? Math.round(Math.abs(c[1] - (fit.t + fit.b) / 2) * 10) / 10 : null,
      readout: A(ro), readoutShort: ro && hit ? Math.round(hit.l - ro.r) : null,
      // (the readout at the widest its max-width lets it be: its width is set far past it, read, and put back)
      roRoom: (() => { const e = document.querySelector('#plotL > .chip.readout'); if (!e || !hit) return null; const w = e.style.width; e.style.width = '9999px'; const q = e.getBoundingClientRect(); e.style.width = w; return Math.round(hit.l - q.right); })(), chip: A(chip), chipShort: chip && hit ? Math.round(hit.l - chip.r) : null, plot: A(R(document.getElementById('plotL'))) };
  })()`);
  ok(`${tag}: the colour key is folded, in the tall-bar state (control)`, !!m.legend && m.collapsed && m.tall, m);
  ok(`${tag}: the folded colour key's 44 px hit area meets no plane key (Fit view, Sphere, Display, Tilt)`, !!m.meets && m.meets.length === 0, m);
  ok(`${tag}: a press at the colour key's centre finds it`, m.centreFindsKey, m);
  ok(`${tag}: the colour key stands ${GAP} px clear of Fit view, the row's first key`, m.gapToFit != null && m.gapToFit >= GAP - 0.5, m);
  ok(`${tag}: the colour key's centre is on the row's centre line (within ${LINE} px)`, m.offLine != null && m.offLine <= LINE, m);
  ok(`${tag}: the readout stops ${GAP} px short of the colour key`, m.readoutShort == null || m.readoutShort >= GAP - 0.5, m);
  ok(`${tag}: the readout at its widest stops ${GAP} px short of the colour key`, m.roRoom != null && m.roRoom >= GAP - 0.5, m);
  // (the left plane's construction chip does not show on the Stack, chipSide: the row is the flat plane's)
  if (!stack) ok(`${tag}: the construction chip stops ${GAP} px short of the colour key`, m.chipShort != null && m.chipShort >= GAP - 0.5, m);
};
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
  await legend(tag);
  // (the card it unfolds into)
  await ev(`document.getElementById('leftLegend').click(); 1`);
  await settled({ max: 10000, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
  await frames(); await frames();
  const u = info[tag + ' unfolded'] = await ev(`(() => { const b = document.getElementById('leftLegend').getBoundingClientRect(), p = document.getElementById('plotL').getBoundingClientRect();
    return { card: [b.left, b.top, b.right, b.bottom].map(Math.round), plot: [p.left, p.top, p.right, p.bottom].map(Math.round), screen: [innerWidth, innerHeight], inPlot: b.left >= p.left - 0.5 && b.right <= p.right + 0.5 && b.top >= p.top - 0.5 && b.bottom <= p.bottom + 0.5, onScreen: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight }; })()`);
  ok(`${tag}: the unfolded card lies inside the plane and the screen`, u.inPlot && u.onScreen, u);
  // the same on the Stack, whose row has the Tilt key at its left (the key folds again first)
  await ev(`document.getElementById('leftLegend').click(); 1`);
  await settled({ max: 10000, until: `document.getElementById('leftLegend').classList.contains('collapsed')` });
  await ev(`__cmwSteps({ surf: 'stack' }); 1`);
  await settled({ max: 20000, until: `__cmwSteps().surf === 'stack' && typeof __cmwStack === 'function' && !!__cmwStack().drawn && !!document.querySelector('#plotL .ph-tilt:not([hidden])')` });
  await frames(); await frames();
  await legend(tag + ' on the Stack', true);
}
return { pass: fails.length === 0, fails, info };
