  // ---------------------------------------------------------------- hearing the function: the phase harp (option 2)
  // The five lines arg F = 0°, 60°, 120°, 210°, 270° (lines 0, 2, 4, 7 and 9 of the default 12 sectors) pluck D, E, F♯,
  // A, B. A Schmitt trigger on each line (h = 1/96 turn): an up note when the unwrapped arg rises past θ + h having last
  // been below θ − h, a down note the other way; so a tremor under 7.5° across a line plays nothing, and the low Ds
  // counted up minus down are exactly the winding number of any closed path that starts more than 3.75° from arg 0.
  // A harp's lines are lines of the Phase key: line s (0 … 11) at arg F = 30°·s plucks D + s semitones. The pointer's
  // harp has five, HARP_LINES; a composed piece (notes/sea-song/r2) has its own, exactly the pitch classes its score uses.
  // v15.2 (review sound-3): the pointer's harp widens the band to what 2.5 px of the probe turn arg F (o.h: the app's
  // |F'/F| · 2.5 px, at most 1/8 turn), so a finger held still near a zero, where a pixel turns arg F by more than 7.5°,
  // plucks nothing; the count is the same (the trigger's state moves one line at a time, whatever the band)
  const HARP_LINES = [0, 2, 4, 7, 9], HARP_H = 1 / 96;
  const thrL = (L, i) => { const n = L.length; return Math.floor(i / n) + L[((i % n) + n) % n] / 12; };
  const cellL = (phi, L) => { let i = Math.floor(phi) * L.length; while (thrL(L, i + 1) <= phi) i++; while (thrL(L, i) > phi) i--; return i; };
  const cellOf = (phi) => cellL(phi, HARP_LINES);
  const linesOk = (L) => Array.isArray(L) && L.length >= 2 && L.length <= 12 && L.every((v, i) => Number.isInteger(v) && v >= 0 && v < 12 && (!i || v > L[i - 1]));
  // the crossings of the lines from cell c as the arg goes P0 → P1: [{i, dir, u}] (u: where along the step, 0 … 1)
  function harpCross(st, P0, P1, h = HARP_H) {
    const fired = [], L = st.L, tAt = (th) => (P1 === P0 ? 1 : clamp((th - P0) / (P1 - P0), 0, 1));
    while (P1 > thrL(L, st.c + 1) + h) { st.c++; fired.push({ i: st.c, dir: 1, u: tAt(thrL(L, st.c)) }); }
    while (P1 < thrL(L, st.c) - h) { fired.push({ i: st.c, dir: -1, u: tAt(thrL(L, st.c)) }); st.c--; }
    return fired;
  }
  // Harp(lines): a piece's own lines (notes/sea-song), or HARP_LINES
  function Harp(lines) { return { c: null, phi: 0, recent: [], up: 0, down: 0, notes: 0, k: 0, L: linesOk(lines) ? lines.slice() : HARP_LINES }; }
  // one note: the pitch class (s semitones above D) in octave copies (D2 … 2.4 kHz) under a Gaussian over log2 f
  // (σ 0.7 octave, centred on D5 + 0.5·tanh(ln|F| / 2.5): lower near zeros, higher near poles), copies under −30 dB
  // dropped (usually 3 remain); each a dark plucked string (T60 1.8 s at D5, ∝ f^−0.5), in tune: one detune (±1.5 cents)
  // shared by all its strings, so its octaves are pure (notes/sea-song/r2). A D is +1.8 dB (×1.23; ×1.26 put the old
  // harp's D at −29.4 LUFS-M, 0.1 dB over its −32 ± 2.5 window: review sound-5) and has the turn's accent on
  // its D4 copy: that string is louder by the accent (half the note's level, added in power, as two independent strings
  // added on average), one string and not a second one at the same pitch, whose sum would depend on the phases
  // (notes/sea-song/r3). sign: in the D-only zone an up D also sounds the A above, a down D the A below
  function harpString(g, f, a, at, bright, pn, tier, tag, cap, oct, key, ph0) {
    R = prng((seedBase + 0x9E3779B9 * ++cueN) >>> 0);
    const Pt = []; pluck(Pt, 0, f, { t60: 1.8 * Math.pow(f / 587.33, -0.5), bright, amp: a, dark: true, tune: true, oct, ph0 });
    return emitCue(g, Object.assign({ tier: TI[tier], pan: pn, wet: 0.12, g: 1, parts: Pt, tag, str: 1 }, cap ? { cap } : {}, key ? { key } : {}), at);
  }
  function harpNote(g, s, vel, t, ln, dir, sign, pan, tier, tag, cap) {
    const cen = 0.5 * Math.tanh((Number.isFinite(ln) ? ln : ln > 0 ? 50 : -50) / 2.5), isD = s === 0, base = 73.416 * Math.pow(2, s / 12), bright = 0.2 + 0.25 * clamp((vel - 0.4) / 0.45, 0, 1);
    const amp = LV.harp * vel * (isD ? 1.23 : 1), pn = clamp((pan || 0) + 0.12 * dir, -0.4, 0.4);
    let end = t;
    FS = g.c.sampleRate;
    R = prng((seedBase + 0x9E3779B9 * ++cueN) >>> 0);
    const det = cents(rnd(-1.5, 1.5));
    const string = (f, a, at, oc) => { end = Math.max(end, harpString(g, f * det, a, at, bright, pn, tier, tag, cap, 0, 0, 0.25 * oc)); };
    for (let oc = 0; oc < 6; oc++) {
      const f = base * Math.pow(2, oc); if (f > 2400) break;
      const d = (Math.log2(f / 587.33) - cen) / 0.7, w0 = Math.exp(-0.5 * d * d), acc = isD && oc === 2 ? 0.5 : 0;
      if (w0 < 0.0316 && !acc) continue;
      const w = w0 < 0.0316 ? 0 : w0;
      string(f, amp * Math.hypot(w, acc), t, oc);
      if (sign && w > 0.5) string(f * Math.pow(2, (dir > 0 ? 7 : -5) / 12), 0.3 * amp * w, t + 0.03, oc);
    }
    return end;
  }
  // a composed piece's note (notes/sea-song/r3): one string at the written pitch, m in MIDI (A4 = 440 Hz; a fraction is
  // the score's own tuning, e.g. its just fifth), no detune: a pitch is always the same string, plucked again (key) and
  // never two near-unisons. Its octave for small speakers is its own 2nd partial at dbl of the fundamental (one string,
  // a fixed level), not a second string. PIECE_G: about the level of the two strings it replaces (1.25 at round 2's
  // LV.harp, 0.0918)
  const PIECE_G = 1.38;
  function pieceNote(g, m, vel, t, dir, pan, tier, tag, cap, dbl) {
    const bright = 0.2 + 0.25 * clamp((vel - 0.4) / 0.45, 0, 1), amp = LV.harp * PIECE_G * vel, pn = clamp((pan || 0) + 0.12 * dir, -0.4, 0.4);
    FS = g.c.sampleRate;
    return harpString(g, 440 * Math.pow(2, (m - 69) / 12), amp, t, bright, pn, tier, tag, cap, dbl > 0 ? dbl : 0, Math.round(m));
  }
  // a harp step: the arg went from st.phi to phi over dt seconds of the probe, played from t0 on the audio clock (the
  // notes spread over the step as the crossings were). o: {ln, pan, dt, shaky (the D-only zone near a zero or pole,
  // while the pointer moves), h (the band, turns: HARP_H … 1/8), tier, tag, vel, note, dbl, cap}. o.vel (a composed
  // curve's stored dynamics, notes/sea-song): the k-th crossing (st.k) sounds at velocity o.vel[k], in place of the rate
  // rules and the D-only thinning; under 0.02 it is silent (it still counts, and takes no string). o.note (a piece's
  // written notes, MIDI, one per crossing, 0 for a crossing that is not a written note: silent): pieceNote in place of
  // the octave copies; o.dbl its octave string's level. o.cap: the strings kept at once (a number, or one per crossing: a
  // piece's theme keeps one note ringing, its chords four, notes/sea-song/r3). The lines are the harp's own (st.L).
  // Returns the crossings (tests count the Ds)
  function harpStep(st, g, t0, phi, o) {
    if (st.c === null) { st.c = cellL(phi, st.L); st.phi = phi; return []; }
    const h = o.h > HARP_H ? Math.min(0.125, o.h) : HARP_H;
    const P0 = st.phi, dt = clamp(o.dt || 0.016, 0.008, 0.1), fired = harpCross(st, P0, phi, h);
    st.phi = phi;
    if (!fired.length) return fired;
    const rateT = Math.abs(phi - P0) / dt;   // turns per second
    for (const n of fired) {
      const nL = st.L.length, s = st.L[((n.i % nL) + nL) % nL], isD = s === 0, at = t0 + n.u * dt, vk = o.vel ? o.vel[st.k] : undefined, mk = o.note ? o.note[st.k] : undefined, ck = Array.isArray(o.cap) ? o.cap[st.k] : o.cap;
      st.k++;
      while (st.recent.length && st.recent[0] < at - 0.5) st.recent.shift();
      st.recent.push(at);
      // notes per second: over the last 0.5 s, or implied by how fast arg F turns now (5 strings a turn), so the first
      // notes of a sudden run are already lighter; above 24 a second only the Ds sound (the count survives)
      const rate = Math.max(st.recent.length / 0.5, 5 * rateT), dOnly = vk == null && (!!o.shaky || st.recent.length / 0.5 > 24);
      if (isD) { if (n.dir > 0) st.up++; else st.down++; }
      if (!isD && dOnly) continue;
      if ((vk != null && vk < 0.02) || (o.note && !(mk > 0))) continue;
      let vel = 0.55 + 0.3 * clamp(Math.log10(Math.max(rateT, 0.1) / 0.1), 0, 1);
      if (rate > 2.5) vel *= Math.pow(2.5 / rate, 0.6);
      if (rate > 14) vel *= 14 / rate;
      // (review v16 sound-picture-1: a still probe under a changing F, a zero passing beside it, hears its sweep: the
      // fast-run rule is for a hand that sweeps, so here the notes keep at least 0.25, about 12 dB under a normal note,
      // not 30)
      if (o.still) vel = Math.max(vel, 0.25);
      if (vk != null) vel = clamp(vk, 0, 1);
      st.notes++;
      if (g) busy(mk > 0 ? pieceNote(g, mk, vel, at, n.dir, o.pan, o.tier || 'sonify', o.tag, ck, o.dbl) : harpNote(g, s, vel, at, o.ln, n.dir, isD && dOnly, o.pan, o.tier || 'sonify', o.tag, ck));
    }
    return fired;
  }
  // a closed curve (listen along): seated as if it had arrived at its start from its own end (shifted by its whole
  // turns), so a curve that starts exactly on a line sounds that line once, at the start, and not again when it closes
  // there: its low Ds are its winding number wherever it starts
  function alongSeat(st, phi, closed, t0) {
    const n = phi.length;
    if (closed && n > 2) { const W = phi[n - 1] - phi[0], p0 = phi[n - 2] - W; st.c = cellL(p0, st.L); harpCross(st, p0, phi[0]); st.phi = phi[0]; }
    else harpStep(st, null, t0, phi[0], {});
  }
  // the crossings listen along would play on these samples (nothing sounds), on the default lines or a piece's own:
  // a stored velocity list must match it
  function alongCount(phi, closed, lines) {
    const st = Harp(lines);
    alongSeat(st, phi, closed, 0);
    let k = 0;
    for (let j = 1; j < phi.length; j++) { k += harpCross(st, st.phi, phi[j]).length; st.phi = phi[j]; }
    return k;
  }
  // "listen along": the harp played along a curve's samples (phi: unwrapped turns, la: ln|F|, uniform in time over dur
  // s), scheduled now on the audio clock, tagged so that stopping it drops what has not sounded. Returns the D count.
  // o: {tag, closed, cuts (tick times, s), pan, lines, vel, note, dbl (a composed curve's own lines, and its velocities
  // and written notes, one per crossing: harpStep; the app passes them only when alongCount agrees), cap (its strings at
  // once: a number or one per crossing), tickDb (its drum: one gain per cut, dB; each tick then a single pluck)}
  function harpAlong(phi, la, dur, o = {}) {
    if (!AC || !P.on || hidden || !P.events || !canSchedule(false)) return null;
    const st = Harp(o.lines), n = phi.length, t0 = ctx.currentTime + Math.max(0.03, LEAD + 0.01), dt = dur / Math.max(1, n - 1);
    alongSeat(st, phi, o.closed, t0);
    for (let j = 1; j < n; j++) harpStep(st, G, t0 + (j - 1) * dt, phi[j], { ln: la[j], pan: o.pan || 0, dt, tier: 'events', tag: o.tag, vel: o.vel, note: o.note, dbl: o.dbl, cap: o.cap });
    const td = o.tickDb && o.cuts && o.tickDb.length === o.cuts.length ? o.tickDb : null;
    (o.cuts || []).forEach((tt, i) => play('cut', Object.assign({ at: Math.max(0.03, LEAD + 0.01) - LEAD + tt, force: true, tier: 'events', tag: o.tag }, td ? { gainDb: td[i], one: true, noRep: true } : {})));
    busy(t0 + dur + 2);
    return { t0, up: st.up, down: st.down, notes: st.notes, now: () => ctx.currentTime };
  }

  // ---------------------------------------------------------------- curves sing (option 4)
  // ph: the unwrapped arg in turns at M points evenly spaced in arc length around a closed curve (the start not
  // repeated at the end), W its winding number. The phase signal e^{2πiφ̃(s)}, played compressed: φ̃(s) = W s +
  // λ (φ(s) − W s − mean), λ the largest ≤ 1 with an RMS deviation ≤ 0.12 turn; its mean slope is still W, so the
  // spectral centre Σ k|b_k|² stays exactly W while the spread shrinks, and W is the strongest harmonic: the note.
  // b_k for k = −8 … 20 → harmonic n = 4 + k of D3 (n ≤ 0 dropped), a Lanczos taper beyond 6 from W. Returns {A, n0}
  function curveAmps(ph, W) {
    const M = ph.length, NH = LIB.NH, re = new Float64Array(M), im = new Float64Array(M), dv = new Float64Array(M);
    let mu = 0; for (let j = 0; j < M; j++) { dv[j] = ph[j] - ph[0] - W * j / M; mu += dv[j]; } mu /= M;
    let e = 0; for (let j = 0; j < M; j++) { dv[j] -= mu; e += dv[j] * dv[j]; }
    const rms = Math.sqrt(e / M), lam = rms > 0.12 ? 0.12 / rms : 1;
    for (let j = 0; j < M; j++) { const p = TAU * (W * j / M + lam * dv[j]); re[j] = Math.cos(p); im[j] = Math.sin(p); }
    const A = new Array(NH).fill(0);
    for (let k = -8; k <= 20; k++) {
      const n = 4 + k; if (n <= 0 || n > NH) continue;
      // Σ x_j e^{−2πi k j / M}, the twiddle by rotation
      const w = -TAU * k / M, cr = Math.cos(w), ci = Math.sin(w);
      let tr = 1, ti = 0, sr = 0, si = 0;
      for (let j = 0; j < M; j++) { sr += re[j] * tr - im[j] * ti; si += re[j] * ti + im[j] * tr; const t = tr * cr - ti * ci; ti = tr * ci + ti * cr; tr = t; }
      let wt = 1; const dd = Math.abs(k - W) - 6; if (dd > 0) { const x = Math.PI * dd / 7; wt = Math.max(0, Math.sin(x) / x); }
      A[n - 1] = Math.hypot(sr, si) / M * wt;
    }
    return { A, n0: 4 + W, lam };
  }
  // a winding number the singer can sing: its harmonic 4 + W of D3 is one of 1 … NH (W = −3 … 20). Outside, curveAmps
  // has no note (only the hum would sound), so the callers play the pings or speak W instead (review sound-2)
  const singable = (W) => Number.isInteger(W) && 4 + W >= 1 && 4 + W <= LIB.NH;
  // low notes lose most of their level on a phone or laptop speaker: +2, +3, +4 dB on harmonics 3, 2, 1
  const LOWMK = [1, Math.pow(10, 4 / 20), Math.pow(10, 3 / 20), Math.pow(10, 2 / 20)];
  const lowMake = (n0) => (n0 >= 1 && n0 <= 3 ? LOWMK[n0] : 1);
  let singOn = false, singOffAt = 0, singTier = '', singSeq = 0;
  // the singer's commands for one note (also the lab's offline renders): the spectrum, its level (the release note 1 dB
  // over the calibrated −32, the live note 1 dB under), a gate on (o.gate: its sequence number, 0 for none) and, for a
  // release, the gate off 1.5 s later
  function singCmds(A, n0, mode, T, tier, o = {}) {
    const rel = mode === 'release', lvl = LV.hv * (rel ? 1.12 : 0.89) * lowMake(n0);
    /** @type {any[]} */
    const cmds = [{ k: 'hv', at: T, amps: A, slew: rel ? (o.sounding ? 0.12 : 0.05) : 0.05, lvl, lt: rel ? 0.3 : 0.03, hum: 0.45, vow: 1, tier: TI[tier], tag: o.tag == null ? null : o.tag }];
    if (o.gate) cmds.push({ k: 'hv', at: T, gate: 1, t1: 0.04, n: o.gate });
    if (rel && o.gate) cmds.push({ k: 'hv', at: T + 1.5, gate: 0, t1: 0.13, n: o.gate, tag: o.tag });
    return cmds;
  }
  // the singer: o.mode 'live' (the deformation: the note follows each new spectrum, slews 50 ms) or 'release' (a loop
  // drawn, a curve listened to: a 0.3 s bloom into the note, hold 1.2 s, then a T60 of 1.2 s); o.tier, o.at (s from
  // now), o.tag. The singer belongs to one tier at a time (it switches only while silent)
  function sing(A, n0, o = {}) {
    const tier = o.tier || 'sonify';
    if (!AC || !P.on || hidden || !P[tier] || !G || !G.synth || !canSchedule(false)) return false;
    const now = ctx.currentTime, T = now + LEAD + (o.at || 0);
    if (singOn && now >= singOffAt && singOffAt > 0) singOn = false;
    const rel = o.mode === 'release';
    // gates carry a sequence number: a release's own gate-off (1.5 s later) is ignored once a newer note has begun
    const gateOn = !singOn || rel || singOffAt > 0;
    G.synth.post(singCmds(A, n0, o.mode, T, tier, { sounding: singOn, gate: gateOn ? ++singSeq : 0, tag: o.tag }));
    singOffAt = rel ? T + 2.8 : 0;
    singOn = true; singTier = tier;
    busy(T + (rel ? 3 : 1));
    return true;
  }
  // the live note fades (τ 50 ms per stage, or 8 ms when fast)
  function singOff(o = {}) {
    if (!singOn || !G || !G.synth || !ctx) { singOn = false; return; }
    if (singOffAt > 0 && !o.force) return;   // a release note ends by itself
    G.synth.post([{ k: 'hv', at: ctx.currentTime + LEAD, gate: 0, t1: o.fast ? 0.008 : 0.05, n: singSeq }]);
    singOn = false; singTier = ''; singOffAt = 0;
  }

  const leadOf = (c) => (typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext ? 0 : LEAD);
  // a target curve from wherever the param is, starting no earlier than now + LEAD
  function follow(c, p, v, tau, t = 0) {
    const T = Math.max(t || 0, c.currentTime + leadOf(c));
    p.cancelScheduledValues(T);
    if (tau > 0) p.setTargetAtTime(v, T, tau); else p.setValueAtTime(v, T);
    return T;
  }
  // Esc, hidden, off: everything stops now, queues are emptied, the voices are gated off; the setting is unchanged.
  // The synth drops what is queued and fades what sounds in 12 ms (raised cosine); the bus dips on a 12 ms raised cosine
  // and comes back on a 30 ms one 50 ms later; every fallback source stops inside the silent window. A hush during a
  // hush joins its silent window, or (in its return) starts a new one after it: value curves never overlap.
  function hush() {
    pendQ.clear();
    if (!ctx || !G) return;
    const now = ctx.currentTime + LEAD, at = G.hushAt == null ? -1 : G.hushAt;
    let t = at;
    if (!(now <= at + 0.035)) {
      t = Math.max(now, at + 0.081);
      try { G.bus.gain.setValueCurveAtTime(FADE_DN, t, 0.012); G.bus.gain.setValueCurveAtTime(FADE_UP, t + 0.05, 0.03); }
      catch (e) { t = follow(ctx, G.bus.gain, 0, 0.004); G.bus.gain.setTargetAtTime(1, t + 0.05, 0.015); }
      G.hushAt = t;
    }
    if (G.synth) G.synth.post([{ k: 'clear' }]);
    if (G.later) G.later.clear();
    HH.along = null;
    const off = Math.max(now, t + 0.013);
    for (const s of G.active) { try { s.stop(off); } catch (e) { /* not started */ } }
    Q.turn.next = Q.contour.next = 0; Q.turn.due.length = Q.contour.due.length = 0;
    SC.tex = false; motionOn = false; singOn = false; singTier = ''; singOffAt = 0; busyUntil = 0;
    hearEnd();
  }
  // stop one tagged group (a "listen along"): what has not sounded is dropped, what sounds fades in 12 ms. The fallback's
  // sources fade on their own gain (a 12 ms raised cosine) and stop after it: a stop alone cut a ringing string's wave
  // (review sound-4)
  function stopTag(tag) {
    if (HH.along && HH.along.tag === tag) HH.along = null;
    for (const [name, q] of [...pendQ]) if (q.o.tag === tag) pendQ.delete(name);
    if (!ctx || !G) return;
    if (G.synth) G.synth.post([{ k: 'clear', tag }]);
    if (G.later) for (const j of G.later) if (j.tag === tag) G.later.delete(j);
    const t = ctx.currentTime + LEAD;
    for (const s of G.active) {
      if (s.tag !== tag) continue;
      try { if (s.out) s.out.gain.setValueCurveAtTime(FADE_DN, t, 0.012); } catch (e) { /* a fade already scheduled */ }
      try { s.stop(t + 0.013); } catch (e) { /* ended */ }
    }
    if (singTier === 'events') { singOn = false; singTier = ''; singOffAt = 0; }
  }


