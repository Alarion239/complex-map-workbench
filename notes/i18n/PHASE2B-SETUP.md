# Russian localization: phase 2b setup in work/xb (2026-10-22)

User request: "Can you add russian localization if system language is russian?"

This step puts the i18n core and the Russian table into `work/xb`. Nothing in the app calls it yet. The visible
interface is still English in every language. Phase 2b wraps the strings.

## Which core

- `src/i18n.js` is phase 2a's final module, a byte-identical copy of `work/xi/src/i18n.js`. Its test passes in xi:
  `node work/xi/test/t_i18n.js` gives "all 3890 checks pass". The prototype (`notes/i18n/proto/i18n.js`) was not used.
- `src/i18n_ru.js` is the shipped table. It was made in xb by xi's generator, `tools/make_ru_table.py` (identical
  copy), from the current `notes/i18n/ru` tables (last changed at 21:09, round 4). Run at 22:12: 1642 entries, 0 call
  sites, 0 unresolved, 15 collisions.
- xi's own table has 1676 entries. The 34 extra keys belong to the call sites xi wrapped in parse.js, funcs.js and the
  others. xb does not have those files yet, so its table does not have those keys.

## What changed in work/xb

- `build.py`: three lines after the MathJax block put `i18n.js` and `i18n_ru.js` first, before cx.js. Lines 1 to 11
  are the same as in `work/xb-base`, so the 3-way merge with xr stays clean. These are the same lines as in xi.
- New files:
  - `src/i18n.js` (copy of xi) and `src/i18n_ru.js` (generated).
  - `tools/make_ru_table.py` and `tools/ru_extra.json` (copies of xi).
  - `tools/ru_report.json` and `tools/ru_collisions.json` (generated).
  - `test/t_i18n_keys.js` and `test/i18n_sites.js` (copies of xi).
  - `test/xb_core_cdp/`: the headless Chrome kit on port 8881, with the checks in `cmd/`.
- No other file in `src/` changed.

## The API (all of it in src/i18n.js)

The key is the English source text. In English every call returns its argument, with placeholders filled. Nothing
else runs, and the table string is never parsed.

- `$t(s, params)`: translate `s`. Placeholders are `%{name}` always, and `{name}` only in a template without TeX.
- `$tx(ctx, s, params)`: the same with a context, for one English word with two Russian ones. The key is
  `ctx + '\u0004' + s`. Example: `$tx('tool', 'Circle')`.
- `$tn(one, many, n, params)`: plurals. `{n}` is filled with `I18N.num(n)`. Russian entries have `one`, `few`, `many`,
  `other`.
- `I18N.parts(s, params, ctx)`: the translated template split into `[text, value, text, ...]`. Use it when slots hold
  DOM nodes or caption segments.
- `I18N.using(lang, fn)`: run synchronous code in another language, for example an English caption from the Russian
  interface. Do not await inside it. `I18N.at(lang)` returns the same functions bound to one language.
- `I18N.lang` (current), `I18N.uiLang` (the page's), `I18N.readPref()` ('auto', 'en', 'ru'), `I18N.setPref(v)`.
- Numbers: `I18N.num(x)` (screen: `0,5`), `I18N.nums(list)`, `I18N.texNum(x)` and `I18N.texDecimal(x)` (`0{,}5`),
  `I18N.texSep`, `I18N.texInterval(a, b, br)`. Inputs and copied values keep the point.
- Text: `I18N.list(items, 'and'|'or')`, `I18N.quote(s)` («»), `I18N.nbsp(s)`, `I18N.nbspTeX`, `I18N.pdfText`.
- Notation: `I18N.notation(tex, lang, opts)` turns `\tan` into `\operatorname{tg}` and so on in Russian. It is
  idempotent. `I18N.fnName(name)` does the same for plain text (`sinh` to `sh`).
- Page: `I18N.applyPage()` sets `<html lang>`, `data-lang` and the font link (nothing in English).
  `I18N.applyStatic(root)` translates static markup. `I18N.onFonts(fn)` registers the canvas redraw.
- Keys: `I18N.keyOf(e)` (shortcuts on a Russian keyboard layout), `I18N.isPaletteSlash(e)`.
- Switching: `I18N.onSwitch(save, fail)`. `setPref` writes the setting, calls `save`, and reloads. If storage is
  blocked, nothing reloads and `fail('storage')` is called.
- Tests and tools: `I18N.define(lang, json)`, `I18N.load`, `I18N.names`, `I18N.fill`, `I18N.pluralKey`,
  `I18N.missing` (lookup misses under `?lang=` or `?i18n-debug`), `I18N._store`, `I18N._setLang`.

Detection runs once, when the page loads. The order is `?lang=en|ru|pseudo` (tests only), then the stored setting
`cmw-lang` (`cmw-lang:<ns>` under `?ns=`), then English under `?ns=`, then `navigator.languages[0]`. Only `ru` and
`ru-*` give Russian.

DESIGN.md has the full design. PHASE2A.md lists what phase 2b must still do in app.js, page.html, figure.js, tour.js
and sound.js.

## How to regenerate the table

From `work/xb`:

1. `python3 tools/make_ru_table.py`. It writes `src/i18n_ru.js`, `tools/ru_report.json` and
   `tools/ru_collisions.json`. Add `--strict` to fail on any call site without Russian.
2. `node test/t_i18n_keys.js`.
3. `python3 build.py`.

Run it after every new `$t`/`$tx`/`$tn` call site and after every change to `notes/i18n/ru/*.json` or
`tools/ru_extra.json`.

Two notes on the tests:

- `node test/t_i18n_keys.js` fails in xb today with "FAIL call sites found: 0". It needs at least one call site. It
  passes once the first string is wrapped, or after the merge with xi.
- xi's `test/t_i18n.js` is not copied. Its module and table checks pass in xb. Its parser section (section 7) needs
  xi's parse.js, so in xb it gives 24 parser FAILs and then throws. It comes with the xi merge.

When xi is merged into xb, do not merge the generated files (`src/i18n_ru.js`, `tools/ru_report.json`,
`tools/ru_collisions.json`). Take either side and re-run the generator. `src/i18n.js`, the tools and the two tests are
identical on both sides.

## How to open the app in Russian in headless Chrome

1. Build: `python3 build.py` in `work/xb`.
2. Serve: `python3 -m http.server 8881 --bind 127.0.0.1` in `work/xb/dist`. Use your own port if you copy the kit.
3. Start the daemon: `node test/xb_core_cdp/cdpd.js` (in the background) and wait for `test/xb_core_cdp/q/READY`.
   Or copy `test/cdp_kit` to `test/<you>_cdp` and replace port 8793 with yours.
4. Open the app in Russian, in one of three ways:
   - `nav('http://localhost:8881/test.html?ns=<you>&lang=ru')`. `?lang=` is for tests only.
   - The stored setting: `ev("localStorage.setItem('cmw-lang:<you>', 'ru')")`, then
     `nav('http://localhost:8881/test.html?ns=<you>')`. Without `?ns=`, the key is `cmw-lang`.
   - A Russian browser: `send('Emulation.setUserAgentOverride', { userAgent: '...', acceptLanguage: 'ru-RU,ru,en' })`
     before `nav`. Under `?ns=` the page stays English on a Russian browser, by design. So test this without `?ns=`.
5. Check with `ev("I18N.lang")` and `ev("$t('Hide')")`, which gives «Скрыть».
6. At the end: `touch test/xb_core_cdp/q/QUIT`, stop the server, and delete `test/xb_core_cdp/chprof-*`.

The published file `dist/complex-map-workbench.html` has no `<meta charset>`, because the publish step adds the
skeleton. `http.server` sends no charset, so the browser misreads it and app.js throws a regex SyntaxError. The base
build does the same. To test that file locally, wrap it first:
`(printf '<!doctype html><meta charset="utf-8">\n'; cat complex-map-workbench.html) > pub_utf8.html`.

## Checks run (all pass)

Headless Chrome, `test/xb_core_cdp/cmd/`:

- `en.js` (English, against `dist/base_test.html`, which is built from `work/xb-base` and is unchanged since 21:16):
  - At 1440 light, 1440 dark and 390 (phone), there are no console errors.
  - `I18N.lang` is `en`. `$t('Hide')` gives `Hide`, `$tn` gives `5 shapes`, `\tan z` and `0.5` are unchanged.
  - `<html lang>` is untouched and no font link is added.
  - `document.body.innerText` and the `#app` markup are equal to the base build.
- `pix.js` (English pixels): base and this build were each loaded twice, with each screenshot taken once the page is
  still. Base against this build differs by 0 pixels at 1440 light, 1440 dark and 390. At 1440 light, the first and
  second loads differ by 24602 pixels in both builds alike. That is page state, not this change.
- `ru.js` (Russian):
  - `?lang=ru`, the stored `cmw-lang:<ns>` = `ru`, `I18N.setPref('ru')` (it reloads), and a `ru-RU` browser all give
    `I18N.lang` = `ru`. `$t('Hide')` gives «Скрыть», `$tn` gives «5 фигур», `\operatorname{tg} z` and `0{,}5`.
  - `setPref('auto')` goes back to English. `?ns=` on a `ru-RU` browser stays English.
  - There are no console errors.
- `pub.js` (the published page, without test hooks, wrapped with a charset): English with no errors and 0 `__cmw`
  globals. `?lang=ru` and the stored `cmw-lang` give «Скрыть», «3 фигуры», `0,25`. It opens `dist/pub_utf8.html`.
  That file was deleted afterwards, so make it again with the one-liner above before re-running.

Size: the test page is 701 KB gzip in the base and 774 KB with the table (+73 KB).

Not run here: the quality and perf suites. The task did not need them, and English pixels were compared directly.

## Left for phase 2b

Everything in PHASE2A.md under "What phase 2b must do". In short:

- Merge xi.
- Add cyr.js to the i18n line in build.py.
- In page.html: the globe button, the tablet More menu, the `data-i18n` marks and the font rule.
- In app.js: init (`applyPage`, `applyStatic`, `onSwitch`, `onFonts`, `keyOf`), the palette Language commands,
  `I18N.notation` at the TeX display boundary, and wrapping the strings.
- Wrap figure.js, tour.js and sound.js.
- Then re-run the generator with `--strict`, the tests, the Russian browser matrix, and the English quality and perf
  suites.
