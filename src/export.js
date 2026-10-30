'use strict';
// Export and captions (issue #20, phase 3: moved out of app.js): plane images and the LaTeX of the map with its
// guarantees, article figures, the captions (as segments and as LaTeX), and the figure export's renderer and the state
// it reads (src/figure.js; notes/export-design/AS-BUILT.md). The app hands it what it needs once, Export.init(api) at
// start-up (src/app/13-export-captions.js, exportApi): its functions and constants as they are, and the state it
// reassigns (S, selected, ...) as getters on api, read as A.S and so on. Figure.attach and the state the rest of the app
// reads too (mfFigCache, artLandBox) stay the app's.
const Export = (() => {
  let A = null;
  let BADGES, cauchyKind, C, EX, PATHS, PHASE, V, activeSteps, copyFigureLink, copyText, enOf, exLabel, exactTexF, flushLabels,
    focusDeriv, hov, inkCache, inlineFrac, isDeriv, keyHex, keyRGB, kindType, lColor, lFlat, lGlobe, lLand,
    lPaintsF, lPhase, lPlain, leftStage, leftView, mfFigCache, morph, morphCaption, morphFigureLayers,
    morphHasDeriv, morphHomSegs, morphLen, morphOn, morphRange, nSteps, openMenu, pathOf, pathsGen, patternCell,
    pickScene, rGlobe, rImage, readTheme, refineAllNow, renderLeft, renderRight, requestRender, rightStage,
    runGenSliced, saveScene, shapeTexOf, sheetsClause, sheetsShown, sheetsTexP, sm, smDropExport, smOn,
    smPrepareExport, sndError, sndExportDone, sphN, stageMap, texSegs, toast, wDefSegs, wvar, setOpt;
  // ---- export: plane images (PNG) and the map with its guarantees (LaTeX) ----
  // Files go through the viewer's downloads capability in claude.ai (the viewer confirms each save); a copy of the
  // page opened on its own saves with a plain download link.
  let dlNs = null, dlAsked = null, dlDone = false;
  function getDownloads() {
    if (!window.claude || typeof window.claude.use !== 'function') { dlDone = true; dlNs = 'local'; return Promise.resolve('local'); }
    if (!dlAsked) dlAsked = window.claude.use('downloads').then((d) => { dlNs = d; dlDone = true; return d; }).catch(() => { dlDone = true; return null; });
    return dlAsked;
  }
  async function saveFile(filename, data) {
    const d = await getDownloads();
    if (d === 'local') {
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob), a = h('a', { href: url, download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(matchMedia('(pointer: coarse)').matches ? $t('Saved to Downloads: {filename}', { filename }) : $t('Saved {filename}.', { filename }));
      sndExportDone();
      return true;
    }
    // true only when the file was saved (or handed to the browser's download): a declined or refused save is false, so
    // the export dialog never says "Saved" for it
    if (!d) { sndError(); toast($t('Saving files is not available in this view.')); return false; }
    try {
      const r = await d.save({ filename, data });
      if (r && r.status === 'saved') { toast($t('Saved {filename}.', { filename })); sndExportDone(); return true; }
      return false;
    } catch (e) {
      const code = e && e.code;
      if (code === 'declined') return false;
      sndError();
      toast(code === 'rate_limited' ? $t('Another save is still waiting for your answer.') : $t('The file could not be saved in this view.'));
      return false;
    }
  }
  // ---- article figures ----
  // A figure as a journal would print it: each plane re-rendered at print resolution in the light theme and placed
  // in a thin frame with inward ticks; tick numbers, axis titles, panel letters and the caption typeset by MathJax
  // in the TeX fonts (as vector paths, so the SVG and PDF need no fonts); a colour bar where colour carries a value;
  // a caption written from the chain (regions, the map, the shading, the natural domain, the guarantees). Sizes are
  // set for the printed width: 1 unit = 1/96 in, so text is 8 to 9 pt at 100 %.
  const FIG_DPI = 300;
  const PT = 96 / 72;                  // px per point
  const mjCache = new Map();
  // TeX as a MathJax SVG (vector paths): {markup, w, h, va} at font size px; null without MathJax
  function mj(tex, px, color = '#000') {
    const key = `${px}|${color}|${tex}`;
    if (mjCache.has(key)) return mjCache.get(key);
    const MJ = window.MathJax;
    let out = null;
    if (tex && MJ && typeof MJ.tex2svg === 'function') {
      try {
        const node = MJ.tex2svg(I18N.notation(tex), { display: false });
        const svg = node && node.querySelector('svg');
        if (svg) {
          const ex = px * 0.431;
          const w = parseFloat(svg.getAttribute('width')) * ex, hh = parseFloat(svg.getAttribute('height')) * ex;
          const va = (parseFloat(String(svg.style.verticalAlign || '0').replace('ex', '')) || 0) * ex;
          svg.setAttribute('width', w.toFixed(3)); svg.setAttribute('height', hh.toFixed(3));
          svg.removeAttribute('style'); svg.removeAttribute('role'); svg.removeAttribute('focusable');
          // glyphs are filled paths: a zero-width stroke prints as a hairline in PDF viewers (text looks bold)
          let markup = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, color).replace(/\sstroke="[^"]*"/g, ' stroke="none"').replace(/\sstroke-width="[^"]*"/g, '');
          if (!/^<svg[^>]*\sxmlns="/.test(markup)) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
          if (w > 0 && hh > 0) out = { markup, w, h: hh, va };
        }
      } catch (e) { out = null; }
    }
    if (!out) {
      // without MathJax: the TeX source as plain serif text (rare: MathJax loads with the page)
      const t = String(tex).replace(/\\(operatorname|text|mathrm|textbf)\{([^}]*)\}/g, '$2').replace(/[{}\\]/g, '').replace(/\^/g, '').replace(/_/g, '');
      const w = t.length * px * 0.5, hh = px * 1.2;
      out = { markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}"><text x="0" y="${px}" font-family="Times New Roman, Times, serif" font-style="italic" font-size="${px}" fill="${color}">${t.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</text></svg>`, w, h: hh, va: -px * 0.2 };
    }
    if (mjCache.size > 2000) mjCache.clear();
    mjCache.set(key, out);
    return out;
  }
  // place a typeset item with its baseline at (x, y); anchor: 'start' | 'middle' | 'end'
  function mjAt(it, x, y, anchor = 'start') {
    const left = anchor === 'middle' ? x - it.w / 2 : anchor === 'end' ? x - it.w : x;
    const top = y - it.h - it.va;
    return it.markup.replace('<svg', `<svg x="${left.toFixed(2)}" y="${top.toFixed(2)}"`);
  }
  // SPEC 10.6: prepareExport(panels, alive) -> true when the export may draw, false when it was cancelled (alive()
  // turned false: an option changed or the dialog closed). Asynchronous and time-sliced: it refines the lines and
  // waits (bounded, polling every 25 ms, never blocking) for the inverse programs that each panel's current view draws
  // with: the right plane or the w-globe (role R), the left plane at a focused stage or the z-globe (role L, also at
  // stage 0), so renderOff then draws exact images synchronously. P5: dims {pw (figure px per panel), dpr}: the
  // SphereMesh jobs of the flat panels' forward shapes at the export's resolution (smPrepareExport).
  async function prepareExport(panels, alive = () => true, morphFig = false, dims = null) {
    // the lines' settle-time refinement, if it has not landed yet (a figure never carries today's samples)
    try { if (!(await refineAllNow(alive))) return false; } catch (e) { console.error('line refinement', e); }
    if (!alive()) return false;
    if (dims && smOn()) {
      const panes = [];
      for (const side of panels) {
        const real = side === 'L' ? A.paneL : A.paneR, v = side === 'L' ? leftView() : V.right;
        if (side === 'R' ? !rImage() || (morphOn() && !morphFig) : !(lPlain() && leftStage() > 0)) continue;
        const k = dims.pw / effW(side), ov = dims.views && dims.views[side], ph = ov ? ov.ph : dims.pw * real.h / effW(side);
        panes.push({ role: side, map: stageMap(side === 'R' ? rightStage() : leftStage()), pane: { view: ov ? { cx: ov.cx, cy: ov.cy, s: ov.s } : { cx: v.cx, cy: v.cy, s: v.s * k }, dpr: dims.dpr, pw: Math.max(1, Math.round(dims.pw * dims.dpr)), ph: Math.max(1, Math.round(ph * dims.dpr)) } });
      }
      try { if (!(await smPrepareExport(panes, alive, dims.gen || 0))) return false; } catch (e) { console.error('SphereMesh export', e); }
    }
    if (!GLR.ok || !GLR.inverseRequest || A.S.exactImages === false) return warmExport(panels, alive, morphFig);
    const kinds = new Set();
    const need = (role, kind, map) => {
      if (!PHASE[role][kind]) return;
      if (A.S.shapes.some((s) => s.visible !== false && kindType(s) === 'area' && pathOf(s, map, role, kind, { status: true }).path === 'pending')) kinds.add(kind);
    };
    // (the deformation figure draws the region at t = end: the stage map, exact; morph-figure.md 6.4)
    if (panels.includes('R') && (!morphOn() || morphFig)) need('R', rGlobe() ? 'globe' : 'flat', stageMap(rightStage()));
    if (panels.includes('L') && (lPlain() || (lGlobe() && !lPhase()))) need('L', lGlobe() ? 'globe' : 'flat', stageMap(leftStage()));
    const t0 = performance.now();
    while (kinds.size && performance.now() - t0 < 4000) {
      if (!alive()) return false;
      if (![...kinds].map((k) => GLR.inverseRequest(A.S.alpha, k)).includes('pending')) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    return alive() && warmExport(panels, alive, morphFig);
  }
  // (issue #72) renderOff links the forward programs it lacks synchronously (syncPrograms), and a cold link on
  // Direct3D 11 takes seconds: the tab froze. So the panels are first drawn small with nothing waiting (renderOff's
  // warm), the deformation's map modes started too, and the programs are awaited here, polled, while the export's
  // progress shows; renderOff then finds them linked (or links the odd one still missing). Awaited: the ones this
  // warm-up started and the current chain's; not the others compiling meanwhile (the idle warm-up's, the gallery's).
  async function warmExport(panels, alive, morphFig) {
    if (!GLR.ok || !GLR.pending) return true;
    const before = new Set(GLR.pending().map((p) => p.id));
    try {
      for (const side of panels) renderOff(side, 48, 32, 1, true);
      if (morphOn() || morphFig) GLR.prestartModes(A.S.homAll ? [3] : [1]);
    } catch (e) { console.error('export warm-up', e); return alive(); }
    const key = GLR.chainKey;
    const need = new Set(GLR.pending().filter((p) => !before.has(p.id) || p.key === key).map((p) => p.id));
    while (!GLR.lost && GLR.pending().some((p) => need.has(p.id))) {   // (a lost context drops its links)
      if (!alive()) return false;
      await new Promise((r) => setTimeout(r, 25));
    }
    return alive();
  }
  // a canvas as a PNG data URL, encoded off the main thread (toBlob), so a 300 dpi raster does not block the page
  function canvasURL(cv) {
    return new Promise((res, rej) => {
      try {
        cv.toBlob((b) => {
          if (!b) { try { res(cv.toDataURL('image/png')); } catch (e) { rej(e); } return; }
          const fr = new FileReader();
          fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error);
          fr.readAsDataURL(b);
        }, 'image/png');
      } catch (e) { rej(e); }
    });
  }
  // a pane's CSS width for the export: a pane hidden by a merged view (merged-views.md) takes the width it has in the
  // split view, half of the wide panel beside the gutter
  function effW(side) {
    const real = side === 'L' ? A.paneL : A.paneR, other = side === 'L' ? A.paneR : A.paneL;
    return real.w > 20 || !(other.w > 20) ? real.w : Math.max(1, (other.w - 8) / 2);
  }
  // a plane drawn off-screen at print size: views scaled so the same window shows; selection, hover and probe off
  // warm: a draw only to start the programs it needs, in the background (prepareExport); nothing waits for them
  function renderOff(side, w, h, dpr, warm = false) {
    const cv = document.createElement('canvas'), ov = document.createElement('canvas');
    const off = new Pane(cv, ov);
    off.w = w; off.h = h; off.dpr = dpr;
    cv.width = ov.width = Math.max(1, Math.round(w * dpr)); cv.height = ov.height = Math.max(1, Math.round(h * dpr));
    const k = w / effW(side);
    const scaled = new Map();
    for (const v of [A.S.srcView, V.left, V.right]) if (v && !scaled.has(v)) { scaled.set(v, v.s); v.s *= k; }
    // (the outline of the left view in the image is a screen aid, not part of a figure; so is the colour key under the
    // Y plane (the Key switch): a figure's Y panel would carry colours its caption and key do not explain)
    const keep = { L: A.paneL, R: A.paneR, probe: A.probe, rHover: A.rHover, selected: A.selected, hoverShape: A.hoverShape, draft: A.draft, hw: hov.w, hl: hov.list, fov: A.S.fov, wKey: A.S.wKey };
    A.probe = null; A.rHover = null; A.selected = null; A.hoverShape = null; A.draft = null; hov.w = null; hov.list = null; setOpt('fov', false); setOpt('wKey', false); A.figMode = true;
    // numbers drawn inside the plot (landscape axes, labels) in the serif of the figure, not the app's monospace
    const mono = A.TH.mono; A.TH.mono = A.TH.math;
    // exact images (SPEC 10.6): prepareExport has waited for the inverse programs; one still compiling (normally
    // none) is waited for here, and only then
    const wait = !warm && GLR.ok && GLR.inverseStatus && (GLR.inverseStatus(A.S.alpha, 'flat') === 'pending' || GLR.inverseStatus(A.S.alpha, 'globe') === 'pending');
    // the forward programs are always waited for: a deformation frame may need a map mode the screen never drew
    // (gl.js MAP compiles one program per mode), and a static program's first use no longer waits on screen
    const waitFwd = !warm && GLR.ok;
    A.offRender = true;
    if (wait) GLR.syncCompile = true;
    if (waitFwd) GLR.syncPrograms = true;
    try {
      if (side === 'L') { A.paneL = off; renderLeft(); } else { A.paneR = off; renderRight(); }
      // labels are placed in a microtask on screen; here they are needed before the pixels are read
      if (off.labels) flushLabels(off, off.labels);
    } finally {
      if (wait) GLR.syncCompile = false;
      if (waitFwd) GLR.syncPrograms = false;
      A.offRender = false;
      A.paneL = keep.L; A.paneR = keep.R;
      for (const [v, s] of scaled) v.s = s;
      A.probe = keep.probe; A.rHover = keep.rHover; A.selected = keep.selected; A.hoverShape = keep.hoverShape; A.draft = keep.draft; hov.w = keep.hw; hov.list = keep.hl; setOpt('fov', keep.fov); setOpt('wKey', keep.wKey); A.figMode = false; A.TH.mono = mono;
    }
    return cv;
  }
  // the world window a plane panel shows at width w (figure px)
  function panelBox(side, w, h) {
    const v = side === 'L' ? leftView() : V.right;
    const s = v.s * w / effW(side);
    return { x0: v.cx - w / 2 / s, x1: v.cx + w / 2 / s, y0: v.cy - h / 2 / s, y1: v.cy + h / 2 / s };
  }
  // export takes each pane's view (U-b): a plane panel is X Plane (with or without Phase) or Y Plane
  const isPlanePanel = (side) => (side === 'L' ? lFlat() : rImage());
  // the variable of a panel's coordinates, in TeX
  function panelVar(side) {
    if (side === 'L') return leftStage() === 0 ? 'z' : `w_{${leftStage()}}`;
    // (the plane Y rests on while ‹ › have it on a step's, #383, is that step's: w_j)
    return A.S.focus === 0 && rightStage() === nSteps() ? 'w' : `w_{${rightStage()}}`;
  }
  // a tick number in TeX: as few decimals as the step needs; powers of ten far from 1
  function tickTex(v, step) {
    if (Math.abs(v) < step * 1e-9) return '0';
    const av = Math.abs(v);
    if (av >= 1e5 || step < 1e-4) {
      const e = Math.floor(Math.log10(av)), m = v / 10 ** e;
      const ms = (+m.toFixed(Math.max(0, Math.min(6, e - Math.floor(Math.log10(step)))))).toString();
      return ms === '1' ? `10^{${e}}` : ms === '-1' ? `-10^{${e}}` : `${ms}\\times 10^{${e}}`;
    }
    const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    let t = v.toFixed(Math.min(dec, 8));
    if (t.includes('.')) t = t.replace(/\.?0+$/, '');
    return t;
  }
  // the colour key of a panel, when colour carries a value: arg F (phase), the stretch factor (Image, Stretch)
  function panelKey(side) {
    const stopsFrom = (f) => Array.from({ length: 25 }, (_, i) => [i / 24, f(i / 24)]);
    const hueAt = (t) => keyHex((2 * t - 1) * Math.PI); // t in [0, 1] -> arg from -pi to pi, colours of the legend wheel
    const Fn = side === 'L' && morphOn() && lPaintsF() ? 'H_t' : A.S.focus === 0 ? 'F' : focusDeriv() ? `w_{${A.S.focus}}` : `f_{${A.S.focus}}`;
    if (side === 'L' && lColor() && A.S.dc !== 'classic') return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.25, '-\\frac{\\pi}{2}'], [0.5, '0'], [0.75, '\\frac{\\pi}{2}'], [1, '\\pi']] };
    if (side === 'L' && lColor()) return { title: `|${Fn}|`, stops: [[0, '#000000'], [0.5, '#8a8f93'], [1, '#ffffff']], ticks: [[0, '0'], [0.5, '1'], [1, '\\infty']] };
    if (side === 'R' && rImage() && A.S.pattern === 'stretch') return { title: `|${Fn}'|`, stops: [[0, A.TH.stretchShrink], [0.5, A.TH.stretchMid], [1, A.TH.stretchGrow]], ticks: [[0, '\\tfrac18'], [0.5, '1'], [1, '8']] };
    if (side === 'L' && lGlobe() && lPhase()) return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.5, '0'], [1, '\\pi']] };
    if (side === 'L' && lLand() && lPhase()) return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.5, '0'], [1, '\\pi']] };
    return null;
  }
  // ---- the caption, as segments: {t: text} and {m: TeX}; also as LaTeX source ----
  const texEsc = (s) => String(s).replace(/\\/g, '\\textbackslash{}').replace(/([#$%&_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
  // a caption sentence as segments: the template is translated whole (DESIGN.md 1) and its %{slots} hold segments,
  // so the word order follows the language. cs 'gen': the genitive form ("the images of ...", Russian needs the case)
  // (a plain-string value joins the text around it, as one segment)
  const capT = (src, params, cs) => {
    const out = [];
    for (let x of I18N.parts(src, params, cs)) {
      if (typeof x === 'string' || typeof x === 'number') { x = String(x); if (!x) continue; const l = out[out.length - 1]; if (l && l._s) l.t += x; else out.push({ t: x, _s: 1 }); } else out.push(...(Array.isArray(x) ? x : [x]));
    }
    return out.map((g) => (g._s ? { t: g.t } : g));
  };
  function shapePhrase(s, idx, cs) {
    let tex = '';
    try { tex = shapeTexOf(s); } catch (e) { tex = ''; }
    // a drawn area is a closed set (Region.isOpen, spec 6.5: only open boundaries are drawn dashed), so its caption
    // says so: the disc |z| <= 2, and its complement |z| > 2 is the open set. Typed formulas keep their own relations
    if (tex && kindType(s) === 'area' && s.kind !== 'formula') tex = tex.replace(/</g, '\\le ').replace(/>/g, '\\ge ');
    // inline maths as journals set it: plain bars and a slashed fraction, not \left|...\right| or a stacked \frac
    if (tex) tex = inlineFrac(tex.replace(/\\left\|/g, '|').replace(/\\right\|/g, '|').replace(/\\left\(/g, '(').replace(/\\right\)/g, ')')).replace(/\\tfrac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');
    const P = (a) => CX.tex(C(a[0], a[1]), 3);
    const M = (m) => ({ m });
    // (phrase(c): the shape in case c; the complement names its shape in the genitive: «дополнение круга», math-4)
    const phrase = (c) => {
      const sp = (src, params) => capT(src, params, c);
      // (v16: constructions by their definitions; [v16.4 review user-2, user-3] a phrase that must be closed when more text
      // follows (a Russian participial phrase, a stacked "in the domain") ends with a closing comma, {pc}: pcTidy drops it
      // before punctuation and at the end)
      if (s.def || s.at) { const ph = Construct.phrase(s, P); if (ph) { const r = sp(ph.src, ph.params); if (ph.close) r.push({ t: ',', pc: 1 }); return r; } }
      // a shape added from an equation, as recognized: by its equation
      if (s.srcTex && tex === s.srcTex && s.kind !== 'point') {
        switch (s.kind) {
          case 'line': return sp('the line %{m}', { m: M(tex) });
          case 'ray': return sp('the ray %{m}', { m: M(tex) });
          case 'segment': return sp('the segment %{m}', { m: M(tex) });
          case 'circle': return sp('the circle %{m}', { m: M(tex) });
          case 'arc': return sp('the arc %{m}', { m: M(tex) });
          case 'fcurve': return sp('the curve formula %{m}', { m: M(tex) });
          default: return sp('the %{kind} %{m}', { kind: Region.KINDS[s.kind].label.toLowerCase(), m: M(tex) });
        }
      }
      switch (s.kind) {
        case 'point': {
          // (a label that is a word, "trailing edge", is set as text, not as a product of italic letters)
          // a name that is a word: "the trailing edge $z=1$", not a symbol "$\\text{trailing edge}=1$"
          if (s.label && (I18N.lang === 'en' ? /[A-Za-z]{2}|\s/ : /\p{L}{2}|\s/u).test(exLabel(s.label))) return sp('the %{label} %{m}', { label: String(exLabel(s.label)).trim(), m: M(`z=${P(s.p)}`) });
          const lab = s.label ? s.label.replace(/₀/g, '_0').replace(/₁/g, '_1').replace(/₂/g, '_2') : `z_{${idx}}`;
          return sp('the point %{m}', { m: M(`${lab}=${P(s.p)}`) });
        }
        case 'segment': return sp('the segment %{m}', { m: M(`[${P(s.a)},\\,${P(s.b)}]`) });
        // (a line stored from a cap on a globe has a unit direction and is written by its equation, Region normalTex)
        // (v16 review picture-7: "\text{…}" in any language is the line-through form: by its two points, never as maths)
        case 'line': return tex && !/^\\text\{/.test(tex) ? sp('the line %{m}', { m: M(tex) }) : sp('the line through %{a} and %{b}', { a: M(P(s.a)), b: M(P(s.b)) });
        case 'ray': return sp('the ray from %{a} through %{b}', { a: M(P(s.a)), b: M(P(s.b)) });
        case 'circle': return sp('the circle %{m}', { m: M(tex) });
        case 'arc': return sp('the arc from %{a} through %{m} to %{b}', { a: M(P(s.a)), m: M(P(s.m)), b: M(P(s.b)) });
        case 'curve': return sp('a freehand curve', {});
        case 'disc': return sp('the disc %{m}', { m: M(tex) });
        case 'rect': return sp('the rectangle %{m}', { m: M(tex) });
        // (the genitive has no plural pair of its own: $tn takes no context; 'вершинами' is right for every n but 21, 31, ...)
        case 'polygon': return [{ t: c === 'gen' ? $tx('gen', 'a polygon with {n} vertices', { n: s.pts.length }) : $tn('a polygon with {n} vertices', 'a polygon with {n} vertices', s.pts.length) }];
        case 'halfplane': return sp('the half-plane %{m}', { m: M(tex) });
        case 'annulus': return sp('the annulus %{m}', { m: M(tex) });
        case 'sector': return capT('the sector %{m}', { m: M(tex) }, s.r > 0 ? c : c === 'gen' ? 'gen-angle' : 'angle');
        case 'formula': return sp('the set %{m}', { m: M(tex) });
        case 'fcurve': return sp('the curve %{m}', { m: M(tex) });
        // (the grid's name is a translated \text{} at the front of its TeX: review math-3)
        case 'cgrid': return sp('a Cartesian grid on %{m}', { m: M(tex.replace(/^\\text\{[^{}]*\}\s*/, '')) });
        case 'pgrid': return sp('a polar grid in %{m}', { m: M(tex.replace(/^\\text\{[^{}]*\},\s*/, '')) });
        // ([issue #260] by their equations: arg Φ_M(z) = 2π·θ, |Φ_M(z)| = r)
        case 'dhray': return sp('the external ray %{m}', { m: M(tex) });
        case 'dheq': return sp('the equipotential %{m}', { m: M(tex) });
        default: return Region.KINDS[s.kind] ? sp('a %{kind}', { kind: Region.KINDS[s.kind].label.toLowerCase() }) : sp('a shape', {});
      }
    };
    // (v16: a 3-point region and a bound half-plane say their side themselves: "the outside of the circle through …")
    if (s.complement && kindType(s) === 'area' && !(s.def || (s.at && s.kind === 'halfplane'))) return capT('the complement of %{segs}', { segs: phrase('gen') }, cs);
    return phrase(cs);
  }
  const joinList = (items) => { // [[segs], ...] -> segs joined with commas and "and"
    const out = [];
    items.forEach((it, i) => {
      if (i) out.push({ t: i === items.length - 1 ? (items.length > 2 ? $tx('list', ', and ') : $tx('list', ' and ')) : ', ' });
      out.push(...it);
    });
    return out;
  };
  const cap1 = (segs) => { const s = segs.slice(); if (s[0] && s[0].t) s[0] = { t: s[0].t.charAt(0).toUpperCase() + s[0].t.slice(1) }; return s; };
  // [v16.4 review user-2] a phrase's closing comma ({pc}) stays only before more words: it goes before punctuation, an
  // opening bracket, another comma and at the end (keepEnd: a list that a template continues; it is left as PC_MARK,
  // which figure.js's polish resolves the same way once the sentence is whole). [verify-1] It also goes before the
  // English "and" (a list's or a meet's): there it would read as a list break; Russian keeps it («…, и~…»)
  const PC_MARK = '\u2063';
  function pcTidy(segs, keepEnd) {
    if (!segs.some((g) => g.pc)) return segs;
    return segs.filter((g, i) => {
      if (!g.pc) return true;
      const nx = segs.slice(i + 1).find((x) => x.m != null || x.b != null || (x.t != null && /\S/.test(x.t)));
      if (!nx) return !!keepEnd;
      return !(nx.t != null && /^\s*(?:[,.;:()]|and\b)/.test(nx.t));
    }).map((g, i, a) => (g.pc && keepEnd && !a.slice(i + 1).some((x) => x.m != null || x.b != null || (x.t != null && /\S/.test(x.t))) ? { t: PC_MARK } : g));
  }
  function compositeTexShort() {
    const act = activeSteps();
    let arg = { s: 'z', p: 4 };
    for (const j of act) arg = A.built[j - 1].tex(arg);
    return act.length ? (arg.s.length <= 320 ? arg.s : null) : 'z';
  }
  // the sentence on the image's shading (the pattern carried from the z-plane)
  function patternSegs(Fname) {
    const cell = { m: I18N.texNum(CX.fmtNum(patternCell(), 3)) }, z = { m: 'z' };
    switch (A.S.pattern) {
      case 'checker': return capT(' Regions are shaded by a checkerboard of squares of side %{cell} in the %{z}-plane, carried by the map.', { cell, z });
      case 'polar': return capT(' Regions are shaded by a log-polar checkerboard in the %{z}-plane, whose cells stay square under conformal maps.', { z });
      case 'tiles': return capT(' Regions are shaded by tiles marked with the letter F, which show rotation, scaling and reflection.', {});
      case 'grid': return capT(' Lines are the coordinate lines of the %{z}-plane, spaced %{cell}.', { z, cell });
      case 'polargrid': return capT(' Lines are circles about 0 and rays from 0 in the %{z}-plane.', { z });
      case 'phase': return capT(' Regions are coloured by the argument of the source point.', {});
      case 'stretch': return capT(' The colour shows the local scale factor %{F} (bar).', { F: { m: `|${Fname}'|` } });
      case 'sphere': return capT(' Regions are shaded by a checkerboard of %{n} longitude sectors and %{n2} latitude bands of the Riemann sphere of the %{z}-plane, carried by the map.', { n: { m: String(sphN()) }, n2: { m: String(sphN() / 2) }, z });
      default: return [];
    }
  }
  function figureCaption(panels) {
    const out = [];
    const push = (...xs) => out.push(...xs);
    const both = panels.length === 2;
    const vis = A.S.shapes.filter((s) => s.visible !== false);
    let pi = 0;
    const shapeList = joinList(vis.map((s) => { const r = shapePhrase(s, s.kind === 'point' ? pi : 0); if (s.kind === 'point') pi++; return r; }));
    const lv = panelVar('L'), Fname0 = A.S.focus === 0 ? 'F' : `f_{${A.S.focus}}`;
    const Ftex = A.S.focus === 0 ? compositeTexShort() : (A.built[A.S.focus - 1] && !A.built[A.S.focus - 1].error ? A.built[A.S.focus - 1].tex({ s: lv, p: 4 }).s : null);
    const mapF = Ftex ? `${Fname0}(${lv})=${Ftex}` : `${Fname0}`;
    // the deformation drawn in one panel (Phase or Landscape of H_t, or X → Y's merged globe): the picture is H_t at
    // the current t, so the caption names H_t and says which t and which homotopy (merged-views review)
    const hm = morphOn() && (panels.includes('L') ? lPaintsF() : true);
    const Fname = hm ? 'H_t' : Fname0, mapM = hm ? 'H_t' : mapF;
    const homDef = () => {
      const m = morphLen(), hom = morphHomSegs(m);
      if (hom.rt) return [...capT(' Shown at %{t}, where %{H} deforms %{QP} (%{t0}) into %{map} (%{tm}); it is %{hom}.', { t: { m: `t=${I18N.texNum(morph.T.toFixed(2))}` }, H: { m: hom.rt.H }, QP: { m: hom.rt.qp }, t0: { m: 't=0' }, map: { m: mapF }, tm: { m: `t=${m}` }, hom: hom.segs }), ...wDefSegs(hom.rt)];
      return capT(' Shown at %{t}, where %{H} deforms the identity (%{t0}) into %{map} (%{tm}) along %{hom}.', { t: { m: `t=${I18N.texNum(morph.T.toFixed(2))}` }, H: { m: 'H_t' }, t0: { m: 't=0' }, map: { m: mapF }, tm: { m: `t=${m}` }, hom: hom.segs });
    };
    // the plane of X in three cases (Russian: nominative, after «в»/«на», after «над»)
    const planeName = (cs) => (leftStage() === 0 ? capT('the %{z}-plane', { z: { m: 'z' } }, cs) : capT('the %{w}-plane, the input of %{F}', { w: { m: lv }, F: { m: Fname } }, cs));
    const lab = (c) => (both ? [{ b: `(${c})` }, { t: ' ' }] : []);
    // (a): X, with its view (U-b): the shapes, or what X's paint shows of the map
    const phaseText = (onWhat) => {
      const st = A.S.dc, r = [], F = { m: `|${Fname}|` }, arg = { m: `\\arg ${Fname}` };
      r.push(...capT('The phase portrait of %{map}', { map: { m: mapM } }), ...onWhat);
      if (st === 'classic') r.push(...capT('brightness increases with %{F}, so zeros are black and poles white.', { F }));
      else if (st === 'phase') r.push(...capT('the colour shows %{arg} (bar).', { arg }));
      else if (st === 'modulus') r.push(...capT('the colour shows %{arg} (bar); lines are level curves of %{F} and of %{arg}.', { arg, F }));
      else if (st === 'grid') r.push(...capT('the colour shows %{arg} (bar); lines are the preimages of the coordinate lines of the image plane.', { arg }));
      else if (st === 'cauchy') {
        const cc = cauchyKind ? cauchyKind() : null, I = { m: '\\frac{1}{2\\pi i}\\oint_\\gamma \\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta' }, Fm = { m: 'F' }, fp = { m: 'f_+' }, fl = { m: 'f_-' }, fm = cc && cc.plus ? { m: '-f_-' } : fl;
        if (cc && cc.kind === 'split' && cc.show === 'in') r.push(...capT('the Cauchy integral %{I} over the selected closed curve, shown inside the curve, where it equals %{fp} = %{F} minus its principal parts at the poles inside.', { I, fp, F: Fm }));
        else if (cc && cc.kind === 'split' && cc.show === 'out') r.push(...capT('the Cauchy integral %{I} over the selected closed curve, shown outside the curve, where it equals %{fm}, the sum of the principal parts of %{F} at its poles inside the curve.', { I, fm, F: Fm }));
        else if (cc && cc.kind === 'split') r.push(...capT('the Cauchy integral %{I} over the selected closed curve, which equals %{fp} inside and %{fm} outside, where %{F} = %{fp} + %{fl} and %{fl} is the sum of the principal parts of %{F} at its poles inside the curve.', { I, fp, fm, fl, F: Fm }));
        else if (cc && cc.kind === 'numeric') r.push(...capT('the Cauchy integral %{I} over the selected closed curve, computed numerically (%{F} has a singularity inside the curve that is not a pole).', { I, F: Fm }));
        else r.push(...capT('the Cauchy integral %{I} over the selected closed curve, which equals %{F} inside and %{zero} outside.', { I, F: Fm, zero: { m: '0' } }));
      }
      else r.push(...capT('the colour shows %{arg} (bar), and the shading steps in %{F} by factors of %{k}, so phase lines and modulus lines meet in near-squares where the map is conformal.', { arg, F, k: { m: `e^{2\\pi/${A.S.sectors || 12}}\\approx ${I18N.texNum(CX.fmtNum(Math.exp(TAU / (A.S.sectors || 12)), 2))}` } }));
      return r;
    };
    const inf = { m: '\\infty' };
    if (panels.includes('L')) {
      if (lColor()) push(...lab('a'), ...phaseText([{ t: $tx('cap', ' on ') }, ...planeName('prep'), { t: ': ' }]));
      else if (lGlobe() && lPhase()) push(...lab('a'), ...capT('The phase portrait of %{map} on the Riemann sphere, with %{inf} at the north pole.', { map: { m: mapM }, inf }));
      else if (lLand()) {
        const ht = { log: `\\log|${Fname}|`, abs: `|${Fname}|`, re: `\\operatorname{Re} ${Fname}`, im: `\\operatorname{Im} ${Fname}` }[A.S.height || 'log'];
        // (v16.1 user-5: what All sheets draws, exactly; while deforming, the sheets of H_t that become those of F,
        // notes/v16-user5/SHEETS-DESIGN.md; the multivalued notation only when it draws F's own sheets)
        const shw = sheetsShown(), shc = shw ? sheetsClause(shw, 'tex', Fname0) : null;
        push(...lab('a'), ...capT('The landscape of %{map}', { map: { m: shw && !shw.hom ? I18N.notation(mapM, undefined, { multi: true }) : mapM } }), { t: $tx('cap', ' over ') }, ...planeName('ins'), ...capT(': the height is %{h}', { h: { m: ht } }), ...(lPhase() ? capT(' and the colour %{arg} (bar)', { arg: { m: `\\arg ${Fname}` } }) : []), ...(shc ? (shc.src ? capT(shc.src, sheetsTexP(shc.p, (m) => ({ m }))) : [{ t: shc.p.text }]) : [{ t: $t('; zeros are pits and poles are peaks.') }]), ...(shc && shc.then ? texSegs($t(shc.then.src, shc.then.p)) : []));
      } else if (vis.length) push(...lab('a'), ...cap1(shapeList), { t: $tx('cap', ' in ') }, ...planeName('prep'), { t: lGlobe() ? $t(', on the Riemann sphere.') : '.' });
      else push(...lab('a'), ...cap1(planeName()), { t: '.' });
      if (both) push({ t: ' ' });
    }
    // (b): Y, the images (the shape list in the genitive: "the images of ...")
    let pg = 0;
    const listGen = () => joinList(vis.map((s) => { const r = shapePhrase(s, s.kind === 'point' ? pg : 0, 'gen'); if (s.kind === 'point') pg++; return r; }));
    if (panels.includes('R') && hm) {
      const r = [...capT('The deformation %{H}', { H: { m: 'H_t' } }), ...(rGlobe() ? capT(' on the Riemann sphere, with %{inf} at the north pole', { inf }) : [])];
      if (vis.length) r.push(...capT(': the image of %{list} under %{H}, over the set itself in grey.', { list: listGen(), H: { m: 'H_t' } }));
      else r.push({ t: '.' });
      push(...r);
    } else if (panels.includes('R')) {
      const r = [];
      const named = vis.length && (!panels.includes('L') || !lPlain() && !(lGlobe() && !lPhase()));
      const map = { m: mapM };
      if (rGlobe()) r.push(...(vis.length ? (named ? capT('The images of %{list} under %{map} on the Riemann sphere, with %{inf} at the north pole.', { list: listGen(), map, inf }) : capT('Their images under %{map} on the Riemann sphere, with %{inf} at the north pole.', { map, inf })) : capT('The image under %{map} on the Riemann sphere, with %{inf} at the north pole.', { map, inf })));
      else if (named) r.push(...capT('The images of %{list} under %{map}.', { list: listGen(), map }));
      else r.push(...(vis.length ? capT('Their images under %{map}.', { map }) : capT('The map %{map}.', { map })));
      push(...lab('b'), ...r);
    }
    // the shading (Image)
    if (panels.includes('R') && rImage() && vis.some((s) => kindType(s) === 'area')) push(...patternSegs(Fname));

    if (vis.some((s) => kindType(s) === 'area' && Region.isOpen && Region.isOpen(s))) push({ t: $t(' Dashed boundaries do not belong to the sets.') });
    if (hm) push(...homDef());
    // the chain, when F has several steps
    const act = activeSteps();
    if (act.length > 1 && A.S.focus === 0) {
      const defs = act.map((j) => {
        const b = A.built[j - 1];
        if (isDeriv(j)) return [{ m: `w_{${j}}=\\frac{d w_{${j - 1}}}{dz}` }];
        return [{ m: `f_{${j}}(${j === 1 ? 'z' : 'w'})=${b.tex({ s: j === 1 ? 'z' : 'w', p: 4 }).s}` }];
      });
      const hasD = act.some((j) => isDeriv(j));
      push(...(hasD ? capT(' Here the chain is built step by step from %{w0}: %{defs}.', { w0: { m: 'w_0=z' }, defs: joinList(defs) }) : capT(' Here %{F} with %{defs}.', { F: { m: `F=${act.slice().reverse().map((j) => `f_{${j}}`).join('\\circ ')}` }, defs: joinList(defs) })));
    }
    // the natural domain and the guarantees
    const P = Funcs.composeProps(act.map((j) => A.built[j - 1].props));
    const words = Object.assign({}, P, { homeo: P.injective, conformal: P.analytic && P.injective });
    const conds = [];
    for (const j of act) { const b = A.built[j - 1]; if (b.domain) conds.push(b.domain(wvar(j - 1))); }
    const deg = P.deg != null ? (P.degExact ? $t(' of degree {deg}', { deg: P.deg }) : $t(' of degree at most {deg}', { deg: P.deg })) : '';
    const props = [];
    if (words.mobius) props.push([{ t: $tx('cap', 'a Möbius transformation') }]);
    else if (words.polynomial) props.push([{ t: $tx('cap', 'a polynomial{deg}', { deg }) }]);
    else if (words.rational) props.push([{ t: $tx('cap', 'rational{deg}', { deg }) }]);
    if (words.entire && !words.polynomial && !words.mobius) props.push([{ t: $tx('cap', 'entire') }]);
    else if (words.analytic && !words.entire && !words.rational && !words.polynomial && !words.mobius) props.push([{ t: $tx('cap', 'analytic') }]);
    if (words.proper) props.push([{ t: $tx('cap', 'proper') }]);
    if (words.conformal) props.push([{ t: $tx('cap', 'conformal onto its image') }]);
    else if (words.homeo) props.push([{ t: $tx('cap', 'a homeomorphism onto its image') }]);
    if (act.length) {
      const generic = conds.filter((c) => /^\\text\{the formula is defined at/.test(c)), sets = conds.filter((c) => !generic.includes(c));
      conds.length = 0; conds.push(...sets);
      const D = { m: `D=\\{z : ${conds.join(',\\ ')}\\}` };
      const onD = !conds.length && generic.length ? capT(' Where the formula is defined, ', {}) : conds.length ? (conds.some((c) => /w_\{/.test(c)) ? capT(' On its natural domain %{D} (with %{wk} the value after step %{k}), ', { D, wk: { m: 'w_k' }, k: { m: 'k' } }) : capT(' On its natural domain %{D}, ', { D })) : [{ t: ' ' }];
      if (props.length) push(...onD, ...(props.length > 1 ? capT('%{F} is %{props}; these properties are guaranteed by the chain.', { F: { m: 'F' }, props: joinList(props) }) : capT('%{F} is %{props}; this is guaranteed by the chain.', { F: { m: 'F' }, props: joinList(props) })));
      else push(...onD, { t: conds.length ? $t('the chain guarantees none of the tracked properties.') : $t('The chain guarantees none of the tracked properties.') });
    }
    return out;
  }
  // the caption as LaTeX source (for \caption{...})
  function captionLatex(segs, keepEnd) {
    return pcTidy(segs, keepEnd).map((s) => (s.m != null ? `$${s.m}$` : s.b != null ? `\\textbf{${texEsc(s.b)}}` : texEsc(s.t).replace(/Möbius/g, 'M\\"obius'))).join('').replace(/\s+/g, ' ').trim();
  }
  // lay the caption out in lines of width W (justified, the last line ragged); returns {markup, h}
  // ragged: ragged-right lines (the deformation's captions, morph-figure.md 5), else justified with capped gaps
  function layoutCaption(segs, x0, y0, W, px, ragged = false) {
    const items = [];
    segs = pcTidy(segs);
    const sp = mj('\\text{a b}', px).w - mj('\\text{ab}', px).w || px * 0.33;
    for (const s of segs) {
      if (s.m != null) { items.push({ it: mj(s.m, px), glue: false }); continue; }
      const text = s.b != null ? s.b : s.t;
      const parts = text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        if (/^\s+$/.test(p)) { items.push({ space: true }); continue; }
        const tex = s.b != null ? `\\textbf{${texEsc(p)}}` : `\\text{${texEsc(p)}}`;
        items.push({ it: mj(tex, px) });
      }
    }
    // words joined by no space stay together (a word followed by math, "z-plane")
    const words = [];
    let cur = [];
    for (const i of items) {
      if (i.space) { if (cur.length) { words.push(cur); cur = []; } continue; }
      cur.push(i.it);
    }
    if (cur.length) words.push(cur);
    const lineH = px * 1.42;
    const lines = [];
    let line = [], lw = 0;
    for (const wd of words) {
      const ww = wd.reduce((a, it) => a + it.w, 0);
      if (line.length && lw + sp + ww > W) { lines.push({ words: line, w: lw }); line = []; lw = 0; }
      line.push({ parts: wd, w: ww });
      lw += (line.length > 1 ? sp : 0) + ww;
    }
    if (line.length) lines.push({ words: line, w: lw, last: true });
    let markup = '', y = y0 + px;
    for (const ln of lines) {
      const gaps = ln.words.length - 1;
      const extra = !ragged && !ln.last && gaps > 0 ? (W - ln.w) / gaps : 0;
      let x = x0;
      ln.words.forEach((wd, i) => {
        for (const it of wd.parts) { markup += mjAt(it, x, y); x += it.w; }
        x += sp + (i < gaps ? Math.min(extra, sp * 3) : 0);
      });
      y += lineH;
    }
    return { markup, h: lines.length ? (lines.length - 1) * lineH + px * 1.35 : 0 };
  }
  // the paths figure's own choice (figure.js figPaths): the points kept in the world window o.box drawn o.w x o.h pt
  // (pathsGen at the figure's spacing), and the caption that names them, in o.lang; o.paths false: none (the caption
  // without its paths sentence). -> {kept: [{z, kind}], captionTex} or null (cancelled, or no deformation picture)
  async function figMorphPaths(o) {
    const alive = o.alive || (() => true);
    if (!(morphOn() && rImage() && !morphHasDeriv())) return null;
    const Tend = morphLen(), b = o.box, w = o.w * 96 / 72, h = o.h * 96 / 72;
    const P = (z) => [(z.re - b.x0) / (b.x1 - b.x0) * w, (b.y1 - z.im) / (b.y1 - b.y0) * h];
    const key = JSON.stringify([A.chainSig[nSteps()], A.S.focus, !!A.S.homAll, A.S.shapes.filter((s) => s.visible !== false), Tend, b.x0, b.x1, b.y0, b.y1, w, h]);
    let sel = mfFigCache.key === key ? mfFigCache.sel : null;
    if (!sel) {
      sel = await runGenSliced(pathsGen(P, { x: 0, y: 0, w, h }, b, Tend, { scale: PATHS.figK, maxN: PATHS.figMax, fig: true }), alive);
      if (!sel || !alive()) return null;
      mfFigCache.key = key; mfFigCache.sel = sel;
    }
    if (o.paths === false) sel = Object.assign({}, sel, { kept: [] });
    let capSegs;
    I18N.using(o.lang || I18N.lang, () => {
      const keepT = morph.T;
      morph.T = Tend;
      try { capSegs = morphCaption(sel, Tend); } finally { morph.T = keepT; }
    });
    return { kept: sel.kept.map((k) => ({ z: [k.sp.z.re, k.sp.z.im], kind: k.sp.kind })), captionTex: captionLatex(capSegs) };
  }
  // (the export meshes of smPrepareExport live only while the figure draws; f.partial counts the forward images whose
  // mesh ended on a budget, which the dialog's note reports)
  // (each call tags its export meshes with its own generation, so a cancelled call's cleanup never drops the meshes
  // of the call that replaced it)
  async function buildFigure(opt) {
    const gen = ++sm.exportGen;
    try {
      const f = await buildFigureNow(Object.assign({}, opt, { expGen: gen }));
      if (f) f.partial = sm.exportPartial | 0;
      return f;
    } finally { smDropExport(gen); }
  }
  async function buildFigureNow(opt) {
    const alive = opt.alive || (() => true);
    const panels = opt.panels, W = Math.round(opt.widthIn * 96), dpr = FIG_DPI / 96;
    const isMorph = !!opt.morph && morphOn() && rImage() && !morphHasDeriv();
    const mEnd = morphLen(), Tend = isMorph ? (opt.upTo ? Math.max(1e-3, morph.T) : mEnd) : 0;
    const TICK = 8 * PT, LAB = 9 * PT, CAP = 9 * PT;
    const black = '#000', frameW = 0.75, tickW = 0.6;
    // margins (px): left room for tick numbers and the rotated axis title; bottom for numbers and the title
    const mL = (side) => (isPlanePanel(side) ? 40 : 0), mB = (side) => (isPlanePanel(side) ? 30 : 0);
    const both = panels.length === 2, arrowGap = both && rImage() && isPlanePanel('L') && !isMorph ? 40 : both ? 18 : 0;
    const topLetter = both ? 16 : 4, right = 6;
    const sumMargins = panels.reduce((a, s) => a + mL(s), 0) + arrowGap + right;
    const pw = (W - sumMargins) / panels.length;
    // the inverse programs the panels draw with, before the theme switch (no frame runs while it is in effect)
    if (!(await prepareExport(panels, alive, isMorph && !opt.upTo, { pw, dpr, gen: opt.expGen || 0 }))) return null;
    // One panel per task, in the light theme for print (switched for that panel only, so no frame on screen runs in
    // it), and every raster's encoding in a task of its own: toBlob reads the pixels back synchronously and waits
    // for the GPU to finish what was drawn before. Two 300 dpi globe panels and the first readback in one task
    // blocked the main thread for 51-60 ms (P3 review); a task here is one panel's draw, or one readback.
    const nextTask = () => new Promise((r) => setTimeout(r, 0));
    const drawn = [];
    for (const side of panels) {
      if (drawn.length) { await nextTask(); if (!alive()) return null; }
      const real = side === 'L' ? A.paneL : A.paneR;
      const ph = pw * real.h / effW(side);
      const wasDark = A.TH.dark, attr = document.documentElement.getAttribute('data-theme');
      if (wasDark) { document.documentElement.setAttribute('data-theme', 'light'); readTheme(); }
      // the deformation panel is drawn at t = Tend, paused (the region exact at the end, normalizeMap)
      const mKeep = { T: morph.T, playing: morph.playing };
      if (isMorph && side === 'R') { morph.T = Tend; morph.playing = false; }
      A.figVec = isMorph && side === 'R';
      try {
        drawn.push({ side, ph, cv: renderOff(side, pw, ph, dpr) });
      } finally {
        A.figVec = false;
        morph.T = mKeep.T; morph.playing = mKeep.playing;
        if (wasDark) { if (attr == null) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', attr); readTheme(); }
        requestRender('L', 'R');
      }
    }
    // the rasters are encoded after the theme is restored, off the main thread, once the GPU has finished the panels
    // (the first readback waited for every panel's passes: 51-58 ms of main thread for two 300 dpi globes)
    if (GLR.gpuDone) await GLR.gpuDone();
    if (!alive()) return null;
    const rasters = [];
    for (const d of drawn) {
      await nextTask();
      if (!alive()) return null;
      rasters.push({ side: d.side, ph: d.ph, url: await canvasURL(d.cv), w: d.cv.width, h: d.cv.height });
    }
    if (!alive()) return null;
    const keyH = panels.some((s) => panelKey(s)) ? 34 : 0;
    const PH = Math.max(...rasters.map((r) => r.ph));
    let body = '';
    let x = 0;
    const panelTop = topLetter;
    let mSel = null;
    for (const [i, r] of rasters.entries()) {
      const side = r.side, plane = isPlanePanel(side);
      x += mL(side);
      const y = panelTop + (PH - r.ph) / 2;
      body += `<image x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${pw.toFixed(2)}" height="${r.ph.toFixed(2)}" preserveAspectRatio="none" href="${r.url}" xlink:href="${r.url}"/>`;
      if (isMorph && side === 'R') {
        // the vector layers of the deformation: X's outline, the paths, arrowheads, dots, the labels
        const b = panelBox('R', pw, r.ph);
        const P = (w) => [x + (w.re - b.x0) / (b.x1 - b.x0) * pw, y + (b.y1 - w.im) / (b.y1 - b.y0) * r.ph];
        // chosen in slices (the dialog stays live; a newer option cancels it), and kept for the same chain, shapes,
        // panel and time, so the Caption switch or a repeated build reuses it
        const fkey = JSON.stringify([A.chainSig[nSteps()], A.S.focus, !!A.S.homAll, A.S.shapes.filter((s) => s.visible !== false), opt.widthIn, Tend, b, pw, r.ph, x, y]);
        if (mfFigCache.key === fkey) mSel = mfFigCache.sel;
        else {
          mSel = await runGenSliced(pathsGen(P, { x, y, w: pw, h: r.ph }, b, Tend, { scale: PATHS.figK, maxN: PATHS.figMax, fig: true }), alive);
          if (!mSel || !alive()) return null;
          mfFigCache.key = fkey; mfFigCache.sel = mSel;
        }
        // Paths off (the figure's Paths row): X's outline and the image only, no arrows (and no arrow sentence)
        if (opt.paths === false) mSel = Object.assign({}, mSel, { kept: [], labelled: null });
        const lay = morphFigureLayers(mSel, P, { x, y, w: pw, h: r.ph, wx0: b.x0, wx1: b.x1, wy0: b.y0, wy1: b.y1 }, `mfclip${i}`);
        mSel.labelled = lay.labelled;
        body += lay.svg;
      }
      if (plane) {
        const b = panelBox(side, pw, r.ph), v = isMorph && side === 'R' ? '' : panelVar(side);
        const step = Axes.niceStep(Math.max(b.x1 - b.x0, b.y1 - b.y0) / 5), minor = step / (String(step / 10 ** Math.floor(Math.log10(step)))[0] === '2' ? 4 : 5);
        const X = (t) => x + (t - b.x0) / (b.x1 - b.x0) * pw, Y = (t) => y + (b.y1 - t) / (b.y1 - b.y0) * r.ph;
        let d = '';
        const tick = (len, step2) => {
          for (let i2 = Math.ceil(b.x0 / step2); i2 <= Math.floor(b.x1 / step2); i2++) { const px = X(i2 * step2); d += `M${px.toFixed(2)} ${(y + r.ph).toFixed(2)}v${-len}M${px.toFixed(2)} ${y.toFixed(2)}v${len}`; }
          for (let j = Math.ceil(b.y0 / step2); j <= Math.floor(b.y1 / step2); j++) { const py = Y(j * step2); d += `M${x.toFixed(2)} ${py.toFixed(2)}h${len}M${(x + pw).toFixed(2)} ${py.toFixed(2)}h${-len}`; }
        };
        tick(4, step); tick(2.2, minor);
        body += `<path d="${d}" stroke="${black}" stroke-width="${tickW}" fill="none"/>`;
        body += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${pw.toFixed(2)}" height="${r.ph.toFixed(2)}" fill="none" stroke="${black}" stroke-width="${frameW}"/>`;
        // tick numbers below and left
        for (let i2 = Math.ceil(b.x0 / step); i2 <= Math.floor(b.x1 / step); i2++) body += mjAt(mj(tickTex(i2 * step, step), TICK), X(i2 * step), y + r.ph + 4 + TICK * 0.95, 'middle');
        for (let j = Math.ceil(b.y0 / step); j <= Math.floor(b.y1 / step); j++) { const it = mj(tickTex(j * step, step), TICK); body += mjAt(it, x - 4, Y(j * step) + TICK * 0.33, 'end'); }
        // axis titles
        body += mjAt(mj(`\\operatorname{Re} ${v}`, LAB), x + pw / 2, y + r.ph + 4 + TICK + 4 + LAB * 0.9, 'middle');
        const it = mj(`\\operatorname{Im} ${v}`, LAB), cx = x - 30, cy = y + r.ph / 2;
        body += `<g transform="rotate(-90 ${cx.toFixed(2)} ${cy.toFixed(2)})">${mjAt(it, cx, cy + LAB * 0.32, 'middle')}</g>`;
      }
      if (both) body += mjAt(mj(`\\text{(${String.fromCharCode(97 + i)})}`, LAB), x - (plane ? mL(side) - 2 : 0), panelTop - 5);
      // colour key, under the panel
      const key = panelKey(side);
      if (key) {
        const kw = Math.min(pw * 0.62, 190), kx = x + (pw - kw) / 2, ky = panelTop + PH + mB(side) + 8, gid = `kg${i}`;
        body += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">${key.stops.map(([o, c]) => `<stop offset="${o.toFixed(4)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`;
        body += `<rect x="${kx.toFixed(2)}" y="${ky.toFixed(2)}" width="${kw.toFixed(2)}" height="6" fill="url(#${gid})" stroke="${black}" stroke-width="0.5"/>`;
        let kd = '';
        for (const [o, t] of key.ticks) { const tx = kx + o * kw; kd += `M${tx.toFixed(2)} ${(ky + 6).toFixed(2)}v2.5`; body += mjAt(mj(t, TICK), tx, ky + 8.5 + TICK * 0.95, 'middle'); }
        body += `<path d="${kd}" stroke="${black}" stroke-width="0.5"/>`;
        body += mjAt(mj(key.title, LAB), kx - 6, ky + 6, 'end');
      }
      // the map arrow between domain and image
      if (both && i === 0 && arrowGap >= 24 && !isMorph) {
        const ax0 = x + pw + 5, ax1 = x + pw + arrowGap - 3, ay = panelTop + PH / 2;
        body += `<path d="M${ax0.toFixed(2)} ${ay.toFixed(2)}H${ax1.toFixed(2)}M${(ax1 - 4).toFixed(2)} ${(ay - 2.6).toFixed(2)}L${ax1.toFixed(2)} ${ay.toFixed(2)}L${(ax1 - 4).toFixed(2)} ${(ay + 2.6).toFixed(2)}" stroke="${black}" stroke-width="0.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        body += mjAt(mj(A.S.focus === 0 ? 'F' : `f_{${A.S.focus}}`, LAB), (ax0 + ax1) / 2, ay - 5, 'middle');
      }
      x += pw + (i === 0 ? arrowGap : 0);
    }
    let H = panelTop + PH + Math.max(...panels.map(mB)) + keyH + 6;
    let capSegs;
    I18N.using(opt.lang || I18N.lang, () => { // (review math-2: the caption in the figure's language)
    if (isMorph && panels.includes('R')) {
      const keepT = morph.T;
      morph.T = Tend;
      try {
        if (both) {
          const vis = A.S.shapes.filter((s) => s.visible !== false);
          let pi = 0;
          const list = joinList(vis.map((s) => { const r = shapePhrase(s, s.kind === 'point' ? pi : 0); if (s.kind === 'point') pi++; return r; }));
          capSegs = [{ b: '(a)' }, { t: ' ' }, ...capT('%{set} in the %{z}-plane. ', { set: list.length ? cap1(list) : capT('The plane', {}), z: { m: 'z' } }), { b: '(b)' }, ...capT(' The deformation %{H}: ', { H: { m: String.raw`H_t,\ 0\le t\le ` + I18N.texNum(CX.fmtNum(Tend, 2)) } }), ...morphCaption(mSel || { kept: [] }, Tend, { both: true })].map((g) => (g.m != null ? { m: inlineFrac(g.m) } : g));
        } else capSegs = morphCaption(mSel || { kept: [] }, Tend);
      } finally { morph.T = keepT; }
    } else capSegs = figureCaption(panels);
    });
    let capMarkup = '';
    if (opt.caption) {
      const c = layoutCaption(capSegs, 0, H + 4, W, CAP, isMorph && panels.includes('R'));
      capMarkup = c.markup; H += 4 + c.h + 4;
    }
    H = Math.ceil(H);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${(W / 96).toFixed(3)}in" height="${(H / 96).toFixed(3)}in" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${body}${capMarkup}</svg>`;
    return { svg, W, H, captionTex: captionLatex(capSegs), morph: mSel ? { kept: mSel.kept.map((k) => ({ z: [k.sp.z.re, k.sp.z.im], kind: k.sp.kind, start: k.l[0], end: k.l[k.l.length - 1], meet: !!k.meet })), budget: mSel.budget, nCands: mSel.nCands, labelled: mSel.labelled ? [mSel.labelled.sp.z.re, mSel.labelled.sp.z.im] : null, log: mSel.log.map(([c, why]) => [c.sp.z.re, c.sp.z.im, c.sp.kind, why]) } : null };
  }
  // (export review r3, video-1) the light theme's tokens, read once per class list: an export render in the dark theme
  // swaps TH in memory instead of flipping data-theme (each flip recalculated every style and, through the theme
  // observer, rebuilt the panels: 78-440 ms tasks per video frame). The one flip here is undone in the same block,
  // and themeChanged skips a notice whose theme is unchanged.
  let lightTH = null, lightKey = null;
  function lightTheme() {
    const de = document.documentElement, key = de.className;
    if (lightTH && lightKey === key) return lightTH;
    const keep = A.TH, attr = de.getAttribute('data-theme');
    de.setAttribute('data-theme', 'light'); readTheme(); lightTH = A.TH; lightKey = key;
    if (attr == null) de.removeAttribute('data-theme'); else de.setAttribute('data-theme', attr);
    A.TH = keep; inkCache.clear();
    return lightTH;
  }
  async function artRender(side, o) {
    const alive = o.alive || (() => true);
    const real = side === 'L' ? A.paneL : A.paneR, v = side === 'L' ? leftView() : V.right;
    const wpx = o.wpt * 96 / 72, dpr = o.dpi / 96;
    const hpx = o.box ? wpx * (o.box.y1 - o.box.y0) / (o.box.x1 - o.box.x0) : o.hpt ? o.hpt * 96 / 72 : wpx * real.h / effW(side);
    const fv = o.box ? { cx: (o.box.x0 + o.box.x1) / 2, cy: (o.box.y0 + o.box.y1) / 2, s: wpx / (o.box.x1 - o.box.x0), ph: hpx } : null;
    const atEnd = o.T == null || o.T >= morphLen() - 1e-9;
    const gen = ++sm.exportGen;
    try {
      if (!(await prepareExport([side], alive, atEnd, { pw: wpx, dpr, gen, views: fv ? { [side]: fv } : null }))) return null;
      const keep = { cx: v.cx, cy: v.cy, s: v.s, T: morph.T, playing: morph.playing };
      const thKeep = A.TH, light = A.TH.dark ? lightTheme() : A.TH;
      let cv;
      try {
        if (fv) { const k = wpx / effW(side); v.cx = fv.cx; v.cy = fv.cy; v.s = fv.s / k; }
        if (o.T != null) { morph.T = o.T; morph.playing = false; }
        // (o.look 'light': the screen's look in the light theme, for a video; else the art layer on white paper)
        A.artMode = o.look !== 'light'; A.printInk = A.artMode ? o.ink || null : null; A.artLand = null; A.artGlobe = null; A.artLandBox = o.landBox || null; A.artCam = true; A.artSkip = o.skipLines ? new Set(o.skipLines) : null; A.artNoLab = !!o.noGlobeLabels;
        A.TH = Object.assign({}, light); inkCache.clear();
        if (A.artMode) { A.TH.plane = '#ffffff'; A.TH.planeRGB = GLR.hexRGB('#ffffff'); }
        cv = renderOff(side, wpx, hpx, dpr);
      } finally {
        A.artMode = false; A.printInk = null; A.artLandBox = null; A.artCam = false; A.artSkip = null; A.artNoLab = false;
        Object.assign(v, { cx: keep.cx, cy: keep.cy, s: keep.s });
        morph.T = keep.T; morph.playing = keep.playing;
        A.TH = thKeep; inkCache.clear();
        requestRender('L', 'R');
      }
      const land = A.artLand, globe = A.artGlobe;
      if (GLR.gpuDone) await GLR.gpuDone();
      if (!alive()) return null;
      // (a video frame: the canvas itself, no readback)
      if (o.raw) return { w: cv.width, h: cv.height, cv, land, globe };
      const id = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, n = cv.width * cv.height, rgb = new Uint8Array(n * 3);
      // flattened on white. An opaque pixel (nearly all of them) is copied: the formula gives the same bytes there, and
      // the copy keeps this step short (the export dialog's preview: no main-thread task near 50 ms)
      for (let i = 0; i < n; i++) {
        const al = id[4 * i + 3];
        if (al === 255) { rgb[3 * i] = id[4 * i]; rgb[3 * i + 1] = id[4 * i + 1]; rgb[3 * i + 2] = id[4 * i + 2]; continue; }
        const a = al / 255; for (let c = 0; c < 3; c++) rgb[3 * i + c] = Math.round(id[4 * i + c] * a + 255 * (1 - a));
      }
      return { w: cv.width, h: cv.height, rgb, land, globe };
    } finally { smDropExport(gen); }
  }
  // what the figure shows: the view's picture (merged-views.md: export follows the view)
  function figViewKind() {
    const main = A.S.view.main;
    if (main === 'land' && lLand()) return 'land';
    if (main === 'phase') return lColor() ? 'phase' : 'xyL';
    if (morphOn()) return rImage() && !morphHasDeriv() ? 'morph' : 'xyR';
    return 'xy';
  }
  const slugOf = (t) => String(t || '').normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  function figSceneName() {
    // the file name comes from the English name in every language: an ASCII name that pdfLaTeX's \includegraphics takes
    const ex = typeof A.currentExample === 'number' && EX[A.currentExample] ? enOf(EX[A.currentExample].name) : null;
    const base = slugOf(ex) || slugOf(activeSteps().map((k) => A.S.steps[k - 1].type).slice(0, 2).join('-')) || 'plane';
    const v = figViewKind();
    return base + (v === 'phase' ? '-phase' : v === 'land' ? '-landscape' : v === 'morph' ? '-deformation' : '');
  }
  // the pieces of a caption, from the scene (figure.js writes the sentences)
  // (o.letters: points named A, B, C... as the Homework figure names them)
  function figCapParts(o = {}) {
    const vis = A.S.shapes.filter((s) => s.visible !== false);
    // (export review r3, verify2-new-1) o.skip: the points a globe figure cannot show (on the far side of the sphere)
    // are left out of the list of what it shows; the caption says they are hidden. The other points keep their names.
    const skipped = (s) => !!(o.skip && s.kind === 'point' && s.p && o.skip.some((z) => z.re === s.p[0] && z.im === s.p[1]));
    const skipAll = vis.every(skipped);
    const listOf = (gen) => {
      let pk = 0;
      return joinList(vis.map((s) => { const k = s.kind === 'point' ? pk : 0; if (s.kind === 'point') pk++; return !skipAll && skipped(s) ? null : shapePhrase(o.letters && s.kind === 'point' ? Object.assign({}, s, { label: String.fromCharCode(65 + (k % 26)) }) : s, k, gen); }).filter((r) => r != null));
    };
    const shapeList = listOf();
    // the same list in the genitive ("the images of ..."): Russian needs the case, English is the same
    const shapeListGen = listOf('gen');
    const lv = panelVar('L'), Fname = A.S.focus === 0 ? 'F' : `f_{${A.S.focus}}`;
    const Ftex = A.S.focus === 0 ? compositeTexShort() : (A.built[A.S.focus - 1] && !A.built[A.S.focus - 1].error ? A.built[A.S.focus - 1].tex({ s: lv, p: 4 }).s : null);
    const formula = Ftex && Ftex.length < 240 ? inlineFrac(Ftex) : null;
    // the deformation shown in one panel (Phase or Landscape of H_t): the picture is H_t at the current t
    const hm = morphOn() && lPaintsF();
    let hom = null;
    if (morphOn()) { try { const m = morphLen(), hs = morphHomSegs(m); hom = { T: morph.T, m, tex: captionLatex(hs.segs), inner: hs.inner ? captionLatex(hs.inner) : null, innerShort: hs.innerShort ? captionLatex(hs.innerShort) : null }; } catch (e) { hom = null; } }
    // (export review r3) the steps the homotopy names f_1, f_2, ...: their maps, for the caption's displayed chain
    let chain = null;
    if (morphOn() && A.S.focus === 0) {
      const ks = morphRange().steps;
      if (ks.length > 1 && !ks.some((k) => isDeriv(k))) chain = ks.map((k) => { const b = A.built[k - 1], v = k === 1 ? 'z' : `w_{${k - 1}}`; return { f: `f_{${k}}`, v, tex: b && !b.error ? b.tex({ s: v, p: 4 }).s : null }; });
      if (chain && chain.some((q) => !q.tex)) chain = null;
    }
    return { shapeList, shapeListGen, nShapes: vis.length, nPoints: vis.filter((s) => kindType(s) === 'point').length, Fname, lvar: lv, formula, raw: Ftex && Ftex.length < 240 ? Ftex : null, mapTex: formula ? `${Fname}(${lv})=${formula}` : null,
      pattern: rImage() && vis.some((s) => kindType(s) === 'area') ? patternSegs(Fname) : [], height: A.S.height, phase: lPhase(), dc: A.S.dc, cauchy: A.S.dc === 'cauchy' ? cauchyKind() : null, sectors: A.S.sectors || 12, hm, hom, chain, sheets: sheetsShown() };
  }
  // t in [0, 1] -> arg from -pi to pi, the colours of the legend wheel (as panelKey)
  const hueBytes = (t) => keyRGB((2 * t - 1) * Math.PI).map((x) => Math.round(255 * x));
  const viewBoxOf = (side) => { const real = side === 'L' ? A.paneL : A.paneR, other = side === 'L' ? A.paneR : A.paneL; return panelBox(side, effW(side), real.h > 20 ? real.h : other.h); };
  // what each lit lamp means, in LaTeX
  const BADGE_TEX = {
    analytic: $t('holomorphic at every point of its natural domain $D$'),
    entire: $t('$D = \\mathbb{C}$ and $F$ is holomorphic everywhere'),
    rational: $t('agrees on $D$ with $P(z)/Q(z)$ for polynomials $P$ and $Q$'),
    polynomial: $t('$F$ is a polynomial in $z$'),
    mobius: $t('$F(z) = \\frac{az+b}{cz+d}$ with $ad - bc \\neq 0$'),
    proper: $t('preimages of compact subsets of $\\mathbb{C}$ are compact in $D$, so $|F(z)| \\to \\infty$ as $z \\to \\partial D$ or $z \\to \\infty$'),
    homeo: $t('injective and continuous on the open set $D$, hence a homeomorphism $D \\to F(D)$ by invariance of domain'),
    conformal: $t('holomorphic and injective, hence a biholomorphism $D \\to F(D)$ with $F\' \\neq 0$'),
  };
  const BADGE_NAME_TEX = { mobius: $t('M\\"obius') };
  // a standalone LaTeX document: the composite map (constants that parse back exactly, non-principal branches
  // noted), every step, the natural domain, and the guaranteed properties (each implied by the chain)
  function latexDocument() {
    const act = activeSteps();
    const P = Funcs.composeProps(act.map((k) => A.built[k - 1].props));
    const words = Object.assign({}, P, { homeo: P.injective, conformal: P.analytic && P.injective });
    let texF = exactTexF();
    const rows = [], conds = [];
    CX.setTexExact(true);
    try {
      A.S.steps.forEach((st, i) => {
        const k = i + 1, b = A.built[i];
        if (st.on === false) rows.push($t('  w_{%{k}} &= w_{%{k2}} && \\text{(step %{k} bypassed)}', { k, k2: k - 1 }));
        else if (b.error) rows.push($t('  w_{%{k}} &= w_{%{k2}} && \\text{(step %{k} skipped: it has an error)}', { k, k2: k - 1 }));
        else rows.push(`  w_{${k}} &= ${b.tex({ s: wvar(k - 1), p: 4 }).s} && \\text{(${(b.def ? b.def.label : st.type).replace(/[&%$#_{}~^\\]/g, '')})}`);
      });
      for (const k of act) { const b = A.built[k - 1]; if (b.domain) conds.push(b.domain(wvar(k - 1))); }
    } finally { CX.setTexExact(false); }
    // (exact constants keep the point for copying; the Russian and Italian documents print them as 0{,}5, as their
    // captions do)
    if (I18N.comma()) { const dc = (t) => t.replace(/(\d)\.(\d)/g, '$1{,}$2'); texF = dc(texF); for (let i = 0; i < rows.length; i++) rows[i] = dc(rows[i]); for (let i = 0; i < conds.length; i++) conds[i] = dc(conds[i]); }
    const deg = P.deg != null ? (P.degExact ? $t(', of degree {deg}', { deg: P.deg }) : $t(', of degree at most {deg}', { deg: P.deg })) : '';
    const lit = BADGES.filter(([k]) => words[k]), unlit = BADGES.filter(([k]) => !words[k]);
    const name = (k, n) => BADGE_NAME_TEX[k] || n;
    const out = [
      $t('% Exported from Complex Map Workbench'),
      '\\documentclass{article}',
      // (Russian text needs Cyrillic fonts and hyphenation: DESIGN.md 5, tested with pdfLaTeX)
      ...(I18N.lang === 'ru' ? ['\\usepackage{iftex}', '\\ifPDFTeX', '  \\usepackage[T2A]{fontenc}', '  \\usepackage[utf8]{inputenc}', '\\else', '  \\usepackage{fontspec}', '  \\setmainfont{cmunrm.otf}[BoldFont=cmunbx.otf,ItalicFont=cmunti.otf,BoldItalicFont=cmunbi.otf]', '\\fi', '\\usepackage[russian]{babel}'] : []),
      // (Italian: accented letters and Italian hyphenation, pdfLaTeX, XeLaTeX and LuaLaTeX alike)
      ...(I18N.lang === 'it' ? ['\\usepackage{iftex}', '\\ifPDFTeX', '  \\usepackage[T1]{fontenc}', '  \\usepackage[utf8]{inputenc}', '\\fi', '\\usepackage[italian]{babel}'] : []),
      '\\usepackage{amsmath,amssymb}',
      '\\begin{document}',
      '',
      $t('\\section*{The map}'),
      '\\[',
      `  ${texF}`,
      '\\]',
    ];
    if (A.S.steps.length) {
      out.push($t('built step by step from $w_0 = z$, with $F(z) = w_{%{n}}$:', { n: A.S.steps.length }), '\\begin{align*}', rows.join(' \\\\\n'), '\\end{align*}');
    } else out.push($t('The chain is empty, so $F$ is the identity.'));
    out.push('', $t('\\section*{Natural domain}'));
    if (!conds.length) out.push(act.every((k) => A.built[k - 1].props.entire) ? '$D = \\mathbb{C}$.' : $t('$D$ is the set of $z$ at which every step is defined.'));
    else out.push($t('$D$ is the set of $z$ for which'), '\\begin{itemize}', ...conds.map((c) => `  \\item $${c}$`), '\\end{itemize}', act.length > 1 ? $t('where $w_k$ is the value after step $k$ and $w_0 = z$.') : '');
    out.push('', $t('\\section*{Guaranteed properties}'),
      $t('Each property listed here is implied by the chain: every step has it and composition preserves it (a derivative step keeps the properties that differentiation preserves). The list is sound but not complete: a property that is not listed may still hold.'));
    if (lit.length) {
      out.push('\\begin{itemize}');
      for (const [k, n] of lit) out.push(`  \\item \\textbf{${name(k, n)}}${k === 'rational' || k === 'polynomial' ? deg : ''}: ${BADGE_TEX[k]}.`);
      out.push('\\end{itemize}');
    } else out.push('', $t('The chain guarantees none of the tracked properties.'));
    if (unlit.length) out.push('', $t('Not implied by the chain (they may still hold): {x}.', { x: unlit.map(([k, n]) => name(k, n).replace(/ onto image$/, ' onto its image')).map((x) => (I18N.lang === 'ru' ? x.replace(/^[А-ЯЁ]/, (c) => c.toLowerCase()) : I18N.lang === 'it' ? x.replace(/^\p{Lu}(?=\p{Ll})/u, (c) => c.toLowerCase()) : x)).join(', ') }));
    out.push('', '\\end{document}', '');
    // Russian notation (tg, sh, ...) at the export boundary (DESIGN.md 6); English is unchanged
    return I18N.notation(out.join('\n'));
  }
  // (v16.5 V02: the items, for the menu and for the phone's ⋯ sheet, which lists them as its own rows)
  function exportMenuItems(withShare) {
    const items = /** @type {any[]} */ ([
      { label: $t('Export figure…'), fig: true, key: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘E' : 'Ctrl E', run: () => Figure.open() },
      { label: $t('Copy figure again'), icon: 'copy', again: true, disabled: !Figure.settings().last, run: () => { Figure.again('copy').catch((e) => { console.error(e); sndError(); toast($t('The figure could not be made here.')); }); } },
      { label: $t('Save figure again'), save: true, again: true, disabled: !Figure.settings().last, run: () => { Figure.again('save').catch((e) => { console.error(e); sndError(); toast($t('The figure could not be made here.')); }); } },
      'sep',
      { label: $t('Copy LaTeX with guarantees'), icon: 'copy', run: () => { copyText(latexDocument()); toast($t('LaTeX copied: the map, its natural domain and its guarantees.')); sndExportDone(); } },
      { label: $t('Save LaTeX with guarantees (.txt)'), save: true, run: () => saveFile('complex-map.txt', latexDocument()) },
    ]);
    // ([v17 D5] the link and the scene files are Share's on a laptop; the phone's sheet lists both)
    if (withShare) items.push('sep', ...shareMenuItems());
    // files cannot be offered in this view: only the copy remains
    // (by a flag, not by the label: the label is translated)
    if (dlDone && !dlNs) for (const it of items) if (it !== 'sep' && it.save) it.disabled = true;
    return items;
  }
  // v15: the whole figure in a link or a scene file (constructions/DESIGN.md 1.5)
  function shareMenuItems() {
    const items = [
      { label: $t('Copy link to this figure'), icon: 'copy', run: () => { copyFigureLink(); } },
      { label: $t('Save scene (.cmw.json)'), save: true, run: () => { saveScene(); } },
      { label: $t('Open scene…'), run: () => { pickScene(); } },
    ];
    if (dlDone && !dlNs) for (const it of items) if (it.save) it.disabled = true;
    return items;
  }
  function openExportMenu(anchor) { openMenu(anchor, exportMenuItems(document.documentElement.classList.contains('ph'))); }
  function openShareMenu(anchor) { openMenu(anchor, shareMenuItems()); }
  // highlight a step in the panel, the matrix and the chain at once
  function hiStep(k, on) {
    for (const el of document.querySelectorAll(`[data-k="${k}"]`)) el.classList.toggle('hi', on);
  }

  function init(api) {
    A = api;
    ({ BADGES, cauchyKind, C, EX, PATHS, PHASE, V, activeSteps, copyFigureLink, copyText, enOf, exLabel, exactTexF, flushLabels, focusDeriv, hov, inkCache, inlineFrac, isDeriv, keyHex, keyRGB, kindType, lColor, lFlat, lGlobe, lLand, lPaintsF, lPhase, lPlain, leftStage, leftView, mfFigCache, morph, morphCaption, morphFigureLayers, morphHasDeriv, morphHomSegs, morphLen, morphOn, morphRange, nSteps, openMenu, pathOf, pathsGen, patternCell, pickScene, rGlobe, rImage, readTheme, refineAllNow, renderLeft, renderRight, requestRender, rightStage, runGenSliced, saveScene, shapeTexOf, sheetsClause, sheetsShown, sheetsTexP, sm, smDropExport, smOn, smPrepareExport, sndError, sndExportDone, sphN, stageMap, texSegs, toast, wDefSegs, wvar, setOpt } = api);
  }
  return { init, getDownloads, saveFile, prepareExport, effW, renderOff, panelVar, capT, shapePhrase, joinList, cap1, pcTidy, compositeTexShort, patternSegs, figureCaption, captionLatex, figMorphPaths, buildFigure, artRender, figViewKind, figSceneName, figCapParts, hueBytes, viewBoxOf, latexDocument, exportMenuItems, openExportMenu, shareMenuItems, openShareMenu, hiStep };
})();
import { TAU, h } from './util.js';
import { CX } from './cx.js';
import { Funcs } from './funcs.js';
import { Region } from './region.js';
import { GLR } from './gl.js';
import { Axes, Pane } from './view.js';
import { Figure } from './figure.js';
import { Construct } from './construct.js';
export { Export };
