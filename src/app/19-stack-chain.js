  // ---------------- the Stack's chains: a glass level for each plane between the floor and the glass ----------------
  // With planes between the plane shown (the floor, stage k) and the disc's plane (the glass, stage T), the Stack shows
  // each of them as a level at an equal height (stackLevelStages: plane n of m at up = n / m), and the disc's preimage on
  // each level (Pieces.tree): every piece of a level lies in one piece of the level above, the one its roots map into,
  // and the straight connectors run from each level to the next (linkLevels), so the tubes from the floor's pieces meet on
  // the levels as the pieces nest (M4 z → z² → w₁² − 1: 4 pieces on z, 2 on w₁, each holding two of them, then the disc).
  // A glide between k and T that goes all at once passes no plane between, so its Stack has the floor and the glass
  // alone. Where a level's pieces are not counted (a step with no exact inverse, a rim through a critical value) there is
  // no tree, and no tubes either: the card names the step the count stops at (readoutCounts).
  // A middle level is drawn as the glass is without its tint, which would cover the tubes above it: its frame and the
  // outlines of its pieces, in the ink of the first piece below that each holds, so a tube keeps its colour into the
  // piece it joins. It stands up out of the floor as the tubes do (tubeFade): straight down it is not drawn, and the
  // frame is Look down's.
  const LEVEL_RING_A = 0.85, LEVEL_FILL_A = 0.12, LEVEL_RING_W = 1.5;
  const chainCache = new Map();
  // The levels of disc s's Stack, from the floor up: {levels: [{stage, up, pieces: [{parent (index into the next level's
  // pieces, -1 for the glass's), roots: C[] (the disc's centre's preimages in it; the centre itself on the glass), covers,
  // ink (index into TH.c), loops: C[][] (its edge's closed loops, TUBE_PTS points each; none on the glass)}]}], why: null}
  // or, where the levels are not counted, {levels: [], why: the reason, step: the step the count stops at}. Kept per
  // plane, stage, chain, disc and All at once
  function stackChain(s) {
    const k = leftStage(), T = shapeStage(s), key = JSON.stringify([k, T, chainSig[nSteps()], s.c, s.r, !!S.homAll]);
    if (chainCache.has(key)) return chainCache.get(key);
    const L = stackLevelStages(k, T), c = C(s.c[0], s.c[1]);
    let t;
    try { t = Pieces.tree(S.steps, built, L, c, s.r); } catch (e) { t = { counted: false, reason: String(e && e.message), step: null }; }
    let d;
    if (!t.counted) d = { levels: [], why: t.reason, step: t.step };
    else {
      const m = L.length - 1, levels = [];
      t.levels.forEach((lv, i) => {
        const below = levels[i - 1];
        levels.push({ stage: lv.stage, up: i / m, pieces: lv.pieces.map((P, j) => {
          // (the floor's inks are tubeData's; above, the ink of the first piece below that this one holds)
          const kid = below ? below.pieces.find((Q) => Q.parent === j) : null;
          return {
            parent: P.parent, covers: P.covers, ink: kid ? kid.ink : TUBE_INKS[j % TUBE_INKS.length],
            roots: lv.count ? P.roots.map((ri) => lv.count.roots[ri].z).filter(Boolean) : [c],
            loops: lv.count ? lv.count.pieces[j].loops.map((li) => tubeResample(lv.count.loops[li].path, TUBE_PTS)) : [],
          };
        }) });
      });
      d = { levels, why: null };
    }
    chainCache.set(key, d);
    while (chainCache.size > 16) chainCache.delete(chainCache.keys().next().value);
    return d;
  }
  // The step the disc's count stops at, from plane k down to plane T's disc |w − c| < r, through every live plane between
  // (whether or not a glide between them goes all at once): {step, name (its map, as the plane's title names it)}, or
  // null where the count goes through (or no step can be named)
  function chainStuck(k, T, c, r) {
    const P = svPlanes(), i0 = P.indexOf(k), i1 = P.indexOf(T);
    if (i0 < 0 || i1 <= i0) return null;
    let t;
    try { t = Pieces.tree(S.steps, built, P.slice(i0, i1 + 1), c, r); } catch (e) { return null; }
    if (t.counted || !(t.step > 0)) return null;
    const below = P.filter((q) => q < t.step).pop();
    return { step: t.step, name: svMapName('text', below == null ? k : below, t.step) };
  }
  // The middle levels of chain d (stackChain's) on ctx (the pane's overlay, css px) for the flat view of pane, seen
  // through the levels' maps between the floor's Fm and the glass's Gm at the given tilt. Returns what was drawn
  // (stackDrawn's mids: each level's stage, up, its frame's corners in the pane's css px, and its pieces' loops, every
  // TUBE_RULE_EVERY-th point, each {p: the plane point, px: where it is drawn})
  function drawStackLevels(pane, ctx, d, Fm, Gm, tilt) {
    const fade = tubeFade(tilt), out = [];
    if (!d || fade <= 0) return out;
    const corners = [[0, 0], [pane.w, 0], [pane.w, pane.h], [0, pane.h]];
    ctx.save();
    ctx.lineJoin = 'round';
    for (const lv of d.levels) {
      if (lv.up <= 0 || lv.up >= 1) continue;
      const m = Fm.map((v, i) => v + lv.up * (Gm[i] - v)), at = ([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
      const frame = corners.map(at);
      ctx.globalAlpha = STACK_EDGE_A * tilt; ctx.strokeStyle = TH.ink; ctx.lineWidth = 1;
      ctx.beginPath(); frame.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
      const pieces = lv.pieces.map((P) => {
        const loops = P.loops.map((q) => q.map((z) => at(pane.w2s(z))));
        ctx.beginPath();
        for (const q of loops) { q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
        ctx.globalAlpha = LEVEL_FILL_A * fade; ctx.fillStyle = TH.c[P.ink].c0; ctx.fill('evenodd');
        ctx.globalAlpha = LEVEL_RING_A * fade; ctx.strokeStyle = TH.c[P.ink].edge; ctx.lineWidth = LEVEL_RING_W; ctx.stroke();
        const pts = (q, n) => q.map((z, i) => [z, i]).filter(([, i]) => i % TUBE_RULE_EVERY === 0).map(([z, i]) => ({ p: [z.re, z.im], px: loops[n][i] }));
        return { ink: P.ink, loops: P.loops.map(pts) };
      });
      out.push({ stage: lv.stage, up: lv.up, frame, pieces });
    }
    ctx.restore();
    return out;
  }
