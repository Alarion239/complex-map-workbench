// Figure export, the classic Image figure (X → Y, two panels): a point drawn on plane w₁ is carried from its own plane, as
// the page draws it. e^z then z², the point z₀ = 0.4 + 0.3i on z and the point 1 + 0.5i on w₁:
// - focus 0 (z and w₂): panel (a), the z-plane, has z₀ alone (a point of a later plane is not drawn there); panel (b) has
//   F(z₀) = e^(0.8 + 0.6i) and f₂(1 + 0.5i) = 0.75 + i;
// - step 2 focused (w₁ and w₂): panel (a) has f₁(z₀) = e^(0.4 + 0.3i) and the w₁ point at 1 + 0.5i itself; panel (b) has F(z₀)
//   and 0.75 + i;
// - every point a panel draws is named, and the names on a panel are different: by the plane it is shown on (z₀; w₁(z₀) on w₁;
//   F(z₀) on the last plane; f₂(…) for the focused step's image of a point of its plane; w₁,₁ with a thin space after its comma);
// - the caption's (a) lists the shapes of (a)'s plane and earlier ones, and names the w₁ point w₁,₁ with its own plane (en, ru).
// (control: the same scene with both points on z keeps both on panel (a), at focus 0, at their coordinates)
// A circle and a disc drawn on w₁ are carried from their own plane the same way (the last block).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
// how near (in the plane's units) a drawn point must be to where the page draws it
const NEAR = 1e-6;
const Z0 = [0.4, 0.3], W11 = [1, 0.5];
const cexp = ([x, y]) => [Math.exp(x) * Math.cos(y), Math.exp(x) * Math.sin(y)];
const csq = ([x, y]) => [x * x - y * y, 2 * x * y];
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
const F_Z0 = csq(cexp(Z0)), F1_Z0 = cexp(Z0), F2_W11 = csq(W11);
// ---- focus 0: z and w₂
for (const lang of ['en', 'ru']) {
  const f = await build('xsp0' + lang + Date.now(), scene(0), lang), L = f.points && f.points.L, R = f.points && f.points.R;
  info['focus 0 ' + lang] = f;
  ok(`focus 0, ${lang}: the figure has two panels (control)`, !f.err && !f.none && JSON.stringify(f.panels) === JSON.stringify(['L', 'R']), f);
  ok(`focus 0, ${lang}: panel (a), the z-plane, has z₀ and not the point of w₁`, has(L, Z0) && !has(L, W11) && (L || []).length === 1, L);
  ok(`focus 0, ${lang}: panel (b) has F(z₀) and the w₁ point at f₂(1 + 0.5i) = 0.75 + i`, has(R, F_Z0) && has(R, F2_W11) && (R || []).length === 2, R);
  ok(`focus 0, ${lang}: every point a panel draws is named, each by its own name`, named(L) && named(R), { L, R });
  // (each point by the plane it is shown on: z₀ on z, F(z₀) on the last plane; the w₁ point, w₁,₁ with a thin space after its comma, as
  // the image on w₂)
  ok(`focus 0, ${lang}: (a) names z₀ z_{0}`, (near(L, Z0)[0] || {}).label === 'z_{0}', L);
  ok(`focus 0, ${lang}: (b) names z₀'s image F(z_{0})`, (near(R, F_Z0)[0] || {}).label === 'F(z_{0})', R);
  ok(`focus 0, ${lang}: the caption defines F as the map, and says nothing more of it (control)`, !/is the whole map|всё отображение/.test(f.cap || ''), f.cap);
  ok(`focus 0, ${lang}: (b) names the w₁ point's image w_{2}(w_{1,\\,1})`, (near(R, F2_W11)[0] || {}).label === 'w_{2}(w_{1,\\,1})', R);
  // (the caption: (a) lists z₀ alone; the w₁ point is named with its own plane, as (b) shows it)
  const capA = lang === 'ru' ? /^\\textit\{а\}~--- точка \$z_\{0\}=0\{,\}4\+0\{,\}3i\$ в~плоскости~\$z\$;/ : /^\(a\) The point \$z_\{0\}=0\.4\+0\.3i\$ in the \$z\$-plane\./;
  const capW = lang === 'ru' ? /образ точки \$w_\{1,\\,1\}=1\+0\{,\}5i\$ из~плоскости~\$w_\{1\}\$/ : /Panel \(b\) also shows the image of the point \$w_\{1,\\,1\}=1\+0\.5i\$, drawn in the \$w_\{1\}\$-plane\./;
  ok(`focus 0, ${lang}: the caption's (a) is the point of z alone, in the z-plane`, capA.test(f.cap || ''), f.cap);
  ok(`focus 0, ${lang}: the caption names the w₁ point with its own plane, w₁`, capW.test(f.cap || ''), f.cap);
}
// ---- step 2 focused: w₁ and w₂
{
  const f = await build('xsp2' + Date.now(), scene(2)), L = f.points && f.points.L, R = f.points && f.points.R;
  info['focus 2'] = f;
  ok('focus 2: the figure has two panels (control)', !f.err && !f.none && JSON.stringify(f.panels) === JSON.stringify(['L', 'R']), f);
  ok('focus 2: panel (a), the w₁-plane, has f₁(z₀) and the w₁ point at 1 + 0.5i itself', has(L, F1_Z0) && has(L, W11) && (L || []).length === 2, L);
  ok('focus 2: panel (b) has F(z₀) and the w₁ point at 0.75 + i', has(R, F_Z0) && has(R, F2_W11) && (R || []).length === 2, R);
  ok('focus 2: every point a panel draws is named, each by its own name', named(L) && named(R), { L, R });
  ok('focus 2: (a), the w₁-plane, names z₀\'s image w_{1}(z_{0}), not by the focused step', (near(L, F1_Z0)[0] || {}).label === 'w_{1}(z_{0})', L);
  ok('focus 2: (a) names the w₁ point by its own name, w_{1,\\,1}', (near(L, W11)[0] || {}).label === 'w_{1,\\,1}', L);
  ok('focus 2: (b) names z₀\'s image F(z_{0}), the whole map\'s', (near(R, F_Z0)[0] || {}).label === 'F(z_{0})', R);
  ok('focus 2: the caption defines F, which (b)\'s label names, by its formula: F(z) = (e^z)², the whole map', /Here \$F\(z\)=\\left\(e\^\{z\}\\right\)\^\{2\}\$ is the whole map\./.test(f.cap || ''), f.cap);
  ok('focus 2: (b) names the w₁ point\'s image f_{2}(w_{1,\\,1}), the focused step\'s', (near(R, F2_W11)[0] || {}).label === 'f_{2}(w_{1,\\,1})', R);
  // (z₀ is not a point of w₁: the caption gives its image there, as (a) draws and names it, w₁(z₀) = e^{z₀} ≈ 1.425 + 0.441i, and z₀'s
  // value in a math run of its own, so a line may break before it)
  ok('focus 2: the caption\'s (a) gives z₀\'s image on w₁, w₁(z₀) ≈ 1.425 + 0.441i (rounded, so ≈) with z₀ = 0.4 + 0.3i, and the w₁ point, in the w₁-plane, and says nothing more', /^\(a\) The point \$w_\{1\}\(z_\{0\}\)\\approx 1\.425\+0\.441i\$ \(\$z_\{0\}=0\.4\+0\.3i\$\) and the point \$w_\{1,\\,1\}=1\+0\.5i\$ in the \$w_\{1\}\$-plane\./.test(f.cap || '') && !/also shows/.test(f.cap || ''), f.cap);
}
// ---- step 2 focused, a point of z with its own label, A: named by the same rule as the others, w₁(A) on (a) and F(A) on (b), and
// the caption's (a) by (a)'s name
{
  const st = Object.assign(scene(2), { shapes: [{ id: 'pa', kind: 'point', p: Z0, label: 'A', visible: true }] });
  const f = await build('xsp2a' + Date.now(), st), L = f.points && f.points.L, R = f.points && f.points.R;
  info['focus 2, labelled'] = { points: f.points, cap: f.cap };
  ok('focus 2, a labelled point A of z: (a) names its image w_{1}(A)', (near(L, F1_Z0)[0] || {}).label === 'w_{1}(A)', L);
  ok('focus 2, a labelled point A of z: (b) names its image F(A), the whole map\'s', (near(R, F_Z0)[0] || {}).label === 'F(A)', R);
  ok('focus 2, a labelled point A of z: the caption\'s (a) gives it by the same name as (a)\'s label, w_{1}(A) ≈ 1.425 + 0.441i with A = 0.4 + 0.3i', /^\(a\) The point \$w_\{1\}\(A\)\\approx 1\.425\+0\.441i\$ \(\$A=0\.4\+0\.3i\$\) in the \$w_\{1\}\$-plane\./.test(f.cap || ''), f.cap);
  ok('focus 2, a labelled point A of z: the caption defines F, which (b)\'s label F(A) names, by its formula', /Here \$F\(z\)=\\left\(e\^\{z\}\\right\)\^\{2\}\$ is the whole map\./.test(f.cap || ''), f.cap);
}
// ---- step 2 focused, in Russian: the image of z₀ with ≈ and z₀'s value, and F defined by its formula
{
  const f = await build('xsp2ru' + Date.now(), scene(2), 'ru');
  info['focus 2 ru'] = { cap: f.cap };
  ok('focus 2, ru: the caption gives z₀\'s image ≈ 1{,}425 + 0{,}441i with z₀ = 0{,}4 + 0{,}3i', /\$w_\{1\}\(z_\{0\}\)\\approx 1\{,\}425\+0\{,\}441i\$ \(\$z_\{0\}=0\{,\}4\+0\{,\}3i\$\)/.test(f.cap || ''), f.cap);
  ok('focus 2, ru: the caption defines F by its formula', /Здесь \$F\(z\)=\\left\(e\^\{z\}\\right\)\^\{2\}\$~--- всё отображение\./.test(f.cap || ''), f.cap);
}
// ---- (control) both points on z: both on panel (a) at their coordinates
{
  const f = await build('xspc' + Date.now(), scene(0, 0)), L = f.points && f.points.L;
  info.control = f;
  ok('both points on z (control): panel (a) has both at their coordinates', has(L, Z0) && has(L, W11), L);
  ok('both points on z (control): the caption is as before, both points in the z-plane', /^\(a\) The point \$z_\{0\}=0\.4\+0\.3i\$ and the point \$z_\{1\}=1\+0\.5i\$ in the \$z\$-plane\. \(b\) Their images under \$F\$/.test(f.cap || '') && !/also shows/.test(f.cap || ''), f.cap);
}
// ---- a circle and a disc drawn on w₁: carried from their own plane, as the page draws them, like the points above.
// The circle |w₁ − 1| = 0.5 and the disc |w₁ − 1| ≤ 0.3 on w₁:
// - focus 0: panel (a), the z-plane, draws neither (a later plane's shape is not drawn there); panel (b), w₂, draws their images
//   under z² alone, so √w lies on the circle (on the disc's edge);
// - step 2 focused: panel (a), the w₁-plane, draws them themselves; panel (b) their images under z².
// (control: the same circle and disc drawn on z, at focus 0: (a) draws them themselves, (b) their images under F = (e^z)², so
// Log(w)/2 lies on them)
const csqrt = ([x, y]) => { const r = Math.hypot(x, y), a = Math.sqrt((r + x) / 2), b = Math.sign(y || 1) * Math.sqrt(Math.max(0, (r - x) / 2)); return [a, b]; };
const clog2 = ([x, y]) => [Math.log(Math.hypot(x, y)) / 2, Math.atan2(y, x) / 2];
// the most a sampled point's preimage strays from the shape's edge, |pre(w) − 1| − r, over the points of the shape's curve on a panel
const CURVE_TOL = 2e-3;
const stray = (curves, id, r, pre) => { const c = (curves || []).find((q) => q.id === id); if (!c || !c.pts.length) return null; return Math.max(...c.pts.map((w) => { const z = pre(w); return Math.abs(Math.hypot(z[0] - 1, z[1]) - r); })); };
const curveScene = (focus, stage) => Object.assign(scene(focus), { shapes: [Object.assign({ id: 'c1', kind: 'circle', c: [1, 0], r: 0.5, visible: true }, stage ? { stage } : {}), Object.assign({ id: 'd1', kind: 'disc', c: [1, 0], r: 0.3, visible: true }, stage ? { stage } : {})] });
const id = (w) => w;
for (const [tag, focus, stage] of [['focus 0', 0, 1], ['focus 2', 2, 1], ['control, on z, focus 0', 0, 0]]) {
  const f = await build('xspcv' + focus + stage + Date.now(), curveScene(focus, stage)), L = f.curves && f.curves.L, R = f.curves && f.curves.R;
  info['curves ' + tag] = { L: (L || []).map((c) => ({ id: c.id, n: c.pts.length, first: c.pts[0] })), R: (R || []).map((c) => ({ id: c.id, n: c.pts.length, first: c.pts[0] })), err: f.err };
  ok(`curves, ${tag}: the figure has two panels (control)`, !f.err && !f.none && JSON.stringify(f.panels) === JSON.stringify(['L', 'R']), f.err || f.panels);
  for (const [sid, r, what] of [['c1', 0.5, 'circle'], ['d1', 0.3, 'disc']]) {
    if (tag === 'focus 0') {
      ok(`curves, focus 0: panel (a), the z-plane, does not draw the ${what} of w₁`, !(L || []).some((c) => c.id === sid), info['curves ' + tag].L);
      const e = stray(R, sid, r, csqrt);
      ok(`curves, focus 0: panel (b) draws the ${what} of w₁'s image under z², √w on its edge (off by ${e})`, e != null && e < CURVE_TOL, info['curves ' + tag].R);
    } else if (tag === 'focus 2') {
      const eL = stray(L, sid, r, id), eR = stray(R, sid, r, csqrt);
      ok(`curves, focus 2: panel (a), the w₁-plane, draws the ${what} itself (off by ${eL})`, eL != null && eL < CURVE_TOL, info['curves ' + tag].L);
      ok(`curves, focus 2: panel (b) draws its image under z², √w on its edge (off by ${eR})`, eR != null && eR < CURVE_TOL, info['curves ' + tag].R);
    } else {
      const eL = stray(L, sid, r, id), eR = stray(R, sid, r, clog2);
      ok(`curves, control: panel (a) draws the ${what} of z itself (off by ${eL})`, eL != null && eL < CURVE_TOL, info['curves ' + tag].L);
      ok(`curves, control: panel (b) draws its image under F = (e^z)², Log(w)/2 on its edge (off by ${eR})`, eR != null && eR < CURVE_TOL, info['curves ' + tag].R);
    }
  }
}
// ---- the Homework figure's orientation chevrons on a disc drawn on w₁: drawn as on a disc of z, carried from w₁ (at focus 0 on
// panel (b) alone, which alone draws it; at step 2 focused on both). (control: the disc on z)
const discScene = (focus, stage) => Object.assign(scene(focus), { shapes: [Object.assign({ id: 'd1', kind: 'disc', c: [1, 0], r: 0.3, visible: true }, stage ? { stage } : {})] });
for (const [tag, focus, stage] of [['focus 0', 0, 1], ['focus 2', 2, 1], ['control, on z, focus 0', 0, 0]]) {
  const f = await build('xsphw' + focus + stage + Date.now(), discScene(focus, stage), 'en', 'homework');
  info['chevrons ' + tag] = { chevrons: f.chevrons, err: f.err };
  ok(`Homework, ${tag}: the disc${stage ? ' of w₁' : ''} has its orientation chevrons`, !f.err && f.chevrons === true, info['chevrons ' + tag]);
}
return { pass: fails.length === 0, fails, info };
