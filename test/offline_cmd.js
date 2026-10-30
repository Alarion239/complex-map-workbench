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
  }
  const want = [['400 14px "Archivo"', 'Ab'], ['italic 400 14px "STIX Two Text"', 'z'], ['400 12px "B612 Mono"', '0'], ['400 12px "JetBrains Mono"', '0']];
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
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
try { fs.unlinkSync(file); } catch (e) { /* the copy's folder goes with the run */ }

// the live page's Settings: Download offline page, with its size (test.html has no such meta: it is added here)
await load('offlineset' + Date.now(), { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
const label = await ev(`(() => {
  const m = document.createElement('meta'); m.name = 'cmw-offline'; m.content = '7593031'; document.head.append(m);
  document.getElementById('settingsBtn').click();
  const b = [...document.querySelectorAll('.set-pop .set-link')].find((x) => /offline/i.test(x.textContent));
  const t = b ? b.textContent : null;
  document.getElementById('settingsBtn').click();
  return t;
})()`);
ok('Settings: Download offline page (7.6 MB)', label === 'Download offline page (7.6 MB)', label);
const none = await ev(`(() => {
  document.querySelector('meta[name="cmw-offline"]').remove();
  document.getElementById('settingsBtn').click();
  const n = [...document.querySelectorAll('.set-pop .set-link')].filter((x) => /offline/i.test(x.textContent)).length;
  document.getElementById('settingsBtn').click();
  return n;
})()`);
ok('Settings: no entry without the size (the test page, the offline page)', none === 0, none);
return { pass: fails.length === 0, fails };
