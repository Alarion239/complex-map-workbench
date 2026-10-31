// The steps view's plane stays in its column (#497, behind ?view=steps): with a long chain the thread under the plane
// fits or scrolls its own steps, and never widens the pane. With 3 and 5 steps, on a phone (360, 390) and a laptop
// (1024, 1440), in en and ru:
// - the pane's right edge is inside its column (the page, or the stage beside the right panel), and the page does not
//   scroll sideways;
// - › and the plane's own controls (the phone's keys; the laptop's zoom stack, colour key and speed) are what
//   elementFromPoint finds at their centres.
// And the thread's ring (#501 review): it follows the rail's own scroll, the hidden ends fade, it keeps clear of the
// plane's name and is a playhead between planes; on the globe the dimmed draw tools are aria-disabled.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ns = 'svw' + Date.now();
const MOB = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, CUBE = { type: 'pown', params: { n: 3 }, on: true }, SIN = { type: 'sin', params: {}, on: true };
const CHAINS = { 3: [MOB, CUBE, SIN], 5: [MOB, CUBE, SIN, CUBE, MOB] };
const open = async (w, h, mobile, lang, n) => {
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }], steps: CHAINS[n], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(w, h, false, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  const k = `${ns}${w}${lang}${n}`;
  await ev(`localStorage.setItem('complex-map-workbench-v1:${k}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${k}&lang=${lang}&view=steps` }); await sleep(1500);
  // (until the steps view is built and its first frame drawn: a software renderer can take several seconds)
  for (let i = 0; i < 50 && !(await ev(`!!(window.__cmwSteps && document.getElementById('svStrip') && document.documentElement.classList.contains('sv'))`).catch(() => false)); i++) await sleep(200);
  await settle(800);
};
// (what the page shows at the centre of each control that is shown: the control itself, or the thing covering it)
const probe = () => ev(`(() => {
  const ph = document.documentElement.classList.contains('ph'), pane = document.getElementById('paneL').getBoundingClientRect();
  const props = document.getElementById('propsPanel'), pr = props && props.getClientRects().length ? props.getBoundingClientRect() : null;
  const col = Math.min(document.documentElement.clientWidth, pr && pr.left > pane.left ? pr.left : Infinity);
  const sel = ph ? ['#svStrip .sv-next', '#svStrip .sv-prev', '#paneL .ph-sph', '#paneL .ph-dsp'] : ['#svStrip .sv-next', '#svStrip .sv-prev', '#svStrip .sv-speed', '#paneL .viewstack button', '#leftLegend'];
  const hit = {};
  for (const q of sel) {
    const el = document.querySelector(q);
    if (!el || !el.getClientRects().length) { hit[q] = 'missing'; continue; }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, at = document.elementFromPoint(x, y);
    hit[q] = at && (at === el || el.contains(at)) ? true : { x: Math.round(x), y: Math.round(y), at: at ? (at.id || at.className || at.tagName) : null };
  }
  return { paneR: Math.round(pane.right), col: Math.round(col), pageW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth, hit };
})()`);
for (const [w, h, mobile] of [[360, 780, true], [390, 844, true], [1024, 768, false], [1440, 900, false]]) {
  for (const lang of ['en', 'ru']) {
    for (const n of [3, 5]) {
      await open(w, h, mobile, lang, n);
      const p = await probe(), tag = `${w} ${lang} ${n} steps`;
      info[tag] = { paneR: p.paneR, col: p.col };
      ok(`${tag}: the plane stays in its column`, p.paneR <= p.col + 1, p);
      ok(`${tag}: the page does not scroll sideways`, p.pageW <= p.vw + 1, p);
      for (const [q, v] of Object.entries(p.hit)) ok(`${tag}: ${q} is shown and on top at its centre`, v === true, v);
    }
  }
}
// (#501 review) the thread's ring: its rail's own scroll is followed (a wheel, then ‹: the ring is in view), the hidden
// ends fade, the ring keeps clear of the shown plane's name, and between planes it is a playhead under the chips
const S = () => ev('__cmwSteps()');
const rest = async () => { for (let i = 0; i < 150; i++) { const s = await S(); if (!s.moving) return s; await sleep(100); } return S(); };
const ring = () => ev(`(() => { const r = document.querySelector('#svStrip .sv-rail'), t = document.querySelector('#svStrip .sv-thumb'), a = r.getBoundingClientRect(), b = t.getBoundingClientRect(),
  pn = document.querySelector('#svStrip .sv-plane.on .sv-pn'), c = pn ? pn.getBoundingClientRect() : null;
  return { cx: Math.round(b.left + b.width / 2), l: Math.round(a.left), r: Math.round(a.right), w: Math.round(b.width), between: t.classList.contains('between'), z: getComputedStyle(t).zIndex,
    fl: r.classList.contains('fade-l'), fr: r.classList.contains('fade-r'), clear: !c || b.bottom <= c.top + 0.5 || b.top >= c.bottom - 0.5 || b.right <= c.left || b.left >= c.right }; })()`);
for (const [w, h, mobile, lang] of [[1024, 768, false, 'ru'], [360, 780, true, 'en']]) {
  await open(w, h, mobile, lang, 5);
  const r0 = await ring(), tag = `${w} ${lang} 5 steps`;
  ok(`${tag}: on z, the thread's far end fades, its near end does not`, r0.fr && !r0.fl, r0);
  ok(`${tag}: the ring keeps clear of the shown plane's name`, r0.clear, r0);
  await ev(`__cmwSteps({ go: 4, now: true }); 1`); await settle(600);
  const r1 = await ring();
  ok(`${tag}: on the last plane the near end fades, and the ring is in the rail`, r1.fl && r1.cx >= r1.l && r1.cx <= r1.r && r1.clear, r1);
  // (a wheel scrolls the rail back to its start; then ‹ glides one plane back: the ring is kept in view)
  await ev(`(() => { document.querySelector('#svStrip .sv-rail').scrollLeft = 0; return 1; })()`); await settle(300);
  await ev(`document.querySelector('#svStrip .sv-prev').click(); 1`); await rest(); await settle(400);
  const r2 = await ring();
  ok(`${tag}: after the rail was scrolled away, ‹ keeps the ring in view`, r2.cx >= r2.l && r2.cx <= r2.r, r2);
  await ev(`__cmwSteps({ park: 1.5 }); 1`); await settle(500);
  const r3 = await ring();
  ok(`${tag}: parked between planes, the ring is a playhead under the chips`, r3.between && r3.w <= 3 && r3.z === '0', r3);
}
// (ux's wave 12 sweep) on the globe the dimmed draw tools say they are off
await open(1024, 768, false, 'en', 3);
await ev(`__cmwSteps({ surf: 'sphere' }); 1`); await settle(1200);
// (the tools are marked when the globe's first frame is drawn: up to 6 s on a software renderer)
for (let i = 0; i < 30 && !(await ev(`document.querySelector('.tool[data-tool="annulus"]').getAttribute('aria-disabled') === 'true'`)); i++) await sleep(200);
const off = await ev(`[...document.querySelectorAll('.tool[data-tool="annulus"], .tool[data-tool="sector"], .tool[data-tool="pgrid"]')].map((b) => b.getAttribute('aria-disabled'))`);
ok('on the globe, Annulus, Sector and Polar grid are aria-disabled', off.length >= 3 && off.every((v) => v === 'true'), off);
await ev(`__cmwSteps({ surf: 'plane' }); 1`); await settle(800);
const on = await ev(`[...document.querySelectorAll('.tool[data-tool="annulus"]')].map((b) => b.getAttribute('aria-disabled'))`);
ok('… and on the plane they are not', on.every((v) => v == null), on);
info.checks = 'steps view: the plane in its column with 3 and 5 steps, phone 360/390 and desk 1024/1440, en and ru';
return { pass: fails.length === 0, fails, info };
