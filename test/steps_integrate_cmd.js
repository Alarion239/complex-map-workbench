// The steps view's Integrate: with several curves and none selected the palette asks which curve (one row each,
// nothing opens by itself); choosing a row opens the integral beside that curve; one curve gives one row.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const BASE = `http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}`;
const NS_MOD = 100000, VIEW_W = 1366, VIEW_H = 768, WAIT_MS = 10000;
const NS = 'svint' + (Date.now() % NS_MOD);
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// (waits on the condition the next check reads: a wait that runs out is reported by the kit)
const until = (expr, max = WAIT_MS) => settled({ until: expr, max });
const quiet = () => settled({ max: WAIT_MS });
const CURVES = [{ id: 'Z', kind: 'circle', c: [-1.2, 0], r: 0.3, ci: 2, visible: true }, { id: 'A', kind: 'circle', c: [0, 0], r: 0.8, ci: 0, visible: true }, { id: 'B', kind: 'circle', c: [1.2, 0.4], r: 0.5, ci: 1, visible: true }];
const STEP = { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true };
const openPal = async () => { await key('k', 4); await settled({ until: `!!document.querySelector('#popHost .palette') && !!document.getElementById('palInput')`, only: true }); };
const palQ = async (q) => {
  await ev(`(() => { const i = document.getElementById('palInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); })()`);
  await settled({ until: `(() => { const i = document.getElementById('palInput'); return !!i && i.value === ${JSON.stringify(q)} && !!document.querySelector('#popHost .palette .pal-item'); })()`, only: true });
};
const INT_ROW = /^(∮ .* around |Integrate .* along )/;   // the palette also lists the Integrals guide, which is not a curve row
const rows = async () => (await ev(`[...document.querySelectorAll('#popHost .palette .pal-item .pal-label')].map((e) => e.textContent)`)).filter((r) => INT_ROW.test(r));
const INTEGRAL_POP = '.int-pop';
const popCount = () => ev(`document.querySelectorAll(${JSON.stringify(INTEGRAL_POP)}).length`);
await view(VIEW_W, VIEW_H, false, false);

const seedShapes = async (shapes) => {
  await load(NS, { v3: true, v4: true, v5: true, v6: true, unit: false, snap: true, shapes, nextId: 30, focus: 0, steps: [STEP] });
  await nav(`${BASE}/test.html?ns=${NS}&lang=en&view=steps`);
  await until(`typeof __cmwSteps === 'function' && __cmwSteps().planes.length >= 2`);
  await ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1`);
};

// two curves, none selected
await seedShapes(CURVES);
await openPal(); await palQ('integrate');
const two = await rows();
ok('two curves, none selected: one Integrate row per curve', two.length === CURVES.length, two);
ok('the rows name different curves', new Set(two).size === CURVES.length, two);
// (nothing opens by itself: read as the palette fills, and again once the page has gone quiet, which a delayed open would not survive)
const popsAtOnce = await popCount();
await quiet();
ok('nothing is integrated until a row is chosen', popsAtOnce === 0 && (await popCount()) === 0, [popsAtOnce, await popCount()]);
await ev(`document.querySelector('#popHost .palette .pal-item').click()`);
await until(`document.querySelectorAll(${JSON.stringify(INTEGRAL_POP)}).length >= 1`);
ok('choosing a row opens the integral', await popCount() >= 1, await popCount());

// one curve
await seedShapes(CURVES.slice(0, 1));
await openPal(); await palQ('integrate');
const one = await rows();
ok('one curve: one Integrate row', one.length === 1, one);

info.checks = 'steps view: Integrate asks which curve, then opens beside it';
return { pass: fails.length === 0, fails, info };
