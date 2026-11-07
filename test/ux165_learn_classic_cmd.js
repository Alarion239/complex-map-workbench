// The classic views' learn checks of UX20, V01, UX80, UX102-UX104, UX97, UX99 and UX60: the pattern key, option bar and
// target note in Y's pane head, the empty chain's Add function in Y's head, the deformation's readout, play button, chip
// and Video format, and the shape keys and right-click menus of the Shapes list and the chain cards. The steps view has
// no Y pane head, chain head or chain cards; its own learn checks are ux165_learn_cmd.js.
// Laptop (1366 x 768) and landscape phone (915 x 412). A command file for a CDP daemon (test/cdp_kit README): python3
// build.py && test/<you>_cdp/q.sh test/ux165_learn_classic_cmd.js. Prints { pass, of, fails: [[name, false, detail]], exc }.
const { U, R, check, exc, grab, UA0, laptop, fresh, ready, firstVisit } = await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'ux165_kit.js'), 'utf8'));
const box = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; })()`);
const meet = (a, b) => !!a && !!b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
const mid = (b) => [b.l + b.w / 2, b.t + b.h / 2];
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const phone = async (w, h, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, platform: 'Linux armv8l' }); await view(w, h, dark, true); };
const rclick = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', clickCount: 1 }); await settled({ until: "!!document.querySelector('#popHost .pop.menu')", max: 1500 }); };
logs();
let g = null;
// ---------------------------------------------------------------- UX20: keys and options in the pane head
await laptop();
await fresh('ux165a'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
g = await ev(`(() => { const L = document.querySelector('#rightLegend'), F = document.querySelector('#rightFoot'), plot = document.querySelector('#plotR'); return { legHead: L.parentNode.classList.contains('pane-head'), footHead: F.parentNode.classList.contains('pane-head'), inPlot: [...plot.querySelectorAll(':scope > .legend-chip:not(.calc-chip):not([hidden]), :scope > .options')].filter((e) => e.getClientRects().length).length, sum: (L.querySelector('.lg-sum') || {}).textContent, onlyBtn: [...F.children].every((c) => { const r = c.getBoundingClientRect(), hd = c.closest('.pane-head'), h = hd && hd.getBoundingClientRect(); return !!h && r.top >= h.top - 1 && r.bottom <= h.bottom + 1; }) }; })()`);
// (#247: the head's controls are inline, compact, every one inside the head)
check('UX20 laptop X → Y: the pattern key and the options are in Y\'s pane head, nothing of theirs on the plot', g.legHead && g.footHead && g.inPlot === 0 && /^cell /.test(g.sum || '') && g.onlyBtn, g);
let lb = await box('#rightLegend');
await move(lb.l + 8, lb.t + 8); await settled({ until: "getComputedStyle(document.querySelector('#rightLegend > canvas')).display !== 'none'" });
g = await ev(`(() => { const c = document.querySelector('#rightLegend > canvas'); const b = c.getBoundingClientRect(), h = document.querySelector('#paneR .pane-head').getBoundingClientRect(); return { shown: getComputedStyle(c).display !== 'none', under: b.top >= h.bottom - 1 }; })()`);
check('UX20: the key unfolds under the head only while pointed at (invited)', g.shown && g.under, g);
await shot('ux165-ux20-key-hover');
await move(300, 300); await settled({ until: "getComputedStyle(document.querySelector('#rightLegend > canvas')).display === 'none'" });
check('UX20: and folds again', await ev(`getComputedStyle(document.querySelector('#rightLegend > canvas')).display === 'none'`));
// (#247: View outline and Phase key are toggles in Y's head, or behind its ⋯ when the head has no room, or, when the head
// holds no toggle at all, in the pattern button's pop-up above the patterns (one button); never over the plot)
const inlineKey = await ev(`(() => { const k = document.getElementById('wKeyChkR'), l = k && k.closest('label'); return !!(l && l.getClientRects().length && l.closest('#paneR .pane-head')); })()`);
if (!inlineKey) { await ev(`(document.querySelector('#rightFoot .opts-btn:not(.pat-btn)') || document.querySelector('#rightFoot .pat-btn')).click()`); await settled({ until: "!!document.querySelector('.opts-pop')" }); }
g = await ev(`(() => { const k = document.getElementById('wKeyChkR'), f = document.getElementById('fovChk'), l = k && k.closest('label'), p = document.querySelector('.opts-pop'), hd = document.querySelector('#paneR .pane-head').getBoundingClientRect(); if (!l) return null; const b = (p || l).getBoundingClientRect(); return { phaseKey: l.getClientRects().length > 0, fov: !!f, inHead: !!l.closest('.pane-head'), under: !p || b.top >= hd.bottom - 1, titles: p ? p.querySelectorAll('.opts-h').length : 0 }; })()`);
check('UX20/#247: View outline and Phase key in Y\'s head, or in its ⋯ pop-up under it, with no title', g && g.phaseKey && g.fov && (g.inHead || g.under) && g.titles === 0, g);
await key('Escape'); await settled({ until: "!document.querySelector('.opts-pop')" });
for (const v of ['phase', 'land']) {
  await ev(`__cmwSetMain('${v}')`); await settled({});
  g = await ev(`(() => { const F = document.querySelector('#leftFoot'), plot = document.querySelector('#plotL'); return { head: F.parentNode.classList.contains('pane-head'), bars: [...plot.querySelectorAll(':scope > .options, :scope > .legend-chip:not([hidden]):not(.calc-chip)')].filter((e) => e.getClientRects().length).length, leg: document.querySelector('#leftLegend').parentNode.classList.contains('pane-head') }; })()`);
  // (#365: Phase's colour key lies on the plot, top right, always shown; the Landscape's height key is the head's chip)
  if (v === 'phase') check('UX20/#365 laptop phase: its option bar is in X\'s pane head, the key is the one thing on the plot', g.head && !g.leg && g.bars === 1, g);
  else check(`UX20 laptop ${v}: its option bar and key are in X's pane head, none over the plot`, g.head && g.leg && g.bars === 0, g);
  await shot('ux165-ux20-' + v);
}
await ev(`__cmwSetMain('xy')`); await settled({});
// phone landscape: the key stays a folded glyph on the plane (its head is not shown)
await phone(915, 412);
await fresh('ux165b'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
g = await ev(`(() => { const L = document.querySelector('#rightLegend'); return { inPlot: L.parentNode.id === 'plotR', folded: L.classList.contains('collapsed') }; })()`);
check('UX20 landscape phone: Y\'s pattern key is the folded glyph, not the box over Y', g.inPlot && g.folded, g);
check('UX20 phone: the glyph carries none of the head\'s words', await ev(`!document.querySelector('#leftLegend .lg-sum, #rightLegend .lg-sum')`));
grab();

// laptop: the note is in Y's pane head
await laptop();
await fresh('ux165d'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
await ev(`document.querySelector('#tools [data-tool="disc"]').click()`); await settled({ until: "!!document.querySelector('#tools [data-tool=\"disc\"].on, #tools [data-tool=\"disc\"][aria-pressed=\"true\"]')" });
const pr = await box('#plotR');
await drag(pr.l + pr.w * 0.5, pr.t + pr.h * 0.45, pr.l + pr.w * 0.55, pr.t + pr.h * 0.5); await settled({ until: "__cmwState().targets === 1" });
// (the note "gives way before the title itself would" (fitTitle, class nofit). With the plane's worded Plane | Sphere,
// the "Y · " tag and the key chip in Y's head, a
// 1366 px head may have no room for it: then it must be hidden by that rule only, i.e. Y's title would not fit beside
// it (measured as fitTitle measures, with the note and the title's classes put back at once), and never cut)
g = await ev(`(() => { const n = document.querySelector('#paneR .pane-head #rightNote'), t = document.querySelector('#rightTitle'), pr = t.querySelector('.prole'); const o = { note: n && n.textContent, shown: !!n && getComputedStyle(n).display !== 'none', cut: !!n && n.scrollWidth > n.clientWidth + 1, tip: n && n.dataset.tip, roleCut: getComputedStyle(pr).display !== 'none' && pr.scrollWidth > pr.clientWidth + 1, tiny: document.querySelector('#paneR').classList.contains('tiny'), calc: document.querySelector('#calcChip').hidden, targets: __cmwState().targets, nofit: !!n && n.classList.contains('nofit') };
  if (n && o.nofit) { const grow = t.nextElementSibling, pt = t.querySelector('.ptitle'), tabs = document.getElementById('rightTabs'), cls = t.className; n.classList.remove('nofit'); t.classList.remove('terse', 'short', 'notag'); const room = grow.offsetWidth + t.offsetWidth - (tabs ? Math.max(0, tabs.scrollWidth - tabs.clientWidth) : 0); o.withNote = { ptw: pt ? pt.scrollWidth : 0, room, noteW: n.getBoundingClientRect().width }; t.className = cls; n.classList.add('nofit'); o.gaveWay = !!pt && o.withNote.ptw > room; }
  return o; })()`);
check('UX20 laptop: the target\'s note is in Y\'s pane head ("Preimage in X"), whole (or, without room beside the title, given way to it: W1-MERGE.md 8), not over the plane; the title keeps its place', g.targets === 1 && g.note === 'Preimage in X' && (g.shown || g.gaveWay === true) && !g.cut && !g.roleCut && !g.tiny && g.calc === true, g);
check('UX20 laptop: the note\'s tooltip is plain words', /^Where F lands in the targets of Y/.test(g.tip || ''), g.tip);
await shot('ux165-v01-laptop');
grab();

await laptop();

// ---------------------------------------------------------------- UX80, UX20: the empty chain's Add function in Y's head
// (the Undo message of the same page is ux165_learn_msg_classic_cmd.js)
await laptop();
await fresh('ux165e'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
await ev(`document.querySelector('#clearChain').click()`); await settled({ until: "!!document.querySelector('#emptyRight') && !document.querySelector('#emptyRight').hidden" });
g = await ev(`(() => { const e = document.querySelector('#emptyRight'), b = e.querySelector('.btn'); return { head: e.parentNode.classList.contains('pane-head'), shown: !e.hidden && !!b && b.getClientRects().length > 0, tip: b && b.dataset.tip, tiny: document.querySelector('#paneR').classList.contains('tiny') }; })()`);
check('UX20 laptop: the empty chain\'s "Add function" is in Y\'s pane head, not over the picture', g.head && g.shown && /Add a function to map the region/.test(g.tip || '') && !g.tiny, g);
// (the title is fitted with the button in place: its role is whole, short or gone, never cut by an ellipsis: "imag…")
g = await ev(`(() => { const t = document.querySelector('#rightTitle'), pr = t.querySelector('.prole'), pt = t.querySelector('.ptitle'), vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; return { cls: t.className, prCut: vis(pr) && pr.scrollWidth > pr.clientWidth + 1, ptCut: vis(pt) && pt.scrollWidth > pt.clientWidth + 1 }; })()`);
check('UX20 laptop: with "Add function" in Y\'s head the title and its role are not cut', !g.prCut && !g.ptCut, g);

// ---------------------------------------------------------------- deformation: UX102, UX103, UX104, UX97 (K, Shift+→), UX60
await laptop();
await fresh('ux165m'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
await key('m'); await settled({ until: "!!document.querySelector('#morphLabel') && __cmwState().morph.open === true" });
// (a row too tight for the words takes the short form "1/2 · f₁ · 53 %", marked data-short, the
// words staying in the tooltip; the title's two spans read "Deformation" and "from z to w" with no space between)
g = await ev(`({ ro: __qa.txt('#morphLabel'), short: (document.querySelector('#morphLabel') || { dataset: {} }).dataset.short || null, title: __qa.txt('#rightTitle'), speed: [...document.querySelectorAll('#speedSeg > button')].map((b) => b.textContent) })`);
check('UX103: the readout is in words ("Step k of m · fₖ · p %"; in a tight row its short form) and the title too ("Deformation from z to w")', (/^Step \d+ of 2 · f[₁₂] · \d+ %$/.test(g.ro) || (g.short === '1' && /^\d\/2 · f[₁₂] · \d+ %$/.test(g.ro))) && /^Deformation\s*from z to w$/.test(g.title), g);
const pb = await box('#morphPlay');
await move(...mid(pb)); await settled({ until: "!document.querySelector('#tip').hidden", only: true });
const tip1 = await ev(`[document.querySelector('#tip').hidden, document.querySelector('#tip').textContent]`);
await click(...mid(pb)); await settled({ until: "__cmwState().morph.playing === false", only: true }); await move(10, 10); await settled({ until: "document.querySelector('#tip').hidden", only: true }); await move(...mid(pb)); await settled({ until: "!document.querySelector('#tip').hidden && /^Play/.test(document.querySelector('#tip').textContent)", only: true });
const tip2 = await ev(`[document.querySelector('#tip').hidden, document.querySelector('#tip').textContent, __cmwState().morph.playing]`);
check('UX104: the play button\'s tooltip follows a click (Pause, then Play)', tip1[0] === false && /^Pause/.test(tip1[1]) && tip2[0] === false && /^Play/.test(tip2[1]) && tip2[2] === false, { tip1, tip2 });
await key('k'); await settled({ until: "__cmwState().morph.playing === true", only: true });
check('UX97: K plays the deformation', await ev('__cmwState().morph.playing'));
await key('k'); await settled({ until: "__cmwState().morph.playing === false", only: true });
await ev(`(() => { const s = document.getElementById('morphRange'); return 1; })()`);
await key('ArrowLeft', 8); await key('ArrowLeft', 8); await key('ArrowLeft', 8); await settled({ until: "__cmwState().morph.T === 0", only: true });
const t0 = await ev('__cmwState().morph.T');
await key('ArrowRight', 8); await settled({ until: "__cmwState().morph.T === 1", only: true });
g = await ev(`({ T: __cmwState().morph.T, ro: __qa.txt('#morphLabel'), short: (document.querySelector('#morphLabel') || { dataset: {} }).dataset.short || null })`);
// (the readout in words, or its short form in a tight row)
check('UX97: Shift+← goes back to t = 0, Shift+→ to the next step\'s tick', t0 === 0 && g.T === 1 && (/Step 2 of 2 · f₂ · 0 %|Step 1 of 2 · f₁ · 100 %/.test(g.ro) || (g.short === '1' && /^(2\/2 · f₂ · 0 %|1\/2 · f₁ · 100 %)$/.test(g.ro))), Object.assign({ t0 }, g));
await ev(`document.querySelector('#tools [data-tool="disc"]').click()`); await settled({ until: "!!document.querySelector('#sphereChipR .chip-draw')" });
g = await ev(`({ chip: __qa.txt('#sphereChipR'), btn: !!document.querySelector('#sphereChipR .chip-draw') })`);
check('UX102: a draw tool in the deformation: the chip offers "Turn off and draw"', g.btn && /Turn off and draw/.test(g.chip), g);
await shot('ux165-ux102-chip');
await ev(`document.querySelector('#sphereChipR .chip-draw').click()`); await settled({ until: "__cmwState().morph.open === false" });
g = await ev(`({ open: __cmwState().morph.open, tool: (document.querySelector('#tools .tool.on, #tools .tool[aria-pressed="true"]') || { dataset: {} }).dataset.tool || null })`);
check('UX102: it turns the deformation off and keeps the chosen tool', g.open === false && g.tool === 'disc', g);
await ev(`document.querySelector('#tools [data-tool="select"]').click()`);
// UX60: Video listed with the deformation off; choosing it turns the deformation on and opens on Video
await ev(`Figure.open()`); await settled({ until: "!!document.querySelector('#xfFmt > button')" });
g = await ev(`({ fmts: [...document.querySelectorAll('#xfFmt > button')].map((b) => b.dataset.v), dis: (document.querySelector('#xfFmt [data-v="video"]') || {}).disabled })`);
check('UX60: Video is listed with the deformation off', g.fmts.includes('video') && g.dis === false, g);
await ev(`document.querySelector('#xfFmt [data-v="video"]').click()`); await settled({ until: "__cmwState().morph.open === true && !!document.querySelector('.modal.xf')" });
g = await ev(`({ open: __cmwState().morph.open, dlg: !!document.querySelector('.modal.xf'), vid: (document.querySelector('#xfFmt [aria-checked="true"], #xfFmt [aria-pressed="true"], #xfFmt .on') || { dataset: {} }).dataset.v || null })`);
check('UX60: choosing Video turns the deformation on and the dialog opens on Video', g.open === true && g.dlg && g.vid === 'video', g);
await shot('ux165-ux60-video');
await key('Escape'); await settled({ until: "!document.querySelector('.modal.xf')" });
await ev(`(() => { try { const s = JSON.parse(localStorage.getItem('cmw-figure-v1:ux165m') || 'null'); } catch (e) { /* */ } return 1; })()`);
grab();
// Russian: 0,5×
await fresh('ux165m', '&lang=ru'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
await ready();
await key('m'); await settled({ until: "!!document.querySelector('#speedSeg > button')", max: 3000 });
g = await ev(`({ speed: [...document.querySelectorAll('#speedSeg > button')].map((b) => b.textContent), ro: __qa.txt('#morphLabel') })`);
check('UX103 Russian: «0,5×» and «Шаг k из m · fₖ · p %»', g.speed[0] === '0,5×' && /^Шаг \d+ из\s2 · f[₁₂] · \d+\s%$/.test(g.ro), g);
await shot('ux165-ux103-ru');
await key('m'); await settled({ until: "__cmwState().morph.open === false" });
await nav(U + '?ns=ux165m&lang=en'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
await ev(`localStorage.removeItem('cmw-lang:ux165m'); localStorage.removeItem('cmw-lang'); 1`);

// ---------------------------------------------------------------- UX97 keys on shapes, UX99 right-click menus
await laptop();
await fresh('ux165k'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
await ev(`__cmwSelect('s2')`); await settled({ until: "__cmwShapes().selected === 's2'", only: true });
const n0 = await ev(`__cmwShapes().shapes.length`);
await ev(`document.body.focus()`);
await key('d', 4); await settled({ until: `__cmwShapes().shapes.length === ${n0 + 1}`, only: true });
g = await ev(`({ n: __cmwShapes().shapes.length, sel: __cmwShapes().selected })`);
check('UX97: ⌘D duplicates the selected shape and selects the copy', g.n === n0 + 1 && g.sel !== 's2', Object.assign({ n0 }, g));
const sid = g.sel;
const before = await ev(`JSON.stringify(__cmwShapes().shapes.find((s) => s.id === ${JSON.stringify(sid)}))`);
await key('ArrowRight'); await settled({ until: `JSON.stringify(__cmwShapes().shapes.find((s) => s.id === ${JSON.stringify(sid)})) !== ${JSON.stringify(before)}`, only: true });
const after = await ev(`JSON.stringify(__cmwShapes().shapes.find((s) => s.id === ${JSON.stringify(sid)}))`);
check('UX97: an arrow moves the selected shape', before !== after, { before, after });
await key('[', 4); await settled({ until: `__cmwShapes().shapes.map((s) => s.id).indexOf(${JSON.stringify(sid)}) === __cmwShapes().shapes.length - 2`, only: true });
g = await ev(`__cmwShapes().shapes.map((s) => s.id)`);
check('UX97: ⌘[ sends it backward', g.indexOf(sid) === g.length - 2, g);
await rclick(...mid(await box('#shapeList .shape[data-id="s2"] .shape-name')));
g = await ev(`(() => { const p = document.querySelector('#popHost .pop.menu'); if (!p) return null; const b = p.getBoundingClientRect(); return { x: b.left, y: b.top, keys: [...p.querySelectorAll('.mi')].filter((m) => /Duplicate|Bring forward|Send backward/.test(m.textContent)).map((m) => m.querySelector('.mi-key').textContent) }; })()`);
const at1 = mid(await box('#shapeList .shape[data-id="s2"] .shape-name'));
check('UX99: a right click on a Shapes row opens its ⋯ menu at the pointer', g && Math.abs(g.x - at1[0]) < 4 && (Math.abs(g.y - at1[1]) < 4 || g.y < at1[1]), Object.assign({ at1 }, g));
check('UX97: the menu shows the keys (⌘D, ⌘], ⌘[)', g && g.keys.length === 3 && g.keys.every((k) => /[⌘C]/.test(k)), g && g.keys);
await key('Escape'); await settled({ until: "!document.querySelector('#popHost .pop.menu')", only: true });
const cb = await box('#pipeline .card[data-k="1"] .thumb');
await rclick(cb.l + 30, cb.t + 30);
g = await ev(`(() => { const p = document.querySelector('#popHost .pop.menu'); if (!p) return null; const b = p.getBoundingClientRect(); return { x: b.left, y: b.top, b: b.bottom, n: p.querySelectorAll('.mi').length }; })()`);
check('UX99: a right click on a chain card opens its ⋯ menu at the pointer', g && g.n > 2 && Math.abs(g.x - (cb.l + 32)) < 4 && (Math.abs(g.y - (cb.t + 32)) < 4 || Math.abs(g.b - (cb.t + 28)) < 4), Object.assign({ at: [cb.l + 30, cb.t + 30] }, g));
await shot('ux165-ux99-card');
await key('Escape'); await settled({ until: "!document.querySelector('#popHost .pop.menu')", only: true });
// UX97: Alt+→ / Alt+← move the focused chain step right / left (its ⋯ menu's Move right / left), the card keeps focus
const st0 = await ev(`[...document.querySelectorAll('#pipeline .card[data-k]')].filter((c) => c.dataset.k !== '0').map((c) => c.querySelector('.nm').textContent).join(',')`);
await ev(`document.querySelector('#pipeline .card[data-k="1"]').focus(); 1`);
await key('ArrowRight', 1); await settled({ until: "document.activeElement && document.activeElement.closest('.card') && document.activeElement.closest('.card').dataset.k === '2'", only: true });
g = await ev(`({ st: [...document.querySelectorAll('#pipeline .card[data-k]')].filter((c) => c.dataset.k !== '0').map((c) => c.querySelector('.nm').textContent).join(','), foc: document.activeElement && document.activeElement.closest('.card') ? document.activeElement.closest('.card').dataset.k : null })`);
const st1 = g;
await key('ArrowLeft', 1); await settled({ until: "document.activeElement && document.activeElement.closest('.card') && document.activeElement.closest('.card').dataset.k === '1'", only: true });
const st2 = await ev(`[...document.querySelectorAll('#pipeline .card[data-k]')].filter((c) => c.dataset.k !== '0').map((c) => c.querySelector('.nm').textContent).join(',')`);
check('UX97: Alt+→ moves the focused step right (focus stays on it), Alt+← moves it back', st0.split(',').length >= 2 && st1.st === st0.split(',').slice(0, 2).reverse().concat(st0.split(',').slice(2)).join(',') && st1.foc === '2' && st2 === st0, { st0, st1, st2 });
grab();

await laptop(1440, 900, false);
await send('Emulation.setUserAgentOverride', { userAgent: UA0 });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails, exc };
