// A glide the carried meshes draw waits on the plane it started from while their programs link, and no frame of it
// blends two planes (#844): the chain [z + 0.2 conj(z)] (not analytic: its homotopy has no inverse plan, so its glide
// is drawn by the carried meshes), coloured from z, Everywhere, opened with the chain's programs held linking
// (?glhold, GLR.holdLinks).
// - Plane, a scrub held at x = 0.05, 0.5 and 0.95 (__cmwSteps({ x })): every colour plot the frame draws is at opacity
//   1 (GLR.drawColorPlot's alpha), the frame being plane z's at rest; the thread stays where it was put;
// - plane, a glide played (__cmwSteps({ go: 1 })): after WAIT_MS, longer than a glide, the thread is still on plane z
//   and every frame drew its plots at opacity 1;
// - the links let go: the held glide arrives on w1, and a scrub at x = 0.5 is the carried meshes' (the glide record's
//   path 'mesh'), with no colour plot under it;
// - Sphere, opened again the same way, a scrub held at x = 0.75: each frame draws one kind of globe (GLR.drawSphere,
//   with the carried mesh or plain), not the carried mesh's attempt and then plane w1's plain globe faded over it; the
//   links let go, the frame at x = 0.75 is the carried mesh's alone.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (WAIT_MS: longer than a Normal glide; FRAMES: the frames read at each place, two rAFs each, a render asked at each)
const WAIT_MS = 2500, FRAMES = 6;
const frames = (n, x) => ev(`(async () => { for (let i = 0; i < ${n}; i++) { ${x == null ? '' : `window.__spheres.push('|'); __cmwSteps({ x: ${x} });`} await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); } return 1; })()`);
const state = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [{ type: 'custom', params: { expr: 'z+0.2*conj(z)', cut: 180 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
// the page opened on the chain with its programs held linking, the colour plots' opacities and the globes drawn
// recorded (window.__plotAlphas, window.__spheres)
const open = async (surf) => {
  const ns = `svmw${surf}${Date.now()}`;
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps&glhold`);
  // (polled, not the kit's settled, which waits for the pane's compiles too: here they are held)
  await ev(`(async () => { const t = performance.now() + 60000; while (!(typeof __cmwSteps === 'function' && !!window.GLR && !!document.querySelector('.sv-rail')) && performance.now() < t) await new Promise((r) => setTimeout(r, 100)); return 1; })()`);
  await ev(`(() => {
    const f = GLR.drawColorPlot, g = GLR.drawSphere; window.__plotAlphas = []; window.__spheres = [];
    GLR.drawColorPlot = function (o) { window.__plotAlphas.push(o.alpha == null ? 1 : o.alpha); return f.apply(this, arguments); };
    GLR.drawSphere = function (o) { window.__spheres.push({ k: o && o.carried ? 'carried' : 'globe' }); return g.apply(this, arguments); };
    return 1; })()`);
  await ev(`__cmwSet('morphPaths', false); __cmwSteps({ T: 0, scope: 'all', surf: '${surf}' }); 1`);
  await frames(2);
};
// the frames drawn with the thread at x, read: the opacities of their colour plots, the globes drawn, the thread
const at = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }); window.__plotAlphas = []; window.__spheres = []; 1`);
  await frames(FRAMES, x);
  // (the globes drawn after each render asked ('|'): a frame that fades one globe over another draws two kinds, the
  // carried mesh's attempt and the other plane's plain globe; the renders of one frame draw one kind)
  return ev(`(() => {
    const s = __cmwSteps(), W = [];
    for (const d of window.__spheres) if (d === '|') W.push([]); else if (W.length) W[W.length - 1].push(d.k);
    const D = W.flat(), mixed = W.filter((w) => new Set(w).size > 1).length;
    return { seq: W.map((w) => w.map((k) => k[0]).join('')).join('|'), mixed, x: s.x, alphas: [...new Set(window.__plotAlphas)].map((a) => +a.toFixed(3)), spheres: D.length, kinds: [...new Set(D)], glide: s.glide && { path: s.glide.path, u: s.glide.u }, pending: GLR.pendingLinks };
  })()`);
};
const partial = (r) => r.alphas.some((a) => a > 0 && a < 1);

await view(1200, 800, false, false);

// ---- the plane ----
await open('plane');
for (const x of [0.05, 0.5, 0.95]) {
  const r = info[`plane held x=${x}`] = await at(x);
  ok(`plane, links held, a scrub at x = ${x}: no colour plot at a partial opacity (the plane's frame at rest)`, !partial(r) && r.alphas.length > 0, r);
  ok(`plane, links held, a scrub at x = ${x}: the thread stays at ${x}`, Math.abs(r.x - x) < 1e-9, r);
}
await ev(`__cmwSteps({ go: 0, now: true }); window.__plotAlphas = []; __cmwSteps({ go: 1 }); 1`);
await ev(`await new Promise((r) => setTimeout(r, ${WAIT_MS})), 1`);
info['plane played, held'] = await ev(`(() => { const s = __cmwSteps(); return { x: s.x, anim: !!s.anim, alphas: [...new Set(window.__plotAlphas)].map((a) => +a.toFixed(3)) }; })()`);
ok(`plane, links held, a glide played: after ${WAIT_MS} ms the thread is still on plane z`, info['plane played, held'].x < 1e-6, info['plane played, held']);
ok('plane, links held, a glide played: no frame drew a colour plot at a partial opacity', !partial(info['plane played, held']), info['plane played, held']);
await ev('GLR.holdLinks(false), 1');
await settled({ max: 60000, until: "GLR.pendingLinks === 0 && !__cmwSteps().anim && __cmwSteps().x === 1" });
info['plane played, let go'] = await ev('(() => { const s = __cmwSteps(); return { x: s.x, anim: !!s.anim }; })()');
ok('plane, the links let go: the glide arrives on w1', info['plane played, let go'].x === 1, info['plane played, let go']);
{
  const r = info['plane linked x=0.5'] = await at(0.5);
  ok('plane, linked, a scrub at x = 0.5: the carried meshes draw it (the glide record\'s path \'mesh\', no colour plot)', !!r.glide && r.glide.path === 'mesh' && r.alphas.length === 0 && Math.abs(r.x - 0.5) < 1e-9, r);
}

// ---- the Sphere ----
await open('sphere');
{
  const r = info['sphere held x=0.75'] = await at(0.75);
  ok('Sphere, links held, a scrub at x = 0.75: one kind of globe a frame, not plane w1\'s faded over the carried mesh\'s', r.spheres > 0 && r.mixed === 0, r);
}
await ev('GLR.holdLinks(false), 1');
await settled({ max: 60000, until: 'GLR.pendingLinks === 0' });
{
  const r = info['sphere linked x=0.75'] = await at(0.75);
  ok('Sphere, linked, a scrub at x = 0.75: one kind of globe a frame, the carried mesh\'s', r.spheres > 0 && r.mixed === 0 && r.kinds.length === 1 && r.kinds[0] === 'carried', r);
}

info.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', info.logs.length === 0, info.logs);
return { pass: fails.length === 0, fails, info };
