'use strict';
// Compares the catalog's steps as the app computes them on the CPU (src/funcs.js on src/cx.js, doubles) with the
// certified values of tools/arb_reference.py (Arb ball arithmetic): for each step, the worst error over the hard points,
// in units of the double epsilon 2^-52, normwise (|f - ref| / |ref|) and per component (|Re f - Re ref| / |Re ref|, the
// same for Im; a component the reference has at 0 is measured against |ref|). A value beyond the double range must not
// come out as an ordinary finite number. test/t_arb_reference.js gates these numbers; this prints them.
//   node tools/arb_compare.js [notes/arb/reference.json] [--md]   (--md: the table as Markdown)
const fs = require('fs');
const path = require('path');
global.CX = global.CX || require('../src/cx.js');
global.Expr = global.Expr || require('../src/parse.js');
const Funcs = require('../src/funcs.js');

const EPS = 2 ** -52;
const REFERENCE = path.join(__dirname, '..', 'notes', 'arb', 'reference.json');
// -> [{ id, n (points), norm: { u, at }, comp: { u, at }, bad (points not finite where they should be) }]
function measure(R) {
  const rows = [];
  for (const [id, vals] of Object.entries(R.steps)) {
    const b = Funcs.build({ type: id, params: Funcs.defaults(id) });
    if (b.error) { rows.push({ id, error: b.error }); continue; }
    let norm = { u: 0, at: '' }, comp = { u: 0, at: '' }, n = 0;
    const bad = [];
    R.points.forEach(([name, x, y], i) => {
      const ref = vals[i];
      if (!ref) return;
      const f = b.f(CX.C(x, y));
      n++;
      // (beyond the double range: right when the double is not finite or as large as a double gets)
      if (ref === 'overflow') { if (f && Number.isFinite(f.re) && Number.isFinite(f.im) && Math.hypot(f.re, f.im) < 1e307) bad.push(name + ' (finite, should overflow)'); return; }
      const rr = Number(ref[0]), ri = Number(ref[1]), m = Math.hypot(rr, ri);
      if (!f || !Number.isFinite(f.re) || !Number.isFinite(f.im)) { bad.push(name); return; }
      const u = Math.hypot(f.re - rr, f.im - ri) / m / EPS;
      const ucomp = Math.max(...[[f.re, rr], [f.im, ri]].map(([a, r]) => Math.abs(a - r) / (r !== 0 ? Math.abs(r) : m) / EPS));
      if (u > norm.u) norm = { u, at: name };
      if (ucomp > comp.u) comp = { u: ucomp, at: name };
    });
    rows.push({ id, n, norm, comp, bad });
  }
  return rows;
}
const fmtU = (u) => (u < 10 ? u.toFixed(1) : u < 1e6 ? Math.round(u).toString() : u.toExponential(1));

if (require.main === module) {
  const argv = process.argv.slice(2);
  const rows = measure(JSON.parse(fs.readFileSync(argv.find((a) => !a.startsWith('--')) || REFERENCE, 'utf8')));
  if (argv.includes('--md')) {
    console.log('| step | points | worst normwise (ulp) | at | worst per component (ulp) | at | not finite |');
    console.log('|---|---|---|---|---|---|---|');
    for (const r of rows) console.log(r.error ? `| ${r.id} | build error: ${r.error} | | | | | |` : `| ${r.id} | ${r.n} | ${fmtU(r.norm.u)} | ${r.norm.at} | ${fmtU(r.comp.u)} | ${r.comp.at} | ${r.bad.join(', ')} |`);
  } else {
    for (const r of rows) console.log(r.error ? `${r.id}: build error ${r.error}` : `${r.id.padEnd(10)} ${String(r.n).padStart(3)} pts  norm ${fmtU(r.norm.u).padStart(8)} ulp (${r.norm.at})  comp ${fmtU(r.comp.u).padStart(8)} ulp (${r.comp.at})${r.bad.length ? '  not finite: ' + r.bad.join(', ') : ''}`);
  }
}
module.exports = { measure, REFERENCE, EPS, fmtU };
