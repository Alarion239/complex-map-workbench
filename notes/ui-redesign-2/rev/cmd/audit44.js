await view(1400, 900, false, false);
await nav('file://<project>/notes/ui-redesign-2/phone/mockup.html');
await sleep(2500);
return await ev(`(() => {
  const els = [...document.querySelectorAll('button, input, [role=radio], [role=menuitem], a, .ph-menu > div:not(.mh)')];
  const small = {};
  let total = 0, n = 0;
  for (const e of els) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; total++;
    // account for transforms: use offsetWidth/Height (layout px)
    const w = e.offsetWidth || r.width, h = e.offsetHeight || r.height;
    if (w < 44 || h < 44) { n++; const k = (e.tagName + '.' + (e.className && e.className.baseVal === undefined ? e.className : '')).slice(0,40) + ' ' + Math.round(w) + 'x' + Math.round(h) + ' "' + (e.getAttribute('aria-label') || e.textContent.trim()).slice(0,24) + '"'; small[k] = (small[k] || 0) + 1; }
  }
  const scr = document.querySelectorAll('.phone, .screen, .ph');
  return { total, under44: n, screens: scr.length, kinds: Object.entries(small).sort((a,b)=>b[1]-a[1]).slice(0,40) };
})()`);
