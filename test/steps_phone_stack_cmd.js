// The phone's canvas keys are the steps view's one stack (360 x 640, 390 x 844, 740 x 360 and 844 x 390, English and Russian, touch).
// Top to bottom where they fit one column: Display options, Zoom in, Zoom out, Fit view, Sphere, in that order and under those
// names on every surface (Plane, Sphere, Landscape); there is no Both key (one plane shows) and no second Sphere key.
// Sphere carries the surface in aria-pressed, the same on every press path. Every key is at least 44 px and is the topmost element at
// its centre; the column overlaps nothing (head, ruler, strip, legend chip, toast). Its keys never move, x or y within half a pixel,
// across Plane -> Sphere -> Landscape -> Plane, nor when the legend chip shows or hides. Sphere on the Landscape and Fit view with
// nothing to fit are aria-disabled in place with the reason in aria-describedby, and a tap on one shows the reason as the toast.
// The tour's sphere step anchors to the stack's Sphere key.
// On every phone size (568 x 320 to 915 x 412 landscape, 360 x 553 to 390 x 844 upright), in the steps view and the classic one, in
// English, Russian and Italian, at rest, with a shape selected (the context bar's one row), with the tall bar of a construction
// tool, and each with a message: every shown key lies inside its plot, is 44 px and on top at its centre, and covers nothing the
// user reads or taps (Both, the readout, the legends, the construction's chip and its ×, the header, the strip, the bar, the
// message); the stack's layout is the first of the app's that keeps this, and its keys step aside only where none does.
// In the classic view on an upright phone, Both (top right) comes before the stack in focus order.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const still = (o = {}) => settled(Object.assign({ until: 'window.__cmwSteps && !__cmwSteps().moving' }, o));
const ns = 'phstk' + Date.now();
const SIZES = [[360, 640], [390, 844], [740, 360], [844, 390]];   // width, height
const LANGS = ['en', 'ru'];
const SURFACES = ['plane', 'sphere', 'land'];
const MIN_KEY = 44;          // px: the smallest touch target
const GROUP_GAP = 8;         // px: between a key and the next group's key in the one-column stack
const SETTLE_MAX_MS = 3000;  // ms: the longest the stack may take to come to rest (its ease after a message or the context bar)
const VIEWS = ['steps', 'classic'];
const CLIP_SLACK = 1;        // px: scroll sizes are rounded to whole pixels, so a box one pixel short of its content is not clipped
const POS_TOLERANCE = 0.5;   // px: a key is at the same place after a surface switch or a chip change
const NO_SPHERE_ON_LAND = 'The Landscape has no sphere: choose Plane or Sphere in the surface menu';   // the key's tooltip and note
const NO_SPHERE_TOAST = { en: 'The Landscape has no sphere. Use the surface menu.', ru: 'В Рельефе нет сферы. Смените поверхность в меню.' };   // the phone's message: two lines at the narrowest width
const MOB = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, CUBE = { type: 'pown', params: { n: 3 }, on: true };
const LABELS = { en: ['Display options', 'Zoom in', 'Zoom out', 'Fit view', 'Sphere'], ru: ['Настройки вида', 'Увеличить', 'Уменьшить', 'Вписать в окно', 'Сфера'] };
const open = async (w, h, lang, vw = 'steps') => {
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }], steps: [MOB, CUBE], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  const k = ns + w + lang + vw;
  await ev(`localStorage.setItem('complex-map-workbench-v1:${k}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${k}&lang=${lang}&view=${vw}`);
  if (vw === 'steps') await still({ until: "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail')" });
  else await settled({ until: "document.documentElement.classList.contains('ph') && !!document.querySelector('#plotL .viewstack .ph-dsp')" });
};
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

// The rule for the stacks of the shown large planes (both in the classic view on a landscape phone), at rest and with the
// context bar open: every shown key lies inside its plot, is at least MIN_KEY px and is the topmost element at its centre, and
// covers nothing the user reads or taps: Both, the readout, the legend chips, the construction's chip and its ×, the header,
// the steps strip, the context bar and a message. The stack takes the first of its layouts that keeps the rule (the app's
// order: its layouts tallest first with the five keys, the legend chips in their place, then with the legend chips moved
// left of the keys; then the same with the zoom keys given way to the pinch), and steps aside only where none does: each one
// before it, forced in turn (Phone._stack), breaks the rule.
const STACKS = `(() => { const R = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const page = [...document.querySelectorAll('.top, #svStrip, .ph-ctx.in, #toastHost .toast')].filter(shown).map((e) => ({ what: e.id || e.className, box: R(e), clear: 0 }));
  return ['plotL', 'plotR'].map((id) => document.getElementById(id)).filter((p) => p && p.getClientRects().length && !p.closest('.ph-inset')).map((p) => {
    const on = [...p.querySelectorAll(':scope > .ph-col > .ph-key, :scope > .chip.readout, :scope > .empty-chip, :scope > .legend-chip, .cm-chip .cm-x')].filter(shown)
      .map((e) => ({ what: e.id || e.className, legend: e.classList.contains('legend-chip'), box: R(e), clear: 1 }));
    const keys = [...p.querySelectorAll('.viewstack button')].filter(shown).map((b) => {
      const q = b.getBoundingClientRect(), t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      return { label: b.getAttribute('aria-label'), box: R(b), top: t === b || b.contains(t), at: t ? (t.id || t.className) : null };
    });
    return { id: p.id, plot: R(p), cls: p.className, legendR: p.style.getPropertyValue('--ph-legend-r'), keys, others: on.concat(page) };
  });
})()`;
const stacks = () => ev(STACKS);
const KIT = await ev(`Phone._stack ? Phone._stack() : null`);   // { layouts, edge, clear } of the app's stack
// what a stack's keys break: [key, what] for each key outside the plot or covered, and each thing it covers (within the
// app's clearance of what sits on the plot; noLegend: the legend chips may move)
const breaks = (st, noLegend = false) => {
  const out = [], p = st.plot, e = KIT ? KIT.edge : 0, c = KIT ? KIT.clear : 0;
  for (const k of st.keys) {
    const b = k.box;
    if (!(b[0] >= p[0] + e - POS_TOLERANCE && b[1] >= p[1] + e - POS_TOLERANCE && b[0] + b[2] <= p[0] + p[2] + POS_TOLERANCE && b[1] + b[3] <= p[1] + p[3] + POS_TOLERANCE)) out.push([k.label, 'outside the plot']);
    if (b[2] < MIN_KEY || b[3] < MIN_KEY) out.push([k.label, 'smaller than ' + MIN_KEY]);
    for (const o of st.others) if (!(noLegend && o.legend) && meets(b, o.box, o.clear ? c : 0)) out.push([k.label, o.what]);
  }
  return out;
};
const layoutOf = (st) => ({ L: (KIT ? KIT.layouts : []).find((L) => st.cls.split(' ').includes(L)) || 'col', nozoom: /\bph-nozoom\b/.test(st.cls), nokeys: /\bph-nokeys\b/.test(st.cls) });
const checkStacks = async (t) => {
  for (const st of await stacks()) {
    const tag = `${t}, ${st.id}`, got = layoutOf(st);
    ok(`${tag}: the app's stack hook is there`, !!KIT, KIT);
    const bad = breaks(st);
    ok(`${tag}: every key lies inside the plot, is ${MIN_KEY} px, and covers nothing (Both, the readout, the legends, the chip and its ×, the header, the strip, the bar, a message)`, bad.length === 0, { bad, keys: st.keys.map((k) => [k.label, ...k.box.map(Math.round)]), others: st.others.map((o) => [o.what, ...o.box.map(Math.round)]) });
    const under = st.keys.filter((k) => !k.top).map((k) => [k.label, k.at]);
    ok(`${tag}: every key is on top at its centre`, under.length === 0, under);
    ok(`${tag}: the keys show unless they stepped aside`, st.keys.length === (got.nokeys ? 0 : got.nozoom ? 3 : 5), { got, n: st.keys.length });
    // the legend chips moved only where the keys' layout needs it, and then they cover nothing either
    if (st.legendR) {
      const lg = st.others.filter((o) => o.legend), rest = st.others.filter((o) => !o.legend);
      const hit = lg.flatMap((l) => rest.filter((o) => meets(l.box, o.box)).map((o) => o.what).concat(st.keys.filter((k) => meets(l.box, k.box)).map((k) => k.label)));
      ok(`${tag}: the moved legend chip lies inside the plot and meets nothing`, lg.every((l) => inside(l.box, st.plot)) && hit.length === 0, { lg: lg.map((l) => l.box), hit });
    }
    // every arrangement the app tries before the one it took breaks the rule
    if (!KIT) continue;
    const order = [];
    for (const nozoom of [false, true]) { for (const L of KIT.layouts) order.push({ L, nozoom, moved: false }); for (const L of KIT.layouts) order.push({ L, nozoom, moved: true }); }
    const at = got.nokeys ? order.length : order.findIndex((o) => o.L === got.L && o.nozoom === got.nozoom && o.moved === !!st.legendR);
    ok(`${tag}: its layout is one of the app's`, at >= 0, got);
    const fits = [];
    for (const o of order.slice(0, Math.max(at, 0))) {
      if (o.moved && !st.others.some((x) => x.legend)) continue;
      await ev(`(Phone._stack('${st.id}', '${o.L}', ${o.nozoom}), 1)`);
      const f = (await stacks()).find((x) => x.id === st.id);
      if (f && f.keys.length && breaks(f, o.moved).length === 0) fits.push(o);
    }
    await ev(`(Phone._stack('${st.id}', null), 1)`);
    ok(`${tag}: ${got.nokeys ? 'the keys step aside only where no arrangement fits' : 'it is the first arrangement that fits'}`, fits.length === 0, { got, legendR: st.legendR, fits });
    if (got.nokeys) info[`${tag}: the keys step aside`] = st.others.map((o) => o.what);
    else if (got.nozoom || st.legendR) info[`${tag}: ${got.nozoom ? 'the zoom keys give way' : ''}${st.legendR ? ' the legend moves' : ''}`] = got.L;
    // 8 px between the groups' keys in the layouts of five
    if (!got.nokeys && !got.nozoom && st.keys.length === 5) {
      const [dsp, zin, zout, fit] = st.keys;
      const below = (a, b) => b.box[1] - (a.box[1] + a.box[3]), beside = (a, b) => b.box[0] - (a.box[0] + a.box[2]), near = (a, b) => Math.abs(a - b) <= POS_TOLERANCE;
      const gaps = got.L === 'col' ? [below(dsp, zin), below(zout, fit)] : got.L === 'ph-short' ? [below(dsp, fit), beside(zin, fit)] : [beside(dsp, zin), beside(got.L === 'ph-row' ? zout : zin, fit)];
      ok(`${tag}: ${GROUP_GAP} px between the groups`, gaps.every((g) => near(g, GROUP_GAP)), { L: got.L, gaps });
    }
  }
};
const SETTLED = (until) => settled({ until, max: SETTLE_MAX_MS });
const BAR_ON = "!!document.querySelector('.ph-ctx.in')", TALL_ON = "!!document.querySelector('.ph-ctx.in.tall')", TOAST_ON = "!!document.querySelector('#toastHost .toast')";
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
    // a message while the bar is open
    await ev(`(__cmwToast('A message while the bar is open'), 1)`);
    await SETTLED(`${TOAST_ON} && ${BAR_ON}`);
    await checkStacks(`${tag} and a message`);
    await ev(`(document.querySelectorAll('#toastHost .toast').forEach((e) => e.remove()), 1)`);
    await SETTLED(`!${TOAST_ON} && !document.documentElement.classList.contains('ph-toast-on')`);
  }
};
const LANDSCAPE = [[568, 320], [740, 360], [844, 390], [915, 412]];
const UPRIGHT = [[360, 553], [375, 553], [360, 560], [360, 568], [360, 576], [360, 640], [390, 844]];
for (const vw of VIEWS) {
  for (const lang of ['en', 'ru', 'it']) {
    for (const [sizes, orient] of [[LANDSCAPE, 'landscape'], [UPRIGHT, 'upright']]) {
      if (orient === 'upright' && vw === 'steps' && lang !== 'en') continue;
      await open(sizes[0][0], sizes[0][1], lang, vw);
      for (const [w, h] of sizes) { await view(w, h, false, true); await SETTLED(); await checkStacks(`${vw} ${w}x${h} ${lang}, at rest`); }
      for (const scene of SCENES) { await ev(scene[1]); await SETTLED(scene[2]); await atSizes(vw, lang, sizes, scene); }
    }
  }
}
// the classic view on an upright phone: Both, at the plane's top right, comes before the stack in focus order (top to bottom)
await open(390, 844, 'en', 'classic');
const order = await ev(`[...document.querySelectorAll('#plotL button')].filter((e) => e.getClientRects().length && (e.classList.contains('ph-key') || e.closest('.viewstack'))).map((e) => ({ label: e.getAttribute('aria-label'), y: e.getBoundingClientRect().top }))`);
ok('classic 390x844: the plane\'s keys in focus order run top to bottom, Both first', order.length === 6 && order[0].label === 'Both' && order.every((k, i) => i === 0 || k.y > order[i - 1].y), order);
return { pass: !fails.length, fails, info };
