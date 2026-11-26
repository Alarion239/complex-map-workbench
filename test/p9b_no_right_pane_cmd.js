// Y's pane is gone (#995, the classic removal's P9b): in the steps view and the classic view, on a desktop and a phone, the page
// has no #paneR, #gutterCol or any of Y's controls; it boots with no console error; X's readout follows a hover; with the
// Inspector hidden at 1280 px its overlay opens and closes; and at 767 px wide (the phone layout's widest) X fills the stage
// with no second pane beside or under it. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, got) => { if (!pass) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const Y_IDS = ['paneR', 'gutterCol', 'rightTabs', 'rightTitle', 'rightLed', 'plotR', 'canvasR', 'overlayR', 'rightReadout', 'rightLegend', 'rightFoot', 'rightFit', 'rightSph', 'emptyRight'];
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1, visible: true }], steps: [{ type: 'pown', params: { n: 2 }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } };
const LEGS = [['steps', 1280, 800, false], ['classic', 1280, 800, false], ['steps', 390, 844, true], ['classic', 390, 844, true]];
for (const [vw, w, h, phone] of LEGS) {
  const at = `${vw} ${phone ? 'phone' : 'desktop'}`;
  await view(w, h, false, phone);
  logs(true);
  await loadView(vw, 'p9b' + vw + w + Date.now(), ST);
  await settle(800);
  const left = await ev(`${JSON.stringify(Y_IDS)}.filter((id) => document.getElementById(id))`);
  info[at + ' ids'] = left;
  ok(`${at}: none of Y's pane or controls is in the page`, left.length === 0, left);
  if (!phone) {
    // (a hover over X's plane: its readout reads the point, not its idle text)
    const before = await ev(`document.getElementById('leftReadout').textContent`);
    const r = await ev(`(() => { const b = document.getElementById('overlayL').getBoundingClientRect(); return [b.left + b.width * 0.6, b.top + b.height * 0.4]; })()`);
    await move(r[0], r[1]); await settle(300); await move(r[0] + 3, r[1] + 2); await settle(300);
    const after = await ev(`document.getElementById('leftReadout').textContent`);
    info[at + ' readout'] = [before, after];
    ok(`${at}: X's readout follows a hover`, !!after && after !== before, [before, after]);
  }
  const e = errs(logs(true));
  ok(`${at}: no console error`, e.length === 0, e.slice(0, 3));
}
// the Inspector hidden at 1280: its overlay (openTemp / closeTemp) opens and closes with no error
{
  await view(1280, 800, false, false);
  logs(true);
  await loadView('steps', 'p9bins' + Date.now(), ST);
  await settle(800);
  // (the Inspector hidden, its rail's Edit button opens it over the stage (openTemp, placed beside the planes) and closes it)
  await ev(`__cmwSet('hideRight', true), 1`); await settle(400);
  const click = () => ev(`(() => { try { const b = document.getElementById('rightRailEdit'); if (!b) return 'no rail button'; b.click(); return document.getElementById('propsPanel').classList.contains('temp') ? 'open' : 'shut'; } catch (e) { return String(e); } })()`);
  const r = await click(); await settle(500);
  const r2 = await click(); await settle(500);
  const e = errs(logs(true));
  info.inspector = [r, r2];
  ok('the Inspector hidden at 1280: its rail opens it over the stage and closes it, with no error', r === 'open' && r2 === 'shut' && e.length === 0, [r, r2, e.slice(0, 3)]);
}
// 767 px, the widest the phone layout takes: X fills the stage, no second pane
{
  await view(767, 900, false, false);
  await loadView('steps', 'p9bnarrow' + Date.now(), ST);
  await settle(800);
  const g = await ev(`(() => { const panes = [...document.querySelectorAll('.panes > .pane')].filter((p) => p.getBoundingClientRect().height > 0); const st = document.querySelector('.panes').getBoundingClientRect(), x = document.getElementById('paneL').getBoundingClientRect(); return { shown: panes.map((p) => p.id), ph: document.documentElement.classList.contains('ph'), xw: Math.round(x.width), sw: Math.round(st.width) }; })()`);
  info.narrow = g;
  ok('767 px wide (the phone layout): X is the one pane shown, and it fills the stage\'s width', g.ph && g.shown.length === 1 && g.shown[0] === 'paneL' && Math.abs(g.xw - g.sw) <= 1, g);
}
return { pass: fails.length === 0, fails, info };
