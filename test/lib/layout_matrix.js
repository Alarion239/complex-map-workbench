// The matrix of the layout checks (#470): the sizes, the states and how to open each, and walk(), which visits every
// point of it. Shared by test/layout_invariants_cmd.js (the CI suite) and tools/inspect.js (the screenshot galleries).
// Not a module: a CDP-daemon command file (test/cdp_kit README) evals this text, so that ev, go, key, sleep and send are in
// scope: `const M = eval(fs.readFileSync(<this file>, 'utf8'));`. It also needs LIB, test/lib/layout.js's text.
(() => {
  const SIZES = [
    { id: '360', w: 360, h: 780, dev: 'phone' }, { id: '390', w: 390, h: 844, dev: 'phone' }, { id: '412', w: 412, h: 915, dev: 'phone' },
    { id: '740x360', w: 740, h: 360, dev: 'phone' }, { id: '915x412', w: 915, h: 412, dev: 'phone' },
    // (the short landscape phones that fold the construction chip: a state lists them in its `sizes`, the others do not run there)
    { id: '568x320', w: 568, h: 320, dev: 'phone', only: true }, { id: '600x320', w: 600, h: 320, dev: 'phone', only: true }, { id: '640x360', w: 640, h: 360, dev: 'phone', only: true }, { id: '667x375', w: 667, h: 375, dev: 'phone', only: true },
    { id: '1024', w: 1024, h: 768, dev: 'desktop' }, { id: '1280', w: 1280, h: 800, dev: 'desktop' }, { id: '1440', w: 1440, h: 900, dev: 'desktop' },
  ];
  // the states: name, dev (phone or desktop only), views (the views it is in), page (a suffix of the page's URL: the state has its own page load), seed (the scene that page load starts from, as the page's saved state), checks (the checks that count in it; all when absent), why (a page expression that tells what the page is at when the state does not open), go (a page script), click (a button's id),
  // key, run (an async function with the daemon's helpers), sizes (the sizes it is measured at; all when absent), after (a page script that puts the page back), wait (ms), ready (a page expression that is true once the state is drawn, polled up to 15 s). A menu's ready is
  // that a layer (test/lib/layout.js INTENT.layers) is open
  const LAYER = `__layout.openLayers().length > 0`;
  // two more steps on the chain (sine, exponential), each waited for on the state the next key reads: the palette open, its
  // list filtered to the typed name, the step in the chain
  const STEPS = `__cmwP().steps.length`;
  const grow = async () => {
    for (const f of ['sine', 'exponential']) {
      const n = await ev(STEPS);
      await key('k', 4);
      await settled({ only: true, until: `!!document.querySelector('.pop.palette .pal-input') && document.querySelectorAll('.pop.palette .pal-item').length > 0` });
      const all = await ev(`document.querySelectorAll('.pop.palette .pal-item').length`);
      await type(f);
      await settled({ only: true, until: `document.querySelector('.pop.palette .pal-input').value === ${JSON.stringify(f)} && document.querySelectorAll('.pop.palette .pal-item').length > 0 && document.querySelectorAll('.pop.palette .pal-item').length < ${all}` });
      await key('Enter');
      await settled({ only: true, until: `${STEPS} > ${n} && !document.querySelector('.pop.palette')` });
    }
    // (the "step added" toasts are not part of the state: they would sit over the sheet)
    await ev(`(() => { for (const t of document.querySelectorAll('#toastHost > *')) t.remove(); return 1; })()`);
  };
  const GROWN = `${STEPS} >= 4`;
  const SHRINK = `(() => { for (let i = 0; i < 2; i++) { const u = document.getElementById('undoBtn'); u.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); u.click(); } })()`;
  const STATES = [
    { name: 'start' },
    { name: 'phase', go: `__cmwSetMain('phase'), 1`, wait: 1200, views: ['classic'] },
    { name: 'landscape', go: `__cmwSetMain('land'), 1`, wait: 1500, views: ['classic'] },
    // (ready once the Inspector is in place: floated over the stage at 1024 (.temp), it is first drawn off the right edge and
    // moves in a render later, about a second on software GL, and the chain head's buttons reflow only then; measured
    // before, Clear chain read as cut, one run in two)
    { name: 'inspector F', go: `(() => { const e = document.querySelector('#pipeline .ftile'); e && e.click(); return 1; })()`, dev: 'desktop',
      ready: `(() => { const p = document.getElementById('propsPanel'); return !!p && p.checkVisibility() && p.getBoundingClientRect().right <= innerWidth + 1; })()` },
    { name: 'tour strip', go: `Tour.start({ chapter: 'basics' }), 1`, wait: 1500, ready: `!!Tour.current()` },
    // (#565: the strip at its fullest: for each chapter, the step with the longest lead, text and task in the language
    // shown, opened on a phone at 360 px, where the strip is narrowest; 'na' where this view has no such chapter)
    ...['basics', 'views', 'edit', 'construct', 'deform', 'analysis', 'branches', 'sound', 'export', 'keys', 'planes'].map((ch) => ({
      name: 'tour longest ' + ch, dev: 'phone', sizes: ['360'], wait: 1500,
      go: `(() => { try { Tour.dismissSuggestion(); Tour.auto(false); } catch (e) { /* */ }
        const T = Tour._t, c = T.CHAPTERS.find((x) => x.id === ${JSON.stringify(ch)});
        if (!c || (T.chapterShown && !T.chapterShown(c))) return 'na';   // (a chapter this screen does not offer: Palette and keys on touch)
        let best = 0, len = -1;
        c.steps.forEach((st, i) => { const n = (T.leadFor(st) || '').length + (T.copyFor(st, null) || '').length + (st.try ? (T.tryFor(st.try) || '').length : 0); if (n > len) { len = n; best = i; } });
        Tour.start({ chapter: c.id, step: best });
        return 1; })()`,
      ready: `!!Tour.current() && Tour.current().chapter === ${JSON.stringify(ch)}` })),
    { name: 'menu examples', click: 'examplesBtn', dev: 'desktop' },
    { name: 'menu export', click: 'exportBtn', dev: 'desktop' },
    { name: 'menu share', click: 'shareBtn', dev: 'desktop' },
    { name: 'menu settings', click: 'settingsBtn', dev: 'desktop' },
    { name: 'menu help', click: 'helpBtn', dev: 'desktop' },
    { name: 'menu sound', click: 'soundMore', dev: 'desktop' },
    { name: 'palette', key: ['k', 4], dev: 'desktop', ready: LAYER },
    // (the preview and the LaTeX are typeset after the dialog opens, and the dialog's layout changes then)
    { name: 'export dialog', key: ['e', 4], wait: 1500, dev: 'desktop', ready: `!!document.querySelector('.modal-bg') && !document.querySelector('.modal-bg .xf-wait')?.checkVisibility() && !!document.getElementById('xfTex')?.textContent.trim()` },
    { name: 'menu more', click: 'hdrMoreBtn', dev: 'phone' },
    ...['edit', 'tools', 'display', 'more', 'chain'].map((k) => ({ name: 'sheet ' + k, go: `(Phone.open(${JSON.stringify(k)}), 1)`, wait: 900, dev: 'phone', ready: `Phone.sheet() === ${JSON.stringify(k)}` })),
    { name: 'sheet numbers', go: `(Phone.open('edit', { params: true }), 1)`, wait: 900, dev: 'phone', ready: `Phone.sheet() === 'edit'` },
    // (#2191: the Line integral popover on an open curve (the scene's line) and on a closed one (a disc added to the scene, taken out after), its two
    // row counts; on a phone, where its Copy and Close are touch targets)
    { name: 'line integral open curve', dev: 'phone', wait: 900, ready: LAYER,
      go: `(() => { const s = __cmwShapes().shapes.find((x) => x.kind === 'line'); return s && __cmwIntegrate(s.id) ? 1 : 'na'; })()` },
    { name: 'line integral closed curve', dev: 'phone', wait: 900, ready: LAYER,
      run: async () => {
        await ev(`__cmwSet('shapes', __cmwShapes().shapes.concat([{ id: 'lay-disc', kind: 'disc', c: [0.2, 0.1], r: 0.5, ci: 2, visible: true }])), 1`);
        await settle(1000);
        await ev(`__cmwIntegrate('lay-disc'), 1`);
      },
      after: `__cmwSet('shapes', __cmwShapes().shapes.filter((x) => x.id !== 'lay-disc'))` },
    { name: 'sphere', go: `__cmwSetView('R', 'sphere'), 1`, wait: 1500, views: ['classic'], after: `__cmwSetView('R', 'plane')` },
    // (#2222: a construction tool picked on a short landscape phone: the chip folds to its × and ?, the words in the context bar)
    { name: 'folded construction chip', dev: 'phone', views: ['classic'], page: '&view=classic', checks: ['target-size'], sizes: ['568x320', '640x360', '667x375', '740x360'], wait: 900,
      // (the classic page is slow to start where its typesetting loads: the tool's button answers a click only once the app has started, and a second click would put the tool back)
      run: async () => {
        await settled({ only: true, max: 40000, until: `typeof __cmwSteps === 'function' && document.documentElement.classList.contains('ph-land') && !!document.querySelector('#constructTools .tool[data-tool="hyper"]')` });
        // (a finger chooses the tool: the page takes the chip's touch form, the ×, from the last pointer press, which a machine with a mouse attached would otherwise not have)
        await ev(`(() => { const t = document.querySelector('#constructTools .tool[data-tool="hyper"]'); if (!t) return 0; window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })); if (!t.classList.contains('on')) t.click(); return 1; })()`);
      },
      ready: `(() => { const c = document.getElementById('draftChipL'); return !!c && !c.hidden && !!c.querySelector('.cm-x') && !c.querySelector('.cm-t')?.getClientRects().length && !!document.querySelector('.ph-ctx.in'); })()`,
      // (what the page is at when it does not open: told in the report's skipped list)
      why: `(() => { const c = document.getElementById('draftChipL'), t = document.querySelector('#constructTools .tool[data-tool="hyper"]'); return { cls: document.documentElement.className.slice(0, 60), wh: innerWidth + 'x' + innerHeight, tool: !!t, on: !!t && t.classList.contains('on'), chip: !!c, hidden: !!c && c.hidden, x: !!(c && c.querySelector('.cm-x')), words: c && c.querySelector('.cm-t') ? c.querySelector('.cm-t').getClientRects().length : -1, ctx: !!document.querySelector('.ph-ctx.in') }; })()`,
      after: `document.querySelector('#draftChipL .cm-x')?.click()` },
    // (#2418: the open key of Look down and the Stack on a short landscape phone: M3 z³ − 1.2z + 0.3 with a disc on w₁ (the scene's own page load, `seed`), the disc selected, the
    // Stack, the key unfolded. The one check that counts is that the key shows all it holds, its marks and the connector switch, where its room is 130 px at 320 tall)
    { name: 'stack key open', dev: 'phone', views: ['steps'], page: '&seed=stack-key', sizes: ['360', '568x320', '600x320', '740x360'], checks: ['scroll-cut'], wait: 900,
      seed: { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 70 }, steps: [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }],
        shapes: [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }] },
      run: async () => {
        await settled({ only: true, max: 40000, until: `typeof __cmwSteps === 'function' && __cmwSteps().ready.ready && __cmwSteps().i === 0` });
        await ev(`__cmwSelect('d'), 1`);
        await settled({ only: true, max: 20000, until: `typeof __cmwLookDown === 'function' && !!__cmwLookDown()` });
        await ev(`__cmwSteps({ surf: 'stack' }), 1`);
        await settled({ only: true, max: 30000, until: `__cmwSteps().surf === 'stack' && !!__cmwStack().drawn && !!__cmwStack().drawn.tubes` });
        await ev(`(() => { const b = document.querySelector('#plotL .ld-key > button.ld-ttl'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); return 1; })()`);
      },
      ready: `(() => { const k = document.querySelector('#plotL .ld-key'); return !!k && !k.classList.contains('folded') && !!k.querySelector('.ld-links'); })()`,
      why: `(() => { const k = document.querySelector('#plotL .ld-key'); return { key: k ? k.className : null, surf: __cmwSteps().surf, tubes: !!(__cmwStack().drawn && __cmwStack().drawn.tubes) }; })()`,
      after: `(() => { __cmwSteps({ surf: 'plane' }); __cmwSelect(null); return 1; })()` },
    // (a pane head's open pop-ups, in the desk sizes: placed from the head's right edge, under the head, against the Inspector's column: the Regions pop-up of the classic X → Y head,
    // and the ⋯ Display options pop-up of the head that has one. Each is ready once the pop-up is connected, laid out and its button pressed; the state is closed with its button)
    { name: 'head regions pop-up', dev: 'desktop', views: ['classic'], page: '&view=classic', sizes: ['1024', '1280', '1440'], wait: 600,
      run: async () => {
        await settled({ only: true, max: 20000, until: `!!document.querySelector('#paneL .pane-head .pat-btn')` });
        await ev(`document.querySelector('#paneL .pane-head .pat-btn').click(), 1`);
      },
      ready: `(() => { const b = document.querySelector('#paneL .pane-head .pat-btn'), p = document.querySelector('.pat-pop'); return !!b && b.getAttribute('aria-expanded') === 'true' && !!p && p.getClientRects().length > 0 && document.getAnimations().length === 0; })()`,
      why: `(() => { const b = document.querySelector('#paneL .pane-head .pat-btn'); return { btn: !!b, pressed: !!b && b.getAttribute('aria-expanded'), pop: !!document.querySelector('.pat-pop') }; })()`,
      after: `(() => { const b = document.querySelector('#paneL .pane-head .pat-btn'); if (b && b.getAttribute('aria-expanded') === 'true') b.click(); return 1; })()` },
    { name: 'head display options pop-up', dev: 'desktop', sizes: ['1024', '1280', '1440'], wait: 600,
      run: async () => {
        await settled({ only: true, max: 20000, until: `!![...document.querySelectorAll('.pane-head .opts-btn:not(.pat-btn)')].find((e) => e.getClientRects().length)` });
        await ev(`[...document.querySelectorAll('.pane-head .opts-btn:not(.pat-btn)')].find((e) => e.getClientRects().length).click(), 1`);
      },
      ready: `(() => { const p = document.querySelector('.disp-pop'), b = [...document.querySelectorAll('.pane-head .opts-btn:not(.pat-btn)')].find((e) => e.getAttribute('aria-expanded') === 'true'); return !!b && !!p && p.getClientRects().length > 0 && document.getAnimations().length === 0; })()`,
      why: `(() => ({ btns: [...document.querySelectorAll('.pane-head .opts-btn:not(.pat-btn)')].map((e) => e.getClientRects().length > 0), pop: !!document.querySelector('.disp-pop') }))()`,
      after: `(() => { const b = [...document.querySelectorAll('.pane-head .opts-btn:not(.pat-btn)')].find((e) => e.getAttribute('aria-expanded') === 'true'); if (b) b.click(); return 1; })()` },
    // (a longer chain than the default's two steps: the steps view's thread and the chain bar at their widest, #497)
    { name: 'chain of 4', run: grow, wait: 1500, ready: GROWN, after: SHRINK },
    // (the palette and the phone's sheets are also checked over a four-step chain, the longer chain they must fit)
    { name: 'palette on chain of 4', dev: 'desktop', run: async () => { await grow(); await key('k', 4); }, ready: `${GROWN} && ${LAYER}`, after: SHRINK },
    ...['edit', 'chain'].map((k) => ({ name: 'sheet ' + k + ' on chain of 4', dev: 'phone', run: async () => { await grow(); await ev(`(Phone.open(${JSON.stringify(k)}), 1)`); },
      ready: `${GROWN} && Phone.sheet() === ${JSON.stringify(k)}`, after: SHRINK })),
  ].map((s) => (s.click && !s.ready ? Object.assign({ ready: LAYER }, s) : s));

  const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
  // the theme, and no motion: a sheet or menu is measured where it stops, not on its way
  const theme = (dark) => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  const size = async (sz) => {
    const ph = sz.dev === 'phone';
    await send('Emulation.setDeviceMetricsOverride', { width: sz.w, height: sz.h, deviceScaleFactor: 1, mobile: ph });
    await send('Emulation.setTouchEmulationEnabled', { enabled: ph, maxTouchPoints: ph ? 5 : 1 });
  };
  const clickId = (id) => ev(`(() => { const b = document.getElementById(${JSON.stringify(id)}); if (!b || !b.checkVisibility()) return false; b.click(); return true; })()`);
  // back to the start: menus, dialogs, sheets, the tour, the deformation and the view closed or reset
  let undo = null;   // what puts back the last state that changed the page's own settings (the sphere)
  async function reset() {
    if (undo) { await ev(`(() => { try { ${undo}; } catch (e) { /* */ } return 1; })()`); undo = null; }
    for (let i = 0; i < 2; i++) { await key('Escape'); await sleep(120); }
    await ev(`(() => { try { Tour.stop(); } catch (e) { /* */ } try { if (window.Phone && Phone.isOn()) Phone.close(true); } catch (e) { /* */ }
      try { if (__cmwLayout().main !== 'xy') __cmwSetMain('xy'); } catch (e) { /* */ }
      try { document.activeElement && document.activeElement !== document.body && document.activeElement.blur(); } catch (e) { /* */ }
      // (a toast a state left, "Your work is back" after the tour, would sit over the next state)
      try { for (const t of document.querySelectorAll('#toastHost > *')) t.remove(); } catch (e) { /* */ }
      return 1; })()`);
    await settle(250);
  }
  // -> true once the state is drawn; false when it has nothing to open here or never got ready (twice)
  async function enter(st) {
    for (let tries = 0; tries < 2; tries++) {
      if (tries) await reset();
      if (st.after) undo = st.after;
      if (st.go) { const r = await ev(st.go); if (r === 'na') return 'na'; }
      if (st.click && !(await clickId(st.click))) return false;
      if (st.key) await key(st.key[0], st.key[1]);
      if (st.run) await st.run();
      await settle(st.wait || 600);
      if (!st.ready) return true;
      await ev(LIB);
      for (let t = 0; t < 30; t++) { if ((await ev(st.ready)) === true) { await settle(300); return true; } await sleep(500); }
    }
    return false;
  }

  // visits every point of the matrix of cfg ({ langs, views, devices, themes, sizes, states }) on the page at url (the
  // test page, test.html): one page load per language, view and kind of device. visit({ lang, view, size, state, theme })
  // runs with the state open, the theme set and test/lib/layout.js loaded. -> the points skipped, with the reason
  async function walk(cfg, url, visit) {
    const skipped = [];
    const sizes = SIZES.filter((s) => !cfg.sizes || cfg.sizes.includes(s.id));
    const states = STATES.filter((s) => !cfg.states || cfg.states.includes(s.name));
    // (a state with a `page` has its own page load: the real classic view, which the default page is not since the steps view is the default)
    const pages = [...new Set(states.map((s) => s.page || ''))];
    for (const lang of cfg.langs) for (const view of cfg.views) for (const dev of cfg.devices) for (const page of pages) {
      const mine = sizes.filter((s) => s.dev === dev);
      if (!mine.length || !states.some((s) => (s.page || '') === page && (!s.dev || s.dev === dev) && (!s.views || s.views.includes(view)))) continue;
      await size(mine[0]);
      await theme(false);
      const ns = `lay-${lang}-${view}-${dev}-${Date.now() % 1e6}`;
      // (a state that names a `seed` has its page load seeded with that scene: the page's storage written from the helpers page, on the same origin)
      const seeded = states.find((s) => (s.page || '') === page && s.seed);
      if (seeded) { await go(url.replace(/[^/]*$/, 'gl-helpers.html')); await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(seeded.seed))}); 1`); }
      await go(`${url}?ns=${ns}${lang === 'en' ? '' : '&lang=' + lang}${view === 'steps' ? '&view=steps' : ''}${page}`);
      await sleep(4500);
      if (view === 'steps' && !(await ev(`document.documentElement.classList.contains('sv')`))) { skipped.push(`${lang} steps ${dev}: this build has no ?view=steps`); continue; }
      // (whether a state is measured at a size, on this page, in this view, on this kind of device)
      const applies = (st, sz) => (st.page || '') === page && !(st.dev && st.dev !== dev) && !(st.views && !st.views.includes(view)) && !(st.sizes && !st.sizes.includes(sz.id)) && !(sz.only && !(st.sizes && st.sizes.includes(sz.id)));
      for (const sz of mine) {
        if (!states.some((st) => applies(st, sz))) continue;
        await size(sz);
        await theme(false);
        await settle(900);
        // (phone's lesson, #474: a size listed is a size measured)
        const got = await ev(`[innerWidth, innerHeight]`);
        if (!Array.isArray(got) || got[0] !== sz.w || got[1] !== sz.h) { skipped.push(`${lang} ${view} ${sz.id}: NOT RENDERED (the page is ${JSON.stringify(got)})`); continue; }
        for (const st of states) {
          if (!applies(st, sz)) continue;
          await reset();
          const opened = await enter(st);
          if (opened === 'na') continue;   // (the state has nothing to open here: no such chapter in this view)
          if (!opened) { skipped.push(`${lang} ${view} ${sz.id} ${st.name}: did not open` + (st.why ? ' ' + JSON.stringify(await ev(st.why)) : '')); continue; }
          for (const th of cfg.themes) {
            await theme(th === 'dark');
            await settle(150);
            await ev(LIB);
            await visit({ lang, view, dev, size: sz, state: st.name, theme: th, last: th === cfg.themes[cfg.themes.length - 1] });
          }
        }
      }
    }
    await reset();
    await theme(false);
    return skipped;
  }
  return { SIZES, STATES, LAYER, settle, theme, size, reset, enter, walk };
})();
