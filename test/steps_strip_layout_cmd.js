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
// - a one-step chain has no F chip at any width (F is f₁ there), and its thread fits the rail without scrolling; the thread
//   is centred (phone: in its rail, within 4 px);
// - a chain of two or more steps has the F chip: on a phone, with the thread fitting, the thread and F are centred in the
//   rail as one row with F whole inside it; with the thread overflowing, the shown dot is centred in the rail (or the rail
//   is at its end), and F is whole or fully out of the rail's view.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const still = (o = {}) => settled(Object.assign({ until: 'window.__cmwSteps && !__cmwSteps().moving' }, o));
const ns = 'svs' + Date.now();
const LOG = { type: 'log', params: {}, on: true }, ROOT = { type: 'root', params: { n: 3 }, on: true }, EXP = { type: 'exp', params: {}, on: true }, SIN = { type: 'sin', params: {}, on: true };
const CHAINS = { log: [LOG], root: [ROOT], two: [LOG, EXP], three: [LOG, EXP, SIN], long: [LOG, EXP, SIN, ROOT, LOG, EXP, SIN, ROOT, LOG, EXP] };
const open = async (w, h, mobile, lang, chain) => {
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: CHAINS[chain], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(w, h, false, mobile);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  const k = `${ns}${w}${lang}${chain}`;
  await ev(`localStorage.setItem('complex-map-workbench-v1:${k}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${k}&lang=${lang}&view=steps`);
  await still({ until: "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail') && !!document.querySelector('#svStrip .sv-fchip')" });
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
  const unit = { l: track.l, r: Math.max(track.r, fb ? fb.r : 0) };
  const left = others.filter((o) => o.r <= rb.l + ${EPS}).reduce((a, o) => Math.max(a, o.r), -Infinity), right = others.filter((o) => o.l >= rb.r - ${EPS}).reduce((a, o) => Math.min(a, o.l), Infinity);
  return { ph, clear: top - body.b, meet, off: tc - pc, gapL: rb.l - left, gapR: right - rb.r, scrolls: rail.scrollWidth > rail.clientWidth + 1, railW: rb.r - rb.l,
    unitOff: (unit.l + unit.r) / 2 - (rb.l + rb.r) / 2, ringOff, fShown: !!fb, fIn: fb ? fb.l >= rb.l - ${EPS} && fb.r <= rb.r + ${EPS} : null, fOut: fb ? fb.l >= rb.r - ${EPS} || fb.r <= rb.l + ${EPS} : null, dotOff, atEnd, atStart, centre: strip.dataset.centre || null };
})()`);
const SIZES = [[1920, 1080, false], [1440, 900, false], [1280, 800, false], [1024, 768, false], [390, 844, true], [360, 740, true], [740, 360, true], [915, 412, true]];
for (const lang of ['en', 'ru', 'it']) for (const chain of ['log', 'root', 'two', 'three', 'long']) for (const [w, h, mobile] of SIZES) {
  await open(w, h, mobile, lang, chain);
  const m = await measure(), tag = `${w} ${lang} ${chain}`, one = CHAINS[chain].length === 1;
  info[tag] = m;
  ok(`${tag}: the rail's elements are clear of the ruler (≥ ${m.ph ? 6 : 8} px)`, m.clear >= (m.ph ? 6 : 8) - 0.01, m.clear);
  ok(`${tag}: the ring is on the first plane's dot (parked on z)`, Math.abs(m.ringOff) <= 1, m.ringOff);
  ok(`${tag}: the rail meets no other control of the bar`, m.meet.length === 0, m.meet);
  if (one) {
    ok(`${tag}: a one-step chain has no F chip, and its thread does not scroll`, !m.fShown && !m.scrolls, m);
    if (m.ph) ok(`${tag}: the thread is centred in the rail`, Math.abs(m.unitOff) <= 4, m.unitOff);
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
info.checks = 'steps view: the thread bar at 1920/1440/1280/1024 and 390/360, en and ru: clear of the ruler, meets no control, centred on the pane (laptop) or in its rail (phone)';
return { pass: fails.length === 0, fails, info };
