// v16.4 (notes/tour-r3/SPEC.md 7.4): the audit of the docked strip, every step of every chapter at 390 × 844, 1024 × 700
// and 1440 × 900, light and dark, English and Russian, mouse and touch (24 runs). Per step: the strip meets none of the
// panes, the chain, the tool row and the header's controls; its box is the same for every step of a chapter (a desktop:
// the panes' too); no lead, task, result or caption is cut (scrollHeight <= clientHeight + 1, scrollWidth <= clientWidth
// + 1); the title ends in an ellipsis only with the full title as its name; buttons at least 44 px on touch (36 with a
// mouse), 8 px apart; text contrast at least 4.5:1 in both themes, Next's countdown fill included; the lit patch holds
// the anchor (90 %); no app layer is left open by the tour (a phone's sheet the step opens aside). The old callout
// audit (place(), the docked callout, the mini bar) went with the callout. With AUDIT_SHOTS, every step is shot at 390
// and 1440 (touch and mouse), light and dark, English and Russian, into AUDIT_SHOTS (a folder).
// r3 review regress-3: v16.2's engine-independent passes are back, ported to the strip (test/tour_audit_spot.js holds
// v16.2's probe): spotlight-exact (each lit element's visible border box, its corner radius included, matches a drawn
// hole or ring within 1 px, the paths mapped through getScreenCTM; no hole that no lit element explains; the strip is a
// window of the shade), the task's control lit (ctl), layers (the palette, Examples, More, export, a toast, the sound
// settings, the guide and the Language menu over a step: the tour covers none of them and its rings are masked off
// each; layerAll: the palette and a toast on every step at 390, 768 and 1440), follow (a scroll, a resize and a layout
// change: the spotlight right in the next frame) and focus (each strip control shows a focus ring; the palette opened
// from the strip and closed with Esc gives the focus back to the strip). The sizes are v16.2's again: 360, 390, 844 ×
// 390, 768, 1024 × 700, 1152 × 720 and 1440 (inputs 'auto': touch on a phone's sizes, a mouse elsewhere).
// Run: test/<you>_cdp/q.sh test/tour_audit_cmd.js. A subset: prepend `const AUDIT_CFG = { sizes: [[390, 844]], ... }`.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const CFG = Object.assign({ sizes: [[360, 780], [390, 844], [844, 390], [768, 1024], [1024, 700], [1152, 720], [1440, 900]], themes: ['light', 'dark'], langs: ['en', 'ru'], inputs: ['mouse', 'touch'], shots: null,
  steps: true, spot: true, layers: true, follow: true, focus: true, layerAll: [390, 768, 1440] },
  typeof AUDIT_CFG !== 'undefined' ? AUDIT_CFG : {});
const SPOT = eval(fs.readFileSync(DIR + '/../tour_audit_spot.js', 'utf8') + '; SPOT');
const inject = () => ev(`window.__aud = ${SPOT}; 1`);
const U = `http://localhost:${PORT}/test.html`;
const R = [], ROWS = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
  // (v16.4: and until the step has settled: the strip no longer busy, the spotlight's morph over)
  for (let i = 0; i < 40; i++) { if (await ev(`!Tour.isActive() || (!document.querySelector('.tour-strip[aria-busy]') && !!Tour.lit() && !Tour.lit().moving)`)) break; await sleep(100); } };
logs();
const PROBE = `(() => {
  const strip = document.querySelector('.tour-strip');
  if (!strip || !Tour.isActive()) return null;
  const c = Tour.current(), L = Tour.lit();
  const rb = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
  const meet = (a, b) => !!a && !!b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
  const S = rb(strip);
  const hits = [];
  // (fix pass: what shows of a part, cut by the ancestors that clip it: the tool row in a drawer scrolled under its top)
  const vb = (e) => { let q = rb(e); if (!q) return null; for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue; const p = a.getBoundingClientRect(); q = { l: Math.max(q.l, p.left), t: Math.max(q.t, p.top), r: Math.min(q.r, p.right), b: Math.min(q.b, p.bottom) }; if (q.r <= q.l || q.b <= q.t) return null; } return q; };
  for (const [n, sel] of [['panes', '#panes'], ['chain', '.pipe-wrap'], ['tools', '#secDraw']]) { const e = document.querySelector(sel); if (e && e.getClientRects().length && meet(S, vb(e))) hits.push(n); }
  for (const b of document.querySelectorAll('header.top button, header.top select, header.top input')) { if (strip.contains(b) || !b.getClientRects().length || b.closest('[popover]:not(:popover-open)')) continue; const q = rb(b); if (q && meet(S, q)) hits.push('header:' + (b.id || b.getAttribute('aria-label') || b.textContent.trim().slice(0, 12))); }
  // cut text: the lead line and its parts, the text block
  const cut = [];
  for (const sel of ['.ts-lead', '.ts-l2', '.ts-text']) { const e = strip.querySelector(sel); if (e && e.getClientRects().length && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) cut.push(sel + ' ' + e.scrollWidth + 'x' + e.scrollHeight + '/' + e.clientWidth + 'x' + e.clientHeight); }
  const ti = strip.querySelector('.ts-title');
  const titleCut = ti && ti.getClientRects().length && ti.scrollWidth > ti.clientWidth + 1;
  const titleOk = !titleCut || ti.getAttribute('aria-label') === ti.textContent;
  // buttons: sizes and gaps
  const btns = [...strip.querySelectorAll('button')].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden' && !b.classList.contains('ts-text')).map((b) => { const q = b.getBoundingClientRect(); return { n: b.className.split(' ').pop(), l: q.left, r: q.right, w: q.width, h: q.height, t: q.top, b: q.bottom }; }).sort((a, b) => a.l - b.l);
  let gap = Infinity;
  for (let i = 1; i < btns.length; i++) gap = Math.min(gap, btns[i].l - btns[i - 1].r);
  // contrast of the strip's text on its background (alpha over the page), and of Next's label on its fill
  const rgb = (s) => { const m = String(s).match(/[\\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (e) => { for (let a = e; a; a = a.parentElement) { const c = rgb(getComputedStyle(a).backgroundColor); if (c.length < 4 || c[3] > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
  const con = {};
  for (const [n, sel] of [['title', '.ts-title'], ['lead', '#tourLead'], ['count', '.ts-count'], ['why', '.ts-wl']]) { const e = strip.querySelector(sel); if (e && e.getClientRects().length && e.textContent.trim()) con[n] = +ratio(rgb(getComputedStyle(e).color), bgOf(e)).toFixed(2); }
  const nx = strip.querySelector('.ts-next'), ncs = getComputedStyle(nx), fill = getComputedStyle(document.documentElement).getPropertyValue('--accent-hover').trim();
  const hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  con.next = +ratio(rgb(ncs.color), rgb(ncs.backgroundColor)).toFixed(2);
  // (r3 review user-4: the countdown is a bar along Next's bottom edge; it must stand off the button as its label does)
  con.bar = +ratio(rgb(getComputedStyle(nx, '::before').backgroundColor), rgb(ncs.backgroundColor)).toFixed(2);
  // the lit patch holds the anchor
  let frac = null;
  if (L && L.anchor && L.holes[0]) { const a = L.anchor, v = { l: Math.max(2, a.l), t: Math.max(2, a.t), r: Math.min(innerWidth - 2, a.r), b: Math.min(innerHeight - 2, a.b) }, h = L.holes[0]; const ar = Math.max(0, v.r - v.l) * Math.max(0, v.b - v.t); frac = ar ? Math.max(0, Math.min(h.r, v.r) - Math.max(h.l, v.l)) * Math.max(0, Math.min(h.b, v.b) - Math.max(h.t, v.t)) / ar : 1; }
  // the app's layers left open (a phone's sheet a step opens is part of the step, and so is the laptop's popover a step
  // opens, data-tour-layer naming that step: [v17 D4] the patterns step's Display ▾; still open at a later step, it counts)
  const layers = [...document.querySelectorAll('#popHost > *, .modal-bg > *, dialog[open]')].filter((e) => e.getClientRects().length && !e.closest('[data-tour]') && !(c && /** @type {HTMLElement} */ (e).dataset.tourLayer === c.chapter + '/' + c.id)).length;
  const pn = rb(document.querySelector('#panes'));
  return { id: c.chapter + '/' + c.id, ch: c.chapter, mode: strip.dataset.mode, strip: S && [S.l, S.t, S.r, S.b].map((v) => Math.round(v)), panes: pn && [pn.l, pn.t, pn.r, pn.b].map(Math.round), hits, cut, titleOk, btns: btns.map((b) => [b.n, Math.round(b.w), Math.round(b.h)]), minW: Math.min(...btns.map((b) => b.w)), minH: Math.min(...btns.map((b) => b.h)), gap: gap === Infinity ? null : +gap.toFixed(1), con, frac, layers, lead: document.querySelector('#tourLead').textContent };
})()`;
const runs = [];
const phoneSize = (w, h) => w < 768 || (w > h && h <= 430);
for (const [w, h] of CFG.sizes) for (const theme of CFG.themes) for (const lang of CFG.langs) for (const input of CFG.inputs) {
  if (input === 'auto') runs.push({ w, h, theme, lang, input: phoneSize(w, h) ? 'touch' : 'mouse' });
  else runs.push({ w, h, theme, lang, input });
}
const LAYERS = [], FOLLOW = [], FOCUS = [];
const seen = new Set();
for (const cfg of runs) {
  const { w, h, theme, lang, input } = cfg;
  const tag = `${w}-${theme}-${lang}-${input}`;
  const touch = input === 'touch';
  await view(w, h, theme === 'dark', touch);
  await nav(U + `?ns=aud${w}x${h}${theme[0]}${lang}${input[0]}` + (lang === 'ru' ? '&lang=ru' : '')); await settle(1500);
  await inject();
  await ev('Tour.dismissSuggestion()');
  await ev('Tour.auto(false)');
  if (CFG.steps) {
  await ev(`Tour.start({ chapter: 'basics' })`); await settle(1500);
  const byCh = {};
  const shoot = CFG.shots && (w === 390 || w === 1440) && ((w === 390) === touch);
  for (let k = 0; k < 60 && (await ev('Tour.isActive()')); k++) {
    const g = await ev(PROBE);
    if (!g) break;
    seen.add(`${tag}:${g.id}`);
    ROWS.push(Object.assign({ tag }, g));
    const n = `${tag} ${g.id}`;
    check(`${n}: the strip meets none of the panes, the chain, the tool row and the header's controls`, g.hits.length === 0, g.hits);
    check(`${n}: no lead, task, result or caption cut`, g.cut.length === 0, [g.cut, g.lead]);
    check(`${n}: the title cut only with its full name`, g.titleOk);
    check(`${n}: buttons ${touch || g.mode !== 'desk' ? 44 : 36} px at least, 8 px apart`, g.minW >= (touch || g.mode !== 'desk' ? 44 : 36) - 0.5 && g.minH >= (touch || g.mode !== 'desk' ? 44 : 36) - 0.5 && (g.gap == null || g.gap >= 7.5), [g.btns, g.gap]);
    check(`${n}: text contrast at least 4.5:1, Next and its countdown bar included`, Object.values(g.con).every((v) => v >= 4.5), g.con);
    if (g.frac != null) check(`${n}: the lit patch holds the anchor`, g.frac >= 0.9, g.frac);
    check(`${n}: no app layer left open by the tour`, g.layers === 0, g.layers);
    if (CFG.spot) {
      // (v16.2's spotlight-exact and lit-control checks, through its own probe)
      const sp = await ev(`({ spot: __aud.spot(), ctl: __aud.ctl() })`);
      const bad = (sp.spot || []).filter((x) => x.d > 1 || x.radD > 1 || x.cut || x.hiddenAnchor || (x.extra && x.extra.length) || (x.zero && x.zero.length));
      check(`${n}: spotlight exact (each lit box a drawn hole within 1 px, radii too; no stray hole)`, !bad.length, bad);
      check(`${n}: the task's control lit`, !(sp.ctl && sp.ctl.kinds.length), sp.ctl);
    }
    const b = byCh[g.ch] || (byCh[g.ch] = { strip: g.strip, panes: g.panes, ids: [] });
    b.ids.push(g.id);
    check(`${n}: the strip in one place through the chapter${g.mode === 'desk' ? ' (and the panes one size)' : ''}`, JSON.stringify(b.strip) === JSON.stringify(g.strip) && (g.mode !== 'desk' || JSON.stringify(b.panes) === JSON.stringify(g.panes)), { first: b.strip, now: g.strip, panes0: b.panes, panes: g.panes });
    if (shoot) {
      const name = `${w}-${theme}-${lang}-${g.id.replace('/', '-')}`;
      await shot('../../../../../notes/tour-r3/shots/' + name);
    }
    const before = JSON.stringify(await ev('Tour.current()'));
    await ev('Tour.next()'); await settle(1100);
    if ((await ev('Tour.isActive()')) && JSON.stringify(await ev('Tour.current()')) === before) { check(`${n}: Next moves on`, false, before); break; }
  }
  // every step this build has was visited
  const n = [...seen].filter((s) => s.startsWith(tag + ':')).length;
  // (46 steps since issue #13 took out edit/zpHere, the planes' menu's "Add zero of f₁ here")
  check(`${tag}: every step visited (46, less what the layout leaves out)`, n >= 44, n);
  await ev('Tour.isActive() && Tour.stop()'); await sleep(250);
  }
  // ---- layers (v16.2's pass, for the strip): during a step, open each layer of the app
  if (CFG.layers && theme === 'light') {
    const runLayer = async (stepAt, name, open, close, sel) => {
      await ev(`Tour.start(${JSON.stringify(stepAt)})`); await settle(1300);
      const id = stepAt.chapter + '/' + stepAt.step;
      const opened = await open();
      await sleep(450); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
      const g = await ev(`(() => {
        const L = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(__aud.vis)[0];
        if (!Tour.isActive()) return { tour: false };
        if (!L) return { layer: false };
        const b = L.getBoundingClientRect();
        const pts = [[(b.left + b.right) / 2, (b.top + b.bottom) / 2], [b.left + 6, b.top + 6], [b.right - 6, b.top + 6], [b.left + 6, b.bottom - 6], [b.right - 6, b.bottom - 6]];
        const lay = pts.map(([x, y]) => { if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return 'offscreen'; const e = document.elementFromPoint(x, y); return e && L.contains(e) ? 'ok' : e ? (e.closest('[data-tour]') ? 'tour' : 'other') : 'none'; });
        return { layer: true, lbox: [b.left, b.top, b.right, b.bottom].map(Math.round), lay, ringsOff: __aud.ringsOff(L), strip: !!document.querySelector('.tour-strip') && document.querySelector('.tour-strip').getClientRects().length > 0 };
      })()`);
      const kinds = [];
      if (opened === 'na') { /* not in this layout */ }
      else if (g.tour === false) kinds.push('tourEnded');
      else if (!g.layer) kinds.push('noLayer');
      else {
        if (g.lay.some((x) => x === 'tour')) kinds.push('layerUnderTour');
        if (!g.ringsOff) kinds.push('ringOverLayer');
        if (!g.strip) kinds.push('noStrip');
      }
      await close(); await sleep(350);
      const after = await ev(`({ active: Tour.isActive(), layer: [...document.querySelectorAll(${JSON.stringify(sel)})].some(__aud.vis) })`);
      if (opened !== 'na' && !after.active) kinds.push('tourEndedOnClose');
      if (opened !== 'na' && after.layer) kinds.push('layerStays');
      LAYERS.push({ tag, id, layer: name, g, after, kinds, na: opened === 'na' });
      check(`${tag} ${id} layer ${name}: the tour covers none of it, its rings masked off it, the tour stays`, !kinds.length, { g, after, kinds });
      await ev('Tour.isActive() && Tour.stop()'); await sleep(250);
    };
    const esc = async () => { await key('Escape'); return true; };
    const X = { chapter: 'basics', step: 1 };
    const toastOpen = async () => ev(`(() => { __tourApi.toast('Deleted: circle 3. A long message so the toast is wide'); return true; })()`);
    const toastClose = async () => ev(`(() => { document.querySelector('#toastHost').innerHTML = ''; return true; })()`);
    // (v16.5 UX17: "Palette and keys" is a chapter for the keyboard, not offered on a touch screen: there the palette is
    // checked at the next step only)
    if (await ev(`Tour._t.chapterShown(Tour._t.CHAPTERS.find((c) => c.id === 'keys'))`)) await runLayer({ chapter: 'keys', step: 0 }, 'palette', async () => { await key('k', 4); return true; }, esc, '#popHost > .pop.palette');
    await runLayer(X, 'palette', async () => { await key('k', 4); return true; }, esc, '#popHost > .pop.palette');
    await runLayer(X, 'examples', async () => ev(`(() => { const m = document.querySelector('#hdrMoreBtn'); const narrow = m && m.checkVisibility(); if (narrow) m.click(); const e = document.querySelector('#examplesBtn'); if (!e || !e.checkVisibility()) return 'na'; e.click(); return true; })()`), esc, '#popHost > .pop');
    await runLayer(X, 'more', async () => ev(`(() => { const m = document.querySelector('#hdrMoreBtn'); if (!m || !m.checkVisibility()) return 'na'; m.click(); return true; })()`), esc, '#hdrMenu:popover-open, .ph-sheet[data-k="more"]:not([hidden])');
    await runLayer(X, 'export', async () => { await key('e', 4); return true; }, esc, '.modal-bg > .modal');
    await runLayer(X, 'toast', toastOpen, toastClose, '#toastHost > .toast');
    await runLayer(X, 'sound', async () => ev(`await (async () => { const m = document.querySelector('#hdrMoreBtn'), s = document.querySelector('#soundMore'); if (!s) return 'na'; if (!s.checkVisibility() && m && m.checkVisibility()) { m.click(); await new Promise((r) => setTimeout(r, 200)); } if (!s.checkVisibility()) return 'na'; s.click(); return true; })()`),
      async () => { await ev(`document.querySelector('.tour-strip .ts-next').focus()`); await key('Escape'); return true; }, '.snd-pop:not([hidden])');
    await runLayer(X, 'guide', async () => ev(`(() => { __tourApi.openGuide(); return true; })()`), esc, '.modal-bg > .modal');
    await runLayer(X, 'language', async () => ev(`await (async () => { const m = document.querySelector('#hdrMoreBtn'), lb = document.querySelector('#settingsBtn');   /* ([v17 D5] Language is in Settings: the globe went) */ if (!lb) return 'na'; if (!lb.checkVisibility() && m && m.checkVisibility()) { m.click(); await new Promise((r) => setTimeout(r, 200)); } if (!lb.checkVisibility()) return 'na'; lb.click(); return true; })()`), esc, '#popHost > .pop');
    if ((CFG.layerAll || []).includes(w) && lang === 'ru') {
      const all = await ev(`Tour._t.CHAPTERS.flatMap((c, i) => c.steps.map((s, j) => ({ chapter: c.id, step: j, id: c.id + '/' + s.id, absent: Tour._t.absent(i, j, true) || !Tour._t.chapterShown(c) })))`);
      for (const at of all.filter((x) => !x.absent)) {
        const st = { chapter: at.chapter, step: at.step };
        await runLayer(st, 'palette*', async () => { await key('k', 4); return true; }, esc, '#popHost > .pop.palette');
        await runLayer(st, 'toast*', toastOpen, toastClose, '#toastHost > .toast');
      }
    }
  }
  // ---- focus: each strip control shows a focus ring; the palette from the strip, Esc: the focus back in the strip
  if (CFG.focus && theme === 'light') {
    await ev(`Tour.start({ chapter: 'basics', step: 1 })`); await settle(1300);
    await ev(`document.querySelector('.tour-strip .ts-next').focus()`);
    const seenF = [];
    for (let i = 0; i < 4; i++) {
      await key('Tab', i === 3 ? 8 : 0);
      seenF.push(await ev(`(() => { const a = document.activeElement; if (!a) return null; const cs = getComputedStyle(a); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || /(\\d+(\\.\\d+)?px\\s*){3}[1-9]/.test(cs.boxShadow); return { label: (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 30), inStrip: !!a.closest('.tour-strip'), ring }; })()`));
    }
    await ev(`document.querySelector('.tour-strip .ts-next').focus()`);
    await key('k', 4); await sleep(250);
    for (const c of 'sin') await key(c);
    await sleep(150); await key('Escape'); await sleep(300);
    const back = await ev(`({ inStrip: !!(document.activeElement && document.activeElement.closest('.tour-strip')), tour: Tour.isActive() })`);
    FOCUS.push({ tag, seenF, back });
    check(`${tag} focus: every strip control the focus reaches shows a ring`, seenF.every((x) => !x || !x.inStrip || x.ring), seenF);
    check(`${tag} focus: the palette from the strip, Esc: the tour stays and the focus is back in the strip`, back.tour && back.inStrip, back);
    await ev('Tour.isActive() && Tour.stop()'); await sleep(250);
  }
  // ---- follow: the spotlight keeps up with a scroll, a resize and a layout change, in the next frame
  if (CFG.follow && theme === 'light') {
    const worst = `(() => { const s = __aud.spot() || []; return s.length ? Math.max(...s.map((x) => x.d)) : null; })()`;
    const one = async (stepAt, name, act) => {
      await ev(`Tour.start(${JSON.stringify(stepAt)})`); await settle(1300);
      const r = await act();
      if (r && r.skip) { FOLLOW.push({ tag, name, skipped: r.skip }); await ev('Tour.isActive() && Tour.stop()'); await sleep(200); return; }
      FOLLOW.push({ tag, name, r });
      check(`${tag} follow ${name}: the spotlight right in the next frame and after it`, r && r.d1 != null && r.d1 <= 1 && r.d6 != null && r.d6 <= 1, r);
      await ev('Tour.isActive() && Tour.stop()'); await sleep(200);
    };
    await one({ chapter: 'analysis', step: 4 }, 'scroll', async () => ev(`await (async () => {
      const tg = Tour.lit() && Tour.lit().anchor; if (!tg) return { skip: 'no anchor' };
      let el = document.elementFromPoint((tg.l + tg.r) / 2, (tg.t + tg.b) / 2);
      let sc = null;
      for (let a = el; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 40) { sc = a; break; } }
      const sy = sc ? sc.scrollTop : scrollY;
      const max = sc ? sc.scrollHeight - sc.clientHeight : document.documentElement.scrollHeight - innerHeight;
      if (max < 20) return { skip: 'nothing scrolls' };
      const dy = sy + 40 <= max ? 40 : -40;
      if (sc) sc.scrollTop = sy + dy; else scrollTo(0, scrollY + dy);
      await __aud.frame(); const d1 = ${worst};
      for (let i = 0; i < 5; i++) await __aud.frame(); const d6 = ${worst};
      return { d1, d6, by: dy, where: sc ? (sc.id || sc.className) : 'page' };
    })()`));
    await one({ chapter: 'basics', step: 1 }, 'resize', async () => {
      await view(w - 40, h, theme === 'dark', touch);
      const d1 = await ev(`await (async () => { await __aud.frame(); return ${worst}; })()`);
      const d6 = await ev(`await (async () => { for (let i = 0; i < 6; i++) await __aud.frame(); return ${worst}; })()`);
      await view(w, h, theme === 'dark', touch);
      return { d1, d6 };
    });
    await one({ chapter: 'basics', step: 6 }, 'layout', async () => ev(`await (async () => {
      const a = Tour.lit() && Tour.lit().anchor; if (!a) return { skip: 'no anchor' };
      const e = __aud.resolve(Tour._t.CHAPTERS.find((c) => c.id === Tour.current().chapter).steps[Tour.current().step].anchor);
      if (!e || !e.style) return { skip: 'no element' };
      const old = e.style.paddingBottom; e.style.paddingBottom = (parseFloat(getComputedStyle(e).paddingBottom) + 24) + 'px';
      await __aud.frame(); await __aud.frame(); const d1 = ${worst};
      for (let i = 0; i < 5; i++) await __aud.frame(); const d6 = ${worst};
      e.style.paddingBottom = old;
      return { d1, d6 };
    })()`));
  }
}
// (as v16.2's: a step the layout leaves out is reported by the engine and counted by "every step visited", not here;
// views/key at 844 × 390 since v15, notes/tour/POLISH.md)
const LALL = logs();
const SKIPS = LALL.filter((l) => /\[tour\] step skipped/.test(l.m)).map((l) => l.m);
const L = LALL.filter((l) => /EXC|\[tour\]/i.test(l.t + l.m) && !/\[tour\] step skipped/.test(l.m)).slice(0, 12);
check('no exceptions or tour warnings', !L.length, L);
try { fs.mkdirSync(DIR + '/audit', { recursive: true }); fs.writeFileSync(DIR + '/audit/strip.json', JSON.stringify({ rows: ROWS, layers: LAYERS, follow: FOLLOW, focus: FOCUS }, null, 0)); } catch (e) { /* */ }
await view(1440, 900, false, false);
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, runs: runs.length, steps: ROWS.length, fails: fails.slice(0, 60), nFails: fails.length, logs: L, skipped: [...new Set(SKIPS)] };
