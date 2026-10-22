// The generated-program benchmark (SPEC 4.7, results in SPEC 13.10), a command file for a CDP daemon (test/cdp_kit):
//   python3 test/make_inv_bench.py
//   node test/<you>_cdp/cdpd.js                    (ANGLE Metal; CDP_ANGLE=swiftshader for SwiftShader, if your copy
//                                                   of cdpd.js reads it) and copy test/inv_bench_evp.js next to it
//   test/<you>_cdp/q.sh test/inv_bench_cmd.js
// Writes test/inv_bench_results/<backend>.json and, at dpr 1 alpha 1 (flat), a PNG per scene into <daemon>/shots/.
// Set globalThis.__IB = {scenes, dprs, alphas, globe, n} in a preceding command to narrow the run.
const evp = new Function('ev', 'sleep', fs.readFileSync(path.join(DIR, '../inv_bench_evp.js'), 'utf8'))(ev, sleep);
const O = globalThis.__IB || {};
await nav('http://localhost:8793/inv-bench.html');
const ren = await ev(`(IB.init(), GLR.gl.getParameter(GLR.gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL))`);
const backend = /SwiftShader/i.test(ren) ? 'swiftshader' : /Metal/i.test(ren) ? 'metal' : 'other';
const scenes = O.scenes || ['zi_H', 'expH', 'e1z_disc', 'sin_halfstrip', 'expexp_disc', 'poly40_exp', 'formula_strip_exp', 'disc_cube', 'joukowski', 'annulus_log'];
const out = { renderer: ren, backend, date: new Date().toISOString(), ua: await ev('navigator.userAgent'), scenes: {} };
for (const name of scenes) {
  const opts = { dprs: O.dprs || [1, 2], alphas: O.alphas || [1, 0.85], globe: O.globe ?? true, n: O.n || (backend === 'swiftshader' ? 6 : 20), png: true };
  const r = await evp(`IB.run(${JSON.stringify(name)}, ${JSON.stringify(opts)})`, 3600000);
  if (r.rows) for (const x of r.rows) if (x.png) { fs.mkdirSync(path.join(DIR, 'shots'), { recursive: true }); fs.writeFileSync(path.join(DIR, 'shots', `bench_${backend}_${name}.png`), Buffer.from(x.png.split(',')[1], 'base64')); delete x.png; }
  out.scenes[name] = r;
}
const dir = path.join(DIR, '../inv_bench_results');
const suffix = O.suffix ? '_' + O.suffix : '';
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, backend + suffix + '.json'), JSON.stringify(out, null, 1));
// a compact table: pass ms per (dpr, alpha, view), compile, first draw
const tab = {};
for (const [name, r] of Object.entries(out.scenes)) {
  if (r.error) { tab[name] = r.error; continue; }
  tab[name] = { N: r.N.join('x'), compile: Object.fromEntries(Object.entries(r.compile).map(([k, c]) => [k, c.error ? 'ERR ' + String(c.error).slice(0, 80) : `${c.compileMs}+${c.linkMs} ms, ${c.srcLen} B`])),
    pass: Object.fromEntries(r.rows.map((x) => [`${x.view} dpr${x.dpr} a${x.alpha}`, x.error ? 'ERR ' + x.error : `${x.passMs} ms (ready ${x.readyMs}, first ${x.firstDrawMs})`])) };
}
return { backend, renderer: ren, tab, logs: logs().filter((l) => l.t !== 'log-error') };
