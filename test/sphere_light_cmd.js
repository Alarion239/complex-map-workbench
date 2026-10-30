// The globe's light (issue #287): a sphere has no up, so turning it must not change how readable a region is.
// F(z) = z in the Phase style on X's sphere (the Phase view), with the default camera and with the camera turned to
// the other side of the equator, the poles' places swapped (pitch -> -pitch), and from straight below and above,
// in the light and the dark theme: the mean OKLab lightness of the lower half of the visible disc is within 10 % of
// the upper half's. The Phase style paints every arg at one lightness, so what differs between the halves is the
// light. The disc is the globe's silhouette, from the camera (sphereView: the silhouette radius
// tan(asin(1 / D)) / tan(fov / 2) * h / 2 around the pane's centre), sampled inside 0.95 of its radius.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/sphere_light_cmd.js
// SPHERE_LIGHT_SHOTS=<folder> also saves the pane of every case there (evidence for a review; not in git).
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const base = process.env.CMW_BASE || 'http://localhost:8793/';
const shots = process.env.SPHERE_LIGHT_SHOTS || '';
// the mean OKLab L of the upper and the lower half of the globe's disc in #canvasL (device px), and the disc itself
const MEASURE = `(() => {
  const cv = document.getElementById('canvasL'), W = cv.width, H = cv.height;
  const c = __cmwCam('L'), D = c.dist;
  const r = Math.tan(Math.asin(1 / D)) / Math.tan(c.fov / 2) * H / 2, cx = W / 2, cy = H / 2;
  const px = cv.getContext('2d').getImageData(0, 0, W, H).data;
  const lin = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
  const okL = (R8, G8, B8) => {
    const r1 = lin(R8 / 255), g1 = lin(G8 / 255), b1 = lin(B8 / 255);
    const l = Math.cbrt(0.4122214708 * r1 + 0.5363325363 * g1 + 0.0514459929 * b1);
    const m = Math.cbrt(0.2119034982 * r1 + 0.6806995451 * g1 + 0.1073969566 * b1);
    const s = Math.cbrt(0.0883024619 * r1 + 0.2817188376 * g1 + 0.6299787005 * b1);
    return 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  };
  const acc = { up: [0, 0], lo: [0, 0] }, rr = 0.95 * r;
  for (let y = Math.max(0, Math.floor(cy - rr)); y < Math.min(H, Math.ceil(cy + rr)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rr)); x < Math.min(W, Math.ceil(cx + rr)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > rr * rr || Math.abs(dy) < 1) continue;
      const i = 4 * (y * W + x), L = okL(px[i], px[i + 1], px[i + 2]);
      const h = dy < 0 ? acc.up : acc.lo;
      h[0] += L; h[1]++;
    }
  }
  const up = acc.up[0] / Math.max(1, acc.up[1]), lo = acc.lo[0] / Math.max(1, acc.lo[1]);
  return { up: +up.toFixed(4), lo: +lo.toFixed(4), ratio: +(lo / up).toFixed(4), n: [acc.up[1], acc.lo[1]], r: +r.toFixed(1), W, H, pitch: +(c.pitch * 180 / Math.PI).toFixed(1) };
})()`;
const DEG = Math.PI / 180;
const st = { v3: true, v4: true, v5: true, shapes: [], steps: [], nextId: 9, focus: 0, dc: 'phase', rightMode: 'sphere', sphereMode: 'color' };
for (const dark of [false, true]) {
  const theme = dark ? 'dark' : 'light';
  await view(1440, 900, dark);
  const ns = 'spherelight' + theme + Date.now();
  await load(ns, st);
  await nav(`${base}test.html?ns=${ns}&lang=en`);
  await settle(1500);
  const v = await ev('__cmwView()');
  ok(`${theme}: the Phase view shows X's sphere`, v && v.main === 'phase' && v.P && v.P.surf === 'sphere', v);
  const cam0 = await ev('__cmwCam("L")');
  // the default camera, the camera across the equator (the poles' places swapped), from below and from above
  const poses = [['default', cam0.pitch], ['upside-down', -cam0.pitch], ['below', -80 * DEG], ['above', 80 * DEG]];
  for (const [pose, pitch] of poses) {
    await ev(`__cmwCam('L', { yaw: ${cam0.yaw}, pitch: ${pitch} }); 1`);
    // (the phase globe's program may link on its first frame: wait until two readings agree)
    let m = null, prev = null;
    for (let i = 0; i < 12; i++) {
      await settle(i ? 400 : 900);
      m = await ev(MEASURE);
      if (prev && m && prev.up === m.up && prev.lo === m.lo) break;
      prev = m;
    }
    R[`${theme}.${pose}`] = m;
    ok(`${theme} ${pose}: the disc is sampled`, m && m.n[0] > 1000 && m.n[1] > 1000, m);
    ok(`${theme} ${pose}: the lower half's OKLab lightness is within 10 % of the upper half's`, m && Math.abs(m.ratio - 1) <= 0.10, m);
    if (shots) {
      const rc = await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
      const r = await send('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 1 }, rc) });
      fs.mkdirSync(shots, { recursive: true });
      fs.writeFileSync(path.join(shots, `sphere_${theme}_${pose}.png`), Buffer.from(r.data, 'base64'));
    }
  }
  // the light is the camera's: every pose of one theme shows the disc at the same lightness (within 10 %)
  const all = poses.map(([p]) => R[`${theme}.${p}`]).filter(Boolean).map((m) => (m.up + m.lo) / 2);
  ok(`${theme}: the disc is as light from every side`, all.length === poses.length && Math.max(...all) / Math.min(...all) <= 1.10, all);
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no page errors', !errs.length, errs.slice(0, 5));
return { pass: fails.length === 0, fails, R };
