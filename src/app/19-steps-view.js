  // ---------------- the steps view (#366 prototype, behind ?view=steps) ----------------
  // One plane of the chain z → w₁ → … → w fills the screen. ‹ ›, the arrow keys, the chain strip and (on a touch
  // screen) a swipe from the plane's edge glide from one plane to the next along the step's deformation h_{k,t}.
  // The colour plane (SV.T, a stage) holds the colour: a plane at or before it is coloured by the phase of the
  // map into the colour plane, f_T ∘ … ∘ f_{k+1} (the pull-back of the colour wheel, the colour plot of the map {a: k, b: T});
  // a plane after it shows the shapes carried forward with their pattern (the push-forward). Inside regions (SV.scope
  // 'in') shows the colour only inside the regions in this plane: the z-plane's and earlier planes' regions carried
  // forward, this plane's own, and later planes' pulled back.
  // The view reuses the app's views: a plane at or before the colour plane is Phase (or Landscape), one after it X → Y, always on
  // the left pane alone (solo 'L'); leftStage() is the shown plane, focusMap() the map into the colour plane.
  const SV = {
    // (or a host page that sets window.cmwView = 'steps' before the app starts: the prototype's published page)
    on: (() => { try { return /** @type {any} */ (window).cmwView === 'steps' || new URLSearchParams(location.search).get('view') === 'steps'; } catch (e) { return false; } })(),
    i: 0,            // the shown plane, an index into svPlanes()
    T: -1,           // the colour plane's stage (-1: the last plane, F's)
    scope: 'all',    // 'all' | 'in'
    surf: 'plane',   // 'plane' | 'sphere' | 'land'
    g: HomRange.glider({ omega: 7 }),   // the position x in planes (set directly: a scrub, a swipe, the glide below)
    anim: null,      // the glide to a plane: {from, to, t0, ms}, eased in and out over a fixed time (no spring tail)
    sig: null,       // the chain and shapes last seen (another one: an example or a link was opened)
    drag: null,      // a scrub of the strip or a swipe of the plane: {x0, i0, px, w, id, edge}
    els: null,
    ready: false,    // setup is done: S.sv may be written (before it, the state's own place is still to be read)
  };
  const SV_GPU_MASK = false;
  // the glide's time a plane, by speed (a setting kept on this device)
  const SV_SPEEDS = { fast: 450, normal: 900, slow: 2000, slower: 4500 };
  SV.speed = (() => { try { const v = localStorage.getItem('cmw-sv-speed'); return v && SV_SPEEDS[v] ? v : 'normal'; } catch (e) { return 'normal'; } })();
  // the planes: z and the stage after each active step
  function svPlanes() { return [0].concat(activeSteps()); }
  function svStage(i = SV.i) { const P = svPlanes(); return P[Math.max(0, Math.min(P.length - 1, i))]; }
  function svT() { const P = svPlanes(); return P.includes(SV.T) ? SV.T : P[P.length - 1]; }
  // the shown plane is coloured from the colour plane: at or before it, and not across a d/dz (whose input is z's plane, not w_k's)
  function svColoured(k = svStage()) { const T = svT(); return k <= T && (k === 0 || !derivIn(k, T)); }
  const svMap = () => { const k = svStage(); return k === 0 ? stageMap(svT()) : { mode: 0, a: k, b: svT() }; };
  // (one name for a plane everywhere: the last is w₂ too, F is the name of the map into it)
  const svName = (k) => (k === 0 ? 'z' : `w${sub(k)}`);
  const svNameHtml = (k) => (k === 0 ? '<i>z</i>' : `<i>w</i><sub>${k}</sub>`);
  // the map from plane k into the colour plane T, by name (#435): F from z into the last plane, else f_T ∘ … ∘ f_{k+1}
  // (f₂, f₃∘f₂, f₄∘⋯∘f₂); null when k is T itself (the wheel is the plane's own phase). fmt 'html' or 'text'
  function svMapName(fmt, k = svStage(), T = svT()) {
    const P = svPlanes(), ss = P.filter((s) => s > k && s <= T), h5 = fmt === 'html';
    if (!ss.length) return null;
    if (k === 0 && T === P[P.length - 1]) return h5 ? '<i>F</i>' : 'F';
    const f = (s) => (h5 ? `<i>f</i>${sub(s)}` : `f${sub(s)}`), q = ss.slice().reverse();
    return q.length === 1 ? f(q[0]) : q.length === 2 ? `${f(q[0])}∘${f(q[1])}` : `${f(q[0])}∘⋯∘${f(q[q.length - 1])}`;
  }
  // that map applied to the plane's own variable, "f₂(w₁)"; just the variable when k is T
  const svMapCall = (fmt, k = svStage()) => { const m = svMapName(fmt, k), v = fmt === 'html' ? wHtml(k) : svName(k); return m ? (fmt === 'html' ? `${m}<span class="rm">(</span>${v}<span class="rm">)</span>` : `${m}(${v})`) : v; };
  // the map from the shown plane into the colour plane as a function: what the probe reads (the identity past it, where
  // the plane carries shapes and no colour of its own)
  function svF(k = svStage()) { const T = svT(); return !svColoured(k) ? (z) => z : k === 0 ? stageF(T) : k === T ? (z) => z : rangeF(k, T); }
  // what the key's caption calls the colouring, "arg and |f₂|": the map into the colour plane, or the plane's own variable
  const svKeyName = (k = svStage()) => svMapName('text', k) || svName(k);
  // past the colour plane the colour is carried, so the probe names where its point comes from in the colour plane T: a
  // preimage of it under the map T → shown plane, by a short search over the camera's window (undefined at or before T;
  // null when none is found there or the map has no inverse here, which the readout says as "—")
  function svSource(q) {
    const k = svStage(), T = svT();
    if (k <= T) return undefined;
    if (T > 0 && derivIn(T, k)) return null;
    /** @type {any} */
    let sols = [];
    const F = T === 0 ? stageF(k) : rangeF(T, k), box = paneBox(paneL, leftView());
    try {
      sols = zerosPolesTimed(F, box, { target: { re: q.re, im: q.im }, max: 4 }, 4);
      // (a search that found nothing before its time ran out, a cold first call or a busy frame: once more with more time)
      if (!sols.length && (sols.stopped || sols.incomplete)) sols = zerosPolesTimed(F, box, { target: { re: q.re, im: q.im }, max: 4 }, 16);
    } catch (e) { return null; }
    const hit = sols.filter((r) => r && r.kind !== 'pole' && r.z && CX.isFin(r.z));
    return hit.length ? hit[0].z : null;
  }
  // the plane's title, name · role: "w₁ · phase of f₂" (the shown plane, then the map into the colour plane); past the
  // colour plane the colour is carried by the points, which the role says
  function svTitleParts() {
    const k = svStage(), T = svT(), map = svMapName('html', k, T) || wHtml(k);
    let role;
    if (!svColoured(k)) role = k > T ? $t('colour of {p}, carried', { p: wHtml(T) }) : $t('shapes only');
    else if (k === T && SV.surf !== 'land') role = $t('colour plane');
    else if (SV.surf === 'land') role = $t('landscape of {h}{sheets}', { h: heightHtml(map), sheets: '' });
    else role = $t('phase of {ofV}', { ofV: map });
    return { name: svNameHtml(k), role };
  }
  const svReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // (one camera for every plane, S.srcView: a glide moves the picture, never the view, so its scale is the user's own)
  // the app's view of the shown plane: Phase (or Landscape) at or before the colour plane, X → Y after it; true when S changed
  const svMain = (k = svStage()) => (SV.surf === 'land' && svColoured(k) ? 'land' : svColoured(k) ? 'phase' : 'xy');
  function svViewFix() {
    const k = svStage(), col = svColoured(k), v = S.view, surf = SV.surf === 'sphere' ? 'sphere' : 'plane';
    const main = svMain(k);
    let ch = false;
    if (S.focus !== 0) { setFocusStep(0); ch = true; }
    if (morph.open) { morph.open = false; ch = true; }
    if (v.main !== main) { setViewOpt(null, 'main', main); ch = true; }
    if (main === 'land' && !(v.D && v.D.phase)) { setViewOpt(null, 'D', Object.assign({}, v.D, { phase: true })); ch = true; }
    const side = col ? 'P' : 'L';
    if (main !== 'land' && v[side].surf !== surf) { setViewOpt(side, 'surf', surf); ch = true; }
    return ch;
  }
  // a state replaced under the view (an example, undo, a link): back to what the steps view shows, before it is drawn
  function svCheck() {
    if (!SV.on || !SV.els || svMoving()) return;
    const P = svPlanes();
    if (SV.i > P.length - 1) { SV.i = P.length - 1; SV.g.set(SV.i); }
    if (SV.T >= 0 && !P.includes(SV.T)) SV.T = -1;
    const sig = svPlanes().join(',') + '|' + S.steps.map((st) => st.type).join(',') + '|' + S.shapes.map((x) => x.id).join(',');
    // (another chain loaded with the state, an example or a link: its glide's programs are started too)
    if (SV.sig != null && sig !== SV.sig) setTimeout(svPrestart, 300);
    svAdopt(SV.sig != null && sig !== SV.sig);
    SV.sig = sig;
    if (svViewFix()) setTimeout(svApply, 0);
    svSync();
  }
  // a view the steps view did not set (an example, a link, a saved state) opens coloured from the last plane: X → Y
  // with the colour inside its regions, Phase everywhere, Landscape on the relief
  // (force: another chain was loaded, which brings its own view even when it is the one shown)
  function svAdopt(force) {
    const ext = S.view.main;
    if (ext === svMain() && !force) return;
    // (ux's review: always from the last plane, F's; X → Y keeps its colour inside its regions when it has areas;
    // Views.svOf, concept §6)
    const areas = S.shapes.some((s) => s.visible !== false && kindType(s) === 'area'), o = Views.svOf(S.view, areas);
    SV.T = o.T; SV.scope = o.scope; SV.surf = o.surf;
    SV.i = 0; SV.g.set(0);
  }
  // S.sv, the steps view's place, saved in the state, in links and kept by undo (Views.cleanSv; the speed is the state's, and
  // the device's setting for a state without one). svStore writes it before a save, a link or an undo entry;
  // svLoad reads it when the page opens on a state that has one, and after an undo
  function svStore() {
    if (!SV.on || !SV.ready) return;
    setOpt('sv', { at: SV.anim ? SV.anim.to : SV.g.x, T: SV.T, scope: SV.scope, surf: SV.surf, speed: SV.speed });
  }
  function svLoad() {
    const o = Views.cleanSv(S.sv, svPlanes());
    if (!o) return false;
    SV.T = o.T; SV.scope = o.scope; SV.surf = o.surf;
    if (o.speed) { SV.speed = o.speed; if (SV.els && SV.els.speed) SV.els.speed.value = o.speed; }   // (a state without one keeps the device's)
    SV.anim = null; SV.g.max = svPlanes().length - 1; SV.g.set(o.at); SV.i = Math.round(o.at);
    return true;
  }
  // an undo put another S.sv under the view
  function svRestored() { if (SV.on && SV.ready && svLoad()) { SV.sig = null; setTimeout(svApply, 0); } }
  function svApply() {
    const k = svStage();
    svViewFix();
    leftAuto = false;
    if (k > 0) Object.assign(V.left, S.srcView);
    applyLayout();
    buildShapeList();
    updateFocusUI();
    requestRender('L', 'R', 'OL', 'OR', 'G');
    svSync();
  }
  // leave the shown plane: its view (panned or zoomed there) is the camera every plane shares
  function svKeepView() { const k = svStage(); if (k > 0) Object.assign(S.srcView, { cx: V.left.cx, cy: V.left.cy, s: V.left.s }); }
  // go to plane i: a glide along the steps in between (at once under reduced motion)
  function svGo(i, now) {
    const P = svPlanes();
    i = Math.max(0, Math.min(P.length - 1, i));
    svKeepView();
    // (the landscape has no frames between two planes: it changes plane at once)
    if (now || svReduced() || SV.surf === 'land') { SV.anim = null; SV.g.set(i); svArrive(); return; }
    SV.g.max = P.length - 1;
    const from = SV.g.x;
    if (Math.abs(i - from) < 1e-6) { SV.anim = null; SV.g.set(i); svArrive(); return; }
    // (a press while it glides starts the next glide from where the picture is: no jump; 420 ms a plane, at most 900)
    // (the speed setting's time a plane, for at most two planes' worth when it crosses several)
    const per = SV_SPEEDS[SV.speed] || 900;
    SV.anim = { from, to: i, t0: performance.now(), ms: per * Math.min(2, Math.max(0.35, Math.abs(i - from))) };
    draft = null; probe = null;
    requestRender('L');
  }
  function svArrive() {
    const i = Math.round(SV.g.x);
    SV.g.set(i);
    SV.i = i;
    svApply();
    if (typeof sndRelayout === 'function') sndRelayout();
    const live = SV.els && SV.els.live;
    if (live) live.textContent = svLabel();
  }
  // (parked: left between two planes on the thread, the picture of the deformation there)
  const svParked = () => !SV.anim && !(SV.drag && SV.drag.moved) && Math.abs(SV.g.x - Math.round(SV.g.x)) > 1e-6;
  const svMoving = () => !!SV.anim || SV.g.moving() || !!(SV.drag && SV.drag.moved) || svParked();
  // one plane on (d = ±1) from where the view is: from between two planes, the next one that way
  function svStep(d) {
    if (SV.anim) { svGo(SV.anim.to + d); return; }
    const x = SV.g.x;
    svGo(d > 0 ? Math.floor(x + 1e-6) + 1 : Math.ceil(x - 1e-6) - 1);
  }
  // one frame of the glide (frame() calls it); true while it moves
  function svFrame(ts) {
    if (!SV.on) return false;
    if (SV.drag && SV.drag.moved) { dirty.L = true; svSync(); return false; }
    if (SV.anim) {
      const A = SV.anim, v = Math.min(1, (performance.now() - A.t0) / A.ms), e = v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
      SV.g.set(A.from + (A.to - A.from) * e);
      dirty.L = true;
      svSync();
      if (v >= 1) { SV.anim = null; svArrive(); return false; }
      return true;
    }
    if (!SV.g.moving()) return false;
    const dt = SV.g.last ? (ts - SV.g.last) / 1000 : 1 / 60;
    SV.g.last = ts;
    const still = !SV.g.step(dt);
    dirty.L = true;
    svSync();
    if (still) { SV.g.last = 0; svArrive(); return false; }
    return true;
  }
  // the glide between planes a and b at x: (a, b, u, the map of the z-plane's shapes along h_{b,u}, and the plane whose
  // look the regions take, the nearer one: outlined over colour, filled past the colour plane, as each plane at rest)
  function svBetween() {
    const P = svPlanes(), x = SV.g.x, j = Math.max(0, Math.min(P.length - 1, Math.floor(x + 1e-9))), u = x - j;
    const a = P[j], b = P[Math.min(P.length - 1, j + 1)];
    const still = u <= 1e-6 || b === a, jump = !still && isDeriv(b);
    const map = still ? stageMap(a) : jump ? stageMap(u < 0.5 ? a : b) : { mode: 1, hi: b, t: u };
    // (its CPU twin, for the points: H_u after the steps before b, as transState)
    const F = still ? stageF(a) : jump ? stageF(u < 0.5 ? a : b) : ((Ht, Fp) => (z) => Ht(Fp(z)))(homF(b, u), stageF(b - 1));
    return { a, b, u, map, F, near: u < 0.5 ? a : b };
  }
  const svColourMap = (k) => (k === 0 ? stageMap(svT()) : { mode: 0, a: k, b: svT() });
  // The colour carried by the points: a grid over plane s's window (the camera's, half again as wide), each vertex
  // painted by where it lands in the colour plane, G = f_T ∘ … ∘ f_{s+1} (its phase, the Arg pattern of the
  // pre-mapped meshes, which reads (ln |G|, arg G) from the vertex), and placed where posF takes it. So the colour
  // travels with the points along a deformation, and a plane past the colour plane shows the colour plane's colours
  // pushed forward. Into the 2D context cc; false when a d/dz step is in the way (no map from plane s). The grid, its
  // colours G and its places on plane a (rangeF(s, a)) are kept while the plane, the colour plane, the view and the
  // chain stay (svCarryMemo), so a glide's frame evaluates only the step's homotopy H (null at rest)
  let svCarryMemo = null, svCarryRes = null, svCarryBuf = null;
  function svCarry(pane, cc, s, a, H) {
    const T = svT();
    if (s > 0 && derivIn(s, T)) return false;
    const v = S.srcView, nx = 160, ny = Math.max(12, Math.round(nx * pane.h / Math.max(1, pane.w)));
    // (#366 F) on the GPU when it can: the grid moved by the glide's map from plane s, each fragment coloured from the
    // colour plane exactly (GLR.drawCarried); the CPU mesh below while its program compiles, or without it
    if (GLR.drawCarried && !/** @type {any} */ (window).__svCpu) {
      const ext = 1.5, hw = pane.w / 2 / v.s * ext, hy = pane.h / 2 / v.s * ext, g = svBetween();
      const map = H ? { mode: 1, base: s, hi: g.b, t: g.u } : { mode: 0, a: s, b: a };
      // (the sheet key of the points of plane s: its window, the camera's, and the plan's accumulation set of the map
      // to plane a, as smKeyOf for the forward meshes)
      const win = { x0: v.cx - hw / ext, y0: v.cy - hy / ext, x1: v.cx + hw / ext, y1: v.cy + hy / ext }, R = Math.hypot(hw, hy) / ext;
      const plan = a > s ? invPlan(s, a) : null;
      const key = { win, R, rs: R / 8, sing: plan && plan.ok ? invSing(plan) : [] };
      GLR.begin(pane.pw, pane.ph);
      if (GLR.drawCarried({ map, s, T, view: v, dpr: pane.dpr, mesh: { x0: v.cx - hw, y0: v.cy - hy, dx: 2 * hw / nx, dy: 2 * hy / ny, nx, ny }, lim: 0.35 * Math.max(pane.w, pane.h) / v.s, key,
        style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark })) { GLR.blit(cc); return true; }
    }
    const key = [s, a, T, v.cx, v.cy, v.s, pane.w, pane.h, chainSig[nSteps()]].join('|');
    let m = svCarryMemo;
    if (!m || m.key !== key) {
      const G = s === T ? (z) => z : rangeF(s, T), toA = s === a ? null : rangeF(s, a);
      const ext = 1.5, hw = pane.w / 2 / v.s * ext, hy = pane.h / 2 / v.s * ext, W = (nx + 1) * (ny + 1);
      m = svCarryMemo = { key, ax: new Float64Array(W), ay: new Float64Array(W), gl: new Float64Array(W), ga: new Float64Array(W), ok: new Uint8Array(W) };
      for (let jy = 0; jy <= ny; jy++) for (let ix = 0; ix <= nx; ix++) {
        const p = C(v.cx - hw + 2 * hw * ix / nx, v.cy - hy + 2 * hy * jy / ny), n = jy * (nx + 1) + ix;
        let q, g;
        try { q = toA ? toA(p) : p; g = G(p); } catch (e) { continue; }
        if (!q || !g || !CX.isFin(q) || !CX.isFin(g)) continue;
        m.ax[n] = q.re; m.ay[n] = q.im;
        m.gl[n] = Math.max(-60, Math.log(Math.hypot(g.re, g.im))); m.ga[n] = Math.atan2(g.im, g.re); m.ok[n] = 1;
      }
    }
    // (perf on #448) the mesh is made once per memo: every grid triangle whose corners have a colour, with its colours
    // (arg unwrapped within it), on the GPU; a frame only moves its corners (GLR.updatePreMesh: one upload, no new
    // buffer), and a triangle torn across a cut or a pole, or with a corner H cannot place, collapses to a point. The
    // same frame again (at rest, parked) is drawn as it is
    const fkey = key + '|' + (H ? SV.g.x.toFixed(6) : 'rest');
    if (!m.tris) {
      const K = 16 / TAU, tris = [], attr = [];
      const add = (A, B, D) => {
        if (!m.ok[A] || !m.ok[B] || !m.ok[D]) return;
        const a0 = m.ga[A];
        tris.push(A, B, D);
        for (const n of [A, B, D]) { let t = m.ga[n] - a0; t -= TAU * Math.round(t / TAU); attr.push(0, 0, m.gl[n] * K, (a0 + t) * K); }
      };
      for (let jy = 0; jy < ny; jy++) for (let ix = 0; ix < nx; ix++) {
        const n = jy * (nx + 1) + ix, e = n + 1, u = n + nx + 1, d = u + 1;
        add(n, e, d); add(n, d, u);
      }
      m.tris = Uint32Array.from(tris);
      m.pos = new Float32Array(tris.length * 2);
      m.attr = Float32Array.from(attr);
      if (svCarryRes) { GLR.destroy(svCarryRes.res); svCarryRes = null; }
    }
    const nt = m.tris.length / 3;
    if (!nt) return true;
    let res = svCarryRes && svCarryRes.memo === m && svCarryRes.res.n ? svCarryRes.res : null;
    if (!res || svCarryRes.key !== fkey) {
      const W = (nx + 1) * (ny + 1), lim2 = Math.pow(0.35 * Math.max(pane.w, pane.h) / v.s, 2);
      if (!svCarryBuf || svCarryBuf.W !== W) svCarryBuf = { W, qx: new Float64Array(W), qy: new Float64Array(W), ok: new Uint8Array(W) };
      const { qx, qy, ok } = svCarryBuf, pos = m.pos, T3 = m.tris;
      for (let n = 0; n < W; n++) {
        ok[n] = 0;
        if (!m.ok[n]) continue;
        if (!H) { qx[n] = m.ax[n] - v.cx; qy[n] = m.ay[n] - v.cy; ok[n] = 1; continue; }
        let q;
        try { q = H(C(m.ax[n], m.ay[n])); } catch (e) { continue; }
        if (!q || !CX.isFin(q)) continue;
        qx[n] = q.re - v.cx; qy[n] = q.im - v.cy; ok[n] = 1;
      }
      const d2 = (A, B) => { const dx = qx[A] - qx[B], dy = qy[A] - qy[B]; return dx * dx + dy * dy; };
      for (let t = 0, o = 0; t < nt; t++, o += 6) {
        const A = T3[3 * t], B = T3[3 * t + 1], D = T3[3 * t + 2];
        if (!ok[A] || !ok[B] || !ok[D] || d2(A, B) > lim2 || d2(B, D) > lim2 || d2(D, A) > lim2) { pos.fill(3e7, o, o + 6); continue; }
        pos[o] = qx[A]; pos[o + 1] = qy[A]; pos[o + 2] = qx[B]; pos[o + 3] = qy[B]; pos[o + 4] = qx[D]; pos[o + 5] = qy[D];
      }
      if (res) GLR.updatePreMesh(res, pos);
      else {
        res = GLR.createPreMesh({ n: nt, pos, attr: m.attr, tri: new Float32Array(nt), origin: [v.cx, v.cy], dynamic: true });
        if (!res) return false;
      }
      svCarryRes = { key: fkey, memo: m, res };
    }
    GLR.begin(pane.pw, pane.ph);
    GLR.drawPreMapped(res, { view: v, dpr: pane.dpr, color: [0.5, 0.5, 0.5], alpha: 1, pattern: 'phase', cell: 1, lines: false, sphN: 16 });
    GLR.blit(cc);
    return true;
  }
  // A frame of the plane between two planes (or at rest on a plane past the colour plane, where it is u = 0): the
  // colour carried by the points along h_{b,u} (svCarry), with each plane's exact pull-back colour blended in near it;
  // Inside regions masks it with the moving regions; the regions are outlined over it. The view stays.
  function svRenderMoving(pane) {
    if (SV.surf === 'sphere' && lGlobe()) { svSphereMoving(pane); return; }
    const { a, b, u, map, F } = svBetween(), rest = !SV.anim && !(SV.drag && SV.drag.moved);
    pane.setView(S.srcView);
    pane.begin(TH.plane);
    if (!GLR.ok) { noGL(pane); return; }
    paper(pane);
    if (GLR.drawGrid) {
      GLR.begin(pane.pw, pane.ph);
      GLR.drawGrid({ view: pane.view, dpr: pane.dpr, plane: TH.planeRGB, minor: GLR.hexRGB(TH.gridMinor), medium: GLR.hexRGB(TH.gridMedium), major: GLR.hexRGB(TH.gridMajor), axis: TH.axisRGB, unit: S.unit, unitAlpha: 0.55 });
      GLR.blit(pane.ctx);
    }
    svColCv = svCanvas(svColCv, pane);
    const cc = svColCv.getContext('2d');
    const T = svT(), src = Math.min(a, T), still = u <= 1e-6 || b === a;
    const plot = (k, al) => {
      if (al <= 0.01 || !svColoured(k)) return;
      GLR.begin(pane.pw, pane.ph);
      GLR.drawColorPlot({ map: svColourMap(k), view: pane.view, dpr: pane.dpr, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark, cauchy: null });
      cc.globalAlpha = al;
      GLR.blit(cc);
      cc.globalAlpha = 1;
    };
    // (under it, the two planes' exact colours cross-faded: where no carried point lands, as the points from outside
    // the window would, the picture is not left blank)
    if (!still) { plot(a, svColoured(b) ? 1 : 1 - u); if (b !== a) plot(b, u); }
    let carried = false;
    if (still || !isDeriv(b)) {
      carried = svCarry(pane, cc, src, a, still ? null : homF(b, u));
    }
    // (over it, at a plane at or before the colour plane, its exact colour: all of it at rest, blended in over the first
    // and the last 15 % of a glide)
    const near = (w) => Math.max(0, Math.min(1, w));
    if (still) plot(a, 1);
    else if (carried) { plot(a, near(1 - u / 0.15)); if (b !== a) plot(b, near((u - 0.85) / 0.15)); }
    if (svMaskOn()) svMaskWith(pane, cc, map, still ? a : undefined);
    pane.ctx.save(); pane.ctx.setTransform(1, 0, 0, 1, 0, 0); pane.ctx.drawImage(svColCv, 0, 0); pane.ctx.restore();
    svOutlines(pane, map);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    // (the points, carried too; at rest the plane's rulers, as every plane has)
    drawPoints(pane, F, still ? { primes: a, k: a, editK: a } : {});
    if (rest) drawRulers(pane, 'L');
  }
  // keep only what is inside the regions under map (and, at rest on plane k, the later planes' regions pulled back) of
  // the picture in the 2D context cc
  function svMaskWith(pane, cc, map, k) {
    svMaskCv = svCanvas(svMaskCv, pane);
    const mp = svProxy(pane, svMaskCv);
    mp.begin = () => {};
    const keep = { pattern: S.pattern, alpha: S.alpha, lines: S.lines };
    try {
      setOpt('pattern', 'solid'); setOpt('alpha', 1); setOpt('lines', false);
      // (at rest, plane k: the cached maps, as the plane's own frame (perf A3); between planes the homotopy's, uncached)
      drawScene(mp, map, null, k == null ? { noGrid: true, cache: false } : { noGrid: true, domain: k === 0, plane: k });
      if (k != null) stagePullbacks(mp, k);
    } catch (e) { console.error('steps view mask', e); }
    for (const key of Object.keys(keep)) setOpt(key, keep[key]);
    cc.save();
    cc.setTransform(1, 0, 0, 1, 0, 0);
    cc.globalCompositeOperation = 'destination-in';
    cc.drawImage(svMaskCv, 0, 0);
    cc.restore();
  }
  // the shapes' outlines under map, as the colour plot draws them (renderColor)
  function svOutlines(pane, map0) {
    GLR.begin(pane.pw, pane.ph);
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point') continue;
      const map = shapeMap(s, map0), r = map && shapeGPU(s);
      if (!r || !r.lineRes) continue;
      GLR.drawLines(r.lineRes, { map, view: pane.view, dpr: pane.dpr, M: 8, width: 1.3 * pane.dpr, color: GLR.hexRGB(TH.dcCasing), alpha: 0.9, casing: { color: [1, 1, 1], alpha: 0.95, width: 3 * pane.dpr } });
    }
    GLR.blit(pane.ctx);
  }
  // a pane that draws into canvas cv instead (the same size and view)
  function svProxy(pane, cv) {
    const p = Object.create(pane);
    p.ctx = cv.getContext('2d');
    p.ctx.setTransform(1, 0, 0, 1, 0, 0);
    p.ctx.clearRect(0, 0, cv.width, cv.height);
    p.begin = (bg) => { p.ctx.setTransform(1, 0, 0, 1, 0, 0); p.ctx.clearRect(0, 0, cv.width, cv.height); if (bg) { p.ctx.fillStyle = bg; p.ctx.fillRect(0, 0, cv.width, cv.height); } p.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0); };
    return p;
  }
  // the glide on the globe: the globe of plane a, its colour fading into plane b's, with the shapes moving on it
  let svFadeCv = null;
  function svSphereMoving(pane) {
    const { a, b, u, map, F, near } = svBetween();
    const look = (k) => ({ imageMode: !svColoured(near), stage: k, plane: !!xView().eq, role: 'L', colorMap: svColoured(k) ? svColourMap(k) : null, lineMap: map, hom: { map, imageMap: map, F, imageF: F } });
    const info = sphereView(pane, camL, CAML, look(a));
    // (plane b's globe fades in when it has its own paint: coloured, or the shapes on paper past the colour plane)
    if (u > 0.01 && b !== a && (svColoured(b) || !svColoured(near))) {
      svFadeCv = svCanvas(svFadeCv, pane);
      sphereView(svProxy(pane, svFadeCv), camL, CAML, look(b));
      pane.ctx.save(); pane.ctx.setTransform(1, 0, 0, 1, 0, 0); pane.ctx.globalAlpha = u; pane.ctx.drawImage(svFadeCv, 0, 0); pane.ctx.restore();
    }
    leftSphereInfo = info;
  }
  // Inside regions on the globe: the globe with its regions, then the colour globe only where a region is: the regions
  // drawn white on a black globe make the mask
  let svSphCv = null, svSphMask = null;
  function svSphereIn(pane) {
    const k = svStage(), o = { stage: k, plane: !!xView().eq, role: 'L' };
    const info = sphereView(pane, camL, CAML, Object.assign({ imageMode: true }, o));
    svSphCv = svCanvas(svSphCv, pane);
    sphereView(svProxy(pane, svSphCv), camL, CAML, Object.assign({ imageMode: false }, o));
    svSphMask = svCanvas(svSphMask, pane);
    const keepTH = TH, keepInk = printInk, keep = { pattern: S.pattern, alpha: S.alpha, lines: S.lines };
    try {
      TH = Object.assign({}, TH, { plane: '#000000', planeRGB: [0, 0, 0], gridMajor: '#000000', axisRGB: [0, 0, 0], inkRGB: [0, 0, 0], faint: '#000000', landTop: '#000000', landBottom: '#000000', landShadow: '#000000', halo: '#000000', muted: '#000000' });
      printInk = () => ({ c0: '#ffffff', alt: '#ffffff', edge: '#ffffff' });
      setOpt('pattern', 'solid'); setOpt('alpha', 1); setOpt('lines', false);
      sphereView(svProxy(pane, svSphMask), camL, CAML, Object.assign({ imageMode: true }, o));
    } catch (e) { console.error('steps view globe mask', e); }
    TH = keepTH; printInk = keepInk;
    for (const key of Object.keys(keep)) setOpt(key, keep[key]);
    const mc = svSphMask.getContext('2d'), img = mc.getImageData(0, 0, svSphMask.width, svSphMask.height), d = img.data;
    // (a lit white region stays light; the black globe, its sheen and the ground stay dark)
    for (let q = 0; q < d.length; q += 4) { const l = (d[q] + d[q + 1] + d[q + 2]) / 3; d[q + 3] = l > 110 ? 255 : l > 70 ? Math.round((l - 70) * 255 / 40) : 0; }
    mc.putImageData(img, 0, 0);
    const c = svSphCv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(svSphMask, 0, 0); c.globalCompositeOperation = 'source-over';
    pane.ctx.save(); pane.ctx.setTransform(1, 0, 0, 1, 0, 0); pane.ctx.drawImage(svSphCv, 0, 0); pane.ctx.restore();
    return info;
  }
  // Inside regions: the region mask of plane k, drawn opaque into a canvas the size of the pane's
  let svMaskCv = null, svColCv = null;
  function svCanvas(cv, pane) {
    if (!cv) cv = document.createElement('canvas');
    if (cv.width !== pane.pw || cv.height !== pane.ph) { cv.width = pane.pw; cv.height = pane.ph; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    return cv;
  }
  // (only areas bound the colour: with none drawn, a curve or a point alone, it shows everywhere)
  function svMaskOn() { return SV.on && SV.scope === 'in' && S.shapes.some((s) => s.visible !== false && kindType(s) === 'area'); }
  // the colour plot just drawn into GL's frame (renderColor, its draw cst): only inside the regions, the rest the plane's
  // paper. On the GPU in one frame: the regions write the frame's alpha alone (GLR.alphaOnly), then the colour plot is
  // kept where that alpha is (dstAlpha). With areas on later planes (pulled back by their own pass) or no alphaOnly,
  // the 2D path: the plot, the regions' mask drawn apart, and destination-in
  function svMaskColour(pane, cst) {
    const k = svStage();
    const later = S.shapes.some((s) => s.visible !== false && kindType(s) === 'area' && shapeStage(s) > k);
    // (the GPU path is issue G's: on a plane past z its mask comes out empty, so it stays off until G finds why)
    if (SV_GPU_MASK && GLR.alphaOnly && cst && !later) {
      // (the forward meshes: the exact images' inverse pass composites its own layers, which an alpha-only mask breaks)
      const keep = { pattern: S.pattern, alpha: S.alpha, lines: S.lines, exactImages: S.exactImages };
      const mp = Object.assign(Object.create(pane), { begin: () => {} });
      try {
        setOpt('pattern', 'solid'); setOpt('alpha', 1); setOpt('lines', false); setOpt('exactImages', false);
        drawScene(mp, stageMap(k), null, { noGrid: true, cache: false, domain: k === 0, plane: k, under: () => GLR.alphaOnly(true),
          over: () => { GLR.alphaOnly(false); GLR.drawColorPlot(Object.assign({}, cst, { dstAlpha: true })); } });
      } catch (e) { GLR.alphaOnly(false); console.error('steps view mask', e); }
      for (const key of Object.keys(keep)) setOpt(key, keep[key]);
      pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
      GLR.begin(pane.pw, pane.ph);
      return;
    }
    svColCv = svCanvas(svColCv, pane);
    const cc = svColCv.getContext('2d');
    GLR.blit(cc);
    svMaskWith(pane, cc, stageMap(k), k);
    pane.ctx.save();
    pane.ctx.setTransform(1, 0, 0, 1, 0, 0);
    pane.ctx.drawImage(svColCv, 0, 0);
    pane.ctx.restore();
    GLR.begin(pane.pw, pane.ph);
  }

  // ---- the controls: the plane's head and the chain strip ----
  function svLabel() {
    if (svParked()) return svPlaceText();
    const k = svStage(), T = svT(), n = svPlanes().length;
    const where = svColoured(k) ? (k === T ? $t('the colour plane') : $t('coloured from {p}', { p: svName(T) })) : $t('after the colour plane {p}', { p: svName(T) });
    return $t('Plane {p}, {i} of {n}, {where}', { p: svName(k), i: SV.i + 1, n, where });
  }
  function svFormulaHtml() {
    const { name, role } = svTitleParts();
    return `${name}<span class="sv-sep"> · </span><span class="sv-role">${role}</span>`;
  }
  function svSeg(cls, label, items, cur, pick) {
    const g = h('div', { class: 'seg small sv-seg ' + cls, role: 'radiogroup', 'aria-label': label });
    for (const [id, text, tip] of items) {
      g.append(h('button', { type: 'button', role: 'radio', 'data-v': id, 'data-tip': tip || '', 'aria-checked': String(cur() === id), tabindex: cur() === id ? '0' : '-1', class: cur() === id ? 'on' : '', onclick: () => pick(id) }, text));
    }
    // (a radio group: one Tab stop, the checked one; ← → pick the next and move the focus with it)
    g.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const bs = [...g.children], i = bs.indexOf(/** @type {HTMLElement} */ (e.target));
      if (i < 0) return;
      e.preventDefault();
      const n = bs[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length];
      pick(n.dataset.v); n.focus();
    });
    return g;
  }
  function svBuild() {
    const head = document.querySelector('#paneL .pane-head');
    const bar = h('div', { class: 'sv-head', id: 'svHead' });
    const title = h('div', { class: 'sv-title', 'aria-hidden': 'true' });
    const cp = h('button', { type: 'button', class: 'btn small sv-cp', 'aria-pressed': 'false', 'data-tip': $t('Colour every plane from this one  C'), onclick: () => svSetT(svStage()) });
    const scope = svSeg('sv-scope', $t('Where colour shows'), [['all', $t('Everywhere')], ['in', $t('Inside regions'), $t('Colour only inside the regions you draw, in every plane')]], () => SV.scope, (v) => { SV.scope = v; svSync(); requestRender('L'); });
    // (the surface: one button that names it and opens a menu of the three, on a laptop as on a phone; ux, #441: the
    // three-way row took 190 px of a head that has 700 at 1024 px)
    const SURF = [['plane', $t('Plane')], ['sphere', $t('Sphere')], ['land', $t('Landscape')]];
    const surf1 = h('button', { type: 'button', class: 'btn small sv-surf1', 'aria-haspopup': 'menu', onclick: () => svSurfMenu() });
    bar.append(title, cp, scope, surf1);
    head.prepend(bar);
    // the chain strip: ‹, a segment per plane with the step between, ›
    const prev = h('button', { type: 'button', class: 'sv-nav sv-prev', 'aria-label': $t('Previous plane'), 'data-tip': $t('Previous plane  ←'), onclick: () => svStep(-1) }, '‹');
    const next = h('button', { type: 'button', class: 'sv-nav sv-next', 'aria-label': $t('Next plane'), 'data-tip': $t('Next plane  →'), onclick: () => svStep(1) }, '›');
    const track = h('div', { class: 'sv-track' });
    const thumb = h('div', { class: 'sv-thumb', 'aria-hidden': 'true' });
    const speed = h('select', { class: 'sv-speed', 'aria-label': $t('Glide speed'), 'data-tip': $t('Glide speed'), onchange: (e) => { SV.speed = e.target.value; try { localStorage.setItem('cmw-sv-speed', SV.speed); } catch (_) { /* (no storage) */ } svStore(); save(); } },
      ...[['fast', $t('Fast')], ['normal', $t('Normal')], ['slow', $t('Slow')], ['slower', $t('Slower')]].map(([v, t]) => h('option', { value: v, selected: v === SV.speed ? '' : null }, t)));
    const strip = h('div', { class: 'sv-strip', id: 'svStrip', role: 'toolbar', 'aria-label': $t('Planes of the chain') }, prev, h('div', { class: 'sv-rail' }, thumb, track), next, speed);
    const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
    // (in the plane's pane right after its head, so Tab reaches it after the head's controls; CSS draws it at the foot)
    head.after(strip);
    $('stage').append(live);
    const rail = strip.querySelector('.sv-rail');
    // (the slider is the ring that marks the place, not the thread: the thread holds the planes' and the steps' buttons,
    // which a slider's children cannot be (axe nested-interactive, ux's re-check of #448))
    thumb.removeAttribute('aria-hidden');
    thumb.setAttribute('role', 'slider'); thumb.setAttribute('tabindex', '0'); thumb.setAttribute('aria-label', $t('Place on the chain'));
    thumb.setAttribute('aria-valuemin', '0'); thumb.setAttribute('aria-orientation', 'horizontal');
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (SV.els) { SV.els.centres = null; svSync(); } }).observe(rail);
    // (the head's width, as the observer reports it: svFitHead fits the head again when it changes, with no read of its own)
    if (typeof ResizeObserver === 'function') new ResizeObserver((es) => { const E = SV.els; if (!E) return; E.headW = Math.round(es[es.length - 1].contentRect.width); svFitHead(); }).observe(head);
    // (on a phone the bar sits in the header: its own width, as reported, keys the fit there; fonts that load late re-fit it)
    if (typeof ResizeObserver === 'function') new ResizeObserver((es) => { const E = SV.els; if (!E) return; E.barW = Math.round(es[es.length - 1].contentRect.width); svFitHead(); }).observe(bar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => svFitHead());
    SV.els = { speed, rail, slider: thumb, bar, head, title, cp, scope, surf1, SURF, strip, track, thumb, prev, next, live, sig: '' };
    svStripWire(strip, track);
  }
  // the strip's planes and steps, rebuilt when the chain changes
  function svBuildTrack() {
    const E = SV.els, P = svPlanes(), T = svT();
    const sig = P.join(',') + '|' + T + '|' + P.map((k) => (k ? S.steps[k - 1].type : '')).join(',');
    if (sig === E.sig) return;
    E.sig = sig;
    E.track.textContent = '';
    E.track.style.setProperty('--n', String(P.length));
    P.forEach((k, i) => {
      if (i > 0) {
        const st = S.steps[k - 1], d = Funcs.DEFS[st.type];
        // (a step is a stretch of the thread, which a drag moves along; its function's chip on it opens the step)
        E.track.append(h('div', { class: 'sv-step', 'data-k': String(k) },
          h('button', { type: 'button', class: 'sv-fchip', 'data-tip': `${cardName(st, d)} · ${$t('Edit step {k}', { k })}`, 'aria-label': `f${sub(k)} ${cardName(st, d)}: ${$t('Edit step {k}', { k })}`, onclick: (e) => { e.stopPropagation(); inspectStep(k); } },
            h('span', { class: 'sv-fk', html: `<i>f</i><sub>${k}</sub>` }), h('span', { class: 'sv-fn' }, cardName(st, d)))));
      }
      // (a plane is a node, the colour plane's filled with the wheel; its name is small: the steps are the buttons)
      E.track.append(h('button', { type: 'button', class: 'sv-plane' + (k === T ? ' cp' : ''), 'data-i': String(i), 'aria-label': k === T ? `${svName(k)}, ${$t('colour plane')}` : svName(k), 'data-tip': k === T ? $t('The colour plane') : '', onclick: (e) => { e.stopPropagation(); svGo(i); } },
        h('span', { class: 'sv-node', 'aria-hidden': 'true' }), h('span', { class: 'sv-pn', html: svNameHtml(k) })));
    });
  }
  // the head, the strip's states and the names: written only when what they show changed (perf A1: a glide's frame
  // writes the ring's transform alone, from the nodes' centres measured once per layout, with no forced layout)
  function svSync() {
    if (!SV.on || !SV.els) return;
    const E = SV.els, k = svStage(), T = svT(), P = svPlanes();
    svBuildTrack();
    const x = SV.g.x, at = Math.round(x), parked = svParked();
    const ph = document.documentElement.classList.contains('ph');
    const sig = [k, T, SV.scope, SV.surf, at, parked ? x.toFixed(3) : '', svMoving() ? 1 : 0, ph ? 1 : 0, E.sig].join('|');
    // (the folded key on a phone loses its head's words: as an image it keeps a name; ux on #448)
    const leg = $('leftLegend');
    if (leg && leg.getAttribute('role') === 'img' && !leg.getAttribute('aria-label')) leg.setAttribute('aria-label', SV.surf === 'land' ? $t('Height key') : $t('Colour key'));
    if (sig !== E.headSig) {
      E.headSig = sig;
      // (the plane's controls: in its head on a desktop, in the header on a phone, where the view switch was)
      const home = ph ? $('top') : E.head;
      if (E.bar.parentNode !== home) { if (home === E.head) home.prepend(E.bar); else home.insertBefore(E.bar, $('hdrMoreBtn')); }
      E.title.innerHTML = svFormulaHtml();
      // (on a phone the button is its wheel alone, its words in its label)
      const cpText = k === T ? $t('Colour plane') : $t('Colour from here');
      E.cp.innerHTML = `<span class="sv-dot"></span><span class="sv-cp-t">${cpText}</span>`;
      E.cp.setAttribute('aria-label', cpText);
      E.cp.setAttribute('aria-pressed', String(k === T));
      E.cp.classList.toggle('on', k === T);
      const sname = (E.SURF.find((v) => v[0] === SV.surf) || E.SURF[0])[1];
      const sicon = { plane: MODE_ICONS.image, sphere: MODE_ICONS.sphere, land: MODE_ICONS['3d'] }[SV.surf] || '';
      E.surf1.innerHTML = `<span class="sv-surf-i" aria-hidden="true">${sicon}</span><span class="sv-surf-t">${sname}</span>${ICONS.chevD || ''}`; E.surf1.setAttribute('aria-label', `${$t('Surface')}: ${sname}`); E.surf1.dataset.tip = `${$t('Surface')}: ${sname}`;
      for (const b of E.scope.children) { const on = b.dataset.v === SV.scope; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); b.setAttribute('tabindex', on ? '0' : '-1'); }
      svFitHead();
      E.prev.disabled = at <= 0 && !svMoving() && !parked;
      E.next.disabled = at >= P.length - 1 && !svMoving() && !parked;
      for (const b of E.track.querySelectorAll('.sv-plane')) { const on = +b.dataset.i === at && !parked; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false'); }
      $('paneL').setAttribute('aria-label', svLabel());
      // (the thread as a slider: its place in planes, said as a plane or the two it is between)
      E.slider.setAttribute('aria-valuenow', x.toFixed(2)); E.slider.setAttribute('aria-valuemax', String(P.length - 1));
      E.slider.setAttribute('aria-valuetext', svPlaceText());
    }
    // (the ring round the shown plane's node, between two nodes in proportion to the glide)
    if (!E.centres || E.centresSig !== E.sig) { E.centres = [...E.track.querySelectorAll('.sv-plane')].map((b) => b.offsetLeft + b.offsetWidth / 2); E.centresSig = E.sig; }
    const c = E.centres, j = Math.max(0, Math.min(c.length - 1, Math.floor(x + 1e-9))), u = x - j;
    if (c.length) E.thumb.style.transform = `translateX(${(c[j] + ((c[Math.min(c.length - 1, j + 1)] ?? c[j]) - c[j]) * u).toFixed(1)}px)`;
  }
  // the surface's menu: the three, the shown one checked (a menu's keys are its own: svKeys leaves them alone)
  function svSurfMenu() {
    const E = SV.els;
    const items = E.SURF.map(([v, t]) => ({ label: t, radio: true, checked: SV.surf === v, run: () => { SV.surf = v; if (v === 'sphere') prestartGlobe(); svApply(); } }));
    openMenu(E.surf1, Object.assign(items, { menuLabel: $t('Surface'), focusChecked: true }));
  }
  // the head on one row (#441): beside the plane's controls it keeps the style row, a ⋯ and the lamp (#247 keeps the
  // style row in the head whatever the room). When they do not fit, the colour-plane button gives up its words first
  // (its wheel stays, its words in its name and tooltip, as on a phone), then the title its role ("phase of f₂", also in
  // the plane's accessible name). Read and written only when the head's width or the words in it change (the observer,
  // or a new title, button or surface), and never while the view moves (#320)
  function svFitHead() {
    const E = SV.els;
    if (!E || !E.head) return;
    // (not while the view moves: the title changes half-way through a glide, and a fit then is a forced layout in a frame;
    // a view parked between two planes is at rest and is fitted; svSync's head key holds svMoving(), so the head is fitted
    // once when the glide settles; rework on #473)
    if (SV.anim || SV.g.moving() || (SV.drag && SV.drag.moved)) return;
    const ph = document.documentElement.classList.contains('ph');
    const key = [ph ? 1 : 0, ph ? E.barW || 0 : E.headW || 0, document.fonts ? document.fonts.status : '', E.title.innerHTML, E.cp.textContent, E.surf1.textContent, I18N.lang].join('|');
    if (key === E.fitKey) return;
    E.fitKey = key;
    const set = (lvl) => { E.bar.classList.toggle('sv-c1', lvl >= 1); E.bar.classList.toggle('sv-c2', lvl >= 2); };
    // (a phone: the header holds the bar beside the menu button; short of room (360 px, Russian) the surface button is
    // its icon and ▾ alone, its name in its label and tooltip; phone on #473)
    E.bar.classList.remove('sv-c3', 'sv-c4');
    if (ph) {
      set(0);
      // (then, still short, as on w₁ at 360 px whose name is wider than z's, the bar's gaps and the scope's padding
      // tighten; eyes on #473)
      const more = $('hdrMoreBtn'), mr = more && more.getClientRects().length ? more.getBoundingClientRect() : null;
      const short = () => E.bar.scrollWidth > E.bar.clientWidth + 1 || (mr && E.surf1.getBoundingClientRect().right > mr.left - 2);
      if (short()) E.bar.classList.add('sv-c3');
      if (short()) E.bar.classList.add('sv-c4');
      return;
    }
    set(0);
    const head = E.head, cs = getComputedStyle(head), gap = parseFloat(cs.columnGap) || 8;
    const room = head.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // (what the rest of the head takes at the least: the strip as its style row and a ⋯, every other shown item as it is,
    // a stretchy spacer as nothing; a gap before each)
    const dc = $('dcSeg'), foot = $('leftFoot');
    let keep = 0;
    for (const c of head.children) {
      if (c === E.bar || !c.getClientRects().length) continue;
      const m = getComputedStyle(c);
      const w = c === foot ? (dc && dc.getClientRects().length ? dc.getBoundingClientRect().width : 0) + 4 + 26 : c.classList.contains('grow') ? 0 : c.getBoundingClientRect().width;
      keep += w + parseFloat(m.marginLeft) + parseFloat(m.marginRight) + gap;
    }
    keep += 2;
    let lvl = 0;
    while (lvl < 2 && E.bar.scrollWidth + keep > room) set(++lvl);
    // (the strip in the head fits its controls to the room the bar now leaves)
    if (typeof layoutFoot === 'function') layoutFoot(true);
  }
  // where the view is on the thread, in words: a plane, or the two planes it is between
  function svPlaceText() {
    const P = svPlanes(), x = SV.g.x;
    if (!svParked()) return svName(svStage());
    return $t('Between {a} and {b}', { a: svName(P[Math.floor(x)]), b: svName(P[Math.min(P.length - 1, Math.ceil(x))]) });
  }
  function svSetT(k) {
    SV.T = k === svPlanes()[svPlanes().length - 1] ? -1 : k;
    svApply();
    save();
    if (SV.els && SV.els.live) SV.els.live.textContent = svLabel();
  }
  // the strip: a press on a plane goes there; a drag along it scrubs through the deformation, and the glide settles on
  // the nearest plane when it is let go
  function svStripWire(strip, track) {
    const rail = strip.querySelector('.sv-rail');
    // (the thread's position under the pointer: between the centres of the planes' nodes, in proportion)
    const posX = (e) => {
      const ns = [...track.querySelectorAll('.sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return r.left + r.width / 2; });
      if (ns.length < 2) return 0;
      const x = e.clientX;
      if (x <= ns[0]) return 0;
      for (let i = 1; i < ns.length; i++) if (x <= ns[i]) return i - 1 + (x - ns[i - 1]) / Math.max(1, ns[i] - ns[i - 1]);
      return ns.length - 1;
    };
    rail.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.sv-fchip')) return;
      SV.drag = { id: e.pointerId, px: e.clientX, moved: false, strip: true };
      try { rail.setPointerCapture(e.pointerId); } catch (_) { /* (a synthetic pointer) */ }
    });
    // (a press on the thread away from the planes and the chips goes there too)
    rail.addEventListener('click', (e) => {
      if (SV.dragEndT && performance.now() - SV.dragEndT < 50) return;
      if (e.target.closest('.sv-fchip, .sv-plane')) return;
      SV.g.set(posX(e)); SV.g.max = svPlanes().length - 1; svLetGo(true);
    });
    rail.addEventListener('pointermove', (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.strip) return;
      if (!d.moved && Math.abs(e.clientX - d.px) < 6) return;
      if (!d.moved) { svKeepView(); SV.anim = null; }
      d.moved = true;
      SV.g.set(posX(e)); SV.g.max = svPlanes().length - 1;
      requestRender('L');
    });
    const up = (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.strip) return;
      SV.drag = null;
      if (d.moved) { e.preventDefault(); SV.dragEndT = performance.now(); svLetGo(); }
    };
    rail.addEventListener('pointerup', up);
    rail.addEventListener('pointercancel', up);
    // (a click that ended a scrub is not a press on the plane under it)
    rail.addEventListener('click', (e) => { if (SV.dragEndT && performance.now() - SV.dragEndT < 50) e.stopPropagation(); }, true);
  }
  // a touch swipe that starts at the plane's left or right edge moves through the planes; anywhere else the plane
  // pans and draws as ever
  function svEdgeSwipe() {
    const plot = $('plotL'), EDGE = 28;
    plot.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const r = plot.getBoundingClientRect();
      const edge = e.clientX - r.left < EDGE ? 'L' : r.right - e.clientX < EDGE ? 'R' : null;
      if (!edge) return;
      e.stopImmediatePropagation(); e.preventDefault();
      svKeepView();
      SV.anim = null;
      SV.drag = { id: e.pointerId, px: e.clientX, w: r.width, x0: SV.g.x, moved: true, edge, t0: performance.now() };
      try { plot.setPointerCapture(e.pointerId); } catch (_) { /* (a synthetic pointer) */ }
    }, true);
    plot.addEventListener('pointermove', (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.edge) return;
      e.stopImmediatePropagation();
      // a finger across the whole plane is one plane
      SV.g.set(Math.max(0, Math.min(svPlanes().length - 1, d.x0 - (e.clientX - d.px) / (0.8 * d.w))));
      SV.g.max = svPlanes().length - 1;
      requestRender('L');
    }, true);
    const up = (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.edge) return;
      e.stopImmediatePropagation();
      SV.drag = null;
      const dx = e.clientX - d.px;
      // a flick (short and quick) goes one plane on; otherwise the view stays where it was let go
      if (Math.abs(dx) > 40 && performance.now() - d.t0 < 300) svGo(dx < 0 ? Math.floor(d.x0 + 1e-6) + 1 : Math.ceil(d.x0 - 1e-6) - 1);
      else svLetGo();
    };
    plot.addEventListener('pointerup', up, true);
    plot.addEventListener('pointercancel', up, true);
  }
  // let go on the thread at x: near a plane (an eighth of a step) it settles there; anywhere else it stays, showing the
  // deformation at that place (press: a press, which glides there first)
  function svLetGo(press) {
    const P = svPlanes(), x = Math.max(0, Math.min(P.length - 1, SV.g.x)), r = Math.round(x);
    if (Math.abs(x - r) < 0.125) { if (press) { svGo(r); return; } SV.g.set(r); svArrive(); return; }
    SV.anim = null;
    SV.g.set(x);
    SV.i = r;
    svSync();
    requestRender('L', 'OL');
    const live = SV.els && SV.els.live;
    if (live) live.textContent = $t('Between {a} and {b}', { a: svName(P[Math.floor(x)]), b: svName(P[Math.ceil(x)]) });
  }
  // a dialog, a menu, a popover, a pop-up or a phone sheet is open over the page (its keys are its own)
  function svLayerOpen() {
    if (document.querySelector('#popHost > *, .modal-bg, dialog[open], .snd-pop:not([hidden]), .ph-sheet:not([hidden])')) return true;
    try { return !!document.querySelector(':popover-open'); } catch (e) { return false; }
  }
  // a quarter of a step along the thread, at once (it stops between two planes, or settles on one it reaches)
  function svNudge(d) {
    const P = svPlanes(), from = SV.anim ? SV.anim.to : SV.g.x;
    SV.anim = null;
    svKeepView();
    SV.g.set(Math.max(0, Math.min(P.length - 1, Math.round((from + d) * 4) / 4)));
    SV.g.max = P.length - 1;
    svLetGo();
  }
  // ← → move through the planes, C makes the shown plane the colour plane (not while typing, nor on a focused plane,
  // whose arrows move the probe)
  function svKeys() {
    document.addEventListener('keydown', (e) => {
      if (!SV.on || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = /** @type {HTMLElement} */ (e.target);
      // (on the thread itself, a slider: ← → move a quarter of a step and stop there, Home / End go to z and the last plane)
      const onRail = !!(t && t.classList && t.classList.contains('sv-thumb'));
      if (onRail && (e.key === 'Home' || e.key === 'End')) { e.preventDefault(); e.stopImmediatePropagation(); svGo(e.key === 'Home' ? 0 : svPlanes().length - 1); return; }
      // (Shift+← → anywhere, or ← → on the thread: a quarter of a step, so the view can stop between two planes)
      // (the keys of a control that has focus, or of an open dialog, menu, popover or sheet, are its own (ux's review of
      // #448; the classic key handler's exclusions, 14-interaction.js): only the thread's own keys pass)
      if (!onRail && (svLayerOpen() || (t && t.closest && t.closest('#pipeline, [role="listbox"], [role="option"], [role="radiogroup"], [role="radio"], [role="menu"], [role="menuitem"], [role="slider"], [role="dialog"], input, select, textarea, [contenteditable], #propsPanel, .ph-sheet, .cm-palette, #popHost')))) return;
      if ((e.shiftKey || onRail) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); e.stopImmediatePropagation();
        svNudge(e.key === 'ArrowRight' ? 0.25 : -0.25);
        return;
      }
      // (PageUp / PageDown on a focused plane too; the arrows not on a plane, where they move the probe)
      const page = e.key === 'PageUp' || e.key === 'PageDown';
      if (!page && t && t.closest && t.closest('canvas')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || page) {
        e.preventDefault(); e.stopImmediatePropagation();
        svStep(e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1);
      } else if ((e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        e.preventDefault(); e.stopImmediatePropagation();
        svSetT(svStage());
      }
    }, true);
  }
  // the chain changed: the shown plane and the colour plane stay on their stages when they still exist
  function svChainChanged() {
    if (!SV.on || !SV.els) return;
    const P = svPlanes();
    if (SV.i > P.length - 1) { SV.i = P.length - 1; SV.g.set(SV.i); }
    if (SV.T >= 0 && !P.includes(SV.T)) SV.T = -1;
    svApply();
    setTimeout(svPrestart, 300);
  }
  // (perf A2) the programs a glide draws with, started without waiting (KHR_parallel_shader_compile): the homotopy
  // maps' (mode 1) and the carried colour's pre-mapped mesh, and its GPU programs (#439); at start-up and when the
  // chain changes
  function svPrestart() {
    try {
      if (!GLR.ok) return;
      if (GLR.prestartModes) GLR.prestartModes([1]);
      // (perf on #448: the programs keyed by the map that the first glide linked synchronously)
      if (GLR.prestartNames) GLR.prestartNames(['region0', 'regionC', 'regionP', 'line0', 'lineC', 'tfRegion', 'tfLine', 'color', 'pre'], [0, 1]);
      if (GLR.prestart) GLR.prestart(['regionP']);
      // (#439: the carried colour's programs, a glide's first: carryId too when a plane lies past the colour plane)
      if (GLR.prestartNames) { const P = svPlanes(); GLR.prestartNames(svT() < P[P.length - 1] ? ['carry', 'carryId'] : ['carry'], [1, 0]); }
    } catch (e) { /* (the first glide starts them) */ }
  }
  function setupStepsView() {
    if (!SV.on) return;
    document.documentElement.classList.add('sv');
    setFocusStep(0);
    svBuild();
    svEdgeSwipe();
    svKeys();
    SV.g.set(0); SV.g.max = svPlanes().length - 1;
    if (!svLoad()) svAdopt();
    SV.ready = true;
    svApply();
    // (#leftLed and #leftLegend carry a label: an image's, for axe's aria-prohibited-attr; ux v6 re-check)
    for (const id of ['leftLed', 'leftLegend']) { const el = $(id); if (el && !el.getAttribute('role')) el.setAttribute('role', 'img'); }
    setTimeout(svPrestart, 1500);
  }
