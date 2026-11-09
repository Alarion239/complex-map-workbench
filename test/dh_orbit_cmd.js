// DH's and Böttcher's H as the shader computes it, with the orbit in variables and recomputed from checkpoints, against the
// same function with the orbit in a 65-entry array: on the GPU the values must agree bit for bit at every point of the
// boundary sets, and the control (the recomputation off by one step) must differ. The page and its checks are
// test/glsl_dh_orbit_test.js; this suite runs it where a GPU suite can run and fails on its verdict.
// Page: dist/glsl-dh-orbit.html (test/make_glsl_dh_orbit.py).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const WAIT_MS = 600000;
await nav(`http://localhost:${PORT}/glsl-dh-orbit.html`);
let r = null;
for (let t = 0; t < WAIT_MS; t += 500) {
  if (await ev('!!(window.__dhOrbit && window.__dhOrbit.done)')) { r = JSON.parse(await ev('JSON.stringify(window.__dhOrbit)')); break; }
  await sleep(500);
}
info.renderer = r && r.renderer;
info.rows = r && r.rows;
info.controls = r && r.controls;
ok('the page finished', !!r, null);
ok('the page reported no errors', !!r && !r.errors.length, r && r.errors);
ok('the orbit in variables equals the array form bit for bit at every point', !!r && r.rows.length > 0 && r.rows.every((x) => x.arrayVsRegistersDiffer === 0), r && r.rows);
ok('control: the recomputation off by one step differs', !!r && r.controls.length > 0 && r.controls.every((c) => c.skewedRecomputeDiffers > 0), r && r.controls);
console.log(JSON.stringify({ pass: fails.length === 0, fails, info }));
