// The steps view's Landscape stays 3D on every plane: before, at and past the colour plane T,
// at rest and in every frame between two planes. The default page (z, exp, Möbius) on the Landscape with T = w₁, so
// plane w₂ is past it, and with T = w₂ (the default):
// - at rest on each plane: the Landscape is the view, its Height key is shown, the camera's pitch is the user's, and
//   the probe finds the point under the pane's centre;
// - held at u = 0.25, 0.5, 0.75 between each two planes: carried frames (__cmwLandCarry), the Landscape and its Height
//   key still on, the pitch unchanged;
// - held by either end of each glide (a scrub on the rail, not let go, at u = 0.001 and 0.999; the difference from the rest frame grows with u, as the points move): the plane at rest
//   there, within the exact-image tolerance (at most 2 % of the pane's pixels more than 32/255 apart: the rest frame's
//   refined walls and cut rims are not drawn while moving);
// - past T the carried points keep T's colour: plane w₂'s frame at rest is the points of w₁ carried (s = 1, u = 1);
// - the title names the height, h(F) on every plane ("landscape of log|F|", and "|F|", "Re F", "Im F" as the Height
//   select reads), then past T the carried colour (", colour carried from w₁"); the floor's axes name the plane drawn
//   (Re w₁, Im w₁ on w₁), and in a held frame the plane nearer the thread.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const { hold, grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const rest = async (i) => { await ev(`window.__drawn = []; __cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`window.__drawn = []; __cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
// what the frame shows: the view, the Height key (shown, and named so) and the camera's pitch
const state = async () => JSON.parse(await ev(`JSON.stringify((() => {
  const l = document.getElementById('leftLegend'), st = __cmwSteps();
  const name = l ? [l.title, l.getAttribute('aria-label'), l.textContent].join(' ') : '';
  const r = document.getElementById('canvasL').getBoundingClientRect(), pk = __cmwSound({ pick: [r.left + r.width / 2, r.top + r.height / 2] });
  const d = window.__drawn || [], axes = d.flatMap((t, i) => (/^(Re|Im) $/.test(t) && d[i + 1] ? [t + d[i + 1]] : []));
  return { title: (document.querySelector('.sv-title') || {}).textContent || '', axes: [...new Set(axes)], main: st.main, key: !!l && !l.hidden && /Height key/.test(name), pitch: __cmwCam('L').pitch, pick: pk, carry: typeof __cmwLandCarry === 'function' ? __cmwLandCarry() : null };
})())`));
await go(`http://localhost:${PORT}/test.html?view=steps&ns=land3d${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
// (the words the canvases draw, from the last reset: the floor's axis names)
await ev(`(() => { const f = CanvasRenderingContext2D.prototype.fillText; window.__drawn = []; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { if (this.canvas.id === 'canvasL') window.__drawn.push(String(t)); return f.call(this, t, ...a); }; return 1; })()`);
await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
await settled({ max: 60000 });
const planes = await ev('__cmwSteps().planes');
ok('the default page has three planes', Array.isArray(planes) && planes.length === 3, planes);
info.runs = {};
for (const T of [1, 2]) {
  const r = info.runs['T' + T] = { rest: {}, held: {}, ends: {} };
  await ev(`__cmwSteps({ T: ${T} }); 1`);
  await rest(0);
  const pitch0 = (await state()).pitch;
  for (const i of [0, 1, 2]) {
    await rest(i);
    const s = await state();
    await grab(`T${T}r${i}`);
    r.rest[i] = s;
    ok(`T = ${T}, plane ${i} at rest: the Landscape`, s.main === 'land', s);
    ok(`T = ${T}, plane ${i} at rest: the Height key`, s.key, s);
    ok(`T = ${T}, plane ${i} at rest: the user's pitch`, Math.abs(s.pitch - pitch0) < 1e-9, s);
    const nm = i === 0 ? 'z' : `w${'₀₁₂'[i]}`, want = 'landscape of log|F|' + (i > T ? ', colour carried from w₁' : '');
    ok(`T = ${T}, plane ${i} at rest: the title names h(F)`, s.title.endsWith(want), s.title);
    ok(`T = ${T}, plane ${i} at rest: the axes name ${nm}`, s.axes.includes('Re ' + nm) && s.axes.includes('Im ' + nm) && s.axes.length === 2, s.axes);
    ok(`T = ${T}, plane ${i} at rest: the probe finds the point under the pane's centre`, Array.isArray(s.pick) && s.pick.every(Number.isFinite), s);
  }
  ok(`T = ${T}: plane w₂ at rest`, T === 2 ? !r.rest[2].carry : !!r.rest[2].carry && r.rest[2].carry.s === 1 && r.rest[2].carry.u === 1, r.rest[2].carry);
  for (const j of [0, 1]) {
    for (const f of [0.25, 0.5, 0.75]) {
      await rest(j);
      await park(j + f);
      const s = await state();
      r.held[j + f] = s;
      ok(`T = ${T}, held at ${j + f}: a carried frame from plane ${Math.min(j, T)}`, !!s.carry && s.carry.s === Math.min(j, T) && Math.abs(s.carry.u - f) < 1e-6, s.carry);
      ok(`T = ${T}, held at ${j + f}: the Landscape`, s.main === 'land', s);
      const nm = Math.round(j + f) === 0 ? 'z' : `w${'₀₁₂'[Math.round(j + f)]}`;
      ok(`T = ${T}, held at ${j + f}: the axes name ${nm}`, s.axes.includes('Re ' + nm) && s.axes.length === 2, s.axes);
      ok(`T = ${T}, held at ${j + f}: the Height key`, s.key, s);
      ok(`T = ${T}, held at ${j + f}: the user's pitch`, Math.abs(s.pitch - pitch0) < 1e-9, s);
    }
    for (const [f, end] of [[0.001, j], [0.999, j + 1]]) {
      await rest(j);
      await hold(j + f);
      await ev(rAF2);
      const s = await state();
      await grab(`T${T}h${j + f}`);
      const c = await compare(`T${T}h${j + f}`, `T${T}r${end}`), d = c && c.frac;
      r.ends[j + f] = { u: s.carry ? s.carry.u : null, d, key: s.key };
      await ev('window.__svScrubUp(), 1');
      await settled({ max: 60000 });
      ok(`T = ${T}, held at ${j + f}: a carried frame`, !!s.carry && Math.abs(s.carry.u - f) < 0.002, s.carry);
      ok(`T = ${T}, held at ${j + f}: the Height key`, s.key, s);
      ok(`T = ${T}, held at ${j + f}: plane ${end} at rest there (≤ 2 % of pixels > 32/255)`, d != null && d <= 0.02, r.ends[j + f]);
    }
  }
}
// the title follows the Height select, on a plane before T and on one past it
await ev(`__cmwSteps({ T: 1 }); 1`);
info.heights = {};
for (const [v, h] of [['abs', '|F|'], ['re', 'Re F'], ['im', 'Im F']]) {
  await ev(`(document.querySelector('#heightSeg button[data-v="${v}"]') || {}).click?.(), 1`);
  for (const i of [0, 2]) {
    await rest(i);
    const t = info.heights[v + i] = (await state()).title;
    ok(`height ${v}, plane ${i}: the title names ${h}`, t.endsWith(`landscape of ${h}` + (i > 1 ? ', colour carried from w₁' : '')), t);
  }
}
return { pass: fails.length === 0, fails, info };
