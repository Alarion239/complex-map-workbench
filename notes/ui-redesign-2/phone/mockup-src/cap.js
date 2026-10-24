// Captures the app's own pictures for the phone mockup (run in the CDP daemon; __DARK__ is replaced per theme).
// Same chain as the desktop mockup: strip, exp, Moebius, zeros and poles.
const DARK = __DARK__; const T = DARK ? 'dark' : 'light';
const IMG = '<project>/notes/ui-redesign-2/phone/img/' + T + '/';
const ST = { shapes: [
  { id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' },
  { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] },
  { id: 's3', kind: 'point', p: [0, 0], label: 'z₀' } ],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5, -0.5i', poles: '-0.8+0.75i' }, on: true }],
  srcView: { cx: 0, cy: 0, s: 52 }, pattern: 'checker' };
const met = async (w, h, d) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: d, mobile: true }); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: DARK ? 'dark' : 'light' }] }); await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); };
const css = async (txt) => { CUR = txt; await ev(`(()=>{let s=document.getElementById('phmockcss');if(!s){s=document.createElement('style');s.id='phmockcss';document.head.append(s);} s.textContent=${JSON.stringify(txt)}; dispatchEvent(new Event('resize')); return 1})()`); await sleep(900); };
const BASE = '#app{padding-left:0!important;padding-right:0!important;padding-bottom:0!important} .top{display:none!important} #secDraw{display:none!important} .pane{border:0!important;border-radius:0!important} .pane{display:grid!important;grid-template-rows:minmax(0,1fr)!important;grid-template-columns:minmax(0,1fr)!important} .pane-head{display:none!important} .plot > :not(canvas){display:none!important} .tdock{display:none!important} #tip{display:none!important} .pop{display:none!important}';
const cap = async (sel, name) => { await ev('scrollTo(0,0)'); await sleep(150); const r = await ev(`__qa.vis(${JSON.stringify(sel)})`); if (!r || r.__exc) return 'nosel ' + sel; const o = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } }); fs.writeFileSync(IMG + name + '.png', Buffer.from(o.data, 'base64')); return r.w + 'x' + r.h; };
let CUR = '';
const focus = async (k) => { await load('ph' + T, Object.assign({}, ST, { focus: k }), `localStorage.setItem('cmw-tour:ph${T}', JSON.stringify({seen:true,dismissed:true}))`); await sleep(1200); if (CUR) await css(CUR); return ev('__cmwState().focus'); };
const focusOld = async (k) => { for (let i = 0; i < 4; i++) { const f = await ev('__cmwState().focus'); if (f === k) return true; if (k === 0) await ev(`document.getElementById('viewAllBtn').click()`); else await clickSel(`#pipeline .card[data-k="${k}"] .nm`); await sleep(600); } return ev('__cmwState().focus'); };
const fit = async () => { await ev(`['leftFit','rightFit'].forEach(id=>{const b=document.getElementById(id); b && b.click();})`); await sleep(700); };
const out = {};
const PART = __PART__;
if (PART !== 'thumbs') {
await met(390, 1500, 2);
await load('ph' + T, ST, `localStorage.setItem('cmw-tour:ph${T}', JSON.stringify({seen:true,dismissed:true}))`);
await sleep(1500);
// ---- stage-size planes: 390 x 595 (rulers 14 px) ----
await css(BASE + ' .pane{height:595px!important}');
await sleep(1500);
out.xyX = await cap('#paneL .pane-body', 'stage-x');
out.xyY = await cap('#paneR .pane-body', 'stage-y');
out.f3 = await focus(3); await sleep(1500);
out.zpX = await cap('#paneL .pane-body', 'stage-zp-x');
out.zpY = await cap('#paneR .pane-body', 'stage-zp-y');
await focus(0); await sleep(800);
await ev(`__cmwSetMain('phase')`); await sleep(2200);
out.phase = await cap('#paneL .pane-body', 'stage-phase');
await ev(`__cmwSetMain('land')`); await sleep(3000);
out.land = await cap('#paneL .pane-body', 'stage-land');
await ev(`__cmwSetMain('xy')`); await sleep(800);
await ev(`__cmwMorph({open:true})`); await sleep(400); await ev(`__cmwMorph({T:1.45, playing:false})`); await sleep(2500);
out.def = await cap('#paneR .pane-body', 'stage-def');
await ev(`__cmwMorph({open:false})`); await sleep(800);
// ---- insets: 112 x 112, no rulers, fitted ----
await css(BASE + ' .pane{height:112px!important;width:112px!important;--ruler:0px!important} .ruler,.ruler-corner{display:none!important}');
await sleep(800); await fit(); await sleep(1200);
out.inY = await cap('#paneR .pane-body', 'inset-y');
out.inX = await cap('#paneL .pane-body', 'inset-x');
await focus(3); await sleep(800); await fit(); await sleep(1200);
out.inZpY = await cap('#paneR .pane-body', 'inset-zp-y');
await focus(0); await sleep(600);
}
if (PART === 'insets') {
  ST.shapes = ST.shapes.filter((s) => s.kind !== 'point');
  await met(390, 1500, 2);
  CUR = BASE + ' .pane{height:112px!important;width:112px!important;--ruler:0px!important} .ruler,.ruler-corner{display:none!important}';
  await focus(0); await sleep(800); await fit(); await sleep(1200);
  out.inY = await cap('#paneR .pane-body', 'inset-y'); out.inX = await cap('#paneL .pane-body', 'inset-x');
  await focus(3); await sleep(800); await fit(); await sleep(1200);
  out.inZpY = await cap('#paneR .pane-body', 'inset-zp-y');
  return out;
}
if (PART !== 'stage') {
  // ---- chip thumbnails: 96 x 96 CSS px at DPR 1 (shown at 48 px on a 2x screen), no rulers, fitted, without the
  // labelled point (its label would be as tall as the picture) ----
  ST.shapes = ST.shapes.filter((s) => s.kind !== 'point');
  await met(390, 1500, 1);
  const TH = BASE + ' .pane{height:96px!important;width:96px!important;--ruler:0px!important} .ruler,.ruler-corner{display:none!important}';
  CUR = TH;
  for (const k of [0, 1, 2, 3]) {
    await focus(k); await sleep(600); await fit(); await sleep(900);
    if (k === 0) { out['t-xy-z'] = await cap('#paneL .pane-body', 't-xy-z'); out['t-xy-F'] = await cap('#paneR .pane-body', 't-xy-F'); }
    else out['t-xy-' + k] = await cap('#paneR .pane-body', 't-xy-' + k);
    await ev(`__cmwSetMain('phase')`); await sleep(1200); await fit(); await sleep(1200);
    out['t-phase-' + (k || 'F')] = await cap('#paneL .pane-body', 't-phase-' + (k || 'F'));
    await ev(`__cmwSetMain('land')`); await sleep(2400);
    out['t-land-' + (k || 'F')] = await cap('#paneL .pane-body', 't-land-' + (k || 'F'));
    await ev(`__cmwSetMain('xy')`); await sleep(600);
    await ev(`__cmwMorph({open:true})`); await sleep(300); await ev(`__cmwMorph({T:${k ? 0.5 : 1.45}, playing:false})`); await fit(); await sleep(1800);
    out['t-def-' + (k || 'F')] = await cap('#paneR .pane-body', 't-def-' + (k || 'F'));
    await ev(`__cmwMorph({open:false})`); await sleep(300);
  }
}
return out;
