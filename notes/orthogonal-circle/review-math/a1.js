const out = {};
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const CI = (o) => ev(`__cmwCI(${JSON.stringify(o || null)})`);
const ST = () => CI({ shapes: true });
const byId = (st, id) => st.list.find((s) => s.id === id);
const rowD = (id) => ev(`(document.querySelector('.shape[data-id="${id}"] .d') || {}).textContent`);
const menuClick = (start) => ev(`(() => { const b = [...document.querySelectorAll('.ctx-menu .mi, .menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).find((b) => b.textContent.trim().startsWith(${JSON.stringify(start)})); if (b) b.click(); return !!b; })()`);
const menuItems = () => ev(`[...document.querySelectorAll('.ctx-menu .mi, .menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim())`);
const tool = async (id) => { await clickSel(`#tools .tool[data-tool="${id}"], #constructTools .tool[data-tool="${id}"]`); await settle(120); };
const V = (o) => Object.assign({ ci: 1, visible: true }, o);
// ---------- scene 1: a perpendicular circle Q built on a touching circle K; Use complement on K
await load('mrv1', { shapes: [V({ id: 'c', kind: 'circle', c: [0, 0], r: 1, ci: 0 }), V({ id: 't', kind: 'point', p: [0, 0], t: 0.1, def: { op: 'glider', args: [{ s: 'c', part: 0 }] } }), V({ id: 'p', kind: 'point', p: [2, 0.5] }),
  V({ id: 'k', kind: 'circle', c: [0, 0], r: 1, ci: 2, def: { op: 'touch', args: [{ s: 'c', part: 0 }, { s: 't' }, { s: 'p' }], fill: 'none' } }),
  V({ id: 'a', kind: 'point', p: [1.5, -0.3] }), V({ id: 'b', kind: 'point', p: [0.4, 1.7] }),
  V({ id: 'q', kind: 'disc', c: [0, 0], r: 1, ci: 3, def: { op: 'perp', args: [{ s: 'k', part: 0 }, { s: 'a' }, { s: 'b' }], fill: 'in' } }),
  V({ id: 'g', kind: 'point', p: [0, 0], t: 0.3, def: { op: 'glider', args: [{ s: 'q', part: 0 }] } })], steps: [], srcView: { cx: 0.5, cy: 0.3, s: 70 }, nextId: 50 });
await settle(800);
let st = await ST();
out.s1_before = { q: { kind: byId(st, 'q').kind, comp: byId(st, 'q').complement, A: byId(st, 'q').A }, g: byId(st, 'g').p, row: await rowD('q') };
await tool('select');
await clickSel(`.shape[data-id="k"] .icon-btn.more`); await settle(250);
out.s1_menu = await menuItems();
await menuClick('Region'); await settle(300);
await clickSel(`.shape[data-id="k"] .icon-btn.more`); await settle(250);
out.s1_uc = await menuClick('Use complement'); await settle(400);
st = await ST();
out.s1_after = { k: { comp: byId(st, 'k').complement, flip: byId(st, 'k').def.flip }, q: { kind: byId(st, 'q').kind, comp: byId(st, 'q').complement, A: byId(st, 'q').A }, g: byId(st, 'g').p, row: await rowD('q') };
await shot('mrv-s1-after');
// ---------- scene 2: rect handle a as T on side 0, then drag handle b below a
await load('mrv2', { shapes: [V({ id: 'r', kind: 'rect', a: [0, 0], b: [2, 1], ci: 0 }), V({ id: 'p', kind: 'point', p: [1, 2] }),
  V({ id: 'k', kind: 'circle', c: [0, 0], r: 1, ci: 2, def: { op: 'touch', args: [{ s: 'r', part: 0 }, { s: 'r', h: 'a' }, { s: 'p' }], fill: 'none' } }),
  V({ id: 'm', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'r', part: 0 }], index: 0 } })], steps: [], srcView: { cx: 1, cy: 0.5, s: 90 }, nextId: 50 });
await settle(800);
st = await ST();
out.s2_before = { k: [byId(st, 'k').kind, byId(st, 'k').c, byId(st, 'k').r], m: byId(st, 'm').p, mrow: await rowD('m'), krow: await rowD('k') };
await tool('select');
await clickSel(`.shape[data-id="r"] .name`); await settle(200);
const [x0, y0] = await ev(`__cmwW2S('L', 2, 1)`), [x1, y1] = await ev(`__cmwW2S('L', 2, -1)`);
await drag(x0, y0, x1, y1, 12, 20); await settle(400);
st = await ST();
const r = byId(st, 'r');
out.s2_after = { rect: [r.a, r.b], k: [byId(st, 'k').kind, byId(st, 'k').c, byId(st, 'k').r, byId(st, 'k').cundef], m: byId(st, 'm').p, mUndef: byId(st, 'm').cundef || null, mrow: await rowD('m'), krow: await rowD('k') };
await shot('mrv-s2-after');
// Intersect tool on K and the bottom side (the meet rule on pieces)
out.s2_meetsPieces = await ev(`(() => { const S = __cmwPlaneMenu().shapes(); const k = S.find((s) => s.id === 'k'), r = S.find((s) => s.id === 'r'); return null; })()`);
// ---------- scene 3: perpendicular to a tilted line through grid points, P Q on a perpendicular (decimals), Region
await load('mrv3', { shapes: [V({ id: 'c', kind: 'line', a: [0, 0], b: [1, 2], ci: 0 }), V({ id: 'p', kind: 'point', p: [-0.5, 0.3] }), V({ id: 'q', kind: 'point', p: [-0.3, 0.2] }),
  V({ id: 'k', kind: 'disc', c: [0, 0], r: 1, ci: 2, def: { op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p' }, { s: 'q' }], fill: 'in' } }),
  V({ id: 'm0', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'c', part: 0 }], index: 0 } }),
  V({ id: 'm1', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'c', part: 0 }], index: 1 } }),
  V({ id: 'p2', kind: 'point', p: [-0.5, 0.25] }), V({ id: 'q2', kind: 'point', p: [-0.25, 0.125] }),
  V({ id: 'k2', kind: 'disc', c: [0, 0], r: 1, ci: 3, def: { op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p2' }, { s: 'q2' }], fill: 'in' } })], steps: [], srcView: { cx: 0, cy: 0.3, s: 120 }, nextId: 50 });
await settle(900);
st = await ST();
const nm = await CI({ names: true });
out.s3 = { k: { kind: byId(st, 'k').kind, c: byId(st, 'k').c, r: byId(st, 'k').r, comp: byId(st, 'k').complement, A: byId(st, 'k').A, row: await rowD('k') },
  k2: { kind: byId(st, 'k2').kind, a: byId(st, 'k2').a, b: byId(st, 'k2').b, A: byId(st, 'k2').A, row: await rowD('k2') },
  m0: [byId(st, 'm0').p, byId(st, 'm0').inf, await rowD('m0')], m1: [byId(st, 'm1').p, byId(st, 'm1').inf] };
await shot('mrv-s3');
out.logs = (await logs()).filter((x) => /EXC|error/.test(x.t)).slice(0, 5);
return out;
