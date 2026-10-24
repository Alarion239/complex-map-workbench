const out = {};
const sizes = [[1440, 900], [1280, 800], [1024, 768], [768, 1024]];
for (const [w, h] of sizes) {
  await view(w, h, false);
  await nav('http://localhost:8901/test.html?ns=dsk1');
  await sleep(2500);
  const views = [['xy', false], ['phase', false], ['land', false], ['xy', true]];
  for (const [v, d] of views) {
    await ev(`__cmwSetMain('${v}')`);
    const on = await ev(`document.getElementById('morphBtn').getAttribute('aria-pressed')`);
    if ((on === 'true') !== d) { await clickSel('#morphBtn'); }
    await sleep(v === 'land' ? 2500 : 1800);
    if (d) { await ev(`(()=>{const b=document.querySelector('#tdockR button, #tdockL button'); return 1})()`); }
    const name = `before-${w}-${v}${d ? '-deform' : ''}`;
    await shot('../../desktop/shots/' + name);
    out[name] = await ev(`(()=>{const q=(s)=>__qa.vis(s);return {panes:q('#panes'),pipe:q('.pipe-wrap'),card1:q('#pipeline .card[data-k="1"]'),left:q('#leftPanel'),right:q('#rightPanel'),paneL:q('#paneL'),paneR:q('#paneR')}})()`);
    if (d) await clickSel('#morphBtn');
  }
}
await view(1440, 900, false);
return out;
