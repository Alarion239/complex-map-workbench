// Figure export, the classic figure of X → Y, X's panel (Y's pane is not drawn since #994): a point drawn on plane w₁ is
// carried from its own plane, as the page draws it. e^z then z², the point z₀ = 0.4 + 0.3i on z and the point 1 + 0.5i on w₁:
// - focus 0 (z): the panel, the z-plane, has z₀ alone (a point of a later plane is not drawn there);
// - step 2 focused (w₁): the panel has f₁(z₀) = e^(0.4 + 0.3i) and the w₁ point at 1 + 0.5i itself;
// - every point the panel draws is named, and the names are different: by the plane it is shown on (z₀; w₁(z₀) on w₁;
//   w₁,₁ with a thin space after its comma);
// - the caption lists the shapes of the panel's plane and earlier ones, and names the w₁ point w₁,₁ with its own plane (en, ru).
// (control: the same scene with both points on z keeps both on the panel, at focus 0, at their coordinates)
// A circle and a disc drawn on w₁ are carried from their own plane the same way (the last blocks).
// (standards-ok: panel (b), Y's, its points, curves and chevrons, the caption's sentence on it and the F it defines went with
// Y's pane, not drawn since #994)
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
// how near (in the plane's units) a drawn point must be to where the page draws it
const NEAR = 1e-6;
const Z0 = [0.4, 0.3], W11 = [1, 0.5];
const cexp = ([x, y]) => [Math.exp(x) * Math.cos(y), Math.exp(x) * Math.sin(y)];
const STEPS = [{ type: 'custom', params: { expr: 'e^z', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^2', cut: 180 }, on: true }];
const scene = (focus, stage = 1) => ({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus, rightMode: 'image', steps: STEPS,
  shapes: [{ id: 'p0', kind: 'point', p: Z0, visible: true }, Object.assign({ id: 'p1', kind: 'point', p: W11, visible: true }, stage ? { stage } : {})] });
const build = async (ns, st, lang = 'en', forWhat = 'article') => {
  await view(1440, 900, false);
  await seed(ns, st);
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=classic`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwFig && typeof __cmwP === "function"', max: 30000 });
  return ev(`await (async () => { try { const f = await __cmwFig.build({ for: '${forWhat}', cols: 2, capInImage: false }); if (!f) return { none: true };
    return { view: f.view, panels: f.info && f.info.panels, points: f.info && f.info.points, curves: f.info && f.info.curves, chevrons: !!(f.info && f.info.chevrons), cap: String(f.captionTex || '') }; } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 180000);
};
// the panel's points near p, and whether a panel has a point near p
const near = (pts, p) => (pts || []).filter((q) => Math.hypot(q.z[0] - p[0], q.z[1] - p[1]) < NEAR);
const has = (pts, p) => near(pts, p).length === 1;
const named = (pts) => (pts || []).every((q) => typeof q.label === 'string' && q.label.length > 0) && new Set((pts || []).map((q) => q.label)).size === (pts || []).length;
const F1_Z0 = cexp(Z0);
// ---- focus 0: z
for (const lang of ['en', 'ru']) {
  const f = await build('xsp0' + lang + Date.now(), scene(0), lang), L = f.points && f.points.L;
  info['focus 0 ' + lang] = f;
  ok(`focus 0, ${lang}: the figure is X's panel (control)`, !f.err && !f.none && JSON.stringify(f.panels) === JSON.stringify(['L']), f);
  ok(`focus 0, ${lang}: the panel, the z-plane, has z₀ and not the point of w₁`, has(L, Z0) && !has(L, W11) && (L || []).length === 1, L);
  ok(`focus 0, ${lang}: every point the panel draws is named, each by its own name`, named(L), L);
  ok(`focus 0, ${lang}: the panel names z₀ z_{0}`, (near(L, Z0)[0] || {}).label === 'z_{0}', L);
  ok(`focus 0, ${lang}: the caption says nothing of the whole map (control)`, !/is the whole map|всё отображение/.test(f.cap || ''), f.cap);
  const cap0 = lang === 'ru' ? /^Точка \$z_\{0\}=0\{,\}4\+0\{,\}3i\$ в~плоскости~\$z\$/ : /^The point \$z_\{0\}=0\.4\+0\.3i\$ in the \$z\$-plane\./;
  ok(`focus 0, ${lang}: the caption is the point of z alone, in the z-plane`, cap0.test(f.cap || ''), f.cap);
}
// ---- step 2 focused: w₁
{
  const f = await build('xsp2' + Date.now(), scene(2)), L = f.points && f.points.L;
  info['focus 2'] = f;
  ok('focus 2: the figure is X\'s panel (control)', !f.err && !f.none && JSON.stringify(f.panels) === JSON.stringify(['L']), f);
  ok('focus 2: the panel, the w₁-plane, has f₁(z₀) and the w₁ point at 1 + 0.5i itself', has(L, F1_Z0) && has(L, W11) && (L || []).length === 2, L);
  ok('focus 2: every point the panel draws is named, each by its own name', named(L), L);
  ok('focus 2: the panel names z₀\'s image w_{1}(z_{0}), not by the focused step', (near(L, F1_Z0)[0] || {}).label === 'w_{1}(z_{0})', L);
  ok('focus 2: the panel names the w₁ point by its own name, w_{1,\\,1}', (near(L, W11)[0] || {}).label === 'w_{1,\\,1}', L);
  // (z₀ is not a point of w₁: the caption gives its image there, as the panel draws and names it, w₁(z₀) = e^{z₀} ≈ 1.425 + 0.441i,
  // and z₀'s value in a math run of its own, so a line may break before it)
  ok('focus 2: the caption gives z₀\'s image on w₁, w₁(z₀) ≈ 1.425 + 0.441i (rounded, so ≈) with z₀ = 0.4 + 0.3i, and the w₁ point, in the w₁-plane, and says nothing more', /^The point \$w_\{1\}\(z_\{0\}\)\\approx 1\.425\+0\.441i\$ \(\$z_\{0\}=0\.4\+0\.3i\$\) and the point \$w_\{1,\\,1\}=1\+0\.5i\$ in the \$w_\{1\}\$-plane\.$/.test(f.cap || ''), f.cap);
}
// ---- step 2 focused, a point of z with its own label, A: named by the same rule as the others, w₁(A), and the caption by the
// panel's name
{
  const st = Object.assign(scene(2), { shapes: [{ id: 'pa', kind: 'point', p: Z0, label: 'A', visible: true }] });
  const f = await build('xsp2a' + Date.now(), st), L = f.points && f.points.L;
  info['focus 2, labelled'] = { points: f.points, cap: f.cap };
  ok('focus 2, a labelled point A of z: the panel names its image w_{1}(A)', (near(L, F1_Z0)[0] || {}).label === 'w_{1}(A)', L);
  ok('focus 2, a labelled point A of z: the caption gives it by the panel\'s name, w_{1}(A) ≈ 1.425 + 0.441i with A = 0.4 + 0.3i', /^The point \$w_\{1\}\(A\)\\approx 1\.425\+0\.441i\$ \(\$A=0\.4\+0\.3i\$\) in the \$w_\{1\}\$-plane\./.test(f.cap || ''), f.cap);
}
// ---- step 2 focused, in Russian: the image of z₀ with ≈ and z₀'s value
{
  const f = await build('xsp2ru' + Date.now(), scene(2), 'ru');
  info['focus 2 ru'] = { cap: f.cap };
  ok('focus 2, ru: the caption gives z₀\'s image ≈ 1{,}425 + 0{,}441i with z₀ = 0{,}4 + 0{,}3i', /\$w_\{1\}\(z_\{0\}\)\\approx 1\{,\}425\+0\{,\}441i\$ \(\$z_\{0\}=0\{,\}4\+0\{,\}3i\$\)/.test(f.cap || ''), f.cap);
}
// ---- (control) both points on z: both on the panel at their coordinates
{
  const f = await build('xspc' + Date.now(), scene(0, 0)), L = f.points && f.points.L;
  info.control = f;
  ok('both points on z (control): the panel has both at their coordinates', has(L, Z0) && has(L, W11), L);
  ok('both points on z (control): the caption has both points in the z-plane', /^The point \$z_\{0\}=0\.4\+0\.3i\$ and the point \$z_\{1\}=1\+0\.5i\$ in the \$z\$-plane\./.test(f.cap || '') && !/also shows/.test(f.cap || ''), f.cap);
}
// ---- a circle and a disc drawn on w₁: carried from their own plane, as the page draws them, like the points above.
// The circle |w₁ − 1| = 0.5 and the disc |w₁ − 1| ≤ 0.3 on w₁:
// - focus 0: the panel, the z-plane, draws neither (a later plane's shape is not drawn there);
// - step 2 focused: the panel, the w₁-plane, draws them themselves.
// (control: the same circle and disc drawn on z, at focus 0: the panel draws them themselves)
// the most a sampled point's preimage strays from the shape's edge, |pre(w) − 1| − r, over the points of the shape's curve on a panel
const CURVE_TOL = 2e-3;
const stray = (curves, id, r, pre) => { const c = (curves || []).find((q) => q.id === id); if (!c || !c.pts.length) return null; return Math.max(...c.pts.map((w) => { const z = pre(w); return Math.abs(Math.hypot(z[0] - 1, z[1]) - r); })); };
const curveScene = (focus, stage) => Object.assign(scene(focus), { shapes: [Object.assign({ id: 'c1', kind: 'circle', c: [1, 0], r: 0.5, visible: true }, stage ? { stage } : {}), Object.assign({ id: 'd1', kind: 'disc', c: [1, 0], r: 0.3, visible: true }, stage ? { stage } : {})] });
const id = (w) => w;
// (the caption writes each shape in its own plane's variable, as its row does: |w₁ − 1| = 0.5 for the circle of w₁, |z − 1| = 0.5
// for the control's)
const W1_CIRCLE = '|w_{1}-1|=0.5', W1_DISC = '|w_{1}-1|\\le 0.3', Z_CIRCLE = '|z-1|=0.5', Z_DISC = '|z-1|\\le 0.3';
for (const [tag, focus, stage] of [['focus 0', 0, 1], ['focus 2', 2, 1], ['control, on z, focus 0', 0, 0]]) {
  const f = await build('xspcv' + focus + stage + Date.now(), curveScene(focus, stage)), L = f.curves && f.curves.L;
  info['caption ' + tag] = f.cap;
  if (tag === 'focus 2') ok(`caption, ${tag}: the circle and the disc of w₁ are written in w₁, $${W1_CIRCLE}$ and $${W1_DISC}$, not in z`, (f.cap || '').includes(W1_CIRCLE) && (f.cap || '').includes(W1_DISC) && !/\|z-1\|/.test(f.cap || ''), f.cap);
  else if (!stage) ok(`caption, ${tag}: the circle and the disc of z keep z, $${Z_CIRCLE}$ and $${Z_DISC}$`, (f.cap || '').includes(Z_CIRCLE) && (f.cap || '').includes(Z_DISC) && !/w_\{1\}-1/.test(f.cap || ''), f.cap);
  info['curves ' + tag] = { L: (L || []).map((c) => ({ id: c.id, n: c.pts.length, first: c.pts[0] })), err: f.err };
  ok(`curves, ${tag}: the figure is X's panel (control)`, !f.err && !f.none && JSON.stringify(f.panels) === JSON.stringify(['L']), f.err || f.panels);
  for (const [sid, r, what] of [['c1', 0.5, 'circle'], ['d1', 0.3, 'disc']]) {
    if (tag === 'focus 0') ok(`curves, focus 0: the panel, the z-plane, does not draw the ${what} of w₁`, !(L || []).some((c) => c.id === sid), info['curves ' + tag].L);
    else {
      const eL = stray(L, sid, r, id);
      ok(`curves, ${tag}: the panel draws the ${what} itself (off by ${eL})`, eL != null && eL < CURVE_TOL, info['curves ' + tag].L);
    }
  }
}
// (in Russian too, with the decimal comma: |w₁ − 1| = 0{,}5)
{
  const f = await build('xspcvru2' + Date.now(), curveScene(2, 1), 'ru');
  info['caption ru, focus 2'] = f.cap;
  ok('caption ru, focus 2: the circle and the disc of w₁ are written in w₁, |w_{1}-1|=0{,}5 and |w_{1}-1|\\le 0{,}3', (f.cap || '').includes('|w_{1}-1|=0{,}5') && (f.cap || '').includes('|w_{1}-1|\\le 0{,}3') && !/\|z-1\|/.test(f.cap || ''), f.cap);
}
// ---- the Homework figure's orientation chevrons on a disc drawn on w₁, at step 2 focused: drawn as on a disc of z, carried from
// w₁. (control: the disc on z)
const discScene = (focus, stage) => Object.assign(scene(focus), { shapes: [Object.assign({ id: 'd1', kind: 'disc', c: [1, 0], r: 0.3, visible: true }, stage ? { stage } : {})] });
for (const [tag, focus, stage] of [['focus 2', 2, 1], ['control, on z, focus 0', 0, 0]]) {
  const f = await build('xsphw' + focus + stage + Date.now(), discScene(focus, stage), 'en', 'homework');
  info['chevrons ' + tag] = { chevrons: f.chevrons, err: f.err };
  ok(`Homework, ${tag}: the disc${stage ? ' of w₁' : ''} has its orientation chevrons`, !f.err && f.chevrons === true, info['chevrons ' + tag]);
}
// ---- a point of w₁ whose label is a word, at step 2 focused: its value is given in its plane's variable, "the trailing edge
// $w_{1}=1+0.5i$" ("The" when it opens the sentence); (control: on z, "$z=…$")
for (const [tag, focus, stage] of [['focus 2', 2, 1], ['control, on z', 0, 0]]) {
  const st = Object.assign(scene(focus), { shapes: [Object.assign({ id: 'pw', kind: 'point', p: W11, label: 'trailing edge', visible: true }, stage ? { stage } : {})] });
  const f = await build('xspwd' + focus + stage + Date.now(), st);
  info['word label ' + tag] = f.cap;
  const want = stage ? 'trailing edge $w_{1}=1+0.5i$' : 'trailing edge $z=1+0.5i$';
  ok(`a point named by a word, ${tag}: its value in its plane's variable, ${want}`, (f.cap || '').includes(want), f.cap);
}
// ---- in Russian, a point named by a word takes its case from a head noun, «точка «…»», and its name stays as typed: at step 2
// focused the panel's list is nominative (точка «задний край» …)
// (standards-ok: the focus-0 rows, the "Panel (b) also shows" list in ru (genitive, and its unlabelled control), en and it,
// read panel (b), Y's, which the classic figure does not draw, #994; the nominative list at focus 2 is read)
const wordScene = (focus, label) => Object.assign(curveScene(focus, 1), {}, { shapes: curveScene(focus, 1).shapes.concat([Object.assign({ id: 'pw', kind: 'point', p: W11, visible: true, stage: 1 }, label ? { label } : {})]) });
for (const [focus, lang, label, want, not] of [
  [2, 'ru', 'задний край', 'точка «задний край» $w_{1}=1+0{,}5i$', /точки «задний край»/],
]) {
  const f = await build('xspwr' + focus + lang + (label ? 1 : 0) + Date.now(), wordScene(focus, label), lang);
  const tag = `${lang}, focus ${focus}, ${label ? `the point named «${label}»` : 'the point unlabelled (control)'}`;
  info['word case ' + tag] = f.cap;
  ok(`word label, ${tag}: ${want}`, (typeof want === 'string' ? (f.cap || '').includes(want) : want.test(f.cap || '')) && !not.test(f.cap || ''), f.cap);
}
return { pass: fails.length === 0, fails, info };
