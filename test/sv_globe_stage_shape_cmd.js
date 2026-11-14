// A shape drawn on a later plane shows on that plane's globe in the steps view (Sphere surface): a Disc fills its
// image in colour (Inside regions leaves the rest of the sphere bare), and a Circle, which has no inside, draws its
// outline over the Everywhere colour: that scene differs from the same one with the circle hidden along the curve.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'curves_kit.js'), 'utf8'))({ ev, send, go, load, shot, settled, view, fs, DIR, ok, R });
const { BASE, settle } = K;
await view(1200, 800);
const snap = () => ev(`(() => { const c = document.getElementById('canvasL'); const s = document.createElement('canvas'); s.width = c.width; s.height = c.height; const x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0); return Array.from(x.getImageData(0, 0, s.width, s.height).data); })()`);
const frame = async (name, shape) => {
  await load(`sv-globe-stage-${name}`, Object.assign({}, BASE, {
    shapes: [Object.assign({ id: 'd1', c: [0.3, 0.3], r: 0.5, stage: 1, ci: 0, visible: true }, shape)],
    targets: [], steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }],
  }));
  await settle();
  await ev(`__cmwSteps({ go: 1, now: true, surf: 'sphere' })`);
  await settle();
  return snap();
};
// the pixels that are coloured (the spread of the channels), and the pixels whose colour differs between two frames
const coloured = (a) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.max(a[i], a[i + 1], a[i + 2]) - Math.min(a[i], a[i + 1], a[i + 2]) > 60) n++; return n; };
const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; return n; };
R.disc = coloured(await frame('disc', { kind: 'disc' }));
ok('the Disc of plane 1 fills its image on the globe', R.disc > 20000, R.disc);
const withC = await frame('circle', { kind: 'circle' }), withoutC = await frame('circle-hidden', { kind: 'circle', visible: false });
R.circle = differ(withC, withoutC);
ok('the Circle of plane 1 draws its outline on the globe', R.circle > 150, R.circle);
return { pass: fails.length === 0, fails, results: R };
