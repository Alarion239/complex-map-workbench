// in-page overflow detector: text that is clipped (ellipsis / hidden) or spills out of its box or the viewport
window.__ovf = () => {
  const out = [];
  const vw = innerWidth;
  const desc = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); const p = el.parentElement; if (!el.id && p) s = (p.id ? '#' + p.id : p.className && typeof p.className === 'string' ? '.' + p.className.trim().split(/\s+/)[0] : p.tagName.toLowerCase()) + ' > ' + s; return s; };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg, canvas, style, script, mjx-container, [hidden]')) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.data.trim()).map((n) => n.data.trim()).join(' ');
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const clip = el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible';
    let spill = false, why = '';
    if (r.right > vw + 1 || r.left < -1) { spill = true; why = 'viewport'; }
    // spills out of a clickable or boxed ancestor (button, chip, card)
    const box = el.parentElement && el.parentElement.closest('button, .chip, .card, .mi, .seg, label, .lamp, .btn');
    if (!spill && box && box !== el) { const b = box.getBoundingClientRect(); if (r.right > b.right + 1.5 || r.left < b.left - 1.5) { spill = true; why = 'box'; } }
    if (el.matches('button, .btn') && el.scrollWidth > el.clientWidth + 1) { spill = true; why = why || 'button'; }
    if (clip || spill) out.push({ sel: desc(el), text: own.slice(0, 50), kind: clip ? 'clipped' : 'spill:' + why, over: Math.round(Math.max(el.scrollWidth - el.clientWidth, r.right - vw)) });
  }
  return out;
};
