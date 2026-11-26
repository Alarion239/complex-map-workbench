// The steps view's moving paths on the Sphere, the glide held with the camera standing still: the paths are chosen
// once and kept. Their choice tests each start's place on the globe at the glide's start (its image under H_0), and a
// turn of the camera that takes more than a quarter of the kept starts' places out of view chooses again (the globe's
// epoch). z² then exp, Everywhere, a disc, the glide from w₁ to w₂ held at x = 1.5 (H_0 is not the identity there):
// - after the paths have landed, the view's own frames over STILL_MS (one every SAMPLE_MS) are one picture, and the
//   globe's epoch does not move;
// - control: the camera turned by TURN radians chooses again (the epoch moves), and the paths are drawn after it.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const STILL_MS = 6000, SAMPLE_MS = 500, TURN = 2.6;
const QUIET = '__cmwSteps().ready.ready && GLR.pendingLinks === 0';
const HASH = `(() => { const c = document.getElementById('canvasL'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < x.length; i += 4) h = (h * 31 + x[i] + 7 * x[i + 1] + 13 * x[i + 2]) | 0; return h; })()`;
const paths = () => ev('(({ globeHeads, globeEpoch, src }) => ({ globeHeads, globeEpoch, startId: src && src.startId }))(__cmwSteps().paths)');
await view(1200, 800, false, false);
const ns = 'svpstill' + Date.now();
await seed(ns, {
  v3: true, v4: true, v5: true, v6: true, alpha: 1, nextId: 50, focus: 0, rightMode: 'image',
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'exp', params: {}, on: true }],
});
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && !!window.GLR` });
await ev(`__cmwSet('morphPaths', true); __cmwSteps({ go: 1, now: true, surf: 'sphere', scope: 'all' }); 1`);
await settled({ max: 90000, until: QUIET });
await ev('__cmwSteps({ x: 1.5 }); 1');
await settled({ max: 90000, until: `${QUIET} && __cmwSteps().paths.globeHeads > 0` });
// (the first choice lands, and its cross-fade from nothing runs out)
await sleep(1500);
// the view's own frames, one every SAMPLE_MS over ms: their distinct pictures and the epochs seen
const watch = async (ms) => {
  const hashes = new Set(), epochs = new Set();
  for (let t = 0; t < ms; t += SAMPLE_MS) {
    await ev('__cmwSteps({ x: 1.5 }); 1');
    await settled({ max: 30000, until: QUIET });
    hashes.add(await ev(HASH));
    epochs.add((await paths()).globeEpoch);
    await sleep(SAMPLE_MS);
  }
  return { pictures: hashes.size, epochs: [...epochs] };
};
const p0 = info.start = await paths();
ok('the glide from w₁ to w₂ does not start at the identity (H_0 ≠ id), and its paths are drawn on the globe', p0.startId === false && p0.globeHeads > 0, p0);
const still = info.still = await watch(STILL_MS);
ok(`the camera standing still for ${STILL_MS} ms: the view's frames are one picture`, still.pictures === 1, still);
ok(`the camera standing still for ${STILL_MS} ms: the globe's paths are not chosen again (the epoch does not move)`, still.epochs.length === 1 && typeof still.epochs[0] === 'number', still);
// ---- control: a turn that takes the starts out of view chooses again ----
const e0 = (await paths()).globeEpoch;
await ev(`__cmwCam('L', { yaw: __cmwCam('L').yaw + ${TURN} }); 1`);
await settled({ max: 90000, until: QUIET });
await ev('__cmwSteps({ x: 1.5 }); 1');
await settled({ max: 30000, until: `${QUIET} && __cmwSteps().paths.globeEpoch !== ${JSON.stringify(e0)}` });
await sleep(1000);
await ev('__cmwSteps({ x: 1.5 }); 1');
await settled({ max: 90000, until: `${QUIET} && __cmwSteps().paths.globeHeads > 0` });
const turned = info.turned = await paths();
ok(`control: the camera turned by ${TURN} rad chooses the globe's paths again`, typeof turned.globeEpoch === 'number' && turned.globeEpoch > e0, { e0, turned });
ok('control: the paths are drawn after the turn', turned.globeHeads > 0, turned);
return { pass: fails.length === 0, fails, info };
