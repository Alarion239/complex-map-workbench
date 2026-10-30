// The Settings pop-over's Help rows (Tour, Guide, Shortcuts and Download offline page; issue #412): at least 44 px tall
// on the phone layout (390 x 844, touch), the 24 px of the desk layout (1440) unchanged, in English, Russian and
// Italian, none cut and all inside the pop-over. The test page has no offline entry, so the page's <meta name="cmw-offline">
// is set before the pop-over opens. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
for (const [w, h, touch] of [[390, 844, true], [1440, 900, false]]) {
  for (const lang of ['en', 'ru', 'it']) {
    const at = `${w} ${lang}`;
    await view(w, h, false, touch);
    await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=hr${w}${lang}${Date.now()}&lang=${lang}` });
    await sleep(2600); await settle();
    await ev(`(() => { const m = document.createElement('meta'); m.name = 'cmw-offline'; m.content = '8100000'; document.head.append(m); document.querySelector('#settingsBtn').click(); return 1; })()`); await settle(900);
    const g = await ev(`(() => {
      const pop = document.querySelector('.set-pop');
      if (!pop) return null;
      const pr = pop.getBoundingClientRect();
      return { n: pop.querySelectorAll('.set-help .set-link').length, rows: [...pop.querySelectorAll('.set-help .set-link')].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 40), h: Math.round(r.height), w: Math.round(r.width), cut: e.scrollWidth > e.clientWidth + 1, inside: r.left >= pr.left - 1 && r.right <= pr.right + 1 }; }) };
    })()`);
    info[at] = g && g.rows.map((r) => `${r.t} ${r.w}x${r.h}`);
    ok(`${at}: the pop-over opens with the four Help rows`, g && g.n === 4, g);
    if (!g) continue;
    for (const r of g.rows) {
      ok(`${at}: "${r.t}" is ${touch ? 'at least 44' : '24 (the desk keeps its height)'} px tall`, touch ? r.h >= 44 : r.h < 30, r);
      ok(`${at}: "${r.t}" is not cut and sits inside the pop-over`, !r.cut && r.inside, r);
    }
  }
}
return { pass: fails.length === 0, fails, info };
