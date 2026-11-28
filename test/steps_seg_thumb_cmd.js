// The segmented controls' sliding thumb (setSeg, placeSegs: .seg's --seg-x and --seg-w) sits on the checked segment once the
// page has settled, also when the page's faces land after the thumb was first placed (the Google Fonts sheet held for HOLD_MS,
// as a slow network has it; the buttons narrow on the loaded faces): for every segmented control shown, --seg-x and --seg-w
// equal the checked button's offsetLeft and offsetWidth. The steps view, at each of SIZES (light and dark at 1440), in en, ru
// and it, read once the faces have landed and the view is idle:
// - control: the held load is up (the app's hooks) while its sheet still waits (print media), and its faces then land;
// - every segmented control shown has its thumb on its checked segment (at least one control is read);
// - the scope switch (Everywhere | Inside regions) is among them where the view's strip shows it (1440, 844 × 390).
// Then, Settings opened and closed OPENS times (its Language row is a segmented control built anew each time):
// - the segment buttons observed for their size do not grow with the openings (a closed popover's are let go).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// [w, h, dark, mobile]
const SIZES = [[1440, 900, false, false], [1440, 900, true, false], [1280, 800, false, false], [1024, 768, false, false], [844, 390, false, true]];
// (the scope switch is in the strip at these widths; at 1280 and 1024 it is behind the strip's ⋯)
const SCOPE_SHOWN = new Set([1440, 844]);
const HOLD_MS = 2500, POLL_MS = 200, POLL_MAX = 300;
const LANGS = ['en', 'ru', 'it'];
// (two frames after the view is idle: a thumb placed at the next frame is placed by then)
const FRAMES = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))';
const st = { v3: true, v4: true, v5: true, v6: true, alpha: 1, nextId: 50, focus: 0, rightMode: 'image',
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'exp', params: {}, on: true }] };
// every segmented control shown: { id, on: its checked segment's label, x, w: --seg-x and --seg-w, ox, ow: the checked
// segment's offsetLeft and offsetWidth }
const thumbs = () => ev(`[...document.querySelectorAll('.seg')].filter((el) => el.getClientRects().length > 0).map((el) => {
  const on = el.querySelector('.on'), px = (n) => parseFloat(el.style.getPropertyValue(n));
  return { id: el.id || el.className, scope: el.classList.contains('sv-scope'), on: on && on.textContent.trim(), x: px('--seg-x'), w: px('--seg-w'), ox: on ? on.offsetLeft : null, ow: on ? on.offsetWidth : null };
})`);
// the sheet's state: { media: the Google Fonts link's (print until it applies), fonts: document.fonts.status, hooks }
const sheet = () => ev(`(() => { const l = document.querySelector('link[rel=stylesheet][href*="fonts.googleapis"]'); return { media: l && l.media, fonts: document.fonts && document.fonts.status, hooks: typeof window.__cmwSteps }; })()`).catch(() => null);
for (const [w, h, dark, mobile] of SIZES) {
  for (const lang of LANGS) {
    const tag = `${w}×${h}${dark ? ' dark' : ''} ${lang}`;
    await holdSheet(0);
    await view(w, h, dark, mobile);
    const ns = 'segth' + Date.now();
    await seed(ns, st);
    await settled({ max: 5000, only: true, until: `document.readyState === 'complete' && localStorage.getItem('complex-map-workbench-v1:${ns}') !== null` });
    await holdSheet(HOLD_MS);
    // raw-navigate: the held sheet holds the load event back, which go() would wait on (as font_late does)
    await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
    let pre = null, s = null;
    for (let i = 0; i < POLL_MAX; i++) { await sleep(POLL_MS); s = await sheet(); if (!pre && s && s.hooks === 'function') pre = s; if (s && s.hooks === 'function' && s.media === 'all' && s.fonts === 'loaded') break; }
    ok(`${tag}: control: the app is up while its sheet waits, and the faces then land`, !!pre && pre.media === 'print' && !!s && s.media === 'all' && s.fonts === 'loaded', { pre, s });
    await settled({ max: 60000, faces: true, until: `__cmwSteps().on && !__cmwSteps().moving` });
    await ev(FRAMES);
    const all = await thumbs();
    const off = all.filter((t) => t.ox !== null && !(t.x === t.ox && t.w === t.ow));
    info[tag] = { n: all.length, off };
    ok(`${tag}: every segmented control shown has its thumb on its checked segment`, all.length > 0 && off.length === 0, { n: all.length, off });
    if (SCOPE_SHOWN.has(w)) ok(`${tag}: the scope switch is among them`, all.some((t) => t.scope), all.map((t) => t.id));
  }
}
await holdSheet(0);
// ---- a popover's segmented control, built anew on each opening, is let go when the popover closes ----
const OPENS = 6;
await view(1440, 900, false, false);
{
  const ns = 'segpop' + Date.now();
  await seed(ns, st);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && __cmwSteps().on && !__cmwSteps().moving` });
}
const opened = () => `!!document.querySelector('#setLang button.on')`;
const observedAt = [];
for (let i = 0; i < OPENS; i++) {
  await ev(`document.getElementById('settingsBtn').click(), 1`);
  await settled({ max: 8000, only: true, until: opened() });
  await ev(`document.getElementById('settingsBtn').click(), 1`);
  await settled({ max: 8000, only: true, until: `!document.getElementById('setLang')` });
  await ev(FRAMES);
  observedAt.push(await ev('__cmwSegObserved()'));
}
info.observed = observedAt;
ok(`Settings opened and closed ${OPENS} times: the segment buttons observed do not grow`, observedAt.length === OPENS && observedAt[OPENS - 1] === observedAt[1], observedAt);
return { pass: fails.length === 0, fails, info };
