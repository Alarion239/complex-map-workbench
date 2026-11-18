// The keyboard of the head's Display options pop-up (#1730), in the steps view on the Landscape on a laptop, and the wrap of the
// segmented rows on a phone (whose Display sheet is not a pop-up: it has no ⋯ button and no Escape to the anchor):
//  - Escape closes it and returns the focus to the head's ⋯ button, whose aria-expanded is false (the popover rule: focus moves in
//    and returns to the anchor);
//  - the arrows of a segmented row wrap, as a radiogroup's do: → on the last Colouring choice (Plaster) checks and focuses the
//    first (Tiles), ← on the first checks and focuses the last; on the phone the same row in the Display sheet;
//  - the pop-up is a non-modal dialog, so Tab does not trap: Shift+Tab from its first control and Tab from its last close it and
//    return the focus to the ⋯ button (the focus does not stay in an open pop-up that sits apart from the page's Tab order).
// Real key events (CDP Input). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SHIFT = 8;
const CUBE = { type: 'pown', params: { n: 3 }, on: true };
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [CUBE], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const opener = "document.querySelector('.pane-head .opts-btn[aria-label=\"Display options\"]')";
const popOpen = "!!document.querySelector('.opts-pop')";
// (where the focus is: the pop-up's control, with its group and value, or the ⋯ button)
const where = () => ev(`(() => { const a = document.activeElement, g = a && a.closest && a.closest('[role="radiogroup"]'); return { inPop: !!a && !!a.closest('.opts-pop'), anchor: a === ${opener}, group: g ? g.id : null, v: a && a.dataset ? a.dataset.v : null, checked: !!a && a.getAttribute('aria-checked') === 'true', expanded: ${opener} ? ${opener}.getAttribute('aria-expanded') : null, open: ${popOpen} }; })()`);
const open = async () => {
  await ev(`${opener}.focus(); 1`); await key('Enter');
  const w = await settled({ until: popOpen, max: 8000, only: true });
  ok('the pop-up opens from the ⋯ button', w.ok, w);
};
const closeIf = async () => { if (await ev(popOpen)) { await key('Escape'); await settled({ until: `!${popOpen}`, max: 8000, only: true }); } };
const tag = 'laptop', W = 1440, H = 900, phone = false;
{
  const ns = 'svhp' + tag + Date.now();
  await view(W, H, phone, phone);
  await loadView('steps', ns, st, { lang: 'en' });
  await settled({ max: 30000, until: "window.__cmwSteps && __cmwSteps().on && !!document.querySelector('#svStrip .sv-rail')" });
  await ev(`(__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }), 1)`);
  await settled({ max: 30000, until: "window.__cmwSteps && !__cmwSteps().moving" });
  // 1. Escape returns the focus to the anchor
  await open();
  await key('Escape');
  await settled({ until: `!${popOpen}`, max: 8000, only: true });
  const esc = await where();
  ok(`${tag}: Escape closes the pop-up`, esc.open === false, esc);
  ok(`${tag}: Escape returns the focus to the ⋯ button, aria-expanded false`, esc.anchor && esc.expanded === 'false', esc);
  // 2. the arrows wrap on the Colouring row
  await open();
  // (the focus is on the checked choice, as the pop-up leaves it)
  await ev(`(() => { const b = document.querySelector('#landPaint button[data-v="plaster"]'); b.click(); b.focus(); return 1; })()`);
  const w0 = await settled({ until: "document.querySelector('#landPaint button.on').dataset.v === 'plaster'", max: 4000, only: true });
  ok(`${tag}: the Plaster choice is checked before the arrows`, w0.ok, w0);
  // (Plaster redraws the relief and refills the row: the arrows are pressed on the quiet page, on the checked choice)
  await settled({ max: 30000 });
  await ev(`document.querySelector('#landPaint button.on').focus(), 1`);
  await key('ArrowRight');
  const wr = await settled({ until: "document.querySelector('#landPaint button.on') && document.querySelector('#landPaint button.on').dataset.v === 'tiles'", max: 4000, only: true });
  info[tag + ' right wait'] = wr.ok;
  await settled({ max: 30000 });
  const right = await where();
  info[tag + ' right'] = right;
  ok(`${tag}: → on the last Colouring choice (Plaster) checks and focuses the first (Tiles)`, right.group === 'landPaint' && right.v === 'tiles' && right.checked, right);
  await key('ArrowLeft');
  const wl = await settled({ until: "document.querySelector('#landPaint button.on') && document.querySelector('#landPaint button.on').dataset.v === 'plaster'", max: 4000, only: true });
  info[tag + ' left wait'] = wl.ok;
  await settled({ max: 30000 });
  const left = await where();
  info[tag + ' left'] = left;
  ok(`${tag}: ← on the first choice (Tiles) checks and focuses the last (Plaster)`, left.group === 'landPaint' && left.v === 'plaster' && left.checked, left);
  await closeIf();
  // 3. Tab leaves the non-modal dialog by closing it, the focus back on the anchor. The pop-up's tab stops are the controls the
  // browser's own sequential order reaches in it (tabIndex 0 or more, enabled, shown), not the source's selector
  const stopsJs = "[...document.querySelectorAll('.opts-pop *')].filter((e) => e.tabIndex >= 0 && !e.disabled && e.offsetParent !== null)";
  await open();
  const nStops = await ev(`${stopsJs}.length`);
  ok(`${tag}: the pop-up has at least three tab stops (a middle one exists)`, nStops >= 3, nStops);
  await closeIf();
  for (const [name, mods, pick] of [['Shift+Tab from the first control', SHIFT, 'first'], ['Tab from the last control', 0, 'last']]) {
    await open();
    await ev(`(() => { const c = ${stopsJs}; c[${pick === 'first' ? '0' : 'c.length - 1'}].focus(); return c.length; })()`);
    await key('Tab', mods);
    await settled({ until: `!${popOpen}`, max: 3000, only: true });
    const t = await where();
    info[tag + ' ' + pick] = t;
    ok(`${tag}: ${name} closes the pop-up and returns the focus to the ⋯ button`, t.open === false && t.anchor && t.expanded === 'false', t);
    await closeIf();
  }
  // Tab from a control in the middle goes to the next control and the pop-up stays open
  await open();
  await ev(`(() => { const c = ${stopsJs}; c[1].focus(); return c.length; })()`);
  const mid0 = await where();
  await key('Tab');
  const mid = await where();
  info[tag + ' middle'] = { before: mid0, after: mid };
  ok(`${tag}: Tab from a middle control keeps the pop-up open, the focus in it and not on the ⋯ button`, mid.open === true && mid.inPop && !mid.anchor, mid);
  await closeIf();
  // a control that Tab does not reach (a segmented row's unchecked choice, tabindex -1) can hold the focus too, after a click: with
  // Plaster checked, Tiles lies before the first tab stop, and Shift+Tab from it leaves the pop-up as well
  await open();
  await ev(`(() => { const b = document.querySelector('#landPaint button[data-v="plaster"]'); b.click(); return 1; })()`);
  const pl = await settled({ until: "document.querySelector('#landPaint button.on') && document.querySelector('#landPaint button.on').dataset.v === 'plaster'", max: 4000, only: true });
  ok(`${tag}: Plaster is checked before the Shift+Tab from Tiles`, pl.ok, pl);
  await settled({ max: 30000 });
  await ev(`(() => { const t = document.querySelector('#landPaint button[data-v="tiles"]'); t.focus(); return t.tabIndex; })()`);
  const tabIdx = await ev(`document.activeElement.tabIndex`);
  ok(`${tag}: Tiles is a tabindex -1 control that holds the focus`, tabIdx === -1, tabIdx);
  await key('Tab', SHIFT);
  await settled({ until: `!${popOpen}`, max: 3000, only: true });
  const tl = await where();
  info[tag + ' tiles'] = tl;
  ok(`${tag}: Shift+Tab from the unchecked Tiles (before the first tab stop) closes the pop-up and returns the focus to the ⋯ button`, tl.open === false && tl.anchor && tl.expanded === 'false', tl);
  await closeIf();
  // Home and End on a segmented row check and focus its first and last choice
  await open();
  await ev(`(() => { const b = document.querySelector('#landPaint button[data-v="tiles"]'); b.click(); b.focus(); return 1; })()`);
  const t0w = await settled({ until: "document.querySelector('#landPaint button.on') && document.querySelector('#landPaint button.on').dataset.v === 'tiles'", max: 4000, only: true });
  ok(`${tag}: Tiles is checked before End`, t0w.ok, t0w);
  await settled({ max: 30000 });
  await ev(`document.querySelector('#landPaint button.on').focus(), 1`);
  await key('End');
  const endW = await settled({ until: "document.querySelector('#landPaint button.on') && document.querySelector('#landPaint button.on').dataset.v === 'plaster'", max: 4000, only: true });
  await settled({ max: 30000 });
  const endF = await where();
  ok(`${tag}: End on the Colouring row checks and focuses the last choice (Plaster)`, endW.ok && endF.group === 'landPaint' && endF.v === 'plaster', endF);
  await key('Home');
  const homeW = await settled({ until: "document.querySelector('#landPaint button.on') && document.querySelector('#landPaint button.on').dataset.v === 'tiles'", max: 4000, only: true });
  await settled({ max: 30000 });
  const homeF = await where();
  ok(`${tag}: Home on the Colouring row checks and focuses the first choice (Tiles)`, homeW.ok && homeF.group === 'landPaint' && homeF.v === 'tiles', homeF);
  // the ⋯ button looks pressed while the pop-up is open (its background changes, with a transition), and plain again when it closes
  const bgOf = `getComputedStyle(${opener}).backgroundColor`;
  const PLAIN = 'rgba(0, 0, 0, 0)';
  await closeIf();
  await ev(`${opener}.blur(); 1`);
  const pl0 = await settled({ until: `${bgOf} === ${JSON.stringify(PLAIN)}`, max: 3000, only: true });
  ok(`${tag}: the ⋯ button is plain (transparent) with the pop-up closed`, pl0.ok, pl0);
  const plain = PLAIN;
  await open();
  const pr = await settled({ until: `${bgOf} !== ${JSON.stringify(plain)}`, max: 3000, only: true });
  ok(`${tag}: the ⋯ button looks pressed (its background differs from ${plain}) while the pop-up is open`, pr.ok, pr);
  await closeIf();
  await ev(`${opener}.blur(); 1`);
  const rel = await settled({ until: `${bgOf} === ${JSON.stringify(plain)}`, max: 3000, only: true });
  ok(`${tag}: the ⋯ button is plain again once the pop-up is closed`, rel.ok, rel);
  // the Language row of Settings does not wrap: its change reloads the page, so no arrow past its end may reach it
  await ev(`window.__keepMarker = 1; document.getElementById('settingsBtn').click(); 1`);
  const lw = await settled({ until: "!!document.querySelector('#setLang button[data-v=\"auto\"]')", max: 8000, only: true });
  ok(`${tag}: Settings shows the Language row`, lw.ok, lw);
  const langState = () => ev(`({ kept: window.__keepMarker === 1, on: (document.querySelector('#setLang button.on') || {}).dataset ? document.querySelector('#setLang button.on').dataset.v : null, focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.v : null })`);
  const quiet = async () => { await ev(`window.__langT0 = performance.now(); 1`); await settled({ until: 'performance.now() - window.__langT0 > 1500', max: 6000, only: true }); };
  const first = await ev(`(() => { const b = document.querySelector('#setLang button[data-v="auto"]'); b.focus(); return document.querySelector('#setLang button.on').dataset.v; })()`);
  ok(`${tag}: the Language row starts on Auto`, first === 'auto', first);
  await key('ArrowLeft');
  await quiet();
  const l1 = await langState();
  ok(`${tag}: ← on Auto stays on Auto (no wrap to Italiano, the page is not reloaded)`, l1.kept && l1.on === 'auto' && l1.focus === 'auto', l1);
  await key('End');
  await quiet();
  const l2 = await langState();
  ok(`${tag}: End on the Language row does not jump to its last choice`, l2.kept && l2.on === 'auto' && l2.focus === 'auto', l2);
}
// the phone: the Display sheet holds the same Colouring row, and it wraps on the arrows too
{
  const ns = 'svhpph' + Date.now();
  await view(390, 844, true, true);
  await loadView('steps', ns, st, { lang: 'en' });
  await settled({ max: 30000, until: "window.__cmwSteps && __cmwSteps().on" });
  await ev(`(__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }), 1)`);
  await settled({ max: 30000, until: "window.__cmwSteps && !__cmwSteps().moving" });
  await ev(`Phone.open('display'), 1`);
  const w = await settled({ until: "!!document.getElementById('landPaint') && document.getElementById('landPaint').offsetParent !== null", max: 10000, only: true });
  ok('phone: the Display sheet opens with the Colouring row', w.ok, w);
  const checked = "document.querySelector('#landPaint button.on') && document.querySelector('#landPaint button.on').dataset.v";
  await ev(`(() => { const b = document.querySelector('#landPaint button[data-v="plaster"]'); b.click(); b.focus(); return 1; })()`);
  const p0 = await settled({ until: `${checked} === 'plaster'`, max: 4000, only: true });
  ok('phone: Plaster is checked before the arrows', p0.ok, p0);
  await settled({ max: 30000 });
  await ev(`document.querySelector('#landPaint button.on').focus(), 1`);
  await key('ArrowRight');
  const p1 = await settled({ until: `${checked} === 'tiles'`, max: 4000, only: true });
  await settled({ max: 30000 });
  const r = await where();
  info['phone right'] = Object.assign({ wait: p1.ok }, r);
  ok('phone: → on the last Colouring choice (Plaster) checks and focuses the first (Tiles)', r.group === 'landPaint' && r.v === 'tiles' && r.checked, r);
  await key('ArrowLeft');
  const p2 = await settled({ until: `${checked} === 'plaster'`, max: 4000, only: true });
  await settled({ max: 30000 });
  const l = await where();
  info['phone left'] = Object.assign({ wait: p2.ok }, l);
  ok('phone: ← on the first choice (Tiles) checks and focuses the last (Plaster)', l.group === 'landPaint' && l.v === 'plaster' && l.checked, l);
}
return { pass: fails.length === 0, fails, info };
