// Steps view Landscape, plain plane (z², d/dz, exp; T = w₁) at rest on w₃: exp(2z) takes many points of plane z to one
// spot, and the carried landscape's depth order must leave no 1–3 px specks along w₃'s far edge.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const ns = `landspecks${Date.now()}`, step = (type, params) => ({ type, params: params || {}, on: true });
const st0 = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [step('pown', { n: 2 }), step('deriv'), step('exp')], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await loadView('steps', ns, st0);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 1, go: 3, now: true }); 1`);
await settled({ max: 60000 });
await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const yaw0 = JSON.parse(await ev(`JSON.stringify(__cmwCam('L'))`)).yaw;
info.n = {};
for (const dy of [0, 0.35, -0.35, 0.7, -0.7]) {
  await ev(`__cmwCam('L', { yaw: ${yaw0} + ${dy} }); 1`);
  await settled({ max: 60000 });
  await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  ok(`yaw ${dy}: the frame is still`, await grab('w3'), null);
  // a speck: a coloured pixel (chroma > 48/255) that differs by more than 48/255 from all four neighbours, whose opposite
  // pairs agree within 24/255: a run of one pixel in a smooth surface
  info.n[dy] = await ev(`(() => { const P = window.__heldPx.w3, cv = document.getElementById('canvasL'), W = cv.width, H = cv.height;
    const df = (i, j) => Math.max(Math.abs(P[i] - P[j]), Math.abs(P[i + 1] - P[j + 1]), Math.abs(P[i + 2] - P[j + 2]));
    const ch = (i) => Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]);
    let n = 0; const at = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = 4 * (y * W + x), l = i - 4, r = i + 4, u = i - 4 * W, d = i + 4 * W;
      if (ch(i) > 48 && df(i, l) > 48 && df(i, r) > 48 && df(i, u) > 48 && df(i, d) > 48 && df(l, r) <= 24 && df(u, d) <= 24) { n++; if (at.length < 6) at.push([x, y]); } }
    return { n, at }; })()`);
  ok(`yaw ${dy}: no isolated specks on w₃`, info.n[dy].n === 0, info.n[dy]);
}
return { pass: fails.length === 0, fails, info };
