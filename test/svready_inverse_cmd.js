// The glide's inverse programs are part of svReady() (#1157): the carried colour's inverse pass of each step is started by the
// prestart and drawn once before the gauge says ready. A command file for a CDP daemon:  <runner> test/svready_inverse_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const ns = 'svi' + Date.now();
await load(ns, {});
await ev('(__cmwExample(1), 1)');
const base = await ev('location.origin');
await nav(`${base}/test.html?ns=${ns}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on' });
await ev('(__cmwSteps({ go: 99, now: true }), 1)');
await settled({ max: 60000, only: true, until: '__cmwSteps().ready.ready === true' });
const rel = await ev('__cmwSteps().ready');
info.ready = rel;
const inv = rel && rel.parts && rel.parts.inverse;
ok('the gauge counts the glide\'s inverse programs', inv && inv.total > 0, rel && rel.parts);
ok('ready: every inverse program linked and drawn once', inv && inv.done === inv.total, inv);
const warm = await ev('GLR.inverseColdState ? GLR.inverseColdState() : -1');
ok('no inverse program waits for its first draw', warm === 0, warm);
// the Landscape draws no frames between planes: it has no inverse programs to wait for, and leaving it warms them
await ev('(__cmwSteps({ surf: "land" }), 1)');
const land = await ev('__cmwSteps().ready.parts.inverse');
ok('Landscape: the gauge has no inverse programs', land && land.total === 0, land);
await ev('(__cmwSteps({ surf: "plane" }), 1)');
await settled({ max: 60000, only: true, until: '__cmwSteps().ready.ready === true' });
const back = await ev('__cmwSteps().ready.parts.inverse');
ok('back on the plane: the inverse programs are counted and drawn once', back && back.total > 0 && back.done === back.total, back);
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
