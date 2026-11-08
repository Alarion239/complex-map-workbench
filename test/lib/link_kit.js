// Links and the figure they carry: what steps_link_migrate_cmd.js and steps_link_roundtrip_cmd.js use. An expression for eval in a
// suite (it reads the suite's DIR, fs, go, ev and sleep): `const { BASE, linkOf, reloadedFigure, openLinked } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'link_kit.js'), 'utf8'))`.
// - BASE: the daemon's page address, http://localhost:PORT;
// - linkOf(s, zip = true): a link's payload for the figure state s, as the app makes it: #cmw=0.<base64url JSON> (zip false) or
//   #cmw=1.<base64url of deflate-raw JSON>;
// - reloadedFigure(toastText): waits for the page a link or a scene opens in: openFigure writes the state and reloads the page, so the
//   read waits for that load's own toast (toastText) and the steps view on it, and the navigation the reload itself causes is waited
//   through, not read; the deadline is 30 s;
// - openLinked(state, ns): opens the figure state in the steps view through a deflate-raw link in a fresh namespace and answers
//   __cmwFigureState() of the page that opened.
(() => {
  const zlib = process.mainModule.require('zlib');
  const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
  const BASE = `http://localhost:${PORT}`;
  const NAV = /navigated or closed/;
  const POLL_MS = 250, POLL_MAX = 120;
  const b64u = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const linkOf = (s, zip = true) => { const raw = Buffer.from(JSON.stringify({ v: 1, s })); return zip ? '1.' + b64u(zlib.deflateRawSync(raw)) : '0.' + b64u(raw); };
  const reloadedFigure = async (toastText) => {
    const until = `(() => { const t = document.body && document.body.innerText || ''; return t.includes(${JSON.stringify(toastText)}) && typeof __cmwSteps === 'function' && __cmwSteps().on && !__cmwSteps().moving; })()`;
    for (let i = 0; i < POLL_MAX; i++) {
      let r = null;
      try { r = await ev(until); } catch (e) { if (!NAV.test(String(e && e.message || e))) throw e; }
      if (r && r.__exc && NAV.test(String(r.__exc))) r = null;
      if (r === true) return;
      await sleep(POLL_MS);
    }
    throw new Error(`the figure did not open: no "${toastText}" on the reloaded page`);
  };
  const openLinked = async (state, ns = 'lrt' + Date.now() + Math.floor(Math.random() * 1e6)) => {
    await go(`${BASE}/test.html?ns=${ns}&view=steps#cmw=${linkOf(state)}`);
    await reloadedFigure('Opened the figure from the link.');
    return ev('__cmwFigureState()');
  };
  return { BASE, linkOf, reloadedFigure, openLinked };
})()
