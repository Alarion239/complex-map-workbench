// The export dialog on a phone (D12, issue #33): the print settings are folded behind one button, and open on a laptop.
// A command file for a CDP daemon; it needs no MathJax, only the dialog.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const shown = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!(e && e.getClientRects().length); })()`);
for (const [w, h, phone] of [[390, 844, true], [1440, 900, false]]) {
  await view(w, h, false, phone);
  await load('xsheet' + w + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
  await sleep(1500);
  await ev('__cmwExample(1); 1'); await sleep(1800);
  await key('e', 2); await sleep(2500);
  const tag = `${w}px`;
  if (phone) {
    ok(`${tag}: the Print settings button shows and the rows are folded`, (await shown('#xfPrintBtn')) && !(await shown('#xfSize')) && !(await shown('#xfFor')), null);
    ok(`${tag}: the folded button says aria-expanded=false (the export suite's helpers read it)`, (await ev(`document.getElementById('xfPrintBtn').getAttribute('aria-expanded')`)) === 'false', null);
    await ev(`document.getElementById('xfPrintBtn').click()`); await sleep(200);
    ok(`${tag}: pressing it shows the rows`, (await shown('#xfSize')) && (await shown('#xfFor')), await ev(`document.getElementById('xfPrintBtn').getAttribute('aria-expanded')`));
    ok(`${tag}: Save comes before Copy image`, await ev(`(() => { const b = [...document.querySelectorAll('.xf-foot .xf-dest')].filter((x) => !x.hidden).map((x) => x.id); return b.indexOf('xfSave') === 0 && b.includes('xfDocs'); })()`), null);
  } else {
    ok(`${tag}: no fold button, the rows are shown`, !(await shown('#xfPrintBtn')) && (await shown('#xfSize')) && (await shown('#xfFor')), null);
  }
  await key('Escape'); await sleep(400);
}
return { pass: fails.length === 0, fails };
