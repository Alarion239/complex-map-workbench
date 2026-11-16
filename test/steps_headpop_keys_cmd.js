// The keyboard of the head's Display options pop-up (#1730), in the steps view on the Landscape on a laptop, and the wrap of the
// segmented rows on a phone (whose Display sheet is not a pop-up: it has no ⋯ button and no Escape to the anchor):
//  - Escape closes it and returns the focus to the head's ⋯ button, whose aria-expanded is false (the popover rule: focus moves in
//    and returns to the anchor);
//  - the arrows of a segmented row wrap, as a radiogroup's do: → on the last Colouring choice (Plaster) checks and focuses the
//    first (Tiles), ← on the first checks and focuses the last; on the phone the same row in the Display sheet;
//  - the pop-up is a non-modal dialog, so Tab does not trap: Shift+Tab from its first control and Tab from its last close it and
//    return the focus to the ⋯ button (the focus does not stay in an open pop-up that sits apart from the page's Tab order).
// Real key events (CDP Input). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
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
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
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
  await key('ArrowRight');
  const wr = await settled({ until: "document.querySelector('#landPaint button.on') && document.querySelector('#landPaint button.on').dataset.v === 'tiles'", max: 4000, only: true });
  info[tag + ' right wait'] = wr.ok;
  const right = await where();
  info[tag + ' right'] = right;
  ok(`${tag}: → on the last Colouring choice (Plaster) checks and focuses the first (Tiles)`, right.group === 'landPaint' && right.v === 'tiles' && right.checked, right);
  await key('ArrowLeft');
  const wl = await settled({ until: "document.querySelector('#landPaint button.on') && document.querySelector('#landPaint button.on').dataset.v === 'plaster'", max: 4000, only: true });
  info[tag + ' left wait'] = wl.ok;
  const left = await where();
  info[tag + ' left'] = left;
  ok(`${tag}: ← on the first choice (Tiles) checks and focuses the last (Plaster)`, left.group === 'landPaint' && left.v === 'plaster' && left.checked, left);
  await closeIf();
  // 3. Tab leaves the non-modal dialog by closing it, the focus back on the anchor
  for (const [name, mods, pick] of [['Shift+Tab from the first control', SHIFT, 'first'], ['Tab from the last control', 0, 'last']]) {
    await open();
    await ev(`(() => { const c = [...document.querySelectorAll('.opts-pop :is(button, input, select, [tabindex]):not([tabindex="-1"]):not(:disabled)')].filter((e) => e.offsetParent !== null); c[${pick === 'first' ? '0' : 'c.length - 1'}].focus(); return c.length; })()`);
    await key('Tab', mods);
    await settled({ until: `!${popOpen}`, max: 3000, only: true });
    const t = await where();
    info[tag + ' ' + pick] = t;
    ok(`${tag}: ${name} closes the pop-up and returns the focus to the ⋯ button`, t.open === false && t.anchor && t.expanded === 'false', t);
    await closeIf();
  }
}
// the phone: the Display sheet holds the same Colouring row, and it wraps on the arrows too
{
  const ns = 'svhpph' + Date.now();
  await view(390, 844, true, true);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
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
  await key('ArrowRight');
  const p1 = await settled({ until: `${checked} === 'tiles'`, max: 4000, only: true });
  const r = await where();
  info['phone right'] = Object.assign({ wait: p1.ok }, r);
  ok('phone: → on the last Colouring choice (Plaster) checks and focuses the first (Tiles)', r.group === 'landPaint' && r.v === 'tiles' && r.checked, r);
  await key('ArrowLeft');
  const p2 = await settled({ until: `${checked} === 'plaster'`, max: 4000, only: true });
  const l = await where();
  info['phone left'] = Object.assign({ wait: p2.ok }, l);
  ok('phone: ← on the first choice (Tiles) checks and focuses the last (Plaster)', l.group === 'landPaint' && l.v === 'plaster' && l.checked, l);
}
return { pass: fails.length === 0, fails, info };
