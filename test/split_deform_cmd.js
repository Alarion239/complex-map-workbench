// The parts of the formula-in-steps Split that the steps view has no equivalent for yet, in the classic views: the Split
// with the Deformation open (the frame stays and T moves from 1.5 to 2.5), the alone walk ‹ › of a step shown alone,
// and the frame times of the Deformation playing 12 split sines. split_cmd.js runs the rest in the steps view.
// A command file for the CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/split_deform_cmd.js
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = (ns, q = '') => `http://localhost:${PORT}/test.html?ns=${ns}${q}`;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const settle = async (ms = 350) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const DESKUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SHAPES = [{ id: 's1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2] }];
const F1 = (expr, cut = 180) => ({ type: 'custom', params: { expr, cut }, on: true });
async function open(ns, st, q = '') {
  // (a page without the app first: the app saves its state when it unloads, which would overwrite this one)
  await send('Page.navigate', { url: `http://localhost:${PORT}/blank-${ns}.html` }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: SHAPES, steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.clear(); localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await nav(U(ns, q)); await settle(2200);
}
const steps = () => ev('__cmwP().steps');
const hideToasts = (on) => ev(`(() => { let s = document.getElementById('qaNoToast'); if (!s) { s = document.createElement('style'); s.id = 'qaNoToast'; document.head.append(s); } s.textContent = ${on} ? '#toastHost{visibility:hidden!important} .tip,[role=tooltip]{display:none!important}' : ''; return 1; })()`);
// the planes (below their heads, whose titles name the step count), as pixels
const planesRect = () => ev(`(() => { const out = []; for (const id of ['paneL', 'paneR']) { const p = document.getElementById(id); if (!p || !p.getClientRects().length) continue; const r = p.getBoundingClientRect(); if (r.width < 10) continue; const hd = p.querySelector('.pane-head'); const top = hd ? hd.getBoundingClientRect().bottom + 2 : r.top; const ft = p.querySelector('.pane-foot, .opts'); out.push({ x: Math.round(r.left) + 2, y: Math.round(top), width: Math.round(r.width) - 4, height: Math.round(r.bottom - top - 44) }); } return out; })()`);
async function planes() { await hideToasts(true); await settle(1800); const rs = await planesRect(); const out = []; for (const r of rs) out.push(await img(r)); await hideToasts(false); return out; }
function diff(a, b) {
  if (a.length !== b.length) return -1;
  let n = 0;
  for (let i = 0; i < a.length; i++) { const p = a[i], q = b[i]; if (p.w !== q.w || p.h !== q.h) return -1; for (let j = 0; j < p.data.length; j += p.ch) if (Math.abs(p.data[j] - q.data[j]) > 8 || Math.abs(p.data[j + 1] - q.data[j + 1]) > 8 || Math.abs(p.data[j + 2] - q.data[j + 2]) > 8) n++; }
  return n;
}

await send('Emulation.setUserAgentOverride', { userAgent: DESKUA, acceptLanguage: 'en-US,en' });
await view(1440, 900, false, false);

await open('fsC', { steps: [{ type: 'exp', params: {}, on: true }, F1('\\sin(z^2+1)'), { type: 'mul', params: { c: '2' }, on: true }] });
{
  // the deformation open at T = 1.5
  await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
  await ev('__cmwMorph({ T: 1.5 })'); await settle(1200);
  await clickSel('#pipeline .card[data-k="2"]'); await settle(500);
  const q0 = await planes();
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(400);
  const T = (await ev('__cmwMorph({})')).T;
  ok('deformation: T 1.5 -> 2.5', Math.abs(T - 2.5) < 1e-12, T);
  const q1 = await planes();
  info.morphPx = diff(q0, q1);
  ok('deformation: the frame is unchanged', info.morphPx === 0, info.morphPx);
  await shot('split-morph');
  await ev('__cmwMorph({ open: false })'); await settle(300);
}
await grab();

// ---------------- 8. the alone walk ----------------
await open('fsF', { steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '1' }, on: true }, { type: 'sin', params: {}, on: true }] });
{
  await clickSel('#pipeline .card[data-k="1"]'); await settle(400);
  await key('l'); await settle(500);
  const st = async () => ev(`({ f: __cmwCards().focus, prev: document.querySelector('#aloneChip .ac-nav.prev').disabled, next: document.querySelector('#aloneChip .ac-nav.next').disabled })`);
  const seq = [await st()];
  for (let i = 0; i < 3; i++) { await clickSel('#aloneChip .ac-nav.next'); await settle(300); seq.push(await st()); }
  await clickSel('#aloneChip .ac-nav.prev'); await settle(300); seq.push(await st());
  ok('alone walk: 1 → 2 → 3 → 3 → 2, ends disabled', seq.map((x) => x.f).join() === '1,2,3,3,2' && seq[0].prev && !seq[0].next && seq[2].next && !seq[2].prev, seq);
  await shot('split-alone-chip', { x: 260, y: 40, width: 460, height: 60 });
}
await grab();

// ---------------- 14. frame times: 12 nested sines, the deformation open ----------------
{
  let e = 'z'; for (let i = 0; i < 12; i++) e = `\\sin(${e})`;
  await open('fsS', { steps: [F1(e)] });
  await clickSel('#pipeline .card[data-k="1"]'); await settle(700);
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(1500);
  ok('12 sines: 12 steps', (await steps()).length === 12);
  await ev('__cmwMorph({ open: true, playing: true })'); await settle(1500);
  info.sines12 = await ev('await __qa.frames(3000)');
  await ev('__cmwMorph({ open: false })');
  ok('12 sines, the deformation playing: p95 ≤ 20 ms', info.sines12.p95 <= 20, info.sines12);
}

await grab();
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass, fails, info };
