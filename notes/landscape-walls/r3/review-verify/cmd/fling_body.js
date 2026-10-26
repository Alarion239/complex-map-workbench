// fling the landscape, switch to the planes before the turn dies away; do the quiet-time jobs still run?
const out = [];
for (const [page, fling] of [['base.html', true], ['test.html', true], ['test.html', false], ['base.html', false], ['test.html', true]]) {
  await view(1440, 900, false, false);
  await ld(page, 'fl' + Date.now(), { meshN: 240, shapes: [{ id: 's1', kind: 'rect', a: [-1, -1], b: [1, 1] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: false, height: 'im' });
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(2500);
  const pr = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width]; })()`);
  const x0 = pr[0] - 100, y0 = pr[1];
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
  let x = x0;
  for (let i = 0; i < 12; i++) { x += fling ? 15 : 2; await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: y0, button: 'left', buttons: 1 }); await sleep(16); }
  if (!fling) await sleep(400);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y: y0, button: 'left', clickCount: 1 });
  await sleep(50);
  const yaw0 = await ev('__cmwCam("L").yaw');
  await ev('__cmwSetMain("xy")');
  await settle(1500);
  const a = await ev('__cmwLines()');
  await ev('__cmwSet("srcView", { cx: 0.37, cy: 0.11, s: 61 })');
  await settle(3000);
  const b = await ev('__cmwLines()');
  await ev('__cmwSet("srcView", { cx: -0.2, cy: 0.05, s: 58 })');
  await settle(4000);
  const c = await ev('__cmwLines()');
  await ev('__cmwSetMain("land")'); await settle(2000);
  const d = await ev('__cmwLines()');
  out.push({ page, fling, yaw0, afterSwitch: a, after3s: b, after4s: c, backToLand: d });
}
return { out, logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
