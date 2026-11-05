// The steps view's scrubber speaks the thread's place (behind ?view=steps), in the classic Deformation readout's words:
// - held at 0.42 between z and w₁ its aria-valuetext reads "Step 1 of 2 · f₁ · 42 %" (ru, it too), and "Plane w₁, 2 of 3" at rest
//   on a plane;
// - a glide that goes all at once reads "All steps at once · 50 %" half way along its span;
// - it changes only with the whole percentage: held at 0.420 and at 0.424 it reads the same, and the live region has said
//   nothing new between the two;
// - the probe reads the point under the pointer at rest, is idle while the thread is held between two planes, and reads
//   again on arrival at a plane (#955).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svro' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
const open = async (lang) => {
  await view(1440, 900, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
};
// (a language's own spaces, no-break ones before a % sign included, read as one space)
const said = async () => (await ev(`document.querySelector('#svStrip .sv-thumb').getAttribute('aria-valuetext')`)).replace(/[\s\u00a0\u202f]+/g, ' ');
const live = () => ev(`document.querySelector('#stage > .sr-only[aria-live]').textContent`);
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ floor: 300 }); };
const WANT = {
  en: { mid: 'Step 1 of 2 · f₁ · 42 %', rest: 'Plane w₁, 2 of 3', all: 'All steps at once · 50 %' },
  ru: { mid: 'Шаг 1 из 2 · f₁ · 42 %', rest: 'Плоскость w₁, 2 из 3', all: 'Все шаги сразу · 50 %' },
  it: { mid: 'Passo 1 di 2 · f₁ · 42 %', rest: 'Piano w₁, 2 di 3', all: 'Tutti i passi insieme · 50 %' },
};
for (const lang of ['en', 'ru', 'it']) {
  await open(lang);
  await park(0.42);
  const mid = await said();
  ok(`${lang}: held at 0.42 between z and w₁ the scrubber reads the step and its percentage`, mid === WANT[lang].mid, mid);
  const l0 = await live();
  await park(0.424);
  ok(`${lang}: the same whole percentage reads the same, and the live region says nothing new`, (await said()) === mid && (await live()) === l0, { said: await said(), live: [l0, await live()] });
  await park(1);
  const rest = await said();
  ok(`${lang}: at rest on a plane it reads the plane`, rest === WANT[lang].rest, rest);
  if (lang === 'en') {
    await ev(`__cmwSteps({ order: 'all', park: 1, span: [0, 2] }); 1`);
    await settled({ floor: 300 });
    const all = await said();
    ok('en: gliding all at once it reads the span\'s percentage', all === WANT.en.all, all);
  }
}
// the probe (#955): on a plane the left readout reads the point under the pointer; while the thread moves (held at u = 1.5)
// it idles, with none of the numbers the last rest frame left; on arrival at a plane it reads the point under the pointer
// in the first parked frame, with no pointer move
await open('en');
const CPX = /\d+[.,]\d+ [+−-] \d+[.,]\d+i/;
const readout = () => ev(`document.querySelector('#leftReadout').textContent`);
const [px, py] = await ev(`(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return [r.left + r.width * 0.6, r.top + r.height * 0.4]; })()`);
await park(0);
await move(px, py);
await settled({ max: 15000, until: `/\\d+[.,]\\d+ [+\\u2212-] \\d+[.,]\\d+i/.test(document.querySelector('#leftReadout').textContent)` });
const rest0 = await readout();
ok('en probe: at rest the readout reads the point under the pointer', CPX.test(rest0), rest0);
await park(1.5);
const mid = await readout();
ok('en probe: held at u = 1.5 the readout is idle, with no rest-frame numbers', !CPX.test(mid), mid);
await park(1);
await settled({ max: 15000, until: `/\\d+[.,]\\d+ [+\\u2212-] \\d+[.,]\\d+i/.test(document.querySelector('#leftReadout').textContent)` });
const arr = await readout();
ok('en probe: on arrival at a plane it reads the point under the pointer, with no pointer move', CPX.test(arr), arr);
return { pass: fails.length === 0, fails, info };
