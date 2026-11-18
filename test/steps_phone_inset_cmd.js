// On a phone in the steps view the plane is the whole picture: no inset (the small second plane of the old two-plane
// layout) stands over it, at any plane of the chain. A chain of two steps, walked from z to its last plane, at 360 x 640 and
// 740 x 360, touch. A command file for a CDP daemon
// (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svi' + (Date.now() % 100000);
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const insets = () => ev(`[...document.querySelectorAll('.pane.ph-inset')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, shown: r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden', box: [r.left, r.top, r.width, r.height].map(Math.round) }; })`);
const open = async (w, h, query) => {
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}${w}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}${w}&lang=en${query}`);
};
for (const [w, h] of [[360, 640], [740, 360]]) {
  await open(w, h, '&view=steps');
  await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && __cmwSteps().on && __cmwSteps().planes.length > 2 && document.documentElement.classList.contains('ph')` });
  for (const k of [0, 1, 2]) {
    await ev(`__cmwSteps({ T: 0, go: ${k}, now: true }); 1`);
    await settled({ max: 30000, until: `__cmwSteps().i === ${k} && !__cmwSteps().moving` });
    const list = await insets();
    info[`${w}x${h} plane ${k}`] = list;
    ok(`${w} x ${h}, plane ${k}: no inset stands over the plane`, list.filter((i) => i.shown).length === 0, list);
  }
}
return { pass: fails.length === 0, fails, info };
