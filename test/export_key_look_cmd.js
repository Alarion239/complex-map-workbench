// The colour key in an exported figure (#1707), as the LaTeX export prints it: the Overleaf preset (Homework, "Overleaf
// article · 11 pt") and the article preset at 11 pt, for a Phase still with zeros and poles (example 9, its pane's key:
// the ring, the modulus strip and the words), the default example's plane z, its plane w₂ past the colour plane (the
// carried key) and the classic Phase figure (its ring marked 0, π/2, ±π, -π/2).
// - The ring is vector: the figure's only bitmap is its picture, in the SVG and in the PDF (one image XObject). Before,
//   the ring was a second, 300 dpi bitmap.
// - The key stands clear of the picture: its nearest mark or word is at least KEY_CLEAR pt right of the picture's frame,
//   so the ring's left mark (-1, ±π) does not read as a label of the frame's right side (before: 5.3 pt).
// - The key ends inside the figure: its width and its height. In a wide window the picture is short, and the key's last
//   lines ran below the figure's bottom and were cut off (the key is now moved up, and the figure grows when it must).
// A command file for a CDP daemon:  <runner> test/export_key_look_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// pt between the picture's right edge and the key's nearest box (the tick labels sit 3 pt off the frame)
const KEY_CLEAR = 8;
// the key may overshoot the figure's width by this much (SVG units)
const FIT_SLACK = 0.01;
// ms for the page to settle and for a figure build plus its PDF
const BUILD_TIMEOUT_MS = 120000;
const PRESETS = { overleaf11: { for: 'homework', sizeId: 'ol11', text: 11 }, article11: { for: 'article', cols: 1, sizeId: 'art11', text: 11 } };
await view(1440, 900, false);
await load('xkl' + Date.now(), {});
const base = await ev('location.origin');
const look = async (tag, opts) => {
  await ev(`window.__xkl = null; (async () => { const f = await Figure.build(${JSON.stringify(opts)}); if (!f) return { none: true };
    const pdf = new Uint8Array(await (await Figure.pdf(f)).arrayBuffer()); let s = ''; for (let i = 0; i < pdf.length; i += 0x8000) s += String.fromCharCode.apply(null, pdf.subarray(i, i + 0x8000));
    const ims = [...f.svg.matchAll(/<image x="([-0-9.]+)" y="([-0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g)].map((m) => m.slice(1).map(Number));
    const key = f.boxes.filter((b) => b.kind === 'ring-mark' || b.kind === 'key');
    return { view: f.view, W: f.W, H: f.H, keyLine: f.info && f.info.keyLine || null, svgImages: (f.svg.match(/<image\\b/g) || []).length, pdfImages: (s.match(/\\/Subtype\\s*\\/Image\\b/g) || []).length, ims,
      key: key.map((b) => ({ k: b.kind, tex: b.tex, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 })) }; })().then((r) => { window.__xkl = r; }, (e) => { window.__xkl = { err: String(e && e.stack || e) }; }); 1`);
  await settled({ until: 'window.__xkl != null', max: BUILD_TIMEOUT_MS, panes: false });
  const r = await ev('window.__xkl');
  ok(`${tag}: a figure builds`, r && !r.err && !r.none, r && (r.err || r));
  if (!r || r.err || r.none) return;
  ok(`${tag}: it has a key`, r.key.length >= 4, r.key.map((b) => b.tex));
  ok(`${tag}: its only bitmap is the picture, in the SVG and in the PDF (the ring is vector)`, r.svgImages === 1 && r.pdfImages === 1, { svg: r.svgImages, pdf: r.pdfImages });
  // (the picture: the largest image; the key stands right of it)
  const pic = r.ims.slice().sort((p, q) => q[2] * q[3] - p[2] * p[3])[0];
  if (!pic || !r.key.length) return;
  const right = pic[0] + pic[2], near = Math.min(...r.key.map((b) => b.x0)), far = Math.max(...r.key.map((b) => b.x1));
  const first = r.key.find((b) => b.x0 === near);
  ok(`${tag}: the key stands at least ${KEY_CLEAR} pt right of the picture`, near - right >= KEY_CLEAR, { gap: +(near - right).toFixed(2), nearest: first && first.tex });
  ok(`${tag}: the key ends inside the figure's width`, far <= r.W + FIT_SLACK, { right: +far.toFixed(2), W: r.W });
  const top = Math.min(...r.key.map((b) => b.y0)), bot = Math.max(...r.key.map((b) => b.y1)), low = r.key.find((b) => b.y1 === bot);
  ok(`${tag}: the key lies inside the figure's height`, top >= -FIT_SLACK && bot <= r.H + FIT_SLACK, { top: +top.toFixed(2), bottom: +bot.toFixed(2), H: r.H, lowest: low && low.tex });
  info[tag] = { view: r.view, gap: +(near - right).toFixed(2), keyLine: r.keyLine };
};
const open = async (ex, classic) => {
  await go(`${base}/test.html?${classic ? 'view=classic' : 'view=steps'}&ns=xkl${ex}${classic ? 'c' : ''}${Date.now() % 1e7}`);
  await settled({ until: `window.MathJax && typeof MathJax.tex2svg === "function" && !!window.Figure${classic ? '' : ' && !!window.__cmwSteps'}`, max: 40000 });
  await ev(`(__cmwExample(${ex}), 1)`);
  await settled({ until: classic ? 'true' : '__cmwSteps().planes.length > 0', max: 20000, floor: 600 });
};
// example 9 (zeros at ±1, poles at ±i): the pane's key
await open(9);
for (const [p, o] of Object.entries(PRESETS)) await look(`example 9, ${p}`, o);
// example 1: plane z (the colour plane), then plane w₂ (past it: the carried key)
await open(1);
await look('example 1, plane z, overleaf11', PRESETS.overleaf11);
const n = await ev('__cmwSteps().planes.length');
await ev(`(__cmwSteps({ go: ${n - 1}, now: true }), 1)`);
await settled({ until: '!__cmwSteps().moving', max: 15000, floor: 600 });
await look(`example 1, plane ${n - 1}, overleaf11`, PRESETS.overleaf11);
// a wide window: the picture is short, and the key is taller than it (example 9 on a 1600 x 480 page)
await view(1600, 480, false);
await open(9);
for (const [p, o] of Object.entries(Object.assign({ revtex: { for: 'article', cols: 2, sizeId: 'revtex', text: 10 } }, PRESETS))) await look(`example 9, wide window, ${p}`, o);
await view(1440, 900, false);
// the classic view's Phase figure: its ring marked 0, π/2, ±π, -π/2 under the title arg F
await open(9, true);
await ev('(__cmwSetMain("phase"), 1)');
await settled({ max: 15000, floor: 600 });
if ((await ev('__cmwView().main')) === 'phase') await look('example 9, classic Phase, overleaf11', PRESETS.overleaf11);
else fails.push({ name: 'the classic view shows Phase', got: await ev('__cmwView()') });
return { pass: fails.length === 0, fails: fails.slice(0, 40), info };
