// The Cauchy style in the steps view: the integral (1/2πi) ∮ F(ζ)/(ζ − z) dζ of the whole map F over the selected closed curve,
// drawn on plane z, where the curve lies, while z is the colour plane T.
//   with F = z + 1/z over the unit circle (a pole inside: f₊ = z inside, f₋ = 1/z outside): plane z at T = z is coloured inside
//   and outside for Both, only inside for Inside and only outside for Outside, whichever plane the thread was parked at before;
//   with T at another plane the Cauchy tile is disabled with its reason, and a plane z that keeps the style is paper with the same
//   sentence as its note, the key naming no bands;
//   with no closed curve at all plane z is paper and the key says so.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PNG = process.mainModule.require(path.join(DIR, 'png.js'));
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const CIRCLE = [{ id: 's1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }];
const stateOf = (shapes) => ({ shapes, steps: [{ type: 'custom', params: { expr: 'z+\\frac{1}{z}', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 110 }, nextId: 50, pattern: 'checker', dc: 'cauchy' });
const REASON = 'The Cauchy integral is drawn on z, where its curve lies: colour from z';
// paper and the neutral grey have their channels within GREY_SPREAD of each other (of 255); a hue differs by far more
const GREY_SPREAD = 14;
const isGrey = (c) => Math.abs(c[0] - c[1]) < GREY_SPREAD && Math.abs(c[1] - c[2]) < GREY_SPREAD;
const open = async (shapes) => {
  await view(1440, 900, false, false);
  const ns = 'czs' + Date.now();
  await load(ns, stateOf(shapes));
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`);
  await settled({ until: 'window.MathJax && !!window.__cmwSteps && __cmwSteps().planes.length > 0', max: 30000 });
  if (shapes.length) await ev(`__cmwSelect('s1'); 1`);
  await settled({ until: '!__cmwSteps().moving', max: 15000 });
};
const park = async (T) => {
  await ev(`(__cmwSteps({ T: ${T}, go: 0, now: true }), 1)`);
  await settled({ until: `!__cmwSteps().moving && __cmwSteps().T === ${T} && __cmwSteps().i === 0`, max: 15000 });
};
// the plane's pixels at two world points: one inside the circle, one outside it
const read = async () => {
  const r = await ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
  const png = PNG(Buffer.from(s.data, 'base64'));
  const at = async (x, y) => { const p = await ev(`(() => { const p = __cmwW2S('L', ${x}, ${y}), r = document.getElementById('canvasL').getBoundingClientRect(); return [p[0] - r.left, p[1] - r.top]; })()`); return png.at(Math.round(p[0]), Math.round(p[1])); };
  return { inside: await at(0.55, 0.3), outside: await at(1.9, 0.45) };
};
const legend = async () => JSON.parse(await ev('JSON.stringify(__cmwLegend())'));
const tile = () => ev(`(() => { const t = document.querySelector('#dcSeg [data-v="cauchy"]'); return t ? { disabled: t.disabled, tip: t.dataset.tip, desc: t.getAttribute('aria-description'), on: t.classList.contains('on') } : null; })()`);

await open(CIRCLE);
// (nothing touched T: a state that has the Cauchy style opens coloured from z)
ok('a Cauchy state opens with T = z', (await ev('__cmwSteps().T')) === 0, await ev('__cmwSteps().T'));
// (thread parked at the last plane first: the picture on z does not depend on where it was)
await ev(`(__cmwSteps({ go: 1, now: true }), 1)`);
await settled({ until: '__cmwSteps().i === 1 && !__cmwSteps().moving', max: 15000 });
await park(0);
for (const [show, inside, outside] of [['both', true, true], ['in', true, false], ['out', false, true]]) {
  await ev(`__cmwCauchyOpt('${show}', true)`);
  await settled({ until: '!__cmwSteps().moving' });
  const px = await read();
  info['T 0 ' + show] = px;
  ok(`T = z, ${show}: inside is ${inside ? 'coloured' : 'neutral'}`, isGrey(px.inside) === !inside, px);
  ok(`T = z, ${show}: outside is ${outside ? 'coloured' : 'neutral'}`, isGrey(px.outside) === !outside, px);
}
await ev(`__cmwCauchyOpt('both', true)`);
const t0 = await tile();
ok('T = z: the Cauchy tile is on and enabled', t0 && t0.on && !t0.disabled, t0);
const lg0 = await legend();
ok('T = z: the key names the Cauchy integral and keeps its ring', lg0.caption === 'Cauchy integral' && lg0.ring === true, lg0);
const nm0 = JSON.parse(await ev('JSON.stringify(__cmwSteps().names.title)'));
ok('T = z: the title is "Cauchy integral over {name}"', /^Cauchy integral over /.test(nm0.role), nm0);
// (Inside regions would cut f₋ off: the scope control reads Everywhere, disabled with its reason)
await ev(`(__cmwSteps({ scope: 'in' }), 1)`);
const sc0 = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.sv-scope button')].map((b) => ({ on: b.classList.contains('on'), disabled: b.disabled, tip: b.dataset.tip, v: b.dataset.v })))`));
ok('Cauchy: the scope control is disabled with its reason and reads Everywhere', sc0.length > 0 && sc0.every((b) => b.disabled && /drawn everywhere/.test(b.tip || '')) && sc0.filter((b) => b.on).every((b) => b.v === 'all'), sc0);
const pxs = await read();
ok('Cauchy with scope Inside: the outside is still coloured', !isGrey(pxs.outside), pxs);
await ev(`(__cmwSteps({ scope: 'all' }), 1)`);

await park(1);
const t1 = await tile();
ok('T at plane 1: the Cauchy tile stays, disabled, with its reason as tip and description', t1 && t1.disabled && t1.tip === REASON && t1.desc === REASON, t1);
ok('T at plane 1: the style stays Cauchy', await ev(`__cmwState().dc === 'cauchy'`));
const px1 = await read();
info.T1 = px1;
ok('T at plane 1: plane z is paper (no hue)', isGrey(px1.inside) && isGrey(px1.outside), px1);
const lg1 = await legend();
ok('T at plane 1: the key is its reason alone, no ring and no bands', lg1.caption === 'Cauchy: on z only' && lg1.ring === false, lg1);

await open([]);
await park(0);
const px2 = await read();
info.none = px2;
ok('no closed curve: plane z is paper', isGrey(px2.inside) && isGrey(px2.outside), px2);
const lg2 = await legend();
ok('no closed curve: the key says so, no bands', lg2.caption === 'No curve selected', lg2);
return { pass: !fails.length, fails, info };
