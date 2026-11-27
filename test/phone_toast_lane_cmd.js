// Phone landscape, the tall construction bar (#2569): the steps view on example 1, opened after example 2, its "Opened …" message with Undo up, then the
// Hyperbolic tool picked so the bar opens at its tall height. Where the plane above the bar is too short to hold the message clear of
// the tour's lane (568 × 320 and 600 × 320), the message goes at once: from the bar's second frame, and a second later, no message
// lies over the lane or the bar, and none is left in the host. The example's opening is still undone by the rail's Undo key once the tool is put away (the bar's ×).
// At 640 × 360 (control) the
// message fits in the plane, clear of the lane, and stays. A state message (sticky, as the Play gate's) is not dropped: it is kept
// out of sight while there is no room and shows again once the bar closes. In en, ru and it, light and dark. In the steps view
// (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SLACK = 0.5;     // layout rounding, px
const SETTLE_MS = 1000;   // how long after the bar opens the message's place is read again, ms
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const read = () => ev(`(() => {
  const R = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const lane = document.querySelector('.tour-lane'), host = document.getElementById('toastHost'), bar = document.querySelector('.ph-ctx.in');
  const msgs = [...host.querySelectorAll('.toast')].filter((t) => t.getClientRects().length && getComputedStyle(t).visibility === 'visible').map((t) => ({ box: R(t), words: t.textContent.slice(0, 48) }));
  return { lane: lane && lane.getClientRects().length ? R(lane) : null, bar: bar ? { l: bar.offsetLeft, t: bar.offsetTop, r: bar.offsetLeft + bar.offsetWidth, b: bar.offsetTop + bar.offsetHeight } : null, msgs, inHost: host.querySelectorAll('.toast').length, tall: document.documentElement.classList.contains('ph-ctx-tall') };
})()`);
// (the bar's ×, which puts the tool away; Esc would also close a message that is up)
const barX = async () => {
  await ev(`(() => { const b = [...document.querySelectorAll('.ph-ctx.in button')].find((e) => e.textContent.trim() === '×'); if (b) b.click(); return !!b; })()`);
  await settled({ only: true, max: 20000, until: `!document.documentElement.classList.contains('ph-ctx-tall')` });
  await frames();
};
const meets = (a, b) => !!a && !!b && a.l < b.r && b.l < a.r && a.t < b.b - SLACK && b.t < a.b - SLACK;
const hyper = async () => {
  await settled({ max: 20000, until: `!!document.querySelector('#constructTools .tool[data-tool="hyper"]')` });
  await ev(`document.querySelector('#constructTools .tool[data-tool="hyper"]').click(); 1`);
  await settled({ only: true, max: 20000, until: `document.documentElement.classList.contains('ph-ctx-tall') && !!document.querySelector('.ph-ctx.in')` });
  await frames();
};
for (const dark of [false, true]) for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[568, 320], [600, 320], [640, 360]]) {
  if (dark && (w > 600 || lang === 'it')) continue;
  const tag = `${lang}${dark ? ' dark' : ''} ${w}×${h}`, short = h === 320;
  await view(w, h, dark, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=ptl${w}${lang}${dark ? 'd' : ''}${Date.now() % 100000}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && __cmwSteps().ready.ready' });
  // (example 2 first, so that the example's opening has something else to undo back to: the page may start on example 1)
  await ev(`__cmwExample(2); 1`);
  await settled({ max: 60000, until: '__cmwSteps().ready.ready' });
  const before = await ev('JSON.stringify(__cmwKeys().shapeIds)');
  await ev(`__cmwExample(1); 1`);
  const shown = await settled({ only: true, max: 10000, until: `!!document.querySelector('#toastHost .toast[data-undo]')` });
  ok(`${tag}: opening the example shows its message with Undo (control)`, shown.ok, null);
  ok(`${tag}: example 1's shapes are not example 2's (control)`, before !== await ev('JSON.stringify(__cmwKeys().shapeIds)'), before);
  await hyper();
  const m0 = info[tag + ' at once'] = await read();
  await sleep(SETTLE_MS); await frames();
  const m = info[tag] = await read();
  ok(`${tag}: the tall bar is open and the tour's lane shows (control)`, m.tall && !!m.lane && !!m.bar, { tall: m.tall, lane: m.lane, bar: m.bar });
  // (where the message stays, it rides up with the bar's slide: it is read once its place is settled)
  for (const [when, r] of short ? [['from the bar\'s second frame', m0], ['a second later', m]] : [['a second later', m]]) ok(`${tag}: ${when}, no message lies over the tour's lane or the bar`, !!r.lane && r.msgs.every((x) => !meets(x.box, r.lane) && !meets(x.box, r.bar)), { lane: r.lane, bar: r.bar, msgs: r.msgs });
  if (short) ok(`${tag}: the example's message, which the plane cannot hold, is gone`, m.inHost === 0, m.msgs);
  else ok(`${tag}: the example's message fits in the plane and stays (control)`, m.msgs.length === 1, m.msgs);
  if (!short) continue;
  // (the tool put away, the rail's Undo key still undoes the example's opening: the drop leaves the history as it was)
  await barX();
  const at = await ev(`(() => { const b = [...document.querySelectorAll('.ph-undo, .ph-hundo')].find((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  ok(`${tag}: the phone shows an Undo key (control)`, !!at, at);
  if (at) await click(at[0], at[1]);
  const undone = await settled({ only: true, max: 10000, until: `JSON.stringify(__cmwKeys().shapeIds) === ${JSON.stringify(before)}` });
  ok(`${tag}: the Undo key still undoes the example's opening`, undone.ok, { before, after: await ev('JSON.stringify(__cmwKeys().shapeIds)') });
  if (dark || lang !== 'en') continue;
  // (a state message is kept out of sight while there is no room, and shows again once the bar closes)
  await ev(`__cmwToast('Still preparing the glide', 'Retry', { sticky: true }); 1`);
  await frames(); await frames();
  await hyper(); await frames();
  const s1 = info[tag + ' sticky, bar open'] = await read();
  ok(`${tag}: a state message is kept, out of sight, while the plane has no room for it`, s1.inHost === 1 && s1.msgs.length === 0, s1);
  await barX(); await frames();
  const s2 = info[tag + ' sticky, bar closed'] = await read();
  ok(`${tag}: the state message shows again once the bar closes`, s2.msgs.length === 1 && /Still preparing/.test(s2.msgs[0].words), s2);
}
return { pass: fails.length === 0, fails: fails.slice(0, 60), info };
