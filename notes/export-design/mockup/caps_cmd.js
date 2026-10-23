// typesets each figure's caption with the composer (MathJax CM outlines, the same TeX that goes into \caption{}),
// so the mockup's paper shows exactly what LaTeX will be given (B11). Writes mockup/cap-<name>.svg
const OUTD = path.join(DIR, '..', 'mockup'), PROTO = path.join(DIR, '..', 'proto');
const evp = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? { __exc: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text } : r.result.value; };
await nav('http://localhost:8817/app-copy/dist/test.html?ns=xdcaps'); await sleep(1500);
await evp(fs.readFileSync(path.join(PROTO, 'compose.js'), 'utf8') + '\n' + fs.readFileSync(path.join(PROTO, 'figures.js'), 'utf8') + '\n1');
const caps = JSON.parse(fs.readFileSync(path.join(PROTO, 'out', 'captions.json'), 'utf8'));
const jobs = [['amsart', 'Figure 1.', caps.cayley, 360, 10], ['hw', 'Figure 1.', caps.homework, 360, 10.95], ['film', 'Figure 3.', caps.film, 510, 10], ['phasebw', 'Figure 2.', caps.phaseBW, 246, 10]];
const R = {};
for (const [name, num, tex, wpt, pt] of jobs) {
  R[name] = await evp(`(() => { XD.begin('cap-${name}'); const segs = [{ b: ${JSON.stringify(num)} }, { t: ' ' }, ...${JSON.stringify(tex)}.split(/(\\$[^$]*\\$)/).filter(Boolean).map((s) => s[0] === '$' ? { m: s.slice(1, -1) } : { t: s.replace(/--/g, '–') })];
    const W = XD.bp(${wpt}), c = XD.caption(segs, 0, 0, W, ${pt}); const f = XD.svg({ W, H: c.h + 3, items: [c.markup] }); return { svg: f.svg.replace('<rect', '<rect fill-opacity="0"'), W: f.W, H: f.H, lines: c.lines }; })()`);
  if (R[name] && R[name].svg) { fs.writeFileSync(path.join(OUTD, `cap-${name}.svg`), R[name].svg); R[name] = [R[name].W, R[name].H, R[name].lines]; }
}
return R;
