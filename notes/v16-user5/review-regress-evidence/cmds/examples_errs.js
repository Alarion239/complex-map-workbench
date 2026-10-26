// Console errors and warnings in every example: each view, the deformation playing, All sheets on in Landscape, the
// export dialog's preview; the merged build (ta) and v16, EN and RU.
const BASE = 'http://localhost:9707/';
const bad = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'warning' || x.t === 'log-error' || x.t === 'log-warning') && !/Failed to load resource|404|favicon/.test(x.m || ''));
const out = { rows: [] };
const LANGS = globalThis.__EX_LANGS || ['', 'ru'];
for (const [build, lang] of [['ta', ''], ['ta', 'ru'], ['v16', '']]) {
  {
    const ns = `rrex${build}${lang}${Date.now()}`;
    await load(ns, {});
    await nav(`${BASE}${build === 'v16' ? 'v16/' : ''}test.html?ns=${ns}${lang ? '&lang=' + lang : ''}`);
    await sleep(2000);
    await logs();
    const n = await ev('(() => { let i = 0; try { for (; i < 60; i++) { if (!document) break; } } catch (e) {} return 0; })()');
    for (let i = 0; i < 14; i++) {
      const r = await ev(`(() => { try { const before = JSON.stringify(__cmwP().steps); __cmwExample(${i}); return 1; } catch (e) { return 'ERR ' + e.message; } })()`);
      await sleep(1200);
      const name = await ev(`(() => { const e = document.querySelector('#exName, .ex-title'); return document.title + ' | ' + JSON.stringify(__cmwP().steps.map((s) => s.type)); })()`);
      const row = { build, lang, i, name, errs: [] };
      if (r !== 1) { row.load = r; }
      for (const main of ['xy', 'phase', 'land']) {
        await ev(`__cmwSetMain('${main}')`); await sleep(700);
        if (main === 'land') { await ev(`__cmwSet('sheets', true)`); await sleep(900); row.landCap = await ev(`typeof __cmwCapText === 'function' ? (() => { try { return __cmwCapText(['L']).slice(-220) + ' || ' + __cmwLandSheets().title; } catch (e) { return 'CAPERR ' + e.message; } })() : null`); }
        await ev('__cmwMorph({ open: true, playing: false })'); await sleep(500);
        await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(700);
        await ev('__cmwMorph({ T: 0.5 })'); await sleep(300);
        const cap = await ev(`typeof __cmwCapText === 'function' ? (() => { try { return __cmwCapText(['L']).slice(0, 300); } catch (e) { return 'CAPERR ' + e.message; } })() : null`);
        if (cap && /CAPERR/.test(cap)) row.errs.push({ main, t: 'cap', m: cap });
        await ev('__cmwMorph({ open: false })'); await sleep(300);
        if (main === 'land') { await ev(`__cmwSet('sheets', false)`); await sleep(300); }
        for (const e of bad(await logs())) row.errs.push({ main, t: e.t, m: e.m.slice(0, 300) });
      }
      out.rows.push(row);
      // stop after the last example (loadExample past the end does nothing: the steps stay the same)
    }
  }
}
return out;
