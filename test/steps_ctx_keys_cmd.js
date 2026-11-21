// On a landscape phone in the steps view, with the orthogonal circle's tall context bar open, every key of the plane (Sphere,
// Display options, Fit view) stands inside the part of the plane the bar leaves, clear of the header, and a press at its centre
// reaches it; no two keys overlap, and the colour key, folded or unfolded, stands clear of all of them. The plane is shorter than
// the column of three keys plus the bar at 740 x 360 and 667 x 375; 844 x 390 has room, and the same arrangement holds there.
// Also: a press at the folded colour key's centre reaches it, nothing of the bar or the construction chip over it, down to
// 568 x 320 in Russian and Italian; with the globe shown, the hint card stays clear of the globe's disk. Where the plane above
// the bar is shorter than ROOM (the 320 px tall phones: 106 px) the keys stand in one row and the unfolded colour key, taller than
// what is left beside them, stands over the keys it meets: no point of it lies under a key or a chip, and the keys it does not meet
// take their presses; the card is opaque, and a plane key that real Tab presses reach stands over it (its focus is never hidden). The classic
// view's Y has the same: its unfolded Regions key stands over Y's keys at 568 x 320 and 600 x 320, in en, ru and it.
// The unfolded colour key shows all its lines, in the steps view and in the classic view's Regions key: it is not cut to a scrolling box,
// and the last line is not cut off.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const MARGIN = 2;   // the keys stand at least this far from the header and from the bar, px
const ROOM = 140;   // the plane above the bar holds the unfolded colour key (74 px) beside a row of keys (44 px) only when it is this tall, px: the 320 px tall phones' 106 px is not, a 360 px tall phone's 146 px is
const HIT_PX = 8;   // the folded colour key's hit area reaches this far past its glyph, px (phone.css)
const SLACK = 0.5;  // layout rounding, px
// the box of #id has held still for QUIET_FRAMES frames in a row (the key is placed by a frame after it unfolds, and again once the bar's slide ends)
const QUIET_FRAMES = 3, QUIET_MAX_FRAMES = 120;
const placed = (id) => ev(`new Promise((resolve) => {
  const e = document.getElementById(${JSON.stringify(id)}); let last = '', same = 0, n = 0;
  const tick = () => { const r = e.getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].join(); same = k === last ? same + 1 : 0; last = k;
    if (same >= ${QUIET_FRAMES} || ++n > ${QUIET_MAX_FRAMES}) resolve(true); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})`);
const meet = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
// the points of a key's box (a 9 x 7 grid over it) that something other than the key lies over: [x, y, what]
const underPoints = (id) => ev(`(() => {
  const c = document.getElementById(${JSON.stringify(id)}), r = c.getBoundingClientRect(), out = [];
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 6; j++) {
    const x = r.left + 1 + (r.width - 2) * i / 8, y = r.top + 1 + (r.height - 2) * j / 6, e = document.elementFromPoint(x, y);
    if (!e || !c.contains(e)) out.push([Math.round(x), Math.round(y), e ? (e.id || String(e.getAttribute('class') || e.tagName)) : null]);
  }
  return out;
})()`);
// the plane keys that real Tab presses reach from the key `fromId`, each with whether it is the topmost element at its centre
// (a focused key hidden under the open card fails WCAG 2.4.11); TABS presses are enough to pass Fit view and Sphere
const TABS = 5;
const tabbedKeys = async (fromId) => {
  await ev(`document.getElementById(${JSON.stringify(fromId)}).focus(), 1`);
  const out = [];
  for (let i = 0; i < TABS; i++) {
    await key('Tab');
    const k = await ev(`(() => { const a = document.activeElement; if (!a || !a.closest || !a.closest('.ph-col, .viewstack')) return null;
      const r = a.getBoundingClientRect(), e = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return { name: a.id || String(a.className), top: !!e && a.contains(e), under: e ? (e.id || String(e.className || e.tagName)) : null, visible: a.matches(':focus-visible') }; })()`);
    if (k) out.push(k);
  }
  return out;
};
const geometry = () => ev(`(() => {
  const plot = document.getElementById('plotL').getBoundingClientRect(), bar = document.querySelector('.ph-ctx').getBoundingClientRect();
  const head = document.querySelector('.top').getBoundingClientRect();
  const keys = [['Sphere', '#plotL .ph-sph'], ['Display', '#plotL .ph-dsp'], ['Fit view', '#leftFit']].map(([name, sel]) => {
    const b = document.querySelector(sel);
    if (!b || !b.getClientRects().length) return { name, shown: false };
    const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { name, shown: true, r: [r.left, r.top, r.right, r.bottom].map((x) => Math.round(x * 10) / 10), press: !!e && (e === b || b.contains(e)) };
  });
  return { keys, plot: [plot.left, plot.top, plot.right, plot.bottom].map(Math.round), barTop: Math.round(bar.top), headBottom: Math.round(head.bottom) };
})()`);
// [width, height, language, surface]: the plane's own picture and the globe, in the languages with the longest words, down to
// the smallest landscape phones
const CASES = [[740, 360, 'en', 'plane'], [667, 375, 'en', 'plane'], [844, 390, 'en', 'plane'], [568, 320, 'ru', 'plane'], [568, 320, 'it', 'plane'], [600, 320, 'ru', 'plane'],
  [740, 360, 'en', 'sphere'], [667, 375, 'en', 'sphere'], [667, 375, 'ru', 'sphere'], [740, 360, 'it', 'sphere'], [568, 320, 'ru', 'sphere'], [600, 320, 'ru', 'sphere'], [640, 360, 'ru', 'sphere'], [640, 360, 'ru', 'plane']];
// (focus events, and so :focus-visible, reach a page only while it has focus: a headless page is made to, until the rows end)
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
for (const [w, h, lang, surf] of CASES) {
  const name = `${w}x${h} ${lang} ${surf}`;
  await view(w, h, false, true);
  // (the page teaches "Hold and slide to read" once a session, for 8 s, in a long readout that the card drops below: this case sees it, whatever ran before)
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`(sessionStorage.removeItem('cmw-probe-taught'), 1)`);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=ctxkeys${w}${Date.now() % 100000}`);
  await settled({ max: 30000, until: '!!document.documentElement.classList.contains("ph") && typeof __cmwSteps === "function" && !!document.querySelector("#constructTools .tool[data-tool=perp]")' });
  if (surf === 'sphere') {
    await ev(`__cmwSteps({ surf: 'sphere', go: 0, now: true }); 1`);
    await settled({ max: 30000, until: `!!document.querySelector('#leftReadout .rglobe') && !!window.__cmwGlobeDisk` });
  }
  await ev(`document.querySelector('#constructTools .tool[data-tool="perp"]').click(); 1`);
  await settled({ max: 20000, until: 'document.documentElement.classList.contains("ph-ctx-tall") && !!document.querySelector(".ph-ctx.in")' });
  const g = await geometry();
  info[name] = g;
  const roomy = g.barTop - g.headBottom >= ROOM;
  for (const k of g.keys) {
    const tag = `${name}: ${k.name}`;
    ok(`${tag} is on the page`, k.shown, k);
    if (!k.shown) continue;
    const [, top, , bottom] = k.r;
    ok(`${tag} clears the header`, top >= Math.max(g.headBottom, g.plot[1]) + MARGIN - SLACK, [top, g.headBottom, g.plot[1]]);
    ok(`${tag} stands above the context bar`, bottom <= g.barTop - MARGIN + SLACK, [bottom, g.barTop]);
    ok(`${tag} takes a press at its centre`, k.press, k);
  }
  // (the construction chip, which stops short of the keys, stands above the bar)
  const chip = await ev(`(() => { const c = document.querySelector('.draft-chip.cm-on'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map((x) => Math.round(x * 10) / 10); })()`);
  info[`${name} chip`] = chip;
  ok(`${name}: the construction chip is on the page and stands above the bar`, !!chip && chip[3] <= g.barTop + SLACK, { chip, barTop: g.barTop });
  const shown = g.keys.filter((k) => k.shown);
  const overlap = [];
  for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
    const a = shown[i].r, b = shown[j].r;
    if (meet(a, b)) overlap.push([shown[i].name, shown[j].name]);
  }
  ok(`${name}: no two keys overlap`, overlap.length === 0, overlap);
  // the colour key, folded and unfolded
  for (const open of [false, true]) {
    const st = open ? 'unfolded' : 'folded';
    await ev(`(() => { const c = document.getElementById('leftLegend'); if (c && ${open} === c.classList.contains('collapsed')) c.click(); return 1; })()`);
    await settled({ max: 10000, until: `(() => { const c = document.getElementById('leftLegend'); return !!c && !c.hidden && c.classList.contains('collapsed') === ${!open}; })()` });
    await placed('leftLegend');
    const lgx = await ev(`(() => {
      const c = document.getElementById('leftLegend'), r = c.getBoundingClientRect(), bar = document.querySelector('.ph-ctx').getBoundingClientRect();
      const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { r: [r.left, r.top, r.right, r.bottom].map((x) => Math.round(x * 10) / 10), ch: c.clientHeight, sh: c.scrollHeight, press: !!e && c.contains(e), bar: [bar.left, bar.top, bar.right, bar.bottom].map(Math.round), over: e ? (e.className || e.id || e.tagName) : null, over_box: e ? (() => { const q = e.closest('.draft-chip, .cm-chip') || e, b = q.getBoundingClientRect(); return [q.className, b.left, b.top, b.right, b.bottom].map((x) => typeof x === 'number' ? Math.round(x) : x); })() : null };
    })()`);
    const lg = lgx.r;
    const hit = (await geometry()).keys.filter((k) => k.shown && meet(k.r, lg)).map((k) => k.name);
    info[`${name} key ${st}`] = lgx;
    // (with the colour key folded and unfolded, a press at each plane key's centre reaches it: the construction chip's Cancel is not over Fit view)
    const covered = (await geometry()).keys.filter((k) => k.shown && !k.press).map((k) => k.name);
    // (#2083: the unfolded card shows all its lines: it is not cut to a scrolling box)
    if (open) ok(`${name}: the unfolded colour key shows all its lines (clientHeight = scrollHeight)`, lgx.ch >= lgx.sh - SLACK, { ch: lgx.ch, sh: lgx.sh });
    if (roomy || !open) ok(`${name}: with the colour key ${st}, a press at every plane key's centre reaches it`, covered.length === 0, covered);
    if (roomy || !open) ok(`${name}: the ${st} colour key overlaps no plane key`, hit.length === 0, { lg, hit });
    if (roomy || !open) ok(`${name}: a press at the ${st} colour key's centre reaches it (nothing of the bar is over it)`, lgx.press && !meet(lg, lgx.bar), lgx);
    // (below ROOM the unfolded card cannot stand beside the keys and lies over them: it is the one the person opened to read, so it
    // stands over the keys it meets and every point of it reaches it; the keys whose centre it does not cover take their presses)
    if (!roomy && open) {
      const probe = await underPoints('leftLegend');
      ok(`${name}: the unfolded colour key is read whole: no point of it lies under a key or a chip`, probe.length === 0, { lg, hit, under: probe.slice(0, 6) });
      const inside = (k) => { const x = (k.r[0] + k.r[2]) / 2, y = (k.r[1] + k.r[3]) / 2; return x >= lg[0] && x <= lg[2] && y >= lg[1] && y <= lg[3]; };
      const free = (await geometry()).keys.filter((k) => k.shown && !inside(k) && !k.press).map((k) => k.name);
      ok(`${name}: with the colour key unfolded, a press at the centre of each plane key it does not cover reaches it`, free.length === 0, free);
      // (the card stands over keys, so what is under it does not show through it)
      const bg = await ev(`getComputedStyle(document.getElementById('leftLegend')).backgroundColor`);
      ok(`${name}: the unfolded colour key's background is opaque, so the keys under it do not show through`, /^rgb\(/.test(bg), bg);   // (an opaque colour reads rgb(…), a translucent one rgba(…))
      // (a key that takes focus from the keyboard is above the card: its focus is never hidden under it)
      const tabbed = await tabbedKeys('leftLegend');
      info[`${name} tabbed`] = tabbed;
      ok(`${name}: Tab from the unfolded colour key reaches a plane key (control)`, tabbed.length > 0, tabbed);
      ok(`${name}: every plane key Tab reaches stands over the unfolded colour key: it is the topmost element at its centre`, tabbed.every((k) => k.top), tabbed);
    }
    // (the readout, which has pointer-events none on a phone so a press goes through it, stops short of the folded key's hit area under the
    // tall bar: the rule that moves the key to the top row and holds the readout back (#1857). It is given the longest text it holds, in one
    // page call so the probe cannot rewrite it, and measured at once; the globe's hint card has its own rule)
    if (!open && surf === 'plane') {
      const ro = await ev(`(() => {
        const e = document.getElementById('leftReadout'); if (!e) return null;
        const html = e.innerHTML; e.textContent = 'z = 123456.7890 + 987654.3210i · w = F(z) = 123456.7890 − 987654.3210i · and a good deal more to read here';
        const r = e.getBoundingClientRect(), shown = e.getClientRects().length > 0; e.innerHTML = html;
        return shown ? [r.left, r.top, r.right, r.bottom].map((x) => Math.round(x * 10) / 10) : null;
      })()`);
      info[`${name} long readout`] = ro;
      ok(`${name}: a long readout is shown and stops short of the folded colour key's hit area`, !!ro && ro[2] <= lg[0] - HIT_PX + SLACK, { ro, lg });
    }
  }
  if (surf === 'sphere') {
    // the hint card stays clear of the globe's disk (phone_hint_globe_cmd's rule), with the tall bar in
    const m = await ev(`(() => {
      const cv = document.getElementById('canvasL').getBoundingClientRect(), R = __cmwGlobeDisk('L').R, ch = document.getElementById('leftReadout').getBoundingClientRect();
      const cx = cv.left + cv.width / 2, cy = cv.top + cv.height / 2, nx = Math.max(ch.left, Math.min(cx, ch.right)), ny = Math.max(ch.top, Math.min(cy, ch.bottom));
      return { R: Math.round(R), chip: [ch.left, ch.top, ch.right, ch.bottom].map(Math.round), gap: Math.round(Math.hypot(nx - cx, ny - cy) - R), shown: ch.width > 0 };
    })()`);
    info[`${name} hint`] = m;
    ok(`${name}: the hint card is clear of the globe's disk (gap >= 0 px)`, m.shown && m.gap >= 0, m);
  }
}
// the classic view's Y has the same state at 320 px tall: its Regions key, unfolded under the tall bar, stands over Y's keys, and no point of it
// lies under a key or a chip
for (const [w, lang] of [[568, 'en'], [568, 'ru'], [568, 'it'], [600, 'en'], [600, 'ru'], [600, 'it'], [640, 'en'], [640, 'ru'], [640, 'it']]) {
  const name = `${w}x320 ${lang} classic`;
  await view(w, 320, false, true);
  await go(`http://localhost:${PORT}/test.html?view=classic&lang=${lang}&ns=ctxcl${w}${Date.now() % 100000}`);
  await settled({ max: 30000, until: '!!document.documentElement.classList.contains("ph") && !!document.querySelector("#constructTools .tool[data-tool=perp]") && !!document.getElementById("rightLegend")' });
  await ev(`document.querySelector('#constructTools .tool[data-tool="perp"]').click(); 1`);
  await settled({ max: 20000, until: 'document.documentElement.classList.contains("ph-ctx-tall") && !!document.querySelector(".ph-ctx.in")' });
  await ev(`(() => { const c = document.getElementById('rightLegend'); if (c.classList.contains('collapsed')) c.click(); return 1; })()`);
  await settled({ max: 10000, until: `!document.getElementById('rightLegend').classList.contains('collapsed')` });
  await placed('rightLegend');
  const whole = await ev(`(() => { const c = document.getElementById('rightLegend'); return { ch: c.clientHeight, sh: c.scrollHeight }; })()`);
  info[`${name} key whole`] = whole;
  ok(`${name}: the unfolded Regions key shows all its lines (clientHeight = scrollHeight)`, whole.ch >= whole.sh - SLACK, whole);
  // (the key takes the plane's top over the readout when that shows it whole; the readout it covers gives way, hidden, so no readout that shows is under it)
  const ro = await ev(`(() => { const k = document.getElementById('rightLegend').getBoundingClientRect(), e = document.querySelector('#plotR > .chip.readout'); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { meets: r.left < k.right && k.left < r.right && r.top < k.bottom && k.top < r.bottom, hidden: getComputedStyle(e).visibility === 'hidden' }; })()`);
  info[`${name} readout`] = ro;
  ok(`${name}: no readout that shows lies under the unfolded Regions key`, !ro || !ro.meets || ro.hidden, ro);
  const under = await underPoints('rightLegend');
  info[`${name} key unfolded`] = under;
  ok(`${name}: the unfolded Regions key is read whole: no point of it lies under a key or a chip`, under.length === 0, under.slice(0, 6));
  const tabbedY = await tabbedKeys('rightLegend');
  info[`${name} tabbed`] = tabbedY;
  ok(`${name}: Tab from the unfolded Regions key reaches a plane key (control)`, tabbedY.length > 0, tabbedY);
  ok(`${name}: every plane key Tab reaches stands over the unfolded Regions key: it is the topmost element at its centre`, tabbedY.every((k) => k.top), tabbedY);
}
await send('Emulation.setFocusEmulationEnabled', { enabled: false });
return { pass: fails.length === 0, fails, info };
