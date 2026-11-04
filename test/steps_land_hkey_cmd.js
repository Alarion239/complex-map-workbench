// The steps view's Landscape from the colour plane T to the plane after it: the Height key chip of the Landscape's pane
// head ramps out over the glide while X → Y's colour key ramps in (svFlatChrome). The default page, colour plane w₁:
// - at rest on w₁ and on w₂, no copy of the Height key;
// - parked at u = 0.25, 0.5 and 0.75 between w₁ and w₂: a copy of the Height key chip (its words, aria-hidden, not
//   pointable) where the chip stood at rest on w₁ (within 1 px), at opacity 1 - u, and the colour key at opacity u;
// - a glide back from w₂ to w₁: on each frame on its way with the colour key at opacity a < 1, the copy at 1 - a;
// - back at rest on w₁, no copy and the Height key chip whole;
// - with the Height key pinned open on w₁, the copy parked at u = 0.5 is open and shows the key's pixels.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
// the Height key chip (or its copy) and the left legend: words, place, opacity
const look = async () => JSON.parse(await ev(`JSON.stringify((() => {
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { txt: e.textContent.trim(), r: [r.x, r.y, r.width, r.height], op: +cs.opacity, hidden: e.getAttribute('aria-hidden'), pe: cs.pointerEvents, n: document.querySelectorAll('.sv-hkey-ghost').length }; };
  const L = document.getElementById('leftLegend');
  return { leg: Object.assign(box(L), { kind: L.dataset.kind }), ghost: box(document.querySelector('.sv-hkey-ghost')) };
})())`));
await go(`http://localhost:${PORT}/test.html?view=steps&ns=hkey${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 1, go: 1, now: true }); 1`);
await settled({ max: 60000 });
await ev(rAF2);
const r1 = await look();
info.rest1 = r1;
ok('at rest on w₁: the Height key chip in the head, and no copy', r1.leg.kind === '3d' && r1.leg.r[2] > 0 && !r1.ghost, r1);
const want = r1.leg;
info.parked = {};
for (const u of [0.25, 0.5, 0.75]) {
  await rest(1);
  await park(1 + u);
  const p = await look();
  info.parked[u] = p;
  const g = p.ghost;
  ok(`parked at u = ${u}: a copy of the Height key where the chip stood on w₁, aria-hidden and not pointable`, !!g && g.n === 1 && g.txt === want.txt && g.r.every((v, i) => Math.abs(v - want.r[i]) <= 1) && g.hidden === 'true' && g.pe === 'none', g);
  ok(`parked at u = ${u}: the copy at opacity ${1 - u}, the colour key at ${u}`, !!g && Math.abs(g.op - (1 - u)) < 0.01 && p.leg.kind === 'color' && Math.abs(p.leg.op - u) < 0.01, { ghost: g && g.op, leg: p.leg });
}
await rest(2);
const r2 = await look();
info.rest2 = r2;
ok('at rest on w₂: no copy of the Height key', !r2.ghost, r2.ghost);
// ---- a glide back from w₂ to w₁ ----
// (each frame drawn on its way: the colour key's opacity a and the copy's, which is 1 - a while a < 1)
await ev(`window.__hk = null; new Promise((done) => {
  const seen = [];
  __cmwSteps({ go: 1 });
  const t0 = performance.now();
  const tick = () => {
    const g = document.querySelector('.sv-hkey-ghost'), a = document.getElementById('leftLegend').style.opacity;
    seen.push([+__cmwSvX().toFixed(3), a === '' ? 1 : +a, g ? +getComputedStyle(g).opacity : null]);
    if (performance.now() - t0 < 6000 && __cmwSteps().moving !== false) requestAnimationFrame(tick); else done(seen);
  };
  requestAnimationFrame(tick);
}).then((v) => { window.__hk = v; }), 1`);
await settled({ max: 30000, panes: false, until: 'window.__hk !== null' });
const back = (await ev('window.__hk')) || [];
info.back = back;
const mid = back.filter(([, a]) => a > 0 && a < 1);
ok('a glide back from w₂ to w₁: the copy at opacity 1 - a on each frame whose colour key is at opacity a < 1, two frames or more', mid.length >= 2 && mid.every(([, a, g]) => g != null && Math.abs(g - (1 - a)) < 0.01), back);
await settled({ max: 60000 });
const r3 = await look();
ok('back at rest on w₁: no copy, the Height key chip in the head', !r3.ghost && r3.leg.kind === '3d' && r3.leg.op === 1, r3);
// ---- the Height key pinned open: the copy shows the key too ----
await rest(1);
await ev(`document.getElementById('leftLegend').click(); 1`);
await ev(rAF2);
const pinned = await ev(`document.getElementById('leftLegend').classList.contains('open')`);
await park(1.5);
const pk = JSON.parse(await ev(`JSON.stringify((() => {
  const g = document.querySelector('.sv-hkey-ghost'), c = g && g.querySelector('canvas');
  if (!c) return { ghost: !!g };
  const r = c.getBoundingClientRect(), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let ink = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 128) ink++;
  return { ghost: true, open: g.classList.contains('open'), w: r.width, h: r.height, ink: ink / (c.width * c.height) };
})())`));
info.pinned = Object.assign({ pinned }, pk);
ok('the Height key pinned open: parked at u = 0.5, the copy is open and shows the key', pinned && pk.open && pk.w > 0 && pk.h > 0 && pk.ink > 0.05, info.pinned);
await rest(1);
return { pass: fails.length === 0, fails, info };
