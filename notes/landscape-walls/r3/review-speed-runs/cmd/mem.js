// GPU objects (counted by wrapping WebGL2's create/delete/upload calls) at rest, after mesh changes, after play,
// after five more fresh formulas; base and r3
const reg = await send('Page.addScriptToEvaluateOnNewDocument', { source: GLM });
const B = 'base/test.html', T = 'test.html';
const K = 1000 + Math.floor(Math.random() * 8000);
const out = {};
for (const page of [B, T]) {
  const o = out[page === B ? 'base' : 'r3'] = [];
  const S = async (what) => o.push(what + ' ' + JSON.stringify(await ev('__glmSum()')));
  await ld(page, 'rvm' + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' });
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(4000); await S('rest m240 ALL');
  await ev(`__cmwSet('meshN', 1920); 1`); await settle(5000); await S('rest Max ALL');
  await ev(`__cmwSet('meshN', 240); 1`); await settle(5000); await S('back m240 ALL');
  await ev(`__cmwSet('meshN', 1920); 1`); await settle(5000); await ev(`__cmwSet('meshN', 240); 1`); await settle(5000); await S('m240 after Max x2');
  await ev(`__cmwSet('sheets', false); 1`); await settle(4000); await S('sheets off');
  await ev(`__cmwSet('sheets', true); 1`); await settle(4000); await S('sheets on');
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(1000);
  await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(3000); await ev('__cmwMorph({ playing: false })'); await settle(4000); await S('after play+stop');
  await ev('__cmwMorph({ open: false })'); await settle(1500);
  for (let i = 0; i < 5; i++) { await ev(`__cmwSet('steps', [{ type: 'custom', params: { expr: '\\\\sqrt{z^2+${K + i}}', cut: 180 }, on: true, id: 'q${i}' }, { type: 'sin', params: {}, on: true, id: 'r${i}' }]); 1`); await settle(3500); }
  await S('after 5 formulas');
  for (let i = 0; i < 5; i++) { await ev(`__cmwSet('steps', [{ type: 'custom', params: { expr: '\\\\log(z^2+${K + 10 + i})', cut: 180 }, on: true, id: 'p${i}' }]); 1`); await settle(3500); }
  await S('after 10 formulas'); await shot('mem-end-' + (page === B ? 'base' : 'r3'));
  o.push('logs ' + JSON.stringify(logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 4)));
}
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: reg.identifier });
return out;
