const fails = [], info = {};
let checks = 0;
const ok = (name, cond, got) => { checks++; if (!cond) fails.push({ name, got }); };
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error' || x.t === 'warning') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const CI = (o) => ev(`__cmwCI(${JSON.stringify(o || null)})`);
const ST = () => CI({ shapes: true });
const byId = (st, id) => st.list.find((s) => s.id === id);
const last = (st) => st.list[st.list.length - 1];
const tool = async (id) => { const r = await clickSel(`#tools .tool[data-tool="${id}"], #constructTools .tool[data-tool="${id}"]`); await settle(120); return r; };
const chipT = (side = 'L') => ev(`(document.querySelector('#draftChip${side} .cm-t') || {}).textContent || ''`);
const rowD = (id) => ev(`(document.querySelector('.shape[data-id="${id}"] .d') || {}).textContent`);
const toastAll = () => ev(`[...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.trim()).join(' | ')`);
const names = async () => { const n = await CI({ names: true }); return (id) => (n.find((x) => x.id === id) || {}).name; };
const menuItems = () => ev(`[...document.querySelectorAll('.menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim())`);
const menuClick = (start) => ev(`(() => { const b = [...document.querySelectorAll('.menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).find((b) => b.textContent.trim().startsWith(${JSON.stringify(start)})); if (b) b.click(); return !!b; })()`);
const NS = 'vd' + (Date.now() % 1000000);
const base = (shapes, o) => Object.assign({ shapes, steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0.3, cy: 0, s: 75 }, unit: true, snap: true, nextId: 50, pattern: 'checker' }, o || {});
const mdrag = async (p0, p1, n = 12) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p0[0], y: p0[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p0[0], y: p0[1], button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= n; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p0[0] + (p1[0] - p0[0]) * i / n, y: p0[1] + (p1[1] - p0[1]) * i / n, button: 'left', buttons: 1 }); await sleep(16); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p1[0], y: p1[1], button: 'left', buttons: 0, clickCount: 1 });
  await settle(250);
};
await view(1440, 900, false, false);

const pt = (id, p) => ({ id, kind: 'point', p, ci: 1, visible: true });
await view(1440, 900, false, false);
const perpS = (id, c, a, b) => ({ id, kind: 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'perp', args: [{ s: c, part: 0 }, { s: a }, { s: b }], fill: 'none', nk: 'circle' } });
const sh = [{ id: 'C3', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'u0' }, { s: 'u1' }, { s: 'u2' }] } }, pt('u0', [0, 0]), pt('u1', [1, 0]), pt('u2', [0, 1]),
  pt('p1', [1, 0.5]), pt('q1', [1.5, 0.5]), perpS('k1', 'C3', 'p1', 'q1'), pt('p2', [0.6, 0.5]), pt('q2', [5.5, 0.5]), perpS('k2', 'C3', 'p2', 'q2'),
  { id: 'Cr', kind: 'circle', c: [0.5, 0.5], r: Math.SQRT1_2, ci: 0, visible: true }, pt('p3', [1, 0.5]), pt('q3', [1.5, 0.5]), perpS('k3', 'Cr', 'p3', 'q3'), pt('p4', [0.6, 0.5]), pt('q4', [5.5, 0.5]), perpS('k4', 'Cr', 'p4', 'q4')];
await load(NS + 'c3', base(sh)); await settle(1000);
const st = await ST();
const out = (id) => { const s = byId(st, id); return s.cundef ? 'undef:' + s.cundef.code : s.kind; };
const C3 = byId(st, 'C3');
await tool('perp');
const chip = await ev(`(() => { const c = document.querySelector('#draftChipL'); return [...c.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => ({ t: e.textContent.trim().slice(0, 50), vis: !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none' })); })()`);
return { binC3: out('k1'), decC3: out('k2'), binCr: out('k3'), decCr: out('k4'), C3: [C3.c, C3.r], chip };
