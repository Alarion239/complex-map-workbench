// All sheets in the steps view: on Landscape, a map with a multivalued step has the All sheets check in the plane's
// options (the head's ⋯ when it is not inline); ticking it draws every sheet, as the classic Landscape does pixel for pixel,
// switches a modulus height to Im with its toast, and the title says which sheets are drawn. The label counts the
// combinations when they are capped. Plane and Sphere have no check, nor does a map with no multivalued step. The
// Inspector's Show all sheets switches the surface to Landscape with All sheets on, and closes the logarithm example's
// Try line, which names it. A reload keeps All sheets and the surface.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const READY = "typeof __cmwLandSheets === 'function' && typeof __cmwSteps === 'function' && typeof __cmwState === 'function'";
const quiet = () => settled({ floor: 400, max: 15000, until: `${READY} && !__cmwSteps().moving` });
const open = async (view, ns, st) => { await loadView(view, ns, st); await quiet(); };
// opens the head's ⋯ when the All sheets check is not inline (the pattern button shares the class)
const OPEN_OPTS = `if (!document.getElementById('sheetsChk')) { const b = document.querySelector('#leftFoot .opts-btn:not(.pat-btn)'); if (b) b.click(); }`;
// the check as the plane's options show it, opening the head's ⋯ when it is not inline: { lab, checked } or null
const check = () => ev(`(() => {
  ${OPEN_OPTS}
  const c = /** @type {HTMLInputElement} */ (document.getElementById('sheetsChk'));
  const r = c ? { lab: c.closest('label').textContent.trim(), checked: c.checked, type: c.type } : null;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return r;
})()`);
const tick = () => ev(`(() => {
  ${OPEN_OPTS}
  const c = document.getElementById('sheetsChk'); if (c) c.click();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return !!c;
})()`);
const title = () => ev(`document.querySelector('#svHead .sv-title').textContent`);
const surf = async (s, go = 0) => { await ev(`__cmwSteps({ go: ${go}, now: true, surf: '${s}' }); 1`); await quiet(); };
// the share of pixels of two PNG data URLs whose channels differ by more than 8 of 255
const differ = (a, b) => ev(`await (async () => {
  const px = async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
  const A = await px(${JSON.stringify(a)}), B = await px(${JSON.stringify(b)});
  if (A.length !== B.length) return 1;
  let n = 0;
  for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 8) n++;
  return n / (A.length / 4);
})()`);
const pic = () => ev(`__cmwRenderOff('L', 480, 360, 1)`);
const ROOT = { shapes: [], steps: [{ type: 'root', params: { n: 2 }, on: true }] };

await view(1200, 800, false, false);
const ns = 'svas' + Date.now();
await open('steps', ns, ROOT);
ok('the page shows the steps view', await isSteps(), null);

// √z on Landscape: the check, off; ticking it draws both sheets, Im for the height, and the title says so
await surf('land');
const c0 = await check();
ok('Landscape of √z: the All sheets check, unticked', c0 && c0.type === 'checkbox' && c0.lab === 'All sheets' && !c0.checked, c0);
ok('the title names no sheets', !/sheet/.test(await title()), await title());
const off = await pic();
await tick(); await quiet();
const c1 = await check(), d1 = await ev('__cmwLandSheets().drawn'), st1 = await ev('__cmwState()');
ok('ticked, it is checked', c1 && c1.checked && st1.sheets === true, { c1, sheets: st1.sheets });
ok('both sheets are drawn', d1 && d1.K === 2 && d1.total === 2, d1);
ok('a modulus height turns to Im', st1.height === 'im', st1.height);
ok('the toast says why', /the height is now Im/.test(await ev('document.body.textContent')), null);
ok('the title says both sheets are drawn', /landscape of Im F, both sheets/.test(await title()), await title());
const on = await pic();

// the same picture as the classic Landscape (an offscreen render of the same size; at most 0.5% of pixels differ)
await open('classic', ns + 'c', Object.assign({ view: { main: 'land' }, sheets: true, height: 'im' }, ROOT));
await ev('__cmwSetMain("land")'); await quiet();
const classic = await pic();
const dOn = await differ(on, classic), dOff = await differ(off, on);
info.differ = { classic: dOn, onOff: dOff };
ok('All sheets: the picture matches the classic Landscape (≤ 0.5% of pixels differ)', dOn <= 0.005, dOn);
ok('the check sees the sheets: one sheet and two differ in over 5% of pixels', dOff > 0.05, dOff);

// a reload keeps All sheets and the surface
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`); await quiet();
const r = await ev(`({ sheets: __cmwState().sheets, surf: __cmwSteps().surf })`);
ok('a reload keeps All sheets on Landscape', r.sheets === true && r.surf === 'land', r);

// Plane and Sphere have no check
for (const s of ['plane', 'sphere']) { await surf(s); ok(`${s}: no All sheets`, !(await check()), s); }

// a map with no multivalued step has none on Landscape
await open('steps', ns + 'e', { shapes: [], steps: [{ type: 'exp', params: {}, on: true }] });
await surf('land');
ok('exp: no All sheets on Landscape', !(await check()), null);

// capped: log then log, 4 sheets each side: 24 of the 81 combinations
await open('steps', ns + 'l', { shapes: [], steps: [{ type: 'log', params: {}, on: true }, { type: 'log', params: {}, on: true }], sheets: true, sheetW: 4, height: 'im' });
await surf('land');
const cc = await check(), dc = await ev('__cmwLandSheets().drawn');
ok('capped: the label counts the combinations drawn', cc && cc.lab === `All sheets (${dc && dc.K} of ${dc && dc.total})` && dc.total > dc.K, { cc, dc });
ok('capped: the title too', dc && new RegExp(`${dc.K} of ${dc.total} sheet combinations`).test(await title()), await title());

// the Inspector's Show all sheets, from the Plane surface
await open('steps', ns + 'i', ROOT);
await surf('plane', 1);
await ev(`document.querySelector('#svStrip .sv-fchip').click(); 1`); await quiet();
const all = await ev(`(() => { const b = document.querySelector('.sh-all'); if (b) b.click(); return !!b; })()`); await quiet();
const si = await ev(`({ surf: __cmwSteps().surf, sheets: __cmwState().sheets, drawn: __cmwLandSheets().drawn })`);
ok('Show all sheets: Landscape with both sheets', all && si.surf === 'land' && si.sheets === true && si.drawn && si.drawn.K === 2, { all, si });

// the logarithm example: its Try line names Show all sheets, which closes it
await open('steps', ns + 'x', { shapes: [], steps: [] });
await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
const lane = () => ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return l ? l.textContent : null; })()`);
const ix = await ev(`(() => { for (let i = 0; i < 60; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && /Sheets of the logarithm/.test(l.textContent)) return i; } return -1; })()`);
await ev(`__cmwExample(${ix})`); await settled({ floor: 600, until: `!!document.querySelector('.tour-lane[data-lane="example"]')` });
const l0 = await lane();
ok('the logarithm example: its line names Show all sheets', ix >= 0 && /Show all sheets in the Inspector/.test(l0 || ''), { ix, l0 });
await ev(`document.querySelector('#svStrip .sv-fchip').click(); 1`); await quiet();
ok('opening the Inspector leaves the line', !!(await lane()), null);
await ev(`(() => { const b = document.querySelector('.sh-all'); if (b) b.click(); return !!b; })()`); await quiet();
ok('Show all sheets closes it', !(await lane()), await lane());
return { pass: fails.length === 0, fails, info };
