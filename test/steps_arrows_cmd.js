// The steps view's ← → step the chain whenever a plane has focus, not only on the thread: with the plot's canvas focused the
// arrows go to the next and the previous plane; in a text field they stay the field's own. A command file for a CDP daemon
// (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1440, 900, false, false);
const ns = 'svar' + Date.now();
await seed(ns, st);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
// (a key's glide waits behind the Play gate until the page's programs, warm draw and jobs are ready, which on a software renderer's cold
// start can take longer than a fixed wait: the page is ready before the first key, and a step is given the time the gate may take)
const READY_MS = 60000, STEP_MS = 60000;
const idle = `__cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#paneL canvas') && __cmwSteps().ready.ready`;
await settled({ max: READY_MS, until: idle });
ok('the page is the steps view', await ev('!!__cmwSteps().on'), null);
const press = async (key, modifiers = 0) => { const p = { key, code: key, modifiers, windowsVirtualKeyCode: key === 'ArrowRight' ? 39 : 37 }; await send('Input.dispatchKeyEvent', { type: 'keyDown', ...p }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); };
const at = () => ev('__cmwSteps().i');
const keyTo = async (key, i) => { await press(key); await settled({ max: STEP_MS, only: true, until: `__cmwSteps().i === ${i} && !__cmwSteps().moving` }); return at(); };
// a slow first draw: the carried colour's warm draw is not made for 9 s, so the Play gate holds the first arrow's glide that long
// (a slow runner's cold start; the rows below must wait for it to be over, not give up)
await ev(`__cmwSteps({ holdWarm: true }), setTimeout(() => __cmwSteps({ holdWarm: false }), 9000), 1`);
// the plot has focus: its canvas
await ev(`(() => { const c = document.querySelector('#paneL canvas'); c.tabIndex = 0; c.focus(); })()`);
ok('a plane canvas has focus', await ev(`document.activeElement && document.activeElement.tagName === 'CANVAS'`), null);
const i0 = await at();
ok('→ on the focused plot steps to the next plane', (await keyTo('ArrowRight', i0 + 1)) === i0 + 1, [i0, await at()]);
ok('← on the focused plot steps back', (await keyTo('ArrowLeft', i0)) === i0, [i0, await at()]);
// sound on: the plane is the keyboard probe, whose arrows are Alt / Option + arrow; ← → still step the thread
await ev(`document.getElementById('soundBtn').click(), 1`);
await settled({ max: 8000, only: true, until: `document.getElementById('soundBtn').getAttribute('aria-pressed') === 'true' && !!document.querySelector('#paneL canvas[aria-keyshortcuts]')` });
ok('sound on makes the plane the keyboard probe, on Alt + the arrows', await ev(`!!document.querySelector('#paneL canvas[aria-keyshortcuts~="Alt+ArrowLeft"]')`), null);
await ev(`document.querySelector('#paneL canvas[aria-keyshortcuts]').focus(), 1`);
ok('→ on the sound probe plane steps to the next plane', (await keyTo('ArrowRight', i0 + 1)) === i0 + 1, [i0, await at()]);
ok('← on the sound probe plane steps back', (await keyTo('ArrowLeft', i0)) === i0, [i0, await at()]);
const heard = () => ev(`document.getElementById('sndLive').textContent`);
const h0 = await heard();
await press('ArrowRight', 1);
await settled({ max: 4000, until: '!__cmwSteps().moving' });
ok('Alt + → on the sound probe plane leaves the thread where it is', (await at()) === i0, await at());
ok('and starts the probe, which says where it is', (await heard()) !== h0 && /^Probe at the centre/.test(await heard()), [h0, await heard()]);
await ev(`document.getElementById('soundBtn').click(), 1`);
await settled({ max: 8000, only: true, until: `document.getElementById('soundBtn').getAttribute('aria-pressed') !== 'true'` });
// typing: a text field keeps its arrows
await ev(`(() => { const f = document.createElement('input'); f.id = 'zzField'; f.value = 'abc'; document.body.append(f); f.focus(); })()`);
await press('ArrowRight');
await settled({ max: 4000, until: '!__cmwSteps().moving' });
ok('→ in a text field leaves the thread where it is', (await at()) === i0, await at());
// the keyboard help says it, by view: in the steps view the probe's arrows are Alt + the arrows (the plain ones step the chain), in the
// classic view the plain arrows move it; the Sound pop-up's key line (the paragraph its view shows) and the Guide's Sound paragraph, in each language
const HELP = [
  ['steps', 'en', /Alt \+ the arrows move a probe/, /Alt ← → ↑ ↓ move a probe/], ['steps', 'ru', /Alt\u00a0\+\u00a0стрелки перемещают указатель/, /Alt ← → ↑ ↓ перемещают указатель/],
  ['steps', 'it', /Alt \+ le frecce spostano una sonda/, /Alt ← → ↑ ↓ muovono una sonda/],
  ['classic', 'en', /: the arrows move a probe/, /Tab to the left plane: the arrows move a probe/], ['classic', 'ru', /На активной плоскости: стрелки перемещают указатель/, /Tab на левую плоскость; стрелки перемещают указатель/],
];
for (const [vw, lang, keyLine, guide] of HELP) {
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=${vw}`);
  await settled({ max: 30000, until: `!!document.querySelector('#paneL canvas')` });
  const t = await ev(`([...document.querySelectorAll('.snd-keys')].find((e) => getComputedStyle(e).display !== 'none') || {}).textContent || ''`);
  ok(`${vw} ${lang}: the sound pop-up's key line says how the probe moves`, keyLine.test(t) && (vw === 'steps') === /Alt/.test(t), t.slice(0, 200));
  await key('?');
  await settled({ max: 8000, only: true, until: `!!document.querySelector('#guideTitle')` });
  const g = await ev(`(document.querySelector('.modal') || {}).textContent || ''`);
  ok(`${vw} ${lang}: the Guide's Sound paragraph says how the probe moves`, guide.test(g.replace(/\s+/g, ' ')) && (vw === 'steps') === /Alt ← → ↑ ↓ (move a probe|перемещают|muovono)/.test(g.replace(/\s+/g, ' ')), (g.match(/.{60}(move a probe|перемещают указатель|muovono una sonda).{20}/) || [g.slice(0, 120)])[0]);
}
return { pass: fails.length === 0, fails, info };
