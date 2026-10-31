// The steps view's tour (#442): with ?view=steps the chapter "Planes" takes the place of Basics' X and Y steps and of the
// Deformation chapter, and each of its eight steps is done by what it asks: a pan or a zoom, › (or a swipe), the ring let go
// between two planes, Colour from here, › then a probe past the colour plane, Inside regions, Sphere, a click on the chip f₁.
// On the desk with a mouse (1280 wide) and on a phone with touch (390), in English and Russian: the chapter list, each step's
// words in the language, the strip inside the screen, the step done by its own action (and not before), and the rest of the
// tour running through (no step skipped for being clipped or for its scene; one for a control the steps view does not have).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const waitFor = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await sleep(150); } return false; };
const ORDER = ['plane', 'thread', 'park', 'colour', 'carried', 'inside', 'surface', 'step'];
// steps the tour skips in the steps view because the control they point at is not there (a step of another chapter)
const MISSING_OK = new Set(['views/switch', 'views/sphere', 'views/key', 'edit/cards', 'basics/add', 'branches/inverse', 'analysis/targets']);
for (const [name, w, h, touch] of [['desk', 1280, 800, false], ['phone', 390, 844, true]]) {
  for (const lang of ['en', 'ru']) {
    const tag = `${name} ${lang}`;
    await view(w, h, false, touch);
    await nav(`http://localhost:${PORT}/test.html?ns=tp${name}${lang}${Date.now() % 1000000}&view=steps${lang === 'en' ? '' : '&lang=' + lang}`);
    await waitFor(`document.querySelector('#svStrip') && typeof Tour !== 'undefined'`);
    await settle(1800);
    await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
    // the chapters: Planes after Basics, no Deformation, Basics without X and Y
    const chs = await ev(`Tour.chapters().map((c) => c.id)`);
    ok(`${tag}: Planes follows Basics, Deformation is gone`, chs[0] === 'basics' && chs[1] === 'planes' && !chs.includes('deform'), chs);
    const bs = await ev(`Tour._t.CHAPTERS[0].steps.map((s) => s.id)`);
    ok(`${tag}: Basics has no X, Y, preimages or chain step`, !['x', 'y', 'preimages', 'chain'].some((i) => bs.includes(i)), bs);
    const pos = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; })()`);
    const press = async (sel) => {
      const c = await pos(sel);
      if (!c) return false;
      if (touch) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } else await click(c.x, c.y);
      return true;
    };
    const st = () => ev(`(() => { const c = Tour.current(), l = Tour.lit(), s = window.__cmwSteps({ now: true }); return { id: c && c.id, ch: c && c.chapter, done: !!(l && l.done), body: l && l.body, strip: l && l.strip, anchor: !!(l && l.anchor), i: s.i, x: s.x, surf: s.surf }; })()`);
    const DO = {
      plane: async () => {
        const c = await pos('#plotL');
        // (empty space: away from the point z₀ at the plane's centre and the line, which a drag would move instead)
        if (touch) { const x0 = c.x - 60, y0 = c.y + 100; await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); for (let i = 1; i <= 5; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + i * 12, y: y0 }] }); await sleep(30); } await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
        else for (let i = 0; i < 3; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: c.x, y: c.y, deltaX: 0, deltaY: -120 }); await sleep(120); }
      },
      thread: async () => { await press('#svStrip .sv-next'); },
      park: async () => { await ev(`window.__cmwSteps({ park: 0.5 }), 1`); },
      colour: async () => { await press('#svHead .sv-cp'); },
      carried: async () => { await press('#svStrip .sv-next'); await sleep(1800); const c = await pos('#plotL'); for (const d of [0, 20, 40, 60]) { await move(c.x + d, c.y + d / 2); await sleep(150); } },
      inside: async () => { await press('#svHead .sv-scope [data-v="in"]'); },
      surface: async () => { if (!(await press('#svHead .sv-surf [data-v="sphere"]'))) { await press('#svHead .sv-surf1'); } },
      step: async () => { await press('#svStrip .sv-fchip'); },
    };
    await ev(`Tour.start({ chapter: 'planes' }), 1`);
    await waitFor(`Tour.current() && Tour.current().chapter === 'planes' && !!Tour.lit()`);
    await settle(1500);
    const seen = [];
    for (let n = 0; n < 8; n++) {
      const s0 = await st();
      seen.push(s0.id);
      ok(`${tag}: step ${n + 1} is ${ORDER[n]}`, s0.id === ORDER[n] && s0.ch === 'planes', s0);
      ok(`${tag} ${s0.id}: its anchor is on the screen`, s0.anchor, s0);
      if (s0.strip) ok(`${tag} ${s0.id}: the strip is inside the screen`, s0.strip.l >= -1 && s0.strip.r <= w + 1 && s0.strip.t >= -1 && s0.strip.b <= h + 1, s0.strip);
      if (lang === 'ru') ok(`${tag} ${s0.id}: the words are Russian`, /[А-Яа-я]/.test(s0.body || ''), s0.body && s0.body.slice(0, 50));
      else ok(`${tag} ${s0.id}: the words are English`, !/[А-Яа-я]/.test(s0.body || ''), s0.body && s0.body.slice(0, 50));
      ok(`${tag} ${s0.id}: not done before the user does it`, !s0.done, s0);
      if (DO[s0.id]) await DO[s0.id]();
      const done = await waitFor(`!!(Tour.lit() && Tour.lit().done)`, 9000);
      ok(`${tag} ${s0.id}: done by its action`, done, await st());
      await ev(`Tour.next(), 1`); await settle(900);
    }
    ok(`${tag}: the eight steps in order`, JSON.stringify(seen) === JSON.stringify(ORDER), seen);
    // on through the other chapters: each step shown or skipped for a control this view does not have
    for (let guard = 0; guard < 60; guard++) {
      const c = await ev(`Tour.current() && Tour.current().chapter`);
      if (!c) break;
      await ev(`Tour.next(), 1`); await sleep(500);
    }
    const sk = await ev(`Tour.skipped()`);
    info[tag] = { skipped: sk };
    ok(`${tag}: nothing skipped for being clipped or for its scene`, sk.every((x) => x.why === 'missing'), sk);
    ok(`${tag}: only steps whose control this view lacks are skipped`, sk.every((x) => MISSING_OK.has(x.id)), sk.map((x) => x.id));
    await ev(`Tour.stop(), 1`); await settle(500);
  }
}
return { pass: fails.length === 0, fails, info };
