// The Sound button keeps one accessible name in both states, and aria-pressed carries the state (#1287, ux's ruling: a toggle
// button's label must not change with its state, or a screen reader says the state twice and a name change on the focused button is
// announced unreliably). In English, Russian and Italian, with sound off, on and off again (turned over with Sound.set, which needs
// no audio), at 1440 × 900:
//  - #soundBtn is a button in Chrome's accessibility tree named "Sound" / «Звук» / «Suono» (its visible label) in every state, with
//    pressed false, true, false;
//  - #soundPh, the bar's button for a 768 to 1023 px phone (hidden by the phone bar's own rule at present, so not in the tree), keeps
//    the same aria-label in every state while its aria-pressed follows the switch.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const NAMES = { en: 'Sound', ru: 'Звук', it: 'Suono' };   // the visible label, by language
const VIEW_W = 1440, VIEW_H = 900, WAIT_MS = 20000, SET_MS = 10000;
// #soundBtn's role, name and pressed state as the accessibility tree has it
const axOf = async (id) => {
  const { root } = await send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
  if (!nodeId) return null;
  const { nodes } = await send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
  const n = nodes && nodes[0];
  if (!n || n.ignored) return null;
  const pr = (n.properties || []).find((p) => p.name === 'pressed');
  return { role: n.role && n.role.value, name: n.name && n.name.value, pressed: pr ? String(pr.value.value) : null };
};
const attrs = (id) => ev(`(() => { const b = document.getElementById(${JSON.stringify(id)}); return { label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed') }; })()`);
const flip = async (on) => {
  await ev(`Sound.set({ on: ${on} }), 1`);
  await settled({ until: `document.getElementById('soundBtn').getAttribute('aria-pressed') === '${on}' && document.getElementById('soundPh').getAttribute('aria-pressed') === '${on}'`, max: SET_MS });
};
await send('Accessibility.enable', {});
const ns = 'ssn' + Date.now();
await view(VIEW_W, VIEW_H, false);
await load(ns, {});
const base = await ev('location.origin');
for (const [lang, label] of Object.entries(NAMES)) {
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ until: `typeof Sound === 'object' && !!document.getElementById('soundBtn') && !!document.getElementById('soundPh')`, max: WAIT_MS });
  const off = await axOf('soundBtn'), phOff = await attrs('soundPh');
  ok(`${lang}: #soundBtn is a button in the accessibility tree`, !!off && off.role === 'button', off);
  ok(`${lang}: sound off: #soundBtn is named "${label}", not pressed`, !!off && off.name === label && off.pressed === 'false', off);
  await flip(true);
  const on = await axOf('soundBtn'), phOn = await attrs('soundPh');
  ok(`${lang}: sound on: #soundBtn is still named "${label}", now pressed`, !!on && on.name === label && on.pressed === 'true', on);
  await flip(false);
  const back = await axOf('soundBtn'), phBack = await attrs('soundPh');
  ok(`${lang}: off again: #soundBtn is still named "${label}", not pressed`, !!back && back.name === label && back.pressed === 'false', back);
  ok(`${lang}: #soundPh keeps its aria-label in every state`, !!phOff.label && phOff.label === phOn.label && phOn.label === phBack.label, [phOff, phOn, phBack]);
  ok(`${lang}: #soundPh's aria-pressed follows the switch`, phOff.pressed === 'false' && phOn.pressed === 'true' && phBack.pressed === 'false', [phOff, phOn, phBack]);
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
info.checks = 'the Sound button keeps its name in both states; aria-pressed carries the state (en, ru, it)';
return { pass: fails.length === 0, fails, info };
