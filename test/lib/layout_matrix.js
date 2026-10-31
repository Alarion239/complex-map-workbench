// The matrix of the layout checks (#470): the sizes, the states and how to open each, and walk(), which visits every
// point of it. Shared by test/layout_invariants_cmd.js (the CI suite) and tools/inspect.js (the screenshot galleries).
// Not a module: a CDP-daemon command file (test/cdp_kit README) evals this text, so that ev, key, sleep and send are in
// scope: `const M = eval(fs.readFileSync(<this file>, 'utf8'));`. It also needs LIB, test/lib/layout.js's text.
(() => {
  const SIZES = [
    { id: '360', w: 360, h: 780, dev: 'phone' }, { id: '390', w: 390, h: 844, dev: 'phone' }, { id: '412', w: 412, h: 915, dev: 'phone' },
    { id: '740x360', w: 740, h: 360, dev: 'phone' }, { id: '915x412', w: 915, h: 412, dev: 'phone' },
    { id: '1024', w: 1024, h: 768, dev: 'desktop' }, { id: '1280', w: 1280, h: 800, dev: 'desktop' }, { id: '1440', w: 1440, h: 900, dev: 'desktop' },
  ];
  // the states: name, dev (phone or desktop only), views (the views it is in), go (a page script), click (a button's id),
  // key, run (an async function with the daemon's helpers), after (a page script that puts the page back), wait (ms), ready (a page expression that is true once the state is drawn, polled up to 15 s). A menu's ready is
  // that a layer (test/lib/layout.js INTENT.layers) is open
  const LAYER = `__layout.openLayers().length > 0`;
  const STATES = [
    { name: 'start' },
    { name: 'phase', go: `__cmwSetMain('phase'), 1`, wait: 1200, views: ['classic'] },
    { name: 'landscape', go: `__cmwSetMain('land'), 1`, wait: 1500, views: ['classic'] },
    { name: 'deformation', go: `__cmwMorph({ open: true, playing: false }), 1`, wait: 1200, views: ['classic'] },
    { name: 'inspector F', go: `(() => { const e = document.querySelector('#pipeline .ftile'); e && e.click(); return 1; })()`, dev: 'desktop' },
    { name: 'tour strip', go: `Tour.start({ chapter: 'basics' }), 1`, wait: 1500, ready: `!!Tour.current()` },
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
    { name: 'sphere', go: `__cmwSetView('R', 'sphere'), 1`, wait: 1500, views: ['classic'], after: `__cmwSetView('R', 'plane')` },
    // (a longer chain than the default's two steps: the steps view's thread and the chain bar at their widest, #497)
    { name: 'chain of 4', run: async () => { for (const f of ['sine', 'exponential']) { await key('k', 4); await sleep(500); await type(f); await sleep(500); await key('Enter'); await sleep(900); } },
      wait: 1500, ready: `document.querySelectorAll('#pipeline .card:not(.region-card)').length >= 4`,
      after: `(() => { for (let i = 0; i < 2; i++) { const u = document.getElementById('undoBtn'); u.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); u.click(); } })()` },
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
      try { __cmwMorph({ open: false }); } catch (e) { /* */ } try { if (__cmwLayout().main !== 'xy') __cmwSetMain('xy'); } catch (e) { /* */ }
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
      if (st.go) await ev(st.go);
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
    for (const lang of cfg.langs) for (const view of cfg.views) for (const dev of cfg.devices) {
      const mine = sizes.filter((s) => s.dev === dev);
      if (!mine.length) continue;
      await size(mine[0]);
      await theme(false);
      const ns = `lay-${lang}-${view}-${dev}-${Date.now() % 1e6}`;
      await send('Page.navigate', { url: `${url}?ns=${ns}${lang === 'en' ? '' : '&lang=' + lang}${view === 'steps' ? '&view=steps' : ''}` });
      await sleep(4500);
      if (view === 'steps' && !(await ev(`document.documentElement.classList.contains('sv')`))) { skipped.push(`${lang} steps ${dev}: this build has no ?view=steps`); continue; }
      for (const sz of mine) {
        await size(sz);
        await theme(false);
        await settle(900);
        // (phone's lesson, #474: a size listed is a size measured)
        const got = await ev(`[innerWidth, innerHeight]`);
        if (!Array.isArray(got) || got[0] !== sz.w || got[1] !== sz.h) { skipped.push(`${lang} ${view} ${sz.id}: NOT RENDERED (the page is ${JSON.stringify(got)})`); continue; }
        for (const st of states) {
          if ((st.dev && st.dev !== dev) || (st.views && !st.views.includes(view))) continue;
          await reset();
          if (!(await enter(st))) { skipped.push(`${lang} ${view} ${sz.id} ${st.name}: did not open`); continue; }
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
