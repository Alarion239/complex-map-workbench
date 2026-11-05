  // ---------------- sound (notes/sound/DESIGN.md §2 and §4.1; the engine is src/sound.js) ----------------
  // On by default from v15 (Interface and Mathematical events; Hear the function off; a ?ns= test page starts off), and
  // free while off: every hook returns on one flag (sndP.on) before any work, and the engine creates nothing (no
  // AudioContext) before the page's first click or key. The settings live in lsk('cmw-sound') (the
  // engine's own key), never in S, a saved session or a shared link. Three tiers: Interface (controls you operate),
  // Mathematical events (things you start), Hear the function under the pointer (opt-in: the probe below).
  const SND = Sound;
  let sndP = SND ? SND.prefs() : { on: false, vol: 0.7, ui: false, snap: false, events: false, sonify: false };
  const snd = {
    last: null, g: null, phi: 0, fKey: '', vKey: '', gestT: -1e9, near: 0, idleT: 0,
    perEval: 0.002, loop: null, lastLoop: null, play: null, auto: false, morphArm: false, kz: null, kloop: null, lm: -1,
    lms: null, lmKey: '', annT: 0, collide: '', tracker: false, ptrT: -1e9, kbd: false, px: null,
    // the function under a still probe (notes/sound/DEFORMATION.md): rest, the probe's last point {z, src, px};
    // T, the transport time and cKey, the chain (+ fcGen) of the last evaluation; run, the turns counted while the
    // function changes; fcRaf, the one evaluation a frame; fcN, function-driven evaluations (tests)
    rest: null, T: null, cKey: '', run: null, fcGen: 0, fcRaf: 0, fcN: 0,
    // cxy, the pointer's last position on the page (null after Esc until it moves) and press, where a mouse or pen
    // press began (sndPtr); rp, a re-pick waiting for a frame drawn at the new layout (sndRelayout, sndFrame); userT,
    // the last change of F a person made (not the transport's own frames); path, the paths of the changes since the
    // last evaluation (soundFunctionChanged({ at })); said, the last speech
    ptrOn: false, cxy: null, press: null, rp: null, userT: -1e9, path: null, said: null,
    // spd, the probe's speed (px per ms, for how hard a ping is struck); cv, the last loop singing while the function
    // changes (curves sing); listenN, a tag per "listen along"
    spd: 0, cv: { key: '', W: null, bad: null, idle: 0, on: false, hushed: false }, listenN: 0,
    // Hear the function (notes/sound/AS-BUILT, Sound.hear): rope, the roped point {x, y, src} in its pane's CSS px (3 px
    // behind a mouse or pen, 5 px behind a finger; null when let go); lastSrc, the probe's last source (a change is a
    // stroke start); ptype, the last pointer's type on a plane; hand, the hand's own last point {x, y, z, src}, where a
    // lifted finger seats the probe (sndLift; lifting while it feeds that step); fh, the finger's way of the last 300 ms
    // {src, h: [{t, x, y}]}; hold, holdT, pz, a slow finger's held crossing, its timer and the probe's points of the last 50 ms
    // (sndHold)
    rope: null, hand: null, fh: null, hold: null, holdT: 0, pz: null, lifting: false, lastSrc: '', ptype: '',
    // (#580) svk, the steps view's plane last seen at the end of a frame (sndFrame): another one re-picks the probe;
    // svSaid, the plane where "no tone past the colour plane" was said last (once a plane)
    svk: /** @type {string | null} */ (null), svSaid: '',
    // (#726) svx, the thread's place last followed and svFam, the colour's family there (sndSvFollow, once a frame);
    // pre, the last point found under a glide's map {fam, q, u, p}, where the next one starts (sndPre)
    svx: /** @type {number | null} */ (null), svFam: '', pre: null,
  };
  // (#726, Pietro's call on #580, Q2) the colour the steps view shows between two planes, which the probe hears: at the
  // thread's place x between planes a and b, u of the way (in an All-at-once span, u is its share of the span), the colour
  // at a point q is G_a(p), plane a's map into the colour plane at the point p of plane a that the glide's map from plane
  // a (svCarry's map spec; its CPU twin, cpuMap) takes to q, p continued in u from p = q at u = 0 (sndPre in the sound
  // hooks). At u = 1 that is plane b's map at q, whichever p, so along the coloured thread it is one function of q and x.
  // The thread at x: {fam, u, G, H(u)} between two planes (fam: what H and G are made of), {u: 0, G} at a coloured plane;
  // null where the probe hears the nearer plane's map instead: plane a or the nearer plane not coloured (past the colour
  // plane no tone, #727), a d/dz step (no map: the picture jumps at ½), or a step whose homotopy is not analytic (Newton
  // needs its derivative)
  function svSoundSeg(x) {
    const m = svSoundMemo, st = `${SV.T}|${SV.alone}|${SV.span ? SV.span.x0 + ',' + SV.span.x1 : ''}|${S.homAll ? 1 : 0}|${chainSig[nSteps()]}`;
    if (m.st !== st) Object.assign(m, { st, x: NaN, seg: null });
    if (x !== m.x) {
      const s = m.seg;
      m.x = x;
      m.v = s && x > s.lo && x < s.hi ? { fam: s.fam, u: (x - s.x0) / s.len, G: s.G, H: s.H } : svSoundFind(x);
    }
    return m.v;
  }
  // svSoundSeg's last answer and the last segment between two planes it found, in the state they were found in (st: the
  // colour plane, the planes, the span and the chain): the calls of an event read one place, and those along a frame's
  // path differ in x alone. seg: where svBetween gives that segment, lo < x < hi (past plane a's 1e-6; short of plane b, and
  // of half-way where b, the nearer plane past it, is not coloured), {lo, hi, x0, len, fam, G, H}
  const svSoundMemo = { st: '', x: NaN, v: null, seg: null };
  // svSoundSeg's answer at x worked out from svBetween; a segment between two planes is kept in svSoundMemo.seg
  function svSoundFind(x) {
    const g = svBetween(x);
    if (!svColoured(g.a) || !svColoured(g.near)) return null;
    if (g.u <= 1e-6 || g.b === g.a) return { u: 0, G: svF(g.a) };
    const ks = g.all ? svPlanes().slice(g.x0 + 1, g.x1 + 1) : [g.b];
    if (!g.H || !ks.every((k) => built[k - 1] && built[k - 1].props && built[k - 1].props.analytic)) return null;
    const map = (u) => (g.all ? { mode: 3, a: g.a, b: g.b, t: u, base: g.a } : { mode: 1, base: g.a, hi: g.b, t: u }), len = g.x1 - g.x0;
    // (H at the last u asked kept: the probe's order cue reads the colour round it at one u, some fifty points)
    let hu = NaN, hf = null;
    const H = (u) => { if (u !== hu) { hu = u; hf = cpuMap(map(u)); } return hf; };
    const at = { fam: `${g.a}>${g.b}${g.all ? '*' : ''}|${svT()}|${chainSig[nSteps()]}`, u: g.u, G: svF(g.a), H };
    svSoundMemo.seg = { lo: g.x0 + 1e-6 * len, hi: svColoured(g.b) ? g.x1 - (g.all ? 1e-6 : 1e-9) : g.x0 + len / 2, x0: g.x0, len, fam: at.fam, G: at.G, H: at.H };
    return at;
  }
  // (#580, #726) the steps view's plane as the sound reads it, null in the classic view. Pietro's calls (1 and 2 Nov): the
  // probe hears what the colours show, the map from the plane into the colour plane, and between two planes the colour as
  // it deforms (svSoundSeg). playing, ▶ plays along the thread; segAt, the colour at a place on the thread. Read only when
  // asked (the sound reads a few of them many times an event): k and T, the nearer plane's stage and the colour plane's;
  // past, the colour plane's name when k is past it (its colour is carried from there, by the points: no tone, #727), else
  // ''; seg, the colour at the thread's place x (svSoundSeg's); x, that place while the probe hears that colour, else
  // null; key, what the probe's function is made of:
  // the coloured thread, one function of the point and x, or where it does not deform, the nearer plane's map (the
  // readout's), re-seated where it switches; view, the camera the picture is drawn with: between two planes the one every
  // plane shares (S.srcView, svRenderMoving's), so a glide or ▶ is no view change under a still probe, else the plane's
  // own (leftView); F, the map from plane k into the colour plane (svF), and name, its name ("F", "f₂", "f₃∘f₂", or the
  // plane's own variable where svF is the identity)
  const stepsView = () => {
    if (!SV.on) return null;
    let found, k, T;
    const here = () => (found === undefined ? (found = svSoundSeg(SV.g.x)) : found);
    const kk = () => (k === undefined ? (k = leftStage()) : k), tt = () => (T === undefined ? (T = svT()) : T);
    return { get k() { return kk(); }, get T() { return tt(); }, get past() { return kk() > tt() ? svName(tt()) : ''; }, playing: !!SV.play, segAt: svSoundSeg,
      get seg() { return here(); }, get x() { return here() ? SV.g.x : null; }, get key() { return here() ? `~${tt()}|${svPlanes().join(',')}` : `${kk()}>${tt()}`; },
      get view() { return here() && here().H ? S.srcView : leftView(); }, get F() { return svF(kk()); }, get name() { return svColoured(kk()) ? svKeyName(kk()) : svName(kk()); } };
  };
  const SND_ICON_ON = svgI('<path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z"/><path d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8M12.3 3.7a6.1 6.1 0 0 1 0 8.6"/>');
  const SND_ICON_OFF = svgI('<path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z"/><path d="M10.5 6l3.5 3.5M14 6l-3.5 3.5"/>');
  // what the sound hooks (src/soundhooks.js) need from the app: its functions and constants, and the state they
  // reassign as getters (and setters for the state they write)
  function soundHooksApi() {
    return {
      C, EX, SND, SND_ICON_OFF, SND_ICON_ON, V, camOf, camS, curvePieces, derivIn, drawProbe, exOk, fnText,
      focusDeriv, focusF, hov, lGlobe, lLand, leftStage, leftView, loadExample, morph, morphLen, morphOn,
      morphState, nSteps, pickLand, pickSphere, pickSphereLeft, rGlobe, rImage, rangeF, rangeKey, rangeParts,
      render3D, requestRender, setReadouts, shapeNames, shapeStage, snd, solo, stepsView, sub, toast, touchUI, tourEmit,
      tourL, tourSndMine, updateDraftChips, zerosPolesTimed,
      get S() { return S; },
      get TH() { return TH; },
      get built() { return built; },
      get chainSig() { return chainSig; },
      get currentExample() { return currentExample; },
      get drag() { return drag; },
      get paneL() { return paneL; },
      get paneR() { return paneR; },
      get probe() { return probe; }, set probe(v) { probe = v; },
      get sndP() { return sndP; }, set sndP(v) { sndP = v; },
    };
  }
  // the app calls the sound hooks by their old names (as untyped calls: their types stay the module's own)
  const SH = /** @type {any} */ (SoundHooks);
  function soundCue(...args) { return SH.soundCue(...args); }
  function sndExportDone(...args) { return SH.sndExportDone(...args); }
  function sndError(...args) { return SH.sndError(...args); }
  function sndToggleCue(...args) { return SH.sndToggleCue(...args); }
  function sndSay(...args) { return SH.sndSay(...args); }
  function soundToggle(...args) { return SH.soundToggle(...args); }
  function soundHear(...args) { return SH.soundHear(...args); }
  function soundStop(...args) { return SH.soundStop(...args); }
  function sndInit(...args) { return SH.sndInit(...args); }
  function sndMorphStart(...args) { return SH.sndMorphStart(...args); }
  function sndMorphArrive(...args) { return SH.sndMorphArrive(...args); }
  function sndScrub(...args) { return SH.sndScrub(...args); }
  function sndScrubEnd(...args) { return SH.sndScrubEnd(...args); }
  function sndMotion(...args) { return SH.sndMotion(...args); }
  function sndFAt(...args) { return SH.sndFAt(...args); }
  function sndMove(...args) { return SH.sndMove(...args); }
  function sndLift(...args) { return SH.sndLift(...args); }
  function sndHoverOff(...args) { return SH.sndHoverOff(...args); }
  function soundFunctionChanged(...args) { return SH.soundFunctionChanged(...args); }
  function sndRelayout(...args) { return SH.sndRelayout(...args); }
  function sndFrame(...args) { return SH.sndFrame(...args); }
  function sndSvFollow(...args) { return SH.sndSvFollow(...args); }
  function sndOverlay(...args) { return SH.sndOverlay(...args); }
  function sndCollide(...args) { return SH.sndCollide(...args); }
  function sndLoopDone(...args) { return SH.sndLoopDone(...args); }
  function sndListen(...args) { return SH.sndListen(...args); }
  function sndStopPlay(...args) { return SH.sndStopPlay(...args); }
  function sndListenShape(...args) { return SH.sndListenShape(...args); }
  function sndListenOf(...args) { return SH.sndListenOf(...args); }
  function sndPtsKey(...args) { return SH.sndPtsKey(...args); }
  function sndListenAsk(...args) { return SH.sndListenAsk(...args); }
  function sndTurnOnListen(...args) { return SH.sndTurnOnListen(...args); }
  function sndPieceHint(...args) { return SH.sndPieceHint(...args); }
  function syncPieceHint(...args) { return SH.syncPieceHint(...args); }
  function pieceHint(...args) { return SH.pieceHint(...args); }
  function listenChipMsg(...args) { return SH.listenChipMsg(...args); }
  function sndPlayPiece(...args) { return SH.sndPlayPiece(...args); }
  function soundMode(...args) { return SH.soundMode(...args); }
  function sndQueryClick(...args) { return SH.sndQueryClick(...args); }
  function sndIsSong(...args) { return SH.sndIsSong(...args); }

  let escSound = false;   // (set by setupEscSound's Esc handler, read by setupKeys' after it)
  // (#385) the Esc that stops a sound (init: before setupKeys)
  function setupEscSound() {
    // Esc stops anything playing, whoever else handles that Esc (the export dialog, the palette, the tour, a menu):
    // first, in the capture phase, and without taking the key from them. During a tour, the Esc that stops a
    // Listen along does only that: the next Esc ends the tour
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      // (a Listen along still preparing its samples counts as playing: this Esc drops it and goes no further)
      const playing = !!(snd.play || snd.prep);
      // (what Esc silences is its own level: while a melody, the deformation's motion or a loop sounds, this Esc stops
      // the sound and goes no further; the next one steps out of the modes)
      escSound = !!(sndP && sndP.on && (snd.play || snd.prep || snd.morphArm || snd.mo || (snd.cv && snd.cv.on)));
      soundStop();
      if (playing && Tour.isActive && Tour.isActive() && !document.querySelector('.modal-bg, #popHost > .pop')) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
  }
