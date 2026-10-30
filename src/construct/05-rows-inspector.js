  // ---------------------------------------------------------------- deletes, toasts
  // deleteShape's toast: "Deleted Circle 1 and 3 shapes built on it." / "2 shapes no longer follow it." (null: v15's)
  function deleteMessage(id) {
    const st = S();
    if (!st.shapes.concat(st.targets).some((s) => s.at || s.def)) return null;
    let plan;
    try { plan = Constr.deletePlan(st, [id]); } catch (e) { return null; }
    const n = plan.del.length - 1, f = new Set(plan.freed.map((x) => x.id)).size;
    if (!n && !f) return null;
    const x = nameById(id);
    const parts = [];
    if (n) parts.push($tn('Deleted {x} and {n} shape built on it.', 'Deleted {x} and {n} shapes built on it.', n, { x }));
    else parts.push(isT(find(id)) ? $t('Target deleted.') : $t('Shape deleted.'));
    if (f) parts.push($tn('{n} shape no longer follows it.', '{n} shapes no longer follow it.', f));
    return parts.join(' ');
  }
  // (v16.3.1) a load before the app's adapter is set (the page opening a saved figure): its toast waits for ui()
  // the family (kind, or complement) of each three-point circle at its last recompute
  const famSeen = new Map();
  let freedLater = false;
  const freedToast = () => setTimeout(() => A.toast($t('Some constructions could not be read and were opened as plain shapes.')), 0);
  function on(type, data) {
    events.push({ type, data });
    if (events.length > 50) events.shift();
    if (!A) { if (type === 'loadFreed') freedLater = true; return; }
    if (type === 'loadFreed') freedToast();
    // [review user-8] removing a zero that constructions use: the toast offers Undo, as a delete's does
    if (type === 'zpRemoved' && data && data.undef && data.undef.length) setTimeout(() => {
      const n = data.undef.length;
      A.undoToast($tn('{n} shape is now undefined.', '{n} shapes are now undefined.', n));
    }, 0);
    // the tour's "Drag z2 across the line": a circle's family changes when its kind does (disc, half-plane) and also when
    // only its complement flips (disc, outside), which leaves the kind alone
    if (type === 'recomputed' && data && data.ids) {
      for (const id of data.ids) {
        const s = find(id);
        if (!s || !s.def || s.def.op !== 'circle3') continue;
        const fam = s.kind === 'disc' && s.complement ? 'complement' : s.kind, was = famSeen.get(id);
        famSeen.set(id, fam);
        if (fam !== was && (was !== undefined || (data.kindChanged && data.kindChanged.includes(id)))) A.tourEmit('construct-family', { kind: fam });
      }
    }
  }
  // the zero being dragged off the plane: what a release does to the constructions on it
  function zpOffNote(k, kind, i) {
    const st = S().steps[k - 1];
    if (!st || !st.zpIds || !st.zpIds[kind]) return '';
    let plan;
    try { plan = Constr.zeroRemovePlan(S(), { zp: st.uid, kind, id: st.zpIds[kind][i] }); } catch (e) { return ''; }
    const n = plan.undef.length;
    return n ? $tn('Release to remove {mark}; {n} shape will be undefined', 'Release to remove {mark}; {n} shapes will be undefined', n, { mark: zMark(kind, Constr.zpNum(st, kind, i)) }) : '';
  }

  // ---------------------------------------------------------------- rows, ⋯ items, hover links
  // updateShapeList's cell: true when this wrote it (a definition, a reason)
  function row(s, r) {
    // ([v16.5 fix rail-4] a fixed unit circle or axis: its row is titled by that name, so the cell shows its equation)
    if (!(s.def || s.at || s.cundef || s._atInf)) { if (r.box) r.box.classList.remove('cm-linked'); return false; }
    const d = r.d;
    let text = null, cls = 'cm-def';
    if (s.cundef) { text = reasonText(s.cundef); cls = 'err-msg'; }
    else if (s._atInf) text = s._note === 'parallel' ? `${pointName(s)} = ∞ · ${$t('They meet only at ∞')}` : `${pointName(s)} = ∞`;
    else if (s.def) text = defText(s, true);
    else if (s.at) text = boundText(s);
    if (text == null) {
      // a shape with only at: its equation (v15) and a link glyph; the tooltip says what it follows
      const sig = 'at|' + followsText(s);
      if (r.box) r.box.classList.add('cm-linked');
      if (r.row && !r.row.querySelector('.cm-link')) { const g = A.h('span', { class: 'cm-link', 'aria-hidden': 'true', html: LINK }); const nm = r.row.querySelector('.shape-name'); if (nm) nm.append(g); }
      if (r.row) { const g = r.row.querySelector('.cm-link'); if (g) g.title = followsText(s); }
      d.dataset.cm = sig;
      return false;
    }
    const sig = cls + '|' + text;
    if (d.dataset.cm !== sig) {
      d.dataset.cm = sig; d.dataset.tex = '';
      d.innerHTML = '';
      d.append(A.h('span', { class: cls }, text));
    }
    // [review user-11] the whole definition in the tooltip, the equation under it (the cell wraps to two lines)
    if (d.title && !d.title.startsWith(text)) d.title = text + '\n' + d.title; else if (!d.title) d.title = text;
    if (s.at && !s.def && r.row && !r.row.querySelector('.cm-link')) { const g = A.h('span', { class: 'cm-link', 'aria-hidden': 'true', html: LINK }); const nm = r.row.querySelector('.shape-name .k'); if (nm) nm.after(g); }
    if (s.at && r.row) { const g = r.row.querySelector('.cm-link'); if (g) g.title = followsText(s); if (r.box) r.box.classList.add('cm-linked'); }
    if (r.box) r.box.classList.toggle('cm-helper', !!s.helper);
    const eye = r.row && r.row.querySelector('.eye');
    if (eye) eye.disabled = !!s.cundef;
    return true;
  }
  const LINK = '<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M5 7l2-2M4.2 5.6L3 6.8a1.6 1.6 0 0 0 2.2 2.2l1.2-1.2M7.8 6.4L9 5.2A1.6 1.6 0 0 0 6.8 3L5.6 4.2"/></svg>';
  // the row's ⋯ menu: Make free, Use complement (flip), Other point, Show as point, Curve | Region
  function rowMenu(s, items) {
    if (!(s.def || s.at || s.helper || fixedName(s))) return;
    const add = [];
    if (fixedName(s)) add.push({ label: $t('Make free'), run: () => unfix(s) });
    if (isCirc3(s)) {
      const i = items.findIndex((it) => it && it.label && (it.label === $t('Use complement') || it.label === $t('Use the set itself')));
      if (i >= 0) items.splice(i, 1);
      if (s.def.fill === 'in') add.push({ label: $t('Use complement'), run: () => api.cm.setDef(s.id, { flip: !s.def.flip }) });
      add.push({ label: s.def.fill === 'in' ? $tx('construct', 'Curve') : $tx('construct', 'Region'), run: () => setFill(s, s.def.fill === 'in' ? 'none' : 'in') });
      // [v16.4 segments] Inside C only: on (SPEC 2.2's side), the other side, the whole circle
      const info = s.def.op === 'perp' && s.def.fill !== 'in' ? segInfo(s) : null;
      // (review math-6: the words of the side it turns on; a disc C drawn as its complement turns on its region, outside)
      const dw = info && (info.sides.find((x) => x[1] === info.dflt) || [])[0];
      if (info && !s.def.seg) add.push({ label: info.line ? $t('One side of {c} only', { c: cName(s.def.args[0]) }) : dw === 'out' ? $t('Outside {c} only', { c: cName(s.def.args[0]) }) : $t('Inside {c} only', { c: cName(s.def.args[0]) }), run: () => setSeg(s, info.dflt) });
      if (info && s.def.seg) add.push({ label: $t('Other side'), run: () => setSeg(s, -s.def.seg) }, { label: $t('Whole circle'), run: () => setSeg(s, 0) });
      // ([issue #70] Between z0 and z1: the segment from the first point to the second; Whole circle undoes it)
      if (info && s.def.between !== 1) add.push({ label: $t('Between {a} and {b} only', { a: refName(s.def.args[1]), b: refName(s.def.args[2]) }), run: () => setBetween(s, true) });
      if (info && s.def.between === 1) add.push({ label: $t('Whole circle'), run: () => setSeg(s, 0) });
    }
    if (s.def && s.def.op === 'meet' && s.def.index !== 'finite' && !s.def.seed && !touchMeet(s)) add.push({ label: $t('Other point'), run: () => api.cm.setDef(s.id, { index: s.def.index === 1 ? 0 : 1 }) });
    if (s.helper) add.push({ label: $t('Show as point'), run: () => { delete s.helper; delete s.owner; A.shapesChanged(true); A.commit(); } });
    if (s.def || s.at) add.push({ label: $t('Make free'), run: () => api.cm.makeFree(s.id) });
    if (add.length) items.unshift(...add, 'sep');
    // Delete: the cascade count
    // [review user-7] the row's Delete by what it is (its icon, its label), never by a style flag
    const del = items.find((it) => it && typeof it === 'object' && (it.icon === 'trash' || it.label === $t('Delete')));
    if (del) { try { const n = Constr.deletePlan(S(), [s.id]).del.length - 1; if (n > 0) del.label = $tn('Delete (and {n} built on it)', 'Delete (and {n} built on it)', n); } catch (e) { /* */ } }
  }
  // Make free on a fixed unit circle or axis: its handles and its drag come back (one undo step)
  function unfix(s) { delete s.fixed; if (isT(s)) A.targetsChanged(true); else A.shapesChanged(true); A.commit(); }
  // Curve | Region of a 3-point circle: the kind changes, the definition stays
  function setFill(s, fill) {
    // [v16.4 segments] Region turns Inside C only off (its gliders keep their points)
    if (fill === 'in' && s.def.seg) { try { Constr.setSeg(S(), s.id, 0, env()); } catch (e) { delete s.def.seg; } }
    s.def.fill = fill;
    s.kind = fill === 'in' ? (s.kind === 'line' ? 'halfplane' : 'disc') : (s.kind === 'halfplane' ? 'line' : 'circle');
    if (fill !== 'in') delete s.complement;
    api.cm.setDef(s.id, { fill });
  }
  // [v16.4 segments] Inside C only: 1 | -1 (a side of C's form) or 0 (the whole circle), its gliders kept on the drawn
  // curve (Constr.setSeg), one undo step
  function setSeg(s, v) {
    try { Constr.setSeg(S(), s.id, v, env()); } catch (e) { if (v) s.def.seg = v; else delete s.def.seg; }
    api.cm.setDef(s.id, {});
  }
  // [issue #70] Between z0 and z1: on (true) or off, its gliders kept on the drawn curve (Constr.setBetween), one undo step
  function setBetween(s, on) {
    try { Constr.setBetween(S(), s.id, on, env()); } catch (e) { if (on) { s.def.between = 1; delete s.def.seg; } else delete s.def.between; }
    api.cm.setDef(s.id, {});
  }
  // the sides of a perpendicular circle's curve and their words (Constr.segSides), or null
  function segInfo(s) { try { return Constr.segSides(S(), s.id, env()); } catch (e) { return null; } }
  // [v16.4 review math-7, user-6] P and Q both finite and strictly on the drawn side of C (not on C, not past it): only
  // then does the hyperbolic line pass through them as points of its plane
  function segThru(s, info) {
    if (!info || !info.seg || !s.def) return false;
    const plane = isT(s) || s._capT ? 1 : 0;
    return [s.def.args[1], s.def.args[2]].every((r) => {
      if (!r || r.inf) return false;
      let z = null;
      try { const res = Constr.resolve(S(), r, plane, env()); z = res && res.z; } catch (e) { z = null; }
      return isXY(z) && !Constr.onCarrier(info.Gc, z, null) && info.seg * Constr.fOf(info.Gc, z) < 0;
    });
  }
  // the word of the side of C that a Between segment lies on (its middle's side): 'in', 'out', 'above', …, or null
  function betweenWord(s) {
    try {
      const info = segInfo(s), pc = piecesOf(s)[0], z = info && pc && pc.seg ? Constr.glide(pc, 0.5) : null;
      if (!z || !isXY(z)) return null;
      const f = Constr.fOf(info.Gc, z);
      const sd = info.sides.find((x) => x[1] * f < 0);
      return sd ? sd[0] : null;
    } catch (e) { return null; }
  }
  const sideLabel = (w) => ({ in: $tx('side', 'Inside'), out: $tx('side', 'Outside'), above: $tx('side', 'Above'), below: $tx('side', 'Below'), left: $tx('side', 'Left'), right: $tx('side', 'Right') }[w] || w);
  // (the chip's icons: a thin circle and the arc orthogonal to it (centre (8, 18), radius 8: 10^2 = 6^2 + 8^2), whole, or
  // inside only, its ends (3.2, 11.6) and (12.8, 11.6) on both curves)
  const SEG_ICON = {
    whole: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"><circle cx="8" cy="8" r="6" stroke-width="1" stroke-opacity=".45"/><path d="M0.254 16A8 8 0 0 1 15.746 16" stroke-width="1.4"/></svg>',
    in: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"><circle cx="8" cy="8" r="6" stroke-width="1" stroke-opacity=".45"/><path d="M3.2 11.6A8 8 0 0 1 12.8 11.6" stroke-width="1.4"/></svg>',
    // ([issue #70] Between: the arc between two points of it, the two points marked)
    between: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"><circle cx="8" cy="8" r="6" stroke-width="1" stroke-opacity=".45"/><path d="M5.2 10.5A8 8 0 0 1 10.8 10.5" stroke-width="1.4"/><circle cx="5.2" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.8" cy="10.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
    // ([v16.5 UX55] Outside: the two ends of the same arc, outside the circle)
    out: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"><circle cx="8" cy="8" r="6" stroke-width="1" stroke-opacity=".45"/><path d="M0.254 16A8 8 0 0 1 3.2 11.6M12.8 11.6A8 8 0 0 1 15.746 16" stroke-width="1.4"/></svg>',
  };
  // the shapes linked to id (its sources, transitively, and what is built on it)
  function linked(id) {
    const out = new Set([id]);
    try {
      const g = graph();
      for (const u of g.users(id)) out.add(u);
      const st = [id];
      while (st.length) { const x = st.pop(); for (const d of g.sources(x)) if (!out.has(d)) { out.add(d); st.push(d); } }
    } catch (e) { /* */ }
    return out;
  }
  // helpers' rows go under their owner's row (SPEC 10; the list order, and so the names, stay as they are)
  function orderRows() {
    const host = document.getElementById('shapeList');
    if (!host) return;
    for (const s of S().shapes.concat(S().targets)) {
      if (!s.helper || !s.owner) continue;
      const me = host.querySelector(`.shape[data-id="${s.id}"]`), ow = host.querySelector(`.shape[data-id="${s.owner}"]`);
      if (me && ow && ow.nextSibling !== me) ow.after(me);
    }
  }
  // rows of the shapes linked to the hovered (or, on touch, the selected) one take --accent-soft
  function markLinks(id) {
    const ids = id && find(id) && (find(id).def || find(id).at || graph().users(id).size) ? linked(id) : null;
    for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#shapeList .shape[data-id]'))) el.classList.toggle('cm-link-on', !!ids && ids.has(el.dataset.id) && el.dataset.id !== id);
  }

  // ---------------------------------------------------------------- the plane menu's group (SPEC 11)
  function menuItems(ctx) {
    if (!A || ctx.surface !== 'flat') return [];
    const side = ctx.side;
    if (side === 'L' && (A.leftStage() > 0 || ctx.plane !== 'X')) return [];
    if (side === 'R' && !A.targetsEditable()) return [];
    const touch = !!ctx.touch, items = [];
    const t = snapAt(side, ctx.x, ctx.y, { points: true, cross: true, curves: true, touch, disp: true });
    const target = side === 'R';
    if (t && t.cls === 'cross') items.push({ label: $t('Mark the intersection'), run: () => { const m = materialize(t, side, {}); api.cm.create(m.shapes, { target }); A.tourEmit('construct-added', { op: 'meet' }); } });
    if (t && t.cls === 'curve') items.push({ label: $t('Point on this curve'), run: () => { const m = materialize(t, side, {}); api.cm.create(m.shapes, { target }); A.tourEmit('construct-added', { op: 'glider' }); } });
    if (t && t.cls === 'curve' && t.disp) { t.make = DISP[t.disp](); }   // ([v16.5 rail] a display curve: made with the point)
    // (issue #13: only what acts on the shape there; the tools that start from it, Perpendicular circle, Touching
    // circle, Circle through 3 points and Midpoint, are the toolbar's)
    if (t && t.cls === 'point') {
      // a free point on a curve: put it on the curve
      const p = t.ref.s && !t.ref.h ? find(t.ref.s) : null;
      if (p && !p.def && !p.at) {
        // [review math-6] never a curve built on this point (a cycle): the point and everything built on it are excluded
        let ex;
        try { ex = new Set([p.id, ...graph().users(p.id)]); } catch (e) { ex = new Set([p.id]); }
        const c = snapAt(side, ctx.x, ctx.y, { points: false, cross: false, curves: true, disp: true, touch, exclude: ex });
        // ([v16.5 rail] a display curve too: its fixed shape is made, or the plane's reused, in the same undo step)
        if (c) items.push({ label: $t('Put on this curve'), run: () => {
          const pre = [], list = side === 'R' ? S().targets : S().shapes;
          const def = { op: 'glider', args: [c.disp ? dispRef(c.disp, side, null, pre) : c.ref] };
          if (c.seed) def.seed = c.seed;
          for (const x of pre) list.splice(list.indexOf(p), 0, x);
          if (api.cm.setDef(p.id, { def, t: c.t }) === false) for (const x of pre) { const i = list.indexOf(x); if (i >= 0) list.splice(i, 1); }
        } });
      }
    }
    // a constructed shape under the press: Make free
    // ([v16.5 UX56] named: a point on a curve and the curve are both under the press)
    const hit = hitShape(side, ctx.x, ctx.y);
    if (hit && (hit.def || hit.at)) items.push({ label: $t('Make {x} free', { x: shapeLabel(hit) }), run: () => api.cm.makeFree(hit.id) });
    else if (hit && fixedName(hit)) items.push({ label: $t('Make {x} free', { x: shapeLabel(hit) }), run: () => unfix(hit) });
    return items;
  }
  function hitShape(side, x, y) {
    const pane = A.setView(side), z = pane.s2w(x, y), tol = 7 / pane.view.s;
    const list = (side === 'R' ? S().targets : S().shapes).filter((s) => s.visible !== false).slice().reverse().sort((a, b) => Number(b.kind === 'point') - Number(a.kind === 'point'));
    for (const s of list) { try { if (Region.hitTest(s, z, tol, A.win(side))) return s; } catch (e) { /* */ } }
    return null;
  }

  // ---------------------------------------------------------------- the Inspector's Construction view (SPEC 7)
  function inspectorSig() {
    const id = A && A.selected();
    const s = id && find(id);
    if (!s || !(s.def || s.at)) return null;
    return `C#${s.id}#${s.kind}#${s.def ? s.def.op + s.def.fill + s.def.index + (s.def.seg || '') : 'at'}#${I18N.lang}#${!!s.cundef}`;
  }
  // [review user-15] what t means on the curve a point slides on, and the range a number for it should take
  function tMeaning(s) {
    const r = s.def && s.def.args && s.def.args[0], c = r && find(r.s);
    if (!c) return null;
    const pc = piecesOf(c)[r.part];
    if (!pc || pc.kind === 'none' || pc.kind === 'traced') return null;
    if (c.def && c.def.op === 'perp' && pc.seg) return { text: $t('0 and 1 at its ends on {c}', { c: cName(c.def.args[0]) }), range: [0, 1] };
    if (c.def && c.def.op === 'perp') return { text: $t('0 at {p}, ½ opposite it', { p: refName(c.def.args[1]) }), range: [0, 1] };
    // (a touching circle: perp's map anchored at T; the tangent at T and a tangent from P: plain line gliders from T or P)
    if (c.def && c.def.op === 'touch' && !(c.def.args[2] && c.def.args[2].inf)) return { text: $t('0 at {p}, ½ opposite it', { p: refName(c.def.args[1]) }), range: [0, 1] };
    if (c.def && (c.def.op === 'touch' || c.def.op === 'tangent')) return { text: $t('0 at {p}; t is the distance from it', { p: refName(c.def.args[1]) }), range: [-10, 10] };
    if (c.def && c.def.op === 'circle3') {
      const [p, q, rr] = c.def.args.map((x) => refName(x));
      return { text: $t('0 at {p}, ¼ at {q}, ½ at {r}', { p, q, r: rr }), range: [0, 1] };
    }
    if (pc.poly) { const n = pc.poly.pts.length; return { text: $t('sides: 0 at vertex 1, {n} once round', { n }), range: [0, n] }; }
    if (pc.kind === 'circle' && pc.closed) return { text: $t('turns, 0 at the right'), range: [0, 1] };
    return { text: $t('0 = start, 1 = end'), range: [0, 1] };
  }
  function inspectorBuild() {
    const s = find(A.selected());
    const h = A.h;
    const head = h('div', { class: 'ihead cm-ihead' }, h('span', { class: 'swatch', 'data-kind': A.kindType(s), style: A.swatchStyle(s) }), h('span', { class: 'ttl' }, shapeLabel(s)));
    const def = h('div', { class: 'cm-idef' });
    const warn = h('div', { class: 'cm-iwarn', role: 'status' });
    const uses = h('div', { class: 'cm-ichips' }), used = h('div', { class: 'cm-ichips' });
    const fields = h('div', { class: 'cm-ifields' });
    const acts = h('div', { class: 'cm-iacts' });
    const root = h('div', { class: 'cm-insp' }, head, h('div', { class: 'cm-ilabel' }, $t('Construction')), def, warn,
      h('div', { class: 'cm-ilabel' }, $t('Uses')), uses, h('div', { class: 'cm-ilabel' }, $t('Used by')), used, fields, acts);
    // a chip per shape (hover: highlighted in X; click: selected), plain for a zero or ∞
    const chip = (id, label) => (id ? h('button', { type: 'button', class: 'cm-chipbtn', onclick: () => A.select(id), onpointerenter: () => A.hoverShape(id), onpointerleave: () => A.hoverShape(null) }, label || nameById(id)) : h('span', { class: 'cm-chipbtn cm-plain' }, label));
    // fields
    if (isCirc3(s)) {
      const seg = h('div', { class: 'seg cm-iseg', role: 'group' });
      for (const [v, lab] of [['none', $tx('construct', 'Curve')], ['in', $tx('construct', 'Region')]]) seg.append(h('button', { type: 'button', class: (s.def.fill === 'in') === (v === 'in') ? 'on' : '', 'aria-pressed': String((s.def.fill === 'in') === (v === 'in')), onclick: () => setFill(s, v) }, lab));
      fields.append(seg);
      // [v16.4 segments] Whole | Inside | Outside (a line: Above | Below, or Left | Right): the side drawn now is on
      const info = s.def.op === 'perp' && s.def.fill !== 'in' ? segInfo(s) : null;
      if (info) {
        const now = s.def.between === 1 ? 'between' : s.def.seg === 1 || s.def.seg === -1 ? s.def.seg : 0, sg = h('div', { class: 'seg cm-iseg cm-iside', role: 'group', 'aria-label': $t('Whole or inside') });
        // ([issue #70] Between z0 and z1 is the last choice: the segment from the first point to the second)
        for (const [v, lab] of [[0, $tx('side', 'Whole')]].concat(info.sides.map(([w, v]) => [v, sideLabel(w)]), [['between', $tx('side', 'Between')]])) sg.append(h('button', { type: 'button', class: now === v ? 'on' : '', 'aria-pressed': String(now === v), onclick: () => (v === 'between' ? setBetween(s, true) : setSeg(s, v)) }, lab));
        fields.append(h('div', { class: 'cm-ibreak' }), sg);
      }
      if (s.def.fill === 'in') fields.append(h('label', { class: 'cm-icheck' }, h('input', { type: 'checkbox', checked: s.complement ? true : null, onchange: () => api.cm.setDef(s.id, { flip: !s.def.flip }) }), $t('Use complement')));
    }
    if (s.def && s.def.op === 'meet' && s.def.index !== 'finite' && !s.def.seed && !touchMeet(s)) fields.append(h('button', { type: 'button', class: 'btn', onclick: () => api.cm.setDef(s.id, { index: s.def.index === 1 ? 0 : 1 }) }, $t('Other point')));
    if (s.def && s.def.op === 'glider' && Number.isFinite(s.t)) {
      const meaning = tMeaning(s);
      const inp = h('input', { class: 'inp mono cm-it', value: s.bind && s.bind.t ? s.bind.t : String(+s.t.toPrecision(6)), 'aria-label': 't' + (meaning ? ' (' + meaning.text + ')' : ''), spellcheck: 'false' });
      const err = h('div', { class: 'field-err cm-ierr', role: 'alert', hidden: true });
      const showErr = (m) => { inp.classList.toggle('bad', !!m); inp.setAttribute('aria-invalid', String(!!m)); err.textContent = m || ''; err.hidden = !m; };
      // a number, or a formula in the shared numbers (v15's bind: t = a moves the point along its curve with a).
      // [review user-1] a new name makes the number first, as v15's other fields do ("Re z = a"), starting at the
      // point's t and with the curve's range [user-15]; bad input says why under the field
      inp.addEventListener('change', () => {
        const txt = inp.value.trim().replace(/−/g, '-');
        let v = Number(txt), added = null;
        if (txt && !Number.isFinite(v)) {
          const u = Params.unknownIn(txt);
          if (u.length > 1) { showErr($t('One new name at a time: {x}', { x: u.map(Params.display).join(', ') })); return; }
          if (u.length === 1) {
            const c = Params.check(u[0]);
            if (c.error) { showErr(c.error); return; }
            const [lo, hi] = meaning ? meaning.range : [0, 1];
            try { Params.add(c.name, { value: +s.t.toPrecision(6), min: lo, max: hi }); added = c.name; } catch (e) { showErr(e.message); return; }
          }
          try { v = Params.evalReal(txt); } catch (e) { showErr(e && e.message ? e.message : $t('This is not a number')); return; }
        }
        if (!Number.isFinite(v)) { showErr($t('This is not a number')); return; }
        showErr(null);
        A.bindField(s, 't', txt);
        api.cm.setDef(s.id, { t: v });
        if (added) setTimeout(() => A.undoToast($t('Added the number {x}', { x: Params.display(added) })), 0);
      });
      fields.append(h('label', { class: 'cm-ifield' }, h('i', null, 't'), inp, meaning ? h('span', { class: 'cm-imean' }, meaning.text) : null), err);
    }
    acts.append(h('button', { type: 'button', class: 'btn', onclick: () => api.cm.makeFree(s.id) }, $t('Make free')));
    let n = 0;
    try { n = Constr.deletePlan(S(), [s.id]).del.length - 1; } catch (e) { n = 0; }
    acts.append(h('button', { type: 'button', class: 'btn danger', onclick: () => A.deleteShape(s.id) }, n ? $tn('Delete (and {n} built on it)', 'Delete (and {n} built on it)', n) : $t('Delete')));
    const E = { kind: 'construct', root, def, warn, uses, used, id: s.id, chip };
    return E;
  }
  function inspectorFill(E) {
    const s = find(E.id);
    if (!s) return;
    const t = s.def ? defText(s) : followsText(s);
    if (E.def.textContent !== t) E.def.textContent = t;
    const w = s.cundef ? reasonText(s.cundef) : '';
    if (E.warn.textContent !== w) E.warn.textContent = w;
    E.warn.hidden = !w;
    let g;
    try { g = graph(); } catch (e) { return; }
    const refs = s.def ? s.def.args : s.at ? Object.values(s.at) : [];
    const src = [];
    for (const r of refs) { const nm = refName(r), id = r.meet ? null : r.s || r.img || null; if (!src.some((x) => x[1] === nm)) src.push([id, nm]); }
    const us = [...g.users(s.id)];
    const sig = src.map((x) => x.join(':')).join(',') + '|' + us.join(',') + '|' + I18N.lang;
    if (E.uses.dataset.sig !== sig) {
      E.uses.dataset.sig = sig;
      E.uses.replaceChildren(...(src.length ? src.map(([id, nm]) => E.chip(id, nm)) : [A.h('span', { class: 'cm-none' }, '—')]));
      E.used.replaceChildren(...(us.length ? us.map((id) => E.chip(id)) : [A.h('span', { class: 'cm-none' }, '—')]));
    }
  }

