// The Cauchy examples (issue #293): an example may name its curve (`selected`, a shape's index or id), so the three
// examples (1/z, z + 1/z, e^{1/z}) open in the Cauchy style with their circle selected, in English and in Russian;
// another example takes the selection away.
// A command file for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('excauchy' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1200);
// the Cauchy examples by their order: the first whose name starts with the Cauchy word is the first of three
const names = await ev(`(() => { const out = []; for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { break; } const l = document.querySelector('#examplesBtn .exlabel'); out.push(l ? l.textContent : ''); } return out; })()`);
const i0 = names.findIndex((n) => /^Cauchy: a simple pole/.test(n));
ok('the Cauchy examples exist', i0 > 0 && /regular part/.test(names[i0 + 1]) && /essential/.test(names[i0 + 2]), names);
const state = () => ev(`(() => { const p = __cmwP(), c = __cmwCauchy(); return { sel: __cmwPlaneMenu().selected(), first: p.shapes[0] && p.shapes[0].id, dc: p.figure.dc, cauchy: c && c.name, label: document.querySelector('#examplesBtn .exlabel').textContent, poles: c ? c.poles.length : -1, formula: c ? c.formula : null }; })()`);
for (const [lang, exp] of [['en', /^Cauchy: /], ['ru', /^Коши: /]]) {
  await ev(`I18N.setPref('${lang}'), 1`); await settle(1500);
  for (let k = 0; k < 3; k++) {
    await ev(`__cmwExample(${i0 + k})`); await settle(1200);
    const s = await state();
    ok(`${lang}: example ${k} opens in the Cauchy style`, s.dc === 'cauchy', s);
    // (the plane's selection itself: the Cauchy plot alone would pick the only closed curve)
    ok(`${lang}: example ${k} has its circle selected`, !!s.sel && s.sel === s.first && !!s.cauchy, s);
    ok(`${lang}: example ${k} is named in the language`, exp.test(s.label), s);
    if (k < 2) ok(`${lang}: example ${k} has its pole found by the formula`, s.formula === true && s.poles === 1, s);
    else ok(`${lang}: the essential singularity is not drawn by the formula`, s.formula === false, s);
  }
}
await ev(`I18N.setPref('en'), 1`); await settle(1200);
// another example takes the Cauchy style and the selection away
await ev(`__cmwExample(1)`); await settle(1000);
const after = await state();
ok('another example leaves the Cauchy style and has no curve selected', after.dc !== 'cauchy' && !after.cauchy && !after.sel, after);
// the selection is the planes', not the saved state's: a link made from an example does not carry it
await ev(`__cmwExample(${i0})`); await settle(1000);
const fig = await ev(`JSON.stringify(__cmwP().figure)`);
ok('the saved state does not carry the selection', !/"selected"/.test(fig), fig.slice(0, 200));
return { pass: fails.length === 0, fails };
