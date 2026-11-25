  // ---------------- the Stack's connectors: how a floor point rises to its image on the glass ----------------
  // A connector carries a point z of the plane shown (the floor, stage k) up to F(z) on the disc's plane (the glass,
  // stage T). Its place at height s, 0 the floor and 1 the glass, in the floor's own coordinates, is one of two kinds
  // (SV.links, the Stack key's switch, saved with the steps view's place):
  // - 'straight': (1 − s)·z + s·F(z), so the box's slice at s is the graph of F turned in C²; with planes between (the
//   Stack's middle levels, stackLevelStages), straight from each plane's image of z to the next one's, plane n of m at
//   s = n / m;
  // - 'curved': the glide's own path from plane k to plane T, as the steps view glides it. With m steps between, s runs
  //   them in turn, step j (0-based) at u = m·s − j through its natural homotopy (homF), from the plane before it; with
  //   All at once (S.homAll, two steps or more), every step at once at u = s.
  // The tubes, the critical strands and the lines to the target all rise along it (19-stack-tubes.js), so the floor's
  // and the glass's ends are the same in both kinds. Each connector is sampled at LINK_N + 1 heights, kept per plane,
  // stage, chain, disc and kind (linkCache): a frame maps the kept points only.
  // An integer power's glide z^(1 + (n − 1)t) has a cut (the principal one), and a piece of the preimage that straddles it
  // would be torn in two half way up (z² about 1: the −1 piece). Where the step offers its homotopy with the cut moved
  // (homCut) and the piece's outer loop neither winds round 0 nor surrounds it, the piece rises on the branch whose cut
  // lies in the middle of the turn its loop leaves free (linkMid); every branch ends at the one zⁿ. A slice still torn
  // (another glide's cut, or a piece about 0) is found where a step between two of its points is far longer than the
  // rest (linkTear), and labelled so where it is widest, as the narrowing is.
  // Two pieces' tubes may meet on the way up, across and apart again, or, curved, together from a height to the glass well
  // below where the straight strands bring them together (M3's: the zoom's path makes the three tubes one from half
  // way up), which is no join: the place is labelled so (linkCrosses).
  const STACK_LINKS = ['straight', 'curved'];
  const LINK_N = 40;                // the heights a connector is sampled at, LINK_N + 1 with both ends (a multiple of TUBE_LEVELS)
  const LINK_TEAR_K = 10;           // a slice's step between two of its points that is LINK_TEAR_K times its median step
  const LINK_TEAR_SIZE = 0.15;      // and LINK_TEAR_SIZE of the slice's size, may be a tear: it is one where its jump keeps
  const LINK_TEAR_KEEP = 0.25, LINK_TEAR_HALVES = 12;   // LINK_TEAR_KEEP of its length over LINK_TEAR_HALVES halvings (linkTear)
  const linkCache = new Map();
  let linkBranch = true;            // (a test hook's) false: every piece rises on the steps' own cuts
  let linkShown = null;             // the connectors the Stack's last frame drew (stackMarks'), for the picks' strands drawn after its tubes
  const linkMode = () => (STACK_LINKS.includes(SV.links) ? SV.links : 'straight');
  // the middle of the turn about 0 that the closed loop q covers, as a lifted angle: the one nearest prev, or without one
  // the one whose branch gives the most of q's points their principal angle (the higher where two do, as the principal
  // angle takes π on the cut); null where the loop winds round 0, passes through it or covers a whole turn
  function linkMid(q, prev) {
    if (!q.length || q.some((p) => p.re === 0 && p.im === 0)) return null;
    let a = Math.atan2(q[0].im, q[0].re);
    const a0 = a;
    let mn = a, mx = a;
    for (let i = 1; i <= q.length; i++) {
      const p = q[i % q.length];
      let d = Math.atan2(p.im, p.re) - Math.atan2(q[i - 1].im, q[i - 1].re);
      if (d > Math.PI) d -= TAU; else if (d <= -Math.PI) d += TAU;
      a += d;
      if (i < q.length) { mn = Math.min(mn, a); mx = Math.max(mx, a); }
    }
    if (Math.abs(a - a0) > Math.PI || mx - mn >= TAU - 1e-6) return null;
    const mid = (mn + mx) / 2;
    if (prev != null) return mid + TAU * Math.round((prev - mid) / TAU);
    const m0 = mid - TAU * Math.ceil((mid - Math.PI) / TAU), args = q.map((p) => Math.atan2(p.im, p.re));
    const keep = (m) => args.filter((x) => x > m - Math.PI && x <= m + Math.PI).length;
    return [m0 + TAU, m0, m0 - TAU].reduce((best, m) => (keep(m) > keep(best) ? m : best));
  }
  // step b's homotopy at t, with its cut opposite mid where it has one to move and mid is known
  const linkHom = (b, t, mid) => {
    const B = built[b - 1];
    return mid != null && linkBranch && t > 0 && t < 1 && B && B.homCut ? B.homCut(mid + Math.PI)(t) : homF(b, t);
  };
  // the active steps from plane k to plane T
  const linkSteps = (k, T) => activeSteps().filter((b) => b > k && b <= T);
  // The planes the Stack shows from plane k up to plane T, k and T included: the live planes between them, at equal
  // heights; k and T alone where the glide between them goes all at once (svAllOk: two steps or more, no d/dz), whose
  // frames pass no plane between
  function stackLevelStages(k, T) {
    const P = svPlanes(), i0 = P.indexOf(k), i1 = P.indexOf(T);
    return i0 < 0 || i1 <= i0 || svAllOk(i0, i1) ? [k, T] : P.slice(i0, i1 + 1);
  }
  // A group of plane points pts carried up by the given kind, from k to T: {lev, at}, lev[j][i] point i at height
  // j / LINK_N, with lev[0] = pts and lev[LINK_N] their images, and at(j, z) any plane point z at height j on the group's
  // branches.
  // outer: the indices of the group's outer loop, whose turn about 0 picks a branch for each step that has a cut to move
  // (none: the steps' own cuts)
  function linkLevels(k, T, mode, pts, outer) {
    const F = rangeF(k, T);
    let at;
    if (mode !== 'curved') {
      // (straight from each level's image of z to the next one's: stackLevelStages' planes, the nth of m at j = n·LINK_N / m)
      const L = stackLevelStages(k, T), G = L.map((b) => (b === k ? (z) => z : rangeF(k, b))), m = L.length - 1;
      at = (j, z) => { const x = (j / LINK_N) * m, n = Math.min(m - 1, Math.floor(x)); return tubeMix(G[n](z), G[n + 1](z), x - n); };
    } else {
      const steps = linkSteps(k, T), m = steps.length, ring = (q) => (outer ? outer.map((i) => q[i]) : null);
      if (S.homAll && m > 1 && !steps.some((b) => isDeriv(b))) {
        // (all at once: each step's input moves with t, so its branch is picked again at each height from the outer loop
        // there, kept continuous)
        const mids = [], prev = steps.map(() => null);
        for (let j = 1; j < LINK_N; j++) {
          let q = pts;
          mids[j] = steps.map((b, n) => { const r = ring(q), mid = r ? linkMid(r, prev[n]) : null; prev[n] = mid; q = q.map(linkHom(b, j / LINK_N, mid)); return mid; });
        }
        at = (j, z) => { let w = z; steps.forEach((b, n) => { w = linkHom(b, j / LINK_N, mids[j][n])(w); }); return w; };
      } else {
        // (in turn: step n's input is the plane before it, the same at every height of its part, so its branch is too)
        const pre = steps.map((b) => rangeF(k, b - 1)), mids = steps.map((b, n) => { const r = ring(pts.map(pre[n])); return r ? linkMid(r, null) : null; });
        at = (j, z) => {
          const x = (j / LINK_N) * m, n = Math.min(m - 1, Math.floor(x)), b = steps[n], u = x - n, q = pre[n](z);
          return isDeriv(b) ? tubeMix(q, rangeF(k, b)(z), u) : linkHom(b, u, mids[n])(q);
        };
      }
    }
    const lev = [pts];
    for (let j = 1; j < LINK_N; j++) lev.push(pts.map((z) => at(j, z)));
    lev.push(pts.map(F));
    return { lev, at: (j, z) => (j <= 0 ? z : j >= LINK_N ? F(z) : at(j, z)) };
  }
  // The height at which a loop's slice is torn widest, and where: {j, z} (the middle of its jump), or null where it is
  // torn nowhere. A slice's longest step (LINK_TEAR_K times its median, LINK_TEAR_SIZE of its size) is halved on the
  // floor LINK_TEAR_HALVES times, each time keeping the half whose step is longer: a slice stretched smooth has its step
  // shrink with the halves, and a torn one keeps a jump of LINK_TEAR_KEEP of it
  function linkTear({ lev, at }, idx) {
    let best = null;
    for (let j = 1; j < LINK_N; j++) {
      const q = idx.map((i) => lev[j][i]);
      if (q.some((p) => !CX.isFin(p))) continue;
      const g = q.map((p, i) => CX.abs(CX.sub(q[(i + 1) % q.length], p)));
      const med = g.slice().sort((x, y) => x - y)[g.length >> 1];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of q) { x0 = Math.min(x0, p.re); x1 = Math.max(x1, p.re); y0 = Math.min(y0, p.im); y1 = Math.max(y1, p.im); }
      const size = Math.hypot(x1 - x0, y1 - y0), i = g.indexOf(Math.max(...g));
      if (!(g[i] > LINK_TEAR_K * med && g[i] > LINK_TEAR_SIZE * size) || (best && best.gap >= g[i])) continue;
      let a = lev[0][idx[i]], b = lev[0][idx[(i + 1) % idx.length]], wa = q[i], wb = q[(i + 1) % q.length];
      for (let h = 0; h < LINK_TEAR_HALVES; h++) {
        const c = CX.scale(CX.add(a, b), 0.5), wc = at(j, c);
        if (CX.abs(CX.sub(wc, wa)) >= CX.abs(CX.sub(wb, wc))) { b = c; wb = wc; } else { a = c; wa = wc; }
      }
      if (CX.abs(CX.sub(wb, wa)) >= LINK_TEAR_KEEP * g[i]) best = { j, gap: g[i], z: CX.scale(CX.add(wa, wb), 0.5) };
    }
    return best;
  }
  // a closed loop's signed area (its points' shoelace)
  const linkArea = (q) => q.reduce((a, p, i) => { const r = q[(i + 1) % q.length]; return a + p.re * r.im - r.re * p.im; }, 0) / 2;
  // whether z lies inside the closed loop q (even-odd)
  const linkInside = (q, z) => { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const a = q[i], b = q[j]; if ((a.im > z.im) !== (b.im > z.im) && z.re < ((b.re - a.re) * (z.im - a.im)) / (b.im - a.im) + a.re) c = !c; } return c; };
  // The connectors of disc s's tubes (tubeData), of the preimages zs of its centre and of the critical points crit (plane
  // points), by the given kind: {mode, pieces: [{loops: [lev]}] (each loop's levels, lev[j][i]), zs: [path] and crit:
  // [path] (path[j], a point's place at height j / LINK_N), tears: [{piece, s, z}], crosses: [{pieces, kind, s, s1, z}]
  // (linkCrosses)}, each piece also with its outer loop on the floor and at(j, z), any of its points at height j on its
  // branches. A preimage of the centre inside a piece rises with it, on its branch
  function stackLinks(s, mode, zs, crit) {
    const k = leftStage(), T = shapeStage(s), d = tubeData(s);
    const key = JSON.stringify([k, T, chainSig[nSteps()], s.c, s.r, mode, !!S.homAll, zs.map((z) => [z.re, z.im]), crit.map((z) => [z.re, z.im])]);
    if (linkCache.has(key)) return linkCache.get(key);
    const out = { mode, pieces: [], zs: zs.map(() => null), crit: [], tears: [], crosses: [] }, free = [];
    const pieces = d ? d.pieces : [];
    const outers = pieces.map((P) => { let o = 0; P.loops.forEach((L, i) => { if (Math.abs(linkArea(L.z)) > Math.abs(linkArea(P.loops[o].z))) o = i; }); return o; });
    const homes = zs.map((z) => pieces.findIndex((P, n) => linkInside(P.loops[outers[n]].z, z)));
    zs.forEach((z, i) => { if (homes[i] < 0) free.push(i); });
    pieces.forEach((P, n) => {
      // (the piece's loops one after another, then its preimages of the centre)
      const pts = [], spans = [];
      for (const L of P.loops) { spans.push([pts.length, pts.length + L.z.length]); pts.push(...L.z); }
      const mine = zs.map((_, i) => i).filter((i) => homes[i] === n), at0 = pts.length;
      pts.push(...mine.map((i) => zs[i]));
      const [o0, o1] = spans[outers[n]], outer = [];
      for (let i = o0; i < o1; i++) outer.push(i);
      const L = linkLevels(k, T, mode, pts, outer), lev = L.lev;
      out.pieces.push({ loops: spans.map(([a, b]) => lev.map((q) => q.slice(a, b))), floor: P.loops[outers[n]].z, at: L.at });
      mine.forEach((i, m) => { out.zs[i] = lev.map((q) => q[at0 + m]); });
      for (const [a, b] of spans) {
        const idx = [];
        for (let i = a; i < b; i++) idx.push(i);
        const tr = linkTear(L, idx);
        if (tr && !out.tears.some((x) => x.piece === n)) out.tears.push({ piece: n, s: tr.j / LINK_N, z: tr.z });
      }
    });
    out.crosses = linkCrosses(out.pieces.map((P, n) => P.loops[outers[n]]), mode === 'curved');
    // (the preimages outside every piece and the critical points rise on the steps' own cuts)
    const rest = free.map((i) => zs[i]).concat(crit);
    if (rest.length) {
      const lev = linkLevels(k, T, mode, rest, null).lev;
      free.forEach((i, m) => { out.zs[i] = lev.map((q) => q[m]); });
      out.crit = crit.map((_, m) => lev.map((q) => q[free.length + m]));
    }
    linkCache.set(key, out);
    while (linkCache.size > 16) linkCache.delete(linkCache.keys().next().value);
    return out;
  }
  // whether the closed loops p and q (plane points) meet: an edge of one crosses an edge of the other, or one lies inside
  // the other; where: a point of the meeting, or null
  function linkMeet(p, q) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      for (let j = 0; j < q.length; j++) {
        const c = q[j], e = q[(j + 1) % q.length];
        const d = (b.re - a.re) * (e.im - c.im) - (b.im - a.im) * (e.re - c.re);
        if (d === 0) continue;
        const u = ((c.re - a.re) * (e.im - c.im) - (c.im - a.im) * (e.re - c.re)) / d, v = ((c.re - a.re) * (b.im - a.im) - (c.im - a.im) * (b.re - a.re)) / d;
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) return C(a.re + u * (b.re - a.re), a.im + u * (b.im - a.im));
      }
    }
    return linkInside(q, p[0]) ? p[0] : linkInside(p, q[0]) ? q[0] : null;
  }
  // Where two pieces' tubes meet on the way up, though they are separate pieces: [{pieces: [a, b], kind, s, s1, z}] from
  // the pieces' outer loops (outer[n], levels lev[j][i]), z a point of the meeting at s. Every piece ends on the disc's
  // rim, so near the glass the slices crowd onto it and meet, as the straight strands bring them there; a meeting is told
  // only where it is not that:
  // - 'cross': their slices meet at s and part again at s1, below the glass;
  // - 'sooner' (curved): they meet from s up to the glass (s1 = 1), and the straight strands bring the same two pieces
  //   together LINK_SOONER or more higher up (straight, the levels between each loop's floor and glass ends).
  const LINK_SOONER = 0.1;
  function linkCrosses(outer, curved) {
    const out = [], first = (p, q) => { for (let J = 1; J < LINK_N; J++) if (linkMeet(p(J), q(J))) return J; return LINK_N; };
    const flat = (lev) => (J) => lev[0].map((z, i) => tubeMix(z, lev[LINK_N][i], J / LINK_N));
    for (let a = 0; a < outer.length; a++) for (let b = a + 1; b < outer.length; b++) {
      const meet = [null];
      for (let J = 1; J < LINK_N; J++) meet.push(linkMeet(outer[a][J], outer[b][J]));
      const J0 = meet.findIndex(Boolean), J1 = J0 < 0 ? -1 : meet.findIndex((m, J) => J > J0 && !m);
      if (J0 > 0 && J1 > 0) out.push({ pieces: [a, b], kind: 'cross', s: J0 / LINK_N, s1: J1 / LINK_N, z: meet[J0] });
      else if (J0 > 0 && curved && first(flat(outer[a]), flat(outer[b])) - J0 >= LINK_SOONER * LINK_N) out.push({ pieces: [a, b], kind: 'sooner', s: J0 / LINK_N, s1: 1, z: meet[J0] });
    }
    return out.sort((x, y) => x.s - y.s);
  }
  // The connector shown from the floor's point z up to v on the glass (plane points), in the flat plane's css px with its
  // heights, [[x, y, t], ...], for a strand that rises along it (the picks'): curved, the glide's path from the floor to
  // the selected disc's plane, on the branches of the piece z lies in, where it ends at v; else straight, its two ends
  function stackLinkFlat(pane, z, v) {
    const s = findShape(selected);
    if (linkMode() === 'curved' && s) {
      // (a point of a piece rises on that piece's branches, as its tube does: the connectors the frame drew, linkShown)
      const P = linkShown && linkShown.mode === 'curved' ? linkShown.pieces.find((q) => linkInside(q.floor, z)) : null;
      const at = P ? P.at : linkLevels(leftStage(), shapeStage(s), 'curved', [z], null).at, pts = [];
      for (let J = 0; J <= LINK_N; J++) pts.push(at(J, z));
      const w = pts[LINK_N];
      if (CX.isFin(w) && CX.abs(CX.sub(w, v)) <= 1e-6 * (1 + CX.abs(v))) return pts.map((q, J) => [...pane.w2s(q), J / LINK_N]);
    }
    return [[...pane.w2s(z), 0], [...pane.w2s(v), 1]];
  }
  // the tear's words: "torn here by the glide's cut, not a split"
  const linkTearText = () => $t('torn here by the glide’s cut, not a split');
  // the Stack key's switch between the two kinds, saved with the steps view's place, after its visible name (the group's
  // own name for assistive technology)
  function stackLinksSwitch() {
    const el = seg(null, linkMode(), [['curved', $t('Glide paths')], ['straight', $t('Straight')]], (v) => { SV.links = v; save(); requestRender('L'); }, $t('Connectors'), { cls: 'ld-links' });
    return h('span', { class: 'ld-links-row', id: 'ldLinks' }, h('span', { class: 'ld-links-l', 'aria-hidden': 'true' }, $t('Connectors')), el);
  }
  // TEST-HOOK (dropped from the published page by build.py): the selected disc's connectors by the kind shown, in plane
  // coordinates ([re, im]); o.links sets the kind, o.branch (false) has every piece rise on the steps' own cuts; o.glide:
  // [x, re, im], the steps view's glide map at the place x applied to that point (glide: [re, im]); o.flat: [re, im, vre,
  // vim], the picks' strand from that floor point up to that glass point (stackLinkFlat's, flat: [[x, y, t], ...])
  window.__cmwStackLinks = (o) => {
    if (o && o.glide) { const [x, re, im] = o.glide, w = svBetween(x, null).F(C(re, im)); return { glide: [w.re, w.im] }; }
    if (o && o.flat) { const [re, im, vr, vi] = o.flat; return { flat: stackLinkFlat(paneL, C(re, im), C(vr, vi)) }; }
    if (o && o.links) { SV.links = o.links; requestRender('L'); }
    if (o && 'branch' in o) { linkBranch = !!o.branch; linkCache.clear(); requestRender('L'); }
    const sh = findShape(selected);
    if (!sh || !lookMarksOn(sh)) return { mode: linkMode(), data: null };
    const mk = lookMarks(paneL, sh), ln = stackLinks(sh, linkMode(), mk.zsZ, mk.critZ), xy = (p) => [p.re, p.im];
    return {
      mode: linkMode(), n: LINK_N, saved: S.sv ? S.sv.links : null,
      data: { pieces: ln.pieces.map((P) => ({ loops: P.loops.map((lev) => lev.map((q) => q.map(xy))) })), zs: ln.zs.map((p) => p && p.map(xy)), crit: ln.crit.map((p) => p.map(xy)), tears: ln.tears.map((r) => ({ piece: r.piece, s: r.s, z: xy(r.z) })), crosses: ln.crosses.map((r) => ({ pieces: r.pieces, kind: r.kind, s: r.s, s1: r.s1, z: xy(r.z) })) },
    };
  };
  // TEST-HOOK
