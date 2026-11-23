// The steps view's glide tile (#1533): while a glide is under way, a small chip over the left plane shows the formula of
// the plane it leaves fading into the formula of the plane it goes to. Alexander's rule: it is low priority, it
// intersects nothing and it does not clutter. A chain of two steps whose composite is long (TILE_CHAIN), the glide
// held between w₁ and w₂, at desktop 1200 × 800 and phone 360 × 640, light and dark, en and ru:
// - the tile shows on the desktop (on the phone it may have no room: then it is hidden, never squeezed);
// - where it shows, it lies inside the plane and its box meets none of what it keeps clear of: every visible control,
//   the readout and the plane's chips, the colour key, the strip and its band, the head, the toasts, the phone's key
//   column, shape bar and sheets, and the plane's note (__cmwNoteBox) — each with GAP px to spare;
// - it stays so with a long toast up, with the plane's hint chip shown (desktop), and with a phone sheet open (phone),
//   moving to another spot or hiding;
// - it names the planes: the second formula is w₂'s, w_{2} = …;
// - one formula at a time, and only it takes room in the tile (rvA, rvB on #2317: overlapping glyphs, a chip as wide as
//   the other formula): never both shown, the tile no wider than its formula and padding (TIGHT). At rest at a quarter
//   of the way the first alone, at the half the second alone (both formulas fitting); under reduced motion the same
//   just either side of the half; parked on a plane it is hidden.
// Its frames go to shots/ (tile-<case>-q1.png and -q3.png, a quarter and three quarters of the way; -toast, -hint and
// -sheet with those up) for the screenshot review.
// The page opens with ?view=steps (loadView('steps', …)).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const READY = 'typeof __cmwSteps === "function" && !!window.GLR';
const GAP = 4;   // px: the least room the tile leaves to what it keeps clear of (it keeps 8)
const TIGHT = 24;   // px: the most the tile may be wider than the formula it shows (its padding and border are 18)
const TILE_CHAIN = [{ type: 'custom', params: { expr: 'z^2+1/z' }, on: true }, { type: 'custom', params: { expr: 'sin(z)+exp(z)/(z-1)' }, on: true }];
// (the boxes the tile must keep clear of, in the page's px; vis as test/lib/layout.js reads it)
const OBSTACLES = `(() => {
  const vis = (e) => { if (!e || !e.isConnected || e.id === 'svTile') return null; if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 ? r : null; };
  const CONTROL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=radio], [role=checkbox], [role=switch], [role=menuitem], [role=option], [role=slider], [role=spinbutton], [role=combobox]';
  const MORE = '.chip, .legend-chip, .empty-chip, .dim-chip, .ld-key, .sv-empty, .options, .viewstack, #toastHost > *, .ph-col, .ph-ctx, .ph-keys, .ph-sheet, .sv-sheet, #svStrip, .sv-bandx, #paneL .pane-head, .pop, dialog[open]';
  const out = [];
  for (const e of document.querySelectorAll(CONTROL + ', ' + MORE)) { if (e.closest('#svTile')) continue; const r = vis(e); if (r) out.push({ what: (e.id ? '#' + e.id : '') + '.' + String(e.className && e.className.baseVal != null ? e.className.baseVal : e.className).split(' ').slice(0, 2).join('.'), l: r.left, t: r.top, r: r.right, b: r.bottom }); }
  const nb = __cmwNoteBox('L'), cv = document.getElementById('canvasL');
  if (nb && cv) { const c = cv.getBoundingClientRect(); out.push({ what: 'note', l: c.left + nb.x, t: c.top + nb.y, r: c.left + nb.x + nb.w, b: c.top + nb.y + nb.h }); }
  return out;
})()`;
// the tile now: shown or not, its box, the plane's box, its two formulas (TeX, shown, opacity) and what it meets
const tileNow = () => evJson(`JSON.stringify((() => {
  const el = document.getElementById('svTile'), P = document.getElementById('plotL').getBoundingClientRect();
  const shown = !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const r = shown ? el.getBoundingClientRect() : null, obs = ${OBSTACLES};
  const meets = r ? obs.filter((o) => r.left - ${GAP} < o.r && r.right + ${GAP} > o.l && r.top - ${GAP} < o.b && r.bottom + ${GAP} > o.t).map((o) => o.what) : [];
  const f = el ? [...el.querySelectorAll('.sv-tile-f')].map((s) => ({ tex: s.dataset.tex || null, shown: !s.hidden, op: +getComputedStyle(s).opacity, w: Math.round(s.getBoundingClientRect().width) })) : [];
  return { shown, box: r && [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], plot: [Math.round(P.left), Math.round(P.top), Math.round(P.right), Math.round(P.bottom)],
    inside: !!r && r.left >= P.left - 0.5 && r.right <= P.right + 0.5 && r.top >= P.top - 0.5 && r.bottom <= P.bottom + 0.5, meets, f };
})())`);
const frames = async () => { await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// a held frame: the thread at x, the frame settled (__cmwSteps().ready.ready, as a held glide is waited for)
const hold = async (x) => { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 60000, until: '__cmwSteps().ready.ready' }); await frames(); };
const check = (tag, t, mustShow) => {
  if (mustShow) ok(`${tag}: the tile shows`, t.shown, t);
  if (t.shown) {
    ok(`${tag}: the tile lies inside the plane`, t.inside, t);
    ok(`${tag}: the tile meets nothing (${GAP} px to spare)`, t.meets.length === 0, t);
  }
};
const CASES = [
  { tag: 'desk light en', w: 1200, h: 800, dark: false, phone: false, lang: 'en' },
  { tag: 'desk dark en', w: 1200, h: 800, dark: true, phone: false, lang: 'en' },
  { tag: 'desk light ru', w: 1200, h: 800, dark: false, phone: false, lang: 'ru' },
  { tag: 'phone light en', w: 360, h: 640, dark: false, phone: true, lang: 'en' },
  { tag: 'phone dark ru', w: 360, h: 640, dark: true, phone: true, lang: 'ru' },
  { tag: 'desk light en reduced', w: 1200, h: 800, dark: false, phone: false, lang: 'en', reduced: true },
];
for (const c of CASES) {
  const r = info[c.tag] = {};
  await view(c.w, c.h, c.dark, c.phone);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: c.reduced ? 'reduce' : 'no-preference' }] });
  await loadView('steps', 'svtile' + Date.now(), { shapes: [], steps: TILE_CHAIN }, { lang: c.lang });
  await settled({ max: 30000, until: READY });
  // (the theme as the page's own switch sets it)
  await ev(`(document.documentElement.setAttribute('data-theme', '${c.dark ? 'dark' : 'light'}'), 1)`);
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
  await frames();
  r.parked0 = await tileNow();
  ok(`${c.tag}: parked on plane z, no tile`, !r.parked0.shown, r.parked0);
  const name = `tile-${c.tag.replace(/ /g, '-')}`;
  if (c.reduced) {
    // (a change-over at the half: the first formula whole just before it, the second just after)
    await hold(1.45);
    const b = r.before = await tileNow();
    await hold(1.55);
    const a = r.after = await tileNow();
    ok(`${c.tag}: just before the half, the first formula alone, whole`, b.shown && b.f[0].shown && b.f[0].op > 0.98 && !b.f[1].shown, b);
    ok(`${c.tag}: just after the half, the second formula alone, whole`, a.shown && a.f[1].shown && a.f[1].op > 0.98 && !a.f[0].shown, a);
    continue;
  }
  await hold(1.75);
  await shot(`${name}-q3`);
  await hold(1.5);
  const t = r.held = await tileNow();
  check(`${c.tag}, held at 1.5`, t, !c.phone);
  if (t.shown) ok(`${c.tag}: the second formula is w₂'s`, !!t.f[1] && /^w_\{2\} = /.test(t.f[1].tex || ''), t.f);
  if (t.shown) {
    const on = t.f.filter((f) => f.shown);
    ok(`${c.tag}: at rest at the half, one formula shown, whole: the second`, on.length === 1 && t.f[1].shown && t.f[1].op > 0.98, t.f);
    ok(`${c.tag}: the tile no wider than its formula and ${TIGHT} px`, on.length === 1 && t.box[2] - t.box[0] <= on[0].w + TIGHT, { box: t.box, f: t.f });
  }
  // (a quarter of the way: the first formula alone, where both fit)
  await hold(1.25);
  const q = r.quarter = await tileNow();
  await shot(`${name}-q1`);
  if (q.shown) ok(`${c.tag}: at rest at a quarter, one formula shown, whole: the first`, q.f[0].shown && q.f[0].op > 0.98 && !q.f[1].shown, q.f);
  await hold(1.5);
  // (a long toast up)
  await ev(`(__cmwToast('A long message to see that the tile keeps clear of the toasts, wherever they are placed', 'Undo', { ms: 60000 }), 1)`);
  await settled({ max: 10000, until: `!!document.querySelector('#toastHost .toast')` });
  await frames();
  const tt = r.toast = await tileNow();
  await shot(`${name}-toast`);
  check(`${c.tag}, with a toast`, tt, false);
  if (c.phone) {
    // (a phone sheet open)
    await ev(`(Phone.open('edit'), 1)`);
    await settled({ max: 10000, until: `!!document.querySelector('.ph-sheet.open')` });
    await frames();
    const ts = r.sheet = await tileNow();
    await shot(`${name}-sheet`);
    check(`${c.tag}, with a sheet open`, ts, false);
    await ev(`(Phone.close && Phone.close(), 1)`);
  } else {
    // (the plane's hint chip shown, a long note)
    await ev(`(() => { const n = document.getElementById('sphereChipL'); n.querySelector('span').textContent = 'A hint over the plane, about as long as the longest the plane shows'; n.hidden = false; return 1; })()`);
    await frames();
    const th = r.hint = await tileNow();
    await shot(`${name}-hint`);
    check(`${c.tag}, with the hint chip`, th, false);
    await ev(`(document.getElementById('sphereChipL').hidden = true, 1)`);
  }
  await ev(`__cmwSteps({ go: 2, now: true }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
  await frames();
  r.parked2 = await tileNow();
  ok(`${c.tag}: parked on w₂, no tile`, !r.parked2.shown, r.parked2);
}
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
return { pass: fails.length === 0, fails, info };
