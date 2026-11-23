  // ---------------- the Play gate (a part of the steps view: svGo and svPlay start the wait) ----------------
  // A glide (▶, or a step by the arrows) waits for the programs and the warm draw, so it never runs on programs still
  // linking or frames not yet drawn. SV.gate holds the wait: {btn, start, t0, timer, hung, shown, toast, keep, fill}; svCheck
  // ends it when another chain is loaded under it (an edit on the thread, a Split or an undo, keeps it); it polls
  // every SV_GATE_POLL_MS and calls start when nothing is left to prepare. SV_GATE_HANG_MS is a hang guard only: past it
  // the wait shows a message with Retry and Cancel, and it never starts a glide that is not ready. Esc, the button
  // again or Cancel cancels; nothing starts afterwards
  const SV_GATE_POLL_MS = 100, SV_GATE_HANG_MS = 10000, SV_GATE_SHOW_MS = 300;
  // the ring's fill while the gauge has no total yet
  const SV_GATE_UNKNOWN_FILL = 0.25;
  // the ring's share for what svReady counts but the frames drawn ahead, while a wait has them to make too
  const SV_GATE_PREP_SHARE = 0.5;
  // The ring's fill for g's wait from r (svReady(g.M)): the share of r done. With frames drawn ahead (r.parts.ahead), which
  // are made only once all else is ready, the rest fills the ring up to SV_GATE_PREP_SHARE, and the frames then fill
  // what is left of it, from where it was when they started (g.aheadFrom): from 0 when all else was ready at once
  function svGateFill(r, g) {
    if (!r.total) return SV_GATE_UNKNOWN_FILL;
    const a = r.parts.ahead;
    if (!a) return r.done / r.total;
    const restT = r.total - a.total, restD = r.done - a.done;
    if (restD < restT) return SV_GATE_PREP_SHARE * restD / restT;
    if (g.aheadFrom == null) g.aheadFrom = g.fill || 0;
    return g.aheadFrom + (1 - g.aheadFrom) * a.done / a.total;
  }
  // What a glide needs before its first frame: the chain's programs linked, the carried colour's warm draw made and the idle
  // jobs of svReady (the pole tracks, the ring, the meshes) finished, so no frame is shown that a job would redraw. No GPU
  // layer: nothing to prepare
  function svGateNeeded(M) {
    return !svGateOff && !!(GLR.ok && GLR.progStatus) && !svReady(M).ready;
  }
  // the test hook's switch for suites that watch what follows the wait (the link-hold) without it
  let svGateOff = false;
  const svGateOffSet = (off) => { svGateOff = !!off; };
  // a press waits for the prestart (the test hook counts it as under way)
  const svGateWaiting = () => !!SV.gate;
  // the wait is on plane z with its colour (T = 0), on the flat plane: its frame is the glide's first, the late-link stand-in while the carried programs link
  const svGateDraws = () => !!SV.gate && svFlatSurf() && lFlat() && svT() === 0 && Math.round(SV.g.x) === 0 && Math.abs(SV.g.x) < SV_REST_U;
  // start() now, or once the chain is prepared; btn is the control the wait shows on, M the motion start() starts from
  // rest (its frames drawn ahead, svAheadPart), or none
  function svGated(btn, start, M) {
    if (SV.gate) return;
    if (!svGateNeeded(M)) { start(); return; }
    SV.gate = { btn, start, M, t0: performance.now(), timer: 0, hung: false, shown: false, toast: null, keep: null };
    svPrestartSoon(0);
    if (svGateDraws()) requestRender('L');
    svGateTick();
  }
  // (restart: Retry keeps the ring shown, with no pause before it)
  function svGateRetry() {
    const g = SV.gate;
    if (!g) return;
    const { btn, start, M } = g;
    svGateEnd(true);
    svGated(btn, start, M);
    if (SV.gate) { SV.gate.shown = true; svGateSync(); }
  }
  // (keep: the wait ends to start the motion, or to wait again (Retry), and the frames drawn ahead stay; else it is cancelled,
  // and they go)
  function svGateEnd(keep) {
    const g = SV.gate;
    if (!g) return;
    clearTimeout(g.timer);
    if (!keep) svAheadDrop();
    // (the keyboard user who acted in the message goes back to the control the wait is on, not to the page)
    if (g.toast && g.toast.contains(document.activeElement)) g.btn.focus();
    if (g.toast) { const x = g.toast.querySelector('.toast-x'); if (x) x.click(); else g.toast.remove(); }
    SV.gate = null;
    requestRender('L');
    if (g.keep) {
      g.btn.replaceChildren(...g.keep.kids);
      for (const [k, v] of g.keep.attrs) { if (v == null) g.btn.removeAttribute(k); else g.btn.setAttribute(k, v); }
    }
    g.btn.toggleAttribute('aria-busy', false);
    delete g.btn.dataset.wait;
    g.btn.style.removeProperty('--wait');
    if (g.btn === (SV.els && SV.els.play)) { delete g.btn.dataset.on; svPlaySync(); }
  }
  function svGateSync() {
    const g = SV.gate;
    if (!g || !g.shown) return;
    const B = g.btn;
    if (!g.keep) {
      g.keep = { kids: Array.from(B.childNodes), attrs: ['aria-label', 'data-tip', 'aria-description', 'aria-pressed'].map((k) => [k, B.getAttribute(k)]) };
      B.replaceChildren();
      B.insertAdjacentHTML('beforeend', ICONS.close);
    }
    const r = svReady(g.M);
    B.toggleAttribute('aria-busy', true);
    B.dataset.wait = g.hung ? 'hung' : 'busy';
    g.fill = Math.max(g.fill || 0, svGateFill(r, g));
    B.style.setProperty('--wait', String(g.fill));
    B.removeAttribute('aria-pressed');
    B.setAttribute('aria-label', $t('Cancel'));
    B.setAttribute('aria-description', $t('Preparing the glide…'));
    B.setAttribute('data-tip', `${$t('Preparing the glide…')}  Esc`);
  }
  function svGateTick() {
    const g = SV.gate;
    if (!g) return;
    if (svPlanes().length < 2) { svGateEnd(); return; }
    if (!svGateNeeded(g.M)) { svGateEnd(true); g.start(); return; }
    // (all else ready: the motion's frames are drawn ahead)
    if (g.M && svAheadPart(g.M) && svReady().ready) svAheadRun(g.M);
    const t = performance.now() - g.t0;
    if (!g.shown && t >= SV_GATE_SHOW_MS) {
      g.shown = true;
      if (SV.els.live) SV.els.live.textContent = $t('Preparing the glide…');
    }
    if (!g.hung && t > SV_GATE_HANG_MS) {
      g.hung = true;
      g.toast = toast($t('Still preparing the glide.'), $t('Retry'), () => { g.toast = null; svGateRetry(); }, false, { sticky: true });
      if (g.toast) {
        g.toast.querySelector('.toast-act').after(h('button', { class: 'toast-act', onclick: () => svGateEnd() }, $t('Cancel')));
        // (Retry and the message's close button end the message, not the wait: the focus moves to the button before the message goes)
        const msg = g.toast, btn = g.btn;
        msg.addEventListener('click', () => { if (msg.contains(document.activeElement)) btn.focus(); }, true);
      }
    }
    svGateSync();
    g.timer = setTimeout(svGateTick, SV_GATE_POLL_MS);
  }
