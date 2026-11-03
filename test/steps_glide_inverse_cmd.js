// The steps view's glide frames between two planes, drawn per pixel by the inverse pass of the step's homotopy:
// - the default example (exp, then a Möbius map), parked between planes z and w₁ at u = 0.25, 0.5, 0.75: the frame is
//   the inverse pass's (__cmwSteps().glide.path), and matches a CPU reference: at a grid of pixels w, the front point z
//   of plane z with H_u(z) = w (Newton's method from seeds over the window; the front one by the inverse pass's own
//   sheet key), coloured as plane z's parked frame colours z; away from the colour lines (a pixel whose neighbourhood,
//   in the parked frame about z or in the glide's frame about w, spans more than 12 levels), more than 6 levels off in a
//   channel on at most 0.2 % of the pixels (the exact images' tolerance, steps_carry_cmd);
// - at u = 0.001 and 0.999 the frame is the parked plane's: within the same tolerance away from the lines, and on the
//   whole frame a mean within 1.5 levels (the colour lines move by a fraction of a pixel there);
// - the fallback, per step: the Mountain King's glide from z to u takes the inverse pass (its homotopy runs a Möbius
//   path, then a power path), its glide from u to F the carried mesh (its formula has no inverse); a step whose
//   homotopy is the straight line (a non-analytic formula) takes the carried mesh too.
// The thread is set directly (__cmwSteps({ x })): a park near a plane snaps onto it.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ready = () => settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
// (the page's helpers: the left pane's pixels, and the comparison of a frame with the CPU reference)
const HELP = `window.__gi = window.__gi || {};
window.__giGrab = () => { const cv = document.querySelector('#canvasL'), c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); return { W: c.width, H: c.height, d: g.getImageData(0, 0, c.width, c.height).data }; };
window.__giRange = (P, W, x, y) => { let r = 0; for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) { const v = P[4 * ((y + dy) * W + x + dx) + c]; lo = Math.min(lo, v); hi = Math.max(hi, v); } r = Math.max(r, hi - lo); } return r; };
window.__giStat = (A, B) => { let n = 0, over = 0, sum = 0, max = 0; for (let i = 0; i < A.d.length; i += 4) { n++; let m = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(A.d[i + c] - B.d[i + c]); sum += d; m = Math.max(m, d); } max = Math.max(max, m); if (m > 6) over++; } return { n, max, mean: +(sum / 3 / n).toFixed(3), over: +(over / n).toFixed(5) }; };
window.__giSmooth = (A, B) => { const W = A.W, H = A.H; let n = 0, over = 0; for (let y = 3; y < H - 3; y += 3) for (let x = 3; x < W - 3; x += 3) { if (__giRange(A.d, W, x, y) > 12 || __giRange(B.d, W, x, y) > 12) continue; n++; const i = 4 * (y * W + x); let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(A.d[i + c] - B.d[i + c])); if (m > 6) over++; } return { n, over: +(over / Math.max(1, n)).toFixed(5) }; };
window.__giRef = (P, F) => {
  const g = __cmwSteps().glide, H = g.H, v = g.view, W = F.W, Ht = F.H, dpr = W / g.w, C = (re, im) => ({ re, im });
  const s2w = (x, y) => C(v.cx + (x / dpr - g.w / 2) / v.s, v.cy - (y / dpr - g.h / 2) / v.s);
  const x0 = v.cx - g.w / 2 / v.s, x1 = v.cx + g.w / 2 / v.s, y0 = v.cy - g.h / 2 / v.s, y1 = v.cy + g.h / 2 / v.s, seeds = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) seeds.push(C(x0 + (i + 0.5) * (x1 - x0) / 8, y0 + (j + 0.5) * (y1 - y0) / 6));
  let n = 0, over = 0, none = 0, max = 0;
  for (let py = 4; py < Ht - 4; py += 10) for (let px = 4; px < W - 4; px += 10) {
    const w = s2w(px + 0.5, py + 0.5);
    let best = null, bk = Infinity;
    for (const s0 of seeds) {
      let z = s0;
      for (let it = 0; it < 40 && z; it++) {
        const f = H(z), h = 1e-7 * (1 + Math.hypot(z.re, z.im)), f2 = H(C(z.re + h, z.im));
        const d = C((f2.re - f.re) / h, (f2.im - f.im) / h), dd = d.re * d.re + d.im * d.im, r = C(f.re - w.re, f.im - w.im);
        if (!(dd > 0) || !isFinite(dd)) { z = null; break; }
        let st = C((r.re * d.re + r.im * d.im) / dd, (r.im * d.re - r.re * d.im) / dd);
        const sl = Math.hypot(st.re, st.im), mx = 2 + 0.5 * Math.hypot(z.re, z.im);
        if (sl > mx) st = C(st.re * mx / sl, st.im * mx / sl);
        z = C(z.re - st.re, z.im - st.im);
        if (!isFinite(z.re) || !isFinite(z.im)) z = null;
        else if (sl < 1e-12 * (1 + Math.hypot(z.re, z.im))) break;
      }
      if (!z) continue;
      const f = H(z);
      if (!(Math.hypot(f.re - w.re, f.im - w.im) <= 1e-9 * (1 + Math.hypot(w.re, w.im)))) continue;
      const k = g.key(z);
      if (k < bk) { bk = k; best = z; }
    }
    if (!best) { none++; continue; }
    const fx = ((best.re - v.cx) * v.s + g.w / 2) * dpr - 0.5, fy = (g.h / 2 - (best.im - v.cy) * v.s) * dpr - 0.5, qx = Math.floor(fx), qy = Math.floor(fy), ax = fx - qx, ay = fy - qy;
    if (qx < 2 || qy < 2 || qx >= W - 3 || qy >= Ht - 3) { none++; continue; }
    if (__giRange(P.d, W, qx, qy) > 12 || __giRange(F.d, W, px, py) > 12) continue;
    const at = (x, y, c) => P.d[4 * (y * W + x) + c], o = 4 * (py * W + px);
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(F.d[o + c] - ((1 - ay) * ((1 - ax) * at(qx, qy, c) + ax * at(qx + 1, qy, c)) + ay * ((1 - ax) * at(qx, qy + 1, c) + ax * at(qx + 1, qy + 1, c)))));
    n++; max = Math.max(max, m); if (m > 6) over++;
  }
  return { n, none, max: Math.round(max), over: +(over / Math.max(1, n)).toFixed(5) };
};
1`;
// the frame at thread place x, once a frame there was drawn (by either path), and its record
const at = async (x, want) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  const until = `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(${Math.floor(x)} + g.u - ${x}) < 1e-9 && ${want ? `g.path === '${want}'` : 'true'}; })()`;
  await settled({ max: 60000, until });
  await ev('await new Promise((r) => setTimeout(r, 1500)), 1');
  const g = await ev('(() => { const g = __cmwSteps().glide; return g ? { b: g.b, u: g.u, path: g.path, reason: g.reason } : null; })()');
  return g;
};
const park = async (k) => {
  await ev(`__cmwSteps({ park: ${k} }), 1`);
  await settled({ max: 60000, until: `__cmwSteps().x === ${k}` });
  await ev('await new Promise((r) => setTimeout(r, 2500)), 1');
};

await view(1440, 900, false, false);
// ---- the default example: exp, then (z - 1)/(z + 1) ----
await go(`${BASE}/test.html?ns=gi${Date.now()}&lang=en&view=steps`);
await ready();
await ev(HELP);
await ev('__cmwSteps({ bare: true }), 1');
await park(0); await ev('window.__gi.p0 = __giGrab(), 1');
await park(1); await ev('window.__gi.p1 = __giGrab(), 1');
for (const u of [0.25, 0.5, 0.75]) {
  const g = await at(u, 'inverse');
  const r = await ev('__giRef(window.__gi.p0, __giGrab())');
  info[`default u ${u}`] = { g, r };
  ok(`default, z → w₁ at u = ${u}: drawn by the inverse pass`, !!g && g.path === 'inverse' && g.b === 1, g);
  ok(`default, z → w₁ at u = ${u}: the CPU reference's colours away from the lines (> 6 on <= 0.2 %)`, r.n > 2000 && r.over <= 0.002, r);
}
for (const [x, ref] of [[0.001, 'p0'], [0.999, 'p1']]) {
  const g = await at(x, 'inverse');
  const r = await ev(`(() => { const F = __giGrab(); return { all: __giStat(F, window.__gi.${ref}), smooth: __giSmooth(F, window.__gi.${ref}) }; })()`);
  info[`default x ${x}`] = { g, r };
  ok(`default at x = ${x}: drawn by the inverse pass`, !!g && g.path === 'inverse', g);
  ok(`default at x = ${x}: the parked plane's frame (away from the lines > 6 on <= 0.2 %; mean <= 1.5 on the whole frame)`, r.smooth.n > 10000 && r.smooth.over <= 0.002 && r.all.mean <= 1.5, r);
}

// ---- the fallback, per step ----
{
  const ex = names.indexOf('In the Hall of the Mountain King');
  ok('the Mountain King example is found', ex >= 0, names.length);
  await go(`${BASE}/test.html?ns=gk${Date.now()}&lang=en&view=steps`);
  await ready();
  await ev(`__cmwExample(${ex}), 1`);
  await ev('await new Promise((r) => setTimeout(r, 3000)), 1');
  for (const [x, want] of [[0.3, 'inverse'], [0.7, 'inverse'], [1.5, 'mesh']]) {
    const g = await at(x, want);
    info[`king x ${x}`] = g;
    ok(`Mountain King at x = ${x}: ${want === 'inverse' ? 'the inverse pass' : 'the carried mesh (no inverse of the step)'}`, !!g && g.path === want, g);
  }
  // a straight-line homotopy (a formula that is not analytic) after exp
  const ns = 'gl' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, shapes: [],
    steps: [{ type: 'exp', params: {}, on: true }, { type: 'custom', params: { expr: 'z+0.2*conj(z)', cut: 180 }, on: true }] };
  await go(`${BASE}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`${BASE}/test.html?ns=${ns}&lang=en&view=steps`);
  await ready();
  const g1 = await at(0.5, 'inverse'), g2 = await at(1.5, 'mesh');
  info.lin = { g1, g2 };
  ok('exp then a non-analytic formula: the glide to plane w₁ takes the inverse pass', !!g1 && g1.path === 'inverse', g1);
  ok('exp then a non-analytic formula: the straight-line glide to plane w₂ takes the carried mesh', !!g2 && g2.path === 'mesh', g2);
}
return { pass: fails.length === 0, fails, info };
