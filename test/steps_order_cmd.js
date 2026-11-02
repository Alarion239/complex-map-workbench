// The steps view's glide order: Step by step or All at once, beside Loop (behind ?view=steps):
// - the strip holds the order select between the speed and Loop, with the two names; the state is S.homAll, kept in a saved page;
// - with All at once, a click on a plane that is not the next, and ▶, cross the planes as one homotopy (a span of the glide),
//   the planes between dimmed on the thread and still planes to click; a plane at a time (← →, the next plane's click) stays
//   plane by plane, and an arrival ends the span;
// - the select is off, with its reason, for a chain of fewer than two steps and for one with a d/dz.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svo' + Date.now();
const SHAPES = [{ id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }];
const step = (type, params) => ({ type, params: params || {}, on: true });
const base = (steps) => ({ v3: true, v4: true, v5: true, v6: true, shapes: SHAPES, steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } });
const open = async (state, nsx) => {
  await view(1280, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${nsx}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await reopen(nsx);
};
const reopen = async (nsx) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${nsx}&lang=en&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-order')` });
};
const S = () => ev('__cmwSteps()');
const ctl = (o) => ev(`__cmwSteps(${JSON.stringify(o)})`);
const arrived = () => settled({ max: 20000, until: `(() => { const s = __cmwSteps(); return !s.anim && !s.play; })()` });
// a glide part-way (from a plane at x = 0): the thread's place is read every 10 ms inside the page until it is past `from`, for at most ~4 s.
// (H.settled does not fit: it answers when the page is quiet or its condition holds, checked every 50 ms and two frames apart, and a glide
// crosses that part of its way between two of its checks, so the check would see it landed)
const underway = (from = 0.25) => ev(`await new Promise((done) => { const t0 = performance.now(), look = () => { const s = __cmwSteps(); if (((s.anim || s.play) && s.x >= ${from}) || performance.now() - t0 > 4000) done(s); else setTimeout(look, 10); }; look(); })`, 9000);
const pick = (v) => ev(`(() => { const e = document.querySelector('#svStrip .sv-order'); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('change', { bubbles: true })); return e.value; })()`);

await open(base([step('exp'), step('mobius', { a: '1', b: '-i', c: '1', d: 'i' }), step('pown', { n: 3 })]), ns);
await ctl({ go: 0, now: true }); await arrived();
// (a first glide links its programs, seconds on a software renderer, with the thread's place standing still: each order is glided
// once, there and back, before anything is read from a glide)
for (const o of ['steps', 'all']) { await ctl({ order: o }); await ctl({ go: 3 }); await arrived(); await ctl({ go: 0 }); await arrived(); }
await ctl({ order: 'steps' });
// the select: after the speed, before Loop, two names, off at Step by step
const sel = await ev(`(() => { const e = document.querySelector('#svStrip .sv-order'), kids = [...document.getElementById('svStrip').children].map((c) => c.className.split(' ').find((x) => /^sv-(speed|order|loop)$/.test(x)) || ''); return e ? { opts: [...e.options].map((o) => [o.value, o.textContent]), value: e.value, disabled: e.disabled, name: e.getAttribute('aria-label'), order: kids.filter(Boolean) } : null; })()`);
ok('the strip has the order select, after the speed and before Loop', sel && sel.order.join() === 'sv-speed,sv-order,sv-loop', sel);
ok('it names the two orders and starts at Step by step', sel && JSON.stringify(sel.opts) === JSON.stringify([['steps', 'Step by step'], ['all', 'All at once']]) && sel.value === 'steps' && !sel.disabled && sel.name === 'Glide order', sel);
// plane by plane: a click on a plane two on glides through the planes between
// (a first glide compiles its shader and stalls frames: one warm-up glide, then back)
await ctl({ go: 3 }); await arrived(); await ctl({ go: 0, now: true }); await arrived();
await ev(`document.querySelector('#svStrip .sv-plane[data-i="3"]').click(); 1`);
const m1 = await underway();
ok('Step by step: a glide to a plane three on is plane by plane (no span)', m1.anim && !m1.all && m1.span === null, m1);
await arrived();
ok('… and it arrives on that plane', (await S()).x === 3, await S());
// All at once
await ctl({ go: 0, now: true }); await arrived();
ok('choosing All at once sets the order', (await pick('all')) === 'all' && (await S()).homAll === true, await S());
// the order is the classic Deformation's: choosing it here goes through the same setter, so the Deformation's moment is
// rescaled to the new range of t (a bypass would leave it at the old one)
const lenAll = await ev(`__cmwGlide().max`), tAll = await ev(`__cmwMorph().T`);
ok('All at once takes the classic setter: the Deformation\'s moment is at the new range (not the old one)', tAll === lenAll && lenAll === 1, { tAll, lenAll });
await pick('steps');
const lenSteps = await ev(`__cmwGlide().max`), tSteps = await ev(`__cmwMorph().T`);
ok('… and Step by step puts it back to the chain\'s range', tSteps === lenSteps && lenSteps === 3, { tSteps, lenSteps });
await pick('all');
const dim = await ev(`[...document.querySelectorAll('#svStrip .sv-plane')].map((b) => [b.dataset.i, b.classList.contains('sv-skip'), b.disabled])`);
ok('the planes between z and the last are dimmed and still planes to click', JSON.stringify(dim) === JSON.stringify([['0', false, false], ['1', true, false], ['2', true, false], ['3', false, false]]), dim);
await ev(`document.querySelector('#svStrip .sv-plane[data-i="3"]').click(); 1`);
const m2 = await underway();
ok('All at once: a click on a plane three on crosses them as one homotopy (a span of the glide)', m2.anim && m2.all === true && m2.span && m2.span.x0 === 0 && m2.span.x1 === 3 && m2.x > 0 && m2.x < 3, m2);
await arrived();
const a2 = await S();
ok('… and its arrival ends the span, on that plane', a2.x === 3 && a2.span === null && a2.all === false, a2);
// a plane at a time stays plane by plane: → and a click on the next plane
await ctl({ go: 0, now: true }); await arrived();
await key('ArrowRight');
const m3 = await underway();
ok('All at once: → goes one plane, plane by plane', m3.anim && m3.all === false && m3.span === null, m3);
await arrived();
ok('… and arrives on the next plane', (await S()).x === 1, await S());
await ctl({ go: 0, now: true }); await arrived();
await ev(`document.querySelector('#svStrip .sv-plane[data-i="1"]').click(); 1`);
const m4 = await underway();
ok('All at once: a click on the next plane is plane by plane', m4.all === false && m4.span === null, m4);
await arrived();
// ▶
await ctl({ go: 0, now: true }); await arrived();
await ctl({ play: 1 });
const m5 = await underway(0.3);
ok('All at once: ▶ is one homotopy from z to the last plane', m5.play === 'glide' && m5.all === true && m5.span && m5.span.x0 === 0 && m5.span.x1 === 3, m5);
await ctl({ play: 0 });
await ctl({ go: 0, now: true }); await arrived();
// (a view parked inside the span of a glide stays that homotopy: set here, since a glide's frames wait for programs to link)
await ctl({ park: 1.4 }); await ctl({ span: [0, 3] });
const m6 = await S();
ok('parked inside the span of a glide, the view stays that homotopy', m6.x === 1.4 && m6.span && m6.all === true, m6);
await ctl({ go: 3 });
const m7 = await underway();
ok('from a parked view a glide to a plane is plane by plane (its start is no plane)', m7.anim && m7.all === false && m7.span === null, m7);
await arrived();
ok('… and it arrives on that plane', (await S()).x === 3, await S());
// a saved page keeps the order
await reopen(ns);
const kept = await ev(`({ homAll: __cmwSteps().homAll, value: document.querySelector('#svStrip .sv-order').value })`);
ok('a saved page keeps All at once (S.homAll)', kept.homAll === true && kept.value === 'all', kept);
// off: one step; a d/dz
await open(base([step('exp')]), ns + 'a');
const one = await ev(`(() => { const e = document.querySelector('#svStrip .sv-order'); return { disabled: e.disabled, tip: e.dataset.tip }; })()`);
ok('one step: the select is off and says why', one.disabled && /two steps or more/.test(one.tip), one);
await open(base([step('pown', { n: 2 }), step('deriv'), step('exp')]), ns + 'b');
const dz = await ev(`(() => { const e = document.querySelector('#svStrip .sv-order'); return { disabled: e.disabled, tip: e.dataset.tip }; })()`);
ok('a d/dz in the chain: the select is off and says why', dz.disabled && /d\/dz is not a map/.test(dz.tip), dz);
// room: at 1024 px, in English, Russian and Italian, the strip's controls sit on one row inside it, overlapping nothing
for (const lang of ['en', 'ru', 'it']) {
  await view(1024, 768, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-order')` });
  await ctl({ order: 'all' });
  await settled({});
  const box = await ev(`(() => {
    const strip = document.getElementById('svStrip'), sb = strip.getBoundingClientRect();
    const items = ['.sv-play', '.sv-prev', '.sv-rail', '.sv-add', '.sv-next', '.sv-speed', '.sv-order', '.sv-loop'].map((q) => { const e = strip.querySelector(q), r = e.getBoundingClientRect(); return { q, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width }; });
    return { strip: [sb.left, sb.right, sb.top, sb.bottom], items, scroll: strip.scrollWidth - strip.clientWidth, order: strip.querySelector('.sv-order').scrollWidth - strip.querySelector('.sv-order').clientWidth };
  })()`);
  const inside = box.items.every((i) => i.l >= box.strip[0] - 0.5 && i.r <= box.strip[1] + 0.5);
  const oneRow = box.items.every((i) => i.t >= box.strip[2] - 0.5 && i.b <= box.strip[3] + 0.5);
  const rail = box.items.find((i) => i.q === '.sv-rail');
  const sorted = box.items.slice().sort((p, q) => p.l - q.l);
  const clear = sorted.every((i, k) => !k || i.l >= sorted[k - 1].r - 0.5);
  info[`1024 ${lang}`] = { strip: box.strip.map(Math.round), rail: Math.round(rail.w), order: Math.round(box.items.find((i) => i.q === '.sv-order').w) };
  ok(`1024 ${lang}: the strip's controls sit inside it, on one row, overlapping nothing, the select's text uncut`, inside && oneRow && clear && box.scroll <= 0 && box.order <= 1, box);
  ok(`1024 ${lang}: the rail keeps room for the thread (at least 160 px, what the F chip's strip keeps)`, rail.w >= 160, rail);
}
// a scrub across the thread and back: the strip is read again before the way back, because the rail follows the plane
// the scrub arrived on (with the order beside the speed the rail is narrower than the thread, so it scrolls), and the
// way back from the last plane moves the thread to the first and draws
await view(1024, 768, false, false);
await open(base([step('exp'), step('pown', { n: 2 }), step('sin')]), ns + 'scrub');
await ctl({ scope: 'all', go: 0, now: true }); await settled({});
const stripAt = () => ev(`(() => { const ps = document.querySelectorAll('.sv-plane'), a = ps[0].getBoundingClientRect(), z = ps[ps.length - 1].getBoundingClientRect(); return { n: ps.length, x0: a.left + a.width / 2, x1: z.left + z.width / 2, y: a.top + a.height / 2, scroll: document.querySelector('.sv-rail').scrollLeft }; })()`);
const d0 = await stripAt();
await drag(d0.x0, d0.y, d0.x1, d0.y, 30, 16); await settled({});
const there = await S(), d1 = await stripAt();
await drag(d1.x1, d1.y, d1.x0, d1.y, 30, 16); await settled({});
const back = await S();
info.scrub = { n: d0.n, scrolled: d1.scroll, there: there.x, back: back.x };
ok('a scrub from the first plane to the last reaches it', there.i === d0.n - 1, there);
ok('a scrub back from the last plane (where the rail has put it) reaches the first', back.i === 0 && !back.anim, { back, d1 });
return { pass: fails.length === 0, fails, info };
