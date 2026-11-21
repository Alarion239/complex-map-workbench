// The pane heads' LEDs, in every state they have (ok, busy, err): a keyboard user reaches each one by Tab and reads its state
// in the tip; a screen-reader user is told, politely, when its state has held for a moment; busy, up to date and failed
// differ in shape, not only in hue, and a busy LED keeps 3:1 against the bar at the pulse's lowest opacity, light and
// dark. The classic view has both LEDs (left, right); the steps view has the left; a phone shows none, and its pane's states are said all the same.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const BAD = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, shapes: [], srcView: { cx: 0, cy: 0, s: 90 },
  steps: [{ type: 'custom', params: { expr: '\\frac{', cut: 180 }, on: true }] };
const open = async (viewName, w, h, mobile, st, lang) => {
  const ns = `led${viewName}${w}x${Date.now()}`;
  await view(w, h, false, mobile);
  await loadView(viewName, ns, st || Object.assign({}, BAD, { steps: [{ type: 'pown', params: { n: 2 }, on: true }] }), { lang: lang || 'en' });
  await settled({ max: 30000, until: `typeof __cmwBusy === 'function' && !!document.getElementById('leftLed') && !!document.getElementById('ledLive')${viewName === 'steps' ? " && typeof __cmwSteps === 'function' && __cmwSteps().ready.ready" : ''}` });
};
// what a LED looks like and says: its shape (a fill or a ring, the corner radius), role, label and place in the tab order
const led = (id) => ev(`(() => { const e = document.getElementById('${id}'); if (!e) return null; const c = getComputedStyle(e), m = /rgba?\\(([^)]*)\\)/.exec(c.backgroundColor), a = m ? (m[1].split(',')[3] === undefined ? 1 : +m[1].split(',')[3]) : 1; return { cls: e.className, fill: a > 0, ring: c.boxShadow !== 'none', radius: c.borderTopLeftRadius, anim: c.animationName, role: e.getAttribute('role'), tab: e.tabIndex, label: e.getAttribute('aria-label'), tip: e.getAttribute('data-tip'), shown: e.getClientRects().length > 0 }; })()`);
const shape = (l) => JSON.stringify([l.fill, l.ring, l.radius]);
const live = () => ev(`document.getElementById('ledLive') ? document.getElementById('ledLive').textContent : null`);
const reach = async (id) => {
  await ev(`document.activeElement && document.activeElement.blur(); 1`);
  for (let i = 0; i < 90; i++) { await key('Tab'); if ((await ev(`document.activeElement.id`)) === id) return i + 1; }
  return 0;
};
const busy = (on) => ev(`__cmwBusy(${on})`);
const states = async (leg, sides) => {
  const L = {};
  for (const [side, id] of sides) {
    L[id] = { ok: await led(id) };
    ok(`${leg} ${id}: it is a focusable image with its state as the name (role img, tabindex 0, aria-label = tip)`, L[id].ok && L[id].ok.role === 'img' && L[id].ok.tab === 0 && L[id].ok.label === L[id].ok.tip && !!L[id].ok.tip, L[id].ok);
    const n = await reach(id);
    ok(`${leg} ${id}: Tab reaches it`, n > 0, n);
    if (n > 0) {
      await settled({ max: 4000, only: true, until: `!document.getElementById('tip').hidden` });
      const tip = await ev(`({ hidden: document.getElementById('tip').hidden, text: document.getElementById('tip').textContent })`);
      ok(`${leg} ${id}: its tip shows what it says, for a keyboard user`, !tip.hidden && tip.text.includes(L[id].ok.tip), tip);
    }
  }
  // busy: both LEDs
  await busy(true);
  await settled({ max: 4000, only: true, until: `document.querySelector('#leftLed').classList.contains('busy')` });
  for (const [, id] of sides) L[id].busy = await led(id);
  // up to date again
  await busy(false);
  await settled({ max: 4000, only: true, until: `document.querySelector('#leftLed').classList.contains('ok')` });
  return L;
};
const announced = async (leg, tipOf) => {
  await busy(true);
  const want = tipOf.busy;
  const s1 = await settled({ max: 4000, only: true, until: `(document.getElementById('ledLive').textContent || '').includes(${JSON.stringify(want)})` });
  ok(`${leg}: a busy state that holds is announced politely (#ledLive says "${want}")`, s1.ok, await live());
  // (each shown LED's words come once, with its pane's title when the pane shows one: "X · z-plane: ..." in the classic view,
  // where there are two; the steps view's hidden right LED says nothing)
  const shown = await ev(`['L', 'R'].map((side) => { const led = document.getElementById(side === 'L' ? 'leftLed' : 'rightLed'), t = document.querySelector(side === 'L' ? '#leftTitle .ptitle' : '#rightTitle .ptitle'); return { led: led.getClientRects().length > 0, title: t && t.getClientRects().length ? t.textContent.trim() : '' }; })`);
  const said = await live();
  // (a pane whose title is hidden at this width is named by its letter when two LEDs are shown, X and Y: the words alone would not say which)
  const two = shown.filter((x) => x.led).length > 1;
  const lines = shown.map((x, i) => ({ x, i })).filter((e) => e.x.led).map((e) => { const name = e.x.title || (two ? ['X', 'Y'][e.i] : ''); return (name ? name + ': ' : '') + tipOf.busy; });
  ok(`${leg}: each shown LED's words come once, with its pane's title (its letter when the title is hidden and two LEDs are shown)`, lines.length === (leg.startsWith('classic') ? 2 : 1) && said === lines.join('. '), { shown, said, lines });
  ok(`${leg}: #ledLive is a polite live region`, await ev(`document.getElementById('ledLive').getAttribute('aria-live') === 'polite'`));
  await busy(false);
  const s2 = await settled({ max: 4000, only: true, until: `(document.getElementById('ledLive').textContent || '').includes(${JSON.stringify(tipOf.ok)})` });
  ok(`${leg}: up to date again is announced`, s2.ok, await live());
  // a flicker (busy for 150 ms, then done) says nothing: the region is not touched
  await ev(`window.__ledMut = 0; new MutationObserver((m) => { window.__ledMut += m.length; }).observe(document.getElementById('ledLive'), { childList: true, characterData: true, subtree: true }); __cmwBusy(true); window.__ledT0 = performance.now(); 1`);
  await settled({ max: 4000, only: true, until: `performance.now() - window.__ledT0 > 150` });
  await busy(false);
  await ev(`window.__ledT0 = performance.now(); 1`);
  await settled({ max: 4000, only: true, until: `performance.now() - window.__ledT0 > 1200` });
  ok(`${leg}: a flicker is not announced`, (await ev(`window.__ledMut`)) === 0, await ev(`window.__ledMut`));
};
// ---- the classic view: both LEDs; the right one fails on a bad step
await open('classic', 1280, 800, false);
const cl = await states('classic', [['L', 'leftLed'], ['R', 'rightLed']]);
info.classic = cl;
await announced('classic', { busy: cl.leftLed.busy.tip, ok: cl.leftLed.ok.tip });
// the failed state, from a step that does not parse
await open('classic', 1280, 800, false, BAD);
await settled({ max: 20000, only: true, until: `document.getElementById('rightLed').classList.contains('err')` });
const err = await led('rightLed'), okL = await led('leftLed');
info.err = err;
ok('classic: a failed step makes the right LED err, with the step named in its tip', err.cls.includes('err') && !!err.tip, err);
ok('classic: the failed LED is focusable and named by its tip', err.role === 'img' && err.tab === 0 && err.label === err.tip, err);
const sizes = (a, b, c) => new Set([shape(a), shape(b), shape(c)]).size;
ok('classic: ok, busy and err are three different shapes (a viewer without hue tells them apart)', sizes(okL, cl.leftLed.busy, err) === 3, { ok: shape(okL), busy: shape(cl.leftLed.busy), err: shape(err) });
const errLive = await settled({ max: 4000, only: true, until: `(document.getElementById('ledLive').textContent || '').includes(${JSON.stringify(err.tip)})` });
ok('classic: a failed step is announced', errLive.ok, await live());
// ---- the classic view in Russian at the same width: the right pane's title is hidden, and its LED is named X / Y
await open('classic', 1280, 800, false, undefined, 'ru');
{
  const hidden = await ev(`(() => { const t = document.querySelector('#rightTitle .ptitle'); return !t || !t.getClientRects().length; })()`);
  ok('classic ru: the right pane head shows no title at 1280 px (the case this leg is for)', hidden, hidden);
  await busy(true);
  await settled({ max: 4000, only: true, until: `document.querySelector('#leftLed').classList.contains('busy')` });
  const busyTip = (await led('leftLed')).tip;
  await busy(false);
  await settled({ max: 4000, only: true, until: `document.querySelector('#leftLed').classList.contains('ok')` });
  const okTip = (await led('leftLed')).tip;
  ok('classic ru: the LED tips are the Russian ones', /[а-яё]/i.test(busyTip) && /[а-яё]/i.test(okTip), { busyTip, okTip });
  await announced('classic ru', { busy: busyTip, ok: okTip });
}
// ---- the steps view: the left LED
await open('steps', 1280, 800, false);
const sv = await states('steps', [['L', 'leftLed']]);
info.steps = sv;
await announced('steps', { busy: sv.leftLed.busy.tip, ok: sv.leftLed.ok.tip });
// ---- the pulse: the busy LED keeps 3:1 against the bar at its lowest opacity, in light and dark
const pulse = await ev(`(() => {
  const kf = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch (e) { return []; } }).find((r) => r.type === CSSRule.KEYFRAMES_RULE && r.name === 'led-pulse');
  const lows = kf ? [...kf.cssRules].map((r) => parseFloat(r.style.opacity)).filter((v) => !isNaN(v)) : [];
  const low = lows.length ? Math.min(...lows) : null, root = document.documentElement, e = document.getElementById('leftLed');
  const rgb = (css) => { const p = document.createElement('i'); p.style.color = css; document.body.append(p); const m = /rgba?\\(([^)]*)\\)/.exec(getComputedStyle(p).color)[1].split(',').map(Number); p.remove(); return m; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const barBg = () => { for (let n = e.parentElement; n; n = n.parentElement) { const m = /rgba?\\(([^)]*)\\)/.exec(getComputedStyle(n).backgroundColor); if (m) { const v = m[1].split(',').map(Number); if (v[3] === undefined || v[3] > 0.5) return v; } } return [255, 255, 255]; };
  const out = { low };
  for (const th of ['light', 'dark']) {
    root.setAttribute('data-theme', th);
    const bg = barBg(), fg = rgb('var(--warn)'), a = low === null ? 1 : low;
    out[th] = +cr([0, 1, 2].map((i) => Math.round(a * fg[i] + (1 - a) * bg[i])), bg).toFixed(2);
  }
  root.removeAttribute('data-theme');
  return out;
})()`);
info.pulse = pulse;
ok('the pulse has a lowest opacity', pulse.low !== null, pulse);
ok('the busy LED at the pulse\'s lowest opacity keeps 3:1 against the bar, in light', pulse.light >= 3, pulse);
ok('the busy LED at the pulse\'s lowest opacity keeps 3:1 against the bar, in dark', pulse.dark >= 3, pulse);
// ---- reduced motion: the pulse stops, and the shapes still tell the states apart
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await busy(true);
await settled({ max: 4000, only: true, until: `document.querySelector('#leftLed').classList.contains('busy')` });
const rb = await led('leftLed');
await busy(false);
await settled({ max: 4000, only: true, until: `document.querySelector('#leftLed').classList.contains('ok')` });
const ro = await led('leftLed');
info.reduced = { busy: rb, ok: ro };
ok('reduced motion: the busy LED is steady', rb.anim === 'none', rb);
ok('reduced motion: busy and up to date still differ in shape', shape(rb) !== shape(ro), { busy: shape(rb), ok: shape(ro) });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
// ---- a phone shows no LED, so none is a Tab stop, and its pane's states are said all the same: the polite region holds the LED's
// words (one pane is shown, the steps view's left, so no title or letter goes before them), once per change
await open('steps', 390, 844, true);
const ph = await led('leftLed');
ok('phone: the LED is not shown, so it is not a Tab stop', !ph || !ph.shown, ph);
// (a colour plot's program held linking, ?glhold: the left LED goes busy with its stand-in's tip while it links, and ok when it has)
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
for (const lang of ['en', 'ru', 'it']) {
  const leg = `phone ${lang}`;
  await view(360, 640, false, true);
  const ns = `ledph${lang}${Date.now() % 100000}`;
  await seed(ns, { steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }], shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 0, T: 1, scope: 'all', surf: 'plane' } });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&glhold&view=steps&lang=${lang}`);
  await settled({ max: 30000, panes: false, until: "typeof __cmwSteps === 'function' && !!window.GLR && !!document.getElementById('ledLive')" });
  const w = await settled({ max: 20000, only: true, panes: false, until: "document.querySelector('#leftLed').classList.contains('busy')" });
  const tip = (await led('leftLed')).tip;
  ok(`${leg}: the LED is not shown (display none), and busy while the colour plot's program links`, w.ok && !(await led('leftLed')).shown, await led('leftLed'));
  const s1 = await settled({ max: 6000, only: true, until: `(document.getElementById('ledLive').textContent || '').includes(${JSON.stringify(tip)})` });
  ok(`${leg}: a busy state that holds is said, once, by #ledLive: "${tip}"`, s1.ok && (await live()) === tip, { said: await live(), tip });
  await ev('GLR.holdLinks(false), 1');
  await settled({ max: 20000, only: true, panes: false, until: "document.querySelector('#leftLed').classList.contains('ok')" });
  const okTip = (await led('leftLed')).tip;
  const s2 = await settled({ max: 6000, only: true, until: `(document.getElementById('ledLive').textContent || '').includes(${JSON.stringify(okTip)})` });
  ok(`${leg}: up to date again is said, once: "${okTip}"`, s2.ok && (await live()) === okTip, { said: await live(), okTip });
}
return { pass: fails.length === 0, fails, info };
