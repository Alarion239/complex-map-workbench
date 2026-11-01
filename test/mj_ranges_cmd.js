// (#288) MathJax 4's STIX2 font loads its rarer ranges (Cyrillic, calligraphic, Fraktur, ...) on demand, and throws
// (e.retry) only for the first formula that asks for a range still loading: another formula with a letter of it comes
// back with that letter as <text> in a system font. Each typesetting path waits for the range and sets such a formula
// again, never keeping the <text>: TeX.set (the interface: two formulas set at once), the figure export's builder
// (export.js) and the figure composer (the export dialog), on a Russian figure whose words are Cyrillic.
// MathJax: where the page has none (a container without the CDN) nothing here can run.
// A command file for a CDP daemon (test/cdp_kit README).
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const mjReady = async () => { for (let i = 0; i < 60; i++) { if (await ev(`!!(window.MathJax && typeof MathJax.tex2svg === 'function' && window.__cmwTeX && __cmwTeX.ready)`)) return true; await sleep(500); } return false; };
await view(1440, 900, false, false);
await load('mjr' + Date.now(), { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 80 } });
await sleep(1500);
info.mathjax = await mjReady();
if (info.mathjax) {
  // the interface in English: two formulas with the same Cyrillic letter (a range English never asks for), at once
  await ev(`(() => { window.__mjTwo = [0, 1].map((i) => { const s = document.createElement('span'); document.body.append(s); __cmwTeX.set(s, i ? '\\\\text{ж}+1' : '\\\\text{ж}'); return s; }); return 1; })()`);
  let two = null;
  for (let i = 0; i < 40; i++) { two = await ev(`__mjTwo.map((s) => ({ fb: !!s.querySelector('.tex-fallback'), text: s.querySelectorAll('text').length, paths: s.querySelectorAll('path, use').length }))`); if (two.every((t) => !t.fb && t.paths)) break; await sleep(250); }
  ok('TeX.set: two formulas with a letter of a range loading at once are both set from the font, no <text>', two.every((t) => !t.fb && t.paths > 0 && t.text === 0), two);

  // a Russian figure: a fresh page in Russian (this tab's language setting), an example with a caption, built at once
  const ns = 'mjr-ru' + Date.now();
  await load(ns, { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 80 } }, `localStorage.setItem('cmw-lang:${ns}', 'ru')`);
  if (await mjReady()) {
    info.lang = await ev('I18N.lang');
    await ev('__cmwExample(1); 1'); await sleep(300);
    await ev(`window.__mjFig = null; __cmwBuildFigure({ caption: true }).then((f) => { window.__mjFig = f && f.svg ? { svg: f.svg, cap: String(f.captionTex) } : ''; }, (e) => { window.__mjFig = 'ERR ' + e; }); 1`);
    let svg = null;
    for (let i = 0; i < 120 && svg == null; i++) { await sleep(500); svg = await ev('window.__mjFig'); }
    // (cyr: the caption has Cyrillic words, which the SVG sets as glyph paths)
    const cnt = (f) => ({ len: String((f && f.svg) || '').length, text: (String((f && f.svg) || '').match(/<text\b/g) || []).length, cyr: /[\u0400-\u04ff]/.test((f && f.cap) || '') });
    info.exportFig = cnt(svg);
    ok('the figure export (export.js), in Russian: built, every word set from the font (no <text>)', info.exportFig.len > 1000 && info.exportFig.cyr && info.exportFig.text === 0, info.exportFig);
    // the export dialog's figure (the composer, src/figure/)
    await key('e', 2);
    let done = false;
    for (let i = 0; i < 90 && !done; i++) { await sleep(500); done = await ev(`(() => { const e = document.querySelector('.xf-wait'); return !!document.querySelector('.xf-dlg, .xf-scroll') && (!e || e.hidden); })()`); }
    info.dialogFig = cnt(await ev(`(() => { const f = Figure.last(); return f ? { svg: String(f.svg), cap: String(f.captionTex) } : null; })()`));
    ok('the export dialog\'s figure (the composer), in Russian: built, every formula set from the font (no <text>)', done && info.dialogFig.len > 1000 && info.dialogFig.text === 0, info.dialogFig);
    await key('Escape'); await sleep(400);
  } else ok('MathJax loads in Russian', false, null);
}
return { pass: fails.length === 0, fails, info };
