// The steps view's paths figure on the Sphere: the shown plane's step has paths too, as on the plane. For Strip to disk
// (planes 1 and 2) shown on the sphere, the paths chosen for the figure (no typesetting) are 3 to 18 whose starts are the
// previous plane's image of z and whose ends the shown plane's, to 1e-9, and the sentence names them; the figure is offered
// (svPathsFig has a step and the sphere as its surface). Plane 0 has no step before it.
// A command file for a CDP daemon:  <runner> test/steps_paths_sphere_cmd.js
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
await load('psp' + Date.now(), {});
const base = await ev('location.origin');
let ns = 0;
const open = async (exN, plane) => {
  await go(`${base}/test.html?view=steps&ns=psp${Date.now() % 1e7}${ns++}`);
  await settled({ until: '!!window.__cmwSteps && typeof __cmwSvPaths === "function"', max: 30000 });
  await ev(`(__cmwExample(${exN}), 1)`);
  await settled({ until: '__cmwSteps().planes.length > 0', max: 15000 });
  await ev(`(__cmwSteps({ surf: 'sphere' }), __cmwSteps({ go: ${plane}, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving && !(window.__cmwSphere && __cmwSphere().running)', max: 20000 });
};
for (const plane of [1, 2]) {
  const tag = `ex 1 plane ${plane} on the sphere`;
  await open(1, plane);
  const sel = await ev('await __cmwSvPaths()', 120000);
  ok(`${tag}: the paths are chosen, 3 to 18 of them`, sel && sel.n >= 3 && sel.n <= 18, sel);
  ok(`${tag}: path starts are the previous plane's image and ends the shown plane's, to 1e-9`, sel && sel.e0 < 1e-9 && sel.e1 < 1e-9, sel);
  ok(`${tag}: the sentence names the paths`, sel && /Curves are the paths/.test(sel.sentence || ''), sel && sel.sentence);
  R[tag] = sel && { n: sel.n, e0: sel.e0, e1: sel.e1 };
}
await open(1, 0);
const p0 = await ev('await __cmwSvPaths()', 60000);
ok('plane 0 on the sphere: no step before it', p0 && p0.why === 'first', p0);
return { pass: fails.length === 0, fails, results: R };
