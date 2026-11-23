// The Landscape's All-sheets programs are started at rest, not in a glide's first frame: on √z (cut 180°) then z + 2 with
// All sheets on the Landscape (heights Im, linear), once the chain reads prepared (__cmwSteps().ready, which counts the
// programs the rest has started), the first glide w₁ → w₂ links none of the sheets' programs (landSheetTF, landSheet and,
// for the linear heights, landSheetC), each a link the glide's first frame would wait for. The
// links are read from GLR.profile() (the page opened with ?glprof). Controls: the glide moves, and by its end the page's
// profile holds the three programs (the glide drew the sheets with them).
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const SHEET_PROGS = ['landSheetTF', 'landSheet', 'landSheetC'];
const CHAIN = [{ type: 'root', params: { n: 2, cut: 180 }, on: true }, { type: 'add', params: { c: '2' }, on: true }];
const ns = 'landsheetspre' + Date.now();
await loadView('steps', ns, { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps: CHAIN, sheets: true, height: 'im' });
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps&glprof`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && typeof GLR.profile === "function"' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 1, now: true }); 1`);
const r = await settled({ max: 120000, until: '!!__cmwSteps().ready && __cmwSteps().ready.ready', only: true });
ok('the chain reads prepared on the Landscape (control)', r.ok, await ev('JSON.stringify(__cmwSteps().ready)'));
const n0 = await ev('GLR.profile().length');
const moving = await ev(`(__cmwSteps({ go: 2 }), __cmwSteps().moving)`);
const g = await settled({ max: 120000, until: '!__cmwSteps().moving && __cmwSteps().x === 2', only: true });
ok('the glide w₁ → w₂ moves and ends on w₂ (control)', moving && g.ok, { moving, ended: g.ok });
const linked = await ev(`GLR.profile().slice(${n0}).map((p) => p.name + ':' + p.mode + ':' + (p.by || ''))`);
const all = await ev('GLR.profile().map((p) => p.name)');
info.linkedInGlide = linked;
ok('the first glide links no program of the sheets (landSheetTF, landSheet, landSheetC)', !linked.some((s) => SHEET_PROGS.includes(s.split(':')[0])), linked);
ok('by the glide\'s end the page has linked the three (control: the glide drew the sheets)', SHEET_PROGS.every((n) => all.includes(n)), SHEET_PROGS.filter((n) => !all.includes(n)));
return { pass: fails.length === 0, fails, info };
