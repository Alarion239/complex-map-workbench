// The steps view's Landscape stays 3D on every plane (#846, ux's rule on it): before, at and past the colour plane T,
// at rest and in every frame between two planes. The default page (z, exp, Möbius) on the Landscape with T = w₁, so
// plane w₂ is past it, and with T = w₂ (the default):
// - at rest on each plane: the Landscape is the view, its Height key is shown, the camera's pitch is the user's, and
//   the probe finds the point under the pane's centre;
// - held at u = 0.25, 0.5, 0.75 between each two planes: carried frames (__cmwLandCarry), the Landscape and its Height
//   key still on, the pitch unchanged;
// - held by either end of each glide (a scrub on the rail, not let go, at u = 0.001 and 0.999; the difference from the rest frame grows with u, as the points move): the plane at rest
//   there, within the exact-image tolerance (at most 2 % of the pane's pixels more than 32/255 apart: the rest frame's
//   refined walls and cut rims are not drawn while moving);
// - past T the carried points keep T's colour: plane w₂'s frame at rest is the points of w₁ carried (s = 1, u = 1).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const grab = (tag) => ev(`(() => { const cv = document.getElementById('canvasL'); window.__ss = window.__ss || {}; window.__ss[${JSON.stringify(tag)}] = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; return [cv.width, cv.height]; })()`);
const diff = (a, b) => ev(`(() => { const A = window.__ss[${JSON.stringify(a)}], B = window.__ss[${JSON.stringify(b)}]; if (!A || !B || A.length !== B.length) return null; let n = 0, n32 = 0; for (let i = 0; i < A.length; i += 4) { n++; const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d > 32) n32++; } return +(n32 / n).toFixed(4); })()`);
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
// what the frame shows: the view, the Height key (shown, and named so) and the camera's pitch
const state = async () => JSON.parse(await ev(`JSON.stringify((() => {
  const l = document.getElementById('leftLegend'), st = __cmwSteps();
  const name = l ? [l.title, l.getAttribute('aria-label'), l.textContent].join(' ') : '';
  const r = document.getElementById('canvasL').getBoundingClientRect(), pk = __cmwSound({ pick: [r.left + r.width / 2, r.top + r.height / 2] });
  return { main: st.main, key: !!l && !l.hidden && /Height key/.test(name), pitch: __cmwCam('L').pitch, pick: pk, carry: typeof __cmwLandCarry === 'function' ? __cmwLandCarry() : null };
})())`));
async function hold(x) {
  await ev(`(() => {
    const rail = document.querySelector('.sv-rail'), ns = [...document.querySelectorAll('.sv-track .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const i = Math.floor(${x}), cx = ns[i][0] + (ns[i + 1][0] - ns[i][0]) * (${x} - i), cy = ns[0][1];
    const ev = (type, px) => rail.dispatchEvent(new PointerEvent(type, { pointerId: 73, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, bubbles: true, clientX: px, clientY: cy }));
    const s = ns[i][0];
    ev('pointerdown', s - 2); ev('pointermove', s + 10); ev('pointermove', cx);
    window.__svScrubUp = () => ev('pointerup', cx);
    return 1;
  })()`);
  await settled({ max: 60000, until: `Math.abs(__cmwSvX() - ${x}) < 0.002 && __cmwSteps().moving` });
  await ev(rAF2);
}
await go(`http://localhost:${PORT}/test.html?view=steps&ns=land3d${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
await settled({ max: 60000 });
const planes = await ev('__cmwSteps().planes');
ok('the default page has three planes', Array.isArray(planes) && planes.length === 3, planes);
info.runs = {};
for (const T of [1, 2]) {
  const r = info.runs['T' + T] = { rest: {}, held: {}, ends: {} };
  await ev(`__cmwSteps({ T: ${T} }); 1`);
  await rest(0);
  const pitch0 = (await state()).pitch;
  for (const i of [0, 1, 2]) {
    await rest(i);
    const s = await state();
    await grab(`T${T}r${i}`);
    r.rest[i] = s;
    ok(`T = ${T}, plane ${i} at rest: the Landscape`, s.main === 'land', s);
    ok(`T = ${T}, plane ${i} at rest: the Height key`, s.key, s);
    ok(`T = ${T}, plane ${i} at rest: the user's pitch`, Math.abs(s.pitch - pitch0) < 1e-9, s);
    ok(`T = ${T}, plane ${i} at rest: the probe finds the point under the pane's centre`, Array.isArray(s.pick) && s.pick.every(Number.isFinite), s);
  }
  ok(`T = ${T}: plane w₂ at rest`, T === 2 ? !r.rest[2].carry : !!r.rest[2].carry && r.rest[2].carry.s === 1 && r.rest[2].carry.u === 1, r.rest[2].carry);
  for (const j of [0, 1]) {
    for (const f of [0.25, 0.5, 0.75]) {
      await rest(j);
      await park(j + f);
      const s = await state();
      r.held[j + f] = s;
      ok(`T = ${T}, held at ${j + f}: a carried frame from plane ${Math.min(j, T)}`, !!s.carry && s.carry.s === Math.min(j, T) && Math.abs(s.carry.u - f) < 1e-6, s.carry);
      ok(`T = ${T}, held at ${j + f}: the Landscape`, s.main === 'land', s);
      ok(`T = ${T}, held at ${j + f}: the Height key`, s.key, s);
      ok(`T = ${T}, held at ${j + f}: the user's pitch`, Math.abs(s.pitch - pitch0) < 1e-9, s);
    }
    for (const [f, end] of [[0.001, j], [0.999, j + 1]]) {
      await rest(j);
      await hold(j + f);
      const s = await state();
      await grab(`T${T}h${j + f}`);
      const d = await diff(`T${T}h${j + f}`, `T${T}r${end}`);
      r.ends[j + f] = { u: s.carry ? s.carry.u : null, d, key: s.key };
      await ev('window.__svScrubUp(), 1');
      await settled({ max: 60000 });
      ok(`T = ${T}, held at ${j + f}: a carried frame`, !!s.carry && Math.abs(s.carry.u - f) < 0.002, s.carry);
      ok(`T = ${T}, held at ${j + f}: the Height key`, s.key, s);
      ok(`T = ${T}, held at ${j + f}: plane ${end} at rest there (≤ 2 % of pixels > 32/255)`, d != null && d <= 0.02, r.ends[j + f]);
    }
  }
}
return { pass: fails.length === 0, fails, info };
