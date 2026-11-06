// The sound piece of the learn piece, on a laptop (1366 x 768): the Sound settings (UX87 the caret, UX70
// Hear the function, UX88 Diagnostics and keyboard help), the wave on the Sound button, Listen along (UX72 the Shapes
// row's ⋯ and the selected curve's editor, UX71 the chip with its Stop, UX73), and the sound example's Try line (UX74).
// The same in the steps view and the classic view; the phone's sound checks stay in ux165_learn_cmd.js. A command file
// for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/ux165_learn_sound_cmd.js
// Prints { pass, of, fails: [[name, false, detail]], exc }.
const { R, check, settle, exc, grab, UA0, laptop, fresh } = await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'ux165_kit.js'), 'utf8'));
const box = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; })()`);
const mid = (b) => [b.l + b.w / 2, b.t + b.h / 2];
logs();
grab();
// ---------------------------------------------------------------- sound: UX70, UX71, UX72, UX73, UX74, UX87, UX88
await laptop();
await fresh('ux165s'); await settle(1800);
g = await ev(`(() => { const b = document.querySelector('#soundBtn').getBoundingClientRect(), c = document.querySelector('#soundMore').getBoundingClientRect(); return { cw: c.width, gap: c.left - b.right }; })()`);
check('UX87: the Sound settings caret is 24 to 28 px, with a gap from the switch', g.cw >= 24 && g.cw <= 28 && g.gap >= 2, g);
await ev(`document.querySelector('#soundMore').click()`); await settle(500);
g = await ev(`(() => { const p = document.querySelector('#sndPop'), kids = [...p.children]; const iHear = kids.findIndex((k) => k.querySelector && k.querySelector('#sndSo')), iVol = kids.findIndex((k) => k.querySelector && k.querySelector('#sndVol')); return { iHear, iVol, diag: !!p.querySelector('details.snd-diag #sndState'), diagOpen: p.querySelector('details.snd-diag').open, keys: getComputedStyle(p.querySelector('.snd-keys')).display !== 'none', small: (p.querySelector('.snd-hear small') || {}).textContent }; })()`);
check('UX70: Hear the function is the first row after Sound, with a one-line description', g.iHear === 1 && g.iVol > g.iHear && /round a zero they rise/.test(g.small || ''), g);
check('UX88: the engine line is under a folded Diagnostics; keyboard help on a laptop', g.diag && !g.diagOpen && g.keys, g);
await shot('ux165-ux70-sound-pop');
await key('Escape'); await settle(200);
await ev(`Sound.set({ on: true, events: true, sonify: true }); 1`); await settle(300);
check('UX70: a wave on the Sound button while Hear the function is on', (await ev(`document.querySelector('#soundBtn').dataset.hear`)) === 'on');
await ev(`Sound.set({ sonify: false }); 1`); await settle(200);
check('UX70: and none when it is off', (await ev(`document.querySelector('#soundBtn').dataset.hear`)) === 'off');
// UX72: Listen along in a curve's row menu
const rowB = await box('#shapeList .shape[data-id="s2"] .shape-row > .more');
if (rowB) { await click(...mid(rowB)); await settle(300); }
g = await ev(`[...document.querySelectorAll('#popHost .pop.menu .mi-label')].map((x) => x.textContent)`);
check('UX72: the Shapes row\'s ⋯ has "Listen along it" under "Integrate … along it"', g.indexOf('Listen along it') === g.findIndex((x) => /^Integrate/.test(x)) + 1, g);
await ev(`[...document.querySelectorAll('#popHost .pop.menu .mi')].find((b) => /Listen along it/.test(b.textContent)).click()`); await settle(900);
g = await ev(`({ play: __cmwSound().play, chip: __qa.txt('#sphereChipL'), stop: !!document.querySelector('#sphereChipL .chip-stop') })`);
check('UX71: the listening chip names the curve and has a Stop button', g.play && /^Listening along/.test(g.chip) && g.stop, g);
await shot('ux165-ux71-listening');
// UX73: a pointer move over the plane does not cut it
const pl = await box('#plotL');
for (let i = 0; i < 6; i++) { await move(pl.l + 100 + i * 15, pl.t + 120 + i * 9); await sleep(40); }
check('UX73: moving the pointer over X does not stop Listen along', await ev('__cmwSound().play'));
await ev(`document.querySelector('#sphereChipL .chip-stop').click()`); await settle(300);
check('UX71: Stop stops it, and the chip goes', !(await ev('__cmwSound().play')) && (await ev(`document.querySelector('#sphereChipL').hidden`)));
// UX72: and in the selected curve's editor (a real click on the row's name, then on the button)
const nameB = await box('#shapeList .shape[data-id="s2"] .shape-name');
if (nameB) { await click(...mid(nameB)); await settle(400); }
// (on the laptop the selected shape's editor is in the Inspector)
await ev(`(() => { const e = document.querySelector('#propsPanel .sh-insp[data-id="s2"] .shape-edit [data-act="listen-along"]'); e && e.scrollIntoView({ block: 'center' }); return 1; })()`); await settle(300);
const edB = await box('#propsPanel .sh-insp[data-id="s2"] .shape-edit [data-act="listen-along"]');
g = { btn: edB, text: await ev(`(document.querySelector('#propsPanel .sh-insp[data-id="s2"] .shape-edit [data-act="listen-along"]') || {}).textContent || null`) };
if (edB) { await click(...mid(edB)); await settle(900); }
g.play = await ev('__cmwSound().play');
check('UX72: the selected curve\'s editor has "Listen along it", and it plays', edB && g.text === 'Listen along it' && g.play, g);
await shot('ux165-ux72-editor');
await ev(`document.querySelector('#sphereChipL .chip-stop') && document.querySelector('#sphereChipL .chip-stop').click()`); await settle(300);
await ev(`Sound.set({ on: false }); 1`);
// UX74: the melody example: ♫ in Examples, and a Try line that stays
await ev(`document.querySelector('#examplesBtn').click()`); await settle(600);
g = await ev(`[...document.querySelectorAll('#popHost .examples .ex-item')].filter((b) => b.querySelector('.ex-snd')).map((b) => ({ name: b.querySelector('.ex-name').textContent, mark: b.querySelector('.ex-snd').textContent, tip: b.querySelector('.ex-snd').title, y: Math.abs(b.querySelector('.ex-snd').getBoundingClientRect().top - b.querySelector('.ex-name').getBoundingClientRect().top) }))`);
check('UX74: the sound example is marked ♫ in Examples, beside its name (the name stays the name)', g.length === 1 && g[0].mark === '♫' && g[0].name === 'In the Hall of the Mountain King' && g[0].tip === 'With sound' && g[0].y < 2, g);
await ev(`document.querySelector('#popHost .examples .ex-snd').closest('.ex-item').click()`); await settle(2500);
g = await ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return l ? { slot: l.parentNode.id, btn: [...l.querySelectorAll('.btn.primary')].map((b) => b.textContent)[0], x: !!l.querySelector('.tl-x') } : null; })()`);
check('UX74: opening it shows a Try line in the docked slot, Listen its button, × to close', g && g.slot === 'tourSlot' && /Listen/.test(g.btn) && g.x, g);
g = await ev(`(() => { const r = document.querySelector('#plotL').getBoundingClientRect(), l = document.querySelector('.tour-lane').getBoundingClientRect(); let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9; for (const p of SEASONG.pts) { const [x, y] = __cmwW2S('L', p[0], p[1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { plane: [r.left, r.top, r.right, r.bottom].map(Math.round), curve: [x0, y0, x1, y1].map(Math.round), lane: Math.round(l.bottom) }; })()`);
check('UX74: the plane is fitted with the Try line in place: the whole spiral is in X, under the line', g.curve[0] > g.plane[0] && g.curve[2] < g.plane[2] && g.curve[1] > g.plane[1] && g.curve[3] < g.plane[3] && g.plane[1] >= g.lane, g);
await shot('ux165-ux74-lane');
await sleep(10000);
check('UX74: the Try line stays (it went after 9 s)', await ev(`!!document.querySelector('.tour-lane[data-lane="example"]')`));
await ev(`document.querySelector('.tour-lane .tl-x').click()`); await settle(300);
check('UX74: × closes it, and the planes get the room back', !(await ev(`!!document.querySelector('.tour-lane')`)) && !(await ev(`document.documentElement.style.getPropertyValue('--tour-h')`)));
grab();
// UX88 phone: no keyboard help on a touch screen
await laptop(1440, 900, false);
await send('Emulation.setUserAgentOverride', { userAgent: UA0 });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails, exc };
