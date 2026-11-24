// The colour key in an exported figure (#1707), as the LaTeX export prints it: the Overleaf preset (Homework, "Overleaf
// article · 11 pt") and the article preset at 11 pt, for a Phase still with zeros and poles (example 9, its pane's key:
// the ring, the modulus strip and the words), the default example's plane z, its plane w₂ past the colour plane with the
// colour carried from z (the carried key) and the classic Phase figure (its ring marked 0, π/2, ±π, -π/2).
// - The ring is vector: the figure's only bitmap is its picture, in the SVG and in the PDF (one image XObject).
// - The key stands clear of the picture: its nearest mark or word is at least KEY_CLEAR pt right of the picture's frame,
//   so the ring's left mark (-1, ±π) does not read as a label of the frame's right side.
// - The key lies inside the figure: its width and its height, also in a wide window, where the picture is shorter than
//   the key, and in Russian and Italian, whose words are longer.
// - A carried key stands clear of the axis titles ("Re w₂" at the real axis's end, past the picture): every mark and word
//   at least KEY_TITLE_CLEAR pt from every axis-name box, in the plain still and in the Two planes figure, in English,
//   Russian and Italian.
// - A key's lines under its ring are KEY_PITCH_EM of their text size apart, baseline to baseline, whatever their letters
//   («цвет» has nothing above the x-height, «перенесён» has «ё»), and a pane key's caption KEY_CAP_GAP pt more under the
//   strip's words: the carried key in the plain still and in Two planes, and the pane's key (example 9), in English,
//   Russian and Italian. A line's baseline and size are read from its glyph box, against its TeX's ascent and descent.
// - A carried key's line never leaves the plane's name alone on a line of its own («из z» stays together): in English and
//   Russian (Italian's words are Pietro's team's).
// A command file for a CDP daemon:  <runner> test/export_key_look_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// pt between the picture's right edge and the key's nearest box (the tick labels sit 3 pt off the frame)
const KEY_CLEAR = 8;
// pt between a carried key's marks and words and the axis titles (glyph boxes)
const KEY_TITLE_CLEAR = 2;
// a key's line pitch, in its text's size; the extra pt between a pane key's strip words and its caption; and the pt
// the measured step may differ from those by
const KEY_PITCH_EM = 1.3, KEY_CAP_GAP = 2, PITCH_TOL = 0.05;
// the key may overshoot the figure's width by this much (SVG units)
const FIT_SLACK = 0.01;
// ms for the page to settle and for a figure build plus its PDF
const BUILD_TIMEOUT_MS = 120000;
const PRESETS = { overleaf11: { for: 'homework', sizeId: 'ol11', text: 11 }, article11: { for: 'article', cols: 1, sizeId: 'art11', text: 11 } };
await view(1440, 900, false);
await load('xkl' + Date.now(), {});
const base = await ev('location.origin');
// want.carried: the figure must carry the colour from another plane (its key says where from: info.keyLine)
const look = async (tag, opts, want = {}) => {
  await ev(`window.__xkl = null; (async () => { const f = await Figure.build(${JSON.stringify(opts)}); if (!f) return { none: true };
    const pdf = new Uint8Array(await (await Figure.pdf(f)).arrayBuffer()); let s = ''; for (let i = 0; i < pdf.length; i += 0x8000) s += String.fromCharCode.apply(null, pdf.subarray(i, i + 0x8000));
    const ims = [...f.svg.matchAll(/<image x="([-0-9.]+)" y="([-0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g)].map((m) => m.slice(1).map(Number));
    const at = (t) => Figure.XD.tex(t, 10);
    const key = f.boxes.filter((b) => b.kind === 'ring-mark' || b.kind === 'key'), names = f.boxes.filter((b) => b.kind === 'axis-name');
    return { view: f.view, W: f.W, H: f.H, keyLine: f.info && f.info.keyLine || null, svgImages: (f.svg.match(/<image\\b/g) || []).length, pdfImages: (s.match(/\\/Subtype\\s*\\/Image\\b/g) || []).length, ims,
      key: key.map((b) => ({ k: b.kind, tex: b.tex, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, ...((m) => ({ base: b.y0 + (b.y1 - b.y0) * m.a / (m.a + m.d), pt: 10 * (b.y1 - b.y0) / (m.a + m.d) }))(at(b.tex)) })), names: names.map((b) => ({ tex: b.tex, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 })) }; })().then((r) => { window.__xkl = r; }, (e) => { window.__xkl = { err: String(e && e.stack || e) }; }); 1`);
  await settled({ until: 'window.__xkl != null', max: BUILD_TIMEOUT_MS, panes: false });
  const r = await ev('window.__xkl');
  ok(`${tag}: a figure builds`, r && !r.err && !r.none, r && (r.err || r));
  if (!r || r.err || r.none) return;
  ok(`${tag}: it has a key`, r.key.length >= 4, r.key.map((b) => b.tex));
  if (want.carried) ok(`${tag}: its key is the carried key, with the line saying where the colour comes from`, !!r.keyLine, { view: r.view, keyLine: r.keyLine });
  const nPic = want.pictures || 1;
  ok(`${tag}: its only bitmaps are its ${nPic} picture(s), in the SVG and in the PDF (the ring is vector)`, r.svgImages === nPic && r.pdfImages === nPic, { svg: r.svgImages, pdf: r.pdfImages });
  // (a carried key and the axis titles: the distance between two boxes is the larger of their gaps across and down; a
  // negative one is an overlap)
  if (want.carried) {
    const sep = (a, b) => Math.max(a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1);
    const pairs = r.key.flatMap((k) => r.names.map((t) => ({ key: k.tex, title: t.tex, gap: +sep(k, t).toFixed(2) })));
    const worst = pairs.reduce((m, q) => (!m || q.gap < m.gap ? q : m), null);
    // (box axes have no axis titles: nothing to stand clear of)
    ok(`${tag}: the carried key stands at least ${KEY_TITLE_CLEAR} pt from every axis title`, !worst || worst.gap >= KEY_TITLE_CLEAR, { closest: worst, titles: r.names.map((t) => t.tex) });
    info[tag + ' (titles)'] = worst;
    // (a line that is only math is the plane's name alone: "z", "w_{1}")
    if (want.lone !== false) {
      const lone = r.key.filter((b) => b.k === 'key' && !/\\text\{/.test(b.tex || ''));
      ok(`${tag}: no line of the carried key is the plane's name alone`, lone.length === 0, { lines: r.key.filter((b) => b.k === 'key').map((b) => b.tex) });
    }
  }
  // (a key's lines under its ring, one under another, by baseline: a pane key's first is its strip's factor, above the
  // strip, and its caption the first line with arg)
  const col = r.key.filter((b) => b.k === 'key').sort((a, b) => a.base - b.base).slice(want.pane ? 1 : 0);
  const ci = want.pane ? col.findIndex((b) => /arg/.test(b.tex)) : -1;
  if (want.pane) ok(`${tag}: the pane's key has the strip's words and the caption`, ci > 0, col.map((b) => b.tex));
  if ((want.carried || want.pane) && col.length >= 2) {
    const steps = col.slice(1).map((b, i) => ({ step: +(b.base - col[i].base).toFixed(2), want: +(KEY_PITCH_EM * col[i].pt + (i + 1 === ci ? KEY_CAP_GAP : 0)).toFixed(2) }));
    ok(`${tag}: the key's lines are ${KEY_PITCH_EM} em apart, baseline to baseline${want.pane ? `, the caption ${KEY_CAP_GAP} pt more` : ''}`, steps.every((q) => Math.abs(q.step - q.want) <= PITCH_TOL), { lines: col.map((b) => b.tex), steps });
    info[tag + ' (steps)'] = steps.map((q) => q.step);
  }
  // (the picture: the largest image, the rightmost of equals; the key stands right of it)
  const pic = r.ims.slice().sort((p, q) => q[2] * q[3] - p[2] * p[3] || q[0] - p[0])[0];
  if (!pic || !r.key.length) return;
  const right = pic[0] + pic[2], near = Math.min(...r.key.map((b) => b.x0)), far = Math.max(...r.key.map((b) => b.x1));
  const first = r.key.find((b) => b.x0 === near);
  ok(`${tag}: the key stands at least ${KEY_CLEAR} pt right of the picture`, near - right >= KEY_CLEAR, { gap: +(near - right).toFixed(2), nearest: first && first.tex });
  ok(`${tag}: the key ends inside the figure's width`, far <= r.W + FIT_SLACK, { right: +far.toFixed(2), W: r.W });
  const top = Math.min(...r.key.map((b) => b.y0)), bot = Math.max(...r.key.map((b) => b.y1)), low = r.key.find((b) => b.y1 === bot);
  ok(`${tag}: the key lies inside the figure's height`, top >= -FIT_SLACK && bot <= r.H + FIT_SLACK, { top: +top.toFixed(2), bottom: +bot.toFixed(2), H: r.H, lowest: low && low.tex });
  info[tag] = { view: r.view, gap: +(near - right).toFixed(2), keyLine: r.keyLine };
};
const open = async (ex, classic, lang) => {
  await go(`${base}/test.html?${classic ? 'view=classic' : 'view=steps'}&ns=xkl${ex}${classic ? 'c' : ''}${Date.now() % 1e7}${lang ? `&lang=${lang}` : ''}`);
  await settled({ until: `window.MathJax && typeof MathJax.tex2svg === "function" && !!window.Figure${classic ? '' : ' && !!window.__cmwSteps'}`, max: 40000 });
  await ev(`(__cmwExample(${ex}), 1)`);
  await settled({ until: classic ? 'true' : '__cmwSteps().planes.length > 0', max: 20000, floor: 600 });
};
// example 9 (zeros at ±1, poles at ±i): the pane's key
await open(9);
for (const [p, o] of Object.entries(PRESETS)) await look(`example 9, ${p}`, o, { pane: true });
// example 1 with the colour from plane z (T = 0, as export_two_planes sets it): plane z, the colour plane with the pane's
// key, then its last plane, past the colour plane, whose figure has the carried key (the ring and the line saying where the
// colour comes from)
await open(1);
await ev('(__cmwSteps({ T: 0 }), __cmwSteps({ go: 0, now: true }), 1)');
await settled({ until: '__cmwSteps().T === 0 && __cmwSteps().i === 0 && !__cmwSteps().moving', max: 15000, floor: 600 });
await look('example 1, plane z, overleaf11', PRESETS.overleaf11);
const n = await ev('__cmwSteps().planes.length');
await ev(`(__cmwSteps({ go: ${n - 1}, now: true }), 1)`);
await settled({ until: `__cmwSteps().i === ${n - 1} && !__cmwSteps().moving && __cmwSteps().T === 0`, max: 15000, floor: 600 });
for (const [p, o] of Object.entries(PRESETS)) await look(`example 1, plane ${n - 1} (carried key), ${p}`, o, { carried: true });
// (the Two planes figure from plane z to the last plane: its second picture's key is the carried key, placed the same way)
const TWO = (to) => Object.assign({ svPic: 'two', svFrom: 0, svTo: to, crop: 'fit' }, PRESETS.overleaf11);
await look(`example 1, Two planes z → plane ${n - 1} (carried key), overleaf11`, TWO(n - 1), { carried: true, pictures: 2 });
// a wide window: the picture is short, and the key is taller than it (example 9 on a 1600 x 480 page)
await view(1600, 480, false);
await open(9);
for (const [p, o] of Object.entries(Object.assign({ revtex: { for: 'article', cols: 2, sizeId: 'revtex', text: 10 } }, PRESETS))) await look(`example 9, wide window, ${p}`, o, { pane: true });
// the same keys in Russian and Italian, whose words are longer: "на полосу яркости" under the strip, the carried
// key's line. Every word stays inside the figure (the words wrap to the key's column)
for (const lang of ['ru', 'it']) {
  await view(1440, 900, false);
  await open(9, false, lang);
  await look(`${lang}: example 9, overleaf11`, PRESETS.overleaf11, { pane: true });
  await open(1, false, lang);
  await ev('(__cmwSteps({ T: 0 }), __cmwSteps({ go: 0, now: true }), 1)');
  await settled({ until: '__cmwSteps().T === 0 && __cmwSteps().i === 0 && !__cmwSteps().moving', max: 15000, floor: 600 });
  await look(`${lang}: example 1, plane z, overleaf11`, PRESETS.overleaf11);
  const nl = await ev('__cmwSteps().planes.length');
  await ev(`(__cmwSteps({ go: ${nl - 1}, now: true }), 1)`);
  await settled({ until: `__cmwSteps().i === ${nl - 1} && !__cmwSteps().moving && __cmwSteps().T === 0`, max: 15000, floor: 600 });
  await look(`${lang}: example 1, plane ${nl - 1} (carried key), overleaf11`, PRESETS.overleaf11, { carried: true, lone: lang !== 'it' });
  await look(`${lang}: example 1, Two planes z → plane ${nl - 1} (carried key), overleaf11`, TWO(nl - 1), { carried: true, pictures: 2, lone: lang !== 'it' });
  await view(1600, 480, false);
  await open(9, false, lang);
  await look(`${lang}: example 9, wide window, overleaf11`, PRESETS.overleaf11, { pane: true });
}
await view(1440, 900, false);
// the classic view's Phase figure: its ring marked 0, π/2, ±π, -π/2 under the title arg F
await open(9, true);
await ev('(__cmwSetMain("phase"), 1)');
await settled({ max: 15000, floor: 600 });
if ((await ev('__cmwView().main')) === 'phase') await look('example 9, classic Phase, overleaf11', PRESETS.overleaf11);
else fails.push({ name: 'the classic view shows Phase', got: await ev('__cmwView()') });
return { pass: fails.length === 0, fails: fails.slice(0, 40), info };
