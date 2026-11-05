// The deformation range (notes/deform-range/SPEC.md 13.3, 13.4): H_t = Q o G_t o P, set by its test hook (__cmwMorph), in
// the classic views: today's paths unchanged without a range, z → sin(√z), the export's captions and the sound. The thread's
// range in the steps view is steps_play_cmd.js's; the engine's is test/t_deform_range.js. A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && cp <xv16-merged-snap built>/dist/test.html dist/v16m.html && <runner> test/deform_range_cmd.js
// (section 1 compares with the merged v16 tree before the range, work/xv16-merged-snap built and served beside this
// build as v16m.html: constructions already changed some path choices against v15.2.1, notes/workflows/V16-MERGE.md 5.2). Prints {pass, fails, shots,
// info}; screenshots go to <daemon folder>/shots/dr-*.png.
// (fs, path and DIR are the daemon's; png.js through the daemon's own require)
const PNG = process.mainModule.require(DIR + '/png.js');
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}/`;
// (a subset: a line `globalThis.DR_RUN = [4, 8];` before this file; read once, so the daemon's next file runs them all)
const RUN = (typeof globalThis.DR_RUN !== 'undefined' && globalThis.DR_RUN) || [1, 4, 8, 9];
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
const st = () => ev('(() => { const s = __cmwState(), h = s.homView; return { focus: s.focus, morph: s.morph, hv: h ? { map: h.map, imageMap: h.imageMap, key: h.key, range: h.range, H0Map: h.H0Map, start: h.start } : null, range: __cmwRange() }; })()');
// (v16.5 UX103: the deformation's title is in words, "Deformation" + "from A to B", where it read "A → B" + "deformation":
// read as "A → B" so the maps it names are compared with the reference build as before)
const title = () => ev(`(() => { const R = document.getElementById('rightTitle'), t = R.querySelector('.ptitle'); if (!t) return R.textContent; const tt = t.textContent.trim(), ro = R.querySelector('.prole'); const m = /^(Deformation|Деформация|Deforming .+|Деформируются .+)$/.test(tt) && ro ? /^(?:from|от)\\s+(.+?)\\s+(?:to|к|до)\\s+(.+)$/.exec(ro.textContent.trim()) : null; return m ? m[1] + ' → ' + m[2] : t.textContent; })()`);
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
      // (v16.5 UX20: Y's key and its options bar left the picture for the pane head, so the paths' starts may use the
      // room they kept free (mfNogo): in the reference build they are taken off the plot before the deformation opens,
      // so both builds choose their paths in the same free plot)
      if (build === 'v16m') await ev(`(() => { for (const id of ['rightLegend', 'rightFoot']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } return 1; })()`);
      await ev('__cmwMorph({ open: true, playing: false })'); await settle(700);
      const m = await ev('__cmwState().homView ? (__cmwState().homView.map.mode === 3 ? 1 : null) : null');
      const len = await ev(`(() => { const s = document.getElementById('morphRange'); return s ? +s.max || 1 : 1; })()`);   // (v16.5 UX103: the readout is in words; the scrubber's max is the length)
      const r = { T: {} };
      for (const T of [0, 0.5 * len, len]) {
        await at(T, 600); await pathsReady(); await settle(300);
        const h = await ev('(() => { const h = __cmwState().homView; return h ? { map: h.map, imageMap: h.imageMap, key: h.key } : null; })()');
        r.T[T] = { h, title: await title() };
        if (T === 0.5 * len) {
          // (v16.5 UX20: the plane's key left the picture for Y's pane head; the reference build's key box over the plot
          // is hidden for the shot, so the frames compare the maths drawing alone)
          if (build === 'v16m') await ev(`(() => { for (const id of ['leftLegend', 'rightLegend']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } return 1; })()`);
          await snap(`today-${sc.id}-${build}`, await plotClip());
          // (the same frame without the paths: the maps, X, its images and the outline alone)
          await ev(`(() => { const b = document.getElementById('pathsBtn'); if (b && b.getAttribute('aria-pressed') === 'true') b.click(); return 1; })()`); await settle(400);
          await snap(`today-${sc.id}-${build}-np`, await plotClip());
          await ev(`(() => { const b = document.getElementById('pathsBtn'); if (b && b.getAttribute('aria-pressed') === 'false') b.click(); return 1; })()`); await settle(300);
        }
      }
      await ev('__cmwMorph({ open: false })'); await settle(300);
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
    const d = diffPx(`dr-today-${sc.id}-v16m`, `dr-today-${sc.id}-v16`), dn = diffPx(`dr-today-${sc.id}-v16m-np`, `dr-today-${sc.id}-v16-np`);
    info.today[sc.id] = { paths: d, noPaths: dn };
    ok(`today ${sc.id}: the frame at T = end/2 without the paths as the merged v16 tree without the range (v16m.html) (0 px over 8/255)`, dn.n === 0, dn);
    // (accepted, review v16 regress-2: chain3, all at once, picks one path differently from v16m because D3 makes
    // hom(0) the exact identity (z^2 at t = 0 differed by 7e-16) and two candidates tied but for that rounding; this
    // build ranks candidates on a micro-px grid in the seeds' fixed order, so it no longer flips on such rounding, but
    // v16m, the reference, still does. Every other scene must match with its paths)
    ok(`today ${sc.id}: the frame at T = end/2 as the merged v16 tree without the range (v16m.html) (0 px over 8/255; chain3's paths accepted)`, d.n === 0 || sc.id === 'chain3', d);
  }
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

// ---------------- 4. z → sin(√z): from sin z to sin √z ----------------
if (RUN.includes(4)) {
  for (const cut of [180, -90]) {
    await deskView(1440, 900, false);
    const RECT = [{ id: 's1', kind: 'rect', a: [0, -2], b: [40, 2] }];
    const stt = (steps) => ({ shapes: RECT, steps, pattern: 'checker', dc: 'enhanced', srcView: { cx: 20, cy: 0, s: 30 }, view: { main: 'phase' } });
    const sq = { type: 'root', params: { n: 2, cut }, on: true }, sn = { type: 'sin', params: {}, on: true };
    await load(NS + 'sin' + cut, stt([sq, sn])); await settle(1000);
    await ev('__cmwSetMain && __cmwSetMain("phase")'); await settle(600);
    await ev(`__cmwMorph({ range: { a: 1, b: 1 }, open: true })`); await settle(400);
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
