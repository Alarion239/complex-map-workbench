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
      const sp = c.find((k) => k.cls.includes('sbtn') || k.label === (lang === 'en' ? 'Sphere' : k.label)) ;
      const sph = c[4];
      if (sph) {
        ok(`${t}: Sphere is pressed exactly on the sphere`, sph.pressed === String(surf === 'sphere'), sph.pressed);
        if (surf === 'land') ok(`${t}: Sphere is aria-disabled in place, with its reason in the note`, sph.disabled === 'true' && sph.note === (lang === 'en' ? NO_SPHERE_ON_LAND : sph.note) && !!sph.note, sph);
        else ok(`${t}: Sphere is enabled`, sph.disabled !== 'true', sph);
      }
      void sp;
      const o = await others();
      const hits = [];
      for (const k of c) for (const e of o) if (meets(k.box, e.box)) hits.push([k.label, e.id]);
      ok(`${t}: the column overlaps nothing`, hits.length === 0, hits);
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
  }
}
return { pass: !fails.length, fails, info };
