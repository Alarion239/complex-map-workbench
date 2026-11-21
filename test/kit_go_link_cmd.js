// H.go (test/cdp_kit/cdpd.js) opens a #cmw= link once. A link opens in a second document (the app decodes it, drops the hash,
// saves its figure and reloads), so with a heavy second document the first load event is missing for longer than GO_STALL_MS while
// document 2 is still arriving. A navigation of the link again differs from the page that is loading only by its hash, so it is a
// navigation within that document: the app opens the link again, finds the figure its first open saved, and shows the ask toast ("This
// link holds a figure. Open it in place of yours?") instead of the opened one.
//   - the link's second document is held back past 5 s (a server for dist/ that sends STALL_BYTES of it and the rest HOLD_MS
//     later, with the Google Fonts sheet held so the first document's load event does not come before the reload): after go and after
//     nav the page shows the opened figure's toast, not the ask;
//   - control: a plain url, held the same way, is still opened again by go (the stall rule stays for a document that is not a link);
//   - a link whose FIRST document stalls before the app has run (the hash still on the page) is opened again: the app has not read it;
//   - control: a link whose documents never arrive is opened again at most LOAD_RELOADS times: go then answers false within its limit and says so.
// It runs in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// (GO_STALL_MS is the kit's: a document stalled this long is opened again, unless it is a link)
const HOLD_MS = GO_STALL_MS + 3000, STALL_BYTES = 1 << 20, SHEET_MS = 6000, GO_LIMIT_MS = 40000, NEVER_LIMIT_MS = 12000;
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
await nav(`http://localhost:${PORT}/test.html?ns=kitgolinkbase${Date.now()}&view=steps`);
const payload = await ev('await Params.encodeLink(__cmwP().figure)');
// (a server for dist/ whose n-th test.html arrives late, test/lib/dist_server.js: STALL_BYTES at once, the rest HOLD_MS later, or never)
const { serveDist: serve } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'dist_server.js'), 'utf8'))({ http, fs, path, DIR });
const serveDist = (late, never) => serve(late, { partial: STALL_BYTES, holdMs: never ? 0 : HOLD_MS });
const close = (srv) => { srv.closeAllConnections(); srv.close(); };
// the toasts the page shows over the next ms: the opened figure's, or the ask
const toasts = async (ms) => {
  const seen = new Set();
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(200)) {
    let r = null;
    try { r = await ev(`[...document.querySelectorAll('.toast')].map((t) => t.textContent.trim())`); } catch (e) { r = null; }
    for (const t of r || []) seen.add(t);
    if ([...seen].some((t) => /^Opened the figure from the link\./.test(t) || /^This link holds a figure\./.test(t))) break;
  }
  return [...seen];
};
await holdSheet(SHEET_MS);
try {
  for (const [how, open] of [['go', (u) => go(u, GO_LIMIT_MS)], ['nav', (u) => nav(u)]]) {
    const srv = await serveDist((n) => n === 2);
    try {
      logs();
      const t0 = Date.now();
      const r = await open(`${srv.origin}/test.html?ns=kitgolink${how}${t0}&view=steps#cmw=${payload}`);
      const seen = await toasts(10000);
      info[how] = { answer: r && typeof r === 'object' ? { ok: r.ok, loaded: r.loaded } : r, tests: srv.tests, ms: Date.now() - t0, toasts: seen, hash: await ev('location.hash'), requests: srv.log, events: logs().filter((l) => l.t === 'cdp' || l.t === 'warn').map((l) => l.m.slice(0, 90)) };
      ok(`${how}: a link whose second document is held past GO_STALL_MS opens: the page shows the opened figure's toast, not the ask`, seen.some((t) => /^Opened the figure from the link\./.test(t)) && !seen.some((t) => /^This link holds a figure\./.test(t)), info[how]);
    } catch (e) { ok(`${how}: the link opens`, false, String((e && e.message) || e)); }
    finally { close(srv); }
  }
  // control: the stall rule stays for a document that is not a link
  const plain = await serveDist((n) => n === 1);
  try {
    const t0 = Date.now();
    const loaded = await go(`${plain.origin}/test.html?ns=kitgoplain${t0}&view=steps`, GO_LIMIT_MS);
    info.plain = { loaded, tests: plain.tests, ms: Date.now() - t0 };
    ok('go: control: a plain url whose document stalls is opened again, and go answers true', loaded === true && plain.tests === 2, info.plain);
  } finally { close(plain); }
  // a link whose FIRST document stalls before the app has run (the page is the link's own url, the hash still on it, the body never
  // finishing): the app has not read the link, so go opens it again, and the page then shows the opened figure's toast
  const firstStalls = await serveDist((n) => n === 1, true);
  try {
    logs();
    const t0 = Date.now();
    const loaded = await go(`${firstStalls.origin}/test.html?ns=kitgofirst${t0}&view=steps#cmw=${payload}`, GO_LIMIT_MS);
    const seen = await toasts(10000);
    info.firstStalls = { loaded, tests: firstStalls.tests, ms: Date.now() - t0, toasts: seen, requests: firstStalls.log };
    ok('go: a link whose first document never finishes arriving (the hash still on the page) is opened again, go answers true, and the page shows the opened figure\'s toast', loaded === true && firstStalls.tests >= 2 && seen.some((t) => /^Opened the figure from the link\./.test(t)) && !seen.some((t) => /^This link holds a figure\./.test(t)), info.firstStalls);
  } finally { close(firstStalls); }
  // control: a link whose documents never arrive is opened again at most LOAD_RELOADS times; go then gives up within its limit and says so
  const never = await serveDist(() => true, true);
  try {
    logs();
    const t0 = Date.now();
    const loaded = await go(`${never.origin}/test.html?ns=kitgonever${t0}&view=steps#cmw=${payload}`, NEVER_LIMIT_MS);
    const warn = logs().filter((l) => l.t === 'warn').map((l) => l.m).join(' | ');
    info.never = { loaded, tests: never.tests, ms: Date.now() - t0, warn };
    ok('go: control: a link whose document never arrives is opened again, but not past the kit\'s reload count, and go answers false within its limit, naming the stall', loaded === false && never.tests >= 2 && never.tests <= 1 + LOAD_RELOADS && info.never.ms < NEVER_LIMIT_MS + 3000 && /reloads [12];/.test(warn) && /link/.test(warn) && /stall/i.test(warn), info.never);
  } finally { close(never); }
} finally { await holdSheet(0); }
return { pass: fails.length === 0, fails, info };
