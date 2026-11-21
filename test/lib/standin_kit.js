// The stand-in suites' shared reads (globe_standin_cmd.js, land_standin_cmd.js): the left pane while its chain programs are held
// linking (?glhold), and after the release. The pane's pixels come from its canvas, canvasL.
// An expression for eval in a suite, which supplies ev, img, settled and the page's rect: `const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib',
// 'standin_kit.js'), 'utf8'))`.
// - look(): { hue, unlike, blocks }: the share of the pane in a colour (a channel spread over 40), the share unlike its corner
//   pixel, and the BLOCK px blocks' mean colours, row by row;
// - apart(a, b): the share of the blocks of two looks whose mean colours differ in a channel by more than LEVELS;
// - release(): releases the held links and watches the animation frames to the first GPU one (not pending), up to 8 of them:
//   { wait, frames, worstHue, worstUnlike }, the least colour and unlike shares of the pane over those frames (read from a
//   coarse copy of the pane);
// - BLOCK, LEVELS.
(() => {
  const BLOCK = 16, LEVELS = 40;
  const look = async () => {
    const p = await img(await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`));
    const W = p.w, H = p.h, blocks = [], bg = [p.data[0], p.data[1], p.data[2]];
    let hue = 0, unlike = 0, t = 0;
    for (let i = 0; i < p.data.length; i += 4 * p.ch) {
      t++;
      if (Math.max(p.data[i], p.data[i + 1], p.data[i + 2]) - Math.min(p.data[i], p.data[i + 1], p.data[i + 2]) > 40) hue++;
      if (Math.abs(p.data[i] - bg[0]) + Math.abs(p.data[i + 1] - bg[1]) + Math.abs(p.data[i + 2] - bg[2]) > 24) unlike++;
    }
    for (let y = 0; y + BLOCK <= H; y += BLOCK) for (let x = 0; x + BLOCK <= W; x += BLOCK) {
      const m = [0, 0, 0];
      for (let j = 0; j < BLOCK; j++) for (let i = 0; i < BLOCK; i++) { const q = p.ch * ((y + j) * W + x + i); m[0] += p.data[q]; m[1] += p.data[q + 1]; m[2] += p.data[q + 2]; }
      blocks.push(m.map((v) => v / (BLOCK * BLOCK)));
    }
    return { hue: hue / t, unlike: unlike / t, blocks };
  };
  const apart = (a, b) => (a.blocks.length === b.blocks.length ? a.blocks.filter((q, i) => q.some((v, c) => Math.abs(v - b.blocks[i][c]) > LEVELS)).length / a.blocks.length : 1);
  const release = async () => {
    await ev(`(() => { window.__siFr = null; const c = document.getElementById('canvasL'), s = document.createElement('canvas'); s.width = 96; s.height = 64; const x = s.getContext('2d', { willReadFrequently: true }), fr = [], t0 = performance.now();
      const share = () => { x.drawImage(c, 0, 0, s.width, s.height); const d = x.getImageData(0, 0, s.width, s.height).data; let h = 0, u = 0; const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) { if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) h++; if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 24) u++; } return [h / n, u / n]; };
      const tick = () => { const [hue, unlike] = share(); fr.push({ pending: GLR.frameStatus().pending, hue, unlike }); const gpu = fr.filter((q) => !q.pending).length;
        if (gpu < 8 && performance.now() - t0 < 30000) requestAnimationFrame(() => setTimeout(tick, 0)); else window.__siFr = fr; };
      GLR.holdLinks(false); requestAnimationFrame(() => setTimeout(tick, 0)); return 1; })()`);
    const wait = await settled({ only: true, max: 40000, until: 'Array.isArray(window.__siFr)' });
    const fr = wait.ok ? await ev('window.__siFr') : null;
    return { wait, frames: fr && fr.length, worstHue: fr ? Math.min(...fr.map((q) => q.hue)) : null, worstUnlike: fr ? Math.min(...fr.map((q) => q.unlike)) : null };
  };
  return { look, apart, release, BLOCK, LEVELS };
})()
