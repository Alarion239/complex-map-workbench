// Reviewer scratch (skeptical verifier): pull commit(), restore(), toast() and the undoBtn
// click handler verbatim out of src/app.js, run them against minimal stubs, and replay
// (a) delete -> bypass -> toast Undo, (b) delete -> Cmd+Z -> toast Undo.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app.js'), 'utf8');
const grab = (re) => { const m = src.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const commitSrc = grab(/function commit\(\) \{[\s\S]*?\n  \}/);
const restoreSrc = grab(/function restore\(s\) \{[\s\S]*?\n  \}/);
const toastSrc = grab(/function toast\(msg, actionLabel, action\) \{[\s\S]*?\n  \}/);
const undoSrc = grab(/\$\('undoBtn'\)\.addEventListener\('click', \(\) => \{ if \(hi > 0\) \{ hi--; restore\(hist\[hi\]\); \} \}\);/);
const delSrc = grab(/function deleteShape\(id\) \{[\s\S]*?\n  \}/);
const bypSrc = grab(/onclick: \(e\) => \{ stop\(e\); st\.on = st\.on === false; chainChanged\(true\); commit\(\); if \(st\.on\) startTransition\(k\); \}/);

// --- minimal DOM stubs ---
function El(tag) { this.tag = tag; this.kids = []; this.listeners = {}; this.parent = null; this.disabled = false; }
El.prototype.append = function (...k) { for (const c of k) { if (c instanceof El) c.parent = this; this.kids.push(c); } };
El.prototype.remove = function () { if (this.parent) { this.parent.kids = this.parent.kids.filter((x) => x !== this); this.parent = null; } };
El.prototype.addEventListener = function (t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); };
El.prototype.click = function () { (this.listeners.click || []).forEach((f) => f({})); if (this.onclick) this.onclick({}); };
Object.defineProperty(El.prototype, 'innerHTML', { set() { this.kids.forEach((k) => { k.parent = null; }); this.kids = []; } });
const els = { undoBtn: new El('button'), redoBtn: new El('button'), toastHost: new El('div') };
const $ = (id) => els[id];
const h = (tag, attrs, ...kids) => { const e = new El(tag); if (attrs) { if (attrs.onclick) e.onclick = attrs.onclick; e.cls = attrs.class; } kids.forEach((k) => { if (typeof k === 'string') e.text = k; else if (k) { e.append(k); } }); if (kids[0] && kids[0].text) e.text = kids[0].text; return e; };
const performance = { now: () => 0 };
const timers = []; const setTimeout = (f) => { timers.push(f); return timers.length; }; const clearTimeout = () => {};
const S = { shapes: [{ id: 's1', name: 'Formula 1' }, { id: 's2', name: 'Line 1' }, { id: 's3', name: 'z0' }], steps: [{ type: 'exp', on: true }], nextId: 4, focus: 0 };
let selected = null;
let hist = [], hi = -1;
const snap = () => JSON.stringify({ shapes: S.shapes, steps: S.steps, nextId: S.nextId });
const chainChanged = () => {}, shapesChanged = () => {}, save = () => {}, dropShapeGPU = () => {}, stop = () => {}, startTransition = () => {};
function updateUndo() { $('undoBtn').disabled = hi <= 0; $('redoBtn').disabled = hi >= hist.length - 1; }
eval(commitSrc.replace('function commit', 'var commit = function'));
eval(restoreSrc.replace('function restore', 'var restore = function'));
eval(toastSrc.replace('function toast', 'var toast = function'));
eval(delSrc.replace('function deleteShape', 'var deleteShape = function'));
eval(undoSrc);
const st = S.steps[0]; const k = 1;
const bypass = eval('({' + bypSrc + '})').onclick;

const state = () => JSON.stringify({ shapes: S.shapes.map((s) => s.name), f1on: S.steps[0] ? S.steps[0].on : null, hi });
const toastBtn = () => { const t = els.toastHost.kids[0]; return t && t.kids.find((c) => c.cls === 'toast-act'); };

// (a)
commit();
console.log('(a) initial          ', state());
deleteShape('s1');
console.log('(a) after delete     ', state(), 'toast visible:', !!toastBtn());
bypass({});
console.log('(a) after bypass     ', state(), 'toast still visible:', !!toastBtn());
toastBtn().click();
console.log('(a) after toast Undo ', state());

// (b) fresh history: add-shape commit, then delete, then Cmd+Z, then toast Undo
S.shapes = [{ id: 's1', name: 'Formula 1' }]; S.steps = [{ type: 'exp', on: true }]; hist = []; hi = -1; els.toastHost.innerHTML = '';
commit();
S.shapes.push({ id: 's2', name: 'Line 1' }); commit(); // user drew Line 1
console.log('(b) after drawing    ', state());
deleteShape('s1');
console.log('(b) after delete     ', state());
$('undoBtn').click(); // Cmd+Z
console.log('(b) after Cmd+Z      ', state(), 'toast still visible:', !!toastBtn());
toastBtn().click();
console.log('(b) after toast Undo ', state(), '<- Line 1 creation was undone too');
