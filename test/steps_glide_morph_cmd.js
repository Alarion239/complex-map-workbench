// The glide tile's morph (#2409): between two planes the tile's first formula turns into the second glyph by glyph, in
// three parts of the way: a glyph only the first has fades out (0 to OUT), a glyph of both slides and resizes from its
// place in the first to its place in the second (OUT to IN, across the middle), a glyph only the second has fades in (IN
// to 1); the plane's name's index changes over in place as the second's glyphs start to come in. The frame is the
// thread's position's alone.
// TILE_CHAIN (z² + 1/z, then sin z + e^z/(z − 1)), the thread held between w₁ and w₂, at desktop 1200 × 800 in en, ru
// and it, and on a phone at 740 × 360 in en:
// - at 10 % to 90 % of the way the tile shows the morph (where it shows: on the phone it may have no room, and
//   then it is hidden, never squeezed), its glyphs paired as many as can be (at least MIN_PAIRS);
// - a pair's glyph is in transit: its affine is part way between its two ends as GlyphMatch.move says (at the half
//   exactly between them), and some pair moves;
// - a glyph only the first has is at GlyphMatch.fadeOut's opacity (gone by OUT), one only the second has at fadeIn's
//   (none before IN), and the name's index at nameOut's and nameIn's;
// - at 40 % to 90 % of the way, no glyph coming in that shows lies over a pair's glyph still in transit (rvE's
//   «sinz(²»), and at 10 % to 90 % the name shows an index (w_k's k, the glyphs between w and the first =), one at
//   least half there, the first plane's up to where the second's glyphs come in (IN) and the second's after;
// - the frame at 50 % is the same held from either side (from 25 % and from 75 %): the thread's position's alone;
// - the tile lies inside the plane and meets nothing it keeps clear of (steps_glide_tile's list, GAP px to spare), at
//   each frame, 10 % to 90 % of the way.
// Under reduced motion (desktop, en) no morph: the first formula alone and whole at 40 %, the second at 60 %. A plane
// whose formula is longer than the caption's limit (SV_CAP_TEX_MAX: LONG_CHAIN's w₂) has no morph either: at the half
// the tile shows at most one formula, never one for w₂. Nor a pair whose second formula is too wide for the tile (a phone
// 360 px wide): the tile is hidden or shows the first formula alone, never a squeezed morph.
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
// (a chain whose second formula is wider than a 360 px phone's tile, and within the caption's limit)
const WIDE_CHAIN = [{ type: 'custom', params: { expr: 'z^2+1/z' }, on: true }, { type: 'custom', params: { expr: 'sin(z)+cos(z)+exp(z)/(z-1)' }, on: true }];
const LONG = 'sin(z)+cos(z)+exp(z)/(z-1)+sinh(z)*cosh(z)+tan(z)/(z+2)+log(z+3)';
const LONG_CHAIN = [{ type: 'custom', params: { expr: 'z^2+1/z' }, on: true }, { type: 'custom', params: { expr: LONG }, on: true }];
// (the boxes the tile must keep clear of, in the page's px, as steps_glide_tile reads them)
const OBSTACLES = `(() => {
  const vis = (e) => { if (!e || !e.isConnected || e.id === 'svTile') return null; if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 ? r : null; };
  const CONTROL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=radio], [role=checkbox], [role=switch], [role=menuitem], [role=option], [role=slider], [role=spinbutton], [role=combobox]';
  const MORE = '.chip, .legend-chip, .empty-chip, .dim-chip, .ld-key, .sv-empty, .options, .viewstack, #toastHost > *, .ph-ctx, .ph-keys, .ph-sheet, .sv-sheet, #svStrip, .sv-bandx, #paneL .pane-head, .pop, dialog[open]';
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
  // (the morph's glyphs in the page, in the order of its parts: box, opacity and code point)
  const els = shown ? [...el.querySelectorAll('.sv-tile-m svg > g > *')].map((g) => { const b = g.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, op: +(g.getAttribute('opacity') || 1), c: g.getAttribute('data-c') || '' }; }) : [];
  return { shown, inside: !!r && r.left >= P.left - 0.5 && r.right <= P.right + 0.5 && r.top >= P.top - 0.5 && r.bottom <= P.bottom + 0.5, meets, f, morph: shown ? T.morph : null, els };
})())`);
const frames = async () => { await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const hold = async (x) => { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 60000, until: '__cmwSteps().ready.ready' }); await frames(); };
// (GlyphMatch's three parts, as src/glyphmatch.js has them: the pairs move from OUT to IN, the name's index changes over
// from NAME_A to NAME_B)
const OUT = 0.25, IN = 0.75, NAME_A = 0.7, NAME_B = 0.8;
const ease = (u) => { const t = Math.min(1, Math.max(0, u)); return t * t * (3 - 2 * t); }, span = (u, a, b) => ease((u - a) / (b - a));
const PHASE = { pair: () => 1, out: (u) => 1 - span(u, 0, OUT), in: (u) => span(u, IN, 1), nameOut: (u) => 1 - span(u, NAME_A, NAME_B), nameIn: (u) => span(u, NAME_A, NAME_B) };
// (a part's role: the hook's, or from the sign it gave before roles: 0 a pair, below the first's alone, above the second's)
const roleOf = (p) => p.role || (p.fade === 0 ? 'pair' : p.fade < 0 ? 'out' : 'in');
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
  for (const u of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
    await hold(1 + u);
    const t = r[u] = await tileNow();
    if (u >= 0.4 && u <= 0.6) await shot(`${shotName}-${Math.round(u * 100)}`);
    const tag = `${c.tag}, ${Math.round(u * 100)} % of the way`;
    if (!c.phone) ok(`${tag}: the tile shows`, t.shown, t);
    if (!t.shown) continue;
    ok(`${tag}: the tile lies inside the plane`, t.inside, t);
    ok(`${tag}: the tile meets nothing (${GAP} px to spare)`, t.meets.length === 0, t.meets);
    ok(`${tag}: the tile shows the morph, at least ${MIN_PAIRS} glyphs paired`, !!t.morph && t.morph.pairs >= MIN_PAIRS, t.morph && { pairs: t.morph.pairs });
    if (!t.morph) continue;
    const parts = t.morph.parts.map((p, k) => Object.assign({ role: roleOf(p), el: t.els[k] }, p)), pairs = parts.filter((p) => p.role === 'pair');
    const m = span(u, OUT, IN), off = pairs.filter((p) => !near(p.now, lerp(p.a, p.b, m)));
    ok(`${tag}: each pair's glyph stands part way between its two places (${m.toFixed(3)} of the way)`, off.length === 0, off.slice(0, 3).map((p) => ({ now: p.now, a: p.a, b: p.b })));
    if (u === 0.5) ok(`${tag}: some pair moves`, pairs.some((p) => !near(p.a, p.b)), pairs.length);
    const opBad = parts.filter((p) => Math.abs(p.op - PHASE[p.role](u)) > EPS);
    ok(`${tag}: each glyph at its part's opacity (the first's alone out by ${OUT}, the second's in from ${IN})`, opBad.length === 0, opBad.slice(0, 4).map((p) => ({ role: p.role, op: p.op, want: +PHASE[p.role](u).toFixed(3) })));
    ok(`${tag}: no formula shown whole beside the morph`, t.f.every((f) => !f.shown), t.f);
    // (rvE's «sinz(²»: a glyph coming in that shows never lies over a pair's glyph still on its way)
    if (u >= 0.4) {
      const moving = pairs.filter((p) => !near(p.now, p.a) && !near(p.now, p.b)), meet = (a, b) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
      const over = parts.filter((p) => p.role === 'in' && p.el && p.el.op > 0.02).filter((p) => moving.some((q) => q.el && meet(p.el, q.el)));
      ok(`${tag}: no glyph coming in lies over a glyph still on its way`, over.length === 0, { over: over.length, moving: moving.length });
    }
    // (the name's index: the glyphs between w, the first, and the first =)
    const els = t.els.slice().sort((a, b) => a.l - b.l), w = els[0], eq = els.find((g) => g.c.toUpperCase() === '3D');
    const index = w && eq ? t.els.filter((g) => g !== w && g.l >= (w.l + w.r) / 2 && g.r <= eq.l + 0.5) : [];
    ok(`${tag}: the name shows an index, one at least half there`, index.some((g) => g.op >= 0.5), index.map((g) => g.op));
    // (rvE: the tile names the first plane while it shows the first's formula, up to where the second's glyphs come in)
    const old = parts.filter((p) => p.role === 'nameOut'), neu = parts.filter((p) => p.role === 'nameIn');
    if (old.length && neu.length) ok(`${tag}: the name's index is the ${u < IN ? 'first' : 'second'} plane's${u < IN ? ', the second\'s glyphs not yet coming in' : ''}`, u < IN ? old.every((p) => p.op >= 0.5) && neu.every((p) => p.op < 0.5) : neu.every((p) => p.op >= 0.5), { old: old.map((p) => p.op), neu: neu.map((p) => p.op) });
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
// (a pair whose second formula is too wide for the tile, on a narrow phone, 360 x 640: the change-over, never a squeezed morph)
{
  const c = { tag: 'phone 360 en, the second too wide', w: 360, h: 640, phone: true, lang: 'en' }, r = info[c.tag] = {};
  await open(c, WIDE_CHAIN);
  await hold(1.25);
  const fits = r.fits = await ev('__cmwTile().fits');
  ok(`${c.tag}: the first formula fits the tile and the second does not`, !!fits && fits[0] === true && fits[1] === false, fits);
  for (const x of [1.25, 1.5, 1.75]) {
    await hold(x);
    const t = r[x] = await tileNow();
    ok(`${c.tag}, held at ${x}: no morph; the tile hidden or the first formula alone`, !t.morph && (!t.shown || (t.f[0].shown && !t.f[1].shown)), t);
  }
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
