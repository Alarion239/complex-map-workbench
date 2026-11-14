// The zeta library's table of ln k (ZETA_LIB's uLogK, filled by the GPU once: logK in src/gl/04-programs-resources.js).
// The steps view on the zeros of zeta, whose chain links the zeta programs:
// - the table has its 132 entries, 1 for k = 0 (the mark that it is filled), each other entry the float32 ln k to within one part in 1e6 and, k by k,
//   strictly increasing: a read-back that came out empty, shifted or half-filled fails;
// - the frame it draws is the page's plot (a program that ran with a table of zeros would draw nothing but blank).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views-1 shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
// (132 is the table's size written out on purpose: the test pins the contract, not GLChain.ZETA_LN_K_COUNT. The host accepts a GPU's
// table within 1e-5 of Math.log, any GPU's; the CI renderer's is held to 1e-6 here)
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const ZETA = 'Zeros of the zeta function';
await view(1280, 800, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=zetalogk${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const idx = names.indexOf(ZETA);
ok('the zeta example is in the examples', idx >= 0, idx);
await ev(`__cmwExample(${idx}); 1`);
await settled({ max: 120000 });
const t = await ev('Array.from(GLR._src.logK())');
info.len = t && t.length;
ok('the table has 132 entries', Array.isArray(t) && t.length === 132, info.len);
if (Array.isArray(t) && t.length === 132) {
  ok('entry 0 is 1, the mark that the table is filled', t[0] === 1, t[0]);
  const bad = [];
  for (let k = 1; k < 132; k++) {
    const want = Math.fround(Math.log(k));
    if (!(Math.abs(t[k] - want) <= 1e-6 * (1 + want)) || (k > 1 && !(t[k] > t[k - 1]))) bad.push([k, t[k], want]);
  }
  ok('every entry k = 1 .. 131 is ln k to 1e-6 and increasing', bad.length === 0, bad.slice(0, 5));
}
// (every 97th pixel is sampled: a prime stride, so the samples do not line up with the plot's rows or checker cells; a drawn plot has far more than 50 distinct colours there, a flat fill one)
const SAMPLE_STRIDE = 97, MIN_DISTINCT_COLOURS = 50;
const px = await ev(`(() => { const c = document.getElementById('canvasL'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * ${SAMPLE_STRIDE}) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); return seen.size; })()`);
ok('the zeta plot draws more than a flat colour', px > MIN_DISTINCT_COLOURS, px);
info.colours = px;
// (the table's own GPU pass compiles with the page's header: a shader that failed to compile is logged, and the host's logs would stand in unseen)
const shaderErrors = (await logs()).filter((x) => /shader \w+ ERROR/.test(x.m || ''));
ok('no shader failed to compile', shaderErrors.length === 0, shaderErrors.slice(0, 3));
return { pass: !fails.length, fails, info };
