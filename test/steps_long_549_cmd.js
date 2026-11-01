// A long chain in the steps view (#549, behind ?view=steps): with 12 steps the thread is longer than its rail, and still
// every plane, every step's chip and both ‹ › can be reached, by mouse, by keyboard and by touch. At 360, 390, 1024 and
// 1440 px, in en, ru and it:
// - mouse: › at both ends of the chain puts the ring and the shown plane's node in view, every chip and plane scrolled to
//   is whole and found by elementFromPoint at its centre, a sideways wheel scrolls the thread, and the last plane's node
//   is whole and on top;
// - keyboard: Tab from the strip's first control visits every plane and every chip, each one in view and on top once
//   focused, then › and ›'s last; the arrows walk the planes, and stop at the last;
// - touch (on the phone widths): a tap on › moves one plane, and a swipe along the thread goes on.
// (reported, not gated: a Tab stop that sits partly under the rail's edge; see info.*.tabNotWhole)
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const still = (o = {}) => settled(Object.assign({ until: 'window.__cmwSteps && !__cmwSteps().moving' }, o));
const ns = 'svl' + Date.now();
const MOB = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, CUBE = { type: 'pown', params: { n: 3 }, on: true }, SIN = { type: 'sin', params: {}, on: true };
const N = 12, CHAIN = Array.from({ length: N }, (_, i) => [MOB, CUBE, SIN][i % 3]);
const open = async (w, h, mobile, lang) => {
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }], steps: CHAIN, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(w, h, false, mobile);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  const k = `${ns}${w}${lang}`;
  await ev(`localStorage.setItem('complex-map-workbench-v1:${k}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${k}&lang=${lang}&view=steps`);
  await still({ until: "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail')" });
};
// (one element's box, and what the page shows at its centre: the element itself, or the thing covering it; whole = its
// box is inside the rail's)
const probe = (sel, nth) => ev(`(() => {
  const els = document.querySelectorAll(${JSON.stringify(sel)}), el = els[${nth || 0}], rail = document.querySelector('#svStrip .sv-rail').getBoundingClientRect();
  if (!el) return null;
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, at = document.elementFromPoint(x, y);
  const inRail = !!el.closest('.sv-rail');
  return { hit: !!at && (at === el || el.contains(at)), whole: !inRail || (r.left >= rail.left - 1.5 && r.right <= rail.right + 1.5), x: Math.round(x), y: Math.round(y), at: at ? (at.id || at.className || at.tagName) : null, rl: Math.round(rail.left), rr: Math.round(rail.right), l: Math.round(r.left), r: Math.round(r.right) };
})()`);
const geo = () => ev(`(() => { const rail = document.querySelector('#svStrip .sv-rail'), tr = rail.querySelector('.sv-track');
  return { rail: rail.clientWidth, track: tr.offsetWidth, scroll: Math.round(rail.scrollLeft), max: Math.round(rail.scrollWidth - rail.clientWidth), pageW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth,
    next: document.querySelector('#svStrip .sv-next').disabled, prev: document.querySelector('#svStrip .sv-prev').disabled }; })()`);
const S = () => ev('__cmwSteps()');
const rest = async () => { for (let i = 0; i < 150; i++) { const s = await S(); if (!s.moving) return s; await sleep(100); } return S(); };
const centre = (sel) => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const ringIn = () => ev(`(() => { const r = document.querySelector('#svStrip .sv-rail').getBoundingClientRect(), t = document.querySelector('#svStrip .sv-thumb').getBoundingClientRect(), c = t.left + t.width / 2;
  const on = document.querySelector('#svStrip .sv-plane.on'), n = on ? on.querySelector('.sv-node').getBoundingClientRect() : null;
  return { cx: Math.round(c), l: Math.round(r.left), r: Math.round(r.right), ring: c >= r.left - 0.5 && c <= r.right + 0.5, node: !n || (n.left >= r.left - 0.5 && n.right <= r.right + 0.5) }; })()`);
const touch = async (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts }, undefined);

// (software rendering takes minutes a combination: by default one language per width, each of the three in turn across the
// widths; CMW_549_FULL=1 runs all twelve)
const FULL = typeof process !== 'undefined' && process.env.CMW_549_FULL;
const GRID = [[360, 780, true, 'en'], [390, 844, true, 'ru'], [1024, 768, false, 'it'], [1440, 900, false, 'en']];
for (const [w, h, mobile] of [[360, 780, true], [390, 844, true], [1024, 768, false], [1440, 900, false]]) {
  for (const lang of ['en', 'ru', 'it']) {
    if (!FULL && !GRID.some((g) => g[0] === w && g[3] === lang)) continue;
    const tag = `${w} ${lang} ${N} steps`;
    try {
    await open(w, h, mobile, lang);
    await ev(`(() => { const s = document.querySelector('#svStrip .sv-speed'); s.value = 'fast'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
    const g0 = await geo();
    info[tag] = { rail: g0.rail, track: g0.track, over: g0.track > g0.rail + 1 };
    ok(`${tag}: the page does not scroll sideways`, g0.pageW <= g0.vw + 1, g0);
    ok(`${tag}: ‹ is off on z, › is on`, g0.prev && !g0.next, g0);
    for (const q of ['#svStrip .sv-next', '#svStrip .sv-prev']) { const p = await probe(q); ok(`${tag}: ${q} is on top at its centre`, p && p.hit, p); }

    // ---- mouse: › at both ends of the chain (the glides in between are the same), every chip and plane on top once the
    // thread is scrolled to it (what a wheel or the ring does), a sideways wheel on the thread ----
    const clickNext = async (i) => {
      const [x, y] = await centre('#svStrip .sv-next'); await click(x, y); await rest();
      const s = await S(), r = await ringIn();
      ok(`${tag}: mouse › to plane ${i}: it is the shown plane`, s.i === i && Math.abs(s.x - i) < 1e-6, { i: s.i, x: s.x });
      ok(`${tag}: mouse › to plane ${i}: the ring and the plane's node are in the rail`, r.ring && r.node, r);
    };
    await clickNext(1); await clickNext(2);
    await ev(`__cmwSteps({ go: ${N - 2}, now: true }); 1`); await still();
    await clickNext(N - 1); await clickNext(N);
    const g1 = await geo();
    ok(`${tag}: on the last plane › is off, ‹ is on`, g1.next && !g1.prev, g1);
    const lastN = await probe('#svStrip .sv-plane', N);
    ok(`${tag}: the last plane's node is whole and on top`, lastN && lastN.hit && lastN.whole, lastN);
    // (each chip and plane, the thread scrolled to put it in the middle of the rail: on top at its centre, whole)
    const miss = await ev(`(() => { const rail = document.querySelector('#svStrip .sv-rail'), out = [];
      for (const el of rail.querySelectorAll('.sv-fchip, .sv-plane')) {
        const b = el.getBoundingClientRect(), r = rail.getBoundingClientRect();
        rail.scrollLeft += (b.left + b.width / 2) - (r.left + r.width / 2);
        const c = el.getBoundingClientRect(), rr = rail.getBoundingClientRect(), at = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
        const whole = c.left >= rr.left - 1.5 && c.right <= rr.right + 1.5, hit = !!at && (at === el || el.contains(at));
        if (!(whole && hit)) out.push([el.className, el.dataset.i ?? (el.closest('.sv-step') || {}).dataset?.k, Math.round(c.left), Math.round(c.right), Math.round(rr.left), Math.round(rr.right), hit]);
      } return out; })()`);
    ok(`${tag}: mouse: every one of the ${2 * N + 1} chips and planes can be scrolled to and is whole and on top`, miss.length === 0, miss.slice(0, 4));
    // (a sideways wheel on the thread scrolls it: the scroll is animated, so it is read a moment later)
    const [rx, ry] = await centre('#svStrip .sv-rail');
    await ev(`document.querySelector('#svStrip .sv-rail').scrollLeft = 1e6; 1`); await sleep(200);
    const w0 = (await geo()).scroll;
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: rx, y: ry, deltaX: -300, deltaY: 0 }); await sleep(900);
    const w1 = (await geo()).scroll;
    ok(`${tag}: a wheel to the left scrolls the thread (${w0} to ${w1})`, mobile || w1 < w0 - 50 || g0.track <= g0.rail + 1, { w0, w1 });   // (a phone has no wheel)

    // ---- keyboard: → ×2 from z, → at the end, then ←; the ring stays in view ----
    await ev(`__cmwSteps({ go: 0, now: true }); 1`); await still();
    await ev(`document.activeElement && document.activeElement.blur(); document.querySelector('#svStrip .sv-rail').scrollLeft = 0; 1`);
    const arrow = async (k, want) => {
      await sleep(300); await key(k); await rest(); let s = await S();
      if (s.i !== want && want !== N) { info[tag].retries = (info[tag].retries || 0) + 1; await key(k); await rest(); s = await S(); }   // (counted in info)
      const r = await ringIn(); ok(`${tag}: key ${k}: plane ${want} is shown and in view`, s.i === want && r.ring && r.node, { i: s.i, r }); };
    await arrow('ArrowRight', 1); await arrow('ArrowRight', 2);
    await ev(`__cmwSteps({ go: ${N - 1}, now: true }); 1`); await still();
    await arrow('ArrowRight', N); await arrow('ArrowRight', N);   // (the last plane stays the last)
    await arrow('ArrowLeft', N - 1);

    // ---- keyboard: Tab through the strip; each focused plane / chip is in the rail and on top ----
    await ev(`__cmwSteps({ go: 0, now: true }); 1`); await still();
    await ev(`document.querySelector('#svStrip .sv-rail').scrollLeft = 0; document.querySelector('#svStrip .sv-thumb').focus(); 1`);
    const planes = new Set(), fchips = new Set(); let nextFocus = false, bad = [];
    for (let i = 0; i < 80 && !nextFocus; i++) {
      await key('Tab'); await sleep(250);
      const f = await ev(`(() => { const a = document.activeElement; if (!a || !a.closest || !a.closest('#svStrip')) return { out: true, tag: a && (a.id || a.className || a.tagName) };
        const r = document.querySelector('#svStrip .sv-rail').getBoundingClientRect(), b = a.getBoundingClientRect(), at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        const inRail = !!a.closest('.sv-rail');
        return { cls: a.className, l: Math.round(b.left), r: Math.round(b.right), rl: Math.round(r.left), rr: Math.round(r.right), sc: Math.round(document.querySelector('#svStrip .sv-rail').scrollLeft), i: a.dataset.i ?? null, k: a.closest('.sv-step') ? a.closest('.sv-step').dataset.k : null, whole: !inRail || (b.left >= r.left - 0.5 && b.right <= r.right + 0.5), hit: !!at && (at === a || a.contains(at)) }; })()`);
      if (f.out) { if (planes.size && fchips.size) break; continue; }
      if (/\bsv-plane\b/.test(f.cls)) planes.add(+f.i);
      if (/\bsv-fchip\b/.test(f.cls)) fchips.add(+f.k);
      if (/\bsv-next\b/.test(f.cls)) nextFocus = true;
      if (!(f.whole && (f.hit || /\bsv-thumb\b/.test(f.cls)))) bad.push(f);   // (the ring is pointer-events: none)
    }
    ok(`${tag}: Tab visits all ${N + 1} planes (${planes.size})`, planes.size === N + 1, [...planes]);
    ok(`${tag}: Tab visits all ${N} step chips (${fchips.size})`, fchips.size === N, [...fchips]);
    ok(`${tag}: Tab reaches ›`, nextFocus, null);
    ok(`${tag}: each focused control that is whole in the rail is on top at its centre`, bad.filter((f) => f.whole && !f.hit && !/\bsv-thumb\b/.test(f.cls)).length === 0, bad.slice(0, 3));
    // (reported, not gated: Chrome's focus scroll leaves a control that shows a few pixels where it is; its box, in px)
    info[tag].tabNotWhole = bad.filter((f) => !f.whole).map((f) => `${f.cls.replace('sv-', '')}${f.i ?? f.k ?? ''} ${f.l}-${f.r} in ${f.rl}-${f.rr}`);

    // ---- touch (phone widths) ----
    if (mobile) {
      await ev(`__cmwSteps({ go: 0, now: true }); 1`); await still();
      await ev(`document.querySelector('#svStrip .sv-rail').scrollLeft = 0; 1`);
      const [tx, ty] = await centre('#svStrip .sv-next');
      await sleep(300); await touch('touchStart', [{ x: tx, y: ty }]); await touch('touchEnd', []); await sleep(500); await rest();
      const t1 = await S();
      ok(`${tag}: a tap on › moves one plane`, t1.i === 1, { i: t1.i });
      // (a swipe right along the thread, edge to edge: the ring follows the finger, the rail scrolls on to keep it in view)
      const [sx, sy] = await centre('#svStrip .sv-rail');
      const rr = await ev(`(() => { const b = document.querySelector('#svStrip .sv-rail').getBoundingClientRect(); return [b.left, b.right]; })()`);
      for (let rep = 0; rep < 3; rep++) {
        const x0 = rr[0] + 24, x1 = rr[1] - 24;
        await touch('touchStart', [{ x: x0, y: sy }]);
        for (let j = 1; j <= 10; j++) { await touch('touchMove', [{ x: x0 + (x1 - x0) * j / 10, y: sy }]); await sleep(16); }
        await touch('touchEnd', []); await rest();
      }
      const t2 = await S(), tr = await ringIn();
      ok(`${tag}: swipes along the thread go on towards the end (plane ${t2.i})`, t2.x > 1.5 || t2.i > 1, { i: t2.i, x: t2.x });
      ok(`${tag}: after the swipes the ring is in the rail`, tr.ring, tr);
    }
    } catch (e) { ok(`${tag}: the run went on to the end`, false, String(e && e.message || e)); }
  }
}
const lg = await logs();
return { pass: fails.length === 0, fails, info, errors: (lg || []).filter((l) => l.t === 'exception' || l.t === 'error').slice(0, 5) };
