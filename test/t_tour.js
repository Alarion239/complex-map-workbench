// The guided tour (notes/tour/DESIGN.md): its content against the integration contract (notes/tour/INTEGRATION.md),
// the copy markup, the callout placement and the lit areas, the persisted record through a fake localStorage, the
// first-run rules and the step order. DOM-free; the browser side is test/tour_cmd.js. Run: node test/t_tour.js
const fs = require('fs');
const path = require('path');
const { Tour } = require('../src/tour.js');
const T = Tour._t;
let fails = 0, n = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, got, want) {
  n++;
  if (!eq(got, want)) { fails++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); }
}
const ok = (name, cond, info) => { n++; if (!cond) { fails++; console.log('FAIL', name, info !== undefined ? JSON.stringify(info) : ''); } };

// ---- the contract: the anchor and event names documented in INTEGRATION.md
const DOC = fs.readFileSync(path.join(__dirname, '../notes/tour/INTEGRATION.md'), 'utf8');
function namesIn(section) {
  const i = DOC.indexOf(section);
  if (i < 0) return new Set();
  const rest = DOC.slice(i + section.length);
  const end = rest.search(/\n#{2,3} /);
  const out = new Set();
  for (const line of (end < 0 ? rest : rest.slice(0, end)).split('\n')) {
    if (!/^\|/.test(line) || /^\|\s*-/.test(line)) continue;
    const first = line.split('|')[1] || '';
    for (const m of first.matchAll(/`([^`]+)`/g)) out.add(m[1]);
  }
  return out;
}
// (v15: the names the new layout adds are in their own tables, so the v14 gate's copy of this test still passes)
const DOC_ANCHORS = new Set([...namesIn('### Anchors'), ...namesIn('### Anchors added or changed in v15')]);
const DOC_EVENTS = new Set([...namesIn('### Events'), ...namesIn('### Events added in v15')]);
ok('INTEGRATION.md lists anchors', DOC_ANCHORS.size >= 20, [...DOC_ANCHORS]);
ok('INTEGRATION.md lists events', DOC_EVENTS.size >= 10, [...DOC_EVENTS]);
for (const k of Object.keys(T.ANCHORS)) ok(`anchor ${k} of the default map is documented`, DOC_ANCHORS.has(k));
for (const k of DOC_ANCHORS) ok(`documented anchor ${k} has a default`, k in T.ANCHORS);
// the names the lead's contract asks for
for (const k of ['examples', 'tool:disc', 'formula', 'shapes', 'chain', 'paneL', 'paneR', 'viewSwitch', 'deformToggle', 'paths', 'guarantees', 'exportBtn', 'palette', 'helpBtn'])
  ok(`contract anchor ${k}`, DOC_ANCHORS.has(k) && k in T.ANCHORS);
for (const m of ['anchor(name)', 'has(feature)', 'snapshot()', 'restore(snap', 'loadScene(spec)', 'sandbox(on)', 'setView(main)', 'setSurface(pane, surf)', 'setDeformation(on)', 'setTool(id)', 'setLook(look)', 'busy()', 'hasWork()', 'on(event, fn)', 'tex(src)', 'storageKey(k)'])
  ok(`INTEGRATION.md documents api.${m}`, DOC.includes(m));
for (const m of ['Tour.init', 'Tour.start', 'Tour.suggest', 'Tour.isSeen', 'Tour.openHelpMenu']) ok(`INTEGRATION.md documents ${m}`, DOC.includes(m));

// ---- content
const CH = T.CHAPTERS;
const steps = CH.flatMap((c) => c.steps.map((s) => Object.assign({ ch: c.id }, s)));
// (v15: an eighth chapter, Editing the chain: the cards, the Inspector, zeros and poles, the planes' menu, shared numbers)
ok('5 to 8 chapters', CH.length >= 5 && CH.length <= 8, CH.length);
ok('20 to 40 steps', steps.length >= 20 && steps.length <= 40, steps.length);
check('chapter order', CH.map((c) => c.id), ['basics', 'views', 'edit', 'deform', 'analysis', 'branches', 'export', 'keys']);
ok('basics: 8 to 10 steps (about two minutes)', CH[0].steps.length >= 8 && CH[0].steps.length <= 10, CH[0].steps.length);
ok('basics: at most 4 Try its (two minutes, as the suggestion promises)', CH[0].steps.filter((s) => s.try).length <= 4, CH[0].steps.filter((s) => s.try).map((s) => s.id));
ok('no chapter over 6 steps but Basics', CH.slice(1).every((c) => c.steps.length <= 6), CH.map((c) => c.steps.length));
ok('chapter ids unique', new Set(CH.map((c) => c.id)).size === CH.length);
for (const c of CH) {
  ok(`${c.id}: step ids unique`, new Set(c.steps.map((s) => s.id)).size === c.steps.length);
  ok(`${c.id}: title, time, rev`, c.title && c.time && c.rev >= 1);
  ok(`${c.id}: scene exists`, c.scene == null || T.SCENES[c.scene], c.scene);
}
// what the tour covers (the lead's list): each topic has a step
const ids = new Set(steps.map((s) => `${s.ch}/${s.id}`));
for (const id of ['basics/examples', 'basics/draw', 'basics/shapes', 'basics/formula', 'basics/chain', 'basics/add', 'basics/x', 'basics/y', 'basics/preimages',
  'views/phase', 'views/land', 'views/sphere', 'views/patterns', 'deform/toggle', 'deform/paths', 'deform/order',
  'analysis/targets', 'analysis/integral', 'analysis/guarantees', 'analysis/domain', 'edit/zp', 'edit/cards', 'edit/inspector', 'edit/zpHere', 'edit/numbers', 'branches/cut', 'branches/inverse', 'branches/deriv', 'branches/sheets',
  'export/figure', 'export/formula-tex', 'keys/palette', 'keys/sound', 'keys/help', 'views/key', 'analysis/cauchy'])
  ok(`covers ${id}`, ids.has(id));
const sentences = (s) => s.replace(/\$[^$]*\$/g, 'M').replace(/\b(e\.g|i\.e)\./g, '').split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean).length;
const EVENTS_USED = new Set();
for (const s of steps) {
  const id = `${s.ch}/${s.id}`;
  ok(`${id}: title`, typeof s.title === 'string' && s.title.length > 2 && s.title.length <= 28, s.title);
  ok(`${id}: body 1 to 3 sentences`, sentences(s.body) >= 1 && sentences(s.body) <= 3, sentences(s.body));
  ok(`${id}: body at most 240 characters as read`, T.plainCopy(s.body, 'Ctrl').length <= 240, T.plainCopy(s.body, 'Ctrl').length);
  ok(`${id}: body ends a sentence`, /[.!?)]$/.test(s.body.trim()), s.body.slice(-12));
  for (const k of ['narrow', 'touch']) if (s[k]) ok(`${id}: ${k} body at most 240, 1 to 3 sentences`, T.plainCopy(s[k], 'Ctrl').length <= 240 && sentences(s[k]) <= 3, T.plainCopy(s[k], 'Ctrl').length);
  for (const [sc, b] of Object.entries(s.byScene || {})) ok(`${id}: body for scene ${sc}`, !!T.SCENES[sc] && T.plainCopy(b, 'Ctrl').length <= 240 && sentences(b) <= 3, sc);
  // the panes are X and Y, never left and right (on a phone they stack); a phone shows no hover, no right-click
  for (const b of [s.body, s.narrow, s.touch, ...Object.values(s.byScene || {})].filter(Boolean)) ok(`${id}: no left or right pane`, !/\b(left|right)\s+(pane|plane)|\bon the (left|right)\b/i.test(b), b);
  const onPhone = T.plainCopy(T.copyFor(s, null, { coarse: true, narrow: true }) + ' ' + (s.try ? T.tryFor(s.try, { coarse: true }) : ''), 'Ctrl');
  ok(`${id}: a phone's text has no left, right or hover`, !/\bhover|\b(left|right)\b(?!\s+angles?)/i.test(onPhone), onPhone);
  for (const a of s.anchor == null ? [] : [].concat(s.anchor, s.also || [])) ok(`${id}: anchor ${a} is in the contract`, DOC_ANCHORS.has(a) && a in T.ANCHORS, a);
  if (s.place) ok(`${id}: place is a side`, ['right', 'left', 'bottom', 'top'].includes(s.place), s.place);
  for (const a of s.before || []) {
    ok(`${id}: action ${a[0]} known`, ['view', 'surface', 'deform', 'focus', 'panel', 'scene', 'tool', 'look', 'select', 'plane'].includes(a[0]), a);
    if (a[0] === 'select') ok(`${id}: select value`, a[1] === 'F' || (Number.isInteger(a[1]) && a[1] >= 1), a);
    if (a[0] === 'plane') ok(`${id}: plane value`, ['L', 'R'].includes(a[1]), a);
    if (a[0] === 'scene') ok(`${id}: scene ${a[1]} exists`, [].concat(a[1]).every((k) => !!T.SCENES[k]), a[1]);
    if (a[0] === 'tool') ok(`${id}: tool value`, typeof a[1] === 'string', a);
    if (a[0] === 'look') ok(`${id}: look keys`, a[1] && Object.keys(a[1]).every((k) => k in T.LOOK), a);
    if (a[0] === 'view') ok(`${id}: view value`, ['xy', 'phase', 'land'].includes(a[1]), a);
    if (a[0] === 'surface') ok(`${id}: surface value`, ['L', 'R'].includes(a[1]) && ['plane', 'sphere'].includes(a[2]), a);
    if (a[0] === 'deform') ok(`${id}: deform value`, typeof a[1] === 'boolean', a);
    // (v15: 'sheet', a phone's sheet only; a third value names the phone's sheet: tools, display)
    if (a[0] === 'panel') ok(`${id}: panel value`, ['left', 'right', 'sheet'].includes(a[1]) && (a[2] == null || ['tools', 'display'].includes(a[2])) && (a[1] !== 'sheet' || a[2] != null), a);
  }
  // TeX: balanced braces and dollars, nothing the plain reading leaves as a command
  const texs = T.parseCopy(s.body + ' ' + (s.try ? s.try.text : '')).filter((t) => t.t === 'tex').map((t) => t.v);
  for (const x of texs) {
    let d = 0, bad = false;
    for (const ch of x) { if (ch === '{') d++; if (ch === '}') d--; if (d < 0) bad = true; }
    ok(`${id}: TeX braces ${x}`, !bad && d === 0);
  }
  ok(`${id}: dollars paired`, ((s.body.match(/\$/g) || []).length % 2) === 0);
  if (s.try) {
    for (const t of [s.try.text, s.try.touch].filter((x) => x != null)) ok(`${id}: try text, at most 60 as read`, typeof t === 'string' && t.length > 4 && T.plainCopy(t, 'Ctrl').length <= 60, t);
    if (s.try.count) ok(`${id}: try count`, Number.isInteger(s.try.count) && s.try.count >= 1);
    ok(`${id}: try has an event`, [].concat(s.try.on || []).length > 0);
    for (const e of [].concat(s.try.on || [])) { EVENTS_USED.add(e); ok(`${id}: event ${e} is in the contract`, DOC_EVENTS.has(e), e); }
    if (s.try.test) ok(`${id}: try test tolerates a bare event`, s.try.test(undefined) === true);
    ok(`${id}: a Try it lights what it asks for`, s.anchor != null);
  }
  if (s.needs) ok(`${id}: needs is a feature name`, typeof s.needs === 'string' || Array.isArray(s.needs));
}
for (const e of DOC_EVENTS) ok(`documented event ${e} is used by a Try it`, EVENTS_USED.has(e), e);
ok('the first step is the centred welcome', CH[0].steps[0].anchor === null);
ok('every other step has an anchor', steps.slice(1).every((s) => s.anchor != null));
ok('a Try it per chapter at least (except Export)', CH.filter((c) => c.id !== 'export').every((c) => c.steps.some((s) => s.try)));
ok('scenes: examples format', Object.values(T.SCENES).every((sc) => Array.isArray(sc.shapes) && Array.isArray(sc.steps) && sc.view && typeof sc.name === 'string'));
// every scene sets the whole look the copy assumes (a user's Stretch pattern or Re F height never leaks in)
for (const [k, sc] of Object.entries(T.SCENES)) ok(`scene ${k}: a full look`, sc.look && Object.keys(T.LOOK).every((x) => x in sc.look) && Object.keys(sc.look).every((x) => x in T.LOOK), sc.look);
ok('scenes: Checker by default', Object.values(T.SCENES).every((sc) => sc.look.pattern === 'checker'));
check('the Landscape sheets scene: Im height and all sheets', [T.SCENES.logSheets.look.height, T.SCENES.logSheets.look.sheets], ['im', true]);
const stepOf = (c, i) => CH.find((x) => x.id === c).steps.find((x) => x.id === i);
// (v15: and opens the left panel, a drawer on a narrow desktop, or a phone's Tools sheet, where the list is)
ok('Your shapes switches to Select first, and its Try it says V', eq(stepOf('basics', 'shapes').before, [['tool', 'select'], ['panel', 'left', 'tools']]) && /\{V\}/.test(stepOf('basics', 'shapes').try.text));
ok('Patterns sets Checker first, so Choose Stretch can always tick', stepOf('views', 'patterns').before.some((a) => a[0] === 'look' && a[1].pattern === 'checker'));
ok('Patterns: the callout prefers below (away from the swatches and their tooltips)', stepOf('views', 'patterns').place === 'bottom');
check('Paths: toggled twice, so it ends on', stepOf('deform', 'paths').try.count, 2);
const an = CH.find((c) => c.id === 'analysis').steps.map((s) => s.id);
ok('Natural domain comes before Guarantees, which says what Step by step shows', an.indexOf('domain') < an.indexOf('guarantees') && /Step by step/.test(stepOf('analysis', 'guarantees').body) && !/Step by step/.test(stepOf('analysis', 'domain').body));
ok('the integral copy names the menu item of a closed curve', /\\oint F/.test(stepOf('analysis', 'integral').body) && !/Integrate/.test(stepOf('analysis', 'integral').body));
ok('no copy promises that squares stay square', steps.every((s) => !/squares? stay square/.test(s.body)));
check('domain copy by scene', [T.copyFor(stepOf('analysis', 'domain'), 'residueZp') !== stepOf('analysis', 'domain').body, T.copyFor(stepOf('analysis', 'domain'), 'residue')], [true, stepOf('analysis', 'domain').body]);
check('copyFor: touch first, then narrow, else the body', [T.copyFor({ body: 'b', narrow: 'n', touch: 't' }, null, { coarse: true, narrow: true }), T.copyFor({ body: 'b', narrow: 'n' }, null, { coarse: true, narrow: false }), T.copyFor({ body: 'b', narrow: 'n' }, null, { coarse: false, narrow: true }), T.copyFor({ body: 'b', narrow: 'n', touch: 't' }, null, { coarse: false, narrow: false })], ['t', 'n', 'n', 'b']);
// the preimages Try it: a probe inside the disc and one outside
const pio = T.probeInOut;
ok('probe: a bare event ticks', pio(undefined) === true && pio({ pane: 'R' }) === true);
ok('probe: X does not tick', pio({ pane: 'L', w: [0, 0] }) === false);
let mem = {};
ok('probe: inside only does not tick', pio({ pane: 'R', w: [0.3, 0.2] }, mem) === false && pio({ pane: 'R', w: { re: 0.1, im: 0 } }, mem) === false);
ok('probe: inside then outside ticks', pio({ pane: 'R', w: [0, 1.4] }, mem) === true);
mem = {};
ok('probe: outside then inside ticks', pio({ pane: 'R', w: [2, 0] }, mem) === false && pio({ pane: 'R', w: [0.5, 0] }, mem) === true);
ok('scenes: every step type has params', Object.values(T.SCENES).every((sc) => sc.steps.every((st) => typeof st.type === 'string' && st.params && typeof st.params === 'object')));
check('the zeros-and-poles scene needs the zp step', [T.SCENES.zp.needs, T.SCENES.zp.steps[0].type], ['zp', 'zp']);
const CHA = CH.find((c) => c.id === 'analysis'), CHE = CH.find((c) => c.id === 'edit');
const ixA = (id) => CHA.steps.findIndex((s) => s.id === id), ixE = (id) => CHE.steps.findIndex((s) => s.id === id);
check('the scene a step shows: its chapter scene, or the last scene action before it', ['targets', 'cauchy', 'integral', 'domain'].map((id) => T.sceneAt(CHA, ixA(id))), ['roots', 'roots', 'residueZp', 'residueZp']);
check('Editing: the strip, then zeros and poles, then the shared number', ['cards', 'inspector', 'zp', 'zpHere', 'numbers'].map((id) => T.sceneAt(CHE, ixE(id))), ['strip', 'strip', 'zp', 'zp', 'numbers']);
ok('the shared-number scene binds the circle to a', T.SCENES.numbers.params[0].name === 'a' && T.SCENES.numbers.shapes.some((sh) => sh.bind && sh.bind.r === 'a') && T.SCENES.numbers.needs === 'params');

// ---- copy markup
check('parse', T.parseCopy('Press {M} or $e^{z^2}$ **now**.'), [{ t: 'text', v: 'Press ' }, { t: 'kbd', v: 'M' }, { t: 'text', v: ' or ' }, { t: 'tex', v: 'e^{z^2}' }, { t: 'text', v: ' ' }, { t: 'b', v: 'now' }, { t: 'text', v: '.' }]);
check('parse mod', T.parseCopy('{mod}{K}'), [{ t: 'kbd', v: 'mod' }, { t: 'kbd', v: 'K' }]);
check('parse: braces inside TeX are TeX', T.parseCopy('$\\frac{1}{z}$'), [{ t: 'tex', v: '\\frac{1}{z}' }]);
check('parse +', T.parseCopy('Press {+}.'), [{ t: 'text', v: 'Press ' }, { t: 'kbd', v: '+' }, { t: 'text', v: '.' }]);
check('plain mod', T.plainCopy('Press {mod}{K}.', '⌘'), 'Press ⌘K.');
check('tex |Im z|<π/2', T.texPlain('|\\operatorname{Im} z|<\\pi/2'), '|Im z| < π/2');
check('tex frac', T.texPlain('F(z)=\\frac{e^z-1}{e^z+1}'), 'F(z) = (eᶻ-1)/(eᶻ+1)');
check('tex power', T.texPlain('z^3-1'), 'z³-1');
check('tex sub', T.texPlain('f_2\\circ f_1'), 'f₂∘ f₁');
check('tex neq pm', T.texPlain('z\\neq\\pm i'), 'z ≠ ±i');
check('tex oint', T.texPlain('\\oint=2\\pi i\\operatorname{Res}_i F=\\pi'), '∮ = 2π i Resᵢ F = π');
// two names written together keep a space (the screen-reader line read "Imlog z"; Russian «ImLn z»)
check('tex names apart', T.texPlain('\\operatorname{Im}\\log z'), 'Im log z');
check('tex names apart (Russian notation)', T.texPlain('\\operatorname{Im}\\operatorname{Ln} z'), 'Im Ln z');
check('tex name before a bracket or a subscript', T.texPlain('\\sin(z)+\\operatorname{Res}_i F'), 'sin(z)+Resᵢ F');
check('tex prime', T.texPlain("|F'(z)|"), "|F'(z)|");
check('tex set braces', T.texPlain('z\\notin\\{i,-i\\}'), 'z∉{i,-i}');
check('tex inverse', T.texPlain('f^{-1}'), 'f⁻¹');
ok('every step reads without a backslash', steps.every((s) => !/\\/.test(T.plainCopy(s.body + (s.try ? s.try.text : ''), 'Ctrl'))), steps.map((s) => T.plainCopy(s.body, 'Ctrl')).filter((x) => /\\/.test(x)));

// ---- placement
const vp = { w: 1440, h: 900 }, card = { w: 320, h: 180 };
const inside = (p, c, v) => p.x >= 0 && p.y >= 0 && p.x + c.w <= v.w && p.y + c.h <= v.h;
const hit = (p, c, h) => p.x < h.r && p.x + c.w > h.l && p.y < h.b && p.y + c.h > h.t;
check('null hole: centred', T.place(null, card, vp), { mode: 'center', side: null, x: 560, y: 360, caret: null });
let p = T.place({ l: 20, t: 100, r: 260, b: 600 }, card, vp, { prefer: 'right' });
check('room on the right', [p.mode, p.side, p.x], ['side', 'right', 274]);
ok('caret within the card', p.caret >= 18 && p.caret <= card.h - 18, p);
p = T.place({ l: 1200, t: 100, r: 1420, b: 300 }, card, vp, { prefer: 'right' });
check('no room on the right: left', [p.mode, p.side], ['side', 'left']);
p = T.place({ l: 300, t: 60, r: 1140, b: 120 }, card, vp, { prefer: 'bottom' });
check('prefer bottom', [p.mode, p.side, p.y], ['side', 'bottom', 134]);
p = T.place({ l: 300, t: 700, r: 1140, b: 880 }, card, vp, { prefer: 'bottom' });
check('no room below: another side', p.mode === 'side' && p.side !== 'bottom', true);
p = T.place({ l: 8, t: 50, r: 1432, b: 892 }, card, vp, { prefer: 'right' });
check('a hole as big as the screen: inset', p.mode, 'inset');
ok('inset inside the viewport', inside(p, card, vp), p);
// inset: the corner with the fewest controls (an options strip along the bottom left)
p = T.place({ l: 8, t: 50, r: 1432, b: 892 }, card, vp, { avoid: [{ l: 20, t: 820, r: 700, b: 870 }] });
ok('inset keeps clear of the controls', p.mode === 'inset' && !hit(p, card, { l: 20, t: 820, r: 700, b: 870 }), p);
p = T.place({ l: 8, t: 50, r: 1432, b: 892 }, card, vp, { avoid: () => [{ l: 20, t: 820, r: 1420, b: 870 }, { l: 20, t: 60, r: 400, b: 100 }] });
ok('inset: the avoid list may be a function', p.mode === 'inset' && p.x > 600 && p.y < 300, p);
// a stage-wide panel with room below (the Phase portrait): below it, the pointer at its middle
p = T.place({ l: 262, t: 38, r: 1142, b: 618 }, { w: 320, h: 200 }, vp, { prefer: 'bottom' });
check('a wide panel with room below: below it', [p.mode, p.side, p.y], ['side', 'bottom', 632]);
// the pointer aims at the anchor inside a lit panel (the Plane · Sphere control): the card centres on it
p = T.place({ l: 262, t: 38, r: 1142, b: 618 }, { w: 320, h: 200 }, vp, { prefer: 'bottom', point: { x: 350, y: 60 } });
check('point: the card centres on it, the caret points at it', [p.side, p.x, p.caret], ['bottom', 190, 160]);
// two lit areas: clear of both
const tools = { l: 2, t: 44, r: 264, b: 344 }, paneL = { l: 262, t: 38, r: 706, b: 618 };
p = T.place(tools, card, vp, { prefer: 'right', others: [paneL] });
ok('two areas: the card covers neither', p.mode === 'side' && !hit(p, card, tools) && !hit(p, card, paneL), p);
p = T.place({ l: 2, t: 450, r: 264, b: 730 }, card, vp, { prefer: 'right', others: [paneL] });
ok('two areas, the other in the way: beside both, no pointer', p.mode === 'side' && p.caret == null && p.x >= paneL.r, p);
// phone: sheets
p = T.place({ l: 16, t: 500, r: 374, b: 700 }, card, { w: 390, h: 844 });
check('phone: a sheet at the top when the hole is low', [p.mode, p.side], ['sheet', 'top']);
p = T.place({ l: 16, t: 80, r: 374, b: 300 }, card, { w: 390, h: 844 });
check('phone: a sheet at the bottom when the hole is high', [p.mode, p.side], ['sheet', 'bottom']);
p = T.place({ l: 6, t: 34, r: 384, b: 410 }, { w: 366, h: 220 }, { w: 390, h: 844 }, { others: [{ l: 2, t: 784, r: 388, b: 842 }] });
check('phone: a pane on top and the tools below: the sheet sits between them', [p.mode, p.side], ['sheet', 'middle']);
ok('phone: the middle sheet covers neither', !hit(p, { w: 366, h: 220 }, { l: 6, t: 34, r: 384, b: 410 }) && !hit(p, { w: 366, h: 220 }, { l: 2, t: 784, r: 388, b: 842 }), p);
// fuzz: the card never leaves the viewport, and beside or as a sheet it never covers a lit area when it need not
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let bad = 0, cover = 0, wide = 0;
const rect = (v, f = 0.9) => { const w = 20 + rnd() * v.w * f, h = 20 + rnd() * v.h * f, l = rnd() * (v.w - w), t = rnd() * (v.h - h); return { l, t, r: l + w, b: t + h }; };
for (let i = 0; i < 6000; i++) {
  const v = i % 5 === 4 ? { w: 320 + Math.round(rnd() * 300), h: 560 + Math.round(rnd() * 300) } : { w: 700 + Math.round(rnd() * 1300), h: 500 + Math.round(rnd() * 700) };
  const c = v.w < 640 ? { w: v.w - 24, h: 120 + Math.round(rnd() * 140) } : { w: 320, h: 120 + Math.round(rnd() * 140) };
  const hole = rect(v), others = i % 3 === 0 ? [rect(v, 0.4)] : [];
  const q = T.place(hole, c, v, { prefer: ['right', 'left', 'top', 'bottom'][i % 4], others });
  if (!inside(q, c, v)) bad++;
  if (q.mode === 'side' && [hole].concat(others).some((h) => hit(q, c, h))) cover++;
  if (v.w >= 640 && q.mode === 'sheet') wide++;
}
check('fuzz: inside the viewport', bad, 0);
check('fuzz: beside means not over', cover, 0);
check('fuzz: sheets only on narrow screens', wide, 0);

// ---- lit areas
let L = T.litAreas([{ l: 10, t: 10, r: 110, b: 40 }]);
check('one area', L, { holes: [{ l: 10, t: 10, r: 110, b: 40 }], mark: null });
L = T.litAreas([{ l: 20, t: 20, r: 120, b: 50 }, { l: 10, t: 10, r: 600, b: 400 }]);
check('the anchor inside a lit panel: one hole, the anchor marked', [L.holes, L.mark], [[{ l: 10, t: 10, r: 600, b: 400 }], { l: 20, t: 20, r: 120, b: 50 }]);
L = T.litAreas([{ l: 2, t: 44, r: 264, b: 344 }, { l: 262, t: 38, r: 706, b: 618 }]);
ok('touching areas are trimmed apart', L.holes.length === 2 && L.holes[0].r < L.holes[1].l && L.mark == null, L);
L = T.litAreas([{ l: 400, t: 600, r: 500, b: 700 }, { l: 0, t: 0, r: 100, b: 100 }]);
check('apart: unchanged, the anchor first', L.holes, [{ l: 400, t: 600, r: 500, b: 700 }, { l: 0, t: 0, r: 100, b: 100 }]);
L = T.litAreas([{ l: 0, t: 0, r: 100, b: 100 }, { l: 50, t: 0, r: 150, b: 100 }]);
check('mostly overlapping: merged', L.holes, [{ l: 0, t: 0, r: 150, b: 100 }]);
check('ms tokens', [T.ms('240ms', 0), T.ms('0.24s', 0), T.ms(' 0ms ', 9), T.ms('', 240), T.ms('fast', 240)], [240, 240, 0, 240, 240]);

// ---- the persisted record
const R = T.normRec;
check('fresh record', R(null), { v: 0, shown: 0, outcome: null, done: {}, last: null });
check('malformed record', R({ v: 'x', shown: null, outcome: 'maybe', done: 3, last: { ch: 4 } }), { v: 0, shown: 0, outcome: null, done: {}, last: null });
ok('fresh: suggest', T.shouldSuggest(R(null)));
ok('shown twice, ignored: suggest again', T.shouldSuggest(R({ shown: 2 })));
ok(`shown ${T.SUGGEST_MAX} times: never again`, !T.shouldSuggest(R({ shown: T.SUGGEST_MAX })));
ok('dismissed: never again', !T.shouldSuggest(R({ shown: 1, outcome: 'dismissed' })));
ok('taken: never again', !T.shouldSuggest(R({ shown: 1, outcome: 'taken' })));
ok('a chapter done (from the help menu): seen', T.seenRec(R({ done: { views: 1 } })) && !T.shouldSuggest(R({ done: { views: 1 } })));
ok('started from the help menu: seen', T.seenRec(R({ last: { ch: 'basics', i: 2 } })));
const basics = CH[0];
ok('done at its rev', T.chapterDone(R({ done: { basics: basics.rev } }), basics));
ok('done at an older rev is not done', !T.chapterDone(R({ done: { basics: basics.rev - 1 } }), basics));
ok('New only for users of an older version', T.chapterNew(R({ v: 0 }), Object.assign({}, basics, { rev: 2 })) === false && T.chapterNew(R({ v: 1 }), Object.assign({}, basics, { rev: 2 })) === true);

// ---- persistence through a fake localStorage (namespaced keys, the stash after a reload, broken storage)
const warn0 = console.warn; let warned = 0;
console.warn = () => { warned++; };   // the module reports broken storage on the console; counted, not printed
function fakeStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), _m: m };
}
const restored = [];
const api = { storageKey: (k) => `${k}:ns1`, restore: (s) => restored.push(s) };
global.localStorage = fakeStorage();
Tour.init(api);
ok('fresh storage: not seen', Tour.isSeen() === false);
check('fresh storage: nothing restored', restored.length, 0);
global.localStorage = fakeStorage({ 'cmw-tour-stash:ns1': JSON.stringify({ shapes: [1, 2], steps: ['exp'] }) });
Tour.init(api);
check('a tour cut short by a reload: the user\'s work is restored at init', restored, [{ shapes: [1, 2], steps: ['exp'] }]);
check('... and the stash is cleared', localStorage.getItem('cmw-tour-stash:ns1'), null);
global.localStorage = fakeStorage({ 'cmw-tour-stash': '{"x":1}' });
restored.length = 0; Tour.init(api);
check('another namespace\'s stash is left alone', [restored.length, localStorage.getItem('cmw-tour-stash')], [0, '{"x":1}']);
global.localStorage = fakeStorage({ 'cmw-tour:ns1': JSON.stringify({ v: 1, shown: 1, outcome: 'dismissed', done: {}, last: null }) });
Tour.init(api);
ok('dismissed in storage: seen', Tour.isSeen() === true);
ok('dismissed: the namespace without it is not seen', (() => { Tour.init({ storageKey: (k) => `${k}:other` }); return Tour.isSeen() === false; })());
Tour.init(api);
Tour.reset();
check('reset forgets the record', JSON.parse(localStorage.getItem('cmw-tour:ns1')), { v: 0, shown: 0, outcome: null, done: {}, last: null });
ok('reset: not seen', Tour.isSeen() === false);
global.localStorage = fakeStorage({ 'cmw-tour:ns1': '{not json', 'cmw-tour-stash:ns1': '{also not' });
let threw = false;
try { Tour.init(api); Tour.isSeen(); } catch (e) { threw = true; }
ok('malformed storage never throws', !threw);
global.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
threw = false;
try { Tour.init(api); Tour.isSeen(); Tour.reset(); } catch (e) { threw = true; }
ok('blocked storage never throws (the tour only forgets)', !threw);
global.localStorage = fakeStorage({ 'cmw-tour:ns1': JSON.stringify({ v: 1, shown: 0, outcome: null, done: { views: 1 }, last: null }) });
Tour.init(api);
check('chapters() reports done chapters', Tour.chapters().filter((c) => c.done).map((c) => c.id), ['views']);
// the first-run rules over a few openings: shown, ignored, shown again, up to the cap
let r = R(null), shows = 0;
for (let open = 0; open < 6; open++) if (T.shouldSuggest(r)) { shows++; r.shown++; }
check('ignored: shown on the first three openings only', shows, T.SUGGEST_MAX);
r = R(null); r.shown++; r.outcome = 'dismissed';
check('Not now on the first opening: never again', [1, 2, 3].filter(() => T.shouldSuggest(r)).length, 0);

// the stash written by a tour ({ page, snap }): restored once restore() takes it; a live tour of another page keeps it
const stashV = (snap, page = 'other') => JSON.stringify({ page, snap });
global.localStorage = fakeStorage({ 'cmw-tour-stash:ns1': stashV({ state: 'S' }), 'cmw-tour-live:ns1': JSON.stringify({ page: 'other', t: Date.now() }) });
restored.length = 0; Tour.init(api);
check('another page\'s live tour: its stash is left alone', [restored.length, !!localStorage.getItem('cmw-tour-stash:ns1')], [0, true]);
global.localStorage = fakeStorage({ 'cmw-tour-stash:ns1': stashV({ state: 'S' }), 'cmw-tour-live:ns1': JSON.stringify({ page: 'other', t: Date.now() - 60000 }) });
restored.length = 0; Tour.init(api);
check('a stale heartbeat (the page closed or crashed): the stash is restored and cleared', [restored, localStorage.getItem('cmw-tour-stash:ns1'), localStorage.getItem('cmw-tour-live:ns1')], [[{ state: 'S' }], null, null]);
global.localStorage = fakeStorage({ 'cmw-tour-stash:ns1': stashV({ state: 'S' }) });
Tour.init({ storageKey: api.storageKey, restore: () => { throw new Error('cannot'); } });
ok('a restore that throws keeps the stash', !!localStorage.getItem('cmw-tour-stash:ns1'));
Tour.init({ storageKey: api.storageKey, restore: () => false });
ok('a restore that returns false keeps the stash', !!localStorage.getItem('cmw-tour-stash:ns1'));
Tour.init({ storageKey: api.storageKey });
ok('no restore in the adapter: the stash waits for one that has it', !!localStorage.getItem('cmw-tour-stash:ns1'));
Tour.init(api); Tour.reset();
restored.length = 0;
global.localStorage = fakeStorage({ 'cmw-tour-stash:ns1': stashV({ state: 'S' }), 'cmw-tour:ns1': JSON.stringify({ v: 1, shown: 1, outcome: 'taken', done: {}, last: null }) });
Tour.reset();
ok('reset forgets the record but never drops a backup of the user\'s work', !!localStorage.getItem('cmw-tour-stash:ns1') && !Tour.isSeen());

console.warn = warn0;
ok('broken storage is reported on the console', warned >= 2, warned);

// ---- features the build lacks (api.has) and the step order
Tour.init({ has: (f) => !['zp', 'allAtOnce'].includes(f) });
const ai = CH.findIndex((c) => c.id === 'analysis'), di = CH.findIndex((c) => c.id === 'deform'), ei = CH.findIndex((c) => c.id === 'edit');
ok('the zeros-and-poles step is absent without the zp feature', T.absent(ei, CH[ei].steps.findIndex((s) => s.id === 'zp')));
ok('Add a zero here is absent without the zp feature (its scene)', T.absent(ei, CH[ei].steps.findIndex((s) => s.id === 'zpHere')));
ok('Shared numbers is not absent without zp (its own scene)', !T.absent(ei, CH[ei].steps.findIndex((s) => s.id === 'numbers')));
ok('All at once is absent without it', T.absent(di, CH[di].steps.findIndex((s) => s.id === 'order')));
ok('a step after the zp scene is not absent (it loads its own scene)', !T.absent(ai, CH[ai].steps.findIndex((s) => s.id === 'integral')));
Tour.init({});
ok('no api.has: nothing is absent', !T.absent(ei, CH[ei].steps.findIndex((s) => s.id === 'zp')));
Tour.init({ has: (f) => !['params', 'planeMenu'].includes(f) });
ok('without Params or the planes\' menu their steps are absent', T.absent(ei, CH[ei].steps.findIndex((s) => s.id === 'numbers')) && T.absent(ei, CH[ei].steps.findIndex((s) => s.id === 'zpHere')) && !T.absent(ei, CH[ei].steps.findIndex((s) => s.id === 'inspector')));
Tour.init({ has: () => { throw new Error('x'); } });
ok('a throwing api.has: nothing is absent', !T.absent(ai, 1));
check('seek next within a chapter', T.seek(0, 1, 1), { ci: 0, si: 1 });
check('seek past a chapter end', T.seek(0, basics.steps.length, 1), { ci: 1, si: 0 });
check('seek back into the previous chapter', T.seek(1, -1, -1), { ci: 0, si: basics.steps.length - 1 });
check('seek before the start', T.seek(0, -1, -1), null);
check('seek after the end', T.seek(CH.length - 1, CH[CH.length - 1].steps.length, 1), null);
check('seek skips absent steps forward', T.seek(0, 2, 1, (ci, si) => ci === 0 && (si === 2 || si === 3)), { ci: 0, si: 4 });
check('seek skips absent steps backward across a chapter', T.seek(1, -1, -1, (ci, si) => ci === 0 && si === basics.steps.length - 1), { ci: 0, si: basics.steps.length - 2 });
check('seek: a whole chapter absent', T.seek(4, 0, 1, (ci) => ci === 4), { ci: 5, si: 0 });
Tour.init({ has: (f) => f !== 'zp' });
check('without zp the integral and its domain fall back to the typed residue scene', [T.sceneAt(CH[ai], CH[ai].steps.findIndex((s) => s.id === 'integral')), T.pickScene(['residueZp', 'residue'])], ['residue', 'residue']);
// without a way to put the user's work back, only the steps that change nothing are shown
const noScene = steps.filter((s, k) => { const ci = CH.findIndex((c) => c.id === s.ch), si = CH[ci].steps.findIndex((x) => x.id === s.id); return !T.absent(ci, si, false); }).map((s) => `${s.ch}/${s.id}`);
check('no scenes: only the steps that borrow nothing', noScene, ['export/figure', 'keys/palette', 'keys/sound', 'keys/help']);
Tour.init({ has: (f) => f !== 'sound' });
ok('the Sound step is absent without the Sound control', T.absent(CH.length - 1, CH[CH.length - 1].steps.findIndex((s) => s.id === 'sound')));
Tour.init({});

// ---- review fixes: the copy of a control found in the ⋯ menu; layout-only steps; place()'s near miss is not 'side'
check('copyFor: the ⋯ menu fallback says "in this menu" first', [T.copyFor({ body: 'b', narrow: 'n', touch: 't' }, null, { coarse: true, narrow: true, menu: true }), T.copyFor({ body: 'b', touch: 't' }, null, { coarse: true, menu: true })], ['n', 't']);
// (v15: no longer wide-only: on a phone Y's options, with the Phase key, are in the Display sheet the step opens)
ok('views/key opens the Display sheet on a phone (Y large)', !stepOf('views', 'key').wide && JSON.stringify(stepOf('views', 'key').before).includes('["panel","sheet","display"]') && JSON.stringify(stepOf('views', 'key').before).includes('["plane","R"]'));
ok('basics/shapes asks its Try it on wide screens only', stepOf('basics', 'shapes').tryWide === true);
{
  const q = T.place({ l: 700, t: 38, r: 1142, b: 618 }, { w: 320, h: 288 }, { w: 1440, h: 900 }, { prefer: 'bottom', others: [{ l: 262, t: 38, r: 700, b: 618 }] });
  check('place: a card 6 px too tall for the room below sits at the bottom edge, over the rim only', [q.mode, q.y + 288 <= 900 - 12, q.y >= 618 - 0.12 * 288], ['edge', true, true]);
}
// ---- the module without a DOM
ok('no DOM: suggest is a no-op', Tour.suggest() === false);
ok('API surface', ['init', 'start', 'stop', 'next', 'back', 'suggest', 'dismissSuggestion', 'isSeen', 'isActive', 'current', 'openHelpMenu', 'closeHelpMenu', 'chapters', 'reset'].every((k) => typeof Tour[k] === 'function'));
check('chapters()', Tour.chapters().map((c) => c.id), CH.map((c) => c.id));
ok('VERSION', Number.isInteger(Tour.VERSION) && Tour.VERSION >= 1);

console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
