// The smoke suite: a short check that the page works at all, run with every browser tier of CI (ci/impact.js) so a
// change that selects few suites still loads the app once in each language and layout. In English and Russian, on
// the desktop (1440 px) and on a phone (390 px): the page opens with no page error and in its language; a chain of two
// steps builds without errors and its disc is drawn on both planes; the top bar's view switch goes to Phase,
// Landscape and back, and the app keeps drawing. A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/smoke_cmd.js
// Prints {pass, fails, info}.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
const DISC = { id: 's1', kind: 'disc', c: [0, 0], r: 1 };
const CHAIN = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }];
// waits until the disc is drawn (a mesh and its lines on the GPU), or ms pass -> its __cmwInfo row
const drawn = async (ms = 20000) => {
  const t0 = Date.now();
  for (;;) {
    const r = await ev(`(__cmwInfo().find((x) => x.id === 's1') || null)`);
    if ((r && r.tris > 0 && r.segs > 0) || Date.now() - t0 > ms) return r;
    await sleep(300);
  }
};

for (const [lang, w] of [['en', 1440], ['ru', 1440], ['en', 390], ['ru', 390]]) {
  const phone = w < 768, tag = `${lang} ${w}`;
  await view(w, phone ? 844 : 900, false, phone);
  // a saved state for this namespace, written from a page of the same origin, then the app with the language forced
  const ns = `smoke-${lang}-${w}-${Date.now()}`;
  await send('Page.navigate', { url: `${U}/gl-helpers.html` }); await sleep(350);
  const st = { v3: true, v4: true, shapes: [DISC], steps: CHAIN, nextId: 50, focus: 0, rightMode: 'image' };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await logs();
  await nav(`${U}/test.html?ns=${ns}&lang=${lang}`); await settle(800);
  ok(`${tag}: the app started`, await ev(`typeof __cmwP === 'function' && typeof __cmwLayout === 'function'`), null);
  // (English leaves the page's lang as it is; the view switch's names are in the page's language)
  const names = await ev(`[...document.querySelectorAll('#viewSwitch button')].map((b) => b.getAttribute('aria-label')).join(' | ')`);
  ok(`${tag}: the page is in its language`, lang === 'ru' ? (await ev('document.documentElement.lang')) === 'ru' && /[а-я]/i.test(names) : !/[а-я]/i.test(names) && /[a-z]/i.test(names), { lang: await ev('document.documentElement.lang'), names });
  ok(`${tag}: the window is ${w} px wide`, (await ev('innerWidth')) === w, await ev('innerWidth'));
  // the chain
  const P = await ev('(() => { const p = __cmwP(); return { steps: p.steps.map((s) => s.type), errors: p.errors, shapes: p.shapes.map((s) => s.id) }; })()');
  ok(`${tag}: the chain has its two steps and the disc`, JSON.stringify(P.steps) === '["exp","mobius"]' && JSON.stringify(P.shapes) === '["s1"]', P);
  ok(`${tag}: the chain builds without errors`, P.errors.every((e) => !e), P.errors);
  // the planes
  const d0 = await drawn();
  ok(`${tag}: the disc is drawn (mesh and lines)`, d0 && d0.tris > 0 && d0.segs > 0, d0);
  const lay = await ev('__cmwLayout()');
  info[tag] = { layout: lay, drawn: d0 };
  ok(`${tag}: the planes are shown`, lay.shown.length >= 1 && lay.wL + lay.wR > 0, lay);
  // the view switch: through its buttons (a real click where it is on screen; the phone may keep it in a sheet)
  for (const mode of ['phase', 'land', 'xy']) {
    const c = await ev(`(() => { const b = document.querySelector('#viewSwitch button[data-mode="${mode}"]'); if (!b) return 'none'; const r = b.getBoundingClientRect(); if (!r.width || !b.offsetParent) { b.click(); return 'js'; } return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    ok(`${tag}: the view switch has ${mode}`, c !== 'none', c);
    if (Array.isArray(c)) await click(c[0], c[1]);
    await settle(1200);
    const m = await ev('__cmwLayout().main');
    ok(`${tag}: the view switch goes to ${mode}`, m === mode, m);
  }
  const d1 = await drawn();
  ok(`${tag}: the disc is drawn after the view switch`, d1 && d1.tris > 0 && d1.segs > 0, d1);
  const e = errs(await logs());
  ok(`${tag}: no page errors`, !e.length, e.slice(0, 5).map((x) => String(x.m).slice(0, 300)));
}

return { pass: !fails.length, fails, info };
