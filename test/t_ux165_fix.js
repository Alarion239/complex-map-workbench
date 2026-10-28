// v16.5 wave 1 fix round (notes/ux-build/w1-fix-AS-BUILT.md): the logic of the review fixes that runs without a
// browser (the detent steps of rail-2 in constr.js), and the source checks of the rest. The browser look of the same
// fixes: test/ux165_fix_cmd.js. Run: node test/t_ux165_fix.js
'use strict';
const fs = require('fs');
const path = require('path');
global.self = global;
const C = require(path.join(__dirname, '..', 'src', 'constr.js'));
const { source } = require('./src_text');
// (a src/ file as build.py reads it: src/app.js is joined from src/app/*.js)
const R = (f) => (f.startsWith('src/') ? source(f.slice(4)) : fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
// (app.js with the modules moved out of it: src/soundhooks.js, the Try line and sndPlayEnded; src/morphpaths.js,
// morphReadout)
const APP = R('src/app.js') + '\n' + R('src/soundhooks.js') + '\n' + R('src/morphpaths.js'), CON = R('src/construct.js'), PRM = R('src/params.js'), PAGE = R('src/page.html'), DESK = R('src/desk.css');
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log('FAIL', m, x === undefined ? '' : JSON.stringify(x)); } };
const fnBody = (src, name) => { const i = src.indexOf(`function ${name}(`); if (i < 0) return ''; const j = src.indexOf(') {', i) + 2; let d = 0, k = j; for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; } return src.slice(i, k + 1); };

// ---- rail-2: the angle detents never cover more than 40 % of a rail
const MOUSE = 6, TOUCH = 10;
const a60m = C.angleDetent(60, MOUSE), a60t = C.angleDetent(60, TOUCH);
ok(a60m && a60m.deg === 30, 'unit circle at 60 px per unit, mouse: 30°', a60m);
ok(a60t && a60t.deg === 90, 'unit circle at 60 px per unit, finger: 90° (1, i, −1, −i)', a60t);
ok(C.angleDetent(600, MOUSE).deg === 15 && C.angleDetent(600, TOUCH).deg === 15, 'zoomed in (600 px per unit): 15° again');
ok(C.angleDetent(10, TOUCH) === null, 'a circle too small for any detent has none');
for (let r = 4; r < 4000; r *= 1.19) for (const Rd of [MOUSE, TOUCH, MOUSE / 2, TOUCH / 2]) {
  const ad = C.angleDetent(r, Rd);
  if (!ad) continue;
  const arc = r * ad.deg * Math.PI / 180;
  ok(2 * ad.R / arc <= 0.4 + 1e-12, `r ${r.toFixed(1)} px, R ${Rd}: a window covers ${(100 * 2 * ad.R / arc).toFixed(1)} % of the rail`);
  ok(C.DETENT_DEG.includes(ad.deg) && ad.R <= Rd, `r ${r.toFixed(1)}: a listed step, a radius no larger than asked`);
}
{
  // a finger can rest at 37° on the unit circle at 60 px per unit: 37° is outside every detent window (45° steps)
  const ad = C.angleDetent(60, TOUCH), win = (ad.R / 60) * 180 / Math.PI;
  const nearest = Math.round(37 / ad.deg) * ad.deg;
  ok(Math.abs(37 - nearest) > win, `a finger rests at 37°: nearest detent ${nearest}°, window ±${win.toFixed(1)}°`);
  // placing takes half the window (user-2): at most ±3 px with a mouse, about ±3° at 60 px per unit
  const am = C.angleDetent(60, MOUSE), pw = 0.5 * am.R / 60 * 180 / Math.PI;
  ok(pw <= 3, `a mouse placement's window ±${pw.toFixed(2)}°`);
}
// the lattice detents of a line
ok(C.latticeDetentR(30, MOUSE) === 6 && C.latticeDetentR(26, MOUSE) === 5.2 && C.latticeDetentR(30, TOUCH) === 6, 'a line\'s lattice window: a fifth of the step at most');
for (let s = 2; s < 5000; s *= 1.3) { const st = C.gridStep(s) * s; ok(2 * C.latticeDetentR(st, TOUCH) / st <= 0.4 + 1e-12, `lattice at ${s.toFixed(1)} px per unit: at most 40 %`); }

// ---- construct.js: the review fixes in the source
const SNAP = fnBody(CON, 'snapAt'), DET = fnBody(CON, 'detentAt');
ok(/bg\(best\) === 'real' \|\| bg\(best\) === 'imag'/.test(SNAP) && /bg\(n\) === 'unit' && n\.d <= cR \/ sc && n\.d - best\.d <= tie/.test(SNAP) && /\(touch \? 6 : 4\) \/ sc/.test(SNAP), 'rail-1: an axis press within 4 px (6 for a finger) of the unit circle goes to the circle');
ok(/\(bg\(a\) && bg\(b\)\)/.test(SNAP), 'rail-1: the unit circle and an axis (shown or fixed shapes) make no crossing target');
ok(/cR = gridOn \? Math\.max\(R\.c, R\.g\) : R\.c/.test(SNAP) && /let best = null, bd = cR \/ sc;/.test(SNAP), 'user-2: a curve within the grid radius wins over a lattice point');
ok(/detentAt\(side, t, touch, ex, best\.s, \{ place: true, self: o\.self \}\)/.test(SNAP) && /f = o\.place \? 0\.5 : 1/.test(DET), 'user-2: a placement takes half a slide\'s detent window');
ok(/Constr\.angleDetent\(pc\.r \* sc, R\)/.test(DET) && /Constr\.latticeDetentR\(st \* sc, R\)/.test(DET) && !/Math\.PI \/ 12/.test(DET), 'rail-2: the angle step and the lattice window adapt to the zoom');
ok(/add\(deg \/ 15 \/ 24, label, null, ad\.R\)/.test(DET), 'rail-2: the turn-exact parameter (k/24) is kept, so 1, i, −1, −i stay exact');
ok(/if \(id === o\.self\) continue;/.test(DET) && /if \(!z \|\| clash\(z\)\) return;/.test(DET), 'rail-3: no detent on a co-argument of a construction built on the dragged point');
ok(/detentAt\(side, tg, touch, ex, e, \{ self: s\.id \}\)/.test(CON) && /pend: false, self: s\.id \}/.test(CON), 'rail-3: the rail and the free drag pass the dragged point');
// (v16.5 check app-4: inside a sentence by its 'ref' form, the same words in English and Russian, with its article in Italian)
ok(/const fx = fixedRef\(s\);\s*if \(fx\) return fx;/.test(fnBody(CON, 'shapeLabel')) && /if \(fixedName\(x\)\) continue;/.test(fnBody(CON, 'shapeLabel')), 'rail-4: a fixed unit circle or axis is called by that name and takes no number (X and Y)');
ok(/fixedName: \(s\) => \(A \? fixedName\(s\) : null\)/.test(CON), 'rail-4: Construct.fixedName for the app\'s rows');
ok(/const FIXREF = \{ unit: \(\) => \$tx\('ref', 'the unit circle'\), real: \(\) => \$tx\('ref', 'the real axis'\), imag: \(\) => \$tx\('ref', 'the imaginary axis'\) \};/.test(CON) && /return FIXREF\[ref\.disp\] \? FIXREF\[ref\.disp\]\(\)/.test(fnBody(CON, 'curveName')), 'check app-4: the unit circle and the axes in a sentence by their ref names');
ok(/const fx = fixedNm\(s\);\s*if \(fx\) return row \? capFirst\(fx\) : fx;/.test(fnBody(APP, 'rowName')) && /if \(!fixedNm\(s\)\) counts\[nk\]/.test(fnBody(APP, 'shapeNames')), 'rail-4: the app names and numbers rows the same way');
ok(/globeCurveAt\(side, gp\.g, x, y, gp\.gc, gp\.hit\)/.test(fnBody(CON, 'globeClick')) && /hit: \(s, tol\) => globeCurveHit\(gc, s, x, y, tol\)/.test(APP), 'rail-5: a globe pick on a drawn curve is a point on it');
ok(/if \(tool === 'meet' \|\| CURVE1\.has\(tool\)\) \{ pickWarn\(\$t\('Switch to the plane to pick the curve'\)\)/.test(fnBody(CON, 'globeClick')), 'rail-5: the curve tools on the globe say where their curve is picked');
ok(!/A\.toast\(\$t\('To place a point next to another/.test(fnBody(CON, 'pointDown')) && /d\.cmTell && !d\.moved && !pointDown\.told/.test(fnBody(CON, 'moveUp')) && /cmTell: Construct\.touchNow\(\)/.test(APP), 'rail-6: the Snap-off tip comes at the release of a tap that did not move, never at a press');
ok(/function pickOk\(\)/.test(CON) && (CON.match(/pickOk\(\);/g) || []).length >= 7 && /if \(e\.key === 'Escape' && A\) pickOk\(\);/.test(CON), 'rail-7: the refusal goes on an accepted pick, Undo pick, cancel and Esc');
ok(/setRing\(side, t, pickWarnMsg === w \? true : w\)/.test(CON) && /setRing\(side, t, true\);/.test(fnBody(CON, 'click')) && /chip: typeof warn === 'string' \? warn : warn \? '' : chipOf\(t\)/.test(CON), 'rail-7: after a press the chip says it, the ring only warns');
ok((CON.match(/pickWarn\(\$t\('\{x\} needs distinct points', \{ x: warnTool\(tool\) \}\)\)/g) || []).length === 2 && /const warnTool = \(tool\) => \(toolName\(tool\)/.test(CON) && !/needs distinct points', \{ x: chipTool\(tool\)/.test(CON), 'rail-8: the refusal names the tool in full (the chip\'s label may be the short one)');
ok(/el\.classList\.add\('cm-low'\)/.test(CON) && /\.draft-chip\.cm-on\.cm-low \{ top: auto !important; bottom: 32px; left: 8px; translate: none; max-width: calc\(100% - 64px\); \}/.test(CON), 'rail-9: a desktop\'s chip moves to the plane\'s foot when the picks are under it');
ok(/\$t\('Pick a point \(on \{c\} or anywhere\)', \{ c: curve1Name\(\) \}\)/.test(fnBody(CON, 'chipText')), 'user-6: the chip says a point on the picked curve will do');

// ---- app.js, params.js
ok(/function syncUnused\(\)/.test(PRM) && /syncUnused,/.test(PRM) && (APP.match(/Params\.syncUnused\(\)/g) || []).length >= 2, 'user-1: "Not used yet" follows the chain and the selected step');
ok(/\.prm-list \{ flex: 0 1 auto;/.test(PRM), 'user-5: + Number sits under the list, not at the section\'s foot');
ok(/S\.shapes\.filter\(\(s\) => kindType\(s\) === 'area'\)\.map/.test(fnBody(APP, 'patternCell')) && /if \(\(s\.def \|\| s\.fixed\) && t !== 'area'\) continue;/.test(fnBody(APP, 'stageSamples')), 'user-3: a construction curve refits neither the cell nor Y');
ok(/probeTeachUntil > now/.test(APP) && /sessionStorage\.getItem\('cmw-probe-taught'\)/.test(APP) && /\.chip\.readout:has\(> \.rteach\) \{ height: auto; white-space: normal;/.test(PAGE), 'regress-4, user-4: the hold-and-slide line once a session for 8 s, whole');
ok(/function morphReadout\(short\)/.test(APP) && /padStart\(3, '\\u2007'\)/.test(APP) && /lab\.dataset\.short = '1'/.test(APP), 'regress-1: a short readout when the row is tight, a padded percentage');
ok(/new ResizeObserver\(\(\) => \{ if \(!q && th\.firstElementChild\)/.test(APP), 'regress-2: a toast is placed again when the layout under it changes');
ok(/host\.setAttribute\('data-placed', 'head'\)/.test(fnBody(APP, 'placeToasts')) && /#toastHost\[data-placed="head"\] \.toast \{/.test(DESK), 'regress-3: a desktop message sits in the chain head when it fits there');
ok(/run: \(\) => go\(\) \}\], drop: 'title'/.test(APP) && /Tour\.laneHide\('example'\);\s*\}/.test(fnBody(APP, 'sndPlayEnded')), 'regress-5: the Try line stays while the melody plays');
ok(/let wOnce;/.test(APP) && /const w = wOnce !== undefined \? wOnce : focusF\(\)\(z\);/.test(APP), 'regress-6: F(z) of the probe evaluated once per move');
ok(/if \(k === undoKey\) return;/.test(fnBody(APP, 'updateUndo')) && /if \(key === targetNoteKey\) return;/.test(fnBody(APP, 'targetNote')), 'regress-7: updateUndo and targetNote return at once when nothing changed');
ok(/b\.x1 > 0 && b\.y1 > 0 && b\.x0 < r\.width && b\.y0 < r\.height/.test(fnBody(APP, 'mfNogo')), 'regress-8: no-go rectangles only over the plane');
ok(/performance\.now\(\) - navKeyAt > 300 \|\| !el\.matches\(':focus-visible'\)/.test(APP) && /el !== kbdTip/.test(APP), 'regress-9: a Tab focus shows the tip, a focus the app moves does not');
ok(/const namesA = shapeNames\(A\.shapes \|\| \[\]\), namesB = shapeNames\(B\.shapes \|\| \[\]\);/.test(fnBody(APP, 'histWhat')), 'regress-10: an undo step names its shape from its own snapshot (z₆)');

// ---- the Russian of this round
const FIX = JSON.parse(R('notes/i18n/ru/v165-ux-fix.json'));
const MRT = R('tools/make_ru_table.py');
ok(/V165_FIX_HERE = \{'v165-ux-fix\.json'\}/.test(MRT) && MRT.indexOf("if p.name in V165_FIX_HERE") > MRT.indexOf("if p.name in V165_HERE)"), 'make_ru_table: the fix table is read after every other v16.5 table');
const RU = (() => { const t = R('src/i18n_ru.js'); const m = /^I18N\.define\('ru', (".*")\);\s*$/ms.exec(t); return JSON.parse(JSON.parse(m[1])); })();
for (const v of Object.values(FIX)) if (v && v.en) ok(RU[v.en] === v.ru, 'Russian shipped: ' + v.en, RU[v.en]);
ok(RU['Hold and slide to read F(z)'] === 'Удерживайте палец\u00a0— F(z)', 'user-4: the short Russian probe line wins');

// (v16.5 check app-4) Italian joins a definite article to the simple preposition before it; English and Russian unchanged
{
  const I18N = require(path.join(__dirname, '..', 'src', 'i18n.js'));
  global.I18N = I18N;
  require(path.join(__dirname, '..', 'src', 'i18n_it.js')); require(path.join(__dirname, '..', 'src', 'i18n_ru.js'));
  const as = (l, f) => I18N.using(l, f), unit = (l) => as(l, () => I18N.tx('ref', 'the unit circle'));
  const T = (l, k, p) => as(l, () => I18N.t(k, p));
  ok(T('it', 'on {c}', { c: unit('it') }) === 'sulla circonferenza unitaria', 'check app-4: «sulla circonferenza unitaria»', T('it', 'on {c}', { c: unit('it') }));
  ok(T('it', 'perpendicular to {c}, through {a} and {b}', { c: as('it', () => I18N.tx('ref', 'the real axis')), a: 'z₀', b: 'z₁' }) === "perpendicolare all'asse reale, passante per z₀ e z₁", "check app-4: «all'asse reale»");
  ok(T('it', 'Outside {c} only', { c: unit('it') }) === 'Solo fuori dalla circonferenza unitaria', 'check app-4: «dalla»');
  ok(T('it', 'on {c} at {a}', { c: unit('it'), a: '60°' }) === 'sulla circonferenza unitaria, 60°', 'check app-4: the snap chip with an angle');
  ok(T('it', 'on {c}', { c: 'Circonferenza 1' }) === 'su Circonferenza 1', "check app-4: a user's curve (no article) is filled as before");
  ok(T('en', 'on {c}', { c: unit('en') }) === 'on the unit circle' && T('ru', 'on {c}', { c: unit('ru') }) === 'на кривой: единичная окружность', 'check app-4: English and Russian unchanged');
}

console.log(fail ? `${fail} of ${pass + fail} checks FAILED` : `all ${pass} checks pass`);
process.exit(fail ? 1 : 0);
