// The phone's canvas keys are the steps view's one stack (360 x 640, 390 x 844, 740 x 360 and 844 x 390, English and Russian, touch).
// One column on the plot's right edge, top to bottom: Display options, Zoom in, Zoom out, Fit view, Sphere, in that order and under
// those names on every surface (Plane, Sphere, Landscape); there is no Both key (one plane shows) and no second Sphere key.
// Sphere carries the surface in aria-pressed, the same on every press path. Every key is at least 44 px and is the topmost element at
// its centre; the column overlaps nothing (head, ruler, strip, legend chip, toast). Its keys never move, x or y within half a pixel,
// across Plane -> Sphere -> Landscape -> Plane, nor when the legend chip shows or hides. Sphere on the Landscape and Fit view with
// nothing to fit are aria-disabled in place with the reason in aria-describedby, and a tap on one shows the reason as the toast.
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
const SHORT_PLOT = 260;      // px: below this plot height five 44 px keys with their gaps do not fit one column
const SETTLE_POLL_MS = 100;  // ms between reads while the stack's boxes settle (its 150 ms ease after a message)
const SETTLE_MAX_MS = 3000;  // ms: the longest the stack may take to come to rest
const POS_TOLERANCE = 0.5;   // px: a key is at the same place after a surface switch or a chip change
const NO_SPHERE_ON_LAND = 'The Landscape has no sphere: choose Plane or Sphere in the surface menu';
const MOB = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, CUBE = { type: 'pown', params: { n: 3 }, on: true };
const LABELS = { en: ['Display options', 'Zoom in', 'Zoom out', 'Fit view', 'Sphere'] };
const open = async (w, h, lang) => {
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }], steps: [MOB, CUBE], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  const k = ns + w + lang;
  await ev(`localStorage.setItem('complex-map-workbench-v1:${k}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${k}&lang=${lang}&view=steps`);
  await still({ until: "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail')" });
};
// the shown keys of plane L's column in document order: label, state, reason note, box, the topmost element at the centre
const column = () => ev(`(() => [...document.querySelectorAll('#plotL button.ph-key, #paneL .viewstack button')].filter((b) => b.getClientRects().length).map((b) => {
  const d = b.getAttribute('aria-describedby'), n = d && document.getElementById(d), r = b.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { label: b.getAttribute('aria-label'), cls: b.className, disabled: b.getAttribute('aria-disabled'), pressed: b.getAttribute('aria-pressed'), note: n ? n.textContent : null,
    box: [r.left, r.top, r.width, r.height], top: t === b || b.contains(t) };
}))()`);
// what the column must clear: the boxes of the shown head, rulers, strip, legend chip and toast
// the plot's box: every key lies inside it (a key above its top edge is clipped)
const plot = () => ev(`(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const inside = (b, p) => b[0] >= p[0] - POS_TOLERANCE && b[1] >= p[1] - POS_TOLERANCE && b[0] + b[2] <= p[0] + p[2] + POS_TOLERANCE && b[1] + b[3] <= p[1] + p[3] + POS_TOLERANCE;
// the column once two reads SETTLE_POLL_MS apart agree (a stack that is still easing has not reached its place)
const atRest = async () => {
  let prev = await column();
  for (let t = 0; t < SETTLE_MAX_MS; t += SETTLE_POLL_MS) {
    await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
    const now = await column();
    if (same(now, prev)) return now;
    prev = now;
  }
  return prev;
};
const accent = () => ev(`(() => { const d = document.createElement('i'); d.style.background = 'var(--accent)'; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; })()`);
const sphereBg = () => ev(`getComputedStyle([...document.querySelectorAll('#plotL button.ph-key, #paneL .viewstack button')].filter((e) => e.getClientRects().length)[4]).backgroundColor`);
const others = () => ev(`(() => [...document.querySelectorAll('#paneL .pane-head, .ruler, .ruler-corner, #svStrip, #plotL > .legend-chip:not([hidden]), #toastHost .toast')].filter((e) => e.getClientRects().length)
  .map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.className, box: [r.left, r.top, r.width, r.height] }; }))()`);
const meets = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
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
      ok(`${t}: the keys are Display options, Zoom in, Zoom out, Fit view, Sphere, in that order`, lang === 'en' ? JSON.stringify(labels) === JSON.stringify(LABELS.en) : labels.length === 5, labels);
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
      const cols = new Set(c.map((k) => Math.round(k.box[0])));
      ok(`${t}: one column where the keys fit the plot, two (zoom keys on the left) where they don't`, cols.size === (pb[3] < SHORT_PLOT ? 2 : 1), { plotH: pb[3], cols: [...cols] });
      if (pb[3] >= SHORT_PLOT) {
        const gap = (i) => c[i + 1].box[1] - (c[i].box[1] + c[i].box[3]);
        ok(`${t}: ${GROUP_GAP} px between the groups (Display to Zoom in, Zoom out to Fit view)`, Math.abs(gap(0) - GROUP_GAP) <= POS_TOLERANCE && Math.abs(gap(2) - GROUP_GAP) <= POS_TOLERANCE, [gap(0), gap(1), gap(2), gap(3)]);
      }
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
    // one press path: tapping Sphere switches the view's surface and the key follows
    await ev(`(__cmwSteps({ surf: 'plane' }), 1)`); await still();
    await ev(`(() => { const b = [...document.querySelectorAll('#plotL button.ph-key, #paneL .viewstack button')].filter((e) => e.getClientRects().length)[4]; b.click(); return 1; })()`); await still();
    const after = await ev(`__cmwSteps().surf`), pr = (await column())[4];
    ok(`${tag}: a tap on Sphere makes the surface the sphere and the key shows pressed`, after === 'sphere' && pr && pr.pressed === 'true', { after, pr });
    // a tap on a disabled Sphere shows its reason as the toast
    await ev(`(__cmwSteps({ surf: 'land' }), 1)`); await still();
    await ev(`(() => { const b = [...document.querySelectorAll('#plotL button.ph-key, #paneL .viewstack button')].filter((e) => e.getClientRects().length)[4]; b.click(); return 1; })()`);
    await settled({ until: "!!document.querySelector('#toastHost .toast')", max: 3000 });
    const toast = await ev(`(document.querySelector('#toastHost .toast') || {}).textContent || ''`);
    ok(`${tag}: a tap on the disabled Sphere shows its reason as the toast`, toast.length > 0 && (lang !== 'en' || toast.includes(NO_SPHERE_ON_LAND)), toast);
    // while the message shows the stack stays where it was, inside the plot, and the message meets no key
    await atRest();
    const withToast = await column(), tp = await plot(), tb = (await others()).filter((e) => /toast/.test(e.id));
    ok(`${tag}: the stack keeps its place while a message shows`, same(withToast, boxes.land), { land: boxes.land.map((k) => k.box), withToast: withToast.map((k) => k.box) });
    ok(`${tag}: and stays inside the plot`, withToast.every((k) => inside(k.box, tp)), { plot: tp, boxes: withToast.map((k) => k.box) });
    ok(`${tag}: and the message meets no key`, tb.length > 0 && !withToast.some((k) => tb.some((e) => meets(k.box, e.box))), { toast: tb, keys: withToast.map((k) => k.box) });
  }
}
return { pass: !fails.length, fails, info };
