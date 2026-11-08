// The steps view's thread bar (#1162, ux's ruling): the thread is centred on the pane and clear of the axis ruler above it.
// At 1920, 1440, 1280 and 1024 px (laptop) and 390 and 360 px (phone), in en and ru, with a one-step chain (Logarithm), a
// one-step chain with a long name (n-th root), a two-step, a three-step and a ten-step chain:
// - the rail's elements (pills with their selected outline, dots, the ring, the band) are at least 8 CSS px (6 on a phone)
//   below the ruler's bottom border, measured on the rendered boxes;
// - the rail meets no other control of the bar;
// - laptop: the thread's centre (first dot to last) lies on the pane's centre line within 4 px, or, where the groups of
//   controls beside it do not leave the room, the thread is as near the centre as it can be: its gap to the group on the
//   centre's side is the bar's own (at most 9.5 px, 8 plus rounding); a thread that needs the whole rail scrolls, as it did;
// - a one-step thread at 1024 px and wider is on the centre line within 4 px, in en, ru and it: the strip's folds make the room, not a shift of the thread;
// - the ring (parked on z) sits on the first plane's dot, within 1 px;
// - a one-step chain has no F chip at any width (F is f₁ there); on a laptop its thread fits the rail without scrolling; on a
//   phone it scrolls like any chain (each step's pill carries a 44 px chip and a 44 px ⋯), and at rest the shown plane and
//   its pill are whole in the rail, the next plane shows its edge, and no two targets overlap;
// - a chain of two or more steps has the F chip: on a phone, with the thread fitting, the thread and F are centred in the
//   rail as one row with F whole inside it; with the thread overflowing, the shown dot is centred in the rail (or the rail
//   is at its end), and F is whole or fully out of the rail's view.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const NEXT_EDGE = 8;   // (px of the next plane a rail shows under its fade)
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const still = (o = {}) => settled(Object.assign({ until: 'window.__cmwSteps && !__cmwSteps().moving' }, o));
const ns = 'svs' + Date.now();
const LOG = { type: 'log', params: {}, on: true }, ROOT = { type: 'root', params: { n: 3 }, on: true }, EXP = { type: 'exp', params: {}, on: true }, SIN = { type: 'sin', params: {}, on: true };
const CHAINS = { log: [LOG], root: [ROOT], two: [LOG, EXP], three: [LOG, EXP, SIN], four: [LOG, EXP, SIN, ROOT], long: [LOG, EXP, SIN, ROOT, LOG, EXP, SIN, ROOT, LOG, EXP] };
const open = async (w, h, mobile, lang, chain) => {
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: CHAINS[chain], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(w, h, false, mobile);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  const k = `${ns}${w}${lang}${chain}`;
  await ev(`localStorage.setItem('complex-map-workbench-v1:${k}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${k}&lang=${lang}&view=steps`);
  await still({ until: "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail') && !!document.querySelector('#svStrip .sv-fchip')" });
  await ev(fs.readFileSync(DIR + '/../lib/layout.js', 'utf8'));
};
const EPS = 0.5;   // (CSS px: boxes within this of touching do not overlap)
const measure = () => ev(`(() => {
  const q = (s) => document.querySelector(s), box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  const vis = (e) => e.getClientRects().length > 0 && e.getBoundingClientRect().width > 0;
  const ph = document.documentElement.classList.contains('ph'), body = box(q('#paneL .pane-body')), rail = q('.sv-rail'), rb = box(rail), strip = q('#svStrip');
  // (the ruler's bottom border is the pane body's bottom: the bar starts there)
  const els = [...rail.querySelectorAll('.sv-fwrap, .sv-fchip, .sv-node, .sv-thumb, .sv-band:not([hidden])')].filter(vis);
  const top = Math.min(...els.map((e) => { const s = getComputedStyle(e), o = e.matches(':focus-visible') || e.getAttribute('aria-pressed') === 'true' || e.classList.contains('on') ? 2 : 0; return e.getBoundingClientRect().top - o; }));
  const others = [...strip.children].filter((e) => e !== rail && vis(e) && !e.matches('.sv-bandx, .sv-playpop')).map((e) => ({ c: e.className.split(' ')[0], ...box(e) }));
  const meet = others.filter((o) => o.l < rb.r - ${EPS} && o.r > rb.l + ${EPS} && o.t < rb.b - ${EPS} && o.b > rb.t + ${EPS}).map((o) => o.c);
  const nodes = [...document.querySelectorAll('.sv-plane .sv-node')].filter(vis).map(box), first = nodes[0], last = nodes[nodes.length - 1];
  const tc = (first.l + first.r) / 2 / 2 + (last.l + last.r) / 2 / 2, pc = (body.l + body.r) / 2;
  const F = q('.sv-wholemap'), fb = F && vis(F) ? box(F) : null, track = box(q('.sv-track'));
  const ring = box(q('.sv-thumb')), ringOff = (ring.l + ring.r) / 2 - (nodes[0].l + nodes[0].r) / 2, shown = nodes[Math.round(__cmwSteps().x)], dotOff = shown ? (shown.l + shown.r) / 2 - (rb.l + rb.r) / 2 : null, atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1, atStart = rail.scrollLeft <= 0;
  const planes = [...rail.querySelectorAll('.sv-plane')].filter(vis).map(box), wraps = [...rail.querySelectorAll('.sv-fwrap')].filter(vis).map(box), xi = Math.round(__cmwSteps().x);
  const curPlane = planes[xi] || null, curPill = wraps[Math.min(xi, wraps.length - 1)] || null, farPlane = planes[xi + 1] || null, whole = (b) => !!b && b.l >= rb.l - ${EPS} && b.r <= rb.r + ${EPS};
  const farEdge = farPlane ? Math.min(farPlane.r, rb.r) - Math.max(farPlane.l, rb.l) : null, fadeR = rail.classList.contains('fade-r');
  // (the ring sits on its plane by design: pointer-events none)
  const overlap = __layout.noOverlap(strip).map((v) => v.el + ' / ' + v.other).filter((d) => !/sv-thumb/.test(d));
  const unit = { l: track.l, r: Math.max(track.r, fb ? fb.r : 0) };
  const left = others.filter((o) => o.r <= rb.l + ${EPS}).reduce((a, o) => Math.max(a, o.r), -Infinity), right = others.filter((o) => o.l >= rb.r - ${EPS}).reduce((a, o) => Math.min(a, o.l), Infinity);
  return { ph, clear: top - body.b, meet, off: tc - pc, gapL: rb.l - left, gapR: right - rb.r, scrolls: rail.scrollWidth > rail.clientWidth + 1, railW: rb.r - rb.l,
    unitOff: (unit.l + unit.r) / 2 - (rb.l + rb.r) / 2, ringOff, fShown: !!fb, fIn: fb ? fb.l >= rb.l - ${EPS} && fb.r <= rb.r + ${EPS} : null, fOut: fb ? fb.l >= rb.r - ${EPS} || fb.r <= rb.l + ${EPS} : null, dotOff, atEnd, atStart, centre: strip.dataset.centre || null, planeIn: whole(curPlane), pillIn: whole(curPill), farEdge, fadeR, nextOn: !!q('.sv-next') && q('.sv-next').getAttribute('aria-disabled') !== 'true' && !q('.sv-next').disabled, overlap, scrollX: rail.scrollLeft };
})()`);
const SIZES = [[1920, 1080, false], [1440, 900, false], [1280, 800, false], [1024, 768, false], [390, 844, true], [360, 740, true], [740, 360, true], [915, 412, true]];
for (const lang of ['en', 'ru', 'it']) for (const chain of ['log', 'root', 'two', 'three', 'long']) for (const [w, h, mobile] of SIZES) {
  await open(w, h, mobile, lang, chain);
  const m = await measure(), tag = `${w} ${lang} ${chain}`, one = CHAINS[chain].length === 1;
  info[tag] = m;
  ok(`${tag}: the rail's elements are clear of the ruler (≥ ${m.ph ? 6 : 8} px)`, m.clear >= (m.ph ? 6 : 8) - 0.01, m.clear);
  ok(`${tag}: the ring is on the first plane's dot (parked on z)`, Math.abs(m.ringOff) <= 1, m.ringOff);
  ok(`${tag}: the rail meets no other control of the bar`, m.meet.length === 0, m.meet);
  if (m.ph) ok(`${tag}: no two controls of the strip overlap`, m.overlap.length === 0, m.overlap);
  if (one) {
    ok(`${tag}: a one-step chain has no F chip`, !m.fShown, m);
    if (!m.ph) ok(`${tag}: a one-step thread does not scroll`, !m.scrolls, m);
    else {
      ok(`${tag}: at rest the shown plane and its pill are whole in the rail`, m.planeIn && m.pillIn, m);
      ok(`${tag}: a thread that overflows shows the next plane's edge (≥ ${NEXT_EDGE} px) under the fade, or › is enabled at rest`, !m.scrolls || (m.fadeR && (m.farEdge >= NEXT_EDGE || m.nextOn)), m);
    }
  } else if (!m.ph) ok(`${tag}: F shows with the second step`, m.fShown, m);
  if (!m.ph && one && w >= 1024) ok(`${tag}: a one-step thread is on the pane's centre line (±4 px)`, Math.abs(m.off) <= 4, { off: Math.round(m.off), gapL: m.gapL, gapR: m.gapR, railW: m.railW });
  if (!m.ph && !m.scrolls) {
    const near = m.off < 0 ? m.gapR : m.gapL;
    ok(`${tag}: the thread is on the pane's centre line, or as near as the bar's groups allow`, Math.abs(m.off) <= 4 || near <= 9.5, { off: Math.round(m.off), gapL: m.gapL, gapR: m.gapR });
  }
  if (m.ph && !m.scrolls && !one) {
    ok(`${tag}: the thread and F are centred in the rail`, Math.abs(m.unitOff) <= 4, m.unitOff);
    ok(`${tag}: F is whole inside the rail`, m.fIn === true, m);
  }
  if (!one && m.scrolls) {
    ok(`${tag}: F is whole or fully out of the rail's view`, m.fIn !== false || m.fOut === true, m);
    ok(`${tag}: the shown dot is centred in the rail (or the rail is at an end)`, Math.abs(m.dotOff) <= 4 || m.atStart || m.atEnd, m);
  }
}
// landscape phones, 568 to 932 px in 4 px steps, with two, three and four steps: at rest F is whole or fully out of the rail's view,
// at every width. Where the thread plus F would overflow the rail by less than F's width (the band), F gets a lead margin that puts it
// fully out of view at rest; scrolled to the end F is whole and the blank before it is under BLANK_MAX; outside the band the margin is 0
const SWEEP_FROM = 568, SWEEP_TO = 932, SWEEP_STEP = 4;
const OVERFLOW_MIN = 1;   // (px: a rail overflowing by no more than this does not scroll)
const BLANK_MAX = 48;   // (px: the blank track before F at the rail's end)
const SETTLE_FLOOR = 150;   // (ms: the least a view change is given to settle)
const GLIDE_SAMPLES = 12, GLIDE_SAMPLE_MS = 40;   // (the margin is read this many times, this far apart, while a glide runs)
const lead = () => ev(`(() => {
  const rail = document.querySelector('#svStrip .sv-rail'), F = document.querySelector('.sv-wholemap'), fw = F.getBoundingClientRect().width;
  const margin = parseFloat(getComputedStyle(F).marginLeft) || 0, over = rail.scrollWidth - rail.clientWidth - margin;
  return { margin, over, fw, inBand: over > ${OVERFLOW_MIN} && over < fw };
})()`);
const atEnd = () => ev(`(() => {
  const rail = document.querySelector('#svStrip .sv-rail'), F = document.querySelector('.sv-wholemap');
  rail.scrollLeft = rail.scrollWidth; const rb = rail.getBoundingClientRect(), fb = F.getBoundingClientRect();
  const planes = [...rail.querySelectorAll('.sv-plane')], last = planes[planes.length - 1].getBoundingClientRect();
  return { fWhole: fb.left >= rb.left - ${EPS} && fb.right <= rb.right + ${EPS}, blank: fb.left - last.right };
})()`);
for (const chain of ['two', 'three', 'four']) {
  await open(SWEEP_FROM, 360, true, 'en', chain);
  const bad = [], badMargin = [], badEnd = [], badRest = [];
  let inBand = null;
  const bandWidths = [];
  for (let w = SWEEP_FROM; w <= SWEEP_TO; w += SWEEP_STEP) {
    await view(w, 360, false, true);
    await still({ floor: SETTLE_FLOOR });
    await ev("document.querySelector('#svStrip .sv-rail').scrollLeft = 0; 1");
    await still();
    const m = await measure(), l = await lead();
    if (!(m.fShown && (m.fIn !== false || m.fOut === true))) bad.push({ w, fIn: m.fIn, fOut: m.fOut, railW: m.railW });
    if ((l.margin > 0) !== l.inBand) badMargin.push({ w, ...l });
    if (l.inBand) {
      if (inBand === null) inBand = w;
      bandWidths.push(w);
      if (!(m.fOut === true && m.planeIn && m.pillIn)) badRest.push({ w, fOut: m.fOut, planeIn: m.planeIn, pillIn: m.pillIn });
      const e = await atEnd();
      if (!e.fWhole || e.blank >= BLANK_MAX) badEnd.push({ w, ...e });
    }
  }
  ok(`${chain}, ${SWEEP_FROM} to ${SWEEP_TO} px landscape in ${SWEEP_STEP} px steps: F is whole or fully out of the rail's view at rest`, bad.length === 0, bad);
  ok(`${chain}: F's lead margin is set in the band and 0 outside it`, badMargin.length === 0 && inBand !== null, { badMargin, inBand });
  ok(`${chain}: in the band, at rest F is fully out of view and the shown plane and its pill are whole`, badRest.length === 0, badRest);
  ok(`${chain}: in the band, scrolled to the end F is whole and the blank before it is under ${BLANK_MAX} px`, badEnd.length === 0, badEnd);
  if (inBand !== null) {
    // parked on each plane in turn, at every width of the band: the plane and its pill are whole, and F is whole or fully out of view
    const badPark = [];
    for (const w of bandWidths) {
      await view(w, 360, false, true);
      await still({ floor: SETTLE_FLOOR });
      await ev("document.querySelector('#svStrip .sv-rail').scrollLeft = 0; 1");
      for (let i = 0; i < CHAINS[chain].length; i++) {
        await ev("document.querySelector('.sv-next').click(); 1");
        await still({ floor: SETTLE_FLOOR });
        const m = await measure();
        if (!(m.fShown && m.planeIn && m.pillIn && (m.fIn !== false || m.fOut === true))) badPark.push({ w, plane: i + 1, planeIn: m.planeIn, pillIn: m.pillIn, fIn: m.fIn, fOut: m.fOut, scrollX: m.scrollX });
      }
    }
    // a jump to each plane (no glide) parks the same way
    for (const w of bandWidths) {
      await view(w, 360, false, true);
      await still({ floor: SETTLE_FLOOR });
      for (let i = 1; i <= CHAINS[chain].length; i++) {
        await ev(`__cmwSteps({ go: ${i}, now: true }); 1`);
        await still({ floor: SETTLE_FLOOR });
        const m = await measure();
        if (!(m.fShown && m.planeIn && m.pillIn && (m.fIn !== false || m.fOut === true))) badPark.push({ w, jump: i, planeIn: m.planeIn, pillIn: m.pillIn, fIn: m.fIn, fOut: m.fOut, scrollX: m.scrollX });
      }
    }
    // a page opened at each width of the band, with no resize before it, and walked to its last plane: F whole or the rail at its end
    for (const w of bandWidths) {
      await open(w, 360, true, 'en', chain);
      await ev(`__cmwSteps({ go: ${CHAINS[chain].length}, now: true }); 1`);
      await still({ floor: SETTLE_FLOOR });
      const m = await measure();
      if (!(m.fShown && m.planeIn && m.pillIn && (m.fIn !== false || m.fOut === true))) badPark.push({ w, opened: true, planeIn: m.planeIn, pillIn: m.pillIn, fIn: m.fIn, fOut: m.fOut, scrollX: m.scrollX });
    }
    ok(`${chain}: in the band, parked on each plane the plane and its pill are whole and F is whole or fully out of view`, badPark.length === 0, badPark);
    await view(inBand, 360, false, true);
    await still({ floor: SETTLE_FLOOR });
    // a glide to the next plane leaves the margin as it was
    await view(inBand, 360, false, true);
    await still({ floor: SETTLE_FLOOR });
    const m0 = (await lead()).margin, seen = [];
    await ev("document.querySelector('.sv-next').click(); 1");
    for (let i = 0; i < GLIDE_SAMPLES; i++) { seen.push((await lead()).margin); await new Promise((r) => setTimeout(r, GLIDE_SAMPLE_MS)); }
    await still();
    seen.push((await lead()).margin);
    ok(`${chain}: the margin does not change during or after a glide`, seen.every((v) => v === m0), { m0, seen });
  }
}
// phone widths at which a selection is checked
const SELECT_WIDTHS = [390, 360];
// a selection on a phone brings the step's chip whole into the rail, each selection in turn, and a later jump of the ring is followed by the
// rail: the ring is in the rail's view on the plane it parks on
for (const w of SELECT_WIDTHS) {
  await open(w, 740, true, 'en', 'four');
  const chipIn = (k) => ev(`(() => { const c = document.querySelector('#svStrip .sv-step[data-k="${k}"]'), r = document.querySelector('#svStrip .sv-rail').getBoundingClientRect(), b = c.getBoundingClientRect(); return b.left >= r.left - ${EPS} && b.right <= r.right + ${EPS}; })()`);
  const ringIn = () => ev(`(() => { const t = document.querySelector('#svStrip .sv-thumb').getBoundingClientRect(), r = document.querySelector('#svStrip .sv-rail').getBoundingClientRect(); return t.left >= r.left - ${EPS} && t.right <= r.right + ${EPS}; })()`);
  const select = async (plane, k) => {
    await ev(`__cmwSteps({ go: ${plane}, now: true }); 1`);
    await still({ floor: SETTLE_FLOOR });
    await ev(`document.querySelector('#svStrip .sv-step[data-k="${k}"] .sv-fchip').click(); 1`);
    await still({ floor: SETTLE_FLOOR });
  };
  const res = {};
  await select(2, 2); res.chip2 = await chipIn(2);
  await select(3, 3); res.chip3 = await chipIn(3);
  await ev("__cmwSteps({ go: 1, now: true }); 1"); await still({ floor: SETTLE_FLOOR });
  res.ringOnPlane1 = await ringIn();
  res.state = await ev("(() => { const r = document.querySelector('#svStrip .sv-rail'), t = document.querySelector('#svStrip .sv-thumb').getBoundingClientRect(), rb = r.getBoundingClientRect(); return { sl: r.scrollLeft, sw: r.scrollWidth, cw: r.clientWidth, tl: Math.round(t.left - rb.left), tr: Math.round(t.right - rb.left), x: __cmwSteps().x, moving: __cmwSteps().moving }; })()");
  ok(`${w} en four: a selection brings the step's chip whole into the rail, the second one too`, res.chip2 && res.chip3, res);
  ok(`${w} en four: after two selections a jump to plane 1 leaves the ring in the rail's view`, res.ringOnPlane1, res);
  // a lone selection then a jump behaves the same
  await open(w, 740, true, 'en', 'four');
  await select(3, 3);
  await ev("__cmwSteps({ go: 1, now: true }); 1"); await still({ floor: SETTLE_FLOOR });
  ok(`${w} en four: after one selection a jump to plane 1 leaves the ring in the rail's view`, await ringIn(), null);
}
info.checks = 'steps view: the thread bar at 1920/1440/1280/1024 and 390/360, en and ru: clear of the ruler, meets no control, centred on the pane (laptop) or in its rail (phone)';
return { pass: fails.length === 0, fails, info };
