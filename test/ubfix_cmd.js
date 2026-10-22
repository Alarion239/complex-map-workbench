// SUPERSEDED in part by test/mv_views_cmd.js (merged views and their review): this file drives U-b controls (key 4, the
// Phase button, the Key switch in X's legend) that the merged views replaced; kept for its history.
// U-b review fixes (the confirmed U-b findings): checks in the real app. A command file for a CDP daemon
// (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh "$PWD/test/ubfix_cmd.js"
// Prints {pass, fails, ...}; pass is true when every check holds. Shots go to <daemon folder>/shots/ubfix-*.png.
const fails = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const out = {};
await view(1440, 900, false);
const fresh = async () => { await nav('http://localhost:8793/test.html?ns=ubfix' + Date.now()); await sleep(2200); await move(5, 5); };
// a CSS pixel of a pane's 2D canvas
const px = (id, x, y) => ev(`(() => { const c = document.getElementById(${JSON.stringify(id)}); const d = Math.min(window.devicePixelRatio || 1, 2); return [...c.getContext('2d').getImageData(Math.round(${x} * d), Math.round(${y} * d), 1, 1).data].slice(0, 3); })()`);
const near = (a, b, t = 12) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= t);
const st = () => ev('__cmwState()');
const vis = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return !e.hidden && r.width > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'; })()`);
const txt = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);

// 1. the Key in the w-plane and the Landscape use one predicate: X Landscape hides the switch and the paint together
await fresh(); logs();
await ev('__cmwExample(1); 1'); await sleep(1500);
const p0 = await px('canvasR', 20, 400);
await key('4'); await sleep(600);
await ev(`document.getElementById('wKeyChk').click(); 1`); await sleep(800);
const p1 = await px('canvasR', 20, 400);
ok('key on: Y painted', !near(p0, p1, 30), [p0, p1]);
await key('3'); await sleep(900);
const p2 = await px('canvasR', 20, 400);
ok('landscape: switch hidden', (await vis('#wKeyRow')) === false, await vis('#wKeyRow'));
ok('landscape: the key is not painted', near(p0, p2), [p0, p2]);
ok('landscape: the setting is kept', (await st()).wKey === true, await st());
await key('1'); await sleep(900);
const p3 = await px('canvasR', 20, 400);
ok('back on Plane: switch and paint return', (await vis('#wKeyRow')) === true && near(p1, p3, 30), [p1, p3]);
await ev(`document.getElementById('wKeyChk').click(); __cmwSetPhase(false); 1`); await sleep(300);

// 2. migration keeps S.dc (portrait style) and the expanded pane follows its picture
for (const [name, s, want] of [
  ['3d with grid', { rightMode: '3d', dc: 'grid' }, { dc: 'grid', landPlain: true, surf: 'land' }],
  ['3d with cauchy', { rightMode: '3d', dc: 'cauchy' }, { dc: 'cauchy', landPlain: true, surf: 'land' }],
  ['3d tiles with modulus', { rightMode: '3d', material: 'tiles', dc: 'modulus' }, { dc: 'modulus', landPlain: false, surf: 'land' }],
]) {
  await load('ubfixm' + Date.now(), s); await sleep(300);
  const g = await st();
  ok(`migrate ${name}`, g.dc === want.dc && g.landPlain === want.landPlain && g.view.L.surf === want.surf, g);
}
// the Plain relief of an old landscape: the strip shows Plain (at 2400 px the landscape's strip has room for the
// style control; narrower, it folds into the options popover)
await view(2400, 1300, false);
{
  await load('ubfixm' + Date.now(), { rightMode: '3d', material: 'tiles', dc: 'modulus' }); await sleep(300);
  const on = await ev(`(document.querySelector('#dcSeg > button.on') || {}).dataset?.v`);
  ok('3d tiles: strip shows Tiles', on === 'enhanced', on);
  await load('ubfixm' + Date.now(), { rightMode: '3d', dc: 'grid' }); await sleep(300);
  const on2 = await ev(`(document.querySelector('#dcSeg > button.on') || {}).dataset?.v`);
  ok('3d default material: strip shows Plain', on2 === 'phase', on2);
  await key('1'); await sleep(400);
  const on3 = await ev(`(document.querySelector('#dcSeg > button.on') || {}).dataset?.v`);
  ok('3d default material: back on Plane the portrait keeps Grid', on3 === 'grid' && (await st()).dc === 'grid', on3);
}
await view(1440, 900, false);
for (const [name, s, cls, lHidden] of [
  ['color solo R', { rightMode: 'color', solo: 'R' }, 'solo-L', false],
  ['3d solo R', { rightMode: '3d', solo: 'R' }, 'solo-L', false],
  ['color solo L', { rightMode: 'color', solo: 'L' }, '', false],
  ['image solo R', { rightMode: 'image', solo: 'R' }, 'solo-R', true],
]) {
  await load('ubfixs' + Date.now(), s); await sleep(300);
  const g = await ev(`({ cls: document.getElementById('panes').className, lw: document.getElementById('canvasL').getBoundingClientRect().width, view: __cmwView() })`);
  ok(`solo ${name}`, (cls ? g.cls.includes(cls) : !/solo-/.test(g.cls)) && (lHidden ? g.lw === 0 : g.lw > 0), g);
}
// examples: the Landscape example keeps the user's portrait style
await fresh();
await ev('__cmwSet("dc", "classic"); __cmwExample(13); 1'); await sleep(1500);
const e13 = await st();
ok('example 13: Plain relief, dc kept', e13.dc === 'classic' && e13.landPlain === true, e13);
await ev('__cmwExample(9); 1'); await sleep(1500);
const e9 = await st();
ok('example 9 after 13: the portrait style', e9.dc === 'classic' && e9.landPlain === false, e9);

// 3. palette aliases (panels.md 8: image, domain colouring, phase portrait, 3d, riemann, globe)
await fresh();
out.palette = {};
for (const [q, want] of [['phase portrait', 'Left: Phase colouring'], ['domain colouring', 'Left: Phase colouring'], ['domain coloring', 'Left: Phase colouring'], ['3d', 'Left: Landscape'], ['riemann', 'Left: Sphere'], ['globe', 'Right: Sphere'], ['image', 'Right: Plane'], ['phase', 'Left: Phase colouring']]) {
  await key('k', 4); await sleep(300);
  await type(q); await sleep(350);
  const items = await ev(`[...document.querySelectorAll('#palList .pal-item')].map((e) => e.textContent)`);
  out.palette[q] = items.slice(0, 6);
  ok(`palette "${q}"`, items.some((t) => t.includes(want)), items.slice(0, 6));
  await key('Escape'); await sleep(250);
}

// 4. view keys by e.code before the '+' shortcut (Swiss Shift 1, Czech 1 type '+')
await ev('__cmwSetView("R", "sphere"); __cmwSetView("L", "sphere"); 1'); await sleep(300);
const raw = async (k, code, mods, text) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, modifiers: mods, text, unmodifiedText: text }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers: mods }); await sleep(300); };
await raw('+', 'Digit1', 8, '+');
ok('Swiss Shift 1 (+): Y Plane', (await ev('__cmwView()')).R.surf === 'plane' && !(await vis('#palInput')), await ev('__cmwView()'));
await raw('+', 'Digit1', 0, '+');
ok('Czech 1 (+): X Plane', (await ev('__cmwView()')).L.surf === 'plane' && !(await vis('#palInput')), await ev('__cmwView()'));
await raw('+', 'Equal', 8, '+');
ok('US Shift = (+): the function palette', !!(await vis('#palInput')), null);
await key('Escape'); await sleep(250);

// 5. drawing on Y Sphere (P3b: the w-globe takes targets): Disc draws there, no chip; Annulus (off on the globes)
// says where it draws
await ev('__cmwSetView("R", "sphere"); 1'); await sleep(300);
await key('d'); await sleep(400);
ok('Y Sphere + Disc: no chip (it draws on the w-globe, P3b)', (await vis('#sphereChipR')) === false, await txt('#sphereChipR'));
await key('n'); await sleep(400);
ok('Y Sphere + Annulus: the chip', (await vis('#sphereChipR')) === true && /Annulus draws in Plane \(⇧1\)/.test(await txt('#sphereChipR')), await txt('#sphereChipR'));
await key('v'); await sleep(300);
ok('Y Sphere + Select: no chip', (await vis('#sphereChipR')) === false, await vis('#sphereChipR'));
await ev('__cmwSetView("R", "plane"); 1'); await sleep(300);

// 6. Y's variable at focus k (P13)
await ev('__cmwExample(1); 1'); await sleep(1500);
await ev(`document.querySelector('.card[data-k="2"] .nm').click(); 1`); await sleep(600);
await key('d'); await sleep(400);
ok('focus 2: the Y hint in w₂', /w₂-plane/.test(await txt('#rightReadout')), await txt('#rightReadout'));
await key('4'); await sleep(500);
ok('focus 2: the Key in w₂', /w₂-plane/.test(await txt('#wKeyRow')), await txt('#wKeyRow'));
ok('focus 2: the Phase tip names f₂', /f₂/.test(await ev(`document.getElementById('phaseBtn').dataset.tip`)), await ev(`document.getElementById('phaseBtn').dataset.tip`));
await key('v'); await sleep(200);
await key('4'); await sleep(300);
// a d/dz step in focus: the landscape role reads w₂(z) like the phase role
await fresh();
await ev('__cmwExample(12); 1'); await sleep(1500);
const dk = await ev(`[...document.querySelectorAll('.card')].map((c) => [c.dataset.k, c.textContent.slice(0, 20)])`);
out.ex12cards = dk;
const kd = (dk.find((c) => /d\/dz/.test(c[1])) || [])[0];
if (kd) {
  await ev(`document.querySelector('.card[data-k="${kd}"] .nm').click(); 1`); await sleep(600);
  await key('3'); await sleep(900);
  const lt = await txt('#leftTitle');
  ok('d/dz focus: landscape of log|w_k(z)|', /landscape of log\|w.\(z\)\|/.test(lt), lt);
  await key('1'); await sleep(300);
}

// 7. View outline only with X Plane
await fresh();
await ev('__cmwExample(1); 1'); await sleep(1200);
ok('X Plane: View outline offered', (await vis('#fovChk')) === true, null);
await key('2'); await sleep(600);
ok('X Sphere: no View outline', !(await vis('#fovChk')), null);
await key('1'); await sleep(300);

// 8. titles: Y Sphere keeps its surface under the deformation; the role never cut inside a formula
await ev('__cmwSetView("R", "sphere"); 1'); await sleep(300);
await key('m'); await sleep(600);
const rt = await txt('#rightTitle');
ok('deformation on Y Sphere: w-sphere title', /sphere/.test(rt) && /deforming/.test(rt), rt);
await key('m'); await sleep(300);
await ev('__cmwSetView("R", "plane"); 1'); await sleep(300);
for (const w of [1024, 1180, 1440]) {
  await view(w, 900, false); await sleep(400);
  await ev(`document.querySelector('.card[data-k="2"] .nm').click(); __cmwSetView("L", "land"); __cmwSetPhase(true); 1`); await sleep(900);
  const t = await ev(`(() => { const t = document.getElementById('leftTitle'), pr = t.querySelector('.prole'); return { cls: t.className, txt: pr ? [...pr.childNodes].filter((n) => n.nodeType === 3 || getComputedStyle(n).display !== 'none').map((n) => n.textContent).join('') : '', cut: pr ? pr.scrollWidth > pr.clientWidth + 1 : false, terse: t.classList.contains('terse') }; })()`);
  out['title' + w] = t;
  ok(`title at ${w}: the role whole, short or gone, never cut`, !t.cut || t.terse, t);
}
await view(1440, 900, false);
await ev('__cmwSetView("L", "plane"); __cmwSetPhase(false); 1'); await sleep(300);

// 9. the X Phase readout: swatch always, |z| and arg where they fit
for (const [w, h] of [[1024, 768], [1440, 900], [2400, 1300]]) {
  await view(w, h, false); await fresh();
  await ev('__cmwExample(1); __cmwSetPhase(true); 1'); await sleep(1200);
  const r = await ev(`(() => { const p = document.getElementById('canvasL').getBoundingClientRect(); return [p.left + p.width * 0.4, p.top + p.height * 0.45]; })()`);
  await move(r[0], r[1]); await sleep(400);
  const g = await ev(`(() => { const e = document.getElementById('leftReadout'); const sw = e.querySelector('.sw'); const er = e.getBoundingClientRect(), sr = sw ? sw.getBoundingClientRect() : null; return { t: e.textContent, clipped: e.scrollWidth > e.clientWidth + 1, sw: !!sr && sr.right <= er.right - 2 }; })()`);
  out['readout' + w] = g;
  ok(`X Phase readout at ${w}: not clipped, swatch shown`, !g.clipped && g.sw, g);
  if (w === 2400) ok('X Phase readout at 2400: |z| and arg', /\|z\|/.test(g.t) && /arg/.test(g.t), g.t);
}
await view(1440, 900, false);

// 11. target preimages in every X view: example 10 (a target disc), X Plane + Phase and X Sphere + Phase
await fresh();
await ev('__cmwExample(10); 1'); await sleep(1800);
await shot('ubfix-ex10-plane', null);
await ev('__cmwSetPhase(true); 1'); await sleep(1200);
await shot('ubfix-ex10-phase', null);
ok('X Phase: cut handles kept', await ev('typeof __cmwState === "function"'), null);
await key('2'); await sleep(1500);
await shot('ubfix-ex10-phaseglobe', null);
await key('3'); await sleep(1500);
await shot('ubfix-ex10-land', null);

// 13. the landscape probe: needle and readout
await fresh();
await ev('__cmwExample(13); 1'); await sleep(2500);
const c = await ev(`(() => { const p = document.getElementById('canvasL').getBoundingClientRect(); return [p.left + p.width / 2, p.top + p.height / 2]; })()`);
await move(c[0], c[1]); await sleep(700);
let lr = await txt('#leftReadout');
ok('landscape: the centre ray meets the helicoid axis', /z 0\.0000 \+ 0\.0000i/.test(lr), lr);
// off the axis: the needle stands under the pointer (shot), the readout reads that point
await move(c[0] - 60, c[1] + 40); await sleep(700);
lr = await txt('#leftReadout');
out.landReadout = lr;
ok('landscape: the probe reads a point', /z/.test(lr) && /\d\.\d/.test(lr) && !/Drag/.test(lr), lr);
await shot('ubfix-land-probe', null);
await move(5, 5); await sleep(400);
ok('landscape: leaving clears the probe', /Drag/.test(await txt('#leftReadout')), await txt('#leftReadout'));

out.logs = logs();
ok('no console errors', !(out.logs || []).some((l) => /error|exception/i.test(JSON.stringify(l))), out.logs);
return { pass: !fails.length, fails, out };
