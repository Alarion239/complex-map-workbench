// The classic view has no chain box under the plane while its cards are gone (#2269): the box (.pipe-wrap, whose #pipeline holds no
// cards and no text), its gutter and their rows take no room, and the panes reach the stage's foot. At 1440 x 900 and 1024 x 700, light and dark, in
// the classic view (?view=classic), once an example is loaded. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
for (const [w, h] of [[1440, 900], [1024, 700]]) {
  for (const dark of [false, true]) {
    const tag = `${w} x ${h}${dark ? ' dark' : ''}`;
    await view(w, h, dark, false);
    await go(`http://localhost:${PORT}/test.html?view=classic&ns=chainbox${w}${dark ? 'd' : 'l'}${Date.now() % 100000}`);
    await settled({ max: 30000, until: 'typeof __cmwExample === "function" && !document.documentElement.classList.contains("sv")' });
    await ev(`__cmwExample(1), 1`);
    await settled({ max: 20000, until: `!!document.getElementById('paneL') && document.getElementById('paneL').getBoundingClientRect().height > 100` });
    const m = info[tag] = await ev(`(() => { const R = (e) => e ? e.getBoundingClientRect() : null, wrap = document.querySelector('.pipe-wrap'), pl = document.getElementById('pipeline'), st = document.getElementById('stage'), panes = document.getElementById('panes');
      return { cards: pl ? pl.querySelectorAll('.card').length : -1, text: pl ? pl.textContent.trim().length : -1, boxShown: !!wrap && wrap.getClientRects().length > 0,
        boxH: wrap ? Math.round(wrap.getBoundingClientRect().height) : null, gap: Math.round(R(st).bottom - R(panes).bottom), stageH: Math.round(R(st).height) }; })()`);
    ok(`${tag}: the chain holds no cards and no text (what this suite is about)`, m.cards === 0 && m.text === 0, m);
    ok(`${tag}: the empty chain box is not on screen`, !m.boxShown, m);
    ok(`${tag}: the panes reach the stage's foot (within 2 px)`, m.gap <= 2, m);
  }
}
return { pass: fails.length === 0, fails, info };
