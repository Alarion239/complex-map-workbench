// Reviewer scratch (verify-visual): runs the real haloText/draw3DLabels from dist/test.html on a 2D canvas with
// a projected floor plate, records the canvas state at every tick stroke(), and samples the tick pixels.
// Paste into the page (javascript_tool) at http://localhost:8793/test.html?ns=verify-visual . No WebGL needed.
(async () => {
  const src = await (await fetch('/test.html')).text();
  const cut = (a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('cut ' + a); return src.slice(i, j); };
  const glCode = cut('function hexRGB(hex)', '// accepts') + cut('const M4 = {', '// Light rig') + cut('function landGeom(box, scale)', '// st: {map');
  const appOrig = cut('function project(pane, MVP, p)', 'function renderSphere(pane)');
  const appFixed = appOrig.replace("function haloText(ctx, t, x, y, halo) { ctx.lineJoin", "function haloText(ctx, t, x, y, halo) { ctx.save(); ctx.lineJoin").replace("ctx.fillText(t, x, y); }", "ctx.fillText(t, x, y); ctx.restore(); }");
  const cs = getComputedStyle(document.documentElement);
  const hx = (n) => cs.getPropertyValue(n).trim().slice(0, 7);
  const TH = { landTop: hx('--land-top'), landBottom: hx('--land-bottom'), landFloor: hx('--land-floor'), landBox: hx('--land-box'), rulerTick: hx('--ruler-tick'), label: hx('--axis-label'), ink2: hx('--ink-2'), mono: cs.getPropertyValue('--f-mono').trim() || 'monospace', math: cs.getPropertyValue('--f-math').trim() || 'serif' };
  const make = (code) => new Function('TH', 'Axes', 'CX', 'S', 'medianAbs', `const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));\n${glCode}\nconst GLR={M4,hexRGB,camera,landGeom,fitDist};\n${code}\nreturn {GLR,draw3DLabels,project};`)(TH, Axes, CX, { height: 'log' }, () => 1);
  const W = 640, H = 480, D = Math.PI / 180;
  const run = (code) => {
    const m = make(code);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const box = { x0: -4.4, x1: 4.4, y0: -4.4, y1: 4.4 };
    const geo = m.GLR.landGeom(box, 1);
    const cam = { yaw: -38 * D, pitch: 30 * D, dist: m.GLR.fitDist(geo.radius, 28 * D, W, H, 1.05), tx: 0, ty: 0, tz: geo.center[2], fov: 28 * D };
    const { MVP, eye } = m.GLR.camera(cam, W, H);
    const Hh = geo.H;
    const info = { MVP, eye, aspect: geo.aspect, floorZ: geo.floorZ, top: Hh, heightOf: (v) => Hh * (2 / Math.PI) * Math.atan(Math.log(Math.max(v, 1e-300)) / 1.4) };
    const pane = { ctx, w: W, h: H };
    // backdrop + floor plate (landFloor) + the block footprint (landBox outline)
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, TH.landTop); g.addColorStop(1, TH.landBottom); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const P = (p) => m.project(pane, MVP, p);
    const [ex, ey] = geo.ext, [ax, ay] = geo.aspect;
    ctx.fillStyle = TH.landFloor; ctx.beginPath(); [[-ex, -ey], [ex, -ey], [ex, ey], [-ex, ey]].forEach(([x, y], i) => { const q = P([x, y, geo.floorZ]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9fb3bd'; ctx.beginPath(); [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]].forEach(([x, y], i) => { const q = P([x, y, geo.floorZ]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill();
    // instrument
    const strokes = []; let pts = [];
    const bp = ctx.beginPath.bind(ctx), mt = ctx.moveTo.bind(ctx), lt = ctx.lineTo.bind(ctx), st = ctx.stroke.bind(ctx);
    ctx.beginPath = () => { pts = []; bp(); };
    ctx.moveTo = (x, y) => { pts.push([x, y]); mt(x, y); };
    ctx.lineTo = (x, y) => { pts.push([x, y]); lt(x, y); };
    const before = [];
    ctx.stroke = () => { strokes.push({ strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth, alpha: ctx.globalAlpha, pts: pts.map((p) => p.map((v) => +v.toFixed(1))) }); st(); };
    m.draw3DLabels(pane, info, box);
    // sample a pixel 2px along each tick (skipping the long ruler line)
    const ticks = strokes.filter((s) => s.pts.length === 2 && Math.hypot(s.pts[1][0] - s.pts[0][0], s.pts[1][1] - s.pts[0][1]) < 6);
    const px = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)).map((v) => v.toString(16).padStart(2, '0')).join('');
    ticks.forEach((t) => { const [a, b] = t.pts; t.mid = '#' + px((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); });
    return { cv, strokes, ticks };
  };
  const o = run(appOrig), f = run(appFixed);
  window.__rvLand = { o, f, TH };
  return { TH, origTicks: o.ticks.map((t) => [t.strokeStyle, t.lineWidth, t.alpha, t.pts[0], t.mid]), fixedTicks: f.ticks.map((t) => [t.strokeStyle, t.lineWidth, t.alpha, t.pts[0], t.mid]), nonTick: o.strokes.filter((s) => !o.ticks.includes(s)).map((s) => [s.strokeStyle, s.lineWidth, s.alpha]) };
})();
