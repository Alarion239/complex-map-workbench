// The steps view's Landscape stays 3D on every plane: before, at and past the colour plane T,
// at rest and in every frame between two planes. The default page (z, exp, Möbius) on the Landscape with T = w₁, so
// plane w₂ is past it, and with T = w₂ (the default):
// - at rest on each plane: the Landscape is the view, its Height key is shown, the camera's pitch is the user's, and
//   the probe finds the point under the pane's centre;
// - held at u = 0.25, 0.5, 0.75 between each two planes: carried frames (__cmwLandCarry), the Landscape and its Height
//   key still on, the pitch unchanged;
// - held by either end of each glide (a scrub on the rail, not let go, at u = 0.001 and 0.999; the difference from the rest frame grows with u, as the points move): the plane at rest
//   there, within the exact-image tolerance (at most 2 % of the pane's pixels more than 32/255 apart: the rest frame's
//   refined walls and cut rims are not drawn while moving);
// - past T the carried points keep T's colour: plane w₂'s frame at rest is the points of w₁ carried (s = 1, u = 1);
// - the title names the height, h(F) on every plane ("landscape of log|F|", and "|F|", "Re F", "Im F" as the Height
//   select reads), then past T the carried colour (", colour carried from w₁"); the floor's axes name the plane drawn
//   (Re w₁, Im w₁ on w₁), and in a held frame the plane nearer the thread.
// - a chain with a d/dz step (z², d/dz, exp), with T = w₁: planes w₂ and w₃ past T are coloured from T through the z
//   points they share with it, as their 2D pictures are: at rest each is plane z's points carried (s = 0), titled
//   ", colour carried from w₁"; the glides w₁ → w₂ across the d/dz and w₂ → w₃ carry plane z's points continuously
//   (held at 1.25, 1.75, 2.5: s = 0, u the glide's, coloured), and held by either end of the d/dz glide the frame is that
//   plane at rest. On w₃, which exp(2z) reaches from many z points at one height, the frame shows the point the 2D
//   picture shows (its sheet key), with no fighting: no more speckled than w₂, and steady under a small camera turn.
//   A plane's Landscape is plain exactly where its 2D picture has no colour (shapes only): with T = w₃,
//   plane w₁, before T across the d/dz, is plain, plane z's points at w₁'s heights.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const { hold, grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const rest = async (i) => { await ev(`window.__drawn = []; __cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`window.__drawn = []; __cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
// what the frame shows: the view, the Height key (shown, and named so) and the camera's pitch
const state = async () => JSON.parse(await ev(`JSON.stringify((() => {
  const l = document.getElementById('leftLegend'), st = __cmwSteps();
  const name = l ? [l.title, l.getAttribute('aria-label'), l.textContent].join(' ') : '';
  const r = document.getElementById('canvasL').getBoundingClientRect(), pk = __cmwSound({ pick: [r.left + r.width / 2, r.top + r.height / 2] });
  const d = window.__drawn || [], axes = d.flatMap((t, i) => (/^(Re|Im) $/.test(t) && d[i + 1] ? [t + d[i + 1]] : []));
  return { title: (document.querySelector('.sv-title') || {}).textContent || '', axes: [...new Set(axes)], main: st.main, key: !!l && !l.hidden && /Height key/.test(name), pitch: __cmwCam('L').pitch, pick: pk, carry: typeof __cmwLandCarry === 'function' ? __cmwLandCarry() : null };
})())`));
await go(`http://localhost:${PORT}/test.html?view=steps&ns=land3d${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
// (the words the canvases draw, from the last reset: the floor's axis names)
await ev(`(() => { const f = CanvasRenderingContext2D.prototype.fillText; window.__drawn = []; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { if (this.canvas.id === 'canvasL') window.__drawn.push(String(t)); return f.call(this, t, ...a); }; return 1; })()`);
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
    const nm = i === 0 ? 'z' : `w${'₀₁₂'[i]}`, want = 'landscape of log|F|' + (i > T ? ', colour carried from w₁' : '');
    ok(`T = ${T}, plane ${i} at rest: the title names h(F)`, s.title.endsWith(want), s.title);
    ok(`T = ${T}, plane ${i} at rest: the axes name ${nm}`, s.axes.includes('Re ' + nm) && s.axes.includes('Im ' + nm) && s.axes.length === 2, s.axes);
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
      const nm = Math.round(j + f) === 0 ? 'z' : `w${'₀₁₂'[Math.round(j + f)]}`;
      ok(`T = ${T}, held at ${j + f}: the axes name ${nm}`, s.axes.includes('Re ' + nm) && s.axes.length === 2, s.axes);
      ok(`T = ${T}, held at ${j + f}: the Height key`, s.key, s);
      ok(`T = ${T}, held at ${j + f}: the user's pitch`, Math.abs(s.pitch - pitch0) < 1e-9, s);
    }
    for (const [f, end] of [[0.001, j], [0.999, j + 1]]) {
      await rest(j);
      await hold(j + f);
      await ev(rAF2);
      const s = await state();
      await grab(`T${T}h${j + f}`);
      const c = await compare(`T${T}h${j + f}`, `T${T}r${end}`), d = c && c.frac;
      r.ends[j + f] = { u: s.carry ? s.carry.u : null, d, key: s.key };
      await ev('window.__svScrubUp(), 1');
      await settled({ max: 60000 });
      ok(`T = ${T}, held at ${j + f}: a carried frame`, !!s.carry && Math.abs(s.carry.u - f) < 0.002, s.carry);
      ok(`T = ${T}, held at ${j + f}: the Height key`, s.key, s);
      ok(`T = ${T}, held at ${j + f}: plane ${end} at rest there (≤ 2 % of pixels > 32/255)`, d != null && d <= 0.02, r.ends[j + f]);
    }
  }
}
// the title follows the Height select, on a plane before T and on one past it
await ev(`__cmwSteps({ T: 1 }); 1`);
info.heights = {};
for (const [v, h] of [['abs', '|F|'], ['re', 'Re F'], ['im', 'Im F']]) {
  await ev(`(document.querySelector('#heightSeg button[data-v="${v}"]') || {}).click?.(), 1`);
  for (const i of [0, 2]) {
    await rest(i);
    const t = info.heights[v + i] = (await state()).title;
    ok(`height ${v}, plane ${i}: the title names ${h}`, t.endsWith(`landscape of ${h}` + (i > 1 ? ', colour carried from w₁' : '')), t);
  }
}
// ---- a chain with a d/dz step: the planes past it carry plane z's points in T's colour ----
{
  const ns = `land3dd${Date.now()}`, step = (type, params) => ({ type, params: params || {}, on: true });
  const st0 = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [step('pown', { n: 2 }), step('deriv'), step('exp')], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await loadView('steps', ns, st0);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 1, go: 0, now: true }); 1`);
  await settled({ max: 60000 });
  const d = info.deriv = { planes: await ev('__cmwSteps().planes'), rest: {}, held: {}, ends: {}, plane: {} };
  ok('the d/dz chain has four planes', Array.isArray(d.planes) && d.planes.length === 4, d.planes);
  for (const i of [1, 2, 3]) {
    await rest(i);
    const s = d.rest[i] = await state();
    await grab(`dr${i}`);
    ok(`d/dz chain, T = 1, plane ${i} at rest: the Landscape`, s.main === 'land' && s.key, s);
    if (i === 1) continue;
    ok(`d/dz chain, T = 1, plane ${i} at rest: plane z's points carried, coloured`, !!s.carry && s.carry.s === 0 && s.carry.u === 1 && !s.carry.plain, s.carry);
    ok(`d/dz chain, T = 1, plane ${i} at rest: the title names the carried colour`, s.title.endsWith('landscape of log|F|, colour carried from w₁'), s.title);
  }
  // no fighting on w₃ at rest: exp(2z) takes many z points to one spot of w₃ at one height, in different colours; the
  // frame shows one of them per pixel, the 2D picture's (its sheet key), so it is no more speckled than w₂'s (the share
  // of the coloured pixels with a right or lower neighbour more than 64/255 apart: at most 1.5 times w₂'s), and turning
  // the camera by 0.003 rad changes it as little as any still surface (within the 2 % tolerance)
  const speck = (tag) => ev(`(() => { const P = window.__heldPx[${JSON.stringify(tag)}], cv = document.getElementById('canvasL'), W = cv.width, H = cv.height; let n = 0, s = 0;
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const i = 4 * (y * W + x); if (Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) <= 16) continue; n++;
      let d = 0; for (const j of [i + 4, i + 4 * W]) for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(P[i + c] - P[j + c])); if (d > 64) s++; }
    return s / Math.max(n, 1); })()`);
  d.speck = { w2: await speck('dr2'), w3: await speck('dr3') };
  ok('d/dz chain, T = 1, plane 3 at rest: no more speckled than plane 2 (no fighting sheets)', d.speck.w3 <= 1.5 * d.speck.w2, d.speck);
  await rest(3);
  const yaw = JSON.parse(await ev(`JSON.stringify(__cmwCam('L'))`)).yaw;
  await ev(`__cmwCam('L', { yaw: ${yaw} + 0.003 }); 1`);
  await settled({ max: 30000 });
  await ev(rAF2);
  await grab('dr3t');
  const turned = d.turned = await compare('dr3', 'dr3t');
  await ev(`__cmwCam('L', { yaw: ${yaw} }); 1`);
  await settled({ max: 30000 });
  ok('d/dz chain, T = 1, plane 3 at rest: a camera turned by 0.003 rad changes ≤ 2 % of pixels > 32/255', !!turned && turned.frac <= 0.02, turned);
  for (const x of [1.25, 1.75, 2.5]) {
    const j = Math.floor(x);
    await rest(j);
    await park(x);
    const s = d.held[x] = await state();
    ok(`d/dz chain, T = 1, held at ${x}: plane z's points carried at u = ${x - j}, coloured`, s.main === 'land' && !!s.carry && s.carry.s === 0 && Math.abs(s.carry.u - (x - j)) < 1e-6 && !s.carry.plain, s.carry);
  }
  // held by either end of the glide across the d/dz: that plane at rest (the carry is continuous into both)
  for (const [x, end] of [[1.001, 1], [1.999, 2]]) {
    await rest(1);
    await hold(x);
    await ev(rAF2);
    const s = await state();
    await grab(`dh${x}`);
    const c = await compare(`dh${x}`, `dr${end}`), df = c && c.frac;
    d.ends[x] = { carry: s.carry, d: df };
    await ev('window.__svScrubUp(), 1');
    await settled({ max: 60000 });
    ok(`d/dz chain, T = 1, held at ${x}: a carried frame from plane z`, !!s.carry && s.carry.s === 0 && !s.carry.plain, s.carry);
    ok(`d/dz chain, T = 1, held at ${x}: plane ${end} at rest there (≤ 2 % of pixels > 32/255)`, df != null && df <= 0.02, d.ends[x]);
  }
  // the Landscape is plain exactly where the Plane surface's picture has no colour ("shapes only")
  for (const T of [1, 3]) {
    await ev(`__cmwSteps({ T: ${T} }); 1`);
    for (const i of [0, 1, 2, 3]) {
      await ev(`__cmwSteps({ surf: 'plane' }); 1`);
      await rest(i);
      const t2 = (await state()).title;
      await ev(`__cmwSteps({ surf: 'land' }); 1`);
      await rest(i);
      const s = await state(), plain = !!s.carry && s.carry.plain;
      d.plane[`T${T}p${i}`] = { t2, carry: s.carry };
      ok(`d/dz chain, T = ${T}, plane ${i}: the Landscape is plain exactly when the 2D picture is shapes only`, plain === /shapes only/.test(t2), d.plane[`T${T}p${i}`]);
    }
  }
  const s1 = d.plane.T3p1.carry;
  ok('d/dz chain, T = 3, plane 1 at rest (before T across the d/dz): plane z\'s points, plain', !!s1 && s1.s === 0 && s1.plain, s1);
}
return { pass: fails.length === 0, fails, info };
