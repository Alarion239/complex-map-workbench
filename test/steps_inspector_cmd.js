// The Inspector in the steps view: "Open in the Inspector" from a chip's ⋯ edits a step (indexed coefficients, 32 px
// fields, the determinant), an edit redraws the thread, and a zero-pole step's Add zero / Add pole buttons add marks and
// × removes them, all without leaving the whole-chain view.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// (waits on the condition the next check reads, with the kit's settled: no fixed time. After an edit the thread links its programs
// again; the next click waits for that, as README names it: __cmwSteps().ready.ready)
const until = (expr, max = 8000) => settled({ until: `(${expr}) && __cmwSteps().ready.ready`, max });
const zp2 = (k) => `__cmwP().steps[1].params.${k}.split(',').length`;
const FIELD_PX = 32, ADD_PX = 36;
const ns = 'svi' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5, -0.5i', poles: '-0.8+0.75i' }, on: true }],
  nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1280, 800, false);
await load(ns, st, null, 'steps');

const cl = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); e.click(); return true; })()`);
const pick = async (label) => { const r = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .menu .mi')].find((x) => x.querySelector('.mi-label').textContent === ${JSON.stringify(label)}); if (!b || b.disabled) return false; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); b.click(); return true; })()`); return r; };
const params = (k) => ev(`__cmwP().steps[${k - 1}].params`);
const inspect = async (k) => { await cl(`#svStrip .sv-step[data-k="${k}"] .sv-more`); await until(`!!document.querySelector('#popHost .menu .mi')`); await pick('Open in the Inspector'); await settled({ until: `!!document.querySelector('#propsPanel .insp-step[data-k="${k}"]')`, max: 3000 }); };
const typeInto = (sel, text) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(text)}; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); })()`);

// the Möbius step: indexed labels, 32 px fields, the generic formula and the determinant
await inspect(1);
const ins = await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="1"]'); if (!e) return null; return { labels: [...e.querySelectorAll('label.pl')].map((l) => l.textContent), tex: e.querySelector('.ftex').dataset.tex,
  h: [...e.querySelectorAll('.params input.inp')].map((i) => Math.round(i.getBoundingClientRect().height)), det: e.querySelector('.isub').textContent }; })()`);
ok('Inspector: f1 Möbius with a1 b1 c1 d1, 32 px fields, the generic formula and the determinant', ins && ins.labels.join() === 'a1,b1,c1,d1' && ins.h.length === 4 && ins.h.every((x) => x === FIELD_PX) && /a_\{1\}z\+b_\{1\}/.test(ins.tex) && /a₁d₁ − b₁c₁ = 2/.test(ins.det), ins);
const sig0 = await ev(`__cmwSteps().planes.length`);
await typeInto('#propsPanel .insp-step[data-k="1"] input[data-pkey="b"]', '-2');
await until(`__cmwP().steps[0].params.b === '-2' && /= 3$/.test(document.querySelector('#propsPanel .insp-step[data-k="1"] .isub').textContent)`);
ok('editing b1 changes the step', (await params(1)).b === '-2', await params(1));
ok('the determinant follows', /= 3$/.test(await ev(`document.querySelector('#propsPanel .insp-step[data-k="1"] .isub').textContent`)), await ev(`document.querySelector('#propsPanel .insp-step[data-k="1"] .isub').textContent`));
ok('the thread still has every step', (await ev(`__cmwSteps().planes.length`)) === sig0, [sig0, await ev(`__cmwSteps().planes.length`)]);

// the zero-pole step: big Add buttons, ζ and p symbols
await inspect(2);
const insz = await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="2"]'); return e ? { adds: [...e.querySelectorAll('.zp-add')].map((b) => [b.textContent.replace(/\\d+$/, ''), Math.round(b.getBoundingClientRect().height)]), syms: [...e.querySelectorAll('.zp-sym')].map((x) => x.textContent), a: e.querySelector('label.pl:not(.zp-sym)').textContent } : null; })()`);
ok('Inspector: Add zero / Add pole are 36 px; a2, ζ1 ζ2 p1', insz && insz.adds.map((x) => x.join(':')).join() === `Add zero:${ADD_PX},Add pole:${ADD_PX}` && insz.syms.join('') === 'ζ₁ζ₂p₁' && insz.a === 'Factor a2', insz);
await cl('#propsPanel .insp-step[data-k="2"] .zp-add.zeros'); await until(`${zp2('zeros')} === 3`);
let p2 = await params(2);
ok('Add zero adds a zero', p2 && String(p2.zeros).split(',').length === 3, p2);
ok('… and the view stays on the whole chain', (await ev(`__cmwSteps().focus`)) === 0, await ev(`__cmwSteps().focus`));
await cl('#propsPanel .insp-step[data-k="2"] .zp-add.poles'); await until(`${zp2('poles')} === 2`);
p2 = await params(2);
ok('Add pole adds a pole', p2.poles.split(',').length === 2, p2);
ok('the new marks are distinct', new Set([...p2.zeros.split(','), ...p2.poles.split(',')].map((x) => x.trim())).size === 5, p2);
await cl('#propsPanel .insp-step[data-k="2"] input[data-zp="poles:1"] ~ .zp-del'); await until(`${zp2('poles')} === 1`);
await cl('#propsPanel .insp-step[data-k="2"] input[data-zp="zeros:2"] ~ .zp-del'); await until(`${zp2('zeros')} === 2`);
p2 = await params(2);
ok('× removes them', p2.zeros.split(',').length === 2 && p2.poles.split(',').length === 1, p2);
// a hyphen typed in a zero field is stored as typed and shown with the true minus when the field is not focused
await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="2"] input[data-zp="zeros:1"]'); e.focus(); e.value = '-0.5-0.25i'; e.dispatchEvent(new Event('input')); e.blur(); e.dispatchEvent(new Event('change')); })()`);
await until(`document.querySelector('#propsPanel .insp-step[data-k="2"] input[data-zp="zeros:1"]').value === '\u22120.5\u22120.25i'`);
const zv = await ev(`({ shown: document.querySelector('#propsPanel .insp-step[data-k="2"] input[data-zp="zeros:1"]').value, stored: __cmwP().steps[1].params.zeros, bad: document.querySelector('#propsPanel .insp-step[data-k="2"] input[data-zp="zeros:1"]').classList.contains('bad') })`);
ok('a zero field: the true minus on screen, the hyphen in the stored text', zv.shown === '−0.5−0.25i' && /(^|, )-0\.5-0\.25i(,|$)/.test(zv.stored) && !/−/.test(zv.stored) && !zv.bad, zv);
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
info.checks = "steps view Inspector: edit, Add zero, Add pole";
return { pass: fails.length === 0, fails, info };
