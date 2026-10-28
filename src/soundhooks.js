'use strict';
// The app's sound (notes/sound/DESIGN.md §2 and §4.1; the engine is src/sound.js): the cues, hearing the function under
// the pointer, loops, listening along curves and the keyboard probe (issue #20, phase 3: moved out of app.js). The app
// hands it what it needs once, SoundHooks.init(api) at start-up (src/app/16-sound.js, soundHooksApi): its functions and
// constants as they are, and the state it reassigns (S, sndP, drag, ...) as getters on api, read as A.S and so on.
// The engine handle and the shared state (SND, sndP, snd) stay the app's: the rest of the app reads them too.
const SoundHooks = (() => {
  let A = null;
  let C, EX, SND, SND_ICON_OFF, SND_ICON_ON, V, camOf, camS, curvePieces, derivIn, drawProbe, exOk, fnText,
    focusDeriv, focusF, hov, lGlobe, lLand, leftStage, leftView, loadExample, morph, morphLen, morphOn, morphState,
    nSteps, pickLand, pickSphere, pickSphereLeft, rGlobe, rImage, rangeF, rangeKey, rangeParts, render3D,
    requestRender, setReadouts, shapeNames, snd, solo, toast, touchUI, tourEmit, tourL, tourSndMine,
    updateDraftChips, zerosPolesTimed;
  const sndClamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sndOk = (w) => !!w && CX.isFin(w) && (w.re !== 0 || w.im !== 0);
  function soundCue(name, o) { if (A.sndP.on && SND) SND.play(name, o || {}); }
  // the "export ready" cue in one place: the save and copy successes call it (the export dialog is being rebuilt)
  function sndExportDone() { soundCue('exportDone'); }
  // with a toast that reports a failure, never instead of it
  function sndError() { soundCue('error'); }
  const sndToggleCue = (on) => soundCue(on ? 'toggleOn' : 'toggleOff');
  // short messages only, through one polite region (the result panels are not live regions)
  function sndSay(s) { const el = $('sndLive'); if (el) el.textContent = s; }
  function soundToggle() { if (!SND) return; tourSndMine(['on']); SND.toggle(); sndSay(SND.prefs().on ? $t('Sound on.') : $t('Sound off.')); }
  // Hear the function under the pointer: from the palette it also turns sound on
  function soundHear() {
    if (!SND) return;
    const on = !(A.sndP.on && A.sndP.sonify);
    tourSndMine(on && !A.sndP.on ? ['on', 'sonify'] : ['sonify']);
    if (on && !A.sndP.on) SND.set({ on: true, sonify: true }); else { SND.set({ sonify: on }); sndToggleCue(on); }
    sndSay(on ? (touchUI() ? $t('Hear the function on: hold a finger on a plane and slide it.') : $t('Hear the function on: hover a plane.')) : $t('Hear the function off.'));
  }
  // Esc (after the dispatcher's own Esc handling) and "Stop sound": everything playing stops now; the setting stays
  function soundStop() {
    if (!SND || !A.sndP.on) return;
    sndStopPlay(false);
    SND.hush();
    if (snd.voice) snd.voice.gate(false, undefined, 0.01);
    clearTimeout(snd.idleT);
    clearTimeout(snd.cv.idle); snd.cv.on = false; snd.cv.key = '';
    // Esc means silence now: a still probe stops following the function until the pointer moves or the keyboard probe
    // steps again (review snddef-1). The pointer's position goes too, so no layout change re-picks a point under a
    // still pointer (the merge, a view switch, a resize): sndPtr keeps it again from the next move.
    // v15.2 (review sound-1): the deformation may go on playing. Its motion bed is over for this play (a new Play arms
    // it again) and the last loop stops singing H_t until the next thing a person does (sndUnhush: a press, a key, a
    // move of the probe, Play, a scrub, a new loop)
    snd.morphArm = false;
    if (snd.mo) { SND.motionEnd(); snd.mo = null; }
    snd.cv.hushed = true;
    snd.rest = null; snd.run = null; snd.path = null; snd.cxy = null; snd.rp = null;
    if (snd.fcRaf) { cancelAnimationFrame(snd.fcRaf); snd.fcRaf = 0; }
  }
  // the next thing a person does after Esc lets the last loop sing again (review sound-1)
  function sndUnhush() { snd.cv.hushed = false; }
  function sndSync(s) {
    A.sndP = s;
    const on = !!s.on;
    for (const id of ['soundBtn', 'soundPh']) {
      const b = $(id);
      if (!b) continue;
      if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
      const ic = b.querySelector('.snd-ic');
      if (ic && ic.dataset.on !== String(on)) { ic.dataset.on = String(on); ic.innerHTML = on ? SND_ICON_ON : SND_ICON_OFF; }
      // (v16.5 UX70) a small wave on the button while Hear the function is on
      const hv = on && s.sonify ? 'on' : 'off';
      if (b.dataset.hear !== hv) { b.dataset.hear = hv; if (hv === 'on') b.setAttribute('aria-description', $t('Hear the function is on')); else b.removeAttribute('aria-description'); }
    }
    const ph = $('soundPh'); if (ph && ph.hidden === on) ph.hidden = !on;
    const top = $('top'); if (top) top.dataset.snd = on ? 'on' : 'off';
    const set = (id, k, v) => { const e = $(id); if (e && e[k] !== v) e[k] = v; };
    set('sndOn', 'checked', on); set('sndVol', 'value', String(Math.round(s.vol * 100)));
    const vo = $('sndVolOut'); if (vo) vo.textContent = Math.round(s.vol * 100) + ' %';
    set('sndUi', 'checked', !!s.ui); set('sndSnap', 'checked', !!s.snap); set('sndSnap', 'disabled', !s.ui);
    set('sndEv', 'checked', !!s.events); set('sndSo', 'checked', !!s.sonify);
    set('sndOffNote', 'hidden', on);
    const st = $('sndState');
    if (st) {
      const lat = s.latency ? $t(' · {ms} ms', { ms: Math.round(s.latency * 1000) }) : '';
      st.textContent = !s.supported ? $t('Audio engine: Web Audio is not available here')
        : s.audio === 'none' ? (on ? $t('Audio engine: starts with your next click or key') : $t('Audio engine: not started'))
          : $t('Audio engine: {audio}{choice}{lat}{choice2}{choice3}', { audio: $tx('audio', s.audio), choice: s.rate ? ' · ' + I18N.num(s.rate / 1000) + $t(' kHz') : '', lat, choice2: s.engine && s.engine !== 'none' ? ' · ' + $tx('audio', s.engine) : '', choice3: s.remembered ? '' : $t(' · settings not saved here') });
    }
    // the keyboard probe: the X plane takes the focus while sound is on
    if (A.paneL) {
      const cv = A.paneL.ocanvas;
      if (on && !cv.hasAttribute('tabindex')) { cv.tabIndex = 0; cv.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight Z O D Enter L'); }
      else if (!on && cv.hasAttribute('tabindex')) { cv.removeAttribute('tabindex'); cv.removeAttribute('aria-keyshortcuts'); }
    }
    if (!(on && s.sonify)) { sndVoiceOff(true); sndCurveOff(); }
    if (!(on && s.events)) sndStopPlay(false);
    // the pointer's position on the page, only while Hear F is on (sndPtr)
    const hear = on && !!s.sonify;
    if (hear !== snd.ptrOn) {
      snd.ptrOn = hear;
      if (hear) { document.addEventListener('pointermove', sndPtr, { capture: true, passive: true }); document.addEventListener('pointerup', sndPtrUp, true); }
      else { document.removeEventListener('pointermove', sndPtr, { capture: true }); document.removeEventListener('pointerup', sndPtrUp, true); snd.cxy = null; snd.press = null; }
    }
  }
  // the pointer's last position on the page (mouse and pen): a still pointer whose plane changes under it is found
  // again there (sndRepick). A press ends the probe's rest only once it moves more than 3 px (a drag or a pan, as the
  // app's own drags start): a plain click keeps it (review snddef-3)
  function sndPtrUp() { snd.press = null; }
  function sndPtr(e) {
    if (e.pointerType === 'touch') return;
    snd.cxy = [e.clientX, e.clientY];
    if (!e.buttons) { snd.press = null; return; }
    if (snd.press && Math.hypot(e.clientX - snd.press[0], e.clientY - snd.press[1]) > 3) { snd.press = null; if (snd.rest && snd.rest.src !== 'key') snd.rest = null; }
  }
  function sndInit() {
    if (!SND) { for (const id of ['soundBtn', 'soundMore']) { const b = $(id); if (b) b.hidden = true; } return; }
    snd.tracker = !!(Calc.argStep && Calc.orderAt);
    SND.subscribe(sndSync); sndSync(SND.state());
    document.addEventListener('pointerdown', sndUnhush, true);
    document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') sndUnhush(); }, true);
    $('soundBtn').addEventListener('click', soundToggle);
    $('soundPh').addEventListener('click', soundToggle);
    const pop = $('sndPop'), more = $('soundMore');
    const openPop = (on) => {
      pop.hidden = !on; more.setAttribute('aria-expanded', String(on));
      if (!on) return;
      // under its caret on a desktop; across the phone (CSS) when the caret sat in the More menu
      const r = more.getBoundingClientRect();
      if (r.width > 0 && window.innerWidth >= 768) { pop.style.top = Math.round(r.bottom + 6) + 'px'; pop.style.right = Math.max(12, Math.round(window.innerWidth - r.right)) + 'px'; }
      else { pop.style.top = ''; pop.style.right = ''; }
      $('sndOn').focus({ preventScroll: true });
    };
    more.addEventListener('click', () => openPop(pop.hidden));
    document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !(e.target.closest && e.target.closest('#soundMore'))) openPop(false); }, true);
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); openPop(false); more.focus(); } });
    $('sndOn').addEventListener('change', (e) => { tourSndMine(['on']); SND.set({ on: e.target.checked }); sndSay(e.target.checked ? $t('Sound on.') : $t('Sound off.')); });
    $('sndVol').addEventListener('input', (e) => SND.set({ vol: +e.target.value / 100 }));
    $('sndVol').addEventListener('change', () => SND.play('toggleOn', { force: true, audition: true }));
    for (const [id, k] of [['sndUi', 'ui'], ['sndSnap', 'snap'], ['sndEv', 'events'], ['sndSo', 'sonify']]) $(id).addEventListener('change', (e) => { tourSndMine([k]); SND.set({ [k]: e.target.checked }); sndToggleCue(e.target.checked); });
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) $('sndIos').hidden = false;
    // the keyboard probe on the X plane (focusable while sound is on), only when the plane got the focus from the
    // keyboard: after a click in it, V, L, D, O, Z … stay the tool and fit shortcuts
    A.paneL.ocanvas.addEventListener('pointerdown', () => { snd.ptrT = performance.now(); snd.kbd = false; }, true);
    // a press of a mouse or pen: where it began (sndPtr ends the rest when it becomes a drag or a pan). A pointer that
    // arrives over a plane without moving: the plane changed under it (the panes merged or split): re-pick
    for (const p of [A.paneL, A.paneR]) {
      p.ocanvas.addEventListener('pointerdown', (e) => { snd.press = e.pointerType !== 'touch' ? [e.clientX, e.clientY] : null; }, true);
      p.ocanvas.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch' && !e.buttons) sndRelayout(); });
    }
    A.paneL.ocanvas.addEventListener('focus', () => { snd.kbd = performance.now() - snd.ptrT > 400; });
    A.paneL.ocanvas.addEventListener('keydown', sndKey);
    A.paneL.ocanvas.addEventListener('blur', () => { snd.kbd = false; if (snd.kz && !snd.kloop) { snd.kz = null; A.probe = null; setReadouts(null); sndRender(); sndVoiceOff(false); } });
    // a wheel zoom moves the plane under a still pointer: probe-driven event cues wait 250 ms (pans, pinches, orbits
    // and tweens are caught by the view key in sndHover)
    for (const p of [A.paneL, A.paneR]) p.ocanvas.addEventListener('wheel', () => { if (A.sndP.on) snd.gestT = performance.now(); }, { passive: true });
  }
  const sndRender = () => requestRender('OL', 'OR', rGlobe() ? 'R' : null, lGlobe() || lLand() ? 'L' : null);

  // ---- Mathematical events: the deformation ----
  // the swell once per play the user starts, the arrival once per such play (never on loop repeats)
  function sndMorphStart() { if (!A.sndP.on || !SND) return; sndUnhush(); snd.morphArm = true; SND.play('morphStart', {}); if (!(morph.T > 0)) snd.run = null; }
  function sndMorphArrive() {
    if (!snd.morphArm) return;
    snd.morphArm = false;
    if (snd.mo && SND) { SND.motionEnd(); snd.mo = null; }
    soundCue('morphEnd', { vel: sndClamp(0.6 * Math.sqrt(2 / Math.max(0.2, A.S.morphSecs || 1.6)), 0.35, 0.9) });
  }
  // scrubbing (v15.1): Sound.scrub decides from the drag's speed: soft detents at each 0.05 of t / morphLen() while
  // slow, a soft band that follows the speed while fast; t = 0, ½, 1 soft keys
  function sndScrub(T0, T1) {
    // (the slider's input sets morph.T right after this call: the tone follows H_t on the next frame; a person's step)
    snd.userT = performance.now();
    sndUnhush();
    soundFunctionChanged('t');
    if (!A.sndP.on || !A.sndP.events || !SND) return;
    const m = morphLen() || 1;
    SND.scrub(T0 / m, T1 / m);
  }
  // the hand let go of the slider: the scrub's air fades (DESIGN v2 §3)
  function sndScrubEnd() { if (SND) SND.scrubEnd(); }
  // the motion bed (DESIGN v2 §4): while a play the user started runs its first pass, the scrub's air follows the
  // playback (t / length and its rate); it fades at the arrival or a pause. Off while Hear the function is on (the harp
  // and the loop's note follow H_t there). One line in frame().
  function sndMotion() {
    if (!SND || !A.sndP.on || !A.sndP.events) return;
    const m = morphLen() || 1, now = performance.now();
    if (!snd.morphArm || !morph.playing || !morph.open || A.sndP.sonify) { if (snd.mo) { SND.motionEnd(); snd.mo = null; } return; }
    const mo = snd.mo || (snd.mo = { T: morph.T, t: now, rate: 0 });
    const dt = (now - mo.t) / 1000;
    if (dt > 0) { const r = Math.abs(morph.T - mo.T) / m / dt; mo.rate += (r - mo.rate) * Math.min(1, dt / 0.08); }
    mo.T = morph.T; mo.t = now;
    SND.motion(morph.T / m, mo.rate);
  }

  // ---- Hear the function under the pointer ----
  // the painted function at a point of the X plane (H_t while the deformation is open), as the readouts show it
  // (homView().F without its second state, the image's, which the probe never uses: review snddef-10)
  // (v16, SPEC 9: the merged plane's probe with a bracket's pre only reads its point as u in w_{a-1} and plays G_t; with a
  // post it is silent, sndMove)
  const sndMergedBase = () => { const p = rangeParts(); return p && !p.post.length ? p.a - 1 : null; };
  const sndF = (src) => (morphOn() ? (src === 'merged' && sndMergedBase() != null ? morphState(true, sndMergedBase()).F : morphState(true).F) : focusF());
  const sndFKey = () => `${A.chainSig[nSteps()]}|${A.S.focus}|${morph.open ? morph.T : '-'}|${A.S.view.main}|${A.S.homAll ? 1 : 0}|${rangeKey()}`;
  // what the probe's function is made of, apart from the chain and t: a change is a new start (nearest pitch class)
  const sndFrameKey = () => `${A.S.focus}|${morph.open ? 1 : 0}|${A.S.view.main}|${A.S.homAll ? 1 : 0}|${rangeKey()}`;
  // the view of the plane the probe is on: a change is a view gesture (src 'merged': the deformation plane or globe
  // of X → Y; otherwise X's plane, globe or relief). solo() changes when the deformation merges X → Y into one plane,
  // so a probe of the hidden X plane stops there. needle: what a still probe depends on: on the relief and on X's globe
  // it is the needle, a point of X that stays put while the camera refits (opening the deformation refits the relief).
  // A plane's key holds its pane's size too: a pane that shrinks or grows under a still pointer (the transport bar,
  // a merge, another view) moves the plane under it as a fit does (review snddef-2/8)
  function sndVKey(src, needle) {
    const cam = (c) => (c ? `${c.yaw}|${c.pitch}|${c.dist}|${c.tx}|${c.ty}` : '');
    if (src === 'merged') return `M|${solo()}|${A.paneR.w}|${A.paneR.h}|` + (rGlobe() ? cam(camS) : `${V.right.cx}|${V.right.cy}|${V.right.s}`);
    if (lLand() || lGlobe()) return `L|${solo()}|` + (needle ? A.S.view.main : cam(camOf('L')));
    const v = leftView(); return `P|${solo()}|${A.paneL.w}|${A.paneL.h}|${v.cx}|${v.cy}|${v.s}`;
  }
  // H at transport time T: the app's own homView() with morph.T set for the call (the one place that knows how the
  // transport builds H_T; DEFORMATION.md)
  function sndFAt(T) {
    const T0 = morph.T;
    morph.T = T;
    try { return sndF(); } finally { morph.T = T0; }
  }
  function sndVoice(kind) {
    if (snd.voice && snd.kind !== kind) { snd.voice.stop(); snd.voice = null; }
    if (!snd.voice) { snd.voice = SND.heightVoice(); snd.kind = kind; }
    return snd.voice;
  }
  function sndVoiceOff(release) {
    clearTimeout(snd.idleT);
    if (snd.voice) {
      if (release) { clearTimeout(snd.sleepT); snd.voice.stop(); snd.voice = null; }
      else { snd.voice.gate(false); clearTimeout(snd.sleepT); snd.sleepT = setTimeout(() => { if (snd.voice && !snd.loop) { snd.voice.stop(); snd.voice = null; } }, 6000); }
    }
    snd.last = null; snd.near = 0; snd.rest = null; snd.run = null;
  }
  // the hover paths of onMove: z under the pointer (x: its CSS px in its pane); src 'pointer' | 'loop' | 'key' |
  // 'merged' (the deformation plane of X → Y, DEFORMATION.md: its point read as a point of X, where the paths
  // t → H_t(z) start; none on a focused d/dz step, whose plane is not X's). (v16.5 UX73) A playback ("listen along")
  // plays to its end, as the melody always did: a pointer move no longer cuts it (it ended at 4 px, silently, and the
  // menu item that starts it sits over the plane); Stop in its chip, Esc or another action end it.
  function sndMove(x, y, z, src) {
    if (!A.sndP.on) return;
    const p = snd.play;
    if (src !== 'key') snd.px = [x, y];
    if (p && src !== 'key') return;
    if (src === 'loop' && !snd.loop && A.sndP.sonify) snd.loop = { phi: 0, k: 0, jumps: 0, pc0: snd.phi - Math.floor(snd.phi), live: true };
    // (silent too when the bracket holds a live d/dz: its segment is a line between two functions of z, so a point of
    // w_{a-1} is not in G_t's domain from that step on: review v16 math-3)
    if (src === 'merged') { const rp = rangeParts(); if (focusDeriv() || (rp && (rp.post.length || derivIn(rp.a - 1, rp.b)))) z = null; }
    if (z) sndHover(z, x, src); else sndHoverOff();
  }
  function sndHoverOff() {
    if (!A.sndP.on || !SND) return;
    if (snd.loop && snd.loop.live && A.drag && A.drag.mode === 'draw') return;
    snd.loop = null; snd.collide = '';
    sndVoiceOff(false);
  }
  // The function under a still probe changed (the deformation plays or is scrubbed, a zero is dragged, a step's
  // parameter is edited; v15: a shared number's slider or Play): the tone re-evaluates at the probe's point on the next
  // frame, once a frame however often this is called (DEFORMATION.md). kind:
  //   't'               only the transport's t moved (tracked exactly along t);
  //   { at: (u) => F_u } a path from the previous function (u = 0) to the new one (u = 1), tracked exactly as t is
  //                     (several in a frame are followed one after another; v15: a shared number c0 → c1 gives
  //                     at = (u) => F with c = c0 + u (c1 − c0));
  //   nothing           a change without a path: the nearest turn (exact while arg F moves less than half a turn a
  //                     frame), no cut tick. One such call makes the whole frame's change pathless, so a change is
  //                     reported in one form only (review snddef-10).
  // Free while sound or Hear F is off.
  function soundFunctionChanged(kind) {
    if (!A.sndP.on || !A.sndP.sonify || !SND) return;
    if (kind !== 't') {
      snd.userT = performance.now();
      if (kind && typeof kind.at === 'function') { if (snd.path !== false) (snd.path || (snd.path = [])).push(kind.at); }
      else { snd.fcGen++; snd.path = false; }
    }
    if (!snd.fcRaf && (snd.rest || (snd.lastLoop && morph.open))) snd.fcRaf = requestAnimationFrame(sndRetrack);
  }
  function sndRetrack() {
    snd.fcRaf = 0;
    sndCurveLive();
    const r = snd.rest;
    if (!A.sndP.on || !A.sndP.sonify || !SND || !snd.tracker || snd.play || !r || r.src === 'loop') { snd.path = null; return; }
    if (r.src === 'key' && !snd.kz) { snd.path = null; return; }
    // the plane under a still pointer moved (a fit, a zoom, a resize) or was replaced: the probe is the point now under
    // the pointer (sndRepick, after this frame is drawn: a fresh start, no cue for 250 ms). During a pan (a press that
    // moved) it waits for the pointer. (The keyboard probe's plane moved: it waits for the next step.)
    if (sndVKey(r.src, true) !== r.nk) { snd.path = null; if (r.src !== 'key') sndRelayout(); return; }
    sndHover(r.z, r.px, r.src, true);
  }
  // The plane under a still pointer changed (the deformation merged X → Y into one plane or split it again; another
  // main view; a pane resized; a fit): the tone goes on from the point under the pointer in the plane now there, as a
  // fresh start (the nearest turn, no cue: the view key starts the 250 ms hush) (review snddef-2, -8). The point is
  // read once the new layout is drawn (sndFrame, at the end of a frame), never from the old one: the panes take their
  // new size in the ResizeObserver after the layout (onPaneResize, which calls this again), and the relief's picker
  // reads the camera and heights of the last frame drawn (render3D.pick).
  function sndRelayout() {
    if (!A.sndP.on || !A.sndP.sonify || !SND || !snd.cxy) return;
    if (!snd.rp) snd.rp = { n: 0, pick: render3D.pick };
    requestRender('OL');
  }
  // called at the end of every frame (one line in frame()): the waiting re-pick, once the pane under the pointer has
  // its new size and, on the relief, a frame was drawn since the change; given up after 30 frames
  function sndFrame() {
    const q = snd.rp;
    if (!q) return;
    if (!A.sndP.on || !A.sndP.sonify || !SND || !snd.cxy) { snd.rp = null; return; }
    const el = document.elementFromPoint(snd.cxy[0], snd.cxy[1]);
    const pane = el && el === A.paneL.ocanvas ? A.paneL : el && el === A.paneR.ocanvas ? A.paneR : null;
    let ready = true;
    if (pane) {
      const b = pane.canvas.getBoundingClientRect();
      if (Math.abs(b.width - pane.w) > 0.5 || Math.abs(b.height - pane.h) > 0.5) ready = false;
      else if (pane === A.paneL && lLand()) { const pk = render3D.pick; ready = !!pk && pk !== q.pick && pk.w === pane.w && pk.h === pane.h; }
    }
    if (!ready && ++q.n < 30) { requestRender('OL'); return; }
    snd.rp = null;
    if (ready) sndRepick();
  }
  function sndRepick() {
    if (!A.sndP.on || !A.sndP.sonify || !SND || !snd.cxy || snd.play || A.drag || snd.kz || snd.press) return;
    const el = document.elementFromPoint(snd.cxy[0], snd.cxy[1]);
    const pane = el && el === A.paneL.ocanvas ? A.paneL : el && el === A.paneR.ocanvas ? A.paneR : null;
    if (!pane) return;
    const b = pane.ocanvas.getBoundingClientRect(), x = snd.cxy[0] - b.left, y = snd.cxy[1] - b.top;
    const r = snd.rest, src = pane === A.paneL ? 'pointer' : 'merged';
    if (pane === A.paneL ? solo() === 'R' : !(solo() === 'R' && morphOn())) return;
    // the probe's plane and view are the same: on the relief and X's globe the probe is the needle, a point of X that
    // stays put while the camera refits (opening the deformation refits the relief: no re-pick, review snddef-5); on a
    // plane, the same point
    const same = r && r.src === src && sndVKey(src, true) === r.nk;
    if (same && pane === A.paneL && (lLand() || lGlobe())) return;
    let z = null;
    if (pane === A.paneL) {
      if (lLand()) z = pickLand(x, y);
      else if (lGlobe()) z = typeof pickSphereLeft === 'function' ? pickSphereLeft(x, y) : null;
      else { pane.setView(leftView()); z = pane.s2w(x, y); }
    } else if (rImage()) { pane.setView(V.right); z = pane.s2w(x, y); } else z = pickSphere(pane, camS, x, y);
    if (!z || (same && r.z.re === z.re && r.z.im === z.im)) return;
    sndMove(x, y, z, src);
  }
  // The merged deformation plane: the probe's point p is a point of X and the tone is H_t(p), the head of the path
  // t → H_t(p) that starts under the pointer. That path is drawn (thin, the probe's colour) with the probe's cross at
  // its head, so the tone describes a point on screen (review snddef-7). Called by renderOverlays; the path is skipped
  // when its 40 evaluations would cost more than 1 ms.
  function sndOverlay() {
    const r = snd.rest;
    if (!A.sndP.on || !A.sndP.sonify || !r || r.src !== 'merged' || !snd.voice || !snd.voice.sounding() || A.drag || solo() !== 'R' || !morphOn() || !rImage()) return;
    const pane = A.paneR, T1 = morph.T, p = r.z;
    pane.setView(V.right);
    let head = null;
    try { head = sndFAt(T1)(p); } catch (e) { head = null; }
    if (!head || !CX.isFin(head)) return;
    if (snd.perEval * 40 < 1 && T1 > 0) {
      const ctx = pane.octx, N = 40;
      ctx.save(); ctx.lineWidth = 1.25; ctx.strokeStyle = A.TH.probe; ctx.globalAlpha = 0.85; ctx.lineJoin = 'round';
      ctx.beginPath();
      let pen = false, last = null;
      for (let i = 0; i <= N; i++) {
        let w = null;
        try { w = i === N ? head : sndFAt(T1 * i / N)(p); } catch (e) { w = null; }
        const q = w && CX.isFin(w) ? pane.w2s(w) : null;
        // broken where H_t(p) is not finite or jumps (a pole or a cut on the way)
        if (!q || Math.abs(q[0]) > 2e4 || Math.abs(q[1]) > 2e4 || (last && Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.5 * (pane.w + pane.h))) { pen = false; last = null; continue; }
        if (pen) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); pen = true; }
        last = q;
      }
      ctx.stroke(); ctx.restore();
    }
    drawProbe(pane, head, A.TH.probe);
  }
  // The probe (DESIGN §2.4, §2.5): arg F tracked exactly along the pointer's segment (Calc.argStep), so the voice's
  // pitch class never runs backwards and a loop's turns ring as bells; a branch cut is a tracker that cannot converge
  // while F stays finite and non-zero. Within a per-event budget of calls of F (about 3 ms, from the measured cost of
  // a call): when it runs out the voice holds and no cue fires. Event cues are suppressed during and 250 ms after a
  // view gesture. While the deformation plays or is scrubbed, the step is a path in (z, t) (Sound.pathStep): exact in
  // t too, so H_t's zeros, poles and cuts sweeping across a still probe ring as the pointer's do (DEFORMATION.md).
  // fn: a re-evaluation because the function changed (soundFunctionChanged), not because the probe moved.
  function sndHover(z, px, src, fn) {
    if (!A.sndP.on || !A.sndP.sonify || !SND || !snd.tracker || !z) return;
    const t0 = performance.now();
    const F = sndF(src), fk = sndFrameKey(), ck = `${A.chainSig[nSteps()]}#${snd.fcGen}`, vk = sndVKey(src);
    const T = morph.open ? morph.T : null, merged = src === 'merged';
    const pan = sndClamp(0.4 * (2 * px / Math.max(1, merged ? A.paneR.w : A.paneL.w) - 1), -0.4, 0.4);
    if (!fn) { snd.rest = { z, src, px, nk: sndVKey(src, true) }; sndUnhush(); }
    // a view change: cues wait 250 ms, and the track starts afresh, since the probe's point moved with the view.
    // Except under a still needle (the relief's or X's globe's camera refitted while the function changes, as when the
    // deformation opens on the Landscape): the point is the same, so the track goes on, and the swap's glide with it
    // (review snddef-5: a fresh start there cut the 0.15 s glide after one frame)
    if (vk !== snd.vKey) { if (snd.vKey) snd.gestT = t0; snd.vKey = vk; if (!(fn && snd.last && z.re === snd.last.re && z.im === snd.last.im)) snd.last = null; }
    // swap: the function under a still probe was replaced (the transport opened or closed: F ↔ H_t; the focus; one
    // after another ↔ all at once), or t ran back while playing (a loop repeat, Play again from the end). No path
    // joins the two: the voice glides to the nearest turn (never a path back, no cue, a new run)
    let swap = !!snd.last && T != null && snd.T != null && T < snd.T && morph.playing;
    if (fk !== snd.fKey) { if (fn && snd.last && snd.fKey) swap = true; else snd.last = null; snd.fKey = fk; snd.near = 0; }
    if (swap) snd.run = null;
    // the paths of the changes since the last evaluation (soundFunctionChanged({ at })), followed in turn; with t
    // moving too, no single path joins the two functions: the nearest turn
    const dT = T !== snd.T, paths = Array.isArray(snd.path) && snd.path.length ? snd.path : null;
    snd.path = null;
    const gen = (ck !== snd.cKey && !paths) || (paths && dT) || swap;
    const moved = !!snd.last && (z.re !== snd.last.re || z.im !== snd.last.im);
    if (fn && snd.last && !gen && !dT && !paths && !moved) return;   // nothing new
    snd.cKey = ck;
    const T0 = snd.T;
    snd.T = T;
    if (fn) snd.fcN++;
    const quiet = t0 - snd.gestT < 250 || !!snd.play;
    const height = lLand();
    let g = null;
    try { g = F(z); } catch (e) { g = null; }
    // the 3 ms hold twice: a count of calls from the measured cost of one call, and a wall-clock deadline checked
    // inside the tracker (performance.now() may tick in 0.1 ms steps, too coarse to time one event's few calls)
    const deadline = t0 + 3;
    let jump = false, seat = false, budget = Math.max(24, Math.min(6000, Math.floor(3 / snd.perEval)));
    // the probe's speed in px per ms (how hard a zero's ping or a contour's bar is struck; DESIGN v2 §1.3)
    const vs = merged ? V.right.s : leftView().s, dtp = t0 - (snd.pT || 0);
    snd.pT = t0;
    if (!fn) snd.spd = moved && dtp > 0 && dtp < 250 ? CX.abs(CX.sub(z, snd.last)) * vs / dtp : 0;
    // the run: arg's turns since the function under the probe began to change (bells, as a loop's). A run of the
    // transport's t lasts while the transport is open and the probe stays: a slow scrub or a pause keeps it (review
    // snddef-6). It ends at a swap, a new chain value, a play started from 0 (sndMorphStart) or a move of the probe
    // while nothing plays. Any other run ends 1.6 s after the function stops changing (the tone's own stillness).
    const fnMoved = (gen || dT || !!paths) && !swap, tMove = dT && !gen;
    if (snd.run && (snd.run.tp ? gen || (!fn && moved && !morph.playing) : t0 - snd.run.t > 1600)) snd.run = null;
    if (snd.last && sndOk(g) && sndOk(snd.g)) {
      let r;
      // a new chain value (or a swap): no path joins the two functions, so the nearest turn (exact while it moves
      // less than half a turn a frame); t alone: the exact path in (z, t); the pointer alone: the exact segment in z
      if (gen) r = { d: Math.atan2(snd.g.re * g.im - snd.g.im * g.re, snd.g.re * g.re + snd.g.im * g.im), exact: false, why: 'chain', evals: 0 };
      else if (dT) r = SND.pathStep(Calc.argStep, sndFAt, snd.last, T0, snd.g, z, T, g, { budget, deadline });
      else if (paths) {
        // one path after another, each from u = 0 to 1 (the probe moves along the last one)
        r = { d: 0, exact: true, why: '', evals: 0 };
        let za = snd.last, ga = snd.g;
        for (let i = 0; i < paths.length; i++) {
          const lastP = i === paths.length - 1, zb = lastP ? z : za;
          let gb = g;
          if (!lastP) { try { gb = paths[i](1)(zb); } catch (e) { gb = null; } r.evals++; }
          if (!sndOk(gb)) { r = { d: 0, exact: false, why: 'budget', evals: r.evals }; break; }
          const q = SND.pathStep(Calc.argStep, paths[i], za, 0, ga, zb, 1, gb, { budget: budget - r.evals, deadline });
          r.d += q.d; r.evals += q.evals;
          if (!q.exact && r.why !== 'budget') { r.exact = false; r.why = q.why; }
          if (q.why === 'budget') break;
          za = zb; ga = gb;
        }
      } else r = Calc.argStep(F, snd.last, snd.g, z, g, { budget, deadline });
      const dt = performance.now() - t0;
      // the cost of a call: total time over total calls, across events (decaying), so the clock's steps average out.
      // A path step (t or a parameter) makes few calls (2 to 6 a frame): it counts too, and the estimate is used from 15
      // decayed calls (about 15 frames), or a heavy chain's cost is never learnt (review snddef-10)
      if (r.evals >= 4 || ((dT || paths) && r.evals >= 1)) { const c = snd.cost || (snd.cost = { dt: 0, n: 0 }); c.dt = 0.95 * c.dt + dt; c.n = 0.95 * c.n + r.evals + 1; if (c.n > 15) snd.perEval = Math.max(2e-5, c.dt / c.n); }
      budget -= r.evals;
      // over budget: the voice holds where it is and nothing fires; the next event starts afresh
      if (!r.exact && r.why === 'budget') { snd.last = null; snd.run = null; return; }
      if (!r.exact && r.why === 'jump') { jump = true; if (!quiet) SND.play('cut', { pan }); }
      if (fnMoved && !snd.run) snd.run = { phi: 0, k: 0, jumps: 0, pc0: snd.phi - Math.floor(snd.phi), t: t0, tp: tMove };
      else if (snd.run && tMove) snd.run.tp = true;
      snd.phi += r.d / TAU;
      if (snd.loop) { snd.loop.phi += r.d / TAU; if (jump) snd.loop.jumps++; sndTurnBells(snd.loop, pan); }
      // (a run under a loop being drawn counts silently: one bell per turn, the loop's)
      if (snd.run) { if (fnMoved) snd.run.t = t0; snd.run.phi += r.d / TAU; if (jump) snd.run.jumps++; sndTurnBells(snd.run, pan, !!snd.loop); }
      // Height: |F| crossed a drawn level line e^(2πk/S): one tick per line, queued by the engine, never dropped
      // (not across a swap: no path joins the two functions)
      if (height && !quiet && !swap) {
        const q = TAU / (A.S.sectors || 12), k0 = Math.floor(Math.log(CX.abs(snd.g)) / q), k1 = Math.floor(Math.log(CX.abs(g)) / q);
        if (k0 !== k1 && Number.isFinite(k0) && Number.isFinite(k1)) {
          const up = k1 > k0, n = Math.min(24, Math.abs(k1 - k0));
          const vel = fn ? undefined : sndClamp(0.3 + 0.3 * Math.log2(1 + snd.spd), 0.3, 0.85);
          for (let j = 1; j <= n; j++) SND.tick({ k: up ? k0 + j : k0 - j + 1, pan, vel });
        }
      }
    } else if (sndOk(g)) {
      // a fresh start (a new function, a view change, a lost track): the nearest equivalent pitch class
      const a = Math.atan2(g.im, g.re) / TAU;
      snd.phi = a + Math.round(snd.phi - a);
      snd.run = null;
      seat = true;
      if (snd.voice) snd.voice.reset();
    }
    snd.last = z; snd.g = g;
    if (!sndOk(g)) return;   // F is 0 or ∞ here: the harp re-seats on the next point
    snd.ld = 0;
    if (!quiet && budget > 48 && performance.now() < deadline) sndNear(F, z, g, pan, budget, deadline, vs, fn); else if (quiet) snd.near = 0;
    const la = Math.log(CX.abs(g));
    // (the merged plane draws the head H_t(p) of the probe's path: sndOverlay)
    if (merged) requestRender('OR');
    if (!height) {
      // the phase harp (v15.2, notes/sound/hearf option 2): silent while still; a plucked note at each of the five
      // phase lines arg F crosses (D E F♯ A B; the low Ds counted up minus down are the winding number). A fresh start,
      // a cut, a swap (no path joins the two functions), the 250 ms after a view gesture, and the keyboard probe while
      // the transport plays by itself (it does not talk over a screen reader) re-seat it without a note. Within 8 px of
      // a zero or pole, while the pointer moves (a trembling hand), only the Ds sound, each with its direction's fifth.
      const keyQuiet = src === 'key' && !snd.kloop && fn && t0 - snd.userT > 280;
      const dt = snd.hT ? (t0 - snd.hT) / 1000 : 0.016;
      snd.hT = t0;
      // (a moving pointer, mouse or finger: the band is what 2.5 px of it turn arg F, so a hand held still near a zero
      // plucks nothing (a 9 Hz tremor of ±1.5 px: 0 notes in 10 s at 6 to 40 px from a zero, was up to 149), review
      // sound-3; the keyboard probe's steps and a still probe under a changing F keep 7.5°)
      const band = !fn && src !== 'key' && snd.ld > 0 ? snd.ld * 2.5 / vs / TAU : 0;
      if (seat || jump || swap || quiet || keyQuiet) SND.harpReset(snd.phi);
      else {
        // (v16.4) a low D counted up or down: the tour's Phase lines are strings task
        const hs0 = tourL['harp-turn'] ? SND.harpState() : null;
        SND.harp(snd.phi, { ln: la, pan, dt, h: band, shaky: !!snd.near && moved && !fn, still: !!fn && !moved });
        if (hs0) { const hs1 = SND.harpState(); if (hs1.up > hs0.up) tourEmit('harp-turn', { dir: 1 }); if (hs1.down > hs0.down) tourEmit('harp-turn', { dir: -1 }); }
      }
      // a loop being drawn: the harp's state at its first point (harpClose at the release); a re-seat later in the loop
      // (a cut, a view gesture) leaves its count as it is
      const lp = snd.loop;
      if (lp) { const hc = SND.harpState().c; if (lp.hc === undefined && hc !== null) lp.hc = hc; else if (seat || jump || swap || quiet || keyQuiet || hc === null) lp.hc = null; }
      return;
    }
    // the Landscape: the Height voice (an organ on the pentatonic staircase of |F|)
    const keyQuiet = src === 'key' && !snd.kloop && fn && t0 - snd.userT > 280;
    if (keyQuiet && !snd.voice) return;
    const v = sndVoice('height');
    if (!v) return;
    v.set(la, pan, undefined, A.S.sectors || 12, swap ? 0.15 : 0);
    if (keyQuiet) return;
    v.gate(true);
    // stillness: the tone fades after 1.6 s without movement (of the probe or of the function under it) and is
    // released after 6 s; a keyboard step sounds a 280 ms sample, so the tone does not talk over a screen reader
    clearTimeout(snd.idleT);
    const still = src === 'key' && !snd.kloop ? 280 : 1600;
    snd.idleT = setTimeout(() => { if (snd.voice && !snd.loop) snd.voice.gate(false, undefined, src === 'key' ? 0.04 : 0.35); }, still);
    clearTimeout(snd.sleepT);
    snd.sleepT = setTimeout(() => { if (snd.voice && !snd.loop) { snd.voice.stop(); snd.voice = null; } }, 6000);
  }
  // a zero or a pole within 8 px, with its order by the argument principle on a 16-gon (Calc.orderAt): exact for any
  // m, and a branch point gives none. Only tested where |F'/F| > 1/(8 px); held while the 14 px circle holds any zero or
  // pole (a second one in the ring between 8 and 14 px no longer re-arms it every other frame). An order m ≥ 2 only
  // when the 4 px circle agrees (two simple zeros 6 px apart are not a double zero: the nearer one's order is used, or,
  // with none within 4 px, nothing yet and a new test next frame); so "order m" means m zeros within 4 px, the
  // screen's resolution. A count above 8 is no landmark, held (an essential singularity: sin(1/z) gives counts of 20
  // to 40 there). Spoken only when
  // the engine played the ping (the cluster cue: "Many zeros or poles"), never the same words twice within 1.5 s
  // (review snddef-4). (vs: px per unit of the probe's plane)
  function sndNear(F, z, g, pan, budget, deadline, vs, fn) {
    const px = 1 / Math.max(1e-300, vs), hh = 0.5 * px;
    let ld = 0;
    try { const a = F(C(z.re + hh, z.im)), b = F(C(z.re - hh, z.im)); ld = CX.abs(CX.sub(a, b)) / (2 * hh) / CX.abs(g); } catch (e) { ld = 0; }
    // (|F'/F| here, per unit: the harp's band, sndHover)
    snd.ld = Number.isFinite(ld) ? ld : 0;
    if (snd.near) { if (!(ld > 1 / (14 * px)) || !Calc.orderAt(F, z, 14 * px, { budget, deadline })) snd.near = 0; return; }
    if (!(ld > 1 / (8 * px))) return;
    const m8 = Calc.orderAt(F, z, 8 * px, { budget, deadline });
    if (!m8) return;
    if (Math.abs(m8) > 8) { snd.near = m8; return; }
    let m = m8;
    if (Math.abs(m) >= 2) { const m4 = Calc.orderAt(F, z, 4 * px, { budget, deadline }); if (m4 !== m) { if (!m4 || Math.abs(m4) > Math.abs(m)) return; m = m4; } }
    snd.near = m;
    // struck harder when approached faster (a still probe under a changing function: the default)
    const vel = fn ? undefined : sndClamp(0.35 + 0.35 * Math.log2(1 + snd.spd), 0.35, 0.95);
    const played = SND.play(m > 0 ? 'zero' : 'pole', { order: Math.abs(m), pan, vel });
    if (!played) return;
    sndSayOnce(played === 'dense' ? $t('Many zeros or poles') : m > 0 ? $t('Zero of order {m} here.', { m: Math.abs(m) }) : $t('Pole of order {m} here.', { m: Math.abs(m) }));
  }
  // the probe's speech: never the same words twice within 1.5 s
  function sndSayOnce(text) {
    const now = performance.now();
    if (snd.said && snd.said[0] === text && now - snd.said[1] < 1500) return;
    snd.said = [text, now];
    sndSay(text);
  }
  // the turns of a loop being drawn (or a run while the function changes): counted (a turn back must reach the
  // previous integer). v15.2: no bell; the harp's low D is the turn (notes/sound/hearf OPTIONS §3)
  function sndTurnBells(L) { SND.turns(L, null); }
  // the preimages of a hovered w collide (a preimage of multiplicity ≥ 2): never on a change of their count
  function sndCollide() {
    if (!A.sndP.on || !A.sndP.sonify || !SND) return;
    const m = hov.list && hov.list.find((r) => r.mult >= 2);
    const key = m ? `${m.z.re.toFixed(4)},${m.z.im.toFixed(4)}` : '';
    if (key && key !== snd.collide) SND.play('collide', {});
    snd.collide = key;
  }

  // ---- loops, "listen along a curve" and curves that sing ----
  // a closed loop released (the Lasso, or Enter with the keyboard probe), in X plane coordinates [[x, y], …]: its
  // winding number exactly (Calc.argPrinciple: zeros minus poles inside); the first loop of a page plays itself back
  // (the harp along it, then its note); later loops sing their note W (with Hear the function on; notes/sound/hearf
  // option 4), or sound palette B's |W| pings, and wait for L or the curve's menu
  function sndLoopDone(pts) {
    const lp = snd.loop;
    snd.loop = null;
    if (!A.sndP.on || !SND || !pts || pts.length < 3) return;
    snd.lastLoop = { pts: pts.slice(), closed: true };
    sndUnhush();
    if (!A.sndP.events) return;
    let r;
    try { r = Calc.argPrinciple(sndF(), pts, 0, { budget: 120000 }); } catch (e) { r = { ok: false, turn: NaN, winding: 0 }; }
    if (!Number.isFinite(r.turn)) { SND.play('cut', { tier: 'events' }); sndSay($t('No winding number: F jumps, vanishes or is infinite on the loop.')); return; }
    const W = r.winding, say = $t('Winding number {W}: zeros minus poles inside, counted with multiplicity.', { W });
    // the harp under the pointer closes the loop: its low Ds come to exactly W (review math-4)
    if (lp && Number.isInteger(lp.hc) && A.sndP.sonify && Number.isInteger(W)) { SND.harpClose(lp.hc + 5 * W, { pan: 0 }); SND.harpReset(snd.phi); }
    sndSay(say);
    // (one message: a polite live region would read only the last of two)
    if (!snd.auto && !matchMedia('(prefers-reduced-motion: reduce)').matches) { snd.auto = true; if (sndListen(pts, true, say)) return; }
    if (A.sndP.sonify && sndSingLoop(pts, W)) return;
    SND.play('loopDone', { w: W });
  }
  // a closed curve sings its winding number W as one note (harmonic 4 + W of D3: D5 for 0, F♯5 for 1, A5 for 2, A4
  // for −1 …): its phase along the curve, sampled evenly in arc length and tracked exactly (sndSample), played as one
  // period of a waveform (Sound.curveAmps). o: {at (s from now), tag}. False when it cannot (F too costly, a cut)
  function sndSingLoop(pts, W, o = {}, Sm) {
    // (a W with no harmonic of D3, 4 + W outside 1 … 24: no note, so the caller plays the |W| pings: review sound-2)
    if (!SND || !snd.tracker || !Number.isInteger(W) || !SND.singable(W)) return false;
    Sm = Sm || sndSample(sndF(), pts, true);
    if (!Sm || Sm.cuts.length) return false;
    const n = Sm.phi.length;
    if (Math.abs(Sm.phi[n - 1] - Sm.phi[0] - W) > 0.05) return false;
    const a = SND.curveAmps(Sm.phi.subarray(0, n - 1), W);
    snd.sang = W;
    return SND.sing(a.A, a.n0, { mode: 'release', tier: 'events', at: o.at || 0, tag: o.tag });
  }
  // the last loop sings while the function changes under it (the deformation plays or is scrubbed, an edit), with Hear
  // the function on: once a frame (sndRetrack), the loop sampled at 256 points under H_t, arg tracked exactly between
  // them within 2.5 ms (over that, the note holds). Its note W can only change when a zero or pole of H_t crosses the
  // loop (homotopy invariance): there W is undefined for an instant and the note holds, then steps. It fades 0.9 s
  // after the function stops changing.
  function sndCurveLive() {
    const L = snd.lastLoop, cv = snd.cv;
    // (after Esc: silent until the next thing a person does, review sound-1)
    if (!A.sndP.on || !A.sndP.sonify || !SND || !snd.tracker || !L || !L.closed || snd.play || !morph.open || cv.hushed) { sndCurveOff(); return; }
    const key = `${A.chainSig[nSteps()]}|${morph.T}|${A.S.focus}|${A.S.homAll ? 1 : 0}|${snd.fcGen}|${L.pts.length}`;
    if (key === cv.key) return;
    cv.key = key;
    const t0 = performance.now();
    let r = null;
    try { r = sndCurveW(sndF(), L.pts, 256, t0 + 2.5); } catch (e) { r = null; }
    if (r) {
      if (!r.ok) { if (cv.bad == null) cv.bad = t0; if (t0 - cv.bad > 150) sndCurveOff(true); cv.W = null; }
      else if (!SND.singable(r.W)) {
        // a W with no harmonic of D3 (4 + W outside 1 … 24, a loop round four poles): no note; the count is spoken
        // whenever it changes (review sound-2)
        cv.bad = null;
        if (cv.on) { SND.singOff(); cv.on = false; }
        if (cv.W !== r.W) sndSayOnce($t('Winding number of the loop: {W}.', { W: r.W }));
        cv.W = r.W; cv.T = morph.T;
      } else {
        cv.bad = null;
        const a = SND.curveAmps(r.ph, r.W);
        if (SND.sing(a.A, a.n0, { mode: 'live', tier: 'sonify' })) {
          if (cv.W != null && cv.W !== r.W) sndSayOnce($t('Winding number of the loop: {W}.', { W: r.W }));
          cv.on = true; cv.W = r.W; cv.T = morph.T;
        }
      }
    }
    clearTimeout(cv.idle);
    cv.idle = setTimeout(() => sndCurveOff(true), 900);
  }
  function sndCurveOff(keepKey) {
    const cv = snd.cv;
    clearTimeout(cv.idle);
    if (cv.on && SND) SND.singOff();
    cv.on = false; cv.bad = null;
    if (!keepKey) { cv.key = ''; cv.W = null; }
  }
  // a closed polygon resampled at M points evenly in arc length; arg F tracked exactly between them (and back to the
  // start): {ph (turns), W, ok}; ok false where F vanishes, is infinite or jumps on the curve (no winding number);
  // null when the deadline passed (the caller holds)
  function sndCurveW(F, pts, M, deadline) {
    const n = pts.length, Ls = [0];
    for (let i = 1; i <= n; i++) { const a = pts[i - 1], b = pts[i % n]; Ls.push(Ls[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const tot = Ls[n];
    if (!(tot > 0)) return { ok: false };
    const zs = [];
    let i = 0;
    for (let k = 0; k < M; k++) {
      const sk = tot * k / M;
      while (i < n - 1 && Ls[i + 1] < sk) i++;
      const a = pts[i], b = pts[(i + 1) % n], u = (sk - Ls[i]) / Math.max(1e-300, Ls[i + 1] - Ls[i]);
      zs.push(C(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u));
    }
    const ph = new Float64Array(M), gs = zs.map((z) => F(z));
    if (!gs.every(sndOk)) return { ok: false };
    let acc = Math.atan2(gs[0].im, gs[0].re) / TAU, ok = true;
    const a0 = acc;
    ph[0] = acc;
    for (let k = 1; k <= M; k++) {
      const r = Calc.argStep(F, zs[k - 1], gs[k - 1], zs[k % M], gs[k % M], { budget: 400, deadline });
      if (!r.exact) { if (r.why === 'budget') return null; ok = false; }
      acc += r.d / TAU;
      if (k < M) ph[k] = acc;
    }
    const Wn = acc - a0, W = Math.round(Wn);
    return { ph, W, ok: ok && Math.abs(Wn - W) < 0.05 };
  }
  // a curve sampled uniformly in arc length, arg tracked exactly between the samples; null when F is too costly here
  function sndSample(F, pts, closed) {
    const ring = closed ? pts.concat([pts[0]]) : pts, seg = [];
    let Lt = 0;
    for (let i = 0; i + 1 < ring.length; i++) { const l = Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]); seg.push(l); Lt += l; }
    if (!(Lt > 0)) return null;
    const M = 900, zs = [];
    let i = 0, acc = 0;
    for (let j = 0; j < M; j++) {
      const s = (j / (M - 1)) * Lt;
      while (i < seg.length - 1 && acc + seg[i] < s) { acc += seg[i]; i++; }
      const a = seg[i] ? sndClamp((s - acc) / seg[i], 0, 1) : 0;
      zs.push(C(ring[i][0] + (ring[i + 1][0] - ring[i][0]) * a, ring[i][1] + (ring[i + 1][1] - ring[i][1]) * a));
    }
    const phi = new Float64Array(M), la = new Float64Array(M), cuts = [], t0 = performance.now();
    let g0 = F(zs[0]);
    if (!sndOk(g0)) return null;
    phi[0] = Math.atan2(g0.im, g0.re) / TAU; la[0] = Math.log(CX.abs(g0));
    for (let j = 1; j < M; j++) {
      const g1 = F(zs[j]), r = Calc.argStep(F, zs[j - 1], g0, zs[j], g1, { budget: 2000 });
      // a cut's tick at the crossing itself (where the tracker failed), not on the next sample (notes/sea-song)
      if (!r.exact && r.why === 'jump') {
        const l = CX.abs(CX.sub(zs[j], zs[j - 1])), a = r.at && l > 0 ? sndClamp(CX.abs(CX.sub(r.at, zs[j - 1])) / l, 0, 1) : 1;
        cuts.push((j - 1 + a) / (M - 1));
      }
      phi[j] = phi[j - 1] + r.d / TAU; la[j] = sndOk(g1) ? Math.log(CX.abs(g1)) : la[j - 1];
      g0 = g1;
      if (performance.now() - t0 > 500) return null;
    }
    return { zs, phi, la, cuts };
  }
  // play F along a curve (Mathematical events): the probe travels the curve in X and its image in Y; Esc, L, the
  // menu again, or a pointer move of more than 4 px stop it (on a 12 ms fade, never mid-waveform). listen: a composed
  // curve's own duration, velocities, register and drum (sndListenOf; an example's melody, notes/sea-song), used only
  // while the harp would play exactly its crossings here; a pointer move does not stop a melody. shape: the shape it
  // plays: it stops when that shape is gone (deleted, another example, undo) or, for a melody, no longer the melody
  // (edited, another chain, notes/sea-song review ui-1)
  function sndListen(pts, closed, lead, listen, shape) {
    if (!A.sndP.on || !A.sndP.events || !SND || !snd.tracker || !pts || pts.length < 2) return false;
    sndStopPlay(false);
    if (snd.voice) snd.voice.gate(false, undefined, 0.02);
    const Sm = sndSample(sndF(), pts, closed);
    if (!Sm) { sndSay($t('This curve cannot be played here: F is too costly, or vanishes or is infinite at its start.')); return false; }
    const n = Sm.phi.length, turns = Sm.phi[n - 1] - Sm.phi[0];
    // (a melody's own strings: listen.lines, lines of the Phase key; its written notes: listen.note, notes/sea-song/r2)
    let dur = sndClamp(2.2 + 1.0 * Math.abs(turns), 2.6, 7), vel = null, note = null, lines = null, tickDb = null;
    const L0 = listen && Array.isArray(listen.lines) ? listen.lines : null;
    if (listen && listen.dur > 0 && Array.isArray(listen.vel) && SND.alongCount && SND.alongCount(Sm.phi, closed, L0) === listen.vel.length) {
      dur = listen.dur; vel = listen.vel; lines = L0;
      if (Array.isArray(listen.note) && listen.note.length === vel.length) note = listen.note;
      if (Array.isArray(listen.tick) && listen.tick.length === Sm.cuts.length) tickDb = listen.tick;
    }
    // the phase harp along the curve (its low Ds, up minus down, are the curve's winding number), its cuts ticked;
    // then a closed curve with a winding number sings it as one note (v15.2)
    const tag = 'listen' + (++snd.listenN);
    // (a melody keeps its own number of strings ringing, listen.cap, one per crossing: one note in its theme, four in
    // its chords, notes/sea-song/r3)
    const hh = SND.harpAlong(Sm.phi, Sm.la, dur, { tag, closed, cuts: Sm.cuts.map((u) => u * dur), lines, vel, note, dbl: vel ? listen.dbl : 0, tickDb, cap: vel ? listen.cap || 24 : 0 });
    if (!hh) return false;
    const Wr = Math.round(turns);
    // (a W the singer has no note for, 4 + W outside 1 … 24: its |W| pings instead, review sound-2)
    if (closed && !Sm.cuts.length && Math.abs(turns - Wr) < 0.05 && !sndSingLoop(pts, Wr, { at: dur + 0.05, tag }, Sm) && !SND.singable(Wr)) SND.play('loopDone', { w: Wr, at: dur + 0.05, tag, force: true });
    const h = { t0: hh.t0, now: hh.now, tag, harp: hh };
    // the pointer moving more than 4 px from where it was when the playback started ends it
    // (v16.4: closed and W, the rounded winding number of a closed curve, for the tour's listen-ended)
    const Wn = closed && !Sm.cuts.length && Math.abs(turns - Wr) < 0.05 ? Wr : null;
    const p = snd.play = { h, zs: Sm.zs, dur, raf: 0, from: snd.px ? snd.px.slice() : null, tag, piece: !!vel, shape: shape || null, nf: 0, closed: !!closed, W: Wn };
    tourEmit('listen-started', { piece: !!vel, closed: !!closed, dur });
    updateDraftChips();
    sndSay((lead ? lead + ' ' : '') + (closed && !Sm.cuts.length ? $tn('Listening along the loop: {n} turn of arg F. Esc stops.', 'Listening along the loop: {n} turns of arg F. Esc stops.', Math.round(turns)) : $t('Listening along the curve. Esc stops.')));
    const tick = () => {
      if (snd.play !== p) return;
      // what it plays changed: the shape gone, or a melody's curve or chain changed (its key checked every 8th frame)
      if (p.shape && (!A.S.shapes.includes(p.shape) || (p.piece && (++p.nf % 8 === 0 || !p.shape.listen) && !sndListenOf(p.shape)))) { sndStopPlay(false); return; }
      const u = sndClamp((h.now() - h.t0) / dur, 0, 1), x = u * (p.zs.length - 1), j = Math.min(p.zs.length - 2, Math.floor(x)), a = x - j;
      A.probe = C(p.zs[j].re + (p.zs[j + 1].re - p.zs[j].re) * a, p.zs[j].im + (p.zs[j + 1].im - p.zs[j].im) * a);
      setReadouts(A.probe); sndRender();
      if (u < 1) p.raf = requestAnimationFrame(tick);
      else setTimeout(() => { if (snd.play === p) { snd.play = null; A.probe = null; setReadouts(null); sndRender(); updateDraftChips(); sndPlayEnded(p, true); } }, 400);
    };
    p.raf = requestAnimationFrame(tick);
    return true;
  }
  function sndStopPlay(hushAll) {
    const p = snd.play;
    if (!p) return;
    snd.play = null;
    cancelAnimationFrame(p.raf);
    SND.stopTag(p.tag);
    if (hushAll) SND.hush();
    A.probe = null; setReadouts(null); sndRender();
    updateDraftChips();
    sndPlayEnded(p, false);
  }
  // (v16.4) a Listen along ended: played out (full), stopped, or cut by a scene change; heard: seconds played
  function sndPlayEnded(p, full) {
    let heard = 0;
    try { heard = Math.max(0, Math.min(p.dur, p.h.now() - p.h.t0)); } catch (e) { heard = 0; }
    tourEmit('listen-ended', { piece: !!p.piece, closed: !!p.closed, W: p.W == null ? null : p.W, heard: full ? p.dur : heard, full: !!full });
    // ([v16.5 fix regress-5] the example's Try line leaves its slot when the melody is over, never while it plays: the
    // planes, and the curve being heard, do not move under the eyes)
    if (Tour.laneHide) Tour.laneHide('example');
  }
  // the curve menu's "Listen along": the shape's longest piece, in the X plane's variable
  function sndListenShape(s) {
    if (snd.hint) { snd.hint = null; clearTimeout(snd.hintT); }   // (the open's hint is answered)
    // (v16.5 UX74: and its Try line, [v16.5 fix regress-5] once the melody ends: sndPlayEnded)
    let pieces = [];
    try { pieces = curvePieces(s, false); } catch (e) { pieces = []; }
    let best = null, bl = -1;
    for (const c of pieces) {
      if (!c.pts || c.pts.length < 2) continue;
      let l = 0; for (let i = 1; i < c.pts.length; i++) l += Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]);
      if (l > bl) { bl = l; best = c; }
    }
    if (!best) return;
    let pts = best.pts;
    const k = leftStage();
    if (k > 0) { const G = rangeF(0, k); pts = pts.map(([x, y]) => { const w = G(C(x, y)); return [w.re, w.im]; }).filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])); }
    const L = sndListenOf(s);
    if (best.closed) snd.lastLoop = { pts, closed: true };
    else if (L) snd.lastLoop = { pts, closed: false, sid: s.id };
    return sndListen(pts, !!best.closed, undefined, L, s);
  }
  // a composed curve's Listen along data (an example's melody: src/seasong.js, notes/sea-song), only on that curve as
  // it was stored (no edit or transform since: the key of its points; an edited curve loses it), under the chain it
  // was composed for, with X in z and no deformation; null otherwise (then today's rules play it)
  function sndListenOf(s) {
    const L = s && s.listen;
    if (!L || s.kind !== 'curve' || !Array.isArray(s.pts)) return null;
    if (L.key !== sndPtsKey(s.pts)) { delete s.listen; return null; }
    if (leftStage() !== 0 || morphOn() || !Array.isArray(L.steps) || A.S.steps.length !== L.steps.length) return null;
    const same = L.steps.every((st, i) => { const a = A.S.steps[i]; return a && a.type === st.type && a.on !== false && Object.keys(st.params || {}).every((k) => String(a.params[k]) === String(st.params[k])); });
    return same ? L : null;
  }
  function sndPtsKey(pts) {
    let hs = 2166136261;
    for (const q of pts) for (const v of q) { const t = String(v) + ','; for (let i = 0; i < t.length; i++) { hs ^= t.charCodeAt(i); hs = Math.imul(hs, 16777619); } }
    return pts.length + ':' + (hs >>> 0).toString(36);
  }
  // Listen along from a menu or the guide: with sound or Mathematical events off, a toast says so and turns them on
  // (then plays: the engine starts inside that click, its clock a moment later)
  function sndListenAsk(s) {
    if (!SND) return;
    if (A.sndP.on && A.sndP.events) { sndListenShape(s); return; }
    const ph = document.documentElement.classList.contains('ph');
    const msg = !A.sndP.on ? (ph ? $t('Sound is off: turn it on here, or in the ⋯ menu.') : $t('Sound is off: turn it on here, or with Sound in the top bar ({x}).', { x: '⇧M' }))
      : $t('Mathematical events are off in the Sound menu: turn them on here.');
    toast(msg, $t('Turn on and listen'), () => { tourSndMine(['on', 'events']); sndTurnOnListen(s); }, false, { sticky: true });
  }
  // sound and Mathematical events on, then Listen along s (the engine starts inside this click, its clock a moment later)
  function sndTurnOnListen(s) {
    SND.set({ on: true, events: true });
    let n = 0;
    const go = () => { if (!A.S.shapes.includes(s)) return; if (SND.state().audio === 'running' || ++n > 12) sndListenShape(s); else setTimeout(go, 100); };
    go();
  }
  // (review v16 user-5) an example with a melody says, once it opens, how to hear it, with the action itself
  // (early: from loadExample before its shapes exist, the Try line only; true when it is shown)
  function sndPieceHint(early) {
    if (!SND) return false;
    const s = A.S.shapes.find((x) => x.listen);
    if (!s && !early) return false;
    const ph = document.documentElement.classList.contains('ph');
    // (the melody's shape when the button is pressed: an early line is shown before the shapes are made)
    const go = () => { const q = s && A.S.shapes.includes(s) ? s : !s && A.S.shapes.find((x) => x.listen); if (!q) return; if (A.sndP.on && A.sndP.events) sndListenShape(q); else sndTurnOnListen(q); };
    // (v16.5 UX74, the learning lane of wave 2's D7) the example's Try line in the tour's docked slot, Listen its
    // button: it covers nothing and stays until it is played or closed, or the example is left (it went after 9 s)
    const exN = typeof A.currentExample === 'number' && EX[A.currentExample] ? EX[A.currentExample].name : '';
    if (Tour.lane && Tour.lane({ id: 'example', title: (exN ? exN + ' ' : '') + '♫', label: $t('Try this example'),
      body: ph ? $t('Try: press Listen, or hold the spiral and choose Listen along.') : $t('Try: press Listen, or right-click the spiral and choose Listen along.'),
      icon: '<svg viewBox="0 0 16 16" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12.5V3.5l7-1.5v9"/><circle cx="4.3" cy="12.5" r="1.7"/><circle cx="11.3" cy="11" r="1.7"/></svg>',
      acts: [{ label: $t('Listen'), primary: true, run: () => go() }], drop: 'title', onClose: () => {} })) return true;
    if (early) return false;
    // (review v16 verify-7: in X's note chip at the top of the plane, not a toast over the spiral; it goes after 9 s,
    // on Listen, or when the example is left)
    clearTimeout(snd.hintT);
    snd.hint = { s, msg: ph ? $t('Hold the spiral, then Listen along.') : $t('Right-click the spiral, then Listen along.'), go };
    snd.hintT = setTimeout(() => { snd.hint = null; updateDraftChips(); }, 9000);
    updateDraftChips();
  }
  // the open's hint while it lasts (and its shape is still there), else ''
  // the hint in X's title row, before its LED (desktop and tablet); false where the row is not shown or too narrow
  function syncPieceHint(q) {
    let el = $('paneHintL');
    if (!q) { if (el && !el.hidden) el.hidden = true; return false; }
    const head = document.querySelector('#paneL .pane-head');
    const fits = !!(head && head.getClientRects().length && head.clientWidth >= 420 && !document.documentElement.classList.contains('ph'));
    if (!fits) { if (el && !el.hidden) el.hidden = true; return false; }
    if (!el) {
      el = h('span', { class: 'pane-hint', id: 'paneHintL', role: 'status' }, h('span', { class: 'pane-hint-t' }),
        h('button', { class: 'toast-act', type: 'button', onclick: () => { const r = pieceHint(); snd.hint = null; clearTimeout(snd.hintT); updateDraftChips(); if (r) r.go(); } }, $t('Listen')));
      const led = $('leftLed');
      if (led && led.parentNode === head) head.insertBefore(el, led); else head.append(el);
    }
    if (el.firstChild.textContent !== q.msg) el.firstChild.textContent = q.msg;
    if (el.hidden) el.hidden = false;
    return true;
  }
  // (in a try, as listenChipMsg: the chips are updated before the sound section has run at start-up)
  function pieceHint() {
    try {
      const q = snd.hint;
      if (!q) return null;
      if (!A.S.shapes.includes(q.s)) { snd.hint = null; return null; }
      return q;
    } catch (e) { return null; }
  }
  // the chip over X while a curve is listened along: what plays, and how to stop it (review v16 user-5)
  function listenChipMsg() {
    try {
      const p = snd.play;
      if (!p || !p.shape || !A.S.shapes.includes(p.shape)) return '';
      const name = shapeNames().get(p.shape.id) || Region.KINDS[p.shape.kind].label;
      return $t('Listening along {name}', { name });   // (v16.5 UX71: its Stop button says the rest; Esc in its tooltip)
    } catch (e) { return ''; }
  }
  // the guide's button: the example with a melody, opened and played
  function sndPlayPiece() {
    const i = EX.findIndex((ex) => exOk(ex) && ex.shapes.some((sh) => sh.listen));
    if (i < 0) return;
    loadExample(i);
    const s = A.S.shapes.find((x) => x.listen);
    snd.hint = null; clearTimeout(snd.hintT); updateDraftChips();   // (the open's hint: this button is already the answer)
    if (s) sndListenAsk(s);
  }

  // ---- the keyboard probe (a focused X plane): arrows in round steps, Z / Shift+Z the next or previous zero or pole,
  // O the order here, D describes the view, Enter starts and closes a loop, L listens, Esc cancels a loop ----
  const sndStep = () => { const v = leftView(); return A.paneL.w / (2 * v.s) > 4 ? 0.25 : 0.1; };
  // (spoken: the screen's decimal comma in Russian, review eng-9; English as before)
  const sndFmt = (z, d = 2) => (I18N.lang === 'en' ? CX.fmt(z, d) : CX.fmt(z, d).replace(/(\d)\.(\d)/g, '$1,$2'));
  function sndProbeTo(z) {
    snd.kz = z; A.probe = z; setReadouts(A.probe); sndRender();
    const v = leftView();
    sndHover(z, A.paneL.w / 2 + (z.re - v.cx) * v.s, 'key');
    clearTimeout(snd.annT);
    snd.annT = setTimeout(() => {
      if (!snd.kz) return;
      const g = sndF()(snd.kz);
      sndSay(CX.isFin(g) ? $tn('z {z}. Modulus {modulus}, argument {n} degrees.', 'z {z}. Modulus {modulus}, argument {n} degrees.', Math.round(Math.atan2(g.im, g.re) / DEG), { z: sndFmt(snd.kz), modulus: I18N.num(CX.fmtNum(CX.abs(g), 3)) }) : $t('z {z}. F is infinite here.', { z: sndFmt(snd.kz) }));
    }, 450);
  }
  function sndKeyStart() {
    if (snd.kz) return false;
    const v = leftView(), st = sndStep();
    sndProbeTo(C(Math.round(v.cx / st) * st, Math.round(v.cy / st) * st));
    clearTimeout(snd.annT);
    sndSay($t('Probe at the centre, z = {z}. Steps of {st}; Shift for {x}.', { z: sndFmt(snd.kz), st: I18N.num(st), x: I18N.num(+(st / 5).toFixed(3)) }));
    return true;
  }
  // the zeros and poles of the painted function in the view (Calc.zerosPoles, time-bounded), cached per view
  function sndLandmarks() {
    const v = leftView(), hw = A.paneL.w / (2 * v.s), hh = A.paneL.h / (2 * v.s), key = sndFKey() + '|' + sndVKey();
    if (snd.lms && snd.lmKey === key) return snd.lms;
    let out = [];
    try { out = zerosPolesTimed(sndF(), { x0: v.cx - hw, x1: v.cx + hw, y0: v.cy - hh, y1: v.cy + hh }, { max: 24 }, 80); } catch (e) { out = []; }
    const L = out.filter((r) => r && r.z && (r.kind === 'zero' || r.kind === 'pole')).sort((p, q) => p.z.re - q.z.re || p.z.im - q.z.im);
    L.incomplete = !!out.incomplete;
    snd.lms = L; snd.lmKey = key; snd.lm = -1;
    return L;
  }
  function sndKey(e) {
    if (!A.sndP.on || !SND || !snd.kbd || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key, done = () => { e.preventDefault(); e.stopPropagation(); };
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const st0 = sndStep();
    if (arrows[k]) {
      done();
      if (sndKeyStart()) return;
      const v = leftView(), hw = A.paneL.w / (2 * v.s), hh = A.paneL.h / (2 * v.s), st = e.shiftKey ? st0 / 5 : st0, d = arrows[k];
      const x0 = snd.kz.re + d[0] * st, y0 = snd.kz.im + d[1] * st;
      const x = sndClamp(x0, v.cx - hw, v.cx + hw), y = sndClamp(y0, v.cy - hh, v.cy + hh);
      if (x !== x0 || y !== y0) {
        soundCue('edge', { pan: sndClamp(0.4 * (x - v.cx) / hw, -0.4, 0.4) }); sndSay($t('Edge of the view.'));
        if (x === snd.kz.re && y === snd.kz.im) return;
      }
      sndProbeTo(C(+x.toFixed(6), +y.toFixed(6)));
      if (snd.kloop) snd.kloop.push([snd.kz.re, snd.kz.im]);
      return;
    }
    const kl = (I18N.keyOf(e) || '').toLowerCase();
    if (kl === 'z') {
      done();
      const L = sndLandmarks();
      if (!L.length) { sndSay(L.incomplete ? $t('No zeros or poles found in the view in the time allowed.') : $t('No zeros or poles in the view.')); return; }
      snd.lm = (snd.lm + (e.shiftKey ? -1 : 1) + L.length) % L.length;
      const p = L[snd.lm], off = st0 / 2;
      sndProbeTo(C(p.z.re + off, p.z.im));
      clearTimeout(snd.annT);
      const lp = { i: snd.lm + 1, n: L.length, orMore: L.incomplete ? $t(' or more') : '', m: p.mult, z: sndFmt(p.z), off: I18N.num(off) };
      sndSay(p.kind === 'zero' ? $t('Zero {i} of {n}{orMore}: order {m} at {z}. The probe is {off} to its right.', lp) : $t('Pole {i} of {n}{orMore}: order {m} at {z}. The probe is {off} to its right.', lp));
      return;
    }
    if (kl === 'o') {
      done(); sndKeyStart();
      const m = Calc.orderAt(sndF(), snd.kz, st0, { budget: 40000 });
      clearTimeout(snd.annT);
      if (m === null) sndSay($t('No order within {st0}: F jumps, vanishes or is infinite on that circle.', { st0: I18N.num(st0) }));
      else if (!m) sndSay($t('Zeros minus poles within {st0}: none.', { st0: I18N.num(st0) }));
      else {
        const np = { st0: I18N.num(st0), m: Math.abs(m) };
        sndSay(m > 0 ? (Math.abs(m) > 1 ? $t('Zeros within {st0}: net order {m}.', np) : $t('Zero within {st0}: net order {m}.', np)) : (Math.abs(m) > 1 ? $t('Poles within {st0}: net order {m}.', np) : $t('Pole within {st0}: net order {m}.', np)));
        const v = leftView();
        SND.play(m > 0 ? 'zero' : 'pole', { order: Math.abs(m), pan: sndClamp(0.4 * (snd.kz.re - v.cx) * v.s / (A.paneL.w / 2), -0.4, 0.4), audition: !A.sndP.sonify });
      }
      return;
    }
    if (kl === 'd') {
      done();
      const L = sndLandmarks(), zs = L.filter((p) => p.kind === 'zero'), ps = L.filter((p) => p.kind === 'pole');
      const list = (a, w) => {
        if (!a.length) return w === 'zero' ? $t('no zeros') : $t('no poles');
        const lp = { items: a.slice(0, 6).map((p) => sndFmt(p.z) + (p.mult > 1 ? $t(' (order {mult})', { mult: p.mult }) : '')).join(I18N.comma() ? '; ' : ', '), andMore: a.length > 6 ? $t(', and more') : '' };
        if (w === 'zero') return L.incomplete ? $tn('{n} or more zero: {items}{andMore}', '{n} or more zeros: {items}{andMore}', a.length, lp) : $tn('{n} zero: {items}{andMore}', '{n} zeros: {items}{andMore}', a.length, lp);
        return L.incomplete ? $tn('{n} or more pole: {items}{andMore}', '{n} or more poles: {items}{andMore}', a.length, lp) : $tn('{n} pole: {items}{andMore}', '{n} poles: {items}{andMore}', a.length, lp);
      };
      const kmax = A.S.focus === 0 ? nSteps() : A.S.focus;
      const cuts = A.built.filter((b, i) => i < kmax && A.S.steps[i] && A.S.steps[i].on !== false && b && !b.error && b.cuts && b.cuts.length).length;
      sndSay($t('{fnText} in this view: {zs}; {ps}{choice}.', { fnText: fnText(), zs: list(zs, 'zero'), ps: list(ps, 'pole'), choice: cuts ? $tn('; branch cuts from {n} step, drawn in red', '; branch cuts from {n} steps, drawn in red', cuts) : '' }));
      return;
    }
    if (k === 'Enter') {
      done();
      if (snd.kloop) { const pts = snd.kloop; snd.kloop = null; if (pts.length >= 3) sndLoopDone(pts); else { snd.loop = null; sndSay($t('A loop needs at least three points.')); } return; }
      sndKeyStart();
      snd.kloop = [[snd.kz.re, snd.kz.im]];
      if (A.sndP.sonify) snd.loop = { phi: 0, k: 0, jumps: 0, pc0: snd.phi - Math.floor(snd.phi), live: true };
      sndSay($t('Loop started. Move with the arrow keys; Enter closes it.'));
      return;
    }
    if (kl === 'l') {
      done();
      if (snd.play) { sndStopPlay(true); return; }
      const LL = snd.lastLoop, ls = LL && LL.sid ? A.S.shapes.find((x) => x.id === LL.sid) : null;
      if (ls) sndListenShape(ls);
      else if (LL && !LL.sid) sndListen(LL.pts, LL.closed); else sndSay($t('No loop yet: Enter starts one.'));
      return;
    }
    if (k === 'Escape' && snd.kloop) { done(); snd.kloop = null; snd.loop = null; sndSay($t('Loop cancelled.')); }
  }

  function init(api) {
    A = api;
    ({ C, EX, SND, SND_ICON_OFF, SND_ICON_ON, V, camOf, camS, curvePieces, derivIn, drawProbe, exOk, fnText, focusDeriv, focusF, hov, lGlobe, lLand, leftStage, leftView, loadExample, morph, morphLen, morphOn, morphState, nSteps, pickLand, pickSphere, pickSphereLeft, rGlobe, rImage, rangeF, rangeKey, rangeParts, render3D, requestRender, setReadouts, shapeNames, snd, solo, toast, touchUI, tourEmit, tourL, tourSndMine, updateDraftChips, zerosPolesTimed } = api);
  }
  return { init, soundCue, sndExportDone, sndError, sndToggleCue, sndSay, soundToggle, soundHear, soundStop, sndInit, sndMorphStart, sndMorphArrive, sndScrub, sndScrubEnd, sndMotion, sndFAt, sndMove, sndHoverOff, soundFunctionChanged, sndRelayout, sndFrame, sndOverlay, sndCollide, sndLoopDone, sndListen, sndStopPlay, sndListenShape, sndListenOf, sndPtsKey, sndListenAsk, sndTurnOnListen, sndPieceHint, syncPieceHint, pieceHint, listenChipMsg, sndPlayPiece };
})();
