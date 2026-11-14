// The carried landscape with All sheets: a glide between two planes whose maps are multivalued carries plane a's
// sheets as it carries its principal surface (plane a's grid moved by the glide's map, each sheet at its own height), so the
// sheets neither vanish nor reappear against the rest frame. A chain z, Möbius, √ with All sheets on, on the Landscape:
// - held by either end (a scrub on the rail, not let go, at u = 0.005 and 0.995): a carried frame that draws the sheets
//   and is the plane at rest there with its sheets (at most 2 % of the pane's pixels more than 32/255 apart);
// - parked between the planes (u = 0.5): a carried frame that draws the sheets, unlike both planes at rest, and the
//   same frame with All sheets off reports no sheets and draws the principal surface.
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const grab = (tag) => ev(`(() => { const cv = document.getElementById('canvasL'); window.__ss = window.__ss || {}; window.__ss[${JSON.stringify(tag)}] = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; return [cv.width, cv.height]; })()`);
const diff = (a, b) => ev(`(() => { const A = window.__ss[${JSON.stringify(a)}], B = window.__ss[${JSON.stringify(b)}]; if (!A || !B || A.length !== B.length) return null; let n = 0, n32 = 0; for (let i = 0; i < A.length; i += 4) { n++; const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d > 32) n32++; } return +(n32 / n).toFixed(4); })()`);
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const CHAIN = [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }];
const open = async () => {
  const ns = 'landglidesheets' + Date.now();
  await loadView('steps', ns, { shapes: [], steps: CHAIN, sheets: true, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
  await settled({ max: 60000 });
};
await open();
await rest(1); await grab('rest1');
await rest(0); await grab('rest0');
const carry = () => ev('typeof __cmwLandCarry === "function" ? JSON.stringify(__cmwLandCarry()) : null').then((c) => (c ? JSON.parse(c) : null));
info.ends = {};
for (const [x, tag, restTag] of [[0.005, 'h0', 'rest0'], [0.995, 'h1', 'rest1']]) {
  await rest(0);
  { const h = await hold(x); ok(`the thread is held at ${x}`, h.ok, h); }
  await ev(rAF2);
  const c = await carry();
  await grab(tag);
  info.ends[tag] = { u: c && c.u, sheets: c && c.sheets, d: await diff(tag, restTag) };
  await ev('window.__svScrubUp(), 1');
  await settled({ max: 60000 });
  ok(`held at ${x}: a carried frame that draws the sheets`, !!c && Math.abs(c.u - x) < 0.002 && c.sheets === true, c);
  ok(`held at ${x}: the plane at rest there (<= 2 % of pixels > 32/255)`, info.ends[tag].d != null && info.ends[tag].d <= 0.02, info.ends[tag]);
}
await rest(0);
{ const h = await hold(0.5); ok('the thread is held at 0.5', h.ok, h); }
await ev(rAF2);
const heldMid = await carry();
await grab('heldMid');
await ev('window.__svScrubUp(), 1');
await settled({ max: 60000 });
await rest(0); await park(0.5);
const mid = await carry();
await grab('mid');
info.mid = { carry: mid, from0: await diff('mid', 'rest0'), from1: await diff('mid', 'rest1') };
ok('parked at 0.5: a carried frame that draws the sheets', !!mid && mid.sheets === true, mid);
ok('parked at 0.5: unlike both planes at rest', info.mid.from0 > 0.01 && info.mid.from1 > 0.01, info.mid);
info.heldMid = { mu: [heldMid && heldMid.mu, mid && mid.mu], d: await diff('mid', 'heldMid') };
ok('the same u gives the same frame, held or parked (<= 2 % of pixels > 32/255, one height scale)', !!heldMid && Math.abs(heldMid.mu / mid.mu - 1) < 1e-6 && info.heldMid.d != null && info.heldMid.d <= 0.02, info.heldMid);
// (the same page with All sheets ticked off, from the plane's options)
await ev(`(() => {
  if (!document.getElementById('sheetsChk')) { const b = document.querySelector('#leftFoot .opts-btn:not(.pat-btn)'); if (b) b.click(); }
  const c = document.getElementById('sheetsChk'); if (c) c.click();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return !!c;
})()`);
await settled({ max: 60000 });
await rest(0); await park(0.5);
const plain = await carry();
ok('parked at 0.5 with All sheets off: the principal surface only', !!plain && plain.sheets === false, plain);
return { pass: !fails.length, fails, info };
