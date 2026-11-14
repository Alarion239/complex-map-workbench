// The ‹ › walk of a step shown alone, in the steps view's thread after "Whole chain" (#945): with three active steps and a
// bypassed one, › › › then ‹ walks f1, f2, f4, f4, f2 skipping the bypassed f3; at the ends the buttons are aria-disabled
// with a tip and a press changes nothing; › from the end plane keeps the shown plane; Whole chain and Esc leave.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
// (waits end on the condition they wait for, not on a time)
const until = (expr, max = 20000) => settled({ until: expr, max });
const quiet = () => settled({});
const ns = 'swk' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'r1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2] }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 },
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '1' }, on: true }, { type: 'sin', params: {}, on: false }, { type: 'exp', params: {}, on: true }] };
const open = async (w, h, lang = 'en', extra = {}) => {
  await view(w, h, false, w < 500);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(Object.assign({}, st, extra)))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane') && __cmwSteps().planes.length > 1", 40000);
};
const walk = (d) => ev(`(() => { const b = document.querySelector('#svStrip .sv-awalk[data-d="${d}"]'); return b ? { off: b.getAttribute('aria-disabled'), tip: b.dataset.tip, label: b.getAttribute('aria-label'), w: b.getBoundingClientRect().width } : null; })()`);
const alone = () => ev(`(() => { if (!document.querySelector('#svStrip .sv-whole')) return 0; const P = __cmwSteps().planes; return P[P.length - 1]; })()`);
const press = async (d) => { await clickSel(`#svStrip .sv-awalk[data-d="${d}"]`); await quiet(); };

await open(1440, 900);
ok('no walk buttons on the whole chain', (await walk(1)) === null && (await walk(-1)) === null);
const pill = () => ev(`(() => { const g = document.querySelector('#svStrip .sv-alone'); if (!g) return null; const r = g.getBoundingClientRect(); return { role: g.getAttribute('role'), label: g.getAttribute('aria-label'), h: Math.round(r.height), kids: [...g.children].map((c) => c.className.split(' ')[0]), segs: [...g.children].map((c) => Math.round(c.getBoundingClientRect().height)) }; })()`);
await clickSel('#svStrip .sv-step[data-k="1"] .sv-more');
await until("[...document.querySelectorAll('[role=menuitem], .menu button')].some((e) => /Show alone/.test(e.textContent))");
await ev(`(() => { const m = [...document.querySelectorAll('[role=menuitem], .menu button')].find((e) => /Show alone/.test(e.textContent)); if (m) m.click(); return 1; })()`); await until("!!document.querySelector('#svStrip .sv-whole')"); await quiet();
const seq = [await alone()];
info.pill = await pill();
ok('Whole chain and ‹ › are one labelled group of 34 px', info.pill && info.pill.role === 'group' && info.pill.label === 'Step shown alone' && info.pill.kids.join() === 'sv-whole,sv-awalk,sv-awalk' && info.pill.h === 34 && info.pill.segs.every((v) => v >= 32), info.pill);
const tips = [await walk(-1), await walk(1)];
ok('f1 alone: ‹ is aria-disabled with its tip, › names f2', tips[0] && tips[0].off === 'true' && /f₁/.test(tips[0].tip) && /No step before/.test(tips[0].tip) && tips[1].off === 'false' && /f₂/.test(tips[1].tip) && tips[0].label === 'Previous step alone' && tips[1].label === 'Next step alone', tips);
await press(-1); seq.push(await alone());
for (let i = 0; i < 3; i++) { await press(1); seq.push(await alone()); }
await press(-1); seq.push(await alone());
ok('the walk 1, 1, 2, 4, 4, 2 (f3 bypassed)', seq.join() === '1,1,2,4,4,2', seq);
await press(1); const endTips = [await walk(1)];
ok('f4 alone: › aria-disabled, tip says no step after f₄', endTips[0].off === 'true' && /No step after f₄/.test(endTips[0].tip), endTips);
// › from the end plane keeps the picture: f2 alone on its last plane, › shows f4 alone on its first plane
await press(-1);
const pl = async () => ev('(() => { const q = __cmwSteps(); return { planes: q.planes, stage: q.stage, T: q.T, key: q.names.key, title: q.names.title, win: JSON.stringify(q.win), anim: q.anim }; })()');
const a = await pl(); await press(1); const b = await pl();
info.walk = [a, b];
ok('› from the end plane: the shown plane stays plane 2 (the colour plane is the step\'s own)', a.stage === 2 && b.stage === 2 && b.planes[0] === 2 && a.win && a.win !== 'null' && a.win === b.win && !b.anim, info.walk);
ok('› from the end plane: the colour plane follows the step shown (f₂ → f₄)', a.T === 2 && b.T === 4, info.walk);
await press(1); await press(-1); await press(-1);
await clickSel('#svStrip .sv-alone .sv-whole'); await until("!document.querySelector('#svStrip .sv-whole')"); await quiet();
ok('Whole chain leaves', (await alone()) === 0 && (await walk(1)) === null);
// the phone: Whole chain is a pinned 44 px icon outside the rail; the walk is in the step's ⋯ menu
const items = () => ev(`[...document.querySelectorAll('#popHost .menu .mi')].map((b) => ({ text: b.querySelector('.mi-label').textContent.trim(), dis: b.disabled }))`);
// (the menu ignores a click just after the long press that raised it: the click is tried at each poll until the step is shown)
const pressUntilShown = (re, k) => until(`(() => { const P = __cmwSteps().planes; if (document.querySelector('#svStrip .sv-whole') && P[P.length - 1] === ${k}) return true; const b = [...document.querySelectorAll('#popHost .menu .mi')].find((x) => ${re}.test(x.querySelector('.mi-label').textContent)); if (b && !b.disabled) { b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); b.click(); } return false; })()`);
const WORDS = { en: [/Previous step alone/, /Next step alone/], ru: [/Предыдущий шаг отдельно/, /Следующий шаг отдельно/] };
for (const lang of ['en', 'ru']) {
  await open(360, 740, lang, { sv: { at: 0, T: -1, scope: 'chain', surf: 'plane', speed: 1, alone: 2 } });
  const pin = await ev(`(() => { const w = document.querySelector('#svStrip .sv-whole'); if (!w) return null; const r = w.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { w: Math.round(r.width), h: Math.round(r.height), outside: !document.querySelector('#svStrip .sv-rail').contains(w), hit: !!at && (at === w || w.contains(at)), glyph: w.querySelector('svg') ? 'chain' : w.textContent.trim(), label: w.getAttribute('aria-label'), pill: !!document.querySelector('#svStrip .sv-alone'), arrows: document.querySelectorAll('#svStrip .sv-awalk').length }; })()`);
  info['pin-' + lang] = pin;
  ok(`phone ${lang}: Whole chain is a pinned 44 px chain icon outside the rail, not covered, with no pill and no ‹ ›`, pin && pin.w === 44 && pin.h === 44 && pin.outside && pin.hit && pin.glyph === 'chain' && !pin.pill && pin.arrows === 0, pin);
  // (a phone's chip has no ⋯: a long press opens the step's menu)
  await ev(`(() => { const c = document.querySelector('#svStrip .sv-step[data-k="2"] .sv-fchip'), r = c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: r.left + 10, clientY: r.top + 10, bubbles: true, cancelable: true, button: 0, buttons: 1 })); return 1; })()`);
  await until(`document.querySelectorAll('#popHost .menu .mi').length > 3`);
  await ev(`(() => { const c = document.querySelector('#svStrip .sv-step[data-k="2"] .sv-fchip'), r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: r.left + 10, clientY: r.top + 10, bubbles: true, cancelable: true, button: 0, buttons: 0 })); return 1; })()`);
  const it = await items();
  info['menu-' + lang] = it;
  ok(`phone ${lang}: the step's ⋯ menu has Previous and Next step alone, both on`, WORDS[lang].every((re) => it.some((x) => re.test(x.text) && !x.dis)), it);
  await pressUntilShown(WORDS[lang][1], 4);
  ok(`phone ${lang}: Next step alone shows f4 alone (f3 is bypassed)`, (await alone()) === 4, await alone());
}
return { pass, fails, info };
