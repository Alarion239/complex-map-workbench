// The guide (issue #34): a contents row that jumps to a section, a search that folds the others away, the sections
// Zeros and poles, Examples and Export, and a Show me that starts the section's tour chapter; the Deformation section and
// its Keys rows in the steps view, and their absence, with the palette's Deformation commands, in the classic view; the
// steps view's Deformation section describes its glide (in en and ru, and on a phone): none of the classic transport's
// words, and each control it names in bold is on the thread's strip or in its Playback dialog. A command file for a CDP
// daemon. It runs in the steps view (ci/suite_views.js: steps({ pin: true })), where the Try line is the steps view's own;
// the classic view's leg asks for ?view=classic.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('guidenav' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settled();
if (!(await ev(`!!(window.__cmwSteps && __cmwSteps().on)`))) return { pass: false, fails: ['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)'] };
// an example says what to try, in the tour's line, with a Show me
await ev(`__cmwExample(3)`); await settled();
const ln = await ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return l ? { text: l.textContent.replace(/\\s+/g, ' ').trim(), btn: [...l.querySelectorAll('.tl-act')].map((b) => b.textContent.trim()) } : null; })()`);
ok('an example opens with its Try line and a Show me', ln && /Joukowski/.test(ln.text) && /Try: drag the circle through 1, then press ›/.test(ln.text) && ln.btn.some((b) => /Show me/.test(b)), ln);
await key('?', 0); await settled();
const g = await ev(`(() => { const m = document.querySelector('.modal'); if (!m) return null; return { toc: [...m.querySelectorAll('.guide-toc-b')].map((b) => b.textContent), secs: m.querySelectorAll('.guide-sec').length, find: !!m.querySelector('.guide-find'), show: [...m.querySelectorAll('.guide-show .btn')].length }; })()`);
ok('the guide has a contents row and a search', g && g.toc.length >= 12 && g.find && g.secs === g.toc.length, g);
ok('the new sections are there', g && ['Zeros and poles', 'Examples', 'Export'].every((t) => g.toc.includes(t)), g && g.toc);
ok('sections about what the tour teaches end in Show me', g && g.show >= 6, g);
// the search folds the sections that do not match
await ev(`(() => { const f = document.querySelector('.guide-find'); f.value = 'Overleaf'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`); await settled();
const s = await ev(`({ shown: [...document.querySelectorAll('.guide-sec')].filter((x) => !x.hidden).map((x) => x.querySelector('h3').textContent), none: !document.querySelector('.guide-none').hidden })`);
ok('the search leaves the sections with the word', s.shown.length >= 1 && s.shown.includes('Export') && s.shown.length < 6 && !s.none, s);
await ev(`(() => { const f = document.querySelector('.guide-find'); f.value = 'qzxqzx'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`); await settled();
ok('a search with no match says so', await ev(`!document.querySelector('.guide-none').hidden && ![...document.querySelectorAll('.guide-sec')].some((x) => !x.hidden)`), null);
await ev(`(() => { const f = document.querySelector('.guide-find'); f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true })); })()`); await settled();
// the Deformation section is the steps view's glide: none of the classic transport's words (its X → Y, the transport under
// the panel, the Deformation button of the top bar and its turning off), and each control it names in bold is on the
// thread's strip or in its Playback dialog, by the name the page gives it (a bold lead ending in a full stop is a
// paragraph's title, not a control)
const DEFORM = `(() => { const sec = [...document.querySelectorAll('.guide-sec')].find((x) => x.querySelector('h3').textContent === $t('Deformation'));
  if (!sec) return null;
  const names = new Set();
  const add = (v) => { if (v) names.add(v.replace(/\\s+/g, ' ').trim()); };
  for (const el of document.querySelectorAll('.sv-nav, .sv-playmore, .sv-loop, .sv-paths, .sv-choice, .sv-playpop-r > span')) { add(el.getAttribute('aria-label')); add(el.textContent); if (el.choices) for (const c of el.choices) add(c[1]); }
  add($t('Playback'));
  const bold = [...sec.querySelectorAll('p b')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()).filter((b) => !/[.:]$/.test(b));
  return { text: sec.textContent.replace(/\\s+/g, ' '), bold, missing: bold.filter((b) => !names.has(b)), names: [...names] };
})()`;
const d = await ev(DEFORM);
ok('the guide has a Deformation section', !!d, d);
ok('the Deformation section has none of the classic transport\'s words', d && !/X\s*→\s*Y|transport|top bar|panes|turning the deformation off/i.test(d.text), d && d.text.slice(0, 600));
ok('each control the Deformation section names in bold is on the strip or in Playback', d && d.bold.length >= 3 && d.missing.length === 0, d && { bold: d.bold, missing: d.missing, names: d.names });
// Show me on Planes and surfaces starts the steps view's chapter in its place, Planes
await ev(`[...document.querySelectorAll('.guide-sec')].find((x) => x.querySelector('h3').textContent === 'Planes and surfaces').querySelector('.guide-show .btn').click()`); await settled();
const t = await ev(`({ modal: !!document.querySelector('.modal-bg'), cur: Tour.isActive() ? Tour.current().chapter : null })`);
ok('Show me closes the guide and starts that chapter', !t.modal && t.cur === 'planes', t);
// Show me on Deformation starts the steps view's Playing the chain; the Keys rows give K or M (play) and P (paths)
await key('Escape'); await settled();
await key('?'); await settled();
const dk = await ev(`(() => { const m = document.querySelector('.modal'); return m ? { deform: [...m.querySelectorAll('h3')].some((h) => h.textContent.trim() === 'Deformation'), play: /Play the chain, or pause it/.test(m.innerText), paths: /Paths t ↦ Hₜ\\(z\\) on or off/.test(m.innerText) } : null; })()`);
ok('the steps view\'s guide has the Deformation section and the Keys rows for play (K, M) and paths (P)', dk && dk.deform && dk.play && dk.paths, dk);
await ev(`[...document.querySelectorAll('.guide-sec')].find((x) => x.querySelector('h3').textContent === 'Deformation').querySelector('.guide-show .btn').click()`); await settled();
const td = await ev(`({ modal: !!document.querySelector('.modal-bg'), cur: Tour.isActive() ? Tour.current().chapter : null })`);
ok('Show me on Deformation starts Playing the chain', !td.modal && td.cur === 'playing', td);
await ev(`Tour.stop(), 1`); await settled();
// the palette finds the guide's sections by what they are for: "Planes and surfaces" by its aliases (GUIDE_SECS), and the row opens the guide
// at that heading
await key('k', 4); await settled();
await type('planes and surfaces'); await settled();
const pp = await ev(`(document.getElementById('palList') || {}).innerText || ''`);
ok('the palette lists Guide: Planes and surfaces for its title', /Guide: Planes and surfaces/.test(pp), pp.slice(0, 300));
await key('Enter'); await settled();
const pg = await ev(`(() => { const m = document.querySelector('.modal-bg .modal'); return { open: !!m, heading: !!(m && [...m.querySelectorAll('h3')].some((h) => h.textContent.trim() === 'Planes and surfaces')) }; })()`);
ok('that row opens the guide, which has the heading', pg.open && pg.heading, pg);
await key('Escape'); await settled();
// the Alt+arrows row (the sound probe on a plane) is the steps view's: its keys
const ak = await ev(`(() => { const m = document.querySelector('.modal'); return m ? /move the probe/.test(m.innerText) : null; })()`);
await key('?'); await settled();
const aks = await ev(`(() => { const m = document.querySelector('.modal'); return m ? /move the probe/.test(m.innerText) : null; })()`);
ok('the steps view\'s Keys has the Alt+arrows row that moves the sound probe', aks === true, { aks, ak });
await key('Escape'); await settled();
// the classic view (?view=classic) has no deformation: its guide has no Deformation section and no Keys row for it, and its
// palette offers no Deformation command and no jump to that section
await loadView('classic', 'guidenavc' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }, { type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settled();
await key('?'); await settled();
const cg = await ev(`(() => { const m = document.querySelector('.modal'); return m ? { hs: [...m.querySelectorAll('h3')].map((h) => h.textContent.trim()), deformKeys: /Deformation on or off|Deformation: paths|Play the chain|Paths t ↦/.test(m.innerText) } : null; })()`);
ok('classic: the guide has no Deformation section and no Keys row for the deformation', cg && !cg.hs.includes('Deformation') && cg.hs.includes('Planes and surfaces') && !cg.deformKeys, cg);
const cgp = await ev(`(() => { const m = document.querySelector('.modal'); const tr = m && [...m.querySelectorAll('table.keys tr')].find((r) => /move the probe/.test(r.textContent)); return tr ? [...tr.children[0].querySelectorAll('.kbd')].map((k) => k.textContent.trim()) : null; })()`);
ok('classic: the Keys row for the sound probe has the plain arrows, not Alt with them (that is the steps view\'s)', !!cgp && cgp.includes('←') && !cgp.includes('Alt'), cgp);
await key('Escape'); await settled();
await key('k', 4); await settled();
await type('deformation'); await settled();
const cp = await ev(`(document.getElementById('palList') || {}).innerText || ''`);
ok('classic: the palette has no Deformation command and no Guide: Deformation', !!cp && !/Deformation:/.test(cp) && !/Guide: Deformation/.test(cp), cp.slice(0, 300));
await key('Escape'); await settled();
// the same in Russian: the section's bold names are the page's Russian names for the controls
await go(`${await ev('location.origin')}/test.html?ns=guidenavru${Date.now()}&lang=ru`); await settled();
await ev(`Tour.isActive() && Tour.stop && Tour.stop()`); await settled();
await key('?', 0); await settled();
const dr = await ev(DEFORM);
ok('ru: each control the Deformation section names in bold is on the strip or in Playback', dr && dr.bold.length >= 3 && dr.missing.length === 0, dr && { bold: dr.bold, missing: dr.missing, names: dr.names });
ok('ru: the Deformation section has no X → Y', dr && !/X\s*→\s*Y/.test(dr.text), dr && dr.text.slice(0, 400));
// on a phone the strip has no speed select, Loop or ⋯, and no keys: the section sends to Playback by holding ▶, as the line under its
// heading does, and names no key
const origin = await ev('location.origin');
await view(412, 860, false, true);
await go(`${origin}/test.html?ns=guidenavph${Date.now()}`); await settled();
await ev(`(document.querySelector('.modal-bg') || { remove() {} }).remove()`); await ev(`__tourApi.openGuide()`); await settled();
const dp = await ev(`(() => { const sec = [...document.querySelectorAll('.guide-sec')].find((x) => x.querySelector('h3').textContent === 'Deformation'); return { ph: document.documentElement.classList.contains('ph'), text: sec ? sec.textContent.replace(/\\s+/g, ' ') : null, keys: sec ? [...sec.querySelectorAll('.kbd')].map((x) => x.textContent) : null }; })()`);
ok('phone: the Deformation section sends to Playback by holding ▶, and names no speed select, ⋯ on the thread or key', dp.ph && dp.text && /Hold ▶ to open Playback/.test(dp.text) && !/speed select|⋯ opens/.test(dp.text) && dp.keys && dp.keys.length === 0, dp);
return { pass: fails.length === 0, fails };
