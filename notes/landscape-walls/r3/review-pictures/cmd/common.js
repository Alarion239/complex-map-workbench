const PORT = 9842;
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
