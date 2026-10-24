const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
const r = {};
const rectStart = (id) => ev(`(() => { const o = window.__rt = []; let n = 0; const f = () => { const e = document.getElementById('${id}'); const b = e ? e.getBoundingClientRect() : {}; const s = __cmwSound(); o.push([Math.round(b.left), Math.round(b.top), Math.round(b.width), s && s.rest ? s.rest.src + ' ' + s.rest.z.map((v) => +v.toFixed(3)).join(',') : null]); if (++n < 60) requestAnimationFrame(f); }; f(); return 1; })()`);
const rectGet = async () => { const a = await ev('window.__rt'); return Array.isArray(a) ? a.filter((v, i) => i === 0 || JSON.stringify(v) !== JSON.stringify(a[i - 1])) : a; };
// 1. merged at M from the default X -> Y view
await loadS([{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }]);
await soundOn(null);
let p = await W('L', ...Z); await rest(p); await settle(1900);
await rectStart('overlayR'); await key('m'); await sleep(1300);
const sF = await S_(); r.F = { p, rest: sF.rest, scr: sF.rest ? await W('R', sF.rest.z[0], sF.rest.z[1]) : null, rectR: await rectGet() };
await rectStart('overlayL'); await key('m'); await sleep(1500);
const sC = await S_(); r.close = { rest: sC.rest, scr: sC.rest ? await W('L', sC.rest.z[0], sC.rest.z[1]) : null, rectL: await rectGet() };
// 2. land -> phase
await ev(`__cmwSetMain('land')`); await sleep(900);
await rectStart('overlayL'); await ev(`__cmwSetMain('phase')`); await sleep(1100); r.rectL2 = await rectGet();
const sP = await S_(); r.phase = { rest: sP.rest, scr: sP.rest ? await W('L', sP.rest.z[0], sP.rest.z[1]) : null };
return r;
