// The SphereMesh stand-in while a chain's first program links (issue #72, I): a cold load of example 15 (Γ/ζ) in X → Y
// with ?glhold, which keeps every chain program's link pending (GLR.holdLinks). The pane shows the CPU-mapped
// stand-in once the link has waited past ~250 ms, not a blank pane; on release it swaps to the GPU picture with no
// frame that is pending and draws nothing. A command file for a CDP daemon:  <runner> test/link_standin_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const ns = 'lsi' + Date.now();
await load(ns, {});
await ev('(__cmwExample(15), __cmwSetMain("xy"), 1)');
await sleep(3000);
// (the share of the pane in the shape's blue: the stand-in and the GPU picture both draw it)
const rect = await ev(`(() => { const b = document.getElementById('canvasR').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
const blue = async () => { const p = await img(rect); let n = 0, t = 0; for (let i = 0; i < p.data.length; i += 4 * p.ch) { t++; if (p.data[i + 2] > 150 && p.data[i] < 120) n++; } return n / t; };
const base = await ev('location.origin');
await nav(`${base}/test.html?ns=${ns}&glhold`);
let held = null;
for (let i = 0; i < 60 && !held; i++) {
  const st = await ev(`(() => typeof GLR === 'object' && GLR.ok ? { pending: GLR.frameStatus().pending, why: __cmwSmVerdict('R').map((v) => v.why) } : null)()`);
  if (st && st.why.includes('linking')) { const f = await blue(); if (f > 0.05) held = Object.assign(st, { blue: +f.toFixed(3) }); }
  if (!held) await sleep(500);
}
info.held = held;
ok('while the link is held: the stand-in is drawn (verdict linking, the shape on the pane)', !!held, held);
ok('while the link is held: the frame counts as pending', held && held.pending === true, held);
// (the frames after the release, collected in the page: blank = the frame is pending and drew nothing)
await ev(`(() => { window.__lsiFr = null;
  let pre = false; const dp = GLR.drawPreMapped; GLR.drawPreMapped = function () { pre = true; return dp.apply(this, arguments); };
  const fr = [], t1 = performance.now();
  const tick = () => { const st = GLR.frameStatus(); fr.push(st.pending && !pre ? 'blank' : st.pending ? 'stand-in' : 'gpu'); pre = false;
    if (performance.now() - t1 < 4000) requestAnimationFrame(() => setTimeout(tick, 0)); else { GLR.drawPreMapped = dp; window.__lsiFr = fr; } };
  GLR.holdLinks(false); requestAnimationFrame(() => setTimeout(tick, 0)); return 1; })()`);
let after = null;
for (let i = 0; i < 60 && !Array.isArray(after); i++) { await sleep(500); after = await ev('window.__lsiFr'); }
const runs = []; for (const x of Array.isArray(after) ? after : []) { if (runs.length && runs[runs.length - 1][0] === x) runs[runs.length - 1][1]++; else runs.push([x, 1]); }
info.after = Array.isArray(after) ? runs : after;
ok('after the release: no frame pending with nothing drawn', Array.isArray(after) && !after.includes('blank'), info.after);
await sleep(2500);
const fin = { blue: +(await blue()).toFixed(3), pending: await ev('GLR.frameStatus().pending'), why: await ev(`__cmwSmVerdict('R').map((v) => v.why)`) };
info.final = fin;
ok('after the release: the GPU picture, settled', fin.pending === false && !fin.why.includes('linking') && fin.blue > 0.05, fin);
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
