'use strict';
// Issue #297, the reproduction from outside the page: N cold loads, each in a fresh headless Chrome with the perf
// suite's flags (no GPU program cache), of example 7 (Square root and its sheets) and then example 8 (Cayley, then
// cube) with ci/equiv.js's waits between scenes; then X's overlay is read in the box of example 7's cut handle. A ghost:
// pixels left there while __cmwCutHandles() is empty. Nothing is instrumented in the page (instrumentation there hid the
// race). Before the fix, 14 of 16 loads showed it on SwiftShader (7641815); test/overlay_ghost_cmd.js runs it too.
//   node test/overlay_ghost_repro.js [N=20] [--shot]     (python3 build.py first; CHROME_BIN, CMW_CHROME_ARGS as for CI)
// The overlay is read back once per load, after the waits (getImageData: its backing store); --shot reads a screenshot
// of the box instead (what the screen shows). Exit 1 when any load showed a ghost.
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { launch, sleep } = require(path.join(__dirname, 'regress', 'perf', 'cdp'));
const decode = require(path.join(__dirname, 'cdp_kit', 'png'));

// the overlay's non-transparent pixels in a 110 x 28 box at the handle (client coordinates)
const readback = (box) => `(() => { const c = document.getElementById('overlayL'), r = c.getBoundingClientRect(); const d = c.getContext('2d').getImageData(${box.x} - r.left - 10, ${box.y} - r.top - 14, 110, 28).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; })()`;
// the pixels near the cut ink (#CC3311) in a screenshot of the same box
const ink = (png) => { const p = decode(png); let n = 0; for (let i = 0; i < p.w * p.h; i++) { const r = p.data[i * p.ch], g = p.data[i * p.ch + 1], b = p.data[i * p.ch + 2]; if (Math.abs(r - 0xCC) < 40 && Math.abs(g - 0x33) < 40 && Math.abs(b - 0x11) < 40) n++; } return n; };

// n cold loads of the test page at base (a served dist/, ending in '/'), each in a fresh Chrome
// -> [{ i, ghost, px, left } | { i, err }]
async function coldLoads(base, n, { shot = false, log = () => {} } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const B = await launch({ width: 1280, height: 800, dpr: 1 });
    try {
      // ci/equiv.js's waits between scenes: a moment, a playing deformation stopped, the programs linked, the cards
      // drawn, a moment
      const settle = async () => {
        await sleep(1500);
        await B.ev(`(() => { try { const m = __cmwState().morph; if (m && m.open) __cmwMorph({ playing: false, T: 0.5 }); } catch (e) { /* */ } return 1; })()`);
        for (let k = 0; k < 40 && await B.ev('typeof GLR !== "undefined" && GLR.compiling === true'); k++) await sleep(250);
        for (let k = 0; k < 40 && await B.ev(`(() => { try { return __cmwCards().cards.some((c) => !c.sig || c.stale); } catch (e) { return false; } })()`); k++) await sleep(250);
        await sleep(1500);
      };
      await B.nav(base + 'test.html');
      try { await B.until(`document.readyState === 'complete' && !!document.querySelector('#pipeline .card')`, 30000, 250); } catch (e) {
        out.push({ i, err: 'the page did not start within 30 s' }); log(`load ${i}: the page did not start within 30 s`); continue;
      }
      await sleep(3000);
      await B.ev('(__cmwExample(7), 1)');
      await settle();
      const hs = await B.ev('__cmwCutHandles()');
      if (!hs.length) { out.push({ i, err: 'example 7 shows no cut handle' }); log(`load ${i}: example 7 shows no cut handle`); continue; }
      const box = { x: Math.round(hs[0].x), y: Math.round(hs[0].y) };
      await B.ev('(__cmwExample(8), 1)');
      await settle();
      const px = shot ? ink(await B.shot({ x: box.x - 10, y: box.y - 14, width: 110, height: 28 })) : await B.ev(readback(box));
      const left = await B.ev('__cmwCutHandles().length');
      const r = { i, ghost: px > 50 && left === 0, px, left };
      out.push(r);
      log(`load ${i}: ${r.ghost ? 'GHOST' : 'clean'} (${px} px in the handle's box, ${left} handles listed)`);
    } finally { await B.close(); }
  }
  return out;
}
module.exports = { coldLoads };

if (require.main === module) {
  (async () => {
    const { serve } = require(path.join(ROOT, 'ci', 'lib'));
    const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || 20);
    const SHOT = process.argv.includes('--shot');
    const { server, base } = await serve(path.join(ROOT, 'dist'));
    let res;
    try { res = await coldLoads(base, N, { shot: SHOT, log: (m) => console.log(m) }); } finally { server.close(); }
    const done = res.filter((r) => !r.err), ghosts = done.filter((r) => r.ghost).length;
    console.log(`ghosts: ${ghosts} of ${done.length} loads (${SHOT ? 'screenshot' : 'overlay readback'})`);
    process.exit(ghosts ? 1 : 0);
  })().catch((e) => { console.error(e); process.exit(2); });
}
