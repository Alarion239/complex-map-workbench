// The steps view's Landscape height follows the colour plane T, as its colour does (#1576): a point's height is h of
// its image in T, so the steps after T never change the relief of a plane up to T, and past T the points carry T's
// heights as they carry its colour.
// A chain z → z² + 1 → √ (and the same without √, or with exp after it), the Landscape, Im heights, the shapes hidden:
// - T = z: plane z is its own relief, Im z, the probe's height map the identity; the frame is the same pixel for pixel
//   as with the √ step removed (no seam along √'s cut, nothing of the steps after T);
// - T = w₁: plane z is the relief of Im(z² + 1), the probe reading z² + 1; the frame is the same pixel for pixel as on
//   the chain without √, where w₁ is the last plane;
// - past T (T = w₁): plane w₂ is plane w₁'s points carried (s = 1) at their heights on w₁ (the carry's height map is the
//   identity of w₁), and the probe over a point of w₂ reads the point of w₁ carried there, its square; the frame is the
//   same pixel for pixel with an exp step appended after w₂.
// (The frames compared are drawn without the pane's words, filled or stroked: the ruler's title names what the height
// reads, f₁ where w₁ is mid-chain and F where it is the last plane)
// A chain z, √, Möbius (two sheets over z and every plane after √), All sheets on:
// - T = w₁: plane z is its own relief with the sheets of √, the same pixel for pixel as the chain √ alone;
// - with 1/w after it, T = w₂ and log heights: plane w₃, past T, is a carried frame from z with the sheets at their
//   heights in T (the stages (z, w₂]: w₂'s pole, at z = −1 on √'s second sheet, a spike carried to w₃ = 0);
// - T = w₂: plane z's own relief at the pane heights of the CI's and of a few others is still once settled() returns
//   (the refined frame is the first rest frame: the pane draws no other frame after it).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const carried = async () => JSON.parse(await ev('JSON.stringify(typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null)'));
const heightAt = async (x, y) => JSON.parse(await ev(`JSON.stringify(typeof __cmwLandHeightAt === 'function' ? __cmwLandHeightAt(${x}, ${y}) : 'no hook')`));
const near = (v, w) => Array.isArray(v) && Math.hypot(v[0] - w[0], v[1] - w[1]) <= 1e-6 * (1 + Math.hypot(w[0], w[1]));
// (a kept frame's pixels, canvasL's RGBA bytes, held here: a page load clears the page's own copy)
const kept = {};
const keep = async (tag) => { const b64 = await ev(`(() => { const P = window.__heldPx[${JSON.stringify(tag)}]; if (!P) return ''; let s = ''; for (let i = 0; i < P.length; i += 0x8000) s += String.fromCharCode.apply(null, P.subarray(i, i + 0x8000)); return btoa(s); })()`); kept[tag] = b64 ? Buffer.from(b64, 'base64') : null; };
// two kept frames' difference: the pixels with any channel apart, the share more than 32/255 apart, the largest channel difference
const diff = (a, b) => {
  const A = kept[a], B = kept[b];
  if (!A || !B || A.length !== B.length) return null;
  let n = 0, over = 0, max = 0;
  for (let i = 0; i < A.length; i += 4) { const m = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (m) n++; if (m > 32) over++; if (m > max) max = m; }
  return { apart: n, frac: +(over / (A.length / 4)).toFixed(5), max };
};
const step = (type, params) => ({ type, params: params || {}, on: true });
const P = step('custom', { expr: 'z^2 + 1', cut: 180 }), ROOT = step('root', { n: 2 }), EXP = step('exp');
// the chain steps on the Landscape with Im heights (o.height: another) at plane `plane` with T, still: its frame kept as
// `tag`. The pane's words are not drawn (the floor's and the ruler's: the ruler's title names what the height reads,
// "Im f₁" or "Im F", which the frames compared here may name differently)
async function frame(steps, T, plane, tag, o = {}) {
  const ns = 'landfollow' + Date.now(), height = o.height || 'im';
  await loadView('steps', ns, { shapes: [], steps, sheets: !!o.sheets, srcView: { cx: 0, cy: 0, s: 90 } });
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`(() => { const f = CanvasRenderingContext2D.prototype; for (const k of ['fillText', 'strokeText']) { const g = f[k]; f[k] = function (...a) { if (this.canvas.id !== 'canvasL') return g.apply(this, a); }; } return 1; })()`);
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: ${T}, go: ${plane}, now: true }); 1`);
  await settled({ max: 60000 });
  await ev(`(document.querySelector('#heightSeg button[data-v="${height}"]') || {}).click?.(), 1`);
  await rest(plane);
  const st = JSON.parse(await ev('JSON.stringify({ T: __cmwSteps().T, planes: __cmwSteps().planes, height: (document.querySelector("#heightSeg [aria-pressed=true], #heightSeg .on") || {}).dataset?.v || null })'));
  ok(`${tag}: the frame is still`, await grab(tag), null);
  await keep(tag);
  return Object.assign(st, { carry: await carried() });
}
// ---- z → z² + 1 → √ ----
const CH = [P, ROOT];
{
  const r = info.z = {};
  r.with = await frame(CH, 0, 0, 'z3');
  r.withH = await heightAt(0.3, 0.7);
  r.without = await frame([P], 0, 0, 'z2');
  ok('T = z: the chain has three planes and T is z', Array.isArray(r.with.planes) && r.with.planes.length === 3 && r.with.T === 0, r.with);
  ok('T = z, plane z: its own relief (no carry)', !r.with.carry, r.with.carry);
  ok('T = z, plane z: the height reads z itself', near(r.withH, [0.3, 0.7]), r.withH);
  r.d = diff('z3', 'z2');
  ok('T = z, plane z: the relief is unchanged by the √ step after T (no seam along its cut)', !!r.d && r.d.max === 0, r.d);
}
{
  const r = info.w1 = {};
  r.with = await frame(CH, 1, 0, 'w1z3');
  r.withH = await heightAt(0.3, 0.7);
  r.last = await frame([P], 1, 0, 'w1z2');
  ok('T = w₁, plane z: its own relief (no carry)', !r.with.carry, r.with.carry);
  // ((0.3 + 0.7i)² + 1 = 0.6 + 0.42i)
  ok('T = w₁, plane z: the height reads z² + 1', near(r.withH, [0.6, 0.42]), r.withH);
  r.d = diff('w1z3', 'w1z2');
  ok('T = w₁, plane z: the relief is h(z² + 1), unchanged by the √ step after T', !!r.d && r.d.max === 0, r.d);
}
{
  const r = info.past = {};
  r.rest = await frame(CH, 1, 2, 'p3');
  // (a point of w₂ in the window, and the point of w₁ carried to it: w₂ = √w₁, so w₁ = w₂²)
  r.h = await heightAt(0.8, 0.5);
  r.more = await frame([P, ROOT, EXP], 1, 2, 'p4');
  const c = r.rest.carry;
  ok('past T, plane w₂: plane w₁\'s points carried', !!c && c.s === 1 && c.u === 1, c);
  ok('past T, plane w₂: at their heights on w₁ (the carry\'s height map is w₁\'s identity)', !!c && !!c.hmap && c.hmap.a === 1 && c.hmap.b === 1, c);
  // ((0.8 + 0.5i)² = 0.39 + 0.8i)
  ok('past T, plane w₂: the probe reads the point of w₁ carried there, w₂²', near(r.h, [0.39, 0.8]), r.h);
  r.d = diff('p3', 'p4');
  ok('past T, plane w₂: the carried relief is unchanged by a step after it', !!r.d && r.d.max === 0, r.d);
}
// ---- All sheets: z, √, Möbius ----
const CHAIN = [ROOT, step('mobius', { a: '1', b: '-i', c: '1', d: 'i' })];
{
  const r = info.sheets = {};
  r.mid = await frame(CHAIN, 1, 0, 'sh1', { sheets: true });
  r.alone = await frame([ROOT], 1, 0, 'sh0', { sheets: true });
  ok('All sheets, T = w₁, plane z: its own relief', !r.mid.carry, r.mid.carry);
  r.d = diff('sh1', 'sh0');
  ok('All sheets, T = w₁, plane z: the sheets of √, as on the chain √ alone', !!r.d && r.d.max === 0, r.d);
  r.past = await frame([...CHAIN, step('mobius', { a: '0', b: '1', c: '1', d: '0' })], 2, 3, 'sh3', { sheets: true, height: 'log' });
  const c = r.past.carry;
  ok('All sheets, T = w₂, plane w₃: a carried frame from z with the sheets', !!c && c.s === 0 && c.sheets === true && !!c.hmap && c.hmap.a === 0 && c.hmap.b === 2, c);
}
// the refined frame is the first rest frame, at the pane heights of the CI's and of a few others (the spike's edge
// crosses a pixel centre at some of them): with the colour kept to a disc far from the pole (Inside regions, plain
// paper elsewhere), plane z's own relief with T = w₂
for (const dh of [0, -17, -7, -2, 3, 11, 20]) {
  await view(1440, 900 + dh, false, false);
  const ns2 = 'landsheetshb' + Date.now();
  await loadView('steps', ns2, { shapes: [{ id: 'd1', kind: 'disc', c: [7, 5], r: 0.4, ci: 0, visible: true }], steps: CHAIN, sheets: true });
  await go(`http://localhost:${PORT}/test.html?ns=${ns2}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'in', surf: 'land', T: 2, go: 0, now: true }); 1`);
  await rest(0);
  ok(`bare (pane ${900 + dh}), T = w₂: the own relief is still`, await grab('bare2'), null);
  // (the frame settled() returned on is the refined one: the pane draws no other frame afterwards. An app that reported
  // settled with its refinement still to come draws one, and its pixels differ from the first's. The wait is for that
  // event, the pane's next draw, and ends at 3 s without one)
  const t0 = await ev('__cmwPaneStatus("L").t');
  info['redraw' + dh] = await ev(`new Promise((res) => { const end = performance.now() + 3000; const f = () => { const s = __cmwPaneStatus('L'); if (s && s.t !== ${t0}) res(true); else if (performance.now() > end) res(false); else setTimeout(f, 50); }; f(); })`);
  await settled({ max: 60000 }); await ev(rAF2);
  ok(`bare (pane ${900 + dh}), T = w₂: the pane drew no other frame after settled()`, info['redraw' + dh] === false, info['redraw' + dh]);
  ok(`bare (pane ${900 + dh}), T = w₂: a later frame is still`, await grab('bare2late'), null);
  const late = info['late' + dh] = await compare('bare2', 'bare2late', { x: [0.28, 0.62], y: [0.2, 0.6] });
  ok(`bare (pane ${900 + dh}): the first rest frame is the later frame (none of the window apart)`, !!late && late.frac === 0, late);
}
return { pass: fails.length === 0, fails, info };
