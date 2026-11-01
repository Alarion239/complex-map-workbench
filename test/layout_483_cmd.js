// The layout fixes of #483 (the first layout-invariants report, #470), each measured as the report found it: the panes' tabs
// are not cut; the mesh presets are 24 px targets clear of the slider; the chain's connector label clears the + under it; the
// deformation bracket's ends are 24 px wide and not over the labels; a phone sheet's grab handle does not reach into its title;
// the deformation dock's tick labels are not drawn on a phone (the marks stay, the dock keeps its height); the sphere's hint
// wraps instead of being cut; the phone menu rows' and the export caption's focus rings are drawn inside their boxes.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/layout_483_cmd.js
// Prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const open = async (w, h, lang = 'en', phone = false) => {
  await view(w, h, false, phone);
  await nav(`${U}/test.html?ns=l483-${w}-${Date.now()}&lang=${lang}`); await settle(2800);
  await ev('__cmwExample(8); 1'); await settle(1500);
};
// (the part of a box that two boxes share, [dx, dy], or null: touching is not overlapping)
const OV = `(a, b) => { const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left), oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top); return ox > 0.5 && oy > 0.5 ? [+ox.toFixed(1), +oy.toFixed(1)] : null; }`;
// (how far a focused element's ring lies outside the boxes that clip it, px)
const RING = `(el) => { el.focus({ focusVisible: true }); const cs = getComputedStyle(el); if (cs.outlineStyle === 'none') return { none: true }; const off = parseFloat(cs.outlineOffset) || 0, w = parseFloat(cs.outlineWidth) || 0; const r = el.getBoundingClientRect(), g = off + w; const ring = { l: r.left - g, t: r.top - g, r: r.right + g, b: r.bottom + g }; let clip = { l: 0, t: 0, r: innerWidth, b: innerHeight }; for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a), bx = /(hidden|auto|scroll|clip)/.test(s.overflowX), by = /(hidden|auto|scroll|clip)/.test(s.overflowY); if (!bx && !by) continue; const c = a.getBoundingClientRect(); if (bx) { clip.l = Math.max(clip.l, c.left); clip.r = Math.min(clip.r, c.right); } if (by) { clip.t = Math.max(clip.t, c.top); clip.b = Math.min(clip.b, c.bottom); } } return { off, w, cut: +Math.max(0, clip.l - ring.l, clip.t - ring.t, ring.r - clip.r, ring.b - clip.b).toFixed(1) }; }`;

// 1. the panes' Plane | Sphere tabs: the buttons are inside their strip (the report: 4 px of their bottom cut) and 24 px tall at least
for (const w of [1024, 1440]) {
  await open(w, 800);
  const t = await ev(`[...document.querySelectorAll('#leftTabs, #rightTabs')].map((seg) => { const s = seg.getBoundingClientRect(); return [...seg.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return { id: seg.id, h: r.height, cutBottom: +(r.bottom - (s.bottom - 1)).toFixed(1), cutTop: +((s.top + 1) - r.top).toFixed(1) }; }); }).flat()`);
  ok(`${w}: the tabs' buttons lie inside their strip and are 28 px tall`, t.length === 4 && t.every((b) => b.cutBottom <= 0.5 && b.cutTop <= 0.5 && b.h >= 28), t);
  info[`tabs ${w}`] = t[0];
}
// 5. Settings > Mesh quality: the slider and the presets are 24 px at least (the slider's 20 px put the stops within its reach) and the presets start where the slider ends (en and ru)
for (const lang of ['en', 'ru']) {
  await open(1024, 800, lang);
  await ev(`(document.getElementById('settingsBtn') || [...document.querySelectorAll('button')].find((x) => /Settings|Настройки/i.test(x.getAttribute('aria-label') || x.textContent))).click(); 1`); await settle(600);
  const m = await ev(`(() => { const rg = document.getElementById('meshRange'); if (!rg || !rg.getClientRects().length) return null; const R = rg.getBoundingClientRect(); const bs = [...document.querySelectorAll('#meshPresets button')].map((b) => { const r = b.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), top: +r.top.toFixed(1) }; }); return { rangeH: +R.height.toFixed(1), rangeBottom: +R.bottom.toFixed(1), bs }; })()`);
  ok(`${lang}: the mesh slider and its presets are 24 px targets, the presets below the slider`, !!m && m.bs.length === 5 && m.rangeH >= 23.9 && m.bs.every((b) => b.w >= 23.9 && b.h >= 23.9 && b.top >= m.rangeBottom - 0.5), m);
}
// 6 and 4. the chain at 1440 and 1024: the connector's label clears the +; with the deformation open, the bracket's ends are
// 24 px wide at least and above the labels (not over them)
for (const w of [1440, 1280, 1024]) {
  await open(w, 800);
  const c = await ev(`(() => { const ov = ${OV}; const pl = document.getElementById('pipeline'); const hits = []; for (const a of pl.querySelectorAll('button.conn-add')) for (const e of pl.querySelectorAll('.conn-var i, .conn-var sub')) { if (!e.getClientRects().length) continue; const o = ov(a, e); if (o) hits.push([e.textContent, ...o]); } return hits; })()`);
  ok(`${w}: the connector labels clear the + under them`, c.length === 0, c);
  await ev('__cmwMorph({ open: true }); 1'); await settle(1200);
  const br = await ev(`(() => { const ov = ${OV}; const pl = document.getElementById('pipeline'); const ends = [...document.querySelectorAll('.br-end')]; const hits = []; for (const e of ends) for (const t of pl.querySelectorAll('.conn-var i, .conn-var sub')) { if (!t.getClientRects().length) continue; const o = ov(e, t); if (o) hits.push([e.className.replace('br-end ', ''), t.textContent, ...o]); } return { n: ends.length, w: ends.map((e) => +e.getBoundingClientRect().width.toFixed(1)), hits }; })()`);
  ok(`${w}: the bracket's ends are 24 px wide at least and not over the labels`, br.n === 2 && br.w.every((x) => x >= 23.9) && br.hits.length === 0, br);
  info[`bracket ${w}`] = br.w;
}
// 3b. the Editor's head is its 18 px bar, so its title row drags the sheet where nothing in it can be pressed: a press on an empty part of
// the Inspector's .ihead and a drag up opens the sheet to its full height (and a drag that starts on the title button does not)
await open(360, 740, 'en', true);
await ev(`Phone.open('edit'); 1`); await settle(900);
// (the sheet slides up: measure once its title row is inside the window)
for (let i = 0; i < 40; i++) { const inside = await ev(`(() => { const e = document.querySelector('.ph-sheet[data-k="edit"] #propsPanel .ihead'); return !!e && e.getBoundingClientRect().bottom <= innerHeight && getComputedStyle(e.closest('.ph-sheet')).transform === 'none'; })()`); if (inside) break; await sleep(250); }
await settle(300);
const empty = await ev(`(() => { const ih = document.querySelector('.ph-sheet[data-k="edit"] #propsPanel .ihead'); if (!ih || !ih.getClientRects().length) return null; const r = ih.getBoundingClientRect(); const y = r.top + r.height / 2; for (let x = r.left + 4; x < r.right - 4; x += 3) if (document.elementFromPoint(x, y) === ih) return [x, y, r.height]; return null; })()`);
const ihDiag = empty ? null : await ev(`(() => { const sh = document.querySelector('.ph-sheet[data-k="edit"]'); const ih = sh && sh.querySelector('#propsPanel .ihead'); const r = ih && ih.getBoundingClientRect(); const t = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { sheet: !!sh, hidden: sh && sh.hidden, cls: sh && sh.className, ihead: r && [r.left, r.top, r.right, r.bottom].map(Math.round), top: t && (t.className || t.tagName).toString().slice(0, 40) }; })()`);
ok('360: the Editor has an empty part of its title row to press', !!empty, ihDiag);
if (empty) {
  ok('360: before the drag the sheet is not full', !(await ev(`document.documentElement.classList.contains('ph-full')`)), null);
  await drag(empty[0], empty[1], empty[0], empty[1] - 120, 8, 30); await settle(900);
  ok('360: a press and drag up on the .ihead\'s empty part opens the sheet full', await ev(`document.documentElement.classList.contains('ph-full')`), empty);
}
// 3. the phone's sheets: the grab handle lies in the strip above the title, not over it
await open(360, 740, 'en', true);
for (const k of ['chain', 'edit', 'display', 'more']) {
  await ev(`Phone.open('${k}'); 1`); await settle(900);
  const g = await ev(`(() => { const ov = ${OV}; const g = document.querySelector('.ph-grab'); if (!g || !g.getClientRects().length) return null; const sh = g.closest('.ph-sheet'); const hits = []; for (const e of sh.querySelectorAll('.ph-st, .ttl, .ttl-btn, .ph-x, .ph-hundo, .ph-pill')) { if (!e.getClientRects().length) continue; const o = ov(g, e); if (o) hits.push([e.className.toString().slice(0, 20), ...o]); } return { k: sh.dataset.k, h: g.getBoundingClientRect().height, hits }; })()`);
  ok(`360: the ${k} sheet's grab handle is clear of its title`, !!g && g.hits.length === 0, g);
}
// 8a. the phone menu's rows in landscape: the ring is inside the row
await open(740, 360, 'en', true);
await ev(`Phone.open('more'); 1`); await settle(900);
// (the sheet slides in from the right: measure once it lies inside the window)
for (let i = 0; i < 40; i++) { const inside = await ev(`(() => { const e = document.querySelector('.ph-sheet[data-k="more"]'); return !!e && e.getBoundingClientRect().right <= innerWidth + 1 && getComputedStyle(e).transform === 'none'; })()`); if (inside) break; await sleep(250); }
await settle(300);
await key('Tab'); await sleep(100);
const rows = await ev(`(() => { const f = ${RING}; return [...document.querySelectorAll('.ph-sheet[data-k="more"] button.ph-row')].filter((e) => e.getClientRects().length).map((e) => f(e)); })()`);
ok('740x360: the menu rows have a ring that no panel cuts, drawn inside the row', rows.length > 3 && rows.every((r) => !r.none && r.cut === 0 && r.off < 0), rows.slice(0, 3));
// 7. the sphere's hint in the right readout wraps: nothing cut at 740 x 360, in en and ru
for (const lang of ['en', 'ru']) {
  await open(740, 360, lang, true);
  await ev(`__cmwSetView('R', 'sphere'); 1`); await settle(1800);
  const h = await ev(`(() => { const c = document.getElementById('rightReadout'); if (!c || !c.getClientRects().length) return null; const r = c.querySelector('.rhint'); return { text: c.textContent.length, sw: c.scrollWidth, cw: c.clientWidth, sh: c.scrollHeight, ch: c.clientHeight, ws: getComputedStyle(c).whiteSpace, hint: !!r }; })()`);
  ok(`740x360 ${lang}: the sphere's hint is whole (wrapped, not cut)`, !!h && h.hint && h.sw <= h.cw + 1 && h.sh <= h.ch + 1, h);
}
// 2. the deformation dock on a phone: no tick text over the readout or the slider, the marks stay, the dock keeps its height
for (const [w, h, dockH] of [[360, 740, 110], [740, 360, 52]]) {
  await open(w, h, 'en', true);
  await ev('__cmwMorph({ open: true }); 1'); await settle(1800);
  const d = await ev(`(() => { const ov = ${OV}; const dock = document.getElementById('tdockR'); if (!dock || !dock.getClientRects().length) return null; const texts = [...dock.querySelectorAll('.ttick, .ttick i, .ttick sub')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().height > 0); const ctl = [...dock.querySelectorAll('input[type=range], .tread')].filter((e) => e.getClientRects().length); const hits = []; for (const t of texts) for (const c of ctl) { const o = ov(t, c); if (o) hits.push([t.textContent, c.id || c.className, ...o]); } return { h: Math.round(dock.getBoundingClientRect().height), texts: texts.length, marks: [...dock.querySelectorAll('.ttick')].map((t) => getComputedStyle(t, '::before').height), hits }; })()`);
  ok(`${w}x${h}: the dock's tick text is not over the readout or the slider, its marks stay, its height is ${dockH}`, !!d && d.hits.length === 0 && d.texts === 0 && d.marks.length >= 2 && d.marks.every((m) => m === '8px') && d.h === dockH, d);
}
// 8b. the export dialog's caption: its focus ring is inside the box
await open(1024, 800);
await key('e', 2); await settle(4500);
await key('Tab'); await sleep(100);
const cap = await ev(`(() => { const e = document.querySelector('.xf-cap'); return e ? (${RING})(e) : null; })()`);
ok('1024: the export caption has a ring that no scroller cuts, drawn inside the box', !!cap && !cap.none && cap.cut === 0 && cap.off < 0, cap);
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no page errors', errs.length === 0, errs.slice(0, 3));
return { pass: fails.length === 0, fails, info };
