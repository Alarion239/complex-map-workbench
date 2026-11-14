// The steps view's glide, its cost without a change of picture, Everywhere:
// - while the carried colour's programs link (held: GLR.holdLinks), a glide's frames start only its own programs, no
//   stand-in for them (each a compile of the chain that the GPU process makes the frames wait behind): the square root
//   example with a step added, held mid-glide at x = 1/2 (a scrub on the rail not let go); once let go, every held
//   program links, those no frame asks for again too;
// - the Mountain King with a step put between its two: the glide to plane 1, whose chain the edit leaves, keeps its
//   whole pole tracks. Then one put before them both: before any idle moment, the frames of the Möbius map's glide (to
//   plane 2) make no step of its tracks (many times a frame's share) and search for its poles only at the tracks'
//   seed steps, and their poles are the tracks' once the idle moments made them whole (each within 1e-3 of one of the
//   others), in slices that pause every 16 evaluations of the map;
// - the zeta example parked at x after x (each a new map of the glide, drawn by the carried mesh and its outer ring:
//   Everywhere under a Newton inverse with no seeds): over two scrubs there and back the outer ring's sizes are made
//   by the idle job (those of the page's first glide before it), in no frame, and each size's mesh is built at most
//   once, without strokes, by the idle job, each with at least half a slice's time left;
// - the zeta example held mid-scrub by plane 1, its meshes rebuilt: the tiling's fix-up it asks for (the left pane's
//   region under zeta) runs no slice until the thread is let go, then runs;
// - the Mountain King after a glide there and back: two scrubs of the rail, plane 0 to the last and back, each after a
//   rest longer than the scratch sweep's second, once the idle job has ended (checked: a starved idle job is reported
//   as such); the carried colour creates no texture, buffer or vertex array in their frames (the outer ring's meshes,
//   their vertex arrays and the carry's scratch textures are made in idle moments and kept between scrubs), and
//   its frames return to the default framebuffer once (every mesh's off-screen passes before the draws); a third
//   scrub's frames decompose no step of the chain (each glide's plans share its t-free part: invHomPath);
//   a chain edit (a step bypassed) frees those scratch textures, as does the scratch sweep once the map cache is over
//   its budget.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// the calls of the named methods of target (a page expression) whose stack holds every one of the frames named, kept in
// the page as window[into]: each a line "name at < ... <" of the stack's first frames
const GL_CREATES = ['createTexture', 'createBuffer', 'createVertexArray'];
const watchCalls = (target, methods, frames, into) => ev(`(() => {
  const o = ${target}, A = window[${JSON.stringify(into)}] = [];
  for (const name of ${JSON.stringify(methods)}) {
    const f = o[name];
    o[name] = function (...a) { const st = new Error().stack || ''; if (${JSON.stringify(frames)}.every((k) => st.includes(k))) A.push(name + ' ' + st.split('\\n').slice(2, 6).map((l) => l.trim()).join(' < ')); return f.apply(this, a); };
  }
  return 1;
})()`);
const ready = async () => { await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwSvKey === "function" && !!window.GLR' }); };
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
  { const h = await hold(0.5, false); ok('the thread is held at x = 0.5', h.ok, h); }
  // (the glide's frames asked for the carry's own programs: the map cache's and the cached places')
  await settled({ max: 20000, panes: false, until: '["tfRegion", "regionKC"].every((n) => GLR.chainProgs().includes(n))' });
  const started = await ev('GLR.chainProgs()');
  await ev('window.__svScrubUp(), 1');
  // (released, the held programs finish linking, those no frame asks for again too)
  await ev('GLR.holdLinks(false), 1');
  const after = await settled({ max: 10000, panes: false, until: 'GLR.pendingLinks === 0' });
  info['while the programs link'] = { started, after: { ok: after.ok, busy: after.busy, pendingLinks: await ev('GLR.pendingLinks') } };
  const list = Array.isArray(started) ? started : [];
  ok('while the carry\'s programs link: its own are started (the map cache, the cached places, the fill and its point pass)', ['tfRegion', 'regionKC'].every((n) => list.includes(n)), started);
  ok('while the carry\'s programs link: no stand-in is started (the sheet program, the plain ones)', Array.isArray(started) && !['regionKS', 'regionK', 'regionKN'].some((n) => list.includes(n)), started);
  ok('once the links are let go: every held program links', after.ok, info['while the programs link'].after);
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
  // (a pause once 16 evaluations ran, checked at least every 9: the slices stop at their 2 ms, not at a step of t's
  // end, which takes up to 113k evaluations on the King)
  ok('after an edit: the idle moments make the tracks whole, in slices of at most 24 evaluations between pauses', whole.tracks.k === whole.tracks.of && idle.poleIdle > 1 && idle.poleChunk > 0 && idle.poleChunk <= 24, idle);
  ok('after an edit: the poles found at t are the whole tracks\' poles', now.sing.every((p) => near(p, whole.sing)) && whole.sing.every((p) => near(p, now.sing)), info['after an edit']);
}
// ---- a moving map's frames: the outer ring ----
{
  const ex = names.indexOf('Zeros of the zeta function');
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=gm${Date.now()}`);
  await ready();
  // (the buffers, textures and vertex arrays a frame creates for the ring: their stack passes through svRingGPU from
  // svCarryRegions, the frame's draw; the idle job's builds pass through svRingWarm)
  await watchCalls('WebGL2RenderingContext.prototype', GL_CREATES, ['svRingGPU', 'svCarryRegions'], '__ringFrameAlloc');
  // (the strokes built for the ring's meshes: their stack passes through svRingGPU)
  await watchCalls('GLR', ['createLines'], ['svRingGPU'], '__ringLines');
  await ev(`__cmwExample(${ex}); 1`);
  await settled({ max: 20000 });
  // (from here, the work counted: the idle job's after the page settles on plane 0, before any frame between planes)
  await ev('globalThis.__svPathStats = {}, 1');
  await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true })}); 1`);
  await settled({ max: 20000, until: '!__cmwSvKey().busy' });
  // (parked at x: the glide's map at t = x; inside (1/8, 7/8), where a thread let go stays)
  const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }), 1`); await settled({ max: 20000, until: `Math.abs(__cmwSvX() - ${x}) < 1e-6` }); };
  const xs = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
  // (the page's first glide, to plane 1: its frames' sizes made by the idle job before it)
  await ev('__cmwSteps({ go: 1 }), 1');
  await settled({ max: 30000, until: '!__cmwSteps().moving && Math.abs(__cmwSvX() - 1) < 1e-6' });
  const ahead = await ev('(() => { const s = globalThis.__svPathStats; globalThis.__svPathStats = {}; return s; })()');
  // (then parked once at each, and the idle job left to finish)
  for (const x of xs) await park(x);
  await settled({ max: 20000, until: '!__cmwSvKey().busy' });
  // (then two scrubs there and back: the ring's sizes made in no frame, and its meshes built once for each size)
  const r0 = await ev('__cmwSvRing(true)');
  const ms = [];
  for (let k = 0; k < 2; k++) for (const x of xs.concat(xs.slice().reverse())) { await park(x); ms.push((await ev('__cmwSvRing()') || { m: null }).m); }
  const ps = await ev('(() => { const s = globalThis.__svPathStats; globalThis.__svPathStats = null; return s; })()');
  const builds = (await ev('__cmwSvRing(true)')) - r0, sizes = new Set(ms.filter((m) => m != null)).size;
  const warm = (ahead.ringOver || []).concat(ps.ringOver || []), lines = (await ev('window.__ringLines')).length, frameAlloc = (await ev('window.__ringFrameAlloc')).length;
  info['the ring'] = { ms, sizes, builds, ahead: ahead.ringIdle || 0, firstFrames: ahead.ringFrame || 0, ringFrame: ps.ringFrame || 0, warm, lines, frameAlloc };
  ok('the ring: the scrubs draw a ring', sizes > 0, info['the ring']);
  ok('the ring: the idle job makes the glide\'s ring sizes, those of the page\'s first glide too', ahead.ringIdle > 0 && !(ahead.ringFrame > 0), info['the ring']);
  ok('the ring: no frame of the scrubs makes its size (the idle job made them)', !(ps.ringFrame > 0), info['the ring']);
  ok('the ring: each of its sizes\' meshes is built once at most over two scrubs', builds <= sizes, info['the ring']);
  ok('the ring: no frame of the page\'s first glide or the scrubs creates a buffer, texture or vertex array for its mesh (the idle job built them)', frameAlloc === 0, info['the ring']);
  // (the slice that makes a size builds its mesh too, past SV_POLE_BUDGET by the build: at most 12 ms over, 1.5 times
  // the longest cold build measured on a lavapipe runner; a mesh built at full resolution or past its cache costs tens)
  ok('the ring: the idle job builds its sizes\' meshes, each in the slice that makes the size, at most 12 ms past the slice\'s budget', warm.length > 0 && warm.every((t) => t.over <= 12), info['the ring']);
  ok('the ring: its meshes build no strokes (it has no edge drawn)', lines === 0, info['the ring']);
}
// ---- the tiling's fix-ups wait out a scrub ----
{
  const ex = names.indexOf('Zeros of the zeta function');
  ok('the zeta example is found', ex >= 0, names.length);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=gz${Date.now()}`);
  await ready();
  await ev(`__cmwExample(${ex}); 1`);
  await settled({ max: 30000 });
  await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true })}); 1`);
  await settled({ max: 30000 });
  // (held mid-scrub by plane 1, whose plane the left pane follows; the meshes rebuilt, so a fix-up is asked for: the
  // left pane's region under zeta, seconds of CPU work)
  { const h = await hold(0.9, false); ok('the thread is held at x = 0.9', h.ok, h); }
  await ev(`globalThis.__svPathStats = {}, __cmwSet('meshN', __cmwState().meshN), window.__heldT = performance.now(), 1`);
  await settled({ max: 20000, panes: false, until: 'performance.now() - window.__heldT > 2000' });
  const held = await ev('(() => { const s = globalThis.__svPathStats; globalThis.__svPathStats = {}; return s; })()');
  // (let go: at rest on plane 1 the job runs)
  await ev('window.__svScrubUp(), 1');
  await settled({ max: 30000, panes: false, until: '(globalThis.__svPathStats.fixSlices || 0) > 0' });
  const rest = await ev('(() => { const s = globalThis.__svPathStats; globalThis.__svPathStats = null; return s; })()');
  info['a scrub'] = { held: held.fixSlices || 0, rest: rest.fixSlices || 0 };
  ok('a scrub: the fix-up asked for runs no slice while the thread is held', !(held.fixSlices > 0) && rest.fixSlices > 0, info['a scrub']);
}
// ---- a scrub's frames: no GPU allocation by the carried colour ----
{
  const ex = names.indexOf('In the Hall of the Mountain King');
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=ga${Date.now()}`);
  await ready();
  await ev(`__cmwExample(${ex}); 1`);
  await settled({ max: 30000 });
  await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true })}); 1`);
  await settled({ max: 30000 });
  for (const to of [1, 0]) {
    await ev(`__cmwSteps({ go: ${to} }), 1`);
    await settled({ max: 60000, until: '!__cmwSteps().moving' });
  }
  const idle = await settled({ max: 30000, until: '!__cmwSvKey().busy' });
  ok('before the scrubs: the idle job ends (the outer ring\'s sizes and meshes made)', idle.ok, idle);
  // (a scrub crosses every glide of the chain: with the idle job ended, the outer ring's sizes of all of them are made,
  // so that no frame of a scrub makes one and builds its mesh)
  const made = await ev('__cmwSvRingMade()');
  ok('before the scrubs: the outer ring\'s sizes of every glide are made, not only those next to the thread', made.glides > 1 && made.left === 0, made);
  // (each texture, buffer or vertex array created from the carried colour's draws: its stack passes through svCarryRegions)
  await watchCalls('WebGL2RenderingContext.prototype', GL_CREATES, ['svCarryRegions'], '__svAlloc');
  // (each frame's returns to the default framebuffer in the carried colour's draws: a draw there after one into a
  // framebuffer of its own, the map cache's or a point pass's; frames counted by a rAF loop)
  await ev(`(() => {
    const P = WebGL2RenderingContext.prototype, R = window.__svReturns = {}, bind = P.bindFramebuffer;
    let fid = 0, fbo = false, last = null;
    const tick = () => { fid++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    P.bindFramebuffer = function (t, f) { fbo = !!f; return bind.apply(this, arguments); };
    for (const name of ['drawArrays', 'drawArraysInstanced', 'drawElements', 'clear']) {
      const f = P[name];
      P[name] = function (...a) {
        if ((new Error().stack || '').includes('svCarryRegions')) {
          if (!fbo && last === 'fbo') R[fid] = (R[fid] || 0) + 1;
          last = fbo ? 'fbo' : 'screen';
        }
        return f.apply(this, a);
      };
    }
    return 1;
  })()`);
  // (a scrub: pressed on one end plane, 40 moves 16 ms apart to the other, let go there; it answers once let go. The
  // promise is awaited in the page: ev evaluates in REPL mode, which hands a returned promise back unresolved)
  let scrubs = 0;
  const scrub = async (from, to, moves = 40, gap = 16) => ok(`scrub ${++scrubs} (plane ${from} to ${to}) is let go`, await ev(`await new Promise((done) => {
    const rail = document.querySelector('.sv-rail'), ns = [...document.querySelectorAll('.sv-track .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const x0 = ns[${from} < 0 ? ns.length - 1 : ${from}][0], x1 = ns[${to} < 0 ? ns.length - 1 : ${to}][0], cy = ns[0][1];
    const ev = (type, px) => rail.dispatchEvent(new PointerEvent(type, { pointerId: 74, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, bubbles: true, clientX: px, clientY: cy }));
    ev('pointerdown', x0);
    let i = 0;
    const step = () => { i++; ev('pointermove', x0 + (x1 - x0) * i / ${moves}); if (i < ${moves}) setTimeout(step, ${gap}); else { ev('pointerup', x1); done(1); } };
    setTimeout(step, ${gap});
  })`, 120000) === 1);
  // (at rest: 2 s, and the idle job's work for the plane the thread is at done)
  const rest = async () => {
    await settled({ max: 60000, until: '!__cmwSteps().moving' });
    await ev('window.__restT = performance.now(), 1');
    await settled({ max: 20000, panes: false, until: 'performance.now() - window.__restT > 2000' });
    const r = await settled({ max: 30000, until: '!__cmwSvKey().busy' });
    ok('at rest between scrubs: the idle job ends', r.ok, r);
  };
  await rest();
  await scrub(0, -1);
  await rest();
  await scrub(-1, 0);
  await rest();
  const alloc = await ev('window.__svAlloc');
  info['a scrub\'s allocations'] = { n: Array.isArray(alloc) ? alloc.length : null, first: Array.isArray(alloc) ? alloc.slice(0, 4) : alloc };
  ok('two scrubs of the Mountain King: the carried colour creates no texture, buffer or vertex array in their frames', Array.isArray(alloc) && alloc.length === 0, info['a scrub\'s allocations']);
  // (Everywhere: the whole plane's mesh and the outer ring's, each with its map cache's pass)
  const returns = Object.values(await ev('window.__svReturns'));
  info['returns to the default framebuffer'] = { frames: returns.length, most: Math.max(0, ...returns) };
  ok('two scrubs of the Mountain King: each frame\'s carried colour returns to the default framebuffer once', returns.length > 20 && returns.every((n) => n === 1), info['returns to the default framebuffer']);
  // (a third scrub, over the glides the first two crossed: the King's steps (custom formulas) are not decomposed again.
  // V8's call counts of customOps, InvOps' decomposition of a formula step, taken by the debugger protocol (reset as
  // the scrub starts; counting slows every call, so after the checks above). Its frames ask for a plan at each u,
  // each from the glide's t-free part)
  await send('Profiler.enable', {});
  await send('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
  const decomps = async () => {
    const cov = await send('Profiler.takePreciseCoverage', {});
    let n = 0;
    for (const sc of (cov && cov.result) || []) for (const f of sc.functions) if (/^customOps\d*$/.test(f.functionName)) n += f.ranges[0].count;
    return n;
  };
  await decomps();
  await scrub(0, -1);
  await rest();
  const nDec = await decomps();
  await send('Profiler.stopPreciseCoverage', {});
  info['the third scrub\'s step decompositions'] = nDec;
  ok('a third scrub of the Mountain King: its frames decompose no step of the chain again (each glide\'s plans share its t-free part)', nDec === 0, nDec);
  // (with the map cache over its budget, the scratch sweep frees the kept entries a second after their last draw, not
  // 30 s; then a scrub keeps them again)
  const kept0 = await ev('GLR.carryTmp'), budget = await ev('GLR.cacheBudget');
  await ev('GLR.cacheBudget = 1, window.__budgetT = performance.now(), 1');
  await settled({ max: 20000, panes: false, until: 'performance.now() - window.__budgetT > 3000' });
  const squeezed = await ev('GLR.carryTmp');
  await ev(`GLR.cacheBudget = ${budget}, 1`);
  info['over the budget'] = { kept0, squeezed };
  ok('over the map cache\'s budget: the kept scratch entries are freed by the next sweep', kept0 && kept0.n > 0 && squeezed && squeezed.n === 0, info['over the budget']);
  await rest();
  // (a scrub that outlasts the keep time keeps the entries of the planes it passed: the keep time shortened to 3 s, a
  // scrub of 6 s to the last plane, then a scrub back: the first planes' entries were last drawn 6 s before, and the
  // scrub back allocates nothing while the carried colour has been drawn all along)
  const keepWas = await ev('GLR.carryKeepMs(3000)');
  await scrub(0, -1, 60, 100);
  await ev('window.__svAlloc.length = 0, 1');
  await scrub(-1, 0);
  const longAlloc = await ev('window.__svAlloc');
  await ev(`GLR.carryKeepMs(${keepWas}), 1`);
  info['a long scrub'] = { keepWas, n: Array.isArray(longAlloc) ? longAlloc.length : null, first: Array.isArray(longAlloc) ? longAlloc.slice(0, 3) : longAlloc };
  ok('a scrub back after a scrub that outlasted the keep time: the first planes\' kept entries are still there, nothing is allocated', Array.isArray(longAlloc) && longAlloc.length === 0, info['a long scrub']);
  await scrub(0, -1);
  await rest();
  // (the scratch entries kept for the next scrub are freed when the chain changes, well inside their 30 s: a step
  // bypassed, the King's shapes kept, read in the task that edits the chain, before any frame of the new one draws its own)
  const kept = await ev('GLR.carryTmp');
  const after = await ev(`(() => {
    const k = GLR.chainKey, tap = (e) => { e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); e.click(); };
    tap(document.querySelector('#svStrip .sv-step[data-k="1"] .sv-more'));
    const b = [...document.querySelectorAll('#popHost .menu .mi')].find((x) => x.querySelector('.mi-label').textContent === 'Bypass this step');
    if (b) tap(b);
    return { bypass: !!b, changed: GLR.chainKey !== k, held: GLR.carryTmp };
  })()`);
  info['the kept scratch entries'] = { king: kept, after };
  ok('a step bypassed: the carried colour\'s kept scratch entries are freed', kept && kept.n > 0 && after && after.changed && after.held.n === 0, info['the kept scratch entries']);
}
return { pass: fails.length === 0, fails, info };
