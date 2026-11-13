// In the steps view a step's chip shows its whole name: a step takes the width its chip needs, and a thread wider than its
// rail scrolls in it rather than cutting a name with an ellipsis. The default chain at 1440 and 1280 px, in en, ru and it.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// a wait on the page's own state; a timeout is a failed check by the caller reading its result
const ready = async (expr, max = 20000) => (await settled({ until: expr, max, only: true })).ok;
// each step chip's name: its text, and whether it is cut (its text is wider than the room it has)
const probe = `(() => {
  const rail = document.querySelector('#svStrip .sv-rail');
  const names = [...rail.querySelectorAll('.sv-step .sv-fchip .sv-fn')].map((n) => ({ t: n.textContent, w: n.scrollWidth, room: n.clientWidth }));
  const steps = [...rail.querySelectorAll('.sv-step')].map((s) => Math.round(s.getBoundingClientRect().width));
  return { names, steps, cut: names.filter((n) => n.w > n.room).map((n) => n.t), railW: rail.clientWidth, scrollW: rail.scrollWidth };
})()`;
for (const w of [1440, 1280]) {
  for (const lang of ['en', 'ru', 'it']) {
    const tag = `${lang} ${w}`;
    await view(w, 900, false, false);
    await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=chipname${Date.now()}&lang=${lang}&view=steps` });
    const up = await ready('!!window.__cmwSteps && __cmwSteps().on && document.querySelectorAll("#svStrip .sv-step").length > 1');
    ok(`${tag}: the steps view is up with its steps`, up, null);
    const p = await ev(probe);
    ok(`${tag}: every step chip shows its whole name`, p.names.length > 1 && p.cut.length === 0, p);
    ok(`${tag}: a step is at least 52 px wide`, p.steps.length > 1 && p.steps.every((s) => s >= 52), p);
    info[tag] = { railW: p.railW, scrollW: p.scrollW };
  }
}
return { pass: fails.length === 0, fails, info };
