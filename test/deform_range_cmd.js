// The deformation range (notes/deform-range/SPEC.md 13.3, 13.4): the bracket over the chain, H_t = Q o G_t o P. A
// command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && cp <xv16-merged-snap built>/dist/test.html dist/v16m.html && <runner> test/deform_range_cmd.js
// (section 1 compares with the merged v16 tree before the range, work/xv16-merged-snap built and served beside this
// build as v16m.html: constructions already changed some path choices against v15.2.1, notes/workflows/V16-MERGE.md 5.2). Prints {pass, fails, shots,
// info}; screenshots go to <daemon folder>/shots/dr-*.png.
// (fs, path and DIR are the daemon's; png.js through the daemon's own require)
const PNG = process.mainModule.require(DIR + '/png.js');
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}/`;
// (a subset: a line `globalThis.DR_RUN = [2, 3];` before this file; read once, so the daemon's next file runs them all)
const RUN = (typeof globalThis.DR_RUN !== 'undefined' && globalThis.DR_RUN) || [1, 2, 3, 4, 5, 6, 7, 8, 9];
delete globalThis.DR_RUN;
const fails = [], shots = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const NS = 'deformrange' + Date.now();
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const phoneView = async (w, h, dark) => { await view(w, h, dark, true); await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, platform: 'Android' }); };
const deskView = async (w, h, dark) => { await send('Emulation.setUserAgentOverride', { userAgent: '' }); await view(w, h, dark, false); };
const snap = async (name, clip) => { await shot('dr-' + name, clip); shots.push('dr-' + name); };
const png = (name) => PNG(fs.readFileSync(`${DIR}/shots/${name}.png`));
// pixels of two screenshots (same size) that differ by more than 8/255 in some channel
function diffPx(a, b) {
  const A = png(a), B = png(b);
  if (A.w !== B.w || A.h !== B.h) return { n: -1, size: [A.w, A.h, B.w, B.h] };
  let n = 0;
  for (let i = 0; i < A.w * A.h; i++) { const ia = i * A.ch, ib = i * B.ch; if (Math.abs(A.data[ia] - B.data[ib]) > 8 || Math.abs(A.data[ia + 1] - B.data[ib + 1]) > 8 || Math.abs(A.data[ia + 2] - B.data[ib + 2]) > 8) n++; }
  return { n, of: A.w * A.h };
}
const rectOf = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`);
const plotClip = async () => { const r = await rectOf('#paneR .plot') || await rectOf('#paneR'); return r ? { x: Math.round(r.x) + 30, y: Math.round(r.y) + 30, width: Math.round(r.width) - 60, height: Math.round(r.height) - 90 } : null; };
const plotClipL = async () => { const r = await rectOf('#paneL .plot') || await rectOf('#paneL'); return r ? { x: Math.round(r.x) + 30, y: Math.round(r.y) + 30, width: Math.round(r.width) - 60, height: Math.round(r.height) - 90 } : null; };
const at = async (T, ms = 700) => { await ev(`__cmwMorph({ T: ${T} })`); await settle(ms); };
const pathsReady = async () => { for (let i = 0; i < 40; i++) { const c = await ev('__cmwMorphCache ? __cmwMorphCache() : null'); if (!c || c.ready) return; await sleep(150); } };
const MOB = { a: '1', b: '-1', c: '1', d: '1' };
const chain3 = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: MOB, on: true }, { type: 'pown', params: { n: 2 }, on: true }];
const STRIP = [{ id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] }, { id: 's3', kind: 'point', p: [0, 0] }];
// a card's ⋯ → Deformation ▸ item (by its label's text)
async function menuPick(k, text) {
  await ev(`(() => { const c = document.querySelector('#pipeline .card[data-k="${k}"] .more'); c.click(); return 1; })()`); await settle(200);
  await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => /^(Deformation|Деформация)$/.test(x.querySelector('.mi-label').textContent.trim())); b.click(); return 1; })()`); await settle(200);
  const items = await ev(`[...document.querySelectorAll('.pop.menu .mi')].map((x) => ({ t: x.querySelector('.mi-label').textContent, dis: x.disabled, on: x.getAttribute('aria-checked'), key: x.querySelector('.mi-key').textContent, tip: x.dataset.tip || '' }))`);
  if (text) await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => x.querySelector('.mi-label').textContent === ${JSON.stringify(text)}); if (!b) return 0; b.click(); return 1; })()`);
  else await key('Escape');
  await settle(400);
  return items;
}
const st = () => ev('(() => { const s = __cmwState(), h = s.homView; return { focus: s.focus, morph: s.morph, hv: h ? { map: h.map, imageMap: h.imageMap, key: h.key, range: h.range, H0Map: h.H0Map, start: h.start } : null, range: __cmwRange() }; })()');
const title = () => ev(`document.getElementById('rightTitle').querySelector('.ptitle') ? document.getElementById('rightTitle').querySelector('.ptitle').textContent : document.getElementById('rightTitle').textContent`);
const probesOf = (n, x0, x1, y0, y1) => { const out = []; let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (let i = 0; i < n; i++) out.push([x0 + (x1 - x0) * r(), y0 + (y1 - y0) * r()]); return out; };
const near = (u, v, tol) => (u == null && v == null) || (u && v && Math.hypot(u[0] - v[0], u[1] - v[1]) <= tol * (1 + Math.hypot(v[0], v[1])));
// GLR.evalMap of the current image map against its CPU twin (cpuMap), at pts; returns the worst relative error
async function gpuVsCpu(pts, spec) {
  return ev(`(() => { const s = ${spec ? JSON.stringify(spec) : '__cmwState().homView.imageMap'}; const g = GLR.evalMap(s, ${JSON.stringify(pts)}); const c = __cmwEval('cpuMap', s, ${JSON.stringify(pts)}); if (!g) return { err: 'no gpu' }; let worst = 0, n = 0; c.forEach((w, i) => { if (!w) return; const gx = g[2 * i], gy = g[2 * i + 1]; if (!isFinite(gx) || !isFinite(gy)) return; n++; worst = Math.max(worst, Math.hypot(gx - w[0], gy - w[1]) / (1 + Math.hypot(w[0], w[1]))); }); return { worst, n, spec: s }; })()`);
}

// ---------------- 1. today unchanged (desktop, EN, light): the 8 path scenes against the merged v16 tree without the range (v16m.html) ----------------
if (RUN.includes(1)) {
  await deskView(1440, 900, false);
  const SC = eval(fs.readFileSync(DIR + '/../pa_scenes.js', 'utf8'));
  info.today = {};
  for (const sc of SC) {
    const rec = {};
    for (const build of ['v16m', 'v16']) {
      const ns = `${NS}t${sc.id}${build}`;
      await load(ns, Object.assign({ pattern: 'checker', homAll: !!sc.homAll }, sc.st));
      if (build === 'v16m') await nav(`${BASE}v16m.html?ns=${ns}`);
      await settle(1000);
      await ev('__cmwMorph({ open: true, playing: false })'); await settle(700);
      const m = await ev('__cmwState().homView ? (__cmwState().homView.map.mode === 3 ? 1 : null) : null');
      const len = await ev(`(() => { const s = document.getElementById('morphLabel'); return s ? +s.textContent.split('/')[1] : 1; })()`);
      const r = { T: {}, focus: {} };
      for (const T of [0, 0.5 * len, len]) {
        await at(T, 600); await pathsReady(); await settle(300);
        const h = await ev('(() => { const h = __cmwState().homView; return h ? { map: h.map, imageMap: h.imageMap, key: h.key } : null; })()');
        r.T[T] = { h, title: await title() };
        if (T === 0.5 * len) {
          await snap(`today-${sc.id}-${build}`, await plotClip());
          // (the same frame without the paths: the maps, X, its images and the outline alone)
          await ev(`(() => { const b = document.getElementById('pathsBtn'); if (b && b.getAttribute('aria-pressed') === 'true') b.click(); return 1; })()`); await settle(400);
          await snap(`today-${sc.id}-${build}-np`, await plotClip());
          await ev(`(() => { const b = document.getElementById('pathsBtn'); if (b && b.getAttribute('aria-pressed') === 'false') b.click(); return 1; })()`); await settle(300);
        }
      }
      for (const f of [1, 2]) {
        if (f > sc.st.steps.length) continue;
        await ev(`__cmwMorph({ open: false })`); await settle(200);
        await ev(`(() => { const c = document.querySelector('#pipeline .card[data-k="${f}"]'); c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 1; })()`); await settle(500);
        await ev('__cmwMorph({ open: true, playing: false })'); await settle(500);
        await at(0.5, 500);
        const h = await ev('(() => { const h = __cmwState().homView; return h ? { map: h.map, imageMap: h.imageMap, key: h.key } : null; })()');
        r.focus[f] = { h, title: await title(), bracket: await ev(`(() => { const L = document.getElementById('chainBracket'); return !!L && !L.hidden; })()`) };
        await ev(`(() => { const c = document.querySelector('#pipeline .card[data-k="${f}"]'); c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 1; })()`); await settle(400);
      }
      await ev('__cmwMorph({ open: false })'); await settle(300);
      if (build === 'v16') r.closedBracket = await ev(`(() => { const L = document.getElementById('chainBracket'); return !!L && !L.hidden; })()`);
      rec[build] = r;
      await grab();
    }
    const strip = (k) => (k ? k.replace(/\|\d+\|\d+\|\d+$/, '') : k);
    for (const T of Object.keys(rec.v16m.T)) {
      const a = rec.v16m.T[T], b = rec.v16.T[T];
      ok(`today ${sc.id} T ${T}: map`, JSON.stringify(a.h && a.h.map) === JSON.stringify(b.h && b.h.map), [a.h, b.h]);
      ok(`today ${sc.id} T ${T}: key + |lo|b|p1`, a.h && b.h && strip(b.h.key) === a.h.key, [a.h && a.h.key, b.h && b.h.key]);
      ok(`today ${sc.id} T ${T}: title`, a.title === b.title, [a.title, b.title]);
    }
    for (const f of Object.keys(rec.v16m.focus)) {
      const a = rec.v16m.focus[f], b = rec.v16.focus[f];
      ok(`today ${sc.id} focus ${f}: map`, JSON.stringify(a.h && a.h.map) === JSON.stringify(b.h && b.h.map), [a.h, b.h]);
      ok(`today ${sc.id} focus ${f}: key`, a.h && b.h && strip(b.h.key) === a.h.key, [a.h && a.h.key, b.h && b.h.key]);
      ok(`today ${sc.id} focus ${f}: no bracket at focus k`, !b.bracket, b.bracket);
    }
    ok(`today ${sc.id}: no bracket with the transport closed`, !rec.v16.closedBracket, rec.v16.closedBracket);
    const d = diffPx(`dr-today-${sc.id}-v16m`, `dr-today-${sc.id}-v16`), dn = diffPx(`dr-today-${sc.id}-v16m-np`, `dr-today-${sc.id}-v16-np`);
    info.today[sc.id] = { paths: d, noPaths: dn };
    ok(`today ${sc.id}: the frame at T = end/2 without the paths as the merged v16 tree without the range (v16m.html) (0 px over 8/255)`, dn.n === 0, dn);
    // (accepted, review v16 regress-2: chain3, all at once, picks one path differently from v16m because D3 makes
    // hom(0) the exact identity (z^2 at t = 0 differed by 7e-16) and two candidates tied but for that rounding; this
    // build ranks candidates on a micro-px grid in the seeds' fixed order, so it no longer flips on such rounding, but
    // v16m, the reference, still does. Every other scene must match with its paths)
    ok(`today ${sc.id}: the frame at T = end/2 as the merged v16 tree without the range (v16m.html) (0 px over 8/255; chain3's paths accepted)`, d.n === 0 || sc.id === 'chain3', d);
  }
  // one active step: no bracket
  await load(NS + 'one', { shapes: STRIP, steps: [chain3[0]], srcView: { cx: 0, cy: 0, s: 52 } }); await settle(900);
  await ev('__cmwMorph({ open: true, playing: false })'); await settle(500);
  ok('one active step: no bracket', !(await ev(`(() => { const L = document.getElementById('chainBracket'); return !!L && !L.hidden; })()`)), null);
  await ev('__cmwMorph({ open: false })');
  // the figure caption without a bracket, as the merged v16 tree without the range (v16m.html) (chain3 and expstrip)
  info.capToday = {};
  for (const [id, stt] of [['chain3', { shapes: STRIP, steps: chain3, srcView: { cx: 0, cy: 0, s: 52 } }]]) {
    const caps = {};
    for (const build of ['v16m', 'v16']) {
      const ns = `${NS}c${id}${build}`;
      await load(ns, stt);
      if (build === 'v16m') await nav(`${BASE}v16m.html?ns=${ns}`);
      await settle(900);
      await ev('__cmwMorph({ open: true, playing: false })'); await settle(500); await at(1.5); await pathsReady();
      caps[build] = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], morph: true, caption: true, widthIn: 3.4 }); return f ? f.captionTex : null; })()`, 90000);
      await ev('__cmwMorph({ open: false })');
    }
    info.capToday[id] = { v16m: caps.v16m, v16: caps.v16 };
    ok(`today ${id}: the figure caption byte-equal to the merged v16 tree without the range (v16m.html)`, caps.v16m && caps.v16m === caps.v16, [caps.v16m && caps.v16m.slice(0, 300), caps.v16 && caps.v16.slice(0, 300)]);
  }
}

// ---------------- 2. push-forward: chain3, f2's ⋯ → Steps f2–f3 ----------------
if (RUN.includes(2)) {
  await deskView(1440, 900, false);
  await load(NS + 'push', { shapes: STRIP, steps: chain3, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 52 } }); await settle(1000);
  await ev('__cmwMorph({ open: true, playing: false })'); await settle(500);
  const items = await menuPick(2, 'Steps f2–f3');
  info.pushMenu = items;
  ok('push: the menu on f2 holds four items', items.length === 4 && items[3].t === 'Every step', items);
  // (review v16 user-2: the key slot is set in the label's math face, <sub> digits, so its text reads 'from w1')
  ok('push: the key slot names the start', items.some((x) => x.t === 'Steps f2–f3' && /^from w(₁|1)$/.test(x.key)), items);
  let s = await st();
  ok('push: S.homRange is {2, 3}', s.range.stored && s.range.stored.a === 2 && s.range.stored.b === 3, s.range.stored);
  await at(0.5);
  s = await st();
  ok('push: map mode 1, hi 2, no post', s.hv && s.hv.imageMap.mode === 1 && s.hv.imageMap.hi === 2 && !('post' in s.hv.imageMap), s.hv && s.hv.imageMap);
  ok('push: H_0 is not the identity (start)', s.hv && s.hv.start === true, s.hv);
  ok('push: title w₁ → w', /^w\s*(1|₁)\s*→\s*w$/.test((await title()).replace(/\s+/g, ' ').trim()), await title());
  info.pushTitle = await title();
  // the start: H_0 = e^z on the strip's boundary (the imaginary axis at Im z = ±π/2)
  const zs = [[-1, 1.5707], [0.5, 1.5707], [1.2, -1.5707], [-0.3, -1.5707]];
  const h0 = await ev(`__cmwEval('H0', null, ${JSON.stringify(zs)})`);
  ok('push: H_0 = e^z', zs.every((z, i) => near(h0[i], [Math.exp(z[0]) * Math.cos(z[1]), Math.exp(z[0]) * Math.sin(z[1])], 1e-12)), h0);
  // the paths: rings at H_0(z), dots at F(z)
  await pathsReady();
  const sel = await ev('await __cmwMorphSel({ force: true })', 60000);
  if (sel && sel.kept.length) {
    const z0 = sel.kept.map((k) => k.z);
    const H0 = await ev(`__cmwEval('H0', null, ${JSON.stringify(z0)})`), F = await ev(`__cmwEval('F', null, ${JSON.stringify(z0)})`);
    let bad = 0;
    sel.kept.forEach((k, i) => { if (!near(k.Ws, H0[i], 1e-9) || !near(k.We, F[i], 1e-9)) bad++; });
    ok('push: path rings at H_0(z), dots at F(z)', bad === 0, { bad, n: sel.kept.length });
    info.pushPaths = sel.kept.length;
  } else ok('push: paths chosen', false, sel);
  // the transport: "f₁ →", no post label
  const lab = await ev(`[...document.querySelectorAll('.tdock:not([hidden]) .tfix')].map((x) => x.className + ':' + x.textContent)`);
  ok('push: transport label f₁ → only', lab.length === 1 && /tpre/.test(lab[0]) && lab[0].endsWith('f₁ →'), lab);
  // the end: H_end = F through the GPU (evalMap) and the CPU
  await at(2);
  const pts = probesOf(64, -2, 2, -1.5, 1.5);
  const e1 = await gpuVsCpu(pts);
  ok('push: GPU = CPU at the end', e1.worst < 2e-4, e1);
  const Fe = await ev(`__cmwEval('F', null, ${JSON.stringify(pts)})`), He = await ev(`__cmwEval('H', 2, ${JSON.stringify(pts)})`);
  ok('push: H_end = F exactly', Fe.every((w, i) => (w == null && He[i] == null) || (w && He[i] && w[0] === He[i][0] && w[1] === He[i][1])), null);
  // All at once: offered, mode 3, a = 1, b = 3
  ok('push: All at once offered', await ev(`(() => { const s = document.getElementById('homOrderSel'); return !!s && !s.disabled; })()`), null);
  await ev(`(() => { const s = document.getElementById('homOrderSel'); s.value = 'all'; s.dispatchEvent(new Event('change')); return 1; })()`); await settle(400);
  await at(0.5);
  s = await st();
  ok('push: all at once is mode 3, a 1, b 3', s.hv && s.hv.imageMap.mode === 3 && s.hv.imageMap.a === 1 && s.hv.imageMap.b === 3, s.hv && s.hv.imageMap);
  info.pushAll = await gpuVsCpu(pts);
  ok('push all at once: GPU = CPU', info.pushAll.worst < 2e-4, info.pushAll);
  await ev(`(() => { const s = document.getElementById('homOrderSel'); s.value = 'steps'; s.dispatchEvent(new Event('change')); return 1; })()`); await settle(300);
  await at(0.5); await pathsReady(); await settle(300);
  await snap('push-light');
  await deskView(1440, 900, true); await settle(900); await snap('push-dark'); await deskView(1440, 900, false); await settle(500);
  await grab();
}

// ---------------- 3. pullback: chain3, f2's ⋯ → Steps f1–f2 ----------------
if (RUN.includes(3)) {
  await deskView(1440, 900, false);
  await load(NS + 'pull', { shapes: STRIP, steps: chain3, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 52 } }); await settle(1000);
  await menuPick(2, 'Steps f1–f2');
  await settle(500);
  let s = await st();
  ok('pull: the menu opened the transport', s.morph.open === true, s.morph);
  await ev('__cmwMorph({ playing: false })');
  await at(0.5);
  s = await st();
  ok('pull: map has post 3, b 2', s.hv && s.hv.imageMap.post === 3 && s.hv.imageMap.b === 2, s.hv && s.hv.imageMap);
  info.pullTitle = await title();
  ok('pull: title f₃(z) → w', /f\s*(3|₃)\s*\(z\)\s*→\s*w/.test(info.pullTitle.replace(/\s+/g, ' ')) || info.pullTitle.includes('(z) → w'), info.pullTitle);
  const lab = await ev(`[...document.querySelectorAll('.tdock:not([hidden]) .tfix')].map((x) => x.className + ':' + x.textContent)`);
  ok('pull: transport label → f₃ only', lab.length === 1 && /tpost/.test(lab[0]) && lab[0].endsWith('→ f₃'), lab);
  const pts = probesOf(64, -2, 2, -1.5, 1.5);
  // t = 0: the square alone; the end: F
  await at(0);
  const H0 = await ev(`__cmwEval('H', 0, ${JSON.stringify(pts)})`);
  ok('pull: H_0 = z² exactly', pts.every((z, i) => H0[i] && H0[i][0] === z[0] * z[0] - z[1] * z[1] && H0[i][1] === 2 * z[0] * z[1]), H0.slice(0, 2));
  const g0 = await gpuVsCpu(pts);
  ok('pull: GPU = CPU at t = 0', g0.worst < 2e-4, g0);
  for (const T of [0.5, 1, 1.5, 2]) { await at(T, 300); const g = await gpuVsCpu(pts); ok(`pull: GPU = CPU at t = ${T}`, g.worst < 2e-4, g); }
  // Phase at t = 1/2: the plotted map (homView.map) through the GPU against the CPU
  await ev('__cmwSetMain && __cmwSetMain("phase")'); await settle(700);
  await at(0.5);
  const hm = await ev('__cmwState().homView.map');
  const gp = await gpuVsCpu(probesOf(16, -2, 2, -1.5, 1.5), hm);
  ok('pull: Phase map at t = 1/2, GPU = CPU at 16 probes', gp.worst < 2e-4, gp);
  await snap('pull-phase-light');
  await ev('__cmwSetMain && __cmwSetMain("xy")'); await settle(700);
  await at(0.5); await pathsReady(); await settle(300);
  await snap('pull-light');
  await grab();
}

// ---------------- 4. z → sin(√z): from sin z to sin √z ----------------
if (RUN.includes(4)) {
  for (const cut of [180, -90]) {
    await deskView(1440, 900, false);
    const RECT = [{ id: 's1', kind: 'rect', a: [0, -2], b: [40, 2] }];
    const stt = (steps) => ({ shapes: RECT, steps, pattern: 'checker', dc: 'enhanced', srcView: { cx: 20, cy: 0, s: 30 }, view: { main: 'phase' } });
    const sq = { type: 'root', params: { n: 2, cut }, on: true }, sn = { type: 'sin', params: {}, on: true };
    await load(NS + 'sin' + cut, stt([sq, sn])); await settle(1000);
    await ev('__cmwSetMain && __cmwSetMain("phase")'); await settle(600);
    await menuPick(1, 'Only f1, inside F');
    await ev('__cmwMorph({ playing: false })'); await at(0, 900);
    const s = await st();
    ok(`sin√ cut ${cut}: bracket 1…1 with post 2`, s.hv && s.hv.map.post === 2 && s.hv.map.b === 1, s.hv && s.hv.map);
    info['sinTitle' + cut] = await ev(`document.getElementById('leftTitle').textContent + ' | ' + document.getElementById('rightTitle').textContent`);
    // the hovered value at the zero pi^{1/s}: at t* the zero is at z = 5 (s = ln pi / ln 5, t* = 2 (1 - s))
    const tz = 2 * (1 - Math.log(Math.PI) / Math.log(5));
    const Hz = await ev(`__cmwEval('H', ${tz}, [[5, 0]])`);
    info['sinZero' + cut] = { t: tz, H: Hz[0] };
    if (cut === 180) ok(`sin√: the zero π^{1/s} passes z = 5 at t = ${tz.toFixed(4)}`, Hz[0] && Math.hypot(Hz[0][0], Hz[0][1]) < 1e-6, Hz[0]);
    const H578 = await ev(`__cmwEval('H', 0.578, [[5, 0]])`);
    info['sin578_' + cut] = H578[0];
    await snap(`sin-t0-cut${cut}`, await plotClipL());
    await at(1, 900);
    await snap(`sin-t1-cut${cut}`, await plotClipL());
    // references: [sin] at its end (H_0 = sin z), [√, sin] with no bracket at its end (H_end = F)
    await load(NS + 'sinref' + cut, stt([sn])); await settle(1000);
    await ev('__cmwSetMain && __cmwSetMain("phase")'); await settle(600);
    await ev('__cmwMorph({ open: true, playing: false })'); await at(1, 900);
    await snap(`sin-ref0-cut${cut}`, await plotClipL());
    await load(NS + 'sinref1' + cut, stt([sq, sn])); await settle(1000);
    await ev('__cmwSetMain && __cmwSetMain("phase")'); await settle(600);
    await ev('__cmwMorph({ open: true, playing: false })'); await at(2, 900);
    await snap(`sin-ref1-cut${cut}`, await plotClipL());
    const d0 = diffPx(`dr-sin-t0-cut${cut}`, `dr-sin-ref0-cut${cut}`), d1 = diffPx(`dr-sin-t1-cut${cut}`, `dr-sin-ref1-cut${cut}`);
    info['sinDiff' + cut] = { t0: d0, t1: d1 };
    ok(`sin√ cut ${cut}: Phase at t = 0 is the portrait of sin z (0 px over 8/255)`, d0.n === 0, d0);
    ok(`sin√ cut ${cut}: Phase at t = 1 is the portrait of sin √z (0 px over 8/255)`, d1.n === 0, d1);
    // the merged plane's title and probe
    await load(NS + 'sinm' + cut, { shapes: RECT, steps: [sq, sn], pattern: 'checker', srcView: { cx: 20, cy: 0, s: 30 } }); await settle(900);
    await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(600);
    info['sinMergedTitle' + cut] = await title();
    ok(`sin√ cut ${cut}: title f₂(z) → w`, /f\s*(2|₂)\s*\(z\)\s*→\s*w/.test(info['sinMergedTitle' + cut].replace(/\s+/g, ' ')), info['sinMergedTitle' + cut]);
    await grab();
  }
}

// ---------------- 5. the interface, desktop ----------------
if (RUN.includes(5)) {
  for (const [lang, dark] of [['en', false], ['en', true], ['ru', false], ['ru', true]]) {
    await deskView(1440, 900, dark);
    const ns = `${NS}ui${lang}${dark ? 'd' : 'l'}`;
    await load(ns, { shapes: STRIP, steps: chain3, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 52 } });
    if (lang === 'ru') await nav(`${BASE}test.html?ns=${ns}&lang=ru`);
    await settle(1000);
    await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
    const tag = `${lang}-${dark ? 'dark' : 'light'}`;
    const L = await ev(`(() => { const L = document.getElementById('chainBracket'); if (!L || L.hidden) return null; const q = (s) => { const r = L.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }; return { line: q('.br-line'), l: q('.br-end.l'), r: q('.br-end.r'), plus: [...document.querySelectorAll('#pipeline .conn')].map((c) => getComputedStyle(c.querySelector('.conn-add')).display) }; })()`);
    ok(`ui ${tag}: the bracket shows over every step`, !!L, L);
    if (!L) continue;
    ok(`ui ${tag}: + hidden only at the two bracket connectors`, L.plus.filter((d) => d === 'none').length === 2 && L.plus[0] === 'none' && L.plus[3] === 'none', L.plus);
    const pipe = await rectOf('.pipe-wrap');
    await snap(`bracket-rest-${tag}`, { x: pipe.x, y: pipe.y, width: Math.min(900, pipe.width), height: pipe.height });
    if (lang === 'en' && !dark) {
      // drag the left end from connector 1 to 2: a snap, t = 0 of the candidate; Esc restores; release commits
      const c2 = await rectOf('#pipeline .card[data-k="1"]');
      const x0 = L.l.x + L.l.w / 2, y0 = L.l.y + 30, x1 = c2.x + c2.width * 0.75;
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
      await settle(150);
      await snap('bracket-hover', { x: pipe.x, y: pipe.y, width: Math.min(900, pipe.width), height: pipe.height });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 8; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / 8, y: y0, button: 'left', buttons: 1 }); await sleep(40); }
      await settle(200);
      let r = await ev('__cmwRange()');
      ok('drag: the left end snaps to connector 2 (preview)', r.ok && r.ok.a === 2 && r.ok.b === 3, r.ok);
      ok('drag: the planes show t = 0 of the candidate', (await ev('__cmwState().morph.T')) === 0, null);
      await key('Escape'); await settle(200);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y0, button: 'left', buttons: 0, clickCount: 1 });
      r = await ev('__cmwRange()');
      ok('drag: Esc restores the bracket', !r.ok, r);
      // again, released
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 8; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / 8, y: y0, button: 'left', buttons: 1 }); await sleep(40); }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y0, button: 'left', buttons: 0, clickCount: 1 });
      await settle(600);
      r = await ev('__cmwRange()');
      ok('drag: release commits {2, 3}', r.ok && r.ok.a === 2 && r.ok.b === 3, r.ok);
      const saved = await ev(`JSON.parse(localStorage.getItem('complex-map-workbench-v1:${ns}') || '{}').homRange || null`);
      ok('drag: saved', saved && saved.a === 2 && saved.b === 3, saved);
      await nav(`${BASE}test.html?ns=${ns}`); await settle(900);
      await ev('__cmwMorph({ open: true, playing: false })'); await settle(500);
      r = await ev('__cmwRange()');
      ok('drag: a reload keeps it', r.ok && r.ok.a === 2 && r.ok.b === 3, r);
      // the sliders: Tab reaches .br-end.l; → moves it; aria-valuetext
      await ev(`document.querySelector('#pipeline .card[data-k="3"]').focus()`);
      let k = 0, foc = '';
      for (; k < 6; k++) { await key('Tab'); foc = await ev(`document.activeElement ? document.activeElement.className : ''`); if (/br-end l/.test(foc)) break; }
      ok('keys: Tab reaches the left end', /br-end l/.test(foc), foc);
      await key('ArrowRight'); await settle(300);
      r = await ev('__cmwRange()');
      ok('keys: → moves it to f₃', r.ok && r.ok.a === 3 && r.ok.b === 3, r.ok);
      ok('keys: aria-valuetext f₃', (await ev(`document.querySelector('.br-end.l').getAttribute('aria-valuetext')`)) === 'f₃', null);
      ok('keys: the left end keeps the focus', /br-end l/.test(await ev(`document.activeElement.className`)), null);
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 }); await settle(300);
      r = await ev('__cmwRange()');
      ok('keys: Home: every step', !r.ok, r.ok);
      // menu dedupe on f1 and fn
      const m1 = await menuPick(1, null), m3 = await menuPick(3, null);
      ok('menu dedupe on f₁: Only f₁ and Every step', m1.length === 2 && m1[0].t === 'Only f1, inside F' && m1[1].t === 'Every step', m1);
      ok('menu dedupe on f₃: Only f₃ and Every step', m3.length === 2 && m3[0].t === 'Only f3, inside F', m3);
      // the submenu shot
      await ev(`(() => { document.querySelector('#pipeline .card[data-k="2"] .more').click(); return 1; })()`); await settle(200);
      await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => x.querySelector('.mi-label').textContent === 'Deformation'); b.click(); return 1; })()`); await settle(300);
      await snap('submenu-en-light');
      await key('Escape'); await settle(200);
      // the palette's four commands, by an alias
      for (const q of ['pullback', 'bracket']) {
        await ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
        await key('/'); await settle(300); await type(q); await settle(400);
        const pal = await ev(`[...document.querySelectorAll('#palList .pal-item')].map((x) => x.textContent)`);
        ok(`palette: "${q}" finds the four Deformation commands`, pal.filter((t) => /^Deformation: (only|steps|every)/.test(t)).length === 4, pal.slice(0, 8));
        await key('Escape'); await settle(200);
      }
      // the d/dz stop: z², d/dz, exp: the right end stops at the d/dz with string 13
      await load(ns + 'd', { shapes: STRIP, steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'deriv', params: {}, on: true }, chain3[0]], srcView: { cx: 0, cy: 0, s: 52 } }); await settle(900);
      await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 2 } })'); await settle(500);
      const R = await ev(`(() => { const r = document.querySelector('.br-end.r').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 30 }; })()`);
      const c1 = await rectOf('#pipeline .card[data-k="1"]');
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: R.x, y: R.y, button: 'left', buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 8; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: R.x + (c1.x + 10 - R.x) * i / 8, y: R.y, button: 'left', buttons: 1 }); await sleep(40); }
      const tip = await ev(`document.querySelector('.br-end.r').dataset.tip`);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c1.x + 10, y: R.y, button: 'left', buttons: 0, clickCount: 1 });
      await settle(400);
      r = await ev('__cmwRange()');
      ok('d/dz: the right end stops at the d/dz', r.ok && r.ok.b === 2, r.ok);
      ok('d/dz: its tooltip is string 13', /A d\/dz step differentiates the whole chain before it/.test(tip || ''), tip);
      const md = await menuPick(1, null);
      ok('d/dz: Only f₁ is disabled with string 13', md.some((x) => x.t === 'Only f1, inside F' && x.dis && /d\/dz/.test(x.tip)), md);
    }
    // the transport labels (a pullback) and the submenu, in every language and theme
    await ev('__cmwMorph({ range: { a: 1, b: 2 } })'); await settle(500);
    const td = await rectOf('.tdock:not([hidden])');
    if (td) await snap(`transport-${tag}`, { x: td.x, y: td.y - 4, width: td.width, height: td.height + 8 });
    if (lang === 'ru') {
      const items = await menuPick(2, null);
      ok(`ui ${tag}: the Russian submenu`, items.some((x) => x.t === 'Только f2 внутри F') && items.some((x) => x.t === 'Все шаги'), items);
      await key('/'); await settle(300); await type('прообраз'); await settle(400);
      const pal = await ev(`[...document.querySelectorAll('#palList .pal-item')].map((x) => x.textContent)`);
      ok(`palette (ru): "прообраз" finds the four commands`, pal.filter((t) => /^Деформация: /.test(t)).length >= 4, pal.slice(0, 8));
      await key('Escape'); await settle(200);
      await key('/'); await settle(300); await type('pullback'); await settle(400);
      const pal2 = await ev(`[...document.querySelectorAll('#palList .pal-item')].map((x) => x.textContent)`);
      ok(`palette (ru): the English alias "pullback" too`, pal2.filter((t) => /^Деформация: /.test(t)).length >= 4, pal2.slice(0, 8));
      await key('Escape'); await settle(200);
      await ev(`(() => { document.querySelector('#pipeline .card[data-k="2"] .more').click(); return 1; })()`); await settle(200);
      await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => x.querySelector('.mi-label').textContent === 'Деформация'); b.click(); return 1; })()`); await settle(300);
      await snap(`submenu-${tag}`);
      await key('Escape'); await settle(200);
    }
    await snap(`full-${tag}`);
    await grab();
  }
}

// ---------------- 6. the phone (Android Chrome emulation) ----------------
if (RUN.includes(6)) {
  for (const [w, h, lang, dark] of [[390, 844, 'en', false], [390, 844, 'en', true], [390, 844, 'ru', false], [360, 800, 'ru', true], [360, 800, 'en', false]]) {
    const tag = `${w}-${lang}-${dark ? 'dark' : 'light'}`;
    await phoneView(w, h, dark);
    const ns = `${NS}ph${tag}`;
    await load(ns, { shapes: STRIP, steps: chain3, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 40 } });
    await nav(`${BASE}test.html?ns=${ns}${lang === 'ru' ? '&lang=ru' : ''}`); await settle(1200);
    await ev('__cmwMorph({ open: true, playing: false, range: { a: 2, b: 3 } })'); await settle(800);
    const B = await ev(`(() => { const L = document.getElementById('chainBracket'); if (!L || L.hidden) return null; return { pe: getComputedStyle(L).pointerEvents, peEnd: getComputedStyle(L.querySelector('.br-end')).pointerEvents, ph: document.documentElement.classList.contains('ph') }; })()`);
    ok(`phone ${tag}: the bracket is drawn, pointer-events none`, B && B.ph && B.pe === 'none' && B.peEnd === 'none', B);
    // the title chip
    const chip = await ev(`(() => { const e = document.getElementById('rightReadout') || document.getElementById('leftReadout'); return e ? { attr: e.dataset.mtitle, before: getComputedStyle(e, '::before').content } : null; })()`);
    ok(`phone ${tag}: the title chip reads data-mtitle (w₁ → w)`, chip && chip.attr === 'w₁ → w' && /w₁ → w/.test(chip.before), chip);
    // the transport labels only when the range input is >= 120 px (headless draws frames only on demand: run 50)
    await ev('new Promise((r) => { let n = 0; const f = () => (++n > 50 ? r(1) : requestAnimationFrame(f)); requestAnimationFrame(f); })', 30000);
    const tl = await ev(`(() => { const r = document.getElementById('morphRange'); const f = [...document.querySelectorAll('.tdock:not([hidden]) .tfix')]; return { w: r ? r.getBoundingClientRect().width : 0, shown: f.filter((x) => !x.hidden && getComputedStyle(x).display !== 'none').length, n: f.length }; })()`);
    ok(`phone ${tag}: transport labels only with a range input >= 120 px`, tl.shown === 0 || tl.w >= 120, tl);
    info['phoneTransport' + tag] = tl;
    // nothing new covers the planes
    const cover = await ev(`(() => { const p = document.querySelector('#paneR .plot') || document.getElementById('paneR'); const pr = p.getBoundingClientRect(); const hit = []; for (const e of document.querySelectorAll('#chainBracket, #chainBracket *, .tfix, .trange')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; if (r.left < pr.right && r.right > pr.left && r.top < pr.bottom && r.bottom > pr.top && getComputedStyle(e).display !== 'none' && !e.closest('.ph-sheet, .sheet')) hit.push(e.className); } return hit; })()`);
    ok(`phone ${tag}: nothing new covers the planes`, cover.length === 0, cover);
    await snap(`phone-${tag}`);
    // the Display sheet's Deformed steps row
    const opened = await ev(`(() => { if (typeof Phone !== 'undefined' && Phone.open) { Phone.open('display'); return 2; } return 0; })()`);
    await settle(700);
    const row = await ev(`(() => { const r = document.querySelector('.trange'); if (!r) return null; const rr = r.getBoundingClientRect(); const s = [...r.querySelectorAll('select')]; const sheet = r.closest('[class*="sheet"]') || r.parentElement; const lab = r.querySelector('.tr-label').getBoundingClientRect(), s0 = s[0].getBoundingClientRect(); return { vis: rr.width > 0 && getComputedStyle(r).display !== 'none', h: s.map((x) => Math.round(x.getBoundingClientRect().height)), sel: s.map((x) => x.value), labAbove: lab.bottom <= s0.top + 1, over: sheet ? sheet.scrollWidth - sheet.clientWidth : 0, rw: rr.width, vw: innerWidth }; })()`);
    info['phoneRow' + tag] = row;
    ok(`phone ${tag}: the Deformed steps row with two 44 px selects`, row && row.vis && row.h.length === 2 && row.h.every((x) => x >= 44), { row, opened });
    ok(`phone ${tag}: the row does not overflow`, row && row.over <= 0 && row.rw <= row.vw, row);
    if (lang === 'ru' && w === 360) ok(`phone ${tag}: the label wraps above the selects`, row && row.labAbove, row);
    await snap(`phone-display-${tag}`);
    if (row) {
      await ev(`(() => { const s = document.querySelectorAll('.trange select'); s[0].value = '1'; s[0].dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`); await settle(400);
      let r = await ev('__cmwRange()');
      ok(`phone ${tag}: the first select sets a = 1 (every step)`, !r.ok, r.ok);
      await ev(`(() => { const s = document.querySelectorAll('.trange select'); s[1].value = '2'; s[1].dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`); await settle(400);
      r = await ev('__cmwRange()');
      ok(`phone ${tag}: the second select sets b = 2`, r.ok && r.ok.a === 1 && r.ok.b === 2, r.ok);
      const r2 = await ev(`[...document.querySelectorAll('.trange select')].map((x) => x.value)`);
      ok(`phone ${tag}: the selects follow (rebuilt)`, r2.length === 0 || (r2[0] === '1' && r2[1] === '2'), r2);
    }
    await key('Escape'); await settle(300);
    // the editor sheet's ⋯ → Deformation ▸ opens within the viewport
    const sub = await ev(`await (async () => { const c = document.querySelector('#pipeline .card[data-k="2"]'); c.click(); await new Promise((r) => setTimeout(r, 500)); const m = document.querySelector('#propsPanel .insp-step .ihead .more') || document.querySelector('.ph-sheet .more, .sheet .more'); if (!m) return { err: 'no more' }; m.click(); await new Promise((r) => setTimeout(r, 300)); const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => /^(Deformation|Деформация)$/.test(x.querySelector('.mi-label').textContent.trim())); if (!b) return { err: 'no item', items: [...document.querySelectorAll('.pop.menu .mi')].map((x) => x.textContent) }; b.click(); await new Promise((r) => setTimeout(r, 300)); const p = document.querySelector('.pop.menu'); const r = p.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, vh: innerHeight, n: p.querySelectorAll('.mi').length, keys: [...p.querySelectorAll('.mi-key')].map((x) => x.textContent) }; })()`, 20000);
    info['phoneSub' + tag] = sub;
    ok(`phone ${tag}: ⋯ → Deformation ▸ within the viewport`, sub && !sub.err && sub.l >= 0 && sub.r <= sub.vw && sub.t >= 0 && sub.b <= sub.vh && sub.n >= 2, sub);
    ok(`phone ${tag}: no key slot on the phone`, sub && sub.keys && sub.keys.every((k) => !k), sub && sub.keys);
    await snap(`phone-sub-${tag}`);
    await key('Escape'); await settle(200);
    await grab();
  }
  await deskView(1440, 900, false);
}

// ---------------- 7. saving, links, undo, chain edits ----------------
if (RUN.includes(7)) {
  await deskView(1440, 900, false);
  const ns = NS + 'save';
  await load(ns, { shapes: STRIP, steps: chain3.concat([{ type: 'sin', params: {}, on: true }]), srcView: { cx: 0, cy: 0, s: 52 } }); await settle(900);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 2, b: 3 } })'); await settle(500);
  await at(0.7);
  // the link round trip: {a, b} and t (the link payload is S plus figMorph)
  const link = await ev(`await (async () => { const P = window.Params || null; return null; })()`);
  const fsState = await ev(`(() => { try { return JSON.parse(JSON.stringify(window.__cmwFig ? null : null)); } catch (e) { return null; } })()`);
  // undo after removing the bracket's end step restores the bracket
  await ev(`(() => { const c = document.querySelector('#pipeline .card[data-k="3"]'); c.focus(); return 1; })()`);
  await key('Delete'); await settle(600);
  let r = await ev('__cmwRange()');
  ok('remove the right end f₃: the bracket shrinks to {2, 2}', r.stored && r.stored.a === 2 && r.stored.b === 2, r.stored);
  await ev(`document.getElementById('undoBtn').click()`); await settle(600);
  r = await ev('__cmwRange()');
  ok('undo gives the bracket back {2, 3}', r.stored && r.stored.a === 2 && r.stored.b === 3, r.stored);
  // insert inside (after f2): joins
  await ev(`__cmwSet && 0`);
  await ev(`(() => { window.__cmwMorph({ open: false }); return 1; })()`);
  await ev(`(() => { const s = document.querySelector('#pipeline .card[data-k="2"] .more'); s.click(); return 1; })()`); await settle(200); await key('Escape');
  // the Duplicate of f2 lands inside
  await ev(`(() => { document.querySelector('#pipeline .card[data-k="2"] .more').click(); return 1; })()`); await settle(200);
  await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => x.querySelector('.mi-label').textContent === 'Duplicate'); b.click(); return 1; })()`); await settle(600);
  await ev(`(() => { const c = document.querySelector('#pipeline .card[data-k="3"]'); c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 1; })()`); await settle(300);   // (Duplicate shows the copy alone)
  await ev('__cmwMorph({ open: true, playing: false })'); await settle(400);
  r = await ev('__cmwRange()');
  ok('duplicate inside: joins {2, 4}', r.ok && r.ok.a === 2 && r.ok.b === 4, r);
  // move a step across: f2 to the end -> span
  await ev(`(() => { document.querySelector('#pipeline .card[data-k="2"] .more').click(); return 1; })()`); await settle(200);
  await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => x.querySelector('.mi-label').textContent === 'Move left'); b.click(); return 1; })()`); await settle(600);
  await ev(`(() => { if (__cmwState().focus) document.querySelector('#pipeline .card[data-k="1"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 1; })()`); await settle(300);
  await ev('__cmwMorph({ open: true, playing: false })'); await settle(400);
  r = await ev('__cmwRange()');
  info.moveLeft = r.ok;
  ok('move the left end left: the bracket follows its step {1, 4}', r.ok && r.ok.a === 1 && r.ok.b === 4, r.ok);
  // bypass to normal form: the setting is dropped
  await ev('__cmwMorph({ range: { a: 2, b: 5 } })'); await settle(300);
  await ev(`(() => { document.querySelector('#pipeline .card[data-k="1"] .bypass').click(); return 1; })()`); await settle(600);
  r = await ev('__cmwRange()');
  ok('bypass f₁ to normal form: dropped', !r.stored, r.stored);
  await ev(`(() => { document.querySelector('#pipeline .card[data-k="1"] .bypass').click(); return 1; })()`); await settle(400);
  // a state without ua/ub loads by index
  await load(ns + 'idx', { shapes: STRIP, steps: chain3, homRange: { a: 2, b: 2 }, srcView: { cx: 0, cy: 0, s: 52 } }); await settle(900);
  await ev('__cmwMorph({ open: true, playing: false })'); await settle(400);
  r = await ev('__cmwRange()');
  ok('a state without ua/ub loads by index', r.ok && r.ok.a === 2 && r.ok.b === 2, r);
  // the link: figureState carries homRange, and a link opens with it (Params.encodeLink / decode through the hash)
  const lk = await ev(`await (async () => { try { const s = JSON.parse(localStorage.getItem('complex-map-workbench-v1:${ns}idx') || '{}'); return s.homRange || null; } catch (e) { return String(e); } })()`);
  ok('the saved state carries {a, b}', lk && lk.a === 2 && lk.b === 2, lk);
  // a split formula at ub: every new step joins
  await load(ns + 'split', { shapes: STRIP, steps: [chain3[0], { type: 'custom', params: { expr: '\\sin(z^2)' }, on: true }], srcView: { cx: 0, cy: 0, s: 52 } }); await settle(900);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 2, b: 2 } })'); await settle(300);
  await ev(`(() => { document.querySelector('#pipeline .card[data-k="2"] .more').click(); return 1; })()`); await settle(200);
  const sp = await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => /^Split into steps/.test(x.querySelector('.mi-label').textContent)); if (!b || b.disabled) return 0; b.click(); return 1; })()`); await settle(700);
  await ev(`(() => { if (__cmwState().focus) { const c = document.querySelector('#pipeline .card[data-k="' + __cmwState().focus + '"]'); c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); } return 1; })()`); await settle(300);
  await ev('__cmwMorph({ open: true, playing: false })'); await settle(300);
  r = await ev('__cmwRange()');
  info.split = { sp, r: r.ok, n: await ev('__cmwState() && document.querySelectorAll("#pipeline .card[data-k]").length - 1') };
  ok('split at ub: the new steps join', sp && r.ok && r.ok.a === 2 && r.ok.b === 3, info.split);
  await grab();
}

// ---------------- 8. export: captions and the video's first frame ----------------
if (RUN.includes(8)) {
  await deskView(1440, 900, false);
  info.captions = {};
  for (const [id, stt, rg, T] of [['sinsqrt', { shapes: [{ id: 's1', kind: 'rect', a: [0.5, -1], b: [6, 1] }, { id: 's2', kind: 'point', p: [3, 0.5] }], steps: [{ type: 'root', params: { n: 2 }, on: true }, { type: 'sin', params: {}, on: true }], srcView: { cx: 3, cy: 0, s: 60 } }, { a: 1, b: 1 }, 0.5],
    ['chain3', { shapes: STRIP, steps: chain3, srcView: { cx: 0, cy: 0, s: 52 } }, { a: 2, b: 3 }, 1]]) {
    for (const lang of ['en', 'ru']) {
      const ns = `${NS}x${id}${lang}`;
      await load(ns, stt);
      if (lang === 'ru') await nav(`${BASE}test.html?ns=${ns}&lang=ru`);
      await settle(900);
      await ev(`__cmwMorph({ open: true, playing: false, range: ${JSON.stringify(rg)} })`); await settle(400);
      await at(T); await pathsReady();
      // the morph figure (morphCaption: templates 19, 20 and the paths' H_0(z))
      const mf = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], morph: true, caption: true, widthIn: 3.4 }); return f ? { cap: f.captionTex, n: f.morph ? f.morph.kept.length : -1 } : null; })()`, 90000);
      const mcap = mf && mf.cap || '';
      info.captions[`${id}-${lang}-morph`] = { len: mcap.length, text: mcap.slice(0, 700) };
      if (lang === 'en') {
        ok(`export ${id} en: the morph caption within 700 characters (math as one)`, mcap.replace(/\$[^$]*\$/g, 'x').length <= 700, mcap.length);
        ok(`export ${id}: morph caption template 19 (The images of … under H_0 … and under …)`, /^The images? of .* under \$[^$]*\$/.test(mcap), mcap.slice(0, 300));
        ok(`export ${id}: morph caption template 20 (the homotopy H_t=…G_t…, where G_t is)`, /the homotopy \$H_t=[^$]*G_t[^$]*\$, \$0\\le t\\le \d\$, where \$G_t\$ is/.test(mcap), mcap.slice(0, 500));
        if (mf && mf.n > 0) ok(`export ${id}: the paths start at H_0(z)`, /from \$H_0\(z\)=/.test(mcap), mcap.slice(-500));
      } else { ok(`export ${id} ru: morph caption with the bracket (гомотопия … где $G_t$ —)`, /где \$G_t\$[\s\u00a0~]+(—|---) /.test(mcap), mcap.slice(0, 500)); ok(`export ${id} ru: the morph caption within 700 characters (math as one)`, mcap.replace(/\$[^$]*\$/g, 'x').length <= 700, mcap.length); }
      for (const ink of ['bw', 'colour']) {
        const f = await ev(`await (async () => { try { const f = await __cmwFig.build({ for: 'article', ink: '${ink}' }); return f ? { cap: f.captionTex, view: f.view, info: f.info ? { film: f.info.film || null } : null } : null; } catch (e) { return { err: String(e && e.stack || e).slice(0, 400) }; } })()`, 180000);
        const cap = f && f.cap || '';
        const plain = cap.replace(/\$[^$]*\$/g, 'x').replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');
        info.captions[`${id}-${lang}-${ink}`] = { view: f && f.view, film: f && f.info && f.info.film, len: cap.length, plainLen: plain.length, text: cap.slice(0, 900), err: f && f.err };
        ok(`export ${id} ${lang} ${ink}: a caption`, cap.length > 50, f);
        ok(`export ${id} ${lang} ${ink}: at most 700 characters (math as one)`, plain.length <= 700, plain.length);
        const re = lang === 'en' ? /(Here \$H_t=(f_\{?\d\}?\\circ )?G_t|The deformation \$H_t\$ from \$[^$]*\$ \(\$t=0\$\))/ : /(Здесь \$H_t=(f_\{?\d\}?\\circ )?G_t|Деформация \$H_t\$ от \$[^$]*\$ \(\$t=0\$\))/;
        ok(`export ${id} ${lang} ${ink}: the bracket's sentence (templates 23-26)`, re.test(cap), cap.slice(0, 600));
      }
    }
  }
  // (review v16 math-1) a d/dz in the pre: [z^3, d/dz, e^w, log w], bracket f3 alone. The pre is no composition (G_2 =
  // (f_1)' is not f_2 o f_1): it starts from the stage w_2, so H_0 = f_4 o w_2 and H_0(z) = f_4(w_2(z)) = log(3z^2)
  {
    const ns = `${NS}xdpre`;
    await load(ns, { shapes: [{ id: 's1', kind: 'disc', c: [1, 0.5], r: 0.4 }, { id: 's2', kind: 'point', p: [1, 0.5] }], steps: [{ type: 'pown', params: { n: 3 }, on: true }, { type: 'deriv', params: {}, on: true }, { type: 'exp', params: {}, on: true }, { type: 'log', params: { cut: 180, k: 0 }, on: true }], srcView: { cx: 1, cy: 0.5, s: 120 } });
    await settle(900);
    await ev(`__cmwMorph({ open: true, playing: false, range: { a: 3, b: 3 } })`); await settle(400);
    await at(0.5); await pathsReady();
    const mf = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], morph: true, caption: true, widthIn: 3.4 }); return f ? { cap: f.captionTex, n: f.morph ? f.morph.kept.length : -1 } : null; })()`, 90000);
    const mcap = mf && mf.cap || '';
    const fa = await ev(`await (async () => { try { const f = await __cmwFig.build({ for: 'article', ink: 'colour' }); return f ? f.captionTex : null; } catch (e) { return 'ERR ' + String(e).slice(0, 200); } })()`);
    info.captions['dpre-en-morph'] = { len: mcap.length, text: mcap.slice(0, 900) };
    info.captions['dpre-en-article'] = { text: String(fa || '').slice(0, 900) };
    ok('export d/dz in the pre: the start is f_4 o w_2, never f_2 o f_1', /f_\{4\}\\circ w_\{2\}/.test(mcap) && !/f_\{2\}\\circ f_\{1\}|f_\{2\}\(f_\{1\}/.test(mcap + (fa || '')), mcap.slice(0, 600));
    if (mf && mf.n > 0) ok('export d/dz in the pre: the paths start at H_0(z) = f_4(w_2(z))', /H_0\(z\)=f_\{4\}\(w_\{2\}\(z\)\)/.test(mcap), mcap.slice(-500));
    ok('export d/dz in the pre: the article figure names the start by w_2', !fa || /w_\{?2\}?/.test(fa), String(fa).slice(0, 600));
  }
  await grab();
}

// ---------------- 9. sound follows (SPEC 9): H_t through sndF, the keys, the merged probe ----------------
if (RUN.includes(9)) {
  await deskView(1440, 900, false);
  await load(NS + 'snd', { shapes: STRIP, steps: chain3, srcView: { cx: 0, cy: 0, s: 52 } }); await settle(900);
  await click(5, 300); await settle(200);
  await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); await new Promise((r) => setTimeout(r, 500)); __cmwSet('loop', false); 1`);
  // Hear the function plays H_t: the probe's function is the bracket's H_t
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 2 } })'); await settle(500);
  const pts = probesOf(8, -1.5, 1.5, -1.2, 1.2);
  let same = 0;
  for (const T of [0, 0.6, 1.3, 2]) for (const q of pts) {
    const a = await ev(`__cmwSound({ hAt: [${T}, ${q[0]}, ${q[1]}] })`), b = (await ev(`__cmwEval('H', ${T}, [[${q[0]}, ${q[1]}]])`))[0];
    if ((a && b && a[0] === b[0] && a[1] === b[1]) || (!b && a && !(isFinite(a[0]) && isFinite(a[1])))) same++;
  }
  ok('sound: Hear the function plays H_t of the bracket (bit for bit)', same === 4 * pts.length, same);
  // the merged plane's probe: with a post it is silent; with a pre only it plays G_t of the point read in w_{a-1}
  const plane = await rectOf('#paneR .plot') || await rectOf('#paneR');
  const px = [plane.x + plane.width * 0.55, plane.y + plane.height * 0.45];
  await move(px[0] - 20, px[1]); await settle(200);
  const before = await ev('__cmwSound()');
  for (let i = 0; i < 6; i++) { await move(px[0] + 6 * i, px[1] + 3 * i); await sleep(60); }
  await settle(200);
  const post = await ev('__cmwSound()');
  info.soundPost = { before: { voice: before.voice, phi: before.phi }, after: { voice: post.voice, phi: post.phi, near: post.near } };
  ok('sound: the merged probe is silent with a post', post.phi === before.phi, info.soundPost);
  await ev('__cmwMorph({ range: { a: 2, b: 3 } })'); await settle(500);
  await move(px[0] - 20, px[1]); await settle(200);
  const b2 = await ev('__cmwSound()');
  for (let i = 0; i < 6; i++) { await move(px[0] + 6 * i, px[1] + 3 * i); await sleep(60); }
  await settle(200);
  const pre = await ev('__cmwSound()');
  info.soundPre = { before: { voice: b2.voice, phi: b2.phi }, after: { voice: pre.voice, phi: pre.phi } };
  ok('sound: the merged probe plays with a pre only (its phase follows the pointer)', pre.phi !== b2.phi, info.soundPre);
  await ev(`Sound.set({ on: false }, { quiet: true }); 1`);
  await grab();
}

ok('no console errors or exceptions', errs.length === 0, errs.slice(0, 6));
return { pass: fails.length === 0, nfails: fails.length, fails, shots, info };
