// A phone's folded legend chip clears what lies at the top of the plane (#1527): with a construction tool in hand the chip (its words, ?, and the
// × that cancels) stands at the left and ends short of the legend's key, folded to a glyph with a 44 px hit area, so the × is never under it; a readout
// of two lines that reaches the key drops it below the readout. In the steps view at 360 × 640, 390 × 844, 430 × 932 and 568 × 320, in English and Russian. Checked: the folded chip's
// hit area meets neither the construction chip nor the ×, and a press at the centre of each of the legend and the × finds it; with the tool put away
// the chip is where it was.
// In the steps view (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const VIEWPORTS = [[360, 640], [390, 844], [430, 932], [568, 320]], HIT_PX = 8, STILL_MS = 150, SETTLE_MAX = 5000, GAP_PX = 1, CUT_MAX = 1, TWO_LINE_PX = 36;
const measure = () => ev(`(() => {
  const rect = (e, pad = 0) => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad }; };
  const lg = document.getElementById('leftLegend'), x = document.querySelector('.cm-x'), chip = document.querySelector('#draftChipL.cm-on'), ro = document.querySelector('#plotL > .chip.readout');
  const hit = (e) => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!at && (at === e || e.contains(at)) ? true : at ? (at.id || at.className || at.tagName) : 'nothing'; };
  return { legend: rect(lg), reach: rect(lg, ${HIT_PX}), x: rect(x), chip: rect(chip), readout: rect(ro), plot: rect(document.getElementById('plotL')), legendHit: hit(lg), xHit: hit(x), cut: (() => { const t = document.querySelector('.cm-chip > .cm-t'); return t ? t.scrollHeight - t.clientHeight : null; })(), collapsed: !!lg && lg.classList.contains('collapsed'), drop: lg ? lg.style.getPropertyValue('--lg-drop') : null };
})()`);
const kit = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails });
const still = () => kit.still(measure, STILL_MS, SETTLE_MAX);
const inter = (a, b) => !!a && !!b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > GAP_PX - 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > GAP_PX - 1;
for (const lang of ['en', 'ru']) for (const [w, h] of VIEWPORTS) {
  const tag = `${lang} ${w}×${h}`;
  await view(w, h, false, true);
  const ns = 'plc' + w + lang + (Date.now() % 1000000);
  await load(ns, ST);
  await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}&view=steps` });
  await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && !!document.getElementById('leftLegend') && !document.getElementById('leftLegend').hidden && !!document.querySelector('#shapeList .shape[data-id="s1"]')` });
  const home = await still();
  ok(`${tag}: the legend is a folded chip (control)`, home.collapsed && !!home.legend, home);
  await ev(`document.querySelector('[data-tool="perp"]').click(), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('#draftChipL.cm-on .cm-x')` });
  const m = await still();
  info[tag] = { home: home.legend, m };
  ok(`${tag}: the construction chip and its × show`, !!m.chip && !!m.x, m);
  if (!m.chip || !m.x) continue;
  ok(`${tag}: the legend's hit area is clear of the construction chip`, !inter(m.reach, m.chip), { reach: m.reach, chip: m.chip, drop: m.drop });
  ok(`${tag}: the legend's hit area is clear of the ×`, !inter(m.reach, m.x), { reach: m.reach, x: m.x });
  ok(`${tag}: a press at the centre of the × finds it, and of the legend finds it`, m.xHit === true && m.legendHit === true, { xHit: m.xHit, legendHit: m.legendHit });
  ok(`${tag}: the chip's words are not cut and the chip is inside the plot`, m.cut !== null && m.cut <= CUT_MAX && !!m.plot && m.chip.l >= m.plot.l - 0.5 && m.chip.r <= m.plot.r + 0.5, { cut: m.cut, chip: m.chip, plot: m.plot });
  ok(`${tag}: the legend stays in the plot`, !!m.plot && m.legend.b <= m.plot.b + 0.5 && m.legend.r <= m.plot.r + 0.5, { legend: m.legend, plot: m.plot });
  // the tool put away: the legend goes home
  await ev(`document.querySelector('[data-tool="select"]').click(), 1`);
  await settled({ max: SETTLE_MAX, panes: false, until: `!document.querySelector('#draftChipL.cm-on')` });
  const back = await still();
  ok(`${tag}: with the tool put away the legend is back where it was`, !!back.legend && Math.abs(back.legend.t - home.legend.t) <= 1 && Math.abs(back.legend.l - home.legend.l) <= 1, { back: back.legend, home: home.legend });
}
// a readout of two lines (Y's "w, then z = F⁻¹(w)" while it is probed) that reaches the folded chip drops it too
{
  const [w, h] = [568, 320];
  await view(w, h, false, true);
  const ns = 'plc2' + (Date.now() % 1000000);
  await load(ns, ST);
  await send('Page.navigate', { url: `${U}?ns=${ns}&lang=en&view=steps` });
  await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && !!document.getElementById('leftLegend') && !document.getElementById('leftLegend').hidden` });
  const home = await still();
  // (the page writes the idle readout again whenever the pointer is off the plane, setReadouts(null), which would put its short idle text back
  // before the key is measured; an observer here puts the two lines back at once, in the same task, so no frame sees the idle text)
  await ev(`(() => {
    const r = document.querySelector('#plotL > .chip.readout'), LONG = 'z = 12.3456 + 7.8901 i<br>w = F(z) = 123456.7890 + 12345.6789 i, a long second line';
    r.style.cssText = 'height:auto;white-space:normal;line-height:18px;padding:4px 8px;max-width:calc(100% - 72px)';
    const hold = () => { if (r.innerHTML !== LONG) r.innerHTML = LONG; };
    new MutationObserver(hold).observe(r, { childList: true, characterData: true, subtree: true });
    hold();
    return 1;
  })()`);
  // (the key is placed again once the readout has changed size: waited for as a condition, the key's --lg-drop set by the page)
  const dropped = await settled({ max: SETTLE_MAX, panes: false, until: `document.getElementById('leftLegend').style.getPropertyValue('--lg-drop') !== ''` });
  const m = await still();
  info['two-line readout'] = { home: home.legend, m };
  ok('568×320: the key is placed again, below the readout, once the readout has two lines', dropped.ok, { drop: m.drop, wait: dropped });
  ok('568×320: the two-line readout reaches the folded legend (control)', !!m.readout && !!home.reach && m.readout.r > home.reach.l && m.readout.b > home.reach.t, { readout: m.readout, reach: home.reach });
  ok('568×320: the legend\'s hit area is clear of the two-line readout', !inter(m.reach, m.readout), { reach: m.reach, readout: m.readout, drop: m.drop });
}
// the classic view at 568 × 320 on its first load, a construction tool in hand: X and Y side by side, and Y's own readout of two lines ("Draw a target in Y ...") beside
// the folded key of the plane Y (#rightLegend): the page, which attached its observer on this first load, places the key below the readout; no state is loaded, no page loaded twice
{
  const [w, h] = [568, 320];
  await view(w, h, false, true);
  const ns = 'plc3' + (Date.now() % 1000000);
  await send('Page.navigate', { url: `${U}?ns=${ns}&lang=en&view=classic` });
  await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && !!document.getElementById('rightLegend') && !document.getElementById('rightLegend').hidden` });
  await ev(`document.querySelector('[data-tool="perp"]').click(), 1`);
  const dropped = await settled({ max: SETTLE_MAX, panes: false, until: `document.getElementById('rightLegend').style.getPropertyValue('--lg-drop') !== ''` });
  const m = await ev(`(() => { const rect = (e) => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }; const lg = document.getElementById('rightLegend'), ro = document.querySelector('#plotR > .chip.readout'), bar = document.querySelector('.ph-ctx.in'), r = rect(lg); return { legend: r, reach: r && { l: r.l - ${HIT_PX}, t: r.t - ${HIT_PX}, r: r.r + ${HIT_PX}, b: r.b + ${HIT_PX} }, readout: rect(ro), text: ro ? ro.textContent.trim().slice(0, 40) : null, bar: rect(bar), planes: [...document.querySelectorAll('.pane')].map((p) => Math.round(p.getBoundingClientRect().width)), drop: lg.style.getPropertyValue('--lg-drop') }; })()`);
  info['classic first load, real readout'] = m;
  ok('classic 568×320, first load: X and Y are both shown', m.planes.length === 2 && m.planes.every((x) => x > 0), m.planes);
  ok('classic 568×320, first load: Y\'s readout has two lines and reaches the folded key (control)', !!m.readout && m.readout.b - m.readout.t > TWO_LINE_PX && m.readout.r > m.reach.l, { readout: m.readout, reach: m.reach });
  ok('classic 568×320, first load: the key is placed again, below Y\'s readout, with no reload', dropped.ok, { drop: m.drop, wait: dropped });
  ok('classic 568×320, first load: the key\'s hit area is clear of Y\'s readout and above the bar', !inter(m.reach, m.readout) && (!m.bar || m.legend.b <= m.bar.t + 0.5), { reach: m.reach, readout: m.readout, bar: m.bar });
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
return { pass: fails.length === 0, fails, info };
