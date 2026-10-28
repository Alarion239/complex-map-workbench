// Screenshots of every view of the Russian interface at 1440 and 390 px, light and dark (phase 2b,
// notes/i18n/shots-2b/final/). Run with a copy of test/cdp_kit: test/<you>_cdp/q.sh test/i18n_shots_cmd.js; the PNGs land
// in <kit>/shots/ru-<width>-<theme>-<view>.png. Result: the list of names and any console errors.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const names = [];
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const esc = async () => { await key('Escape'); await sleep(150); await key('Escape'); await sleep(250); };
logs();
for (const w of [1440, 390]) {
  for (const dark of [false, true]) {
    const phone = w < 768, tag = `ru-${w}-${dark ? 'dark' : 'light'}`;
    const snap = async (v) => { const n = `${tag}-${v}`; await shot(n); names.push(n); };
    await view(w, phone ? 844 : 900, dark, phone);
    await nav(`${U}?ns=i18n-shots-${w}-${dark ? 'd' : 'l'}-${Date.now()}&lang=ru`); await settle(4000);
    await snap('01-xy');
    await ev(`__cmwSetMain('phase'), 1`); await settle(1800); await snap('02-phase');
    await ev(`__cmwSetMain('land'), 1`); await settle(2200); await snap('03-landscape');
    await ev(`__cmwSetMain('xy'), 1`); await settle(800);
    await ev(`__cmwSetView('L', 'sphere'), __cmwSetView('R', 'sphere'), 1`); await settle(2000); await snap('04-spheres');
    await ev(`__cmwSetView('L', 'plane'), __cmwSetView('R', 'plane'), 1`); await settle(800);
    await ev(`__cmwMorph({ open: true }), 1`); await settle(800); await ev(`__cmwMorph({ T: 0.6 }), 1`); await settle(1500); await snap('05-deformation');
    await ev(`__cmwMorph({ open: false }), 1`); await settle(500);
    // a chain with zeros and poles, its card focused (the guarantees and the zero-pole fields)
    await ev(`__cmwExample(3), 1`); await settle(2500);
    await ev(`(() => { const c = document.querySelectorAll('#pipeline .card'); c.length && c[c.length - 1].click(); })()`); await settle(1200); await snap('06-example-card');
    await ev(`__cmwExample(10), 1`); await settle(3000); await snap('06b-roots');
    await key('k', 4); await settle(400); await type('tg'); await settle(700); await snap('07-palette'); await esc();
    await ev(`(() => { if (getComputedStyle(document.getElementById('hdrMoreBtn')).display !== 'none') document.getElementById('hdrMoreBtn').click(); })()`); await settle(400);
    if (phone) { await snap('08-more-menu'); }
    await ev(`(document.getElementById('settingsBtn') || {}).click && document.getElementById('settingsBtn').click(), 1`); await settle(600); await snap('09-language-menu'); await esc();   // ([v17 D5] Language is in Settings)
    await ev(`document.getElementById('examplesBtn').click(), 1`); await settle(1500); await snap('10-examples'); await esc();
    await key('?'); await settle(1500); await snap('11-guide'); await esc();
    await key('e', 4); await settle(3500); await snap('12-export-dialog'); await esc(); await settle(500);
    await ev(`(() => { const m = document.getElementById('hdrMoreBtn'); if (getComputedStyle(m).display !== 'none') m.click(); })()`); await settle(300);
    await ev(`document.getElementById('soundMore').click(), 1`); await settle(800); await snap('13-sound'); await esc();
    await ev(`Tour.start({ chapter: 'basics', step: 2 }), 1`); await settle(2500); await snap('14-tour'); await ev(`Tour.stop(), 1`); await settle(800);
    await ev(`Tour.openHelpMenu && Tour.openHelpMenu(document.getElementById('helpBtn')), 1`); await settle(700); await snap('15-help-menu'); await esc();
  }
}
await view(1440, 900, false, false);
return { names, errors: logs().filter((l) => /error|exception/i.test(JSON.stringify(l)) && !/favicon|404/.test(JSON.stringify(l))).slice(0, 5) };
