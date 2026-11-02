// v15.1 acceptance (review-v15-verify): verify-3 (the degenerate Möbius note), verify-7 (a Cyrillic letter in a number's
// value field), verify-8 (the language switch keeps a selection other than the step shown alone), verify-9 (the F
// list's fractions in display style). verify-1, verify-4 and verify-6 are in v15_desktop_cmd.js, verify-10 in
// tour_cmd.js. It runs in the steps view (ci/suite_views.js: steps({ pin: true })): the Inspector opens from the thread's chips.
// Run: test/<you>_cdp/q.sh test/v151_cmd.js
// v15.1 probe: verify-1 (t labels while playing), verify-3 (degenerate Möbius note), verify-7 (Cyrillic in a value
// field), verify-8 (language switch with Show alone on another step), verify-9 (the F list's fractions).
const P = { port: (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1], tag: 'v151' }, base = `http://localhost:${P.port}/test.html`, out = { port: P.port };
const open = async (ns, st, q = '') => {
  await go(`http://localhost:${P.port}/__blank_for_storage`);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await go(`${base}?ns=${ns}${q}`); await settled({ until: `typeof __cmwSteps === 'function'` });
};
// (the language switch reloads the page: poll through the navigation, where an evaluation can throw, until the new page has the language)
const reloaded = async (lang) => { for (let k = 0; k < 120; k++) { try { if (await ev(`document.readyState === 'complete' && typeof __cmwCards === 'function' && I18N.lang === '${lang}'`)) break; } catch (e) { /* the page is going away */ } await sleep(250); } await settled(); };
const SH = [{ id: 's1', kind: 'formula', expr: '|\\Im z| < 0.8' }];
await view(1440, 900, false);
let ns;
// verify-3: f1 = (z + 1)/(az + 1) with a = 1 -> constant; then b = -1, a = -1, c = 1, d = 1 (constant -1, z = -1)
ns = 'pr3' + Date.now();
await open(ns, { shapes: SH, steps: [{ type: 'mobius', params: { a: '-1', b: '-1', c: '1', d: '1' }, on: true }], sel: 1 });
if (!(await ev(`!!(window.__cmwSteps && __cmwSteps().on)`))) return { pass: false, fails: ['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)'] };
out.v3 = await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="1"] .isub'); return e ? { text: e.textContent, html: e.innerHTML } : null; })()`);
await shot(`pr-${P.tag}-v3`, { x: 1140, y: 40, width: 300, height: 360 });
await go(`${base}?ns=${ns}&lang=ru`); await settled({ until: `typeof __cmwSteps === 'function'` });
out.v3ru = await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="1"] .isub'); return e ? e.textContent : null; })()`);
await shot(`pr-${P.tag}-v3ru`, { x: 1140, y: 40, width: 300, height: 360 });
// verify-7: a number a; its value field gets the Cyrillic «с» (no c exists), then «а» (a: itself), then 2*«с» with c existing
ns = 'pr7' + Date.now();
await open(ns, { shapes: SH, steps: [{ type: 'mul', params: { a: 'a' }, on: true }], params: [{ name: 'a', value: 0.5, min: -2, max: 2, step: 0.01 }, { name: 'b', value: 0.25, min: -2, max: 2, step: 0.01 }] }, '&lang=ru');
const typeIn = async (sel, text) => {
  const r = await ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; el.scrollIntoView({block:'nearest'}); el.focus(); el.select && el.select(); return true})()`);
  if (!r) return false;
  await ev(`(()=>{const el=document.activeElement; el.value=''; el.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`);
  await type(text); await key('Enter'); await settled();
  return true;
};
const errOf = (nm) => ev(`(() => { const r = document.querySelector('.prm-row[data-name="${nm}"]'); const e = r && r.querySelector('.prm-err'); return { err: e && !e.hidden ? e.textContent : '', field: r && r.querySelector('.prm-val').value, params: __cmwP().params.map((p) => p.name + '=' + (p.expr || p.value)) }; })()`);
out.v7 = {};
out.v7.found = await typeIn('.prm-row[data-name="b"] .prm-val', 'с');
out.v7.cyrC = await errOf('b');
await typeIn('.prm-row[data-name="b"] .prm-val', '2а');
out.v7.cyrA = await errOf('b');
await typeIn('.prm-row[data-name="b"] .prm-val', 'д');
out.v7.cyrD = await errOf('b');
await typeIn('.prm-row[data-name="b"] .prm-val', 'q');
out.v7.latinQ = await errOf('b');
// verify-8: f1 shown alone (its chip's ⋯ menu), f2 selected, then the language switch
ns = 'pr8' + Date.now();
await open(ns, { shapes: SH, steps: [{ type: 'exp', params: {}, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5', poles: '-0.5' }, on: true }] });
await ev(`(() => { document.querySelectorAll('#svStrip .sv-more')[0].click(); return 1; })()`); await settled({ until: `!!document.querySelector('.pop.menu')` });
await ev(`(() => { const m = [...document.querySelectorAll('.pop.menu [role=menuitem]')].find((x) => /^Show alone/.test(x.textContent.trim())); m.click(); return 1; })()`); await settled({ until: `!!document.querySelector('#svStrip .sv-whole')` });
await ev(`(() => { const c = document.querySelectorAll('#svStrip .sv-fchip')[1]; c.click(); return 1; })()`); await settled({ until: `__cmwCards().sel === 2` });
const selState = `(() => { const C = __cmwCards(); return { alone: !!document.querySelector('#svStrip .sv-whole'), sel: C.sel, insp: (document.querySelector('#propsPanel .insp-step .ihead .ttl') || {}).textContent || null, k: (document.querySelector('#propsPanel .insp-step') || { dataset: {} }).dataset.k }; })()`;
out.v8 = { before: await ev(selState) };
await ev(`(() => { I18N.setPref('ru'); return 1; })()`); await reloaded('ru');
out.v8.after = await ev(selState);
await ev(`(() => { I18N.setPref('en'); return 1; })()`); await reloaded('en');
out.v8.back = await ev(selState);
// verify-9: F = (e^z - 1)/(e^z + 1): the F list at 1440 and 1024
ns = 'pr9' + Date.now();
await open(ns, { shapes: SH, steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }], sel: 'F' });
out.v9 = {};
for (const [w, hh] of [[1440, 900], [1024, 768]]) {
  await view(w, hh, false); await settled();
  out.v9[w] = await ev(`(() => { const f = document.querySelector('#propsPanel .iform'); if (!f) return null; const fr = f.getBoundingClientRect(); return { ftex: (f.querySelector('.ftex') || {}).dataset ? f.querySelector('.ftex').dataset.tex : null, wl: [...f.querySelectorAll('.wl > div')].map((d) => { const s = d.firstElementChild || d; const r = (s.querySelector('mjx-container') || s).getBoundingClientRect(); return { tex: s.dataset && s.dataset.tex, w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), formRight: Math.round(fr.right), fs: s.style && s.style.fontSize }; }) }; })()`);
  await shot(`pr-${P.tag}-v9-${w}`, { x: w - 300, y: 40, width: 300, height: 420 });
}
await view(1440, 900, false);
out.logs = (await logs()).filter((l) => l.t === 'EXC' || l.t === 'error').slice(0, 8);
const fails = [];
// (Russian typography: a no-break space after short words and before a dash; compared as a plain space)
const sp = (t) => String(t == null ? '' : t).replace(/\u00a0/g, ' ');
const ok = (name, cond, info) => { if (!cond) fails.push({ name, info }); };
ok('verify-3: the note reads "f₁ is constant (= −1); z = −1 is a removable singularity." with the true minus', out.v3 && out.v3.text === 'a₁d₁ − b₁c₁ = 0. f₁ is constant (= −1); z = −1 is a removable singularity.', out.v3);
ok('verify-3: a, d, b, c, f and z in math italics', out.v3 && /<i>a<\/i>₁<i>d<\/i>₁ − <i>b<\/i>₁<i>c<\/i>₁/.test(out.v3.html) && /<i>f<\/i>₁/.test(out.v3.html) && /<i>z<\/i> = −1/.test(out.v3.html), out.v3 && out.v3.html);
ok('verify-3: Russian', sp(out.v3ru) === 'a₁d₁ − b₁c₁ = 0. f₁ постоянна (= −1); z = −1 — устранимая особая точка.', out.v3ru);
ok('verify-7: «с» in a value field (no number c) names the Russian letter, not c₀', out.v7.found && /Буква «с» — русская/.test(sp(out.v7.cyrC.err)) && !/c₀/.test(out.v7.cyrC.err), out.v7.cyrC);
ok('verify-7: «д» names the Russian letter', /Буква «д» — русская/.test(sp(out.v7.cyrD.err)), out.v7.cyrD);
ok('verify-7: a look-alike of a known number (а for a) still reads as that number', out.v7.cyrA.err === '', out.v7.cyrA);
ok('verify-7: a Latin unknown name keeps its message', /^q не задано/.test(out.v7.latinQ.err), out.v7.latinQ);
const same = (a, b) => a && b && a.alone === b.alone && a.sel === b.sel && a.k === b.k;
ok('verify-8: the switch keeps f2 selected while f1 is shown alone (and back)', out.v8.before.alone && out.v8.before.sel === 2 && same(out.v8.before, out.v8.after) && same(out.v8.before, out.v8.back) && /Нули и полюсы/.test(sp(out.v8.after.insp)), out.v8);
for (const w of ['1440', '1024']) ok(`verify-9 ${w}: the w list is in display style and fits its well`, out.v9[w] && out.v9[w].wl.length === 2 && out.v9[w].wl.every((x) => /^\\displaystyle /.test(x.tex) && x.right <= x.formRight), out.v9[w]);
ok('no exceptions', out.logs.length === 0, out.logs);
return { pass: fails.length === 0, fails, info: out };
