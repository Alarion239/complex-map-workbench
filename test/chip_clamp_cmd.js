// The picks' chip on a plane may take three lines in Russian and Italian from 1280 to 1440 px, two in English (issue #31).
// A command file for a CDP daemon: the rule is read from a chip made for the purpose, so no construction is needed.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const clamp = () => ev(`(() => { const host = document.getElementById('plotL'), box = document.createElement('div'); box.className = 'draft-chip cm-on'; box.innerHTML = '<span class="cm-chip"><span class="cm-t">x</span></span>'; host.append(box); const v = getComputedStyle(box.querySelector('.cm-t')).webkitLineClamp; box.remove(); return v; })()`);
await view(1366, 768, false, false);
await load('clampbase' + Date.now(), { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
const base = await ev('location.origin');
for (const [lang, w, h, want] of [['ru', 1366, 768, '3'], ['it', 1366, 768, '3'], ['en', 1366, 768, '2'], ['ru', 1600, 900, '2']]) {
  await view(w, h, false, false);
  await nav(`${base}/test.html?ns=clamp${lang}${w}&lang=${lang}`); await sleep(2200);
  const v = await clamp();
  ok(`${lang} at ${w}: the chip's line clamp is ${want}`, v === want, v);
}
return { pass: fails.length === 0, fails };
