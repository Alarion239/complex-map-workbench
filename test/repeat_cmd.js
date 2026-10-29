// Repeat × N (issue #6, part B): a card's ⋯ → Repeat sets a block to run twice; the bracket under its cards holds N
// (typed, or a shared number's name: its slider runs the passes), and its × ends it; a new N is the same GPU program;
// one Undo per edit; an insert inside the block widens it, removing its last step hands the repeat to the step before,
// a duplicate of that step carries none; F's guarantees follow (degree d^N); an example keeps its repeats.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/repeat_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
async function openApp(st) {
  const ns = 'rep' + Date.now();
  await view(1366, 768, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}` }); await sleep(2300);
  await settle(600);
}
const chain = async () => (await ev('__cmwP()')).steps.map((s) => s.type + (s.repeat ? `[${s.repeat.n}/${s.repeat.len}]` : '')).join(',');
const menu = async (k, ...labels) => {
  await ev(`document.querySelector('#pipeline .card[data-k="${k}"] .more').click()`); await settle(300);
  for (const l of labels) {
    const r = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .mi')].find((e) => e.querySelector('.mi-label').textContent === ${JSON.stringify(l)}); if (!b) return [...document.querySelectorAll('#popHost .mi .mi-label')].map((e) => e.textContent); b.click(); return true; })()`);
    if (r !== true) return r;
    await settle(300);
  }
  return true;
};
const typeN = (v) => ev(`(() => { const c = document.querySelector('#pipeline .rep-bracket .rep-n'); c.value = ${JSON.stringify(v)}; c.dispatchEvent(new Event('input')); c.dispatchEvent(new Event('change')); })()`);
const fDeg = () => ev(`(() => { const f = document.querySelector('#pipeline .ftile'); return f ? f.textContent.replace(/\\s+/g, ' ') : null; })()`);

await openApp({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '0.2+0.1i' }, on: true }] });
let r = await menu(2, 'Repeat', 'f₁–f₂, twice');
ok('⋯ → Repeat → f₁–f₂, twice', r === true, r);
await settle(700);
ok('the repeat is on f₂: twice, two steps', (await chain()) === 'pown,add[2/2]', await chain());
const chip = await ev(`(() => { const c = document.querySelector('#pipeline .rep-bracket .rep-n'), L = document.querySelector('#pipeline .rep-bracket .rep-line'), a = document.querySelector('#pipeline .card[data-k="1"]'), b = document.querySelector('#pipeline .card[data-k="2"]');
  return c ? { v: c.value, label: c.getAttribute('aria-label'), focused: document.activeElement === c, spans: L.offsetLeft >= a.offsetLeft && L.offsetLeft + L.offsetWidth <= b.offsetLeft + b.offsetWidth && L.offsetWidth > b.offsetWidth } : null; })()`);
ok('the bracket spans f₁–f₂; its chip shows 2, is named and has the keyboard', chip && chip.v === '2' && chip.label === 'Repeat f₁–f₂: times' && chip.focused && chip.spans, chip);
info.F2 = await fDeg();
ok('F: a polynomial of degree 4 (z² + c twice)', /deg 4(?!\d)/.test(info.F2 || ''), info.F2);
const glKey = async () => (await ev('__cmwZp()')).glKey;
const key2 = await glKey();
await typeN('3'); await settle(700);
ok('N = 3: F of degree 8', (await chain()) === 'pown,add[3/2]' && /deg 8(?!\d)/.test(await fDeg()), [await chain(), await fDeg()]);
ok('a new N is the same GPU program (N is a uniform)', !!key2 && (await glKey()) === key2, [key2, await glKey()]);
await typeN('99'); await settle(500);
ok('N past 64 is not taken', (await chain()) === 'pown,add[3/2]', await chain());
await ev(`document.getElementById('undoBtn').click()`); await settle(700);
ok('one Undo: twice again', (await chain()) === 'pown,add[2/2]', await chain());
r = await menu(1, 'Insert a function after it');
await ev(`(() => { const i = document.getElementById('palInput'); i.value = 'sin z'; i.dispatchEvent(new Event('input')); })()`); await settle(400);
await key('Enter'); await settle(900);
ok('a step inserted inside the block widens it', (await chain()) === 'pown,sin,add[2/3]', await chain());
r = await menu(3, 'Remove'); await settle(900);
ok('removing the block\'s last step hands the repeat to the step before', (await chain()) === 'pown,sin[2/2]', await chain());
r = await menu(2, 'Duplicate'); await settle(900);
ok('a duplicate of the last step carries no repeat', (await chain()) === 'pown,sin[2/2],sin', await chain());
r = await menu(3, 'Repeat');
ok('a step after the block offers itself only (blocks never overlap)', r === true && (await ev(`[...document.querySelectorAll('#popHost .mi .mi-label')].map((e) => e.textContent).join('|')`)) === 'This step, twice', await ev(`[...document.querySelectorAll('#popHost .mi .mi-label')].map((e) => e.textContent).join('|')`));
await key('Escape'); await settle(250);
await ev(`document.querySelector('#pipeline .rep-bracket .rep-off').click()`); await settle(700);
ok('the chip\'s × ends the repeat', (await chain()) === 'pown,sin,sin' && !(await ev(`!!document.querySelector('#pipeline .rep-bracket:not([hidden])')`)), await chain());
// written another way (by its zeros and poles): the same function, so the repeat stays (lint review of #192)
await openApp({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'poly', params: { co: '1, 0, -1' }, on: true, repeat: { n: 3, len: 1 } }] });
const d0 = await fDeg();
r = await menu(1, 'Write by zeros and poles'); await settle(900);
ok('Write by zeros and poles keeps the repeat and F (degree 8)', (await chain()) === 'zp[3/1]' && /deg 8(?!\d)/.test(await fDeg()) && /deg 8(?!\d)/.test(d0 || ''), [r, await chain(), d0, await fDeg()]);
// an example keeps its steps' repeats: Newton's method is its map twenty times (#6)
const exAt = (name) => ev(`(() => { for (let i = 0; i < 60; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && l.textContent.includes(${JSON.stringify(name)})) return i; } return -2; })()`);
info.newton = await exAt('Newton'); await settle(1500);
ok('the Newton example: one step, repeated twenty times', (await chain()) === 'custom[20/1]' && !!(await ev(`!!document.querySelector('#pipeline .rep-bracket:not([hidden]) .rep-n')`)), [info.newton, await chain()]);
info.julia = await exAt('z² + i'); await settle(1500);
ok('the z² + i example draws its escape-time curve', (await chain()) === 'pown,add' && (await ev(`__cmwP().shapes.map((s) => s.kind).join()`)) === 'fcurve', [info.julia, await chain()]);
// N bound to a shared number: its name in the chip; its slider runs the passes, one program; a typed N unbinds it
await openApp({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], params: [{ name: 'k', value: 3, min: 1, max: 10, step: 1 }], v5: true, v6: true,
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '0.2+0.1i' }, on: true, repeat: { n: 2, len: 2 } }] });
const kb0 = await glKey();
await typeN('k'); await settle(800);
info.bound = await ev('__cmwP().steps[1].repeat');
ok('typing a number\'s name binds N to it: k = 3, F of degree 8', info.bound && info.bound.by === 'k' && /deg 8(?!\d)/.test(await fDeg()), [info.bound, await fDeg()]);
await ev(`Params.set('k', 5)`); await settle(800);
ok('its slider runs the passes: k = 5, degree 32, the same GPU program', /deg 32(?!\d)/.test(await fDeg()) && (await glKey()) === kb0, [await fDeg(), kb0, await glKey()]);
await ev(`Params.set('k', 2.6)`); await settle(800);
ok('a value between whole numbers rounds: k = 2.6 runs 3 passes', /deg 8(?!\d)/.test(await fDeg()), await fDeg());
await ev(`Params.rename('k', 'm')`); await settle(800);
ok('renaming the number renames the binding', (await ev('__cmwP().steps[1].repeat.by')) === 'm' && /deg 8(?!\d)/.test(await fDeg()), [await ev('__cmwP().steps[1].repeat'), await fDeg()]);
await typeN('4'); await settle(800);
info.unbound = await ev('__cmwP().steps[1].repeat');
ok('a typed N unbinds it', info.unbound && !info.unbound.by && info.unbound.n === 4 && /deg 16(?!\d)/.test(await fDeg()), [info.unbound, await fDeg()]);
await grab();
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
