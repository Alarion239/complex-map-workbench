  // ---------------- the page's shell: the header, its menus and Settings, the panels and drawers (#385) ----------------
  // (the area wiring init() calls, at the point where it had it; the theme the header cycles, which the phone's More
  // sheet reads and sets too)
  let curTheme = 'auto';
  // the header: the icons, the command field, its fit (init: before the view controls)
  function setupHeader() {
    // right tabs
    for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.ic-slot[data-icon]'))) el.innerHTML = ICONS[el.dataset.icon] || '';
    $('cmdKbd').textContent = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';
    $('cmdBtn').addEventListener('click', (e) => openPalette(e.currentTarget));
    hdrFitInit();
  }
  // the panels' sections: always open off the phone layout (:root.ph), toggles on it
  function setupSections() {
    // off the phone layout the panel sections are always open: their summaries are headings, not Tab stops or toggles.
    // ([#348] the phone is :root.ph, as Phone sets it, landscape phones up to 1023 px wide included, not a width query;
    // the sections follow the class when it changes)
    const isPhone = () => document.documentElement.classList.contains('ph');
    let wasPhone = null;
    const syncSections = () => {
      const ph = isPhone();
      if (ph === wasPhone) return;
      wasPhone = ph;
      for (const d of /** @type {NodeListOf<HTMLDetailsElement>} */ (document.querySelectorAll('details.psec'))) {
        const s = /** @type {HTMLElement | null} */ (d.querySelector(':scope > summary'));
        if (!s) continue;
        if (ph) s.removeAttribute('tabindex'); else { s.tabIndex = -1; d.open = true; }
      }
    };
    for (const d of /** @type {NodeListOf<HTMLDetailsElement>} */ (document.querySelectorAll('details.psec'))) d.addEventListener('toggle', () => { if (!isPhone() && !d.open) d.open = true; });
    new MutationObserver(syncSections).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    syncSections();
  }
  // the right click, the messages' place, the drawers and the panels' buttons (init: before applyLayout)
  function setupShell() {
    // (v16.5 UX99) a right click on a chain card or a Shapes row opens its ⋯ menu at the pointer, as on the planes
    // (a mouse only: a phone's long press keeps its own meaning)
    document.addEventListener('contextmenu', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t || document.documentElement.classList.contains('ph') || (e.pointerType && e.pointerType !== 'mouse')) return;
      const card = t.closest('#pipeline .card[data-k]'), row = !card && t.closest('.shape-row');
      const more = /** @type {HTMLButtonElement | null} */ (card ? card.querySelector('.card-head .more') : row ? row.querySelector(':scope > .more') : null);
      if (!more || more.disabled) return;
      e.preventDefault();
      if (popEl && popEl._opener === more) closePalette();
      more.click();
      const pop = popEl && popEl._opener === more ? popEl : null;
      if (!pop) return;
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let px = e.clientX + 2, py = e.clientY + 2;
      if (px + pw > window.innerWidth - 12) px = Math.max(12, e.clientX - pw - 2);
      if (py + ph > window.innerHeight - 12) py = Math.max(12, e.clientY - ph - 2);
      pop.style.left = px + 'px'; pop.style.top = py + 'px';
    });
    // (v16.5 UX80) a message is placed clear of the planes' controls when it shows and when the layout changes
    { const th = $('toastHost'); if (th) new MutationObserver(() => placeToasts()).observe(th, { childList: true }); window.addEventListener('resize', () => requestAnimationFrame(placeToasts));
      // ([v16.5 fix regress-2] and whenever the layout under a toast changes while it stays up: the deformation's dock
      // opening or closing, the learning lane showing or hiding, a panel: each resizes a plot or the chain; one rAF, and
      // only while a toast shows)
      if (th) {
        let q = 0;
        const ro = new ResizeObserver(() => { if (!q && th.firstElementChild) q = requestAnimationFrame(() => { q = 0; placeToasts(); }); });
        for (const el of [$('plotL'), $('plotR'), document.querySelector('.pipe-wrap')]) if (el) ro.observe(el);
      } }
    // crossing a drawer breakpoint: a drawer starts closed, a docked panel follows the user's choice
    let drawerWas = { L: isDrawer('L'), R: isDrawer('R') }, wideWas = window.innerWidth >= 768, oneWas = oneDock();
    window.addEventListener('resize', () => {
      const now = { L: isDrawer('L'), R: isDrawer('R') }, wide = window.innerWidth >= 768;
      if (wide && wideWas && (now.L !== drawerWas.L || now.R !== drawerWas.R)) {
        if (now.L !== drawerWas.L) setHidden('L', now.L || dockPref.L);
        if (now.R !== drawerWas.R) setHidden('R', now.R || dockPref.R);
        applyLayout();
      }
      drawerWas = now; wideWas = wide;
      if (oneDock() && !S.hideLeft && !S.hideRight) applyLayout();   // (v15: one docked panel from 1024 to 1279)
      // (review regress-1: back at 1280 or more, both panels follow the user's choice again)
      const one = oneDock();
      if (oneWas && !one && window.innerWidth >= 1280 && (S.hideLeft !== dockPref.L || S.hideRight !== dockPref.R)) { setHidden('L', dockPref.L); setHidden('R', dockPref.R); applyLayout(); }
      oneWas = one;
      if (tempInsp) placeTemp();
    });
    // a pointerdown outside an open overlay drawer closes it
    document.addEventListener('pointerdown', (e) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest('#popHost, .modal-bg')) return;
      const inL = t.closest('#leftPanel, #leftRail, #toggleLeft'), inR = t.closest('#rightPanel, #rightRail, #toggleRight');
      const l = isDrawer('L') && !S.hideLeft && !inL, r = isDrawer('R') && !S.hideRight && !inR;
      if (l || r) setPanels(S.hideLeft || l, S.hideRight || r);
    }, true);
    $('meshRange').addEventListener('change', (e) => setMesh(posToMesh(+/** @type {HTMLInputElement} */ (e.target).value)));
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#meshPresets button'))) b.addEventListener('click', () => setMesh(+b.dataset.n));
    $('toggleLeft').addEventListener('click', () => setPanels(!S.hideLeft, S.hideRight));
    $('toggleRight').addEventListener('click', () => setPanels(S.hideLeft, !S.hideRight));
    $('leftCollapse').addEventListener('click', () => setPanels(true, S.hideRight));
    $('leftRailOpen').addEventListener('click', () => setPanels(false, S.hideRight));
    $('rightRailOpen').addEventListener('click', () => setPanels(S.hideLeft, false));
    // (v15: the rail's Edit opens the selection in the temporary Inspector, over the stage's right edge)
    if ($('rightRailEdit')) $('rightRailEdit').addEventListener('click', () => { if (tempInsp) { closeTemp(); return; } if (window.innerWidth >= 1024 && S.hideRight) openTemp(); else setPanels(S.hideLeft, false); });
    $('leftSolo').addEventListener('click', () => setSolo('L'));
    $('rightSolo').addEventListener('click', () => setSolo('R'));
  }
  // the header's buttons and menus: undo and redo, help, sound, export, share, examples, the theme, the palette, Settings
  function setupHeaderButtons() {
    $('undoBtn').addEventListener('click', () => {
      // [v16.5 UX15] a construction's last pick, [UX14] an open polygon's last point, before any finished work
      const w = Construct.undoPick();
      if (w != null) { toast(w ? $t('Undid the pick: {x}', { x: w }) : $t('Undid the last pick')); updateUndo(); return; }
      if (polyBack()) return;
      if (hi > 0) { hi--; restore(hist[hi]); }
    });
    $('redoBtn').addEventListener('click', () => { if (hi < hist.length - 1) { hi++; restore(hist[hi]); } });
    $('helpBtn').addEventListener('click', (e) => Tour.openHelpMenu(e.currentTarget));
    sndInit();
    $('exportBtn').addEventListener('click', (e) => openExportMenu(e.currentTarget));
    $('shareBtn').addEventListener('click', (e) => openShareMenu(e.currentTarget));
    getDownloads(); // resolves the save capability early (no prompt until a save)
    $('examplesBtn').addEventListener('click', (e) => openGallery(e.currentTarget));
    // the cycle runs on the theme in use, so it still reaches Dark when storage is blocked
    curTheme = themePref();
    $('themeBtn').addEventListener('click', () => {
      const order = ['auto', 'light', 'dark'];
      curTheme = order[(order.indexOf(curTheme) + 1) % 3];
      setTheme(curTheme);
      sndToggleCue(curTheme !== 'light');
    });
    setTheme(curTheme);
    // Phase colors (issue 8): the palette menu, with a preview of each
    const pb = $('palBtn');
    if (pb) {
      pb.setAttribute('aria-expanded', 'false');
      pb.addEventListener('click', (e) => {
        const pop = openMenu(e.currentTarget, palItems());
        pb.setAttribute('aria-expanded', String(!!pop));
        if (pop) { const mo = new MutationObserver(() => { if (!pop.isConnected) { pb.setAttribute('aria-expanded', 'false'); mo.disconnect(); } }); mo.observe($('popHost'), { childList: true }); }
      });
      syncPalBtn();
    }
    // [v17 D5, #82] Settings (⚙): what is rarely changed, in one pop-down under the button: the theme, the language,
    // sound and its settings, the panels, mesh quality (lent from #settingsHome) and help. The Language setting (device
    // only: Auto, English, Русский, Italiano; a choice that changes the language reloads) is here and in the palette:
    // the header's globe went (notes/i18n/USER-DECISIONS.md, 2026-10-28)
    const sb = $('settingsBtn');
    if (sb) sb.addEventListener('click', () => openSettings(sb));
  }
  // [#21] the offline page: build.py writes its size into the live page (<meta name="cmw-offline">) and pages.yml
  // publishes it beside index.html, so the entry is a same-origin download. The offline page itself, the test page
  // and a copy opened from disk have no such entry (null)
  function offlinePage() {
    const m = document.querySelector('meta[name="cmw-offline"]'), n = m ? Number(m.getAttribute('content')) : 0;
    if (!(n > 0) || location.protocol === 'file:') return null;
    const file = 'complex-map-workbench-offline.html';
    return { file, label: $t('Download offline page ({size})', { size: $t('{n} MB', { n: I18N.num((n / 1e6).toFixed(1)) }) }),
      run: () => { const a = h('a', { href: file, download: file }); document.body.append(a); a.click(); a.remove(); } };
  }
  function openSettings(btn) {
    if (popEl && popEl.classList.contains('set-pop')) { closePalette(); btn.focus(); return; }   // (a re-click closes)
    closePalette();
    const sep = (t, first) => h('div', { class: 'opts-h' + (first ? '' : ' opts-sep') }, t);
    // (Auto's tooltip names what it would pick here: a test page's ?ns= stays English, review eng-12; the languages'
    // own names are never translated)
    const autoName = { en: 'English', ru: 'Русский', it: 'Italiano' }[I18N._resolve({ param: null, pref: 'auto', ns: I18N.NS, nav: navigator })] || 'English';
    const kids = [sep($t('Theme'), true), seg('setTheme', curTheme, [['auto', $t('Auto')], ['light', $t('Light')], ['dark', $t('Dark')]], (v) => { curTheme = v; setTheme(v); sndToggleCue(v !== 'light'); }, $t('Theme')),
      sep($t('Language')), seg('setLang', I18N.readPref(), [['auto', $t('Auto'), $t('Auto ({name})', { name: autoName })], ['en', 'English'], ['ru', 'Русский'], ['it', 'Italiano']], (v) => pickLang(v), $t('Language'))];
    if (SND) {
      const sw = h('input', { type: 'checkbox', class: 'snd-switch', role: 'switch', 'aria-label': $t('Sound') });
      sw.checked = !!SND.prefs().on;
      sw.addEventListener('change', () => { $('soundBtn').click(); sw.checked = !!SND.prefs().on; });
      kids.push(sep($t('Sound')), h('div', { class: 'set-row' }, h('span', { class: 'fl' }, $t('Sound (Shift+M)')), sw),
        h('button', { class: 'set-link', type: 'button', onclick: () => { closePalette(); $('soundMore').click(); } }, $t('Sound settings…')));
    }
    const panel = (label, key, on, set) => {
      const c = h('input', { type: 'checkbox' });
      c.checked = on;
      c.addEventListener('change', () => set(c.checked));
      return h('label', { class: 'check' }, c, h('span', null, label), h('span', { class: 'kbd' }, key));
    };
    kids.push(sep($t('Panels')), panel($t('Draw'), '[', !S.hideLeft, (v) => setPanels(!v, S.hideRight)), panel($t('Inspector'), ']', !S.hideRight, (v) => setPanels(S.hideLeft, !v)));
    const mesh = $('meshGroup');
    if (mesh) kids.push(sep(''), mesh);   // (the fader names itself: Mesh quality)
    const help = (label, run) => h('button', { class: 'set-link', type: 'button', onclick: () => { closePalette(); run(); } }, label);
    const off = offlinePage();
    kids.push(sep($t('Help')), h('div', { class: 'set-help' }, help($t('Guided tour'), () => Tour.openHelpMenu($('helpBtn'))), help($t('Guide'), () => openGuide()),
      help($t('Keyboard shortcuts'), () => { openGuide(); const k = [...document.querySelectorAll('.modal h3')].find((x) => ['Keys', $t('Keys')].includes(x.textContent.trim())); if (k) k.scrollIntoView({ block: 'start' }); }),
      off ? help(off.label, off.run) : null));
    const pop = h('div', { class: 'pop opts-pop set-pop', role: 'dialog', 'aria-label': $t('Settings') }, ...kids);
    pop._onClose = () => { btn.setAttribute('aria-expanded', 'false'); const home = $('settingsHome'); if (mesh && home && mesh.parentNode === pop) home.append(mesh); };
    $('popHost').append(pop);
    popEl = pop;
    btn.setAttribute('aria-expanded', 'true');
    // (under the button, its right edge on the button's, inside the window)
    const r = btn.getBoundingClientRect(), pw = pop.offsetWidth;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.right - pw)) + 'px';
    pop.style.top = (r.bottom + 6) + 'px';
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePalette(); btn.focus(); } });
    const first = pop.querySelector('.seg > .on') || pop.querySelector('button, input');
    if (first) first.focus({ preventScroll: true });
    armOutside(btn);
  }
