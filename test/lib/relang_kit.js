// A language switch, which reloads the page: the language is set as the preference, then the suite waits (the kit's reloaded) until
// the new document is loaded, in that language (data-lang, which English leaves unset) and shows the element `sel`, and asserts
// it. A call the reload cuts off is asked again by reloaded, and any other error in the page is thrown. A switch to the
// language the page is already in brings no new document, so the wait fails: a suite switches to another language. An
// expression for eval in a suite:
// `const { relang } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'relang_kit.js'), 'utf8'))({ ev, reloaded, ok });`
({ ev, reloaded, ok }) => {
  const relang = async (lang, sel) => {
    const old = await ev('performance.timeOrigin');
    await ev(`I18N.setPref('${lang}'), 1`);
    const there = `!!document.documentElement && (document.documentElement.dataset.lang || 'en') === '${lang}' && !!document.querySelector(${JSON.stringify(sel)})`;
    let err = null;
    try { await reloaded(old, there); } catch (e) {
      err = String((e && e.message) || e);
      if (!/^the page did not finish reloading within/.test(err)) throw e;
    }
    ok(`${lang}: the page reloaded in ${lang} and shows ${sel}`, !err, { lang, sel, err });
  };
  return { relang };
};
