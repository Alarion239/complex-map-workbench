// On a landscape phone in the steps view, with the orthogonal circle's tall context bar open, every key of the plane (Sphere,
// Display options, Fit view) stands inside the part of the plane the bar leaves, clear of the header, and a press at its centre
// reaches it; no two keys overlap, and the colour key, folded or unfolded, stands clear of all of them. The plane is shorter than
// the column of three keys plus the bar at 740 x 360 and 667 x 375; 844 x 390 has room, and the same arrangement holds there.
// Also: a press at the folded colour key's centre reaches it, nothing of the bar or the construction chip over it, down to
// 568 x 320 in Russian and Italian; with the globe shown, the hint card stays clear of the globe's disk. Where the plane above
// the bar is shorter than ROOM (the 320 px tall phones: 106 px) the keys stand in one row and the unfolded colour key, taller than
// what is left beside them, stands over the keys it meets: no point of it lies under a key or a chip, and the keys it does not meet
// take their presses; the card is opaque, and a plane key that real Tab presses reach stands over it (its focus is never hidden). The construction chip
// stays above the bar with the key folded and unfolded (#2103): no point of its ? and × lies under the bar, and each, focused, is the topmost element
// at its centre; where the unfolded card meets the ×, it covers the whole glyph or none of it. The classic
// view's Y has the same: its unfolded Regions key stands over Y's keys at 568 x 320 and 600 x 320, and as far up as it meets them (740 x 360, 667 x 375
// and 740 x 400), in en, ru and it.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const MARGIN = 2;   // the keys stand at least this far from the header and from the bar, px
const ROOM = 140;   // the plane above the bar holds the unfolded colour key (74 px) beside a row of keys (44 px) only when it is this tall, px: the 320 px tall phones' 106 px is not, a 360 px tall phone's 146 px is
const HIT_PX = 8;   // the folded colour key's hit area reaches this far past its glyph, px (phone.css)
const SLACK = 0.5;  // layout rounding, px
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
// the construction chip's box and its controls (? and ×): of a 5 x 5 grid on each, how many points lie under the context bar (elementFromPoint)
const CHIP_CONTROLS = 2;
const chipMet = [];   // (the cases where the unfolded card met a control of the chip: the focus rows are not vacuous)
const chipControls = () => ev(`(() => {
  const chip = document.querySelector('#plotL > .draft-chip.cm-on'), bar = document.querySelector('.ph-ctx.in'); if (!chip || !bar) return null;
  const R = (r) => [r.left, r.top, r.right, r.bottom].map((x) => Math.round(x * 10) / 10);
  const controls = [...chip.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => {
    const r = b.getBoundingClientRect(); let underBar = 0, seen = 0;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const e = document.elementFromPoint(r.left + r.width * (i + 0.5) / 5, r.top + r.height * (j + 0.5) / 5); if (e && bar.contains(e)) underBar++; if (e && b.contains(e)) seen++; }
    return { name: b.getAttribute('aria-label'), r: R(r), underBar, seen };
  });
  // (the × glyph's own box, from its text: of a 3 x 3 grid on it, how many points show the × and how many lie under something else)
  const x = chip.querySelector('.cm-x'), rg = document.createRange(); let glyph = null;
  if (x && x.firstChild) { rg.selectNodeContents(x); const g = rg.getBoundingClientRect(); let shown = 0, hid = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const e = document.elementFromPoint(g.left + g.width * (i + 0.5) / 3, g.top + g.height * (j + 0.5) / 3); if (e && x.contains(e)) shown++; else hid++; }
    glyph = { r: R(g), shown, hid }; }
  return { chip: R(chip.getBoundingClientRect()), barTop: Math.round(bar.getBoundingClientRect().top), controls, glyph };
})()`);
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
    const lgx = await ev(`(() => {
      const c = document.getElementById('leftLegend'), r = c.getBoundingClientRect(), bar = document.querySelector('.ph-ctx').getBoundingClientRect();
      const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { r: [r.left, r.top, r.right, r.bottom].map((x) => Math.round(x * 10) / 10), press: !!e && c.contains(e), bar: [bar.left, bar.top, bar.right, bar.bottom].map(Math.round), over: e ? (e.className || e.id || e.tagName) : null, over_box: e ? (() => { const q = e.closest('.draft-chip, .cm-chip') || e, b = q.getBoundingClientRect(); return [q.className, b.left, b.top, b.right, b.bottom].map((x) => typeof x === 'number' ? Math.round(x) : x); })() : null };
    })()`);
    const lg = lgx.r;
    const hit = (await geometry()).keys.filter((k) => k.shown && meet(k.r, lg)).map((k) => k.name);
    info[`${name} key ${st}`] = lgx;
    // (with the colour key folded and unfolded, a press at each plane key's centre reaches it: the construction chip's Cancel is not over Fit view)
    const covered = (await geometry()).keys.filter((k) => k.shown && !k.press).map((k) => k.name);
    if (roomy || !open) ok(`${name}: with the colour key ${st}, a press at every plane key's centre reaches it`, covered.length === 0, covered);
    if (roomy || !open) ok(`${name}: the ${st} colour key overlaps no plane key`, hit.length === 0, { lg, hit });
    if (roomy || !open) ok(`${name}: a press at the ${st} colour key's centre reaches it (nothing of the bar is over it)`, lgx.press && !meet(lg, lgx.bar), lgx);
    // (#2103: the construction chip keeps its place above the bar whether the key is folded or not; where the unfolded card meets it, its controls lie
    // under the card, never under the bar, and one given focus as the keyboard gives it is the topmost element at its centre. The chip's own Whole | Inside |
    // Outside is not shown under the tall bar, whose row says it: its ? and × are its controls)
    const cc = await chipControls();
    info[`${name} chip, key ${st}`] = cc;
    ok(`${name}: with the colour key ${st}, the construction chip stands above the bar`, !!cc && cc.chip[3] <= cc.barTop + SLACK, cc && { chip: cc.chip, barTop: cc.barTop });
    ok(`${name}: with the colour key ${st}, the chip's ? and × are on the page and no point of them lies under the bar`, !!cc && cc.controls.length === CHIP_CONTROLS && cc.controls.every((c) => c.underBar === 0), cc && cc.controls);
    // (where the unfolded card meets the ×, it covers the whole glyph or none of it: no half × shows beside the card)
    ok(`${name}: with the colour key ${st}, the chip's × glyph shows whole or not at all`, !!cc && !!cc.glyph && (cc.glyph.shown === 0 || cc.glyph.hid === 0), cc && cc.glyph);
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
    if (open && cc) {
      // (each control with the key unfolded again, focus moved off the key first: whether the card met the control, and whether, given focus as the
      // keyboard gives it (focus({ focusVisible: true }), which :focus-visible matches), the control
      // is the topmost element at its centre; the card folds as a control under it takes focus)
      const focused = [];
      for (let i = 0; i < cc.controls.length; i++) {
        await ev(`(() => { const c = document.getElementById('leftLegend'); if (c.classList.contains('collapsed')) c.click(); if (document.activeElement) document.activeElement.blur(); return 1; })()`);
        await settled({ max: 10000, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
        focused.push(await ev(`(() => { const b = [...document.querySelectorAll('#plotL > .draft-chip.cm-on button')].filter((q) => q.getClientRects().length)[${i}], lg = document.getElementById('leftLegend');
          const r = b.getBoundingClientRect(), l = lg.getBoundingClientRect(), met = r.left < l.right && r.right > l.left && r.top < l.bottom && r.bottom > l.top;
          b.focus({ focusVisible: true });
          const e = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); const o = { name: b.getAttribute('aria-label'), met, top: !!e && b.contains(e), visible: b.matches(':focus-visible') }; b.blur(); return o; })()`));
      }
      info[`${name} chip focus`] = focused;
      chipMet.push(...focused.filter((f) => f.met).map((f) => `${name}: ${f.name}`));
      ok(`${name}: with the colour key unfolded, each of the chip's controls, given keyboard-style focus (focus with focusVisible), is the topmost element at its centre`, focused.length === CHIP_CONTROLS && focused.every((f) => f.top && f.visible), focused);
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
// the classic view's Y has the same state at 320 px tall and above: its Regions key, unfolded under the tall bar, stands over Y's keys, and no
// point of it lies under a key or a chip
// (and as tall as the keys and the card meet: 740 x 360, 667 x 375 and 740 x 400 reach the zoom group and Fit view, as 568 x 320 reaches Fit view and Sphere)
const CLASSIC_SIZES = [[568, 320], [600, 320], [740, 360], [667, 375], [740, 400]];
for (const [w, h, lang] of CLASSIC_SIZES.flatMap(([a, b]) => ['en', 'ru', 'it'].map((l) => [a, b, l]))) {
  const name = `${w}x${h} ${lang} classic`;
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/test.html?view=classic&lang=${lang}&ns=ctxcl${w}${h}${Date.now() % 100000}`);
  await settled({ max: 30000, until: '!!document.documentElement.classList.contains("ph") && !!document.querySelector("#constructTools .tool[data-tool=perp]") && !!document.getElementById("rightLegend")' });
  await ev(`document.querySelector('#constructTools .tool[data-tool="perp"]').click(); 1`);
  await settled({ max: 20000, until: 'document.documentElement.classList.contains("ph-ctx-tall") && !!document.querySelector(".ph-ctx.in")' });
  await ev(`(() => { const c = document.getElementById('rightLegend'); if (c.classList.contains('collapsed')) c.click(); return 1; })()`);
  await settled({ max: 10000, until: `!document.getElementById('rightLegend').classList.contains('collapsed')` });
  const under = await underPoints('rightLegend');
  info[`${name} key unfolded`] = under;
  ok(`${name}: the unfolded Regions key is read whole: no point of it lies under a key or a chip`, under.length === 0, under.slice(0, 6));
  const tabbedY = await tabbedKeys('rightLegend');
  info[`${name} tabbed`] = tabbedY;
  ok(`${name}: Tab from the unfolded Regions key reaches a plane key (control)`, tabbedY.length > 0, tabbedY);
  ok(`${name}: every plane key Tab reaches stands over the unfolded Regions key: it is the topmost element at its centre`, tabbedY.every((k) => k.top), tabbedY);
}
await send('Emulation.setFocusEmulationEnabled', { enabled: false });
info.chipMet = chipMet;
ok('the unfolded colour key meets a control of the construction chip in at least one case (the focus rows test a covered control)', chipMet.length > 0, chipMet);
return { pass: fails.length === 0, fails, info };
