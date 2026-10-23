// Demo adapter: Tour.init(api) on the published v12 build (notes/gate-merged-r2/dist/test.html), built from its test
// hooks (window.__cmw*) and its DOM. It stands in for the app-side adapter of notes/tour/INTEGRATION.md so the tour can
// be seen and screenshotted on the real app before integration. Events are polled from __cmwState here; the real app
// emits them directly. URL: ?ns=<name>&tour=suggest | step&ch=<chapter>&i=<index> | menu
(() => {
  const qs = new URLSearchParams(location.search);
  const ns = qs.get('ns');
  const lsk = (k) => (ns ? `${k}:${ns}` : k);
  const L = {}, taps = [];
  const emit = (ev, p) => {
    for (const f of taps) try { f('event', ev, p); } catch (e) { /* */ }
    for (const f of L[ev] || []) try { f(p); } catch (e) { console.warn(e); }
  };
  window.__tourTap = (f) => taps.push(f);         // the harness panel logs events and api calls
  // the examples of v12 by name (EX order in app.js)
  const EXI = { 'Strip to disk': 1, 'Logarithm of an annulus': 4, 'A rational map': 9, 'Roots as preimages': 10, 'A residue by integration': 11, 'The derivative in the chain': 12, 'Every sheet of the logarithm': 13 };
  const $ = (s) => document.querySelector(s);
  const frames = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const shapeCount = () => { try { const s = window.__cmwShapes(); return s.shapes.length + s.targets.length; } catch (e) { return 0; } };
  // the app's saved state, and the sandbox (INTEGRATION.md §3): v12 cannot pause its autosave, so the demo holds back
  // its writes to that key while a tour runs (the last one held is kept, for the polled events). v12 has no flush hook:
  // a save still pending when the tour starts (under 300 ms old) is held back too
  const SAVE_KEY = lsk('complex-map-workbench-v1');
  const setItem0 = Storage.prototype.setItem;
  let sandboxed = false, restoring = false, held = null;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage && k === SAVE_KEY && (sandboxed || restoring)) { held = String(v); return; }
    return setItem0.call(this, k, v);
  };
  const savedNow = () => (sandboxed && held != null ? held : localStorage.getItem(SAVE_KEY));
  const hadWork = localStorage.getItem(SAVE_KEY) != null;
  // a drawing in progress (v12 does not expose its draft): a press in a pane with a drawing tool, until a shape is
  // added or Escape or Enter is handled by the app
  let drafting = false;
  const toolNow = () => { const b = document.querySelector('.tool.on[data-tool]'); return b ? b.dataset.tool : 'select'; };
  const PATTERN_LABEL = { checker: 'Checker', polar: 'Log-polar', tiles: 'Tiles', grid: 'Grid', polargrid: 'Polar grid', phase: 'Arg z', stretch: 'Stretch', sphere: 'Sphere checker', solid: 'Solid' };

  const api = {
    storageKey: lsk,
    // v12 has neither the zeros-and-poles step nor "All at once" (both come with the deformation round)
    has(feature) { return !({ zp: 1, allAtOnce: 1 })[feature]; },
    anchor(name) {
      if (name === 'paths') { const c = $('#pathsBtn') || $('#pathsChk'); return c ? (c.closest('label') || c) : null; }
      if (name === 'transport') return $('.tdock:not([hidden])') || null;
      return undefined;   // the tour's own selector map
    },
    // state: the saved state as v12 writes it; v12's undo history cannot be reached from here (mem is empty)
    snapshot() { try { return { state: localStorage.getItem(SAVE_KEY), mem: null }; } catch (e) { return null; } },
    restore(snap) {
      // v12 has no in-place restore hook: put the saved state back and reload (the real app restores in place). The
      // app's own writes stay held back until the reload (its pagehide flush would save the tour's scene). In the URL
      // modes used by the checks there is no reload: the page keeps showing the tour's scene
      if (!snap || snap.state === undefined) return false;
      try { if (snap.state == null) localStorage.removeItem(SAVE_KEY); else setItem0.call(localStorage, SAVE_KEY, snap.state); } catch (e) { return false; }
      if (!qs.get('tour')) { restoring = true; setTimeout(() => location.reload(), 160); }
      return true;
    },
    sandbox(on) { sandboxed = !!on; if (!on) held = null; return true; },
    hasWork() { return hadWork; },
    busy() {
      if (document.querySelector('#toolMore[open]')) return true;
      try { if (window.__cmwShapes().selected != null) return true; } catch (e) { /* */ }
      return drafting;
    },
    setTool(id) { const b = document.querySelector(`#secDraw .tool[data-tool="${id}"]`) || document.querySelector(`.tool[data-tool="${id}"]`); if (b) b.click(); drafting = false; },
    setLook(lk) {
      if (!lk || !window.__cmwSet) return;
      if (lk.pattern && PATTERN_LABEL[lk.pattern]) { const b = document.querySelector(`#patternSeg [aria-label="${PATTERN_LABEL[lk.pattern]}"]`); if (b && b.getAttribute('aria-checked') !== 'true') b.click(); }
      if ('alpha' in lk) window.__cmwSet('alpha', lk.alpha == null ? 0.85 : lk.alpha);
      if (lk.height) window.__cmwSet('height', lk.height);
      if ('sheets' in lk) window.__cmwSet('sheets', !!lk.sheets);
      if (lk.phaseStyle) window.__cmwSet('dc', lk.phaseStyle);
    },
    loadScene(spec) {
      quietUntil = performance.now() + 900;      // the scene's own changes are not the user's
      const i = EXI[spec.name];
      if (i == null || !window.__cmwExample) return false;
      window.__cmwExample(i);
      // the residue example opens its integral by itself; the tour wants it closed until the Try it (Escape reaches the
      // app, not the tour, while the popover is open)
      if (spec.name === 'A residue by integration') {
        let k = 0;
        const t = setInterval(() => { if ($('.pop.int-pop')) { clearInterval(t); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } else if (++k > 40) clearInterval(t); }, 25);
      }
      return true;
    },
    setView(m) { window.__cmwSetMain && window.__cmwSetMain(m); },
    setSurface(pane, surf) { window.__cmwSetView && window.__cmwSetView(pane, surf); },
    setDeformation(on) { window.__cmwMorph && window.__cmwMorph({ open: !!on }); },
    focusStep(k) { const c = $(`.card[data-k="${k}"]`); if (c) c.click(); },
    showPanel(side) { const b = side === 'right' ? $('#rightRailOpen') : $('#leftRailOpen'); if (b && b.offsetParent) b.click(); },
    openGuide() { document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })); },
    toast(msg) {
      const host = $('#toastHost'); if (!host) return;
      const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = '<span></span>'; t.firstChild.textContent = msg;
      host.append(t); setTimeout(() => t.remove(), 4000);
    },
    tex(src) {
      const MJ = window.MathJax;
      if (!(MJ && MJ.tex2svg)) return null;
      try { const n = MJ.tex2svg(src, { display: false }); return n; } catch (e) { return null; }
    },
    on(ev, fn) { (L[ev] = L[ev] || []).push(fn); return () => { L[ev] = (L[ev] || []).filter((f) => f !== fn); }; },
  };

  // events: polled from the test hooks, plus a few DOM listeners
  let prev = null, nShapes = 0, shapesSig = '', nSteps = 0, pat = null, quietUntil = 0, savedStr = null, cutSig = '';
  const cutsOf = (str) => { try { const o = JSON.parse(str); return JSON.stringify((o.steps || []).map((st) => st.params && st.params.cut)); } catch (e) { return ''; } };
  const stepCount = () => document.querySelectorAll('.pipe .card[data-k]:not(.region-card), .card[data-k]:not(.region-card)').length;
  const patNow = () => { const b = $('#patternSeg [aria-checked="true"]'); return b ? (b.dataset.v || b.dataset.id || b.textContent.trim()) : null; };
  function poll() {
    let s; try { s = window.__cmwState(); } catch (e) { return; }
    const n = shapeCount();
    let sig = ''; try { const sh = window.__cmwShapes(); sig = JSON.stringify([sh.shapes, sh.targets]); } catch (e) { /* */ }
    const ns = stepCount(), pt = patNow();
    if (prev && performance.now() > quietUntil) {
      if (n === nShapes && sig !== shapesSig) emit('shape-moved', {});
      if (ns > nSteps) emit('step-added', {});
      if (pt !== pat && pt != null) emit('pattern-changed', { id: String(pt).toLowerCase() });
      if (s.view.main !== prev.view.main) emit('view-changed', { main: s.view.main });   // (quiet after the tour's own setView)
      if (s.morph.open !== prev.morph.open) emit('deformation-toggled', { on: s.morph.open });
      if (s.morph.open && s.morph.T !== prev.morph.T && !s.morph.playing) emit('deformation-t', { t: s.morph.T });
      if (s.focus !== prev.focus) emit('step-focused', { k: s.focus });
      if (s.intPop != null && prev.intPop == null) emit('integral-opened', { shape: s.intPop });
      if (n > nShapes) emit('shape-added', {});
    }
    if (n !== nShapes) drafting = false;
    // a branch cut moved: the steps' cut angles in the state the app last saved (or tried to)
    const sv = savedNow();
    if (sv !== savedStr) {
      const cs = sv ? cutsOf(sv) : '';
      if (prev && savedStr != null && cs !== cutSig && performance.now() > quietUntil) emit('cut-moved', {});
      savedStr = sv; cutSig = cs;
    }
    prev = s; nShapes = n; shapesSig = sig; nSteps = ns; pat = pt;
  }
  document.addEventListener('pointermove', (e) => { if (e.target.closest && e.target.closest('#plotR')) emit('probe', { pane: 'R' }); }, true);
  document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('#paneL, #paneR') && e.target.tagName === 'CANVAS' && toolNow() !== 'select') drafting = true; }, true);
  document.addEventListener('keyup', (e) => { if (e.key === 'Escape' || e.key === 'Enter') drafting = false; });
  document.addEventListener('click', (e) => {
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    if (t.closest('#pathsBtn, #pathsChk')) setTimeout(() => emit('paths-toggled', {}), 0);
    // the help button opens the tour menu (the reference guide is one of its items). v12's own listener (openGuide) is
    // kept from running; the default action stays, so on a phone the ⋯ menu closes as it will in the app
    if (t.closest('#helpBtn') && window.Tour) { e.stopPropagation(); Tour.openHelpMenu(t.closest('#helpBtn')); }
  }, true);
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) setTimeout(() => emit('palette-opened', {}), 0); }, true);
  $('#cmdBtn') && $('#cmdBtn').addEventListener('click', () => emit('palette-opened', {}));

  async function boot() {
    for (let i = 0; i < 100 && !window.__cmwState; i++) await new Promise((r) => setTimeout(r, 50));
    await frames(3);
    setInterval(poll, 120);
    Tour.init(api);
    const mode = qs.get('tour');
    if (mode === 'suggest') { Tour.reset(); Tour.suggest({ delay: 200, force: true }); }
    else if (mode === 'step') await Tour.start({ chapter: qs.get('ch') || 'basics', step: +(qs.get('i') || 0) });
    else if (mode === 'menu') { const r = JSON.parse(qs.get('rec') || 'null'); if (r) localStorage.setItem(lsk('cmw-tour'), JSON.stringify(r)); Tour.openHelpMenu(document.querySelector('#helpBtn')); }
    else if (!ns || qs.get('first') === '1') Tour.suggest();
    window.__tourApi = api;
    window.dispatchEvent(new CustomEvent('tour-harness-ready'));
  }
  // every call the tour makes into the adapter, for the harness panel
  for (const k of Object.keys(api)) {
    const f = api[k];
    if (typeof f !== 'function' || /^(storageKey|anchor|has|tex|on|busy|hasWork)$/.test(k)) continue;
    api[k] = function (...a) {
      for (const t of taps) try { t('call', k, a); } catch (e) { /* */ }
      // what the tour does itself is not the user's doing: the polled events stay quiet for a moment
      if (/^(loadScene|setView|setSurface|setDeformation|focusStep|showPanel|setTool|setLook|restore)$/.test(k)) quietUntil = Math.max(quietUntil, performance.now() + 500);
      return f.apply(this, a);
    };
  }
  if (document.readyState === 'complete') boot(); else addEventListener('load', boot);
})();
