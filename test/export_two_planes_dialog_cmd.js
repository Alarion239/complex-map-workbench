// The steps view's export dialog: Picture reads Shown plane · Two planes · Filmstrip. Two planes adds From and To plane
// selects (labelled "From plane" and "To plane", defaults z and the last plane, "to" listing only the planes after
// "from"), and the preview's accessible name says the planes and the map. On the Landscape Two planes is disabled with
// its reason, and the figure is the Shown plane's. On a phone each select is a full-width row with a 44 px target.
// A command file for a CDP daemon:  <runner> test/export_two_planes_dialog_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const ready = async (w, h, phone, ns) => {
  await view(w, h, false, !!phone);
  await load('xtpd' + ns + Date.now(), {});
  const base = await ev('location.origin');
  await go(`${base}/test.html?view=steps&ns=xtpd${ns}${Date.now() % 1e7}`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
  await ev(`(__cmwExample(1), __cmwSet('wKey', false), 1)`);
  await settled({ until: '__cmwSteps().planes.length > 1', max: 15000 });
};
const built = async () => (await settled({ until: '(() => { const d = __cmwFig.dialog(); return !!(d && d.fig && !d.building); })()', max: 30000, panes: false })).ok === true;
const until = (expr) => settled({ until: expr, max: 30000, panes: false });
const ALT = `document.querySelector('.xf-fig').alt`;
const opts = (id) => ev(`[...document.querySelectorAll('#${id} option')].map((o) => o.textContent)`);

await ready(1440, 900, false, 'a');
await key('e', 4);
ok('the dialog opens and builds', await built());
const pics = await ev(`[...document.querySelectorAll('#xfSvPic [data-v]')].map((b) => b.dataset.v)`);
ok('Picture: Shown plane, Paths, Two planes, Filmstrip', JSON.stringify(pics) === JSON.stringify(['plane', 'paths', 'two', 'film']), pics);
ok('the planes row is hidden for the Shown plane', await ev(`document.getElementById('xfSvFrom').closest('.xf-row').hidden`) === true);
await ev(`document.querySelector('#xfSvPic [data-v="two"]').click(); 1`);
ok('the figure rebuilds for the two planes', (await until(`${ALT} === 'z and w₂, joined by F'`)).ok === true);
ok('the planes row shows', await ev(`document.getElementById('xfSvFrom').closest('.xf-row').hidden`) === false);
ok('the selects are labelled From plane and To plane', await ev(`document.getElementById('xfSvFrom').getAttribute('aria-label') === 'From plane' && document.getElementById('xfSvTo').getAttribute('aria-label') === 'To plane'`));
ok('From lists z and w₁', JSON.stringify(await opts('xfSvFrom')) === JSON.stringify(['z', 'w₁']), await opts('xfSvFrom'));
ok('To lists the planes after z, w₁ and w₂, and shows w₂', JSON.stringify(await opts('xfSvTo')) === JSON.stringify(['w₁', 'w₂']) && await ev(`document.getElementById('xfSvTo').value`) === '2', await opts('xfSvTo'));
ok("the preview's name is 'z and w₂, joined by F'", await ev(`document.querySelector('.xf-fig').alt`) === 'z and w₂, joined by F', await ev(`document.querySelector('.xf-fig').alt`));
await ev(`(() => { const s = document.getElementById('xfSvFrom'); s.value = '1'; s.dispatchEvent(new Event('change')); })()`);
ok('the figure rebuilds for w₁', (await until(`${ALT} === 'w₁ and w₂, joined by f₂'`)).ok === true);
ok('To then lists only w₂', JSON.stringify(await opts('xfSvTo')) === JSON.stringify(['w₂']), await opts('xfSvTo'));
ok("the preview's name is 'w₁ and w₂, joined by f₂'", await ev(`document.querySelector('.xf-fig').alt`) === 'w₁ and w₂, joined by f₂', await ev(`document.querySelector('.xf-fig').alt`));
// the Landscape: Two planes is disabled, with its reason
await ready(1440, 900, false, 'b');
await ev(`(__cmwSteps({ surf: 'land' }), 1)`);
await settled({ until: '!__cmwSteps().moving', max: 15000 });
await key('e', 4);
ok('the dialog opens on the Landscape', await built());
const tb = await ev(`(() => { const b = document.querySelector('#xfSvPic [data-v="two"]'); return { dis: b.getAttribute('aria-disabled'), tip: b.dataset.tip, desc: b.getAttribute('aria-description'), clicked: (b.click(), b.getAttribute('aria-checked')) }; })()`);
ok('Two planes is aria-disabled with its reason, and a click does not choose it', tb.dis === 'true' && tb.tip === 'Two planes is for the Plane and Sphere surfaces' && tb.desc === tb.tip && tb.clicked === 'false', tb);

// a phone: the selects are full-width rows, 44 px high
await ready(390, 844, true, 'c');
await key('e', 4);
ok('the dialog opens on a phone', await built());
await ev(`document.querySelector('#xfSvPic [data-v="two"]').click(); 1`);
await until(`${ALT} === 'z and w₂, joined by F'`);
const ph = await ev(`(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), row = document.getElementById('xfSvFrom').closest('.xf-row').getBoundingClientRect(); const f = r('xfSvFrom'), t = r('xfSvTo'); return { fh: f.height, th: t.height, fw: f.width, tw: t.width, rw: row.width, ftop: f.top, ttop: t.top }; })()`);
ok('each select is 44 px high and on a row of its own', ph.fh >= 44 && ph.th >= 44 && ph.ttop > ph.ftop + 40, ph);
ok('each select spans the row', ph.fw >= ph.rw - 40 && ph.tw >= ph.rw - 40, ph);
return { pass: fails.length === 0, fails, info };
