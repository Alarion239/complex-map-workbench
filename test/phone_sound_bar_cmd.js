// The Sound control on a landscape phone 768 to 1023 px wide: 900 × 400 with touch (:root.ph.ph-land), in the steps view and the classic one,
// in English, Russian and Italian. While sound is on the bar's own button stands in for the menu's (hidden) #soundBtn:
//  - sound on: #soundPh is in the bar, a button in Chrome's accessibility tree named «Sound» («Звук», «Suono») with pressed true, a 44 px target
//    inside the bar and under no other element; a touch on it turns the sound off (aria-pressed false, the button goes);
//  - sound off: the bar has no Sound button (control), and ⋯ opens the sheet whose Sound switch is in the tree with the same name, checked false;
//    (then the sound is turned on with Sound.set).
// (The steps view is the page's default (?view=steps); ?view=classic is the other. Sound.set turns the sound over with no audio.) A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const NAMES = { en: 'Sound', ru: 'Звук', it: 'Suono' };
const VIEW_W = 900, VIEW_H = 400, WAIT_MS = 20000, SET_MS = 10000, TARGET_PX = 44, TAP_MS = 60;
const { axOf } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'ax_kit.js'), 'utf8'))({ send });
const boxOf = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), bar = document.getElementById('top') || document.querySelector('.top'), b = bar.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, hit: !!at && (at === e || e.contains(at)), inBar: r.left >= b.left - 0.5 && r.right <= b.right + 0.5 && r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5, display: getComputedStyle(e).display }; })()`);
const touch = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(TAP_MS); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const tapSel = async (sel) => { const b = await boxOf(sel); if (!b) return false; await touch(b.l + b.w / 2, b.t + b.h / 2); return true; };
const snd = (on) => ev(`Sound.set({ on: ${on} }), 1`);
for (const v of ['steps', 'classic']) for (const [lang, label] of Object.entries(NAMES)) {
  const tag = `${lang} ${v}`;
  await view(VIEW_W, VIEW_H, false, true);
  const ns = 'psb' + v + lang + (Date.now() % 1000000);
  await load(ns, {});
  await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}&view=${v}` });
  await settled({ max: WAIT_MS, until: `typeof Sound === 'object' && !!window.Phone && Phone.isOn() && !!document.getElementById('soundPh')` });
  ok(`${tag}: it is a landscape phone`, await ev(`document.documentElement.classList.contains('ph-land')`), null);
  // ---- sound off: no Sound button in the bar (control); the sheet's switch is the control
  await snd(false);
  await settled({ max: SET_MS, panes: false, until: `document.getElementById('soundPh').hidden === true` });
  ok(`${tag}: sound off: the bar has no Sound button (control)`, (await boxOf('#soundPh')) === null, await boxOf('#soundPh'));
  await tapSel('#hdrMoreBtn');
  await settled({ max: SET_MS, panes: false, until: `!!document.querySelector('.ph-sheet[data-k="more"].open') && !!document.querySelector('.ph-sheet .ph-switch[aria-label]')` });
  const sw = await axOf('.ph-sheet[data-k="more"] .ph-switch[aria-label]');
  ok(`${tag}: sound off: the sheet's Sound switch is named "${label}" and not checked`, !!sw && sw.role === 'switch' && sw.name === label && sw.state === 'false', sw);
  // (the sheet closes, and the sound goes on)
  await ev(`Phone.close(), 1`);
  await settled({ max: SET_MS, panes: false, until: `!document.querySelector('.ph-sheet.open')` });
  await snd(true);
  await settled({ max: SET_MS, panes: false, until: `document.getElementById('soundPh').hidden === false` });
  // ---- sound on: the bar's button
  const b = await boxOf('#soundPh');
  info[`${tag} on`] = b;
  ok(`${tag}: sound on: the bar shows #soundPh`, !!b && b.display !== 'none', b);
  if (b) {
    ok(`${tag}: sound on: #soundPh is a ${TARGET_PX} px target inside the bar, under no other element`, b.w >= TARGET_PX - 0.5 && b.h >= TARGET_PX - 0.5 && b.inBar && b.hit, b);
    const ax = await axOf('#soundPh');
    ok(`${tag}: sound on: #soundPh is a button in the accessibility tree named "${label}", pressed`, !!ax && ax.role === 'button' && ax.name === label && ax.state === 'true', ax);
    await tapSel('#soundPh');
    await settled({ max: SET_MS, panes: false, until: `document.getElementById('soundPh').hidden === true` });
    ok(`${tag}: a touch on #soundPh turns the sound off`, await ev(`document.getElementById('soundBtn').getAttribute('aria-pressed') === 'false'`), null);
  }
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
return { pass: fails.length === 0, fails, info };
