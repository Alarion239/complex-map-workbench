// The classic views' part of the language checks (i18n_cmd.js is the steps view's): on a Russian layout (ЙЦУКЕН) С → the Circle tool, and the logarithm's example names its Landscape window of sheets in Russian. A command file for a CDP
// daemon (test/cdp_kit README); prints { pass, of, fails }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail === undefined ? null : detail]);
const until = (expr, max = 5000) => settled({ max, only: true, until: expr });
const PAL = `!!document.querySelector('#popHost .palette, .pop.palette')`;
const ITEMS = `!!document.querySelector('#popHost .pal-item')`;
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const loaded = async (pause, ms = 30000) => {
  await settled({ max: pause });
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(200)) {
    let ok = false;
    try { ok = await ev(`document.readyState === 'complete' && typeof I18N === 'object' && typeof __cmwP === 'function'`); } catch (e) { /* navigating */ }
    if (ok) break;
  }
  await settle(0);
};
await view(1440, 900, false, false);
await go(`${U}?ns=i18nc-keys-${Date.now()}&lang=ru`); await loaded(3500);
await ev(`document.activeElement && document.activeElement.blur(), 1`);
const press = async (k, code, mods = 0) => { const p = { type: 'keyDown', key: k, code, modifiers: mods, windowsVirtualKeyCode: code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0 }; if (!(mods & 6) && k.length === 1) p.text = k; await send('Input.dispatchKeyEvent', p); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers: mods }); await settled({ max: 3000 }); };
const tool = () => ev(`(document.querySelector('.tool.on') || { dataset: {} }).dataset.tool || null`);
await press('с', 'KeyC'); check('ЙЦУКЕН С (KeyC) → Circle', (await tool()) === 'circle');
await press('м', 'KeyV');
// text fields keep their letters: this check runs in i18n_cmd.js under the steps view (standards-ok: its steps-view twin is there, with the steps view's keys)
// the logarithm's example and its Landscape title say which sheets, in Russian
await go(`${U}?ns=i18nc-log-${Date.now()}&lang=ru`); await loaded(3500);
await ev(`document.getElementById('examplesBtn').click(), 1`); await until(`!!document.querySelector('#popHost .examples .ex-name')`);
const ex = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .examples .ex-name')].find((e) => /Листы логарифма/.test(e.textContent)); if (!b) return [...document.querySelectorAll('#popHost .examples .ex-name')].map((e) => e.textContent).join(' | '); b.closest('button, [role="menuitem"], .mi').click(); return true; })()`);
check('ru: the example is named «Листы логарифма» (not «Все листы»)', ex === true, ex);
await until(`/, листы k = −2…2$/.test((document.querySelector('.prole .rf') || document.querySelector('.prole') || {}).textContent || '')`, 15000);
const t = await ev(`(() => { const e = document.querySelector('.prole .rf') || document.querySelector('.prole'); return e ? e.textContent : null; })()`);
check('ru: the Landscape title names the window of sheets («листы k = −2…2»), not «все листы»', /, листы k = −2…2$/.test(t || '') && !/все листы/.test(t || ''), t);
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails };
