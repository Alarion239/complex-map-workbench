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
// - between the planes (both formulas fitting) it shows the morph from the first formula to the second (#2409:
//   steps_glide_morph checks its glyphs), and no formula whole beside it, at a quarter of the way and at the half, the
//   tile no wider than the morph's frame and padding (TIGHT); under reduced motion one formula at a time, and only it
//   takes room in the tile: the first alone and whole just before the half, the second just after; parked on a plane it
//   is hidden.
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
  const mo = el && el.querySelector('.sv-tile-m'), m = mo && !mo.hidden ? { w: Math.round(mo.getBoundingClientRect().width) } : null;
  return { shown, box: r && [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], plot: [Math.round(P.left), Math.round(P.top), Math.round(P.right), Math.round(P.bottom)],
    inside: !!r && r.left >= P.left - 0.5 && r.right <= P.right + 0.5 && r.top >= P.top - 0.5 && r.bottom <= P.bottom + 0.5, meets, f, m };
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
    // (and while the thread is dragged between w₁ and w₂, 45% of the way: the one real motion between planes under reduced motion, where
    // the formula changes over at the half: the first whole, the second not shown, where a fade would show it part way)
    await ev(`__cmwSteps({ go: 1, now: true }); 1`);
    await settled({ max: 60000, until: '!__cmwSteps().moving' });
    await frames();
    const geo = await evJson(`JSON.stringify((() => { const C = (e) => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
      const t = document.querySelector('#svStrip .sv-thumb'), p = [...document.querySelectorAll('#svStrip .sv-plane')]; return { thumb: t ? C(t) : null, p1: p[1] ? C(p[1]) : null, p2: p[2] ? C(p[2]) : null }; })())`);
    ok(`${c.tag}: the thread's thumb and planes w₁, w₂ are on the strip`, !!(geo.thumb && geo.p1 && geo.p2), geo);
    if (geo.thumb && geo.p1 && geo.p2) {
      const to = [geo.thumb[0] + 0.45 * (geo.p2[0] - geo.p1[0]), geo.thumb[1] + 0.45 * (geo.p2[1] - geo.p1[1])];
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: geo.thumb[0], y: geo.thumb[1], button: 'none' });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.thumb[0], y: geo.thumb[1], button: 'left', buttons: 1, clickCount: 1 });
      for (let n = 1; n <= 6; n++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: geo.thumb[0] + (to[0] - geo.thumb[0]) * n / 6, y: geo.thumb[1] + (to[1] - geo.thumb[1]) * n / 6, button: 'left', buttons: 1 });
      await frames();
      const d = r.dragged = await tileNow();
      r.dragX = await ev(`__cmwSteps().x`);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to[0], y: to[1], button: 'left', buttons: 0, clickCount: 1 });
      ok(`${c.tag}: dragged to about 45% of the way (between w₁ and w₂)`, r.dragX > 1.3 && r.dragX < 1.5, r.dragX);
      ok(`${c.tag}: dragged, the first formula alone and whole, not part way through a fade`, d.shown && d.f[0].shown && d.f[0].op > 0.98 && !d.f[1].shown, d);
    }
    continue;
  }
  await hold(1.75);
  await shot(`${name}-q3`);
  await hold(1.5);
  const t = r.held = await tileNow();
  check(`${c.tag}, held at 1.5`, t, !c.phone);
  if (t.shown) ok(`${c.tag}: the second formula is w₂'s`, !!t.f[1] && /^w_\{2\} = /.test(t.f[1].tex || ''), t.f);
  if (t.shown) {
    ok(`${c.tag}: at rest at the half, the morph shown, no formula whole beside it`, !!t.m && t.f.every((f) => !f.shown), { m: t.m, f: t.f });
    ok(`${c.tag}: the tile no wider than the morph's frame and ${TIGHT} px`, !!t.m && t.box[2] - t.box[0] <= t.m.w + TIGHT, { box: t.box, m: t.m });
  }
  // (a quarter of the way: the first formula alone, where both fit)
  await hold(1.25);
  const q = r.quarter = await tileNow();
  await shot(`${name}-q1`);
  check(`${c.tag}, held at a quarter`, q, !c.phone);
  if (q.shown) ok(`${c.tag}: at rest at a quarter, the morph shown, no formula whole beside it`, !!q.m && q.f.every((f) => !f.shown), { m: q.m, f: q.f });
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
// (#2357) the chain changed under the tile, and the Look down key appearing under it, the thread held between w₁ and w₂ at desktop 1200 × 800:
// the tile names the formulas of the chain now there, not those it typeset for the same pair before (another example loaded over
// the chain, its Undo, the tour's Esc); and it clears the Look down key once the key is there
{
  const tex2 = () => ev(`(document.querySelectorAll('#svTile .sv-tile-f')[1] || { dataset: {} }).dataset.tex || null`);
  const ready = () => settled({ max: 60000, until: '__cmwSteps().ready.ready' });
  await view(1200, 800, false, false);
  await loadView('steps', 'svtilechain' + Date.now(), { shapes: [{ id: 'd', kind: 'disc', c: [1, 0], r: 0.5, stage: 2 }], steps: TILE_CHAIN }, { lang: 'en' });
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
  await hold(1.5);
  const tex0 = info.chainTex0 = await tex2();
  ok('the chain: held at 1.5, the tile shows the second formula, with the chain\'s sin', /sin/.test(tex0 || ''), tex0);
  // (another chain over it: an example loaded)
  await ev(`__cmwExample(1); 1`); await ready();
  await hold(1.25); await hold(1.5);
  const tex1 = info.chainTex1 = await tex2();
  ok('another example loaded: held at 1.5 again, the tile shows its formula (e^z), not the old chain\'s', /e\^\{z\}/.test(tex1 || '') && !/sin/.test(tex1 || ''), tex1);
  // (and its Undo)
  await ev(`document.getElementById('undoBtn').click(); 1`); await ready();
  await hold(1.25); await hold(1.5);
  const tex2u = info.chainTexUndo = await tex2();
  ok('after Undo: held at 1.5 again, the tile shows the chain\'s formula again (sin)', /sin/.test(tex2u || ''), tex2u);
  // (the Look down key appearing, the thread held at a quarter: the disc is on the second plane, whose key shows between w₁ and w₂)
  await hold(1.25);
  await ev(`__cmwSelect('d'); 1`);
  await settled({ max: 10000, until: `(() => { const k = document.querySelector('#plotL .ld-key'); return !!k && !k.hidden; })()` });
  await frames();
  const tk = info.keyShown = await tileNow();
  check('the Look down key shown, the thread held at a quarter', tk, true);
  // (the hook's list of what the tile keeps clear of, in the page's px, covers each box over the plane that the suite's own list names, the key's included)
  const covered = info.obstacles = await evJson(`JSON.stringify((() => {
    const P = document.getElementById('plotL').getBoundingClientRect(), app = __cmwTile().obstacles, e = 1;
    const own = ${OBSTACLES}.filter((o) => o.l < P.right && o.r > P.left && o.t < P.bottom && o.b > P.top);
    return { n: own.length, missing: own.filter((o) => !app.some((a) => a[0] <= o.l + e && a[1] <= o.t + e && a[2] >= o.r - e && a[3] >= o.b - e)).map((o) => o.what) };
  })())`);
  ok('the app\'s obstacle list covers every box the suite names, the Look down key among them', covered.n > 0 && covered.missing.length === 0, covered);
}
// (the tour's Esc gives the chain back, the thread parked where it was between w₁ and w₂: the tile names the chain's formulas again,
// not those the tour's scene had there)
{
  const tex2 = () => ev(`(document.querySelectorAll('#svTile .sv-tile-f')[1] || { dataset: {} }).dataset.tex || null`);
  await view(1200, 800, false, false);
  await loadView('steps', 'svtiletour' + Date.now(), { shapes: [], steps: TILE_CHAIN }, { lang: 'en' });
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
  await hold(1.5);
  const own = info.tourOwn = await tex2();
  await ev(`Tour.start({ chapter: 'planes' })`);
  await settled({ max: 30000, until: `!!document.querySelector('.tour-strip')` });
  await hold(1.5);
  const during = info.tourDuring = await tex2();
  ok('the tour: its scene\'s formula is on the tile\'s second line while it runs (the setup of the next row)', !!during && during !== own, { own, during });
  await key('Escape');
  await settled({ max: 30000, until: `!document.querySelector('.tour-strip')` });
  await frames(); await frames(); await frames();
  const back = info.tourBack = await tex2();
  ok('after the tour\'s Esc: the tile names the chain\'s formula again (sin), not the tour scene\'s', back === own, { own, during, back });
}
// (a Repeat on the first step, from the step's ⋯ menu, the thread held between w₁ and w₂: the first formula is the repeated step's now,
// not the one typeset before the Repeat, which the chain's own key, repeats and parameters, tells apart)
{
  const { press, pickItem } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'repeat_kit.js'), 'utf8'))({ ev, settled });
  const tex1 = () => ev(`(document.querySelectorAll('#svTile .sv-tile-f')[0] || { dataset: {} }).dataset.tex || null`);
  await view(1200, 800, false, false);
  await loadView('steps', 'svtilerepeat' + Date.now(), { shapes: [], steps: TILE_CHAIN }, { lang: 'en' });
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
  await hold(1.25);
  const before = info.repeatBefore = await tex1();
  ok('Repeat: held at a quarter, the tile shows the first formula, w₁ = the first step', /^w_\{1\} = /.test(before || ''), before);
  ok('Repeat: the ⋯ of step 1 is there', await press('#svStrip .sv-step[data-k="1"] .sv-more'), null);
  await settled({ max: 10000, until: `!!document.querySelector('#popHost .menu .mi')` });
  ok('Repeat: its Repeat… item is there', await pickItem('Repeat…'), null);
  await settled({ max: 30000, until: '__cmwSteps().ready.ready' });
  await hold(1.5);
  await hold(1.25);
  const after = info.repeatAfter = await tex1();
  ok('Repeat: held at a quarter again, the tile shows the repeated step\'s formula, not the one before the Repeat', !!after && after !== before, { before, after });
}
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
return { pass: fails.length === 0, fails, info };
