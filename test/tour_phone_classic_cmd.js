// The classic views' tour on a phone (the parts tour_phone_cmd.js, which runs in the steps view, cannot check): at 390 × 844
// the strip is the 68 px row under the header and X is 608 px high, under the 56 px chain bar (600 with a three-line row); and
// a sheet a step opens starts below the strip (the Views chapter's Phase key opens the Display sheet). English, touch.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, of, fails }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const IDLE = `!Tour.isActive() || (!document.querySelector('.tour-strip[aria-busy]') && !!Tour.lit() && !Tour.lit().moving)`;
const waitFails = [];
const { until } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails: waitFails });
const settle = (cond) => until(cond ? `(${cond}) && (${IDLE})` : IDLE);
for (const [w, h] of [[390, 844], [360, 780]]) {
  const tag = `${w}x${h}`;
  await view(w, h, false, true);
  await nav(`http://localhost:${PORT}/test.html?ns=phc${w}`); await settle();
  await ev('Tour.dismissSuggestion()'); await ev('Tour.auto(false)');
  await ev(`Tour.start({ chapter: 'basics' })`); await settle(`Tour.isActive()`);
  const g = await ev(`(() => { const s = document.querySelector('.tour-strip').getBoundingClientRect(), p = document.querySelector('#paneL').getBoundingClientRect();
    return { mode: document.querySelector('.tour-strip').dataset.mode, top: Math.round(s.top), head: Math.round(document.querySelector('header.top').getBoundingClientRect().bottom), paneH: Math.round(p.height), lines: Tour.lit().lines }; })()`);
  check(`${tag}: portrait, the strip is the row under the header${w === 390 ? '; X is 608 px (600 with a three-line row)' : ''}`, g.mode === 'port' && Math.abs(g.top - g.head) <= 1 && (w !== 390 || g.paneH === (g.lines === 3 ? 600 : 608)), g);
  await ev(`Tour.start({ chapter: 'views', step: 4 })`); await settle(`Tour.isActive() && Tour.current().chapter === 'views'`);
  const sh = await ev(`(() => { const s = [...document.querySelectorAll('.ph-sheet')].find((e) => !e.hidden && e.getClientRects().length); const t = document.querySelector('.tour-strip').getBoundingClientRect(); return s ? { sheet: Math.round(s.getBoundingClientRect().top), strip: Math.round(t.bottom), mode: document.querySelector('.tour-strip').dataset.mode } : null; })()`);
  check(`${tag}: a sheet the step opens starts below the strip`, !sh || sh.sheet >= sh.strip - 1 || sh.mode === 'head', sh);
  await ev('Tour.stop()'); await settle('!Tour.isActive()');
}
await view(1440, 900, false, false);
check('no wait timed out', !waitFails.length, waitFails);
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails };
