// Figure export, the classic Image figure (X → Y, two panels): a point drawn on plane w₁ is carried from its own plane, as
// the page draws it. e^z then z², the point z₀ = 0.4 + 0.3i on z and the point 1 + 0.5i on w₁:
// - focus 0 (z and w₂): panel (a), the z-plane, has z₀ alone (a point of a later plane is not drawn there); panel (b) has
//   F(z₀) = e^(0.8 + 0.6i) and f₂(1 + 0.5i) = 0.75 + i;
// - step 2 focused (w₁ and w₂): panel (a) has f₁(z₀) = e^(0.4 + 0.3i) and the w₁ point at 1 + 0.5i itself; panel (b) has F(z₀)
//   and 0.75 + i;
// - every point a panel draws is named, and the names on a panel are different: by the plane it is shown on (z₀; w₁(z₀) on w₁;
//   F(z₀) on the last plane; f₂(…) for the focused step's image of a point of its plane; w₁,₁ with a thin space after its comma);
// - the caption's (a) lists the shapes of (a)'s plane and earlier ones, and names the w₁ point with its own plane (en, ru).
// (control: the same scene with both points on z keeps both on panel (a), at focus 0, at their coordinates)
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
const build = async (ns, st, lang = 'en') => {
  await view(1440, 900, false);
  await seed(ns, st);
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=classic`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwFig && typeof __cmwP === "function"', max: 30000 });
  return ev(`await (async () => { try { const f = await __cmwFig.build({ for: 'article', cols: 2, capInImage: false }); if (!f) return { none: true };
    return { view: f.view, panels: f.info && f.info.panels, points: f.info && f.info.points, cap: String(f.captionTex || '') }; } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 180000);
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
  ok(`focus 0, ${lang}: (b) names the w₁ point's image w_{2}(w_{1,\\,1})`, (near(R, F2_W11)[0] || {}).label === 'w_{2}(w_{1,\\,1})', R);
  // (the caption: (a) lists z₀ alone; the w₁ point is named with its own plane, as (b) shows it)
  const capA = lang === 'ru' ? /^\\textit\{а\}~--- точка \$z_\{0\}=0\{,\}4\+0\{,\}3i\$ в~плоскости~\$z\$;/ : /^\(a\) The point \$z_\{0\}=0\.4\+0\.3i\$ in the \$z\$-plane\./;
  const capW = lang === 'ru' ? /образ точки \$z_\{1\}=1\+0\{,\}5i\$ из~плоскости~\$w_\{1\}\$/ : /Panel \(b\) also shows the image of the point \$z_\{1\}=1\+0\.5i\$, drawn in the \$w_\{1\}\$-plane\./;
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
  ok('focus 2: (b) names the w₁ point\'s image f_{2}(w_{1,\\,1}), the focused step\'s', (near(R, F2_W11)[0] || {}).label === 'f_{2}(w_{1,\\,1})', R);
  ok('focus 2: the caption\'s (a) has both points in the w₁-plane, and says nothing more of the w₁ point', /^\(a\) The point \$z_\{0\}=0\.4\+0\.3i\$ and the point \$z_\{1\}=1\+0\.5i\$ in the \$w_\{1\}\$-plane\./.test(f.cap || '') && !/also shows/.test(f.cap || ''), f.cap);
}
// ---- (control) both points on z: both on panel (a) at their coordinates
{
  const f = await build('xspc' + Date.now(), scene(0, 0)), L = f.points && f.points.L;
  info.control = f;
  ok('both points on z (control): panel (a) has both at their coordinates', has(L, Z0) && has(L, W11), L);
  ok('both points on z (control): the caption is as before, both points in the z-plane', /^\(a\) The point \$z_\{0\}=0\.4\+0\.3i\$ and the point \$z_\{1\}=1\+0\.5i\$ in the \$z\$-plane\. \(b\) Their images under \$F\$/.test(f.cap || '') && !/also shows/.test(f.cap || ''), f.cap);
}
return { pass: fails.length === 0, fails, info };
