// The steps view's glide, its cost without a change of picture, Everywhere:
// - while the carried colour's programs link (held: GLR.holdLinks), a glide's frames start only its own programs, no
//   stand-in for them (each a compile of the chain that the GPU process makes the frames wait behind): the square root
//   example with a step added, held mid-glide at x = 1/2 (a scrub on the rail not let go);
// - the Mountain King with a step put between its two: the glide to plane 1, whose chain the edit leaves, keeps its
//   whole pole tracks. Then one put before them both: before any idle moment, the frames of the Möbius map's glide (to
//   plane 2) make no step of its tracks (many times a frame's share) and search for its poles only at the tracks'
//   seed steps, and their poles are the tracks' once the idle moments made them whole (each within 1e-3 of one of the
//   others), in slices that pause every 48 evaluations of the map.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ready = async () => { await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwSvKey === "function" && !!window.GLR' }); };
// the thread held at x mid-glide: a scrub on the rail, not let go (window.__svScrubUp lets it go)
// (links: wait for every program to have linked too; false while links are held)
async function hold(x, links = true) {
  await ev(`(() => {
    const rail = document.querySelector('.sv-rail'), ns = [...document.querySelectorAll('.sv-track .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const i = Math.floor(${x}), cx = ns[i][0] + (ns[i + 1][0] - ns[i][0]) * (${x} - i), cy = ns[0][1];
    const ev = (type, px) => rail.dispatchEvent(new PointerEvent(type, { pointerId: 73, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, bubbles: true, clientX: px, clientY: cy }));
    ev('pointerdown', ns[0][0] - 2); ev('pointermove', ns[0][0] + 10); ev('pointermove', cx);
    window.__svScrubUp = () => ev('pointerup', cx);
    return 1;
  })()`);
  await settled({ max: 30000, panes: links, until: `${links ? 'GLR.pendingLinks === 0 && ' : ''}Math.abs(__cmwSvX() - ${x}) < 0.01 && __cmwSteps().moving` });
}
// ---- the stand-ins while the carry's programs link ----
{
  const ex = names.indexOf('Square root and its sheets');
  ok('the square root example is found', ex >= 0, names.length);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=gl${Date.now()}`);
  await ready();
  await ev(`__cmwExample(${ex}); 1`);
  await settled({ max: 20000 });
  await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true })}); 1`);
  await settled({ max: 20000 });
  // (the edited chain's programs held linking, on any back end: the glide's frames find none of them ready)
  await ev('GLR.holdLinks(true), 1');
  await ev(`__cmwAddStep('exp'), 1`);
  await settled({ max: 20000, panes: false, until: '!!document.querySelector(".sv-plane")' });
  await hold(0.5, false);
  // (the glide's frames asked for the carry's own programs: the map cache's and the cached places')
  await settled({ max: 20000, panes: false, until: '["tfRegion", "regionKC"].every((n) => GLR.chainProgs().includes(n))' });
  const started = await ev('GLR.chainProgs()');
  await ev('window.__svScrubUp(), 1');
  await ev('GLR.holdLinks(false), 1');
  await settled({ max: 30000 });
  info['while the programs link'] = { started };
  ok('while the carry\'s programs link: its own are started (the map cache, the cached places, the fill and its point pass)', ['tfRegion', 'regionKC'].every((n) => started.includes(n)), started);
  ok('while the carry\'s programs link: no stand-in is started (the fill evaluating its own, the sheet program, the plain one)', !['regionKSC', 'regionKS', 'regionK'].some((n) => started.includes(n)), started);
}

// ---- the glides' pole tracks after an edit ----
{
  const ex = names.indexOf('In the Hall of the Mountain King');
  ok('the Mountain King example is found', ex >= 0, names.length);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=gp${Date.now()}`);
  await ready();
  await ev(`__cmwExample(${ex}); 1`);
  await settled({ max: 30000, panes: false });
  await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true })}); 1`);
  await settled({ max: 30000, panes: false });
  // (the two glides' tracks whole, and the idle job done; from here on the idle moments are the test's own: each
  // callback asked for is queued, and run with 50 ms left)
  await ev('__cmwSvKey(1, 0.5, true), __cmwSvKey(2, 0.5, true), 1');
  await settled({ max: 30000, panes: false, until: '!__cmwSvKey().busy' });
  await ev('window.__svIdleQ = [], window.requestIdleCallback = (f) => (window.__svIdleQ.push(f), 1), 1');
  // (a step put between the King's two: plane 1's chain is the same)
  await ev(`__cmwAddStep('mul', { c: '1' }, 1), 1`);
  await settled({ max: 30000, panes: false, until: '!!document.querySelector(".sv-plane") && __cmwSteps().planes.length === 4' });
  const kept = (await ev('__cmwSvKey(1, 0.5)')).tracks;
  ok('after an edit past plane 1: the glide to plane 1 keeps its whole tracks', kept && kept.k === kept.of, kept);
  // (and a step put before them all: the Möbius map's glide, with its poles, goes to plane 2, after a new chain)
  await ev(`__cmwAddStep('mul', { c: '1' }, 0), 1`);
  await settled({ max: 30000, panes: false, until: '!!document.querySelector(".sv-plane") && __cmwSteps().planes.length === 5' });
  // (the key of a glide's frames at t = 1/2 to plane 2, frame after frame until the seed step's search there is done:
  // before any idle moment, the tracks are many times a frame's share)
  const now = await ev('(() => { globalThis.__svPathStats = {}; let r = null; for (let i = 0; i < 400 && !(r && r.tracks.seed === 32); i++) r = __cmwSvKey(2, 0.5); r.stats = globalThis.__svPathStats; return r; })()');
  // (and the searches a glide's frames make while the tracks are not whole: t over (0, 0.3) in 20 frames' steps)
  const sweep = await ev('(() => { globalThis.__svPathStats = {}; for (let i = 1; i <= 20; i++) __cmwSvKey(2, 0.3 * i / 20); const s = globalThis.__svPathStats; return s; })()');
  // (then the idle moments, until the job is done)
  const idle = await ev('(() => { globalThis.__svPathStats = {}; const q = window.__svIdleQ; let n = 0; while (q.length && n < 5000) { n++; q.shift()({ timeRemaining: () => 50, didTimeout: false }); } const s = globalThis.__svPathStats; globalThis.__svPathStats = null; s.callbacks = n; return s; })()');
  const whole = await ev('__cmwSvKey(2, 0.5)');
  const near = (p, L) => L.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-3 * (1 + Math.hypot(q[0], q[1])));
  info['after an edit'] = { kept, now: now.sing, nowTracks: now.tracks, frames: now.stats, sweep, idle, whole: whole.sing, wholeTracks: whole.tracks };
  ok('after an edit: a glide frame\'s key does not make the glide\'s pole tracks', now.tracks && now.tracks.k === 0 && !(now.stats.poleFrameSteps > 0), info['after an edit']);
  ok('after an edit: the frames finish the seed step\'s search at t', now.tracks && now.tracks.seed === 32 && now.sing.length > 0, info['after an edit']);
  // (the tracks' seed steps in t <= 0.3: 0, 8 and 16 of 64, the one nearest 0.3 being 24)
  ok('after an edit: a glide\'s frames search for poles only at the tracks\' seed steps', (sweep.poleSync || 0) <= 4, sweep);
  // (a pause once 48 evaluations ran, checked at least every grid row of 25: the slices stop at their 2 ms, not at a
  // step of t's end, which takes up to 113k evaluations on the King)
  ok('after an edit: the idle moments make the tracks whole, in slices of at most 72 evaluations between pauses', whole.tracks.k === whole.tracks.of && idle.poleIdle > 1 && idle.poleChunk > 0 && idle.poleChunk <= 72, idle);
  ok('after an edit: the poles found at t are the whole tracks\' poles', now.sing.every((p) => near(p, whole.sing)) && whole.sing.every((p) => near(p, now.sing)), info['after an edit']);
}
return { pass: fails.length === 0, fails, info };
