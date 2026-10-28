// Reviewer scratch: extracts the undo history logic (commit / restore / undoBtn handler)
// and the toast action wiring verbatim from src/app.js and replays the reported sequence.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app.js'), 'utf8');
const grab = (re) => { const m = src.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const commitSrc = grab(/function commit\(\) \{[\s\S]*?\n  \}/);
const toastDel = grab(/toast\('Shape deleted\.', 'Undo', \(\) => \$\('undoBtn'\)\.click\(\)\);/);
const byp = grab(/onclick: \(e\) => \{ stop\(e\); st\.on = st\.on === false; chainChanged\(true\); commit\(\);/);
console.log('commit():\n' + commitSrc);
console.log('deleteShape toast:', toastDel);
console.log('bypass onclick:', byp);

const S = { shapes: [{ id: 1, name: 'Formula 1' }, { id: 2, name: 'Line 1' }, { id: 3, name: 'z0' }], steps: [{ type: 'exp', on: true }], nextId: 4 };
let hist = [], hi = -1;
const snap = () => JSON.stringify({ shapes: S.shapes, steps: S.steps, nextId: S.nextId });
function updateUndo() {}
function save() {}
// eslint-disable-next-line no-eval
eval(commitSrc.replace('function commit', 'var commit = function'));
function restore(s) { const o = JSON.parse(s); S.shapes = o.shapes; S.steps = o.steps; S.nextId = o.nextId; }
const undoClick = () => { if (hi > 0) { hi--; restore(hist[hi]); } };
const state = () => ({ shapes: S.shapes.map((s) => s.name), f1on: S.steps[0].on });

commit();
console.log('initial', state());
S.shapes = S.shapes.filter((s) => s.id !== 1); commit();
const toastAction = () => undoClick(); // what `() => $('undoBtn').click()` does
console.log('after delete', state());
const st = S.steps[0]; st.on = st.on === false; commit();
console.log('after bypass', state());
toastAction();
console.log('after toast Undo', state());
