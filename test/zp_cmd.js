// The zeros-and-poles step (user request 2026-10-22: "Can we define polynomials by dragging their roots?", answer
// "Zeros and poles"): f(z) = a prod(z - zeta_k) / prod(z - p_j) with its zeros (dots) and poles (crosses) as handles in
// its input plane. Checks: handles drawn where the values are; a drag updates the step live at 60 fps without a
// recompile (uniforms only) and is one undo step; the image is exact at rest and while the pointer holds still mid-drag
// (degree <= 2: the inverse renderer, per pixel against the exact truth); Shift-click adds a zero, Shift-Cmd-click a
// pole; dragging off the plane or Delete removes; the card's + / x buttons; degree 3 goes forward with its reason;
// the conversions from and to coefficients; the focused step in a chain; the deformation (natural path, figure);
// light and dark screenshots. A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/zp_cmd.js
// Prints {pass, fails, info, shots}; screenshots go to <daemon folder>/shots/zp-*.png.
const fails = [], shots = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const zp = () => ev('__cmwZp()');
const handle = async (kind, i) => (await zp()).handles.find((q) => q.kind === kind && q.i === i);
const DISC = { id: 's1', kind: 'disc', c: [0, 1.2], r: 0.8 };
const PLAIN = { pattern: 'solid', alpha: 1, lines: false, unit: false, fov: false, outline: false, chev: false };

const EXACT_SRC = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'zp_kit.js'), 'utf8'))(DISC);

// ---------------------------------------------------------------------------------------------------------------
// (v15 review regress-3: the test runs at the shipped geometry; its truth leaves out the ruler bands at the plane's
// edges, 16 px, where axis ink is neither fill nor plane)
// (a step's ⋯ menu and its name: the chain's card in the classic view, the thread's step in the steps view)
const stepMore = (k) => inSteps ? `#svStrip .sv-step[data-k="${k}"] .sv-more` : `#pipeline .card[data-k="${k}"] .more`;
const stepName = async (k) => inSteps ? ev(`document.querySelector('#svStrip .sv-step[data-k="${k}"]').textContent`) : (await ev('__qa.cards()'))[k];
// 1. (z^2 - 1)/z of a disc: handles, the card, exact at rest
await view(1440, 900, false);
// (Y, the image, is the classic view's right pane; the steps view shows it as its last plane, so the exactness is read
// there and the view goes back to the plane with the handles)
let inSteps = false;   // (read once the page is loaded)
const toPlane = async (i) => { await ev(`__cmwSteps({ go: ${i === 'last' ? '__cmwSteps().planes.length - 1' : i}, now: true })`); await settled({ until: '!__cmwSteps().moving' }); };
const exact = async () => {
  if (!inSteps) return ev(EXACT_SRC('R'), 60000);
  await toPlane('last');
  const r = await ev(EXACT_SRC('L'), 60000);
  await toPlane(0);
  return r;
};
await load('zpacc' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1200); await grab();
inSteps = await ev(`document.documentElement.classList.contains('sv')`);
let z = await zp();
ok('three handles in X (2 zeros, 1 pole)', z.k === 1 && z.handles.length === 3, z);
const w2s = async (re, im) => ev(`__cmwW2S('L', ${re}, ${im})`);
const h0 = await handle('zeros', 0), p0 = await handle('poles', 0);
const e0 = await w2s(1, 0), e1 = await w2s(0, 0);
ok('zero 1 drawn at 1', h0 && Math.hypot(h0.x - e0[0], h0.y - e0[1]) < 0.75, { h0, e0 });
ok('pole 1 drawn at 0', p0 && Math.hypot(p0.x - e1[0], p0.y - e1[1]) < 0.75, { p0, e1 });
// (the step's editor is the Inspector's: #propsPanel .insp-step; Add zero / Add pole are its big buttons)
const card = await ev(`(() => { const c = document.querySelector('#propsPanel .insp-step[data-k="1"]'); return { fields: [...c.querySelectorAll('input[data-zp]')].map((e) => [e.dataset.zp, e.value]), adds: [...c.querySelectorAll('.zp-add')].map((b) => b.textContent), syms: [...c.querySelectorAll('.zp-sym')].map((e) => e.textContent), tex: c.querySelector('.ftex').dataset.tex }; })()`);
ok('Inspector: a field per zero and pole, Add zero / Add pole', JSON.stringify(card.fields) === JSON.stringify([['zeros:0', '1'], ['zeros:1', '−1'], ['poles:0', '0']]) && card.adds.join('|') === 'Add zero2|Add pole1' && card.syms.join('') === 'ζ₁ζ₂p₁', card);
ok('card formula factored', /\\frac\{\\left\(z-1\\right\)\\left\(z\+1\\right\)\}\{z\}/.test(card.tex || ''), card.tex);
let lamps = await ev('__qa.lamps()');
ok('guarantees: rational of exact degree 2, not polynomial, not Möbius', /●rational\(deg 2\)/.test(lamps) && /○polynomial/.test(lamps) && /○mobius/.test(lamps), lamps);
let ex = await exact();
ok('exact at rest (per pixel against the truth)', ex.n > 2000 && ex.rate < 0.002, ex);
info.exactRest = ex;
await shot('zp-light'); shots.push('zp-light');

// 2. drag a zero: live (no recompile, 60 fps), exact while held, one undo step
const key0 = (await zp()).glKey;
let h = await handle('zeros', 0);
await ev('window.__fr = __qa.frames(1500); window.__keys = new Set(); window.__kt = setInterval(() => window.__keys.add(__cmwZp().glKey), 40); 1');
await drag(h.x, h.y, h.x + 24, h.y - 70, 70, 16);
const fr = await ev('await window.__fr');
const keys = await ev('clearInterval(window.__kt); [...window.__keys]');
info.dragFrames = fr;
ok('drag at 60 fps (p95 frame <= 20 ms)', fr.fps >= 55 && fr.p95 <= 20.5, fr);
ok('no recompile while dragging (one chain signature)', keys.length === 1 && keys[0] === key0, keys);
z = await zp();
ok('the zero moved (rounded below a pixel)', /^1\.2\d\d?\+0\.6[0-9]*i, -1$/.test(z.params.zeros) || /^1\.\d+\+0\.\d+i, -1$/.test(z.params.zeros), z.params);
ok('the dragged zero is selected', z.sel && z.sel.kind === 'zeros' && z.sel.i === 0, z.sel);
const fieldNow = await ev(`document.querySelector('#propsPanel .insp-step[data-k="1"] input[data-zp="zeros:0"]').value`);
ok('Inspector field follows the drag', fieldNow === z.params.zeros.split(',')[0].trim().replace(/-/g, '−'), fieldNow);   // (review verify-4: the field shows the true minus, the stored text the hyphen)
await settle(900);
ex = await exact();
ok('exact at rest after the drag', ex.n > 2000 && ex.rate < 0.002, ex);
// mid-drag, the pointer held still
h = await handle('zeros', 1);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x, y: h.y });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: h.x, y: h.y, button: 'left', clickCount: 1 });
for (let i = 1; i <= 12; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x - 3 * i, y: h.y + 4 * i, button: 'left', buttons: 1 }); await sleep(16); }
await settle(250);
// (the frame held mid-drag is read on the image plane, which the steps view cannot show while a handle of the domain is
// held: that case is in zp_classic_cmd.js)
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: h.x - 36, y: h.y + 48, button: 'left', clickCount: 1 });
await settle(400);
const zz = (await zp()).params.zeros;
await key('z', 4); await settle(400);
ok('undo takes back the whole second drag', (await zp()).params.zeros === z.params.zeros, { before: z.params.zeros, after: (await zp()).params.zeros, moved: zz });
await key('z', 4); await settle(400);
ok('undo again: the first drag', (await zp()).params.zeros === '1, -1', (await zp()).params);
await key('z', 12); await settle(400);
ok('redo', (await zp()).params.zeros === z.params.zeros, (await zp()).params);

// 3. Shift-click adds a zero (degree 3: forward, with its reason); Shift-Cmd-click a pole
const pane = (await zp()).pane;
const ax = pane.left + pane.w * 0.78, ay = pane.top + pane.h * 0.2;
await click(ax, ay, { mods: 8 }); await settle(700);
z = await zp();
ok('Shift-click adds zero 3', Funcs_split(z.params.zeros).length === 3 && z.handles.filter((q) => q.kind === 'zeros').length === 3, z.params);
lamps = await ev('__qa.lamps()');
ok('degree 3 rational', /●rational\(deg 3\)/.test(lamps), lamps);
await settle(600);
await click(pane.left + pane.w * 0.2, pane.top + pane.h * 0.8, { mods: 8 | 4 }); await settle(700);
z = await zp();
ok('Shift-Cmd-click adds pole 2', Funcs_split(z.params.poles).length === 2, z.params);
await shot('zp-added-light'); shots.push('zp-added-light');
// drag pole 2 off the plane: removed (one undo step)
h = await handle('poles', 1);
await drag(h.x, h.y, pane.left - 40, h.y, 20, 16); await settle(600);
z = await zp();
ok('dragged off the plane: pole 2 removed', Funcs_split(z.params.poles).length === 1, z.params);
await key('z', 4); await settle(400);
ok('undo brings it back', Funcs_split((await zp()).params.poles).length === 2, (await zp()).params);
await key('z', 12); await settle(400);
// select zero 3 by a click, Delete removes it
h = await handle('zeros', 2);
await click(h.x, h.y); await settle(300);
ok('a click selects zero 3', (await zp()).sel && (await zp()).sel.i === 2, (await zp()).sel);
await key('Delete'); await settle(600);
z = await zp();
ok('Delete removes zero 3', Funcs_split(z.params.zeros).length === 2 && z.sel === null, z);

// 4. the card's buttons: + pole, x on it
await clickSel('#propsPanel .insp-step[data-k="1"] .zp-add.poles'); await settle(600);
z = await zp();
ok('+ pole adds a pole in view', Funcs_split(z.params.poles).length === 2 && z.handles.some((q) => q.kind === 'poles' && q.i === 1 && q.x > pane.left && q.x < pane.left + pane.w), z);
await clickSel('#propsPanel .insp-step[data-k="1"] input[data-zp="poles:1"] ~ .zp-del'); await settle(600);
ok('x removes it', Funcs_split((await zp()).params.poles).length === 1, (await zp()).params);
// [UX54] x on zero 1: zero 2 keeps its name, ζ₂; Undo brings ζ₁ back
const zSyms = () => ev(`[...document.querySelectorAll('#propsPanel .insp-step[data-k="1"] .zp-sym.zeros')].map((e) => e.textContent)`);
info.zSyms0 = await zSyms();
await clickSel('#propsPanel .insp-step[data-k="1"] input[data-zp="zeros:0"] ~ .zp-del'); await settle(600);
info.zSyms1 = await zSyms();
ok('x on zero 1: the other zero is still ζ₂', info.zSyms0.join() === 'ζ₁,ζ₂' && info.zSyms1.join() === 'ζ₂', [info.zSyms0, info.zSyms1]);
await key('z', 4); await settle(500);
ok('… Undo: ζ₁, ζ₂ again', (await zSyms()).join() === 'ζ₁,ζ₂', await zSyms());
// typing a value
await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="1"] input[data-zp="poles:0"]'); e.value = '0.5i'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); })()`); await settle(500);
const pz = await handle('poles', 0), pe = await w2s(0, 0.5);
ok('a typed pole moves its handle', pz && Math.hypot(pz.x - pe[0], pz.y - pe[1]) < 0.75, { pz, pe });

// 5. conversions: by coefficients and back
await ev(`__cmwSet ? 1 : 0`);
const conv = await ev(`(() => { const r1 = Funcs.fromZerosPoles({ type: 'zp', params: { a: '2', zeros: '1, -1', poles: '0' } }); const r2 = Funcs.toZerosPoles(r1.step); return { r1, r2 }; })()`);
ok('fromZerosPoles: (2z^2 - 2)/z', conv.r1.step.type === 'rational' && conv.r1.step.params.p === '2, 0, -2' && conv.r1.step.params.q === '1, 0', conv.r1);
ok('toZerosPoles: back', conv.r2.step.type === 'zp' && conv.r2.step.params.a === '2' && conv.r2.step.params.zeros === '1, -1' && conv.r2.step.params.poles === '0', conv.r2);
// through the step menu
await clickSel(stepMore(1)); await settle(300);
const menu = await ev(`[...document.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent.trim())`);
ok('menu: Write by coefficients', menu.some((t) => /Write by coefficients/.test(t)), menu);
await ev(`[...document.querySelectorAll('[role="menuitem"]')].find((e) => /Write by coefficients/.test(e.textContent)).click()`); await settle(700);
ok('now a rational step', /Rational/.test(await stepName(1)), await stepName(1));
await clickSel(stepMore(1)); await settle(300);
await ev(`[...document.querySelectorAll('[role="menuitem"]')].find((e) => /Write by zeros and poles/.test(e.textContent)).click()`); await settle(700);
await settle(300);
z = await zp();
ok('and back to zeros and poles', /Zeros and poles/.test(await stepName(1)) && Funcs_split(z.params.zeros).length === 2, { card: await stepName(1), p: z.params });
await grab();

// 6. a focused step in a chain: e^z then zeros and poles; the handles show in f2's input plane only when focused
await load('zpacc2' + Date.now(), Object.assign({ shapes: [{ id: 's1', kind: 'rect', a: [-1, -1], b: [0.5, 1] }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'zp', params: { a: '1', zeros: '1+i, -1', poles: '' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } }, { pattern: 'checker' }));
await settle(1200); await grab();
ok('whole chain: no handles in X (step 2 acts on w1)', (await zp()).handles.length === 0, await zp());
// (a click selects; Show alone is a double-click)
if (inSteps) await toPlane(1);   // (f2's input plane)
else await ev(`document.querySelector('#pipeline .card[data-k="2"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
await settle(1200);
z = await zp();
ok('f2 focused: its zeros in its input plane', z.k === 2 && z.handles.length === 2, z);
h = (await zp()).handles.find((q) => q.x > z.pane.left + 20 && q.x < z.pane.left + z.pane.w - 60 && q.y > z.pane.top + 20 && q.y < z.pane.top + z.pane.h - 40);
ok('a zero of f2 in view', !!h, z);
if (h) await drag(h.x, h.y, h.x + 40, h.y + 20, 30, 16);
await settle(800);
ok('dragging in the focused plane changes f2', (await zp()).params.zeros !== '1+i, -1', (await zp()).params);
lamps = await ev('__qa.lamps()');
await shot('zp-focused-light'); shots.push('zp-focused-light');

// 8. dark
await load('zpacc5' + Date.now(), { shapes: [DISC, { id: 's2', kind: 'pgrid', c: [0, 0], r: 1.6, nc: 4, nr: 12 }], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1, 0.5i', poles: '0, -0.6-0.4i' }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 110 } });
await view(1440, 900, true); await settle(1400);
h = await handle('zeros', 2);
await move(h.x, h.y); await settle(300);
await shot('zp-dark'); shots.push('zp-dark');
await view(1440, 900, false); await settle(300);
await grab();
ok('no exceptions', errs.length === 0, errs.slice(0, 5));
// (no geometry hook to remove: review regress-3)
return { pass: fails.length === 0, fails, info, shots };

function Funcs_split(s) { return String(s || '').split(',').map((x) => x.trim()).filter((x) => x); }
