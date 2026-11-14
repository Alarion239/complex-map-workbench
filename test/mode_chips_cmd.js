// Esc leaves a Construct tool, and the tool is a chip in the plane's head with its pick count (the steps view's
// part: the tool chip and Listening along stay in the head, counted by svFitHead). A command file for a CDP daemon.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'mode_chips_kit.js'), 'utf8')), st = K.st;
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
// the Construct tool's chip stays in the head while a glide plays (#941): sampled through the glide, not only at rest.
// The slowest speed makes the glide long enough to sample from here (about 4.5 s a plane).
await key('e');
await settled({ max: 8000, until: `!!document.querySelector('.tool[data-tool="circle3"][aria-pressed="true"]')` });
await choose('#svStrip .sv-speed', 'slower');
const i0 = await ev('__cmwSteps().i');
// (sampled in the page, once a frame, from the glide's start to its rest: a round trip per sample is too slow for it)
await ev(`(() => { const rec = window.__glide941 = { chips: [], on: true };
  const frame = () => { if (!rec.on) return; const s = __cmwSteps();
    if (s.moving) rec.chips.push([...document.querySelectorAll('#modeChips .mode-chip')].map((c) => c.dataset.mode));
    else if (rec.chips.length) { rec.on = false; return; }
    requestAnimationFrame(frame); };
  __cmwSteps({ go: ${i0 + 1} }); requestAnimationFrame(frame); return 1; })()`);
await settled({ max: 20000, until: `!!window.__glide941 && window.__glide941.on === false` });
const glide = await ev('window.__glide941.chips');
ok('the glide ran and was sampled while it moved', glide.length >= 5, { samples: glide.length });
ok('the Construct tool chip is in the head on every frame of the glide', glide.length >= 5 && glide.every((c) => c.includes('tool')), { missing: glide.filter((c) => !c.includes('tool')).length, samples: glide.length });
await key('Escape');
await settled({ max: 8000, until: `!document.querySelector('.tool[data-tool="circle3"][aria-pressed="true"]') && !!document.querySelector('.tool[data-tool="select"][aria-pressed="true"]')` });

return { pass: fails.length === 0, fails, info };
