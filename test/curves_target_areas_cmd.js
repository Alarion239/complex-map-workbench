// The inverse renderer's formula areas keep their own cap of 4 (the preimage pass's 8 is for traced targets): the
// classic right pane draws the first four inverse and the fifth and sixth forward, and so does the steps view's last plane.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'curves_kit.js'), 'utf8'))({ ev, send, go, load, shot, settled, view, fs, DIR, ok, R });
const { BASE, settle, addFormula } = K;
await view(1440, 900);

// the inverse renderer's formula areas keep their own cap of 4 (the preimage pass's 8 is for traced targets)
const six = ['|z| < 1', '|z-1| < 0.5', '|z+1| < 0.5', '|z-i| < 0.5', '|z+i| < 0.5', '|z-2| < 0.3'].map((e, i) => ({ id: 'f' + i, kind: 'formula', expr: e, ci: i, visible: true }));
await load('curves-p5b', Object.assign({}, BASE, { shapes: six, targets: [], steps: [{ type: 'pown', params: { n: 2 }, on: true }] }));
await settle(2500);
// (the steps view's one plane shows the images on the chain's last step; the classic view's right pane does)
const sv = await ev(`document.documentElement.classList.contains('sv')`);
if (sv) await ev(`__cmwSteps({ go: Math.max(...__cmwSteps().planes), now: true })`);
await settled({ until: `__cmwPaths().length >= 6 && __cmwPaths().every((p) => p.path !== 'pending')`, max: 20000 });
R.sixPaths = await ev('__cmwPaths()');
const rp = R.sixPaths.filter((p) => p.role === (sv ? 'L' : 'R'));
ok('formula areas: the first four draw inverse, the fifth and sixth forward (fifth formula shape)', rp.length === 6 && rp.slice(0, 4).every((p) => p.path === 'inverse') && rp.slice(4).every((p) => p.path === 'forward' && /fifth formula shape/.test(p.reason || '')), rp);
R.logs = (await logs()).filter((l) => /EXC|error/i.test(l.t));
ok('no page errors (the formula areas)', !R.logs.length, R.logs);
return { pass: !fails.length, fails, results: R };
