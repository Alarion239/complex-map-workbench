// A glide the carried meshes draw waits on the plane it started from while their programs link, drawn as that plane is
// at rest, and no frame of it blends two planes (#844): the chain [z + 0.2 conj(z)] (not analytic: its homotopy has no
// inverse plan, so its glide is drawn by the carried meshes), coloured from z, Everywhere, opened with the chain's
// programs held linking (?glhold, GLR.holdLinks) and the Play gate off (__cmwSteps({ gate: false }): a glide pressed
// starts at once, so the frames read are those of the hold under the gate).
// - Plane, plane z at rest (the reference): not the bare paper (its mean luminance under PAPER_LUM);
// - plane, a scrub held at x = 0.05, 0.5 and 0.95 (__cmwSteps({ x })): the frame is plane z's at rest (at most HOLD_OFF
//   of its pixels more than DIFF_TOL apart, held_frames' compare), its chrome is plane z's at rest (the rulers' pixels,
//   the scale in the left readout and the rulers' corner, chrome()), no colour plot is drawn at a partial opacity
//   (GLR.drawColorPlot's alpha), and the thread stays where it was put;
// - plane, a glide played (__cmwSteps({ go: 1 })) on the stepped clock (__cmwSteps({ clock })) for PLAY_FRAMES frames,
//   longer than a glide: the thread is still on plane z, the frame and its chrome are plane z's at rest, and no frame
//   drew a colour plot at a partial opacity;
// - the links let go: the held glide arrives on w1, and a scrub at x = 0.5 is the carried meshes' (the glide record's
//   path 'mesh'), with no colour plot under it;
// - plane, a chain with a cut before such a step ([√z, z + 0.2 conj(z)]: the glide from w1 to w2 is the carried meshes',
//   which fill the sheets torn at the cut), only the fill's programs held linking (GLR.holdLinks(true, names): the
//   glide's other programs linked): a scrub at x = 1.5 waits for the fill too, its frame neutral (at least NEUTRAL of its
//   pixels grey: the paper, its grid and rulers; plane w1's frame at rest would stand in another chain's picture while
//   a chain links, so a held scrub off plane z is not drawn as it), no colour plot drawn; and the glide from w1 played
//   on the stepped clock for CUT_FRAMES frames is still on w1; let go, the carried meshes draw it;
// - Sphere, opened again with every program held, a scrub held at x = 0.75: the frame is plane z's globe at rest (as
//   above), and each frame draws one kind of globe (GLR.drawSphere, with the carried mesh or plain), not the carried
//   mesh's attempt and then plane w1's plain globe faded over it; the links let go, the frame at x = 0.75 is the
//   carried mesh's alone.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { grab, compare, DIFF_TOL } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// (FRAMES: the frames read at each place, two rAFs each, a render asked at each; CLOCK_MS: the stepped clock's ms a
// frame; PLAY_FRAMES: the frames a played glide is given, each two rAFs, so 2 PLAY_FRAMES CLOCK_MS ms of glide time, more
// than a Normal glide's; HOLD_OFF: the share of a held frame's pixels that may be more than DIFF_TOL from the rest frame
// (the rest frame's own redraws differ by none); PAPER_LUM: a frame's mean luminance under which it is not the bare
// paper, about 253; NEUTRAL: the share of grey pixels, channels within 20 of each other, of a frame with no picture)
const FRAMES = 6, CLOCK_MS = 16, PLAY_FRAMES = 120, HOLD_OFF = 0.005, PAPER_LUM = 245, NEUTRAL = 0.95;
// (the cut glide's play: CUT_FRAMES frames on a CUT_CLOCK_MS clock, the same glide time in fewer frames, each a frame
// of plane w1 at rest)
const CUT_FRAMES = 30, CUT_CLOCK_MS = 64;
const frames = (n, x) => ev(`(async () => { for (let i = 0; i < ${n}; i++) { ${x == null ? '' : `window.__spheres.push('|'); __cmwSteps({ x: ${x} });`} await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); } return 1; })()`);
const CONJ = { type: 'custom', params: { expr: 'z+0.2*conj(z)', cut: 180 }, on: true }, ROOT = { type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true };
const scene = (steps) => ({ v3: true, v4: true, v5: true, v6: true, shapes: [], steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } });
// the left pane's chrome: the rulers' pixels (a hash of each), the left readout's text (the scale) and the rulers' corner
const chrome = () => ev(`(() => {
  const h = (id) => { const c = document.getElementById(id); if (!c || !c.width) return null; const P = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x = 2166136261; for (let i = 0; i < P.length; i++) x = Math.imul(x ^ P[i], 16777619); return (x >>> 0).toString(16); };
  const t = (id) => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
  return { rx: h('rulerLX'), ry: h('rulerLY'), scale: t('leftReadout'), corner: t('cornerL') };
})()`);
const sameChrome = (a, b) => !!a && !!b && !!a.rx && ['rx', 'ry', 'scale', 'corner'].every((k) => a[k] === b[k]);
// plane j at rest grabbed as 'rest', with its chrome
const restOf = async (j) => {
  await ev(`__cmwSteps({ go: ${j}, now: true }); 1`);
  await frames(2);
  return { grabbed: await grab('rest'), chrome: await chrome() };
};
// the page opened on the chain with its programs held linking, the colour plots' opacities and the globes drawn
// recorded (window.__plotAlphas, window.__spheres; not the no-value pass, drawColorPlot's noValue, which draws only the
// departure plane's hatch where its map has no value, under the carried colour)
const open = async (surf, steps, T = 0) => {
  const ns = `svmw${surf}${Date.now()}`;
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(scene(steps)))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps&glhold`);
  // (polled, not the kit's settled, which waits for the pane's compiles too: here they are held)
  await ev(`(async () => { const t = performance.now() + 60000; while (!(typeof __cmwSteps === 'function' && !!window.GLR && !!document.querySelector('.sv-rail')) && performance.now() < t) await new Promise((r) => setTimeout(r, 100)); return 1; })()`);
  await ev(`(() => {
    const f = GLR.drawColorPlot, g = GLR.drawSphere; window.__plotAlphas = []; window.__spheres = [];
    GLR.drawColorPlot = function (o) { if (!o.noValue) window.__plotAlphas.push(o.alpha == null ? 1 : o.alpha); return f.apply(this, arguments); };
    GLR.drawSphere = function (o) { window.__spheres.push({ k: o && o.carried ? 'carried' : 'globe' }); return g.apply(this, arguments); };
    return 1; })()`);
  // (the Play gate off: a glide pressed waits for nothing before it starts, so the frames read are those of the hold
  // under it, svLinkHold's, while the links are held)
  await ev(`__cmwSet('morphPaths', false); __cmwSteps({ T: ${T}, scope: 'all', surf: '${surf}', gate: false }); 1`);
};
// the frames drawn with the thread at x, read: the opacities of their colour plots, the globes drawn, the thread, the
// frame against the rest frame
const at = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }); window.__plotAlphas = []; window.__spheres = []; 1`);
  await frames(FRAMES, x);
  const held = await grab(`held${x}`), d = held ? await compare(`held${x}`, 'rest') : null;
  // (the globes drawn after each render asked ('|'): a frame that fades one globe over another draws two kinds, the
  // carried mesh's attempt and the other plane's plain globe; the renders of one frame draw one kind)
  const r = await ev(`(() => {
    const s = __cmwSteps(), W = [];
    for (const d of window.__spheres) if (d === '|') W.push([]); else if (W.length) W[W.length - 1].push(d.k);
    const D = W.flat(), mixed = W.filter((w) => new Set(w).size > 1).length;
    return { seq: W.map((w) => w.map((k) => k[0]).join('')).join('|'), mixed, x: s.x, alphas: [...new Set(window.__plotAlphas)].map((a) => +a.toFixed(3)), spheres: D.length, kinds: [...new Set(D)], glide: s.glide && { b: s.glide.b, path: s.glide.path, u: s.glide.u }, pending: GLR.pendingLinks };
  })()`);
  // (null where no rest frame is kept on this page)
  r.vsRest = d && d.frac != null ? { off: +d.frac.toFixed(4), lum: d.lum.map((v) => +v.toFixed(1)) } : null;
  r.chrome = await chrome();
  return r;
};
const partial = (r) => r.alphas.some((a) => a > 0 && a < 1);
// the share of grey pixels of the frame kept as tag (held_frames' grab)
const grey = (tag) => ev(`(() => { const P = window.__heldPx[${JSON.stringify(tag)}]; let n = 0; for (let i = 0; i < P.length; i += 4) if (Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) < 20) n++; return +(n / (P.length / 4)).toFixed(4); })()`);
const asRest = (r) => !!r.vsRest && r.vsRest.off <= HOLD_OFF;

await view(1200, 800, false, false);

// ---- the plane ----
await open('plane', [CONJ]);
info['plane rest'] = await restOf(0);
{
  const d = await compare('rest', 'rest');
  info['plane rest'].lum = d && d.lum[0];
  ok('plane, links held: plane z at rest is drawn, not the bare paper', info['plane rest'].grabbed && !!d && d.lum[0] < PAPER_LUM, info['plane rest']);
}
for (const x of [0.05, 0.5, 0.95]) {
  const r = info[`plane held x=${x}`] = await at(x);
  ok(`plane, links held, a scrub at x = ${x}: the frame is plane z's at rest (at most ${100 * HOLD_OFF} % of pixels more than ${DIFF_TOL} apart)`, asRest(r), r);
  ok(`plane, links held, a scrub at x = ${x}: the rulers, the scale and the rulers' corner are plane z's at rest`, sameChrome(r.chrome, info['plane rest'].chrome), { held: r.chrome, rest: info['plane rest'].chrome });
  ok(`plane, links held, a scrub at x = ${x}: no colour plot at a partial opacity`, !partial(r), r);
  ok(`plane, links held, a scrub at x = ${x}: the thread stays at ${x}`, Math.abs(r.x - x) < 1e-9, r);
}
await ev(`__cmwSteps({ go: 0, now: true, clock: ${CLOCK_MS} }); window.__plotAlphas = []; __cmwSteps({ go: 1 }); 1`);
await frames(PLAY_FRAMES);
{
  const held = await grab('played'), d = held ? await compare('played', 'rest') : null;
  const r = info['plane played, held'] = await ev(`(() => { const s = __cmwSteps(); return { x: s.x, anim: !!s.anim, alphas: [...new Set(window.__plotAlphas)].map((a) => +a.toFixed(3)) }; })()`);
  r.vsRest = d && { off: +d.frac.toFixed(4) };
  r.chrome = await chrome();
  ok(`plane, links held, a glide played for ${PLAY_FRAMES} stepped frames: the thread is still on plane z`, r.x < 1e-6 && r.anim, r);
  ok('plane, links held, a glide played: the frame is plane z\'s at rest', asRest(r), r);
  ok('plane, links held, a glide played: the rulers, the scale and the rulers\' corner are plane z\'s at rest', sameChrome(r.chrome, info['plane rest'].chrome), { held: r.chrome, rest: info['plane rest'].chrome });
  ok('plane, links held, a glide played: no frame drew a colour plot at a partial opacity', !partial(r), r);
}
await ev('GLR.holdLinks(false), 1');
await settled({ max: 60000, until: "GLR.pendingLinks === 0 && !__cmwSteps().anim && __cmwSteps().x === 1" });
info['plane played, let go'] = await ev('(() => { const s = __cmwSteps(); return { x: s.x, anim: !!s.anim }; })()');
ok('plane, the links let go: the glide arrives on w1', info['plane played, let go'].x === 1, info['plane played, let go']);
await ev('__cmwSteps({ clock: 0 }); 1');
{
  const r = info['plane linked x=0.5'] = await at(0.5);
  ok('plane, linked, a scrub at x = 0.5: the carried meshes draw it (the glide record\'s path \'mesh\', no colour plot)', !!r.glide && r.glide.path === 'mesh' && r.alphas.length === 0 && Math.abs(r.x - 0.5) < 1e-9, r);
}

// ---- the plane, a chain with a cut: the fill's programs alone held ----
await open('plane', [ROOT, CONJ]);
{
  const names = info['cut fill'] = await ev("GLR.carryNames(false).filter((n) => !/^regionKCN?$/.test(n))");
  ok('cut: the glide\'s carried colour has a fill (its programs other than the cached one)', names.length > 0, names);
  await ev(`GLR.holdLinks(true, ${JSON.stringify(names)}); 1`);
  await settled({ max: 60000, panes: false, until: `GLR.pending().every((p) => ${JSON.stringify(names)}.some((n) => p.id.includes(n)))` });
  const r = info['cut fill held x=1.5'] = await at(1.5);
  r.grey = await grey('held1.5');
  ok(`cut, the fill's programs alone linking, a scrub at x = 1.5: its frame neutral (${100 * NEUTRAL} % grey) with no colour plot`, r.grey >= NEUTRAL && r.alphas.length === 0 && Math.abs(r.x - 1.5) < 1e-9, r);
  await ev(`__cmwSteps({ go: 1, now: true, clock: ${CUT_CLOCK_MS} }); __cmwSteps({ go: 2 }); 1`);
  await frames(CUT_FRAMES);
  const p = info['cut fill played'] = await ev('(() => { const s = __cmwSteps(); return { x: s.x, anim: !!s.anim }; })()');
  ok(`cut, the fill's programs alone linking, the glide from w1 played for ${CUT_FRAMES} stepped frames: it waits on w1 for the fill`, Math.abs(p.x - 1) < 1e-6 && p.anim, p);
  await ev('__cmwSteps({ clock: 0, go: 1, now: true }); 1');
  await ev('GLR.holdLinks(false), 1');
  await settled({ max: 60000, until: 'GLR.pendingLinks === 0' });
  const q = info['cut linked x=1.5'] = await at(1.5);
  q.grey = await grey('held1.5');
  ok('cut, linked, a scrub at x = 1.5: the carried meshes draw it', !!q.glide && q.glide.b === 2 && q.glide.path === 'mesh' && q.grey < NEUTRAL, q);
}

// ---- the Sphere ----
await open('sphere', [CONJ]);
info['sphere rest'] = await restOf(0);
{
  const r = info['sphere held x=0.75'] = await at(0.75);
  ok('Sphere, links held, a scrub at x = 0.75: the frame is plane z\'s globe at rest', asRest(r), r);
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
