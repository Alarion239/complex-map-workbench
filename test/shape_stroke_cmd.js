// The stroke rule every outline draws with (shapeStroke): a curve 2 px with a 4 px halo, a region's edge 1.5 px with 3.5 px, a grid on a
// flat plane 1 px at alpha 0.8 with 2.5 px; selected on its plane +0.75 (the halo too). The globes' lines (opt.still) draw every
// curve, a grid included, at its plain width with neither emphasis; a target outline's canvas stroke takes the halo as width + 2.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'curves_kit.js'), 'utf8'))({ ev, send, go, load, shot, settled, view, fs, DIR, ok: (n, c, g) => ok(n, c, g), R });
await view(1200, 800);
await load('shape-stroke' + Date.now(), Object.assign({}, K.BASE, {
  shapes: [
    { id: 'a1', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true },
    { id: 'a2', kind: 'disc', c: [-0.4, 0.3], r: 0.6, ci: 1, visible: true },
    { id: 'a3', kind: 'cgrid', a: [-1, -1], b: [1, 1], n: 4, ci: 2, visible: true },
  ],
  targets: [{ id: 't1', kind: 'disc', c: [0.5, 0.2], r: 0.7, ci: 3, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }],
}));
await settled({ floor: 300, max: 15000, until: "typeof __cmwStroke === 'function' && __cmwShapes().shapes.length === 3" });
ok('the page is the steps view', (await ev('__cmwSteps().on')) === true, await ev('__cmwSteps().on'));
const st = (id, opt) => ev(`__cmwStroke('${id}', ${JSON.stringify(opt || {})})`);
const same = (a, b) => !!a && Object.keys(b).every((k) => Math.abs(a[k] - b[k]) < 1e-9);
R.circle = await st('a1'); ok('a curve: 2 px, halo 4 px', same(R.circle, { width: 2, alpha: 1, casing: 4 }), R.circle);
R.disc = await st('a2'); ok('a region\'s edge: 1.5 px, halo 3.5 px', same(R.disc, { width: 1.5, alpha: 1, casing: 3.5 }), R.disc);
R.grid = await st('a3'); ok('a grid on a flat plane: 1 px at alpha 0.8, halo 2.5 px', same(R.grid, { width: 1, alpha: 0.8, casing: 2.5 }), R.grid);
R.gridG = await st('a3', { still: true }); ok('a grid on a globe: drawn as a curve, 2 px, halo 4 px', same(R.gridG, { width: 2, alpha: 1, casing: 4 }), R.gridG);
await ev(`__cmwSelect('a1'); 1`);
await settled({ floor: 300, max: 15000, until: "__cmwShapes().selected === 'a1'" });
R.sel = await st('a1', { domain: true }); ok('selected on its plane: +0.75 px, the halo too', same(R.sel, { width: 2.75, casing: 4.75 }), R.sel);
R.selG = await st('a1', { domain: true, still: true }); ok('on a globe the selection adds nothing', same(R.selG, { width: 2, casing: 4 }), R.selG);
await ev(`__cmwSelect('t1'); 1`);
await settled({ floor: 300, max: 15000, until: "__cmwShapes().selected === 't1'" });
ok('the target t1 is selected in the steps view', (await ev('__cmwShapes().selected')) === 't1', await ev('__cmwShapes().selected'));
R.tgt = await st('t1', { domain: true }); ok('a selected target outline: its halo is its width + 2', same(R.tgt, { width: 2.25, casing: 4.25 }), R.tgt);
return { pass: fails.length === 0, fails, results: R };
