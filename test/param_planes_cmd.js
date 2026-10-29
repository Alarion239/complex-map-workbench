// A shared number as a point in any plane (#252, option 1): a point of a later plane is shown in an earlier one by its
// preimages (the solutions of the steps between, = its place), drawn as hollow dots a₍₁₎, a₍₂₎ …, at most 4, the rest
// counted; a press on a dot drags it and the number becomes the image of where the dot is, one Undo step; while the
// number moves the dots follow it without a new search; a step between that uses the number keeps its dots still.
// "New complex number here" is offered in any plane X shows. The timing check ("timing: ...") reports the frame time of
// a drag with 8 preimages relative to a drag of the same point in its own plane (ci/browser_suites.js TIMING).
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/param_planes_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
async function openApp(st) {
  const ns = 'pp' + Date.now();
  await view(1440, 900, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = Object.assign({ v3: true, v4: true, v5: true, v6: true, nextId: 50, rightMode: 'image', focus: 0, srcView: { cx: 0, cy: 0, s: 120 } }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}` }); await sleep(2300);
  await settle(1500);
}
const pre = async () => ev(`__cmwPre('L')`);
const aVal = async () => { const p = (await ev('__cmwP()')).params.find((q) => q.name === 'a'); return p ? [p.value, p.im || 0] : null; };
const near = (z, re, im, tol = 1e-6) => !!z && Math.abs(z[0] - re) < tol && Math.abs(z[1] - im) < tol;
const has = (sols, re, im, tol) => sols.some((z) => near(z, re, im, tol));
// a pane point (re, im) on the page
const at = async (re, im) => ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`);
const pointA = (stage, re = 1, im = 0) => ({ id: 'pa', kind: 'point', p: [re, im], bind: { p: 'a' }, ci: 3, visible: true, stage });
const numA = (re = 1, im = 0) => [{ name: 'a', value: re, im, min: -2, max: 2, step: 0.01 }];
const sq = { type: 'pown', params: { n: 2 }, on: true }, plus1 = { type: 'add', params: { c: '1' }, on: true };

// ---- A: a in w₁ under w₁ = z²: its preimages in the z-plane are ±1
await openApp({ steps: [sq, plus1], params: numA(1, 0), shapes: [pointA(1)] });
await settle(800);
let P = await pre();
const e0 = P.list.find((e) => e.id === 'pa');
info.A = P.list;
ok('A the point a of w₁ has its preimages in the z-plane, z = 1 and z = −1', !!e0 && e0.sols.length === 2 && has(e0.sols, 1, 0, 1e-7) && has(e0.sols, -1, 0, 1e-7), P.list);
ok('A both are drawn as dots in X', P.hits.length === 2, P.hits);

// ---- B: dragging the dot at z = 1 to z = 1.2: a = 1.44, the other dot is −1.2; one Undo step
const n0 = (await ev('__cmwP()')).n;
await ev(`document.querySelector('.tool[data-tool="select"]').click(); 1`);
const p1 = await at(1, 0), p2 = await at(1.2, 0);
await drag(p1[0], p1[1], p2[0], p2[1], 12, 16); await settle(1200);
info.B = { a: await aVal(), pre: (await pre()).list };
ok('B dragging a preimage moves the number: a = (z at the pointer)² ≈ 1.44', !!info.B.a && Math.abs(info.B.a[0] - 1.44) < 0.03 && Math.abs(info.B.a[1]) < 0.03, info.B);
const eB = info.B.pre.find((e) => e.id === 'pa');
ok('B the other preimage follows, at −√a', !!eB && eB.sols.some((z) => Math.abs(z[0] + Math.sqrt(info.B.a[0])) < 1e-4 && Math.abs(z[1]) < 1e-4), info.B);
ok('B the drag is one Undo step', (await ev('__cmwP()')).n === n0 + 1, [n0, (await ev('__cmwP()')).n]);
await ev(`document.getElementById('undoBtn').click()`); await settle(900);
ok('B Undo brings a = 1 back', near(await aVal(), 1, 0), await aVal());

// ---- C: a slider (or any change of a) moves the dots with it: a = i → preimages ±e^{iπ/4}
await ev(`Params.set('a', { re: 0, im: 1 }, { live: true })`); await settle(200);
const eC = (await pre()).list.find((e) => e.id === 'pa');
const r2 = Math.SQRT1_2;
info.C = eC;
ok('C a change of a moves its preimages at once (followed, not searched): ±(1 + i)/√2', !!eC && has(eC.sols, r2, r2, 1e-6) && has(eC.sols, -r2, -r2, 1e-6), eC);

// ---- D: more than 4 preimages: z⁸ (a = 1 gives the 8 roots of unity): 4 drawn, "+4 more"
await openApp({ steps: [{ type: 'pown', params: { n: 8 }, on: true }], params: numA(1, 0), shapes: [pointA(1)] });
await settle(1500);
P = await pre();
const eD = P.list.find((e) => e.id === 'pa');
info.D = { n: eD && eD.sols.length, hits: P.hits.length };
ok('D z⁸: the 8 preimages are found, 4 of them drawn', !!eD && eD.sols.length === 8 && P.hits.length === 4, info.D);
// timing: frames of a drag of a in its own plane (focus 1: X is w₁) against a drag of one of its 8 preimages
const frames = async (from, to) => {
  await ev(`(() => { window.__fr = []; window.__frOn = true; let last = performance.now(); const f = (t) => { window.__fr.push(t - last); last = t; if (window.__frOn) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
  await drag(from[0], from[1], to[0], to[1], 30, 16);
  await ev('window.__frOn = false; 1');
  const fr = ((await ev('window.__fr')) || []).slice(1).sort((x, y) => x - y);
  return +(fr[Math.floor(fr.length / 2)] || 0).toFixed(1);
};
const h = P.hits[0];
const pz = await ev(`(() => { const c = document.getElementById('canvasL').getBoundingClientRect(); return [c.left + ${h.x}, c.top + ${h.y}]; })()`);
info.dragPre = await frames(pz, [pz[0] + 25, pz[1] + 10]);
await openApp({ focus: 2, steps: [{ type: 'pown', params: { n: 8 }, on: true }, plus1], params: numA(1, 0), shapes: [pointA(1)] });
await settle(1200);
const ph = await at(1, 0);
info.dragHome = await frames(ph, [ph[0] + 25, ph[1] + 10]);
ok('timing: a drag of one of 8 preimages keeps frames within 2× a drag of the point in its own plane', info.dragPre <= 2 * Math.max(16.7, info.dragHome), [info.dragPre, info.dragHome]);

// ---- E: a step between that uses a: its preimages are shown, not dragged (Q4)
await openApp({ steps: [{ type: 'custom', params: { expr: 'z^2+a' }, on: true }, plus1], params: numA(1, 0), shapes: [pointA(1)] });
await settle(1500);
P = await pre();
const eE = P.list.find((e) => e.id === 'pa');
ok('E z² + a with a in w₁: the preimages of a are drawn (z² + a = a: z = 0, twice)', !!eE && eE.sols.length >= 1 && has(eE.sols, 0, 0, 1e-4), eE);
const a0 = await aVal(), q0 = await at(0, 0), q1 = await at(0.3, 0.2);
await drag(q0[0], q0[1], q1[0], q1[1], 10, 16); await settle(600);
ok('E … and a press on one does not move a', near(await aVal(), a0[0], a0[1]), [a0, await aVal()]);

// ---- F: "New complex number here" in the plane X shows (focus 2: w₁), on a shape there
await openApp({ focus: 2, steps: [sq, plus1], shapes: [{ id: 'd1', kind: 'disc', c: [0.5, 0.5], r: 0.4, ci: 0, visible: true, stage: 1 }] });
await settle(800);
const c1 = await at(0.5, 0.5);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c1[0], y: c1[1], button: 'right', buttons: 2, clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c1[0], y: c1[1], button: 'right', buttons: 0, clickCount: 1 });
await settle(400);
info.menu = await ev(`[...document.querySelectorAll('#popHost .mi .mi-label, .pmenu .mi-label, [role=menu] [role=menuitem]')].map((e) => e.textContent)`);
const made = await ev(`(() => { const b = [...document.querySelectorAll('[role=menuitem], .mi')].find((e) => /New complex number here/.test(e.textContent)); if (!b) return false; b.click(); return true; })()`);
await settle(600);
const S6 = await ev('__cmwP()');
const np = S6.shapes.find((s) => s.kind === 'point');
ok('F "New complex number here" is offered in w₁ and makes a number and its point there', made === true && !!np && np.stage === 1 && S6.params.length === 1, { made, menu: info.menu, shapes: S6.shapes, params: S6.params });
ok('F … whose value is the place in w₁', !!np && Math.abs(S6.params[0].value - np.p[0]) < 1e-9 && Math.abs((S6.params[0].im || 0) - np.p[1]) < 1e-9, S6.params);

await grab();
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
