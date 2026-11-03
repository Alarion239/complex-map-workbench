// What the curves suite leaves for the steps view (#699): the preimages of five targets drawn on the source plane, the
// legend of curve targets, and the inverse renderer's formula areas. In the classic view they run as part of what
// curves_cmd.js had; the steps view draws the five preimages with more ink than the tolerance, and has no right pane for the
// legend and the renderer paths.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'curves_kit.js'), 'utf8'))({ ev, send, nav, load, shot, settled, view, fs, DIR, ok, R });
const { BASE, settle, addFormula } = K;
await view(1440, 900);

// ------------------------------------------------------------------ exact truth: the five preimage scenes
const SCENES = ['pre_target_lemniscate_exp', 'pre_target_tan_poles', 'pre_target_complex_sides_0', 'pre_target_complex_sides_0.25', 'pre_target_complex_sides_0.5'];
for (const sc of K.SC) if (SCENES.includes(sc.name)) await K.runScene(sc);

// ------------------------------------------------------------------ the legend and the formula areas
{
  await load('curves-p5', Object.assign({}, BASE, { shapes: [], targets: [], steps: [{ type: 'pown', params: { n: 2 }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } }));
  await settle(1500);
  // the target legend: curve targets are drawn, not shaded
  await addFormula('|w| = 1');
  await addFormula('Re w^2 = 1');
  await settle(1200);
  // (v16.5 UX20: on a desktop the target note is Y's head note, "Preimage in X", and what is shaded or drawn is its
  // tooltip: with curve targets only, it says they are drawn, and nothing is shaded)
  R.legend = await ev(`(() => { const e = document.getElementById('rightNote'); return e && !e.hidden ? [e.textContent, e.dataset.tip || ''] : []; })()`);
  ok('the legend of curve targets says drawn, not shaded', R.legend.some((t) => /drawn/i.test(t)) && !R.legend.some((t) => /shaded/i.test(t)), R.legend);
  // the inverse renderer's formula areas keep their own cap of 4 (the preimage pass's 8 is for traced targets)
  const six = ['|z| < 1', '|z-1| < 0.5', '|z+1| < 0.5', '|z-i| < 0.5', '|z+i| < 0.5', '|z-2| < 0.3'].map((e, i) => ({ id: 'f' + i, kind: 'formula', expr: e, ci: i, visible: true }));
  await load('curves-p5b', Object.assign({}, BASE, { shapes: six, targets: [], steps: [{ type: 'pown', params: { n: 2 }, on: true }] }));
  await settle(2500);
  R.sixPaths = await ev('__cmwPaths()');
  const rp = R.sixPaths.filter((p) => p.role === 'R');
  ok('formula areas: the first four draw inverse, the fifth and sixth forward (fifth formula shape)', rp.length === 6 && rp.slice(0, 4).every((p) => p.path === 'inverse') && rp.slice(4).every((p) => p.path === 'forward' && /fifth formula shape/.test(p.reason || '')), rp);
}
R.logs = (await logs()).filter((l) => /EXC|error/i.test(l.t));
ok('no page errors (the preimage scenes, the legend, the formula areas)', !R.logs.length, R.logs);
return { pass: !fails.length, fails, results: R };
