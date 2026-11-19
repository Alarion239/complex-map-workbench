// The even-spacing check of the layout invariants (#470), over the rows declared in test/lib/layout.js INTENT.rows: each
// declared row that is on the page is even as it stands, and the same row with one member moved 3 px (a margin on the
// second member, along the row's own axis) is reported, so the check can fail; put back, it passes again. Legs: a desktop,
// a portrait phone, and a landscape phone (where the tool rail is a column-reverse column, which a vertical nudge must
// move the check on). A row is only counted when its selector finds a visible row with at least three members, so the
// suite cannot pass over an empty page. A row that wraps onto a second line has no one gap and is not reported.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/layout_rows_cmd.js
// Prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}`;
const LIB = fs.readFileSync(path.join(DIR, '..', 'lib', 'layout.js'), 'utf8');
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// the page side: the first visible row of a declared selector with at least three visible members (evenSpacing's own filter),
// the declared selectors that have one, and a move of the row's second member along the row's own axis (a margin, px; 0 puts it back)
const HELP = `window.__rows = (() => {
  const L = __layout, members = (r) => [...r.children].filter(L.vis);
  const of = (sel) => [...document.querySelectorAll(sel)].find((r) => L.vis(r) && members(r).length >= 3);
  const horizontal = (r) => { const b = members(r).map((k) => k.getBoundingClientRect()); const ext = (lo, hi) => Math.max(...b.map((x) => x[hi])) - Math.min(...b.map((x) => x[lo])); return ext('left', 'right') >= ext('top', 'bottom'); };
  return {
    of, members,
    present: () => L.INTENT.rows.map((d) => d.sel).filter((sel) => !!of(sel)),
    count: (sel) => L.evenSpacing().filter((v) => v.el === L.desc(of(sel))).length,
    nudge: (sel, px) => { const r = of(sel), k = members(r)[1], prop = horizontal(r) ? 'marginLeft' : 'marginTop'; k.style[prop] = px ? px + 'px' : ''; return prop; },
  };
})(); 1`;
const open = async (w, h, phone) => {
  await view(w, h, false, phone);
  await nav(`${U}/test.html?ns=lrows-${w}x${h}-${Date.now()}`);
  await ev(LIB); await ev(HELP);
  await ev('__cmwExample(8); 1');
  // (the example drawn: some declared row is on the page)
  const r = await settled({ max: 30000, only: true, until: '__rows.present().length > 0' });
  ok(`${w}x${h}: a declared row is on the page`, r && r.ok !== false, r);
};
const NUDGE = 3, SEEN = new Set();
// a leg: every declared row on the page, moved by `px` along its own axis
const leg = async (name, px) => {
  const here = await ev('__rows.present()');
  info[name] = here;
  for (const sel of here) {
    SEEN.add(`${name} ${sel}`);
    ok(`${name}: ${sel} is even as it stands`, (await ev(`__rows.count(${JSON.stringify(sel)})`)) === 0, sel);
    const prop = await ev(`__rows.nudge(${JSON.stringify(sel)}, ${px})`);
    // (evenSpacing reads the boxes, which lays the page out: no wait for the margin)
    ok(`${name}: ${sel} with its second member moved ${px} px (${prop}) is reported`, (await ev(`__rows.count(${JSON.stringify(sel)})`)) === 1, prop);
    await ev(`__rows.nudge(${JSON.stringify(sel)}, 0)`);
    ok(`${name}: ${sel} put back is even again`, (await ev(`__rows.count(${JSON.stringify(sel)})`)) === 0, sel);
  }
};

await open(1280, 800, false);
await leg('1280x800', NUDGE);
await open(390, 844, true);
await leg('390x844', NUDGE);
// a row that wraps onto a second line has no one gap, so it is not reported however its gaps fall (the classic phone's Display sheet wraps
// its Phase style tiles into two lines): the first declared row on this page, made to wrap three to a line with its first member OFF px
// off, in a row SLACK px wider than the three of them
{
  const PER_LINE = 3, OFF = 9, SLACK = 2;
  const sel = (await ev('__rows.present()'))[0];
  const w = await ev(`(() => { const R = __rows, row = R.of(${JSON.stringify(sel)}), ks = R.members(row); row.style.cssText += ';display:flex;flex-wrap:wrap;width:' + (ks[0].getBoundingClientRect().width * ${PER_LINE} + ${OFF + SLACK}) + 'px'; ks[0].style.marginRight = '${OFF}px'; const tops = new Set(ks.map((k) => Math.round(k.getBoundingClientRect().top))); return { lines: tops.size, found: R.count(${JSON.stringify(sel)}) }; })()`);
  ok(`${sel} made to wrap, ${PER_LINE} to a line, is not reported`, w.lines >= 2 && w.found === 0, w);
}
// the landscape phone: the tool rail is a column (column-reverse), so it is nudged vertically, 6 px as ux measured it
await open(740, 360, true);
await leg('740x360', 6);
ok('the legs saw .seg on the desktop, the tool rail on the portrait and the landscape phone',
  SEEN.has('1280x800 .seg') && SEEN.has('390x844 :root.ph #tools') && SEEN.has('740x360 :root.ph #tools'), [...SEEN]);
return { pass: fails.length === 0, fails, info };
