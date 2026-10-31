  // ---------------- the phone layout's adapter (src/phone.js; notes/ui-redesign-2/build/phone.md; #385) ----------------
  // what Phone.init gets: the app's side of the phone layout
  function phoneApi() {
    return {
      icons: ICONS, modeIcons: MODE_ICONS, morphOn: () => morphOn(),
      // (the steps view's surface, for the plane's Sphere key: null outside the steps view)
      svSphere: () => svSphereKey(), svOnSphere: () => (SV.on ? SV.surf === 'sphere' : null),
      showPanels: (ph) => { if (ph) { setHidden('L', false); setHidden('R', false); } else { setHidden('L', dockPref.L); setHidden('R', dockPref.R); } applyLayout(); requestRender('P'); },
      resize: () => { onPaneResize(); requestRender('L', 'R', 'OL', 'OR', 'T'); },
      // (v15.1, build/phone-swap.md: a plane's own view, the one it draws (X's leftView(), Y's V.right), its pane's
      // width, and whether the app fits it itself (Y's auto fit, X's at a focused step); setView writes that view)
      // (land: a running tween on that view ends at its target first, review-phone-swap swap-8)
      getView: (side, land) => {
        const v = side === 'L' ? leftView() : V.right, p = side === 'L' ? paneL : paneR;
        if (land) for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; if (tw.view === v) { Object.assign(v, tw.to); tweens.splice(i, 1); if (tw.onDone) tw.onDone(); } }
        return { cx: v.cx, cy: v.cy, s: v.s, w: p.w, h: p.h, auto: side === 'L' ? leftStage() > 0 && leftAuto : rightAuto };
      },
      setView: (side, v) => {
        const t = side === 'L' ? leftView() : V.right;
        for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].view === t) tweens.splice(i, 1);
        t.cx = v.cx; t.cy = v.cy; t.s = v.s;
        if (side === 'L') { if (leftStage() > 0) leftAuto = false; sourceViewChanged(); } else rightAuto = false;
        requestRender('L', 'R', 'OL', 'OR');
      },
      fit: (side) => $(side === 'L' ? 'leftFit' : 'rightFit').click(),
      // (#246) the phone's chain row and sheet: the plane it is at, ‹ › (the step glide), the deformation's programs
      // compiled ahead of the first press, a step's sheet, a step moved by the sheet's drag
      chainState: () => chainState(), glide: (d) => glideStep(d), cardClick: (k) => (k === 'F' ? selectStep('F') : cardClick(k)),
      prestart: () => { try { if (GLR.ok && GLR.prestartModes) GLR.prestartModes(S.homAll ? [3] : [1]); } catch (e) { /* the frame starts them */ } },
      moveStep: (k, d) => moveStep(k, d), toggleTransport: () => toggleTransport(),
      footKids: (side) => foot[side].kids.slice(Math.max(0, foot[side].n)),
      xyView: () => S.view.main === 'xy',   // ([v17 D5] the regions' display is the X → Y view's)
      renderInspector: () => renderProps(),
      openMenu: (a, items) => openMenu(a, items), closePops: () => closePalette(),
      theme: () => curTheme, setTheme: (t) => { curTheme = t; setTheme(t); sndToggleCue(t !== 'light'); },
      langPref: () => I18N.readPref(), setLang: (v) => pickLang(v),
      palName: () => PAL_NAMES()[GLR.palette()][0], palIcon: () => `<span class="pcol-ic" style="--wheel:${keyConic()}"></span>`, palMenu: (a, done) => openMenu(a, palItems(done)),
      styleState: () => ({ ...styleState(), svg: STYLE_SVG[S.dc] || '' }), styleMenu: (a, done) => openMenu(a, styleItems(done)),
      globeIcon: ICONS.globe,
      soundIcon: () => (($('soundBtn') || {}).querySelector && $('soundBtn').querySelector('.snd-ic') || {}).innerHTML || '',
      // (D3) what the phone's context bar shows: the polygon being drawn, a curve being listened along, the selected shape
      ctxState: () => {
        if (polyDraftOpen()) return { kind: 'polygon', n: draft.pts.length };
        // (a construction tool in hand: what to pick next, with the pick it can take back)
        if (Construct.isTool(tool)) return { kind: 'construct', text: Construct.hint(), undo: !!Construct.undoPickable(), seg: tool === 'perp' ? Construct.seg : tool === 'hyper' ? Construct.hyper : null, segs: tool === 'hyper' ? ['in', 'between'] : null };
        if (SND && snd.play) return { kind: 'listen' };
        const sel = selected && findShape(selected);
        if (!sel) return null;
        const r = shapeRows.get(sel.id);
        // ([#321] a typeset definition as the words its tooltip reads: the cell's text is MathJax's, or the raw TeX
        // until MathJax has loaded; a construction's definition and an error are plain text already)
        const def = !r ? '' : r.d.dataset.tex ? texTitle(r.d.dataset.tex) : r.d.textContent;
        return { kind: 'shape', id: sel.id, name: r ? r.k.textContent : '', def, used: Construct.usedBy(sel.id).length };
      },
      ctxAct: (act, id, anchor) => {
        if (act === 'last') polyBack();
        else if (act === 'done') finishPolygon();
        else if (act === 'cancel') cancelDrawing();
        else if (act === 'seg') { if (tool === 'hyper') Construct.hyper = id; else Construct.seg = id; requestRender('OL', 'OR'); }
        else if (act === 'undopick') $('undoBtn').click();
        else if (act === 'xcancel') { Construct.cancel(); setTool('select'); }
        else if (act === 'delete') deleteShape(id);
        else if (act === 'stop') sndStopPlay(true);
        else if (act === 'more') { const r = shapeRows.get(id); if (r && r.more) r.more(anchor); }
      },
      sound: (k, v) => (k === 'state' ? { has: !!SND, on: !!(SND && SND.prefs().on), sonify: !!(SND && SND.prefs().sonify) } : k === 'sonify' && SND ? (SND.set({ sonify: !!v }, { quiet: true }), null) : null),
      newScene: () => loadExample(0),
      exportFigure: () => Figure.open(),
      copyLatex: () => { copyText(latexDocument()); toast($t('LaTeX copied: the map, its natural domain and its guarantees.')); sndExportDone(); },
      openGuide: () => openGuide(),
      offlinePage: () => offlinePage(),   // [#21] the More sheet's Download offline page (null: none)
      exportItems: () => exportMenuItems(true),   // (v16.5 V02)
      // v16.5 UX12: the top layer a phone's Back closes, as the function that closes it (null: nothing is open). Top
      // first: the coordinate pad, the popover (the palette, a menu, a plane's menu, the integral, the options), the
      // tour's chapter menu, the sound settings, a dialog (Export, the guide), a popover of the top layer, the sheet
      backLayer: () => {
        if (padEl) return () => closePad();
        if (popEl) return () => closePalette();
        const tm = document.querySelector('#popHost > .tour-menu');
        if (tm) return () => { if (Tour.closeHelpMenu) Tour.closeHelpMenu(); else tm.remove(); };
        const sp = $('sndPop');
        if (sp && !sp.hidden) return () => { sp.hidden = true; const m = $('soundMore'); if (m) m.setAttribute('aria-expanded', 'false'); };
        const bgs = document.querySelectorAll('.modal-bg');
        if (bgs.length) { const bg = bgs[bgs.length - 1]; return () => bg.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
        let po = null;
        try { po = [...document.querySelectorAll(':popover-open')].find((e) => !e.closest('[data-tour]') && !e.classList.contains('tour-top')); } catch (e) { po = null; }
        if (po) return () => { try { po.hidePopover(); } catch (e) { /* */ } };
        if (Phone.sheet && Phone.sheet()) return () => Phone.close();
        const tmo = $('toolMore');
        if (tmo && tmo.open) return () => { tmo.open = false; };
        return null;
      },
    };
  }
