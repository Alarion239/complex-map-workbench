'use strict';
// The Inspector (notes/ui-redesign-2/desktop/DESIGN.md 2.4, 2.6): the right panel edits the one selected object.
// Selection: a step (its full formula, 32 px fields with indexed coefficients, the zeros and poles with Add zero and
// Add pole), F (the expanded formula, the lit guarantees, the natural domain, the step table folded) or the region.
// Parameters: the slot of the shared numbers (Params.mount(el), when the shared-numbers build is present).
// app.js owns the state; it hands this module what it needs as the object A (Inspector.create(A)).
const Inspector = (() => {
  // the step-type icons (14 px, the view-switch glyph weight)
  const sv = (inner, sw = 1.3) => `<svg class="ic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const ICON = {
    region: sv('<path d="M2 5.5h12M2 10.5h12"/><path d="M4 5.5v5M8 5.5v5M12 5.5v5" stroke-opacity=".45"/>'),
    exp: sv('<path d="M2 13.5c5 0 8-2.5 10.5-11"/><path d="M2 13.5h12" stroke-opacity=".45"/>'),
    log: sv('<path d="M3 14c.4-5 2-9 11-11.5"/><path d="M3 2v12" stroke-opacity=".45"/>'),
    mobius: sv('<circle cx="8" cy="8" r="5.5"/><path d="M2.6 9.6c3-1.8 7.6-1.8 10.8 0"/><path d="M8 2.5v11" stroke-opacity=".45"/>'),
    zp: sv('<circle cx="4.6" cy="8" r="2.2" fill="currentColor" stroke="none"/><path d="M9.6 5.6l4.8 4.8M14.4 5.6l-4.8 4.8"/>', 1.4),
    linear: sv('<path d="M2.5 12.5l11-9"/><path d="M2.5 12.5h11" stroke-opacity=".45"/>'),
    power: sv('<path d="M2.5 3c2 7 4 10.5 5.5 10.5S11.5 10 13.5 3"/>'),
    root: sv('<path d="M2 9l2-1 2.5 5L10 2.5h4"/>'),
    trig: sv('<path d="M1.5 8c1.6-5 3.6-5 5.2 0s3.6 5 5.2 0 1.6-2.5 2.6-2.5"/>'),
    special: sv('<path d="M2 8c2-4.5 10-4.5 12 0M2 8c2 4.5 10 4.5 12 0" stroke-opacity=".45"/><path d="M4 8h8"/>'),
    poly: sv('<path d="M2 12.5c1.5-9 3.5-9 5 0s3.5 9 7-9"/>'),
    custom: sv('<path d="M10.5 2.5c-2 0-2.5 1-3 4l-1 6c-.4 2-1 2.5-2.5 2.5M5 7h6"/>'),
    deriv: sv('<path d="M2.5 13.5c3 0 5-2 6-6s2.5-5 5-5"/><path d="M5 10.5l6-6" stroke-opacity=".45"/>'),
  };
  const FAMILY = { exp: 'exp', log: 'log', mobius: 'mobius', blaschke: 'mobius', recip: 'mobius', zp: 'zp', mul: 'linear', add: 'linear', affine: 'linear',
    pown: 'power', powa: 'power', root: 'root', joukowski: 'special', ijouk: 'special', conj: 'special', dh: 'special', bottcher: 'special', poly: 'poly', rational: 'poly', custom: 'custom', deriv: 'deriv' };
  const typeIcon = (type) => ICON[FAMILY[type] || (/^a?(sin|cos|tan|sinh|cosh|tanh|sec|csc|cot)h?$/.test(type) ? 'trig' : 'custom')];
  const regionIcon = () => ICON.region;
  // icons of the head buttons (16 px)
  const s16 = (inner, fill) => `<svg class="ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  // (v16.5 UX85: Show alone is one card inside a focus frame, never a magnifier, which reads as zoom or search)
  const LENS = s16('<rect x="5.25" y="4.75" width="5.5" height="6.5" rx="1"/><path d="M2 5V3.25C2 2.56 2.56 2 3.25 2H5M11 2h1.75C13.44 2 14 2.56 14 3.25V5M14 11v1.75c0 .69-.56 1.25-1.25 1.25H11M5 14H3.25C2.56 14 2 13.44 2 12.75V11"/>');
  // the specificity order of the lit names on the F tile (the strongest first)
  const STRONG = ['mobius', 'polynomial', 'rational', 'conformal', 'entire', 'homeo', 'proper', 'analytic'];
  // types whose catalog formula, with the coefficients indexed, reads as the generic form of the step
  const GENERIC = new Set(['mul', 'add', 'affine', 'mobius']);
  // a formula this long (TeX characters) is not typeset in a well or a row: unreadable at any size that fits, and
  // MathJax takes a second or more for it; the well says so and the rows name it, as F's expanded formula does
  const LONG = 700;
  // a step's formula as the Inspector shows it: its display form when it has one (Funcs.build: params.show), else its
  // formula; tex the same for a TeX argument a = {s, p}
  const shownTex = (b, a) => (b.show || b.tex)(a);

  function create(A) {
    const { h, $t, $tx, $tn, ICONS, TeX, sub, fsub } = A;
    const cur = { sig: null, el: null, tempKey: null };
    let host = null, tbar = null, selSec = null, parSec = null, mounted = false, pmount = null;
    function skeleton() {
      host = A.host();
      if (!host) return false;
      if (selSec && host.contains(selSec)) return true;
      host.innerHTML = '';
      const close = h('button', { class: 'icon-btn', 'aria-label': $t('Close the editor'), 'data-tip': $t('Close  Esc'), html: ICONS.close, onclick: () => A.closeTemp() });
      tbar = h('div', { class: 'tbar' }, h('span', null, $t('Inspector')), h('span', { class: 'grow' }), h('span', { class: 'kbd' }, 'Esc'), close);
      // (review design-21: a named region a screen reader can jump to; the temporary one is a dialog of the same name)
      if (!host.classList.contains('temp')) { host.setAttribute('role', 'region'); host.setAttribute('aria-label', $t('Inspector')); }
      selSec = h('section', { class: 'psec insp-sel', 'aria-label': $t('Selection') });
      // (the shared numbers bring their own section: its heading, + and label; the slot only places it)
      parSec = h('div', { class: 'insp-params' }, h('div', { class: 'params-mount' }));
      host.append(tbar, selSec, parSec);
      cur.sig = null; mounted = false;
      return true;
    }
    // the Parameters slot: the shared numbers (src/params.js) mount themselves here; without them the slot hides
    function mountParams() {
      const el = parSec.querySelector('.params-mount');
      const has = typeof Params.mount === 'function';
      parSec.hidden = !has;
      // (review regress-7: a rebuilt panel destroys its old mount before it mounts again)
      if (has && !mounted) { mounted = true; try { if (pmount && pmount.destroy) pmount.destroy(); pmount = Params.mount(el); } catch (e) { console.error('Params.mount', e); } }
    }
    // indexed coefficient labels: a step's own coefficients carry its index (a₂, b₂); the special symbols keep theirs
    const SPECIAL = new Set(['cut', 'k', 'branch', 'co', 'p', 'q', 'expr']);
    function indexLabels(el, k) {
      for (const lab of el.querySelectorAll('label.pl:not(.zp-sym)')) {
        const inp = el.querySelector('#' + CSS.escape(lab.htmlFor || ''));
        const key = inp && inp.dataset.pkey;
        const sym = lab.querySelector('.ps') || lab;   // (v16.5 UX33: "Factor a₃", the word and its symbol)
        const t = sym.textContent;
        if (!key || SPECIAL.has(key) || [...t].length !== 1 || lab.dataset.ix || (sym === lab && lab.classList.contains('worded'))) continue;
        lab.dataset.ix = '1';
        sym.innerHTML = '';
        sym.append(t, h('sub', null, String(k)));
        // (review design-8: the Argand button names the indexed coefficient, a₃, never the plain a of a shared number)
        const ab = lab.parentNode && lab.parentNode.querySelector('.argand');
        if (ab) ab.setAttribute('aria-label', $t('Pick {label} on an Argand diagram', { label: t + sub(k) }));
      }
    }
    // the zeros-and-poles hint by input: a long press on touch, a right-click with a mouse (review design-9; issue #13:
    // the planes' menu acts on a mark, it adds none)
    const touchUI = () => document.documentElement.classList.contains('ph') || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    // a formula wider than its well: the same formula smaller, down to 70 % (review design-4); true when it fits
    function fitTex(node, minScale = 0.7) {
      node.style.fontSize = '';
      const form = node.closest('.iform');
      if (!form || !form.clientWidth || node.hidden) return true;
      const cs = getComputedStyle(form);
      const avail = form.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      // (an inline node, a line of the F list, has no scrollWidth: its box's width)
      const wOf = () => node.scrollWidth || node.getBoundingClientRect().width;
      const w = wOf();
      if (w <= avail + 0.5) return true;
      if (minScale >= 1) return false;
      // (the width does not scale exactly with the size: the glyphs' advances and the math's spacing round, and by a pixel or two
      // with a face whose x-height differs; so the scale is corrected up to twice from the width it gave)
      let f = Math.max(minScale, Math.floor((avail / w) * 100) / 100);
      node.style.fontSize = Math.round(f * 100) + '%';
      for (let i = 0; i < 2 && wOf() > avail + 0.5 && f > minScale; i++) {
        f = Math.max(minScale, Math.floor(f * (avail / wOf()) * 100) / 100 - 0.01);
        node.style.fontSize = Math.round(f * 100) + '%';
      }
      return wOf() <= avail + 0.5;
    }
    // a formula in its well: the full form when it fits, else the alternative (alt), then smaller; decided once per
    // formula (a drag holds its formula, so drag frames never force a layout here). 1: the alternative is shown.
    //
    // (#455) the choice needs the well's width: in a well that has none (the Inspector built while a phone's sheet is
    // closed) nothing is decided, and the well is watched: when its width changes (the sheet opens, the phone turns)
    // each formula in it is decided again, here, from the arguments it was last given
    const pickArgs = new WeakMap(), pickForms = new WeakMap();
    const pickRO = typeof ResizeObserver === 'function' ? new ResizeObserver((entries) => {
      for (const { target: form } of entries) {
        const st = pickForms.get(form), w = form.clientWidth;
        if (!form.isConnected) { pickRO.unobserve(form); pickForms.delete(form); continue; }   // (a well the Inspector dropped)
        if (!st || w === st.w) continue;
        st.w = w;
        if (!w) continue;
        for (const node of [...st.nodes]) {
          const a = pickArgs.get(node);
          if (!a || !node.isConnected || !form.contains(node)) { st.nodes.delete(node); continue; }
          delete node.dataset.pick;
          fitPick(node, a.full, a.alt, a.display);
        }
      }
    }) : null;
    function fitPick(node, full, alt, display = true) {
      const form = node.closest('.iform');
      if (form && pickRO) {
        pickArgs.set(node, { full, alt, display });
        let st = pickForms.get(form);
        if (!st) { st = { w: form.clientWidth, nodes: new Set() }; pickForms.set(form, st); pickRO.observe(form); }
        st.nodes.add(node);
      }
      if (node.dataset.pick === full) { TeX.set(node, node.dataset.use === '1' ? alt : full, display); return node.dataset.use === '1' ? 1 : 0; }
      TeX.set(node, full, display);
      if (node.dataset.tex !== full || !TeX.ready) return 0;   // (held while input continues, or MathJax not yet loaded: decided when it is shown)
      if (form && pickRO && !form.clientWidth) return 0;   // (no width yet: decided when it has one)
      node.dataset.pick = full;
      let use = 0;
      if (alt && !fitTex(node, 1)) { use = 1; TeX.set(node, alt, display); }
      node.dataset.use = String(use);
      fitTex(node);
      return use;
    }
    // TeX with \text{…} runs: the words in the interface's type, the math between them typeset (review russian-11)
    function mixedTex(el, tex) {
      if (el.dataset.mix === tex) return;
      el.dataset.mix = tex;
      el.innerHTML = '';
      const parts = String(tex).split(/\\text\{([^{}]*)\}/);
      parts.forEach((p, i) => {
        if (i % 2) { el.append(h('span', { class: 'itxt' }, p)); return; }
        const m = p.replace(/^\s*(\\ )?\s*|\s*(\\ )?\s*$/g, '');
        if (!m) return;
        const sp = h('span');
        el.append(i ? ' ' : '', sp, i + 1 < parts.length ? ' ' : '');
        TeX.set(sp, m);
      });
    }
    // the generic form w_k = (a_k w_{k-1} + b_k)/(c_k w_{k-1} + d_k) for the few types where it says more than the values
    function genericTex(st, k) {
      if (!GENERIC.has(st.type)) return '';
      const d = A.defOf(st), letters = new Set((d.params || []).map((q) => q.key).filter((x) => /^[a-y]$/.test(x)));
      const wv = A.wvar(k - 1);
      const tex = String(d.menuTex || '');
      if (!tex) return '';
      return tex.replace(/\\[a-zA-Z]+|[a-zA-Z]/g, (m) => (m.length > 1 ? m : m === 'z' ? wv : letters.has(m) ? `${m}_{${k}}` : m));
    }
    function cxv(s) { try { return A.Expr.constValue(String(s)); } catch (e) { return null; } }
    // ---- a step ----
    function buildStep(k) {
      const S = A.S(), st = S.steps[k - 1], d = A.defOf(st), b = A.built()[k - 1];
      const deriv = A.isDerivStep(st, b);
      const lens = h('button', { class: 'icon-btn alone-btn', 'aria-pressed': 'false', html: LENS, onclick: () => A.toggleAlone(k) });
      lens.append(h('span', { class: 'ab-l' }));   // (v16.5 UX85: "Show alone" / "Show F" in words where there is no hover)
      // (v16.5 UX81: ← → move the step one place, in a phone's editor sheet; the laptop has Alt+← / Alt+→ on the card)
      const n = S.steps.length;
      const mvL = h('button', { class: 'icon-btn mv-btn', 'data-tip': $t('Move left'), 'aria-label': $t('Move f{x} left', { x: sub(k) }), disabled: k <= 1 || null, onclick: () => A.moveStep(k, -1) }, '←');
      const mvR = h('button', { class: 'icon-btn mv-btn', 'data-tip': $t('Move right'), 'aria-label': $t('Move f{x} right', { x: sub(k) }), disabled: k >= n || null, onclick: () => A.moveStep(k, 1) }, '→');
      const inv = h('button', { class: 'icon-btn txt', 'data-tip': $t('Replace with the inverse'), 'aria-label': $t('Replace with the inverse function'), html: '<i>f</i><sup>−1</sup>', onclick: () => A.inverseAction(k) });
      if (deriv) inv.hidden = true;
      const byp = h('button', { class: 'icon-btn bypass', html: ICONS.bypass, onclick: () => A.toggleBypass(k) });
      const more = h('button', { class: 'icon-btn more', 'aria-haspopup': 'menu', 'data-tip': $t('Inverse, bypass, move, duplicate, presets, remove'), 'aria-label': $t('More actions for f{x}', { x: sub(k) }), html: ICONS.more, onclick: (e) => A.stepMenu(e.currentTarget, k, { full: true }) });
      // (the head keeps the name whole: Show alone and More; Inverse and Bypass are in More)
      const head = h('div', { class: 'ihead' }, h('span', { class: 'idx', html: fsub(k) }), h('span', { class: 'ty', html: typeIcon(st.type) }), h('span', { class: 'ttl ttl-btn', role: 'button', tabindex: 0, 'data-tip': $t('Replace this step'), 'aria-label': $t('Replace f{x} {name}', { x: sub(k), name: d.label }), 'aria-haspopup': 'dialog', onclick: (e) => A.replacePalette(e.currentTarget, k), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); A.replacePalette(e.currentTarget, k); } } }, d.label), mvL, mvR, lens, more);
      const ftex = h('div', { class: 'ftex' });
      const flong = h('div', { class: 'ftex long', hidden: true }, $t('The formula is long; the field below holds it in full.'));
      // (#361: it scrolls sideways when the formula is long: a keyboard reaches it, named by what it holds)
      const form = h('div', { class: 'iform', tabindex: 0, role: 'group', 'aria-label': $t('Formula') }, ftex, flong);
      const err = h('div', { class: 'ierr', role: 'status' });
      const params = h('div', { class: 'params' + (st.type === 'mobius' ? ' matrix2' : '') + (st.type === 'zp' ? ' zp' : '') });
      fillParams(params, st, k);
      const note = h('div', { class: 'inote' });
      const nums = h('div', { class: 'inote inums', hidden: true });   // (v16.5 UX65: the numbers this step uses)
      const det = h('div', { class: 'isub' });
      // v15.2 (notes/formula-steps/DESIGN.md 6): a formula that is a chain of catalog steps shows how it is built, after
      // its fields and before the note line, with one button that splits it into those steps
      const split = st.type === 'custom' && A.splitInfo ? h('details', { class: 'split-offer', hidden: true }) : null;
      const root = h('div', { class: 'insp-step', 'data-k': k }, head, form, err, params, det, split, note, nums);
      const E = { kind: 'step', k, root, lens, inv, byp, ftex, flong, err, note, nums, det, params, split, typing: false };
      if (split) {
        split.open = foldOpen();
        // (the tour's unfolding, below, is not the viewer's fold)
        split.addEventListener('toggle', () => { if (split.dataset.tourOpen) { delete split.dataset.tourOpen; syncFoldLabel(split); return; } if (!split.hidden) { foldSave(split.open); syncFoldLabel(split); } });
        // (hidden from the first keystroke in the formula field until the text is committed: Enter or leaving the field)
        const fx = params.querySelector('input[data-pkey="expr"]');
        if (fx) {
          fx.addEventListener('input', () => { if (!E.typing) { E.typing = true; fillSplit(E, k); } });
          const done = () => { if (E.typing) { E.typing = false; A.requestRender('P'); } };
          fx.addEventListener('change', done);
          fx.addEventListener('blur', done);
          // (Enter commits even when the text ends as it began, which fires no change event)
          fx.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
        }
      }
      return E;
    }
    // the fold of the split offer is remembered for this viewer (folding it is the dismissal); open without storage. The
    // key is the app's (lsk: namespaced on a ?ns= page, as every other setting: review regress-2)
    const FOLD_KEY = A.lsk ? A.lsk('cmw-split-fold') : 'cmw-split-fold';
    function foldOpen() { try { return localStorage.getItem(FOLD_KEY) !== '0'; } catch (e) { return true; } }
    function foldSave(open) { try { localStorage.setItem(FOLD_KEY, open ? '1' : '0'); } catch (e) { /* ignore */ } }
    function syncFoldLabel(box) {
      const sm = box.querySelector('summary');
      if (sm) box.setAttribute('aria-label', sm.textContent);
    }
    // the offer: "Built from n steps" with the derivation z ↦ … ↦ F (each row named) and Split into n steps; a formula that
    // is one catalog step says so, with Replace with that step. Nothing while the formula is being typed, or in the tour
    function fillSplit(E, k) {
      const box = E.split;
      if (!box) return false;
      const S = A.S(), st = S.steps[k - 1], b = A.built()[k - 1];
      let sp = null;
      if (st && st.type === 'custom' && b && !b.error && !E.typing && !A.splitHidden()) { try { sp = A.splitInfo(k); } catch (e) { sp = null; } }
      const show = !!(sp && (sp.kind === 'one' || sp.kind === 'many') && sp.rows);
      if (box.hidden !== !show) box.hidden = !show;
      if (!show) return false;
      // (v16.1, user 5: the tour's stop about the offer unfolds it, so its Split button shows, without saving the fold)
      if (A.splitTour && A.splitTour() && !box.open) { box.dataset.tourOpen = '1'; box.open = true; }
      const n = sp.steps.length, one = sp.kind === 'one';
      const name = one ? A.Funcs.DEFS[sp.steps[0].type].label : '';
      // (the rows in the step's own input variable, as its heading: w₆ ↦ w₆² ↦ … for f₇, review steps-9)
      const v = A.wvar(k - 1), rv0 = one ? null : A.Funcs.splitRowsVar(sp, v) || sp;
      // (a step with a display form ends its rows with that form, not with the typed formula again)
      const rv = rv0 && b.show && rv0.rows ? { rows: rv0.rows, eq: b.show({ s: v, p: 4 }).s } : rv0;
      const key = JSON.stringify([sp.kind, sp.steps, rv && rv.eq, v, I18N.lang]);
      if (box.dataset.key !== key) {
        box.dataset.key = key;
        box.classList.toggle('one', one);
        box.innerHTML = '';
        const sum = h('summary', null);
        if (one) sum.append(h('span', null, $t('This is the step “{name}”.', { name })));
        else sum.append(h('span', { class: 'so-open' }, $tn('Built from {n} step', 'Built from {n} steps', n, { n })), h('span', { class: 'so-closed' }, $tn('Built from {n} step: {chain}', 'Built from {n} steps: {chain}', n, { n, chain: sp.names.join(' → ') })));
        box.append(sum);
        if (!one) {
          const ol = h('ol', { class: 'so-rows' });
          box.append(ol);
          // a long chain repeats a growing expression in every row: when a row does not fit even at 70 %, the block
          // shows each step once instead, named (u₁ = z², u₂ = u₁ + 1, w₁ = sin u₂: review steps-3); a row of LONG
          // characters or more cannot fit, so that is decided before anything is typeset
          const subst = () => { const sub = A.Funcs.splitSubRows(sp, v, A.wvar(k)); if (!sub) return false; ol.classList.add('subst'); fillRows(ol, sub, null); fitRows(ol); return true; };
          const tooLong = rv.rows.some((r) => r.tex.length >= LONG) || (rv.eq || '').length >= LONG;
          if (!(tooLong && subst())) { fillRows(ol, rv.rows, rv.eq, rv !== rv0); fitRows(ol, subst); }
        } else if (sp.steps[0].type === 'mobius') {
          // a fraction: the simple moves it is made of, read only (z ↦ z − 1 ↦ 1/(z − 1) ↦ 3/(z − 1) ↦ 3/(z − 1) + 2:
          // review steps-5)
          const mv = A.Funcs.splitMoves(sp.steps[0], v);
          if (mv) { const ol = h('ol', { class: 'so-rows moves' }); fillRows(ol, mv, null); box.append(ol); fitRows(ol); }
        }
        // (the focus goes to the first new card, so the keyboard does not fall back to the page: review steps-11)
        const btn = h('button', { class: 'so-btn', type: 'button', onclick: () => { if (A.splitStep(k)) focusCard(k); } },
          one ? $t('Replace with “{name}”', { name }) : $tn('Split into {n} step', 'Split into {n} steps', n, { n }));
        box.append(btn);
        E.splitBtn = btn;
        syncFoldLabel(box);
      }
      const tip = sp.blocked ? A.Funcs.splitReason(sp) : $t('Each step gets its own card and picture; the deformation plays them one by one.');
      const btn = E.splitBtn;
      if (btn && btn.dataset.tip !== tip) { btn.dataset.tip = tip; btn.setAttribute('aria-description', tip); }
      if (btn && btn.disabled !== !!sp.blocked) btn.disabled = !!sp.blocked;
      return true;
    }
    // after a split, the keyboard goes to the first new step: its card in the classic view, its chip on the steps view's
    // thread (the button and its Inspector are rebuilt: the element is looked up again while the chain is drawn)
    function focusCard(k) {
      let n = 0, held = 0;
      const go = () => {
        const c = /** @type {HTMLElement | null} */ (document.querySelector(A.svOn && A.svOn() ? `#svStrip .sv-step[data-k="${k}"] .sv-fchip` : `#pipeline .card[data-k="${k}"]`));
        if (c && c.isConnected) {
          if (document.activeElement !== c) { c.focus({ preventScroll: true }); held = 0; } else held++;
        }
        // (held until it has stayed for 8 frames, at most 600: the chain and the Inspector are drawn again after the split,
        // and the steps view's thread keeps drawing its new chips for a while)
        if (held < 8 && ++n < 600) requestAnimationFrame(go);
      };
      go();
    }
    // the rows of the derivation: ↦, the formula and the step's name in three grid columns (the ↦ never wraps alone)
    // the quiet mark on a line written with a step's display form: "in short", the full-formula explanation in its tooltip
    // and its accessible description, one wording on F's line and on the split offer's row (#453; the step's own card says
    // the same in its note)
    function shortMark() {
      const tip = $t('Written in short; each step\'s own field holds its full formula.');
      return h('span', { class: 'shortmark', role: 'note', 'data-tip': tip, 'aria-description': tip, tabindex: '0' }, $t('in short'));
    }
    function fillRows(ol, rows, eq, showMark) {
      ol.innerHTML = '';
      const sub = ol.classList.contains('subst');
      rows.forEach((r, i) => {
        const last = i === rows.length - 1;
        const t = h('span', { class: 'so-tex' });
        const li = h('li', { class: 'so-row' }, h('span', { class: 'so-map', 'aria-hidden': 'true' }, i && !sub ? '↦' : ''), t, h('span', { class: 'so-name' }, i || sub ? r.name : ''));
        // (the last row ends with the step's display form, not the typed formula: says so)
        if (last && eq && !sub && showMark) li.lastChild.append(shortMark());
        ol.append(li);
        TeX.set(t, rowTex(last && eq ? `${r.tex}=${eq}` : r.tex));
      });
    }
    // a row of LONG characters or more keeps its left side (u₁ =, w₂ =) and elides the rest, so the row still names its
    // step and is never cut mid-formula; a row without one (z ↦ …) shows the ellipsis alone
    function rowTex(tex) {
      if (tex.length < LONG) return tex;
      const m = /^[a-zA-Z](?:_\{\d+\})?=/.exec(tex);
      return (m ? m[0] : '') + '\\cdots';
    }
    // a long row: smaller, down to 70 %; tooLong() when one still does not fit there (once the TeX is typeset)
    function fitRows(ol, tooLong) {
      let tries = 0;
      const go = () => {
        if (!ol.isConnected) return;
        const ts = [...ol.querySelectorAll('.so-tex')];
        // (MathJax not loaded yet, or the box folded or hidden: tried again on the next frames, for 2 s)
        if (!TeX.ready || !ol.clientWidth || ts.some((t) => t.dataset.tex && !t.firstChild)) { if (++tries < 120) requestAnimationFrame(go); return; }
        let over = false;
        for (const t of ts) {
          t.style.fontSize = '';
          const li = t.parentNode;
          if (li) li.classList.remove('stack');
          let w = t.scrollWidth, avail = t.clientWidth;
          if (!(avail > 0) || w <= avail + 0.5) continue;
          let f = Math.floor((avail / w) * 100);
          // (a row that does not fit at 70 % puts its name on a line of its own, as on the phone, and gets the width)
          if (f < 70 && li) { li.classList.add('stack'); w = t.scrollWidth; avail = t.clientWidth; f = Math.floor((avail / w) * 100); }
          if (f >= 100) continue;
          if (f < 70) over = true;
          t.style.fontSize = Math.max(70, f) + '%';
        }
        if (over && tooLong) tooLong();
      };
      requestAnimationFrame(go);
    }
    function fillParams(params, st, k) {
      const d = A.defOf(st);
      params.innerHTML = '';
      if (st.type === 'zp' && A.Funcs.DEFS.zp) {
        params.append(A.zpFields(st, k, 'i'));
        const adds = params.querySelector('.zp-adds');
        if (adds) {
          // the big buttons first, then the hint, then a and one row per zero and pole
          params.prepend(adds);
          adds.after(h('div', { class: 'zp-hint' }, touchUI() ? $t('Drag a mark to move it; hold it for more.') : $t('Drag a mark to move it; right-click it for more.')));
          for (const b of adds.querySelectorAll('.zp-add')) {
            const kind = b.classList.contains('zeros') ? 'zeros' : 'poles';
            const txt = [...b.childNodes].find((n) => n.nodeType === 3);
            if (txt) txt.textContent = kind === 'zeros' ? $tx('zp', 'Add zero') : $tx('zp', 'Add pole');
          }
        }
      } else for (const q of d.params || []) if (q.key !== 'cut' || hasCut(st, k)) params.append(A.paramField(st, k, q, 'i'));
      if ((st.type === 'dh' || st.type === 'bottcher') && A.dhAdd) params.append(...dhAdds(k));
      indexLabels(params, k);
    }
    // [issue #260] Φ_M and φ_c: an external ray of angle θ (turns, exact as p/q) and an equipotential |Φ| = r of the
    // step's set, added as shapes of the plane the step reads (Enter or the button; a value it cannot use is flagged)
    function dhAdds(k) {
      const row = (word, sym, val, kind, label) => {
        const id = `dh${k}_${kind}`;
        const inp = h('input', { class: 'inp mono', id, value: val, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off' });
        const go = () => {
          const msg = A.dhAdd(k, kind, inp.value);
          inp.classList.toggle('bad', !!msg); inp.setAttribute('aria-invalid', String(!!msg));
          if (msg) inp.setAttribute('data-tip', msg); else inp.removeAttribute('data-tip');
        };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        const lab = h('label', { class: 'pl worded', for: id }, h('span', { class: 'pw' }, word), ' ', h('span', { class: 'ps', html: sym }));
        return h('div', { class: 'pf worded wide dh-add' }, lab, h('div', { class: 'pair' }, inp, h('button', { type: 'button', class: 'btn', onclick: go }, label)));
      };
      return [row($t('Ray'), '<i>θ</i>', '1/3', 'dhray', $t('Add ray')), row($t('Level'), '|Φ|', '1.1', 'dheq', $t('Add equipotential'))];
    }
    // (v16.5 UX33) a formula step shows its cut angle only when the formula has a cut to move (log, roots, powers)
    function hasCut(st, k) {
      if (st.type !== 'custom') return true;
      const b = A.built()[k - 1];
      return !!(b && !b.error && b.cuts && b.cuts.some((c) => c.editable));
    }
    function fillStep(E) {
      const S = A.S(), k = E.k, st = S.steps[k - 1], b = A.built()[k - 1];
      if (!st) return;
      const bad = !!(b && b.error), off = st.on === false;
      const alone = S.focus === k;
      E.lens.setAttribute('aria-pressed', String(alone));
      // (v16.5 UX85: one name, Show alone; while it is on, the same button reads Show F)
      const lt = alone ? $t('Show F  L') : $t('Show alone  L');
      if (E.lens.dataset.tip !== lt) {
        E.lens.dataset.tip = lt; E.lens.setAttribute('aria-label', alone ? $t('Show F') : $t('Show f{x} alone', { x: sub(k) }));
        const ab = E.lens.querySelector('.ab-l'); if (ab) ab.textContent = alone ? $t('Show F') : $t('Show alone');
      }
      E.byp.setAttribute('aria-pressed', String(off));
      const bt = off ? $t('Turn this step back on') : $t('Bypass this step');
      if (E.byp.dataset.tip !== bt) { E.byp.dataset.tip = bt; E.byp.setAttribute('aria-label', bt); }
      E.inv.disabled = !b || bad;
      const errT = bad ? b.error : '';
      if (E.err.textContent !== errT) E.err.textContent = errT;
      if (b && !bad) {
        // (a field that uses shared numbers shows their names: Funcs.build keeps them, issue #11)
        // (a display form stands for the formula here; a formula of LONG characters or more is not typeset: the well
        // says that the field holds it)
        const num = shownTex(b, { s: A.wvar(k - 1), p: 4 }).s;
        const long = !b.show && num.length >= LONG;
        if (E.flong.hidden !== !long) { E.flong.hidden = !long; E.ftex.hidden = long; }
        const gen = genericTex(st, k);
        const full = `w_{${k}}=` + (gen && gen.replace(/\s/g, '') !== num.replace(/\s/g, '') ? `${gen}=${num}` : num), short = `w_{${k}}=${num}`;
        // (the generic form and the values do not fit: the values alone, then smaller)
        if (!long) fitPick(E.ftex, full, full === short ? null : short);
        const drags = b.cuts.some((x) => x.editable) ? $t('Drag the seam in the input plane') : null;
        // (the split offer says what the note's "Same as …" says: the note drops it while the offer shows)
        const offer = fillSplit(E, k);
        // a formula read as a chain that is not offered as steps (its numbers have no short exact form, or depend on a
        // shared number): the note says why it stays one step (review steps-4)
        let rn = offer ? null : b.recNote;
        if (rn && st.type === 'custom' && A.splitInfo && !E.typing && !A.splitHidden()) {
          let sp = null;
          try { sp = A.splitInfo(k); } catch (e) { sp = null; }
          if (sp && sp.kind === 'none' && (sp.reason === 'R2' || sp.reason === 'R3') && / → /.test(rn)) {
            const why = A.Funcs.splitReason(sp);
            rn = rn.replace(/\.$/, '') + '; ' + $t('it stays one step: {why}', { why: why.charAt(0).toLowerCase() + why.slice(1) });
          }
        }
        // (v16.5 UX33: the cut and the sheet are in their fields, so the note no longer repeats them: A.branchTag left out)
        const shortNote = b.show ? $t('Written in short; the field below holds the formula in full.') : null;
        const n = [shortNote, b.branchNote, drags, rn].filter(Boolean).map((x) => x.replace(/\.$/, '')).join('. ');
        const nt = n ? n + '.' : '';
        if (E.note.textContent !== nt) E.note.textContent = nt;
      } else {
        E.ftex.innerHTML = ''; E.ftex.dataset.tex = '';
        if (E.note.textContent) E.note.textContent = '';
        fillSplit(E, k);
      }
      // a Möbius step: its determinant, with the indexed letters in math italics and numbers with the true minus
      let dt = '';
      if (st.type === 'mobius' && !bad) {
        const [a, bb, c, d] = ['a', 'b', 'c', 'd'].map((x) => cxv(st.params[x]));
        if (a && bb && c && d) {
          const v = A.CX.sub(A.CX.mul(a, d), A.CX.mul(bb, c));
          const li = (x) => `<i>${x}</i>${sub(k)}`, num = (z) => A.fmt(z).replace(/-/g, '−');
          dt = `${li('a')}${li('d')} − ${li('b')}${li('c')} = ${num(v)}`;
          // (review math-6: a determinant 0 makes the step constant; its "pole" is a removable singularity.
          // verify-3: "(= v)", the true minus, f and z in italics)
          if (A.CX.mobDetZero([a, bb, c, d])) {
            const cz = A.CX.isZero(c);
            dt += '. ' + (cz ? $t('{f} is constant (= {v}).', { f: li('f'), v: num(A.CX.div(bb, d)) })
              : $t('{f} is constant (= {v}); {z} = {p} is a removable singularity.', { f: li('f'), z: '<i>z</i>', v: num(A.CX.div(a, c)), p: num(A.CX.neg(A.CX.div(d, c))) }));
          }
        }
      }
      if (E.det.dataset.h !== dt) { E.det.dataset.h = dt; E.det.innerHTML = dt; }
      // (v16.5 UX65) the numbers the step uses, with their values
      const nt = A.numbersOf ? A.numbersOf(k) : '';
      if (E.nums.textContent !== nt) E.nums.textContent = nt;
      E.nums.hidden = !nt;
    }
    // ---- F ----
    function buildF() {
      const S = A.S(), act = A.activeSteps(), built = A.built();
      const copy = h('button', { class: 'icon-btn', 'data-tip': $t('Copy LaTeX'), 'aria-label': $t('Copy the formula as LaTeX'), html: ICONS.copy });
      copy.addEventListener('click', () => { A.copyText(A.exactTexF()); copy.innerHTML = ICONS.check; setTimeout(() => { copy.innerHTML = ICONS.copy; }, 1200); if (A.tourEmit) A.tourEmit('tex-copied', { what: 'F' }); });
      const head = h('div', { class: 'ihead' }, h('span', { class: 'fF' }, 'F'), h('span', { class: 'ttl' }, $t('The whole map')), copy);
      const ftex = h('div', { class: 'ftex' });
      const flong = h('div', { class: 'ftex long', hidden: true }, $t('The expanded formula is long; the steps below list it piece by piece.'));
      const wl = h('div', { class: 'wl' });
      const chain = [];
      if (S.steps.length > 1) S.steps.forEach((st, i) => {
        const k = i + 1, b = built[i];
        const li = h('div', { 'data-k': k, onpointerenter: () => A.hiStep(k, true), onpointerleave: () => A.hiStep(k, false) });
        if (st.on === false) li.append(h('span', { class: 'idx', html: fsub(k) }), ' ', h('span', { class: 'lbl' }, $t('bypassed')));
        else if (b.error) li.append(h('span', { class: 'idx', html: fsub(k) }), ' ', h('span', { class: 'err-msg' }, b.error));
        else { const t = h('span'); chain.push([k, t]); li.append(t); }
        wl.append(li);
      });
      const smark = shortMark();
      smark.hidden = true;
      const form = h('div', { class: 'iform' }, ftex, smark, flong, wl.childElementCount ? wl : null);
      const warn = h('div', { class: 'ierr', role: 'status' });
      const lamps = {};
      const glist = h('div', { class: 'iglist' });
      for (const [key, name, desc] of A.BADGES) {
        const q = h('span', { class: 'lampq' });
        const el = h('span', { class: 'lamp', 'data-lamp': key, 'data-tip': desc, hidden: true }, h('span', { class: 'lampname' }, name), q);
        lamps[key] = { el, q };
        glist.append(el);
      }
      const none = h('div', { class: 'ignot nolit' });
      const not = h('div', { class: 'ignot' });
      const dom = h('div', { class: 'idom' });
      const nConds = act.filter((k) => built[k - 1].domain).length;
      const domEls = [];
      let domLbl = null;
      if (!nConds) { domLbl = h('span'); dom.append(h('span', { html: $t('Natural domain <i>D</i>') + ': ' }), domLbl); }
      else {
        const ul = h('ul');
        for (let i = 0; i < nConds; i++) { const li = h('li'); domEls.push(li); ul.append(li); }
        dom.append(h('div', { html: $t('Natural domain <i>D</i>') + ': ' + $tx('insp', 'All <i>z</i> for which:') }), ul);
      }
      // the step table and how the guarantees are decided, folded
      const tbl = h('table', { class: 'matrix' });
      const hr = h('tr', null, h('th', { class: 'stepcol' }, $t('step')));
      for (const [key, ab, t] of A.CHIP_DEFS) hr.append(h('th', { 'data-col': key, 'data-tip': t }, ab));
      tbl.append(h('thead', null, hr));
      const body = h('tbody'), rows = [];
      const cell = (key) => h('td', { 'data-col': key }, h('span', { class: 'sq', role: 'img' }));
      for (const k of act) {
        const cells = A.CHIP_DEFS.map(([key]) => cell(key));
        rows.push([k, cells]);
        body.append(h('tr', { 'data-k': k, onpointerenter: () => A.hiStep(k, true), onpointerleave: () => A.hiStep(k, false) },
          h('td', { class: 'stepcol' }, h('span', { class: 'idx', html: fsub(k) }), h('span', { class: 'nm' }, built[k - 1].def.label)), ...cells));
      }
      const total = A.CHIP_DEFS.map(([key]) => cell(key));
      rows.push([0, total]);
      body.append(h('tr', { class: 'total' }, h('td', { class: 'stepcol', html: '<i>F</i>' }), ...total));
      tbl.append(body);
      const steps = h('details', { class: 'ifold steps' }, h('summary', null, $t('Step by step')), tbl);
      const how = h('details', { class: 'ifold how' }, h('summary', null, $t('How these are decided')),
        h('p', null, $t('A property is listed only when every active step has it and composition preserves it on the natural domain. Compositions of analytic, entire, rational, polynomial, Möbius, injective and proper (into ℂ) maps keep that property.')),
        h('p', null, $t('Each step is judged on its own natural domain, off its branch cut. So log is injective but exp is not; z ↦ 1/z is Möbius but not proper into ℂ, since |1/z| stays bounded as z → ∞.')),
        h('p', null, $t('The list is sound but not complete. For example, log followed by exp returns z, yet neither step is rational, so "rational" is not claimed.')));
      const root = h('div', { class: 'insp-F' }, head, form, warn, glist, none, not, dom, steps, how);
      return { kind: 'F', root, ftex, flong, smark, chain, warn, lamps, none, not, domEls, domLbl, rows, act };
    }
    function fillF(E) {
      const act = A.activeSteps(), built = A.built(), S = A.S();
      const P = A.Funcs.composeProps(act.map((k) => built[k - 1].props));
      const words = Object.assign({}, P, { homeo: P.injective, conformal: P.analytic && P.injective });
      // (composed from the steps' display forms where they have one)
      let arg = { s: 'z', p: 4 };
      for (const k of act) arg = shownTex(built[k - 1], arg);
      const long = arg.s.length >= LONG;
      E.flong.hidden = !long; E.ftex.hidden = long;
      // (F's line says so when a step it is composed of is written in its display form)
      const sm = !long && act.some((k) => built[k - 1].show);
      if (E.smark.hidden !== !sm) E.smark.hidden = !sm;
      // (review design-4: an expanded F wider than the well is written in terms of the last w, as the mockup does,
      // with the w list under it; then smaller, never cut)
      const last = act.length > 1 && E.chain.length ? act[act.length - 1] : 0;
      let byW = false;
      // (a step's line of LONG characters or more reads w_k = f_k(w_{k−1}): its own card shows it)
      const wLine = (k) => { const s = shownTex(built[k - 1], { s: A.wvar(k - 1), p: 4 }).s; return `w_{${k}}=` + (s.length < LONG ? s : `f_{${k}}(${A.wvar(k - 1)})`); };
      if (!long) byW = fitPick(E.ftex, `F(z)=${arg.s}`, last ? `F(z)=${wLine(last)}` : null) === 1;
      for (const [k, t] of E.chain) {
        const li = t.parentNode;
        if (li) li.hidden = byW && k === last;
        // (review verify-9: in display style, at the size of F's line, when it fits; else in text style)
        if (!(byW && k === last)) { const wt = wLine(k); fitPick(t, `\\displaystyle ${wt}`, wt, false); }
      }
      const warns = [];
      S.steps.forEach((st, i) => { if (st.on !== false && built[i].error) warns.push($t('Step {x} has an error and is skipped until fixed.', { x: i + 1 })); });
      if (P.constant) warns.push($t('A step is constant, so F is constant on D.'));
      const ws = warns.join(' ');
      if (E.warn.textContent !== ws) E.warn.textContent = ws;
      const off = [];
      for (const [key, name] of A.BADGES) {
        const L = E.lamps[key], on = !!words[key];
        let q = '';
        if (on && (key === 'rational' || key === 'polynomial') && P.deg != null) q = P.degExact ? $t('deg {n}', { n: P.deg }) : $t('deg ≤ {n}', { n: P.deg });
        if (L.q.textContent !== q) L.q.textContent = q;
        L.el.hidden = !on;
        L.el.classList.toggle('on', on);
        // (lower case in the running list, except a proper name: Möbius)
        if (!on) off.push(key === 'mobius' && I18N.lang === 'en' ? name : name.charAt(0).toLowerCase() + name.slice(1));
      }
      const lit = A.BADGES.some(([key]) => words[key]);
      const nt = lit ? '' : $t('No guarantees: the chain implies none of these properties.');
      if (E.none.textContent !== nt) E.none.textContent = nt;
      const not = off.length && lit ? $t('Not implied: {list}.', { list: off.join(', ') }) : '';
      if (E.not.textContent !== not) E.not.textContent = not;
      if (E.domLbl) {
        const all = act.every((k) => built[k - 1].props.entire || built[k - 1].def.id === 'conj');
        const t = all ? '<i>D</i> = ℂ' : $t('Every <i>z</i> where each step is defined.');
        if (E.domLbl.dataset.v !== t) { E.domLbl.dataset.v = t; E.domLbl.innerHTML = t; }
      } else {
        let i = 0;
        for (const k of act) { const b = built[k - 1]; if (b.domain && E.domEls[i]) mixedTex(E.domEls[i++], b.domain(A.wvar(k - 1))); }
      }
      for (const [k, cells] of E.rows) {
        const pr = !k ? P : A.isDeriv(k) ? A.Funcs.composeProps(act.filter((j) => j <= k).map((j) => built[j - 1].props)) : built[k - 1].props;
        A.CHIP_DEFS.forEach(([key], j) => {
          const on = !!pr[key], td = cells[j];
          if (td.classList.contains(on ? 'y' : 'n')) return;
          td.classList.toggle('y', on); td.classList.toggle('n', !on);
          td.firstChild.setAttribute('aria-label', on ? $t('yes') : $t('no'));
        });
      }
    }
    // ---- the region ----
    function buildRegion() {
      const head = h('div', { class: 'ihead' }, h('span', { class: 'idx', html: '<i>z</i>' }), h('span', { class: 'ty', html: ICON.region }), h('span', { class: 'ttl' }, $t('Shapes')));
      const sum = h('div', { class: 'idom' });
      const sw = h('div', { class: 'swatches' });
      // (v16.5 UX17: on a touch screen, the phone's places)
      const hint = h('div', { class: 'inote' }, touchUI() ? $t('Draw shapes in X with the tools of the bottom row; the Shapes list, in More tools, edits them. Tap a step in the chain to edit it here.') : $t('Draw shapes in X with the tools on the left. Select a shape, or a step in the chain, to edit it here.'));
      return { kind: 'region', root: h('div', { class: 'iregion' }, head, sum, sw, hint), sum, sw };
    }
    function fillRegion(E) {
      const S = A.S();
      const t = A.regionSummary() || $t('No shapes yet.');
      if (E.sum.textContent !== t) E.sum.textContent = t;
      const sig = S.shapes.map((s) => s.id + (s.visible === false ? 'h' : '') + (s.ci ?? '') + (s.color || '')).join('|');
      if (E.sw.dataset.sig !== sig) {
        E.sw.dataset.sig = sig;
        E.sw.innerHTML = '';
        for (const s of S.shapes.slice(0, 24)) E.sw.append(h('span', { class: 'swatch' + (s.visible === false ? ' off' : ''), 'data-kind': A.kindType(s), style: A.swatchStyle(s) }));
      }
    }
    // the structure a built view depends on: rebuilt when it changes, else updated in place
    function sigOf(sel) {
      const S = A.S(), built = A.built();
      if (sel === 'F') return 'F#' + S.steps.map((st, i) => `${st.on === false ? 0 : 1}${built[i] && built[i].error ? 'e' : ''}${built[i] && built[i].def ? built[i].def.id : st.type}${built[i] && built[i].domain ? 'd' : ''}`).join('|');
      if (!sel) return 'R';
      const st = S.steps[sel - 1];
      const zp = st.type === 'zp' ? A.zpCounts(st) : '';
      return `S${sel}#${st.type}#${zp}#${I18N.lang}#${st.type === 'zp' && touchUI() ? 't' : ''}#${hasCut(st, sel) ? 'c' : ''}#${S.steps.length}`;
    }
    function render() {
      if (!skeleton()) return;
      mountParams();
      const sel = A.sel();
      // (a selected construction shows its Construction view while the selection is the region; construct.js)
      const cmSig = (A.S().sel == null || A.S().sel === 0) ? Construct.inspectorSig() : null;
      // ([v17 D4] a selected free shape is edited here, on the laptop: the app's shape view)
      const shSig = !cmSig && A.shapeInspSig ? A.shapeInspSig() : null;
      const sig = cmSig || shSig || sigOf(sel);
      if (sig !== cur.sig || cur.stale || !cur.el || !selSec.contains(cur.el.root)) {
        // (a field being typed in keeps its place: a zero emptied while typing drops out of the list until the
        // field is left, so the editor waits for that instead of rebuilding under the caret)
        const typing = cur.el && cur.el.kind === 'step' && sel === cur.el.k && selSec.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
        if (typing && cur.sig && cur.sig.split('#')[0] === sig.split('#')[0] && cur.sig.split('#')[1] === sig.split('#')[1]) {
          if (!cur.wait) { cur.wait = true; document.activeElement.addEventListener('blur', () => { cur.wait = false; cur.sig = null; A.requestRender('P'); }, { once: true }); }
        } else {
          selSec.innerHTML = '';
          cur.stale = false;
          cur.el = cmSig ? Construct.inspectorBuild() : shSig ? A.shapeInspBuild() : sel === 'F' ? buildF() : sel ? buildStep(sel) : buildRegion();
          selSec.append(cur.el.root);
          cur.sig = sig;
        }
      }
      const E = cur.el;
      if (E.kind === 'construct') Construct.inspectorFill(E); else if (E.kind === 'shape') A.shapeInspFill(E); else if (E.kind === 'step') fillStep(E); else if (E.kind === 'F') fillF(E); else fillRegion(E);
    }
    // the step editor's parameter block again (zeros or poles added or removed)
    function refreshParams(k) {
      const E = cur.el;
      if (!E || E.kind !== 'step' || E.k !== k) return;
      const st = A.S().steps[k - 1];
      if (!st) return;
      const top = host ? host.scrollTop : 0;
      fillParams(E.params, st, k);
      cur.sig = sigOf(k);
      if (host) host.scrollTop = top;
    }
    // the chain was rebuilt (undo, a step added or removed, a number renamed): the editor is built again at the next
    // render, except under a field being typed in (it waits for the field to be left, as above)
    function invalidate() { cur.stale = true; }
    return { render, refreshParams, invalidate, typeIcon, regionIcon, STRONG };
  }
  return { create, typeIcon, regionIcon, STRONG };
})();
import { Construct } from './construct.js';
import { Params } from './params.js';
export { Inspector };
