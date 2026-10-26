const BASE = 'http://localhost:9709/';
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const out = {}; const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
const RECT = [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }];
const RT = (n, cut = 180) => ({ type: 'root', params: { n, cut }, on: true }), SN = { type: 'sin', params: {}, on: true };
const st = (steps, extra) => Object.assign({ shapes: RECT, steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' }, extra || {});
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const setView = async (w, h, dark, phone) => { await view(w, h, dark, phone); await send('Emulation.setUserAgentOverride', phone ? { userAgent: ANDROID, platform: 'Android' } : { userAgent: '' }); };
const dlgReady = async () => { for (let i = 0; i < 150; i++) { await sleep(150); const r = await ev(`(() => { const d = __cmwFig.dialog(); return !!(d && d.fig && !d.building); })()`); if (r === true) return true; } return false; };
const MP = `(() => { const p = document.querySelector('#popHost .pop.menu'), m = document.querySelector('.modal.xf'); if (!p) return { open: false, dialog: !!m };
    const r = p.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), e2 = document.elementFromPoint(r.left + 8, r.top + 8);
    return { open: true, dialog: !!m, rect: [r.left, r.top, r.width, r.height].map(Math.round), onTop: !!(e && p.contains(e)) && !!(e2 && p.contains(e2)), inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, items: [...p.querySelectorAll('[role=menuitem],button')].map((b) => b.textContent.trim()).slice(0, 8) }; })()`;
const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.hidden) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
for (const [w, h, dark, phone, lang] of [[1440, 900, false, false, ''], [390, 844, true, true, 'ru'], [844, 390, false, true, '']]) {
  await setView(w, h, dark, phone);
  const ns = `vx${w}${lang}${Date.now()}`;
  await load(ns, st([RT(2), SN]));
  if (lang) await nav(`${BASE}test.html?ns=${ns}&lang=${lang}`);
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(600);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 }, T: 0.5 })'); await settle(900);
  const eb = await center('#exportBtn');
  let how = 'button';
  if (eb) { await click(eb[0], eb[1]); await sleep(400); const it = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .pop.menu [role=menuitem], #popHost .pop.menu button, .sheet [role=menuitem], .sheet button')].find((x) => x.offsetParent && /^(Export figure|Экспорт рисунка|Рисунок)/i.test(x.textContent.trim())); if (!b) return [...document.querySelectorAll('#popHost .pop.menu [role=menuitem], #popHost .pop.menu button')].map((x) => x.textContent.trim()).slice(0,4).join('|'); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`); if (Array.isArray(it)) await click(it[0], it[1]); else { how = 'ctrl+e (menu: ' + it + ')'; await key('Escape'); await key('e', 2); } } else { how = 'ctrl+e'; await key('e', 2); }
  const ready = await dlgReady();
  await settle(600);
  await shot(`vx-dlg-${w}${lang}`);
  const r = { how, ready };
  for (const id of ['xfMore', 'xfSize']) {
    const c = await center('#' + id);
    if (!c) { r[id] = 'missing'; continue; }
    await click(c[0], c[1]); await sleep(400);
    r[id] = await ev(MP);
    await shot(`vx-${id}-${w}${lang}`);
    await key('Escape'); await sleep(300);
    r[id + 'After'] = await ev(`({ menu: !!document.querySelector('#popHost .pop.menu'), dialog: !!document.querySelector('.modal.xf') })`);
  }
  r.cap = await ev(`(() => { const e = document.querySelector('.xf-cap'); return e ? e.textContent.slice(0, 900) : null; })()`);
  out[`${w}${lang}`] = r;
  await key('Escape'); await sleep(300);
  await grab();
}
await setView(1440, 900, false, false);
out.errs = errs;
return out;
