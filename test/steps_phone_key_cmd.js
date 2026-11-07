// The steps view's per-plane key on a phone (412 x 860 and 360 x 740, touch): example 1 with the thread parked at each plane
// and the colour plane T at each plane (the sweep of test/lib/plane_key_kit.js, which also checks the legend's kind and
// caption against the laptop's key). On the phone the key is a folded glyph on the plane that a tap unfolds into the card (a
// second tap folds it); the glyph and the card are each whole (inside the plane and the screen) and nothing else covers them
// (the topmost element at the middle and near the four corners, inside the rounded corners, is the key).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'plane_key_kit.js'), 'utf8'));
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// the key element's rect, its plane's rect, the screen, and what is on top at its middle and near its corners
const probe = () => ev(`(() => {
  const k = document.getElementById('leftLegend'), p = document.getElementById('plotL');
  if (!k || !p || !k.getClientRects().length) return { shown: false };
  const b = k.getBoundingClientRect(), q = p.getBoundingClientRect();
  const pts = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]].map(([fx, fy]) => { const e = document.elementFromPoint(b.left + fx * b.width, b.top + fy * b.height); return !!e && (e === k || k.contains(e)) ? '' : (e ? (e.id || e.className || e.tagName) + '' : 'none'); });
  const r = (x) => Math.round(x * 10) / 10;
  return { shown: true, collapsed: k.classList.contains('collapsed'), open: k.classList.contains('open'), w: r(b.width), h: r(b.height),
    inPlane: b.left >= q.left - 0.5 && b.right <= q.right + 0.5 && b.top >= q.top - 0.5 && b.bottom <= q.bottom + 0.5,
    onScreen: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, top: pts, vw: innerWidth };
})()`);
for (const [w, h] of [[412, 860], [360, 740]]) {
  await view(w, h, false, true);
  const nPl = await K.open('phonekey' + w + '_', PORT);
  ok(`${w}: the phone layout`, await ev('!!Phone._state().on'), null);
  ok(`${w}: example 1 has three planes`, nPl === 3, nPl);
  await K.sweep(ok, info, nPl, async (name, lg) => {
    name = `${w}, ${name}`;
    const pr = await probe();
    info[name] = { lg, pr };
    ok(`${name}: the folded key shows on the phone, whole, and nothing covers it`, pr.shown && pr.collapsed && pr.inPlane && pr.onScreen && pr.top.every((t) => t === ''), pr);
    // (a tap unfolds the card: it is as whole and as uncovered as the glyph, and larger than it)
    await ev(`(document.getElementById('leftLegend').click(), 1)`);
    await sleep(150);
    const un = await probe();
    info[name].unfolded = un;
    ok(`${name}: the unfolded card is shown, whole, and nothing covers it`, un.shown && !un.collapsed && un.w > pr.w && un.inPlane && un.onScreen && un.top.every((t) => t === ''), un);
    await ev(`(document.getElementById('leftLegend').click(), 1)`);
  });
}
return { pass: !fails.length, fails, info };
