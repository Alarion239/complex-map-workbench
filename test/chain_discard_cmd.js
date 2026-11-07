// A chain's cache goes with the chain (#1157): everything the chains own (programs, inverse programs, cached
// evaluations, the prestart lists and the version records of GLR.chainStats) belongs to the current chain alone after
// - an example replaces the scene, and
// - an edit follows an Undo (the undone chain can no longer be redone);
// and Undo / Redo cycles keep the chains' state within the caps.
// A command file for a CDP daemon:  <runner> test/chain_discard_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const ns = 'cd' + Date.now();
const STATS = 'GLR.chainStats()';
const press = (id) => ev(`(document.getElementById("${id}").click(), 1)`);
const calm = () => settled({ max: 90000, only: true, until: '__cmwSteps().ready.ready && !__cmwSteps().moving' });

await view(1440, 900, false);
await load(ns, {});
await ev('(__cmwExample(1), 1)');
const o = await ev('location.origin');
await nav(`${o}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, only: true, until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on' });
await calm();

// the chains an example leaves behind are freed
const a = await ev(STATS);
ok('the first scene: its chain owns programs', a.programs > 0 && a.keys.length >= 1, a);
await ev('(__cmwExample(2), 1)');
await calm();
const b = await ev(`({ s: ${STATS}, key: GLR.chainKey })`);
info.afterExample = b;
ok('after an example: only the current chain owns anything', b.s.keys.length === 1 && b.s.keys[0] === b.key && b.s.hist === 0 && b.s.wanted === 1, b);

// an edit after an Undo frees the undone chain
await ev(`(__cmwAddStep('custom', { expr: 'z+1', cut: 180 }), 1)`);
await calm();
const kB = await ev('GLR.chainKey');
await press('undoBtn');
await calm();
const mid = await ev(`({ s: ${STATS}, key: GLR.chainKey })`);
ok('after Undo: the undone chain is kept for Redo', mid.s.keys.includes(kB) && mid.key !== kB, { mid, kB });
await ev(`(__cmwAddStep('exp', {}), 1)`);
await calm();
const c = await ev(`({ s: ${STATS}, key: GLR.chainKey })`);
info.afterEdit = c;
ok('an edit after Undo: the undone chain is freed', !c.s.keys.includes(kB), { c, kB });

// Undo / Redo cycles do not grow what the chains own
const base = await ev(STATS);
for (let i = 0; i < 4; i++) { await press('undoBtn'); await calm(); await press('redoBtn'); await calm(); }
const after = await ev(STATS);
info.cycles = { base, after };
ok('Undo / Redo cycles keep the programs, versions and prestart lists within the caps', after.programs <= base.programs + 0 && after.hist <= 3 && after.wanted <= 5 && after.keys.length <= 5, { base, after });

const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
