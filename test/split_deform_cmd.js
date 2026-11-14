// The Split of a formula step into 12 sines in the steps view, and the frame times of the thread playing across them (the
// steps view's Play is its deformation): the Split during a glide or a Play is steps_split_remap_cmd.js, the ‹ › walk of a
// step shown alone is steps_walk_cmd.js. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = 20000) => settled({ until: expr, max });
const ns = 'sdf' + Date.now();
let e = 'z'; for (let i = 0; i < 12; i++) e = `\\sin(${e})`;
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'r1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2] }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 }, steps: [{ type: 'custom', params: { expr: e, cut: 180 }, on: true }] };
await view(1440, 900, false, false);
await nav(`http://localhost:${PORT}/gl-helpers.html`);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane') && __cmwSteps().planes.length > 1", 40000);
await clickSel('#svStrip .sv-step[data-k="1"] .sv-fchip');
await until("!!document.querySelector('#propsPanel .split-offer .so-btn')");
await clickSel('#propsPanel .split-offer .so-btn');
await until('__cmwSteps().planes.length === 13', 60000);
ok('12 sines: 12 steps', (await ev('__cmwP().steps')).length === 12);
await ev('__cmwSteps({ loop: true, play: true })');
await until("__cmwSteps().play === 'glide' && __cmwSteps().x > 2", 180000);   // (past the first planes: the glide's programs are linked)
info.sines12 = await ev('await __qa.frames(3000)');
ok('12 sines, the thread playing: it still plays', (await ev('__cmwSteps().play')) === 'glide');
await ev('__cmwSteps({ play: false })');
ok('12 sines, the deformation playing: p95 ≤ 20 ms', info.sines12.p95 <= 20, info.sines12);
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass, fails, info };
