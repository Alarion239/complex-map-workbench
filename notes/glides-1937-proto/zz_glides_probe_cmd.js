// (scratch harness for #1937's design study; never committed) frames of one glide held at u, timed, kept as raw RGBA
const info = {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, compare, judge, keep, UNHELD } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const OUT = process.env.GP_OUT, TAG = process.env.GP_TAG || 'base';
const W = +(process.env.GP_W || 900), Hh = +(process.env.GP_H || 600);
const ONLY = process.env.GP_ONLY ? process.env.GP_ONLY.split(',') : null;
const XS = (process.env.GP_XS || '0.001,0.25,0.5,0.5556,0.75,0.999').split(',').map(Number);
const CASES = {
  z2: { steps: [{ type: 'pown', params: { n: 2 }, on: true }], s: 90 },
  cubic: { steps: [{ type: 'poly', params: { co: '1, 0, -2, 1' }, on: true }], s: 90 },
  jouk: { steps: [{ type: 'joukowski', params: {}, on: true }], s: 90 },
  exp: { steps: [{ type: 'exp', params: {}, on: true }], s: 60 },
  tan: { steps: [{ type: 'tan', params: {}, on: true }], s: 60 },
  negpow: { steps: [{ type: 'pown', params: { n: -2 }, on: true }], s: 90 },
  mob: { steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], s: 90 },
  zeta: { steps: [{ type: 'zeta', params: {}, on: true }], s: 30 },
  gamma: { steps: [{ type: 'gamma', params: {}, on: true }], s: 60 },
  cos: { steps: [{ type: 'cos', params: {}, on: true }], s: 60 },
};
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const openState = async (state, tag) => {
  const ns = `${tag}${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const r = await settled({ max: 90000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && typeof __cmwTime === "function" && !!window.GLR' });
  if (!r.ok) throw new Error('hooks not up: ' + JSON.stringify(r));
};
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); return settled({ max: 180000, until: `!__cmwSteps().moving && __cmwSvX() === ${i} && ${UNHELD}` }); };
const dump = async (name, tag) => {
  await keep(tag);
  const b64 = await ev(`(() => { const P = window.__heldPx[${JSON.stringify(tag)}]; if (!P) return ''; let s = ''; for (let i = 0; i < P.length; i += 0x8000) s += String.fromCharCode.apply(null, P.subarray(i, i + 0x8000)); return btoa(s); })()`, 60000);
  const c = await ev('(() => { const c = document.getElementById("canvasL"); return [c.width, c.height]; })()');
  if (b64) fs.writeFileSync(path.join(OUT, `${TAG}-${name}.rgba`), Buffer.from(b64, 'base64'));
  return c;
};
const timeIt = async () => { const r = []; for (let i = 0; i < 3; i++) r.push(await ev('__cmwTime(2).left', 600000)); return [...r].sort((a, b) => a - b)[1]; };
await view(W, Hh, false, false);
for (const [name, cs] of Object.entries(CASES)) {
  if (ONLY && !ONLY.includes(name)) continue;
  const R = info[name] = { frames: {} };
  try {
    await openState({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: cs.s }, shapes: [], steps: cs.steps }, 'gp' + name);
    await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane' }), 1`);
    if (process.env.GP_T) await ev(`__cmwSteps({ T: ${+process.env.GP_T} }), 1`);
    if (process.env.GP_FLAGS) await ev(`${process.env.GP_FLAGS}; 1`);
    R.rest1 = await rest(1); await grab('R1'); R.size = await dump(name + '-rest1', 'R1'); R.restMs1 = await timeIt();
    R.rest0 = await rest(0); await grab('R0'); await dump(name + '-rest0', 'R0'); R.restMs0 = await timeIt();
    for (const x of XS) {
      const t0 = Date.now();
      const h = await hold(x);
      const F = R.frames[x] = { held: h.ok, waitMs: Date.now() - t0 };
      await grab('M' + x);
      await dump(`${name}-x${x}`, 'M' + x);
      const g = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, u: g.u, why: g.why || g.reason || null }; })()');
      F.glide = g;
      F.ms = await timeIt();
      if (process.env.GP_JUDGE) { try { F.judge = await judge('R0', 'M' + x, { step: 12 }); } catch (e) { F.judge = String(e); } }
      // (design-A: the frame without the planes' colour plots, and without the inverse pass)
      if (process.env.GP_SPLIT && x === 0.5) {
        F.msNoPlot = await ev('(() => { const f = GLR.drawColorPlot; GLR.drawColorPlot = () => {}; try { const r = []; for (let i = 0; i < 3; i++) r.push(__cmwTime(2).left); return r.sort((a, b) => a - b)[1]; } finally { GLR.drawColorPlot = f; } })()', 600000);
        F.msNoInv = await ev('(() => { const f = GLR.drawInverse; GLR.drawInverse = () => "drawn"; try { const r = []; for (let i = 0; i < 3; i++) r.push(__cmwTime(2).left); return r.sort((a, b) => a - b)[1]; } finally { GLR.drawInverse = f; } })()', 600000);
      }
      // (design-A: frames at a new u each, as a glide draws them: the first render at each u, plan and preparation included)
      if (process.env.GP_MOVE && x === 0.5) {
        F.move = await ev(`(() => { const out = []; for (let k = 1; k <= 8; k++) { __cmwSteps({ x: ${x} + k * 0.0125 }); const t0 = performance.now(); const r = __cmwTime(1); out.push(+(performance.now() - t0 - r.left - 2 * (r.right || 0) - 2 * (r.overlay || 0)).toFixed(1)); } return out; })()`, 600000);
      }
      await ev('window.__svScrubUp && window.__svScrubUp(), 1');
      await rest(0);
    }
  } catch (e) { R.error = String(e && e.stack || e); }
  fs.writeFileSync(path.join(OUT, `${TAG}-${name}.json`), JSON.stringify(R, null, 1));
}
return { pass: true, fails: [], info };
