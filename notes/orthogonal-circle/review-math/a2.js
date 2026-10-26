const out = {};
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const CI = (o) => ev(`__cmwCI(${JSON.stringify(o || null)})`);
const ST = () => CI({ shapes: true });
const byId = (st, id) => st.list.find((s) => s.id === id);
const rowD = (id) => ev(`(document.querySelector('.shape[data-id="${id}"] .d') || {}).textContent`);
const tool = async (id) => { await clickSel(`#tools .tool[data-tool="${id}"], #constructTools .tool[data-tool="${id}"]`); await settle(120); };
const V = (o) => Object.assign({ ci: 1, visible: true }, o);
await load('mrv2b', { shapes: [V({ id: 'r', kind: 'rect', a: [0, 0], b: [2, 1], ci: 0 }), V({ id: 'p', kind: 'point', p: [1, 2] }),
  V({ id: 'k', kind: 'circle', c: [0, 0], r: 1, ci: 2, def: { op: 'touch', args: [{ s: 'r', part: 0 }, { s: 'r', h: 'a' }, { s: 'p' }], fill: 'none' } }),
  V({ id: 'm', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'r', part: 0 }], index: 0 } })], steps: [], srcView: { cx: 1, cy: 0.5, s: 90 }, nextId: 50 });
await settle(800);
await tool('select');
const [sx, sy] = await ev(`__cmwW2S('L', 2, 0.5)`);
await click(sx, sy); await settle(300);
out.sel = await ev(`__cmwPlaneMenu().selected()`);
const [x0, y0] = await ev(`__cmwW2S('L', 2, 1)`), [x1, y1] = await ev(`__cmwW2S('L', 2, -1)`);
await drag(x0, y0, x1, y1, 12, 25); await settle(500);
const st = await ST();
const r = byId(st, 'r');
out.after = { rect: [r.a, r.b], k: [byId(st, 'k').kind, byId(st, 'k').c, byId(st, 'k').r, byId(st, 'k').cundef || null], m: byId(st, 'm').p, mUndef: byId(st, 'm').cundef || null, mrow: await rowD('m'), krow: await rowD('k') };
await shot('mrv-s2b-after');
return out;
