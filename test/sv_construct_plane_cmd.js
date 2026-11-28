// The steps view's later planes take constructions on their own objects: on plane 1 of a Möbius chain a 3-point circle
// is made from three clicks, its points and the circle belong to plane 1 (stage = 1), one Undo takes them all, the chip
// says "· on w₁" while the construction is under way, and a point of plane z carried to plane 1 (z₀′) is an input too. A finished
// shape's text counts the primes of the image points from the shape's own plane: the plane-1 circle of a three-plane chain (z², then the Möbius)
// through two plane-1 points and z₀′ reads z₀′ on each of the three planes, in en, ru and it. The same circle under (z + 1)/1 is undefined, and its
// reason names the argument that is undefined, z₀′ (not the source point z₀), on each plane.
// A command file for a CDP daemon (test/cdp_kit README).
const fails = [], info = {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// waits, in ms: the floor before a quiet page is read, how long a glide or a quiet page may take, how long the page and
// its chain may take to load, how long a pick may take to show, and the pause between moving to a pick and clicking it
// (the hover snap lands in it)
const QUIET_FLOOR = 300, QUIET_MAX = 15000, LOAD_MAX = 30000, PICK_MAX = 8000, HOVER_PAUSE = 150;
const NEW_SHAPES = 4;   // a 3-point circle and its three points
const quiet = () => settled({ floor: QUIET_FLOOR, max: QUIET_MAX, until: "window.__cmwSteps && !__cmwSteps().moving" });
const shapes = async () => (await ev('__cmwShapes()')).shapes;
const chip = async () => ev(`(() => { const e = [...document.querySelectorAll('.cm-chip')].find((x) => x.offsetParent); return e ? e.textContent : ''; })()`);
const at = async (re, im) => ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`);
await view(1200, 800, false, false);
const ns = 'svcp' + Date.now();
await go(`${BASE}/gl-helpers.html`); await sleep(350);
const o = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [{ id: 'z0', kind: 'point', p: [0.5, 0.5], ci: 0, visible: true, num: 0 }], steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }] };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
await go(`${BASE}/test.html?ns=${ns}&view=steps`);
// the app is driven once the page has loaded and the chain is in (a glide to plane 1 needs two planes), and a pick is
// read once it has landed: the stage is plane 1, and the chip counts the picks made
await settled({ max: LOAD_MAX, until: "typeof __cmwSteps === 'function' && typeof __cmwPlaneMenu === 'function' && __cmwSteps().on && __cmwSteps().planes.length > 1" });
await ev(`__cmwSteps({ go: 1, now: true }); 1`);
const onPlane1 = () => settled({ floor: QUIET_FLOOR, max: QUIET_MAX, until: "__cmwSteps().stage === 1 && !__cmwSteps().moving" });
await onPlane1();
const picked = (n) => settled({ max: PICK_MAX, until: `[...document.querySelectorAll('.cm-chip')].some((e) => !!e.offsetParent && e.textContent.includes('${n} of 3'))` });
await ev(`(() => { const b = [...document.querySelectorAll('[data-tool="circle3"]')].find((e) => e.offsetParent) || document.querySelector('[data-tool="circle3"]'); b.click(); return 1; })()`); await onPlane1();
const n0 = (await shapes()).length;
const P = [[0.35, 0.45], [0.7, -0.35], [-0.45, -0.4]];
const p0 = await at(P[0][0], P[0][1]);
await move(p0[0], p0[1]); await settled({ max: 3000, until: `[...document.querySelectorAll('.cm-chip')].some((e) => !!e.offsetParent)` });
await click(p0[0], p0[1]); await picked(2);
const c1 = await chip();
ok('a 3-point circle on plane 1: the chip names the plane while picks are under way', /on w₁/.test(c1), c1);
for (const [i, q] of P.slice(1).entries()) {
  const s = await at(q[0], q[1]); await move(s[0], s[1]); await settle(HOVER_PAUSE); await click(s[0], s[1]);
  if (i === 0) await picked(3); else await settled({ max: PICK_MAX, until: `__cmwShapes().shapes.length === ${n0 + NEW_SHAPES}` });
}
await quiet();
const S1 = await shapes(), circle = S1.find((s) => s.def && s.def.op === 'circle3');
ok('a 3-point circle on plane 1: the circle is made', !!circle && S1.length === n0 + NEW_SHAPES, S1);
ok('a 3-point circle on plane 1: it and its three points belong to plane 1', !!circle && S1.slice(n0).every((s) => s.stage === 1), S1.slice(n0));
ok('a 3-point circle on plane 1: its points are plane 1\'s own (no reference to plane z)', !!circle && circle.def.args.every((r) => { const t = S1.find((s) => s.id === r.s); return !!t && t.stage === 1; }), circle && circle.def);
const stageNow = await ev('__cmwSteps().stage');
ok('a 3-point circle on plane 1: the view stays on plane 1', stageNow === 1, stageNow);
await key('z', 4); await quiet();
ok('a 3-point circle on plane 1: one Undo takes the circle and its points', (await shapes()).length === n0, (await shapes()).length);
// a point of plane z carried to plane 1 is an input: two plane-1 points and z₀′
const carriedPt = await ev(`__cmwPlaneMenu().stage(1, 0.5, 0.5)`), carriedAt = await at(carriedPt[0], carriedPt[1]);
const pickA = await at(0.35, 0.45), pickB = await at(0.7, -0.35);
for (const s of [pickA, pickB, carriedAt]) { await move(s[0], s[1]); await settle(HOVER_PAUSE); await click(s[0], s[1]); await settle(300); }
await quiet();
const S2 = await shapes(), carriedCircle = S2.find((s) => s.def && s.def.op === 'circle3');
ok('a 3-point circle on plane 1 through a carried point: its third input is the image of z₀', !!carriedCircle && carriedCircle.stage === 1 && carriedCircle.def.args.some((r) => r.img === 'z0'), carriedCircle && carriedCircle.def);
// ---- a finished shape's text counts the primes from the shape's own plane, whichever plane is shown
for (const lang of ['en', 'ru', 'it']) {
  const ns3 = 'svcn' + lang + Date.now();
  const o3 = { v3: true, v4: true, v5: true, v6: true, nextId: 60, focus: 0, rightMode: 'image', shapes: [
    { id: 'z0', kind: 'point', p: [0.5, 0.5], ci: 0, visible: true, num: 0 },
    { id: 's50', kind: 'point', ci: 1, visible: true, p: [0.35, 0.45], stage: 1, num: 1 },
    { id: 's51', kind: 'point', ci: 1, visible: true, p: [0.7, -0.35], stage: 1, num: 2 },
    { id: 's52', kind: 'disc', ci: 1, visible: true, c: [0.2335, -0.0775], r: 0.54, def: { op: 'circle3', args: [{ s: 's50' }, { s: 's51' }, { img: 'z0' }], fill: 'in', flip: true }, stage: 1 },
    { id: 's53', kind: 'segment', ci: 1, visible: true, a: [0.35, 0.45], b: [0.2, 0.1], stage: 1, at: { a: { s: 's50' }, b: { img: 'z0' } } }],
    steps: [{ type: 'custom', params: { expr: 'z^2' }, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }] };
  await go(`${BASE}/gl-helpers.html`); await sleep(350);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns3}', ${JSON.stringify(JSON.stringify(o3))}); 1`);
  await go(`${BASE}/test.html?ns=${ns3}&view=steps&lang=${lang}`);
  await settled({ max: LOAD_MAX, until: "typeof __cmwSteps === 'function' && __cmwSteps().on && __cmwSteps().planes.length > 2" });
  for (const k of [0, 1, 2]) {
    await ev(`__cmwSteps({ go: ${k}, now: true }); 1`);
    await settled({ floor: QUIET_FLOOR, max: QUIET_MAX, until: `__cmwSteps().stage === ${k} && !__cmwSteps().moving` });
    await ev(`__cmwSelect('s52'); 1`);
    await settled({ max: PICK_MAX, until: `[...document.querySelectorAll('.cm-idef')].some((e) => !!e.offsetParent && /w₁/.test(e.textContent))` });
    const idef = await ev(`(() => { const e = [...document.querySelectorAll('.cm-idef')].find((x) => x.offsetParent); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : ''; })()`);
    ok(`a plane-1 circle through z₀′ on plane ${k} (${lang}): its text names the image z₀′, not z₀″`, /z₀′(?!′)/.test(idef) && !/z₀[″‴]/.test(idef), idef);
    // (a segment bound to z₀′: the Inspector says what it follows, its row says its ends, both from its own plane)
    await ev(`__cmwSelect('s53'); 1`);
    await settled({ max: PICK_MAX, until: `[...document.querySelectorAll('.cm-idef')].some((e) => !!e.offsetParent && /z₀/.test(e.textContent))` });
    const seg = await ev(`[...document.querySelectorAll('.cm-idef, .cm-def')].filter((e) => e.offsetParent).map((e) => e.textContent.replace(/\\s+/g, ' ').trim()).join(' | ')`);
    ok(`a segment bound to z₀′ on plane ${k} (${lang}): what it follows and its ends name z₀′, not z₀″`, /z₀′(?!′)/.test(seg) && !/z₀[″‴]/.test(seg), seg);
  }
}
// ---- an undefined argument's reason names the image point on the shape's plane (z₀′), not the source point
for (const [lang, want] of [['en', /z₀′ is undefined/], ['ru', /z₀′: не определено/], ['it', /z₀′ non è definito/]]) {
  const ns4 = 'svcu' + lang + Date.now();
  const o4 = { v3: true, v4: true, v5: true, v6: true, nextId: 60, focus: 0, rightMode: 'image', shapes: [
    { id: 'z0', kind: 'point', p: [0.5, 0.5], ci: 0, visible: true, num: 0 },
    { id: 's50', kind: 'point', ci: 1, visible: true, p: [0.35, 0.45], stage: 1, num: 1 },
    { id: 's51', kind: 'point', ci: 1, visible: true, p: [0.7, -0.35], stage: 1, num: 2 },
    { id: 's52', kind: 'disc', ci: 1, visible: true, c: [0.2335, -0.0775], r: 0.54, def: { op: 'circle3', args: [{ s: 's50' }, { s: 's51' }, { img: 'z0' }], fill: 'in', flip: true }, stage: 1 }],
    steps: [{ type: 'custom', params: { expr: 'z^2' }, on: true }, { type: 'mobius', params: { a: '1', b: '1', c: '0', d: '1' }, on: true }] };
  await go(`${BASE}/gl-helpers.html`); await sleep(350);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns4}', ${JSON.stringify(JSON.stringify(o4))}); 1`);
  await go(`${BASE}/test.html?ns=${ns4}&view=steps&lang=${lang}`);
  await settled({ max: LOAD_MAX, until: "typeof __cmwSteps === 'function' && __cmwSteps().on && __cmwSteps().planes.length > 2" });
  for (const k of [0, 1, 2]) {
    await ev(`__cmwSteps({ go: ${k}, now: true }); 1`);
    await settled({ floor: QUIET_FLOOR, max: QUIET_MAX, until: `__cmwSteps().stage === ${k} && !__cmwSteps().moving` });
    await ev(`__cmwSelect('s52'); 1`);
    await settled({ max: PICK_MAX, until: `[...document.querySelectorAll('.err-msg')].some((e) => /undefined|не определено|non è definito/.test(e.textContent))` });
    const why = await ev(`[...document.querySelectorAll('.err-msg')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()).join(' | ')`);
    ok(`a plane-1 circle through an undefined z₀′ on plane ${k} (${lang}): the reason names z₀′, not z₀`, want.test(why), why);
  }
}
// ---- when the source point itself is undefined, the reason names that point (its row is where the fix lies), not its image
{
  const ns5 = 'svcw' + Date.now();
  const o5 = { v3: true, v4: true, v5: true, v6: true, nextId: 70, focus: 0, rightMode: 'image', shapes: [
    { id: 'k1', kind: 'circle', c: [0, 0], r: 0.5, ci: 0, visible: true },
    { id: 'k2', kind: 'circle', c: [5, 0], r: 0.5, ci: 0, visible: true },
    { id: 'X', kind: 'point', p: [0, 0], ci: 0, visible: true, num: 0, def: { op: 'meet', args: [{ s: 'k1', part: 0 }, { s: 'k2', part: 0 }], index: 0 } },
    { id: 's50', kind: 'point', ci: 1, visible: true, p: [0.35, 0.45], stage: 1, num: 1 },
    { id: 's51', kind: 'point', ci: 1, visible: true, p: [0.7, -0.35], stage: 1, num: 2 },
    { id: 's52', kind: 'disc', ci: 1, visible: true, c: [0.2335, -0.0775], r: 0.54, def: { op: 'circle3', args: [{ s: 's50' }, { s: 's51' }, { img: 'X' }], fill: 'in', flip: true }, stage: 1 }],
    steps: [{ type: 'custom', params: { expr: 'z^2' }, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }] };
  await go(`${BASE}/gl-helpers.html`); await sleep(350);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns5}', ${JSON.stringify(JSON.stringify(o5))}); 1`);
  await go(`${BASE}/test.html?ns=${ns5}&view=steps`);
  await settled({ max: LOAD_MAX, until: "typeof __cmwSteps === 'function' && __cmwSteps().on && __cmwSteps().planes.length > 2" });
  await ev(`__cmwSelect('s52'); 1`);
  await settled({ max: PICK_MAX, until: `[...document.querySelectorAll('.err-msg')].some((e) => /undefined/.test(e.textContent))` });
  const whyX = await ev(`[...document.querySelectorAll('.err-msg')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()).join(' | ')`);
  ok('a circle through the image of an undefined point: the reason names the point itself, not its image', /undefined/.test(whyX) && !/[′″‴]/.test(whyX), whyX);
}
// ---- a point at ∞ whose image the map cannot give (exp at ∞): the reason names the image, not the generic "An argument is undefined"
{
  const ns6 = 'svci' + Date.now();
  const o6 = { v3: true, v4: true, v5: true, v6: true, nextId: 70, focus: 0, rightMode: 'image', shapes: [
    { id: 'k1', kind: 'line', a: [-2, 0], b: [2, 0], ci: 0, visible: true },
    { id: 'k2', kind: 'line', a: [-2, 1], b: [2, 1], ci: 0, visible: true },
    { id: 'X', kind: 'point', p: [0, 0], ci: 0, visible: true, num: 0, def: { op: 'meet', args: [{ s: 'k1', part: 0 }, { s: 'k2', part: 0 }], index: 'finite' } },
    { id: 's50', kind: 'point', ci: 1, visible: true, p: [0.35, 0.45], stage: 1, num: 1 },
    { id: 's51', kind: 'point', ci: 1, visible: true, p: [0.7, -0.35], stage: 1, num: 2 },
    { id: 's52', kind: 'disc', ci: 1, visible: true, c: [0.2335, -0.0775], r: 0.54, def: { op: 'circle3', args: [{ s: 's50' }, { s: 's51' }, { img: 'X' }], fill: 'in', flip: true }, stage: 1 }],
    steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }] };
  await go(`${BASE}/gl-helpers.html`); await sleep(350);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns6}', ${JSON.stringify(JSON.stringify(o6))}); 1`);
  await go(`${BASE}/test.html?ns=${ns6}&view=steps`);
  await settled({ max: LOAD_MAX, until: "typeof __cmwSteps === 'function' && __cmwSteps().on && __cmwSteps().planes.length > 2" });
  await ev(`__cmwSelect('s52'); 1`);
  await settled({ max: PICK_MAX, until: `[...document.querySelectorAll('.err-msg')].some((e) => /undefined/.test(e.textContent))` });
  const whyI = await ev(`[...document.querySelectorAll('.err-msg')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()).join(' | ')`);
  ok('a circle through the image of a point at ∞ that exp cannot map: the reason names the image', /′ is undefined/.test(whyI), whyI);
}
return { pass: fails.length === 0, fails, info };
