// What the curves suite leaves for the steps view (#699): the preimages of five targets drawn on the source plane. The
// target legend is curves_target_legend_cmd.js (the classic right pane's note) and the inverse renderer's formula areas are
// curves_target_areas_cmd.js (waiting on #758).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'curves_kit.js'), 'utf8'))({ ev, send, go, load, shot, settled, view, fs, DIR, ok, R });
await view(1440, 900);

// ------------------------------------------------------------------ exact truth: the five preimage scenes
const SCENES = ['pre_target_lemniscate_exp', 'pre_target_tan_poles', 'pre_target_complex_sides_0', 'pre_target_complex_sides_0.25', 'pre_target_complex_sides_0.5'];
for (const sc of K.SC) if (SCENES.includes(sc.name)) await K.runScene(sc);

R.logs = (await logs()).filter((l) => /EXC|error/i.test(l.t));
ok('no page errors (the preimage scenes)', !R.logs.length, R.logs);
return { pass: !fails.length, fails, results: R };
