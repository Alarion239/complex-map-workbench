const LANGS = ['ru'], SHOTS = true;

// Russian screenshots of the prototype (work/xl): 390 and 1440 px, light and dark; overflow lists for ru and en
const OVF = "// in-page overflow detector: text that is clipped (ellipsis / hidden) or spills out of its box or the viewport\nwindow.__ovf = () => {\n  const out = [];\n  const vw = innerWidth;\n  const desc = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.'); const p = el.parentElement; if (!el.id && p) s = (p.id ? '#' + p.id : p.className && typeof p.className === 'string' ? '.' + p.className.trim().split(/\\s+/)[0] : p.tagName.toLowerCase()) + ' > ' + s; return s; };\n  for (const el of document.querySelectorAll('body *')) {\n    if (el.closest('svg, canvas, style, script, mjx-container, [hidden]')) continue;\n    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.data.trim()).map((n) => n.data.trim()).join(' ');\n    if (!own) continue;\n    const r = el.getBoundingClientRect();\n    if (!r.width || !r.height) continue;\n    const cs = getComputedStyle(el);\n    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;\n    const clip = el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible';\n    let spill = false, why = '';\n    if (r.right > vw + 1 || r.left < -1) { spill = true; why = 'viewport'; }\n    // spills out of a clickable or boxed ancestor (button, chip, card)\n    const box = el.parentElement && el.parentElement.closest('button, .chip, .card, .mi, .seg, label, .lamp, .btn');\n    if (!spill && box && box !== el) { const b = box.getBoundingClientRect(); if (r.right > b.right + 1.5 || r.left < b.left - 1.5) { spill = true; why = 'box'; } }\n    if (el.matches('button, .btn') && el.scrollWidth > el.clientWidth + 1) { spill = true; why = why || 'button'; }\n    if (clip || spill) out.push({ sel: desc(el), text: own.slice(0, 50), kind: clip ? 'clipped' : 'spill:' + why, over: Math.round(Math.max(el.scrollWidth - el.clientWidth, r.right - vw)) });\n  }\n  return out;\n};\n";
const res = {};
const W = [[390, 844, true], [1440, 900, false]];
const clickText = (sel, txt) => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent.trim() === ${JSON.stringify(txt)} && x.offsetParent); if (b) { b.click(); return true; } return false; })()`);
const hidePop = () => ev(`document.querySelectorAll(':popover-open').forEach((p) => p.hidePopover())`);
for (const LANG of LANGS) for (const [w, hh, mob] of W) for (const dark of [false, true]) {
  const tag = `${LANG}_${w}_${dark ? 'dark' : 'light'}`;
  const S = LANG === 'ru' && SHOTS;
  await view(w, hh, dark, mob);
  await nav(`http://localhost:8817/test.html?ns=xlshot${w}${dark ? 'd' : 'l'}${LANG}${Date.now()}&lang=${LANG}`);
  await sleep(3200);
  await ev(OVF);
  await ev(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(dark ? 'dark' : 'light')})`);
  await sleep(600);
  const r = { base: await ev('__ovf()') };
  if (S) await shot(`${tag}_1_xy_chain`);
  if (w < 768) {
    // the right panel (guarantees, domain, step table) on a phone
    await ev(`(() => { const l = document.querySelector('.lampname'); if (l) l.closest('section, .panel, aside, div').scrollIntoView({ block: 'start' }); })()`);
    await sleep(700);
    r.right = await ev('__ovf()');
    if (S) await shot(`${tag}_2_right_panel`);
    await ev(`(() => { const c = document.querySelector('.card-head'); if (c) c.scrollIntoView({ block: 'center' }); })()`); await sleep(500);
    if (S) await shot(`${tag}_2b_chain_cards`);
    await ev(`window.scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; })`); await sleep(400);
    // the More menu
    await ev(`document.getElementById('hdrMoreBtn').click()`); await sleep(500);
    r.more = await ev('__ovf()');
    if (S) await shot(`${tag}_3_more_menu`);
    await hidePop(); await key('Escape'); await sleep(300);
  } else {
    await ev(`document.getElementById('examplesBtn').click()`); await sleep(600);
    r.examples = await ev('__ovf()');
    if (S) await shot(`${tag}_3_examples_menu`);
    await hidePop(); await key('Escape'); await sleep(300);
    await ev(`document.getElementById('langBtn').click()`); await sleep(400);
    if (S) await shot(`${tag}_3b_language_menu`);
    await hidePop(); await key('Escape'); await sleep(300);
  }
  await ev(`document.getElementById('exportBtn').click()`); await sleep(500);
  r.export = await ev('__ovf()');
  if (S) await shot(`${tag}_4_export_menu`);
  await hidePop(); await key('Escape'); await sleep(300);
  // the command palette: empty, then a query
  await ev(`document.getElementById('cmdBtn').click()`); await sleep(500);
  if (S) await shot(`${tag}_5_palette`);
  await type('deform'); await sleep(400);
  r.palette = await ev('__ovf()');
  if (S) await shot(`${tag}_5b_palette_query`);
  await key('Escape'); await sleep(300);
  // the guide
  await ev(`document.getElementById('helpBtn').click()`); await sleep(900);
  r.guide = await ev('__ovf()');
  if (S) await shot(`${tag}_6_guide`);
  await key('Escape'); await sleep(300);
  // the Phase view
  const ph = await clickText('header button, .seg button, button', LANG === 'ru' ? 'Фаза' : 'Phase');
  await sleep(1800);
  r.phase = await ev('__ovf()');
  if (S) await shot(`${tag}_7_phase`);
  r.clickedPhase = ph;
  res[tag] = r;
}
res.logs = (await logs()).filter((l) => l.t === 'EXC' || l.t === 'error').slice(0, 10);
return res;
