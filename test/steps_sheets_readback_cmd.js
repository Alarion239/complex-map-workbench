// All sheets in the steps view on the user's case, a Landscape of a chain √z then sin: the readback says what is drawn
// (two surfaces of the two sheets, "both sheets" in the title, no deformation), the CPU twin's two surfaces are
// sin √z and its negative (distinct); with All sheets off no sheet set is drawn.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const READY = "typeof __cmwLandSheets === 'function' && typeof __cmwSteps === 'function' && !!window.GLR";
const SHEETS = 2;                    // sin √z has the two sheets of √
const GRID = 7, HALF = 3;            // the CPU twin's grid: GRID x GRID points over [-HALF, HALF]^2, the origin left out
const DISTINCT = 0.1;                // the two surfaces differ by more than this at the median point
const EXACT = 1e-9;                  // sin(-w) = -sin w to rounding
const CHAIN = [{ type: 'root', params: { n: 2, cut: 180 }, on: true }, { type: 'sin', params: {}, on: true }];
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const read = () => ev(`(() => { const s = __cmwLandSheets();
  return { K: s.drawn && s.drawn.K, total: s.drawn && s.drawn.total, hom: s.drawn && s.drawn.hom, title: s.title.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim() }; })()`);
await view(1440, 900, false, false);
const ns = 'sheetsrb' + Date.now();
await loadView('steps', ns, { shapes: [{ id: 's1', kind: 'rect', a: [-HALF, -HALF], b: [HALF, HALF] }], steps: CHAIN, sheets: true, height: 'im' });
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 30000, until: READY });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
await settled({ max: 60000 });

// the readback at the first plane
await rest(0);
const r0 = await read();
info.rest0 = r0;
ok('at z: two surfaces drawn', r0.K === SHEETS && r0.total === SHEETS, r0);
ok('at z: they are the map\'s sheets, not a deformation', r0.hom === false, r0);
ok('the title says both sheets', /both sheets/.test(r0.title), r0.title);

// the CPU twin: sin √z on the two sheets, one the negative of the other
const twin = await ev(`(() => { const p = __cmwP(), b = p.steps.map((s) => Funcs.build(s)), d = [], sum = [];
  for (let j = 0; j < ${GRID}; j++) for (let i = 0; i < ${GRID}; i++) { const z = CX.C(-${HALF} + i, -${HALF} + j); if (Math.hypot(z.re, z.im) < 1e-9) continue;
    const a = Funcs.sheetEval(p.steps, b, p.steps.length, z, z, 0, 2), c = Funcs.sheetEval(p.steps, b, p.steps.length, z, z, 1, 2);
    d.push(Math.hypot(a.re - c.re, a.im - c.im)); sum.push(Math.hypot(a.re + c.re, a.im + c.im)); }
  d.sort((x, y) => x - y); sum.sort((x, y) => x - y);
  return { n: d.length, median: d[d.length >> 1], min: d[0], sumMax: sum[sum.length - 1], combos: Funcs.sheetCombos(p.steps, b) }; })()`);
info.twin = twin;
ok('the twin counts the two surfaces', twin.combos === SHEETS, twin);
ok('the twin\'s grid has every point but the origin', twin.n === GRID * GRID - 1, twin);
ok('the two surfaces are sin √z and its negative', twin.sumMax < EXACT, twin);
ok('and they differ', twin.median > DISTINCT && twin.min > 0, twin);

// All sheets off, from the plane's options: the principal surface alone
await rest(0);
await ev(`(() => {
  if (!document.getElementById('sheetsChk')) { const b = document.querySelector('#leftFoot .opts-btn:not(.pat-btn)'); if (b) b.click(); }
  const c = document.getElementById('sheetsChk'); if (c) c.click();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return !!c;
})()`);
await settled({ max: 60000 });
await rest(0);
const off = await read();
info.off = off;
ok('with All sheets off: no sheet set is drawn', off.K === null && !/both sheets/.test(off.title), off);

return { pass: fails.length === 0, fails, info };
