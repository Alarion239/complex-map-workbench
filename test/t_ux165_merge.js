// v16.5 wave 1 merge (notes/ux-build/W1-MERGE.md): the places where the five pieces (learn, chain, plane, rail, phone)
// meet, read from the merged sources. Each check names the pieces whose intents it keeps. Node, no browser.
'use strict';
const fs = require('fs');
const path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got).slice(0, 400) : '')); } };
const APP = R('src/app.js'), CON = R('src/construct.js'), PAGE = R('src/page.html'), TOUR = R('src/tour.js'), MK = R('tools/make_ru_table.py');
const count = (s, sub) => s.split(sub).length - 1;
const fnBody = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; const j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };

// ---- no conflict marker left anywhere
for (const f of ['src/app.js', 'src/construct.js', 'src/constr.js', 'src/page.html', 'src/tour.js', 'src/phone.js', 'src/phone.css', 'src/desk.css', 'src/inspector.js', 'tools/make_ru_table.py'])
  ok(`${f}: no conflict markers`, !/^(<{7}|>{7}) /m.test(R(f)));

// ---- Russian: one set holds every piece's table and the merge's own, read after every v16.4 table
const m = /V165_HERE = \{([^}]*)\}/.exec(MK);
const names = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
ok('make_ru_table: V165_HERE lists the five pieces and the merge', ['learn', 'chain', 'plane', 'rail', 'phone', 'merge'].every((p) => names.includes(`v165-ux-${p}.json`)), names);
ok('make_ru_table: one V165 set, read once, after the v16.4 tables', count(MK, 'p.name in V165_HERE') === 1 && !/V165_(CHAIN|PLANE|RAIL)_HERE/.test(MK) && MK.indexOf("glob('v165-*.json')") > MK.lastIndexOf("glob('v164-*.json')"));
const TABLE = (() => { const s = R('src/i18n_ru.js'); const mm = /I18N\.define\('ru', (".*")\);\s*$/ms.exec(s); return JSON.parse(JSON.parse(mm[1])); })();
const keyOf = (v) => (v.ctx ? v.ctx + '\u0004' : '') + v.en;
const MERGE_RU = JSON.parse(fs.readFileSync(path.join(__dirname, '../notes/i18n/ru/v165-ux-merge.json'), 'utf8'));
const ents = Object.entries(MERGE_RU).filter(([k]) => !k.startsWith('_'));
ok('the merge\'s table: every entry has en and ru', ents.length >= 6 && ents.every(([, v]) => v.en && v.ru), ents.length);
ok('the merge\'s table: every string is in the shipped table', ents.every(([, v]) => TABLE[keyOf(v)] === v.ru), ents.filter(([, v]) => TABLE[keyOf(v)] !== v.ru).map(([k]) => k));

// ---- learn UX97 + chain UX81: one Alt+←/→ branch in chainKey (the same key, built twice)
const ck = fnBody(APP, 'chainKey');
ok('chainKey: one Alt+arrow branch, through moveCard', (ck.match(/[^!]e\.altKey && /g) || []).length === 1 && /moveCard\(k, e\.key === 'ArrowLeft' \? -1 : 1\)/.test(ck), ck.slice(0, 300));
ok('a card\'s ⋯ shows Alt ← / Alt → (none on touch)', /label: \$t\('Move left'\), icon: 'chevL', key: touchUI\(\) \? '' : 'Alt ←'/.test(APP) && /label: \$t\('Move right'\), icon: 'chevR', key: touchUI\(\) \? '' : 'Alt →'/.test(APP));
ok('menu keys (⌘D, ⌘], ⌘[) are empty on a touch screen (phone UX17)', /const modK = \(k\) => \(touchUI\(\) \? '' :/.test(APP));

// ---- chain UX71 wording + learn UX71 Stop
ok('X\'s chip: "choose Show F to draw" (chain) with the listening Stop (learn)', APP.includes("choose Show F to draw.')") && /if \(!msg\) \{ msg = listenChipMsg\(\); if \(msg\) act = \{ stop: true \}; \}/.test(APP) && !APP.includes('choose Whole chain to draw'));

// ---- chain UX25 + learn UX74 in the Examples list
const og = fnBody(APP, 'openGallery');
ok('Examples: New first with ex-new (chain) and the ♫ mark (learn)', og.includes("' ex-new'") && og.includes("$t('New: empty canvas')") && og.includes("class: 'ex-snd'") && og.includes("class: 'ex-nl'"));

// ---- chain V03 + phone UX17 in integrateSelected
const is = fnBody(APP, 'integrateSelected');
ok('integrateSelected: the touch toast (phone), the pick-a-curve guard and integrateShape (chain)', is.includes("hold a finger on a curve, then choose Integrate.") && is.includes('Pick a curve to integrate along') && is.includes('return integrateShape(list[0].id);') && !is.includes('openIntegralPop'));

// ---- plane UX27 + learn UX103 in paneTitles
const pt = fnBody(APP, 'paneTitles');
ok('paneTitles: Deformation in words (learn) and the Y tag on the four other right titles (plane)', pt.includes("$t('Deformation'), $t('from {a} to {b}'") && count(pt, 'right = T(YT + ') === 4);
// ---- plane + learn: the tag gives way before the title (merge: with Add function in Y's head the title vanished)
const ft = fnBody(APP, 'fitTitle');
ok('fitTitle: the note, then the X / Y tag, give way before the title', ft.includes("t.classList.add('notag')") && ft.indexOf('fitTitle(side, true)') < ft.indexOf("add('notag')") && ft.indexOf("add('notag')") > ft.indexOf("querySelector('.ptag')") && PAGE.includes('.pane-title.notag .ptag { display: none; }'));

// ---- plane UX92/UX95 + learn UX72 in shapeEditor
const se = fnBody(APP, 'shapeEditor');
ok('shapeEditor: the unbounded note (plane) and Listen along it (learn)', se.includes('!formulaBounded(s)') && se.includes("'data-unb'") && se.includes("'data-act': 'listen-along'"));
// ---- plane UX95 + learn UX97 in the shape ⋯
ok('shape ⋯: Duplicate through duplicateShape with ⌘D (learn) and colours by name (plane)', APP.includes("label: $t('Duplicate'), key: modK('D'), run: () => duplicateShape(s)") && APP.includes('label: colorName(i), swatch: cc'));
// ---- plane UX67 + chain UX33 in paramField
ok('paramField: the sheet ‹ ahead of the field (plane) and the worded class and paramWord (chain)', APP.includes("(word ? ' worded' : '') }, lab, extra ? h('div', { class: 'pair' }, before, input, extra) : input)") && /function paramWord\(st, q\)/.test(APP));
// ---- plane + learn in idleRight
ok('idleRight: the phone target line (learn), then "Draw a target in Y" (plane)', /targetText\(\{ phone: true \}\)/.test(APP) && APP.includes("$t('Draw a target in Y (the {x}-plane)'"));
// ---- learn UX93 for the plane's seventh tool
ok('the Russian phone tile for Hyperbolic (plane UX55, learn UX93)', APP.includes("hyper: $tx('phone tile', 'Hyperbolic')") && TABLE['phone tile\u0004Hyperbolic'] === 'Гиперб.', TABLE['phone tile\u0004Hyperbolic']);

// ---- rail + plane in construct.js
ok('construct: "needs distinct points" refused in the chip (plane UX52 on rail\'s lines), never a toast', count(CON, "pickWarn($t('{x} needs distinct points'") === 2 && !CON.includes("A.toast($t('{x} needs distinct points'"));
ok('construct: the meet tool\'s test is rail\'s, its refusal plane\'s pickWarn', CON.includes("if (t.cls !== 'curve' || !t.ref) { const c = snapAt(side, x, y, { points: false, cross: false, curves: true }); if (!c) { pickWarn(chipTouch() ? $t('Tap a crossing of two curves, or a curve.') : $t('Click a crossing of two curves, or a curve.'))"));
ok('construct: exports are the union (rail and plane)', ['cancelDrag', 'globeSlide', 'globePoint', 'touchNow', 'altNow', 'samePick', 'undoPick', 'undoPickable'].every((k) => new RegExp('\\b' + k + '\\b[:,]').test(CON.slice(CON.lastIndexOf('return {')))));
for (const w of ['a line or a circle.', 'a crossing of two curves, or a curve.', 'a point off {c}.', 'a point on {c}.'])
  ok(`construct: "Click ${w}" has its touch words "Tap ${w}" (phone UX17)`, count(CON, `$t('Click ${w}'`) === count(CON, `$t('Tap ${w}'`) && count(CON, `$t('Tap ${w}'`) >= 1);
ok('page.html: Snap carries rail\'s tooltip and plane\'s word', /id="snapBtn"[^>]*data-tip="Snap to the grid and to figures \(both panes\)\. Hold Alt to place freely\."[^>]*aria-label="Snap to grid and figures"><span class="ic-slot" data-icon="snap"><\/span><span class="snap-w">Snap<\/span>/.test(PAGE));

// ---- rail + plane in app.js
ok('snapZ: the press\'s own pointer (plane ptrTouch) before Construct\'s last pointer (rail)', /const fing = touch != null \? touch : ptrTouch != null \? ptrTouch :/.test(fnBody(APP, 'snapZ')));
ok('nudgeShape: one step of the grid as drawn (rail Constr.gridStep, learn UX97)', fnBody(APP, 'nudgeShape').includes('Constr.gridStep(sc)'));
ok('editDown: rail\'s Point-tool move and plane\'s handleAt both present', fnBody(APP, 'editDown').includes("pd === 'existing'") && /handleAt\(pane, /.test(APP));

// ---- phone guide + chain UX85 / UX65
ok('the phone guide names the button Show alone (chain UX85) and finds Numbers (chain UX65)', APP.includes("The editor's <b>Show alone</b> button") && !APP.includes('Show this step alone') && APP.includes('`Shared numbers|Numbers`'));
ok('the tour\'s chain step on touch says Show alone (chain over phone)', TOUR.includes("touch: 'Tap the card $f_1$, then Show alone in the sheet.'") && !TOUR.includes('Show this step alone'));

// ---- the tour's shared notes
const INT = fs.readFileSync(path.join(__dirname, '../notes/tour/INTEGRATION.md'), 'utf8');
ok('INTEGRATION.md: the v16.5 wave 1 step fields and the lane', /### Step fields and API added in v16\.5 wave 1/.test(INT) && ['titleTouch', 'leadTouch', 'touchByScene', 'desk: true', 'Tour.lane(', 'Tour.laneHide', 'leftOpts'].every((k) => INT.includes(k)));

console.log(fail ? `t_ux165_merge: ${fail} of ${pass + fail} FAILED` : `t_ux165_merge: ${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
