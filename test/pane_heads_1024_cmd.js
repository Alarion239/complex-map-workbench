// The heads beside the Inspector at 1024 and 1100 px (issues #356, #357): with the example "Cayley, then cube" and its
// f₁ card selected, the Inspector open, Y's head keeps "Plane | Sphere" in words (no tab cut; its key chip folds to its
// glyph first, its value kept in its accessible name, then the head packs closer, then its status light goes) and the chain head cuts no control ("Clear
// chain" inside the head; the heading "Function chain" gives way first, kept for screen readers). At 1280 px nothing
// folds. en, ru, it. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const NAME = /^(Cayley, then cube|Кэли, затем куб|Cayley, poi il cubo)$/;
const probe = () => ev(`(() => {
  const R = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; };
  const tabs = document.getElementById('rightTabs'), chip = document.getElementById('rightLegend'), ph = document.querySelector('.pipe-head'), cc = document.getElementById('clearChain'), h2 = ph && ph.querySelector('h2');
  return { insp: !!document.getElementById('propsPanel') && document.getElementById('propsPanel').getClientRects().length > 0,
    tabs: tabs ? [...tabs.children].map((b) => [b.textContent, b.scrollWidth, b.clientWidth]) : null,
    tabsCut: !!tabs && (tabs.scrollWidth > tabs.clientWidth + 1 || [...tabs.children].some((b) => b.scrollWidth > b.clientWidth + 1)),
    chip: R(chip), glyph: !!chip && chip.classList.contains('glyph'), chipName: chip && chip.getAttribute('aria-label'), chipSum: chip && chip.querySelector('.lg-sum') ? chip.querySelector('.lg-sum').textContent : null,
    head: R(document.querySelector('#paneR .pane-head')), pipeHead: R(ph), clear: R(cc),
    clearCut: !!(cc && ph && (cc.getBoundingClientRect().right > ph.getBoundingClientRect().right + 0.5 || cc.scrollWidth > cc.clientWidth + 1)),
    pipeOver: !!ph && ph.scrollWidth > ph.clientWidth + 1, title: !!h2 && h2.getBoundingClientRect().width > 2, h2Text: h2 && h2.textContent };
})()`);
for (const lang of ['en', 'ru', 'it']) {
  for (const w of [1024, 1100, 1280]) {
    await view(w, 768, false, false);
    await send('Page.navigate', { url: `${U}?ns=ph${w}${lang}${Date.now() % 1000000}&lang=${lang}` }); await sleep(2500);
    for (let i = 0; i < 40 && !(await ev(`typeof __cmwExample === 'function' && !!document.querySelector('#examplesBtn')`)); i++) await sleep(250);
    if (lang !== 'en' && (await ev('I18N.lang')) !== lang) { await ev(`I18N.setPref('${lang}'), 1`); await settle(1200); }
    const found = await ev(`(() => { for (let i = 0; i < 120; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && ${NAME}.test(l.textContent)) return i; } return -2; })()`);
    await settle(1500);
    await ev(`(() => { const c = document.querySelector('#pipeline .card[data-k="1"]'); if (c) c.click(); return !!c; })()`);
    // (the heads settle once the Inspector has slid in and the strips are laid out)
    await settle(3500);
    const p = await probe(), at = `${w} px, ${lang}`;
    info[`${w}${lang}`] = p;
    ok(`${at}: the example is open with the Inspector on f₁`, found >= 0 && p.insp, { found, insp: p.insp });
    ok(`${at}: Y's head keeps Plane | Sphere in words (no tab cut)`, !p.tabsCut, p.tabs);
    ok(`${at}: the chain head cuts no control (Clear chain inside it)`, !p.clearCut && !p.pipeOver, { clear: p.clear, pipeHead: p.pipeHead });
    if (w === 1280) ok(`${at}: nothing folds at 1280 px (the key chip in words, the heading shown)`, !p.glyph && p.title, { glyph: p.glyph, title: p.title });
    // (a folded chip keeps its words as its name; the hidden heading keeps its text)
    // (ux's review: the folded chip's name still says what it shows, "cell 1")
    if (p.glyph) ok(`${at}: the folded key chip's accessible name keeps its value`, !!p.chipName && !!p.chipSum && p.chipName.startsWith(p.chipSum), [p.chipName, p.chipSum]);
    ok(`${at}: the chain heading keeps its text for screen readers`, !!p.h2Text, p.h2Text);
  }
}
await view(1440, 900, false, false);
return { pass: fails.length === 0, fails, info };
