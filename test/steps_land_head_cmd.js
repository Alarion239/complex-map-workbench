// The steps view's Landscape chrome (#846): the head is one row and the height axis reads evenly.
// - the head (the plane's title, its controls, the Height key's chip, the status light) is one row, under 44 px tall, at
//   1440, 1280 and 1024 px wide: the Height key's chip is in it, folded to its glyph (the .glyph class) at 1280 and 1024,
//   where the row is short of room, and keeping its words at 1920 and 1440 px;
// - the height axis (the last frame's labels, __cmwLandTicks) has no two labels less than 18 px apart on the screen, at
//   plane w₁ and w₂ at rest and held between them.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const headOf = () => ev(`(() => { const h = document.querySelector('#leftLegend') && document.querySelector('#leftLegend').parentNode, l = document.getElementById('leftLegend'); return h && l ? { h: Math.round(h.getBoundingClientRect().height), inHead: h.classList.contains('pane-head'), glyph: l.classList.contains('glyph'), w: Math.round(l.getBoundingClientRect().width) } : null; })()`);
info.head = {};
for (const w of [1920, 1440, 1280, 1024]) {
  await view(w, 900, false, false);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=landchrome${w}${Date.now()}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'in', surf: 'land', go: 1, now: true }); 1`);
  await settled({ max: 60000 });
  await ev(`await ${rAF2}; 1`);
  await settled({ max: 5000 });
  info.head[w] = await headOf();
  const r = info.head[w];
  ok(`${w} px: the head is one row (under 44 px)`, !!r && r.inHead && r.h < 44, r);
  if (w >= 1440) ok(`${w} px: the Height key chip keeps its words`, !!r && !r.glyph && r.w > 60, r);
  else ok(`${w} px: the Height key chip is folded to its glyph`, !!r && r.glyph && r.w < 40, r);
}
// ---- the height axis ----
await view(1440, 900, false, false);
info.ticks = {};
for (const x of [1, 1.5, 2]) {
  await ev(`__cmwSteps({ go: ${Math.floor(x)}, now: true }); 1`);
  await settled({ max: 60000 });
  if (x % 1) { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 60000 }); }
  await ev(`await ${rAF2}; 1`);
  const t = (await ev('JSON.stringify(__cmwLandTicks())')) || '[]';
  const ys = JSON.parse(t).sort((a, b) => a - b);
  info.ticks[x] = ys;
  const gap = ys.length > 1 ? Math.min(...ys.slice(1).map((y, i) => y - ys[i])) : 99;
  ok(`x = ${x}: the height axis has labels, none under 18 px from the next`, ys.length >= 2 && gap >= 18, ys);
}
return { pass: fails.length === 0, fails, info };
