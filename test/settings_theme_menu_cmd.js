// Settings' Theme link opens the Theme menu, and the menu is a menu button's: while it is open the control that holds it
// (the Settings button, since the link itself leaves with the Settings popover) says aria-expanded="true", Escape and a
// choice return the focus to it, and it says "false" again. The phone layout has no Settings popover: its Theme is a
// radiogroup in the More sheet, so no menu opens there and nothing can be detached. A command file for a CDP daemon
// (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const state = () => ev(`(() => { const a = document.activeElement, s = document.getElementById('settingsBtn'), m = document.querySelector('#popHost .pop.menu'); return { expanded: s && s.getAttribute('aria-expanded'), active: a === document.body ? 'body' : a && (a.id || a.className), menu: m ? m.getAttribute('aria-label') : null, settingsPop: !!document.querySelector('#popHost .set-pop'), connected: !!(s && s.isConnected) }; })()`);
const openSettingsTheme = async () => {
  await ev(`document.getElementById('settingsBtn').click(); 1`);
  await settled({ max: 8000, only: true, until: `!!document.querySelector('#setTheme')` });
  await ev(`document.getElementById('setTheme').click(); 1`);
  await settled({ max: 8000, only: true, until: `!!document.querySelector('#popHost .pop.menu')` });
};
const closed = () => settled({ max: 8000, only: true, until: `!document.querySelector('#popHost .pop')` });
const leg = async (name, w, h, mobile) => {
  await view(w, h, false, mobile);
  await go(`http://localhost:${PORT}/test.html?ns=setthm${w}${Date.now()}`);
  await settled({ max: 30000, until: '!!document.querySelector("#settingsBtn")' });
  const rest = await state();
  ok(`${name}: the Settings button is at aria-expanded="false" at rest`, rest.expanded === 'false', rest);
  await openSettingsTheme();
  const up = await state();
  ok(`${name}: with the Theme menu open from Settings, the control that holds it says aria-expanded="true"`, up.menu === 'Theme' && up.expanded === 'true' && up.connected, up);
  await key('Escape'); await closed();
  const esc = await state();
  ok(`${name}: Escape returns the focus to the Settings button, not the body`, esc.active === 'settingsBtn', esc);
  ok(`${name}: after Escape the Settings button says aria-expanded="false"`, esc.expanded === 'false', esc);
  // (a choice: Enter on the checked item, which the menu focuses first)
  await openSettingsTheme();
  await key('Enter'); await closed();
  const pick = await state();
  ok(`${name}: choosing a theme returns the focus to the Settings button`, pick.active === 'settingsBtn', pick);
  ok(`${name}: after a choice the Settings button says aria-expanded="false"`, pick.expanded === 'false', pick);
  // (a press on the Settings button while the Theme menu is open closes the menu and leaves Settings closed)
  await openSettingsTheme();
  await ev(`document.getElementById('settingsBtn').click(); 1`); await closed();
  const again = await state();
  ok(`${name}: pressing the Settings button with the Theme menu open closes it, with the focus on that button`, again.expanded === 'false' && !again.menu && !again.settingsPop && again.active === 'settingsBtn', again);
  // (the header's own Theme button keeps its state as before)
  await ev(`document.getElementById('themeBtn').click(); 1`);
  await settled({ max: 8000, only: true, until: `!!document.querySelector('#popHost .pop.menu')` });
  const hdr = await ev(`document.getElementById('themeBtn').getAttribute('aria-expanded')`);
  ok(`${name}: the header's Theme button says aria-expanded="true" while its menu is open`, hdr === 'true', hdr);
  await key('Escape'); await closed();
  info[name] = { rest, up, esc, pick };
};
await leg('laptop', 1280, 800, false);
await leg('tablet touch', 820, 1180, true);
// the phone layout: Theme is a radiogroup in the More sheet; there is no Settings popover and no link to detach
await view(390, 844, false, true);
await go(`http://localhost:${PORT}/test.html?ns=setthmph${Date.now()}`);
await settled({ max: 30000, until: '!!document.querySelector("#hdrMoreBtn")' });
await ev(`document.getElementById('hdrMoreBtn').click(); 1`);
await settled({ max: 8000, only: true, until: `!!document.querySelector('.ph-sheet [role="radiogroup"][aria-label="Theme"]')` });
const ph = await ev(`(() => { const g = document.querySelector('.ph-sheet [role="radiogroup"][aria-label="Theme"]'); return { group: !!g, popup: !!document.querySelector('.ph-sheet #setTheme, .ph-sheet [aria-haspopup="menu"][aria-label*="Theme"]'), settings: !!document.getElementById('settingsBtn') && document.getElementById('settingsBtn').getClientRects().length > 0 }; })()`);
ok('phone: Theme is a radiogroup in the More sheet, with no Theme menu link and no Settings button', ph.group && !ph.popup && !ph.settings, ph);
info.phone = ph;
return { pass: fails.length === 0, fails, info };
