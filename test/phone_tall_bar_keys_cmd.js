// Phone landscape under the tall construction bar: the steps view on example 1, the Hyperbolic tool picked so the bar is open at its tall
// height and says the tool's sentence ("Pick the boundary: a line or a circle"), with its ⌫ and ×. The plane's own construction chip says
// the same: where the plane above the bar is too short to hold it whole (568 × 320, 600 × 320, and 640 × 360 and 740 × 360, where it ran
// 3 px under the bar), it steps aside rather than be cut at the bar's top; at 800 × 390 (control) it stands whole above the bar. At
// 568 × 320, with a side sheet open (Display), the bar is out of sight under it and the chip does not step aside; once the sheet closes it
// steps aside again. With the colour key unfolded over the plane's keys, no key's edge shows above the card: no key (Fit view and Sphere's
// group, the keys, Display) stands higher than 4 px under the plane's top, the card's top. The chip is read once the example's message has
// gone (a message hides the chip by itself, phone.css). In en, ru and it, light and dark. In the steps view (ci/suite_views.js). A command
// file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SLACK = 0.5;     // layout rounding, px
const KEY_TOP = 4;     // the least room between the plane's top and its keys' or the card's top, px (phone.css)
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const SAYS = { en: 'Pick the boundary', ru: 'Выберите границу', it: 'Scegli il bordo' };
const read = () => ev(`(() => {
  const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
  const bar = document.querySelector('.ph-ctx.tall'), chip = document.querySelector('#plotL > .draft-chip.cm-on'), lg = document.getElementById('leftLegend');
  const fit = document.getElementById('leftFit');
  return { plotTop: document.getElementById('plotL').getBoundingClientRect().top, toast: !!(document.getElementById('toastHost') || {}).firstElementChild, tall: document.documentElement.classList.contains('ph-ctx-tall'), barTop: bar ? bar.getBoundingClientRect().top : null, barUnder: !!bar && bar.classList.contains('under'), cmUnder: !!chip && chip.classList.contains('cm-under'), barText: bar ? bar.textContent : '',
    chip: R(chip), partsB: chip ? Math.max(...[...chip.querySelectorAll('.cm-chip > *')].map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0).map((r) => r.bottom)) : null, chipShown: !!chip && getComputedStyle(chip).visibility === 'visible', keys: document.getElementById('plotL').dataset.keys || '',
    card: lg && !lg.classList.contains('collapsed') ? R(lg) : null, fit: R(fit), grp: fit ? R(fit.parentElement) : null, sph: R(document.querySelector('#plotL .viewstack .vb-sph')), dsp: R(document.querySelector('#plotL .viewstack .ph-dsp')) };
})()`);
for (const dark of [false, true]) for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[568, 320], [600, 320], [640, 360], [740, 360], [800, 390]]) {
  if (dark && (w > 600 || lang === 'it')) continue;
  const tag = `${lang}${dark ? ' dark' : ''} ${w}×${h}`, short = h < 390;
  await view(w, h, dark, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=ptbk${w}${lang}${dark ? 'd' : ''}${Date.now() % 100000}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && __cmwSteps().ready.ready' });
  await ev(`__cmwExample(1); 1`);
  await settled({ max: 60000, until: '__cmwSteps().ready.ready' });
  await settled({ max: 20000, until: `!!document.querySelector('#constructTools .tool[data-tool="hyper"]')` });
  await ev(`document.querySelector('#constructTools .tool[data-tool="hyper"]').click(); 1`);
  await settled({ max: 20000, until: `document.documentElement.classList.contains('ph-ctx-tall') && !!document.querySelector('.ph-ctx.tall') && !!document.querySelector('#plotL > .draft-chip.cm-on')` });
  // (the example's message gone)
  await settled({ max: 20000, until: `!(document.getElementById('toastHost') || {}).firstElementChild` });
  await frames(); await frames();
  const m = info[tag] = await read();
  ok(`${tag}: the example's message has gone (control)`, !m.toast, m.toast);
  ok(`${tag}: the tall bar is open and says the tool's sentence (control)`, m.tall && m.barText.includes(SAYS[lang]), { tall: m.tall, barText: m.barText });
  ok(`${tag}: no part of the shown construction chip (its words, ?, ×) lies under the bar`, !m.chipShown || m.partsB <= m.barTop + SLACK, { chip: m.chip, partsB: m.partsB, shown: m.chipShown, barTop: m.barTop });
  if (short) ok(`${tag}: the chip, which the plane cannot hold above the bar, steps aside`, !m.chipShown, { chip: m.chip, barTop: m.barTop });
  else ok(`${tag}: the chip stands whole above the bar (control)`, m.chipShown && m.partsB <= m.barTop + SLACK, { chip: m.chip, partsB: m.partsB, barTop: m.barTop });
  if (w === 568) {
    // (a side sheet open: the bar is out of sight under it, so the chip, which says the bar's sentence, does not step aside for it; once
    // the sheet closes and the bar shows again, the chip steps aside again)
    await ev(`Phone.open('display'); 1`);
    await settled({ max: 20000, until: `document.documentElement.classList.contains('ph-split') && !!document.querySelector('.ph-ctx.tall.under')` });
    await frames(); await frames();
    const s1 = info[tag + ' sheet open'] = await read();
    ok(`${tag}: with the Display sheet open, the bar is out of sight under it (control)`, s1.barUnder, s1);
    ok(`${tag}: with the Display sheet open, the chip does not step aside for the bar out of sight`, !!s1.chip && !s1.cmUnder && s1.chipShown, { chip: s1.chip, cmUnder: s1.cmUnder, shown: s1.chipShown });
    await ev(`Phone.close(); 1`);
    await settled({ max: 20000, until: `!document.documentElement.classList.contains('ph-split') && !!document.querySelector('.ph-ctx.tall.in:not(.under)')` });
    await frames(); await frames();
    const s2 = info[tag + ' sheet closed'] = await read();
    ok(`${tag}: once the sheet closes, the chip steps aside again under the bar`, s2.tall && !s2.barUnder && !s2.chipShown, { chip: s2.chip, shown: s2.chipShown, barTop: s2.barTop });
  }
  // (the colour key unfolded over the keys)
  await ev(`document.getElementById('leftLegend').click(); 1`);
  await settled({ max: 10000, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
  await frames(); await frames();
  const k = info[tag + ' key open'] = await read();
  const under = [k.grp, k.fit, k.sph, k.dsp].filter((b) => b && k.card && b.l < k.card.r && k.card.l < b.r && b.t < k.card.b && k.card.t < b.b);
  ok(`${tag}: no key under the open card shows an edge above it`, !!k.card && under.every((b) => b.t >= k.card.t - SLACK), { card: k.card, fit: k.fit, sph: k.sph, dsp: k.dsp });
  ok(`${tag}: no key stands higher than ${KEY_TOP} px under the plane's top`, [k.grp, k.fit, k.sph, k.dsp].every((b) => !b || b.t >= k.plotTop + KEY_TOP - SLACK), { plotTop: k.plotTop, grp: k.grp, fit: k.fit, sph: k.sph, dsp: k.dsp, keys: k.keys });
}
return { pass: fails.length === 0, fails: fails.slice(0, 60), info };
