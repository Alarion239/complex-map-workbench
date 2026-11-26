'use strict';
// Export and captions: plane images and the LaTeX of the map with its
// guarantees, article figures, the captions (as segments and as LaTeX), and the figure export's renderer and the state
// it reads (src/figure.js; notes/export-design/AS-BUILT.md). The app hands it what it needs once, Export.init(api) at
// start-up (src/app/13-export-captions.js, exportApi): its functions and constants as they are, and the state it
// reassigns (S, selected, ...) as getters on api, read as A.S and so on. Figure.attach and the state the rest of the app
// reads too (mfFigCache, artLandBox) stay the app's.
const Export = (() => {
  let A = null;
  let BADGES, cauchyKind, C, EX, PATHS, PHASE, V, activeSteps, copyFigureLink, copyText, enOf, exLabel, exactTexF, flushLabels,
    focusDeriv, hov, inkCache, inlineFrac, isDeriv, keyHex, keyRGB, kindType, lColor, lFlat, lGlobe, lLand,
    lPhase, lPlain, leftStage, leftView, mfFigCache, morph, pathsSentence,
    openMenu, pathOf, pathsGen,
    pickScene, pointLabel, readTheme, refineAllNow, renderLeft, requestRender, shapeF, shapeStage, stageF, fNameTex, parkedAt,
    runGenSliced, saveScene, shapeTexOf, shapeTexOwn, sheetsClause, sheetsShown, sheetsTexP, sm, smDropExport, smOn,
    smPrepareExport, sndError, sndExportDone, stageMap, texSegs, toast, wvar, setOpt;
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
    // true only when the file is saved (or handed to the browser's download): a declined or refused save is false, so
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
  // MathJax 4's STIX2 font loads its rarer ranges (Cyrillic, Fraktur, …) on demand: a formula that needs one not
  // yet loaded throws with e.retry, a promise. mj() typesets synchronously, so it notes the promise and gives the
  // fallback for that formula (uncached); buildFigure waits for mjWaits and builds again. (Another formula with a
  // letter of a range still loading comes back with it as <text> in a system font, not a throw: uncached as well)
  let mjWaits = [];
  // TeX as a MathJax SVG (vector paths): {markup, w, h, va} at font size px; null without MathJax
  function mj(tex, px, color = '#000') {
    const key = `${px}|${color}|${tex}`;
    if (mjCache.has(key)) return mjCache.get(key);
    const MJ = window.MathJax;
    let out = null, waiting = false;
    if (tex && MJ && typeof MJ.tex2svg === 'function') {
      try {
        const node = MJ.tex2svg(I18N.notation(tex), { display: false });
        const svg = node && node.querySelector('svg');
        if (svg && mjWaits.length && svg.querySelector('text')) waiting = true;
        else if (svg) {
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
      } catch (e) {
        out = null;
        if (e && e.retry) { mjWaits.push(e.retry); waiting = true; }
      }
    }
    if (!out) {
      // without MathJax: the TeX source as plain serif text (rare: MathJax loads with the page)
      const t = String(tex).replace(/\\(operatorname|text|mathrm|textbf)\{([^}]*)\}/g, '$2').replace(/[{}\\]/g, '').replace(/\^/g, '').replace(/_/g, '');
      const w = t.length * px * 0.5, hh = px * 1.2;
      out = { markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}"><text x="0" y="${px}" font-family="Times New Roman, Times, serif" font-style="italic" font-size="${px}" fill="${color}">${t.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</text></svg>`, w, h: hh, va: -px * 0.2 };
    }
    if (mjCache.size > 2000) mjCache.clear();
    if (!waiting) mjCache.set(key, out);
    return out;
  }
  // place a typeset item with its baseline at (x, y); anchor: 'start' | 'middle' | 'end'
  function mjAt(it, x, y, anchor = 'start') {
    const left = anchor === 'middle' ? x - it.w / 2 : anchor === 'end' ? x - it.w : x;
    const top = y - it.h - it.va;
    return it.markup.replace('<svg', `<svg x="${left.toFixed(2)}" y="${top.toFixed(2)}"`);
  }
  // SPEC 10.6: prepareExport(alive) -> true when the export may draw, false when it is cancelled (alive() turned
  // false: an option changed or the dialog closed). Asynchronous and time-sliced: it refines the lines and waits
  // (bounded, polling every 25 ms, never blocking) for the inverse programs that X's current view draws with: the
  // plane at a focused stage or the z-globe (also at stage 0), so renderOff then draws exact images synchronously.
  // P5: dims {pw (figure px), dpr, view (the window drawn, {cx, cy, s, ph}, else X's own)}: the SphereMesh jobs of the
  // plane's forward shapes at the export's resolution (smPrepareExport).
  async function prepareExport(alive = () => true, dims = null) {
    // the lines' settle-time refinement, if it has not landed yet (a figure never carries today's samples)
    try { if (!(await refineAllNow(alive))) return false; } catch (e) { console.error('line refinement', e); }
    if (!alive()) return false;
    if (dims && smOn()) {
      const panes = [];
      if (lPlain() && leftStage() > 0) {
        const v = leftView(), k = dims.pw / effW(), ov = dims.view, ph = ov ? ov.ph : dims.pw * A.paneL.h / effW();
        panes.push({ role: 'L', map: stageMap(leftStage()), pane: { view: ov ? { cx: ov.cx, cy: ov.cy, s: ov.s } : { cx: v.cx, cy: v.cy, s: v.s * k }, dpr: dims.dpr, pw: Math.max(1, Math.round(dims.pw * dims.dpr)), ph: Math.max(1, Math.round(ph * dims.dpr)) } });
      }
      try { if (!(await smPrepareExport(panes, alive, dims.gen || 0))) return false; } catch (e) { console.error('SphereMesh export', e); }
    }
    if (!GLR.ok || !GLR.inverseRequest) return warmExport(alive);
    const kind = lGlobe() ? 'globe' : 'flat', map = stageMap(leftStage());
    const pending = (lPlain() || (lGlobe() && !lPhase())) && PHASE.L[kind] && A.S.shapes.some((s) => s.visible !== false && kindType(s) === 'area' && pathOf(s, map, 'L', kind, { status: true }).path === 'pending');
    const t0 = performance.now();
    while (pending && performance.now() - t0 < 4000) {
      if (!alive()) return false;
      if (GLR.inverseRequest(A.S.alpha, kind) !== 'pending') break;
      await new Promise((r) => setTimeout(r, 25));
    }
    return alive() && warmExport(alive);
  }
  // renderOff links the forward programs it lacks synchronously (syncPrograms), and a cold link on
  // Direct3D 11 takes seconds, which would freeze the tab. So the panels are first drawn small with nothing waiting (renderOff's
  // warm), and the programs are awaited here, polled, while the export's progress shows; renderOff then finds them linked (or links the odd one still missing). Awaited: the ones this
  // warm-up started and the current chain's; not the others compiling meanwhile (the idle warm-up's, the gallery's).
  async function warmExport(alive) {
    if (!GLR.ok || !GLR.pending) return true;
    const before = new Set(GLR.pending().map((p) => p.id));
    try {
      renderOff(48, 32, 1, true);
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
  // X's pane's CSS width, which the export's windows are scaled from
  const effW = () => A.paneL.w;
  // X drawn off-screen at print size: views scaled so the same window shows; selection, hover and probe off
  // warm: a draw only to start the programs it needs, in the background (prepareExport); nothing waits for them
  function renderOff(w, h, dpr, warm = false) {
    const cv = document.createElement('canvas'), ov = document.createElement('canvas');
    const off = new Pane(cv, ov);
    off.w = w; off.h = h; off.dpr = dpr;
    cv.width = ov.width = Math.max(1, Math.round(w * dpr)); cv.height = ov.height = Math.max(1, Math.round(h * dpr));
    const k = w / effW();
    const scaled = new Map();
    for (const v of [A.S.srcView, V.left]) if (v && !scaled.has(v)) { scaled.set(v, v.s); v.s *= k; }
    // (the outline of the left view in the image is a screen aid, not part of a figure; so is the Key switch's colour key)
    const keep = { L: A.paneL, probe: A.probe, selected: A.selected, hoverShape: A.hoverShape, draft: A.draft, hw: hov.w, hl: hov.list, fov: A.S.fov, wKey: A.S.wKey };
    A.probe = null; A.selected = null; A.hoverShape = null; A.draft = null; hov.w = null; hov.list = null; setOpt('fov', false); setOpt('wKey', false); A.figMode = true;
    // numbers drawn inside the plot (landscape axes, labels) in the serif of the figure, not the app's monospace
    const mono = A.TH.mono; A.TH.mono = A.TH.math;
    // exact images (SPEC 10.6): prepareExport has waited for the inverse programs; one still compiling (normally
    // none) is waited for here, and only then
    const wait = !warm && GLR.ok && GLR.inverseStatus && (GLR.inverseStatus(A.S.alpha, 'flat') === 'pending' || GLR.inverseStatus(A.S.alpha, 'globe') === 'pending');
    // the forward programs are always waited for: a deformation frame may need a map mode the screen never drew
    // (gl.js MAP compiles one program per mode), and a static program's first use does not wait on screen
    const waitFwd = !warm && GLR.ok;
    A.offRender = true;
    if (wait) GLR.syncCompile = true;
    if (waitFwd) GLR.syncPrograms = true;
    try {
      A.paneL = off; renderLeft();
      // labels are placed in a microtask on screen; here they are needed before the pixels are read
      if (off.labels) flushLabels(off, off.labels);
    } finally {
      if (wait) GLR.syncCompile = false;
      if (waitFwd) GLR.syncPrograms = false;
      A.offRender = false;
      A.paneL = keep.L;
      for (const [v, s] of scaled) v.s = s;
      A.probe = keep.probe; A.selected = keep.selected; A.hoverShape = keep.hoverShape; A.draft = keep.draft; hov.w = keep.hw; hov.list = keep.hl; setOpt('fov', keep.fov); setOpt('wKey', keep.wKey); A.figMode = false; A.TH.mono = mono;
    }
    return cv;
  }
  // the world window X's panel shows at width w (figure px)
  function panelBox(w, h) {
    const v = leftView();
    const s = v.s * w / effW();
    return { x0: v.cx - w / 2 / s, x1: v.cx + w / 2 / s, y0: v.cy - h / 2 / s, y1: v.cy + h / 2 / s };
  }
  // the variable of X's coordinates, in TeX
  const panelVar = () => (leftStage() === 0 ? 'z' : `w_{${leftStage()}}`);
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
  // the colour key of X's panel, when colour carries a value: arg F (phase), |F| (the classic style)
  function panelKey() {
    const stopsFrom = (f) => Array.from({ length: 25 }, (_, i) => [i / 24, f(i / 24)]);
    const hueAt = (t) => keyHex((2 * t - 1) * Math.PI); // t in [0, 1] -> arg from -pi to pi, colours of the legend wheel
    const Fn = A.S.focus === 0 ? 'F' : focusDeriv() ? `w_{${A.S.focus}}` : `f_{${A.S.focus}}`;
    if (lColor() && A.S.dc !== 'classic') return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.25, '-\\frac{\\pi}{2}'], [0.5, '0'], [0.75, '\\frac{\\pi}{2}'], [1, '\\pi']] };
    if (lColor()) return { title: `|${Fn}|`, stops: [[0, '#000000'], [0.5, '#8a8f93'], [1, '#ffffff']], ticks: [[0, '0'], [0.5, '1'], [1, '\\infty']] };
    if (lGlobe() && lPhase()) return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.5, '0'], [1, '\\pi']] };
    if (lLand() && lPhase()) return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.5, '0'], [1, '\\pi']] };
    return null;
  }
  // ---- the caption, as segments: {t: text} and {m: TeX}; also as LaTeX source ----
  // (one pass over the special characters: a replacement's own braces are not escaped again, as they would be when the backslash
  // is replaced first and the braces after it)
  const texEsc = (s) => String(s).replace(/[\\#$%&_{}~^]/g, (c) => (c === '\\' ? '\\textbackslash{}' : c === '~' ? '\\textasciitilde{}' : c === '^' ? '\\textasciicircum{}' : '\\' + c));
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
    // (a shape drawn on a later plane is written in that plane's variable, |w₁ − 1| = 0.5, as its row writes it)
    let tex = '', typed = false;
    try { tex = shapeTexOwn(s); typed = !!s.srcTex && shapeTexOf(s) === s.srcTex; } catch (e) { tex = ''; }
    // (a drawn area is a closed set, Region.isOpen, spec 6.5: its TeX says so, the disc |z| <= 2, and its complement |z| > 2 is
    // the open set; a typed formula keeps its own relations)
    // inline maths as journals set it: plain bars and a slashed fraction, not \left|...\right| or a stacked \frac
    if (tex) tex = inlineFrac(tex.replace(/\\left\|/g, '|').replace(/\\right\|/g, '|').replace(/\\left\(/g, '(').replace(/\\right\)/g, ')')).replace(/\\tfrac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');
    const P = (a) => CX.tex(C(a[0], a[1]), 3);
    const M = (m) => ({ m });
    // (phrase(c): the shape in case c; the complement names its shape in the genitive: «дополнение круга»)
    const phrase = (c) => {
      const sp = (src, params) => capT(src, params, c);
      // (constructions by their definitions; a phrase that must be closed when more text
      // follows (a Russian participial phrase, a stacked "in the domain") ends with a closing comma, {pc}: pcTidy drops it
      // before punctuation and at the end)
      if (s.def || s.at) { const ph = Construct.phrase(s, P); if (ph) { const r = sp(ph.src, ph.params); if (ph.close) r.push({ t: ',', pc: 1 }); return r; } }
      // a shape added from an equation, as recognized: by its equation
      if (typed && s.kind !== 'point') {
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
          // (a point of an earlier plane in a later plane's list: its image there, by the figure's label, w₁(z₀) = …)
          if (s._imageTex) {
            // (≈ where the value is rounded to its three decimals; the point it is the image of, with its own value, in a run of its own,
            // so a line may break between the two)
            const r3 = (x) => Math.abs(x * 1000 - Math.round(x * 1000)) < 1e-9 * Math.max(1, Math.abs(x * 1000));
            const rel = r3(s.p[0]) && r3(s.p[1]) ? '=' : '\\approx ';
            return sp('the point %{m}', { m: M(`${s._imageTex}${rel}${P(s.p)}`) }).concat([{ t: ' (' }, M(`${s._ofTex}=${P(s._of)}`), { t: ')' }]);
          }
          // (a label that is a word, "trailing edge", is set as text, not as a product of italic letters)
          // a name that is a word: "the trailing edge $z=1$", not a symbol "$\\text{trailing edge}=1$"
          if (s.label && (I18N.lang === 'en' ? /[A-Za-z]{2}|\s/ : /\p{L}{2}|\s/u).test(exLabel(s.label))) return sp('the %{label} %{m}', { label: String(exLabel(s.label)).trim(), m: M(`${wvar(shapeStage(s))}=${P(s.p)}`) });
          // (a point drawn on a later plane by its plane's name, w₁,₁, as the page and the figure's labels name it)
          const lab = s.label ? s.label.replace(/₀/g, '_0').replace(/₁/g, '_1').replace(/₂/g, '_2') : (shapeStage(s) > 0 && Construct.nameTex(pointLabel(s, idx, 0))) || `z_{${idx}}`;
          return sp('the point %{m}', { m: M(`${lab}=${P(s.p)}`) });
        }
        case 'segment': return sp('the segment %{m}', { m: M(`[${P(s.a)},\\,${P(s.b)}]`) });
        // (a line stored from a cap on a globe has a unit direction and is written by its equation, Region normalTex)
        // ("\text{…}" in any language is the line-through form: by its two points, never as maths)
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
        // (the grid's name is a translated \text{} at the front of its TeX)
        case 'cgrid': return sp('a Cartesian grid on %{m}', { m: M(tex.replace(/^\\text\{[^{}]*\}\s*/, '')) });
        case 'pgrid': return sp('a polar grid in %{m}', { m: M(tex.replace(/^\\text\{[^{}]*\},\s*/, '')) });
        // (by their equations: arg Φ_M(z) = 2π·θ, |Φ_M(z)| = r)
        case 'dhray': return sp('the external ray %{m}', { m: M(tex) });
        case 'dheq': return sp('the equipotential %{m}', { m: M(tex) });
        default: return Region.KINDS[s.kind] ? sp('a %{kind}', { kind: Region.KINDS[s.kind].label.toLowerCase() }) : sp('a shape', {});
      }
    };
    // (a 3-point region and a bound half-plane say their side themselves: "the outside of the circle through …")
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
  // a phrase's closing comma ({pc}) stays only before more words: it goes before punctuation, an
  // opening bracket, another comma and at the end (keepEnd: a list that a template continues; it is left as PC_MARK,
  // which figure.js's polish resolves the same way once the sentence is whole). It also goes before the
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
  // (upto: only the steps through that stage: the plane ‹ › rest Y on)
  function compositeTexShort(upto) {
    const act = activeSteps().filter((j) => upto == null || upto < 0 || j <= upto);
    let arg = { s: 'z', p: 4 };
    for (const j of act) arg = A.built[j - 1].tex(arg);
    return act.length ? (arg.s.length <= 320 ? arg.s : null) : 'z';
  }
  function figureCaption() {
    const out = [];
    const push = (...xs) => out.push(...xs);
    const vis = A.S.shapes.filter((s) => s.visible !== false);
    let pi = 0;
    const shapeList = joinList(vis.map((s) => { const r = shapePhrase(s, s.kind === 'point' ? pi : 0); if (s.kind === 'point') pi++; return r; }));
    const lv = panelVar(), Fname = fNameTex();
    const Ftex = A.S.focus === 0 ? compositeTexShort(parkedAt()) : (A.built[A.S.focus - 1] && !A.built[A.S.focus - 1].error ? A.built[A.S.focus - 1].tex({ s: lv, p: 4 }).s : null);
    const mapF = Ftex ? `${Fname}(${lv})=${Ftex}` : `${Fname}`;
    // the plane of X in three cases (Russian: nominative, after «в»/«на», after «над»)
    const planeName = (cs) => (leftStage() === 0 ? capT('the %{z}-plane', { z: { m: 'z' } }, cs) : capT('the %{w}-plane, the input of %{F}', { w: { m: lv }, F: { m: Fname } }, cs));
    // X, with its view (U-b): the shapes, or what X's paint shows of the map
    const phaseText = (onWhat) => {
      const st = A.S.dc, r = [], F = { m: `|${Fname}|` }, arg = { m: `\\arg ${Fname}` };
      r.push(...capT('The phase portrait of %{map}', { map: { m: mapF } }), ...onWhat);
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
    if (lColor()) push(...phaseText([{ t: $tx('cap', ' on ') }, ...planeName('prep'), { t: ': ' }]));
    else if (lGlobe() && lPhase()) push(...capT('The phase portrait of %{map} on the Riemann sphere, with %{inf} at the north pole.', { map: { m: mapF }, inf }));
    else if (lLand()) {
      const ht = { log: `\\log|${Fname}|`, abs: `|${Fname}|`, re: `\\operatorname{Re} ${Fname}`, im: `\\operatorname{Im} ${Fname}` }[A.S.height || 'log'];
      // (what All sheets draws, exactly; while deforming, the sheets of H_t that become those of F,
      // notes/v16-user5/SHEETS-DESIGN.md; the multivalued notation only when it draws F's own sheets; standards-ok: a spec path in notes/)
      const shw = sheetsShown(), shc = shw ? sheetsClause(shw, 'tex', Fname) : null;
      push(...capT('The landscape of %{map}', { map: { m: shw && !shw.hom ? I18N.notation(mapF, undefined, { multi: true }) : mapF } }), { t: $tx('cap', ' over ') }, ...planeName('ins'), ...capT(': the height is %{h}', { h: { m: ht } }), ...(lPhase() ? capT(' and the colour %{arg} (bar)', { arg: { m: `\\arg ${Fname}` } }) : []), ...(shc ? (shc.src ? capT(shc.src, sheetsTexP(shc.p, (m) => ({ m }))) : [{ t: shc.p.text }]) : [{ t: $t('; zeros are pits and poles are peaks.') }]), ...(shc && shc.then ? texSegs($t(shc.then.src, shc.then.p)) : []));
    } else if (vis.length) push(...cap1(shapeList), { t: $tx('cap', ' in ') }, ...planeName('prep'), { t: lGlobe() ? $t(', on the Riemann sphere.') : '.' });
    else push(...cap1(planeName()), { t: '.' });
    if (vis.some((s) => kindType(s) === 'area' && Region.isOpen && Region.isOpen(s))) push({ t: $t(' Dashed boundaries do not belong to the sets.') });
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
  // lay the caption out in lines of width W (justified with capped gaps, the last line ragged); returns {markup, h}
  function layoutCaption(segs, x0, y0, W, px) {
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
      const extra = !ln.last && gaps > 0 ? (W - ln.w) / gaps : 0;
      let x = x0;
      ln.words.forEach((wd, i) => {
        for (const it of wd.parts) { markup += mjAt(it, x, y); x += it.w; }
        x += sp + (i < gaps ? Math.min(extra, sp * 3) : 0);
      });
      y += lineH;
    }
    return { markup, h: lines.length ? (lines.length - 1) * lineH + px * 1.35 : 0 };
  }
  // the paths figure's own choice (figure.js figPaths) for the steps view's source o.src (svPathsFig's): the points kept
  // in the world window o.box drawn o.w x o.h pt (pathsGen at the figure's spacing), and the sentence that names them,
  // in o.lang; o.paths false: none. -> {kept: [{z, kind}], captionTex, sentenceTex} or null (cancelled, or no source)
  async function figMorphPaths(o) {
    const alive = o.alive || (() => true);
    if (!o.src) return null;
    const Tend = o.src.Tend, b = o.box, w = o.w * 96 / 72, h = o.h * 96 / 72;
    const P = (z) => [(z.re - b.x0) / (b.x1 - b.x0) * w, (b.y1 - z.im) / (b.y1 - b.y0) * h];
    const key = JSON.stringify([o.src.key, A.S.shapes.filter((s) => s.visible !== false), Tend, b.x0, b.x1, b.y0, b.y1, w, h]);
    let sel = mfFigCache.key === key ? mfFigCache.sel : null;
    if (!sel) {
      sel = await runGenSliced(pathsGen(P, { x: 0, y: 0, w, h }, b, Tend, { scale: PATHS.figK, maxN: PATHS.figMax, fig: true, src: o.src }), alive);
      if (!sel || !alive()) return null;
      mfFigCache.key = key; mfFigCache.sel = sel;
    }
    // o.keep(z): only the points it accepts are named and returned (the sphere's figure draws those seen from the camera's side)
    if (o.paths === false) sel = Object.assign({}, sel, { kept: [] });
    else if (o.keep) sel = Object.assign({}, sel, { kept: sel.kept.filter((k) => o.keep(k.sp.z)) });
    // (the sentence naming the paths, for the figure's own caption to carry)
    let sent;
    I18N.using(o.lang || I18N.lang, () => { sent = captionLatex(pathsSentence(sel, Tend, { z: o.z, end: o.end }).map((g) => (g.m != null ? { m: inlineFrac(g.m) } : g))); });
    return { kept: sel.kept.map((k) => ({ z: [k.sp.z.re, k.sp.z.im], kind: k.sp.kind })), captionTex: '', sentenceTex: sent };
  }
  // (the export meshes of smPrepareExport live only while the figure draws; f.partial counts the forward images whose
  // mesh ended on a budget, which the dialog's note reports)
  // (each call tags its export meshes with its own generation, so a cancelled call's cleanup never drops the meshes
  // of the call that replaced it)
  // (a pass that met a range of MathJax's STIX2 font not yet loaded, mjWaits, is built again once the ranges are
  // in, at most 8 passes)
  async function buildFigure(opt) {
    const gen = ++sm.exportGen;
    const alive = opt.alive || (() => true);
    try {
      for (let pass = 0; ; pass++) {
        mjWaits = [];
        const f = await buildFigureNow(Object.assign({}, opt, { expGen: gen }));
        if (f && mjWaits.length && pass < 7) {
          await Promise.all(mjWaits.map((p) => p.catch(() => {})));
          if (alive()) continue;
          return null;
        }
        if (f) f.partial = sm.exportPartial | 0;
        return f;
      }
    } finally { smDropExport(gen); }
  }
  async function buildFigureNow(opt) {
    const alive = opt.alive || (() => true);
    const W = Math.round(opt.widthIn * 96), dpr = FIG_DPI / 96;
    const TICK = 8 * PT, LAB = 9 * PT, CAP = 9 * PT;
    const black = '#000', frameW = 0.75, tickW = 0.6;
    // margins (px): left room for tick numbers and the rotated axis title; bottom for numbers and the title
    const plane = lFlat(), mL = plane ? 40 : 0, mB = plane ? 30 : 0;
    const panelTop = 4, right = 6;
    const pw = W - mL - right;
    // the inverse programs the panel draws with, before the theme switch (no frame runs while it is in effect)
    if (!(await prepareExport(alive, { pw, dpr, gen: opt.expGen || 0 }))) return null;
    // the panel in the light theme for print (switched for the draw only, so no frame on screen runs in it), and the
    // raster's encoding in a task of its own: toBlob reads the pixels back synchronously and waits for the GPU
    const ph = pw * A.paneL.h / effW();
    const wasDark = A.TH.dark, attr = document.documentElement.getAttribute('data-theme');
    if (wasDark) { document.documentElement.setAttribute('data-theme', 'light'); readTheme(); }
    let cv;
    try {
      cv = renderOff(pw, ph, dpr);
    } finally {
      if (wasDark) { if (attr == null) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', attr); readTheme(); }
      requestRender('L');
    }
    // the raster is encoded after the theme is restored, off the main thread, once the GPU has finished the panel
    if (GLR.gpuDone) await GLR.gpuDone();
    if (!alive()) return null;
    await new Promise((r) => setTimeout(r, 0));
    if (!alive()) return null;
    const url = await canvasURL(cv);
    if (!alive()) return null;
    const key = panelKey(), keyH = key ? 34 : 0;
    const x = mL, y = panelTop;
    let body = `<image x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" preserveAspectRatio="none" href="${url}" xlink:href="${url}"/>`;
    if (plane) {
      const b = panelBox(pw, ph), v = panelVar();
      const step = Axes.niceStep(Math.max(b.x1 - b.x0, b.y1 - b.y0) / 5), minor = step / (String(step / 10 ** Math.floor(Math.log10(step)))[0] === '2' ? 4 : 5);
      const X = (t) => x + (t - b.x0) / (b.x1 - b.x0) * pw, Y = (t) => y + (b.y1 - t) / (b.y1 - b.y0) * ph;
      let d = '';
      const tick = (len, step2) => {
        for (let i2 = Math.ceil(b.x0 / step2); i2 <= Math.floor(b.x1 / step2); i2++) { const px = X(i2 * step2); d += `M${px.toFixed(2)} ${(y + ph).toFixed(2)}v${-len}M${px.toFixed(2)} ${y.toFixed(2)}v${len}`; }
        for (let j = Math.ceil(b.y0 / step2); j <= Math.floor(b.y1 / step2); j++) { const py = Y(j * step2); d += `M${x.toFixed(2)} ${py.toFixed(2)}h${len}M${(x + pw).toFixed(2)} ${py.toFixed(2)}h${-len}`; }
      };
      tick(4, step); tick(2.2, minor);
      body += `<path d="${d}" stroke="${black}" stroke-width="${tickW}" fill="none"/>`;
      body += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" fill="none" stroke="${black}" stroke-width="${frameW}"/>`;
      // tick numbers below and left
      for (let i2 = Math.ceil(b.x0 / step); i2 <= Math.floor(b.x1 / step); i2++) body += mjAt(mj(tickTex(i2 * step, step), TICK), X(i2 * step), y + ph + 4 + TICK * 0.95, 'middle');
      for (let j = Math.ceil(b.y0 / step); j <= Math.floor(b.y1 / step); j++) { const it = mj(tickTex(j * step, step), TICK); body += mjAt(it, x - 4, Y(j * step) + TICK * 0.33, 'end'); }
      // axis titles
      body += mjAt(mj(`\\operatorname{Re} ${v}`, LAB), x + pw / 2, y + ph + 4 + TICK + 4 + LAB * 0.9, 'middle');
      const it = mj(`\\operatorname{Im} ${v}`, LAB), cx = x - 30, cy = y + ph / 2;
      body += `<g transform="rotate(-90 ${cx.toFixed(2)} ${cy.toFixed(2)})">${mjAt(it, cx, cy + LAB * 0.32, 'middle')}</g>`;
    }
    // colour key, under the panel
    if (key) {
      const kw = Math.min(pw * 0.62, 190), kx = x + (pw - kw) / 2, ky = panelTop + ph + mB + 8, gid = 'kg0';
      body += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">${key.stops.map(([o, c]) => `<stop offset="${o.toFixed(4)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`;
      body += `<rect x="${kx.toFixed(2)}" y="${ky.toFixed(2)}" width="${kw.toFixed(2)}" height="6" fill="url(#${gid})" stroke="${black}" stroke-width="0.5"/>`;
      let kd = '';
      for (const [o, t] of /** @type {[number, string][]} */ (key.ticks)) { const tx = kx + o * kw; kd += `M${tx.toFixed(2)} ${(ky + 6).toFixed(2)}v2.5`; body += mjAt(mj(t, TICK), tx, ky + 8.5 + TICK * 0.95, 'middle'); }
      body += `<path d="${kd}" stroke="${black}" stroke-width="0.5"/>`;
      body += mjAt(mj(key.title, LAB), kx - 6, ky + 6, 'end');
    }
    let H = panelTop + ph + mB + keyH + 6;
    let capSegs;
    I18N.using(opt.lang || I18N.lang, () => { capSegs = figureCaption(); }); // (the caption in the figure's language)
    let capMarkup = '';
    if (opt.caption) {
      const c = layoutCaption(capSegs, 0, H + 4, W, CAP);
      capMarkup = c.markup; H += 4 + c.h + 4;
    }
    H = Math.ceil(H);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${(W / 96).toFixed(3)}in" height="${(H / 96).toFixed(3)}in" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${body}${capMarkup}</svg>`;
    return { svg, W, H, captionTex: captionLatex(capSegs) };
  }
  // the light theme's tokens, read once per class list: an export render in the dark theme
  // swaps TH in memory instead of flipping data-theme (a flip recalculates every style and, through the theme
  // observer, rebuilds the panels: 78-440 ms tasks per video frame). The one flip here is undone in the same block,
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
  async function artRender(o) {
    const alive = o.alive || (() => true);
    const v = leftView();
    const wpx = o.wpt * 96 / 72, dpr = o.dpi / 96;
    const hpx = o.box ? wpx * (o.box.y1 - o.box.y0) / (o.box.x1 - o.box.x0) : o.hpt ? o.hpt * 96 / 72 : wpx * A.paneL.h / effW();
    const fv = o.box ? { cx: (o.box.x0 + o.box.x1) / 2, cy: (o.box.y0 + o.box.y1) / 2, s: wpx / (o.box.x1 - o.box.x0), ph: hpx } : null;
    const gen = ++sm.exportGen;
    try {
      if (!(await prepareExport(alive, { pw: wpx, dpr, gen, view: fv }))) return null;
      const keep = { cx: v.cx, cy: v.cy, s: v.s, T: morph.T, playing: morph.playing };
      const thKeep = A.TH, light = A.TH.dark ? lightTheme() : A.TH;
      let cv;
      try {
        if (fv) { const k = wpx / effW(); v.cx = fv.cx; v.cy = fv.cy; v.s = fv.s / k; }
        if (o.T != null) { morph.T = o.T; morph.playing = false; }
        // (o.look 'light': the screen's look in the light theme, for a video; else the art layer on white paper)
        A.artMode = o.look !== 'light'; A.printInk = A.artMode ? o.ink || null : null; A.artLand = null; A.artGlobe = null; A.artLandBox = o.landBox || null; A.artLandRound = o.landRound || null; A.artCamAsp = o.camAsp || null; A.artCam = true; A.artRelief = !!o.reliefOnly; A.artSkip = o.skipLines ? new Set(o.skipLines) : null;
        A.TH = Object.assign({}, light); inkCache.clear();
        if (A.artMode) { A.TH.plane = '#ffffff'; A.TH.planeRGB = GLR.hexRGB('#ffffff'); }
        cv = renderOff(wpx, hpx, dpr);
      } finally {
        A.artMode = false; A.printInk = null; A.artLandBox = null; A.artLandRound = null; A.artCamAsp = null; A.artCam = false; A.artRelief = false; A.artSkip = null;
        Object.assign(v, { cx: keep.cx, cy: keep.cy, s: keep.s });
        morph.T = keep.T; morph.playing = keep.playing;
        A.TH = thKeep; inkCache.clear();
        requestRender('L');
      }
      const land = A.artLand, globe = A.artGlobe;
      if (GLR.gpuDone) await GLR.gpuDone();
      if (!alive()) return null;
      // (o.reliefOnly: the alpha plane alone, 255 where the relief covers the pixel)
      if (o.reliefOnly) { const q = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, cov = new Uint8Array(cv.width * cv.height); for (let i = 0; i < cov.length; i++) cov[i] = q[4 * i + 3]; return { w: cv.width, h: cv.height, cov, land }; }
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
    return 'xy';
  }
  const slugOf = (t) => String(t || '').normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  function figSceneName() {
    // the file name comes from the English name in every language: an ASCII name that pdfLaTeX's \includegraphics takes
    const ex = typeof A.currentExample === 'number' && EX[A.currentExample] ? enOf(EX[A.currentExample].name) : null;
    const base = slugOf(ex) || slugOf(activeSteps().map((k) => A.S.steps[k - 1].type).slice(0, 2).join('-')) || 'plane';
    const v = figViewKind();
    return base + (v === 'phase' ? '-phase' : v === 'land' ? '-landscape' : '');
  }
  // the pieces of a caption, from the scene (figure.js writes the sentences)
  // (o.letters: points named A, B, C... as the Homework figure names them)
  function figCapParts(o = {}) {
    const vis = A.S.shapes.filter((s) => s.visible !== false);
    // a point of a plane before X's, which the panel draws as its image there: that image, named as the figure's label
    // names it (w₁(z₀)); the point as it is where it has no image there or no name in symbols
    const lk0 = leftStage();
    const asShown = (s, k) => {
      const j = shapeStage(s);
      if (s.kind !== 'point' || !s.p || j >= lk0 || o.letters) return s;
      const F = shapeF(s, stageF(lk0), lk0), w = F && F(C(s.p[0], s.p[1]));
      if (!w || !CX.isFin(w)) return s;
      const keep = A.figMode;
      A.figMode = true;
      try {
        const t = Construct.nameTex(pointLabel(s, k, lk0 - j)), t0 = Construct.nameTex(pointLabel(s, k, 0));
        return t && t0 ? Object.assign({}, s, { p: [w.re, w.im], _imageTex: t, _ofTex: t0, _of: s.p }) : s;
      } finally { A.figMode = keep; }
    };
    // (on: the shapes the list keeps, all without it; a point keeps its place among all the points, which names it)
    const listOf = (gen, on = null) => {
      let pk = 0;
      return joinList(vis.map((s) => { const k = s.kind === 'point' ? pk : 0; if (s.kind === 'point') pk++; return on && !on(s) ? null : shapePhrase(o.letters && s.kind === 'point' ? Object.assign({}, s, { label: String.fromCharCode(65 + (k % 26)) }) : asShown(s, k), k, gen); }).filter((r) => r != null));
    };
    // a shape drawn on a plane after X's is not in its panel: the list leaves it out
    const own = (s) => shapeStage(s) <= lk0;
    const shapeList = listOf(undefined, own);
    // the same list in the genitive ("the images of ..."): Russian needs the case, English is the same
    const shapeListGen = listOf('gen', own);
    const lv = panelVar(), Fname = fNameTex();
    const Ftex = A.S.focus === 0 ? compositeTexShort(parkedAt()) : (A.built[A.S.focus - 1] && !A.built[A.S.focus - 1].error ? A.built[A.S.focus - 1].tex({ s: lv, p: 4 }).s : null);
    const formula = Ftex && Ftex.length < 240 ? inlineFrac(Ftex) : null;
    return { shapeList, shapeListGen, nShapes: vis.filter(own).length, nPoints: vis.filter((s) => kindType(s) === 'point').length, Fname, lvar: lv, formula, raw: Ftex && Ftex.length < 240 ? Ftex : null, mapTex: formula ? `${Fname}(${lv})=${formula}` : null,
      height: A.S.height, phase: lPhase(), dc: A.S.dc, cauchy: A.S.dc === 'cauchy' ? cauchyKind() : null, sectors: A.S.sectors || 12, sheets: sheetsShown() };
  }
  // t in [0, 1] -> arg from -pi to pi, the colours of the legend wheel (as panelKey)
  const hueBytes = (t) => keyRGB((2 * t - 1) * Math.PI).map((x) => Math.round(255 * x));
  // X's window at its pane's size
  const viewBoxOf = () => panelBox(effW(), A.paneL.h);
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
  // (the items, for the menu and for the phone's ⋯ sheet, which lists them as its own rows)
  function exportMenuItems(withShare) {
    const items = /** @type {any[]} */ ([
      { label: $t('Export figure…'), fig: true, key: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘E' : 'Ctrl E', run: () => Figure.open() },
      { label: $t('Copy figure again'), icon: 'copy', again: true, disabled: !Figure.settings().last, run: () => { Figure.again('copy').catch((e) => { console.error(e); sndError(); toast($t('The figure could not be made here.')); }); } },
      { label: $t('Save figure again'), save: true, again: true, disabled: !Figure.settings().last, run: () => { Figure.again('save').catch((e) => { console.error(e); sndError(); toast($t('The figure could not be made here.')); }); } },
      'sep',
      { label: $t('Copy LaTeX with guarantees'), icon: 'copy', run: () => { copyText(latexDocument()); toast($t('LaTeX copied: the map, its natural domain and its guarantees.')); sndExportDone(); } },
      { label: $t('Save LaTeX with guarantees (.txt)'), save: true, run: () => saveFile('complex-map.txt', latexDocument()) },
    ]);
    // (the link and the scene files are Share's on a laptop; the phone's sheet lists both)
    if (withShare) items.push('sep', ...shareMenuItems());
    // files cannot be offered in this view: only the copy remains
    // (by a flag, not by the label: the label is translated)
    if (dlDone && !dlNs) for (const it of items) if (it !== 'sep' && it.save) it.disabled = true;
    return items;
  }
  // the whole figure in a link or a scene file (constructions/DESIGN.md 1.5)
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
    ({ BADGES, cauchyKind, C, EX, PATHS, PHASE, V, activeSteps, copyFigureLink, copyText, enOf, exLabel, exactTexF, flushLabels, focusDeriv, hov, inkCache, inlineFrac, isDeriv, keyHex, keyRGB, kindType, lColor, lFlat, lGlobe, lLand, lPhase, lPlain, leftStage, leftView, mfFigCache, morph, pathsSentence, openMenu, pathOf, pathsGen, pickScene, pointLabel, readTheme, refineAllNow, renderLeft, requestRender, shapeF, shapeStage, stageF, fNameTex, parkedAt, runGenSliced, saveScene, shapeTexOf, shapeTexOwn, sheetsClause, sheetsShown, sheetsTexP, sm, smDropExport, smOn, smPrepareExport, sndError, sndExportDone, stageMap, texSegs, toast, wvar, setOpt } = api);
  }
  return { init, getDownloads, saveFile, effW, renderOff, panelVar, capT, shapePhrase, pcTidy, compositeTexShort, figureCaption, captionLatex, figMorphPaths, buildFigure, artRender, figViewKind, figSceneName, figCapParts, hueBytes, viewBoxOf, latexDocument, exportMenuItems, openExportMenu, shareMenuItems, openShareMenu, hiStep };
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
