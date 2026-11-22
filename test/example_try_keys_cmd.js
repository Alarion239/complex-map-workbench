// A drag Try from the keyboard alone: in the steps view "Roots as preimages" asks "on w₁, drag the point at 0, then press ‹". With the
// point (a shape of plane w₁) selected from its row in the Shapes list (Enter) and the arrow keys nudging it, the first half of the line is done as it is after a
// mouse drag (the tour's shape-moved event, on the plane w), so the line closes at ‹; without the nudge, ‹ alone leaves it open.
// The keys' own contract on that plane: one arrow press is one step of the grid the plane shows (the w₁ plane shows about ±3.5
// with a grid of 1), the toast the run ends with names the point as its row does and gives its place, the shortcuts list names
// ↑ ↓ and Shift, and a value typed into the Inspector's w field is a move too (the screen-reader route: the row's arrow keys
// stay with the reader in browse mode).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const SETTLE_MS = 60000;
const lane = () => ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return l ? l.textContent : null; })()`);
const names = exampleNames();
const EXAMPLE = names.indexOf('Roots as preimages');
if (EXAMPLE < 0) throw new Error('example_try_keys: the example Roots as preimages is not in the guide');
await view(1280, 800, false, false);
// the example opened on the plane w₁ with its Try line showing
const open = async (tag) => {
  await nav(`http://localhost:${PORT}/test.html?ns=trykeys${tag}${Date.now()}&view=steps`);
  await settled({ max: SETTLE_MS, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!document.querySelector("#svStrip")' });
  await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
  await ev(`__cmwExample(${EXAMPLE}); 1`);
  await settled({ max: SETTLE_MS, until: `!!document.querySelector('.tour-lane[data-lane="example"]')` });
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: SETTLE_MS, until: '__cmwSteps().i === 1 && !__cmwSteps().moving' });
  // (the example's own opening is not the user's doing: its watch ignores the first 250 ms)
  await settled({ only: true, floor: 300, max: SETTLE_MS });
};
// the point at 0's row in the Shapes list (a role=button, focusable): focus it, as Tab does, and press Enter (ROW: set once the example
// is open, from the id of its point on w₁)
let ROW = '';
const where = () => ev(`(() => { const r = ${ROW}; return r ? { pressed: r.getAttribute('aria-pressed'), at: r.querySelector('.d').getAttribute('title') } : null; })()`);
const prev = `document.querySelector('#svStrip .sv-prev')`;
// ‹, as Enter on the focused button does
const pressPrev = async () => {
  ok('‹ is there', await ev(`(() => { const b = ${prev}; if (!b) return false; b.focus(); return document.activeElement === b; })()`), null);
  await key('Enter'); await settled({ max: SETTLE_MS, until: '__cmwSteps().i === 0 && !__cmwSteps().moving' });
};

// with the point selected from its row and nudged by the arrows, ‹ closes the line (a mouse drag then ‹ does)
await open('a');
ok('the Try line is open on w₁', /drag the point at 0/.test((await lane()) || ''), await lane());
const pid = await ev(`(() => { const s = __cmwShapes().shapes.find((x) => x.kind === 'point' && (x.stage | 0) === 1); return s ? s.id : null; })()`);
ok('the example has a point on w₁', !!pid, pid);
ROW = `document.querySelector('#shapeList .shape[data-id=${JSON.stringify(pid)}] .shape-name')`;
const w0 = await where();
ok('the point at 0 has its row', !!w0, w0);
await ev(`${ROW}.focus(); 1`);
await key('Enter'); await settled({ only: true, max: SETTLE_MS, until: `${ROW}.getAttribute('aria-pressed') === 'true'` });
info.selected = await where();
ok('Enter on the focused row selects the point', info.selected && info.selected.pressed === 'true', info.selected);
const target = () => ev(`(() => { const t = __cmwShapes().shapes.find((x) => x.id === ${JSON.stringify(pid)}); return t ? t.p : null; })()`);
const p0 = await target();
await key('ArrowRight'); await settled({ only: true, max: SETTLE_MS, until: `${ROW}.querySelector('.d').getAttribute('title') !== ${JSON.stringify(w0 && w0.at)}` });
info.nudged = await where();
// (one step of the plane shown: the finest grid tier it draws, at most 1 here, so the point stays inside the plane's ±3.5)
const p1 = await target();
info.step = p0 && p1 ? [p1[0] - p0[0], p1[1] - p0[1]] : null;
const st = info.step ? info.step[0] : 0;
ok('one → moves the point by the grid step of the plane shown, not off the plane', info.step && st > 0 && st <= 1 && Math.abs(info.step[1]) < 1e-9, { p0, p1 });
await key('ArrowUp'); await key('ArrowUp', 8);
const p2 = await target();
ok('↑ is one step and Shift ↑ ten', p2 && Math.abs(p2[1] - p1[1] - 11 * st) < 1e-9, { p1, p2 });
await key('ArrowDown', 8); await key('ArrowDown');
// (the toast of the settled run: the row's name for the point, and the point's place)
const rowName = await ev(`(() => { const r = ${ROW}; const k = r && r.querySelector('.k'); return k ? k.textContent.trim() : null; })()`);
const said = await ev(`new Promise((res) => { const t0 = performance.now(), want = ${JSON.stringify(p1)}; let last = null; const f = () => { for (const x of document.querySelectorAll('#toastHost .toast')) { const t = x.textContent, m = /^Moved (.+) to (-?[\\d.]+), (-?[\\d.]+)[.]$/.exec(t); if (/^Moved /.test(t)) last = t; if (m && Math.abs(+m[2] - want[0]) < 1e-3 && Math.abs(+m[3] - want[1]) < 1e-3) return res(t); } if (performance.now() - t0 > 6000) res(last); else setTimeout(f, 50); }; f(); })`);
info.said = { rowName, said };
ok('the toast names the point as its row does, with its place', !!said && !!rowName && (() => { const m = /^Moved (.+) to (−?[\d.]+) ([+−]) ([\d.]+)i[.]$/.exec(said || ''); const q = [p1[0], p1[1]]; return !!m && m[1] === rowName && Math.abs(+m[2].replace('−', '-') - q[0]) < 1e-3 && Math.abs((m[3] === '−' ? -1 : 1) * +m[4] - q[1]) < 1e-3; })(), info.said);
ok('the arrow key nudges the selected point (its place changes)', info.nudged && w0 && info.nudged.at !== w0.at, { w0, nudged: info.nudged });
ok('the line stays open until ‹ (the line has two halves)', !!(await lane()), await lane());
await pressPrev();
ok('keys only: the nudge and ‹ close the line, as a mouse drag and ‹ do', !(await lane()), await lane());

// the shortcuts list says ↑ ↓ and Shift for the nudge
await ev(`(document.querySelector('.modal-bg') || { remove() {} }).remove(); __tourApi.openGuide(); 1`);
const nudgeRow = await ev(`(() => { const r = [...document.querySelectorAll('.modal-bg tr, .modal-bg .kbd-row, .modal-bg li')].find((x) => /nudge/i.test(x.textContent)); return r ? r.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
info.nudgeRow = nudgeRow;
ok('Keyboard shortcuts names ↑ ↓ and Shift for the nudge', !!nudgeRow && /↑/.test(nudgeRow) && /↓/.test(nudgeRow) && /⇧|Shift/.test(nudgeRow), nudgeRow);
await ev(`(document.querySelector('.modal-bg') || { remove() {} }).remove(); 1`);

// the Inspector's w field: a committed value is a move, and with ‹ it closes the line (no arrow key, no drag)
await open('c');
await ev(`${ROW}.focus(); 1`);
await key('Enter'); await settled({ only: true, max: SETTLE_MS, until: `${ROW}.getAttribute('aria-pressed') === 'true'` });
// (the Inspector opens for the selection a moment after the row's press: wait for its field)
await settled({ only: true, max: SETTLE_MS, until: `!!document.querySelector('.sh-insp .field.cxf input')` });
const typed = await ev(`(() => { const i = document.querySelector('.sh-insp .field.cxf input'); if (!i) return false; i.focus(); i.value = '1+0.5i'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
ok('the Inspector has the w field for the selected point', typed, typed);
ok('the typed value moved the point', JSON.stringify(await target()) === JSON.stringify([1, 0.5]), await target());
await pressPrev();
ok('a committed w value closes the line with ‹, as a drag does', !(await lane()), await lane());

// control: ‹ alone leaves the line open
await open('b');
await pressPrev();
ok('control: ‹ alone leaves the line open', !!(await lane()), await lane());
return { pass: fails.length === 0, fails, info };
