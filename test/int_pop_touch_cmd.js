// The Line integral popover on a touch device (#2191): its Copy and Close are 44 px targets, and the popover fits the screen.
// On phones in portrait (360 and 412 wide, in en and ru) and in landscape (740 × 360), on an open curve (the scene's line) and on a closed
// one (a disc added to the scene, which has a second Copy):
// - every button's hit box (the button grown by its ::after's insets, and cut by the boxes that clip it: the title's and the popover's) is at
//   least 44 × 44 px and inside the popover, so the popover's overflow does not clip the hit area, and no two hit boxes overlap;
// - the popover is inside the screen, and its last row can be scrolled into view while its title (Close) stays in view (at 740 × 360 the
//   popover is taller than the screen: the body scrolls);
// - control: on a desktop with a mouse the buttons are 24 px, with no hit area beyond them (unchanged).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }. CI runs it in the misc-1 shard.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const MIN = 44, TOL = 0.5;
// the hit boxes of the popover's buttons (each scrolled into view first), in the page's pixels: the button grown by the insets of its ::after
// (none: the button itself), cut by every ancestor up to the popover that clips (overflow not visible), at the padding box
const HITS = `(() => {
  const pop = document.querySelector('.int-pop');
  if (!pop) return null;
  const d = (v) => parseFloat(v) || 0, pad = (el) => { const q = el.getBoundingClientRect(), s = getComputedStyle(el); return { l: q.left + d(s.borderLeftWidth), t: q.top + d(s.borderTopWidth), r: q.right - d(s.borderRightWidth), b: q.bottom - d(s.borderBottomWidth) }; };
  const out = [];
  for (const b of pop.querySelectorAll('button')) {
    b.scrollIntoView({ block: 'nearest' });
    const q = b.getBoundingClientRect(), a = getComputedStyle(b, '::after');
    const grown = a.content !== 'none' && a.position === 'absolute';
    let box = grown ? { l: q.left + d(a.left), t: q.top + d(a.top), r: q.left + d(a.left) + d(a.width), b: q.top + d(a.top) + d(a.height) } : { l: q.left, t: q.top, r: q.right, b: q.bottom };
    for (let e = b.parentElement; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { const c = pad(e); box = { l: Math.max(box.l, c.l), t: Math.max(box.t, c.t), r: Math.min(box.r, c.r), b: Math.min(box.b, c.b) }; }
      if (e === pop) break;
    }
    out.push({ name: b.getAttribute('aria-label') || b.className, size: [q.width, q.height], w: box.r - box.l, h: box.b - box.t, box: [box.l, box.t, box.r, box.b], grown });
  }
  return out;
})()`;
// the popover's frame and its scrolling: its box, the screen's, the body's scroll (height of its content, of its window), and where the last row and the
// title's Close are once the body is scrolled to its end
const FRAME = `(() => {
  const pop = document.querySelector('.int-pop'), body = pop && pop.querySelector('.int-body');
  if (!pop || !body) return null;
  const q = pop.getBoundingClientRect(), bb = body.getBoundingClientRect();
  body.scrollTop = body.scrollHeight;
  const last = body.lastElementChild.getBoundingClientRect(), close = pop.querySelector('button').getBoundingClientRect(), after = body.getBoundingClientRect();
  return { pop: [q.left, q.top, q.right, q.bottom], screen: [innerWidth, innerHeight], body: [bb.top, bb.bottom], scroll: [body.scrollHeight, body.clientHeight], lastRow: [last.top, last.bottom], bodyAfter: [after.top, after.bottom], close: [close.top, close.bottom] };
})()`;
const open = async (w, h, touch, lang) => {
  await view(w, h, false, touch);
  await go(`http://localhost:${PORT}/test.html?ns=ipt${w}${lang}${Date.now() % 1e6}${lang === 'en' ? '' : '&lang=' + lang}`);
  await settled({ max: 30000, until: `typeof __cmwIntegrate === 'function'` });
  await settle(1200);
};
const show = async (id, closed) => {
  if (closed) {
    await ev(`__cmwSet('shapes', __cmwShapes().shapes.concat([{ id: 'ipt-disc', kind: 'disc', c: [0.2, 0.1], r: 0.5, ci: 2, visible: true }])), 1`);
    await settle(1000);
  }
  const shown = await ev(`(() => { for (const p of document.querySelectorAll('.int-pop')) p.remove(); return __cmwIntegrate(${JSON.stringify(id)}); })()`);
  await settled({ max: 10000, only: true, until: `!!document.querySelector('.int-pop') && (${closed ? "document.querySelectorAll('.int-pop button').length >= 3" : 'true'})` });
  await settle(700);
  return shown;
};
const near = (a, b) => Math.abs(a - b) <= TOL;
const overlap = (p, q) => Math.min(p[2], q[2]) - Math.max(p[0], q[0]) > 1 && Math.min(p[3], q[3]) - Math.max(p[1], q[1]) > 1;
const legs = [['360 × 780', 360, 780, 'en'], ['412 × 915', 412, 915, 'en'], ['740 × 360', 740, 360, 'en'], ['360 × 780 ru', 360, 780, 'ru'], ['740 × 360 ru', 740, 360, 'ru']];
for (const [name, w, h, lang] of legs) {
  await open(w, h, true, lang);
  for (const closed of [false, true]) {
    const id = closed ? 'ipt-disc' : (await ev(`(__cmwShapes().shapes.find((s) => s.kind === 'line') || {}).id`));
    const tag = `${name}, ${closed ? 'closed' : 'open'} curve`;
    ok(`${tag}: the popover opens`, await show(id, closed) === true, id);
    const hits = await ev(HITS);
    info[tag] = hits && hits.map((x) => `${x.name}: ${x.size.join('×')} hit ${x.w.toFixed(1)}×${x.h.toFixed(1)}`);
    ok(`${tag}: its buttons are found (Close and ${closed ? 'two Copy' : 'a Copy'})`, !!hits && hits.length === (closed ? 3 : 2), hits && hits.length);
    for (const x of hits || []) ok(`${tag}: ${x.name} has a hit box of ${MIN} × ${MIN} px inside the popover`, x.w >= MIN - TOL && x.h >= MIN - TOL, x);
    for (let i = 0; i < (hits || []).length; i++) for (let j = i + 1; j < hits.length; j++) ok(`${tag}: the hit boxes of ${hits[i].name} and ${hits[j].name} do not overlap`, !overlap(hits[i].box, hits[j].box), [hits[i].box, hits[j].box]);
    const f = await ev(FRAME);
    info[tag + ' frame'] = f;
    ok(`${tag}: the popover is inside the screen`, !!f && f.pop[0] >= -TOL && f.pop[1] >= -TOL && f.pop[2] <= f.screen[0] + TOL && f.pop[3] <= f.screen[1] + TOL, f);
    ok(`${tag}: the last row can be scrolled into view`, !!f && f.lastRow[1] <= f.bodyAfter[1] + TOL && f.lastRow[1] > f.bodyAfter[0], f);
    ok(`${tag}: the title's Close stays in view`, !!f && f.close[0] >= f.pop[1] - TOL && f.close[1] <= f.pop[3] + TOL && f.close[1] <= f.screen[1] + TOL, f);
  }
}
// control: a mouse on a desktop: 24 px buttons, no hit area beyond them
await open(1280, 800, false, 'en');
for (const closed of [false, true]) {
  const id = closed ? 'ipt-disc' : (await ev(`(__cmwShapes().shapes.find((s) => s.kind === 'line') || {}).id`));
  await show(id, closed);
  const hits = await ev(HITS);
  info[`desktop ${closed ? 'closed' : 'open'}`] = hits && hits.map((x) => `${x.name}: ${x.size.join('×')} hit ${x.w.toFixed(1)}×${x.h.toFixed(1)}`);
  ok(`desktop, ${closed ? 'closed' : 'open'} curve: the buttons are 24 px with no hit area beyond them`, !!hits && hits.length > 0 && hits.every((x) => near(x.size[0], 24) && near(x.size[1], 24) && !x.grown && near(x.w, 24)), hits);
}
return { pass: fails.length === 0, fails, info };
