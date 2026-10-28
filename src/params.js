'use strict';
// Shared numbers, links and scene files (v15; notes/ui-redesign-2/constructions/DESIGN.md 1, phase 1).
//
// A shared number is {name, value, min, max, step} (a free number, a slider) or {name, expr, min, max, step} (a number
// by formula of other numbers: b = 2a + 1). The list lives in the app's state (S.params) so that saving, undo and the
// language switch keep it; without the app (node tests) Params keeps its own list.
//
// The formula hook: Params sets Expr's name scope (Expr.setNames), so every field that goes through the parser reads
// names as their values: step parameters (Funcs.build), zeros and poles, shape fields, region and curve formulas.
// A field's text keeps the names; the app re-evaluates the fields that use a number when it changes.
//
// Public API (the interface between the v15 builds): mount(el), list(), get(name), set(name, value), on('change', fn),
// and the hook (install()). Also: add, remove, rename, check, display, tex, namesIn, unknownIn, resolve, evalReal,
// attach(host), and the links and scene files (encodeLink, decodeLink, scene, readScene).
const Params = (() => {
  let host = null;                 // the app: {list(), formulas(), commit(), toast(), undoToast(), openMenu(), ...}
  let local = [];                  // the list without the app
  const arr = () => (host && typeof host.list === 'function' ? host.list() : local);
  const evs = { change: [], structure: [] };
  function on(type, fn) { (evs[type] || (evs[type] = [])).push(fn); return () => { const l = evs[type]; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }; }
  function emit(type, ...a) { for (const fn of (evs[type] || []).slice()) { try { fn(...a); } catch (e) { console.error(e); } } }

  // ---------------- names ----------------
  const SUBD = '₀₁₂₃₄₅₆₇₈₉';
  const GREEK = Expr.GREEK || {};
  const GREEK_CH = new Set(Object.values(GREEK));
  // a name as shown: a₁, α₂ (the index as subscript digits)
  const display = (nm) => String(nm).replace(/\d+$/, (d) => [...d].map((c) => SUBD[+c]).join(''));
  const tex = (nm) => (Expr.nameTex ? Expr.nameTex(nm) : nm);
  // the canonical name of what was typed: a, a1 (from a1, a_1, a_{1}, a₁), α (from α, alpha, \alpha); null if none
  function canon(raw) {
    let s = String(raw == null ? '' : raw).trim().replace(/^\\/, '');
    s = s.replace(/[₀-₉]/g, (c) => String(SUBD.indexOf(c))).replace(/_\{?\s*(\d+)\s*\}?$/, '$1');
    const m = /^([A-Za-z]+|[Ͱ-Ͽ])(\d*)$/.exec(s);
    if (!m) return null;
    let base = m[1];
    if (base.length > 1) { if (!GREEK[base] && !{ varepsilon: 1, varphi: 1, varrho: 1 }[base]) return { word: base }; base = GREEK[base] || { varepsilon: 'ε', varphi: 'φ', varrho: 'ρ' }[base]; }
    return base + m[2];
  }
  // why a name cannot be a shared number (a clear message), or '' when it can
  const TAKEN = () => ({
    z: $t('z is the variable of the map'), w: $t('w is the variable of the image plane'),
    x: $t('x and y are Re z and Im z'), y: $t('x and y are Re z and Im z'),
    r: $t('r is |z| in region formulas: use ρ or R'), i: $t('i is the imaginary unit'), e: $t("e is Euler's number"),
    'θ': $t('θ is arg z in region formulas: use φ or t'), 'π': $t('π is the constant 3.14159…'), 'ϑ': $t('θ is arg z in region formulas: use φ or t'),
  });
  // (review russian-7: a Cyrillic look-alike typed on a Russian layout reads as its Latin letter, as in formulas)
  const LOOK = { 'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'у': 'y', 'к': 'k', 'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X' };
  function check(raw, { exists = true } = {}) {
    const s0 = String(raw == null ? '' : raw).trim();
    if (!s0) return { error: $t('Type a name: one letter, such as a or k, or a Greek letter') };
    const s = /^[асеорхукАВСЕНКМОРТХ][0-9₀-₉_]*$/.test(s0) ? LOOK[s0[0]] + s0.slice(1) : s0;
    const cy = s.match(/[А-Яа-яЁё]/);
    if (cy) return { error: $t('The letter “{x}” is Cyrillic: names are written in Latin letters. Switch the keyboard layout.', { x: cy[0] }) };
    const c = canon(s);
    if (!c) return { error: $t('A name is one letter, with an index if you like (a, k, a₁), or a Greek letter (α, ρ)') };
    if (typeof c === 'object') {
      if (c.word === 'pi') return { error: TAKEN()['π'] };
      if (c.word === 'theta' || c.word === 'vartheta') return { error: TAKEN()['θ'] };
      return { error: $t('{f} is a function or a word: a name is one letter (a, k, a₁) or a Greek letter (α, ρ)', { f: c.word }) };
    }
    const base = c.replace(/\d+$/, '');
    const t = TAKEN()[base];
    if (t) return { error: t };
    if (base.length === 1 && /[Ͱ-Ͽ]/.test(base) && !GREEK_CH.has(base)) return { error: $t('A name is one letter, with an index if you like (a, k, a₁), or a Greek letter (α, ρ)') };
    if (exists && find(c)) return { error: $t('{x} already exists', { x: display(c) }) };
    return { name: c };
  }

  // ---------------- the numbers ----------------
  const find = (nm) => arr().find((p) => p.name === nm) || null;
  const list = () => arr().map((p) => Object.assign({}, p));
  const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
  // a shared number is its real part p.value plus an imaginary part p.im, kept only when it is not 0 (a real number saves
  // exactly as before; a build that predates complex numbers reads the real part and ignores the rest)
  const imOf = (p) => (p && isNum(p.im) ? p.im : 0);
  const isComplex = (nm) => { const p = typeof nm === 'string' ? find(nm) : nm; return imOf(p) !== 0; };
  // the real part (what a real-only field reads)
  function get(nm) { const p = find(nm); return p && isNum(p.value) ? p.value : undefined; }
  // {re, im}
  function getC(nm) { const p = find(nm); return p && isNum(p.value) ? { re: p.value, im: imOf(p) } : undefined; }
  // what the formula parser reads: a real number as a number, a complex one as {re, im}
  function valueOf(nm) { const c = getC(nm); return c && c.im !== 0 ? c : c && c.re; }
  const isVal = (x) => x && typeof x === 'object' && isNum(x.re) && isNum(x.im);
  // a number, {re, im} or a text of a constant, read as {re, im} (a throw is a message)
  function toC(x) {
    if (isNum(x)) return { re: x, im: 0 };
    if (isVal(x)) return { re: x.re, im: x.im };
    return null;
  }
  // names in a text (in order, without repeats) and the ones not defined yet
  function namesIn(src) {
    if (src == null || typeof Expr.nameSpans !== 'function') return [];
    const out = [];
    for (const sp of Expr.nameSpans(String(src))) if (!out.includes(sp.name)) out.push(sp.name);
    return out;
  }
  const unknownIn = (src) => namesIn(src).filter((nm) => !find(nm));
  // (review verify-7: a value or formula that fails because of a Cyrillic letter, a look-alike read as an unknown Latin
  // name or a letter the parser cannot read, says so in the name field's words, not with a Latin name the user never
  // typed; a look-alike of a known number still reads as that number)
  function cyrMsg(src, msg) {
    if (!msg) return msg;
    const cy = String(src).match(/[А-Яа-яЁё]/g);
    if (!cy) return msg;
    let unk = [];
    try { unk = unknownIn(src).map((n) => String(n).replace(/\d+$/, '')); } catch (e) { /* unreadable: the letter is the reason */ }
    const c = cy.find((ch) => !LOOK[ch] || unk.includes(LOOK[ch]));
    return c ? $t('The letter “{x}” is Cyrillic: names are written in Latin letters. Switch the keyboard layout.', { x: c }) : msg;
  }
  // the value of a real constant formula (the names read as their values); throws a message
  function evalReal(src) {
    const v = Expr.constValue(String(src));
    if (Math.abs(v.im) > 1e-12 * Math.max(1, Math.abs(v.re))) {
      const c = namesIn(src).find(isComplex);
      throw new Error(c ? $t('{x} is complex: use Re {x}, Im {x} or |{x}|', { x: display(c) }) : $t('A number here must be real'));
    }
    return v.re;
  }
  // the value of a constant formula as {re, im}; a rounding-size imaginary part of a real result is dropped
  function evalVal(src) {
    const v = Expr.constValue(String(src));
    return { re: v.re, im: Math.abs(v.im) > 1e-12 * Math.max(1, Math.abs(v.re)) ? v.im : 0 };
  }
  // the text with each name replaced by its value in parentheses (the exact shortest decimal): what the shapes'
  // renderer reads, so every cache keyed by the text sees a new value (Re z = a -> Re z = (0.5))
  function resolve(src, values) {
    const s = String(src);
    const sp = typeof Expr.nameSpans === 'function' ? Expr.nameSpans(s) : [];
    if (!sp.length) return s;
    let out = '', at = 0;
    for (const x of sp) {
      const v = values && x.name in values ? values[x.name] : valueOf(x.name);
      out += s.slice(at, x.pos) + (v === undefined ? s.slice(x.pos, x.pos + x.len) : `(${reprC(v)})`);
      at = x.pos + x.len;
    }
    return out + s.slice(at);
  }
  const repr = (v) => (Object.is(v, -0) ? '0' : String(v));
  // a value as text the parser reads back exactly: 0.5, 0.5+0.3i, -0.5-0.3i, 0.3i (v: a number or {re, im})
  function reprC(v) {
    if (!isVal(v) || v.im === 0) return repr(isVal(v) ? v.re : v);
    const im = v.im === 1 ? 'i' : v.im === -1 ? '-i' : `${repr(v.im)}i`;
    if (v.re === 0) return im;
    return `${repr(v.re)}${im[0] === '-' ? '' : '+'}${im}`;
  }
  // the text with name old written as text instead (rename, or the value when a number is deleted)
  function replaceName(src, old, text) {
    const s = String(src);
    const sp = (typeof Expr.nameSpans === 'function' ? Expr.nameSpans(s) : []).filter((x) => x.name === old);
    if (!sp.length) return s;
    let out = '', at = 0;
    for (const x of sp) {
      // a run like "az" holds a one-letter name: a new name with an index needs a space after it (a1z -> a1 z)
      const after = s[x.pos + x.len] || '', before = x.pos > 0 ? s[x.pos - 1] : '';
      out += s.slice(at, x.pos) + ((/[A-Za-z]/.test(before) && /^[A-Za-z0-9\u0370-\u03FF]/.test(text)) || (/\d/.test(before) && /^\d/.test(text)) ? ' ' : '') + text + (/[A-Za-z0-9]/.test(after) && /[A-Za-z0-9\u0370-\u03FF]$/.test(text) ? ' ' : '');
      at = x.pos + x.len;
    }
    return out + s.slice(at);
  }
  const niceRange = (v) => {
    const a = Math.abs(v);
    if (a <= 2) return [-2, 2];
    const m = Math.pow(10, Math.ceil(Math.log10(a)));
    const top = [1, 2, 5, 10].map((k) => k * m / 10).find((x) => x >= a) || m;
    return [-top, top];
  };
  // a new number: {name, value, min, max, step}
  function add(name, o = {}) {
    const c = check(name);
    if (c.error) throw new Error(c.error);
    const cv = toC(o.value) || { re: 1, im: 0 };
    const v = cv.re;
    const [lo, hi] = isNum(o.min) && isNum(o.max) && o.max > o.min ? [o.min, o.max] : niceRange(v);
    const p = { name: c.name, value: v, min: Math.min(lo, v), max: Math.max(hi, v), step: isNum(o.step) && o.step > 0 ? o.step : 0.01 };
    if (cv.im !== 0) p.im = cv.im;
    if (typeof o.expr === 'string' && o.expr.trim()) { p.expr = o.expr.trim(); }
    arr().push(p);
    if (p.expr) recompute();
    emit('structure', { added: p.name });
    emit('change', { names: [p.name], added: true });
    render();
    return p;
  }
  function remove(name) {
    const a = arr(), i = a.findIndex((p) => p.name === name);
    if (i < 0) return false;
    a.splice(i, 1);
    stopPlay(name);
    emit('structure', { removed: name });
    emit('change', { names: [name], removed: true });
    render();
    return true;
  }
  // the numbers by formula in dependency order; a cycle is reported as a message (a -> b -> a)
  function order() {
    const a = arr(), byName = new Map(a.map((p) => [p.name, p])), seen = new Map(), out = [];
    function visit(p, path) {
      const st = seen.get(p.name);
      if (st === 2) return null;
      if (st === 1) return path.concat(p.name);
      seen.set(p.name, 1);
      if (p.expr) for (const d of namesIn(p.expr)) { const q = byName.get(d); if (q) { const c = visit(q, path.concat(p.name)); if (c) return c; } }
      seen.set(p.name, 2);
      out.push(p);
      return null;
    }
    for (const p of a) { const c = visit(p, []); if (c) return { cycle: c.slice(c.indexOf(c[c.length - 1])) }; }
    return { order: out };
  }
  // the values of the numbers by formula (in dependency order); the names whose value changed
  function recompute() {
    const o = order();
    if (o.cycle) return [];
    const changed = [];
    for (const p of o.order) {
      if (!p.expr) continue;
      let v;
      try { v = evalVal(p.expr); } catch (e) { p._err = e.message; continue; }
      delete p._err;
      if (v.re !== p.value || v.im !== imOf(p)) {
        p.value = v.re;
        if (v.im !== 0) p.im = v.im; else delete p.im;
        changed.push(p.name);
      }
    }
    return changed;
  }
  // the numbers that depend on one of names (through formulas), names included
  function closure(names) {
    const out = new Set(names);
    let grew = true;
    while (grew) {
      grew = false;
      for (const p of arr()) if (p.expr && !out.has(p.name) && namesIn(p.expr).some((d) => out.has(d))) { out.add(p.name); grew = true; }
    }
    return [...out];
  }
  // set a number: a value (a free number) or a formula text (a number by formula when it holds names). o.live: a
  // drag or play frame (the app draws at motion quality and commits nothing); returns '' or an error message
  function set(name, value, o = {}) {
    const p = find(name);
    if (!p) return $t('{x} is not defined', { x: display(name) });
    if (typeof value === 'string') {
      const txt = value.trim();
      const ns = namesIn(txt);
      if (ns.includes(name)) return $t('{x} would depend on itself', { x: display(name) });
      if (ns.length) {
        const unknown = ns.filter((n) => !find(n));
        if (unknown.length) return $t('{x} is not defined', { x: unknown.map(display).join(', ') });
        const was = p.expr;
        p.expr = txt;
        const ord = order();
        if (ord.cycle) { if (was) p.expr = was; else delete p.expr; return $t('{x} would depend on itself: {path}', { x: display(name), path: ord.cycle.map(display).join(' → ') }); }
        try { evalVal(txt); } catch (e) { if (was) p.expr = was; else delete p.expr; return e.message; }
        const ch = recompute();
        fire(closure([name]).concat(ch), o);
        render();
        return '';
      }
      let v;
      try { v = evalVal(txt); } catch (e) { return e.message; }
      value = v.im !== 0 ? v : v.re;
    }
    const cv = toC(value);
    if (!cv) return $t('Enter a number');
    const freed = !!p.expr;
    delete p.expr; delete p._err;
    // (the range belongs to the real part: a complex number is moved on the plane, not by the slider)
    if (cv.im === 0) {
      if (cv.re < p.min) p.min = cv.re;
      if (cv.re > p.max) p.max = cv.re;
    }
    if (p.value === cv.re && imOf(p) === cv.im && !freed) return '';
    p.value = cv.re;
    if (cv.im !== 0) p.im = cv.im; else delete p.im;
    recompute();
    fire(closure([name]), o);
    if (!o.live || o.fromUI !== true) render(o.live ? name : null);
    return '';
  }
  function fire(names, o) { emit('change', Object.assign({ names }, o && o.live ? { live: true } : {}, o && o.play ? { play: true } : {})); }
  function setRange(name, min, max, step) {
    const p = find(name);
    if (!p) return '';
    if (!(isNum(min) && isNum(max) && max > min)) return $t('The range needs min < max');
    if (step != null && !(isNum(step) && step > 0)) return $t('The step must be positive');
    p.min = min; p.max = max; if (step != null) p.step = step;
    if (!p.expr && (p.value < min || p.value > max)) { p.value = Math.max(min, Math.min(max, p.value)); fire(closure([name]), {}); }
    render();
    return '';
  }
  // rename a number and every formula that uses it (the app's formulas: steps, shapes; the numbers' own)
  function rename(old, raw) {
    const p = find(old);
    if (!p) return $t('{x} is not defined', { x: display(old) });
    const c = check(raw);
    if (c.error) return c.error;
    const nn = c.name, t = nn;
    for (const f of formulas()) { const s = f.get(); const r = replaceName(s, old, t); if (r !== s) f.set(r); }
    for (const q of arr()) if (q.expr) q.expr = replaceName(q.expr, old, t);
    p.name = nn;
    if (playing.has(old)) { playing.set(nn, playing.get(old)); playing.delete(old); }
    emit('structure', { renamed: [old, nn] });
    emit('change', { names: [nn], renamed: true });
    render();
    return '';
  }
  // the formulas of the app that hold names: [{get(), set(text), label}]
  const formulas = () => (host && typeof host.formulas === 'function' ? host.formulas() : []);
  function usedBy(name) {
    const out = [];
    for (const f of formulas()) if (namesIn(f.get()).includes(name) && !out.includes(f.label)) out.push(f.label);
    for (const q of arr()) if (q.expr && q.name !== name && namesIn(q.expr).includes(name)) out.push(display(q.name));
    return out;
  }
  // delete a number that formulas use: they keep its value, written in their place
  function inline(name) {
    const p = find(name);
    if (!p) return;
    const t = `(${reprC({ re: p.value, im: imOf(p) })})`;
    for (const f of formulas()) { const s = f.get(); const r = replaceName(s, name, t); if (r !== s) f.set(r); }
    for (const q of arr()) if (q.expr) q.expr = replaceName(q.expr, name, t);
  }
  // a saved list from another build or a damaged file: valid entries only (unique valid names, finite ranges)
  function sanitize(raw) {
    const out = [];
    if (!Array.isArray(raw)) return out;
    for (const q of raw) {
      if (!q || typeof q !== 'object') continue;
      const c = canon(q.name);
      if (!c || typeof c === 'object' || out.some((p) => p.name === c)) continue;
      const base = c.replace(/\d+$/, '');
      if (TAKEN()[base] || (/[Ͱ-Ͽ]/.test(base) && !GREEK_CH.has(base))) continue;
      const v = isNum(q.value) ? q.value : 1;
      let min = isNum(q.min) ? q.min : niceRange(v)[0], max = isNum(q.max) ? q.max : niceRange(v)[1];
      if (!(max > min)) [min, max] = niceRange(v);
      const p = { name: c, value: v, min: Math.min(min, v), max: Math.max(max, v), step: isNum(q.step) && q.step > 0 ? q.step : 0.01 };
      if (isNum(q.im) && q.im !== 0) p.im = q.im;
      if (typeof q.expr === 'string' && q.expr.trim()) p.expr = q.expr.trim().slice(0, 500);
      if (q.play === 'bounce' || q.play === 'loop') p.play = q.play;
      out.push(p);
    }
    return out;
  }

  // ---------------- the formula hook ----------------
  function install() {
    if (typeof Expr.setNames === 'function') Expr.setNames({ get: valueOf, display });
  }
  function attach(h) {
    host = h;
    install();
  }

  // ---------------- play ----------------
  // bounce between min and max in 4 s (a number by formula does not play); a frame is a live change (no undo step)
  const playing = new Map();     // name -> {dir, last}
  let playRaf = 0;
  function togglePlay(name) {
    const p = find(name);
    if (!p || p.expr || isComplex(p)) return;
    if (playing.has(name)) { stopPlay(name); return; }
    playing.set(name, { dir: 1, last: 0 });
    if (!playRaf) playRaf = requestAnimationFrame(playFrame);
    render();
  }
  function stopPlay(name) {
    if (!playing.has(name)) return;
    playing.delete(name);
    emit('change', { names: closure([name]), rest: true, play: true });
    render();
  }
  function playFrame(ts) {
    playRaf = 0;
    const names = [];
    for (const [nm, st] of playing) {
      const p = find(nm);
      if (!p || p.expr) { playing.delete(nm); continue; }
      const dt = st.last ? Math.min(0.1, (ts - st.last) / 1000) : 0;
      st.last = ts;
      const span = p.max - p.min, speed = span / 4;
      let v = p.value + st.dir * speed * dt;
      if (p.play === 'loop') { if (v > p.max) v = p.min + (v - p.max); } else {
        if (v > p.max) { v = p.max - (v - p.max); st.dir = -1; }
        if (v < p.min) { v = p.min + (p.min - v); st.dir = 1; }
      }
      const q = p.step > 0 ? Math.round((v - p.min) / p.step) * p.step + p.min : v;
      p.value = Math.max(p.min, Math.min(p.max, +q.toPrecision(12)));
      names.push(nm);
      syncRow(nm);
    }
    if (names.length) { recompute(); fire(closure(names), { live: true, play: true }); }
    if (playing.size) playRaf = requestAnimationFrame(playFrame);
  }
  const isPlaying = (name) => (name == null ? playing.size > 0 : playing.has(name));

  // ---------------- the Parameters component ----------------
  // Params.mount(el): a section with one 56 px row per number (line 1: the name, "=", the value field, play, ⋯; line 2:
  // the slider with its range ends) and "+ Number" (constructions/DESIGN.md 3, INTERFACE.md).
  const mounts = new Set();
  const ICON = {
    play: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M5 3.5v9l7-4.5z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><rect x="4.25" y="3.5" width="2.5" height="9" rx=".5"/><rect x="9.25" y="3.5" width="2.5" height="9" rx=".5"/></svg>',
    more: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><circle cx="3.5" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12.5" cy="8" r="1.1"/></svg>',
    plus: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
  };
  const CSS = `
.prm { display: flex; flex-direction: column; min-height: 240px; min-width: 0; }
.prm > h2 { flex: 0 0 auto; min-height: 28px; margin: 0 0 4px; }
.prm-list { flex: 0 1 auto; overflow-y: auto; min-height: 0; }
/* ([v16.5 fix user-5] the list takes its own height, so + Number sits right under the last number or the hint, never at
   the section's foot; a long list still scrolls) */
.prm-row { display: grid; grid-template-rows: 24px 20px; row-gap: 4px; padding: 2px 0 6px; min-height: 56px; box-sizing: border-box; border-bottom: 1px solid var(--line); }
.prm-row:last-child { border-bottom: 0; }
.prm-l1 { display: flex; align-items: center; gap: 6px; min-width: 0; }
.prm-name { font: italic 500 15px/20px var(--f-math); color: var(--ink); min-width: 14px; white-space: nowrap; background: none; border: 0; padding: 0 2px; cursor: pointer; border-radius: var(--r-1, 3px); }
.prm-name:hover { background: var(--well); }
.prm-eq { font: 400 13px/20px var(--f-math); color: var(--ink-2); }
.prm-val { width: 72px; flex: 0 0 72px; height: 24px; font: 400 12px/16px var(--f-mono); }
.prm-val.expr { flex: 1 1 auto; width: auto; }
.prm-sp { flex: 1 1 auto; }
.prm-row .icon-btn { width: 24px; height: 24px; flex: 0 0 24px; }
.prm-play[aria-pressed="true"] { color: var(--accent); }
.prm-l2 { display: flex; align-items: center; gap: 6px; min-width: 0; }
.prm-l2 input[type="range"] { flex: 1 1 auto; width: 100%; min-width: 0; margin: 0; accent-color: var(--accent); }
.prm-end { font: var(--t-micro); color: var(--muted); white-space: nowrap; min-width: 18px; }
.prm-end.hi { text-align: right; }
.prm-note { font: var(--t-micro); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prm-err { font: var(--t-micro); color: var(--error, #B4231A); grid-column: 1 / -1; }
.prm-row.has-err { grid-template-rows: 24px 20px auto; }
.prm-edit { display: flex; align-items: center; gap: 4px; min-width: 0; }
.prm-edit .inp { width: 52px; flex: 1 1 52px; height: 20px; font: 400 11px/14px var(--f-mono); padding: 0 4px; }
.prm-edit label { font: var(--t-micro); color: var(--muted); }
.prm-ask { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 0; font: var(--t-label); color: var(--ink-2); }
.prm-add { display: flex; align-items: center; gap: 6px; min-height: 32px; flex: 0 0 auto; }
.prm-add .btn { gap: 4px; }
.prm-new { display: flex; align-items: center; gap: 6px; min-height: 32px; }
.prm-new .inp { width: 64px; height: 24px; }
.prm-empty { font: var(--t-label); color: var(--muted); padding: 4px 0 8px; }
.prm-empty i { font: italic 500 13px/16px var(--f-math); color: var(--ink-2); }
.prm-tools { display: flex; gap: 4px; flex-wrap: wrap; }
`;
  function style() {
    if (typeof document === 'undefined' || document.getElementById('prm-css')) return;
    const s = document.createElement('style');
    s.id = 'prm-css';
    s.textContent = CSS;
    document.head.append(s);
  }
  const fmt = (v) => {
    if (!isNum(v)) return '';
    const s = String(+v.toPrecision(6));
    // (screen text: the true minus, U+2212, as the rest of the interface; review math-14, russian-10)
    return (typeof I18N !== 'undefined' && I18N.lang !== 'en' && I18N.num ? I18N.num(s) : s).replace(/-/g, '−');
  };
  // the text of a value field: the formula of a number by formula, else the value (the exact value when short)
  const valText = (p) => (p.expr ? p.expr : isComplex(p) ? reprC({ re: +p.value.toPrecision(12), im: +p.im.toPrecision(12) }) : String(+p.value.toPrecision(12)));
  // (as shown in an idle field: the true minus; the parser reads it back, review math-14)
  const valShow = (p) => valText(p).replace(/-/g, '−');
  function mount(el) {
    style();
    const m = { el, open: null, ask: null, adding: false };
    mounts.add(m);
    el.classList.add('prm-host');
    draw(m);
    return { el, refresh: () => draw(m), destroy: () => { mounts.delete(m); el.innerHTML = ''; } };
  }
  // [v16.5 fix user-1] the "Not used yet" line follows the chain: which numbers nothing uses, and the step Use in would
  // take; the app calls syncUnused when the chain or the selected step changes, and the panel redraws only when that
  // changed (a step added with its number in one undo step, from the palette, used to leave the line stale)
  let unusedSig = null;
  const unusedKey = () => arr().map((p) => (usedBy(p.name).length ? '' : p.name + '>' + (((host && host.useIn && host.useIn(p.name)) || {}).label || ''))).join('|');
  function syncUnused() { if (!mounts.size) return; const k = unusedKey(); if (k !== unusedSig) render(); }
  function render(skip) {
    if (!skip) unusedSig = unusedKey();
    for (const m of mounts) {
      if (!m.el.isConnected) continue;   // (review regress-7: a detached mount is never drawn)
      // while a slider of the panel is dragged, only the other rows' values follow (the row being dragged keeps its DOM)
      if (skip) { syncAll(m, skip); continue; }
      draw(m);
    }
  }
  function syncRow(name) { for (const m of mounts) syncAll(m, null, name); }
  function syncAll(m, skip, only) {
    for (const row of m.el.querySelectorAll('.prm-row')) {
      const nm = row.dataset.name, p = find(nm);
      if (!p || (only && nm !== only)) continue;
      const inp = row.querySelector('.prm-val'), rg = row.querySelector('input[type="range"]');
      if (inp && document.activeElement !== inp && inp.value !== valShow(p)) inp.value = valShow(p);
      if (rg && nm !== skip && +rg.value !== p.value) rg.value = String(p.value);
    }
  }
  function draw(m) {
    const el = m.el;
    const focus = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.prmFocus : null;
    el.innerHTML = '';
    // (v16.5 UX65: one name, Numbers, for the section, the key, the hint and the button)
    const sec = h('section', { class: 'psec prm', 'aria-label': $t('Numbers') });
    // (review design-17: one add control, + Number at the end of the list)
    sec.append(h('h2', null, h('span', { class: 'grow' }, $t('Numbers'))));
    const listEl = h('div', { class: 'prm-list', role: 'list' });
    const a = arr();
    if (!a.length && !m.adding) listEl.append(h('div', { class: 'prm-empty', html: $t('Type a new letter in any formula, such as <i>Re z = a</i>, or press + Number.') }));
    for (const p of a) listEl.append(row(m, p));
    sec.append(listEl);
    if (m.adding) sec.append(newRow(m));
    else sec.append(h('div', { class: 'prm-add' }, h('button', { class: 'btn ghost small', type: 'button', 'data-prm-focus': 'add', onclick: () => { m.adding = true; draw(m); } }, h('span', { html: ICON.plus }), $t('Number'))));
    el.append(sec);
    if (focus) { const f = el.querySelector(`[data-prm-focus="${CSS_ESC(focus)}"]`); if (f) f.focus({ preventScroll: true }); }
  }
  const CSS_ESC = (s) => (typeof CSS !== 'undefined' && window.CSS && window.CSS.escape ? window.CSS.escape(s) : String(s).replace(/"/g, '\\"'));
  function newRow(m) {
    // (v16.5 UX32: the next free letter is there as real text, selected: Add works at once, and typing replaces it)
    const inp = h('input', { class: 'inp mono', 'aria-label': $t('Name of the new number'), value: nextFree(), spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'data-prm-focus': 'new' });
    const err = h('div', { class: 'prm-err', role: 'alert' });
    const ok = () => {
      const c = check(inp.value);
      if (c.error) { err.textContent = c.error; inp.classList.add('bad'); return; }
      m.adding = false;
      add(c.name);
      commit();
      announce($t('Added the number {x}', { x: display(c.name) }));
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } if (e.key === 'Escape') { e.preventDefault(); m.adding = false; draw(m); } });
    inp.addEventListener('input', () => { err.textContent = ''; inp.classList.remove('bad'); });
    const box = h('div', { class: 'prm-new' }, h('span', { class: 'prm-eq' }, $t('Name')), inp,
      h('button', { class: 'btn small', type: 'button', onclick: ok }, $t('Add')),
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => { m.adding = false; draw(m); } }, $t('Cancel')));
    setTimeout(() => { if (inp.isConnected) { inp.focus(); inp.select(); } }, 0);
    return h('div', null, box, err);
  }
  // (v16.5 UX32) the first letter not taken by a number or by the app: a, b, c, …
  function nextFree() {
    for (const c of 'abcdghkmnpqrstuvαβγλμρ') if (!check(c).error) return c;
    return '';
  }
  const commit = () => { if (host && host.commit) host.commit(); };
  const announce = (msg) => { if (host && host.announce) host.announce(msg); };
  function row(m, p) {
    const nm = p.name, d = display(nm);
    const r = h('div', { class: 'prm-row', role: 'listitem', 'data-name': nm });
    const nameBtn = h('button', { class: 'prm-name', type: 'button', 'data-tip': $t('Rename'), 'aria-label': $t('Rename {x}', { x: d }), 'data-prm-focus': 'n:' + nm, onclick: () => { m.open = { name: nm, what: 'rename' }; draw(m); } }, d);
    const val = h('input', { class: 'inp mono prm-val' + (p.expr ? ' expr' : ''), value: valShow(p), spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'aria-label': $t('Value of {x}', { x: d }), 'data-prm-focus': 'v:' + nm });
    const err = h('div', { class: 'prm-err', role: 'alert', hidden: true });
    const showErr = (msg) => { err.textContent = msg || ''; err.hidden = !msg; r.classList.toggle('has-err', !!msg); val.classList.toggle('bad', !!msg); };
    let before = null;
    val.addEventListener('focus', () => { before = JSON.stringify(p); });
    const apply = () => {
      const t = val.value.trim().replace(/(\d),(\d)/g, '$1.$2');
      if (!t) { val.value = valShow(p); showErr(''); return; }
      const msg = cyrMsg(t, set(nm, t));
      showErr(msg);
      if (!msg && JSON.stringify(find(nm)) !== before) { commit(); before = JSON.stringify(find(nm)); }
    };
    val.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } if (e.key === 'Escape') { val.value = valShow(p); showErr(''); val.blur(); } });
    val.addEventListener('change', apply);
    const playBtn = h('button', { class: 'icon-btn prm-play', type: 'button', 'aria-pressed': String(playing.has(nm)), disabled: p.expr || isComplex(p) ? true : null,
      'data-tip': playing.has(nm) ? $t('Pause') : $t('Play: {x} runs between its ends', { x: d }), 'aria-label': playing.has(nm) ? $t('Pause {x}', { x: d }) : $t('Play {x}', { x: d }),
      html: playing.has(nm) ? ICON.pause : ICON.play, 'data-prm-focus': 'p:' + nm, onclick: () => togglePlay(nm) });
    const moreBtn = h('button', { class: 'icon-btn prm-more', type: 'button', 'aria-haspopup': 'menu', 'data-tip': $t('More'), 'aria-label': $t('More for {x}', { x: d }), html: ICON.more, 'data-prm-focus': 'm:' + nm,
      onclick: (e) => menu(m, p, e.currentTarget) });
    const l1 = h('div', { class: 'prm-l1' }, nameBtn, h('span', { class: 'prm-eq' }, '='), val, playBtn, h('span', { class: 'prm-sp' }), moreBtn);
    if (m.open && m.open.name === nm && m.open.what === 'rename') l1.replaceChild(renameEd(m, p), nameBtn);
    r.append(l1);
    if (m.open && m.open.name === nm && m.open.what === 'range') r.append(rangeEd(m, p));
    else if (isComplex(p) && !p.expr) {
      // a complex number has no slider: the real range does not describe it
      r.append(h('div', { class: 'prm-l2' }, h('span', { class: 'prm-note' }, $t('A complex number'))));
    } else if (p.expr) {
      const used = namesIn(p.expr).map(display).join(', ');
      r.append(h('div', { class: 'prm-l2' }, h('span', { class: 'prm-note' }, $t('= {v}, from {x}', { v: isComplex(p) ? valText(p).replace(/-/g, '−') : fmt(p.value), x: used }))));
    } else {
      const rg = h('input', { type: 'range', min: String(p.min), max: String(p.max), step: String(p.step || 'any'), value: String(p.value), 'aria-label': $t('{x} from {min} to {max}', { x: d, min: fmt(p.min), max: fmt(p.max) }), 'data-prm-focus': 'r:' + nm });
      let start = null;
      rg.addEventListener('pointerdown', () => { start = p.value; });
      rg.addEventListener('input', () => {
        if (start == null) start = p.value;
        set(nm, +rg.value, { live: true, fromUI: true });
        if (document.activeElement !== val) val.value = valShow(p);
      });
      rg.addEventListener('change', () => {
        set(nm, +rg.value, { fromUI: true });
        emit('change', { names: closure([nm]), rest: true });
        if (start == null || p.value !== start) commit();
        start = null;
      });
      r.append(h('div', { class: 'prm-l2' }, h('span', { class: 'prm-end', 'aria-hidden': 'true' }, fmt(p.min)), rg, h('span', { class: 'prm-end hi', 'aria-hidden': 'true' }, fmt(p.max))));
    }
    if (p._err) showErr(p._err);
    r.append(err);
    // (v16.5 UX65: a number nothing uses yet says so, and offers the way in: + a in a formula step)
    if (!usedBy(nm).length) {
      const use = host && host.useIn ? host.useIn(nm) : null;
      r.append(h('div', { class: 'prm-unused' }, h('span', { class: 'prm-note' }, use ? $t('Not used yet.') : $t('Not used yet: type {x} in a formula.', { x: d })),
        use ? h('button', { class: 'btn ghost small prm-use', type: 'button', onclick: () => use.run() }, use.label) : null));
    }
    if (m.ask && m.ask.name === nm) r.append(askDelete(m, p));
    return r;
  }
  function renameEd(m, p) {
    const inp = h('input', { class: 'inp mono', value: display(p.name), spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'aria-label': $t('New name for {x}', { x: display(p.name) }), style: 'width:56px;height:24px', 'data-prm-focus': 'rn:' + p.name });
    const done = (ok) => {
      if (ok) {
        const t = inp.value.trim();
        if (t && canon(t) !== p.name) {
          const msg = rename(p.name, t);
          if (msg) { inp.classList.add('bad'); inp.setAttribute('data-tip', msg); announce(msg); if (host && host.toast) host.toast(msg); return; }
          commit();
        }
      }
      m.open = null; draw(m);
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(true); } if (e.key === 'Escape') { e.preventDefault(); done(false); } });
    inp.addEventListener('blur', () => setTimeout(() => { if (m.open && m.open.what === 'rename') done(true); }, 0));
    setTimeout(() => { if (inp.isConnected) { inp.focus(); inp.select(); } }, 0);
    return inp;
  }
  function rangeEd(m, p) {
    const f = (v, lab) => h('input', { class: 'inp mono', value: String(v), spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'aria-label': lab });
    const lo = f(p.min, $t('Minimum')), hi = f(p.max, $t('Maximum')), st = f(p.step, $t('Step'));
    const ok = () => {
      const rd = (x) => { try { return evalReal(x.value.replace(/(\d),(\d)/g, '$1.$2')); } catch (e) { return NaN; } };
      const msg = setRange(p.name, rd(lo), rd(hi), rd(st));
      if (msg) { if (host && host.toast) host.toast(msg); return; }
      m.open = null; commit(); draw(m);
    };
    for (const x of [lo, hi, st]) x.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } if (e.key === 'Escape') { e.preventDefault(); m.open = null; draw(m); } });
    setTimeout(() => { if (lo.isConnected) lo.focus(); }, 0);
    return h('div', { class: 'prm-edit' }, h('label', null, $t('min')), lo, h('label', null, $t('max')), hi, h('label', null, $t('step')), st,
      h('button', { class: 'btn small', type: 'button', onclick: ok }, $t('Done')));
  }
  function askDelete(m, p) {
    const users = usedBy(p.name);
    return h('div', { class: 'prm-ask', role: 'alertdialog', 'aria-label': $t('Delete {x}', { x: display(p.name) }) },
      h('span', null, $t('Used by {list}. Delete {x} and write its value {v} into those formulas?', { list: users.join(', '), x: display(p.name), v: fmt(p.value) })),
      h('button', { class: 'btn small danger', type: 'button', onclick: () => { m.ask = null; inline(p.name); remove(p.name); emit('change', { names: [p.name], removed: true, inlined: true }); commit(); if (host && host.undoToast) host.undoToast($t('Deleted {x}; its value is in the formulas.', { x: display(p.name) })); } }, $t('Delete')),
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => { m.ask = null; draw(m); } }, $t('Cancel')));
  }
  function menu(m, p, anchor) {
    const items = [
      { label: $t('Range…'), run: () => { m.open = { name: p.name, what: 'range' }; draw(m); } },
      { label: $t('Rename…'), run: () => { m.open = { name: p.name, what: 'rename' }; draw(m); } },
      { label: p.play === 'loop' ? $t('Play back and forth') : $t('Play in a loop'), disabled: !!p.expr, run: () => { p.play = p.play === 'loop' ? 'bounce' : 'loop'; commit(); } },
      { label: $t('Unlink from the formula'), disabled: !p.expr, run: () => { set(p.name, p.value); commit(); } },
      'sep',
      { label: $t('Delete'), danger: true, run: () => {
        if (usedBy(p.name).length) { m.ask = { name: p.name }; draw(m); return; }
        remove(p.name); commit();
        if (host && host.undoToast) host.undoToast($t('Deleted {x}.', { x: display(p.name) }));
      } },
    ];
    if (host && host.openMenu) { host.openMenu(anchor, items); return; }
    const it = items.find((x) => x !== 'sep' && x.label === $t('Delete'));
    if (it) it.run();
  }

  // ---------------- links and scene files ----------------
  // A link holds the figure in its hash: #cmw=1.<base64url of deflate-raw(JSON)> (0.<base64url of JSON> where the
  // browser has no CompressionStream). The JSON is {v: 1, s: state}; the state goes through the app's sanitizeState,
  // so a link made by an earlier build opens as its saved state would.
  const LINK_V = 1;
  const b64u = {
    enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; },
  };
  async function pipe(bytes, Stream, kind) {
    const s = new Blob([bytes]).stream().pipeThrough(new Stream(kind));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const canZip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  async function encodeLink(state) {
    const json = JSON.stringify({ v: LINK_V, s: state });
    const raw = new TextEncoder().encode(json);
    if (canZip()) { try { return '1.' + b64u.enc(await pipe(raw, CompressionStream, 'deflate-raw')); } catch (e) { /* fall through */ } }
    return '0.' + b64u.enc(raw);
  }
  // the state in a link's payload (the part after #cmw=), or throws a message
  async function decodeLink(payload) {
    const m = /^(\d+)\.([A-Za-z0-9_-]+)$/.exec(String(payload || '').trim());
    if (!m) throw new Error($t('This link does not hold a figure.'));
    let bytes;
    try { bytes = b64u.dec(m[2]); } catch (e) { throw new Error($t('This link is damaged.')); }
    if (m[1] === '1') {
      if (!canZip()) throw new Error($t('This browser cannot open compressed links.'));
      try { bytes = await pipe(bytes, DecompressionStream, 'deflate-raw'); } catch (e) { throw new Error($t('This link is damaged.')); }
    } else if (m[1] !== '0') throw new Error($t('This link was made by a newer version of the app.'));
    let o;
    try { o = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw new Error($t('This link is damaged.')); }
    if (!o || typeof o !== 'object' || !o.s || typeof o.s !== 'object') throw new Error($t('This link does not hold a figure.'));
    return o.s;
  }
  const LINK_WARN = 8000, LINK_MAX = 2000000;   // apps and chats cut long links; browsers stop near 2 MB
  // a scene file: {app, kind, version, state}
  const SCENE_V = 1;
  function scene(state) { return JSON.stringify({ app: 'complex-map-workbench', kind: 'scene', version: SCENE_V, saved: new Date().toISOString(), state }, null, 1); }
  function readScene(text) {
    let o;
    try { o = JSON.parse(String(text)); } catch (e) { throw new Error($t('This file is not a scene: it is not JSON.')); }
    if (!o || typeof o !== 'object') throw new Error($t('This file is not a scene of this app.'));
    // a bare saved state (localStorage's JSON) opens too
    if (o.app === undefined && Array.isArray(o.shapes) && Array.isArray(o.steps)) return o;
    if (o.app !== 'complex-map-workbench' || o.kind !== 'scene' || !o.state || typeof o.state !== 'object') throw new Error($t('This file is not a scene of this app.'));
    return o.state;
  }

  return {
    mount, list, get, set, on, install, attach, add, remove, rename, check, canon, display, tex, namesIn, unknownIn, resolve, replaceName,
    evalReal, evalVal, getC, read: valueOf, isComplex, reprC, usedBy, inline, sanitize, recompute, order, closure, setRange, togglePlay, stopPlay, isPlaying, render, syncUnused,
    encodeLink, decodeLink, scene, readScene, LINK_WARN, LINK_MAX, _local: (a) => { local = a || []; },
  };
})();
Params.install();
if (typeof module !== 'undefined') module.exports = Params;
