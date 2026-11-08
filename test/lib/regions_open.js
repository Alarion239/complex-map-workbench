// The regions suites' front (regions_phase_cmd.js, regions_phase_classic_cmd.js): a command file evaluates this file's
// text, `eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'regions_open.js'), 'utf8'))`, and calls the function it
// gives with the kit's helpers: ({ U, ev, send, nav, sleep, settled }) => { DISC, STATE, openSaved, readRegions, popFit }.
//   DISC, STATE(o)       a unit disc under exp, and a saved state around it with the fields of o set
//   openSaved(ns, st, lang)
//                        the app with the saved state st written straight to its storage (not the kit's load(), which
//                        sets a seeded pattern through the test hook): what a user's own saved work does; lang, when
//                        given, is the page's language; it returns once the page's __cmwRegions hook answers
//   readRegions(what, also)
//                        __cmwRegions() read as soon as the page has the hook and, when given, the expression also is
//                        true: one in-page wait, asked again (a page that reloads under it leaves the wait hanging) until the limit.
//                        what names the read; after REGIONS_READY_LIMIT_MS it throws, naming what never became ready
(({ U, ev, send, nav, sleep, settled }) => {
  // CMW_HOOK_DELAY_MS: the test page defines its __cmwRegions hook that long after it starts (off by default)
  const HOOK_DELAY_MS = (typeof process !== 'undefined' && +process.env.CMW_HOOK_DELAY_MS) || 0;
  const REGIONS_READY_LIMIT_MS = 60000;   // the longest the page may take to define the hook (and a link to open)
  const REGIONS_POLL_MS = 50;             // the in-page wait asks the condition this often
  const ASK_MS = 3000;                    // one in-page wait: a page that reloads under it leaves it hanging, so it is asked again
  const ASK_SLACK_MS = 2000;              // the kit's room for one ask to answer after its own limit
  const DISC = { id: 's1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true };
  const STATE = (o) => Object.assign({
    v3: true, v4: true, shapes: [DISC], steps: [{ type: 'exp', params: {}, on: true }], nextId: 50, focus: 0,
    rightMode: 'image', srcView: { cx: 0, cy: 0, s: 80 },
  }, o);
  const readRegions = async (what, also) => {
    const deadline = Date.now() + REGIONS_READY_LIMIT_MS;
    let last = null;
    while (Date.now() < deadline) {
      const ask = Math.min(ASK_MS, deadline - Date.now());
      try {
        const r = await ev(`await new Promise((res) => {
          const t0 = performance.now();
          const poll = () => {
            if (typeof __cmwRegions === 'function' && (${also || 'true'})) return res(__cmwRegions());
            if (performance.now() - t0 > ${ask}) return res(null);
            setTimeout(poll, ${REGIONS_POLL_MS});
          };
          poll();
        })`, ask + ASK_SLACK_MS);
        if (r && !r.__exc) return r;
        last = r;
      } catch (e) { last = String(e && e.message || e); }   // the page reloaded while the wait ran: the new page is asked
    }
    throw new Error(`${what}: __cmwRegions${also ? ' with ' + also : ''} never became ready within ${REGIONS_READY_LIMIT_MS} ms (last answer: ${JSON.stringify(last)})`);
  };
  const openSaved = async (ns, st, lang) => {
    await send('Page.navigate', { url: `${U}/gl-helpers.html` }); await sleep(350);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
    await nav(`${U}/test.html?ns=${ns}${lang ? `&lang=${lang}` : ''}${HOOK_DELAY_MS ? `&hook_delay=${HOOK_DELAY_MS}` : ''}`);
    await readRegions(`openSaved ${ns}`);
    await settled({ floor: 800 });
  };
  const popFit = async (lang, o) => {
    await openSaved(`rgph-fit-${lang}-${Date.now() % 1000000}`, STATE({}), lang);
    if (o.prep) { await ev(o.prep); await settled({ floor: 800 }); }
    await ev(`document.querySelector(${JSON.stringify(o.btn)}).click()`);
    await settled({ floor: 500, until: `!!document.querySelector(${JSON.stringify(o.pop)})` });
    const fit = await ev(`(() => {
      const p = document.querySelector(${JSON.stringify(o.pop)});
      if (!p || !p.querySelector('#regionsBox')) return null;
      const out = [p, ...p.querySelectorAll('*')]
        .filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1
          && getComputedStyle(e).overflowX !== 'visible')
        .map((e) => (e.id || e.className || e.tagName) + ' ' + e.scrollWidth + '/' + e.clientWidth);
      return { out, pw: Math.round(p.getBoundingClientRect().width) };
    })()`);
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
    await settled({ floor: 300 });
    return fit;
  };
  return { DISC, STATE, openSaved, readRegions, popFit };
})
