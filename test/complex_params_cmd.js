// Complex shared numbers in the real app (src/params.js; issue #10): a number a = 1 + i read by a Möbius step and a custom
// formula; the CPU map follows it; the GPU picture at rest equals a fresh load of the same saved state (the value is a
// uniform: changing it never recompiles the program); typing a new value in the row is one undo step and undo brings the
// old one back; a link, a reload and a scene file keep the imaginary part; a real number still saves without `im`.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/complex_params_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const P = () => ev('__cmwP()');
const NS = 'cxprm' + (Date.now() % 1000000);
const STATE = (im) => ({
  shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.6, ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: 'a', c: '0', d: '1' }, on: true }, { type: 'custom', params: { expr: 'conj(a) z' }, on: true }],
  params: [{ name: 'a', value: 1, im, min: -2, max: 2, step: 0.01 }],
  srcView: { cx: 0, cy: 0, s: 80 }, pattern: 'checker', v5: true, v6: true,
});
const typeIn = async (sel, text) => {
  const r = await ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; el.scrollIntoView({block:'nearest'}); el.focus(); el.select && el.select(); return true})()`);
  if (!r) return false;
  await ev(`(()=>{const el=document.activeElement; el.value=''; el.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`);
  await type(text);
  await key('Enter');
  await ev(`(()=>{const el=document.activeElement; if (el && el.blur) el.blur(); return 1})()`);
  await settle(300);
  return true;
};
const stage = (k, re, im) => ev(`__cmwPlaneMenu().stage(${k}, ${re}, ${im})`);
const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

await view(1440, 900, false, false);
await load(NS, STATE(1));
await settle(1000);
const origin = await ev('location.origin');
await grab();

// 1. the saved number reads as 1 + i: the CPU map (b = a, then conj(a) z)
let s = await P();
ok('a = 1 + i loads with its imaginary part', s.params.length === 1 && s.params[0].value === 1 && s.params[0].im === 1, s.params);
ok('no step error', s.errors.every((e) => !e), s.errors);
ok('step 1: z + a at 0 is 1 + i', near(await stage(1, 0, 0), [1, 1]), await stage(1, 0, 0));
ok('step 2: conj(a) (z + a) at 0 is 2', near(await stage(2, 0, 0), [2, 0]), await stage(2, 0, 0));
ok('the row shows the value as text', (await ev(`document.querySelector('.prm-row[data-name="a"] .prm-val').value`)).replace('−', '-') === '1+i', null);
ok('a complex number has no slider and cannot play', await ev(`(()=>{ const r = document.querySelector('.prm-row[data-name="a"]'); return !r.querySelector('input[type=range]') && r.querySelector('.prm-play').disabled; })()`), null);
const glKey = async () => (await ev('__cmwZp().glKey'));
const key1 = await glKey();

// 2. typing a new value in the row: one undo step; the program is not rebuilt; the picture equals a fresh load
const hi0 = s.hi;
await typeIn('.prm-row[data-name="a"] .prm-val', '1 - i');
s = await P();
ok('typing 1 - i sets im = -1', s.params[0].value === 1 && s.params[0].im === -1, s.params);
ok('the program key is unchanged (the value is a uniform)', key1 && (await glKey()) === key1, { was: key1, now: await glKey() });
ok('step 2 follows: conj(1 - i) (z + 1 - i) at 0 is 2', near(await stage(2, 0, 0), [2, 0]), await stage(2, 0, 0));
ok('typing the value is one undo step', s.hi === hi0 + 1, { hi: s.hi, was: hi0 });
await settle(600);
const restL = await ev(`__cmwRenderOff('L', 320, 240, 1)`), restR = await ev(`__cmwRenderOff('R', 320, 240, 1)`);
await ev('new Promise((r) => setTimeout(r, 400))');
await load(NS + 'f', STATE(-1));
await settle(1500);
const freshL = await ev(`__cmwRenderOff('L', 320, 240, 1)`), freshR = await ev(`__cmwRenderOff('R', 320, 240, 1)`);
ok('rest frame after the edit = a fresh load of the same value (X)', restL === freshL, restL.length + ' vs ' + freshL.length);
ok('rest frame after the edit = a fresh load of the same value (Y)', restR === freshR, restR.length + ' vs ' + freshR.length);
ok('the picture really depends on im', freshR !== (await (async () => { await load(NS + 'g', STATE(1)); await settle(1500); return ev(`__cmwRenderOff('R', 320, 240, 1)`); })()), null);

// 3. undo and redo bring the imaginary part back
await load(NS, STATE(1));
await settle(1000);
await typeIn('.prm-row[data-name="a"] .prm-val', '1 - i');
await key('z', 2);
await settle(500);
s = await P();
ok('undo restores a = 1 + i', s.params[0].im === 1, s.params);
await key('z', 2 | 8);
await settle(500);
s = await P();
ok('redo gives 1 - i again', s.params[0].im === -1, s.params);
// a real value clears the imaginary part (an older build and a real link see the same entry as before)
await typeIn('.prm-row[data-name="a"] .prm-val', '0.5');
s = await P();
ok('a real value drops im', s.params[0].value === 0.5 && !('im' in s.params[0]), s.params);
await typeIn('.prm-row[data-name="a"] .prm-val', '0.5 + 0.25i');
s = await P();
ok('0.5 + 0.25i', s.params[0].value === 0.5 && s.params[0].im === 0.25, s.params);

// 4. a link and a scene file keep it (the link is decoded and opened in the page, over a figure with a different number)
const figure = s.figure;
const payload = await ev(`await Params.encodeLink(__cmwP().figure)`);
await load(NS + 'l', STATE(-2));
await settle(1000);
ok('before the link the number is -2i', (await P()).params[0].im === -2, (await P()).params);
await ev(`(async () => { __cmwPOpen(await Params.decodeLink(${JSON.stringify(payload)}), 'link'); return 1; })()`);
await settle(2000);
const L = await P();
ok('a link opens with the imaginary part', L.params.length === 1 && L.params[0].value === 0.5 && L.params[0].im === 0.25, L.params);
ok('the link figure equals the original', JSON.stringify(L.figure.params) === JSON.stringify(figure.params) && JSON.stringify(L.figure.steps) === JSON.stringify(figure.steps), null);
const scene = await ev(`Params.scene(__cmwP().figure)`);
ok('a scene file keeps it', JSON.stringify(await ev(`Params.readScene(${JSON.stringify(scene)}).params`)) === JSON.stringify(figure.params), null);

// 5. a real number saves as before
await load(NS + 'r', { shapes: [], steps: [{ type: 'mobius', params: { a: '1', b: 'a', c: '0', d: '1' }, on: true }], params: [{ name: 'a', value: 0.5, min: -2, max: 2, step: 0.01 }], srcView: { cx: 0, cy: 0, s: 80 }, v5: true, v6: true });
await settle(1000);
s = await P();
ok('a real number has no im', s.params.length === 1 && !('im' in s.params[0]), s.params);
ok('a real number keeps its slider', await ev(`!!document.querySelector('.prm-row[data-name="a"] input[type=range]')`), null);
// a formula number follows a complex one, and a real-only field names the culprit
await load(NS + 'q', STATE(1));
await settle(1000);
const msg = await ev(`Params.set('a', 'a')`);
ok('a refused self reference', /depend on itself/.test(msg), msg);
const e2 = await ev(`(()=>{ try { Params.evalReal('a'); return ''; } catch (e) { return e.message; } })()`);
ok('a real-only field names the complex number', /a is complex: use Re a, Im a or \|a\|/.test(e2), e2);
// a bound region formula that reads a complex number as a real says so and is not drawn (it would read Re a silently)
await load(NS + 'u', { shapes: [{ id: 'f1', kind: 'formula', expr: 'Re z < 0.5', bind: { expr: 'Re z < a' }, ci: 0, visible: true }], steps: [], params: [{ name: 'a', value: 0.5, im: 0.3, min: -2, max: 2, step: 0.01 }], srcView: { cx: 0, cy: 0, s: 110 }, v5: true, v6: true });
await settle(1000);
s = await P();
const f1 = s.shapes.find((x) => x.id === 'f1');
ok('a comparison with a complex number is undefined, with the hint', !!f1 && /a is complex: use Re a, Im a or \|a\|/.test(f1.undef || ''), f1);
await ev(`Params.set('a', 0.25)`);
await settle(500);
ok('and it is drawn again once a is real', !(await P()).shapes.find((x) => x.id === 'f1').undef, (await P()).shapes);
await grab();
ok('no exceptions', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
