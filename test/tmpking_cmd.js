const info = {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
await go(`http://localhost:${PORT}/test.html?view=steps&ns=k${Date.now()}`);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwExample === "function" && !!window.GLR' });
await ev(`__cmwExample(${names.indexOf('In the Hall of the Mountain King')}); 1`); await settled({ max: 60000 });
await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane' }), 1`);
await ev(`__cmwSteps({ go: 0, now: true }), 1`); await settled({ max: 60000 });
// warm: one pass over the glide
for (const x of [0.3, 0.5, 0.7]) { await ev(`__cmwSteps({ x: ${x} }), 1`); await settled({ max: 60000, until: 'GLR.pendingLinks === 0' }); }
await ev(`(async () => { const out = [], c = document.getElementById('canvasL');
  for (let i = 0; i < 12; i++) { const x = 0.2 + 0.05 * i; __cmwSteps({ x }); const t0 = performance.now(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); c.getContext('2d').getImageData(0, 0, 1, 1); out.push(performance.now() - t0); }
  window.__kt = out; })(), 1`);
await settled({ max: 120000, until: 'Array.isArray(window.__kt)' });
const ts = await ev('window.__kt');
info.ms = ts.map((t) => Math.round(t));
info.path = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, b: g.b, reason: g.reason }; })()');
info.jet = await ev(`(() => { try { const st = (typeof SEASONG !== 'undefined' && SEASONG.steps) || null; if (!st) return 'no steps in state'; const b = Funcs.applyRepeats(st, st.map((x) => Funcs.build(x))); const i = GLChain.build(st, b); const j = i.jet; if (!j) { const r = []; b.forEach((x, k) => { let d = null; try { d = Funcs.derivAst(x, { stable: true }); } catch (e) { d = { error: String(e) }; } r.push(d ? (d.error ? 'err ' + d.error : 'ok') : 'null'); }); return { jet: null, derivs: r, dks: i.derivs }; } return { jet: true, len: j.source.length, slots: j.slots }; } catch (e) { return 'throw ' + e.message; } })()`);
info.T = await ev('__cmwSteps().T'); info.canvas = await ev(`(() => { const c = document.getElementById('canvasL'); return [c.width, c.height, devicePixelRatio]; })()`);
ts.sort((a, b) => a - b); info.median = Math.round(ts[6]);
return { pass: true, fails: [], info };
