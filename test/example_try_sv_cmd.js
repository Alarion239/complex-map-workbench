// The steps view's Try lines (#442): with ?view=steps an example shows its own line (en and ru) and the line closes when the user
// does what it asks, and only then: › closes "press ›" lines, choosing Landscape closes the logarithm line, a hover near a pole
// closes the Gamma line, and a plane change alone does not close a line about something else.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails }.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const lane = () => ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return l ? l.textContent : null; })()`);
const byName = (re) => ev(`(() => { for (let i = 0; i < 60; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && ${re}.test(l.textContent)) return i; } return -1; })()`);
const open = async (lang) => {
  await view(1280, 800, false, false);
  await nav(`http://localhost:${PORT}/test.html?ns=exsv${lang}${Date.now() % 1000000}&view=steps${lang === 'en' ? '' : '&lang=' + lang}`);
  await sleep(2000);
  await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
};
const next = () => ev(`(() => { const b = document.querySelector('#svStrip .sv-next'); if (b) b.click(); return !!b; })()`);
let idx = null;
for (const lang of ['en', 'ru']) {
  await open(lang);
  const names = { strip: /Strip to disk|Полоса/, quarter: /Quarter plane squared|Четверть|квадрант/i, cayley: /Cayley, then cube|Кэли/, log: /Sheets of the logarithm|Листы логарифма/, gamma: /Poles of the Gamma|Полюсы гамма/, auto: /Disk automorphism|Автоморфизм диска/, deriv: /The derivative in the chain|Производная в цепочке/ };
  if (!idx) { idx = {}; for (const k of Object.keys(names)) idx[k] = await byName(names[k]); }
  ok(`${lang}: examples found`, Object.values(idx).every((i) => i >= 0), idx);
  // the line is the steps view's own (no word Deformation) and is there
  for (const k of ['strip', 'quarter', 'cayley', 'log', 'gamma']) {
    await ev(`__cmwExample(${idx[k]})`); await settle(1200);
    const t = await lane();
    ok(`${lang}: ${k} has its line`, !!t, t);
    ok(`${lang}: ${k} line does not talk of Deformation`, t && !/Deformation|Деформаци/.test(t), t);
  }
  // › closes the quarter-plane line; another plane change does not close a line about something else
  await ev(`__cmwExample(${idx.quarter})`); await settle(1200);
  ok(`${lang}: quarter line is open`, !!(await lane()), null);
  await next(); await settle(1500);
  ok(`${lang}: › closes the quarter line`, !(await lane()), await lane());
  await ev(`__cmwExample(${idx.gamma})`); await settle(1200);
  await next(); await settle(1500);
  ok(`${lang}: a plane change does not close the Gamma line`, !!(await lane()), null);
  // Cayley then cube: one › is not enough, two are
  await ev(`__cmwExample(${idx.cayley})`); await settle(1200);
  await next(); await settle(1200);
  const afterOne = await lane();
  await next(); await settle(1500);
  ok(`${lang}: Cayley closes by the second ›`, !(await lane()), { afterOne });
  // the logarithm: choosing Landscape closes it
  await ev(`__cmwExample(${idx.log})`); await settle(1200);
  ok(`${lang}: log line open`, !!(await lane()), null);
  await ev(`(() => { const b = document.querySelector('#svHead .sv-surf1'); if (b) b.click(); return !!b; })()`); await sleep(400);
  await ev(`(() => { const m = document.querySelectorAll('.pop.menu [role=menuitemradio]')[2]; if (m) m.click(); return !!m; })()`); await settle(1500);
  ok(`${lang}: Landscape closes the log line`, !(await lane()), await lane());
  // the derivative: the line names the chip and its ⋯ menu (not a card); opening the menu leaves it, moving the step closes it
  await ev(`__cmwExample(${idx.deriv})`); await settled({ until: `!!document.querySelector('.tour-lane[data-lane="example"]') && document.querySelectorAll('#svStrip .sv-more').length === 2` });
  const dl = await lane();
  ok(`${lang}: the derivative line is the steps view's own (a chip, no card)`, !!dl && !/\bcard\b|карточк/i.test(dl) && /chip|шаг/.test(dl), dl);
  const moreOf = (k) => ev(`(() => { const b = document.querySelectorAll('#svStrip .sv-more')[${k}]; if (b) b.click(); return !!b; })()`);
  const menuItem = (re) => ev(`(() => { const m = [...document.querySelectorAll('.pop.menu [role=menuitem]')].find((x) => ${re}.test(x.textContent)); if (m) m.click(); return !!m; })()`);
  await moreOf(1); await settled({ until: `!!document.querySelector('.pop.menu')` });
  ok(`${lang}: opening the d/dz chip's menu leaves the derivative line`, !!(await lane()), await lane());
  ok(`${lang}: the menu offers Move left`, await menuItem(/Move left|Сдвинуть влево/), null);
  await settled({ until: `!document.querySelector('.tour-lane[data-lane="example"]')` });
  ok(`${lang}: moving the d/dz step closes the derivative line`, !(await lane()), await lane());
}
return { pass: fails.length === 0, fails };
