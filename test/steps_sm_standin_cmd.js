// The steps view's carried colour at rest while a region's SphereMesh rebuilds: exp(H), Inside regions, coloured from
// z, exact images off (the carry draws the region's SphereMesh, an unbounded shape), at rest on w₁. A pan on plane z
// re-centres the meshing window, then back to w₁: while the rebuild runs, the old mesh stands in inside its guard box
// (drawScene's stand-in) and the tessellated mesh only around it, so every frame of the rebuild is the rest frame after
// it (at most 0.5 % of the pane's pixels more than 32/255 apart), not the tessellated mesh, which covers clipWin's
// window alone. Paths are off: the glide's paths t -> H_t(z) are drawn over the colour, which is what is read.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
// (no SphereMesh job left and the pane still; want: the least number of meshes built)
const meshed = async (built) => { await settled({ max: 120000, until: `!__cmwSphere().running && !__cmwSphere().jobs.length && __cmwSphere().stats.built >= ${built}` }); await ev(rAF2); };
// the left pane's pixels, kept in the page under tag
const grab = (tag) => ev(`(() => { const cv = document.getElementById('canvasL'); window.__ss = window.__ss || {}; window.__ss[${JSON.stringify(tag)}] = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; return [cv.width, cv.height]; })()`);
// the share of pixels of a more than 32/255 apart from b in a channel
const diff = (a, b) => ev(`(() => { const A = window.__ss[${JSON.stringify(a)}], B = window.__ss[${JSON.stringify(b)}]; if (!A || !B || A.length !== B.length) return null; let n = 0, n32 = 0; for (let i = 0; i < A.length; i += 4) { n++; const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d > 32) n32++; } return { n, frac32: +(n32 / n).toFixed(4) }; })()`);
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const ns = `sms${Date.now()}`;
const st = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', exactImages: false, srcView: { cx: 0, cy: 1, s: 30 }, shapes: [H], steps: [{ type: 'exp', params: {}, on: true }] };
await go(`http://localhost:${PORT}/gl-helpers.html`);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof __cmwSphere === "function" && typeof __cmwSet === "function" && !!window.GLR' });
await ev("__cmwSet('morphPaths', false), __cmwHideStrokes(true), 1");
await ev(`__cmwSteps(${JSON.stringify({ scope: 'in', surf: 'plane', T: 0, go: 1, now: true })}); 1`);
await meshed(1);
const st0 = await ev('__cmwSphere()');
info.before = { built: st0.stats.built, entries: st0.entries.map((e) => ({ why: e.why, slot: e.slot })) };
ok('at rest on w₁: the carried colour is drawn from a SphereMesh of the region', st0.entries.some((e) => /SV/.test(e.slot || e.key || '')), info.before);
// (a pan of 45 % of the pane on plane z, a middle-button drag: the meshing window re-centres; then back to w₁ at once)
await ev(`__cmwSteps({ go: 0, now: true }), 1`);
await settled({ max: 20000 });
const rL = await ev('(() => { const r = document.getElementById("canvasL").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()');
const cx = rL[0] + rL[2] / 2, cy = rL[1] + rL[3] / 2;
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'middle', buttons: 4, clickCount: 1 });
for (let i = 1; i <= 12; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx - 0.45 * rL[2] * i / 12, y: cy, button: 'middle', buttons: 4 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx - 0.45 * rL[2], y: cy, button: 'middle', buttons: 0, clickCount: 1 });
await settled({ max: 20000, panes: false });
const built0 = (await ev('__cmwSphere()')).stats.built;
await ev(`__cmwSteps({ go: 1, now: true }), 1`);
// (the frames while the rebuild runs, up to four)
let n = 0;
for (let i = 0; i < 200 && n < 4; i++) {
  const s = await ev('__cmwSphere()');
  if (s.jobs.length || s.running) { await ev(rAF2); await grab('dur' + n++); }
  else if (s.stats.built > built0) break;
  await ev('new Promise((r) => setTimeout(r, 60))');
}
await meshed(built0 + 1);
await grab('rest1');
const during = [];
for (let k = 0; k < n; k++) during.push(await diff('dur' + k, 'rest1'));
const st1 = await ev('__cmwSphere()');
info.rebuild = { frames: n, during, built: [built0, st1.stats.built] };
ok('the pan re-centres the window: the region\'s mesh rebuilds, with frames drawn while it runs', st1.stats.built > built0 && n > 0, info.rebuild);
ok('while the mesh rebuilds: every frame is the rest frame after it (the old mesh stands in, at most 0.5 % of pixels > 32/255)', n > 0 && during.every((d) => d && d.frac32 <= 0.005), info.rebuild);
return { pass: fails.length === 0, fails, info };
