// A drag Try from the keyboard alone: in the steps view "Roots as preimages" asks "on w₁, drag the point at 0, then press ‹". With the
// point (a shape of plane w₁) selected from its row in the Shapes list (Enter) and the arrow keys nudging it, the first half of the line is done as it is after a
// mouse drag (the tour's shape-moved event, on the plane w), so the line closes at ‹; without the nudge, ‹ alone leaves it open.
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
await key('ArrowRight'); await settled({ only: true, max: SETTLE_MS, until: `${ROW}.querySelector('.d').getAttribute('title') !== ${JSON.stringify(w0 && w0.at)}` });
info.nudged = await where();
ok('the arrow key nudges the selected point (its place changes)', info.nudged && w0 && info.nudged.at !== w0.at, { w0, nudged: info.nudged });
ok('the line stays open until ‹ (the line has two halves)', !!(await lane()), await lane());
await pressPrev();
ok('keys only: the nudge and ‹ close the line, as a mouse drag and ‹ do', !(await lane()), await lane());

// control: ‹ alone leaves the line open
await open('b');
await pressPrev();
ok('control: ‹ alone leaves the line open', !!(await lane()), await lane());
return { pass: fails.length === 0, fails, info };
