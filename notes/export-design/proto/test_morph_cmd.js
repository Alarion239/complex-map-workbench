const OUT = path.join(DIR, '..', 'proto', 'out');
const evp = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? { __exc: r.exceptionDetails.exception && r.exceptionDetails.exception.description } : r.result.value; };
await view(1440, 900, false);
await load('xdproto', { shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }], steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], pattern: 'checker' });
await sleep(1200);
await ev('__cmwMorph({ open: true })'); await sleep(600);
const res = {};
await ev('__xdArt(true); __cmwHideStrokes(true); 1');
for (const T of [0.5]) {
  await ev(`__cmwMorph({ T: ${T} })`); await sleep(500);
  const r = await evp(`__xdRender('R', {x0:-2.5,x1:2.5,y0:-1.5,y1:2.5}, 150, 200)`);
  if (!r || r.__exc) { res[T] = r; continue; }
  fs.writeFileSync(path.join(OUT, `raw-morph-${T}.png`), Buffer.from(r.url.split(',')[1], 'base64'));
  res[T] = [r.pw, r.ph];
}
await ev('__xdArt(false); __cmwHideStrokes(false); 1');
res.layout = await ev('__cmwLayout()');
res.logs = logs().filter((l) => l.t === 'EXC' || l.t === 'error');
return res;
