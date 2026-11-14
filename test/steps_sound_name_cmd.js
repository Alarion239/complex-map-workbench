// The Sound button's accessible name carries its state: "Sound: Off" while sound is off, "Sound: On" while it is on, and it
// follows the switch, in English, Russian and Italian (#1287). The phone's Sound button (shown while sound is on) says the
// same. The state is turned over with Sound.set, which needs no audio. A command file for a CDP daemon (test/cdp_kit
// README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// [off, on] by language
const NAMES = { en: ['Sound: Off', 'Sound: On'], ru: ['Звук: выкл', 'Звук: вкл'], it: ['Suono: disattivato', 'Suono: attivo'] };
const nameOf = (id) => ev(`(() => { const b = document.getElementById(${JSON.stringify(id)}); return b ? b.getAttribute('aria-label') : null; })()`);
const pressed = (id) => ev(`(() => { const b = document.getElementById(${JSON.stringify(id)}); return b ? b.getAttribute('aria-pressed') : null; })()`);
const ns = 'ssn' + Date.now();
await view(1440, 900, false);
await load(ns, {});
const base = await ev('location.origin');
for (const [lang, [off, on]] of Object.entries(NAMES)) {
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ until: `typeof Sound === 'object' && !!document.getElementById('soundBtn') && !!document.getElementById('soundPh')`, max: 20000 });
  ok(`${lang}: with sound off the Sound button is "${off}"`, (await pressed('soundBtn')) === 'false' && (await nameOf('soundBtn')) === off, [await pressed('soundBtn'), await nameOf('soundBtn')]);
  await ev(`Sound.set({ on: true }), 1`);
  await settled({ until: `document.getElementById('soundBtn').getAttribute('aria-pressed') === 'true'`, max: 10000 });
  ok(`${lang}: with sound on it is "${on}"`, (await nameOf('soundBtn')) === on, await nameOf('soundBtn'));
  ok(`${lang}: the phone's Sound button says the same`, (await nameOf('soundPh')) === on, await nameOf('soundPh'));
  await ev(`Sound.set({ on: false }), 1`);
  await settled({ until: `document.getElementById('soundBtn').getAttribute('aria-pressed') === 'false'`, max: 10000 });
  ok(`${lang}: and back to "${off}" when it is turned off`, (await nameOf('soundBtn')) === off, await nameOf('soundBtn'));
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
info.checks = 'the Sound button\'s accessible name carries its state (en, ru, it)';
return { pass: fails.length === 0, fails, info };
