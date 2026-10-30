// Shared numbers in a series' a_n and a recurrence's rule (#240, #241): typing n into a_n or u into the rule adds no
// number (the field binds them), a new name beside them is still offered, a number named n is refused; a number in a_n
// or in the rule redraws the picture when it changes (the Julia set of u² + c with c on a slider) without a new GPU
// program; renaming it follows into the field.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/series_params_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
async function openApp(st) {
  const ns = 'sp' + Date.now();
  await view(1366, 768, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = Object.assign({ v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image', sel: 1 }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}` }); await sleep(2300);
  await settle(800);
}
const names = async () => (await ev('__cmwP().params')).map((p) => p.name).join(',');
// a field of the selected step: its text set and committed as Enter does (input, then change)
const enter = (key, text) => ev(`(() => { const i = document.querySelector('input[data-pkey="${key}"]'); if (!i) return false; i.value = ${JSON.stringify(text)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
const F = (z) => ev(`JSON.stringify(__cmwEval('F', null, [${JSON.stringify(z)}]))`);
const glKey = async () => (await ev('__cmwZp()')).glKey;
// a hash of the plane's pixels (a screenshot of the wider of the two plane canvases: Phase is one full-width panel)
const picture = async () => {
  const r = await ev(`(() => { const c = ['canvasL', 'canvasR'].map((id) => document.getElementById(id).getBoundingClientRect()).sort((a, b) => b.width - a.width)[0]; return { x: c.left, y: c.top, width: c.width, height: c.height }; })()`);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 1 }, r) });
  let h = 2166136261;
  for (let i = 0; i < s.data.length; i++) h = Math.imul(h ^ s.data.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
};

// ---- #240: the field's own letters are not new numbers
await openApp({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'series', params: { kind: 'power', an: '1', c: '0' }, on: true }] });
ok('the a_n field is there', await enter('an', '\\frac{1}{n^2}'), null);
await settle(500);
ok('a_n = 1/n²: Enter adds no number', (await names()) === '', await names());
await enter('an', '(-1)^n'); await settle(500);
ok('a_n = (−1)^n: Enter adds no number', (await names()) === '', await names());
await enter('an', 'a^n'); await settle(700);
ok('a_n = a^n with a undefined: Enter adds a, not n', (await names()) === 'a', await names());
info.refused = await ev(`Params.check('n')`);
ok('a number named n is refused, saying why', !!info.refused.error && /series/.test(info.refused.error), info.refused);

// ---- #241: a number in a_n redraws
const zs = [0.3, 0.2];
const f1 = await F(zs), k1 = await glKey();
await ev(`Params.set('a', 0.2)`); await settle(900);
ok('a_n = a^n: a new a changes F, the same GPU program', (await F(zs)) !== f1 && (await glKey()) === k1, [f1, await F(zs), k1, await glKey()]);

// ---- #327: a COMPLEX number in a_n: F is the closed form for each value, the same GPU program, and the rename follows
const cx = (v) => ({ re: v[0], im: v[1] });
const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv1 = (a) => { const d = a.re * a.re + a.im * a.im; return { re: a.re / d, im: -a.im / d }; };   // 1 / a
const near = (got, want, tol = 1e-9) => !!got && Math.hypot(got[0] - want.re, got[1] - want.im) < tol * Math.max(1, Math.hypot(want.re, want.im));
const FF = async (z) => (await ev(`__cmwEval('F', null, [${JSON.stringify(z)}])`))[0];
await openApp({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.5 }], params: [{ name: 'a', value: 0.5, im: 0.3, min: -2, max: 2, step: 0.01 }],
  steps: [{ type: 'series', params: { kind: 'power', an: 'a^n', c: '0' }, on: true }] });
await settle(1200);
const seriesWant = (a) => cdiv1({ re: 1 - cmul(a, cx(zs)).re, im: -cmul(a, cx(zs)).im });   // Σ (a z)^n = 1 / (1 − a z)
const kc = await glKey();
ok('a = 0.5 + 0.3i in a_n = a^n: F is 1 / (1 − a z)', near(await FF(zs), seriesWant({ re: 0.5, im: 0.3 })), [await FF(zs), seriesWant({ re: 0.5, im: 0.3 })]);
await ev(`Params.set('a', { re: -0.2, im: 0.7 })`); await settle(900);
ok('a new complex a: F follows the closed form', near(await FF(zs), seriesWant({ re: -0.2, im: 0.7 })), [await FF(zs), seriesWant({ re: -0.2, im: 0.7 })]);
ok('… with the same GPU program', (await glKey()) === kc, [kc, await glKey()]);
await ev(`Params.rename('a', 'b')`); await settle(600);
ok('renaming a complex a renames it in a_n', (await ev('__cmwP().steps[0].params.an')) === 'b^n', await ev('__cmwP().steps[0].params.an'));
ok('… and the value survives the rename', near(await FF(zs), seriesWant({ re: -0.2, im: 0.7 })), await FF(zs));

// ---- the recurrence: u is the rule's own; c on a slider moves the Julia set without a new program
await openApp({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], params: [{ name: 'c', value: -0.75, min: -2, max: 2, step: 0.01 }], rightMode: 'color',
  steps: [{ type: 'recurrence', params: { u0: 'z', g: 'u^2+c', N: 6, cut: 180 }, on: true }] });
await enter('g', 'u^2+c+0'); await settle(600);
ok('the rule u² + c + 0: Enter adds no u', (await names()) === 'c', await names());
info.uRefused = await ev(`Params.check('u')`);
ok('while a recurrence is in the chain a number named u is refused', !!info.uRefused.error && /recurrence/.test(info.uRefused.error), info.uRefused);
await settle(1500);
const p0 = await picture(), g0 = await F(zs), kj = await glKey();
await ev(`Params.set('c', 0.3)`); await settle(1500);
const p1 = await picture();
info.julia = { p0, p1, g0, g1: await F(zs) };
ok('a slider on c moves the Julia set: F and the picture change', info.julia.g1 !== g0 && p1 !== p0, info.julia);
ok('… with the same GPU program (c is a uniform)', (await glKey()) === kj, [kj, await glKey()]);
// a complex c: F is the orbit u_6 of u² + c from u_0 = z, and the same GPU program (the picture's own check is above)
{
  const orbit6 = (c) => { let u = cx(zs); for (let i = 0; i < 6; i++) { const q = cmul(u, u); u = { re: q.re + c.re, im: q.im + c.im }; } return u; };
  const kk = await glKey();
  await ev(`Params.set('c', { re: -0.4, im: 0.5 })`); await settle(1500);
  ok('the rule u² + c with c = −0.4 + 0.5i: F is the orbit', near(await FF(zs), orbit6({ re: -0.4, im: 0.5 }), 1e-6), [await FF(zs), orbit6({ re: -0.4, im: 0.5 })]);
  ok('… the same GPU program (both parts are uniforms)', (await glKey()) === kk, [kk, await glKey()]);
  await ev(`Params.set('c', { re: -0.4, im: -0.5 })`); await settle(1500);
  ok('the conjugate c gives the conjugate orbit', near(await FF(zs), orbit6({ re: -0.4, im: -0.5 }), 1e-6), [await FF(zs), orbit6({ re: -0.4, im: -0.5 })]);
}
await ev(`Params.rename('c', 'b')`); await settle(600);
ok('renaming c renames it in the rule', (await ev('__cmwP().steps[0].params.g')) === 'u^2+b+0', await ev('__cmwP().steps[0].params.g'));
await grab();
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
