// The steps view's glide on the Sphere surface looks as the exact picture at the same u (#846, option A): held at
// u = 0.25, 0.5 and 0.75 of a glide between two coloured planes, each pixel of the globe shows the colour that plane
// z's parked globe shows at the point the glide's map H_u carries there, lit where it now is.
// The reference, per sample point w of the sphere's front side (a lattice of the sphere, its pixel P on the moving
// globe): z0 = H_u^-1(w) by Newton's method (the step is a Möbius map, so z0 is the one point), and its pixel Q on the
// parked globe of plane z, where it shows on the front side. The globe's light (SHADE_GLOBE: c = alb k(n, v) + spec(n,
// v) in linear light, the key light and the eye from __cmwSvGlobe) is taken out at Q and put back at P. Points next to a colour line,
// a stroke or the limb (a 4 x 4 neighbourhood spanning more than RANGE levels in either frame) are not compared. At
// most OVER_MAX of at least N_MIN compared points may be more than TOL levels apart in a channel.
// Both scopes: Everywhere (the whole globe in colour) and Inside regions (the colour inside the regions, which move).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const TOL = 16, OVER_MAX = 0.01, N_MIN = 300, RANGE = 12, LOOK_U = [0.25, 0.5, 0.75];
await view(1200, 800);
const ST = {
  pattern: 'phase', outline: true, lines: false, unit: false, alpha: 1, v3: true, v4: true, v5: true, v6: true, nextId: 50,
  focus: 0, rightMode: 'image',
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }],
  shapes: [{ id: 'd0', kind: 'disc', c: [0.2, 0.6], r: 0.9, ci: 0, visible: true }],
  targets: [],
};
await loadView('steps', 'svslook' + Date.now(), ST);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvGlobe === "function" && !!window.GLR && GLR.pendingLinks === 0' });
ok('the page shows the steps view', await isSteps(), null);
await ev(`__cmwSet('morphPaths', false), 1`);
// (the left canvas's pixels kept in the page under a tag)
const grab = (tag) => ev(`(() => {
  const c = document.getElementById('canvasL'), x = document.createElement('canvas');
  x.width = c.width; x.height = c.height;
  const g = x.getContext('2d', { willReadFrequently: true });
  g.drawImage(c, 0, 0);
  (window.__sl || (window.__sl = {}))[${JSON.stringify(tag)}] = { W: c.width, H: c.height, k: c.width / c.getBoundingClientRect().width, d: g.getImageData(0, 0, c.width, c.height).data };
  return 1;
})()`);
// the moving frame F against the exact picture from plane z's parked frame P (both kept), at the glide's u
const compare = (P, F) => ev(`(() => {
  const K = window.__sl, A = K[${JSON.stringify(P)}], B = K[${JSON.stringify(F)}], g = __cmwSvGlobe(0, 0), H = g.H, W = A.W, Hh = A.H;
  const eye = g.eye, key = g.key, C = (re, im) => ({ re, im });
  const lift = (z) => { const r2 = z.re * z.re + z.im * z.im; return [2 * z.re / (r2 + 1), -2 * z.im / (r2 + 1), (r2 - 1) / (r2 + 1)]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map((t) => t / l); };
  // (SHADE_GLOBE's front-face light at sphere point n: the factor on the colour and the added highlight, in linear light)
  const light = (n) => {
    const v = nrm([eye[0] - n[0], eye[1] - n[1], eye[2] - n[2]]), ndl = Math.max(dot(n, key), 0), e = 1 - Math.max(dot(n, v), 0);
    const h = nrm([key[0] + v[0], key[1] + v[1], key[2] + v[2]]);
    return { k: (0.80 + 0.22 * ndl) * (1 - 0.15 * e * e), sp: 0.05 * Math.pow(Math.max(dot(n, h), 0), 96) };
  };
  // (the shader's sRGB transfer: SHADE_GLOBE lights the colour in linear light)
  const cl = (c) => Math.min(1, Math.max(0, c));
  const toLin = (c) => { c = cl(c); return c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const toSrgb = (c) => { c = cl(c); return c < 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  const px = (z) => { const q = __cmwGlobeXY('L', z.re, z.im); return q ? [q[0] * A.k - 0.5, q[1] * A.k - 0.5] : null; };
  const range = (D, x, y) => { let r = 0; for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) { const v = D[4 * ((y + dy) * W + x + dx) + c]; lo = Math.min(lo, v); hi = Math.max(hi, v); } r = Math.max(r, hi - lo); } return r; };
  const inv = (w) => {
    let best = null;
    for (const s0 of [w, C(0, 0), C(1, 1), C(-1, -1), C(2, -2)]) {
      let z = s0;
      for (let it = 0; it < 60 && z; it++) {
        const f = H(z), h = 1e-7 * (1 + Math.hypot(z.re, z.im)), f2 = H(C(z.re + h, z.im));
        const d = C((f2.re - f.re) / h, (f2.im - f.im) / h), dd = d.re * d.re + d.im * d.im, r = C(f.re - w.re, f.im - w.im);
        if (!(dd > 0) || !isFinite(dd)) { z = null; break; }
        let st = C((r.re * d.re + r.im * d.im) / dd, (r.im * d.re - r.re * d.im) / dd);
        const sl = Math.hypot(st.re, st.im), mx = 1 + 0.5 * Math.hypot(z.re, z.im);
        if (sl > mx) st = C(st.re * mx / sl, st.im * mx / sl);
        z = C(z.re - st.re, z.im - st.im);
        if (!isFinite(z.re) || !isFinite(z.im)) z = null;
        else if (sl < 1e-13 * (1 + Math.hypot(z.re, z.im))) break;
      }
      if (!z) continue;
      const f = H(z);
      if (Math.hypot(f.re - w.re, f.im - w.im) <= 1e-8 * (1 + Math.hypot(w.re, w.im))) { best = z; break; }
    }
    return best;
  };
  let n = 0, over = 0, max = 0, none = 0, sum = 0;
  for (let la = -84; la <= 84; la += 2) for (let lo = 0; lo < 360; lo += 2 / Math.max(0.1, Math.cos(la * Math.PI / 180))) {
    const p3 = [Math.cos(la * Math.PI / 180) * Math.cos(lo * Math.PI / 180), Math.cos(la * Math.PI / 180) * Math.sin(lo * Math.PI / 180), Math.sin(la * Math.PI / 180)];
    if (p3[2] > 0.995) continue;
    const w = C(p3[0] / (1 - p3[2]), -p3[1] / (1 - p3[2])), pw = px(w);
    if (!pw) continue;
    const z0 = inv(w), pq = z0 && px(z0);
    if (!pq) { none++; continue; }
    const fx = Math.round(pw[0]), fy = Math.round(pw[1]), qx = Math.floor(pq[0]), qy = Math.floor(pq[1]), ax = pq[0] - qx, ay = pq[1] - qy;
    if (fx < 3 || fy < 3 || qx < 3 || qy < 3 || fx >= W - 4 || qx >= W - 4 || fy >= Hh - 4 || qy >= Hh - 4) continue;
    if (range(A.d, qx, qy) > ${RANGE} || range(B.d, fx, fy) > ${RANGE}) continue;
    const lq = light(lift(z0)), lp = light(lift(w)), o = 4 * (fy * W + fx), at = (x, y, c) => A.d[4 * (y * W + x) + c];
    let m = 0;
    for (let c = 0; c < 3; c++) {
      const q = (1 - ay) * ((1 - ax) * at(qx, qy, c) + ax * at(qx + 1, qy, c)) + ay * ((1 - ax) * at(qx, qy + 1, c) + ax * at(qx + 1, qy + 1, c));
      const want = 255 * toSrgb((toLin(q / 255) - lq.sp) / lq.k * lp.k + lp.sp);
      m = Math.max(m, Math.abs(B.d[o + c] - want));
    }
    n++; sum += m; max = Math.max(max, m); if (m > ${TOL}) over++;
  }
  return { n, none, max: Math.round(max), mean: +(sum / Math.max(1, n)).toFixed(2), over: +(over / Math.max(1, n)).toFixed(4), path: g.path, u: g.u };
})()`);
for (const scope of ['all', 'in']) {
  await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere', scope: ${JSON.stringify(scope)}, T: 1 }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving && GLR.pendingLinks === 0' });
  await grab('P');
  if (process.env.SL_DUMP) fs.writeFileSync(`${process.env.SL_DUMP}/${scope}-rest.png`, Buffer.from((await ev(`document.getElementById('canvasL').toDataURL()`)).split(',')[1], 'base64'));
  for (const u of LOOK_U) {
    await ev(`__cmwSteps({ x: ${u} }); 1`);
    await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${u}) < 1e-9 && GLR.pendingLinks === 0 && __cmwSvGlobe(0, 0).path === 'inverse'` });
    await grab('F');
    if (process.env.SL_DUMP) fs.writeFileSync(`${process.env.SL_DUMP}/${scope}-${u}.png`, Buffer.from((await ev(`document.getElementById('canvasL').toDataURL()`)).split(',')[1], 'base64'));
    const r = await compare('P', 'F');
    R[`${scope} ${u}`] = r;
    ok(`${scope === 'all' ? 'Everywhere' : 'Inside regions'}, u = ${u}: the moving globe is the exact picture at u (at most ${OVER_MAX * 100} % of ≥ ${N_MIN} points over ${TOL} levels)`,
      r.path === 'inverse' && r.n >= N_MIN && r.over <= OVER_MAX, r);
  }
}
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
