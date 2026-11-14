// svReady() (#1157): the steps view's gauge of what a glide of the current chain still needs. With every link held
// (?glhold, GLR.holdLinks) it is not ready and its total is above 0; after the release it becomes ready, and a step
// added takes it back to not ready until the prestart has run again, and so does a lost and restored WebGL context, after
// which the left pane draws its plane again. A command file for a CDP daemon:  <runner> test/svready_cmd.js
const { planePixels } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'plane_pixels.js'), 'utf8'));
const READY_MS = 40000;   // (the bound on each wait for the gauge to read ready)
// (the shown plane's coloured pixels: the carried colour's, not the grey of the background, the grid or the rulers)
const colouredPixels = () => planePixels('', '(r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) > 40');
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const ns = 'svr' + Date.now();
await load(ns, {});
await ev('(__cmwExample(1), 1)');
const base = await ev('location.origin');
await go(`${base}/test.html?ns=${ns}&glhold&view=steps`);
// (the app up: its panes stay compiling while the links are held)
await settled({ max: 30000, panes: false, until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on' });
await ev('(__cmwSteps({ go: 99, now: true }), 1)');
await settled({ max: 30000, only: true, until: '__cmwSteps().ready.total > 0' });
const held = await ev('__cmwSteps().ready');
info.held = held;
ok('with the links held: not ready', held && held.ready === false, held);
ok('with the links held: total above 0', held && held.total > 0, held);
ok('with the links held: the programs are not all done', held && held.parts.programs && held.parts.programs.done < held.parts.programs.total, held && held.parts);
await ev('(GLR.holdLinks(false), 1)');
await settled({ max: READY_MS, only: true, until: '__cmwSteps().ready.ready === true' });
const rel = await ev('__cmwSteps().ready');
info.released = rel;
ok('after the release: ready', rel && rel.ready === true && rel.done === rel.total && rel.total > 0, rel);
await ev('(__cmwAddStep("joukowski", {}), 1)');
const edited = await ev('__cmwSteps().ready');
info.edited = edited;
ok('a step added: not ready until the prestart has run again', edited && edited.ready === false, edited);
await settled({ max: READY_MS, only: true, until: '__cmwSteps().ready.ready === true' });
const again = await ev('__cmwSteps().ready');
info.again = again;
ok('the prestart ran again: ready', again && again.ready === true, again);
// a lost and restored context: every program and the warm draw are gone with it, so the gauge reads ready again only
// once the prestart has run again on the restored context, and the plane is drawn as before
const shown = await colouredPixels();
info.shown = shown;
await ev('(window.__svrLose = GLR.gl.getExtension("WEBGL_lose_context"), __svrLose.loseContext(), 1)');
await settled({ max: 10000, only: true, until: '!GLR.ok' });
await ev('(__svrLose.restoreContext(), 1)');
await settled({ max: READY_MS, only: true, until: 'GLR.ok && __cmwSteps().ready.ready === true' });
const restored = await ev('__cmwSteps().ready');
info.restored = restored;
ok('a lost and restored context: ready within the bound', restored && restored.ready === true, restored);
await settled({ max: 20000, until: '!__cmwSteps().anim' });
const redrawn = await colouredPixels();
info.redrawn = redrawn;
ok('a lost and restored context: the plane is drawn again', shown.n > 0 && redrawn.n >= 0.9 * shown.n && redrawn.n <= 1.1 * shown.n, { shown, redrawn });
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
