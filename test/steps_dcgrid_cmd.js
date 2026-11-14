// dcGrid of a saved state, seen in the steps view: the grid step of the colour plot when the colour is the grid style.
// It is read back through the frame's pixels (the steps view has no hook that reports the value), so each case compares
// two loads: the same state with two grid steps differs, the same step twice does not, a step that cannot be used loads
// as the default 0.5, and the colour styles that draw no grid do not change with it.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = 30000) => settled({ until: expr, max });
const quiet = () => settled({});
const ns = 'sdg' + Date.now();
const lsKey = `complex-map-workbench-v1:${ns}`;
const CHAIN = [{ type: 'exp', params: {}, on: true }, { type: 'pown', params: { n: 2 }, on: true }];
const RECT = { id: 'r1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2], ci: 0 };
const FLAGS = { v3: true, v4: true, v5: true, v6: true };
const base = (extra) => Object.assign({ shapes: [Object.assign({}, RECT)], steps: CHAIN, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } }, FLAGS, extra);
const open = async (st) => {
  await view(1440, 900, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem(${JSON.stringify(lsKey)}, ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  const ready = await until("typeof __cmwSteps === 'function' && __cmwSteps().on && __cmwSteps().planes.length > 1 && !!document.querySelector('#paneL canvas')");
  if (!ready.ok) fails.push({ name: 'the page is ready', got: ready });
  await quiet();
};
const hide = (on) => ev(`(() => { let s = document.getElementById('qaNoToast'); if (!s) { s = document.createElement('style'); s.id = 'qaNoToast'; document.head.append(s); } s.textContent = ${on} ? '#toastHost{visibility:hidden!important} .tip,[role=tooltip]{display:none!important}' : ''; return 1; })()`);
const pane = async () => { await ev('__cmwSteps({ bare: true })'); await hide(true); await quiet(); const r = await ev(`(() => { const r = document.getElementById('paneL').getBoundingClientRect(); const h = document.querySelector('#paneL .pane-head'); const t = h ? h.getBoundingClientRect().bottom + 2 : r.top; return { x: Math.round(r.left) + 2, y: Math.round(t) + 90, width: Math.round(r.width) - 4, height: Math.round(r.bottom - t - 210) }; })()`); const i = await img(r); await hide(false); await ev('__cmwSteps({ bare: false })'); return i; };
const diff = (a, b) => { if (a.w !== b.w || a.h !== b.h) return -1; let n = 0; for (let j = 0; j < a.data.length; j += a.ch) if (Math.abs(a.data[j] - b.data[j]) > 8 || Math.abs(a.data[j + 1] - b.data[j + 1]) > 8 || Math.abs(a.data[j + 2] - b.data[j + 2]) > 8) n++; return n; };
const frame = async (extra) => { await open(base(extra)); return pane(); };

const g01 = await frame({ dc: 'grid', dcGrid: 0.1 });
const g05 = await frame({ dc: 'grid', dcGrid: 0.5 });
const g20 = await frame({ dc: 'grid', dcGrid: 2 });
const g05b = await frame({ dc: 'grid', dcGrid: 0.5 });
const gBad = await frame({ dc: 'grid', dcGrid: 0 });
info.p01vs05 = diff(g01, g05);
info.p05vs20 = diff(g05, g20);
info.p05vs05 = diff(g05, g05b);
info.zeroVs05 = diff(gBad, g05);
ok('dcGrid 0.1 and 0.5 draw different grids in the steps view', info.p01vs05 > 50, info.p01vs05);
ok('dcGrid 0.5 and 2 draw different grids in the steps view', info.p05vs20 > 50, info.p05vs20);
ok('dcGrid 0.5 on a second load is the same frame', info.p05vs05 === 0, info.p05vs05);
ok('dcGrid 0 is not used: it loads as 0.5', info.zeroVs05 === 0, info.zeroVs05);

// the grid step draws nothing in the enhanced style: the same two steps give the same frame there
const e01 = await frame({ dc: 'enhanced', dcGrid: 0.1 });
const e20 = await frame({ dc: 'enhanced', dcGrid: 2 });
info.enhanced = diff(e01, e20);
ok('dcGrid does not change the enhanced colour', info.enhanced === 0, info.enhanced);

const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass, fails, info };
