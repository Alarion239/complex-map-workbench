// Editing a series without the lag (#243) and a number inside a_n on a slider (#241 part 2): typing a_n rebuilds the
// chain once per pause, not per key, and Enter applies it at once, one Undo step; of two quick edits the later one is
// the picture; a formula step stays synchronous (the field's change is the chain's at once); a slider of a number in
// a_n keeps its drag (the first drag after the page opens too) and the picture follows the number. The timing checks
// ("timing: ...") report numbers relative to a formula step on the same machine (ci/browser_suites.js TIMING).
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/series_edit_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
async function openApp(st) {
  const ns = 'se' + Date.now();
  await view(1440, 900, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = Object.assign({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', sel: 1 }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}` }); await sleep(2300);
  await settle(1500);
  for (let i = 0; i < 40 && !(await ev('typeof __cmwP === "function" && !!document.querySelector(".card")')); i++) await sleep(250);
  // the chain's rebuilds (Funcs.build of each step) and the page's long tasks from here on
  await ev(`(() => { window.__nb = 0; const b = Funcs.build; Funcs.build = function (...a) { window.__nb++; return b.apply(this, a); };
    window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask' }); } catch (e) { /* no long tasks */ } return 1; })()`);
}
const F = async (z) => (await ev(`__cmwEval('F', null, [${JSON.stringify(z)}])`))[0];
const near = (w, re, im = 0) => !!w && Math.abs(w[0] - re) < 1e-6 && Math.abs(w[1] - im) < 1e-6;
const focusField = (key) => ev(`(() => { const i = document.querySelector('input[data-pkey="${key}"]'); if (!i) return false; i.focus(); i.select(); return true; })()`);
// type text a key at a time, gap ms apart; long tasks while typing: {n, max, sum}
async function typeSlowly(text, gap) {
  const t0 = await ev('performance.now()');
  for (const ch of text) { await type(ch); await sleep(gap); }
  const lt = ((await ev('window.__lt')) || []).filter(([s]) => s >= t0);
  return { keys: [...text].length, builds: await ev('window.__nb'), n: lt.length, max: Math.round(Math.max(0, ...lt.map(([, d]) => d))), sum: Math.round(lt.reduce((x, [, d]) => x + d, 0)) };
}
const ZETA = { shapes: [{ id: 's1', kind: 'rect', a: [1.5, -6], b: [5, 6], ci: 0, visible: true }], steps: [{ type: 'series', params: { kind: 'dirichlet', an: '1', c: '0' }, on: true }] };
const ZETA3 = 1.2020569031595942, ZETA5 = 1.0369277551433699;

// ---- A: typing a_n of ζ: one rebuild per pause, Enter applies at once, one Undo step
await openApp(ZETA);
ok('A the a_n field is there', await focusField('an'), null);
const n0 = (await ev('__cmwP()')).n;
info.typed = await typeSlowly('\\frac{1}{n^2}', 60);
ok('A one rebuild per pause, not per key (fewer than half the keys rebuilt the chain)', info.typed.builds < info.typed.keys / 2, info.typed);
await key('Enter'); await settle(300);
const pA = await ev('__cmwP()');
ok('A Enter applies the typed a_n', pA.steps[0].params.an === '\\frac{1}{n^2}', pA.steps[0].params.an);
ok('A … and F is Σ n^(−2−z): F(3) = ζ(5)', near(await F([3, 0]), ZETA5), await F([3, 0]));
ok('A the edit is one Undo step', pA.n === n0 + 1, [n0, pA.n]);
await ev(`document.getElementById('undoBtn').click()`); await settle(600);
ok('A one Undo brings a_n = 1 back', (await ev('__cmwP()')).steps[0].params.an === '1' && near(await F([3, 0]), ZETA3), [(await ev('__cmwP()')).steps[0].params.an, await F([3, 0])]);

await type('2'); await key('Enter'); await settle(600);
info.afterUndo = await ev(`[__cmwP().steps[0].params.an, document.querySelector('input[data-pkey="an"]').value]`);
ok('A after an Undo while the field has the focus, typing in it edits the chain\'s step', info.afterUndo[0] === info.afterUndo[1] && /2$/.test(info.afterUndo[0]), info.afterUndo);
await ev(`document.getElementById('undoBtn').click()`); await settle(600);

// ---- B: two quick edits: the later one is the picture; the field's change applies a pending edit at once
await focusField('an');
await ev(`(() => { const i = document.querySelector('input[data-pkey="an"]'); i.value = '\\\\frac{1}{n^2}'; i.dispatchEvent(new Event('input', { bubbles: true })); i.value = '1'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
await settle(1200);
ok('B of two quick edits the later one is the chain: F(3) = ζ(3)', near(await F([3, 0]), ZETA3), await F([3, 0]));
await ev(`(() => { const i = document.querySelector('input[data-pkey="an"]'); i.value = '\\\\frac{1}{n^2}'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
info.changeNow = await F([3, 0]);
info.changeAn = await ev(`[__cmwP().steps[0].params.an, [...document.querySelectorAll('input[data-pkey="an"]')].map((i) => [i.id, i.value, i.isConnected])]`);
ok('B Enter or leaving the field (its change) applies a pending edit at once', near(info.changeNow, ZETA5), [info.changeNow, info.changeAn]);
await settle(600);

// ---- C: a formula step stays synchronous
await openApp({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }], steps: [{ type: 'custom', params: { expr: 'z^2+1' }, on: true }] });
info.sync = await ev(`(() => { const i = document.querySelector('input[data-pkey="expr"]'); if (!i) return null; i.focus(); i.value = 'z^3+1'; i.dispatchEvent(new Event('input', { bubbles: true })); return __cmwEval('F', null, [[2, 0]])[0]; })()`);
ok('C a formula\'s field is the chain at once (F(2) = 9 within the input event)', near(info.sync, 9), info.sync);
await ev(`document.querySelector('input[data-pkey="expr"]').blur(); 1`);
info.control = await (async () => { await focusField('expr'); return typeSlowly('\\frac{1}{z^2+1}', 60); })();
await key('Enter'); await settle(600);

// ---- D: a number in a_n on its slider: the drag keeps its slider, the picture follows the number
await openApp({ shapes: ZETA.shapes, params: [{ name: 'a', value: 0.5, min: 0, max: 2, step: 0.01 }], steps: [{ type: 'series', params: { kind: 'dirichlet', an: '\\frac{1}{n^2+a}', c: '0' }, on: true }] });
const R = await ev(`(() => { const g = document.querySelector('input[type=range][data-prm-focus="r:a"]'); if (!g) return null; g.scrollIntoView({ block: 'center' }); const b = g.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
ok('D the slider of a is there', !!R && R[2] > 0, R);
if (R && R[2] > 0) {
  await ev(`(() => { window.__fr = []; window.__frOn = true; let last = performance.now(); const f = (t) => { window.__fr.push(t - last); last = t; if (window.__frOn) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
  const y = R[1] + R[3] / 2;
  await drag(R[0] + R[2] * 0.25, y, R[0] + R[2] * 0.75, y, 30, 16);
  await ev('window.__frOn = false; 1');
  const fr = ((await ev('window.__fr')) || []).slice(1).sort((x, y2) => x - y2);
  info.drag = { frames: fr.length, med: +(fr[Math.floor(fr.length / 2)] || 0).toFixed(1), a: await ev(`Params.get('a')`) };
  ok('D the first drag after the page opens takes a to the pointer, about 1.5 (the panel is not redrawn under it)', Math.abs(info.drag.a - 1.5) < 0.1, info.drag);
  await settle(1200);
  // Σ 1/((n² + a) n^z) at z = 3 against the series summed here (absolutely convergent: 4096 terms leave < 1e-10)
  const a = await ev(`Params.get('a')`);
  let s = 0; for (let n = 1; n <= 4096; n++) s += 1 / ((n * n + a) * n ** 3);
  info.dragF = [await F([3, 0]), s];
  ok('D after the drag the picture is the number\'s: F(3) = Σ 1/((n² + a) n³)', !!info.dragF[0] && Math.abs(info.dragF[0][0] - s) < 1e-8, info.dragF);
}

// ---- timing, relative to the formula step on the same machine (reported, not gated, in software CI)
ok('timing: typing a_n of ζ blocks the page no longer than typing a formula of the same length', info.typed.sum <= Math.max(200, info.control.sum), { series: info.typed, formula: info.control });
ok('timing: no task of 150 ms or more while typing a_n', info.typed.max < 150, info.typed);
await grab();
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
