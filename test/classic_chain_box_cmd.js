// The classic view has no chain box under the plane while its cards are gone (#2269): the box (.pipe-wrap, whose #pipeline holds no
// cards and no text), its gutter and their rows take no room, and the panes reach the stage's foot; a message (toast) then stands at the planes' foot,
// between the zoom columns, and meets no zoom column, readout or colour key. At 1440 x 900 and 1024 x 700, light and dark, in the classic view
// (?view=classic), once an example is loaded. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
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
    // a message at the planes' foot: where placeToasts puts it, once it stops moving
    await ev(`__cmwToast('Colour plane: z', 'Undo'); 1`);
    await settled({ max: 10000, until: `!!document.querySelector('#toastHost .toast')` });
    await settled({ max: 10000, until: `(() => { const r = document.querySelector('#toastHost .toast').getBoundingClientRect(), k = r.top + ',' + r.left, same = window.__toastKey === k; window.__toastKey = k; return same; })()` });
    const t = info[tag + ' toast'] = await ev(`(() => { const T = document.querySelector('#toastHost .toast').getBoundingClientRect(), P = document.getElementById('panes').getBoundingClientRect();
      const hit = [...document.querySelectorAll('#paneL .viewstack, #paneR .viewstack, #leftReadout, #rightReadout, #leftLegend, #rightLegend')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { n: e.id || e.className, r: [r.left, r.top, r.right, r.bottom].map(Math.round) }; })
        .filter(({ r }) => r[2] > r[0] && r[3] > r[1] && T.left < r[2] && T.right > r[0] && T.top < r[3] && T.bottom > r[1]).map((x) => x.n + ' ' + x.r.join(','));
      return { toast: [T.left, T.top, T.right, T.bottom].map(Math.round), panesBottom: Math.round(P.bottom), hit, placed: document.getElementById('toastHost').getAttribute('data-placed') }; })()`);
    ok(`${tag}: a message stands at the planes' foot (its bottom within 40 px above it)`, t.toast[3] <= t.panesBottom && t.toast[3] >= t.panesBottom - 40, t);
    ok(`${tag}: a message meets no zoom column, readout or colour key`, t.hit.length === 0, t);
  }
}
return { pass: fails.length === 0, fails, info };
