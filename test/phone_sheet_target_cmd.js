// The phone sheets' drag target (#483): since #500 the sheet's grab handle (button.ph-grab) is an 18 px strip above the title row, and
// phone.css and the 44 px audits (test/v15_phone_cmd.js) exempt it, so this holds the real target to 44 px. In every sheet (Editor, Chain,
// Display, Menu, Tools), in English, Russian and Italian, at 360 and 390 px: the head row (the Editor's title row, the Inspector's .ihead,
// where its head is an 18 px bar) is 44 px tall at least and has an empty part to press, and a press there with a drag up opens the sheet
// to its full height. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ST = { shapes: [], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }] };
const open = async (w, h, lang) => {
  await view(w, h, false, true); await load(`pst${w}${lang}-${Date.now()}`, ST);
  if (lang !== 'en') { const u = await ev('location.href'); await send('Page.navigate', { url: u + (u.includes('?') ? '&' : '?') + 'lang=' + lang }); }
  for (let i = 0; i < 40; i++) { if (await ev(`document.documentElement.classList.contains('ph') && typeof Phone !== 'undefined'`)) break; await sleep(250); }
  await settle(900);
};
// the sheet has stopped sliding in: its transform is none and it lies inside the window
const sheetSettled = async () => { for (let i = 0; i < 40; i++) { if (await ev(`(() => { const s = document.querySelector('.ph-sheet:not([hidden])'); return !!s && getComputedStyle(s).transform === 'none' && s.getBoundingClientRect().bottom <= innerHeight + 1; })()`)) break; await sleep(250); } await settle(300); };
const probe = () => ev(`(() => { const sh = document.querySelector('.ph-sheet:not([hidden])'); if (!sh) return null;
  const tgt = sh.dataset.k === 'edit' && !sh.classList.contains('nums') ? sh.querySelector('#propsPanel .ihead') : sh.querySelector('.ph-sh');
  if (!tgt || !tgt.getClientRects().length) return { k: sh.dataset.k, none: true };
  const r = tgt.getBoundingClientRect(), y = r.top + r.height / 2, pressable = 'button, a, input, select, textarea, summary, [role="button"], [tabindex]';
  const xs = [];
  for (let x = r.left + 4; x < r.right - 4; x += 3) { const el = document.elementFromPoint(x, y); if (el && tgt.contains(el) && !el.closest(pressable)) xs.push(x); }
  return { k: sh.dataset.k, h: Math.round(r.height), at: xs.length ? [xs[Math.floor(xs.length / 2)], y] : null, full: document.documentElement.classList.contains('ph-full') }; })()`);
for (const lang of ['en', 'ru', 'it']) for (const w of [360, 390]) {
  const tag = `${w} ${lang}`;
  await open(w, w === 360 ? 740 : 844, lang);
  for (const k of ['edit', 'chain', 'display', 'more', 'tools']) {
    await ev(`Phone.open('${k}'); 1`); await sheetSettled();
    const t = await probe();
    ok(`${tag}: the ${k} sheet's drag target is 44 px tall at least, with an empty part to press`, !!t && !t.none && t.h >= 44 && !!t.at, t);
    info[`${tag} ${k}`] = t && { h: t.h };
    if (t && t.at && !t.full) {
      await drag(t.at[0], t.at[1], t.at[0], t.at[1] - 120, 8, 30); await settle(700);
      ok(`${tag}: the ${k} sheet: a press and drag up on its drag target opens it full`, await ev(`document.documentElement.classList.contains('ph-full')`), t);
    }
    await ev('Phone.close(true); 1'); await sleep(700);
  }
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no page errors', errs.length === 0, errs.slice(0, 3));
return { pass: fails.length === 0, fails, info };
