// Item 2 (the deformation as one picture, notes/ui-design/morph-figure.md, with the user's change "more arrows from
// more places"): the three prototype cases and two app examples, on screen (t = 0.55 and t = end) and exported
// (single and double column, SVG + PNG rendering), with the checks of morph-figure.md 6.6.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/morphfig_cmd.js
// env: MF_OUT (a directory for the PNG/SVG outputs; default <daemon>/shots), MF_ONLY (comma list of case ids)
const OUT = process.env.MF_OUT || path.join(DIR, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 1500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const CASES = [
  { id: 'cayley', shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }], steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }] },
  { id: 'square', shapes: [{ id: 's1', kind: 'sector', c: [0, 0], r: 1.5, t1: 0, t2: 90 }], steps: [{ type: 'pown', params: { n: 2 }, on: true }] },
  { id: 'exp', shapes: [{ id: 's1', kind: 'rect', a: [-1, 0], b: [1, Math.PI] }], steps: [{ type: 'exp', params: {}, on: true }] },
  { id: 'ex-strip', example: 1 },
  { id: 'ex-jouk', example: 3 },
];
const only = (process.env.MF_ONLY || '').split(',').filter(Boolean);
await view(1440, 900);
for (const cs of CASES) {
  if (only.length && !only.includes(cs.id)) continue;
  const r = R[cs.id] = {};
  if (cs.example != null) {
    await load('morphfig', { pattern: 'checker' });
    await ev(`__cmwExample(${cs.example})`);
  } else {
    await load('morphfig', { shapes: cs.shapes, steps: cs.steps, pattern: 'checker' });
  }
  await settle(1500);
  r.open = await ev('__cmwMorph({ open: true })');
  await ev('__cmwMorph({ T: 1 })');
  await settle(1200);
  // a forced re-choice (the cache dropped), timed, with the long tasks it causes: the choice runs in slices off the
  // frame, so no task may exceed 50 ms (it took 22-146 ms inside one frame before)
  await ev(`window.__mfLT = []; window.__mfPO && __mfPO.disconnect(); window.__mfPO = new PerformanceObserver((l) => { for (const e of l.getEntries()) __mfLT.push(Math.round(e.duration)); }); __mfPO.observe({ type: 'longtask' }); 0`);
  const sel = await ev('await __cmwMorphSel({ force: true })', 60000);
  await sleep(60);
  const lt = await ev('(__mfPO.disconnect(), __mfLT)');
  if (!sel || sel.__exc) { ok(cs.id + ': screen selection', false, sel); continue; }
  r.selMs = +sel.wall.toFixed(1);
  r.selCpuMs = sel.ms ? +(sel.ms.cand + sel.ms.trace + sel.ms.select).toFixed(1) : null;
  r.selLongTasks = lt;
  ok(cs.id + ': the re-choice makes no long task', !lt.some((d) => d > 50), lt);
  // the paths keep clear of the transport bar and the Pattern legend
  const nogo = await ev(`(() => { const r = document.getElementById('overlayR').getBoundingClientRect(); return ['rightFoot', 'rightLegend'].map((id) => document.getElementById(id)).filter((el) => el && !el.hidden && el.offsetParent).map((el) => { const q = el.getBoundingClientRect(); return [q.left - r.left, q.top - r.top, q.right - r.left, q.bottom - r.top]; }); })()`);
  let under = 0;
  for (const k of sel.kept) for (const R of nogo) if ((k.path || [k.start, k.end]).some((p) => p[0] >= R[0] && p[0] <= R[2] && p[1] >= R[1] && p[1] <= R[3])) under++;
  ok(cs.id + ': no path under the transport or the legend', under === 0, under);
  r.screen = { n: sel.n, budget: sel.budget, nCands: sel.nCands, kinds: sel.kept.reduce((a, k) => { a[k.kind] = (a[k.kind] || 0) + 1; return a; }, {}) };
  // paths start at z (t = 0: H_0 = id at stage 0) and end at F(z), to 1e-9 relative. F is the chain's own map
  // (stageF of the end stage), not the homotopy at its end time, so a homotopy that ends at the wrong map fails
  let worst = 0;
  for (const k of sel.kept) {
    const e0 = Math.hypot(k.Ws[0] - k.W0[0], k.Ws[1] - k.W0[1]) / Math.max(1, Math.hypot(k.W0[0], k.W0[1]));
    const e1 = Math.hypot(k.We[0] - k.F[0], k.We[1] - k.F[1]) / Math.max(1, Math.hypot(k.F[0], k.F[1]));
    worst = Math.max(worst, e0, e1);
  }
  r.endErr = worst;
  ok(cs.id + ': path ends are z and F(z)', worst < 1e-9, worst);
  // no head within 6 px of another path's start
  let hs = Infinity;
  for (const a of sel.kept) for (const b of sel.kept) if (a !== b) hs = Math.min(hs, Math.hypot(a.end[0] - b.start[0], a.end[1] - b.start[1]));
  r.minHeadStart = +hs.toFixed(2);
  ok(cs.id + ': no head on a start dot', hs >= 6, hs);
  ok(cs.id + ': more arrows than the old cap', sel.n > 8 || sel.n === sel.nCands, sel.n);
  r.dropped = sel.log.reduce((a, l) => { a[l[3]] = (a[l[3]] || 0) + 1; return a; }, {});
  await shot(`mf-${cs.id}-screen-t1`, { x: 720, y: 0, width: 720, height: 900 });
  await ev('__cmwMorph({ T: 0.55 })');
  await settle(900);
  await shot(`mf-${cs.id}-screen-t055`, { x: 720, y: 0, width: 720, height: 900 });
  // the figure, single and double column, with its caption; unchanged when the scrubber moves (whole deformation)
  for (const w of [3.4, 7]) {
    const fig = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], widthIn: ${w}, caption: true, morph: true }); return f ? { svg: f.svg, W: f.W, H: f.H, cap: f.captionTex, morph: f.morph } : null; })()`, 60000);
    if (!fig || fig.__exc) { ok(`${cs.id}: figure ${w}`, false, fig); continue; }
    const tag = `${cs.id}-${w === 7 ? 'double' : 'single'}`;
    fs.writeFileSync(path.join(OUT, `mf-${tag}.svg`), fig.svg);
    const nHeads = (fig.svg.match(/class="mf-heads">([\s\S]*?)<\/g>/) || ['', ''])[1].split('<path').length - 1;
    ok(`${tag}: one arrowhead per kept path`, nHeads === fig.morph.kept.length, [nHeads, fig.morph.kept.length]);
    // the caption's maths: no inline \\frac (morph-figure.md 5), no X called grey, no TeX lost to the template literal
    ok(`${tag}: no inline \\frac in the caption`, !/\\frac/.test(fig.cap), fig.cap);
    ok(`${tag}: no '(grey)' in the caption`, !/grey/.test(fig.cap), fig.cap);
    r[tag] = { n: fig.morph.kept.length, budget: fig.morph.budget, labelled: fig.morph.labelled, caption: fig.cap, dropped: fig.morph.log.reduce((a, l) => { a[l[3]] = (a[l[3]] || 0) + 1; return a; }, {}) };
    // rasterize for viewing (2x)
    const png = await ev(`await (async () => { const svg = ${JSON.stringify(fig.svg)}; const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode(); const k = 300 / 96; const c = document.createElement('canvas'); c.width = Math.round(${fig.W} * k); c.height = Math.round(${fig.H} * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/png').split(',')[1]; })()`, 60000);
    if (typeof png === 'string') fs.writeFileSync(path.join(OUT, `mf-${tag}.png`), Buffer.from(png, 'base64'));
    if (w === 3.4) {
      await ev('__cmwMorph({ T: 0.2 })');
      const fig2 = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], widthIn: 3.4, caption: true, morph: true }); return f ? f.svg : null; })()`, 60000);
      // (the raster is re-encoded: compare the vector part and the caption)
      const strip = (s) => String(s).replace(/href="data:[^"]+"/g, '');
      ok(`${tag}: unchanged when the scrubber moves`, strip(fig2) === strip(fig.svg), null);
      await ev('__cmwMorph({ T: 0.55 })');
    }
  }
  // Both: (a) X, (b) the deformation, with intact TeX in (b)'s range ("0\\le t\\le 1", not "0le tle 1")
  const both = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['L', 'R'], widthIn: 7, caption: true, morph: true }); return f ? f.captionTex : null; })()`, 60000);
  r.bothCaption = both;
  ok(`${cs.id}: Both caption keeps its TeX`, typeof both === 'string' && /0\\le t\\le/.test(both) && !/0le/.test(both), both);
  // Up to t: the stop is stated once, at sentence level
  await ev('__cmwMorph({ T: 0.55 })');
  const upto = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], widthIn: 3.4, caption: true, morph: true, upTo: true }); return f ? f.captionTex : null; })()`, 60000);
  r.upToCaption = upto;
  ok(`${cs.id}: Up to t states the stop once`, typeof upto === 'string' && (upto.match(/shown for/g) || []).length === 1 && (upto.match(/0\\le t\\le 0\.55/g) || []).length === 1, upto);
  // exported from the dark theme: the figure's vector inks are the light theme's (no dark-theme ink on white)
  await view(1440, 900, true);
  await settle(600);
  const darkInks = await ev(`(() => { const cs = getComputedStyle(document.documentElement); return ['--ink', '--ink-2', '--faint', '--muted'].map((n) => cs.getPropertyValue(n).trim().slice(0, 7).toUpperCase()); })()`);
  const dsvg = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], widthIn: 7, caption: true, morph: true }); return f ? f.svg.replace(/href="data:[^"]+"/g, '') : null; })()`, 60000);
  const hits = darkInks.filter((c) => c && dsvg && dsvg.toUpperCase().includes(c));
  r.darkInkHits = hits;
  ok(`${cs.id}: a dark-theme export has no dark-theme ink`, dsvg && hits.length === 0, { darkInks, hits });
  await view(1440, 900, false);
  await settle(400);
  r.logs = logs().filter((l) => /EXC|error/i.test(l.t)).slice(0, 5);
  await ev('__cmwMorph({ open: false })');
}
return { pass: !fails.length, fails, results: R };
