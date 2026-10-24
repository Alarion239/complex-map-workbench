const base = 'file://' + DIR + '/../desktop/frames/';
const out = {};
for (const [f, w, h, bw] of [['f1-xy-1440', 1440, 900, 1440], ['f1-xy-1440', 1280, 800, 1280], ['f5-xy-1024', 1024, 768, 1024], ['f6-xy-768', 768, 1024, 768]]) {
  for (const lang of ['en', 'ru']) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await nav(base + f + '.html?t=light&lang=' + lang); await sleep(1200);
    out[f + '@' + w + ':' + lang] = await ev(`(()=>{ if (${w} !== 1440) { document.body.style.width='${bw}px'; document.body.style.height='${h}px'; document.getElementById('top').classList.add('n-narrow-hdr'); } const r = [...document.querySelectorAll('.n-card .nm, .n-ftile .fl')].map(e => { const cut = e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1; return (cut ? 'CUT ' : '') + e.textContent.trim() + ' ' + e.clientWidth + 'px'; }); const hdr = [...document.querySelectorAll('#top .mlabel, #top .exlabel, #top .cmd-text, #top .llabel')].filter(e => e.offsetWidth).map(e => (e.scrollWidth > e.clientWidth + 1 ? 'CUT ' : '') + e.textContent.trim()); return { cards: r, hdr }; })()`);
    if (lang === 'ru') await shot('../rev/ru-' + f + '-' + w);
  }
}
return out;
