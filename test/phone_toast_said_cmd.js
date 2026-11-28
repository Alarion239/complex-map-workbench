// Phone landscape, the tall construction bar: a state message kept out of sight is still said. The steps view on example 1, the Hyperbolic
// tool picked so the bar opens at its tall height. Where the plane above the bar has no room for a message (568 × 320, 600 × 320), a sticky
// state message (as the Play gate's) raised there is kept out of sight (#toastHost[data-no-room], placeToasts), and content out of sight is
// not in the accessibility tree: its own role="status" and its host's aria-live say nothing. Its words are said once through another of the
// page's live regions instead; placed again (a resize) they are not said again; a new message with other words is said once in its turn. At
// 640 × 360 (control) the message shows, and its own role="status" says it: no other live region repeats its words. Every change of every
// live region ([aria-live]) but the message's host is counted. In en and ru, light and dark. In the steps view (ci/suite_views.js). A
// command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SETTLE_MS = 1000;   // how long after a message is raised, or placed again, the live regions are read, ms
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const WORDS = ['Still preparing the glide: the drawing programs are not ready yet', 'Still preparing the glide: the sheets are not ready yet'];
// (every change of every live region other than the message's own host (#toastHost, aria-live, which holds the message), as its words
// then: a region set twice to the same words counts twice)
const LISTEN = `(() => { window.__said = []; const els = [...document.querySelectorAll('[aria-live]')].filter((el) => el.id !== 'toastHost'); for (const el of els) new MutationObserver(() => __said.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true }); return els.length; })()`;
const said = (w) => ev(`__said.filter((t) => t.includes(${JSON.stringify(w)})).length`);
const read = () => ev(`(() => {
  const host = document.getElementById('toastHost'), t = host.querySelector('.toast');
  return { inHost: host.querySelectorAll('.toast').length, noRoom: host.hasAttribute('data-no-room'), shown: !!t && t.getClientRects().length > 0 && getComputedStyle(t).visibility === 'visible', tall: document.documentElement.classList.contains('ph-ctx-tall') };
})()`);
for (const dark of [false, true]) for (const lang of ['en', 'ru']) for (const [w, h] of [[568, 320], [600, 320], [640, 360]]) {
  if (dark && w !== 568) continue;
  const tag = `${lang}${dark ? ' dark' : ''} ${w}×${h}`, short = h === 320;
  await view(w, h, dark, true);
  await go('about:blank');
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=pts${w}${lang}${dark ? 'd' : ''}${Date.now() % 100000}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && __cmwSteps().ready.ready' });
  await ev(`__cmwExample(1); 1`);
  await settled({ max: 60000, until: '__cmwSteps().ready.ready' });
  await settled({ max: 20000, until: `!!document.querySelector('#constructTools .tool[data-tool="hyper"]')` });
  await ev(`document.querySelector('#constructTools .tool[data-tool="hyper"]').click(); 1`);
  await settled({ only: true, max: 20000, until: `document.documentElement.classList.contains('ph-ctx-tall') && !!document.querySelector('.ph-ctx.in')` });
  // (the example's message gone, by itself or as the bar opened)
  await settled({ only: true, max: 20000, until: `!document.querySelector('#toastHost .toast')` });
  const regions = await ev(LISTEN);
  ok(`${tag}: the page has live regions to say things in (control)`, regions > 0, regions);
  await ev(`__cmwToast(${JSON.stringify(WORDS[0])}, 'Retry', { sticky: true }); 1`);
  await frames(); await sleep(SETTLE_MS); await frames();
  const m = info[tag] = Object.assign(await read(), { said: await said(WORDS[0]) });
  if (!short) {
    ok(`${tag}: the state message has room and shows (control)`, m.inHost === 1 && m.shown && !m.noRoom, m);
    ok(`${tag}: no other live region repeats the words of a message that shows (its own role="status" says them)`, m.said === 0, m);
    continue;
  }
  ok(`${tag}: the state message is kept out of sight while the plane has no room for it (control)`, m.tall && m.inHost === 1 && !m.shown && m.noRoom, m);
  ok(`${tag}: the words of the state message kept out of sight are said once`, m.said === 1, m);
  // (placed again, by a resize, the message is still out of sight and its words are not said again)
  for (let i = 0; i < 3; i++) { await ev(`window.dispatchEvent(new Event('resize')); 1`); await frames(); }
  await view(w, h, dark, true); await frames(); await sleep(SETTLE_MS); await frames();
  const r = info[tag + ' placed again'] = Object.assign(await read(), { said: await said(WORDS[0]) });
  ok(`${tag}: placed again, the message kept out of sight is not said again`, r.inHost === 1 && !r.shown && r.said === 1, r);
  // (a new message with other words, raised while there is still no room, is said once in its turn)
  await ev(`__cmwToast(${JSON.stringify(WORDS[1])}, 'Retry', { sticky: true }); 1`);
  await frames(); await sleep(SETTLE_MS); await frames();
  const n = info[tag + ' new words'] = Object.assign(await read(), { said: await said(WORDS[1]) });
  ok(`${tag}: a new state message kept out of sight is said once`, n.inHost === 1 && !n.shown && n.said === 1, n);
}
return { pass: fails.length === 0, fails: fails.slice(0, 60), info };
