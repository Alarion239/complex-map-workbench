// The style row's ⋯ pop-up (the steps view, Cauchy style on the example whose singularity is a regular part plus a pole):
// the formula note sits directly under the settings it describes, the Both / Inside / Outside parts, not after the other
// controls (Outlines, Unit circle). When the parts are inline in the pane head the note leads the pop-up, next to them.
// Read on laptop widths, where the head decides what goes behind ⋯, and on a phone, where every control is in the pop-up.
// A command file for a CDP daemon; prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const STATE = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
// the pop-up's children in order, by what they are
const popOrder = () => ev(`(() => { const p = document.querySelector('.opts-pop'); if (!p) return null;
  const kind = (c) => (c.querySelector('#cauchySeg') || c.id === 'cauchySeg') ? 'parts' : c.classList.contains('foot-note') ? 'note' : (c.querySelector('#outlineChk') || c.id === 'outlineChk') ? 'outlines' : (c.querySelector('#unitChk') || c.id === 'unitBox' || c.querySelector('#unitBox')) ? 'unit' : c.classList.contains('ovf') ? 'scrub' : 'other:' + (c.id || c.className);
  return [...p.children].map(kind); })()`);
const openPop = async () => {
  await ev(`(document.querySelector('.opts-pop') && document.body.click(), 1)`); await sleep(200);
  const hasBtn = await ev(`!!document.querySelector('#leftFoot .opts-btn')`);
  if (!hasBtn) return false;
  await ev(`(document.querySelector('#leftFoot .opts-btn').click(), 1)`); await sleep(500);
  return true;
};
const names = async () => ev(`(() => { const out = []; for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { break; } const l = document.querySelector('#examplesBtn .exlabel'); out.push(l ? l.textContent : ''); } return out; })()`);
const run = async (w, h, phone, tag) => {
  await view(w, h, false, phone);
  await loadView(null, 'fno' + tag + Date.now(), STATE, { lang: 'en' });
  await settled({ until: `typeof __cmwExample === 'function' && I18N.lang === 'en'` });
  if (!(await isSteps())) { ok(`${tag}: the steps view`, false, null); return null; }
  const ns = await names();
  const i0 = ns.findIndex((n) => /^Cauchy: a simple pole/.test(n)), ir = ns.findIndex((n) => /regular part/.test(n));
  ok(`${tag}: the regular-part Cauchy example exists`, i0 > 0 && ir > 0, ns);
  await ev(`__cmwExample(${ir})`); await settled();
  const kind = await ev(`(() => { const c = __cmwCauchy(); return c && c.kind; })()`);
  const opened = await openPop();
  ok(`${tag}: the ⋯ pop-up opens`, opened, null);
  const o = await popOrder();
  info[tag] = { kind, order: o };
  return o;
};
let seenBehind = false;
for (const [w, h] of [[1440, 900], [1180, 800], [1024, 768], [900, 700]]) {
  const o = await run(w, h, false, `laptop ${w}`);
  if (!o) continue;
  const iN = o.indexOf('note'), iP = o.indexOf('parts');
  ok(`laptop ${w}: the pop-up holds the formula note`, iN >= 0, o);
  if (iP >= 0) { seenBehind = true; ok(`laptop ${w}: the parts are behind ⋯ and the note is directly under them`, iN === iP + 1, o); }
  else ok(`laptop ${w}: the parts are inline, the note leads the pop-up`, iN === 0, o);
}
ok('on some laptop width the parts are behind ⋯ (the case this suite pins)', seenBehind, info);
const ph = await run(412, 860, true, 'phone 412');
if (ph) { const iN = ph.indexOf('note'), iP = ph.indexOf('parts'); ok('phone: the parts and the note are in the pop-up, the note directly under the parts', iP >= 0 && iN === iP + 1, ph); }
return { pass: !fails.length, fails, info };
