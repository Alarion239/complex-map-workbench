const f = (x, d = 3) => (x == null ? '-' : Number.isInteger(x) ? String(x) : x.toFixed(d));
for (const K of process.argv.slice(2)) {
  const rows = require(`./results_K${K}.json`);
  console.log(`\nK = ${K}`);
  console.log('scene        view        ms(node)  classMs  F-evals  layerTris coreSub claimed(+prop) cert  collar  cull  cap  sat  satTests  dropSub floor budget | IoU    holes spill parity(n)        minCov devMax devP99');
  for (const r of rows) {
    console.log(`${r.scene.padEnd(12)} ${r.view.padEnd(11)} ${f(r.ms, 0).padStart(7)} ${f(r.classMs, 0).padStart(8)} ${String(r.evals).padStart(8)} ${String(r.tris).padStart(9)} ${String(r.core).padStart(7)} ${(r.claimed + '(+' + r.prop + ')').padStart(13)} ${String(r.certified).padStart(5)} ${String(r.collar).padStart(6)} ${String(r.culled).padStart(5)} ${String(r.capped).padStart(4)} ${String(r.sat).padStart(5)} ${String(r.satTests).padStart(8)} ${String(r.dropSub).padStart(8)} ${String(r.dropFloor).padStart(5)} ${String(r.budget).padStart(6)} | ${f(r.iou, 4)} ${String(r.nHole ?? '-').padStart(5)} ${String(r.nSpill ?? '-').padStart(5)} ${(f(r.parity, 4) + '(' + (r.nPar ?? '-') + ')').padStart(15)} ${f(r.minCov, 0).padStart(6)} ${f(r.devMax).padStart(6)} ${f(r.devP99).padStart(6)}`);
  }
}
