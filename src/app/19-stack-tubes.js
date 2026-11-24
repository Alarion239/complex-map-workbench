  // ---------------- the Stack's tubes: each piece of the preimage carried up the straight strands to the disc ----------------
  // A strand joins a floor point z to F(z) on the glass (F: the map from the plane shown to the disc's plane) in a
  // straight line: at height s, 0 the floor and 1 the glass, it is at (1 − s)·z + s·F(z) in the floor's own coordinates,
  // so the box's slice at s is the graph of F turned in C². A piece of the disc's preimage (Pieces.count, the readout
  // card's) is bounded by loops of preimages of the disc's rim, so the strands from its loops make a tube from its lit
  // patch on the floor up to the rim on the glass. A tube is drawn as its slices, bottom to top, with the strands between
  // two slices drawn before the upper one: the camera is above the floor, so along any line of sight a higher slice is
  // nearer, and that order is the order in depth. The critical strands and the lines from the floor to the glass (the
  // 'lines' layer) span every height and are drawn over all the slices, which are nearly clear. Each piece takes
  // one colour (TUBE_INKS: the shapes' theme colours, the violet first), filled even-odd so a piece's holes stay open.
  // Every TUBE_RULE_EVERY-th strand of a loop is drawn, and each critical point's strand rises, dotted in the cut's red
  // (the join ring is dashed), to its critical value. Near a preimage z₀ of the centre, the slice at s is the loop scaled by (1 − s) + s·F′(z₀):
  // where F′(z₀) is a negative real number that is 0 at s = 1 / (1 − F′(z₀)), so the tube narrows to a point there,
  // which is not a join, and a label says so, drawn last, over the glass.
  // The tubes, the critical strands and the labels stand up out of the floor: they fade in with the tilt (stackTilt), at
  // full strength from TUBE_FULL_TILT, and straight down they are not drawn, so that frame is Look down's.
  const TUBE_PTS = 64, TUBE_LEVELS = 10, TUBE_RULE_EVERY = 8;
  const TUBE_INKS = [5, 0, 2, 3, 1, 4, 6, 7];   // TH.c's colours in the pieces' order
  const TUBE_FILL_A = 0.08, TUBE_RING_A = 0.4, TUBE_RULE_A = 0.6;
  const TUBE_FULL_TILT = 0.5;                  // cos(pitch) at 60°
  const NARROW_TOL = 1e-6;                     // F′ counts as real when |Im F′| ≤ NARROW_TOL·|F′|
  const TUBE_CRIT_DOTS = [0, 4];               // css px: a critical strand's dots (round caps make each dash of length 0 a dot)
  const TUBE_DOT = 2.5, TUBE_LABEL_DX = 7, TUBE_FONT = 12, TUBE_PLATE = 3;   // css px: a narrowing's dot, its words' gap from it, their size, their plate's margin
  const tubeCache = new Map();
  // n of a closed loop's points, about evenly spaced by arc length: the loop's own points (preimages of the rim, so a
  // tube's ends lie exactly on the patch's edge and the rim), all of them when it has n or fewer
  function tubeResample(path, n) {
    if (path.length <= n) return path.slice();
    const L = [0];
    for (let i = 1; i < path.length; i++) L.push(L[i - 1] + CX.abs(CX.sub(path[i], path[i - 1])));
    const total = L[path.length - 1] + CX.abs(CX.sub(path[0], path[path.length - 1])), out = [];
    for (let j = 0, i = 0; j < n; j++) {
      const t = (total * j) / n;
      while (i < path.length - 1 && L[i + 1] <= t) i++;
      out.push(i < path.length - 1 && L[i + 1] - t < t - L[i] ? path[i + 1] : path[i]);
    }
    return out;
  }
  // The tubes of disc s over the plane shown, in the plane's coordinates, or null where its pieces are not counted:
  // {pieces: [{ink: index into TH.c, loops: [{z: C[], w: C[]}] (each loop's points and their images on the glass)}],
  //  narrows: [{z, d (F′(z)), s (the height it narrows at)}]}, kept per plane, stage, chain and disc
  function tubeData(s) {
    const k = leftStage(), T = shapeStage(s), key = JSON.stringify([k, T, chainSig[nSteps()], s.c, s.r]);
    if (tubeCache.has(key)) return tubeCache.get(key);
    const pc = readoutData(s).pc;
    let d = null;
    if (pc.counted) {
      const F = rangeF(k, T);
      const dF = (z) => { const h = 1e-6 * (1 + CX.abs(z)); return CX.scale(CX.sub(F(CX.add(z, C(h, 0))), F(CX.sub(z, C(h, 0)))), 0.5 / h); };
      const pieces = pc.pieces.map((P, i) => ({ ink: TUBE_INKS[i % TUBE_INKS.length], loops: P.loops.map((li) => {
        const z = tubeResample(pc.loops[li].path, TUBE_PTS);
        return { z, w: z.map(F) };
      }) }));
      const narrows = [];
      for (const r of pc.roots) {
        if (!r.z || r.mult !== 1) continue;
        const dz = dF(r.z);
        if (dz.re < 0 && Math.abs(dz.im) <= NARROW_TOL * CX.abs(dz)) narrows.push({ z: r.z, d: C(dz.re, 0), s: 1 / (1 - dz.re) });
      }
      d = { pieces, narrows };
    }
    tubeCache.set(key, d);
    while (tubeCache.size > 16) tubeCache.delete(tubeCache.keys().next().value);
    return d;
  }
  // a number or a complex number as the labels write it: the language's decimal mark and a true minus sign
  const tubeNum = (z) => I18N.num(CX.fmt(z, 3)).replace(/-/g, '−');
  // the narrowing's words: "narrows here: F′(−1) = −2, not a join" (the map named as the plane's title names it)
  function tubeNarrowText(n) {
    const name = svMapName('text', leftStage(), shapeStage(findShape(selected))) || 'f', f = name.includes('∘') ? `(${name})` : name;
    return $t('narrows here: {d}, not a join', { d: `${f}′(${tubeNum(n.z)}) = ${tubeNum(n.d)}` });
  }
  // the narrowings' labels (drawStackTubes' labels) on ctx at strength fade, last, over every level: a dot at the
  // narrowing and the words beside it on a halo plate, to its right, or to its left where the room R the box is fitted in
  // ([x0, y0, x1, y1], css px: stackRoom) has none there; kept across inside the room, and above the dot where that would
  // cover it. Each label's box [x0, y0, x1, y1] (css px, the plate's) is kept on it
  function drawStackLabels(ctx, labels, fade, R) {
    ctx.save();
    ctx.font = `${TUBE_FONT}px ${TH.ui}`; ctx.textBaseline = 'middle';
    for (const L of labels) {
      const [x, y] = L.at, tw = ctx.measureText(L.text).width, right = x + TUBE_LABEL_DX + tw <= R[2] - TUBE_LABEL_DX;
      const x0 = Math.max(R[0] + TUBE_LABEL_DX, Math.min(R[2] - TUBE_LABEL_DX - tw, right ? x + TUBE_LABEL_DX : x - TUBE_LABEL_DX - tw));
      const ty = x0 - TUBE_PLATE <= x + TUBE_DOT && x0 + tw + TUBE_PLATE >= x - TUBE_DOT ? y - TUBE_FONT - TUBE_PLATE : y;
      L.box = [x0 - TUBE_PLATE, ty - TUBE_FONT / 2 - TUBE_PLATE, x0 + tw + TUBE_PLATE, ty + TUBE_FONT / 2 + TUBE_PLATE];
      ctx.globalAlpha = TH.haloA * fade; ctx.fillStyle = TH.halo; ctx.fillRect(L.box[0], L.box[1], L.box[2] - L.box[0], L.box[3] - L.box[1]);
      ctx.globalAlpha = fade; ctx.fillStyle = TH.ink;
      ctx.beginPath(); ctx.arc(x, y, TUBE_DOT, 0, TAU); ctx.fill();
      ctx.fillText(L.text, x0, ty);
    }
    ctx.restore();
  }
  // The tubes of disc s on ctx (the pane's overlay, css px) for the flat view of pane, seen through the floor's and the
  // glass's level maps Fm and Gm at the given tilt; the critical points crit (plane points) get their dashed strands.
  // Returns what was drawn, in the plane's coordinates and the pane's css px (stackDrawn's tubes), or null
  function drawStackTubes(pane, ctx, s, Fm, Gm, tilt, crit) {
    const d = tubeData(s), fade = Math.min(1, tilt / TUBE_FULL_TILT);
    if (!d || fade <= 0) return null;
    // a plane point at height t, through the level map at t (the levels' maps are affine in the height)
    const at = (p, t) => {
      const [x, y] = pane.w2s(p), m = Fm.map((v, i) => v + t * (Gm[i] - v));
      return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    };
    const mix = (z, w, t) => C(z.re + t * (w.re - z.re), z.im + t * (w.im - z.im));
    const ink = (P) => TH.c[P.ink];
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let j = 0; j <= TUBE_LEVELS; j++) {
      const t0 = (j - 1) / TUBE_LEVELS, t = j / TUBE_LEVELS;
      // every piece's strands between the slice below and this one, then every piece's slice here (its fill, and its ring)
      if (j > 0) {
        for (const P of d.pieces) {
          ctx.globalAlpha = TUBE_RULE_A * fade; ctx.strokeStyle = ink(P).edge; ctx.lineWidth = 1; ctx.beginPath();
          for (const L of P.loops) for (let i = 0; i < L.z.length; i += TUBE_RULE_EVERY) { ctx.moveTo(...at(mix(L.z[i], L.w[i], t0), t0)); ctx.lineTo(...at(mix(L.z[i], L.w[i], t), t)); }
          ctx.stroke();
        }
      }
      if (j === 0 || j === TUBE_LEVELS) continue;
      for (const P of d.pieces) {
        ctx.beginPath();
        for (const L of P.loops) { L.z.forEach((z, i) => { const [x, y] = at(mix(z, L.w[i], t), t); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); }
        ctx.globalAlpha = TUBE_FILL_A * fade; ctx.fillStyle = ink(P).c0; ctx.fill('evenodd');
        ctx.globalAlpha = TUBE_RING_A * fade; ctx.strokeStyle = ink(P).edge; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    // the critical points' strands, dotted, to their values
    const F = rangeF(leftStage(), shapeStage(s)), strands = [];
    ctx.globalAlpha = fade; ctx.strokeStyle = TH.cut; ctx.lineWidth = 2; ctx.setLineDash(TUBE_CRIT_DOTS);
    for (const z of crit) {
      const w = F(z);
      if (!CX.isFin(w)) continue;
      const a = at(z, 0), b = at(w, 1);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
      strands.push({ z: [z.re, z.im], w: [w.re, w.im], from: a, to: b });
    }
    ctx.restore();
    // the narrowings, where their labels go (drawStackLabels)
    const c = C(s.c[0], s.c[1]);
    const labels = d.narrows.map((n) => ({ text: tubeNarrowText(n), z: [n.z.re, n.z.im], s: n.s, at: at(mix(n.z, c, n.s), n.s) }));
    const pts = (L, key, t) => L[key].filter((_, i) => i % TUBE_RULE_EVERY === 0).map((p) => ({ p: [p.re, p.im], px: at(p, t) }));
    return { fade, ruleA: TUBE_RULE_A, dots: TUBE_CRIT_DOTS, pieces: d.pieces.map((P) => ({ ink: P.ink, colour: ink(P).edge, loops: P.loops.map((L) => ({ floor: pts(L, 'z', 0), glass: pts(L, 'w', 1) })) })), strands, labels };
  }
