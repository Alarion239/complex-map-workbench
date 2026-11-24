// The layout invariants' ground check (#470, test/lib/layout.js onGround) on the construction chip, in the steps view on a
// landscape phone with a construction tool picked (Hyperbolic line): the chip's × and ? stand over the plane's canvas, on the
// chip's card (#draftChipL), whose background is the light or dark surface at 0.92. The card has pointer-events: none (taps
// go through to the plane), so it is not among the elements at the buttons' centres; the check also counts the text's own
// ancestors above the canvas, and finds the card. Every landscape phone size, in English and Russian, light and dark.
// (control: with the card's background made transparent on the page, the check reports the × and ? as having no ground)
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/layout_ground_cmd.js
// Prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LIB = fs.readFileSync(path.join(DIR, '..', 'lib', 'layout.js'), 'utf8');
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// the ground check's findings on the chip: the × and ? (by their classes), each with the canvas it stands over
const CHIP = `__layout.onGround(document.getElementById('draftChipL')).map((v) => ({ check: v.check, el: String(v.el || '').slice(0, 60) }))`;
for (const [w, h] of [[568, 320], [640, 360], [667, 375], [740, 360]]) for (const lang of ['en', 'ru']) for (const dark of [false, true]) {
  const tag = `${w} × ${h}, ${lang}, ${dark ? 'dark' : 'light'}`;
  await view(w, h, dark, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=lg${w}${lang}${dark ? 1 : 0}${Date.now() % 100000}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#constructTools .tool[data-tool=hyper]")' });
  await ev(`document.querySelector('#constructTools .tool[data-tool="hyper"]').click(); 1`);
  await settled({ max: 20000, floor: 600, until: '!document.getElementById("draftChipL").hidden' });
  await ev(LIB);
  const state = await ev(`(() => { const c = document.getElementById('draftChipL'), x = c.querySelector('button.cm-x'), q = c.querySelector('button.cm-q'), cs = getComputedStyle(c);
    return { shown: !c.hidden && !!x && !!q && x.getBoundingClientRect().width > 0 && q.getBoundingClientRect().width > 0, bg: cs.backgroundColor, pe: cs.pointerEvents, view: __cmwView().main }; })()`);
  const found = await ev(CHIP);
  info[tag] = { state, found };
  ok(`${tag}: the chip, its × and its ? are shown (control)`, state && state.shown, state);
  ok(`${tag}: the chip's × and ? stand on the chip's card, a ground (no no-ground)`, Array.isArray(found) && !found.some((v) => v.check === 'no-ground'), found);
  if (w === 640 && lang === 'en' && !dark) {
    // (control: the same chip on no ground at all, the check must still report its buttons)
    const bare = await ev(`(() => { const c = document.getElementById('draftChipL'), was = c.style.background; c.style.background = 'transparent'; const r = ${CHIP}; c.style.background = was; return r; })()`);
    info[tag + ', the card transparent'] = bare;
    ok(`${tag}, the card made transparent: the check reports the × and ? with no ground (control)`, Array.isArray(bare) && bare.filter((v) => v.check === 'no-ground').length >= 2, bare);
  }
}
return { pass: fails.length === 0, fails, info };
