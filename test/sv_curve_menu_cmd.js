// A curve drawn in plane w₁ of the steps view is found where it is drawn: the plane menu's line integral (and its
// curve, mapped from the shape's own plane) on the circle itself, nothing at the point where a point of z on that
// circle would land. The chain z → w₁ = z² → w₂ = w₁³; the circle |w₁ − 0.8i| = 0.3 of plane w₁. On plane w₁ a
// right-click on its top point 1.1i offers the integral, one at −1.21 (1.1i squared) offers none, and the integral's
// curve is the circle in plane w₁ (its box). The same in the classic view with step 2 focused (its left plane is w₁).
// And a right-click at the page's first moment opens the menu as any other does.
// A command file for a CDP daemon.
const fails = [];
const ok = (name, pass, got) => { if (!pass) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const menu = () => ev(`(() => { const p = document.querySelector('#popHost .pop.menu.pm'); return p ? [...p.querySelectorAll('.mi')].map((b) => b.dataset.pm) : null; })()`);
const closeAll = async () => { for (let i = 0; i < 2 && (await ev(`!!document.querySelector('#popHost .pop')`)); i++) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await settled({ max: 2000, until: `!document.querySelector('#popHost .pop')` }); } };
const rclick = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
  await settled({ max: 3000, until: `!!document.querySelector('#popHost .pop.menu')` });
};
// the client point of w in the left plane, once the pane's view holds still (two reads, each once the page is
// quiet, agree)
const at = async (re, im) => {
  let p = await ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`);
  for (let i = 0; i < 20; i++) {
    await settled({ max: 3000 });
    const q = await ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`);
    if (Math.abs(q[0] - p[0]) < 0.5 && Math.abs(q[1] - p[1]) < 0.5) return q;
    p = q;
  }
  return p;
};
// what is under client point (x, y): the element's id or class (a popover or overlay there takes the click)
const under = (x, y) => ev(`(() => { const e = document.elementFromPoint(${x}, ${y}); return e ? e.id || String(e.className) : null; })()`);
const CIRCLE = { id: 'c1', kind: 'circle', c: [0, 0.8], r: 0.3, ci: 0, visible: true, stage: 1 };
await view(1440, 900, false, false);
for (const [where, url, toPlane] of [['steps view, plane w₁', 'view=steps', `__cmwSteps({ go: 1, now: true })`], ['classic view, step 2 focused', '', '']]) {
  const ns = 'svcm' + Date.now();
  await go(`${BASE}/gl-helpers.html`);
  const o = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: url ? 0 : 2, shapes: [CIRCLE], steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'pown', params: { n: 3 }, on: true }] };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await go(`${BASE}/test.html?ns=${ns}${url ? '&' + url : ''}`);
  await settled({ max: 15000, until: `typeof __cmwPlaneMenu === 'function'${url ? " && typeof __cmwSteps === 'function'" : ''}` });
  if (toPlane) { await ev(`${toPlane}, 1`); await settled({ max: 15000, until: `!__cmwSteps().moving` }); }
  ok(`${where}: the left plane is w₁`, (await ev(`__cmwPlaneMenu().leftStage()`)) === 1, await ev(`__cmwPlaneMenu().leftStage()`));
  await closeAll();
  const [x1, y1] = await at(0, 1.1);
  const hit = await under(x1, y1);
  await rclick(x1, y1);
  const on = await menu();
  ok(`${where}: a right-click on the circle offers its line integral`, !!on && on.includes('integral'), { menu: on, at: [x1, y1], under: hit });
  if (on && on.includes('integral')) {
    const pick = await ev(`(() => { const b = document.querySelector('#popHost .pop.menu.pm .mi[data-pm="integral"]'); const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pick[0], y: pick[1], button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pick[0], y: pick[1], button: 'left', buttons: 0, clickCount: 1 });
    await settled({ max: 5000, until: `!!document.querySelector('#popHost .int-pop')` });
    const box = await ev(`__cmwPlaneMenu().curveBox('c1')`);
    // (the curve the integral runs along: the circle in plane w₁, its box 0.6 by 0.6 about 0.8i; 0.02 is room for the
    // sampled polygon's sag inside the circle, where the curve of a wrong plane is off by more than 0.5)
    ok(`${where}: the integral runs along the circle in plane w₁`, !!box && Math.abs(box.x0 + 0.3) < 0.02 && Math.abs(box.x1 - 0.3) < 0.02 && Math.abs(box.y0 - 0.5) < 0.02 && Math.abs(box.y1 - 1.1) < 0.02, box);
  }
  await closeAll();
  const [x2, y2] = await at(-1.21, 0);
  await rclick(x2, y2);
  const off = await menu();
  ok(`${where}: a right-click at −1.21 (the circle's top point squared) offers no integral`, !off || !off.includes('integral'), off);
  await closeAll();
}
// a right-click as soon as the page is up (a fast machine has it up within a second of loading): the page's clock
// starts again at 0 just before it, and the menu opens all the same
{
  const ns = 'svcm0' + Date.now();
  await go(`${BASE}/gl-helpers.html`);
  const o = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 2, shapes: [CIRCLE], steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'pown', params: { n: 3 }, on: true }] };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await go(`${BASE}/test.html?ns=${ns}`);
  await settled({ max: 15000, until: `typeof __cmwPlaneMenu === 'function'` });
  const [x, y] = await at(0, 1.1);
  const t = await ev(`(() => { const now = performance.now.bind(performance), t0 = now(); performance.now = () => now() - t0; return Math.round(performance.now()); })()`);
  await rclick(x, y);
  const m = await menu();
  ok('a right-click on the circle at the page\'s first moment offers its line integral', !!m && m.includes('integral'), { menu: m, t });
}
return { pass: fails.length === 0, fails };
