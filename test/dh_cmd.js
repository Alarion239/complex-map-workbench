// The Douady–Hubbard map's rays and equipotentials (issue #260): the Φ_M step's Inspector card adds an external ray
// (θ = 1/3) and an equipotential (|Φ| = 1.05) as shapes of the z-plane, refuses a level ≤ 1 and an angle it cannot
// read; F maps the ray onto the radial line arg w = 2π/3 and the equipotential onto the circle |w| = 1.05; the shape
// rows name them by their equations. A Böttcher step with c a shared number adds a ray of the Julia set whose c is
// bound to that number (a slider moves it). The palette offers both commands while such a step is in the chain.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/dh_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
async function openApp(st) {
  const ns = 'dh' + Date.now();
  await view(1366, 768, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = Object.assign({ v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image', sel: 1 }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}` }); await sleep(2300);
  await settle(800);
}
// the Inspector's Add field of kind ('dhray' | 'dheq') of step k: its text set, then Enter
const addVia = (k, kind, text) => ev(`(() => { const i = document.getElementById('dh${k}_${kind}'); if (!i) return null; i.value = ${JSON.stringify(text)}; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return { bad: i.classList.contains('bad'), tip: i.getAttribute('data-tip') }; })()`);
const shapes = async () => (await ev('__cmwP().shapes')).filter((s) => s.kind === 'dhray' || s.kind === 'dheq');
// F at the samples of shape id's curve (every 8th), in the page: [[re, im] | null]
const imagesOf = (id) => ev(`(() => { const s = __cmwP().shapes.find((x) => x.id === ${JSON.stringify(id)}); const cs = Region.curvesOf(s, { x0: -3, x1: 3, y0: -2, y1: 2 }); if (!cs.length) return []; const pts = []; for (let i = 0; i < cs[0].pts.length; i += 8) pts.push([cs[0].pts[i].re, cs[0].pts[i].im]); return __cmwEval('F', null, pts); })()`);
const palOpen = async () => { if (!(await ev(`!!document.getElementById('palInput')`))) { await key('k', 4); await settle(350); } };
const palType = async (q) => { await palOpen(); await ev(`(() => { const i = document.getElementById('palInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); })()`); await settle(300); };
const palLabels = () => ev(`[...document.querySelectorAll('.pal-item')].map((e) => e.querySelector('.pal-label').textContent)`);

// ---- Φ_M: the card's fields
await openApp({ steps: [{ type: 'dh', params: { N: 64 }, on: true }] });
info.fields = await ev(`['dh1_dhray', 'dh1_dheq'].map((id) => { const e = document.getElementById(id); return e ? { value: e.value, shown: e.getClientRects().length > 0 } : null; })`);
ok('the Φ_M card has its Ray and Level fields, filled with 1/3 and 1.1', info.fields.every((f) => f && f.shown) && info.fields[0].value === '1/3' && info.fields[1].value === '1.1', info.fields);
info.r1 = await addVia(1, 'dhray', '1/3'); await settle(900);
let sh = await shapes();
ok('Enter in the Ray field adds the external ray 1/3 of M', sh.length === 1 && sh[0].kind === 'dhray' && sh[0].theta === '1/3' && sh[0].c === null && !('stage' in sh[0]), sh);
info.bad = await addVia(1, 'dheq', '0.9'); await settle(300);
ok('a level 0.9 is refused, flagged, saying why', info.bad && info.bad.bad && /1/.test(info.bad.tip || '') && (await shapes()).length === 1, info.bad);
info.badRay = await addVia(1, 'dhray', 'x/3'); await settle(300);
ok('an angle x/3 is refused, flagged', info.badRay && info.badRay.bad && (await shapes()).length === 1, info.badRay);
info.r2 = await addVia(1, 'dheq', '1.05'); await settle(900);
sh = await shapes();
ok('Enter in the Level field adds the equipotential |Φ_M| = 1.05', sh.length === 2 && sh[1].kind === 'dheq' && sh[1].r === 1.05, sh);
// F maps them where Φ_M says
const rayW = await imagesOf(sh[0].id), eqW = await imagesOf(sh[1].id);
const argOff = rayW.filter((w) => w).map((w) => Math.abs(Math.atan2(w[1], w[0]) - 2 * Math.PI / 3));
const modOff = eqW.filter((w) => w).map((w) => Math.abs(Math.hypot(w[0], w[1]) - 1.05));
info.ray = { n: rayW.length, finite: argOff.length, worst: Math.max(...argOff) };
info.eq = { n: eqW.length, finite: modOff.length, worst: Math.max(...modOff) };
// (the ray's last point is its estimated landing point on M, where Φ_M is not defined)
ok('F = Φ_M maps the ray onto arg w = 2π/3', info.ray.finite >= 40 && info.ray.finite >= info.ray.n - 1 && info.ray.worst < 1e-9, info.ray);
ok('… and the equipotential onto |w| = 1.05', info.eq.finite >= 100 && info.eq.finite === info.eq.n && info.eq.worst < 1e-9, info.eq);
info.tex = await ev(`__cmwP().shapes.filter((s) => s.kind === 'dhray' || s.kind === 'dheq').map((s) => Region.KINDS[s.kind].tex(s))`);
ok('their TeX: arg Φ_M(z) = 2π·1/3 and |Φ_M(z)| = 1.05', /\\arg \\Phi_M\(z\)=2\\pi\\cdot \\tfrac\{1\}\{3\}/.test(info.tex[0]) && /\|\\Phi_M\(z\)\|=1[.,]05/.test(info.tex[1]), info.tex);
// the palette's commands
await palType('external ray');
info.pal = await palLabels();
ok('the palette offers Add an external ray to f₁…', info.pal.some((l) => /external ray/.test(l) && /f₁/.test(l)), info.pal.slice(0, 8));
await ev(`[...document.querySelectorAll('.pal-item')].find((e) => /external ray/.test(e.querySelector('.pal-label').textContent)).click()`); await settle(700);
info.focused = await ev('document.activeElement && document.activeElement.id');
ok('… which focuses the Ray field of f₁', info.focused === 'dh1_dhray', info.focused);

// ---- φ_c with c = a, a shared number: the ray follows a
await openApp({ params: [{ name: 'a', value: -1, min: -2, max: 2, step: 0.01 }], steps: [{ type: 'bottcher', params: { c: 'a', N: 64 }, on: true }] });
await addVia(1, 'dhray', '1/4'); await settle(900);
sh = await shapes();
ok('the Böttcher card adds a ray of the Julia set, c bound to a', sh.length === 1 && JSON.stringify(sh[0].c) === '[-1,0]' && sh[0].bind && sh[0].bind.c === 'a', sh);
info.jtex = await ev(`(() => { const s = __cmwP().shapes[0]; return Region.KINDS[s.kind].tex(s); })()`);
ok('its TeX names c: arg φ_a(z) = 2π·1/4', /\\varphi_\{a\}/.test(info.jtex), info.jtex);
await ev(`Params.set('a', -0.12)`); await settle(900);
sh = await shapes();
ok('a slider on a moves the ray\'s c', JSON.stringify(sh[0].c) === '[-0.12,0]', sh[0] && sh[0].c);
await addVia(1, 'dheq', '1.2'); await settle(900);
const eq2 = (await shapes())[1], w2 = eq2 ? await imagesOf(eq2.id) : [];
const off2 = w2.filter((w) => w).map((w) => Math.abs(Math.hypot(w[0], w[1]) - 1.2));
info.jeq = { n: w2.length, worst: Math.max(...off2) };
ok('φ_a maps its equipotential 1.2 onto |w| = 1.2', w2.length >= 100 && off2.length === w2.length && info.jeq.worst < 1e-9, info.jeq);

// ---- the two examples (the last of the gallery): they load with their rays and levels, which F sends where it should
const exIdx = await ev(`(() => { const out = {}; for (let i = 0; i < 80; i++) { let ok; try { ok = __cmwExample(i); } catch (e) { break; } if (!ok) break; const st = __cmwP().steps[0]; if (st && (st.type === 'dh' || st.type === 'bottcher')) out[st.type] = i; } return out; })()`);
ok('the gallery has the Douady–Hubbard and the Böttcher examples', exIdx.dh != null && exIdx.bottcher != null, exIdx);
await ev(`__cmwExample(${exIdx.dh})`); await settle(1500);
sh = await shapes();
ok('Douady–Hubbard example: six rays and three equipotentials of M', sh.filter((x) => x.kind === 'dhray').length === 6 && sh.filter((x) => x.kind === 'dheq').length === 3 && sh.every((x) => x.c === null), sh.length);
const exW = await imagesOf(sh.find((x) => x.kind === 'dheq').id);
ok('… its first equipotential maps onto |w| = 1.02', exW.length > 50 && exW.every((w) => w && Math.abs(Math.hypot(w[0], w[1]) - 1.02) < 1e-9), exW.length);
await ev(`__cmwExample(${exIdx.bottcher})`); await settle(1500);
sh = await shapes();
ok('Böttcher example: four rays and two levels of the basilica, c bound to the slider c', sh.length === 6 && sh.every((x) => x.bind && x.bind.c === 'c' && JSON.stringify(x.c) === '[-1,0]'), sh.map((x) => [x.kind, x.c, x.bind]));
const bw = await imagesOf(sh.find((x) => x.kind === 'dhray' && x.theta === '1/3').id);
const bOff = bw.filter((w) => w).map((w) => Math.abs(Math.atan2(w[1], w[0]) - 2 * Math.PI / 3));
ok('… its ray 1/3 maps onto arg w = 2π/3', bOff.length > 20 && Math.max(...bOff) < 1e-9, [bw.length, Math.max(...bOff)]);
// ([#299 review] c on Play: each new c costs the curves no more than a quick follow, and the full traces land once c
// rests. The curve work per frame is Region.curvesOf's time (the drawing itself is the GPU's, as for any curve))
await ev(`(() => { window.__play = null; const R = Region, f = R.curvesOf; let acc = 0; R.curvesOf = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { acc += performance.now() - t; } };
  const per = [], stamps = []; let k = 0;
  const step = () => { acc = 0; Params.set('c', -1 + 0.3 * Math.sin(++k / 6)); requestAnimationFrame(() => { per.push(acc); if (k % 5 === 0) stamps.push(__cmwP().shapes.map((s) => R.dhStamp(s)).join('')); if (k < 20) step(); else { R.curvesOf = f; per.sort((a, b) => a - b); window.__play = { frames: per.length, median: per[per.length >> 1], max: per[per.length - 1], stamps }; } }); };
  step(); return 1; })()`);
for (let i = 0; i < 240 && !(await ev(`window.__play`)); i++) await sleep(250);
info.play = await ev('window.__play');
// (whether the full traces land between two frames depends on the frame rate: t_dh.js checks the quick curves)
ok('c on Play: the curves cost at most 15 ms a frame (median)', !!info.play && info.play.median <= 15, info.play);
await settle(2500);
info.rest = await ev(`__cmwP().shapes.map((s) => Region.dhStamp(s)).join('')`);
ok('… and once c rests, every curve is its full trace again', info.rest === 'ffffff', info.rest);
await ev(`Params.set('c', 0.3)`); await settle(1500);
info.cOut = await ev(`__cmwP().shapes.map((s) => [s.kind, Region.curvesOf(s, { x0: -2, x1: 2, y0: -2, y1: 2 }).length])`);
ok('c = 0.3 (outside M): the shapes follow it, and nothing throws', info.cOut.length === 6, info.cOut);
// ([#299 review] a c whose critical level reaches an equipotential's: that shape is undefined and says why, as any
// value out of range; it comes back with a c that frees it. |Φ_M(1)|^{1/2} ≈ 1.226: the level 1.05 goes, 1.3 stays)
await ev(`Params.set('c', 1)`); await settle(1500);
info.undef = await ev(`__cmwP().shapes.filter((s) => s.kind === 'dheq').map((s) => [s.r, s.undef || null, s.visible])`);
ok('c = 1: the equipotential 1.05 is undefined, saying the critical level; 1.3 stays', info.undef.length === 2 && /critical/.test(info.undef.find((x) => x[0] === 1.05)[1] || '') && !info.undef.find((x) => x[0] === 1.3)[1], info.undef);
await ev(`Params.set('c', 0.3)`); await settle(1500);
info.back = await ev(`__cmwP().shapes.filter((s) => s.kind === 'dheq').map((s) => [s.r, s.undef || null, s.visible])`);
ok('… and c = 0.3 brings it back', info.back.every((x) => !x[1] && x[2] !== false), info.back);

// [#358] the card's Add rows fit the Inspector in every language: the field keeps about five characters (64 px) and
// the button stays inside the panel (a long one, ru and it, wraps under the field)
for (const w of [1280, 1024]) {
  await openApp({ steps: [{ type: 'dh', params: { N: 64 }, on: true }] });
  await view(w, 800, false, false); await settle(800);
  for (const lang of ['en', 'ru', 'it']) {
    await ev(`I18N.setPref('${lang}'), 1`); await settle(1200);
    const rows = await ev(`(() => { const pr = document.getElementById('propsPanel').getBoundingClientRect(); return [...document.querySelectorAll('#propsPanel .pf.dh-add')].map((f) => { const i = f.querySelector('.inp').getBoundingClientRect(), b = f.querySelector('.btn').getBoundingClientRect(); return { inpW: Math.round(i.width), btnL: Math.round(b.left), btnR: Math.round(b.right), panelL: Math.round(pr.left), panelR: Math.round(pr.right) }; }); })()`);
    info[`fit${w}${lang}`] = rows;
    ok(`${w} px, ${lang}: the Ray and Level rows keep their fields at least 64 px wide and their buttons inside the panel`, rows.length === 2 && rows.every((r) => r.inpW >= 64 && r.btnL >= r.panelL && r.btnR <= r.panelR), rows);
  }
}
await ev(`I18N.setPref('en'), 1`); await settle(600);
await grab();
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
