// pseudo-localization matrix: widths x themes; base view, palette, guide, a menu; overflow lists
const OVF = OVF_SRC;
const res = {};
const W = [[360, 780, true], [390, 844, true], [768, 1024, true], [1024, 768, false], [1440, 900, false]];
for (const LANG of LANGS) for (const [w, hh, mob] of W) for (const dark of [false, true]) {
  const tag = `${LANG}_${w}_${dark ? 'dark' : 'light'}`;
  await view(w, hh, dark, mob);
  await nav(`http://localhost:8817/${PAGE}?ns=i18nm${w}${dark ? 'd' : 'l'}${LANG}&lang=${LANG}`);
  await sleep(2600);
  await ev(OVF);
  if (dark) await ev(`document.documentElement.setAttribute('data-theme','dark')`); else await ev(`document.documentElement.setAttribute('data-theme','light')`);
  await sleep(500);
  const r = { base: await ev('__ovf()') };
  if (SHOTS) await shot(`${tag}_a_base`);
  // the more menu on narrow widths, else the examples menu
  const more = await ev(`(() => { const b = document.getElementById('hdrMoreBtn'); return b && getComputedStyle(b).display !== 'none'; })()`);
  if (more) { await ev(`document.getElementById('hdrMoreBtn').click()`); await sleep(400); r.more = await ev('__ovf()'); if (SHOTS) await shot(`${tag}_b_more`); await ev(`document.getElementById('hdrMenu').hidePopover && document.getElementById('hdrMenu').hidePopover()`); await sleep(200); }
  else { await ev(`document.getElementById('examplesBtn').click()`); await sleep(500); r.examples = await ev('__ovf()'); if (SHOTS) await shot(`${tag}_b_examples`); await key('Escape'); await sleep(200); }
  // the command palette with a query
  await ev(`document.getElementById('cmdBtn').click()`); await sleep(400);
  await type('deform'); await sleep(300);
  r.palette = await ev('__ovf()'); if (SHOTS) await shot(`${tag}_c_palette`);
  await key('Escape'); await sleep(200);
  // the guide
  await ev(`document.getElementById('helpBtn').click()`); await sleep(700);
  r.guide = await ev('__ovf()'); if (SHOTS) await shot(`${tag}_d_guide`);
  await key('Escape'); await sleep(200);
  // the export menu and the language menu
  await ev(`document.getElementById('exportBtn').click()`); await sleep(400);
  r.export = await ev('__ovf()'); if (SHOTS) await shot(`${tag}_e_export`);
  await key('Escape'); await sleep(200);
  res[tag] = r;
}
return res;
