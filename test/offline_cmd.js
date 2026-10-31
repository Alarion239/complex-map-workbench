// The offline page (issue #21, option b): dist/complex-map-workbench-offline.html opens from file:// with the network
// off and still has its typesetter (MathJax) and its faces, English and Russian, and asks the network for nothing.
// The live page (test.html with build.py's <meta name="cmw-offline">) offers it in Settings, with its size.
// A command file for a CDP daemon (test/cdp_kit).
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const dist = path.join(DIR, '..', '..', 'dist');
// (in the document shell ci/pages.py gives it, as Pages publishes it and a download saves it)
const page = fs.readFileSync(path.join(dist, 'complex-map-workbench-offline.html'), 'utf8');
const file = path.join(DIR, 'offline-page.html');
fs.writeFileSync(file, '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n' + page + '\n</body>\n</html>\n');
const url = 'file://' + (file.startsWith('/') ? '' : '/') + file.replace(/\\/g, '/');
await send('Network.enable');
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await view(1440, 900, false, false);
// (what the page asked of anything but itself: file:, data: and blob: URLs are its own)
const asked = () => ev(`performance.getEntriesByType('resource').map((e) => e.name).filter((n) => !/^(file|data|blob):/.test(n))`);
// (the list goes in as a JSON string: its faces' names are quoted; the loads' result is read back from window, polled,
// rather than awaited through the evaluation)
const faces = async (list) => {
  await ev(`window.__offFaces = null; Promise.all(JSON.parse(${JSON.stringify(JSON.stringify(list))}).map(([f, t]) => document.fonts.load(f, t).then((r) => r.length, () => -1))).then((r) => { window.__offFaces = r; }); 1`);
  for (let i = 0; i < 40; i++) { const r = await ev('window.__offFaces'); if (r) return r; await sleep(250); }
  return 'no answer in 10 s';
};
for (const lang of ['en', 'ru']) {
  await nav(`${url}?lang=${lang}&ns=offline${lang}`);
  // MathJax starts after the first paint (build.py): up to 30 s on a software renderer
  let mj = false;
  for (let i = 0; i < 60 && !mj; i++) { mj = await ev(`!!(window.MathJax && typeof MathJax.tex2svg === 'function')`); if (!mj) await sleep(500); }
  ok(`${lang}: MathJax loads with the network off`, mj, mj);
  if (mj) {
    const svg = await ev(`(() => { try { return MathJax.tex2svg('\\\\int_\\\\gamma f(z)\\\\,dz').querySelectorAll('path, use').length; } catch (e) { return String(e); } })()`);
    ok(`${lang}: MathJax typesets a formula`, typeof svg === 'number' && svg > 0, svg);
    // (#288) a formula whose glyphs are in ranges of the STIX2 font loaded on demand (Fraktur, Cyrillic): MathJax asks
    // for them (e.retry) and they come from the page itself; set again until it is typeset, at most 8 times
    await ev(`window.__offRange = null; (async () => { const t = '\\\\mathfrak{g}\\\\,\\\\text{кривая}'; for (let k = 0; k < 8; k++) { try { const n = MathJax.tex2svg(t); window.__offRange = { paths: n.querySelectorAll('path, use').length, text: n.querySelectorAll('text').length, retries: k }; return; } catch (e) { if (!e.retry) { window.__offRange = String(e.message); return; } await e.retry; } } window.__offRange = 'still waiting after 8 tries'; })(); 1`);
    let rg = null; for (let i = 0; i < 40 && !rg; i++) { rg = await ev('window.__offRange'); if (!rg) await sleep(250); }
    ok(`${lang}: a formula in ranges loaded on demand (Fraktur, Cyrillic) is typeset with the network off`, rg && typeof rg === 'object' && rg.paths > 0 && rg.text === 0 && rg.retries > 0, rg);
  }
  const want = [['400 14px "Roboto Flex"', 'Ab'], ['italic 400 14px "STIX Two Text"', 'z'], ['400 12px "JetBrains Mono"', '0']];
  if (lang === 'ru') want.push(['500 12px "Roboto Flex"', 'Жж']);
  const got = await faces(want);
  ok(`${lang}: every face loads from the page itself`, Array.isArray(got) && got.every((n) => n > 0), { faces: want.map((w) => w[0]), got });
  ok(`${lang}: the app started`, await ev(`!!document.querySelector('#app') && !document.documentElement.classList.contains('i18n-wait')`), null);
  ok(`${lang}: no request leaves the page`, JSON.stringify(await asked()) === '[]', await asked());
  ok(`${lang}: the offline page offers no download of itself`, await ev(`!document.querySelector('meta[name="cmw-offline"]')`), null);
  if (lang !== 'en') continue;
  // the figure export's PDF library (issue #393): its two blocks started as figure.js starts them (a Blob URL), then a
  // small SVG drawn into a PDF, all with the network off; the bytes start with %PDF
  await ev(`window.__offPdf = null; (async () => {
    const run = (id) => new Promise((res, rej) => { const b = document.getElementById(id), s = document.createElement('script');
      s.src = URL.createObjectURL(new Blob([JSON.parse(b.textContent)], { type: 'text/javascript' })); s.onload = res; s.onerror = rej; document.head.append(s); });
    await run('cmw-jspdf'); await run('cmw-svg2pdf');
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: [120, 80] });
    const svg = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><path d="M10 10 L110 70" stroke="#000"/><circle cx="60" cy="40" r="20" fill="#c33"/></svg>', 'image/svg+xml').documentElement;
    document.body.append(svg);
    await window.svg2pdf.svg2pdf(svg, doc, { x: 0, y: 0, width: 120, height: 80 });
    svg.remove();
    const out = doc.output();
    return { head: out.slice(0, 5), bytes: out.length };
  })().then((r) => { window.__offPdf = r; }, (e) => { window.__offPdf = { error: String(e) }; }); 1`);
  let pdf = null;
  for (let i = 0; i < 40 && !pdf; i++) { pdf = await ev('window.__offPdf'); if (!pdf) await sleep(250); }
  ok('the PDF library runs from the page itself and writes a PDF', pdf && pdf.head === '%PDF-' && pdf.bytes > 500, pdf);
  ok('the PDF library asked the network for nothing', JSON.stringify(await asked()) === '[]', await asked());
}
// (#491) the MathJax block is gzipped: a browser without DecompressionStream inflates it with the page's fflate; that
// browser here, its DecompressionStream deleted before the page runs
{
  const add = await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { delete window.DecompressionStream; } catch (e) {}' });
  await nav(`${url}?lang=en&ns=offlinenods`);
  let mj = false;
  for (let i = 0; i < 60 && !mj; i++) { mj = await ev(`!!(window.MathJax && typeof MathJax.tex2svg === 'function')`); if (!mj) await sleep(500); }
  ok('no DecompressionStream: MathJax still loads with the network off (fflate inflates the block)', mj && (await ev('typeof window.DecompressionStream')) === 'undefined' && (await ev('typeof window.fflate')) === 'object', mj);
  if (mj) {
    await ev(`window.__offRange = null; (async () => { const t = '\\\\mathfrak{g}\\\\,\\\\text{кривая}'; for (let k = 0; k < 8; k++) { try { const n = MathJax.tex2svg(t); window.__offRange = { paths: n.querySelectorAll('path, use').length, text: n.querySelectorAll('text').length }; return; } catch (e) { if (!e.retry) { window.__offRange = String(e.message); return; } await e.retry; } } window.__offRange = 'still waiting'; })(); 1`);
    let rg = null; for (let i = 0; i < 40 && !rg; i++) { rg = await ev('window.__offRange'); if (!rg) await sleep(250); }
    ok('no DecompressionStream: a formula in ranges loaded on demand is typeset', rg && typeof rg === 'object' && rg.paths > 0 && rg.text === 0, rg);
  }
  ok('no DecompressionStream: no request leaves the page', JSON.stringify(await asked()) === '[]', await asked());
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: add.identifier });
}
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
try { fs.unlinkSync(file); } catch (e) { /* the copy's folder goes with the run */ }

// the live page's Settings: Download offline page, with its size (test.html has no such meta: it is added here). On a
// cold start the app wires #settingsBtn only once its init has run, seconds after load() returns on a software
// renderer: the pop-down is opened by clicking until it is there (up to 30 s), never read before
await load('offlineset' + Date.now(), { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
const settingsLinks = async () => {
  for (let i = 0; i < 60; i++) {
    const r = await ev(`(() => {
      if (!document.querySelector('.set-pop')) { const b = document.getElementById('settingsBtn'); if (b) b.click(); }
      const pop = document.querySelector('.set-pop');
      if (!pop) return null;
      const out = [...pop.querySelectorAll('.set-link')].map((x) => x.textContent);
      document.getElementById('settingsBtn').click();   // (a re-click closes it)
      return out;
    })()`);
    if (Array.isArray(r)) return r;
    await sleep(500);
  }
  return 'the Settings pop-down never opened';
};
await ev(`(() => { const m = document.createElement('meta'); m.name = 'cmw-offline'; m.content = '7593031'; document.head.append(m); return 1; })()`);
const withMeta = await settingsLinks();
const label = Array.isArray(withMeta) ? withMeta.find((x) => /offline/i.test(x)) || null : withMeta;
ok('Settings: Download offline page (7.6 MB)', label === 'Download offline page (7.6 MB)', label);
await ev(`(() => { document.querySelector('meta[name="cmw-offline"]').remove(); return 1; })()`);
const without = await settingsLinks();
ok('Settings: no entry without the size (the test page, the offline page)', Array.isArray(without) && without.length > 0 && !without.some((x) => /offline/i.test(x)), without);
return { pass: fails.length === 0, fails };
