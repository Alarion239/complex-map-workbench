// What the two keyboard-navigation suites share: where the focus is, which area that is, and the page they open (two discs, a
// reciprocal and a sine). An expression for eval in a suite: `const K = eval(fs.readFileSync(...))` (the suite's own view, load,
// ev and settled are used).
({
  where: () => ev(`(() => { const a = document.activeElement; if (!a) return null; return { tag: a.tagName, id: a.id || '', cls: String(a.className).slice(0, 40), tool: a.dataset && a.dataset.tool || '', k: a.dataset && a.dataset.k || '', inTop: !!a.closest('#top'), inTools: !!a.closest('#tools'), inThread: !!a.closest('#svStrip'), inChain: !!a.closest('#pipeline'), inProps: !!a.closest('#propsPanel'), xCanvas: !!(a.parentElement && a.closest('#paneL')), yCanvas: !!a.closest('#paneR') }; })()`),
  // the area a `where()` answer is in (the thread is inside the plane's pane, so it is asked first)
  area: (w) => (w ? (w.inTop ? 'top' : w.inTools ? 'tools' : w.inThread ? 'thread' : w.xCanvas ? 'x' : w.yCanvas ? 'y' : w.inChain ? 'chain' : w.inProps ? 'inspector' : '?') : null),
  open: async () => {
    await view(1440, 900, false, false);
    await load('kbdnav' + Date.now(), { shapes: [{ id: 'a', kind: 'disc', c: [0, 0], r: 1 }, { id: 'b', kind: 'disc', c: [2, 0], r: 0.5 }], steps: [{ type: 'recip', params: {}, on: true }, { type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
    await settled({});
  },
})
