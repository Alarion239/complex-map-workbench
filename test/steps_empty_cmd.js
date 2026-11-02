// The steps view's plane with no colouring (behind ?view=steps):
// - a chain with no steps opens on Inside regions, and with no region drawn the plane is neutral (no colour);
// - Everywhere on the same chain colours it (the user's choice);
// - a chain with a step opens on Everywhere, coloured; Inside regions with no region drawn is neutral there too, and with a disc drawn
//   the colour shows inside the disc only;
// - a state saved on Everywhere keeps it on an empty chain.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'sve' + Date.now();
const DISC = { id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true };
const base = (steps, shapes, sv) => Object.assign({ v6: true, shapes, steps, srcView: { cx: 0, cy: 0, s: 90 } }, sv ? { sv } : {});
const open = async (state) => {
  await view(1280, 800, false, false);
  await loadView('steps', ns, state, { lang: 'en' });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#plotL canvas')` });
};
const { ctl, quiet, planePixels } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'plane_pixels.js'), 'utf8'));
// the share of the plane's pixels with a colour: the channels more than COLOURED apart
const COLOURED = 40;   // (the phase colours differ by well over this between channels; the plane's paper, grid and ink are greys within it)
const colour = async () => { const r = await planePixels('', `(r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) > ${COLOURED}`); return r.__exc ? r : { share: +(r.n / r.total).toFixed(3) }; };
const NEUTRAL_MAX = 0.02, COLOURED_MIN = 0.2;   // (a neutral plane has only its grid and curves' ink: a few pixels in a hundred)
// (the head's switch: the scope it shows checked)
const shown = () => ev(`(() => { const b = document.querySelector('.sv-scope [aria-checked="true"]'); return b ? b.dataset.v : null; })()`);
// (what the plane says: the empty-state message over it, when it is shown)
const said = () => ev(`(() => { const e = document.querySelector('.sv-empty'); return e && !e.hidden ? e.textContent : ''; })()`);
const HINT = /Draw a region to colour it, or choose Everywhere\./;
const read = async () => { await quiet(); await settled({ floor: 400 }); return Object.assign({ scope: (await ctl()).scope, shown: await shown(), said: await said() }, await colour()); };

await open(base([], []));
let a = await read(); info.empty = a;
ok('a chain with no steps opens on Inside regions', a.scope === 'in', a);
ok('the head\'s switch shows Inside regions checked', a.shown === 'in', a);
ok('and its plane is neutral (no region drawn), asking only for a function', !a.__exc && a.share <= NEUTRAL_MAX && !HINT.test(a.said) && /Add a function/.test(a.said), a);
await ctl({ scope: 'all' });
a = await read(); info.emptyAll = a;
ok('Everywhere on the empty chain colours the plane, the switch shows it, and the hint is gone', a.scope === 'all' && a.shown === 'all' && a.share >= COLOURED_MIN && !HINT.test(a.said), a);

await open(base([{ type: 'exp', params: {}, on: true }], []));
a = await read(); info.step = a;
ok('a chain with a step opens on Everywhere, coloured', a.scope === 'all' && a.share >= COLOURED_MIN, a);
await ctl({ scope: 'in' });
a = await read(); info.stepIn = a;
ok('Inside regions with no region drawn is neutral there too, and says what to do', a.scope === 'in' && a.share <= NEUTRAL_MAX && a.said === 'Draw a region to colour it, or choose Everywhere.', a);

await open(base([{ type: 'exp', params: {}, on: true }], [DISC]));
await ctl({ scope: 'in' });
a = await read(); info.disc = a;
ok('with a disc drawn, Inside regions colours the disc only, with no hint', a.share > NEUTRAL_MAX && a.share < COLOURED_MIN && !HINT.test(a.said), a);

await open(base([], [], { at: 0, T: -1, scope: 'all', surf: 'plane' }));
a = await read(); info.saved = a;
ok('a state saved on Everywhere keeps it on an empty chain', a.scope === 'all' && a.share >= COLOURED_MIN, a);

return { pass: fails.length === 0, fails, info };
