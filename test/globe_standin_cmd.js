// The phase globe's stand-in while its program (sphereP) links, on a cold load with ?glhold, which keeps every chain
// program's link pending (GLR.holdLinks), in the steps view: the colour plane z of (z²−1)/(z²+1), Everywhere, on the Sphere.
// - the globe is coloured from F's values on a longitude-latitude grid (globeStandIn), the frame still pending, instead of
//   an uncoloured ball: the finest level done is drawn (its nodes, the job's end) and the pane's colour share is high;
// - the stand-in is the GPU picture's in colour: with the links released and the globe settled, the pane's 16 px blocks'
//   mean colours differ from the stand-in's in at most DIFF_FRAC of them, by more than DIFF_LEVELS;
// - from the release to the GPU picture no frame shows an uncoloured globe.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BLOCK = 16, DIFF_LEVELS = 40, DIFF_FRAC = 0.12, HUE_MIN = 0.3, FRAME_HUE_MIN = 0.2;
const loaded = "typeof __cmwSteps === 'function' && !!window.GLR";
await view(1200, 800, false, false);
const ns = 'gsi' + Date.now();
await seed(ns, { steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }, { type: 'mobius', params: { a: '1', b: '1', c: '0', d: '1' }, on: true }],
  shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 0, T: 1, scope: 'all', surf: 'sphere' } });
if (!(await go(`http://localhost:${PORT}/test.html?ns=${ns}&glhold&view=steps`))) throw new Error('no load event');
await settled({ max: 30000, panes: false, until: loaded });
const rect = await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
// the pane's blocks' mean colours and the share of its pixels in a colour (a channel spread over 40)
const look = async () => {
  const p = await img(rect), W = p.w, H = p.h, blocks = [];
  let hue = 0, t = 0;
  for (let i = 0; i < p.data.length; i += 4 * p.ch) { t++; if (Math.max(p.data[i], p.data[i + 1], p.data[i + 2]) - Math.min(p.data[i], p.data[i + 1], p.data[i + 2]) > 40) hue++; }
  for (let y = 0; y + BLOCK <= H; y += BLOCK) for (let x = 0; x + BLOCK <= W; x += BLOCK) {
    const m = [0, 0, 0];
    for (let j = 0; j < BLOCK; j++) for (let i = 0; i < BLOCK; i++) { const q = p.ch * ((y + j) * W + x + i); m[0] += p.data[q]; m[1] += p.data[q + 1]; m[2] += p.data[q + 2]; }
    blocks.push(m.map((v) => v / (BLOCK * BLOCK)));
  }
  return { hue: hue / t, blocks };
};
const w = await settled({ only: true, max: 60000, panes: false, until: "!!__cmwStandIn() && __cmwStandIn().globe && __cmwStandIn().end !== null" });
const si = await ev('__cmwStandIn()');
const held = await look();
info.held = { wait: w, standIn: si, hue: +held.hue.toFixed(3), pending: await ev('GLR.frameStatus().pending') };
ok('the globe is drawn from the stand-in: its finest level done is kept (nodes drawn, the job ended)', w.ok && !!si && si.globe && si.nodes >= 33 * 17 && (si.end === 'done' || si.end === 'budget'), info.held);
ok(`the stand-in colours the globe (a colour share over ${HUE_MIN}), the frame still pending`, held.hue > HUE_MIN && info.held.pending === true, info.held);
// the release: per animation frame, the share of a coarse sample of the pane in a colour, until the GPU frame (not pending)
await ev(`(() => { window.__gsFr = null; const c = document.getElementById('canvasL'), s = document.createElement('canvas'); s.width = 96; s.height = 64; const x = s.getContext('2d', { willReadFrequently: true }), fr = [], t0 = performance.now();
  const share = () => { x.drawImage(c, 0, 0, s.width, s.height); const d = x.getImageData(0, 0, s.width, s.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) n++; return n / (d.length / 4); };
  const tick = () => { fr.push({ pending: GLR.frameStatus().pending, hue: share() }); const left = fr.filter((q) => !q.pending).length;
    if (left < 8 && performance.now() - t0 < 30000) requestAnimationFrame(() => setTimeout(tick, 0)); else window.__gsFr = fr; };
  GLR.holdLinks(false); requestAnimationFrame(() => setTimeout(tick, 0)); return 1; })()`);
const rel = await settled({ only: true, max: 40000, until: 'Array.isArray(window.__gsFr)' });
const frames = rel.ok ? await ev('window.__gsFr') : null;
const worst = frames ? Math.min(...frames.map((q) => q.hue)) : null;
info.release = { wait: rel, frames: frames && frames.length, worstHue: worst === null ? null : +worst.toFixed(3) };
ok(`from the release to the GPU picture no frame shows an uncoloured globe (every frame's colour share over ${FRAME_HUE_MIN})`, !!frames && worst > FRAME_HUE_MIN, info.release);
const fin = await settled({ max: 30000 });
const after = await look();
const apart = held.blocks.filter((b, i) => b.some((v, c) => Math.abs(v - after.blocks[i][c]) > DIFF_LEVELS)).length / held.blocks.length;
info.final = { wait: fin, hue: +after.hue.toFixed(3), apart: +apart.toFixed(3) };
ok(`the stand-in is the GPU picture's: at most ${DIFF_FRAC * 100} % of the ${BLOCK} px blocks differ by more than ${DIFF_LEVELS} levels`, fin.ok && held.blocks.length === after.blocks.length && apart <= DIFF_FRAC, info.final);
return { pass: fails.length === 0, fails, info };
