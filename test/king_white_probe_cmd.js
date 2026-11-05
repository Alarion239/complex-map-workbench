// One-off probe (not for merging): the Mountain King's w1 -> w2 glide held at x = 1.25, 1.5, 1.75, Everywhere,
// on the machine's real GPU. Reads the visible pane (a page screenshot over canvasL's box), the parked frames on
// planes 1 and 2 for comparison, every WebGL error a frame raises (getError after each draw while held), the
// console and the glide's record. The job log prints only fails, so the report is always listed as fails
// ("report: <section>"); a held frame mostly white where the parked frames are not is a fail of its own.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ex = names.indexOf('In the Hall of the Mountain King');
ok('the Mountain King example is found', ex >= 0, names.length);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=kw${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
info.gpu = await ev(`(() => { const g = document.createElement('canvas').getContext('webgl2'), e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : String(!!g); })()`);
await ev(`__cmwExample(${ex}); 1`);
await settled({ max: 30000 });
await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 1, now: true })}); 1`);
await settled({ max: 60000, until: '!__cmwSteps().moving' });
// (the visible pane: a screenshot cut to canvasL's box; white share, mean luminance, a 48 x 18 luminance map)
const pane = async (tag) => {
  await sleep(400);
  const r = await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
  const im = await img();
  const [L, T, Wd, Hd] = r.map((v) => Math.round(v)), sx = im.w / 1200, ch = im.ch;
  let white = 0, n = 0, lum = 0;
  const RAMP = ' .:-=+*#%@', rows = [];
  const at = (x, y) => { const i = (Math.round(y * sx) * im.w + Math.round(x * sx)) * ch; return [im.data[i], im.data[i + 1], im.data[i + 2]]; };
  for (let y = T; y < T + Hd; y += 2) for (let x = L; x < L + Wd; x += 2) {
    const [R, G, B] = at(x, y); n++; lum += 0.299 * R + 0.587 * G + 0.114 * B; if (R >= 248 && G >= 248 && B >= 248) white++;
  }
  for (let j = 0; j < 18; j++) {
    let s = '';
    for (let i = 0; i < 48; i++) { const [R, G, B] = at(L + (i + 0.5) * Wd / 48, T + (j + 0.5) * Hd / 18); s += RAMP[Math.min(9, Math.floor((0.299 * R + 0.587 * G + 0.114 * B) / 25.6))]; }
    rows.push(s);
  }
  const st = await ev(`(() => { const s = __cmwSteps(), g = s.glide; return { x: +__cmwSvX().toFixed(3), moving: s.moving, scope: s.scope, path: g && g.path, u: g && g.u, key: g ? !!g.key : null, pending: GLR.pendingLinks }; })()`);
  info[tag] = { box: r, white: +(white / n).toFixed(3), lum: +(lum / n).toFixed(1), state: st, map: rows.join('|') };
  return info[tag];
};
const p1 = await pane('parked on plane 1');
// (WebGL errors: getError after every draw, counted by code, while the thread is held)
await ev(`(() => {
  const P = WebGL2RenderingContext.prototype, E = window.__kwErr = {}, ge = P.getError;
  for (const name of ['drawArrays', 'drawArraysInstanced', 'drawElements', 'drawElementsInstanced', 'clear', 'blitFramebuffer']) {
    const f = P[name];
    P[name] = function (...a) { const r = f.apply(this, a); const e = ge.call(this); if (e) { const k = name + ' 0x' + e.toString(16); E[k] = (E[k] || 0) + 1; } return r; };
  }
  return 1;
})()`);
logs(true);
const held = {};
for (const x of [1.25, 1.5, 1.75]) {
  const h = await hold(x);
  const p = await pane('held at ' + x);
  p.hold = h;
  p.glErrors = await ev('(() => { const e = window.__kwErr; window.__kwErr = {}; for (const k in e) delete e[k]; return Object.assign({}, e); })()');
  held[x] = p;
  await ev('window.__svScrubUp && window.__svScrubUp(), 1');
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
  await ev(`__cmwSteps({ go: 1, now: true }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
}
// (the errors' totals once the hooks are read: __kwErr was emptied after each hold)
info.glErrorsAfter = await ev('Object.assign({}, window.__kwErr)');
await ev(`__cmwSteps({ go: 2, now: true }); 1`);
await settled({ max: 60000, until: '!__cmwSteps().moving' });
const p2 = await pane('parked on plane 2');
info.console = logs(true).filter((l) => !/^log-verbose/.test(l.t)).slice(0, 12);
for (const x of [1.25, 1.5, 1.75]) {
  const h = held[x];
  ok(`held at ${x}: the pane is not mostly white where the parked frames are not`, !(h.white > 0.6 && h.white > Math.max(p1.white, p2.white) + 0.3), { white: h.white, parked: [p1.white, p2.white] });
}
// (one fail per section: the log prints up to 2000 characters of each)
for (const k of Object.keys(info)) fails.push({ name: 'report: ' + k, got: info[k] });
return { pass: false, fails, info };
