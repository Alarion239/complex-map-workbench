// Scratch measurement for #1323 (not a suite): items 1-3 of the director's brief. Prints { pass, fails, info }.
const fails = [], info = {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ONLY = (process.env.PROBE_ONLY || '3').split(',');
await view(1200, 800, false, false);
const ready = () => settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
const open = async (ex, surf, scope) => {
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=z${Date.now()}`);
  await ready();
  await ev(`__cmwExample(${ex}); 1`);
  await settled({ max: 30000, panes: false });
  await ready();
  if (surf || scope) { await ev(`__cmwSteps(${JSON.stringify(Object.assign({}, surf ? { surf } : {}, scope ? { scope } : {}))}); 1`); await settled({ max: 30000, panes: false }); }
};
const park = async (k) => { await ev(`__cmwSteps(${JSON.stringify({ go: k, now: true })}); 1`); await settled({ max: 30000, until: '!__cmwSteps().anim && !__cmwSteps().play' }); };
const brief = () => ev(`(() => { const s = __cmwSteps(); const P = __cmwP(); return { scope: s.scope, surf: s.surf, planes: s.planes && s.planes.length, i: s.i, win: s.win, steps: P.steps.map((t) => ({ type: t.type, on: t.on !== false, params: t.params, repeat: t.repeat || null })), shapes: __cmwShapes().shapes.map((h) => ({ id: h.id, kind: h.kind, a: h.a, b: h.b, c: h.c, r: h.r, r2: h.r2, stage: h.stage, plane: h.plane, ci: h.ci, complement: h.complement })), paths: s.paths }; })()`);
const COLOURED = 40;
// the plane's canvas, sampled at the screen position of each w of a list: {coloured:bool} per w (null: off the canvas)
const sample = (ws) => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c.getContext('2d'), r = c.getBoundingClientRect();
  const m = Math.round(Math.min(c.width, c.height) * 0.14), out = [];
  for (const [re, im] of ${JSON.stringify(ws)}) {
    const p = __cmwW2S('L', re, im); if (!p) { out.push(null); continue; }
    const px = Math.round((p[0] - r.left) * c.width / r.width), py = Math.round((p[1] - r.top) * c.height / r.height);
    if (px < m || py < m || px >= c.width - m || py >= c.height - m) { out.push(null); continue; }
    const d = x.getImageData(px, py, 1, 1).data; out.push(Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]) > ${COLOURED} ? 1 : 0);
  }
  return out;
})()`);
const coverage = async () => {
  const r = await ev(`(() => { const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c.getContext('2d'); const m = Math.round(Math.min(c.width, c.height) * 0.14), w = c.width - 2 * m, h = c.height - 2 * m, d = x.getImageData(m, m, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > ${COLOURED}) n++; return n / (d.length / 4); })()`);
  return typeof r === "number" ? +r.toFixed(4) : r;
};
const glideReasons = async (nPlanes, surf) => {
  const rows = {};
  for (let b = 1; b < nPlanes; b++) for (const u of [0.25, 0.5, 0.75, 0.998]) {
    await ev(`__cmwSteps(${JSON.stringify({ x: b - 1 + u })}); 1`);
    await settled({ max: 20000, panes: false });
    const g = await ev('(() => { const g = __cmwSteps().glide; return g ? { b: g.b, u: g.u, path: g.path, reason: g.reason } : null; })()');
    const sw = await ev('window.__svWhyG ? window.__svWhyG.r : "no scratch hook"');
    rows[`b${b} u${u}`] = surf === 'sphere' ? { sphereWhy: sw } : g && { path: g.path, reason: g.reason };
  }
  return rows;
};
if (ONLY.includes('1')) {
  const ex = names.indexOf('Newton’s method for z³ − 1');
  await open(ex, null, 'in');
  info.ex1 = { ex, brief: await brief() };
  await park(1);
  const B = await brief();
  info.ex1.parked1 = { scope: B.scope, paths: B.paths, cov: await coverage() };
  // w grid of about 20 px: the cubic 2 z^3 - 3 w z^2 + 1 = 0 has a root in the rect [-2, 2]^2 iff the pixel is coloured
  if (!B.win) return { pass: false, B, info };
  const [cx, cy, s] = B.win, W = 1200 / 2, H = 800 / 2, ws = [];
  for (let j = -Math.floor(H / 20); j <= Math.floor(H / 20); j++) for (let i = -Math.floor(W / 20); i <= Math.floor(W / 20); i++) ws.push([cx + i * 20 / s, cy - j * 20 / s]);
  const got = await sample(ws);
  const roots3 = (wr, wi) => { // Durand-Kerner on z^3 - 1.5 w z^2 + 0.5
    const a = [-1.5 * wr, -1.5 * wi], p = (zr, zi) => { const z2r = zr * zr - zi * zi, z2i = 2 * zr * zi, z3r = z2r * zr - z2i * zi, z3i = z2r * zi + z2i * zr; return [z3r + (a[0] * z2r - a[1] * z2i) + 0.5, z3i + (a[0] * z2i + a[1] * z2r)]; };
    let z = [[0.4, 0.9], [-0.9, 0.3], [0.7, -0.6]];
    for (let it = 0; it < 200; it++) z = z.map((zi, i) => { const f = p(zi[0], zi[1]); let dr = 1, di = 0; z.forEach((zj, j) => { if (j === i) return; const er = zi[0] - zj[0], ei = zi[1] - zj[1]; [dr, di] = [dr * er - di * ei, dr * ei + di * er]; }); const q = dr * dr + di * di || 1e-300; return [zi[0] - (f[0] * dr + f[1] * di) / q, zi[1] - (f[1] * dr - f[0] * di) / q]; });
    return z;
  };
  let n = 0, agree = 0, pred1 = 0, got1 = 0; const bad = [];
  ws.forEach((w, k) => {
    if (got[k] == null) return;
    const inside = roots3(w[0], w[1]).some((z) => Math.abs(z[0]) <= 2 && Math.abs(z[1]) <= 2) ? 1 : 0;
    n++; pred1 += inside; got1 += got[k]; if (inside === got[k]) agree++; else if (bad.length < 12) bad.push({ w: w.map((v) => +v.toFixed(3)), predicted: inside, parked: got[k] });
  });
  { const NI = 2 * Math.floor(W / 20) + 1; const rowsS = []; for (let k = 0; k < got.length; k += NI) rowsS.push(got.slice(k, k + NI).map((v) => (v == null ? '.' : v)).join('')); info.ex1.parkedMap = rowsS; info.ex1.mapNote = 'rows top (Im w > 0) to bottom, columns left to right, 20 px apart; 1 coloured, 0 not, . off the canvas'; }
  info.ex1.pixelCheck = { samples: n, agree, predictedColoured: pred1, parkedColoured: got1, disagreements: bad };
}
if (ONLY.includes('2')) {
  const ex = names.indexOf('Logarithm of an annulus');
  await open(ex);
  info.ex2 = { ex, brief: await brief() };
  const nP = info.ex2.brief.planes;
  info.ex2.cov = {};
  for (let k = 0; k < nP; k++) { await park(k); info.ex2.cov[k] = { cov: await coverage(), win: (await brief()).win }; }
}
if (ONLY.includes('3')) {
  const ex = names.indexOf('In the Hall of the Mountain King');
  const SC = (process.env.U10_SCOPES || 'in,all').split(',');
  info.ex3 = { ex, reasons: {} };
  for (const scope of SC) for (const surf of ['plane', 'sphere']) {
    await open(ex, surf, scope);
    const B = await brief();
    if (!info.ex3.brief) info.ex3.brief = B;
    info.ex3.reasons[scope + '/' + surf] = await glideReasons(B.planes, surf);
  }
}
return { pass: true, fails, info };
