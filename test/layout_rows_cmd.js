// The even-spacing check of the layout invariants (#470), over the rows declared in test/lib/layout.js INTENT.rows: each
// declared row that is on the page is even as it stands, and the same row with one member moved 3 px (a margin on the
// second member) is reported, so the check can fail; put back, it passes again. A row is only counted when its
// selector finds a visible row with at least three members, so the suite cannot pass over an empty page.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/layout_rows_cmd.js
// Prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}`;
const LIB = fs.readFileSync(path.join(DIR, '..', 'lib', 'layout.js'), 'utf8');
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const open = async (w, h, phone) => {
  await view(w, h, false, phone);
  await nav(`${U}/test.html?ns=lrows-${w}-${Date.now()}`); await settle(2800);
  await ev('__cmwExample(8); 1'); await settle(1500);
  await ev(LIB);
};
// the declared rows that are on the page now: their selectors, with a visible row of three members or more
const PRESENT = `(() => { const L = __layout; return L.INTENT.rows.filter((d) => [...document.querySelectorAll(d.sel)].some((r) => L.vis(r) && [...r.children].filter(L.vis).length >= 3)).map((d) => d.sel); })()`;
// move the second visible member of the first visible row of a selector by px (a margin), or put it back (px 0)
const NUDGE = (sel, px) => `(() => { const L = __layout, row = [...document.querySelectorAll(${JSON.stringify(sel)})].find((r) => L.vis(r) && [...r.children].filter(L.vis).length >= 3); const k = [...row.children].filter(L.vis)[1]; k.style.marginLeft = ${px} ? ${px} + 'px' : ''; k.style.marginTop = ''; return 1; })()`;

const seen = new Set();
for (const [w, h, phone] of [[1280, 800, false], [390, 844, true]]) {
  await open(w, h, phone);
  const here = await ev(PRESENT);
  info[`${w}`] = here;
  for (const sel of here) {
    seen.add(sel);
    const row = await ev(`(() => { const L = __layout; const r = [...document.querySelectorAll(${JSON.stringify(sel)})].find((r) => L.vis(r) && [...r.children].filter(L.vis).length >= 3); return L.desc(r); })()`);
    const count = () => ev(`__layout.evenSpacing().filter((v) => v.el === ${JSON.stringify(row)}).length`);
    ok(`${w}: ${sel} is even as it stands`, (await count()) === 0, row);
    await ev(NUDGE(sel, 3)); await settle(200);
    ok(`${w}: ${sel} with its second member moved 3 px is reported`, (await count()) === 1, row);
    await ev(NUDGE(sel, 0)); await settle(200);
    ok(`${w}: ${sel} put back is even again`, (await count()) === 0, row);
  }
}
ok('the declared rows seen on the page cover the horizontal ones (.seg at 1280; the phone\'s tool rail at 390)', seen.has('.seg') && seen.has(':root.ph #tools'), [...seen]);
return { pass: fails.length === 0, fails, info };
