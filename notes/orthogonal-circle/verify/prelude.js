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
const NS = 'fx' + (Date.now() % 1000000);
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
