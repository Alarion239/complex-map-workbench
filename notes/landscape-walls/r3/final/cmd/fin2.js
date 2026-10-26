const PORT = 9846;
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ld = async (page, ns, st) => {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/gl-helpers.html` }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page}?ns=${ns}` }); await sleep(2200);
};
const sq = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn = { type: 'sin', params: {}, on: true };
const cust = (expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true });
const paneRect = async () => ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) }; })()`);
const CASES = {
  user: { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, height: 'im' },
  tan: { steps: [{ type: 'tan', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 }, sheets: false, height: 're' },
  sec: { steps: [cust('\\sec z')], srcView: { cx: 0, cy: 0, s: 60 }, sheets: false, height: 're' },
  loglog: { steps: [cust('\\log(\\log z)')], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, sheets: true, height: 'im' },
  expinv: { steps: [cust('e^{1/z}')], srcView: { cx: 0, cy: 0, s: 80 }, sheets: false, height: 're' },
  z15tan: { steps: [cust('z^{1/5}\\tan 3z')], srcView: { cx: 0, cy: 0, s: 60 }, sheets: true, height: 're' },
};
// one configuration: rest shot, mid-play frames (deformation from T0), mid-orbit frames
const cap = async (o) => {
  const { page = 'test.html', id, sheets, dark, phone, mesh = 240, T0, Tr, play = true, orbit = true, nPlay = 6, gap = 60, tag = '' } = o;
  if (phone) await view(390, 844, dark, true); else await view(1440, 900, dark, false);
  const st = Object.assign({ shapes: [], pattern: 'checker', view: { main: 'land' }, meshN: mesh }, CASES[id]);
  if (sheets != null) st.sheets = sheets;
  await ld(page, 'pr' + Date.now(), st);
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(2000);
  const nm = `${tag}${page.replace(/\W/g, '').replace('testhtml', '') || 'r3'}-${id}${st.sheets ? '-allsh' : ''}-${mesh === 240 ? 'def' : 'max' }-${phone ? 'phone' : 'desk'}-${dark ? 'dark' : 'light'}`;
  const res = { nm, shots: [] };
  if (T0 != null) { await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900); await ev(`__cmwMorph({ T: ${Tr != null ? Tr : T0} })`); }
  await settle(3500);
  const r = await paneRect(); res.rect = r;
  res.shots.push([await shot(nm + '-rest', r), 'rest', Tr != null ? Tr : T0]);
  if (play && T0 != null) {
    await ev(`__cmwMorph({ T: ${T0} })`); await settle(2500);
    await ev('__cmwMorph({ playing: true })');
    for (let i = 0; i < nPlay; i++) {
      await sleep(gap);
      const a = (await ev('__cmwMorph({})')).T; const f = await shot(`${nm}-play${i}`, r); const b = (await ev('__cmwMorph({})')).T;
      res.shots.push([f, 'play', +a.toFixed(3), +b.toFixed(3)]);
    }
    await ev('__cmwMorph({ playing: false })');
    if (Tr != null) { await ev(`__cmwMorph({ T: ${Tr} })`); }
    await settle(2500);
  }
  if (orbit) {
    await ev(`(() => { const c0 = __cmwCam('L'); window.__c0 = c0; let k = 0; window.__spin = true; const spin = () => { if (!window.__spin) return; __cmwCam('L', { yaw: c0.yaw + 0.012 * (++k) }); requestAnimationFrame(spin); }; requestAnimationFrame(spin); return 1; })()`);
    for (let i = 0; i < 3; i++) { await sleep(150); res.shots.push([await shot(`${nm}-orbit${i}`, r), 'orbit', (await ev('+(__cmwCam("L").yaw - __c0.yaw).toFixed(2)'))]); }
    await ev('window.__spin = false; 1');
    await settle(3000);
    res.shots.push([await shot(`${nm}-orbitrest`, r), 'orbit-rest', (await ev('+(__cmwCam("L").yaw - __c0.yaw).toFixed(2)'))]);
  }
  res.logs = logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6);
  return res;
};
// r3 final: verify-1 (open and play at once, Loop on) pictures and frame gaps, base alternating; verify-2 (WebGL errors)
const GAPON = `(() => { window.__gap = { gaps: [], last: performance.now(), t0: performance.now(), on: true, n: 0 }; const f = () => { const t = performance.now(); const d = t - __gap.last; __gap.n++; if (d > 50) __gap.gaps.push([Math.round(__gap.last - __gap.t0), Math.round(d)]); __gap.last = t; if (__gap.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`;
const out = { pics: [], gaps: [], warn: [] };
const open = async (page, mesh) => {
  await view(1440, 900, false, false);
  await ld(page, 'f' + Date.now(), Object.assign({}, CASES.user, { meshN: mesh, sheets: false, view: { main: 'land' }, loop: true }));
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(3500);
  await ev('__cmwSet("loop", true); 1');
};
for (const page of ['base.html', 'test.html', 'test.html', 'base.html']) {
  await open(page, 240);
  await ev(GAPON);
  await ev('__gap.t0 = performance.now(); __cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } }); __cmwMorph({ T: 0, playing: true }); 1');
  await sleep(4000);
  const g = await ev('(() => { __gap.on = false; return __gap; })()');
  await ev('__cmwMorph({ playing: false })'); await settle(600);
  out.gaps.push({ page, frames: g.n, gaps: g.gaps.map((x) => x.join('@')).join(' ') });
}
const K0 = 1000 + Math.floor(Math.random() * 8000);
let i = 0; logs();
for (const page of ['test.html', 'base.html', 'test.html']) {
  i++;
  const f = `\\sin\\sqrt{z^2+${K0 + 7 * i}}`;
  await ld(page, 'cw' + Date.now(), { shapes: [], steps: [sq, { type: 'custom', params: { expr: f, cut: 180 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, sheets: true, height: 'im' });
  await sleep(2500); logs();
  await ev(GAPON);
  await ev('__gap.t0 = performance.now(); __cmwSetMain("land")');
  await sleep(1000);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 2 } }); __cmwMorph({ T: 0, playing: true }); 1');
  await sleep(8000);
  const g = await ev('(() => { __gap.on = false; return __gap; })()');
  const T = (await ev('__cmwMorph({})')).T;
  await ev('__cmwMorph({ playing: false })'); await settle(1500);
  const L = logs().filter((l) => !/404|favicon/.test(l.m)).map((l) => l.m.slice(0, 100));
  out.warn.push({ page, f, Tend: T, nLogs: L.length, first: L.slice(0, 2), gaps: g.gaps.map((x) => x.join('@')).join(' ') });
}
return out;
