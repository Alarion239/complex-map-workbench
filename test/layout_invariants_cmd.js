// Layout invariants (#470): the page's boxes checked with no one looking (test/lib/layout.js): no two controls or text
// boxes overlap, no control is covered, the boxes meant to be centred are, no text is cut, nothing leaves the viewport,
// targets are big enough (24 px with a mouse, 44 px on touch), focus rings show and are not cut, rows meant to be even
// are. Over the matrix of test/lib/layout_matrix.js: phones 360/390/412 portrait, 740×360 and 915×412 landscape,
// desktops 1024/1280/1440; en, ru, it; light and dark; the classic view and ?view=steps (where the build has it); the
// main states (each view, the deformation, the menus, the Inspector, the tour strip, the export dialog, the phone's
// sheets). One page load per language, view and kind of device; the sizes, states and themes change in it.
// A violation is keyed by its boxes' structure (test/lib/layout.js key()), not their words: one bug in three languages
// and four sizes is one row, seen at n points. DECLARED lists the violations that are meant, each with its reason; the
// rest are the report. LAYOUT_CFG.mode 'report' passes and reports; 'gate' fails on a key that ci/layout_baseline.json
// does not have for this run (LAYOUT_CFG.label): the rows only go down, like ci/lint_ratchet.js (ci/layout_ratchet.js
// writes the baseline). The points a row is seen at are reported, not gated: on software GL they vary by one or two.
// A marked screenshot of each row's first point goes to shots/ (the violation red, the other box blue).
// A preamble sets LAYOUT_CFG (ci/browser_suites.js): { langs, views, devices, themes, sizes, states, mode, shots }.
// A command file for a CDP daemon (test/cdp_kit README).
const CFG = Object.assign({ langs: ['en', 'ru', 'it'], views: ['classic', 'steps'], devices: ['phone', 'desktop'], themes: ['light', 'dark'], mode: 'report', shots: 40 },
  typeof LAYOUT_CFG !== 'undefined' ? LAYOUT_CFG : {});
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LIB = fs.readFileSync(path.join(DIR, '..', 'lib', 'layout.js'), 'utf8');
const M = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'layout_matrix.js'), 'utf8'));
const BASELINE = (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, '..', '..', 'ci', 'layout_baseline.json'), 'utf8')); } catch (e) { return null; } })();

// The violations that are meant: check, key (a RegExp on the key), okey (on the other box's key), why. A row here is a
// design decision, which ux reviews (#470)
const DECLARED = [
  { check: 'overlap', key: /^#secShapes summary$/, okey: /button#clearShapes/, why: 'Clear sits at the end of the Shapes heading row, which is the whole <summary> (the heading is a disclosure)' },
  { check: 'overlap', key: /#pipeline button\.conn-add|div#chainOpt\d|button#addStepBtn/, okey: /#pipeline button\.conn-add|div#chainOpt\d|button#addStepBtn/, why: 'the + between two chain cards sits on the gap and overlaps each card\'s edge by 4 px, as a connector' },
  { check: 'overlap', key: /input#i\d+_\w+\.inp/, okey: /button\.icon-btn\.argand/, why: 'the Argand button is an adornment inside its number field (the field\'s right padding leaves it room)' },
  { check: 'overlap', key: /#svStrip div\.sv-thumb/, okey: /#svStrip button\.sv-plane/, why: 'the steps view\'s ring sits on the shown plane\'s dot (between two when parked), ux\'s layer table: the ring over the track' },
  { check: 'focus-ring', key: /^input#palInput/, why: 'the palette\'s search field is the only field of its layer and always has the focus while it is open: the caret shows it' },
];
const declared = (v) => DECLARED.find((d) => d.check === v.check && d.key.test(v.key) && (!d.okey || d.okey.test(v.okey || '')));

// a marked screenshot: the violation's box red, the other one blue
let nShots = 0;
async function markShot(name, v) {
  if (nShots >= CFG.shots || !v.box) return null;
  nShots++;
  await ev(`(() => { const d = document.createElement('div'); d.id = '__lmark'; d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    for (const [b, c] of [[${JSON.stringify(v.box)}, '#e00'], [${JSON.stringify(v.obox || null)}, '#06f']]) { if (!b) continue; const x = document.createElement('div');
      x.style.cssText = 'position:absolute;left:' + (b.l - 2) + 'px;top:' + (b.t - 2) + 'px;width:' + (b.r - b.l + 4) + 'px;height:' + (b.b - b.t + 4) + 'px;outline:2px solid ' + c + ';background:' + c + '22'; d.append(x); }
    document.body.append(d); return 1; })()`);
  const f = await shot(name.replace(/[^\w.-]+/g, '_'));
  await ev(`document.getElementById('__lmark')?.remove(), 1`);
  return path.basename(f);
}

const rows = new Map();   // id -> { check, key, okey, el, other, detail, n, where: [], shot }
const meant = new Map();  // DECLARED index -> points
const fails = [], info = { points: 0 };
const t0 = Date.now();
info.skipped = await M.walk(CFG, `http://localhost:${PORT}/test.html`, async (p) => {
  const where = `${p.lang} ${p.view} ${p.size.id} ${p.theme} ${p.state}`;
  // (the focus rings once a state, last: they move the focus)
  const vs = await ev(`__layout.all({ touch: ${p.dev === 'phone'}, focus: ${p.last} })`);
  if (!Array.isArray(vs)) { fails.push(`${where}: the checks threw ${JSON.stringify(vs)}`); return; }
  info.points++;
  for (const v of vs) {
    const d = declared(v);
    if (d) { const i = DECLARED.indexOf(d); meant.set(i, (meant.get(i) || 0) + 1); continue; }
    const id = `${v.check} ${v.key}${v.okey ? ' × ' + v.okey : ''}`;
    let r = rows.get(id);
    if (!r) {
      r = { check: v.check, key: v.key, okey: v.okey, el: v.el, other: v.other, detail: v.detail, n: 0, where: [] };
      if (CFG.shots) r.shot = await markShot(`${rows.size}-${v.check}-${p.lang}-${p.view}-${p.size.id}-${p.theme}-${p.state}`, v);
      rows.set(id, r);
    }
    r.n++;
    if (r.where.length < 6) r.where.push(where);
  }
});
// (a size the matrix lists and the page never took fails the run: phone's lesson on #474)
for (const sk of info.skipped) if (/NOT RENDERED/.test(sk)) fails.push(sk);
const report = [...rows.entries()].map(([id, r]) => Object.assign({ id }, r)).sort((a, b) => a.check.localeCompare(b.check) || b.n - a.n);
info.ms = Date.now() - t0;
info.counts = {};
for (const r of report) info.counts[r.check] = (info.counts[r.check] || 0) + 1;
info.declared = DECLARED.map((d, i) => ({ check: d.check, key: String(d.key), why: d.why, n: meant.get(i) || 0 }));
// the gate: no key this run's baseline lacks; the keys it has and the run did not see are fixed (lower the baseline)
const label = CFG.label || CFG.langs.join('+');
const B = BASELINE && BASELINE.runs && BASELINE.runs[label];
if (B) info.fixed = Object.keys(B).filter((k) => !rows.has(k));
if (CFG.mode === 'gate') {
  if (!B) fails.push(`gate: ci/layout_baseline.json has no run ${label}`);
  else for (const r of report) if (!(r.id in B)) fails.push(`new layout violation: ${r.id} (${r.el}${r.other ? ' × ' + r.other : ''}) at ${r.where[0]} ${JSON.stringify(r.detail)}${r.shot ? ' (shots/' + r.shot + ')' : ''}`);
}
return { pass: fails.length === 0, fails, mode: CFG.mode, label, info, report };
