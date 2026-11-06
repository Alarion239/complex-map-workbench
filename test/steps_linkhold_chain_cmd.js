// After a chain change (a step put first), while the new chain's programs link (GLR.holdLinks), the frame the pane
// shows parked between planes is the picture of the current chain: the plane parked at rest, or nothing; never another
// chain's picture. The seams chain (exp, log; Everywhere), a Mul put first, parked at 2.5 with the links held, against
// the same chain's plane 2 parked at rest with the links let go.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const { grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const ns = 'lhc' + Date.now();
const shapes = [{ id: 's1', kind: 'disc', c: [0, 0], r: 2, ci: 0, visible: true }, { id: 's2', kind: 'rect', a: [-1.5, -1.2], b: [1.2, 1.4], ci: 1, visible: true }];
await seed(ns, { steps: [{ id: 'f1', type: 'exp', params: {} }, { id: 'f2', type: 'log', params: { cut: 180, k: 0 } }], shapes, focus: 2 });
await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ T: 0 }); 1`);
await settled({ max: 20000 });
await ev('GLR.holdLinks(true), 1');
await ev(`__cmwAddStep('mul', { c: '1' }, 0), 1`);
await settled({ max: 20000, panes: false, until: '__cmwSteps().planes.length === 4' });
await ev(`__cmwSteps({ scope: 'all', surf: 'plane', park: 2.5 }); 1`);
await settled({ max: 20000, panes: false, until: 'Math.abs(__cmwSvX() - 2.5) < 0.01' });
info.pending = await ev('GLR.pendingLinks');
ok('the new chain\'s programs are still linking', info.pending > 0, info);
ok('held frame is kept', await grab('held'), null);
await ev('GLR.holdLinks(false), 1');
await settled({ max: 60000 });
await ev(`__cmwSteps({ scope: 'all', surf: 'plane', park: 2.0 }); 1`);
await settled({ max: 60000 });
ok('plane 2 at rest is kept', await grab('ref'), null);
info.cmp = await compare('held', 'ref');
// (neutral: the pane's paper, its grid and rulers, grey pixels; another chain's picture is colour)
const blank = await ev(`(() => { const P = window.__heldPx.held; let n = 0; for (let i = 0; i < P.length; i += 4) if (Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) < 20) n++; return n / (P.length / 4); })()`);
info.blank = blank;
ok('the held frame is the current chain\'s plane 2 or a neutral frame, never another picture', info.cmp && (info.cmp.frac <= 0.005 || blank > 0.95), info);
return { pass: fails.length === 0, fails, info };
