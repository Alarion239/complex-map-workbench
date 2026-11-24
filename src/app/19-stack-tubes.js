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
  // A label's placement (drawStackLabels) is scored on what it covers of the marks drawn, a mark by its weight: a tube's slice ring
  // or strand 1, a critical strand or a line to the target 2, a critical cross, a critical value's dot or the target's centre 4,
  // the target's ring and the join ring 8 (the ring is dragged with the Pick tool, so a plate over it hides a handle)
  const TUBE_AVOID_W = { tube: 1, strand: 2, line: 2, mark: 4, ring: 8 };
  // Beyond the plate's places beside its dot, farther ones: TUBE_FAR_DIRS directions at TUBE_FAR_AT plate heights from the dot,
  // joined to it by a leader line where the plate is more than a plate height away; each px of leader costs TUBE_LEADER_COST, and
  // each mark it crosses a quarter of the mark's weight
  const TUBE_KEPT_MAX = 8;   // the labels whose last place is kept (tubeKept)
  const TUBE_FAR_DIRS = 16, TUBE_FAR_AT = [1.5, 2.5, 4, 6, 9, 13], TUBE_LEADER_COST = 0.002, TUBE_LEADER_CROSS = 0.25, TUBE_LEADER_A = 0.6;
  const tubeCache = new Map(), tubeKept = new Map();   // tubeKept: a label's last place as an offset from its dot, by its words
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
  // whether the segment a–b meets box B = [x0, y0, x1, y1]
  function tubeSegMeets(a, b, B) {
    if ((a[0] < B[0] && b[0] < B[0]) || (a[0] > B[2] && b[0] > B[2]) || (a[1] < B[1] && b[1] < B[1]) || (a[1] > B[3] && b[1] > B[3])) return false;
    const inside = (p) => p[0] >= B[0] && p[0] <= B[2] && p[1] >= B[1] && p[1] <= B[3];
    if (inside(a) || inside(b)) return true;
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [d, q] of [[-dx, a[0] - B[0]], [dx, B[2] - a[0]], [-dy, a[1] - B[1]], [dy, B[3] - a[1]]]) {
      if (d === 0) { if (q < 0) return false; continue; }
      const t = q / d;
      if (d < 0) { if (t > t1) return false; t0 = Math.max(t0, t); } else { if (t < t0) return false; t1 = Math.min(t1, t); }
    }
    return t0 <= t1;
  }
  // whether the segments a–b and c–d cross
  function tubeSegCross(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  }
  // the weight (TUBE_AVOID_W) of the marks in avoid ({lines: [{kind, pts}], dots: [{kind, x, y, r}]}, css px) that box B meets
  function tubeCovered(avoid, B) {
    let n = 0;
    for (const l of avoid.lines) {
      // (a polyline's own box, made when first asked, keeps a plate far from it from reading its segments)
      let bb = l.bb;
      if (!bb) {
        bb = l.bb = [Infinity, Infinity, -Infinity, -Infinity];
        for (const p of l.pts) { if (p[0] < bb[0]) bb[0] = p[0]; if (p[0] > bb[2]) bb[2] = p[0]; if (p[1] < bb[1]) bb[1] = p[1]; if (p[1] > bb[3]) bb[3] = p[1]; }
      }
      if (bb[0] > B[2] || bb[2] < B[0] || bb[1] > B[3] || bb[3] < B[1]) continue;
      for (let i = 1; i < l.pts.length; i++) if (tubeSegMeets(l.pts[i - 1], l.pts[i], B)) n += TUBE_AVOID_W[l.kind];
    }
    for (const q of avoid.dots) if (q.x + q.r >= B[0] && q.x - q.r <= B[2] && q.y + q.r >= B[1] && q.y - q.r <= B[3]) n += TUBE_AVOID_W[q.kind];
    return n;
  }
  // the cost of a leader line a–b over the marks it crosses (TUBE_LEADER_CROSS of the weight of each of a mark's kinds above a tube's)
  function tubeLeaderCost(avoid, a, b) {
    let n = 0;
    for (const l of avoid.lines) if (TUBE_AVOID_W[l.kind] > 1) for (let i = 1; i < l.pts.length; i++) if (tubeSegCross(a, b, l.pts[i - 1], l.pts[i])) n += TUBE_AVOID_W[l.kind];
    for (const q of avoid.dots) if (segDist([q.x, q.y], a, b) <= q.r) n += TUBE_AVOID_W[q.kind];
    return TUBE_LEADER_CROSS * n + TUBE_LEADER_COST * Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  // the narrowings' labels (drawStackTubes' labels) on ctx at strength fade, last, over every level: a dot at the
  // narrowing and the words on a halo plate, in the room R the box is fitted in ([x0, y0, x1, y1], css px: stackRoom), where
  // the plate covers least of the marks drawn (avoid: drawStackTubes' and Look down's shapes, tubeCovered). Its places, the
  // first of equal cover winning: the one beside the dot (to its right, or to its left where R has no room there, and
  // above it where that would cover it), then to its right, to its left, above and below it; where none is clear, the place it
  // had at the last frame (an offset from the dot, so that it stays as the camera turns), then any of TUBE_FAR_DIRS directions at TUBE_FAR_AT plate heights from the dot, joined to it by a leader line where it is a plate height
  // or more away. Each label's box [x0, y0, x1, y1] (css px, the plate's), its place (`place`: 'beside', 'right',
  // 'left', 'above', 'below', 'kept', 'far'), what it covers (`covered`, in marks' weight) and its leader line ([x, y, x, y] or null) are kept on it
  function drawStackLabels(ctx, labels, fade, R, avoid) {
    ctx.save();
    ctx.font = `${TUBE_FONT}px ${TH.ui}`; ctx.textBaseline = 'middle';
    const ph = TUBE_FONT + 2 * TUBE_PLATE, taken = { lines: avoid.lines.slice(), dots: avoid.dots };
    for (const L of labels) {
      const [x, y] = L.at, tw = ctx.measureText(L.text).width;
      const room = (x0, ty) => [Math.max(R[0] + TUBE_LABEL_DX, Math.min(R[2] - TUBE_LABEL_DX - tw, x0)), Math.max(R[1] + ph / 2, Math.min(R[3] - ph / 2, ty))];
      const boxOf = (x0, ty) => [x0 - TUBE_PLATE, ty - ph / 2, x0 + tw + TUBE_PLATE, ty + ph / 2];
      const covers = (B) => B[0] <= x + TUBE_DOT && B[2] >= x - TUBE_DOT && B[1] <= y + TUBE_DOT && B[3] >= y - TUBE_DOT;
      const right = x + TUBE_LABEL_DX + tw <= R[2] - TUBE_LABEL_DX;
      const [bx, by] = room(right ? x + TUBE_LABEL_DX : x - TUBE_LABEL_DX - tw, y);
      const beside = covers(boxOf(bx, by)) ? [bx, y - ph] : [bx, by];
      let best = null;
      const consider = (place, pos, leader) => {
        const [x0, ty] = pos;
        const box = boxOf(x0, ty);
        if (place !== 'beside' && covers(box)) return;
        const covered = tubeCovered(taken, box);
        if (best && covered >= best.cost) return;
        const cost = covered + (leader ? tubeLeaderCost(taken, [x, y], leader) : 0);
        if (!best || cost < best.cost) best = { place, x0, ty, box, covered, cost, leader };
      };
      consider('beside', beside, null);
      consider('right', room(x + TUBE_LABEL_DX, y), null);
      consider('left', room(x - TUBE_LABEL_DX - tw, y), null);
      consider('above', room(x - tw / 2, y - ph), null);
      consider('below', room(x - tw / 2, y + ph), null);
      // (and where it was last, so that a plate that is still clear stays where it was as the camera turns)
      const kept = tubeKept.get(L.text);
      if (best.covered > 0 && kept) {
        const pos = room(x + kept[0], y + kept[1]), B = boxOf(...pos), end = [Math.max(B[0], Math.min(B[2], x)), Math.max(B[1], Math.min(B[3], y))];
        consider('kept', pos, Math.hypot(end[0] - x, end[1] - y) >= ph ? end : null);
      }
      if (best.covered > 0) {
        // (the nearest ring of places with one that covers nothing is the last asked: farther ones only cost more leader)
        for (const k of TUBE_FAR_AT) if (best.covered > 0) for (let a = 0; a < TUBE_FAR_DIRS; a++) {
          const pos = room(x + k * ph * Math.cos(a * TAU / TUBE_FAR_DIRS) - tw / 2, y + k * ph * Math.sin(a * TAU / TUBE_FAR_DIRS)), B = boxOf(...pos);
          const end = [Math.max(B[0], Math.min(B[2], x)), Math.max(B[1], Math.min(B[3], y))];
          consider('far', pos, Math.hypot(end[0] - x, end[1] - y) >= ph ? end : null);
        }
      }
      tubeKept.set(L.text, [best.x0 - x, best.ty - y]);
      if (tubeKept.size > TUBE_KEPT_MAX) tubeKept.delete(tubeKept.keys().next().value);
      L.box = best.box; L.place = best.place; L.covered = best.covered; L.leader = best.leader && [x, y, ...best.leader];
      taken.lines.push({ kind: 'ring', pts: [[best.box[0], best.box[1]], [best.box[2], best.box[1]], [best.box[2], best.box[3]], [best.box[0], best.box[3]], [best.box[0], best.box[1]]] });
      if (best.leader) { ctx.globalAlpha = TUBE_LEADER_A * fade; ctx.strokeStyle = TH.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(...best.leader); ctx.stroke(); }
      ctx.globalAlpha = TH.haloA * fade; ctx.fillStyle = TH.halo; ctx.fillRect(best.box[0], best.box[1], best.box[2] - best.box[0], best.box[3] - best.box[1]);
      ctx.globalAlpha = fade; ctx.fillStyle = TH.ink;
      ctx.beginPath(); ctx.arc(x, y, TUBE_DOT, 0, TAU); ctx.fill();
      ctx.fillText(L.text, best.x0, best.ty);
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
    // (what is drawn, for the labels to keep off: the slices' rings, the strands between them, the critical strands)
    const avoid = { lines: [], dots: [] };
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let j = 0; j <= TUBE_LEVELS; j++) {
      const t0 = (j - 1) / TUBE_LEVELS, t = j / TUBE_LEVELS;
      // every piece's strands between the slice below and this one, then every piece's slice here (its fill, and its ring)
      if (j > 0) {
        for (const P of d.pieces) {
          ctx.globalAlpha = TUBE_RULE_A * fade; ctx.strokeStyle = ink(P).edge; ctx.lineWidth = 1; ctx.beginPath();
          for (const L of P.loops) for (let i = 0; i < L.z.length; i += TUBE_RULE_EVERY) {
            const a = at(mix(L.z[i], L.w[i], t0), t0), b = at(mix(L.z[i], L.w[i], t), t);
            ctx.moveTo(...a); ctx.lineTo(...b); avoid.lines.push({ kind: 'tube', pts: [a, b] });
          }
          ctx.stroke();
        }
      }
      // (the floor's and the glass's rings are the patch's edge and the target's rim, which those layers draw)
      const drawn = j > 0 && j < TUBE_LEVELS;
      for (const P of d.pieces) {
        if (drawn) ctx.beginPath();
        for (const L of P.loops) {
          const ring = L.z.map((z, i) => at(mix(z, L.w[i], t), t));
          avoid.lines.push({ kind: 'tube', pts: [...ring, ring[0]] });
          if (drawn) { ring.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); }
        }
        if (!drawn) continue;
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
      avoid.lines.push({ kind: 'strand', pts: [a, b] });
      strands.push({ z: [z.re, z.im], w: [w.re, w.im], from: a, to: b });
    }
    ctx.restore();
    // the narrowings, where their labels go (drawStackLabels)
    const c = C(s.c[0], s.c[1]);
    const labels = d.narrows.map((n) => ({ text: tubeNarrowText(n), z: [n.z.re, n.z.im], s: n.s, at: at(mix(n.z, c, n.s), n.s) }));
    const pts = (L, key, t) => L[key].filter((_, i) => i % TUBE_RULE_EVERY === 0).map((p) => ({ p: [p.re, p.im], px: at(p, t) }));
    const rec = { fade, ruleA: TUBE_RULE_A, dots: TUBE_CRIT_DOTS, pieces: d.pieces.map((P) => ({ ink: P.ink, colour: ink(P).edge, loops: P.loops.map((L) => ({ floor: pts(L, 'z', 0), glass: pts(L, 'w', 1) })) })), strands, labels };
    // (not an enumerable field: what the labels keep off stays out of the record stackDrawn keeps)
    Object.defineProperty(rec, 'avoid', { value: avoid });
    return rec;
  }
