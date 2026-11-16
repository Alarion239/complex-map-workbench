// The steps view's Landscape chrome: the Height key, the title and the readout name what the height reads, which
// follows the colour plane T: the map into T up to it (F from z into the last plane, f₁, f₂), T's own variable
// on T, and past T T's variable, whose heights the points carry. The default page (z, exp, Möbius) on the Landscape,
// with T = w₁ (plane w₂ past it) and T = w₂ (the default):
// - on every plane at rest and between planes, held at u = 0.5: the Height key is the key, captioned "height log |X|",
//   X what the plane's height reads (held, either plane's);
// - the title names the relief's height, log|X|, on every plane with either T;
// - at rest the probe at the pane's centre reads the point, X there (but on T, where X is the point) and the height |X|
//   (but on T, where the point's own row reads it);
// - the Height control names the kind of height alone ("log |·|", "|·|", "Re", "Im"), each button named in words that
//   start with its visible label ("Re, real part");
// - on a phone (360 x 640) on T with a log height, the readout reads the point and |w₁| once, and the Display sheet
//   shows the Height control under a visible "Height" caption.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const legend = async () => await evJson('JSON.stringify(__cmwLegend())');
// the pointer over the pane's centre: the readout's rows (label, value) and the probed point
async function probeRows() {
  const c = await evJson(`JSON.stringify((() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })())`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0] + 1, y: c[1] });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0], y: c[1] });
  await settled({ max: 20000 });
  await ev(rAF2);
  return await evJson(`JSON.stringify([...document.querySelectorAll('#leftReadout .rp')].map((e) => [e.querySelector('.rk') ? e.querySelector('.rk').textContent : '', e.querySelector('.rv') ? e.querySelector('.rv').textContent : '']))`);
}
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landchrome${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
await settled({ max: 60000 });
// what plane i's height reads with T
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'plane_key_kit.js'), 'utf8')), X = (T, i) => K.heightOf(T, i);
// the Height control names the kind of height alone, the same on every plane (the title, the key and the ruler name the
// map), each button with an accessible name in words
info.heightSeg = await evJson(`JSON.stringify([...document.querySelectorAll('#heightSeg button')].map((b) => [b.dataset.v, b.textContent.trim(), b.getAttribute('aria-label')]))`);
ok('the Height control: the kinds log |·|, |·|, Re, Im', JSON.stringify(info.heightSeg.map((b) => b.slice(0, 2))) === JSON.stringify([['log', 'log |·|'], ['abs', '|·|'], ['re', 'Re'], ['im', 'Im']]), info.heightSeg);
ok('the Height control: each button named in words that start with its visible label', JSON.stringify(info.heightSeg.map((b) => b[2])) === JSON.stringify(['log of the modulus', 'modulus', 'Re, real part', 'Im, imaginary part']), info.heightSeg);
info.runs = {};
for (const T of [1, 2]) {
  const r = info.runs['T' + T] = { rest: {}, held: {} };
  await ev(`__cmwSteps({ T: ${T} }); 1`);
  for (const i of [0, 1, 2]) {
    await rest(i);
    const k = await legend(), role = await ev('__cmwSteps().names.title.role');
    const rows = await probeRows();
    r.rest[i] = { k, role, rows };
    const x = X(T, i);
    ok(`T = ${T}, plane ${i} at rest: the Height key, of ${x}`, k.kind === '3d' && k.caption === `height log |${x}|`, k);
    ok(`T = ${T}, plane ${i}: the title's height is log|${x}|`, String(role).replace(/<[^>]*>/g, '').includes(`log|${x}|`), role);
    const lab = rows.map((r) => r[0].trim());
    // (on T the point's own row reads |x|: a log height adds no second one)
    ok(`T = ${T}, plane ${i} at rest: the readout reads |${x}| once`, lab.filter((l) => l === `|${x}|`).length === 1, rows);
    // (on T, x is the plane's own variable: its row is the point's, not repeated)
    ok(`T = ${T}, plane ${i} at rest: the readout reads ${x} once`, lab.filter((l) => l === x).length === 1, rows);
  }
  for (const x of [0.5, 1.5]) {
    await rest(Math.floor(x));
    await park(x);
    const k = await legend();
    r.held[x] = k;
    const xs = [X(T, Math.floor(x)), X(T, Math.ceil(x))].map((v) => `height log |${v}|`);
    ok(`T = ${T}, held at ${x}: the Height key, of either plane's`, k.kind === '3d' && xs.includes(k.caption), k);
  }
}
// a phone (360 x 640) on T with a log height: the readout reads the point and its modulus, the height, once (the one-line
// form with |w₁| is too wide there, so its two lines: w₁, then |w₁|)
await view(360, 640, false, true);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landchromeph${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!window.Phone && Phone._state().on' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 1, go: 1, now: true }); 1`);
await settled({ max: 60000 });
await ev(rAF2);
info.phone = await probeRows();
const labP = info.phone.map((r) => r[0].trim());
ok('phone 360 x 640, T = 1, plane 1 at rest: the readout reads w₁', labP.includes('w₁'), info.phone);
ok('phone 360 x 640, T = 1, plane 1 at rest: the readout reads |w₁| once', labP.filter((l) => l === '|w₁|').length === 1, info.phone);
// (the Display sheet: the Height control under a visible caption, as its buttons name the kind alone)
await ev(`Phone.open('display'), 1`);
await settled({ max: 20000, until: '!!document.querySelector("#heightSeg") && !!document.querySelector("#heightSeg").getClientRects().length' });
info.sheet = await ev(`(() => { const g = document.getElementById('heightSeg'), c = g && g.previousElementSibling; return { tag: c ? c.tagName : null, text: c ? c.textContent : null, shown: !!(c && c.getClientRects().length), labelledBy: g ? g.getAttribute('aria-labelledby') : null, id: c ? c.id : null }; })()`);
ok('phone 360 x 640: the Display sheet captions the Height control, visibly', !!info.sheet && info.sheet.tag === 'H3' && info.sheet.text === 'Height' && info.sheet.shown, info.sheet);
ok('phone 360 x 640: the caption names the Height control (aria-labelledby), so it is said once', !!info.sheet && !!info.sheet.id && info.sheet.labelledBy === info.sheet.id, info.sheet);
return { pass: fails.length === 0, fails, info };
