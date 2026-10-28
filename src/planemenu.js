'use strict';
// The planes' context menu (v15; notes/ui-redesign-2/desktop/DESIGN.md 2.5, INTERFACE.md "Long-press" and "Keyboard and
// screen readers", phone/DESIGN.md 3.6). One menu for every plane: a right-click, the touch long-press (450 ms ring, a
// release without moving), Shift+F10 or the Menu key. A head with the point and the map there, then groups, empty
// ones left out:
//   object:        the object under the pointer (a zero or pole mark, a cut handle, a shape: its line integral and
//                  Listen along, Hide, Delete)
//   constructions: (v16, construct.js) what acts on the shape there: Mark the intersection, Point on this curve, Put on
//                  this curve, Make free
// It is a menu of objects only (issue #13): over empty plane nothing opens (a right-click there only pans; the view is
// centred with a double-click), and while a drawing is in progress the app's right-click cancels it instead.
// The app hands over an adapter with PlaneMenu.init(api) (app.js planeMenuApi); other builds add items with
// PlaneMenu.register(group, provider): provider(ctx) returns a list of items {label | html, sub?, icon?, key?, danger?,
// disabled?, run}. Built on the app's own menus (openMenu: role="menu", arrows, Home/End, Esc, a press outside closes).
const PlaneMenu = (() => {
  const ORDER = ['object', 'constructions'];
  const providers = new Map();      // group -> [provider]
  let api = null;
  let openedAt = 0;                 // when the last menu opened (the contextmenu event that follows a key opens nothing)
  const last = { side: null, x: 0, y: 0, t: 0 };   // the pointer's last position over a plane (pane pixels)
  let mark = null, ringEl = null, live = null;

  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (k) => String(k).split('').map((d) => SUB[+d] ?? d).join('');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const varHtml = (j) => (j === 0 ? '<i>z</i>' : `<i>w</i>${sub(j)}`);
  const fHtml = (k) => `<i>f</i>${sub(k)}`;
  const isFin = (z) => !!z && Number.isFinite(z.re) && Number.isFinite(z.im);
  const tag = (t, cls, html) => { const e = document.createElement(t); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // ---- numbers: as many decimals as a pixel of the plane needs (2 at 52 px per unit), upright digits, real minus
  // (at most 6 decimals: a menu head is a reading, not a computation; review math-8)
  function dpFor(s) { return Number.isFinite(s) && s > 0 ? Math.max(0, Math.min(6, Math.ceil(Math.log10(s) - 0.3))) : 3; }
  function fmtR(x, dp) {
    const ax = Math.abs(x);
    let t;
    if (ax !== 0 && (ax >= 1e6 || ax < Math.pow(10, -dp) / 2)) { const [m, e] = x.toExponential(2).split('e'); t = `${m}×10<sup>${String(+e).replace('-', '−')}</sup>`; }
    else t = x.toFixed(dp);
    if (/^-0(\.0*)?$/.test(t)) t = t.slice(1);
    return I18N.num(t).replace('-', '−');
  }
  // "0.75 + 0.60i" (HTML; the digits upright in the math line)
  function fmtCx(z, dp) {
    if (!isFin(z)) return '<span class="pm-n">∞</span>';
    // (a part below 1e-12 of the other is rounding residue, not a value: 0.80, never 0.80 + 5.55×10⁻¹⁷i)
    const big = Math.max(Math.abs(z.re), Math.abs(z.im));
    if (Math.abs(z.im) < 1e-12 * big) z = { re: z.re, im: 0 }; else if (Math.abs(z.re) < 1e-12 * big) z = { re: 0, im: z.im };
    const re = fmtR(z.re, dp), imAbs = fmtR(Math.abs(z.im), dp), zero = (t) => /^0([.,]0*)?$/.test(t);
    if (zero(imAbs)) return `<span class="pm-n">${re}</span>`;
    const im = `<span class="pm-n">${imAbs}</span><i>i</i>`;
    if (zero(re)) return (z.im < 0 ? '<span class="pm-n">−</span>' : '') + im;
    return `<span class="pm-n">${re} ${z.im < 0 ? '−' : '+'} </span>${im}`;
  }
  const plain = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.replace(/\s+/g, ' ').trim(); };

  // ---- the menu
  function register(group, provider) {
    if (typeof provider !== 'function') return;
    if (!providers.has(group)) providers.set(group, []);
    providers.get(group).push(provider);
  }
  const sideOfPane = (pane) => (pane === 'L' || pane === 'R' ? pane : api && api.sideOf(pane && pane.ocanvas ? pane.ocanvas : pane));
  // open(pane, z, event): pane 'L' | 'R' (or a pane, or its canvas); z the point in that plane (null: from the event);
  // event {clientX, clientY, pointerType} (or {x, y} in pane pixels, keyboard: true). True when it opened; false when
  // nothing there has a menu.
  function open(pane, z, ev) {
    if (!api) return false;
    const side = sideOfPane(pane);
    if (!side || !api.shown(side)) return false;
    ev = ev || {};
    const r = api.paneOf(side).ocanvas.getBoundingClientRect();
    let x = ev.x, y = ev.y;
    if (x == null) { x = (ev.clientX != null ? ev.clientX : r.left + r.width / 2) - r.left; y = (ev.clientY != null ? ev.clientY : r.top + r.height / 2) - r.top; }
    const at = api.at(side, x, y);
    if (!at && !z) return false;
    const touch = ev.pointerType === 'touch' || ev.pointerType === 'pen' || !!ev.touch;
    const zExact = z || at.z;
    if (!isFin(zExact)) return false;
    // the point the head reads: to the decade below a pixel on a flat plane
    const zFree = !at || at.surface === 'flat' ? api.round(side, zExact) : zExact;
    const ctx = {
      side, x, y, cx: r.left + x, cy: r.top + y, touch, keyboard: !!ev.keyboard,
      plane: at ? at.plane : side === 'L' ? 'X' : 'Y', surface: at ? at.surface : 'flat', stage: at ? at.stage : 0, s: at && at.s,
      zExact, zFree, z: zFree,
    };
    // head: the point and the map there
    const dp = dpFor(ctx.s);
    let head = `<span class="pm-h1">${ctx.plane === 'X' ? varHtml(ctx.stage) : api.yHtml()} = ${fmtCx(ctx.z, dp)}</span>`;
    if (ctx.plane === 'X') {
      const F = api.mapF(), w = F ? F(ctx.z) : null;
      if (w) head += `<span class="pm-h2">${api.fnHtml()}(${varHtml(ctx.stage)}) = ${fmtCx(w, dpFor(api.scale('R')))}</span>`;
    }
    // the groups (a provider that throws is left out: one broken item never takes the menu away)
    const items = [];
    const groups = [...ORDER, ...[...providers.keys()].filter((g) => !ORDER.includes(g))];
    for (const g of groups) {
      const list = [];
      for (const p of providers.get(g) || []) { try { list.push(...(p(ctx) || [])); } catch (e) { if (typeof console !== 'undefined') console.warn('PlaneMenu provider', g, e); } }
      if (!list.length) continue;
      if (items.length) items.push('sep');
      items.push(...list);
    }
    if (!items.length) return false;
    // the app's menu: our items in its format; the head, icons and second lines are added below
    const menuItems = items.map((it) => (it === 'sep' ? 'sep' : {
      label: it.label || plain(it.html || ''), key: it.key, danger: it.danger, disabled: it.disabled, run: it.run,
      labelEl: (() => { const l = tag('span', 'mi-label', it.html || esc(it.label || '')); if (it.sub) l.append(tag('span', 'mi-sub', it.sub)); return l; })(),
    }));
    menuItems.menuLabel = [...head.matchAll(/<span class="pm-h\d">(.*?)<\/span>(?=<span class="pm-h|$)/g)].map((m) => plain(m[1])).join('; ') || plain(head);
    const pop = api.openMenu(api.paneOf(side).ocanvas, menuItems, 'ctx-menu pm' + (touch ? ' pm-touch' : ''));
    if (!pop) return false;
    openedAt = performance.now();
    const btns = [...pop.querySelectorAll('.mi')];
    items.filter((it) => it !== 'sep').forEach((it, i) => {
      const b = btns[i];
      if (!b) return;
      const ic = b.querySelector('.mi-ic');
      if (ic) ic.innerHTML = ICON[it.icon] || it.iconHtml || '';
      b.dataset.pm = it.id || '';
    });
    const hd = tag('div', 'pm-head', head);
    hd.setAttribute('aria-hidden', 'true');
    pop.prepend(hd);
    // where: beside the point (below-right, flipped at the window's edges); a finger's menu opens above its finger
    const pw = pop.offsetWidth, ph = pop.offsetHeight, W = window.innerWidth, H = window.innerHeight;
    let px = ctx.cx + 8, py = touch ? ctx.cy - ph - 24 : ctx.cy + 8;
    if (px + pw > W - 12) px = Math.max(12, ctx.cx - pw - 8);
    if (py < 12) py = touch ? Math.min(H - ph - 12, ctx.cy + 24) : 12;
    if (py + ph > H - 12) py = Math.max(12, ctx.cy - ph - 8);
    pop.style.left = px + 'px'; pop.style.top = py + 'px';
    api.armOutside();
    // the point on the plane, while the menu is open
    showMark(side, ctx);
    const prev = pop._onClose;
    pop._onClose = () => { hideMark(); if (prev) prev(); };
    if (ctx.keyboard || !touch) { /* openMenu focused the first item */ }
    PlaneMenu.lastCtx = ctx;
    return true;
  }
  function showMark(side, ctx) {
    hideMark();
    let p = ctx.surface === 'flat' ? api.toClient(side, ctx.z) : [ctx.cx, ctx.cy];
    if (!p) p = [ctx.cx, ctx.cy];
    mark = tag('div', 'pm-mark');
    mark.style.left = p[0] + 'px'; mark.style.top = p[1] + 'px';
    document.body.append(mark);
  }
  function hideMark() { if (mark) { mark.remove(); mark = null; } }
  const isOpen = () => !!document.querySelector('#popHost > .pop.menu.pm');
  function close() { if (isOpen()) api.close(); }
  function announce(msg) {
    if (!live) { live = tag('div', 'sr-only'); live.id = 'pmLive'; live.setAttribute('aria-live', 'polite'); document.body.append(live); }
    live.textContent = '';
    setTimeout(() => { if (live) live.textContent = msg; }, 30);
  }

  // ---- the touch ring (INTERFACE.md "Long-press": 8 px slop, 450 ms; the app's pointer code runs the states)
  function ringStart(cx, cy) {
    ringStop();
    ringEl = tag('div', 'pm-ring', '<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><circle cx="22" cy="22" r="18"/><circle class="pm-ring-fill" cx="22" cy="22" r="18"/></svg>');
    ringEl.style.left = cx + 'px'; ringEl.style.top = cy + 'px';
    document.body.append(ringEl);
  }
  // the ring is full: the press is a long press now
  function ringFull() { if (ringEl) ringEl.classList.add('full'); try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { /* no vibration */ } }
  function ringStop() { if (ringEl) { ringEl.remove(); ringEl = null; } }

  // ---- icons (16 px strokes, the app's style)
  const svg = (inner, fill) => `<svg class="ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const ICON = {
    zero: '<span class="pm-mk zeros"></span>',
    pole: '<span class="pm-mk poles"></span>',
    trash: svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.75 9h5.5l.75-9"/>'),
    hide: svg('<path d="M1.75 8s2.3-4.25 6.25-4.25S14.25 8 14.25 8s-2.3 4.25-6.25 4.25S1.75 8 1.75 8z"/><circle cx="8" cy="8" r="2"/><path d="M2.5 13.5l11-11"/>'),
    select: svg('<path d="M4 2.5l8.5 5.25-3.75.9L7 12.5z"/>'),
    edit: svg('<path d="M10.5 2.75l2.75 2.75-7.5 7.5H3v-2.75z"/><path d="M9 4.25L11.75 7"/>'),
    cut: svg('<path d="M2.5 8h11" stroke-dasharray="2 2"/><path d="M8 4.5a3.5 3.5 0 1 1-3.5 3.5"/><path d="M4.5 5.5v2.5H7"/>'),
    integral: '<span class="pm-glyph">∮</span>',
    listen: svg('<path d="M3 6.5v3h2.25L8.5 12V4L5.25 6.5z"/><path d="M10.75 6a2.75 2.75 0 0 1 0 4M12.5 4.25a5 5 0 0 1 0 7.5"/>'),
    // (a composed curve's "Play the composition": a beamed pair of notes)
    piece: svg('<path d="M6 11.5V4.25l6-1.5v7.25"/><circle cx="4.6" cy="11.6" r="1.4"/><circle cx="10.6" cy="10.1" r="1.4"/>'),
  };

  // ---- the built-in groups
  function zpMarkHtml(kind, n) { return kind === 'zeros' ? `<i>ζ</i>${sub(n)}` : `<i>p</i>${sub(n)}`; }
  function objectItems(ctx) {
    const out = [];
    // a zero or pole of the zeros-and-poles step acting on X's plane
    if (ctx.plane === 'X' && ctx.surface === 'flat') {
      const m = api.zp.hit(ctx.x, ctx.y, ctx.touch ? 22 : 11);
      if (m) {
        const nm = zpMarkHtml(m.kind, api.zp.num ? api.zp.num(m.k, m.kind, m.i) : m.i + 1), other = m.kind === 'zeros' ? 'poles' : 'zeros';
        out.push({ id: 'zp-remove', icon: 'trash', html: $t('Remove {mark}', { mark: nm }), run: () => {
          api.zp.remove(m.k, m.kind, m.i);
          api.undoToast(m.kind === 'zeros' ? $t('Removed zero {mark} of {f}.', { mark: plain(nm), f: `f${sub(m.k)}` }) : $t('Removed pole {mark} of {f}.', { mark: plain(nm), f: `f${sub(m.k)}` }));
        } });
        out.push({ id: 'zp-swap', icon: m.kind === 'zeros' ? 'pole' : 'zero', label: m.kind === 'zeros' ? $t('Turn into a pole') : $t('Turn into a zero'), disabled: api.zp.count(m.k, other) >= api.zp.max, run: () => {
          const j = api.zp.swap(m.k, m.kind, m.i);
          if (j >= 0) announce(other === 'poles' ? $t('{mark} is now a pole of {f}.', { mark: plain(nm), f: `f${sub(m.k)}` }) : $t('{mark} is now a zero of {f}.', { mark: plain(nm), f: `f${sub(m.k)}` }));
        } });
        // (its field is in the Inspector: Edit opens fₖ there, over the stage when the panel is hidden)
        out.push({ id: 'zp-edit', icon: 'edit', html: $t('Edit {mark}', { mark: nm }), run: () => api.zp.edit(m.k, m.kind, m.i) });
        return out;
      }
      const c = api.cutAt(ctx.x, ctx.y);
      if (c) {
        out.push({ id: 'cut-reset', icon: 'cut', html: $t('Reset the cut of {f}', { f: fHtml(c) }), run: () => api.resetCut(c) });
        if (api.inspect) out.push({ id: 'cut-edit', icon: 'edit', html: $t('Edit {f} in the Inspector', { f: fHtml(c) }), run: () => api.inspect(c) });
      }
    }
    // the shape under the pointer: the line integral along one curve there (that shape's when it is a curve near the
    // pointer, else the nearest) and its Listen along, then Hide and Delete (a left click already selects; issue #13)
    const s = api.shapeAt(ctx.side, ctx.x, ctx.y);
    const integrals = api.integralItems(ctx.side, ctx.x, ctx.y, ctx.cx, ctx.cy, s && s.id).map((it) => ({ id: it.listen ? 'listen' : it.piece ? 'piece' : 'integral', icon: it.listen ? 'listen' : it.piece ? 'piece' : 'integral', label: it.label, run: it.run }));
    // ([v16.5 UX56] a point is the menu's subject: its items come before the curve's integral)
    if (!(s && s.kind === 'point')) out.push(...integrals);
    if (s) {
      // ([v16.5 UX56] a point on a curve says so on its first line: "z₁ · on Arc 1")
      const on = s.on && s.on.length ? $t('lies on {x}', { x: s.on.join(', ') }) : null;
      if (on) out.push({ id: 'shape-on', icon: 'select', label: s.name, sub: on, disabled: true });
      out.push({ id: 'shape-hide', icon: 'hide', label: $t('Hide {name}', { name: s.name }), run: () => api.hide(s.id) });
      out.push({ id: 'shape-delete', icon: 'trash', danger: true, label: $t('Delete {name}', { name: s.name }), run: () => api.del(s.id) });
      if (s.kind === 'point') out.push(...integrals);
    }
    return out;
  }
  // ---- keyboard: Shift+F10 or the Menu key opens it at the keyboard probe, the pointer or the plane's centre; with
  // nothing there that has a menu, a screen reader hears so
  function onKey(e) {
    if (e.type !== 'keydown' || !api) return;
    const isMenuKey = e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey);
    if (!isMenuKey) return;
    const a = document.activeElement;
    let side = api.sideOf(a);
    // only from a plane or from nowhere in particular: a field, a button or a menu keeps its own menu
    if (!side && a && a !== document.body && a !== document.documentElement) return;
    if (document.querySelector('.modal-bg')) return;
    let x = null, y = null;
    if (side) { const p = api.kbPoint(side); if (p) [x, y] = p; }
    if (!side && last.side && api.shown(last.side)) side = last.side;
    if (!side) side = api.shown('L') ? 'L' : 'R';
    if (x == null && last.side === side && performance.now() - last.t < 600000) { x = last.x; y = last.y; }
    const r = api.paneOf(side).ocanvas.getBoundingClientRect();
    if (x == null || x < 0 || y < 0 || x > r.width || y > r.height) { x = r.width / 2; y = r.height / 2; }
    e.preventDefault(); e.stopPropagation();
    if (!open(side, null, { x, y, keyboard: true })) announce($t('Nothing here has a menu.'));
  }
  function onPointer(e) {
    if (!api || e.pointerType === 'touch') return;
    const side = api.sideOf(e.target);
    if (!side) return;
    const r = e.target.getBoundingClientRect();
    last.side = side; last.x = e.clientX - r.left; last.y = e.clientY - r.top; last.t = performance.now();
  }

  const CSS = `
.pop.menu.pm { min-width: 236px; max-width: min(340px, calc(100vw - 24px)); }
.pm-head { display: flex; flex-direction: column; gap: 3px; padding: 7px 8px 7px; margin-bottom: 2px; border-bottom: 1px solid var(--line);
  font: italic 500 13px/16px var(--f-math); color: var(--ink); white-space: nowrap; }
.pm-head .pm-h2 { color: var(--ink-2); font-size: 12.5px; }
.pm-head .pm-n { font-style: normal; font-feature-settings: "tnum" 1; }
.pm-head sup { font-size: 9px; line-height: 0; }
.pop.menu.pm .mi { height: auto; min-height: 30px; padding: 4px 8px; }
@media (pointer: coarse) { .pop.menu.pm .mi { min-height: 44px; } }
.pop.menu.pm.pm-touch .mi { min-height: 44px; }
.pop.menu.pm .mi-label { white-space: normal; }
.pop.menu.pm .mi-label i { font: var(--t-math-s); }
.pop.menu.pm .mi-sub { display: block; margin-top: 1px; font: 400 11px/14px var(--f-ui); color: var(--muted); }
.pop.menu.pm .mi-sub i { font: italic 500 12px/14px var(--f-math); }
.pop.menu.pm .mi-sub sup, .pop.menu.pm .mi-label sup { font-size: 8.5px; line-height: 0; }
.pm-mk { position: relative; display: block; width: 9px; height: 9px; }
.pm-mk.zeros { border-radius: 50%; background: var(--zero); box-shadow: 0 0 0 1.5px var(--surface); }
.pm-mk.zeros::after { content: ""; position: absolute; left: 3px; top: 3px; width: 3px; height: 3px; border-radius: 50%; background: var(--surface); }
.pm-mk.poles::before, .pm-mk.poles::after { content: ""; position: absolute; left: -1.5px; right: -1.5px; top: 3.5px; height: 2px; border-radius: 1px; background: var(--pole); rotate: 45deg; }
.pm-mk.poles::after { rotate: -45deg; }
.pm-glyph { font: italic 500 15px/16px var(--f-math); color: var(--ink-2); }
.pm-mark { position: fixed; z-index: 29; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; pointer-events: none;
  border: 1.5px solid var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
.pm-ring { position: fixed; z-index: 29; width: 44px; height: 44px; margin: -22px 0 0 -22px; pointer-events: none; }
.pm-ring svg { display: block; rotate: -90deg; }
.pm-ring circle { fill: none; stroke: color-mix(in srgb, var(--accent) 22%, transparent); stroke-width: 3; }
.pm-ring circle.pm-ring-fill { stroke: var(--accent); stroke-dasharray: 113.1; stroke-dashoffset: 113.1; animation: pm-ring 330ms linear 120ms forwards; }
.pm-ring.full circle.pm-ring-fill { animation: none; stroke-dashoffset: 0; }
@keyframes pm-ring { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .pm-ring circle.pm-ring-fill { animation-duration: 1ms; animation-delay: 449ms; } }
`;
  function init(a) {
    api = a;
    if (!document.getElementById('pm-style')) { const st = document.createElement('style'); st.id = 'pm-style'; st.textContent = CSS; document.head.append(st); }
    register('object', objectItems);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointermove', onPointer, { capture: true, passive: true });
  }
  const PM = {
    init, open, register, close, isOpen, announce,
    justOpened: () => performance.now() - openedAt < 400,
    ringStart, ringFull, ringStop,
    lastCtx: null,
    _t: { fmtCx, dpFor, ORDER },
  };
  return PM;
})();
if (typeof window !== 'undefined') window.PlaneMenu = PlaneMenu;
