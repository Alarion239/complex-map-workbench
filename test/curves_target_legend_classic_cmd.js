// The target legend of curve targets, in the classic view: curve targets are drawn, not shaded. The note is the classic
// right pane's head note (#rightNote); the steps view's version is curves_target_legend_cmd.js.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'curves_kit.js'), 'utf8'))({ ev, send, go, load, shot, settled, view, fs, DIR, ok, R });
const { BASE, settle, addFormula } = K;
await view(1440, 900);

await load('curves-p5', Object.assign({}, BASE, { shapes: [], targets: [], steps: [{ type: 'pown', params: { n: 2 }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } }));
await settle();

// the target legend: curve targets are drawn, not shaded
await addFormula('|w| = 1');
await addFormula('Re w^2 = 1');
await settle();
// (on a desktop the target note is Y's head note, "Preimage in X", and what is shaded or drawn is its
// tooltip: with curve targets only, it says they are drawn, and nothing is shaded)
R.legend = await ev(`(() => { const e = document.getElementById('rightNote'); return e && !e.hidden ? [e.textContent, e.dataset.tip || ''] : []; })()`);
ok('the legend of curve targets says drawn, not shaded', R.legend.some((t) => /drawn/i.test(t)) && !R.legend.some((t) => /shaded/i.test(t)), R.legend);
R.logs = (await logs()).filter((l) => /EXC|error/i.test(l.t));
ok('no page errors (the legend)', !R.logs.length, R.logs);
return { pass: !fails.length, fails, results: R };
