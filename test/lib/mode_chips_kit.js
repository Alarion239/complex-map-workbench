// What the two mode-chip suites share: the page they open (a disc, a reciprocal and a sine), the probe of the tool and the
// chips, and a click by text. An expression for eval in a suite: `const K = eval(fs.readFileSync(...))` (the suite's own view,
// load, ev and settled are used).
({
  open: async () => {
    await view(1440, 900, false, false);
    await load('modechips' + Date.now(), { shapes: [{ id: 'a', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'recip', params: {}, on: true }, { type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
    await settled({ floor: 1500 });
  },
  st: () => ev(`(() => ({ tool: (document.querySelector('.tool[data-tool][aria-pressed="true"]') || { dataset: {} }).dataset.tool, chips: [...document.querySelectorAll('.mode-chip, .alone-chip:not([hidden])')].map((c) => c.textContent.replace(/\\s+/g, ' ').trim()), solo: document.getElementById('leftSolo').getAttribute('aria-pressed') + document.getElementById('rightSolo').getAttribute('aria-pressed'), merged: document.getElementById('panes').className }))()`),
  clickText: (sel, re) => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => ${re}.test(x.textContent)); if (b) b.click(); return !!b; })()`),
})
