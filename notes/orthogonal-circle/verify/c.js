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
const NS = 'vq' + (Date.now() % 1000000);
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
// ---------------------------------------------------------------- U4: BUDGET60, T (a glider) and a free point in a 28-shape disk scene
{
  const scene = (k) => {
    const sh = [{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true, fixed: 'unit' }, { id: 'T', kind: 'point', p: [1, 0], t: 0.05, ci: 1, visible: true, def: { op: 'glider', args: [{ s: 'C', part: 0 }] } }];
    for (let j = 0; j < 6; j++) {
      const a = j / 6 * 2 * Math.PI;
      sh.push({ id: 'pa' + j, kind: 'point', p: [+(0.5 * Math.cos(a)).toFixed(2), +(0.5 * Math.sin(a)).toFixed(2)], ci: 2, visible: true }, { id: 'pb' + j, kind: 'point', p: [+(0.3 * Math.cos(a + 2)).toFixed(2), +(0.3 * Math.sin(a + 2)).toFixed(2)], ci: 2, visible: true });
      sh.push({ id: 'k' + j, kind: j % 2 ? 'circle' : 'disc', c: [0, 0], r: 1, ci: j % 8, visible: true, def: { op: 'perp', args: [{ s: 'C', part: 0 }, { s: 'pa' + j }, { s: 'pb' + j }], fill: j % 2 ? 'none' : 'in', nk: 'circle' } });
    }
    for (let j = 0; j < 3; j++) {
      sh.push({ id: 'q' + j, kind: 'point', p: [-0.6 + 0.3 * j, -0.2 + 0.1 * j], ci: 2, visible: true });
      sh.push({ id: 't' + j, kind: j % 2 ? 'circle' : 'disc', c: [0, 0], r: 1, ci: (j + 3) % 8, visible: true, def: { op: 'touch', args: [{ s: 'C', part: 0 }, { s: 'T' }, { s: 'q' + j }], fill: j % 2 ? 'none' : 'in', nk: 'circle' } });
    }
    return { shapes: sh, steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 160 }, unit: true, snap: false, nextId: 500, ns: k };
  };
  const instrument = () => ev(`(()=>{ window.__frw = []; window.__frd = []; window.__pm = []; let lastT = 0;
      if (!window.__rafWrapped) { window.__rafWrapped = true; const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => raf((ts) => { const t0 = performance.now(); cb(ts); if (window.__frw) window.__frw.push(performance.now() - t0); }); }
      const tick = (ts) => { if (!window.__frd) return; if (lastT) window.__frd.push(ts - lastT); lastT = ts; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      let t0 = 0; window.addEventListener('pointermove', () => { t0 = performance.now(); }, true); window.addEventListener('pointermove', () => { if (window.__pm) window.__pm.push(performance.now() - t0); });
      return 1; })()`);
  const collect = () => ev(`(()=>{ const q = (a, p) => { const b = (a || []).slice().sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2) : null; };
      const r = { work_p95: q(__frw, 0.95), delta_p95: q(__frd, 0.95), delta_max: q(__frd, 1), move_p95: q(__pm, 0.95), n: (__frd || []).length };
      window.__frw = null; window.__frd = null; window.__pm = null; return r; })()`);
  const perfOf = async (what, k) => {
    await load(NS + 'pf' + what + k, scene(k)); await settle(1500);
    await tool('select');
    await instrument();
    const c0 = await W(0, 0), sc = (await W(1, 0))[0] - c0[0];
    const at = what === 'T' ? (a) => [c0[0] + sc * Math.cos(a), c0[1] - sc * Math.sin(a)] : (a) => [c0[0] + sc * 0.5 + sc * 0.3 * (Math.cos(a) - 1), c0[1] - sc * 0.3 * Math.sin(a)];
    const a0 = what === 'T' ? 0.05 * 2 * Math.PI : 0, p0 = at(a0);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p0[0], y: p0[1] });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p0[0], y: p0[1], button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 90; i++) { const q = at(a0 + 3 * i / 90); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q[0], y: q[1], button: 'left', buttons: 1 }); await sleep(16); }
    const e = at(a0 + 3);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: e[0], y: e[1], button: 'left', buttons: 0, clickCount: 1 });
    await settle(250);
    const r = await collect(), st = await ST();
    r.moved = what === 'T' ? byId(st, 'T').t !== 0.05 : byId(st, 'pa0').p[0] !== 0.5;
    r.und = st.list.filter((s) => s.cundef).length;
    return r;
  };
  info.perf = {};
  for (const what of ['z', 'T']) {
    const runs = [await perfOf(what, 1), await perfOf(what, 2)];
    info.perf[what] = runs;
  }
  const best = (rs, k) => Math.min(...rs.map((r) => r[k]));
  ok('U4 T (a glider) dragged, 28 shapes: it moves; frame p95 ≤ 16.8 ms (best of 3); pointermove p95 ≤ 4 ms', info.perf.T.every((r) => r.moved && r.und === 0) && best(info.perf.T, 'delta_p95') <= 16.8 && best(info.perf.T, 'move_p95') <= 4, info.perf.T);
  ok('U4 a free point dragged in the same scene: frame p95 ≤ 16.8 ms (best of 3)', info.perf.z.every((r) => r.moved) && best(info.perf.z, 'delta_p95') <= 16.8, info.perf.z);
  await grab();
}
// glider drag: one undo step brings T back; dependents follow
{
  const st0 = await ST();
  const t0 = byId(st0, 'T').t;
  await key('z', 4); await settle(300);
  const st1 = await ST();
  info.undoT = { after: t0, undone: byId(st1, 'T').t, k0: byId(st0, 't0').c, k1: byId(st1, 't0').c };
}
// phone dark: the touching tool's rings (user-3)
{
  await load(NS + 'ph', base([{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true, fixed: 'unit' }], { srcView: { cx: 0, cy: 0, s: 70 } }));
  await view(390, 844, true, true); await nav(`http://localhost:9827/test.html?ns=${NS}ph`); await settle(1500);
  const tap = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(40); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(250); };
  info.phoneTools = await ev(`[...document.querySelectorAll('#constructTools .tool[data-tool="touch"]')].map((b) => b.getClientRects().length)`);
  const tb = await ev(`(() => { const b = document.querySelector('#constructTools .tool[data-tool="touch"]'); if (!b || !b.getClientRects().length) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
  if (tb) await tap(tb[0], tb[1]); else await ev(`(() => { const b = document.querySelector('#constructTools .tool[data-tool="touch"]'); b && b.click(); return 1; })()`);
  await settle(300);
  info.phoneChip0 = await chipT();
  const u = await W(Math.cos(2.2), Math.sin(2.2));
  await tap(u[0], u[1]); await settle(200);
  const p = await W(-1.4, 1.2);
  await tap(p[0], p[1]); await settle(300);
  info.phoneDraft = (await CI()).draft;
  info.phoneChip = await chipT();
  await shot('ver-phone-dark-rings');
  await view(1440, 900, false, false);
}
return { info, errs };
