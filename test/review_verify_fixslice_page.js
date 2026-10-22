const C = CX.C;
window.__vfStageF = function(steps) {
  const fs = steps.map((st) => { const b = Funcs.build({ type: st.type, params: Object.assign(Funcs.defaults(st.type), st.params) }); return b.f; });
  return (z) => { for (const f of fs) z = f(z); return z; };
}
const yieldNow = () => new Promise((r) => setTimeout(r, 0));
window.__vfFix = async function(mesh, F, slices) {
  const SRC = mesh.src, T = mesh.tri, nv = SRC.length / 2, nt = T.length / 3;
  const W = new Float64Array(nv * 2);
  let t0 = performance.now();
  const pause = async () => {
    if (performance.now() - t0 > 10) { slices.push(performance.now() - t0); await yieldNow(); t0 = performance.now(); }
    return false;
  };
  for (let i = 0; i < nv; i++) {
    const w = F(C(SRC[2 * i], SRC[2 * i + 1]));
    W[2 * i] = w.re; W[2 * i + 1] = w.im;
    if ((i & 1023) === 0 && await pause()) return null;
  }
  const LIM = 1e12;
  const ok = (x, y) => Math.abs(x) < LIM && Math.abs(y) < LIM;
  const flags = new Float32Array(nt);
  const extra = [];
  let budget = 200000;
  const maxDepth = 5;
  function rec(ax, ay, bx, by, cx, cy, wa, wb, wc, depth) {
    if (ok(wa.re, wa.im) && ok(wb.re, wb.im) && ok(wc.re, wc.im)) {
      const e = Math.max(Math.hypot(wa.re - wb.re, wa.im - wb.im), Math.hypot(wb.re - wc.re, wb.im - wc.im), Math.hypot(wc.re - wa.re, wc.im - wa.im));
      const wm = F(C((ax + bx + cx) / 3, (ay + by + cy) / 3));
      budget--;
      if (Math.hypot(wm.re - (wa.re + wb.re + wc.re) / 3, wm.im - (wa.im + wb.im + wc.im) / 3) <= 0.2 * e) { extra.push(ax, ay, bx, by, cx, cy); return; }
    }
    if (depth >= maxDepth || budget <= 0) return;
    const abx = (ax + bx) / 2, aby = (ay + by) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, cax = (cx + ax) / 2, cay = (cy + ay) / 2;
    const wab = F(C(abx, aby)), wbc = F(C(bcx, bcy)), wca = F(C(cax, cay));
    budget -= 3;
    rec(ax, ay, abx, aby, cax, cay, wa, wab, wca, depth + 1);
    rec(abx, aby, bx, by, bcx, bcy, wab, wb, wbc, depth + 1);
    rec(cax, cay, bcx, bcy, cx, cy, wca, wbc, wc, depth + 1);
    rec(abx, aby, bcx, bcy, cax, cay, wab, wbc, wca, depth + 1);
  }
  let nbad = 0;
  for (let t = 0; t < nt; t++) {
    const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
    const ax = W[2 * a], ay = W[2 * a + 1], bx = W[2 * b], by = W[2 * b + 1], cx = W[2 * c], cy = W[2 * c + 1];
    const nfin = (ok(ax, ay) ? 1 : 0) + (ok(bx, by) ? 1 : 0) + (ok(cx, cy) ? 1 : 0);
    let bad = nfin < 3;
    if (nfin === 0) { flags[t] = 1; continue; }
    if (!bad) {
      const e = Math.max(Math.hypot(ax - bx, ay - by), Math.hypot(bx - cx, by - cy), Math.hypot(cx - ax, cy - ay));
      const wm = F(C((SRC[2 * a] + SRC[2 * b] + SRC[2 * c]) / 3, (SRC[2 * a + 1] + SRC[2 * b + 1] + SRC[2 * c + 1]) / 3));
      bad = !(Math.hypot(wm.re - (ax + bx + cx) / 3, wm.im - (ay + by + cy) / 3) <= 0.2 * e);
    }
    if (bad) { nbad++; flags[t] = 1; if (budget > 0) rec(SRC[2 * a], SRC[2 * a + 1], SRC[2 * b], SRC[2 * b + 1], SRC[2 * c], SRC[2 * c + 1], C(ax, ay), C(bx, by), C(cx, cy), 0); else flags[t] = 0; }
    if ((t & 1023) === 0 && await pause()) return null;
  }
  slices.push(performance.now() - t0);
  return { nv, nt, nbad, extra: extra.length / 6, budgetLeft: budget };
}


'ok'