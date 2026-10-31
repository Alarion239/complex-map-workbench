  // ---------------------------------------------------------------- the chip (the draft chip of the plane drawn in)
  // [review user-2, picture-4] the counter first (it says which pick is next), then the tool (its tile label on a
  // narrow pane or touch), then Esc; the chip wraps to two lines rather than cut the counter
  // (v16.3 review user-7: the English tile is «Orthogonal», one line, as the Russian «Ортогональная»; «perpendicular»
  // stays the bisector's sense)
  const toolShort = (id) => ({ circle3: $t('3-pt circle'), meet: $t('Intersect'), midpoint: $t('Midpoint'), bisector: $t('Bisector'), perp: $t('Perpendicular'), touch: $t('Touching'), hyper: $t('Hyperbolic') }[id] || id);
  // [v16.3 review user-12] the chip's touch form (no "Esc cancels", a ×) from its first frame when the tool was chosen
  // by touch, or on a coarse pointer before any pointer event over a plane
  let lastPressTouch = null;
  const coarse = () => { try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches); } catch (e) { return false; } };
  const chipTouch = () => (lastEv ? touchNow() || (lastPressTouch === true && lastPressAt > lastEvAt) : lastPressTouch != null ? lastPressTouch : coarse());
  let lastPressAt = 0, lastEvAt = 0;
  // [v16.5 UX48] what to pick next, in one plain sentence, then the count, the tool, and on a keyboard how to back up
  // ("⌫ undo pick · Esc" once the draft has picks of its own, else "Esc cancels"); a finger has × and Undo instead
  // (noEsc: without that keyboard tail, for a chip that would wrap with it and fits one line without it [v16.3.1])
  // (noName: without the tool's name, which the pane head's chip already gives: a chip that wraps drops it before its
  // keyboard tail [#35: «3-pt circle» is longer than the retired «3 points», and at 1366 x 768 the tail went])
  function chipText(narrow, noEsc, noName) {
    const tool = A.tool();
    if (!isCTool(tool)) return '';
    // (the tile's soft hyphen never reaches the chip: it would break the chip's line there [v16.3 review user-8])
    const touch = chipTouch(), tn = (narrow || touch ? toolShort(tool) : toolName(tool)).replace(/­/g, '');
    const d = draftC && draftC.tool === tool ? draftC : null;
    const tail = touch || noEsc ? '' : ' · ' + (undoPickable() ? $t('⌫ undo pick · Esc') : $t('Esc cancels'));
    const of = (n, m) => ' · ' + $t('{n} of {m}', { n, m });
    let what, cnt = '';
    if (tool === 'meet') { const n = d && d.curve1 ? 2 : 1; what = n === 1 ? $t('Pick where two curves cross, or the first curve') : $t('Pick the second curve'); cnt = of(n, 2); }
    else if (CURVE1.has(tool) && !(d && curve1Ok())) what = tool === 'hyper' ? $t('Pick the boundary: a line or a circle') : $t('Pick a line or a circle');
    else if (tool === 'touch' && d && d.picks.length) {
      // (the touching circle: after P, the touching point on C; after T, P or the tangent when C is a circle)
      if (d.picks[0].role === 'P') what = ringsLeft(d.picks[0].z).length ? $t('Pick the touching point on {c}, or a ring for a tangent', { c: curve1Name() }) : $t('Pick the touching point on {c}', { c: curve1Name() });
      else { const pc = curve1Piece(d.curve1); what = pc && pc.kind === 'circle' ? $t('Pick a point off {c}, or the dashed tangent', { c: curve1Name() }) : $t('Pick a point off {c}', { c: curve1Name() }); }
      cnt = of(2, 2);
    } else if (tool === 'touch') { what = $t('Pick the touching point on {c}, or a point off it', { c: curve1Name() }); cnt = of(1, 2); }
    else {
      const n = (d ? d.picks.length : 0) + 1, m = NEED[tool];
      // ([v16.5 fix user-6] after the curve: a point on that curve is as good as one anywhere, and the chip says so)
      what = (tool === 'midpoint' || tool === 'bisector') && n === 1 ? $t('Pick a point, an empty spot or a segment')
        : CURVE1.has(tool) && d && curve1Ok() ? $t('Pick a point (on {c} or anywhere)', { c: curve1Name() }) : $t('Pick a point or an empty spot');
      cnt = of(n, m);
    }
    lastCnt = cnt.replace(/^ · /, '');
    return what + cnt + (noName ? '' : ' · ' + tn) + tail;
  }
  // the head's chip for the tool in use (the sentence stays on the plane): its name and how far the picks have got
  let lastCnt = '';
  function toolChip() {
    const tool = A && A.tool();
    if (!tool || !isCTool(tool)) return null;
    chipText(true, true);
    return { name: toolName(tool).replace(/\u00ad/g, ''), count: lastCnt };
  }
  const howTo = (tool) => { const r = toolRows().find((x) => x[0] === tool); return r ? r[3] : ''; };
  // the plane whose draft chip a construction tool uses (updateDraftChips shows it)
  let hoverSide = 'L';
  const chipNarrow = { L: false, R: false }, chipBot = { L: 0, R: 0 }, chipH = { L: 0, R: 0 };
  function chipSide() {
    if (!A || !isCTool(A.tool())) return null;
    const side = draftC ? draftC.side : hoverSide;
    if (side === 'L' && (A.leftStage() > 0 || !(A.lFlat() || A.globeEdit('L')))) return null;
    if (side === 'R' && !A.targetsEditable()) return null;
    return side;
  }
  function syncChip() {
    if (!A) return;
    const cs = chipSide();
    for (const side of ['L', 'R']) {
      const el = document.getElementById(side === 'L' ? 'draftChipL' : 'draftChipR');
      if (!el) continue;
      const tool = A.tool();
      const on = cs === side;
      let box = /** @type {HTMLElement | null} */ (el.querySelector('.cm-chip'));
      if (!on) { if (box) { box.remove(); el.classList.remove('cm-on'); el.firstElementChild && (/** @type {HTMLElement} */ (el.firstElementChild).hidden = false); } continue; }
      if (!box) {
        box = document.createElement('span');
        box.className = 'cm-chip';
        el.append(box);
      }
      el.classList.add('cm-on');
      if (el.firstElementChild && el.firstElementChild !== box) /** @type {HTMLElement} */ (el.firstElementChild).hidden = true;
      const plot = el.parentElement, pw = plot ? plot.clientWidth : 0, narrow = pw > 0 && pw < 560;
      chipNarrow[side] = narrow;
      // ([v16.5 fix rail-9] until wave 2's D10 puts it in the pane head, a desktop's chip never sits where the picks go:
      // it moves to the plane's foot while the pointer, a pick or the picked circle is in its band at the top and none of
      // them in the band at the foot, and back up the other way round; its size is measured when its text changes)
      if (!document.documentElement.classList.contains('ph') && chipBot[side] > 0 && draftC && draftC.side === side) {
        const pn = A.setView(side), ys = [], H = pn.h, top = [0, chipBot[side] + 24], foot = [H - 32 - chipH[side] - 24, H];
        if (isXY(draftC.hover)) ys.push(draftC.hover);
        for (const p of draftC.picks) if (isXY(p.z)) ys.push(p.z);
        const yy = ys.map((z) => pn.w2sxy(z[0], z[1])[1]).filter(Number.isFinite);
        let cy = null;
        const pc1 = draftC.curve1 ? curve1Piece(draftC.curve1) : null;
        if (pc1 && pc1.kind === 'circle' && isXY(pc1.c) && pc1.r > 0) cy = [pn.w2sxy(pc1.c[0], pc1.c[1] + pc1.r)[1], pn.w2sxy(pc1.c[0], pc1.c[1] - pc1.r)[1]];
        const hit = (b) => yy.some((y) => y >= b[0] && y <= b[1]) || (!!cy && cy[0] < b[1] && cy[1] > b[0]);
        const ht = hit(top), hf = hit(foot), low = el.classList.contains('cm-low');
        if (ht && !hf && !low) el.classList.add('cm-low');
        else if (hf && !ht && low) el.classList.remove('cm-low');
      } else if (el.classList.contains('cm-low') && !(draftC && draftC.side === side)) el.classList.remove('cm-low');
      const txt = chipText(narrow);
      const kept = CURVE1.has(tool) && draftC && draftC.tool === tool && draftC.side === side && curve1Ok() ? curve1Name() : '';
      // (pw, the plane's width, for every tool [v16.3.1: the one-line rule below re-measures the wrap when it changes]; it
      // also covers the Orthogonal chip's 8 px bucket that the Whole | Inside fit was rebuilt on [v16.4]. [v16.5 check
      // app-5] the chip's place too: at the plane's foot it is narrower, and the rule must measure it there)
      const tan = tool === 'touch' && tangentReady(side);
      const sig = `${txt}|${tool}|${fillMode}|${segMode}|${hyperMode}|${I18N.lang}|${chipTouch()}|${narrow}|${pw}|${kept}|${tan}|${pickWarnMsg || ''}|${howOpen}|${el.classList.contains('cm-low')}`;
      if (box.dataset.sig !== sig) {
        box.dataset.sig = sig;
        box.innerHTML = '';
        box.classList.toggle('cm-tch', chipTouch());
        // (each part after the first keeps its words together: "1 of 2", "Esc cancels" never break [v16.5])
        const ct = A.h('span', { class: 'cm-t' });
        // (the keyboard tail "⌫ undo pick · Esc" is one part: "Esc" never goes alone onto a line of its own)
        const tailU = $t('⌫ undo pick · Esc');
        const fillT = (s) => {
          ct.textContent = '';
          const parts = s.endsWith(' · ' + tailU) ? s.slice(0, -tailU.length - 3).split(' · ').concat([tailU]) : s.split(' · ');
          parts.forEach((p, i) => { if (i) ct.append(' · '); ct.append(i ? A.h('span', { class: 'cm-nw' }, p) : p); });
        };
        fillT(txt);
        box.append(ct);
        // [v16.5 UX100] the curve kept for the next circle, as a token: its × un-picks only the curve
        if (kept) box.append(A.h('span', { class: 'cm-tok' }, A.h('span', null, $t('on {c}', { c: kept })), A.h('button', { type: 'button', class: 'cm-tokx', 'aria-label': $t('Pick another curve'), title: $t('Pick another curve'), html: '×', onclick: (e) => { e.stopPropagation(); if (draftC) { draftC.curve1 = null; draftC.picks = []; draftC.carried = false; draftC.doneK = null; } A.requestRender('OL', 'OR'); } })));
        // [v16.5 UX48] a small ? unfolds the tool's how-to inside the chip
        const how = howTo(tool);
        if (how) box.append(A.h('button', { type: 'button', class: 'cm-q' + (howOpen ? ' on' : ''), 'aria-expanded': String(howOpen), 'aria-label': $t('How to use {x}', { x: toolName(tool) }), title: $t('How to use {x}', { x: toolName(tool) }), html: '?', onclick: (e) => { e.stopPropagation(); howOpen = !howOpen; A.requestRender('OL', 'OR'); } }));
        if (tool === 'circle3') {
          // (a narrow pane: two icons, a circle and a filled disc, with their names as labels; [v16.5 UX51] a finger: the words)
          const icons = narrow && !chipTouch();
          const seg = A.h('span', { class: 'cm-seg' + (icons ? ' cm-icons' : '') + (chipTouch() ? ' cm-touch' : ''), role: 'group', 'aria-label': $t('Curve or region') });
          for (const [v, lab] of [['none', $tx('construct', 'Curve')], ['in', $tx('construct', 'Region')]]) {
            const b = A.h('button', { type: 'button', class: 'cm-sb' + (fillMode === v ? ' on' : ''), 'aria-pressed': String(fillMode === v), 'aria-label': lab, title: lab, onclick: (e) => { e.stopPropagation(); fillMode = v; A.requestRender('OL', 'OR'); } });
            if (icons) b.innerHTML = v === 'in' ? '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="1.4"/></svg>' : '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
            else b.textContent = lab;
            seg.append(b);
          }
          box.append(seg);
        }
        let segBox = null;
        const mkSeg = (icons, only) => {
          // [v16.4 segments] Whole | Inside: words, or two icons (the orthogonal arc whole or inside only) on touch and when
          // the words do not fit the chip's free width (review user-4: measured below, after the text)
          const seg = A.h('span', { class: 'cm-seg' + (icons ? ' cm-icons' : '') + (chipTouch() ? ' cm-touch' : ''), role: 'group', 'aria-label': $t('Whole or inside') });
          for (const [v, lab] of [['whole', $tx('side', 'Whole')], ['in', $tx('side', 'Inside')], ['out', $tx('side', 'Outside')], ['between', $tx('side', 'Between')]].filter(([v]) => !only || only.includes(v))) {
            // ([v16.5 UX55] the same three choices as the Inspector's: Outside is the other side of the curve)
            const tip = v === 'in' ? $t("Inside: only the arc inside the curve (for a line, on the first point's side)") : v === 'out' ? $t("Outside: only the arc outside the curve (for a line, on the other side from the first point)") : v === 'between' ? $t('Between: only the hyperbolic segment from the first point to the second, with no tails') : $t('Whole: the whole circle');
            const b = A.h('button', { type: 'button', class: 'cm-sb' + (effSeg(tool) === v ? ' on' : ''), 'aria-pressed': String(effSeg(tool) === v), 'aria-label': lab, title: tip, onclick: (e) => { e.stopPropagation(); if (tool === 'hyper') hyperMode = v; else segMode = v; A.requestRender('OL', 'OR'); } });
            if (icons) b.innerHTML = SEG_ICON[v]; else b.textContent = lab;
            seg.append(b);
          }
          return seg;
        };
        // ([v16.5 UX51] words on touch too: the chip takes two lines rather than drop them)
        if (tool === 'perp') box.append(segBox = mkSeg(false));
        // ([issue #70] the Hyperbolic line tool: the whole line, or the segment between the two points)
        else if (tool === 'hyper') box.append(segBox = mkSeg(false, ['in', 'between']));
        // the touching circle after T on a circle: the tangent at T in one click (or Enter)
        if (tan) box.append(A.h('span', { class: 'cm-seg cm-tan' + (chipTouch() ? ' cm-touch' : '') }, A.h('button', { type: 'button', class: 'cm-sb', title: $t('The tangent at {a} (Enter)', { a: pickName(draftC.picks[0], side) }), onclick: (e) => { e.stopPropagation(); tangentNow(); } }, $t('Tangent line'))));
        if (chipTouch()) box.append(A.h('button', { type: 'button', class: 'cm-x', 'aria-label': $t('Cancel'), html: '×', onclick: (e) => { e.stopPropagation(); cancel(); A.setTool('select'); } }));
        if (segBox && !chipTouch() && plot) {
          // (the words fit when the text stays on one line and the chip inside its plane)
          const t = /** @type {HTMLElement} */ (box.firstElementChild), fs = parseFloat(getComputedStyle(t).fontSize) || 12;
          if (t.offsetHeight > 2.6 * fs || el.getBoundingClientRect().right > plot.getBoundingClientRect().right - 8) segBox.replaceWith(mkSeg(true));
        }
        // a chip that wraps keeps one line without its keyboard tail ("Esc cancels", or v16.5's "⌫ undo pick ·
        // Esc") when that is enough (the touching circle's "…, or a ring for a tangent" in X at 1440 x 900); when it is
        // not, the whole text on two lines, else (it would be cut at two) the shorter one. (after the Whole |
        // Inside choice above, so a chip that is one line with the icons keeps its tail, as in v16.4. v16.5: before the
        // refusal and the how-to lines below, and before rail-9 measures the chip)
        const noEsc = chipText(narrow, true);
        if (noEsc !== txt) {
          const lines = () => { const lh = parseFloat(getComputedStyle(ct).lineHeight) || 16; return ct.scrollHeight / lh; };
          const n = lines(), most = el.classList.contains('cm-low') ? 3 : 2;   // (the lines the place allows [check app-5])
          if (n > 1.5) {
            // (#35: first without the tool's name, which the head's chip shows: the keyboard tail stays when that fits)
            fillT(chipText(narrow, false, true));
            if (lines() > 1.5) { fillT(noEsc); if (lines() > 1.5 && n < most + 0.5) fillT(txt); }
          }
        }
        // [v16.5 UX52] a refused pick, here for 2 s; [UX48] the how-to
        if (pickWarnMsg) box.append(A.h('span', { class: 'cm-warn', role: 'status' }, pickWarnMsg));
        if (howOpen && how) box.append(A.h('span', { class: 'cm-how' }, how));
        // ([v16.5 fix rail-9] the chip's foot in its top place, for the band the picks keep clear of)
        if (!el.classList.contains('cm-low')) chipBot[side] = el.offsetTop + el.offsetHeight;
        chipH[side] = el.offsetHeight;
      }
    }
  }

  // ---------------------------------------------------------------- the overlay: the ring, its chip, the preview
  // [v16.5 UX101] a crossing gone to ∞ (its two lines made parallel) is not lost from the plane: a hollow marker sits at
  // the plane's edge where each line leaves it, toward ∞, with "∞" beside it (its row says why)
  function drawInfMarks(pane, side, ctx, TH) {
    const list = side === 'R' ? S().targets : S().shapes;
    for (const s of list) {
      if (s.kind !== 'point' || !s._atInf || s.visible === false || !s.def || s.def.op !== 'meet') continue;
      for (const r of s.def.args.slice(0, 2)) {
        const c = r && find(r.s), pc = c && piecesOf(c)[r.part];
        if (!pc || pc.kind !== 'line' || !isXY(pc.a) || !isXY(pc.b)) continue;
        const [ax, ay] = pane.w2sxy(pc.a[0], pc.a[1]), [bx, by] = pane.w2sxy(pc.b[0], pc.b[1]);
        let dx = bx - ax, dy = by - ay;
        const L = Math.hypot(dx, dy);
        if (!(L > 0)) continue;
        dx /= L; dy /= L;
        // the line's point nearest the pane's centre, then out along the line both ways to 14 px inside the edge
        const cx = pane.w / 2, cy = pane.h / 2, t0 = (cx - ax) * dx + (cy - ay) * dy, px = ax + t0 * dx, py = ay + t0 * dy, m = 14;
        if (px < m || py < m || px > pane.w - m || py > pane.h - m) continue;
        ctx.save();
        for (const sg of [1, -1]) {
          const ux = sg * dx, uy = sg * dy;
          let t = Infinity;
          if (ux > 1e-9) t = Math.min(t, (pane.w - m - px) / ux); else if (ux < -1e-9) t = Math.min(t, (m - px) / ux);
          if (uy > 1e-9) t = Math.min(t, (pane.h - m - py) / uy); else if (uy < -1e-9) t = Math.min(t, (m - py) / uy);
          if (!Number.isFinite(t)) continue;
          const x = px + t * ux, y = py + t * uy;
          ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
          ctx.lineWidth = 1.5; ctx.strokeStyle = TH.ink; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
          // (an arrowhead on the ring, pointing out of the plane)
          ctx.beginPath(); ctx.moveTo(x + ux * 6 - uy * 3.5 - ux * 3, y + uy * 6 + ux * 3.5 - uy * 3); ctx.lineTo(x + ux * 9, y + uy * 9); ctx.lineTo(x + ux * 6 + uy * 3.5 - ux * 3, y + uy * 6 - ux * 3.5 - uy * 3); ctx.stroke();
          ctx.font = `italic 500 13px ${TH.math || 'serif'}`; ctx.fillStyle = TH.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
          ctx.fillText('∞', x - ux * 14 + uy * 10, y - uy * 14 - ux * 10);
        }
        ctx.restore();
        break;
      }
    }
  }
  function drawOverlay(pane, side) {
    const ctx = pane.octx, TH = A.TH();
    drawInfMarks(pane, side, ctx, TH);
    // during a gesture only, an undefined construction shows its last good shape, dashed at 30 % [C11b]
    if (A.dragging()) drawGhosts(pane, side, ctx);
    // a construction tool's picks and its dashed preview through the pointer
    if (draftC && draftC.side === side) drawPreview(pane, side, ctx, TH);
    // the selected shape's bound handles: small rings (a bound handle has no square)
    const sel = A.selected() && find(A.selected());
    // [review user-9] a selected construction shows what it is built from: a ring on each defining point, its curves
    // drawn wide and faint (so "drag those" is visible, on touch too)
    if (sel && (sel.def || sel.at) && (side === 'R') === isT(sel) && !A.dragging()) drawSources(pane, side, ctx, sel, TH);
    if (sel && sel.at && (side === 'R') === isT(sel)) {
      ctx.save();
      for (const [k, hz] of Region.handlesOf(sel)) {
        if (!sel.at[k]) continue;
        const [hx, hy] = pane.w2s(hz);
        ctx.lineWidth = 1.25; ctx.strokeStyle = A.shapeInk(sel).edge;
        ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
    // [v16.5 rail SPEC 4.1] a point sliding on its curve: the rail wide and faint; pulled off it: the stretch line and the
    // ghost dot at the pointer
    if (rail && rail.side === side) drawRail(pane, ctx, TH);
    if (freeChip && freeChip.side === side) {
      const p = find(freeChip.id), at = freeChip.Z || (p && isXY(p.p) ? p.p : null);
      // (one chip row higher when the ring's chip shows too: the freed point dragged over a curve or a lattice point says
      // both, "z₂ is free" above "on the real axis")
      const dy = ring && ring.side === side && !ring.held && ring.chip ? 26 : 0;
      if (at && performance.now() < freeChip.until) { const [fx, fy] = pane.w2sxy(at[0], at[1]); ctx.save(); drawChip(pane, ctx, TH, fx, fy - dy, 11, freeChip.text, touchNow(), false); ctx.restore(); }
    }
    if (!ring || ring.side !== side || ring.held) return;
    const [x, y] = pane.w2sxy(ring.z[0], ring.z[1]);
    ctx.save();
    // [review picture-5] the ring sits outside every point mark (a dot reaches 5 px, a ring mark 6.25 px, the selection
    // ring 8 px): r = 11 (13 on touch) with its halo and a faint accent fill, so a snap reads at a glance; ([v16.5 rail])
    // a grid catch is lighter: r = 7, no fill; a point sliding on its rail has its chip only
    const grid = ring.cls === 'grid', bare = ring.cls === 'rail';
    const rr = grid ? 7 : ring.touch ? 13 : 11, acc = ring.warn ? TH.warn : TH.accent;
    if (!bare && !grid) { ctx.globalAlpha = 0.14; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (!bare) {
      ctx.lineWidth = grid ? 3 : 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
      ctx.lineWidth = grid ? 1.25 : 1.75; ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    }
    if (ring.chip) drawChip(pane, ctx, TH, x, y, bare ? 11 : rr, ring.chip, ring.touch, ring.warn);
    ctx.restore();
  }
  // the chip [review user-10, picture-6]: above and to the LEFT of the target (a point's label is placed below or to
  // its right first), 12 px clear of the ring, on whole pixels, inside the pane on all four sides; a finger: 48 px up
  function drawChip(pane, ctx, TH, x, y, rr, text, touch, warn) {
    ctx.font = `500 12px ${TH.ui}`;
    const w = Math.ceil(ctx.measureText(text).width) + 14, hgt = 22;
    let cx = x - rr - 6 - w, cy = touch ? y - 48 - hgt / 2 : y - rr - 6 - hgt;
    if (cx < 4) cx = x + rr + 6;
    if (cy < 4) cy = y + rr + 6;
    cx = Math.round(Math.max(4, Math.min(pane.w - 4 - w, cx)));
    cy = Math.round(Math.max(4, Math.min(pane.h - 4 - hgt, cy)));
    ctx.fillStyle = TH.surface; ctx.strokeStyle = TH.line; ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx + 0.5, cy + 0.5, w, hgt, 6); else ctx.rect(cx + 0.5, cy + 0.5, w, hgt);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = warn ? TH.warn : TH.ink; ctx.textBaseline = 'middle';
    ctx.fillText(text, cx + 7, cy + hgt / 2 + 1);
    lastChip = { text, x: cx, y: cy, w, h: hgt, at: [x, y], pw: pane.w, ph: pane.h };
  }
  let lastChip = null;
  // [v16.5 rail SPEC 4.1] the rail 6 px wide at 25 % of its curve's ink; the stretch line dashed 4/3, 1.5 px, accent, its
  // opacity from 0.35 to 1 as the pull nears the let-go; a hollow ghost dot (r = 4) at the pointer
  function drawRail(pane, ctx, TH) {
    ctx.save();
    if (rail.pc && rail.ink) { ctx.strokeStyle = rail.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 6; ctx.setLineDash([]); strokePiece(pane, ctx, rail.pc); ctx.globalAlpha = 1; }
    const st = rail.stretch;
    if (st && isXY(st.a) && isXY(st.b)) {
      const [ax, ay] = pane.w2sxy(st.a[0], st.a[1]), [bx, by] = pane.w2sxy(st.b[0], st.b[1]);
      ctx.globalAlpha = st.k; ctx.strokeStyle = TH.accent; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1.25; ctx.beginPath(); ctx.arc(bx, by, 4, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  // the defining points (rings) and curves (wide, faint) of a selected construction [user-9]
  function drawSources(pane, side, ctx, sel, TH) {
    const plane = side === 'R' ? 1 : 0;
    const refs = sel.def ? sel.def.args : Object.values(sel.at || {});
    ctx.save();
    for (const r of refs) {
      if (!r || r.inf) continue;
      if (r.part != null) {
        const c = find(r.s), pc = c && piecesOf(c)[r.part];
        if (pc && pc.kind !== 'none') { ctx.strokeStyle = TH.accent; ctx.globalAlpha = 0.3; ctx.lineWidth = 6; ctx.setLineDash([]); strokePiece(pane, ctx, pc); ctx.globalAlpha = 1; }
        continue;
      }
      let z = null;
      try { const res = Constr.resolve(S(), r, plane, env()); z = res && res.z; } catch (e) { z = null; }
      if (!isXY(z)) continue;
      const [x, y] = pane.w2sxy(z[0], z[1]);
      if (x < -20 || y < -20 || x > pane.w + 20 || y > pane.h + 20) continue;
      ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = TH.accent; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  function drawGhosts(pane, side, ctx) {
    const list = side === 'R' ? S().targets : S().shapes;
    const box = pane.box();
    for (const s of list) {
      if (!s.cundef || !s.cHid) continue;
      ctx.save();
      ctx.globalAlpha = 0.3; ctx.strokeStyle = A.shapeInk(s).edge; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      if (s.kind === 'point') { if (isXY(s.p)) { const [x, y] = pane.w2sxy(s.p[0], s.p[1]); ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.stroke(); } }
      else {
        let cs = [];
        try { cs = Region.curvesOf(s, box); } catch (e) { cs = []; }
        ctx.beginPath();
        for (const c of cs) {
          const n = Math.max(48, Math.min(400, c.n0 || 64));
          for (let i = 0; i <= n; i++) { const z = c.f(i / n); if (!z || !Number.isFinite(z.re)) continue; const [x, y] = pane.w2s(z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawPreview(pane, side, ctx, TH) {
    const d = draftC;
    // [review picture-3] the colour the new shape will take, for its stroke and its fill alike
    // (a perpendicular or touching circle on a display curve: that curve becomes the next shape, and K the one after it)
    const k = CURVE1.has(d.tool) && d.curve1 && d.curve1.make ? 1 : 0;
    const ink = A.shapeInk({ ci: A.nextCi ? A.nextCi(side === 'R', k) : ((side === 'R' ? S().targets.length : S().shapes.length) + k) % 8 });
    const color = ink.edge;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    const P = d.picks.map((p) => p.z);
    // the perpendicular or touching circle's curve, 4 px wide at 35 % (as Intersect's first curve), under its picks
    const ppc = CURVE1.has(d.tool) && curve1Ok() ? curve1Piece(d.curve1) : null;
    if (ppc) { ctx.lineWidth = 4; ctx.globalAlpha = 0.35; strokePiece(pane, ctx, ppc); ctx.globalAlpha = 1; ctx.lineWidth = 1.5; }
    // [v16.3 review user-3] the touching circle's marks in dark mode: the accent (the new shape's colour is too dim on
    // the picked curve's glow), and a halo of the plane's colour under each pick
    const mark = d.tool === 'touch' && TH.dark ? TH.accent : color;
    for (const p of d.picks) {
      const [x, y] = pane.w2sxy(p.z[0], p.z[1]);
      if (d.tool === 'touch') { ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = color; }
      ctx.fillStyle = mark; ctx.beginPath(); ctx.arc(x, y, d.tool === 'touch' ? 4 : 3.5, 0, TAU); ctx.fill();
    }
    // a finger hides what it picked, so each pick wears a ring and its number (UX50)
    if (touchNow()) {
      ctx.font = `600 11px ${TH.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      d.picks.forEach((p, i) => {
        const [x, y] = pane.w2sxy(p.z[0], p.z[1]);
        ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = mark; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.strokeText(String(i + 1), x + 13, y - 13);
        ctx.fillStyle = mark; ctx.fillText(String(i + 1), x + 13, y - 13);
      });
    }
    if (d.tool === 'meet' && d.curve1) {
      const s = find(d.curve1.ref.s), pc = s && piecesOf(s)[d.curve1.ref.part];
      if (pc) { ctx.lineWidth = 4; ctx.globalAlpha = 0.35; strokePiece(pane, ctx, pc); ctx.globalAlpha = 1; }
    }
    const hv = d.hover;
    ctx.setLineDash([4, 3]);
    if (d.tool === 'touch') { if (ppc && ppc.G) drawTouch(pane, ctx, d, ppc, hv, TH, mark); }
    else if (ppc && ppc.G && hv && P.length === 1 && isXY(P[0])) {
      // K through P and the pointer (nothing while it is undefined: the pointer at P, or at P's mirror image)
      let r = null;
      try { r = Constr.perpForm(ppc.G, P[0], hv, ppc); } catch (e) { r = null; }   // (the piece: the decimal rules, as the made K [v16.3 review math-3, math-4])
      if (r && r.G) {
        // [v16.4 segments] Inside: the arc the click will make, from the same sampler
        const q = effSeg(d.tool) === 'in' || effSeg(d.tool) === 'between' ? previewSeg(d, ppc, r.G, P[0], hv) : null;
        if (q) strokeSeg(pane, ctx, q); else if (effSeg(d.tool) !== 'in' && effSeg(d.tool) !== 'between') strokeForm(pane, ctx, r.G);
      }
    } else if (hv && d.tool === 'circle3' && P.length === 2) {
      let G = null;
      try { G = Constr.circle3(P[0], P[1], hv); } catch (e) { G = null; }
      if (G) {
        // the form the click will make (CORE's creation rule, SPEC 2.3): the disc, or the half-plane left of P -> Q
        const g0 = Constr.geomOf(G);
        if (G.A < 0 || (G.A === 0 && g0.d[0] * (P[1][0] - P[0][0]) + g0.d[1] * (P[1][1] - P[0][1]) < 0)) G = { o: G.o, A: -G.A, B: [-G.B[0], -G.B[1]], C: -G.C };
        const g = Constr.geomOf(G), fill = fillMode === 'in';
        const big = 4 * Math.hypot(pane.w, pane.h) / pane.view.s;
        if (g.line) {
          const L = clipLine(pane, g.p, g.d);
          if (fill) {
            // the region: the side of the line where the form is negative (against B), as a clipped polygon
            const c0 = pane.s2w(pane.w / 2, pane.h / 2), dl = Math.hypot(g.d[0], g.d[1]), u = [g.d[0] / dl, g.d[1] / dl], bl = Math.hypot(G.B[0], G.B[1]), nI = [-G.B[0] / bl, -G.B[1] / bl];
            const t0 = (c0.re - g.p[0]) * u[0] + (c0.im - g.p[1]) * u[1], q = (t) => [g.p[0] + (t0 + t) * u[0], g.p[1] + (t0 + t) * u[1]];
            const a = q(-big), b = q(big), corners = [a, b, [b[0] + big * nI[0], b[1] + big * nI[1]], [a[0] + big * nI[0], a[1] + big * nI[1]]];
            ctx.beginPath(); corners.forEach((z, i) => { const [x, y] = pane.w2sxy(z[0], z[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath();
            ctx.globalAlpha = 0.18; ctx.fillStyle = ink.c0; ctx.fill(); ctx.globalAlpha = 1;
          }
          if (L) { ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); ctx.stroke(); }
        } else {
          const [cx, cy] = pane.w2sxy(g.c[0], g.c[1]), r = g.r * pane.view.s;
          if (r < 1e6) {
            if (fill) {
              ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
              if (G.A < 0) ctx.rect(-pane.w, -pane.h, 3 * pane.w, 3 * pane.h);    // (the outside: even-odd with the pane)
              ctx.globalAlpha = 0.18; ctx.fillStyle = ink.c0; ctx.fill('evenodd'); ctx.globalAlpha = 1;
            }
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
          }
        }
      }
    } else if (hv && P.length === 1 && (d.tool === 'circle3' || d.tool === 'midpoint' || d.tool === 'bisector')) {
      const [x0, y0] = pane.w2sxy(P[0][0], P[0][1]), [x1, y1] = pane.w2sxy(hv[0], hv[1]);
      ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.globalAlpha = 1;
      if (d.tool === 'midpoint') { ctx.setLineDash([]); ctx.beginPath(); ctx.arc((x0 + x1) / 2, (y0 + y1) / 2, 4, 0, TAU); ctx.stroke(); }
      if (d.tool === 'bisector' && (x0 !== x1 || y0 !== y1)) {
        const m = [(P[0][0] + hv[0]) / 2, (P[0][1] + hv[1]) / 2], dd = [-(hv[1] - P[0][1]), hv[0] - P[0][0]];
        const L = clipLine(pane, m, dd);
        if (L) { ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
  // the touching circle's preview (dashed, in the new shape's colour; drawn with no pointer too, since touch has no
  // hover): after T, the tangent at T thin at 50 %; after P, the tangents from P and their rings (hollow, 5 px). K
  // through the pointer (after P: touching C at the pointer's nearest point on C); a snapped hint or ring at full
  // strength instead. Nothing where K is undefined
  // [v16.3 review user-3] the hint and the rings: in dark mode in the accent at full strength; each ring 2 px wide on a
  // halo of the plane's colour (it shows over the picked curve's glow), 6 px (8 px on touch)
  function drawTouch(pane, ctx, d, pc, hv, TH, mark) {
    const P0 = d.picks[0], ht = d.hoverT || null;
    if (!P0 || !isXY(P0.z)) return;
    const dark = !!TH.dark;
    const line = (G, full) => { ctx.save(); ctx.strokeStyle = mark; ctx.lineWidth = full || dark ? 1.5 : 1; ctx.globalAlpha = full || dark ? 1 : 0.5; strokeForm(pane, ctx, G); ctx.restore(); };
    let K = null;
    if (P0.role === 'T') {
      const H = hintForm(P0.z), snapped = !!ht && ht.cls === 'hint';
      if (H) line(H, snapped);
      if (hv && !snapped) { try { const r = Constr.touchForm(pc.G, P0.z, hv); K = r && r.G; } catch (e) { K = null; } }
    } else {
      const snapped = !!ht && ht.cls === 'ring';
      const rr = touchNow() || chipTouch() ? 8 : 6;
      for (const r of ringsLeft(P0.z)) {
        const full = snapped && ht.k === r.k;
        line(r.G, full);
        const [x, y] = pane.w2sxy(r.tp[0], r.tp[1]);
        ctx.save(); ctx.setLineDash([]);
        ctx.lineWidth = 4; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = mark; ctx.globalAlpha = full || dark ? 1 : 0.6; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke(); ctx.restore();
      }
      if (hv && !snapped) {
        let T = ht && ht.role === 'T' ? ht.z : null;
        if (!T) { try { const pr = Constr.projectPiece(pc, hv, pc.c3 && d.curve1.ref ? pts3Of(find(d.curve1.ref.s), d.side === 'R' ? 1 : 0) : null); T = pr && isXY(pr.z) ? pr.z : null; } catch (e) { T = null; } }
        if (T) { try { const r = Constr.touchForm(pc.G, T, P0.z); K = r && r.G; } catch (e) { K = null; } }
      }
    }
    if (K) strokeForm(pane, ctx, K);
  }
  // a generalized circle, exact at any radius: a line clipped to the pane; a circle by ctx.arc below 1e6 px; beyond, its
  // M(R) samples (Constr.sampleMR), broken where they leave a margin around the pane (no huge canvas coordinates)
  function strokeForm(pane, ctx, G) {
    const g = Constr.geomOf(G);
    ctx.beginPath();
    if (g.line) { const L = clipLine(pane, g.p, g.d); if (L) { ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); } }
    else if (g.r * pane.view.s < 1e6) { const [cx, cy] = pane.w2sxy(g.c[0], g.c[1]); ctx.arc(cx, cy, g.r * pane.view.s, 0, TAU); }
    else {
      const pts = Constr.sampleMR(G, pane.box(), 2 / pane.view.s), m = 4 * Math.hypot(pane.w, pane.h);
      let on = false;
      for (let i = 0; i < pts.length; i += 2) {
        const [x, y] = pane.w2sxy(pts[i], pts[i + 1]);
        if (!(x > -m && x < pane.w + m && y > -m && y < pane.h + m)) { on = false; continue; }
        if (on) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        on = true;
      }
    }
    ctx.stroke();
  }
  // [v16.4 segments] the arc of a perpendicular circle (Constr.segCurves' samples, cut where they leave a margin around
  // the pane), and the draft's: K through P and the pointer on the side the chip's Inside chooses
  function strokeSeg(pane, ctx, q) {
    const box = pane.box(), step = 2 / pane.view.s, m = 4 * Math.hypot(pane.w, pane.h);
    ctx.beginPath();
    for (const c of Region.segCurvesOf(q, box)) {
      const pts = c.gsamp ? c.gsamp(box, step) : Region.sampleCurve(c, box);   // (a circle's arc: by its angle; a line's: the chord or long rays)
      let on = false;
      for (let i = 0; i < pts.length; i += 2) {
        const [x, y] = pane.w2sxy(pts[i], pts[i + 1]);
        if (!(x > -m && x < pane.w + m && y > -m && y < pane.h + m)) { on = false; continue; }
        if (on) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        on = true;
      }
    }
    ctx.stroke();
  }
  function previewSeg(d, pc, G, P, Q) {
    try {
      const C = d.curve1.ref ? find(d.curve1.ref.s) : d.curve1.make, Gc = Constr.gcOf(C, pc);
      // ([issue #70] Between: the segment from P to Q, as drawn; undefined across C, so the preview shows the whole circle then)
      const q = !Gc ? null : effSeg(d.tool) === 'between' ? Constr.betweenOf(G, pc.G, P, Q, false) : Constr.segOf(G, pc.G, Gc, Constr.segSideOf(C, pc, P, Q), P, Q, false);
      return q && !q.undef ? q : null;
    } catch (e) { return null; }
  }
  function clipLine(pane, p, d) {
    const L = Math.hypot(d[0], d[1]);
    if (!(L > 0)) return null;
    const u = [d[0] / L, d[1] / L], R = 2 * Math.hypot(pane.w, pane.h) / pane.view.s;
    const c = pane.s2w(pane.w / 2, pane.h / 2), t0 = (c.re - p[0]) * u[0] + (c.im - p[1]) * u[1];
    const a = pane.w2sxy(p[0] + (t0 - R) * u[0], p[1] + (t0 - R) * u[1]), b = pane.w2sxy(p[0] + (t0 + R) * u[0], p[1] + (t0 + R) * u[1]);
    return [a[0], a[1], b[0], b[1]];
  }
  function strokePiece(pane, ctx, pc) {
    if (pc.seg) { strokeSeg(pane, ctx, pc.seg); return; }
    ctx.beginPath();
    if (pc.kind === 'line') {
      const lo = Number.isFinite(pc.lo) ? pc.lo : -1e3, hi = Number.isFinite(pc.hi) ? pc.hi : 1e3;
      if (!Number.isFinite(pc.lo) || !Number.isFinite(pc.hi)) { const L = clipLine(pane, pc.a, [pc.b[0] - pc.a[0], pc.b[1] - pc.a[1]]); if (L) { ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); } }
      else { const a = pane.w2sxy(pc.a[0] + lo * (pc.b[0] - pc.a[0]), pc.a[1] + lo * (pc.b[1] - pc.a[1])), b = pane.w2sxy(pc.a[0] + hi * (pc.b[0] - pc.a[0]), pc.a[1] + hi * (pc.b[1] - pc.a[1])); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    } else if (pc.kind === 'circle') {
      const [cx, cy] = pane.w2sxy(pc.c[0], pc.c[1]);
      ctx.arc(cx, cy, pc.r * pane.view.s, -pc.a0, -(pc.a0 + pc.span), true);
    } else (pc.pts || []).forEach((p, i) => { const q = pane.w2sxy(p[0], p[1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.stroke();
  }

  // ---------------------------------------------------------------- hover (no button): the ring before the press
  function hover(pane, side, x, y, e) {
    if (e) { lastEv = e; lastEvAt = performance.now(); }
    const tool = A.tool();
    if (isCTool(tool) && hoverSide !== side && !draftC) { hoverSide = side; A.requestRender('OL', 'OR'); }
    if (tool === 'select' || tool === 'formula' || tool === 'curve' || tool === 'lasso' || tool === 'cgrid' || tool === 'pgrid') { if (ring) setRing(null, null); return; }
    if ((side === 'L' && (A.leftStage() > 0 || !A.lFlat())) || (side === 'R' && !A.targetsEditable())) { if (ring) setRing(null, null); return; }
    const cl = classesFor(tool, 'draw');
    let t = cl ? snapAt(side, x, y, cl) : null;
    if (isCTool(tool)) {
      if (!draftC || draftC.side !== side) draftC = draftC && (draftC.picks.length || (CURVE1.has(draftC.tool) && draftC.curve1)) ? draftC : { tool, side, picks: [], curve1: null, hover: null };
      // (the perpendicular or touching circle before its curve: the ring on an exact curve or a display curve, "on the
      // unit circle")
      if (CURVE1.has(tool) && !curve1Ok()) t = cl ? perpCurveAt(side, x, y) : null;
      const pane2 = A.setView(side);
      const z0 = pane2.s2w(x, y);
      // (the touching circle after its curve: the target a click takes, the tangent hint and the rings among them; a
      // refused target shows its toast as the chip)
      if (tool === 'touch' && curve1Ok()) {
        // (the other plane: a click there starts a new draft, so its ring is a curve's; no preview in the draft's plane)
        if (draftC.side !== side) { draftC.hover = null; draftC.hoverT = null; A.requestRender('OL', 'OR'); setRing(side, cl ? perpCurveAt(side, x, y) : null); return; }
        const r = cl ? touchTargetC(side, x, y) : null, tt = r && r.t && r.t.cls !== 'free' ? r.t : null;
        draftC.hover = r && r.restart ? null : tt && !r.warn ? tt.z.slice() : [z0.re, z0.im];
        draftC.hoverT = r && !r.warn && !r.restart ? r.t : null;
        A.requestRender('OL', 'OR');
        if (tt && r.warn) { setRing(side, tt, r.warn); return; }
        if (tt && tt.ref && tt.ref.img && !A.yWhole()) { setRing(side, tt, $t('Draw in X to use {x}', { x: pointName(find(tt.ref.img)) })); return; }
        setRing(side, tt);
        return;
      }
      draftC.hover = t ? t.z.slice() : [z0.re, z0.im];
      // ([v16.5 fix rail-7] one message: once the press was refused the chip says it, and the ring by the pointer only warns)
      if (dupPick(t)) { const w = $t('{x} needs distinct points', { x: warnTool(tool) }); setRing(side, t, pickWarnMsg === w ? true : w); return; }
      if (t && tool === 'meet' && t.cls === 'point') t = snapAt(side, x, y, { points: false, cross: true, curves: true });
      if (t && tool === 'meet' && t.cls === 'curve' && !t.ref) t = null;   // ([v16.5 rail] Intersect takes a display curve's crossings, not the curve)
      if (t && t.ref && t.ref.img && !A.yWhole()) { setRing(side, t, $t('Draw in X to use {x}', { x: pointName(find(t.ref.img)) })); return; }
      A.requestRender('OL', 'OR');
    }
    setRing(side, t);
  }
  function pointer(e) { lastEv = e; lastEvAt = performance.now(); }
  // the pointer left a plane: no hover preview and no ring there [review picture-3]
  function leave(side) {
    let ch = false;
    if (draftC && draftC.side === side && draftC.hover) { draftC.hover = null; draftC.hoverT = null; ch = true; }
    if (ring && ring.side === side) { ring = null; ch = true; }
    if (ch) A.requestRender('OL', 'OR');
  }

