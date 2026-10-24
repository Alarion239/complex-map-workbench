// Zeros and poles, review fixes (2026-10-22): Delete acts on the selection the user sees (a shape chosen in the
// Shapes list clears a zero/pole selection), the selected shape's handles win over a zero or pole on the same spot,
// a field given a list '0.5, 0.5i' becomes one field per item (fields and handles keep their indices), and the cap of
// 24 zeros and 24 poles (+ disabled, Shift-click refused). A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/zpfix_cmd.js
// Prints {pass, fails, shots}.
const fails = [], shots = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const zp = () => ev('__cmwZp()');
const handle = async (kind, i) => (await zp()).handles.find((q) => q.kind === kind && q.i === i);
const w2s = async (re, im) => ev(`__cmwW2S('L', ${re}, ${im})`);
const shapes = () => ev('__cmwShapes().shapes.map((s) => s.id)');

await view(1440, 900, false);
// 1. Delete after choosing a shape in the list removes that shape, not the zero clicked before
await load('zpfix' + Date.now(), { shapes: [{ id: 's1', kind: 'disc', c: [0, 1.2], r: 0.5 }, { id: 's2', kind: 'disc', c: [0, -1.2], r: 0.5 }],
  steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
let h = await handle('zeros', 0);
await click(h.x, h.y); await settle(300);
ok('a click selects zeta_1', (await zp()).sel && (await zp()).sel.kind === 'zeros' && (await zp()).sel.i === 0, (await zp()).sel);
const row = await ev(`(() => { const r = [...document.querySelectorAll('#shapeList .shape-row')].find((e) => /Disc 2/.test(e.textContent)); if (!r) return null; const b = r.getBoundingClientRect(); return { x: b.left + 40, y: b.top + b.height / 2 }; })()`);
ok('the Disc 2 row is in the Shapes list', !!row, row);
if (row) { await click(row.x, row.y); await settle(400); }
ok('choosing a shape in the list clears the zero selection', (await zp()).sel === null, (await zp()).sel);
await move(700, 300); await key('Delete'); await settle(500);
const z1 = await zp();
ok('Delete removes the chosen shape, the zeros stay', z1.params.zeros === '1, -1' && JSON.stringify(await shapes()) === JSON.stringify(['s1']), { zeros: z1.params.zeros, shapes: await shapes() });

// 2. a selected disc about 0 of radius 1 under the default zeros: its radius handle (at zeta_1 = 1) is reachable
await load('zpfix2' + Date.now(), { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }],
  steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
await ev(`__cmwSelect('s1')`); await settle(300);
const r0 = await w2s(1, 0);
await drag(r0[0], r0[1], r0[0] + 55, r0[1], 12, 16); await settle(500);
const st2 = await ev('__cmwShapes()'), z2 = await zp();
ok('the selected disc\'s radius handle wins over zeta_1 on the same spot', z2.params.zeros === '1, -1' && Math.abs(st2.shapes[0].r - 1.5) < 0.06, { zeros: z2.params.zeros, r: st2.shapes[0].r });
// a zero snapped onto the pole: repeated clicks cycle between them (the pole can be grabbed)
await ev(`__cmwSelect(null)`); await settle(200);
await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="1"] input[data-zp="zeros:1"]'); e.value = '0'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); })()`); await settle(500);
const c0 = await w2s(0, 0);
await click(c0[0], c0[1]); await settle(250);
const s1 = (await zp()).sel;
await click(c0[0], c0[1]); await settle(250);
const s2 = (await zp()).sel;
ok('a zero on the pole: two clicks take both', s1 && s2 && s1.kind !== s2.kind, { s1, s2 });

// 3. a field given a list: one field per item after the change, fields and handles agree
await load('zpfix3' + Date.now(), { shapes: [{ id: 's1', kind: 'disc', c: [0, 1.2], r: 0.5 }],
  steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="1"] input[data-zp="zeros:0"]'); e.value = '0.5, 0.5i'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); })()`); await settle(600);
let fields = await ev(`[...document.querySelectorAll('#propsPanel .insp-step[data-k="1"] input[data-zp^="zeros:"]')].map((e) => [e.dataset.zp, e.value])`);
ok('a list in one field: one field per item', JSON.stringify(fields) === JSON.stringify([['zeros:0', '0.5'], ['zeros:1', '0.5i'], ['zeros:2', '−1']]), fields);
h = await handle('zeros', 2);
await drag(h.x, h.y, h.x + 20, h.y - 30, 8, 16); await settle(500);
fields = await ev(`[...document.querySelectorAll('#propsPanel .insp-step[data-k="1"] input[data-zp^="zeros:"]')].map((e) => [e.dataset.zp, e.value])`);
const z3 = await zp();
ok('after a drag of zeta_3 its own field shows it', fields.length === 3 && fields[2][1] === Funcs_split(z3.params.zeros)[2].replace(/-/g, '−') && fields[0][1] === '0.5', { fields, zeros: z3.params.zeros });
// long values: one item per row (the field shows the whole value)
const wide = await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="1"] input[data-zp="zeros:2"]'); return { wide: e.closest('.zp-item').classList.contains('wide1'), fits: e.scrollWidth <= e.clientWidth + 1 }; })()`);
ok('a long dragged value: its field takes the full row and shows it whole', wide.wide && wide.fits, wide);
await shot('zpfix-card-light'); shots.push('zpfix-card-light');

// 4. the cap: 24 zeros, the + zero button disabled, Shift-click refused
const many = Array.from({ length: 24 }, (_, i) => `${(Math.cos(i * Math.PI / 12) * 1.2).toFixed(3)}${Math.sin(i * Math.PI / 12) < 0 ? '-' : '+'}${Math.abs(Math.sin(i * Math.PI / 12) * 1.2).toFixed(3)}i`).join(', ');
await load('zpfix4' + Date.now(), { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1.6 }],
  steps: [{ type: 'zp', params: { a: '1', zeros: many, poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1500); await grab();
const btn = await ev(`(() => { const b = document.querySelector('#propsPanel .insp-step[data-k="1"] .zp-add.zeros'); return b ? { dis: b.disabled, tip: b.dataset.tip, text: b.textContent } : null; })()`);
ok('24 zeros: + zero disabled, says the cap, shows the count', btn && btn.dis && /At most 24/.test(btn.tip) && /24/.test(btn.text), btn);
const e5 = await w2s(0.3, 0.2);
await click(e5[0], e5[1], { mods: 8 }); await settle(400);
ok('24 zeros: Shift-click adds none', Funcs_split((await zp()).params.zeros).length === 24, Funcs_split((await zp()).params.zeros).length);
const err = await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="1"] input[data-zp="zeros:0"]'); e.value = '0.1, 0.2'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); return document.querySelector('#propsPanel .insp-step[data-k="1"]').textContent; })()`);
await settle(500);
ok('25 typed: the step says the cap', /At most 24/.test(err) || /At most 24/.test(await ev(`document.querySelector('#propsPanel .insp-step[data-k="1"]').textContent`)), err.slice(0, 200));

await grab();
ok('no exceptions or console errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, shots };
function Funcs_split(s) { return String(s).split(',').map((x) => x.trim()).filter((x) => x); }
