// The glide tile's morph (#2409): between two planes the tile's first formula turns into the second glyph by glyph. A
// glyph of both slides and resizes from its place in the first to its place in the second; one only the first has fades
// out before the half, one only the second has fades in after it. The frame is the thread's position's alone.
// TILE_CHAIN (z² + 1/z, then sin z + e^z/(z − 1)), the thread held between w₁ and w₂, at desktop 1200 × 800 in en, ru
// and it, and on a phone at 740 × 360 in en:
// - at 40 %, 50 % and 60 % of the way the tile shows the morph (where it shows: on the phone it may have no room, and
//   then it is hidden, never squeezed), its glyphs paired as many as can be (at least MIN_PAIRS);
// - a pair's glyph is in transit: its affine is the eased position's part way between its two ends (GlyphMatch.ease, at
//   the half exactly between them), and some pair moves;
// - a glyph only the first has is at 1 − 2e, one only the second has at 2e − 1 (e the eased position): at 40 % the
//   first's alone still show, the second's do not; at 60 % the reverse;
// - the frame at 50 % is the same held from either side (from 25 % and from 75 %): the thread's position's alone;
// - the tile lies inside the plane and meets nothing it keeps clear of (steps_glide_tile's list, GAP px to spare), at
//   each of the three frames.
// Under reduced motion (desktop, en) no morph: the first formula alone and whole at 40 %, the second at 60 %. A plane
// whose formula is longer than the caption's limit (SV_CAP_TEX_MAX: LONG_CHAIN's w₂) has no morph either: at the half
// the tile shows at most one formula, never one for w₂.
// Frames go to shots/ (morph-<case>-40, -50, -60.png) for the screenshot review.
// The page opens with ?view=steps (loadView('steps', …)).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const READY = 'typeof __cmwSteps === "function" && !!window.GLR && typeof __cmwTile === "function"';
const GAP = 4;          // px: the least room the tile leaves to what it keeps clear of (it keeps 8)
const MIN_PAIRS = 3;    // the glyphs of w₁ = … and w₂ = … paired at least: w, = and a z (their subscripts differ)
const EPS = 0.01;       // the affines and opacities as the page writes them (3 decimals)
const TILE_CHAIN = [{ type: 'custom', params: { expr: 'z^2+1/z' }, on: true }, { type: 'custom', params: { expr: 'sin(z)+exp(z)/(z-1)' }, on: true }];
const LONG = 'sin(z)+cos(z)+exp(z)/(z-1)+sinh(z)*cosh(z)+tan(z)/(z+2)+log(z+3)';
const LONG_CHAIN = [{ type: 'custom', params: { expr: 'z^2+1/z' }, on: true }, { type: 'custom', params: { expr: LONG }, on: true }];
// (the boxes the tile must keep clear of, in the page's px, as steps_glide_tile reads them)
const OBSTACLES = `(() => {
  const vis = (e) => { if (!e || !e.isConnected || e.id === 'svTile') return null; if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 ? r : null; };
  const CONTROL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=radio], [role=checkbox], [role=switch], [role=menuitem], [role=option], [role=slider], [role=spinbutton], [role=combobox]';
  const MORE = '.chip, .legend-chip, .empty-chip, .dim-chip, .ld-key, .sv-empty, .options, .viewstack, #toastHost > *, .ph-col, .ph-ctx, .ph-keys, .ph-sheet, .sv-sheet, #svStrip, .sv-bandx, #paneL .pane-head, .pop, dialog[open]';
  const out = [];
  for (const e of document.querySelectorAll(CONTROL + ', ' + MORE)) { if (e.closest('#svTile')) continue; const r = vis(e); if (r) out.push({ what: (e.id ? '#' + e.id : '') + '.' + String(e.className && e.className.baseVal != null ? e.className.baseVal : e.className).split(' ')[0], l: r.left, t: r.top, r: r.right, b: r.bottom }); }
  const nb = __cmwNoteBox('L'), cv = document.getElementById('canvasL');
  if (nb && cv) { const c = cv.getBoundingClientRect(); out.push({ what: 'note', l: c.left + nb.x, t: c.top + nb.y, r: c.left + nb.x + nb.w, b: c.top + nb.y + nb.h }); }
  return out;
})()`;
// the tile now: shown, inside the plane, what it meets, the formulas shown, and the morph (__cmwTile)
const tileNow = () => evJson(`JSON.stringify((() => {
  const el = document.getElementById('svTile'), P = document.getElementById('plotL').getBoundingClientRect(), T = __cmwTile();
  const shown = !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const r = shown ? el.getBoundingClientRect() : null, obs = ${OBSTACLES};
  const meets = r ? obs.filter((o) => r.left - ${GAP} < o.r && r.right + ${GAP} > o.l && r.top - ${GAP} < o.b && r.bottom + ${GAP} > o.t).map((o) => o.what) : [];
  const f = el ? [...el.querySelectorAll('.sv-tile-f')].map((s) => ({ tex: s.dataset.tex || null, shown: !s.hidden, op: +getComputedStyle(s).opacity })) : [];
  return { shown, inside: !!r && r.left >= P.left - 0.5 && r.right <= P.right + 0.5 && r.top >= P.top - 0.5 && r.bottom <= P.bottom + 0.5, meets, f, morph: shown ? T.morph : null };
})())`);
const frames = async () => { await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const hold = async (x) => { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 60000, until: '__cmwSteps().ready.ready' }); await frames(); };
const ease = (u) => u * u * (3 - 2 * u);
const near = (p, q) => p.length === q.length && p.every((v, k) => Math.abs(v - q[k]) <= EPS * Math.max(1, Math.abs(q[k])));
const lerp = (a, b, e) => a.map((v, k) => v + (b[k] - v) * e);
const open = async (c, chain) => {
  await view(c.w, c.h, false, c.phone);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: c.reduced ? 'reduce' : 'no-preference' }] });
  await loadView('steps', 'svmorph' + Date.now(), { shapes: [], steps: chain }, { lang: c.lang });
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
  await frames();
};
const CASES = [
  { tag: 'desk en', w: 1200, h: 800, phone: false, lang: 'en' },
  { tag: 'desk ru', w: 1200, h: 800, phone: false, lang: 'ru' },
  { tag: 'desk it', w: 1200, h: 800, phone: false, lang: 'it' },
  { tag: 'phone 740 en', w: 740, h: 360, phone: true, lang: 'en' },
];
for (const c of CASES) {
  const r = info[c.tag] = {};
  await open(c, TILE_CHAIN);
  const shotName = `morph-${c.tag.replace(/ /g, '-')}`;
  for (const [x, u] of [[1.4, 0.4], [1.5, 0.5], [1.6, 0.6]]) {
    await hold(x);
    const t = r[u] = await tileNow();
    await shot(`${shotName}-${Math.round(u * 100)}`);
    const tag = `${c.tag}, ${Math.round(u * 100)} % of the way`;
    if (!c.phone) ok(`${tag}: the tile shows`, t.shown, t);
    if (!t.shown) continue;
    ok(`${tag}: the tile lies inside the plane`, t.inside, t);
    ok(`${tag}: the tile meets nothing (${GAP} px to spare)`, t.meets.length === 0, t.meets);
    ok(`${tag}: the tile shows the morph, at least ${MIN_PAIRS} glyphs paired`, !!t.morph && t.morph.pairs >= MIN_PAIRS, t.morph && { pairs: t.morph.pairs });
    if (!t.morph) continue;
    const e = ease(u), pairs = t.morph.parts.filter((p) => p.fade === 0), gone = t.morph.parts.filter((p) => p.fade < 0), come = t.morph.parts.filter((p) => p.fade > 0);
    const off = pairs.filter((p) => !near(p.now, lerp(p.a, p.b, e)));
    ok(`${tag}: each pair's glyph stands part way between its two places (eased ${e.toFixed(3)})`, off.length === 0, off.slice(0, 3));
    if (u === 0.5) ok(`${tag}: some pair moves`, pairs.some((p) => !near(p.a, p.b)), pairs.length);
    const opBad = gone.filter((p) => Math.abs(p.op - Math.max(0, 1 - 2 * e)) > EPS).concat(come.filter((p) => Math.abs(p.op - Math.max(0, 2 * e - 1)) > EPS));
    ok(`${tag}: the first's glyphs alone fade out before the half, the second's in after it`, opBad.length === 0 && (u !== 0.4 || gone.every((p) => p.op > 0) && come.every((p) => p.op === 0)) && (u !== 0.6 || gone.every((p) => p.op === 0) && come.every((p) => p.op > 0)), { gone: gone.map((p) => p.op), come: come.map((p) => p.op) });
    ok(`${tag}: no formula shown whole beside the morph`, t.f.every((f) => !f.shown), t.f);
  }
  // (the frame at the half from either side)
  if (r[0.5] && r[0.5].morph) {
    await hold(1.25); await hold(1.5);
    const below = await tileNow();
    await hold(1.75); await hold(1.5);
    const above = await tileNow();
    const same = !!(below.morph && above.morph) && below.morph.parts.length === above.morph.parts.length && below.morph.parts.every((p, k) => near(p.now, above.morph.parts[k].now) && Math.abs(p.op - above.morph.parts[k].op) <= EPS);
    ok(`${c.tag}: the frame at the half is the same from either side`, same, { below: below.morph && below.morph.parts.length, above: above.morph && above.morph.parts.length });
  }
}
// (reduced motion: a change-over at the half, no morph)
{
  const c = { tag: 'desk en reduced', w: 1200, h: 800, phone: false, lang: 'en', reduced: true }, r = info[c.tag] = {};
  await open(c, TILE_CHAIN);
  await hold(1.4);
  const b = r.before = await tileNow();
  await hold(1.6);
  const a = r.after = await tileNow();
  ok(`${c.tag}: at 40 % no morph, the first formula alone and whole`, b.shown && !b.morph && b.f[0].shown && b.f[0].op > 0.98 && !b.f[1].shown, b);
  ok(`${c.tag}: at 60 % no morph, the second formula alone and whole`, a.shown && !a.morph && a.f[1].shown && a.f[1].op > 0.98 && !a.f[0].shown, a);
}
// (a formula past the caption's limit: no morph, and never one for it)
{
  const c = { tag: 'desk en long', w: 1200, h: 800, phone: false, lang: 'en' }, r = info[c.tag] = {};
  await open(c, LONG_CHAIN);
  await hold(1.5);
  const t = r.half = await tileNow();
  r.tex = t.f.map((f) => f.tex);
  ok(`${c.tag}: w₂'s formula is past the limit (the tile has none for it)`, !t.f[1] || !t.f[1].tex, r.tex);
  ok(`${c.tag}: at the half no morph, and the tile hidden or showing at most one formula, never one for w₂`, !t.morph && (!t.shown || (t.f.filter((f) => f.shown).length <= 1 && !(t.f[1] && t.f[1].shown))), t);
}
return { pass: fails.length === 0, fails: fails.slice(0, 40), info };
