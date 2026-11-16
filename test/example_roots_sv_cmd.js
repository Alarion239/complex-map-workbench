// The example "Roots as preimages" in the steps view (#1701): its point and circle are shapes of plane w₁, not classic targets,
// so on w₁ the point is drawn where it is and can be dragged, and its preimages (the cube roots of unity) show on z:
//  - the example's shapes hold a point and a circle drawn on w₁ (stage 1) and no classic target;
//  - dragging the point on w₁ moves it (the plane does not pan);
//  - the Try line ("on w₁, drag the point at 0, then press ‹") stays open after the drag and closes at the plane change to z.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const lane = () => ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return l ? l.textContent : null; })()`);
await view(1280, 800, false, false);
await go(`http://localhost:${PORT}/gl-helpers.html`);
await go(`http://localhost:${PORT}/test.html?ns=exroots${Date.now()}&lang=en&view=steps`);
await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && typeof __cmwShapes === 'function'` });
await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
// (the example's index: the one whose button label is its name)
const EXAMPLE = await ev(`(() => { for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && l.textContent === 'Roots as preimages') return i; } return -1; })()`);
ok('the example is in the guide', EXAMPLE >= 0, EXAMPLE);
await ev(`__cmwExample(${EXAMPLE}), 1`);
await adopted();
const got = await ev(`(() => { const d = __cmwShapes(); return { shapes: d.shapes.map((s) => ({ kind: s.kind, stage: s.stage || 0, p: s.p, c: s.c, r: s.r })), targets: d.targets.length }; })()`);
info.shapes = got;
const pt = got.shapes.findIndex((s) => s.kind === 'point' && s.stage === 1);
ok('a point drawn on w₁ is among the example\'s shapes', pt >= 0, got);
ok('a circle drawn on w₁ is among them', got.shapes.some((s) => s.kind === 'circle' && s.stage === 1), got);
ok('the example has no classic target', got.targets === 0, got.targets);
await settled({ max: 20000, until: `!!document.querySelector('.tour-lane[data-lane="example"]')` });
const hint = await lane();
info.hint = hint;
ok('the example\'s Try line is there and is for w₁', !!hint && /w₁/.test(hint), hint);
await ev(`__cmwSteps({ go: 1, now: true }); 1`);
await settled({ max: 20000, until: `!__cmwSteps().anim` });
const at = await ev(`__cmwPlaneMenu().w2s('L', 0, 0)`);
const before = await ev(`JSON.stringify(__cmwShapes().shapes.filter((s) => s.kind === 'point').map((s) => s.p))`);
await drag(at[0], at[1], at[0] + 70, at[1] - 50, 12, 16);
await sleep(300);
const after = await ev(`JSON.stringify(__cmwShapes().shapes.filter((s) => s.kind === 'point').map((s) => s.p))`);
info.moved = { before, after };
ok('dragging the point on w₁ moves it', before !== after, { before, after });
ok('the Try line stays open until the plane changes', !!(await lane()), await lane());
await ev(`(() => { const b = document.querySelector('#svStrip .sv-prev'); if (b) b.click(); return !!b; })()`);
const closed = await settled({ max: 20000, only: true, until: `!document.querySelector('.tour-lane[data-lane="example"]')` });
ok('pressing ‹ after the drag closes the Try line', closed.ok, await lane());
return { pass: fails.length === 0, fails, info };
