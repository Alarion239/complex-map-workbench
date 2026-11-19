// The marked preimages of a later plane's point, said to a screen reader (#1770): the plane draws at most four of them
// (p₍1₎ … p₍4₎) and "+n more" for the rest, on the canvas only; the plane's description (the canvas's aria-describedby
// names a hidden span) says the same count in words: "Marked preimages of p: 4 of 5".
// The steps view, z⁵ with the point p = 0.5 + 0.3i on w₁, whose five preimages on z lie on the circle |z| = 0.887:
//  - at the default camera all five are in the window: four marked, "+1 more" drawn, and the description says 4 of 5;
//  - zoomed in on one of them (2000 px a unit), one is in the window: "+4 more" drawn, the description says 1 of 5
//    (the count follows the window, as the label does);
//  - with the camera far from them, none is in the window: no label, and the description says nothing of p;
//  - in English, Russian and Italian, each in the words of its own table;
//  - the classic view's left plane says it too (en).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MS = 40000, READY_MS = 60000;
const fails = [], info = {};
const ok = (name, pass, got) => { if (!pass) fails.push({ name, got }); };
const P = [0.5, 0.3];
const ROOT = (() => { const r = Math.pow(Math.hypot(P[0], P[1]), 1 / 5), a = Math.atan2(P[1], P[0]) / 5; return [r * Math.cos(a), r * Math.sin(a)]; })();
const STEPS = [{ type: 'pown', params: { n: 5 }, on: true }];
const POINT = { id: 'p1', kind: 'point', p: P, stage: 1, label: 'p', ci: 2 };
const SAID = {
  en: (k, n) => `Marked preimages of p: ${k} of ${n}.`,
  ru: (k, n) => `Отмеченные прообразы p: ${k} из ${n}.`,
  it: (k, n) => `Controimmagini segnate di p: ${k} su ${n}.`,
};
const MORE = { en: (n) => `+${n} more`, ru: (n) => `ещё ${n}`, it: (n) => `altri ${n}` };
const CAMS = [{ tag: 'default camera', s: 90, at: [0, 0], k: 4 }, { tag: 'zoomed in on one', s: 2000, at: ROOT, k: 1 }, { tag: 'far from them', s: 90, at: [40, 40], k: 0 }];
const until = (expr, max = READY_MS) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const open = async (lang, cam, vw) => {
  const ns = `premore-${lang}-${cam.s}-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [POINT], steps: STEPS, nextId: 50, focus: 0, srcView: { cx: cam.at[0], cy: cam.at[1], s: cam.s } };
  await view(1440, 900, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}` + (vw === 'steps' ? '&view=steps' : '&view=classic'));
  await until(vw === 'steps' ? "typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane') && __cmwSteps().planes.length === 2" : "typeof __cmwLabelsPlaced === 'function'", LOAD_MS);
  if (vw === 'steps') await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
};
// the plane's description, and the "+n more" the placer drew; once the preimages are solved (a label drawn, or the window
// holding none of them)
const said = () => ev(`(() => { const c = document.getElementById('overlayL'), id = c && c.getAttribute('aria-describedby'), e = id && document.getElementById(id); return e ? e.textContent : ''; })()`);
const read = async (lang, cam) => {
  const more = /^(\+\d+ more|ещё \d+|altri \d+)$/;
  await until(cam.k ? `(__cmwLabelsPlaced() || []).some((q) => ${more}.test(q.text))` : 'true');
  await frames();
  return { said: await said(), more: (await ev('__cmwLabelsPlaced()')).filter((q) => more.test(q.text)).map((q) => q.text) };
};
for (const lang of ['en', 'ru', 'it']) for (const cam of CAMS) {
  const tag = `${lang}, ${cam.tag}`;
  await open(lang, cam, 'steps');
  const r = await read(lang, cam);
  info[tag] = r;
  if (cam.k) {
    ok(`${tag}: the plane draws "${MORE[lang](5 - cam.k)}"`, r.more.length === 1 && r.more[0] === MORE[lang](5 - cam.k), r.more);
    ok(`${tag}: the plane's description says "${SAID[lang](cam.k, 5)}"`, r.said.includes(SAID[lang](cam.k, 5)), r.said);
  } else {
    ok(`${tag}: no "+n more" is drawn`, !r.more.length, r.more);
    ok(`${tag}: the description says nothing of p`, !/\bp\b/.test(r.said), r.said);
  }
}
{
  await open('en', CAMS[0], 'classic');
  const r = await read('en', CAMS[0]);
  info.classic = r;
  ok('classic view: the left plane draws "+1 more"', r.more.length === 1 && r.more[0] === MORE.en(1), r.more);
  ok(`classic view: its description says "${SAID.en(4, 5)}"`, r.said.includes(SAID.en(4, 5)), r.said);
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
