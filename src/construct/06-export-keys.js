  // ---------------------------------------------------------------- export phrases (SPEC 12)
  // a caption phrase for capT: {src, params}; values are text or {m: TeX} (the app sets the maths: z₂ = −1 − 1.5i)
  const SUBR = { '₀': 0, '₁': 1, '₂': 2, '₃': 3, '₄': 4, '₅': 5, '₆': 6, '₇': 7, '₈': 8, '₉': 9 };
  // a point's name as TeX (z₂ -> z_{2}, ζ₁ -> \zeta_{1}, z₀″ -> z_{0}''), or null for a name in words
  function nameTex(nm) {
    if (/^[A-Za-z]$/.test(nm)) return nm;            // (a user's one-letter label)
    const m = /^([a-zζ])([₀-₉]+)([′″‴]*)$/u.exec(nm);
    if (!m) return nm === '∞' ? '\\infty' : null;
    const base = m[1] === 'ζ' ? '\\zeta' : m[1];
    return `${base}_{${[...m[2]].map((c) => SUBR[c]).join('')}}${"'".repeat([...m[3]].reduce((n, c) => n + ('′″‴'.indexOf(c) + 1), 0))}`;
  }
  // [review picture-7] a caption names each point once with its value (a point shape's own phrase does: "the point
  // $z_0=-1.5$"), so a definition names point shapes by their label only (the figure labels them), a zero by name and
  // value, a handle by its value; curves by their maths (the app's own phrase of the curve, in the genitive), never by
  // a row name; a line bound at both ends by its points
  function phrase(s, texOf) {
    if (!s || !(s.def || s.at)) return null;
    const d = s.def, plane = isT(s) || s._capT ? 1 : 0;
    const val = (r) => { try { const res = Constr.resolve(S(), r, plane, env()); return res && res.z ? res.z : null; } catch (e) { return null; } };
    const R = (r) => {
      if (!r) return '?';
      if (r.inf) return { m: '\\infty' };
      const z = val(r);
      if (r.s && !r.h && r.part == null) {
        const p = find(r.s), t = p ? nameTex(pointName(p)) : null;
        if (t && p.visible !== false && !p.helper) return { m: t };
        return z ? { m: texOf(z) } : refName(r);
      }
      const t = nameTex(refName(r));
      if (t) return { m: z ? `${t}=${texOf(z)}` : t };
      return z ? { m: texOf(z) } : refName(r);
    };
    const self = () => { const t = nameTex(pointName(s)); return t ? { m: isXY(s.p) ? `${t}=${texOf(s.p)}` : t } : pointName(s); };
    const CM = (ref) => {
      const c = find(ref.s);
      if (!c) return '?';
      const pcs = piecesOf(c), pc = pcs[ref.part];
      if (pcs.length > 1 && pc && pc.kind === 'line' && Number.isFinite(pc.lo) && Number.isFinite(pc.hi)) {
        const a = Constr.glide(Object.assign({}, pc, { poly: null, arc3: null }), pc.lo), b = Constr.glide(Object.assign({}, pc, { poly: null, arc3: null }), pc.hi);
        if (A.capPhrase && isXY(a) && isXY(b)) return A.capPhrase({ id: '', kind: 'segment', a, b }, 'gen');
      }
      return A.capPhrase ? A.capPhrase(c, 'gen') : curveName(ref);
    };
    if (!d) {
      if (!s.at || !s.at.a || !s.at.b) return null;
      const a = R(s.at.a), b = R(s.at.b);
      switch (s.kind) {
        case 'line': return { src: 'the line through {a} and {b}', params: { a, b } };
        case 'segment': return { src: 'the segment from {a} to {b}', params: { a, b } };
        case 'ray': return { src: 'the ray from {a} through {b}', params: { a, b } };
        case 'halfplane': return s.complement ? { src: 'the half-plane to the right of the line from {a} to {b}', params: { a, b } } : { src: 'the half-plane to the left of the line from {a} to {b}', params: { a, b } };
      }
      return null;
    }
    const P = (i) => R(d.args[i]);
    if (d.op === 'circle3') {
      if (d.fill !== 'in') return s.kind === 'line' ? { src: 'the line through {a}, {b} and {c}', params: { a: P(0), b: P(1), c: P(2) } } : { src: 'the circle through {a}, {b} and {c}', params: { a: P(0), b: P(1), c: P(2) } };
      if (s.kind === 'halfplane') { const [i, j] = hpOrder(s); return { src: 'the half-plane to the left of the line from {a} to {b}', params: { a: P(i), b: P(j) } }; }
      if (s.complement) return { src: 'the outside of the circle through {a}, {b} and {c}', params: { a: P(0), b: P(1), c: P(2) } };
      return { src: 'the disc bounded by the circle through {a}, {b} and {c}', params: { a: P(0), b: P(1), c: P(2) } };
    }
    if (d.op === 'meet') return { src: 'the intersection {x} of {c1} and {c2}', params: { x: self(), c1: CM(d.args[0]), c2: CM(d.args[1]) } };
    if (d.op === 'midpoint') return { src: 'the midpoint {x} of {a} and {b}', params: { x: self(), a: P(0), b: P(1) } };
    if (d.op === 'glider') return { src: 'the point {x} on {c}', params: { x: self(), c: CM(d.args[0]) } };
    if (d.op === 'bisector') return { src: 'the perpendicular bisector of {a} and {b}', params: { a: P(0), b: P(1) } };
    // {c}: C's carrier, a circle or a line in the genitive (a 3-point, perpendicular or touching circle drawn as a curve by
    // its own phrase; any other piece by its circle or its line: a polygon side is the line it lies on)
    const carrier = (ref) => {
      const C = find(ref.s), pc = C && piecesOf(C)[ref.part];
      let c = curveName(ref);
      if (C && pc && A.capPhrase) {
        if (isCirc3(C) && C.def.fill !== 'in') c = A.capPhrase(C, 'gen');
        else if (pc.kind === 'circle' && isXY(pc.c)) c = A.capPhrase({ id: '', kind: 'circle', c: pc.c.slice(), r: pc.r }, 'gen');
        else if (pc.kind === 'line' && isXY(pc.a) && isXY(pc.b)) c = A.capPhrase({ id: '', kind: 'line', a: pc.a.slice(), b: pc.b.slice() }, 'gen');
      }
      return c;
    };
    // the touching circle ({a}: T, {b}: P), the tangent at T, the tangent from P
    if (d.op === 'tangent') return { src: 'the tangent to {c} through {p}', params: { c: carrier(d.args[0]), p: P(1) } };
    if (d.op === 'touch') {
      const p = { a: P(1), b: P(2), c: carrier(d.args[0]) };
      if (d.args[2] && d.args[2].inf) return { src: 'the tangent to {c} at {a}', params: { c: p.c, a: p.a } };
      if (d.fill !== 'in') return s.kind === 'line' ? { src: 'the line through {b} touching {c} at {a}', params: p } : { src: 'the circle through {b} touching {c} at {a}', params: p };
      if (s.kind === 'halfplane') { const [i, j] = hpOrder(s); return { src: 'the half-plane to the left of the line from {a} to {b}', params: { a: P(i), b: P(j) } }; }
      if (s.complement) return { src: 'the outside of the circle through {b} touching {c} at {a}', params: p };
      return { src: 'the disc bounded by the circle through {b} touching {c} at {a}', params: p };
    }
    if (d.op === 'perp') {
      const p = { a: P(1), b: P(2), c: carrier(d.args[0]) };
      // [v16.4 segments SPEC 6.2] the hyperbolic line in the domain {r} (C's open side, as maths); through P and Q when both
      // lie on the drawn arc, else on K ({k}: K's whole caption, in the genitive)
      if (d.seg && d.fill !== 'in' && s._seg) {
        const info = segInfo(s), C = find(d.args[0].s), cpc = C && piecesOf(C)[d.args[0].part], kpc = piecesOf(s)[0];
        let r = null;
        try {
          // (review math-3: the outside of a circle is a disc of the sphere, infinity included)
          if (info && cpc && cpc.kind === 'circle' && isXY(cpc.c)) { r = Region.KINDS.disc.tex({ kind: 'disc', c: cpc.c, r: cpc.r }); if (info.word === 'out') r = `\\{${r.replace(/</g, '>')}\\}\\cup\\{\\infty\\}`; }
          else if (info && cpc && cpc.kind === 'line' && isXY(cpc.a) && isXY(cpc.b)) {
            const L = [cpc.a[0] - (cpc.b[1] - cpc.a[1]), cpc.a[1] + (cpc.b[0] - cpc.a[0])], left = info.seg * Constr.fOf(info.Gc, L) < 0;
            r = Region.KINDS.halfplane.tex({ kind: 'halfplane', a: left ? cpc.a : cpc.b, b: left ? cpc.b : cpc.a });
          }
        } catch (e) { r = null; }
        if (r) {
          // (review math-7: through P and Q only when both are points of the domain; review user-2, user-3: close: the phrase
          // ends with a comma when more words follow it)
          if (kpc && segThru(s, info)) return { src: 'the hyperbolic line through {a} and {b} in the domain {r}', params: { a: p.a, b: p.b, r: { m: r } }, close: true };
          const g = Constr.geomOf(s._g), copy = Object.assign({ id: '', _capT: isT(s), def: Object.assign({}, d, { seg: undefined }) }, g.line ? { kind: 'line', a: g.p, b: [g.p[0] + g.d[0], g.p[1] + g.d[1]] } : { kind: 'circle', c: g.c, r: g.r });
          delete copy.def.seg;
          const k = A.capPhrase ? A.capPhrase(copy, 'gen') : curveName({ s: s.id, part: 0 });
          return { src: 'the hyperbolic line in the domain {r} on {k}', params: { r: { m: r }, k }, close: true };
        }
      }
      // ([issue #70] Between z0 and z1: the hyperbolic segment, as the caption says the figure's curve)
      if (d.between === 1 && d.fill !== 'in' && s._seg) return { src: 'the hyperbolic segment from {a} to {b}', params: { a: p.a, b: p.b } };
      if (d.fill !== 'in') return s.kind === 'line' ? { src: 'the line through {a} and {b} perpendicular to {c}', params: p } : { src: 'the circle through {a} and {b} perpendicular to {c}', params: p };
      if (s.kind === 'halfplane') { const [i, j] = hpOrder(s); return { src: 'the half-plane to the left of the line from {a} to {b}', params: { a: P(i), b: P(j) } }; }
      if (s.complement) return { src: 'the outside of the circle through {a} and {b} perpendicular to {c}', params: p };
      return { src: 'the disc bounded by the circle through {a} and {b} perpendicular to {c}', params: p };
    }
    return null;
  }
  // (the caption templates, for the Russian table's call-site scan: capT translates them at run time)
  const CAPTIONS = () => [$t('the line through {a}, {b} and {c}'), $t('the circle through {a}, {b} and {c}'), $t('the half-plane to the left of the line from {a} to {b}'),
    $t('the half-plane to the right of the line from {a} to {b}'), $t('the line through {a} and {b}'), $t('the segment from {a} to {b}'), $t('the ray from {a} through {b}'),
    $t('the outside of the circle through {a}, {b} and {c}'), $t('the disc bounded by the circle through {a}, {b} and {c}'), $t('the intersection {x} of {c1} and {c2}'),
    $t('the midpoint {x} of {a} and {b}'), $t('the point {x} on {c}'), $t('the perpendicular bisector of {a} and {b}'),
    $t('the circle through {a} and {b} perpendicular to {c}'), $t('the line through {a} and {b} perpendicular to {c}'), $t('the hyperbolic segment from {a} to {b}'),
    $t('the disc bounded by the circle through {a} and {b} perpendicular to {c}'), $t('the outside of the circle through {a} and {b} perpendicular to {c}'),
    $t('the circle through {b} touching {c} at {a}'), $t('the line through {b} touching {c} at {a}'), $t('the disc bounded by the circle through {b} touching {c} at {a}'),
    $t('the outside of the circle through {b} touching {c} at {a}'), $t('the tangent to {c} at {a}'), $t('the tangent to {c} through {p}'),
    $t('the hyperbolic line through {a} and {b} in the domain {r}'), $t('the hyperbolic line in the domain {r} on {k}')];

  // ---------------------------------------------------------------- the tool rows, the grid, the CSS, the keys
  const tsvg = (inner) => `<svg class="tic" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="1.9" fill="currentColor" stroke="none"/>`;
  const ICON = {
    circle3: tsvg('<circle cx="10" cy="10.5" r="6.5"/>' + dot(4.4, 7.3) + dot(15.6, 7.3) + dot(10, 17)),
    meet: tsvg('<path d="M3 15.5L17 4.5M3 6.5c4 0 9 3 14 9"/><circle cx="10.1" cy="9.4" r="2.6" fill="none" stroke-width="1.3"/>'),
    midpoint: tsvg('<path d="M3.5 14.5l13-9"/>' + dot(3.5, 14.5) + dot(16.5, 5.5) + '<circle cx="10" cy="10" r="2.3" fill="none" stroke-width="1.3"/>'),
    bisector: tsvg('<path d="M3.5 13.5l13-7" stroke-opacity=".55"/>' + dot(3.5, 13.5) + dot(16.5, 6.5) + '<path d="M6.6 2.5l6.8 15"/><path d="M10.9 9.5l.7 1.5-1.5.7"/>'),
    // a line, a half-circle on it (centre (10, 14.5), r 5.5) with two dots on it, a right-angle mark at its right foot
    perp: tsvg('<path d="M2.5 14.5h15"/><path d="M4.5 14.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 12.4h2.1v2.1" stroke-width="1.1"/>' + dot(6.1, 10.62) + dot(12.8, 9.77)),
    // a circle and a smaller one touching it from outside, a dot at the touching point (exactly on both)
    touch: tsvg('<circle cx="8" cy="10" r="5.5"/><circle cx="16" cy="10" r="2.5"/>' + dot(13.5, 10)),
    // [v16.5 UX55] a circle (the boundary, faint) and the arc of a hyperbolic line inside it, with its two points
    hyper: tsvg('<circle cx="10" cy="10" r="7.5" stroke-opacity=".5"/><path d="M4.7 15.3A7.5 7.5 0 0 1 15.3 15.3" transform="translate(0 -4.6)"/>' + dot(7.6, 9.2) + dot(12.4, 9.2)),
  };
  function toolRows() {
    return [
      ['circle3', $t('Circle through 3 points'), 'E', $t('Pick three points: points on the page, crossings, or empty spots. The circle and its disc follow them.'), 'construct', $t('3-pt circle')],
      ['meet', $t('Intersect'), 'I', $t('Click a crossing of two curves, or one curve and then another.'), 'construct', $t('Intersect')],
      ['midpoint', $t('Midpoint'), 'U', $t('Pick two points, or a segment.'), 'construct', $t('Midpoint')],
      ['bisector', $t('Perpendicular bisector'), 'Q', $t('Pick two points, or a segment: the line of the points equally far from both.'), 'construct', $t('Bisector')],
      ['perp', $t('Perpendicular circle'), 'W', $t('Pick a line or a circle, then two points: the circle through them crosses it at right angles. The curve stays picked for the next one.'), 'construct', $t('⊥ circle')],
      ['touch', $t('Touching circle'), 'J', $t('Pick a line or a circle, then the point where the new circle touches it and a point it passes through, in either order. Click the dashed tangent or press Tangent line for the tangent line, or a ring for a tangent from the point. The curve stays picked for the next one.'), 'construct', $t('Touching')],
      ['hyper', $t('Hyperbolic line'), 'Y', $t('Pick the boundary (a line or a circle), then two points on one side of it: the hyperbolic line through them, the arc of the circle at right angles to the boundary. The boundary stays picked for the next one.'), 'construct', $t('Hyperbolic')],
    ];
  }
  const CSS = `
.cm-head { display: flex; align-items: center; margin: 10px 0 4px; font: var(--t-label); color: var(--muted); letter-spacing: .02em; }
.empty-chip > .cm-chip { display: inline-flex; align-items: center; gap: 8px; pointer-events: auto; overflow: visible; min-width: 0; flex: 1 1 auto; }
.cm-chip > .cm-t { overflow: hidden; min-width: 0; flex: 0 1 auto; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.25; }
.draft-chip.cm-on { height: auto; min-height: 32px; padding-top: 3px; padding-bottom: 3px; width: max-content; }
.cm-seg.cm-icons .cm-sb { display: inline-flex; align-items: center; padding: 2px 6px; }
.cm-chip > .cm-seg, .cm-chip > .cm-x { flex: 0 0 auto; }
.draft-chip.cm-on { pointer-events: auto; padding: 0 4px 0 10px; }
.draft-chip.cm-on.cm-low { top: auto !important; bottom: 32px; left: 8px; translate: none; max-width: calc(100% - 64px); }
/* ([v16.5 check app-5] at the foot the chip clears the plane's buttons, 48 px narrower than at the top: its sentence may
   take a third line there rather than be cut; the one-line rule in syncChip measures it in this place) */
.draft-chip.cm-on.cm-low .cm-chip > .cm-t { -webkit-line-clamp: 3; }
.cm-seg { display: inline-flex; border: 1px solid var(--line); border-radius: var(--r-2, 6px); overflow: hidden; }
.cm-sb { border: 0; background: transparent; color: var(--ink-2); font: var(--t-label); padding: 2px 8px; cursor: pointer; }
.cm-sb.on { background: var(--inverse); color: var(--inverse-ink); }
/* [v16.4 review user-5] touch: each segment button takes taps 40px tall, with the same look */
.cm-seg.cm-touch { overflow: visible; }
.cm-seg.cm-touch .cm-sb { position: relative; }
.cm-seg.cm-touch .cm-sb:first-child { border-radius: 5px 0 0 5px; }
.cm-seg.cm-touch .cm-sb:last-child { border-radius: 0 5px 5px 0; }
.cm-seg.cm-touch .cm-sb::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 40px; transform: translateY(-50%); }
.cm-x { border: 0; background: transparent; color: var(--ink-2); font-size: 19px; line-height: 1; width: 28px; height: 28px; cursor: pointer; }
/* [v16.5 UX48, UX51, UX52, UX100] the chip wraps (text, then its controls; a refusal or the how-to on a line of its own); the
   kept curve's token; the ? */
.empty-chip > .cm-chip { flex-wrap: wrap; row-gap: 4px; }
/* (the chip's words let the plane take the pointer, as the polygon's chip does: only its buttons take a press, so a
   pick under its second line still lands) */
.draft-chip.cm-on, .empty-chip > .cm-chip { pointer-events: none; }
.cm-chip button { pointer-events: auto; }
.cm-chip > .cm-tok, .cm-chip > .cm-q { flex: 0 0 auto; }
/* (a mouse chip with only its words and the ?: the ? stays beside the words, not alone on a line below them) */
.cm-chip:not(.cm-tch):not(:has(> .cm-seg, > .cm-tok)) > .cm-t { flex: 1 1 0; }
.cm-tok { display: inline-flex; align-items: center; gap: 2px; height: 22px; border: 1px solid var(--line); border-radius: 999px; padding: 0 1px 0 8px; font: var(--t-label); color: var(--ink-2); white-space: nowrap; background: var(--surface); }
.cm-tokx, .cm-q { position: relative; border: 0; background: transparent; color: var(--ink-2); cursor: pointer; font: 600 13px/1 var(--f-ui); width: 20px; height: 20px; border-radius: 999px; padding: 0; }
.cm-q { border: 1px solid var(--line); font-size: 11px; }
.cm-q.on { background: var(--inverse); color: var(--inverse-ink); border-color: var(--inverse); }
.cm-tokx:hover, .cm-q:not(.on):hover { color: var(--accent); border-color: var(--accent); }
.cm-chip > .cm-warn, .cm-chip > .cm-how { flex: 1 0 100%; font: var(--t-label); white-space: normal; text-align: left; padding: 0 0 2px; }
.cm-chip > .cm-warn { color: var(--warn); font-weight: 600; }
.cm-chip > .cm-how { color: var(--ink-2); max-width: 52ch; }
/* a finger: words in the segments, every control taps 44 px */
.cm-chip.cm-tch .cm-sb { min-width: 44px; }
.cm-chip.cm-tch :is(.cm-x, .cm-tokx, .cm-q)::after { content: ''; position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); }
.cm-chip.cm-tch .cm-x { position: relative; width: 32px; height: 32px; }
/* (a finger: the × beside the words on the first line, the choices on the second) */
.cm-chip.cm-tch > .cm-t { flex: 1 1 calc(100% - 48px); }
.cm-chip.cm-tch > .cm-x { order: 1; margin-left: auto; }
.cm-chip.cm-tch > :is(.cm-tok, .cm-q, .cm-seg) { order: 2; }
.cm-chip.cm-tch > :is(.cm-warn, .cm-how) { order: 3; }
/* (between the lines the choices' 40 px taps win over the ×'s 44 px tap: a finger a little high on Outside never
   cancels the construction) */
.empty-chip > .cm-chip.cm-tch { row-gap: 8px; }
.cm-chip.cm-tch > .cm-seg { position: relative; z-index: 1; }
.cm-t > .cm-nw { white-space: nowrap; }
.shape .d .cm-def { color: var(--ink-2); font: var(--t-label); }
/* [review user-11] a definition (or a reason) wraps to two lines in its row instead of being cut */
.shape-row:has(> .shape-name .cm-def, > .shape-name .d[data-cm] > .err-msg) { height: auto; min-height: 32px; padding-top: 4px; padding-bottom: 4px; }
.shape-name:has(.cm-def, .d[data-cm] > .err-msg) { align-items: baseline; flex-wrap: wrap; white-space: normal; -webkit-mask-image: none; mask-image: none; }
/* [v16 verify-4] too narrow beside the name: the definition takes the row's full width under it */
.shape-name .d:has(> .cm-def, > .err-msg)[data-cm] { flex: 1 1 8em; min-width: 0; }
.shape .d[data-cm] > .cm-def, .shape .d[data-cm] > .err-msg { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; line-height: 15px; }
.shape.cm-helper > .shape-row { padding-left: 18px; }
.shape .cm-link { display: inline-flex; vertical-align: middle; margin-left: 4px; color: var(--muted); }
.shape.cm-link-on > .shape-row { background: var(--accent-soft); }
.rail-sep { width: 18px; height: 1px; background: var(--line); margin: 4px 0; flex: 0 0 auto; }
#railTools.cm-tight1 > .rail-tool:is([data-tool="cgrid"], [data-tool="pgrid"]), #railTools.cm-tight2 > .rail-tool:is([data-tool="curve"], [data-tool="lasso"]) { display: none; }
@media (min-width: 768px) { :root:not(.ph) .cm-tight3 > .rail-label { display: none; } }
/* [v16.5 UX55] last, the Hyperbolic line tile leaves the rail (it stays in the drawer's Construct grid and in ⌘K) */
#railTools.cm-tight4 > .rail-tool[data-tool="hyper"] { display: none; }
.cm-insp { display: flex; flex-direction: column; gap: 4px; }
.cm-ihead { margin-bottom: 4px; }
.cm-ilabel { font: var(--t-label); color: var(--muted); margin-top: 8px; }
.cm-idef { font: var(--t-body); color: var(--ink); }
.cm-iwarn { color: var(--warn); font: var(--t-label); }
.cm-ichips { display: flex; flex-wrap: wrap; gap: 4px; }
.cm-chipbtn { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 2px 8px; font: var(--t-label); cursor: pointer; }
.cm-chipbtn:not(.cm-plain):hover { border-color: var(--accent); color: var(--accent); }
.cm-chipbtn.cm-plain { cursor: default; }
.cm-none { color: var(--muted); font: var(--t-label); }
.cm-ifields, .cm-iacts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 4px; }
.cm-ibreak { flex-basis: 100%; height: 0; }
.cm-icheck, .cm-ifield { display: inline-flex; align-items: center; gap: 6px; font: var(--t-label); color: var(--ink-2); }
.cm-it { width: 90px; }
.field.cm-boundf { display: flex; align-items: center; gap: 6px; }
.field.cm-boundf > .cm-bound { flex: 1 1 auto; min-width: 0; color: var(--ink-2); background: var(--surface-2, transparent); cursor: default; }
.field.cm-boundf > .cm-free { flex: 0 0 auto; }
.cm-imean { color: var(--muted); font: var(--t-label); }
.cm-ierr { color: var(--warn); font: var(--t-label); width: 100%; }
.ph-tiles > .cm-ph { grid-column: 1 / -1; margin: 8px 0 2px; }
@media (max-width: 767px) { #secDraw > #cmHead, #secDraw > #constructTools { display: none; } }
:root.ph #secDraw > #cmHead, :root.ph #secDraw > #constructTools { display: none !important; }   /* (phone.css shows #secDraw > .tools with !important) */
:root.ph .draft-chip.cm-on { left: 8px; translate: none; max-width: calc(100% - 68px); }
`;
  function buildGrid() {
    const tools = document.getElementById('tools');
    if (!tools || document.getElementById('constructTools')) return document.getElementById('constructTools');
    css();
    const head = document.createElement('div');
    Object.assign(head, { className: 'cm-head', id: 'cmHead', textContent: $t('Construct') });
    head.setAttribute('role', 'heading'); head.setAttribute('aria-level', '3');
    const grid = document.createElement('div');
    Object.assign(grid, { className: 'tools', id: 'constructTools' });
    grid.setAttribute('role', 'toolbar'); grid.setAttribute('aria-label', $t('Construction tools'));
    tools.after(head, grid);
    return grid;
  }
  function css() { if (!document.getElementById('cmStyle')) { const st = document.createElement('style'); st.id = 'cmStyle'; st.textContent = CSS; document.head.append(st); } }
  function keydown(e) {
    if (e.key === 'Escape' && A && cancelDrag()) { e.preventDefault(); e.stopPropagation(); return; }   // ([v16.5 rail SPEC 2.6])
    if (e.key === 'Escape' && A) pickOk();   // ([v16.5 fix rail-7] Esc takes the refusal away, whatever else it closes)
    if (!draftC || !A) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    // (a draft without picks lets Esc through: it closes what the app's Esc closes)
    const has = !!(draftC.picks.length || draftC.curve1);
    if (e.key === 'Escape' && has) { cancel(); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'Backspace' && has) { back(); e.preventDefault(); e.stopPropagation(); }
    // (Enter after the touching circle's T: nothing else is pending there; a focused button keeps its own Enter)
    else if (e.key === 'Enter' && !(t && t.tagName === 'BUTTON') && tangentNow()) { e.preventDefault(); e.stopPropagation(); }
  }
  // the tablet rail (SPEC 5.4): when it would overflow the panel, Grid and Polar grid leave it first (they stay in the
  // drawer), then Freehand and Lasso; (the fifth Construct tool) then the rail's vertical "Region tools" label,
  // which v16.2 already cut by 10 px at 1024 × 768 (the count above it and the open key stay)
  function fitRail() {
    const rail = document.getElementById('railTools');
    if (!rail || !rail.offsetParent) return;
    const box = rail.closest('.panel') || rail.parentElement;
    const over = () => box.scrollHeight > box.clientHeight + 1;
    rail.classList.remove('cm-tight1', 'cm-tight2', 'cm-tight4');
    if (rail.parentElement) rail.parentElement.classList.remove('cm-tight3');
    if (over()) rail.classList.add('cm-tight1');
    if (over()) rail.classList.add('cm-tight2');
    if (over() && rail.parentElement) rail.parentElement.classList.add('cm-tight3');
    if (over()) rail.classList.add('cm-tight4');
  }
  function ui(adapter) {
    A = adapter;
    css();
    try { const rail = document.getElementById('railTools'); if (rail && window.ResizeObserver) { const ro = new ResizeObserver(() => fitRail()); ro.observe(rail.closest('.panel') || rail.parentElement); } } catch (e) { /* */ }
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('pointerdown', (e) => { lastPressTouch = e.pointerType === 'touch' || e.pointerType === 'pen'; lastPressAt = performance.now(); }, true);
    PlaneMenu.register('constructions', menuItems);
    if (freedLater) { freedLater = false; freedToast(); }
  }
  // the command palette: the six tools; Make free and Use complement for a selected construction (SPEC 5.6)
  function paletteActs() {
    const out = CTOOLS.map((id) => [toolName(id), () => A.setTool(id), '']);
    const s = A.selected() && find(A.selected());
    if (s && (s.def || s.at)) out.push([$t('Make free'), () => api.cm.makeFree(s.id), '']);
    if (isCirc3(s) && s.def.fill === 'in') out.push([$t('Use complement'), () => api.cm.setDef(s.id, { flip: !s.def.flip }), '']);
    return out;
  }
  // a tool change: the draft goes, the chip follows
  function toolChanged() {
    if (draftC && draftC.tool !== A.tool()) draftC = null;
    gestSnap = null; ring = null;
    // [v16.5 UX52] what the last tool said goes with it
    pickWarnMsg = null; clearTimeout(pickWarnT); howOpen = false;
    if (lastToast && lastToast.isConnected) lastToast.remove();
    lastToast = null;
  }
  // TEMP-DEBUG-HOOK (removed before publishing)
  function debug() {
    return { chipBot: Object.assign({}, chipBot), hover: draftC && draftC.hover, chipRect: lastChip, rail: rail ? { side: rail.side, stretch: rail.stretch ? { a: rail.stretch.a, b: rail.stretch.b, k: rail.stretch.k } : null } : null, freeChip: freeChip ? freeChip.text : null, ring: ring ? { side: ring.side, z: ring.z, ref: ring.ref, cls: ring.cls, chip: ring.chip, warn: ring.warn } : null, draft: draftC ? { tool: draftC.tool, side: draftC.side, picks: draftC.picks.map((p) => ({ cls: p.cls, z: p.z, ref: p.ref, role: p.role })), curve1: draftC.curve1 && draftC.curve1.ref, hoverT: draftC.hoverT ? { cls: draftC.hoverT.cls, k: draftC.hoverT.k, z: draftC.hoverT.z } : null, rings: draftC.tool === 'touch' && draftC.picks[0] && draftC.picks[0].role === 'P' ? ringsOf(draftC.picks[0].z).map((r) => ({ k: r.k, tp: r.tp })) : null, hint: draftC.tool === 'touch' && draftC.picks[0] && draftC.picks[0].role === 'T' ? hintForm(draftC.picks[0].z) : null } : null, fill: fillMode, seg: segMode, events: events.map((e) => e.type) };
  }
  // TEMP-DEBUG-HOOK
  // (every entry point is inert until the app's adapter arrives: init() builds the tools before Construct.ui runs)
  const g = (f, d) => (...a) => (A && api ? f(...a) : d);
  return {
    init(a) { api = a; },
    on, ui, toolRows, toolChip: () => toolChip(), ICON, buildGrid, CTOOLS, isTool: isCTool,
    vertexPick: g(vertexPick, null), bindVertices: g(bindVertices), globeClick: g(globeClick, false), boundUnder: g(boundUnder, null), snapAt: g(snapAt, null), drawStart: g(drawStart, null), drawMove: g(drawMove, null), drawEnd: g(drawEnd), pointDown: g(pointDown, false),
    handleMove: g(handleMove, null), handleUp: g(handleUp), moveUp: g(moveUp), moveDrag: g(moveDrag, false), cancelDrag: g(cancelDrag, false), globeSlide: g(globeSlide, null), globePoint: g(globePoint, false), touchNow: () => touchNow(), altNow: () => !!A && altNow(), samePick, click: g(click, false), toolDown: g(toolDown, false), cancel: g(cancel, false), back: g(back, false), drafting: g(drafting, false), undoPick: g(undoPick, null), undoPickable: g(undoPickable, false), hint: g(() => chipText(true, true), ''),
    hover: g(hover), finalPick: g(finalPick, false), pointer, leave: g(leave), drawOverlay: g(drawOverlay), syncChip: g(syncChip), chipSide: g(chipSide, null), toolChanged: g(toolChanged), deleteMessage: g(deleteMessage, null), zpOffNote: g(zpOffNote, ''),
    row: g(row, false), rowMenu: g(rowMenu), markLinks: g(markLinks), orderRows: g(orderRows), linked: g(linked, new Set()),
    fixedName: (s) => (A ? fixedName(s) : null), defText: g(defText, null), reasonText: g(reasonText, ''), refName: g(refName, ''), shapeLabel: g(shapeLabel, ''), pointName: g(pointName, ''), followsText: g(followsText, ''), phrase: g(phrase, null), menuItems: g(menuItems, []),
    inspectorSig: g(inspectorSig, null), inspectorBuild, inspectorFill, usedBy: g((id) => { try { return [...graph().users(id)]; } catch (e) { return []; } }, []), setFill, paletteActs: g(paletteActs, []), CAPTIONS,
    // TEMP-DEBUG-HOOK (removed before publishing)
    debug,
    // TEMP-DEBUG-HOOK
    pointMark: (s) => (s.helper ? 'helper' : s.def && s.def.op !== 'glider' ? 'ring' : null),
    get api() { return api; },
    get events() { return events.slice(); },
    get fill() { return fillMode; }, set fill(v) { fillMode = v === 'none' ? 'none' : 'in'; },
    get hyper() { return hyperMode; }, set hyper(v) { hyperMode = v === 'between' ? 'between' : 'in'; },
    get seg() { return segMode; }, set seg(v) { segMode = v === 'in' || v === 'out' || v === 'between' ? v : 'whole'; },
    setSeg: g(setSeg), setBetween: g(setBetween),
  };
