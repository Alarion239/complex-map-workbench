const RECT = [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }];
const r = {};
for (const [nm, steps] of [['logk3', [{ type: 'log', params: { cut: 180, k: 3 }, on: true }]], ['root30k3', [{ type: 'root', params: { n: 30, cut: 180, k: 3 }, on: true }]]]) {
  await load('vz' + nm + Date.now(), { shapes: RECT, steps, view: { main: 'land' }, sheets: true, height: 'im' });
  await sleep(1500);
  r[nm] = await ev(`(() => { const p = __cmwP(); const b = Funcs.build(p.steps[0]); const w = b.f(CX.C(1, 0)); return { params: p.steps[0].params, F1: [w.re, w.im], tex: __cmwCapText(['L']).slice(0, 120) }; })()`);
}
return r;
