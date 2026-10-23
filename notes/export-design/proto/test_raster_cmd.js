// raw art rasters of the Cayley scene (art mode, strokes hidden), to check what the renderer gives the composer
const OUT = path.join(DIR, '..', 'proto', 'out');
await view(1440, 900, false);
await load('xdproto', { shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }], steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], pattern: 'checker' });
await sleep(1500);
const res = {};
const evp = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? { __exc: r.exceptionDetails.exception && r.exceptionDetails.exception.description } : r.result.value; };
res.state = await ev('({ alpha: __cmwState && __cmwState().alpha, view: __xdView("L"), viewR: __xdView("R") })');
await ev('__xdArt(true); __cmwHideStrokes(true); 1');
for (const [side, box, name] of [['L', { x0: -2, x1: 2, y0: -0.5, y1: 3.5 }, 'raw-L'], ['R', { x0: -1.2, x1: 1.2, y0: -1.2, y1: 1.2 }, 'raw-R']]) {
  const r = await evp(`__xdRender('${side}', ${JSON.stringify(box)}, 120, 300)`);
  if (!r || r.__exc) { res[name] = r; continue; }
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
  res[name] = [r.pw, r.ph];
}
await ev('__xdArt(false); __cmwHideStrokes(false); 1');
res.logs = logs().filter((l) => l.t === 'EXC' || l.t === 'error');
return res;
