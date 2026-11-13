// A language switch, which reloads the page: the language is set as the preference, then the suite waits until the new
// page is in that language (data-lang, which English leaves unset) and shows the element `sel`, and asserts it. While
// the page navigates, the new document may have no root element yet, which the condition reads as not there yet, and an
// evaluation that finds no page to run in is refused by the kit (caught, also not there yet). An expression for eval in
// a suite:
// `const { relang } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'relang_kit.js'), 'utf8'))({ ev, settled, sleep, ok });`
({ ev, settled, sleep, ok }) => {
  const POLL_MS = 200, POLLS = 100;   // how often the reloading page is looked at, and how many times at most
  const relang = async (lang, sel) => {
    await ev(`I18N.setPref('${lang}'), 1`);
    const there = `!!document.documentElement && (document.documentElement.dataset.lang || 'en') === '${lang}' && !!document.querySelector(${JSON.stringify(sel)})`;
    for (let i = 0; i < POLLS; i++) { let r = false; try { r = await ev(there); } catch (e) { r = false; } if (r === true) break; await sleep(POLL_MS); }
    ok(`${lang}: the page reloaded in ${lang} and shows ${sel}`, (await settled({ max: 8000, until: there })).ok, { lang, sel });
  };
  return { relang };
};
