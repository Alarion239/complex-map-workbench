// Repeat × N in the steps view (behind ?view=steps), the engine's cases through its own controls: a chip's ⋯ → Repeat, the
// Inspector's Repeat row (N, a shared number's name, End the repeat) and F's guarantees in the Inspector:
// - ⋯ → Repeat → "f₁–f₂, twice" sets the block, N = 2, the keyboard in the row's N field; F is a polynomial of degree d^N;
// - a new N is the same GPU program; N past 64 is not taken; one Undo undoes one edit;
// - an insert inside the block widens it, removing its last step hands the repeat to the step before, a duplicate of that
//   step carries none, and a step after the block offers a repeat of itself only (blocks never overlap);
// - Write by zeros and poles keeps the repeat and F; an example keeps its repeats (Newton: twenty passes);
// - N bound to a shared number: typing its name binds it, the number's slider runs the passes (one program), a value
//   between whole numbers rounds, renaming renames the binding, a typed N unbinds it.
// The row's looks, keys, badge and phone sheet are steps_repeat_cmd's. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {}, errs = [];
const ok = (name, pass, got) => { if (!pass) fails.push({ name, got }); };
const labelsOf = () => ev(`[...document.querySelectorAll('#popHost .menu .mi .mi-label')].map((e) => e.textContent)`);
const { press, pickItem, typeN, chain } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'repeat_kit.js'), 'utf8'))({ ev, settled });
const open = async (st) => {
  await view(1366, 768, false, false);
  await loadView('steps', 'svrep' + Date.now(), Object.assign({ v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1, visible: true }], steps: [], nextId: 50, focus: 0 }, st), { lang: 'en' });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip')` });
};
// (the chip's ⋯ menu; a menu is not raised again within 500 ms of the last)
const chipMenu = async (k, ...path) => {
  await settled({ floor: 600 });
  await press(`#svStrip .sv-step[data-k="${k}"] .sv-more`);
  await settled({ panes: false, until: `!!document.querySelector('#popHost .menu')` });
  for (const l of path) {
    const got = await pickItem(l);
    if (!got) return false;
    await settled({ panes: false, floor: 200 });
  }
  return true;
};
const selectStep = async (k) => {
  await press(`#svStrip .sv-step[data-k="${k}"] .sv-fchip`);
  await settled({ until: `__cmwSteps().sel === ${k}` });
};
// F's guarantees in the Inspector: the polynomial's degree
const fDeg = async () => {
  await press('#svStrip .sv-wholemap');
  await settled({ until: `__cmwSteps().sel === 'F'` });
  const t = await ev(`document.getElementById('propsPanel').textContent`);
  const m = /Polynomial\s*deg\s*(\d+)(?!\d)/.exec(t);
  return m ? +m[1] : null;
};
const glKey = async () => (await ev('__cmwZp()')).glKey;
const rowN = () => ev(`(() => { const f = document.querySelector('.insp-repeat .rep-n'); return f && !f.closest('[hidden]') && f.getClientRects().length ? { v: f.value, label: f.getAttribute('aria-label'), focus: document.activeElement === f } : null; })()`);

await open({ steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '0.2+0.1i' }, on: true }] });
ok('the page is the steps view', await isSteps(), null);
ok('⋯ → Repeat → f₁–f₂, twice', await chipMenu(2, 'Repeat', 'f₁–f₂, twice'), await labelsOf());
await settled({ until: `!!document.querySelector('.insp-repeat .rep-n')` });
ok('the repeat is on f₂: twice, two steps', (await chain()) === 'pown,add[2/2]', await chain());
const r0 = await rowN();
ok('the Inspector row names f₁–f₂, shows 2 and has the keyboard', r0 && r0.v === '2' && r0.label === 'Repeat f₁–f₂: times' && r0.focus, r0);
info.deg2 = await fDeg();
ok('F: a polynomial of degree 4 (z² + c twice)', info.deg2 === 4, info.deg2);
await selectStep(2);
const key2 = await glKey();
await typeN('3');
ok('N = 3: F of degree 8', (await chain()) === 'pown,add[3/2]' && (await fDeg()) === 8, [await chain(), info.deg2]);
ok('a new N is the same GPU program (N is a uniform)', !!key2 && (await glKey()) === key2, [key2, await glKey()]);
await selectStep(2);
await typeN('99');
ok('N past 64 is not taken', (await chain()) === 'pown,add[3/2]', await chain());
await press('#undoBtn'); await settled({});
ok('one Undo: twice again', (await chain()) === 'pown,add[2/2]', await chain());

// the chain edited inside and after the block
ok('step 1\'s ⋯ → Insert a function after it', await chipMenu(1, 'Insert a function after it'), await labelsOf());
await settled({ panes: false, until: `!!document.getElementById('palInput')` });
await ev(`(() => { const i = document.getElementById('palInput'); i.value = 'sin z'; i.dispatchEvent(new Event('input')); })()`);
await settled({ panes: false, floor: 300 });
await key('Enter');
await settled({ until: `__cmwP().steps.length === 3` });
ok('a step inserted inside the block widens it', (await chain()) === 'pown,sin,add[2/3]', await chain());
ok('step 3\'s ⋯ → Remove', await chipMenu(3, 'Remove'), await labelsOf());
await settled({ until: `__cmwP().steps.length === 2` });
ok('removing the block\'s last step hands the repeat to the step before', (await chain()) === 'pown,sin[2/2]', await chain());
ok('step 2\'s ⋯ → Duplicate', await chipMenu(2, 'Duplicate'), await labelsOf());
await settled({ until: `__cmwP().steps.length === 3` });
ok('a duplicate of the last step carries no repeat', (await chain()) === 'pown,sin[2/2],sin', await chain());
// (a step after the block: one choice, so "Repeat…" is one item and acts at once: a repeat of that step alone)
await settled({ floor: 600 });
await press('#svStrip .sv-step[data-k="3"] .sv-more');
await settled({ panes: false, until: `!!document.querySelector('#popHost .menu')` });
const after = await labelsOf();
ok('a step after the block offers itself only: Repeat… as one item, no submenu, no End', after.includes('Repeat…') && !after.includes('Repeat') && !after.includes('End the repeat'), after);
await pickItem('Repeat…');
await settled({ until: `!!__cmwP().steps[2].repeat` });
ok('… and it repeats that step alone, the block before it kept', (await chain()) === 'pown,sin[2/2],sin[2/1]', await chain());
await press('#undoBtn'); await settled({});
ok('Undo takes it back', (await chain()) === 'pown,sin[2/2],sin', await chain());
ok('End the repeat from the block\'s chip menu', await chipMenu(2, 'End the repeat'), await labelsOf());
await settled({ until: `!__cmwP().steps[1].repeat` });
ok('the block is ended', (await chain()) === 'pown,sin,sin', await chain());

// written another way (by its zeros and poles): the same function, so the repeat stays
await open({ steps: [{ type: 'poly', params: { co: '1, 0, -1' }, on: true, repeat: { n: 3, len: 1 } }] });
const d0 = await fDeg();
ok('before: F is a polynomial of degree 8', d0 === 8, d0);
ok('⋯ → Write by zeros and poles', await chipMenu(1, 'Write by zeros and poles'), await labelsOf());
await settled({ until: `__cmwP().steps[0].type === 'zp'` });
ok('Write by zeros and poles keeps the repeat and F (degree 8)', (await chain()) === 'zp[3/1]' && (await fDeg()) === 8, [await chain(), await fDeg()]);

// an example keeps its steps' repeats: Newton's method is its map twenty times
const exAt = (name) => ev(`(() => { for (let i = 0; i < 60; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && l.textContent.includes(${JSON.stringify(name)})) return i; } return -2; })()`);
info.newton = await exAt('Newton');
await settled({ max: 20000, until: `__cmwP().steps.length === 1 && !!__cmwP().steps[0].repeat` });
ok('the Newton example: one step, repeated twenty times, ×20 on its chip', (await chain()) === 'custom[20/1]' && (await ev(`document.querySelector('#svStrip .sv-step[data-k="1"] .sv-rep').textContent`)) === '×20', [info.newton, await chain()]);
info.julia = await exAt('z² + i');
await settled({ max: 20000, until: `__cmwP().steps.length === 2` });
ok('the z² + i example draws its escape-time curve', (await chain()) === 'pown,add' && (await ev(`__cmwP().shapes.map((s) => s.kind).join()`)) === 'fcurve', [info.julia, await chain()]);

// N bound to a shared number
await open({ params: [{ name: 'k', value: 3, min: 1, max: 10, step: 1 }], steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '0.2+0.1i' }, on: true, repeat: { n: 2, len: 2 } }] });
await selectStep(2);
const kb0 = await glKey();
await typeN('k');
const bound = await ev('__cmwP().steps[1].repeat');
ok('typing a number\'s name binds N to it: k = 3, F of degree 8', bound && bound.by === 'k' && (await fDeg()) === 8, bound);
await ev(`Params.set('k', 5)`); await settled({});
ok('its slider runs the passes: k = 5, degree 32, the same GPU program', (await fDeg()) === 32 && (await glKey()) === kb0, [await glKey(), kb0]);
await ev(`Params.set('k', 2.6)`); await settled({});
ok('a value between whole numbers rounds: k = 2.6 runs 3 passes (degree 8)', (await fDeg()) === 8, null);
await ev(`Params.rename('k', 'm')`); await settled({});
ok('renaming the number renames the binding', (await ev('__cmwP().steps[1].repeat.by')) === 'm' && (await fDeg()) === 8, await ev('__cmwP().steps[1].repeat'));
await selectStep(2);
await typeN('4');
const unb = await ev('__cmwP().steps[1].repeat');
ok('a typed N unbinds it: N = 4, degree 16', unb && !unb.by && unb.n === 4 && (await fDeg()) === 16, unb);

errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')));
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
