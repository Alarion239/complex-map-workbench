// The Landscape's stand-in while its programs (landTF and land) link, on a cold load with ?glhold, which keeps every chain
// program's link pending (GLR.holdLinks), in the steps view: the Landscape of plane z of (z²−1)/(z²+1), Everywhere.
// - the relief is drawn from F's values on a grid of the block's box (landStandIn): the frame is still pending, the finest level
//   done is kept (its nodes, the job's end), and the pane shows the relief (more of it unlike the plate than the plate alone);
// - the stand-in is the GPU surface's: with the links released and the Landscape settled, the pane's 16 px blocks' mean colours
//   differ from the stand-in's in at most DIFF_FRAC of them, by more than 40 levels (test/lib/standin_kit.js);
// - from the release to the GPU picture no frame shows the plate alone.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const DIFF_FRAC = 0.1, PLATE_UNLIKE = 0.3;
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'standin_kit.js'), 'utf8'));
const loaded = "typeof __cmwSteps === 'function' && !!window.GLR";
for (const theme of ['light', 'dark']) {
  await view(1200, 800, false, false);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
  const ns = 'lsi' + Date.now();
  await seed(ns, { steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }, { type: 'mobius', params: { a: '1', b: '1', c: '0', d: '1' }, on: true }],
    shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 0, T: 1, scope: 'all', surf: 'land' } });
  if (!(await go(`http://localhost:${PORT}/test.html?ns=${ns}&glhold&view=steps`))) throw new Error('no load event');
  await settled({ max: 30000, panes: false, until: loaded });
  const w = await settled({ only: true, max: 60000, panes: false, until: "!!__cmwStandIn() && __cmwStandIn().land && __cmwStandIn().end !== null" });
  await settled({ only: true, max: 20000, panes: false, until: '__cmwLandStandIn()' });
  const si = await ev('__cmwStandIn()');
  const held = await K.look();
  info[theme] = info[theme] || {}; info[theme].held = { wait: w, standIn: si, drawn: await ev('__cmwLandStandIn()'), unlike: +held.unlike.toFixed(3), hue: +held.hue.toFixed(3), pending: await ev('GLR.frameStatus().pending') };
  ok(theme + ': the relief is drawn from the stand-in: its finest level done is kept (nodes drawn, the job ended)', w.ok && !!si && si.land && si.nodes >= 33 * 33 && (si.end === 'done' || si.end === 'budget'), info[theme].held);
  ok(`${theme}: the frame draws the stand-in's relief (more of the pane unlike the plate than ${PLATE_UNLIKE}), still pending`, info[theme].held.drawn && held.unlike > PLATE_UNLIKE && info[theme].held.pending === true, info[theme].held);
  const rel = await K.release();
  info[theme].release = { wait: rel.wait, frames: rel.frames, worstUnlike: rel.worstUnlike === null ? null : +rel.worstUnlike.toFixed(3) };
  ok(`${theme}: from the release to the GPU picture no frame shows the plate alone (every frame's unlike share over ${PLATE_UNLIKE})`, !!rel.frames && rel.worstUnlike > PLATE_UNLIKE, info[theme].release);
  const fin = await settled({ max: 30000 });
  const after = await K.look(), apart = K.apart(held, after);
  info[theme].final = { wait: fin, unlike: +after.unlike.toFixed(3), apart: +apart.toFixed(3) };
  ok(`${theme}: the stand-in is the GPU surface's: at most ${DIFF_FRAC * 100} % of the ${K.BLOCK} px blocks differ by more than ${K.LEVELS} levels`, fin.ok && apart <= DIFF_FRAC, info[theme].final);
}
return { pass: fails.length === 0, fails, info };
