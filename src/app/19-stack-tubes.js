  // ---------------- the Stack's tubes: each piece of the preimage carried up its connectors to the disc ----------------
  // A connector (19-stack-links.js) carries a floor point z up to F(z) on the glass (F: the map from the plane shown to
  // the disc's plane): straight, at height s, 0 the floor and 1 the glass, it is at (1 − s)·z + s·F(z) in the floor's own
  // coordinates, so the box's slice at s is the graph of F turned in C²; curved, it follows the glide's own path. A piece
  // of the disc's preimage (Pieces.count, the readout card's) is bounded by loops of preimages of the disc's rim, so the
  // connectors from its loops make a tube from its lit patch on the floor up to the rim on the glass. A tube is drawn as
  // its slices, bottom to top, with the strands between two slices drawn before the upper one: the camera is above the
  // floor, so along any line of sight a higher slice is nearer, and that order is the order in depth. The critical
  // strands and the lines from the floor to the glass (the 'lines' layer) span every height and are drawn over all the
  // slices, which are nearly clear. Each piece takes one colour (TUBE_INKS: the shapes' theme colours, the violet
  // first), filled even-odd so a piece's holes stay open. Every TUBE_RULE_EVERY-th strand of a loop is drawn, and each
  // critical point's strand rises, dotted in the cut's red (the join ring is dashed), to its critical value. Straight,
  // near a preimage z₀ of the centre the slice at s is the loop scaled by (1 − s) + s·F′(z₀): where F′(z₀) is a negative
  // real number that is 0 at s = 1 / (1 − F′(z₀)), so the tube narrows to a point there, which is not a join, and a label
  // says so, drawn last, over the glass; curved, a slice torn by a glide's cut is labelled the same way.
  // The tubes, the critical strands and the labels stand up out of the floor: they fade in with the tilt (stackTilt), at
  // full strength from TUBE_FULL_TILT, and straight down they are not drawn, so that frame is Look down's.
  const TUBE_PTS = 64, TUBE_LEVELS = 10, TUBE_RULE_EVERY = 8;
  const TUBE_INKS = [5, 0, 2, 3, 1, 4, 6, 7];   // TH.c's colours in the pieces' order
  const TUBE_FILL_A = 0.08, TUBE_RING_A = 0.4, TUBE_RULE_A = 0.6;
  const TUBE_FULL_TILT = 0.5;                  // cos(pitch) at 60°
  // how far the tubes stand up at a tilt: 0 straight down, 1 from TUBE_FULL_TILT
  const tubeFade = (tilt) => Math.min(1, tilt / TUBE_FULL_TILT);
  // the point a share t of the way from z to w (complex numbers): a straight strand's place at height t
  const tubeMix = (z, w, t) => C(z.re + t * (w.re - z.re), z.im + t * (w.im - z.im));
  const NARROW_TOL = 1e-6;                     // F′ counts as real when |Im F′| ≤ NARROW_TOL·|F′|
  const TUBE_CRIT_DOTS = [0, 4];               // css px: a critical strand's dots (round caps make each dash of length 0 a dot)
  const TUBE_DOT = 2.5, TUBE_LABEL_DX = 7, TUBE_FONT = 12, TUBE_PLATE = 3, TUBE_OFF = 3;   // css px: a narrowing's dot, its words' gap from it, their size, their plate's margin; the open ring where a critical strand leaves the box
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
  // {pieces: [{ink: index into TH.c, covers: how many times it covers the disc, loops: [{z: C[]}] (each loop's points)}],
  //  narrows: [{z, d, s, p, a, b, piece}]}, kept per plane, stage, chain, disc and All at once. A narrowing is where the straight
  //  connectors from a preimage z₀ of the centre narrow to a point: on the part from level a to level b of the planes
  //  between (stackLevelStages; the floor and the glass alone when there are none), at z, z₀'s image on level a, where
  //  the step's map f from a to b has f′(z) = d a negative real number, at the height s, where it passes the plane point p
  function tubeData(s) {
    const k = leftStage(), T = shapeStage(s), key = JSON.stringify([k, T, chainSig[nSteps()], s.c, s.r, !!S.homAll]);
    if (tubeCache.has(key)) return tubeCache.get(key);
    const pc = readoutData(s).pc;
    let d = null;
    if (pc.counted) {
      const { L, G, m } = stackLevelMaps(k, T), f = L.slice(1).map((b, n) => rangeF(L[n], b));
      const dF = (g, z) => { const h = 1e-6 * (1 + CX.abs(z)); return CX.scale(CX.sub(g(CX.add(z, C(h, 0))), g(CX.sub(z, C(h, 0)))), 0.5 / h); };
      const pieces = pc.pieces.map((P, i) => ({ ink: TUBE_INKS[i % TUBE_INKS.length], covers: P.covers, loops: P.loops.map((li) => {
        const z = tubeResample(pc.loops[li].path, TUBE_PTS);
        return { z };
      }) }));
      const narrows = [];
      for (const r of pc.roots) {
        if (!r.z || r.mult !== 1) continue;
        for (let n = 0; n < m; n++) {
          const z = G[n](r.z), dz = dF(f[n], z);
          if (!(dz.re < 0 && Math.abs(dz.im) <= NARROW_TOL * CX.abs(dz))) continue;
          const u = 1 / (1 - dz.re), w = G[n + 1](r.z);
          narrows.push({ z, d: C(dz.re, 0), s: (n + u) / m, p: tubeMix(z, w, u), a: L[n], b: L[n + 1], piece: r.piece });
        }
      }
      d = { pieces, narrows };
    }
    tubeCache.set(key, d);
    while (tubeCache.size > 16) tubeCache.delete(tubeCache.keys().next().value);
    return d;
  }
  // a number or a complex number as the labels write it: the language's decimal mark in each of its parts (I18N.num marks
  // one number) and a true minus sign
  const tubeNum = (z) => CX.fmt(z, 3).split(/(\s+)/).map((p) => I18N.num(p)).join('').replace(/-/g, '−');
  // whether the point z lies inside the closed polygon of points path (C[]): the ray to the right crosses it an odd number of times
  function tubeInside(path, z) {
    let c = false;
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      const a = path[i], b = path[j];
      if ((a.im > z.im) !== (b.im > z.im) && z.re < a.re + ((z.im - a.im) * (b.re - a.re)) / (b.im - a.im)) c = !c;
    }
    return c;
  }
  // The tubes that cover the disc more than once, by their critical points whose values lie in the disc (the connectors' critical
  // strands, ln.crit): [{piece, crit, z, text}], the words "covers the disc twice: its critical point 0" (k times: "covers the disc
  // 3 times: …"). A piece's critical point is the one inside its outer loop; where two such pieces nest, the smaller
  function tubeCovers(d, ln, s) {
    const out = [];
    ln.crit.forEach((lev, k) => {
      const z = lev[0], w = lev[LINK_N];
      if (!CX.isFin(w) || Math.hypot(w.re - s.c[0], w.im - s.c[1]) >= s.r) return;
      let best = -1;
      d.pieces.forEach((P, n) => { if (P.covers > 1 && P.loops.length && tubeInside(P.loops[0].z, z) && (best < 0 || P.covers < d.pieces[best].covers)) best = n; });
      if (best < 0) return;
      const zt = tubeNum(z), cv = d.pieces[best].covers;
      out.push({ piece: best, crit: k, z, text: cv === 2 ? $t('covers the disc twice: its critical point {z}', { z: zt }) : $t('covers the disc {k} times: its critical point {z}', { k: cv, z: zt }) });
    });
    return out;
  }
  // the narrowing's words: "narrows here: F′(−1) = −2, not a join" (the map from its part's lower level to its upper one,
  // named as the plane's title names it)
  function tubeNarrowText(n) {
    const name = svMapName('text', n.a, n.b) || 'f', f = name.includes('∘') ? `(${name})` : name;
    // (the formula kept whole where a label breaks onto two lines: its spaces are no-break ones)
    return $t('narrows here: {d}, not a join', { d: `${f}′(${tubeNum(n.z)}) = ${tubeNum(n.d)}`.replace(/ /g, '\u00a0') });
  }
  // the tubes' labels (drawStackTubes' labels) on ctx at strength fade, last, over every level: a dot at the place and
  // the words on a halo plate. Each label's plate lies inside the room R the box is fitted in ([x0, y0, x1, y1], css px:
  // stackRoom), clear of the labels placed before it and of the marks drawn ([x, y] css px: the tubes', the strands' and
  // Look down's), counted on a grid of TUBE_CELL px. It takes the first of TUBE_SPOTS beside its dot (the dot at the
  // plate's end or corner) that is clear, on one line and then on two (broken at the space nearest the middle); where
  // none is, the clear spot nearest the dot, TUBE_STEP px apart over the room, with a leader from the dot to the plate;
  // where there is none, the spot beside the dot over the fewest marks. Each label's box [x0, y0, x1, y1] (css px, the
  // plate's), its lines, how many marks its plate covers (hits) and its leader (null: none) are kept on it
  const TUBE_SPOTS = ['right', 'left', 'above right', 'above left', 'below right', 'below left'];
  const TUBE_CELL = 4, TUBE_STEP = 6;
  function drawStackLabels(ctx, labels, fade, R, marks = []) {
    ctx.save();
    ctx.font = `${TUBE_FONT}px ${TH.ui}`; ctx.textBaseline = 'middle';
    const width = (lines) => Math.max(...lines.map((t) => ctx.measureText(t).width)), lh = TUBE_FONT + 2, P = TUBE_PLATE, g = TUBE_LABEL_DX;
    // (the marks counted in TUBE_CELL px cells of the room, as a summed-area table: a plate's count in four reads)
    const nx = Math.max(1, Math.ceil((R[2] - R[0]) / TUBE_CELL)), ny = Math.max(1, Math.ceil((R[3] - R[1]) / TUBE_CELL));
    const cell = new Float64Array(nx * ny), sat = new Float64Array((nx + 1) * (ny + 1));
    const put = (x, y, n) => { const i = Math.floor((x - R[0]) / TUBE_CELL), j = Math.floor((y - R[1]) / TUBE_CELL); if (i >= 0 && i < nx && j >= 0 && j < ny) cell[j * nx + i] += n; };
    for (const [x, y] of marks) put(x, y, 1);
    const sum = () => { for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) sat[(j + 1) * (nx + 1) + i + 1] = cell[j * nx + i] + sat[j * (nx + 1) + i + 1] + sat[(j + 1) * (nx + 1) + i] - sat[j * (nx + 1) + i]; };
    sum();
    const over = (b) => {
      const i0 = Math.max(0, Math.floor((b[0] - R[0]) / TUBE_CELL)), j0 = Math.max(0, Math.floor((b[1] - R[1]) / TUBE_CELL));
      const i1 = Math.min(nx, Math.ceil((b[2] - R[0]) / TUBE_CELL)), j1 = Math.min(ny, Math.ceil((b[3] - R[1]) / TUBE_CELL));
      return i1 <= i0 || j1 <= j0 ? 0 : sat[j1 * (nx + 1) + i1] - sat[j0 * (nx + 1) + i1] - sat[j1 * (nx + 1) + i0] + sat[j0 * (nx + 1) + i0];
    };
    const inRoom = (b) => b[0] >= R[0] && b[1] >= R[1] && b[2] <= R[2] && b[3] <= R[3];
    for (const L of labels) {
      const [x, y] = L.at, sp = [...L.text.matchAll(/ /g)].map((m) => m.index), mid = L.text.length / 2;
      const two = sp.length ? (() => { const i = sp.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a)); return [L.text.slice(0, i), L.text.slice(i + 1)]; })() : null;
      const options = two ? [[L.text], two] : [[L.text]], size = (lines) => [width(lines) + 2 * P, lines.length * lh - 2 + 2 * P];
      let best = null, near = null;
      for (const lines of options) {
        const [w, h] = size(lines);
        for (const spot of TUBE_SPOTS) {
          const x0 = spot === 'right' ? x + g - P : spot === 'left' ? x - g + P - w : spot.endsWith('right') ? x + TUBE_DOT : x - TUBE_DOT - w;
          const y0 = spot.startsWith('above') ? y - TUBE_DOT - 2 - h : spot.startsWith('below') ? y + TUBE_DOT + 2 : y - h / 2;
          const b = [x0, y0, x0 + w, y0 + h];
          if (!inRoom(b)) continue;
          const hits = over(b);
          if (!near || hits < near.hits) near = { b, lines, hits, leader: null };
          if (hits === 0) { best = near; break; }
        }
        if (best) break;
      }
      // (none beside the dot is clear: the clear spot nearest it, with a leader)
      for (const lines of best ? [] : options) {
        const [w, h] = size(lines);
        for (let y0 = R[1]; y0 + h <= R[3]; y0 += TUBE_STEP) for (let x0 = R[0]; x0 + w <= R[2]; x0 += TUBE_STEP) {
          const b = [x0, y0, x0 + w, y0 + h], cx = Math.max(b[0], Math.min(b[2], x)), cy = Math.max(b[1], Math.min(b[3], y)), dd = Math.hypot(cx - x, cy - y);
          if ((!best || dd < best.dd) && over(b) === 0) best = { b, lines, hits: 0, leader: [cx, cy], dd };
        }
      }
      if (!best) best = near || (() => { const [w, h] = size([L.text]), x0 = Math.max(R[0], Math.min(R[2] - w, x + g - P)), b = [x0, y - h / 2, x0 + w, y + h / 2]; return { b, lines: [L.text], hits: over(b), leader: null }; })();
      L.box = best.b; L.lines = best.lines; L.hits = best.hits; L.leader = best.leader;
      // (a plate placed is a mark for the labels after it)
      for (let yy = best.b[1]; yy <= best.b[3]; yy += TUBE_CELL) for (let xx = best.b[0]; xx <= best.b[2]; xx += TUBE_CELL) put(xx, yy, 1);
      sum();
      ctx.globalAlpha = fade; ctx.strokeStyle = TH.ink; ctx.lineWidth = 1;
      if (L.leader) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(...L.leader); ctx.stroke(); }
      ctx.globalAlpha = TH.haloA * fade; ctx.fillStyle = TH.halo; ctx.fillRect(L.box[0], L.box[1], L.box[2] - L.box[0], L.box[3] - L.box[1]);
      ctx.globalAlpha = fade; ctx.fillStyle = TH.ink;
      ctx.beginPath(); ctx.arc(x, y, TUBE_DOT, 0, TAU); ctx.fill();
      L.lines.forEach((t, i) => ctx.fillText(t, L.box[0] + P, L.box[1] + P + TUBE_FONT / 2 + i * lh));
    }
    ctx.restore();
  }
  // The tubes of disc s on ctx (the pane's overlay, css px) for the flat view of pane, seen through the floor's and the
  // glass's level maps Fm and Gm at the given tilt, along the connectors ln (stackLinks': the tubes' loops, and the
  // critical points' strands, dotted). Everything is drawn inside the box only: a slice inside the box's rectangle at its
  // height, a strand as far as it is inside (stackClipPath), a critical strand with an open ring where it leaves it.
  // Labelled: straight, a narrowing; curved, a slice the glide's cut tears; and in both, where a tube leaves the window
  // (tubeExits) and where two pieces' tubes meet (ln.crosses). Returns what was drawn, in the plane's coordinates and
  // the pane's css px (stackDrawn's tubes; marks: the points drawn, which the labels keep clear of), or null
  function drawStackTubes(pane, ctx, s, Fm, Gm, tilt, ln) {
    const d = tubeData(s), fade = tubeFade(tilt);
    if (!d || fade <= 0) return null;
    // a point of the flat plane's css px at height t, through the level map at t (the levels' maps are affine in the
    // height); a plane point there
    const lift = (q, t) => { const m = stackMapAt(Fm, Gm, t); return [m[0] * q[0] + m[2] * q[1] + m[4], m[1] * q[0] + m[3] * q[1] + m[5]]; };
    const at = (p, t) => lift(pane.w2s(p), t);
    const ink = (P) => TH.c[P.ink], per = LINK_N / TUBE_LEVELS, box = [[0, 0], [pane.w, 0], [pane.w, pane.h], [0, pane.h]];
    // the labels (drawStackLabels): straight, the narrowings; curved, the tears; the tubes out of the window and the
    // pieces that meet (of the tubes the glide brings together, the lowest meeting alone)
    const exits = tubeExits(pane, ln), num = (x) => I18N.num(x.toFixed(2));
    const labels = (ln.mode === 'curved'
      ? ln.tears.map((r) => ({ text: linkTearText(), kind: 'tear', piece: r.piece, z: [r.z.re, r.z.im], s: r.s, at: at(r.z, r.s) }))
      : d.narrows.filter((n) => d.pieces[n.piece].covers < 2).map((n) => ({ text: tubeNarrowText(n), kind: 'narrow', z: [n.z.re, n.z.im], s: n.s, at: at(n.p, n.s) })))
      .concat(tubeCovers(d, ln, s).map((x) => ({ text: x.text, kind: 'covers', piece: x.piece, z: [x.z.re, x.z.im], s: 0.5, at: at(ln.crit[x.crit][Math.round(LINK_N / 2)], 0.5) })))
      .concat(exits.map((x) => ({ text: x.s1 < 1 ? $t('out of the window from here to height {s}', { s: num(x.s1) }) : $t('out of the window from here up'), kind: 'exit', piece: x.piece, s: x.s0, s1: x.s1, at: lift(x.at, x.at[2]) })))
      .concat(ln.crosses.filter((x, i) => x.kind === 'cross' || ln.crosses.findIndex((y) => y.kind === 'sooner') === i)
        .map((x) => ({ text: x.kind === 'cross' ? $t('the pieces cross here, not a join') : $t('the glide brings the pieces together from here, not a join'), kind: x.kind, pieces: x.pieces, z: [x.z.re, x.z.im], s: x.s, s1: x.s1, at: at(x.z, x.s) })));
    // (what is drawn, as points in the canvas's css px, for the labels to keep clear of: gathered only where there are
    // labels)
    const marks = [], keep = labels.length > 0, fl = tubeFlat(pane, ln);
    const put = (x, y, first) => { if (keep) marks.push([x, y]); if (first) ctx.moveTo(x, y); else ctx.lineTo(x, y); };
    // (a point's path through the heights J0..J1 of the connectors' samples, xy[J][i] in the flat plane's css px, as far as
    // it is inside the box: whole where it all is, else its runs there (stackClipPath)); returns where it leaves the box
    const path = (xy, ins, i, J0, J1) => {
      let all = true;
      for (let J = J0; J <= J1 && all; J++) all = ins[J][i];
      if (all) { for (let J = J0; J <= J1; J++) { const [x, y] = lift(xy[J][i], J / LINK_N); put(x, y, J === J0); } return []; }
      const q = [];
      for (let J = J0; J <= J1; J++) q.push([...xy[J][i], J / LINK_N]);
      const cl = stackClipPath(pane, q);
      for (const r of cl.runs) r.forEach((p, k) => { const [x, y] = lift(p, p[2]); put(x, y, k === 0); });
      return cl.ends;
    };
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let j = 0; j <= TUBE_LEVELS; j++) {
      // every piece's strands between the slice below and this one, then every piece's slice here (its fill, and its ring)
      if (j > 0) {
        d.pieces.forEach((P, n) => {
          ctx.globalAlpha = TUBE_RULE_A * fade; ctx.strokeStyle = ink(P).edge; ctx.lineWidth = 1; ctx.beginPath();
          for (const L of fl.pieces[n]) for (let i = 0; i < L.xy[0].length; i += TUBE_RULE_EVERY) path(L.xy, L.ins, i, (j - 1) * per, j * per);
          ctx.stroke();
        });
      }
      if (j === 0 || j === TUBE_LEVELS) continue;
      const t = j / TUBE_LEVELS, J = j * per, cut = !fl.pieces.every((P) => P.every((L) => L.all[J]));
      // (clipped to the box's rectangle at this height only where a slice goes out of it)
      if (cut) { ctx.save(); ctx.beginPath(); box.forEach((q, i) => { const [x, y] = lift(q, t); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.clip(); }
      d.pieces.forEach((P, n) => {
        ctx.beginPath();
        for (const L of fl.pieces[n]) { L.xy[J].forEach((q, i) => { const [x, y] = lift(q, t); put(x, y, i === 0); }); ctx.closePath(); }
        ctx.globalAlpha = TUBE_FILL_A * fade; ctx.fillStyle = ink(P).c0; ctx.fill('evenodd');
        ctx.globalAlpha = TUBE_RING_A * fade; ctx.strokeStyle = ink(P).edge; ctx.lineWidth = 1; ctx.stroke();
      });
      if (cut) ctx.restore();
    }
    // (the lit patches' edges on the floor and the rim on the glass, the tubes' ends)
    if (keep) for (const P of fl.pieces) for (const L of P) for (const J of [0, LINK_N]) L.xy[J].forEach((q, i) => { if (L.ins[J][i]) marks.push(lift(q, J / LINK_N)); });
    // the critical points' strands, dotted, to their values, and an open ring where one leaves the box
    const strands = [];
    ln.crit.forEach((lev, k) => {
      const z = lev[0], w = lev[LINK_N];
      if (!CX.isFin(w)) return;
      ctx.globalAlpha = fade; ctx.strokeStyle = TH.cut; ctx.lineWidth = 2; ctx.setLineDash(TUBE_CRIT_DOTS);
      ctx.beginPath();
      const ends = path(fl.crit[k].xy, fl.crit[k].ins, 0, 0, LINK_N);
      ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1.5;
      for (const e of ends) { ctx.beginPath(); ctx.arc(...lift(e, e[2]), TUBE_OFF, 0, TAU); ctx.stroke(); }
      strands.push({ z: [z.re, z.im], w: [w.re, w.im], from: at(z, 0), to: at(w, 1), off: ends.length, pts: lev.filter((_, J) => J % per === 0).map((p, J) => at(p, J / TUBE_LEVELS)) });
    });
    ctx.restore();
    const pts = (lev, J) => lev[J].map((p, i) => [p, i]).filter(([, i]) => i % TUBE_RULE_EVERY === 0).map(([p]) => ({ p: [p.re, p.im], px: at(p, J / LINK_N) }));
    return {
      fade, ruleA: TUBE_RULE_A, dots: TUBE_CRIT_DOTS, mode: ln.mode, strands, labels, marks,
      pieces: d.pieces.map((P, n) => ({ ink: P.ink, colour: ink(P).edge, loops: ln.pieces[n].loops.map((lev) => ({ floor: pts(lev, 0), glass: pts(lev, LINK_N) })) })),
    };
  }
  // The connectors' samples in the flat plane's css px for the view of pane, and which lie inside the box (the pane's
  // rectangle): {pieces: [[{xy, ins, all}]] per piece and loop, crit: [{xy, ins}]}, xy[J][i] a sample's [x, y], ins[J][i]
  // whether it is inside, all[J] whether the whole slice is; kept while the connectors and the view (the pane's size, and
  // where it puts 0 and 1) are the same, so a turn of the camera maps the kept points only
  const tubeFlatKept = new WeakMap();
  const tubeViewKey = (pane) => [pane.w, pane.h, ...pane.w2s(C(0, 0)), ...pane.w2s(C(1, 0))].join();
  function tubeFlat(pane, ln) {
    const key = tubeViewKey(pane), kept = tubeFlatKept.get(ln);
    if (kept && kept.key === key) return kept.fl;
    const inside = (q) => q[0] >= 0 && q[0] <= pane.w && q[1] >= 0 && q[1] <= pane.h;
    const of = (lev) => { const xy = lev.map((q) => q.map((z) => pane.w2s(z))), ins = xy.map((q) => q.map(inside)); return { xy, ins, all: ins.map((q) => q.every(Boolean)) }; };
    const fl = { pieces: ln.pieces.map((P) => P.loops.map(of)), crit: ln.crit.map((path) => of(path.map((z) => [z]))) };
    tubeFlatKept.set(ln, { key, fl });
    return fl;
  }
  // Where the tubes leave the window (the pane's rectangle, at every height): for each piece whose slices go out of it,
  // the first stretch of heights they are out, s0 to s1 (1: they do not come back in), and the point (the flat plane's
  // css px, with its height) where the first of its strands to go out leaves the box: [{piece, s0, s1, at}], from the
  // samples' places for the view (tubeFlat)
  function tubeExits(pane, ln) {
    const out = [], fl = tubeFlat(pane, ln);
    fl.pieces.forEach((P, n) => {
      let J0 = -1, J1 = LINK_N, first = null;
      for (let J = 1; J < LINK_N; J++) {
        const l = P.findIndex((L) => !L.all[J]);
        if (l >= 0 && J0 < 0) { J0 = J; first = [l, P[l].ins[J].indexOf(false)]; } else if (l < 0 && J0 >= 0) { J1 = J; break; }
      }
      if (J0 < 0) return;
      const L = P[first[0]], q = [];
      for (let J = 0; J <= J0; J++) q.push([...L.xy[J][first[1]], J / LINK_N]);
      out.push({ piece: n, s0: J0 / LINK_N, s1: J1 / LINK_N, at: stackClipPath(pane, q).ends[0] || q[J0] });
    });
    return out;
  }
