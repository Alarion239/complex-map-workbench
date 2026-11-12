// The phone's canvas keys are the steps view's one stack (360 x 640, 390 x 844, 740 x 360 and 844 x 390, English and Russian, touch).
// Top to bottom where they fit one column: Display options, Zoom in, Zoom out, Fit view, Sphere, in that order and under those
// names on every surface (Plane, Sphere, Landscape); there is no Both key (one plane shows) and no second Sphere key.
// Sphere carries the surface in aria-pressed, the same on every press path. Every key is at least 44 px and is the topmost element at
// its centre; the column overlaps nothing (head, ruler, strip, legend chip, toast). Its keys never move, x or y within half a pixel,
// across Plane -> Sphere -> Landscape -> Plane, nor when the legend chip shows or hides. Sphere on the Landscape and Fit view with
// nothing to fit are aria-disabled in place with the reason in aria-describedby, and a tap on one shows the reason as the toast.
// The tour's sphere step anchors to the stack's Sphere key.
// On every phone size (568 x 320 to 915 x 412 landscape, in English also 600 x 340, 640 x 360, 667 x 375 and 812 x 375; 360 x
// 553 to 390 x 844 upright), in the steps view and the classic one, in English, Russian and Italian, at rest, with a shape
// selected (the context bar's one row), with the tall bar of a construction tool, each with a message, and each with the legend
// chips tapped open: every shown key lies inside its plot, is a key's full size and on top at its centre, and covers nothing the user reads or taps (Both, the readout and the room it keeps to grow in,
// the legends, the construction's chip and its × (on either large plane: the chip crosses with the pointer), the header, the
// strip, the bar, the message); a legend chip moved left of the keys, folded or open, lies inside its plot and covers none of
// these either; with the bar open over the plot's foot the stack rests the app's edge above it; the stack's arrangement is the
// first of the app's that keeps the rule, and its keys step aside only where none does; its groups are a gap apart in every
// arrangement. While the pointer probes the planes, with the bar open and while a message shows, the readout grows, and no
// stack changes its arrangement, meets the readout or cuts a line of it.
// In the classic view on an upright phone, Both (top right) comes before the stack in focus order.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { MOB, CUBE, still, openChain } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_chain_kit.js'), 'utf8'))({ ev, go, view, settled, PORT });
const ns = 'phstk' + Date.now();
const SIZES = [[360, 640], [390, 844], [740, 360], [844, 390]];   // width, height
const LANGS = ['en', 'ru'];
const SURFACES = ['plane', 'sphere', 'land'];
const SETTLE_MAX_MS = 3000;  // ms: the longest the stack may take to come to rest (its ease after a message or the context bar)
const VIEWS = ['steps', 'classic'];
const CLIP_SLACK = 1;        // px: scroll sizes are rounded to whole pixels, so a box one pixel short of its content is not clipped
const POS_TOLERANCE = 0.5;   // px: a key is at the same place after a surface switch or a chip change
const NO_SPHERE_ON_LAND = 'The Landscape has no sphere: choose Plane or Sphere in the surface menu';   // the key's tooltip and note
const NO_SPHERE_TOAST = { en: 'The Landscape has no sphere. Use the surface menu.', ru: 'В Рельефе нет сферы. Смените поверхность в меню.' };   // the phone's message: two lines at the narrowest width
const LABELS = { en: ['Display options', 'Zoom in', 'Zoom out', 'Fit view', 'Sphere'], ru: ['Настройки вида', 'Увеличить', 'Уменьшить', 'Вписать в окно', 'Сфера'] };
const open = (w, h, lang, vw = 'steps') => openChain({ ns: ns + w + lang + vw, steps: [MOB, CUBE], w, h, mobile: true, lang, view: vw,
  until: vw === 'steps' ? null : "document.documentElement.classList.contains('ph') && !!document.querySelector('#plotL .viewstack .ph-dsp')" });
let KIT = null;   // the app's stack rule (Phone._stack): its arrangements in order, what sits on a plot, the room it keeps, a key's side, the gap between groups
// the shown keys of plane L's column in document order: label, state, reason note, box, the topmost element at the centre
const SHOWN_KEYS = "[...document.querySelectorAll('#plotL button.ph-key, #paneL .viewstack button')].filter((e) => e.getClientRects().length)";
const column = () => ev(`(() => ${SHOWN_KEYS}.map((b) => {
  const d = b.getAttribute('aria-describedby'), n = d && document.getElementById(d), r = b.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { label: b.getAttribute('aria-label'), cls: b.className, disabled: b.getAttribute('aria-disabled'), pressed: b.getAttribute('aria-pressed'), note: n ? n.textContent : null,
    box: [r.left, r.top, r.width, r.height], top: t === b || b.contains(t) };
}))()`);
// the plot's box: every key lies inside it (a key above its top edge is clipped)
const plot = () => ev(`(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const inside = (b, p) => b[0] >= p[0] - POS_TOLERANCE && b[1] >= p[1] - POS_TOLERANCE && b[0] + b[2] <= p[0] + p[2] + POS_TOLERANCE && b[1] + b[3] <= p[1] + p[3] + POS_TOLERANCE;
const accent = () => ev(`(() => { const d = document.createElement('i'); d.style.background = 'var(--accent)'; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; })()`);
const sphereBg = () => ev(`getComputedStyle(${SHOWN_KEYS}[4]).backgroundColor`);
// what the column must clear: the boxes of the shown head, rulers, strip, legend chip and toast
const others = () => ev(`(() => [...document.querySelectorAll('#paneL .pane-head, .ruler, .ruler-corner, #svStrip, #plotL > .legend-chip:not([hidden]), #toastHost .toast')].filter((e) => e.getClientRects().length)
  .map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.className, box: [r.left, r.top, r.width, r.height] }; }))()`);
const meets = (a, b, c = 0) => a[0] < b[0] + b[2] + c && a[0] + a[2] > b[0] - c && a[1] < b[1] + b[3] + c && a[1] + a[3] > b[1] - c;   // (c: the room kept between them)
const same = (a, b) => a.length === b.length && a.every((k, i) => k.box.every((v, j) => Math.abs(v - b[i].box[j]) <= POS_TOLERANCE));

for (const lang of LANGS) {
  for (const [w, h] of SIZES) {
    await open(w, h, lang);
    if (!KIT) KIT = await ev(`window.Phone && Phone._stack ? Phone._stack() : null`);
    const MIN_KEY = KIT ? KIT.key : Infinity;
    const tag = `${w}x${h} ${lang}`;
    const boxes = {};
    for (const surf of SURFACES) {
      await ev(`(__cmwSteps({ surf: '${surf}' }), 1)`); await still();
      const c = await column(), t = `${tag}, ${surf}`;
      const labels = c.map((k) => k.label);
      ok(`${t}: the keys are Display options, Zoom in, Zoom out, Fit view, Sphere, in that order`, JSON.stringify(labels) === JSON.stringify(LABELS[lang]), labels);
      ok(`${t}: no Both key and no second Sphere key`, !c.some((k) => /ph-both-key|ph-sph/.test(k.cls)), c.map((k) => k.cls));
      ok(`${t}: every key is at least ${MIN_KEY} px and is on top at its centre`, c.every((k) => k.box[2] >= MIN_KEY && k.box[3] >= MIN_KEY && k.top), c);
      const sph = c[4];
      if (sph) {
        ok(`${t}: Sphere is pressed exactly on the sphere`, sph.pressed === String(surf === 'sphere'), sph.pressed);
        if (surf === 'land') ok(`${t}: Sphere is aria-disabled in place, with its reason in the note`, sph.disabled === 'true' && sph.note === (lang === 'en' ? NO_SPHERE_ON_LAND : sph.note) && !!sph.note, sph);
        else ok(`${t}: Sphere is enabled`, sph.disabled !== 'true', sph);
      }
      const o = await others();
      const hits = [];
      for (const k of c) for (const e of o) if (meets(k.box, e.box)) hits.push([k.label, e.id]);
      ok(`${t}: the column overlaps nothing`, hits.length === 0, hits);
      const pb = await plot();
      ok(`${t}: every key lies inside the plot`, c.every((k) => inside(k.box, pb)), { plot: pb, boxes: c.map((k) => k.box) });
      if (surf !== 'land') {
        const bg = await sphereBg(), ac = await accent();
        ok(`${t}: Sphere's pressed state shows as the accent fill, its released state does not`, (bg === ac) === (surf === 'sphere'), { bg, ac });
      }
      boxes[surf] = c;
    }
    for (const surf of ['sphere', 'land']) ok(`${tag}: no key moves between the plane and the ${surf}`, same(boxes[surf], boxes.plane), { plane: boxes.plane.map((k) => k.box), [surf]: boxes[surf].map((k) => k.box) });
    // the legend chip shows or hides without moving the column
    await ev(`(__cmwSteps({ surf: 'plane' }), 1)`); await still();
    const chipless = await column();
    const hadChip = await ev(`(() => { const c = document.querySelector('#plotL > .legend-chip'); if (!c) return null; const was = c.hidden; c.hidden = !was; return was; })()`);
    await still();
    const flipped = await column();
    ok(`${tag}: the column stays put when the legend chip ${hadChip ? 'shows' : 'hides'}`, hadChip !== null && same(flipped, chipless), { hadChip, a: chipless.map((k) => k.box), b: flipped.map((k) => k.box) });
    // the tour's sphere step lights the stack's Sphere key on a phone
    const lit = await ev(`(() => { const k = Tour._t.ANCHORS.sphereKey(); return k ? k === ${SHOWN_KEYS}[4] : null; })()`);
    ok(`${tag}: the tour's sphereKey anchor is the stack's Sphere key`, lit === true, lit);
    // one press path: tapping Sphere switches the view's surface and the key follows
    await ev(`(__cmwSteps({ surf: 'plane' }), 1)`); await still();
    await ev(`(() => { ${SHOWN_KEYS}[4].click(); return 1; })()`); await still();
    const after = await ev(`__cmwSteps().surf`), pr = (await column())[4];
    ok(`${tag}: a tap on Sphere makes the surface the sphere and the key shows pressed`, after === 'sphere' && pr && pr.pressed === 'true', { after, pr });
    // a tap on a disabled Sphere shows its reason as the toast
    await ev(`(__cmwSteps({ surf: 'land' }), 1)`); await still();
    await ev(`(() => { ${SHOWN_KEYS}[4].click(); return 1; })()`);
    await settled({ until: "!!document.querySelector('#toastHost .toast')", max: SETTLE_MAX_MS });
    const toast = await ev(`(document.querySelector('#toastHost .toast') || {}).textContent || ''`);
    ok(`${tag}: a tap on the disabled Sphere shows its reason, short, as the toast`, toast === NO_SPHERE_TOAST[lang], toast);
    ok(`${tag}: the disabled Sphere keeps the full reason as its tooltip`, lang !== 'en' || (await ev(`${SHOWN_KEYS}[4].title`)) === NO_SPHERE_ON_LAND, null);
    // while the message shows the stack stays where it was, inside the plot, and the message meets no key
    const withToast = await column(), tp = await plot(), tb = (await others()).filter((e) => /toast/.test(e.id));
    ok(`${tag}: the stack keeps its place while a message shows`, same(withToast, boxes.land), { land: boxes.land.map((k) => k.box), withToast: withToast.map((k) => k.box) });
    ok(`${tag}: and stays inside the plot`, withToast.every((k) => inside(k.box, tp)), { plot: tp, boxes: withToast.map((k) => k.box) });
    // the reason reads in full: no line is clipped and no ellipsis shows
    const words = await ev(`(() => { const e = document.querySelector('#toastHost .toast > span'); return e ? { clipped: e.scrollHeight > e.clientHeight + ${CLIP_SLACK} || e.scrollWidth > e.clientWidth + ${CLIP_SLACK}, text: e.textContent } : null; })()`);
    ok(`${tag}: the message's words are not clipped or truncated`, !!words && !words.clipped, words);
    ok(`${tag}: and the message meets no key`, tb.length > 0 && !withToast.some((k) => tb.some((e) => meets(k.box, e.box))), { toast: tb, keys: withToast.map((k) => k.box) });
  }
}

// The rule for the stacks of the shown large planes (both in the classic view on a landscape phone), at rest, with the
// context bar open and with the legend chips open: every shown key lies inside its plot, is a key's full size and is the
// topmost element at its centre, and covers nothing the user reads or taps: Both, the readout and its room (the app's
// readout room: as wide and as tall as the readout may grow while the pointer probes), the legend chips, the construction's
// chip and its ×, the header, the steps strip, the context bar and a message. A legend chip the stack moved left of its keys
// lies inside the plot and meets none of these either. The stack takes the first of the app's arrangements (KIT.order)
// that keeps the rule, and steps aside only where none does: each one before it, forced in turn (Phone._stack), breaks the rule.
const STACKS = () => `(() => { const R = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const page = [...document.querySelectorAll('.top, #svStrip, .ph-ctx.in, #toastHost .toast')].filter(shown).map((e) => ({ what: e.id || e.className, box: R(e), clear: 0 }));
  const bar = [...document.querySelectorAll('.ph-ctx.in:not(.under)')].filter(shown).map(R)[0] || null;
  const large = ['plotL', 'plotR'].map((id) => document.getElementById(id)).filter((p) => p && p.getClientRects().length && !p.closest('.ph-inset'));
  return large.map((p) => {
    const on = [...p.querySelectorAll(${JSON.stringify(KIT.onPlot + ', .cm-chip .cm-x')})].filter(shown)
      .map((e) => ({ what: e.id || e.className, legend: e.classList.contains('legend-chip'), box: R(e), clear: 1 }));
    // (the construction's chip shown on another large plane, where it would lie on this one: it crosses with the pointer;
    // a hidden copy under this plane's chip's id, laid out and removed in this evaluation)
    const own = p.querySelector(':scope > #draftChipL, :scope > #draftChipR');
    if (own && !shown(own)) for (const q of large.filter((q) => q !== p)) for (const d of [...q.querySelectorAll(':scope > #draftChipL, :scope > #draftChipR')].filter(shown)) {
      const c = d.cloneNode(true);
      c.id = own.id; c.style.visibility = 'hidden';
      p.append(c);
      on.push({ what: d.id + ' (as on ' + p.id + ')', box: R(c), clear: 1 });
      c.remove();
    }
    const room = Phone._stack(p.id).readout;
    if (room) on.push({ what: 'the readout room', box: [room[0], room[1], room[2] - room[0], room[3] - room[1]], clear: 1 });
    const keys = [...p.querySelectorAll('.viewstack button')].filter(shown).map((b) => {
      const q = b.getBoundingClientRect(), t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      return { label: b.getAttribute('aria-label'), box: R(b), top: t === b || b.contains(t), at: t ? (t.id || t.className) : null };
    });
    return { id: p.id, plot: R(p), cls: p.className, legendR: p.style.getPropertyValue('--ph-legend-r'), keys, others: on.concat(page), bar };
  });
})()`;
const stacks = () => ev(STACKS());
const insideBy = (b, p, e) => b[0] >= p[0] + e - POS_TOLERANCE && b[1] >= p[1] + e - POS_TOLERANCE && b[0] + b[2] <= p[0] + p[2] + POS_TOLERANCE && b[1] + b[3] <= p[1] + p[3] + POS_TOLERANCE;
// what a stack breaks: [key, what] for each key outside the plot, too small or covering something (within the app's
// clearance of what sits on the plot), and, where the legend chips moved, [legend, what] for each moved chip outside the
// plot or meeting something
const breaks = (st) => {
  const out = [], p = st.plot, c = KIT.clear;
  for (const k of st.keys) {
    const b = k.box;
    if (!insideBy(b, p, KIT.edge)) out.push([k.label, 'outside the plot']);
    if (b[2] < KIT.key - POS_TOLERANCE || b[3] < KIT.key - POS_TOLERANCE) out.push([k.label, 'smaller than ' + KIT.key]);
    for (const o of st.others) if (meets(b, o.box, o.clear ? c : 0)) out.push([k.label, o.what]);
  }
  if (st.legendR) {
    for (const l of st.others.filter((o) => o.legend)) {
      if (!insideBy(l.box, p, 0) || l.box[0] < p[0] + KIT.edge - POS_TOLERANCE) out.push([l.what, 'outside the plot']);
      for (const o of st.others) if (!o.legend && meets(l.box, o.box, o.clear ? c : 0)) out.push([l.what, o.what]);
    }
  }
  return out;
};
const arrangementOf = (st) => {
  const cls = st.cls.split(' ');
  return { L: KIT.layouts.find((L) => cls.includes(L)) || 'col', keys: KIT.keys.find((k) => cls.includes(k)) || 'all', moved: !!st.legendR };
};
const KEYS_SHOWN = { all: 5, 'ph-nozoom': 3, 'ph-dsponly': 1, 'ph-nokeys': 0 };
// the gaps between neighbouring groups' keys in arrangement `got` (Display; the zoom keys; Fit view and Sphere): one column
// stacks them, two columns put Display above Fit view and the zoom keys left of it, and the three groups side by side (or
// the five keys in one row) put each right of the one before; null where fewer than two groups show
const groupGaps = (got, keys) => {
  if (keys.length !== KEYS_SHOWN[got.keys]) return null;
  const below = (a, b) => b.box[1] - (a.box[1] + a.box[3]), beside = (a, b) => b.box[0] - (a.box[0] + a.box[2]);
  if (got.keys === 'all') {
    const [dsp, zin, zout, fit] = keys;
    return got.L === 'col' ? [below(dsp, zin), below(zout, fit)] : got.L === 'ph-short' ? [below(dsp, fit), beside(zin, fit)] : [beside(dsp, zin), beside(got.L === 'ph-row' ? zout : zin, fit)];
  }
  if (got.keys === 'ph-nozoom') {
    const [dsp, fit] = keys;
    return [got.L === 'col' || got.L === 'ph-short' ? below(dsp, fit) : beside(dsp, fit)];
  }
  return null;
};
const checkStacks = async (t) => {
  for (const st of await stacks()) {
    const tag = `${t}, ${st.id}`, got = arrangementOf(st);
    const bad = breaks(st);
    ok(`${tag}: every key lies inside the plot, is ${KIT.key} px, and covers nothing (Both, the readout and its room, the legends, the chip and its ×, the header, the strip, the bar, a message); a moved legend chip lies inside the plot and meets none of these`, bad.length === 0, { bad, cls: st.cls, legendR: st.legendR, keys: st.keys.map((k) => [k.label, ...k.box.map(Math.round)]), others: st.others.map((o) => [o.what, ...o.box.map(Math.round)]) });
    const under = st.keys.filter((k) => !k.top).map((k) => [k.label, k.at]);
    ok(`${tag}: every key is on top at its centre`, under.length === 0, under);
    ok(`${tag}: the keys show as the arrangement says`, st.keys.length === KEYS_SHOWN[got.keys], { got, n: st.keys.length });
    // the bar open over the plot's foot: the stack rests the app's edge above it
    if (st.keys.length && st.bar && st.bar[1] < st.plot[1] + st.plot[3] - KIT.edge) {
      const foot = Math.max(...st.keys.map((k) => k.box[1] + k.box[3]));
      ok(`${tag}: the stack rests ${KIT.edge} px above the context bar`, Math.abs(st.bar[1] - foot - KIT.edge) <= POS_TOLERANCE, { foot, barTop: st.bar[1] });
    }
    // every arrangement the app tries before the one it took breaks the rule
    const at = got.keys === 'ph-nokeys' ? KIT.order.length : KIT.order.findIndex((o) => o.L === got.L && o.keys === got.keys && o.moved === got.moved);
    ok(`${tag}: its arrangement is one of the app's`, at >= 0, got);
    const fits = [];
    for (const o of KIT.order.slice(0, Math.max(at, 0))) {
      if (o.moved && !st.others.some((x) => x.legend)) continue;
      const f = (await ev(`(Phone._stack('${st.id}', ${JSON.stringify(o)}), ${STACKS()})`)).find((x) => x.id === st.id);
      if (f && f.keys.length && (!o.moved || f.legendR) && breaks(f).length === 0) fits.push(o);
    }
    await ev(`(Phone._stack('${st.id}', null), 1)`);
    ok(`${tag}: ${got.keys === 'ph-nokeys' ? 'the keys step aside only where no arrangement fits' : 'it is the first arrangement that fits'}`, fits.length === 0, { got, legendR: st.legendR, fits });
    if (got.keys !== 'all' || got.moved) info[`${tag}`] = Object.assign({ cls: st.cls }, got);
    // the groups' gap, in every arrangement of more than one group
    const gaps = groupGaps(got, st.keys);
    if (gaps) ok(`${tag}: ${KIT.gap} px between the groups`, gaps.every((g) => Math.abs(g - KIT.gap) <= POS_TOLERANCE), { got, gaps });
  }
};
const SETTLED = (until) => settled({ until, max: SETTLE_MAX_MS });
const MESSAGE_MS = 120000;   // ms: a message held while a scene's checks run
const BAR_ON = "!!document.querySelector('.ph-ctx.in')", TALL_ON = "!!document.querySelector('.ph-ctx.in.tall')", TOAST_ON = "!!document.querySelector('#toastHost .toast')";
// the legend chips tapped open, then folded again (a tap toggles a chip on the plot)
const LEGENDS = "[...document.querySelectorAll('#plotL > .legend-chip, #plotR > .legend-chip')].filter((e) => e.getClientRects().length && !e.closest('.ph-inset'))";
const openLegends = async (t) => {
  const n = await ev(`(() => { const l = ${LEGENDS}.filter((e) => e.classList.contains('collapsed')); l.forEach((e) => e.click()); return l.length; })()`);
  if (!n) return;
  await SETTLED(`${LEGENDS}.every((e) => !e.classList.contains('collapsed'))`);
  await checkStacks(`${t}, the legend open`);
  await ev(`(${LEGENDS}.filter((e) => !e.classList.contains('collapsed')).forEach((e) => e.click()), 1)`);
  await SETTLED(`${LEGENDS}.every((e) => e.classList.contains('collapsed'))`);
};
// the pointer probing each plane: the readout grows, and no stack changes its arrangement, meets the readout or cuts a
// line of it
const PROBES = [[0.5, 0.2], [0.8, 0.5], [0.3, 0.7]];
// the readout lines the stack cuts: a line of a shown readout (or the readout, where it is one line) whose text is longer
// than the line while the stack stops the readout short of its keys (--ph-ro-r on the plot), and that holds its text with
// the readout's whole room (--ph-ro-r lifted, and set again in the same evaluation, before the page lays out or paints)
const CUT_BY_STACK = `(() => ['plotL', 'plotR'].map((id) => document.getElementById(id)).filter((p) => p && p.getClientRects().length && !p.closest('.ph-inset')).flatMap((p) => {
  const ro = p.querySelector(':scope > .chip.readout'), cap = p.style.getPropertyValue('--ph-ro-r');
  if (!cap || !ro || !ro.getClientRects().length || ro.querySelector('.rhint, .rteach')) return [];
  const lines = ro.querySelector(':scope > .rln') ? [...ro.querySelectorAll(':scope > .rln')] : [ro];
  // (a line: its text measured to the fraction of a pixel against the line's box; the one-line readout: its scroll width,
  // which counts the X or Y tag, against its client width)
  const cut = (e) => { if (e === ro) return ro.scrollWidth > ro.clientWidth + ${CLIP_SLACK}; const rg = document.createRange(); rg.selectNodeContents(e); return rg.getBoundingClientRect().width > e.getBoundingClientRect().width + ${POS_TOLERANCE}; };
  const capped = lines.map(cut);
  p.style.removeProperty('--ph-ro-r');
  const whole = lines.map(cut);
  p.style.setProperty('--ph-ro-r', cap);
  return lines.filter((e, i) => capped[i] && !whole[i]).map((e) => [p.id, cap, e.textContent]);
}))()`;
const probing = async (t) => {
  const before = (await stacks()).map((s) => [s.id, s.cls, s.legendR].join(' | '));
  for (const st of await stacks()) {
    for (const [fx, fy] of PROBES) {
      await move(st.plot[0] + fx * st.plot[2], st.plot[1] + fy * st.plot[3]);
      await settled({ max: SETTLE_MAX_MS });
      const now = await stacks();
      const shift = now.map((s) => [s.id, s.cls, s.legendR].join(' | ')).filter((x, i) => x !== before[i]);
      const hits = now.flatMap((s) => s.keys.flatMap((k) => s.others.filter((o) => /readout/.test(o.what) && meets(k.box, o.box, KIT.clear)).map((o) => [s.id, k.label, o.what, o.box.map(Math.round)])));
      ok(`${t}, the pointer at (${fx}, ${fy}) of ${st.id}: no stack changes its arrangement`, shift.length === 0, { before, shift });
      ok(`${t}, the pointer at (${fx}, ${fy}) of ${st.id}: no key meets the readout`, hits.length === 0, hits);
      const cuts = await ev(CUT_BY_STACK);
      ok(`${t}, the pointer at (${fx}, ${fy}) of ${st.id}: the stack cuts no line of a readout`, cuts.length === 0, cuts);
    }
  }
  await move(1, 1);
  await settled({ max: SETTLE_MAX_MS });
};
// the scenes: a shape selected (the bar's one row), a construction tool with a choice of part in hand (two rows), and each with a message
const SCENES = [
  ['a shape selected', "(__cmwSelect('h1'), 1)", "!!document.querySelector('.ph-ctx.in:not(.tall)')"],
  ['the tall bar', "(__cmwSelect(null), document.querySelector('#constructTools .tool[data-tool=\"perp\"]').click(), 1)", TALL_ON],
];
const atSizes = async (vw, lang, sizes, scene) => {
  for (const [w, h] of sizes) {
    await view(w, h, false, true);
    await SETTLED(BAR_ON);
    const tag = `${vw} ${w}x${h} ${lang}, ${scene[0]}`;
    ok(`${tag}: the context bar is open`, await ev(scene[2]), null);
    await checkStacks(tag);
    if (lang !== 'it') await openLegends(tag);
    if (lang === 'en') await probing(tag);
    // a message while the bar is open (held for the checks: a message's own time is 4 to 6 s)
    await ev(`(__cmwToast('A message while the bar is open', undefined, { ms: ${MESSAGE_MS} }), 1)`);
    await SETTLED(`${TOAST_ON} && ${BAR_ON}`);
    await checkStacks(`${tag} and a message`);
    if (lang === 'en') await probing(`${tag} and a message`);
    await ev(`(document.querySelectorAll('#toastHost .toast').forEach((e) => e.remove()), 1)`);
    await SETTLED(`!${TOAST_ON} && !document.documentElement.classList.contains('ph-toast-on')`);
  }
};
const LANDSCAPE = [[568, 320], [740, 360], [844, 390], [915, 412]];
// (in English, also the landscape phones between them, where the stack stops the readout short of its keys while a message shows)
const LANDSCAPE_EN = [[568, 320], [600, 340], [640, 360], [667, 375], [740, 360], [812, 375], [844, 390], [915, 412]];
const UPRIGHT = [[360, 553], [375, 553], [360, 560], [360, 568], [360, 576], [360, 640], [390, 844]];
ok('the app\'s stack hook is there', !!KIT, KIT);
if (KIT) {
  for (const vw of VIEWS) {
    for (const lang of ['en', 'ru', 'it']) {
      for (const [sizes, orient] of [[lang === 'en' ? LANDSCAPE_EN : LANDSCAPE, 'landscape'], [UPRIGHT, 'upright']]) {
        if (orient === 'upright' && vw === 'steps' && lang !== 'en') continue;
        await open(sizes[0][0], sizes[0][1], lang, vw);
        for (const [w, h] of sizes) {
          await view(w, h, false, true); await SETTLED();
          const tag = `${vw} ${w}x${h} ${lang}, at rest`;
          await checkStacks(tag);
          if (lang !== 'it') await openLegends(tag);
          if (lang === 'en') await probing(tag);
        }
        for (const scene of SCENES) { await ev(scene[1]); await SETTLED(scene[2]); await atSizes(vw, lang, sizes, scene); }
      }
    }
  }
}
// the classic view on an upright phone: Both, at the plane's top right, comes before the stack in focus order (top to bottom)
await open(390, 844, 'en', 'classic');
const order = await ev(`[...document.querySelectorAll('#plotL button')].filter((e) => e.getClientRects().length && (e.classList.contains('ph-key') || e.closest('.viewstack'))).map((e) => ({ label: e.getAttribute('aria-label'), y: e.getBoundingClientRect().top }))`);
ok('classic 390x844: the plane\'s keys in focus order run top to bottom, Both first', order.length === 6 && order[0].label === 'Both' && order.every((k, i) => i === 0 || k.y > order[i - 1].y), order);
return { pass: !fails.length, fails, info };
