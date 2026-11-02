// Esc leaves a Construct tool, and the tool is a chip in the plane's head with its pick count (issue #31, the steps view's
// part: ux keeps the tool chip and Listening along in the head, counted by svFitHead; the step-alone, expanded-plane and
// deformation chips are the classic views' and are mode_chips_classic_cmd.js). A command file for a CDP daemon.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'mode_chips_kit.js'), 'utf8')), st = K.st, clickText = K.clickText;
await K.open();
// a Construct tool shows in the head with its pick count, and Esc leaves it
await key('e'); await settled({ floor: 300 });
const s0 = await st();
ok('a Construct tool is a chip in the head with its count', s0.tool === 'circle3' && s0.chips.some((c) => /Circle through 3 points · 1 of 3/.test(c) && /Esc/.test(c)), s0);
await key('Escape'); await settled({ floor: 300 });
const s1 = await st();
ok('Esc leaves the Construct tool and its chip', s1.tool === 'select' && !s1.chips.some((c) => /Circle through/.test(c)), s1);
// (the chip takes room in the plane's head: at each width it is inside the pane, clear of the head's own controls, and the head fits)
for (const w of [1440, 1024]) {
  await view(w, 900, false, false); await settled({ floor: 600 });
  await key('e'); await settled({ floor: 500 });
  const g = await ev(`(() => { const c = document.querySelector('.mode-chip'), pane = document.getElementById('paneL').getBoundingClientRect(), hd = document.getElementById('svHead');
    if (!c || !c.getClientRects().length) return null; const b = c.getBoundingClientRect(), h = hd.getBoundingClientRect();
    const kids = [...hd.children].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect());
    return { inPane: b.left >= pane.left - 1 && b.right <= pane.right + 1, clear: kids.every((k) => k.right <= b.left + 1 || k.left >= b.right - 1 || k.bottom <= b.top + 1 || k.top >= b.bottom - 1), headFits: hd.scrollWidth <= hd.clientWidth + 1, w: Math.round(b.width) }; })()`);
  ok(`${w}: the Construct tool chip is in the pane, clear of the head's controls, and the head fits`, !!g && g.inPane && g.clear && g.headFits, g);
  await key('Escape'); await settled({ floor: 300 });
}
return { pass: fails.length === 0, fails, info };
