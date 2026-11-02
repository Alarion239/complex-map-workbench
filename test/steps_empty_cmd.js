// The steps view's plane with no colouring (behind ?view=steps):
// - a chain with no steps opens on Inside regions, and with no region drawn the plane is neutral (no colour);
// - Everywhere on the same chain colours it (the user's choice);
// - a chain with a step opens on Everywhere, coloured; Inside regions with no region drawn is neutral there too, and with a disc drawn
//   the colour shows inside the disc only;
// - a state saved on Everywhere keeps it on an empty chain.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'sve' + Date.now();
const DISC = { id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true };
const base = (steps, shapes, sv) => Object.assign({ v3: true, v4: true, v5: true, v6: true, shapes, steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } }, sv ? { sv } : {});
const open = async (state) => {
  await view(1280, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#plotL canvas')` });
};
const ctl = (o) => ev(`__cmwSteps(${JSON.stringify(o)})`);
const quiet = () => settled({ max: 20000, until: `(() => { const s = __cmwSteps(); return !s.anim && !s.play; })()` });
// the share of the plane's pixels (its rulers' margin left out) with a colour: the channels more than COLOURED apart
const RULER_MARGIN = 0.14, COLOURED = 40;
const colour = () => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c && c.getContext('2d');
  if (!x) return { __exc: 'no 2d canvas in #plotL' };
  const m = Math.round(Math.min(c.width, c.height) * ${RULER_MARGIN}), w = c.width - 2 * m, h = c.height - 2 * m, d = x.getImageData(m, m, w, h).data;
  let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > ${COLOURED}) n++;
  return { share: +(n / (d.length / 4)).toFixed(3) };
})()`);
const NEUTRAL_MAX = 0.02, COLOURED_MIN = 0.2;   // (a neutral plane has only its grid and curves' ink: a few pixels in a hundred)
const read = async () => { await quiet(); await settled({ floor: 400 }); return Object.assign({ scope: (await ctl()).scope }, await colour()); };

await open(base([], []));
let a = await read(); info.empty = a;
ok('a chain with no steps opens on Inside regions', a.scope === 'in', a);
ok('and its plane is neutral (no region drawn)', !a.__exc && a.share <= NEUTRAL_MAX, a);
await ctl({ scope: 'all' });
a = await read(); info.emptyAll = a;
ok('Everywhere on the empty chain colours the plane', a.scope === 'all' && a.share >= COLOURED_MIN, a);

await open(base([{ type: 'exp', params: {}, on: true }], []));
a = await read(); info.step = a;
ok('a chain with a step opens on Everywhere, coloured', a.scope === 'all' && a.share >= COLOURED_MIN, a);
await ctl({ scope: 'in' });
a = await read(); info.stepIn = a;
ok('Inside regions with no region drawn is neutral there too', a.scope === 'in' && a.share <= NEUTRAL_MAX, a);

await open(base([{ type: 'exp', params: {}, on: true }], [DISC]));
await ctl({ scope: 'in' });
a = await read(); info.disc = a;
ok('with a disc drawn, Inside regions colours the disc only', a.share > NEUTRAL_MAX && a.share < COLOURED_MIN, a);

await open(base([], [], { at: 0, T: -1, scope: 'all', surf: 'plane' }));
a = await read(); info.saved = a;
ok('a state saved on Everywhere keeps it on an empty chain', a.scope === 'all' && a.share >= COLOURED_MIN, a);

return { pass: fails.length === 0, fails, info };
