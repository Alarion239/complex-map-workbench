// Shapes in the planes of the chain (#253, option B: forward only): with step 2 focused X shows w₁, and a disc drawn
// there is a shape of stage 1; Y (w₂) shows its image, the whole chain's Y (w₃) too, the z-plane does not; one Undo
// takes it away; removing the step before it moves it back to that step's input plane; a saved stage loads, one past
// the chain does not.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/stage_shapes_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
async function openApp(st) {
  const ns = 'stg' + Date.now();
  await view(1440, 900, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = Object.assign({ v3: true, v4: true, v5: true, v6: true, nextId: 50, rightMode: 'image' }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}` }); await sleep(2300);
  await settle(800);
}
// a hash of a pane's canvas pixels (a screenshot of it)
const picture = async (id) => {
  const r = await ev(`(() => { const c = document.getElementById('${id}').getBoundingClientRect(); return { x: c.left, y: c.top, width: c.width, height: c.height }; })()`);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 1 }, r) });
  let h = 2166136261;
  for (let i = 0; i < s.data.length; i++) h = Math.imul(h ^ s.data.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
};
const shapes = async () => (await ev('__cmwP()')).shapes.map((s) => ({ id: s.id, kind: s.kind, stage: s.stage }));
const focusOf = async () => (await ev('__cmwState()')).focus || 0;
const steps = [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '1' }, on: true }, { type: 'pown', params: { n: 2 }, on: true }];
const base = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps };

// ---- draw a disc in w₁ (step 2 focused: X shows w₁, Y w₂)
await openApp(Object.assign({ focus: 2 }, base));
const r0 = await picture('canvasR');
await ev(`document.querySelector('.tool[data-tool="disc"]').click(); 1`); await settle(300);
ok('a drawing tool keeps the focused step (X stays w₁)', (await focusOf()) === 2, await focusOf());
const L = await ev(`(() => { const c = document.getElementById('canvasL').getBoundingClientRect(); return [c.left, c.top, c.width, c.height]; })()`);
const x0 = L[0] + L[2] * 0.62, y0 = L[1] + L[3] * 0.42;
await drag(x0, y0, x0 + 45, y0, 12, 16); await settle(900);
let sh = await shapes();
const drawn = sh.find((s) => s.id !== 's1');
ok('the disc drawn in w₁ is a shape of stage 1', !!drawn && drawn.kind === 'disc' && drawn.stage === 1, sh);
ok('Y (w₂) shows its image', (await picture('canvasR')) !== r0, null);
info.list = await ev(`[...document.querySelectorAll('#shapeList .shapes-sub')].map((e) => e.textContent)`);
ok('the Shapes list puts it under its plane', info.list.some((t) => /plane w/.test(t) || /w₁/.test(t)), info.list);
// ---- the whole chain: Y (w₃) shows it, X (the z-plane) does not
await ev(`document.getElementById('undoBtn').click()`); await settle(900);
ok('one Undo takes it away', (await shapes()).length === 1, await shapes());
const focusAfterUndo = await focusOf();
await ev(`document.getElementById('redoBtn').click()`); await settle(900);
ok('Redo brings it back, in w₁', (await shapes()).some((s) => s.stage === 1), await shapes());
info.focusAfterUndo = focusAfterUndo;
await ev(`__cmwSet('focus', 0)`); await settle(900);
const zWith = await picture('canvasL'), yWith = await picture('canvasR');
await ev(`document.getElementById('undoBtn').click()`); await settle(900);
await ev(`__cmwSet('focus', 0)`); await settle(900);
const zWithout = await picture('canvasL'), yWithout = await picture('canvasR');
ok('the z-plane does not show a shape of w₁', zWith === zWithout, [zWith, zWithout]);
ok('the whole chain\'s Y (w₃) shows its image', yWith !== yWithout, [yWith, yWithout]);

// ---- the steps change: the shape follows its plane; a saved stage loads
await openApp(Object.assign({ focus: 2 }, base, { shapes: base.shapes.concat([{ id: 's2', kind: 'disc', c: [0.3, 0.2], r: 0.1, ci: 1, visible: true, stage: 1 }]) }));
ok('a saved stage loads', (await shapes()).find((s) => s.id === 's2').stage === 1, await shapes());
await ev(`document.querySelector('#pipeline .card[data-k="1"] .more').click()`); await settle(300);
info.menu = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .mi')].find((e) => e.querySelector('.mi-label').textContent === 'Remove'); if (!b) return [...document.querySelectorAll('#popHost .mi .mi-label')].map((e) => e.textContent); b.click(); return true; })()`);
await settle(900);
ok('removing f₁ moves the shape of w₁ to f₁\'s input plane, the z-plane', info.menu === true && !(await shapes()).find((s) => s.id === 's2').stage, [info.menu, await shapes()]);
await ev(`document.getElementById('undoBtn').click()`); await settle(900);
ok('Undo puts it back in w₁', (await shapes()).find((s) => s.id === 's2').stage === 1, await shapes());
await openApp(Object.assign({ focus: 0 }, base, { shapes: base.shapes.concat([{ id: 's2', kind: 'disc', c: [0.3, 0.2], r: 0.1, ci: 1, visible: true, stage: 9 }]) }));
ok('a stage past the chain is dropped (the shape is the z-plane\'s)', !(await shapes()).find((s) => s.id === 's2').stage, await shapes());
await grab();
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
