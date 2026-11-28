// The inverse programs of the glides a press starts are part of svReady() (#1157): those of the glides out of and into
// the plane shown, each part (the warm-up's jobs, svInvGlides), counted once they have linked. A command file for a CDP
// daemon:  <runner> test/svready_inverse_cmd.js
// - on the last plane: the gauge's inverse part counts the jobs' glides, every one a glide into that plane, and ready
//   reads true once they have linked;
// - the Landscape draws no frames between planes: it has no inverse programs to wait for; back on the plane they are
//   counted again, and ready reads true;
// - a new opacity, which picks the programs' B class: the gauge counts the programs of the new look (not those of the look
//   it counted before, which no job asks for any more), and ready reads true once they have linked;
// - a page opened parked on plane 1, an example loaded (its view puts the thread on plane 0), its warm-up done there, then
//   the thread taken to plane 1: the warm-up of plane 1's glides starts on arriving, and ready reads true;
// - on a fresh page whose links land LATE_MS late (test/lib/late_links.js): ▶ pressed on plane 0 as soon as the page is
//   up waits while the chain's programs link, and then the glide's inverse programs, which together take longer than a
//   warm-up's tries would last if each try spent on a pending link counted; ready never reads false for READY_AFTER_MS
//   with no link pending (watched in the page every animation frame), it reads true, and the glide starts, with no Retry.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const GO_LAST = 99, VIEW_W = 1440, VIEW_H = 900, LOAD_MS = 30000, READY_MS = 60000;
const LATE_MS = 40000, READY_AFTER_MS = 10000, PLAY_MS = 120000;
await view(VIEW_W, VIEW_H, false);
const ns = 'svi' + Date.now();
await load(ns, {});
await ev('(__cmwExample(1), 1)');
const base = await ev('location.origin');
const up = 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on';
await nav(`${base}/test.html?ns=${ns}&view=steps`);
await settled({ max: LOAD_MS, until: up });
await ev(`(__cmwSteps({ go: ${GO_LAST}, now: true }), 1)`);
await settled({ max: READY_MS, only: true, until: '__cmwSteps().ready.ready === true' });
const rel = await ev('(() => { const s = __cmwSteps(); return { ready: s.ready, planes: s.planes, x: s.x, glides: s.invGlides || [] }; })()');
info.last = rel;
const inv = rel.ready && rel.ready.parts && rel.ready.parts.inverse, P = rel.planes || [], j = Math.round(rel.x);
ok('the gauge counts the press\'s glides\' inverse programs', inv && inv.total > 0 && rel.glides.length > 0, rel);
ok('on the last plane every glide counted is the glide into it', rel.glides.every(([b]) => b === P[j]), rel);
ok('ready: every one of them linked', inv && inv.done === inv.total, inv);
await ev('(__cmwSteps({ surf: "land" }), 1)');
const land = await ev('__cmwSteps().ready.parts.inverse');
ok('Landscape: the gauge has no inverse programs', land && land.total === 0, land);
await ev('(__cmwSteps({ surf: "plane" }), 1)');
await settled({ max: READY_MS, only: true, until: '__cmwSteps().ready.ready === true' });
const back = await ev('__cmwSteps().ready.parts.inverse');
ok('back on the plane: the inverse programs are counted, and linked', back && back.total > 0 && back.done === back.total, back);
// a new opacity in another B class (GLR's invB): on the Joukowski airfoil (its airfoil Inside regions, whose glide frames
// draw at the slider's opacity), from its own opacity to 1 as soon as the example's page settles: the gauge counts the
// programs of the new look, and ready reads true once they link
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
await nav(`${base}/test.html?ns=${ns}x&view=steps`);
await settled({ max: LOAD_MS, until: up });
await ev(`(__cmwExample(${names.indexOf('Joukowski airfoil')}), 1)`);
// (the opacity set as the example's page settles, as a suite or a hand sets it straight after a load: the gauge has
// counted the example's programs by then)
await settled({ max: LOAD_MS });
const a0 = await ev('__cmwKeys().alpha'), counted = await ev('__cmwSteps().ready.parts.inverse');
await ev("(__cmwSet('alpha', 1), 1)");
const relook = await settled({ max: READY_MS, only: true, until: '__cmwSteps().ready.ready === true' });
const look = await ev('__cmwSteps().ready.parts.inverse');
ok('a new opacity: ready reads true once the programs of the new look have linked', a0 < 0.999 && relook.ok && look && look.total > 0 && look.done === look.total, { a0, counted, look, ready: await ev('__cmwSteps().ready') });
// a page opened parked on plane 1, then an example loaded: the example's view puts the thread on plane 0, and the arrival
// at plane 1 that follows starts that plane's warm-up
await nav(`${base}/test.html?ns=${ns}p&view=steps`);
await settled({ max: LOAD_MS, until: up });
await ev('(__cmwSteps({ go: 1, now: true }), 1)');
await settled({ max: READY_MS, only: true, until: '__cmwSteps().ready.ready === true' });
await nav(`${base}/test.html?ns=${ns}p&view=steps`);
await settled({ max: LOAD_MS, until: up });
const opened = await ev('__cmwSteps().x');
await ev('(__cmwExample(1), 1)');
const atZero = await settled({ max: READY_MS, only: true, until: '__cmwSteps().x === 0 && __cmwSteps().ready.ready === true' });
await ev('(__cmwSteps({ go: 1, now: true }), 1)');
const arrived = await settled({ max: READY_MS, only: true, until: '__cmwSteps().ready.ready === true' });
const onOne = await ev('(() => { const s = __cmwSteps(); return { x: s.x, inverse: s.ready.parts.inverse, invWarm: s.invWarm }; })()');
info.reopened = { opened, atZero, arrived, onOne };
ok('a page opened on plane 1 (control)', opened === 1, opened);
ok('an example loaded there puts the thread on plane 0, and ready reads true (control)', atZero.ok, atZero);
ok('taken from there to plane 1: the warm-up of its glides starts, and ready reads true', arrived.ok && onOne.x === 1 && onOne.inverse && onOne.inverse.total > 0 && onOne.inverse.done === onOne.inverse.total, onOne);
let exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
// links that land late: ▶ waits for the chain's programs and the glide's inverse programs, and starts once they have landed
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${LATE_MS};\n` + fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8') });
try {
  await nav(`${base}/test.html?ns=${ns}&view=steps`);
  await settled({ max: LOAD_MS, only: true, until: up });
  await ev('(__cmwSteps({ go: 0, now: true }), __cmwSteps({ play: true }), 1)');
  // (in the page, every animation frame: the longest time ready read false with no link pending, and when it first read true)
  await ev(`(() => { const q = window.__sviQuiet = { since: 0, longest: 0, readyAt: 0 }; const t = () => { const now = performance.now(), rd = __cmwSteps().ready.ready; if (rd) { if (!q.readyAt) q.readyAt = now; q.since = 0; } else if (GLR.pendingLinks === 0) { if (!q.since) q.since = now; q.longest = Math.max(q.longest, now - q.since); } else q.since = 0; if (!q.readyAt) requestAnimationFrame(t); }; requestAnimationFrame(t); return 1; })()`);
  const held = await settled({ max: READY_MS, only: true, until: '__cmwSteps().ready.parts.inverse && __cmwSteps().ready.parts.inverse.total > 0 && GLR.pendingLinks > 0' });
  const pressed = await ev('(() => { const s = __cmwSteps(); return { inverse: s.ready.parts.inverse, pending: GLR.pendingLinks, x: s.x, waiting: s.moving && !s.play }; })()');
  ok(`links ${LATE_MS} ms late: ▶ waits while the programs link`, held.ok && pressed.inverse.done < pressed.inverse.total && pressed.x === 0 && pressed.waiting, pressed);
  // (the chain's programs land first, and the glide's inverse programs, asked for once the rest is ready, after them; a
  // program a frame asks for after a landing links LATE_MS more)
  const ready = await settled({ max: 3 * LATE_MS + PLAY_MS, only: true, until: `__cmwSteps().ready.ready === true || window.__sviQuiet.longest > ${READY_AFTER_MS}` });
  // (quiet.readyAt: the first frame ready read true; the glide may start at once, and the glides of the next plane link)
  const after = await ev('(() => { const s = __cmwSteps(); return { ready: s.ready, quiet: window.__sviQuiet, pending: GLR.pendingLinks, links: window.__lateLinks }; })()');
  ok(`links ${LATE_MS} ms late: ready never reads false for ${READY_AFTER_MS} ms with no link pending, and reads true`, ready.ok && after.quiet.readyAt > 0 && after.quiet.longest <= READY_AFTER_MS, after);
  const went = await settled({ max: PLAY_MS, only: true, until: '__cmwSteps().x > 0' });
  const fin = await ev('(() => { const s = __cmwSteps(); return { x: s.x, play: s.play }; })()');
  ok(`links ${LATE_MS} ms late: the glide pressed for starts, with no Retry`, went.ok && fin.x > 0, fin);
  info.late = { pressed, after, fin };
  exc = exc.concat((await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')));
} finally {
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
}
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
