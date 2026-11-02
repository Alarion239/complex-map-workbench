// The steps view's glide, its cost without a change of picture, Everywhere:
// - while the carried colour's programs link (held: GLR.holdLinks), a glide's frames start only its own programs, no
//   stand-in for them (each a compile of the chain that the GPU process makes the frames wait behind): the square root
//   example with a step added, held mid-glide at x = 1/2 (a scrub on the rail not let go);
// - a glide at once after an edit, before any idle moment made the glide's pole tracks: its frames do not make them
//   (the tracks of plane 1 are still not begun), and the key's poles there, found at t itself, are the tracks' poles
//   once the tracks are whole (each within 1e-3 of one of the others).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ready = async () => { await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwSvRingCull === "function" && typeof __cmwSvPoleTracks === "function" && !!window.GLR' }); };
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
  await sleep(1500);
  const started = await ev('GLR.chainProgs()');
  await ev('window.__svScrubUp(), 1');
  await ev('GLR.holdLinks(false), 1');
  await settled({ max: 30000 });
  info['while the programs link'] = { started };
  ok('while the carry\'s programs link: its own are started (the map cache, the cached places, the fill and its point pass)', ['tfRegion', 'regionKC'].every((n) => started.includes(n)), started);
  ok('while the carry\'s programs link: no stand-in is started (the fill evaluating its own, the sheet program, the plain one)', !['regionKSC', 'regionKS', 'regionK'].some((n) => started.includes(n)), started);
}

// ---- a glide at once after an edit ----
{
  const ex = names.indexOf('Joukowski airfoil');
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=gp${Date.now()}`);
  await ready();
  await ev(`__cmwExample(${ex}); 1`);
  await settled({ max: 20000 });
  await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true })}); 1`);
  await settled({ max: 20000 });
  // (no idle moment from here on: the tracks of the edited chain are made by nothing but the glide's own frames)
  await ev('window.requestIdleCallback = () => 0, 1');
  await ev(`__cmwAddStep('exp'), 1`);
  await settled({ max: 20000, until: '!!document.querySelector(".sv-plane")' });
  await hold(0.5);
  const tr = await ev('__cmwSvPoleTracks(1)');
  const now = await ev('__cmwSvKey(1, 0.5)');
  await ev('window.__svScrubUp(), 1');
  await settled({ max: 20000 });
  await ev('__cmwSvPoleTracks(1, true), 1');
  const whole = await ev('__cmwSvKey(1, 0.5)');
  const near = (p, L) => L.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-3 * (1 + Math.hypot(q[0], q[1])));
  info['after an edit'] = { tracks: tr, now: now.sing, whole: whole.sing };
  ok('after an edit, held mid-glide: the glide\'s frames did not make its pole tracks', tr.k === 0, tr);
  ok('after an edit: the key has its poles at t (the disc formula\'s pole at -0.577i among them)', now.sing.length > 0, now.sing);
  ok('after an edit: the poles found at t are the whole tracks\' poles', now.sing.every((p) => near(p, whole.sing)) && whole.sing.every((p) => near(p, now.sing)), info['after an edit']);
}
return { pass: fails.length === 0, fails, info };
