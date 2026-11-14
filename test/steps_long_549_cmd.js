// A long chain in the steps view (#549, behind ?view=steps): with 12 steps the thread is longer than its rail, and still
// every plane, every step's chip and both ‹ › can be reached, by mouse, by keyboard and by touch. At 360, 390, 1024 and
// 1440 px, in en, ru and it:
// - mouse: › at both ends of the chain puts the ring and the shown plane's node in view, every chip and plane scrolled to
//   is whole and found by elementFromPoint at its centre, a sideways wheel scrolls the thread, and the last plane's node
//   is whole and on top; on a desktop, a rail nobody scrolled follows the ring when its width changes and again after the thread has
//   fitted and been let go, also after a wheel that moves nothing (the rail fits, is at its end, or the wheel is mostly vertical),
//   and a rail the user scrolled by the wheel keeps its place (or its end) until the ring moves;
// - keyboard: Tab from the ring visits every plane, every chip and ›, each plane and chip whole in the rail and on top
//   once focused (#549: the focus scrolls it clear of the fade); the arrows walk the planes and stop at the last;
// - touch (on the phone widths): a tap on › moves one plane, and a swipe along the thread goes on.
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
const FADE_PX = 28;   // (the rail's edge fades: .sv-rail.fade-l and .fade-r in desktop.css)
const geo = () => ev(`(() => { const rail = document.querySelector('#svStrip .sv-rail'), tr = rail.querySelector('.sv-track');
  return { rail: rail.clientWidth, track: tr.offsetWidth, scroll: Math.round(rail.scrollLeft), max: Math.round(rail.scrollWidth - rail.clientWidth), pageW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth,
    next: document.querySelector('#svStrip .sv-next').disabled, prev: document.querySelector('#svStrip .sv-prev').disabled }; })()`);
const S = () => ev('__cmwSteps()');
const rest = async () => { for (let i = 0; i < 150; i++) { const s = await S(); if (!s.moving) return s; await sleep(100); } return S(); };
const centre = (sel) => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const ringIn = () => ev(`(() => { const r = document.querySelector('#svStrip .sv-rail').getBoundingClientRect(), t = document.querySelector('#svStrip .sv-thumb').getBoundingClientRect(), c = t.left + t.width / 2;
  const on = document.querySelector('#svStrip .sv-plane.on'), n = on ? on.querySelector('.sv-node').getBoundingClientRect() : null;
  return { cx: Math.round(c), l: Math.round(r.left), r: Math.round(r.right), ring: c >= r.left - 0.5 && c <= r.right + 0.5, clear: c >= r.left + ${FADE_PX} && c <= r.right - ${FADE_PX}, node: !n || (n.left >= r.left - 0.5 && n.right <= r.right + 0.5) }; })()`);
const touch = async (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts }, undefined);

// (software rendering takes minutes a combination: the CI cut is en at the four widths, ru and it at 360 and 1440, each
// with a short run; CMW_549_FULL=1 runs all twelve, with every step of the glide)
const FULL = typeof process !== 'undefined' && process.env.CMW_549_FULL;
const GRID = [[360, 'en'], [390, 'en'], [1024, 'en'], [1440, 'en'], [360, 'ru'], [1440, 'ru'], [360, 'it'], [1440, 'it']];   // (the CI cut)
for (const [w, h, mobile] of [[360, 780, true], [390, 844, true], [1024, 768, false], [1440, 900, false]]) {
  for (const lang of ['en', 'ru', 'it']) {
    if (typeof process !== 'undefined' && process.env.CMW_549_ONLY && process.env.CMW_549_ONLY !== `${w}:${lang}`) continue;
    if (!FULL && !GRID.some((g) => g[0] === w && g[1] === lang)) continue;
    const tag = `${w} ${lang} ${N} steps`;
    const T0 = Date.now(), tm = (k) => { (info[tag].ms = info[tag].ms || {})[k] = Date.now() - T0; };
    try {
    await open(w, h, mobile, lang);
    await choose('#svStrip .sv-speed', 'fast');
    const g0 = await geo();
    info[tag] = { rail: g0.rail, track: g0.track, over: g0.track > g0.rail + 1 }; tm('open');
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
    if (FULL) { await clickNext(1); await clickNext(2); }
    await ev(`__cmwSteps({ go: ${N - (FULL ? 2 : 1)}, now: true }); 1`); await still();
    if (FULL) await clickNext(N - 1);
    await clickNext(N);
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
    if (!mobile) {   // (a phone has no wheel)
    const [rx, ry] = await centre('#svStrip .sv-rail');
    await ev(`document.querySelector('#svStrip .sv-rail').scrollLeft = 1e6; 1`); await sleep(200);
    const w0 = (await geo()).scroll;
    await move(rx, ry); await sleep(100);
    let w1 = w0;
    for (let tryN = 0; tryN < 2 && w1 >= w0 - 50; tryN++) {   // (a wheel's first event after a click is sometimes not taken; counted)
      if (tryN) info[tag].retries = (info[tag].retries || 0) + 1;
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: rx, y: ry, deltaX: -300, deltaY: 0 });
      for (let i = 0; i < 20 && w1 >= w0 - 50; i++) { await sleep(100); w1 = (await geo()).scroll; }
    }
    ok(`${tag}: a wheel to the left scrolls the thread (${w0} to ${w1})`, w1 < w0 - 50 || g0.track <= g0.rail + 1, { w0, w1 });
    // (a rail the user scrolled stays where they left it when the thread or the rail changes width; the ring is brought into view
    // again when it moves: ‹)
    ok(`${tag}: the thread is longer than its rail, so the rail legs below run`, g0.track > g0.rail + 1, g0);
    if (g0.track > g0.rail + 1) {
      // (the strip's right padding changes the rail's width, which is what the page's observer watches: the wait is for that width to change)
      const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))');
      const resized = async (px) => {
        const w0 = (await geo()).rail;
        await ev(`document.querySelector('#svStrip').style.paddingRight = '${px}px'; 1`);
        let g = await geo();
        for (let i = 0; i < 100 && g.rail === w0; i++) { await sleep(50); g = await geo(); }
        ok(`${tag}: the strip's padding of ${px} px changes the rail's width (${w0} to ${g.rail})`, g.rail !== w0, { w0, rail: g.rail });
        await frames();
        return (await geo()).scroll;
      };
      // (a rail nobody scrolled follows the ring when its width changes: the ring is in the rail, clear of the fades or with the rail at its end)
      // (the follow lands within a few frames of a resize: read once it has, or after FOLLOW_POLLS polls)
      const FOLLOW_POLLS = 60;
      const followed = async () => {
        let f;
        for (let i = 0; i < FOLLOW_POLLS; i++) {
          const r = await ringIn(), g = await geo();
          f = { ok: r.ring && r.node && (r.clear || g.scroll >= g.max - 1), scroll: g.scroll, max: g.max, ring: r };
          if (f.ok) break;
          await sleep(50);
        }
        return f;
      };
      const narrowRing = async (after) => {
        const railW0 = (await geo()).rail;
        await ev(`document.querySelector('#svStrip').style.paddingRight = '200px'; 1`);
        for (let i = 0; i < 100 && (await geo()).rail === railW0; i++) await sleep(50);
        await frames();
        const narrow = await followed(), railW1 = (await geo()).rail;
        ok(`${tag}: a rail nobody scrolled keeps the ring in view when it gets narrower${after} (${railW0} to ${railW1})`, narrow.ok && railW1 < railW0, narrow);
        await ev(`document.querySelector('#svStrip').style.paddingRight = ''; 1`);
        for (let i = 0; i < 100 && (await geo()).rail !== railW0; i++) await sleep(50);
        await frames();
        const wide = await followed();
        ok(`${tag}: and when it gets wide again${after} (${railW1} to ${(await geo()).rail})`, wide.ok && (await geo()).rail === railW0, wide);
      };
      // (a wheel over the rail, at its centre; one that moves nothing brings no scroll, so the page is given two frames to show none)
      const wheelOver = async (deltaX, deltaY) => {
        const [x, y] = await centre('#svStrip .sv-rail');
        await move(x, y);
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY });
        await frames(); await frames();
      };
      await ev(`__cmwSteps({ go: 0, now: true }); 1`); await rest(); await ev(`__cmwSteps({ go: ${N}, now: true }); 1`); await rest(); await frames();
      await narrowRing('');
      await narrowRing(' a second time');
      // (a wheel that cannot move the rail leaves it following: the rail is at its end, with the ring on the last plane)
      const atEnd0 = await followed();
      ok(`${tag}: the rail is at its end with the ring on the last plane before the wheels that move nothing`, atEnd0.scroll >= atEnd0.max - 1 && atEnd0.max > 0, atEnd0);
      await wheelOver(300, 0);
      await narrowRing(' after a wheel at its end');
      await wheelOver(2, 120);
      await narrowRing(' after a mostly vertical wheel');
      // (a rail that has fitted holds no scroll of the user's: widened until the whole thread fits and back, it follows the ring again)
      await ev(`document.querySelector('#svStrip').style.minWidth = '${g0.track + 2200}px'; 1`);
      for (let i = 0; i < 100 && (await geo()).max > 0; i++) await sleep(50);
      await frames();
      const fitted = await geo();
      await wheelOver(300, 0);   // (a rail that fits cannot move: the wheel is not the user's scroll; to the left it would also navigate back, as a swipe does)
      await ev(`document.querySelector('#svStrip').style.minWidth = ''; 1`);
      for (let i = 0; i < 100 && (await geo()).max === 0; i++) await sleep(50);
      await frames();
      ok(`${tag}: the thread fits a rail widened enough, and overflows again when it is let go`, fitted.max === 0 && (await geo()).max > 0, fitted);
      await narrowRing(' after the thread has fitted and a wheel on it');
      // (a rail the user scrolled by the wheel stays where it is when the thread changes width)
      await move(rx, ry);
      let before = (await geo()).scroll;
      for (let tryN = 0; tryN < 2 && (await geo()).scroll >= before - 50; tryN++) {   // (a wheel's first event after a click is sometimes not taken)
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: rx, y: ry, deltaX: -300, deltaY: 0 });
        for (let i = 0; i < 20 && (await geo()).scroll >= before - 50; i++) await sleep(100);
      }
      // (the wheel's scroll is animated: read it once two reads agree)
      let k0 = (await geo()).scroll;
      for (let i = 0; i < 40; i++) { await sleep(100); const v = (await geo()).scroll; if (v === k0) break; k0 = v; }
      const k1 = await resized(1), k2 = await resized(200), k3 = await resized(0);
      ok(`${tag}: a rail scrolled away from the ring keeps its place when the thread changes width (${k0}, ${k1}, ${k2}, ${k3})`, k0 < before - 50 && k1 === k0 && k2 === k0 && k3 === k0, { before, k0, k1, k2, k3 });
      // (a rail the user scrolled to its end stays at its end when the thread changes width)
      await wheelOver(5000, 0);
      const atEnd = async () => { let g = await geo(); for (let i = 0; i < 40 && g.scroll < g.max - 1; i++) { await sleep(50); g = await geo(); } return g; };
      const ends = [await atEnd()];
      for (const pad of ['200px', '']) {   // (the rail narrower, then as it was: its range grows, then shrinks)
        const railW = (await geo()).rail;
        await ev(`document.querySelector('#svStrip').style.paddingRight = '${pad}'; 1`);
        for (let i = 0; i < 100 && (await geo()).rail === railW; i++) await sleep(50);
        ends.push(await atEnd());
      }
      ok(`${tag}: a rail the user scrolled to its end stays at its end when the thread changes width (${ends.map((g) => `${g.scroll}/${g.max}`).join(', ')})`, ends.every((g) => g.max > 0 && g.scroll >= g.max - 1), ends);
      // (a scroll that is not the app's, here a scrollIntoView with the focus outside the rail, is the user's: the plane it shows stays in view
      // through a resize, where the ring (on the last plane) would take the rail)
      await frames(); await frames();   // (the page puts the rail back for three frames after a resize: past them)
      await ev(`document.activeElement && document.activeElement.blur(); document.querySelector('#svStrip .sv-plane[data-i="0"]').scrollIntoView({ inline: 'start', block: 'nearest' }); 1`);
      await frames();
      const planeIn = () => ev(`(() => { const r = document.querySelector('#svStrip .sv-rail').getBoundingClientRect(), b = document.querySelector('#svStrip .sv-plane[data-i="0"]').getBoundingClientRect(); return b.left >= r.left - 0.5 && b.right <= r.right + 0.5; })()`);
      const shown = [await planeIn()];
      for (const px of [200, 0]) { await resized(px); shown.push(await planeIn()); }
      ok(`${tag}: a plane scrolled into view with the focus outside the rail stays in view through a resize (${shown.join(', ')})`, shown.every(Boolean), shown);
      await ev(`document.querySelector('#svStrip .sv-prev').click(); 1`); await rest();
      let back = await ringIn();
      for (let i = 0; i < 40 && !(back.ring && back.node); i++) { await sleep(50); back = await ringIn(); }
      ok(`${tag}: ‹ brings the ring into view again`, back.ring && back.node, back);
    }
    }

    tm('mouse');
    // ---- keyboard: the arrows (the full run only) ----
    const arrow = async (k, want) => {
      await sleep(300); await key(k);
      // (the glide may start a moment after the key: wait for the plane, and press once more only if nothing moved in 3 s; counted)
      let s = await S();
      for (let tryN = 0; tryN < 2 && s.i !== want; tryN++) {
        if (tryN) { info[tag].retries = (info[tag].retries || 0) + 1; await key(k); }
        for (let i = 0; i < 30 && s.i !== want; i++) { await sleep(100); s = await S(); }
      }
      await rest(); s = await S();
      const r = await ringIn(); ok(`${tag}: key ${k}: plane ${want} is shown and in view`, s.i === want && r.ring && r.node, { i: s.i, r }); };
    if (FULL) {
      await ev(`document.activeElement && document.activeElement.blur(); 1`);
      await ev(`__cmwSteps({ go: 0, now: true }); 1`); await still();
      await arrow('ArrowRight', 1); await arrow('ArrowRight', 2);
      await ev(`__cmwSteps({ go: ${N - 1}, now: true }); 1`); await still();
      await arrow('ArrowRight', N); await arrow('ArrowRight', N);   // (the last plane stays the last)
      await arrow('ArrowLeft', N - 1);
    }
    // (↑ the glides of the arrows are slow on a loaded software renderer; the CI cut leaves them to steps_view_cmd and kbd_nav_cmd)

    tm('arrows');
    // ---- keyboard: Tab through the strip; each focused plane / chip is in the rail and on top ----
    await ev(`document.querySelector('#svStrip .sv-rail').scrollLeft = 0; document.querySelector('#svStrip .sv-thumb').focus(); 1`);
    const planes = new Set(), fchips = new Set(); let nextFocus = false, bad = [];
    for (let i = 0; i < 80; i++) {
      await key('Tab');
      const snap = () => ev(`(() => { const a = document.activeElement; if (!a || !a.closest || !a.closest('#svStrip')) return { out: true, tag: a && (a.id || a.className || a.tagName) };
        const r = document.querySelector('#svStrip .sv-rail').getBoundingClientRect(), b = a.getBoundingClientRect(), at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        const inRail = !!a.closest('.sv-rail');
        return { cls: a.className, l: Math.round(b.left), r: Math.round(b.right), rl: Math.round(r.left), rr: Math.round(r.right), sc: Math.round(document.querySelector('#svStrip .sv-rail').scrollLeft), i: a.dataset.i ?? null, k: a.closest('.sv-step') ? a.closest('.sv-step').dataset.k : null, whole: !inRail || (b.left >= r.left - 1.5 && b.right <= r.right + 1.5), hit: !!at && (at === a || a.contains(at)) }; })()`);
      // (the focus scroll can land a frame or more later on a loaded software renderer: look again, for up to 1 s, until the control is whole and on top)
      let f = null;
      for (let t = 0; t < 8; t++) { await sleep(t ? 120 : 60); f = await snap(); if (f.out || (f.whole && (f.hit || /\bsv-thumb\b/.test(f.cls)))) break; }
      if (f.out) { if (planes.size && fchips.size) break; continue; }
      if (/\bsv-plane\b/.test(f.cls)) planes.add(+f.i);
      if (/\bsv-fchip\b/.test(f.cls)) fchips.add(+f.k);
      if (/\bsv-next\b/.test(f.cls)) nextFocus = true;
      if (!(f.whole && (f.hit || /\bsv-thumb\b/.test(f.cls)))) bad.push(f);   // (the ring is pointer-events: none)
    }
    ok(`${tag}: Tab visits all ${N + 1} planes (${planes.size})`, planes.size === N + 1, [...planes]);
    ok(`${tag}: Tab visits all ${N} step chips (${fchips.size})`, fchips.size === N, [...fchips]);
    ok(`${tag}: each Tab-focused plane and chip is whole in the rail, clear of its edges (#549)`, bad.filter((f) => !f.whole).length === 0, bad.filter((f) => !f.whole).slice(0, 3));
    ok(`${tag}: each Tab-focused control is on top at its centre`, bad.filter((f) => !f.hit && !/\bsv-thumb\b/.test(f.cls)).length === 0, bad.slice(0, 3));

    tm('tab');
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
      // (each swipe starts on the ring and goes to the rail's right edge: the ring goes to the plane under the finger)
      for (let rep = 0; rep < 3; rep++) {
        if (rep && !FULL && (await S()).x > 1.5) break;
        const x0 = await ev(`(() => { const b = document.querySelector('#svStrip .sv-thumb').getBoundingClientRect(); return b.left + b.width / 2; })()`), x1 = rr[1] - 4;
        await touch('touchStart', [{ x: x0, y: sy }]);
        for (let j = 1; j <= 12; j++) { await touch('touchMove', [{ x: x0 + (x1 - x0) * j / 12, y: sy }]); await sleep(16); }
        await touch('touchEnd', []); await sleep(300); await rest();
      }
      const t2 = await S(), tr = await ringIn();
      ok(`${tag}: swipes along the thread go on towards the end (plane ${t2.i}, x ${t2.x.toFixed(2)})`, t2.x > 1.5, { i: t2.i, x: t2.x });
      ok(`${tag}: after the swipes the ring is in the rail`, tr.ring, tr);
    }
    } catch (e) { ok(`${tag}: the run went on to the end`, false, String(e && e.message || e)); }
  }
}
if (typeof process !== 'undefined' && process.env.CMW_549_ONLY) ok('info (CMW_549_ONLY shows it here)', false, info);
const lg = await logs();
return { pass: fails.length === 0, fails, info, errors: (lg || []).filter((l) => l.t === 'exception' || l.t === 'error').slice(0, 5) };
