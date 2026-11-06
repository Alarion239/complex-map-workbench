// The Joukowski airfoil's glide at u = 0.25, 0.3 and 0.75: the carried mesh's frame (__cmwSteps({ mesh: true })) is the
// inverse pass's exact picture (the same u, the whole colour layer without the grid, outlines and labels, bare), to
// within the acceptance suite's bound (steps_glide_look_cmd.js: at most 0.5 % of the pixels more than 32/255 apart in a
// channel). The glide's power path bends the map across the lower half of the pane, so a polar annulus of a fixed 48 cells
// a turn leaves 0.84 % of the pixels at u = 0.3 further off than that: the annulus takes the cells its map's curvature
// needs (svPolarCells).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const OVER = 32, MAX_SHARE = 0.5;
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const wait = async () => { await settled({ max: 60000, until: '__cmwSvFixed() && !__cmwSphere().running && !__cmwSphere().jobs.length' }); };
const ready = async () => { await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSvFixed === "function" && typeof __cmwSphere === "function"' }); };
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const EX = exampleNames().indexOf('Joukowski airfoil');
ok('the Joukowski example is found', EX >= 0, EX);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=jkc${Date.now()}`);
await ready();
await ev("__cmwSet('morphPaths', false), 1");
await ev(`__cmwExample(${EX}); 1`);
await wait();
await ev(`__cmwSteps({ scope: 'all', surf: 'plane', bare: true }), 1`);
const at = async (x) => { await ev(`__cmwSteps({ x: ${x} }), 1`); await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${x}) < 1e-9 && GLR.pendingLinks === 0` }); await new Promise((r) => setTimeout(r, 300)); };
const still = async (tag) => { await settled({ max: 20000 }); ok(`the frame ${tag} settles`, await grab(tag), null); };
for (const x of [0.25, 0.3, 0.75]) {
  await ev(`__cmwSteps({ mesh: false }), 1`); await at(x); await still('E' + x);
  const pe = await ev(`__cmwSteps().glide && __cmwSteps().glide.path`);
  // (the mesh's frame is reached from the other side of x, so it is drawn afresh)
  await ev(`__cmwSteps({ mesh: true, x: ${x + 0.013} }), 1`); await at(x); await still('M' + x);
  const pm = await ev(`__cmwSteps().glide && __cmwSteps().glide.path`);
  ok(`x = ${x}: the exact frame is the inverse pass's and the other the carried mesh's`, pe === 'inverse' && pm === 'mesh', { pe, pm });
  const share = await ev(`(() => { const K = window.__heldPx, a = K['E${x}'], b = K['M${x}']; let c = 0; for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > ${OVER}) c++; return +(100 * c / (a.length / 4)).toFixed(3); })()`);
  info[x] = { over: share };
  ok(`x = ${x}: at most ${MAX_SHARE} % of the pixels of the mesh's frame are more than ${OVER}/255 from the exact picture`, share <= MAX_SHARE, share);
}
await ev(`__cmwSteps({ mesh: false }), 1`);
return { pass: fails.length === 0, fails, info };
