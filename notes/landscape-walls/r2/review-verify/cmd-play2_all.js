const out = { frames: [], tint: null, errs: [] };
await view(1440, 900, false, false);
for (const sh of [true, false]) {
  await openCase('test.html', { meshN: 240, steps: [sq, sn], sheets: sh, height: 'im' }, 0.15);
  const r = await paneRect();
  await ev('__cmwMorph({ T: 0.15, speed: 0.5 })'); await settle(1500);
  await ev('__cmwMorph({ playing: true })');
  for (let i = 0; i < 6; i++) { await sleep(90); const nm = `pl2-${sh ? 'allsh' : 'princ'}-${i}`; await shot(nm, r); out.frames.push([nm, +(await ev('__cmwMorph({})')).T.toFixed(3)]); }
  await ev('__cmwMorph({ playing: false })');
}
globalThis.__tintViews = [[1440, 900, false]];
out.tint = await (async () => {
// pictures-1 gate: the user's case (sin √z, √ bracketed, All sheets, Im) with the cue off and on, the same frame.
// Pixels whose OKLab L rises are sheet 0's, falls sheet 1's (the cue's sign); the step between the sheets is
// mean dL(sheet 0) - mean dL(sheet 1), relative to the mean L. Gate: >= 8 % at t = 0.05; at t = 1 mean |dL| / L <= 5 %.
const OUT = globalThis.__tintOut || null;
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const Lok = (r, g, b) => { const R = lin(r), G = lin(g), B = lin(b); const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B); return 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s; };
const res = [];
for (const [vw, vh, mobile] of (globalThis.__tintViews || [[1440, 900, false], [390, 844, true]])) for (const dark of [false, true]) {
  await view(vw, vh, dark, mobile);
  await ld('test.html', 'tint' + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' });
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(1500);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  const r = await paneRect();
  for (const T of [0.05, 1]) {
    await ev(`__cmwMorph({ T: ${T} })`); await settle(2500);
    const im = {};
    for (const cue of ['none', 'tint']) { await ev(`GLR._lw = { cue: ${JSON.stringify(cue)} }; __cmwMorph({ T: ${T} + 1e-9 }); __cmwMorph({ T: ${T} }); 1`); await settle(1800); im[cue] = await img(r); if (OUT) { const f = await shot(`cue-t${T}-${cue}-${dark ? 'dark' : 'light'}${mobile ? '-phone' : ''}`, mobile ? null : r); fs.copyFileSync(f, path.join(OUT, path.basename(f))); } }
    await ev('GLR._lw = {}; 1');
    const A = im.none, B = im.tint;
    let n0 = 0, n1 = 0, d0 = 0, d1 = 0, Ls = 0, n = 0, dAbs = 0, nCh = 0;
    for (let i = 0; i < A.data.length; i += A.ch) {
      const la = Lok(A.data[i], A.data[i + 1], A.data[i + 2]), lb = Lok(B.data[i], B.data[i + 1], B.data[i + 2]), d = lb - la;
      if (Math.abs(d) > 0.004) { nCh++; dAbs += Math.abs(d) / Math.max(la, 0.05); if (d > 0) { n0++; d0 += d; } else { n1++; d1 += d; } Ls += la; n++; }
    }
    const meanL = n ? Ls / n : 0;
    res.push({ view: `${vw}${dark ? ' dark' : ' light'}`, T, changedPct: +(100 * nCh / (A.data.length / A.ch)).toFixed(1), sheet0Pct: +(100 * n0 / (A.data.length / A.ch)).toFixed(1), sheet1Pct: +(100 * n1 / (A.data.length / A.ch)).toFixed(1), stepRel: n0 && n1 ? +((d0 / n0 - d1 / n1) / meanL).toFixed(3) : null, meanAbsRel: nCh ? +(dAbs / nCh).toFixed(3) : 0 });
  }
}
await view(1440, 900, false, false);
return res;
})();
const l = logs().filter((x) => x.t === 'EXC' || x.t === 'error' || /warn/i.test(x.t)); if (l.length) out.errs.push(l.slice(0, 6));
return out;
