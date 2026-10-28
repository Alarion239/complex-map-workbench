// v16.5 wave 1 merge: before / after pictures of the merge's own visible fixes (notes/ux-build/W1-MERGE.md), light and
// dark, Russian where words changed. "before" is dist/before-test.html: the merged tree with the pieces' conflicts
// resolved but without the merge's own fixes (built by the merge for these pictures only, then deleted); "after" is
// dist/test.html. Pictures: <daemon>/shots/w1-merge/<fix>-before|after-<light|dark>[-ru].png
//   title  Y's head with the chain empty at 1366 × 768: the tagged title no longer vanishes ("Y · " gives way first)
//   tile   the Russian phone's More tools: the Hyperbolic tile «Гиперб.» on one line (was «Гипербо-лическая»)
//   tap    a refused pick on the phone says Tap (was Click)
//   keys   a card's ⋯ on the laptop shows Alt ← / Alt →
// A command file for the CDP daemon (test/cdp_kit README).
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const PAGE = { before: 'before-test.html', after: 'test.html' };
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const UA0 = await ev('navigator.userAgent');
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const phone = async (dark) => { await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, platform: 'Linux armv8l' }); await view(412, 860, dark, true); };
const laptop = async (dark) => { await send('Emulation.setUserAgentOverride', { userAgent: UA0 }); await view(1366, 768, dark, false); };
const tap = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(200); };
const box = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
const st0 = (extra) => JSON.stringify(Object.assign({ v3: true, v4: true, unit: true, snap: true, shapes: [], steps: [], nextId: 10, focus: 0 }, extra || {}));
const open = async (which, ns, state, q = '') => {
  await nav(`http://localhost:${PORT}/${PAGE[which]}?ns=w1mclean`);
  await ev(`(() => { for (const k of Object.keys(localStorage)) if (k.endsWith(':${ns}')) localStorage.removeItem(k); ${state ? `localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(state)});` : ''} return 1; })()`);
  await nav(`http://localhost:${PORT}/${PAGE[which]}?ns=${ns}${q}`); await settle(900);
};
const out = [];
const S = async (name, clip) => { out.push(name); return shot('w1-merge/' + name, clip || undefined); };
const tool = async (id) => { await ev(`(() => { const b = [...document.querySelectorAll('[data-tool="${id}"]')].find((e) => e.offsetParent) || document.querySelector('[data-tool="${id}"]'); b.click(); return 1; })()`); await settle(150); };
for (const which of ['before', 'after']) {
  for (const dark of [false, true]) {
    const th = dark ? 'dark' : 'light';
    // title: Y's head with the chain empty
    await laptop(dark);
    await open(which, `w1ms${which}${th}t`, st0());
    const hd = await box('#paneR .pane-head');
    await S(`title-${which}-${th}`, hd && { x: hd.x, y: hd.y, width: hd.width, height: hd.height + 4 });
    // keys: a card's ⋯
    await open(which, `w1ms${which}${th}k`, st0({ steps: [{ type: 'exp', params: {}, on: true }, { type: 'recip', params: {}, on: true }] }));
    const cb = await box('#pipeline .card[data-k="1"] .thumb');
    if (cb) {
      const x = cb.x + 20, y = cb.y + 20;
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
      await settle(300);
      const m = await box('#popHost .pop.menu');
      await S(`keys-${which}-${th}`, m && { x: m.x - 4, y: m.y - 4, width: m.width + 8, height: m.height + 8 });
      await key('Escape'); await settle(150);
    }
    // tap: a refused pick on the phone (Hyperbolic line, a tap on empty space)
    await phone(dark);
    await open(which, `w1ms${which}${th}p`, st0());
    await tool('hyper');
    const e = await ev(`__cmwW2S('L', 2.2, 2.4)`);
    await tap(e[0], e[1]); await settle(250);
    const ch = await box('.cm-chip');
    await S(`tap-${which}-${th}`, ch && { x: 0, y: Math.max(0, ch.y - 8), width: 412, height: ch.height + 16 });
    // tile: the Russian phone's More tools
    await open(which, `w1ms${which}${th}r`, st0(), '&lang=ru');
    const more = await box('#secDraw .tool-more > summary');
    if (more) { await tap(more.x + more.width / 2, more.y + more.height / 2); await settle(800); }
    const sh = await box('.ph-sheet:not([hidden])');
    await S(`tile-${which}-${th}-ru`, sh && { x: 0, y: sh.y, width: 412, height: Math.min(860 - sh.y, sh.height) });
    await key('Escape'); await settle(150);
  }
}
await laptop(false); await view(1440, 900, false, false);
return { shots: out, errs: (await logs()).filter((x) => x.t === 'EXC').slice(0, 5) };
