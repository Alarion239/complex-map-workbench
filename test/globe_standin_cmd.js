// The phase globe's stand-in while its program (sphereP) links, on a cold load with ?glhold, which keeps every chain
// program's link pending (GLR.holdLinks), in the steps view: the colour plane z of (z²−1)/(z²+1), Everywhere, on the Sphere.
// - the globe is coloured from F's values on a longitude-latitude grid (globeStandIn), the frame still pending, instead of
//   an uncoloured ball: the finest level done is drawn (its nodes, the job's end) and the pane's colour share is high;
// - the stand-in is the GPU picture's in colour: with the links released and the globe settled, the pane's 16 px blocks'
//   mean colours differ from the stand-in's in at most DIFF_FRAC of them, by more than 40 levels (test/lib/standin_kit.js);
// - from the release to the GPU picture no frame shows an uncoloured globe.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const DIFF_FRAC = 0.12, HUE_MIN = 0.3, FRAME_HUE_MIN = 0.2;
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'standin_kit.js'), 'utf8'));
const loaded = "typeof __cmwSteps === 'function' && !!window.GLR";
await view(1200, 800, false, false);
const ns = 'gsi' + Date.now();
await seed(ns, { steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }, { type: 'mobius', params: { a: '1', b: '1', c: '0', d: '1' }, on: true }],
  shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 0, T: 1, scope: 'all', surf: 'sphere' } });
if (!(await go(`http://localhost:${PORT}/test.html?ns=${ns}&glhold&view=steps`))) throw new Error('no load event');
await settled({ max: 30000, panes: false, until: loaded });
const w = await settled({ only: true, max: 60000, panes: false, until: "!!__cmwStandIn() && __cmwStandIn().globe && __cmwStandIn().end !== null" });
const si = await ev('__cmwStandIn()');
const held = await K.look();
info.held = { wait: w, standIn: si, hue: +held.hue.toFixed(3), pending: await ev('GLR.frameStatus().pending') };
ok('the globe is drawn from the stand-in: its finest level done is kept (nodes drawn, the job ended)', w.ok && !!si && si.globe && si.nodes >= 33 * 17 && (si.end === 'done' || si.end === 'budget'), info.held);
ok(`the stand-in colours the globe (a colour share over ${HUE_MIN}), the frame still pending`, held.hue > HUE_MIN && info.held.pending === true, info.held);
// the release: per animation frame, the share of a coarse sample of the pane in a colour, until the GPU frame (not pending)
const rel = await K.release();
info.release = { wait: rel.wait, frames: rel.frames, worstHue: rel.worstHue === null ? null : +rel.worstHue.toFixed(3) };
ok(`from the release to the GPU picture no frame shows an uncoloured globe (every frame's colour share over ${FRAME_HUE_MIN})`, !!rel.frames && rel.worstHue > FRAME_HUE_MIN, info.release);
const fin = await settled({ max: 30000 });
const after = await K.look(), apart = K.apart(held, after);
info.final = { wait: fin, hue: +after.hue.toFixed(3), apart: +apart.toFixed(3) };
ok(`the stand-in is the GPU picture's: at most ${DIFF_FRAC * 100} % of the ${K.BLOCK} px blocks differ by more than ${K.LEVELS} levels`, fin.ok && apart <= DIFF_FRAC, info.final);
return { pass: fails.length === 0, fails, info };
