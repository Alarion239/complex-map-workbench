// Phone landscape, the tall construction bar open with a state message up (sticky, as the Play gate's), then the window widened to a
// desktop's (1280 × 800) and narrowed back to the phone's size, the bar still open: the phone's layout comes back as it was before the
// widening. The steps view on example 1, the Hyperbolic tool picked so the bar opens at its tall height. At each of SIZES, in en (and
// ru, it, dark at some), the page is read before the widening and after the narrowing:
// - control: before the widening the tall bar is open, :root has ph-ctx-tall, and the tour's lane shows;
// - after the narrowing the bar still stands and :root has ph-ctx-tall again;
// - the tour's lane and every message shown keep the boxes they had before the widening (within SLACK px).
// In the steps view (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SLACK = 1;   // layout rounding, px
// [w, h, lang, dark]
const SIZES = [[568, 320, 'en', false], [600, 320, 'en', false], [640, 360, 'en', false], [740, 360, 'en', false], [568, 320, 'ru', true], [740, 360, 'it', true]];
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
// the page's layout: the bar (open and tall), :root's ph-ctx-tall, the tour's lane, the messages shown (box, first words)
const read = () => ev(`(() => {
  const R = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const lane = document.querySelector('.tour-lane'), host = document.getElementById('toastHost'), bar = document.querySelector('.ph-ctx.in');
  const msgs = [...host.querySelectorAll('.toast')].filter((t) => t.getClientRects().length && getComputedStyle(t).visibility === 'visible').map((t) => ({ box: R(t), words: t.textContent.slice(0, 32) }));
  return { phone: document.documentElement.classList.contains('ph'), bar: !!bar && bar.classList.contains('tall') && bar.getClientRects().length > 0, tall: document.documentElement.classList.contains('ph-ctx-tall'),
    lane: lane && lane.getClientRects().length ? R(lane) : null, msgs };
})()`);
const same = (a, b) => !!a && !!b && ['l', 't', 'r', 'b'].every((k) => Math.abs(a[k] - b[k]) <= SLACK);
for (const [w, h, lang, dark] of SIZES) {
  const tag = `${lang}${dark ? ' dark' : ''} ${w}×${h}`;
  await view(w, h, dark, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=pcr${w}${lang}${dark ? 'd' : ''}${Date.now() % 100000}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && __cmwSteps().ready.ready' });
  await ev(`__cmwExample(1); 1`);
  await settled({ max: 60000, until: '__cmwSteps().ready.ready' });
  await ev(`(() => { for (const t of document.querySelectorAll('#toastHost .toast')) t.remove(); })(), 1`);
  await settled({ max: 20000, until: `!!document.querySelector('#constructTools .tool[data-tool="hyper"]')` });
  await ev(`document.querySelector('#constructTools .tool[data-tool="hyper"]').click(); 1`);
  await settled({ only: true, max: 20000, until: `document.documentElement.classList.contains('ph-ctx-tall') && !!document.querySelector('.ph-ctx.in')` });
  await ev(`__cmwToast('Still preparing the glide', 'Retry', { sticky: true }); 1`);
  await frames(); await sleep(500); await frames();
  const before = info[tag + ' before'] = await read();
  ok(`${tag}: control: the tall bar is open, :root has ph-ctx-tall and the tour's lane shows`, before.phone && before.bar && before.tall && !!before.lane, before);
  // (widened to a desktop's, then narrowed back with the bar still open)
  await view(1280, 800, dark, false);
  await settled({ only: true, max: 20000, until: `!document.documentElement.classList.contains('ph')` });
  await frames(); await sleep(500);
  await view(w, h, dark, true);
  await settled({ only: true, max: 20000, until: `document.documentElement.classList.contains('ph')` });
  await frames(); await sleep(1000); await frames();
  const after = info[tag + ' after'] = await read();
  ok(`${tag}: narrowed back, the tall bar still stands and :root has ph-ctx-tall again`, after.phone && after.bar && after.tall, { before: { bar: before.bar, tall: before.tall }, after: { bar: after.bar, tall: after.tall } });
  ok(`${tag}: narrowed back, the tour's lane and the messages shown have the boxes they had before the widening`, same(before.lane, after.lane) && before.msgs.length === after.msgs.length && before.msgs.every((m, i) => same(m.box, after.msgs[i].box)),
    { lane: [before.lane, after.lane], msgs: [before.msgs, after.msgs] });
}
return { pass: fails.length === 0, fails, info };
