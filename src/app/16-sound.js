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
    // lifted finger seats the probe (sndLift)
    rope: null, hand: null, lastSrc: '', ptype: '',
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
      render3D, requestRender, setReadouts, shapeNames, snd, solo, toast, touchUI, tourEmit, tourL, tourSndMine,
      updateDraftChips, zerosPolesTimed,
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

