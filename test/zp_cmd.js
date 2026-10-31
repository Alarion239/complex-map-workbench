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

// Exactness: classify pixels of the right plane against the exact image of the disc |z| < R under the step's map
// (degree <= 2: the roots of a prod(z - zeta) - w prod(z - p) = 0). Samples on a 6 px lattice whose truth is the
// same 2 px around them (the boundary band is not scored), and 3.5 px away from the image of the boundary circle (its
// stroke, which a fold lays inside the image); a pixel is 'fill' when nearer the fill colour than the plane.
const EXACT = `await (async () => {
  const st = __cmwZp().params, R = ${DISC.r}, CZ = { re: ${DISC.c[0]}, im: ${DISC.c[1]} };
  const C = (re, im) => ({ re, im });
  const cmul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const csub = (a, b) => C(a.re - b.re, a.im - b.im);
  const cadd = (a, b) => C(a.re + b.re, a.im + b.im);
  const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const csqrt = (a) => { const r = Math.sqrt(Math.hypot(a.re, a.im)), t = Math.atan2(a.im, a.re) / 2; return C(r * Math.cos(t), r * Math.sin(t)); };
  const val = (s) => Expr.constValue(s);
  const list = (s) => Funcs.splitList(s).map(val);
  const a = val(st.a), zs = list(st.zeros), ps = list(st.poles);
  const expand = (c, rs) => rs.reduce((co, r) => { const o = co.map(() => C(0, 0)).concat([C(0, 0)]); co.forEach((x, i) => { o[i] = cadd(o[i], x); o[i + 1] = csub(o[i + 1], cmul(x, r)); }); return o; }, [c]);
  const P = expand(a, zs), Q = expand(C(1, 0), ps);
  const pad = (co) => [...Array(3 - co.length).fill(C(0, 0)), ...co];
  if (P.length > 3 || Q.length > 3) return { skipped: 'degree > 2' };
  const PP = pad(P), QQ = pad(Q);
  const inImage = (w) => {
    const A = csub(PP[0], cmul(w, QQ[0])), B = csub(PP[1], cmul(w, QQ[1])), Cc = csub(PP[2], cmul(w, QQ[2]));
    let roots;
    if (Math.hypot(A.re, A.im) < 1e-14) roots = Math.hypot(B.re, B.im) > 0 ? [cdiv(C(-Cc.re, -Cc.im), B)] : [];
    else { const d = csqrt(csub(cmul(B, B), cmul(C(4, 0), cmul(A, Cc)))); roots = [cdiv(csub(d, B), cmul(C(2, 0), A)), cdiv(C(-B.re - d.re, -B.im - d.im), cmul(C(2, 0), A))]; }
    return roots.some((z) => Math.hypot(z.re - CZ.re, z.im - CZ.im) < R);
  };
  const F = (z) => { const ev = (co) => co.reduce((s, c) => cadd(cmul(s, z), c), C(0, 0)); return cdiv(ev(P), ev(Q)); };
  const c = document.getElementById('canvasR');
  const s = document.createElement('canvas'); s.width = c.width; s.height = c.height;
  const x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0);
  const d = x.getImageData(0, 0, s.width, s.height).data;
  const look = __cmwLook('s1'), dpr = look.dpr, v = look.view;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const fill = hex(look.color), bg = hex(look.plane);
  const W = c.width / dpr, H = c.height / dpr;
  const w2 = (px, py) => C(v.cx + (px - W / 2) / v.s, v.cy - (py - H / 2) / v.s);
  const rim = [];
  for (let j = 0; j < 4000; j++) { const t = 2 * Math.PI * j / 4000, w = F(C(CZ.re + R * Math.cos(t), CZ.im + R * Math.sin(t))); if (Number.isFinite(w.re) && Number.isFinite(w.im)) rim.push([W / 2 + (w.re - v.cx) * v.s, H / 2 - (w.im - v.cy) * v.s]); }
  const nearRim = (px, py) => rim.some(([x, y]) => Math.abs(x - px) < 3.5 && Math.abs(y - py) < 3.5);
  let n = 0, bad = 0; const badAt = [];
  for (let py = 16; py < H - 16; py += 6) for (let px = 16; px < W - 16; px += 6) {
    const t = inImage(w2(px, py));
    let robust = true;
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]]) if (inImage(w2(px + dx, py + dy)) !== t) { robust = false; break; }
    if (!robust || nearRim(px, py)) continue;
    const i = 4 * (Math.round(py * dpr) * c.width + Math.round(px * dpr));
    const p = [d[i], d[i + 1], d[i + 2]];
    const df = Math.hypot(p[0] - fill[0], p[1] - fill[1], p[2] - fill[2]), db = Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]);
    const got = df < db;
    n++;
    if (got !== t) { bad++; if (badAt.length < 6) badAt.push([px, py, t, p]); }
  }
  return { n, bad, rate: bad / Math.max(1, n), badAt };
})()`;

// ---------------------------------------------------------------------------------------------------------------
// (v15 review regress-3: the test runs at the shipped geometry; its truth leaves out the ruler bands at the plane's
// edges, 16 px, where axis ink is neither fill nor plane)
// 1. (z^2 - 1)/z of a disc: handles, the card, exact at rest
await view(1440, 900, false);
await load('zpacc' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1200); await grab();
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
const pathsR = async () => (await ev('__cmwPaths()')).filter((p) => p.role === 'R');
let paths = await pathsR();
ok('degree 2: drawn exactly (inverse renderer)', paths.length && paths.every((p) => p.path === 'inverse'), paths);
let ex = await ev(EXACT, 60000);
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
ex = await ev(EXACT, 60000);
ok('exact at rest after the drag', ex.n > 2000 && ex.rate < 0.002, ex);
// mid-drag, the pointer held still: the motion frame is the rest frame
h = await handle('zeros', 1);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x, y: h.y });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: h.x, y: h.y, button: 'left', clickCount: 1 });
for (let i = 1; i <= 12; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x - 3 * i, y: h.y + 4 * i, button: 'left', buttons: 1 }); await sleep(16); }
await settle(250);
const exHeld = await ev(EXACT, 60000);
ok('exact mid-drag (pointer held still)', exHeld.n > 2000 && exHeld.rate < 0.002, exHeld);
info.exactHeld = exHeld;
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
paths = await pathsR();
ok('degree 3: forward, with the reason', paths.every((p) => p.path === 'forward' && /degree 3/.test(p.reason || '')), paths);
info.deg3 = paths;
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
paths = await pathsR();
ok('back to degree 2: exact again', paths.every((p) => p.path === 'inverse'), paths);

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
await clickSel('#pipeline .card[data-k="1"] .more'); await settle(300);
const menu = await ev(`[...document.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent.trim())`);
ok('menu: Write by coefficients', menu.some((t) => /Write by coefficients/.test(t)), menu);
await ev(`[...document.querySelectorAll('[role="menuitem"]')].find((e) => /Write by coefficients/.test(e.textContent)).click()`); await settle(700);
let cards = await ev('__qa.cards()');
ok('now a rational step', /Rational/.test(cards[1]), cards);
await clickSel('#pipeline .card[data-k="1"] .more'); await settle(300);
await ev(`[...document.querySelectorAll('[role="menuitem"]')].find((e) => /Write by zeros and poles/.test(e.textContent)).click()`); await settle(700);
cards = await ev('__qa.cards()');
z = await zp();
ok('and back to zeros and poles', /Zeros and poles/.test(cards[1]) && Funcs_split(z.params.zeros).length === 2, { cards, p: z.params });
await grab();

// 6. a focused step in a chain: e^z then zeros and poles; the handles show in f2's input plane only when focused
await load('zpacc2' + Date.now(), Object.assign({ shapes: [{ id: 's1', kind: 'rect', a: [-1, -1], b: [0.5, 1] }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'zp', params: { a: '1', zeros: '1+i, -1', poles: '' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } }, { pattern: 'checker' }));
await settle(1200); await grab();
ok('whole chain: no handles in X (step 2 acts on w1)', (await zp()).handles.length === 0, await zp());
// (a click selects; Show alone is a double-click)
await ev(`document.querySelector('#pipeline .card[data-k="2"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`); await settle(1200);
z = await zp();
ok('f2 focused: its zeros in its input plane', z.k === 2 && z.handles.length === 2, z);
h = (await zp()).handles.find((q) => q.x > z.pane.left + 20 && q.x < z.pane.left + z.pane.w - 60 && q.y > z.pane.top + 20 && q.y < z.pane.top + z.pane.h - 40);
ok('a zero of f2 in view', !!h, z);
if (h) await drag(h.x, h.y, h.x + 40, h.y + 20, 30, 16);
await settle(800);
ok('dragging in the focused plane changes f2', (await zp()).params.zeros !== '1+i, -1', (await zp()).params);
lamps = await ev('__qa.lamps()');
await shot('zp-focused-light'); shots.push('zp-focused-light');

// 7. the deformation: the natural path of a polynomial (zeros fly in), and a figure with its caption
await load('zpacc3' + Date.now(), { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1.5 }, { id: 's2', kind: 'pgrid', c: [0, 0], r: 1.5, nc: 5, nr: 16 }],
  steps: [{ type: 'zp', params: { a: '1', zeros: '1, -0.5+0.8i, -0.5-0.8i', poles: '' }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
await ev('__cmwMorph({ T: 0.5 })'); await settle(900);
const st = await ev('__cmwState()');
ok('deformation: a natural path (mode 1)', st.homView && st.homView.map.mode === 1, st.homView && st.homView.map);
await shot('zp-deform-light'); shots.push('zp-deform-light');
const fig = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], morph: true, caption: true, widthIn: 3.4 }); return f ? { n: f.morph ? f.morph.kept.length : -1, cap: f.captionTex } : null; })()`, 60000);
ok('figure: arrows and the zoom path about zeta_1 in the caption (only true claims)', fig && fig.n > 0 && /zoom homotopy/.test(fig.cap) && /about \$c=1\$, a zero of/.test(fig.cap) && !/never meet/.test(fig.cap) && !/zeros fly/.test(fig.cap), fig && { n: fig.n, cap: fig.cap.slice(0, 500) });
info.figCaption = fig && fig.cap.slice(0, 600);
await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(300);
const pf = await ev('await (async () => await __qa.frames(2000))()', 30000);
info.playFrames = pf;
ok('deformation plays at 60 fps', pf.fps >= 55, pf);
await ev('__cmwMorph({ playing: false, open: false })'); await settle(400);
// with a pole: the rational zoom path
await load('zpacc4' + Date.now(), { shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0.3i' }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1000);
await ev('__cmwMorph({ open: true, playing: false })'); await settle(500);
await ev('__cmwMorph({ T: 0.6 })'); await settle(900);
const st2 = await ev('__cmwState()');
ok('with a pole: a natural path too', st2.homView && st2.homView.map.mode === 1, st2.homView && st2.homView.map);
await shot('zp-deform-pole-light'); shots.push('zp-deform-pole-light');
await ev('__cmwMorph({ open: false })'); await settle(300);

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
