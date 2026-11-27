// The planes' accessible names follow the plane shown, as the titles and the readout do: the left canvas's aria-label says which
// plane it is (z, w₁, w₂, from the head's own title and role), and the keyboard probe's words name that plane's variable
// ("Probe at the centre, w₁ = 0", "w₁ 0.1. Modulus …"), not z. The steps view at each plane of a three-plane chain; the classic
// view with a step focused.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const st = (focus) => ({ v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus, srcView: { cx: 0, cy: 0, s: 90 } });
const VAR = ['z', 'w₁', 'w₂'];
const label = (id) => ev(`document.getElementById('${id}').getAttribute('aria-label')`);
const heard = () => ev(`document.getElementById('sndLive').textContent`);
const press = async (key, modifiers = 0) => { const p = { key, code: key, modifiers, windowsVirtualKeyCode: key === 'ArrowRight' ? 39 : 37 }; await send('Input.dispatchKeyEvent', { type: 'keyDown', ...p }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); };
await view(1440, 900, false, false);
// ---- the steps view: the label and the probe at each plane (a page each: the probe says its start once a page)
for (let k = 0; k < 3; k++) {
  const ns = `cpn${k}x${Date.now()}`;
  await seed(ns, st(0));
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ max: 30000, until: `__cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#paneL canvas')` });
  await ev(`__cmwSteps({ go: ${k}, now: true }); 1`);
  await settled({ max: 30000, until: `__cmwSteps().i === ${k} && !__cmwSteps().moving` });
  await ev(`document.getElementById('soundBtn').click(), 1`);
  await settled({ max: 8000, only: true, until: `document.getElementById('soundBtn').getAttribute('aria-pressed') === 'true' && !!document.querySelector('#paneL canvas[aria-keyshortcuts]')` });
  await settled({ max: 8000, only: true, until: `(document.getElementById('overlayL').getAttribute('aria-label') || '').includes(${JSON.stringify(VAR[k])})` });
  const l = await label('overlayL');
  info['label' + k] = l;
  ok(`steps view, plane ${VAR[k]}: the left canvas's name says ${VAR[k]}`, l.includes(VAR[k]), l);
  if (k > 0) ok(`steps view, plane ${VAR[k]}: the left canvas's name does not call it the z-plane`, !/z-plane/.test(l), l);
  // the probe: Alt + → starts it; its first words name the plane's variable
  await ev(`document.querySelector('#paneL canvas[aria-keyshortcuts]').focus(), 1`);
  await press('ArrowRight', 1);
  const s1 = await settled({ max: 6000, only: true, until: `/^Probe at the centre/.test(document.getElementById('sndLive').textContent)` });
  const said = await heard();
  info['probe' + k] = said;
  ok(`steps view, plane ${VAR[k]}: the probe's start names ${VAR[k]}`, s1.ok && said.startsWith(`Probe at the centre, ${VAR[k]} = `), said);
  // after a step, its place is said (450 ms later), naming the variable: "w₁ 0.1. Modulus …"
  await press('ArrowRight', 1);
  const s2 = await settled({ max: 6000, only: true, until: `/Modulus|infinite/.test(document.getElementById('sndLive').textContent)` });
  const step = await heard();
  info['step' + k] = step;
  ok(`steps view, plane ${VAR[k]}: the probe's step announcement names ${VAR[k]}`, s2.ok && step.startsWith(`${VAR[k]} `), step);
}
// ---- ru and it, at w₁: the canvas's name and the probe's words are the translated ones, naming w₁
for (const [lang, start, notPlane] of [['ru', 'Указатель в центре, w₁ = ', /z-плоскост|плоскост\S* z/i], ['it', 'Sonda al centro, w₁ = ', /piano z/i]]) {
  const nsl = `cpn${lang}${Date.now()}`;
  await seed(nsl, st(0));
  await go(`http://localhost:${PORT}/test.html?ns=${nsl}&lang=${lang}&view=steps`);
  await settled({ max: 30000, until: `__cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#paneL canvas')` });
  await ev(`__cmwSteps({ go: 1, now: true }); 1`);
  await settled({ max: 30000, until: `__cmwSteps().i === 1 && !__cmwSteps().moving` });
  await ev(`document.getElementById('soundBtn').click(), 1`);
  await settled({ max: 8000, only: true, until: `document.getElementById('soundBtn').getAttribute('aria-pressed') === 'true' && !!document.querySelector('#paneL canvas[aria-keyshortcuts]')` });
  await settled({ max: 8000, only: true, until: `(document.getElementById('overlayL').getAttribute('aria-label') || '').includes('w₁')` });
  const l = await label('overlayL');
  ok(`${lang}, plane w₁: the left canvas's name says w₁ and does not call it the z-plane`, l.includes('w₁') && !notPlane.test(l), l);
  await ev(`document.querySelector('#paneL canvas[aria-keyshortcuts]').focus(), 1`);
  await press('ArrowRight', 1);
  await settled({ max: 6000, only: true, until: `document.getElementById('sndLive').textContent.startsWith(${JSON.stringify(start)})` });
  const said = await heard();
  ok(`${lang}, plane w₁: the probe's start is said in ${lang}, naming w₁`, said.startsWith(start), said);
  await press('ArrowRight', 1);
  const s2 = await settled({ max: 6000, only: true, until: `/^w₁ /.test(document.getElementById('sndLive').textContent)` });
  ok(`${lang}, plane w₁: the probe's step announcement names w₁`, s2.ok, await heard());
  info[lang] = { label: l, said };
}
// ---- the classic view with step 2 focused: X shows w₁ (standards-ok: the page has no Y pane; its canvas has no name to check)
const ns2 = 'cpn2' + Date.now();
await seed(ns2, st(2));
await go(`http://localhost:${PORT}/test.html?ns=${ns2}&lang=en&view=classic`);
await settled({ max: 30000, until: `typeof __cmwCards === 'function' && __cmwCards().focus === 2` });
await settled({ max: 8000, only: true, until: `(document.getElementById('overlayL').getAttribute('aria-label') || '').includes('w₁')` });
const lx = await label('overlayL');
info.classic = { x: lx };
ok('classic, step 2 focused: X\'s canvas is named for w₁, not the z-plane', lx.includes('w₁') && !/z-plane/.test(lx), lx);
// ---- at rest on z the names are the heads' own
const ns3 = 'cpn3' + Date.now();
await seed(ns3, st(0));
await go(`http://localhost:${PORT}/test.html?ns=${ns3}&lang=en&view=classic`);
await settled({ max: 30000, until: `typeof __cmwCards === 'function'` });
const l0 = await label('overlayL');
info.rest = { x: l0 };
ok('classic, no step focused: X\'s canvas is the z-plane, domain of F', /z/.test(l0) && /domain of/.test(l0), l0);
return { pass: fails.length === 0, fails, info };
