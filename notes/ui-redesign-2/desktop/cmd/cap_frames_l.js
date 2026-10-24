const DARK = false; const T = DARK ? 'dark' : 'light';
const dpr = async (w, h) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false }); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: DARK ? 'dark' : 'light' }] }); };
const focus = async (k) => {
  for (let i = 0; i < 3; i++) {
    const f = await ev('__cmwState().focus');
    if (f === k) return;
    if (k === 0) await clickSel('#viewAllBtn'); else await clickSel(`#pipeline .card[data-k="${k}"] .nm`);
    await sleep(500);
  }
};
const crop = async (sel, name) => { const r = await ev(`__qa.vis(${JSON.stringify(sel)})`); if (!r) return 'nosel ' + sel; await shot(`../../desktop/img/${T}/${name}`, { x: r.x, y: r.y, width: r.w, height: r.h }); return r; };
const css = async (txt, chainH) => ev(`(()=>{let s=document.getElementById('dskF'); if(!s){s=document.createElement('style');s.id='dskF';document.head.append(s);} s.textContent=${JSON.stringify(txt)}; const st=document.getElementById('stage'); if (${chainH}) st.style.setProperty('--chain-h','${chainH}px'); return 1})()`);
const out = {};
await dpr(1440, 900);
await nav('http://localhost:8901/test.html?ns=dskT' + T);
await sleep(2000);
await css('', 188); await sleep(1200);
// DOM snapshots (light only: CSS variables carry the theme)
if (!DARK) {
  out.dom = await ev(`(()=>{const cl=(el)=>{const c=el.cloneNode(true); return c.outerHTML}; const lp=document.getElementById('leftPanel'); return {top: cl(document.getElementById('top')), left: cl(lp), leftCanvases: lp.querySelectorAll('canvas').length, compose: document.getElementById('composeTex').innerHTML, ftex: [...document.querySelectorAll('#pipeline .card .ftex')].map((e)=>e.innerHTML), pipeHead: document.querySelector('.pipe-head').outerHTML, card1: document.querySelector('#pipeline .card[data-k="1"]').outerHTML, conn: document.querySelector('#pipeline .conn') ? document.querySelector('#pipeline .conn').outerHTML : '', addCard: document.getElementById('addStepBtn').outerHTML, region: document.querySelector('#pipeline .region-card').outerHTML, props: document.getElementById('propsPanel').outerHTML, zpParams: document.querySelector('#pipeline .card[data-k="3"] .params').outerHTML, mobParams: document.querySelector('#pipeline .card[data-k="2"] .params').outerHTML}})()`);
}
await ev(`__cmwSetMain('xy')`); await focus(3); await sleep(2200);
out.f1 = await crop('#panes', 'p-xy1440-f3');
await focus(0); await sleep(1500);
out.f1b = await crop('#panes', 'p-xy1440');
await ev(`__cmwSetMain('phase')`); await sleep(2500);
out.f2 = await crop('#panes', 'p-phase1440');
await ev(`__cmwSetMain('xy')`); await sleep(600);
await ev(`__cmwMorph({open:true})`); await sleep(600); await ev(`__cmwMorph({T:1.55})`); await sleep(2200);
out.f4 = await crop('#panes', 'p-def1440');
await ev(`__cmwMorph({open:false})`); await sleep(500);
// without the right panel: Landscape
await css('.layout{--rw:36px!important} .layout > .panel.right > :not(.rail){display:none!important} .layout > .panel.right > .rail{display:flex!important}', 188); await sleep(400);
await ev(`__cmwSetMain('land')`); await sleep(3000);
out.f3 = await crop('#panes', 'p-land1440-noR');
await ev(`__cmwSetMain('xy')`); await sleep(500);
// 1024 x 768: left rail, Inspector docked 264
await dpr(1024, 768); await css('.layout{--lw:36px!important; --rw:264px!important} .layout > .panel{position:static!important}', 188); await sleep(2500);
out.f5 = await crop('#panes', 'p-xy1024');
// 768 x 1024: both rails, the Inspector under the chain
await dpr(768, 1024); await css('.layout{--lw:36px!important; --rw:36px!important} #stage{max-height:704px!important} .layout > .panel{position:static!important}', 188); await sleep(2500);
out.f6 = await crop('#panes', 'p-xy768');
await css('', 0);
await dpr(1440, 900);
return out;
