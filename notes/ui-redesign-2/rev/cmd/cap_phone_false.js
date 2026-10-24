// Revision captures (rev): card pictures per view, cumulative (card k = F_k = f_k o ... o f_1 over the main z-window in
// Phase and Landscape; the image after step k in X -> Y; the step at its own t in the Deformation, no paths), plus the
// phone's side-by-side planes. false and phone are replaced per run.
const DARK = false; const T = DARK ? 'dark' : 'light'; const PART = 'phone';
const ROOT = '<project>/notes/ui-redesign-2/';
const STEPS = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5, -0.5i', poles: '-0.8+0.75i' }, on: true }];
const SH = [{ id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] }];
const PT = { id: 's3', kind: 'point', p: [0, 0], label: 'z₀' };
const st = (k, s, extra) => Object.assign({ shapes: SH.slice(), steps: STEPS.slice(0, k), srcView: { cx: 0, cy: 0, s }, pattern: 'checker', morphPaths: false, fov: false }, extra || {});
const met = async (w, h, d) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: d, mobile: true }); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: DARK ? 'dark' : 'light' }] }); };
let CUR = '';
const css = async (txt) => { CUR = txt; await ev(`(()=>{let s=document.getElementById('revcss');if(!s){s=document.createElement('style');s.id='revcss';document.head.append(s);} s.textContent=${JSON.stringify(txt)}; dispatchEvent(new Event('resize')); return 1})()`); await sleep(700); };
const BASE = '#app{padding-left:0!important;padding-right:0!important;padding-bottom:0!important} .top{display:none!important} #secDraw{display:none!important} .pane{border:0!important;border-radius:0!important} .pane{display:grid!important;grid-template-rows:minmax(0,1fr)!important;grid-template-columns:minmax(0,1fr)!important} .pane-head{display:none!important} .plot > :not(canvas){display:none!important} .tdock{display:none!important} #tip{display:none!important} .pop{display:none!important} .empty-chip{display:none!important}';
const SMALL = (w, h) => BASE + ` .pane{height:${h}px!important;width:${w}px!important;--ruler:0px!important} .ruler,.ruler-corner{display:none!important}`;
const NOOV = ' #overlayL,#overlayR{visibility:hidden!important}';
const go = async (ns, state) => { await load(ns, state, `localStorage.setItem('cmw-tour:${ns}', JSON.stringify({seen:true,dismissed:true}))`); await sleep(1100); if (CUR) await css(CUR); };
const cap = async (sel, file, sub) => { await ev('scrollTo(0,0)'); await sleep(120); const r = await ev(`__qa.vis(${JSON.stringify(sel)})`); if (!r || r.__exc) return 'nosel ' + sel; const clip = sub ? { x: r.x + sub.dx, y: r.y + sub.dy, width: sub.w, height: sub.h, scale: 1 } : { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 }; const o = await send('Page.captureScreenshot', { format: 'png', clip }); fs.writeFileSync(ROOT + file + '.png', Buffer.from(o.data, 'base64')); return r.w + 'x' + r.h; };
const fit = async (side) => { await ev(`['${side}Fit'].forEach(id=>{const b=document.getElementById(id); b && b.click();})`); await sleep(700); };
const out = {};
const cards = async (dir, W, H, sMain, dpr, pre) => {
  await met(390, 1500, dpr);
  const s = sMain;
  // X -> Y: the image after step k (only F_k exists, so no later step's marks), fitted
  await css(SMALL(W, H));
  for (const k of [0, 1, 2, 3]) {
    await go('rv' + pre + T + k, st(Math.max(k, 1), 52)); await css(SMALL(W, H));
    await fit('left'); await fit('right'); await sleep(900);
    out[pre + 'xy' + k] = k === 0 ? await cap('#paneL .pane-body', dir + 'c-xy-0') : await cap('#paneR .pane-body', dir + 'c-xy-' + k);
  }
  // Phase and Landscape: F_k over the main plane's z-window, no overlay (no labels, no marks)
  await css(SMALL(W, H) + NOOV);
  for (const v of ['phase', 'land']) {
    for (const k of [1, 2, 3]) {
      // Landscape renders at twice the size and keeps the central part: the relief fills the card, the axis labels fall outside
      const m = v === 'land' ? 2 : 1, CS = SMALL(W * m, H * m) + NOOV;
      await go('rv' + pre + v + T + k, st(k, s * m)); await css(CS);
      await ev(`__cmwSetMain('${v}')`); await sleep(v === 'land' ? 2600 : 1600);
      out[pre + v + k] = await cap('#paneL .pane-body', dir + (v === 'phase' ? 'c-ph-' : 'c-la-') + k, m === 2 ? { dx: W / 2, dy: H / 2, w: W, h: H } : null);
    }
  }
  // Deformation: step k alone at its own t, paths off, fitted
  await css(SMALL(W, H));
  const Ts = { 1: 1, 2: 0.55, 3: 0 };
  for (const k of [1, 2, 3]) {
    await go('rv' + pre + 'df' + T + k, st(3, 52, { focus: k })); await css(SMALL(W, H));
    await ev(`__cmwMorph({open:true})`); await sleep(500); await ev(`__cmwMorph({T:${Ts[k]}, playing:false})`); await fit('right'); await sleep(1600);
    out[pre + 'df' + k] = await cap('#paneR .pane-body', dir + 'c-df-' + k);
    await ev(`__cmwMorph({open:false})`); await sleep(300);
  }
};
if (PART === 'desk') await cards('desktop/img/' + T + '/', 200, 137, 52 * 200 / 868, 2, 'd');
if (PART === 'phone') await cards('phone/img/' + T + '/', 96, 96, 96 / 7.5, 1, 'p');
if (PART === 'sbs') {
  // the phone's side-by-side planes while a sheet is open: X (z, whole chain) | Y (w = F(z)), 195 x 300 each, rulers on
  await met(390, 1500, 2);
  const SB = BASE + ' .pane{height:300px!important;width:195px!important}';
  await go('rvsbs' + T, Object.assign(st(3, 40), { shapes: SH.concat([PT]) })); await css(SB);
  await fit('right'); await sleep(1500);
  out.sbsX = await cap('#paneL .pane-body', 'phone/img/' + T + '/sbs-x');
  out.sbsY = await cap('#paneR .pane-body', 'phone/img/' + T + '/sbs-y');
  out.mapX = await ev(`(()=>{const b=document.querySelector('#paneL .pane-body').getBoundingClientRect(), c=document.getElementById('canvasL').getBoundingClientRect(); return {ox:c.left-b.left, oy:c.top-b.top, w:c.width, h:c.height}})()`);
  out.mapY = await ev(`(()=>{const b=document.querySelector('#paneR .pane-body').getBoundingClientRect(), c=document.getElementById('canvasR').getBoundingClientRect(); return {ox:c.left-b.left, oy:c.top-b.top, w:c.width, h:c.height}})()`);
  out.viewR = await ev('JSON.stringify(__cmwView())');
  // the full-width X stage (390 x 595) for the long-press and construction screens: its canvas offset
  await css(BASE + ' .pane{height:595px!important}'); await sleep(1200);
  await go('rvst' + T, Object.assign(st(3, 52), { shapes: SH.concat([PT]) })); await css(BASE + ' .pane{height:595px!important}'); await sleep(1500);
  out.stX = await cap('#paneL .pane-body', 'phone/img/' + T + '/stage-x');
  out.mapStX = await ev(`(()=>{const b=document.querySelector('#paneL .pane-body').getBoundingClientRect(), c=document.getElementById('canvasL').getBoundingClientRect(); return {ox:c.left-b.left, oy:c.top-b.top, w:c.width, h:c.height, bw:b.width, bh:b.height}})()`);
}
out.logs = logs().filter((l) => l.t === 'EXC').slice(0, 5);
return out;
