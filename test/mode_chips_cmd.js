// Esc leaves a Construct tool, and the tool is a chip in the plane's head with its pick count (issue #31, the steps view's
// part: ux keeps the tool chip and Listening along in the head, counted by svFitHead; the step-alone, expanded-plane and
// deformation chips are the classic views' and are mode_chips_classic_cmd.js). A command file for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('modechips' + Date.now(), { shapes: [{ id: 'a', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'recip', params: {}, on: true }, { type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1500);
const st = () => ev(`(() => ({ tool: (document.querySelector('.tool[data-tool][aria-pressed="true"]') || { dataset: {} }).dataset.tool, chips: [...document.querySelectorAll('.mode-chip, .alone-chip:not([hidden])')].map((c) => c.textContent.replace(/\\s+/g, ' ').trim()), solo: document.getElementById('leftSolo').getAttribute('aria-pressed') + document.getElementById('rightSolo').getAttribute('aria-pressed'), merged: document.getElementById('panes').className }))()`);
const clickText = (sel, re) => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => ${re}.test(x.textContent)); if (b) b.click(); return !!b; })()`);
// a Construct tool shows in the head with its pick count, and Esc leaves it
await key('e'); await settle(300);
const s0 = await st();
ok('a Construct tool is a chip in the head with its count', s0.tool === 'circle3' && s0.chips.some((c) => /Circle through 3 points · 1 of 3/.test(c) && /Esc/.test(c)), s0);
await key('Escape'); await settle(300);
const s1 = await st();
ok('Esc leaves the Construct tool and its chip', s1.tool === 'select' && !s1.chips.some((c) => /Circle through/.test(c)), s1);
// (the chip takes room in the plane's head: at each width it is inside the pane, clear of the head's own controls, and the head fits)
for (const w of [1440, 1024]) {
  await view(w, 900, false, false); await settle(600);
  await key('e'); await settle(500);
  const g = await ev(`(() => { const c = document.querySelector('.mode-chip'), pane = document.getElementById('paneL').getBoundingClientRect(), hd = document.getElementById('svHead');
    if (!c || !c.getClientRects().length) return null; const b = c.getBoundingClientRect(), h = hd.getBoundingClientRect();
    const kids = [...hd.children].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect());
    return { inPane: b.left >= pane.left - 1 && b.right <= pane.right + 1, clear: kids.every((k) => k.right <= b.left + 1 || k.left >= b.right - 1 || k.bottom <= b.top + 1 || k.top >= b.bottom - 1), headFits: hd.scrollWidth <= hd.clientWidth + 1, w: Math.round(b.width) }; })()`);
  ok(`${w}: the Construct tool chip is in the pane, clear of the head's controls, and the head fits`, !!g && g.inPane && g.clear && g.headFits, g);
  await key('Escape'); await settle(300);
}
return { pass: fails.length === 0, fails, info };
