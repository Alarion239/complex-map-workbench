// State keys of a saved state or a link, read back and seen in the steps view: the v3, v4, v5 and v6 migrations, a shape
// that cannot be drawn, the next id, and meshN (the steps view's frame differs from the default one's).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = 30000) => settled({ until: expr, max });
const quiet = () => settled({});
const ns = 'ssk' + Date.now();
const lsKey = `complex-map-workbench-v1:${ns}`;
const CHAIN = [{ type: 'exp', params: {}, on: true }, { type: 'pown', params: { n: 2 }, on: true }];
const RECT = { id: 'r1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2], ci: 0 };
// the state is written under the key as given (no version flags added): the load decides what a missing one means
const open = async (st, url = `?ns=${ns}&lang=en&view=steps`, hash = '') => {
  await view(1440, 900, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem(${JSON.stringify(lsKey)}, ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html${url}${hash}`);
  const ready = await until("typeof __cmwKeys === 'function' && typeof __cmwSteps === 'function' && __cmwSteps().on && __cmwSteps().planes.length > 1 && !!document.querySelector('#paneL canvas')");
  // a wait that ran out is a failure of its own, with what the page was still waiting for, not a read of a page without the hooks
  if (!ready.ok) fails.push({ name: `the page is ready: ${url}${hash.slice(0, 12)}`, got: ready });
  await quiet();
  return ev('__cmwKeys()');
};
const FLAGS = { v3: true, v4: true, v5: true, v6: true };
const base = (extra) => Object.assign({ shapes: [Object.assign({}, RECT)], steps: CHAIN, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } }, extra);

// ---- the migrations: a key left out is migrated, the same key present is kept
let k = await open(base(Object.assign({}, FLAGS, { alpha: 0.4, meshN: 480 })));
info.kept = k;
ok('v3 to v6 present: alpha is kept', k.alpha === 0.4, k);
ok('v3 to v6 present: meshN is kept', k.meshN === 480, k);
k = await open(base({ v4: true, v5: true, v6: true, alpha: 0.4, meshN: 480 }));
info.noV3 = k;
ok('v3 missing: meshN is 240', k.meshN === 240, k);
ok('v3 missing: alpha is kept', k.alpha === 0.4, k);
ok('v3 missing: the flag is set', k.v3 === true, k);
const palette = ['#2f6fdb', '#e0532f', '#169a68', '#8b55d8', '#cf9213', '#0e93a6', '#d4467e', '#61748a'];
const old4 = (extra) => base(Object.assign({ v3: true, v5: true, v6: true, alpha: 0.4, meshN: 480, shapes: [{ id: 'r1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2], color: palette[3] }, { id: 'r2', kind: 'rect', a: [0, 0], b: [1, 1] }] }, extra));
k = await open(old4({}));
info.noV4 = k;
ok('v4 missing: alpha is 0.85', k.alpha === 0.85, k);
ok('v4 missing: meshN is 240', k.meshN === 240, k);
ok('v4 missing: a palette colour becomes its index', k.shapeCi[0] === 3 && k.shapeColor[0] === null, k);
ok('v4 missing: a shape with no colour gets index 0', k.shapeCi[1] === 0, k);
ok('v4 missing: the flag is set', k.v4 === true, k);
k = await open(old4({ v4: true }));
ok('v4 present: alpha and meshN are kept', k.alpha === 0.4 && k.meshN === 480, k);
// ---- out-of-range settings are clamped on load: alpha to 0.2..1, meshN to 80..1920
const clamp = async (extra) => open(base(Object.assign({}, FLAGS, extra)));
k = await clamp({ alpha: 5 });
ok('alpha 5 is clamped to 1', k.alpha === 1, k);
k = await clamp({ alpha: 0 });
ok('alpha 0 is clamped to 0.2', k.alpha === 0.2, k);
k = await clamp({ alpha: -1 });
ok('alpha -1 is clamped to 0.2', k.alpha === 0.2, k);
k = await clamp({ meshN: 1e6 });
ok('meshN 1e6 is clamped to 1920', k.meshN === 1920, k);
k = await clamp({ meshN: 3 });
ok('meshN 3 is clamped to 80', k.meshN === 80, k);
const tgt = [{ id: 't0', kind: 'point', p: [0, 0] }, { id: 't1', kind: 'point', p: [1, 0] }, { id: 't2', kind: 'point', p: [0, 0], label: 'origin' }];
k = await open(base({ v3: true, v4: true, v6: true, targets: tgt }));
info.noV5 = k;
ok('v5 missing: the untouched default target t0 is dropped', k.targetIds.join() === 't1,t2' && k.v5 === true, k);
k = await open(base(Object.assign({}, FLAGS, { targets: tgt })));
ok('v5 present: t0 is kept', k.targetIds.join() === 't0,t1,t2', k);
k = await open(base({ v3: true, v4: true, v5: true }));
ok('v6 missing: the flag is set', k.v6 === true, k);
k = await open(base(Object.assign({}, FLAGS, { v6: false })));
ok('v6 odd: the flag is set', k.v6 === true, k);

// ---- a shape that cannot be drawn is dropped, the others stay
const mixed = [
  { id: 's1', kind: 'rect', a: [-1, -1], b: [1, 1] },
  { id: 's2', kind: 'rect', a: [-1, -1] },
  { id: 's3', kind: 'formula', expr: 7 },
  { id: 's4', kind: 'curve', pts: [[0, 0]] },
  { id: 's5', kind: 'polygon', pts: [[0, 0], [1, 0]] },
  { id: 's6', kind: 'curve', pts: [[0, 0], [1, 'x']] },
  { id: 's7', kind: 'dhray', theta: 'bad' },
  { id: 's8', kind: 'nothing' },
  { id: 's9', kind: 'formula', expr: 'z' },
  { id: 's10', kind: 'curve', pts: [[0, 0], [1, 1]] },
];
k = await open(base(Object.assign({}, FLAGS, { shapes: mixed })));
info.shapeOk = k;
ok('shapeOk: only the shapes that can be drawn stay', k.shapeIds.join() === 's1,s9,s10', k);

// ---- the next id: past every id in use, kept when higher, a shape with no id gets one
k = await open(base(Object.assign({}, FLAGS, { nextId: 2, shapes: [{ id: 's3', kind: 'rect', a: [0, 0], b: [1, 1] }, { id: 's7', kind: 'rect', a: [1, 1], b: [2, 2] }] })));
info.nextId = k;
ok('nextId: lower than an id in use, it moves past it', k.nextId === 8, k);
k = await open(base(Object.assign({}, FLAGS, { nextId: 50 })));
ok('nextId: higher than any id in use, it is kept', k.nextId === 50, k);
k = await open(base(Object.assign({}, FLAGS, { nextId: 'x', shapes: [{ id: 's4', kind: 'rect', a: [0, 0], b: [1, 1] }] })));
ok('nextId: not a number, it is one past the highest id', k.nextId === 5, k);
k = await open(base(Object.assign({}, FLAGS, { nextId: 9.7, shapes: [{ kind: 'rect', a: [0, 0], b: [1, 1] }, { id: 's1', kind: 'rect', a: [1, 1], b: [2, 2] }, { id: 's1', kind: 'rect', a: [2, 2], b: [3, 3] }] })));
info.noId = k;
ok('nextId: a shape with no id, or a repeated one, gets the next ids in order', k.shapeIds.join() === 's9,s1,s10' && k.nextId === 11, k);

// ---- a link carries the keys
await open(base(Object.assign({}, FLAGS, { alpha: 0.4, meshN: 480 })));
await ev(`(window.__lnk = null, Params.encodeLink(JSON.parse(localStorage.getItem(${JSON.stringify(lsKey)}))).then((p) => { window.__lnk = p; }), 1)`);
await until("typeof window.__lnk === 'string'", 10000);
const payload = await ev('window.__lnk');
k = await open(base(Object.assign({}, FLAGS)), `?ns=${ns}b&lang=en&view=steps`, `#cmw=${payload}`);
info.link = k;
ok('a link carries alpha and meshN', k.alpha === 0.4 && k.meshN === 480, k);

// ---- the steps view shows meshN: its frame differs from the default one's (alpha is read back above; the steps view's
// frame does not change with it, so no check here claims it does)
const hide = (on) => ev(`(() => { let s = document.getElementById('qaNoToast'); if (!s) { s = document.createElement('style'); s.id = 'qaNoToast'; document.head.append(s); } s.textContent = ${on} ? '#toastHost{visibility:hidden!important} .tip,[role=tooltip]{display:none!important}' : ''; return 1; })()`);
const pane = async () => { await ev('__cmwSteps({ bare: true })'); await hide(true); await quiet(); const r = await ev(`(() => { const r = document.getElementById('paneL').getBoundingClientRect(); const h = document.querySelector('#paneL .pane-head'); const t = h ? h.getBoundingClientRect().bottom + 2 : r.top; return { x: Math.round(r.left) + 2, y: Math.round(t) + 90, width: Math.round(r.width) - 4, height: Math.round(r.bottom - t - 210) }; })()`); const i = await img(r); await hide(false); await ev('__cmwSteps({ bare: false })'); return i; };
const diff = (a, b) => { if (a.w !== b.w || a.h !== b.h) return -1; let n = 0; for (let j = 0; j < a.data.length; j += a.ch) if (Math.abs(a.data[j] - b.data[j]) > 8 || Math.abs(a.data[j + 1] - b.data[j + 1]) > 8 || Math.abs(a.data[j + 2] - b.data[j + 2]) > 8) n++; return n; };
const frame = async (extra) => { await open(base(Object.assign({}, FLAGS, extra))); return pane(); };
const g0 = await frame({});
const g0b = await frame({});
info.defaultVsDefault = diff(g0, g0b);
const gm = await frame({ meshN: 80 });
info.meshPx = diff(g0, gm);
ok('the steps view frame is the same on a second load of the same state', info.defaultVsDefault === 0, info.defaultVsDefault);
ok('meshN 80: the steps view frame differs from the default', info.meshPx > 50, info.meshPx);

const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass, fails, info };
