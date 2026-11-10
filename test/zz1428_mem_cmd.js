const PROBE5 = `(async () => {
  await window.__cmwLandRelief();
  const cv = document.getElementById('canvasL'), W = cv.width, H = cv.height, sc = cv.width / cv.getBoundingClientRect().width;
  const box = __cmwLandCarry(true), NX = 120, NY = 96, pts = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) pts.push([box.x0 + (box.x1 - box.x0) * i / NX, box.y0 + (box.y1 - box.y0) * j / NY]);
  const g = GLR.landFrameVerts(pts, box);
  const hh = pts.map((_, k) => (g && g[k] && g[k][0] && Number.isFinite(g[k][0].h)) ? g[k][0].h : null);
  const fin = hh.filter((x) => x !== null), hmin = Math.min(...fin), hmax = Math.max(...fin);
  const A = window.__heldPx.cur, B = window.__heldPx.P0, TOL = 32, R = 2;
  const pr = (a) => Array.isArray(a) ? a : (a && a.x !== undefined ? [a.x, a.y] : null);
  const sample = JSON.stringify(__cmwLandProject(0, 0, 0)), sample2 = JSON.stringify(__cmwLandProject(pts[5000][0], pts[5000][1], hh[5000])), hasRel = !!(window.__cmwLandRelief && window.__cmwLandRelief.land);
  const out = { sample, sample2, hasRel, W, H, sc, nPts: pts.length, nFin: fin.length, hmin, hmax, byT: [] };
  for (const T of [0.02, 0.05, 0.1, 0.2]) {
    const thr = T * (hmax - hmin), m = new Uint8Array(W * H);
    let nWallCells = 0;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = [j * (NX + 1) + i, j * (NX + 1) + i + 1, (j + 1) * (NX + 1) + i, (j + 1) * (NX + 1) + i + 1];
      const hs = k.map((q) => hh[q]);
      const wall = hs.some((x) => x === null) || (Math.max(...hs) - Math.min(...hs) > thr);
      if (!wall) continue;
      nWallCells++;
      const ps = k.map((q) => hh[q] === null ? null : pr(__cmwLandProject(pts[q][0], pts[q][1], hh[q]))).filter((x) => x);
      if (!ps.length) continue;
      const xs = ps.map((q) => q[0] * sc), ys = ps.map((q) => q[1] * sc);
      const x0 = Math.max(0, Math.floor(Math.min(...xs)) - R), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)) + R), y0 = Math.max(0, Math.floor(Math.min(...ys)) - R), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)) + R);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = 1;
    }
    let diff = 0, dWall = 0, dFlat = 0, wallPx = 0;
    for (let q = 0; q < W * H; q++) { if (m[q]) wallPx++; const o = 4 * q, d = Math.max(Math.abs(A[o] - B[o]), Math.abs(A[o + 1] - B[o + 1]), Math.abs(A[o + 2] - B[o + 2])); if (d > TOL) { diff++; if (m[q]) dWall++; else dFlat++; } }
    out.byT.push({ T, thr, nWallCells, wallPx, diff, dWall, dFlat, fracFlat: dFlat / (W * H), fracWall: dWall / (W * H) });
  }
  return out;
})()`;
// scratch probe (not for a PR): at u = END_U, split the pixels that differ from the parked plane z into wall pixels (a steep
// luminance gradient within WALL_R px, in the parked or the current frame) and flat ones
const PROBE = `(() => {
  const A = window.__heldPx.cur, B = window.__heldPx.P0, W = document.getElementById('canvasL').width, H = A.length / 4 / W;
  const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
  const GT = 24, WALL_R = 2, TOL = 32;
  const grad = (d) => { const g = new Uint8Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = 4 * (y * W + x); const gx = Math.abs(lum(d, i + 4) - lum(d, i - 4)), gy = Math.abs(lum(d, i + 4 * W) - lum(d, i - 4 * W)); if (Math.max(gx, gy) > GT) g[y * W + x] = 1; } return g; };
  const ga = grad(A), gb = grad(B), wall = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ga[y * W + x] || gb[y * W + x]) for (let dy = -WALL_R; dy <= WALL_R; dy++) for (let dx = -WALL_R; dx <= WALL_R; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && X < W && Y >= 0 && Y < H) wall[Y * W + X] = 1; }
  let tot = 0, diff = 0, dWall = 0, dFlat = 0, maxFlat = 0, wallPx = 0;
  for (let k = 0; k < W * H; k++) { const i = 4 * k; tot++; if (wall[k]) wallPx++; const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d > TOL) { diff++; if (wall[k]) dWall++; else { dFlat++; if (d > maxFlat) maxFlat = d; } } }
  return { W, H, tot, wallPx, diff, dWall, dFlat, maxFlatDiff: maxFlat, fracDiff: diff / tot, fracWall: dWall / tot, fracFlat: dFlat / tot };
})()`;
let src = fs.readFileSync(path.join(DIR, '..', 'lib', 'land_exact.js'), 'utf8');
const a = "const GLIDE_U = [END_U, 0.002, MID_U[0], GLIDE_MID, MID_U[1], 0.998, 1 - END_U];";
const b = "const vpts = at1(got, pts), cw = at1(cgot, cpts);";
if (!src.includes(a) || !src.includes(b)) return { pass: false, fails: [{ name: 'patch anchors missing' }], info: {} };
const hookCode = ` if (u === END_U && sheets) {
  const hk = (q) => ev('__cmwLandFrameVerts(' + JSON.stringify(q) + ')');
  const out = { keys: null, rows: [] };
  const R = 6;
  for (const U of [0.25, 0.5]) {
    const win = {};
    for (const drop of [0, 1]) {
      await ev('(window.__zDrop = ' + drop + ', 1)');
      await setU(U); await grab('rs'); await ev('window.__cmwLandRelief().then(() => 1)');
      const g = await hk(vpts);
      const c = await ev('(() => { const c = __cmwLandCarry(); return c && { src: c.src }; })()');
      const sb = c.src, bx = { x0: sb.x0 ?? sb[0], y0: sb.y0 ?? sb[1], x1: sb.x1 ?? sb[2], y1: sb.y1 ?? sb[3] };
      const hpx = await ev('(() => { const a = window.__heldPx.rs, b = window.__heldPx.P0, d = window.__heldPx.P1, W = document.getElementById("canvasL").width; const o = []; const dd = (x, y, p) => Math.max(Math.abs(a[4*(y*W+x)] - p[4*(y*W+x)]), Math.abs(a[4*(y*W+x)+1] - p[4*(y*W+x)+1]), Math.abs(a[4*(y*W+x)+2] - p[4*(y*W+x)+2])); window.__dd0 = (x, y, r) => { let n = 0, t = 0; const H = a.length / 4 / W; for (let Y = Math.max(0, y - r); Y <= Math.min(H - 1, y + r); Y++) for (let X = Math.max(0, x - r); X <= Math.min(W - 1, x + r); X++) { t++; if (dd(X, Y, b) > 32) n++; } return [n, t]; }; window.__dd1 = (x, y, r) => { let n = 0; const H = a.length / 4 / W; for (let Y = Math.max(0, y - r); Y <= Math.min(H - 1, y + r); Y++) for (let X = Math.max(0, x - r); X <= Math.min(W - 1, x + r); X++) { if (dd(X, Y, d) > 32) n++; } return n; }; return 1; })()');
      if (!out.keys && g && g[0] && g[0][0]) out.keys = Object.keys(g[0][0]);
      for (let pi = 0; pi < g.length; pi++) for (let k = 0; k < g[pi].length; k++) {
        const l = g[pi][k]; if (!l || !l.z) continue;
        const isOut = l.z[0] < bx.x0 || l.z[0] > bx.x1 || l.z[1] < bx.y0 || l.z[1] > bx.y1;
        if (!isOut) continue;
        const key = U + ':' + pi + ':' + k;
        let pr = null;
        if (!out.dbg) out.dbg = await ev('(() => { try { const q = __cmwLandProject(' + vpts[pi][0] + ', ' + vpts[pi][1] + ', ' + l.h + '); return { q, dd: typeof window.__dd0, h: ' + l.h + ' }; } catch (e) { return { err: String(e) }; } })()');
        if (Number.isFinite(l.h)) pr = await ev('(() => { const q = __cmwLandProject(' + vpts[pi][0] + ', ' + vpts[pi][1] + ', ' + l.h + '); const p = Array.isArray(q) ? q : (q && q.x !== undefined ? [q.x, q.y] : null); if (!p) return null; const cv = document.getElementById("canvasL"), sc = cv.width / cv.getBoundingClientRect().width; const x = Math.round(p[0] * sc), y = Math.round(p[1] * sc); return { x, y, d0: window.__dd0(x, y, ' + R + '), d1: window.__dd1(x, y, ' + R + ') }; })()');
        (win[key] = win[key] || { U, place: pi, k, w: vpts[pi], z: l.z, absz: Math.hypot(l.z[0], l.z[1]), combo: l.combo, member: l.member, sheet: l.sheet, h: l.h })['drop' + drop] = pr;
      }
    }
    for (const key of Object.keys(win)) out.rows.push(win[key]);
  }
  await ev('(window.__zDrop = 0, 1)');
  fs.writeFileSync('/tmp/claude-0/members.json', JSON.stringify(out));
  fails.push({ name: 'PROBE7 ' + name, got: { n: out.rows.length, dbg: out.dbg } });
  return { pass: false, fails, info };
 }`;
src = src.replace(a, "const GLIDE_U = [END_U];").replace(b, b + hookCode);
return await eval(src)([false, true]);
