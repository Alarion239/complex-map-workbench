// The steps view's Inside regions in a glide frame (zeta, plane between z and w₁): until the regions' SphereMesh is
// built, the mask is drawn from the shape's own tessellated mesh, which lacks the image of the critical strip, so the
// pane reports that frame as pending, and the picture is drawn again when the mesh lands:
//   - no sample of the pane has less than the floor's share of non-paper pixels while its status is not pending;
//   - once the pane is quiet, the share is at least the floor.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const DEFAULT_PORT = '8793';
const INK_PAPER = 240;        // a pixel is paper when every channel is above it
const SHARE_FLOOR = 0.065;    // the zeta glide's share of the pane at x = 0.5 (steps_glide_inverse_cmd)
const SAMPLE_MS = 700;        // between samples
const MAX_SAMPLES = 400;      // a frame takes seconds on a software renderer
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, DEFAULT_PORT])[1];
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const SAMPLE = `(() => { const s = __cmwPaneStatus('L'), c = document.querySelector('#canvasL'), k = document.createElement('canvas'); k.width = c.width; k.height = c.height; const q = k.getContext('2d'); q.drawImage(c, 0, 0); const d = q.getImageData(0, 0, k.width, k.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (!(d[i] > ${INK_PAPER} && d[i + 1] > ${INK_PAPER} && d[i + 2] > ${INK_PAPER})) n++; return { pending: !!(s && (s.pending || s.compiling)), share: n / (d.length / 4) }; })()`;
const ex = names.indexOf('Zeros of the zeta function');
ok('the zeta example is found', ex >= 0, names.length);
await view(1440, 900, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=gmp${Date.now()}&lang=en`);
await settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")', panes: false });
await ev(`__cmwExample(${ex}), 1`);
await ev("__cmwSteps({ bare: true, scope: 'in' }), 1");
await ev('__cmwSteps({ x: 0.5 }), 1');
const samples = [];
let quiet = 0;
for (let i = 0; i < MAX_SAMPLES && quiet < 3; i++) {
  await ev(`new Promise((r) => setTimeout(r, ${SAMPLE_MS}))`);
  const s = await ev(SAMPLE);
  samples.push([s.pending, +s.share.toFixed(4)]);
  quiet = !s.pending && s.share >= SHARE_FLOOR ? quiet + 1 : 0;
}
info.samples = samples;
const bad = samples.filter(([pending, share]) => !pending && share < SHARE_FLOOR);
ok('no sample below the floor while the pane is not pending', bad.length === 0, bad.slice(0, 5));
ok('quiet at the end, with at least the floor', quiet >= 3, samples.slice(-3));
return { pass: fails.length === 0, fails, info };
