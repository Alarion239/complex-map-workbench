// svReady() (#1157): the steps view's gauge of what a glide of the current chain still needs. With every link held
// (?glhold, GLR.holdLinks) it is not ready and its total is above 0; after the release it becomes ready, and a step
// added takes it back to not ready until the prestart has run again. A command file for a CDP daemon:  <runner> test/svready_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const ns = 'svr' + Date.now();
await load(ns, {});
await ev('(__cmwExample(1), 1)');
const base = await ev('location.origin');
await nav(`${base}/test.html?ns=${ns}&glhold&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on' });
await ev('(__cmwSteps({ go: 99, now: true }), 1)');
await settled({ max: 30000, only: true, until: '__cmwSteps().ready.total > 0' });
const held = await ev('__cmwSteps().ready');
info.held = held;
ok('with the links held: not ready', held && held.ready === false, held);
ok('with the links held: total above 0', held && held.total > 0, held);
ok('with the links held: the programs are not all done', held && held.parts.programs && held.parts.programs.done < held.parts.programs.total, held && held.parts);
await ev('(GLR.holdLinks(false), 1)');
await settled({ max: 40000, only: true, until: '__cmwSteps().ready.ready === true' });
const rel = await ev('__cmwSteps().ready');
info.released = rel;
ok('after the release: ready', rel && rel.ready === true && rel.done === rel.total && rel.total > 0, rel);
await ev('(__cmwAddStep("joukowski", {}), 1)');
const edited = await ev('__cmwSteps().ready');
info.edited = edited;
ok('a step added: not ready until the prestart has run again', edited && edited.ready === false, edited);
await settled({ max: 40000, only: true, until: '__cmwSteps().ready.ready === true' });
const again = await ev('__cmwSteps().ready');
info.again = again;
ok('the prestart ran again: ready', again && again.ready === true, again);
// a static program the prestart starts counts in the gauge (here a Landscape pass, not asked for before). Programs start in the
// background only with KHR_parallel_shader_compile, which this renderer has not: a stand-in for it reports each link
// done 500 ms after its first poll
await send('Page.enable', {});
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const seen = new WeakMap();
  const ge = WebGL2RenderingContext.prototype.getExtension;
  WebGL2RenderingContext.prototype.getExtension = function (n) { return n === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR: 0x91B1 } : ge.call(this, n); };
  const gp = WebGL2RenderingContext.prototype.getProgramParameter;
  WebGL2RenderingContext.prototype.getProgramParameter = function (p, n) {
    if (n === 0x91B1) { if (!seen.has(p)) seen.set(p, performance.now()); return performance.now() - seen.get(p) > 500; }
    return gp.call(this, p, n);
  };
})();` });
await nav(`${base}/test.html?ns=${ns}&view=steps`);
await settled({ max: 30000, only: true, until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on && __cmwSteps().ready.ready === true' });
const st0 = await ev('GLR.progStatus().total');
await ev('(GLR.prestart(["landLv"]), 1)');
const st1 = await ev('GLR.progStatus().total');
ok('a static program started by the prestart counts in the programs', st1 === st0 + 1, { st0, st1 });
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
