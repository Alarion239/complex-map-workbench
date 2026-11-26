  // ---------------- the Play gate (a part of the steps view: svGo and svPlay start the wait) ----------------
  // A glide (▶, or a step by the arrows) waits for the programs and the warm draw, so it never runs on programs still
  // linking or frames not yet drawn. SV.gate holds the wait: {btn, start, t0, timer, hung, shown, toast, keep, fill,
  // aheadFrom}; svCheck ends it when another chain is loaded under it (an edit on the thread, a Split or an undo, keeps
  // it); it polls every SV_GATE_POLL_MS and calls start when nothing is left to prepare. SV_GATE_HANG_MS is a hang guard
  // only: past it the wait shows a message with Retry and Cancel, and it never starts a glide that is not ready. Esc,
  // the button again or Cancel cancels; nothing starts afterwards
  const SV_GATE_POLL_MS = 100, SV_GATE_HANG_MS = 10000, SV_GATE_SHOW_MS = 300;
  // the ring's fill while the gauge has no total yet
  const SV_GATE_UNKNOWN_FILL = 0.25;
  // the ring's share for what svReady counts but the frames drawn ahead, while a wait has them to make too: a half, as
  // neither part's time is known before it starts (the programs' links and the frames' cost vary by machine and chain),
  // so each is given the same room and neither part's progress is squeezed into a sliver of the ring
  const SV_GATE_PREP_SHARE = 0.5;
  // the steps, as a share of the ring, in which a waiting control's description gives the ring's fill (svWaitLook): it
  // changes at most 1 / SV_WAIT_SAY_STEP times a wait
  const SV_WAIT_SAY_STEP = 0.1;
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
  // (restart: Retry keeps the ring shown, with no pause before it, and says the live region's line again)
  function svGateRetry() {
    const g = SV.gate;
    if (!g) return;
    const { btn, start, M } = g;
    svGateEnd(true);
    svGated(btn, start, M);
    // (its line is said on the next poll, a task after svGateEnd emptied the live region, so the write is a change a screen
    // reader announces)
    if (SV.gate) { SV.gate.shown = true; SV.gate.sayAgain = true; svGateSync(); }
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
    // (the live region's "Preparing the glide…" goes with the wait: a cancelled wait leaves no stale line, and the next wait
    // on another control says the line again as a change, which a screen reader announces; anything else the region says stays)
    if (g.shown && SV.els && SV.els.live && SV.els.live.textContent === $t('Preparing the glide…')) SV.els.live.textContent = '';
    svWaitRestore(g);
  }
  // The Play gate's gauge for its wait g: the share of what svReady(g.M) counts that is done, or null while it is not
  // measured: while svReady has no total, and while the counted parts (the programs, the pole tracks, the ring, the meshes) are done and only parts
  // with nothing counted inside them are left (svReady's whole parts: the warm draw, a REPT draw's tiles, a pane's
  // redraw; on a REPT chain the warm draw's machine code takes seconds, and one unit of eighteen would stand the ring
  // at 94 %), besides the parts that start only once all else is ready (the inverse programs, svInvWarmNext; the frames
  // ahead), which wait on those. Unknown, the ring keeps its arc and shows the rest as unknown (svWaitLook). With frames
  // drawn ahead (the part ahead), which are made only once all else is ready, all else fills the ring up to
  // SV_GATE_PREP_SHARE and the frames fill what is left of it, from where it stood when they started (g.aheadFrom): from
  // 0 when all else was ready at once, so that the ring reads the share of the frames made
  function svGateFill(g) {
    const r = svReady(g.M), a = r.parts.ahead;
    if (!r.total) return null;
    let whole = 0, wholeDone = 0, counted = 0, countedDone = 0;
    for (const k in r.parts) {
      const p = r.parts[k];
      if (p.whole) { whole += p.total; wholeDone += p.done; } else if (k !== 'ahead' && k !== 'inverse') { counted += p.total; countedDone += p.done; }
    }
    if (wholeDone < whole && countedDone === counted) return null;
    if (!a) return r.done / r.total;
    const restT = r.total - a.total, restD = r.done - a.done;
    if (restD < restT) return SV_GATE_PREP_SHARE * restD / restT;
    if (g.aheadFrom == null) g.aheadFrom = g.fill || 0;
    return g.aheadFrom + (1 - g.aheadFrom) * a.done / a.total;
  }
  // The look of a control that waits for the programs (the Play gate's, and ▶ in a hold in the middle of a play): its
  // icon a cross in a ring that fills by its gauge (w.gauge, else the gate's), named Cancel and described "Preparing
  // the glide… 40 %", the largest share measured (w.said) in whole steps of SV_WAIT_SAY_STEP: the ring's progress for
  // a screen reader, read when the control has the focus or is asked for (a description, so a change of it is not
  // announced; the live region says "Preparing the glide…" once). While the gauge is unknown (null) the ring keeps the
  // arc it had (SV_GATE_UNKNOWN_FILL before any), shows the rest of it as unknown (data-wait "unknown": a segment
  // sweeping round it, desk.css) and the control is described "Preparing the glide…" alone. w: {btn, keep, fill, said,
  // gauge?, hung?} and, for the gate's, M and aheadFrom (svGateFill); kept so svWaitRestore gives the control back as
  // it was
  function svWaitLook(w) {
    const B = w.btn;
    if (!w.keep) {
      w.keep = { kids: Array.from(B.childNodes), attrs: ['aria-label', 'data-tip', 'aria-description', 'aria-pressed'].map((k) => [k, B.getAttribute(k)]) };
      B.replaceChildren();
      B.insertAdjacentHTML('beforeend', ICONS.close);
    }
    B.toggleAttribute('aria-busy', true);
    const v = w.gauge ? w.gauge() : svGateFill(w);
    B.dataset.wait = w.hung ? 'hung' : v == null ? 'unknown' : 'busy';
    w.fill = Math.max(w.fill || 0, v == null ? SV_GATE_UNKNOWN_FILL : v);
    if (v != null) w.said = Math.max(w.said || 0, v);
    B.style.setProperty('--wait', String(w.fill));
    B.removeAttribute('aria-pressed');
    B.setAttribute('aria-label', $t('Cancel'));
    const p = Math.round(100 * SV_WAIT_SAY_STEP * Math.floor((w.said || 0) / SV_WAIT_SAY_STEP + 1e-9));
    B.setAttribute('aria-description', v == null ? $t('Preparing the glide…') : $t('Preparing the glide… {p} %', { p: I18N.num(p) }));
    B.setAttribute('data-tip', `${$t('Preparing the glide…')}  Esc`);
  }
  function svWaitRestore(w) {
    const B = w.btn;
    if (w.keep) {
      B.replaceChildren(...w.keep.kids);
      for (const [k, v] of w.keep.attrs) { if (v == null) B.removeAttribute(k); else B.setAttribute(k, v); }
    }
    B.toggleAttribute('aria-busy', false);
    delete B.dataset.wait;
    B.style.removeProperty('--wait');
    if (B === (SV.els && SV.els.play)) { delete B.dataset.on; svPlaySync(); }
  }
  // whether button B shows the wait look: the Play gate's (once shown) or a hold's
  const svWaitOn = (B) => !!((SV.gate && SV.gate.shown && SV.gate.btn === B) || (SV.hold && SV.hold.shown && SV.hold.btn === B));
  function svGateSync() {
    const g = SV.gate;
    if (!g || !g.shown) return;
    svWaitLook(g);
  }
  // A hold in the middle of a play (svLinkHold: the programs of a later glide still link, so the play's clock stands still):
  // past SV_GATE_SHOW_MS ▶ takes the gate's look and the live region says "Preparing the glide…" once, and when the hold ends
  // ▶ goes back to Pause and the live region says the play's words once. A shorter hold shows nothing. Pressing ▶ (Cancel) or
  // Esc pauses the play, as for any play
  function svHoldWaitBegin(A) {
    if (SV.hold && SV.hold.ending) svHoldWaitLeave(SV.hold);
    if (SV.hold) return;
    // (the ring is this hold's own, and of what the held glide waits for (svHoldLeft): the share that has gone since the hold began,
    // so it is full when the glide can go; svReady's gauge counts what was done before the play, so it would start high and never
    // fill. With nothing counted, the ring stands at the unknown fill)
    const w = SV.hold = { btn: SV.els.play, A, t0: performance.now(), timer: 0, shown: false, keep: null, fill: 0, left0: svHoldLeft, ending: false,
      gauge: () => { w.left0 = Math.max(w.left0, svHoldLeft); return w.left0 > 0 ? 1 - Math.min(svHoldLeft, w.left0) / w.left0 : null; } };
    w.timer = setTimeout(svHoldWaitTick, SV_GATE_SHOW_MS);
  }
  function svHoldWaitTick() {
    const w = SV.hold;
    if (!w || w.ending) return;
    if (SV.play !== w.A || !w.A.held) { svHoldWaitEnd(SV.play === w.A); return; }
    if (!w.shown) {
      w.shown = true;
      if (SV.els.live) SV.els.live.textContent = $t('Preparing the glide…');
    }
    svWaitLook(w);
    w.timer = setTimeout(svHoldWaitTick, SV_GATE_POLL_MS);
  }
  // the hold's look given back, and the hold gone
  function svHoldWaitLeave(w) {
    if (SV.hold === w) SV.hold = null;
    svWaitRestore(w);
  }
  // the hold is over (say: the play goes on, so the ring is full, painted for two animation frames, and its words are said again; else, as
  // when ▶ pauses the play, ▶ is given back at once)
  function svHoldWaitEnd(say) {
    const w = SV.hold;
    if (!w) return;
    if (w.ending) { if (!say) svHoldWaitLeave(w); return; }
    clearTimeout(w.timer);
    if (!w.shown) { SV.hold = null; return; }
    if (!say) { svHoldWaitLeave(w); return; }
    w.ending = true;
    w.gauge = () => 1;
    svWaitLook(w);
    if (SV.els.live && SV.play === w.A) SV.els.live.textContent = svPlayWords(w.A.to);
    requestAnimationFrame(() => requestAnimationFrame(() => { if (SV.hold === w) svHoldWaitLeave(w); }));
  }
  // the 10 s message is on the screen
  const svGateMessageUp = () => !!(SV.gate && SV.gate.toast && SV.gate.toast.isConnected);
  // The first part of svReady's gauge not done, in the gauge's order, or null
  function svGateMissing() {
    const parts = svReady().parts;
    for (const k in parts) if (parts[k].done < parts[k].total) return k;
    return null;
  }
  // The 10 s message: the sentence, then what is missing. One sentence per part, so each language puts its words in its own order
  function svGateStill(part) {
    switch (part) {
      case 'programs': return $t('Still preparing the glide: the drawing programs are not ready yet.');
      case 'warm': return $t('Still preparing the glide: its colouring is not ready yet.');
      case 'poles': return $t('Still preparing the glide: the paths of the poles are not computed yet.');
      case 'ring': return $t('Still preparing the glide: the outer part of the plane is not computed yet.');
      case 'meshes': return $t('Still preparing the glide: the regions are not meshed yet.');
      case 'redraw': return $t('Still preparing the glide: the first frame is not drawn yet.');
      default: return $t('Still preparing the glide.');
    }
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
    } else if (g.sayAgain && SV.els.live) { g.sayAgain = false; SV.els.live.textContent = $t('Preparing the glide…'); }
    if (!g.hung && t > SV_GATE_HANG_MS) {
      g.hung = true;
      g.toast = toast(svGateStill(svGateMissing()), $t('Retry'), () => { g.toast = null; svGateRetry(); }, false, { sticky: true, fit: true });
      if (g.toast) {
        g.toast.querySelector('.toast-act').after(h('button', { class: 'toast-act', onclick: () => svGateEnd() }, $t('Cancel')));
        // (Retry and the message's close button end the message, not the wait: the focus moves to the button before the message goes)
        const msg = g.toast, btn = g.btn;
        msg.addEventListener('click', () => { if (msg.contains(document.activeElement)) btn.focus(); }, true);
      }
      requestRender('L');   // (the plane's "Compiling…" note goes while the message names the programs)
    }
    // (the message is gone without the wait ending, closed or replaced by another: the plane's note is drawn again)
    if (g.toast && !g.toast.isConnected) { g.toast = null; requestRender('L'); }
    // (the message names what is missing now: when a part is done while it is up, its words give way to the next part's)
    else if (g.toast) { const words = g.toast.querySelector('span'), s = svGateStill(svGateMissing()); if (words && words.textContent !== s) words.textContent = s; }
    svGateSync();
    g.timer = setTimeout(svGateTick, SV_GATE_POLL_MS);
  }
