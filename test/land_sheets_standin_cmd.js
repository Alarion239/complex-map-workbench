// The All-sheets Landscape while its programs (landSheetTF, landSheet) link, on a cold load with ?glhold, which keeps every
// chain program's link pending (GLR.holdLinks), in the steps view: the Landscape of plane z of √z, Im heights, All sheets.
// - the principal branch stands in for the covering surface: F's values on a grid of the block's box (landStandIn, drawn by landS)
//   give the relief while the sheets' programs link: the frame is still pending, no sheet is drawn, and the pane shows the
//   relief (more of it unlike the plate than the plate alone);
// - from the release to the GPU picture no frame shows the plate alone;
// - the GPU picture draws both sheets, and the stand-in is its principal branch: at most DIFF_FRAC of the 16 px blocks differ
//   from it by more than 40 levels (the second sheet is what differs).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const DIFF_FRAC = 0.1, PLATE_UNLIKE = 0.3, SHEETS = 2, VIEW_W = 1200, VIEW_H = 800, LOAD_WAIT = 30000, JOB_WAIT = 60000;
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'standin_kit.js'), 'utf8'));
const loaded = "typeof __cmwSteps === 'function' && !!window.GLR";
await view(VIEW_W, VIEW_H, false, false);
const ns = 'lss' + Date.now();
await loadView('steps', ns, {
  srcView: { cx: 0, cy: 0, s: 60 }, shapes: [{ id: 's1', kind: 'disc', c: [0.3, 0.2], r: 1, ci: 0, visible: true }],
  steps: [{ type: 'root', params: { n: 2, cut: 180 }, on: true }],
  rightMode: '3d', sheets: true, height: 'im',
});
if (!(await go(`http://localhost:${PORT}/test.html?ns=${ns}&glhold&view=steps`))) throw new Error('no load event');
await settled({ max: LOAD_WAIT, panes: false, until: loaded });
await ev(`__cmwSteps({ surf: 'land', T: 1 }); 1`);
const w = await settled({ only: true, max: JOB_WAIT, panes: false, until: "!!__cmwStandIn() && __cmwStandIn().land && __cmwStandIn().end !== null" });
await settled({ only: true, max: JOB_WAIT, panes: false, until: '__cmwLandStandIn()' });
const si = await ev('__cmwStandIn()');
const held = await K.look();
const drawn = await ev('(() => { const d = __cmwLandSheets().drawn; return d ? d.K : null; })()');
const heldTitle = await ev("document.querySelector('#svHead .sv-role').textContent");
info.held = { wait: w, standIn: si, drawn: await ev('__cmwLandStandIn()'), sheets: drawn, unlike: +held.unlike.toFixed(3), hue: +held.hue.toFixed(3), pending: await ev('GLR.frameStatus().pending') };
ok('the sheets wait: the stand-in is the principal branch\'s grid (its finest level done, the job ended)', w.ok && !!si && si.land && si.nodes >= 33 * 33 && (si.end === 'done' || si.end === 'budget'), info.held);
ok('no sheet is drawn while their programs link', drawn === null, info.held);
ok('the steps head (#svHead .sv-role, the title on the page) does not say both sheets while one is drawn', !/both sheets/.test(heldTitle), heldTitle);
ok(`the frame draws the stand-in's relief (more of the pane unlike the plate than ${PLATE_UNLIKE}), still pending`, info.held.drawn && held.unlike > PLATE_UNLIKE && info.held.pending === true, info.held);
const rel = await K.release();
info.release = { wait: rel.wait, frames: rel.frames, worstUnlike: rel.worstUnlike === null ? null : +rel.worstUnlike.toFixed(3) };
ok(`from the release to the GPU picture no frame shows the plate alone (every frame's unlike share over ${PLATE_UNLIKE})`, !!rel.frames && rel.worstUnlike > PLATE_UNLIKE, info.release);
const fin = await settled({ max: LOAD_WAIT, until: '__cmwLandSheets().drawn !== null' });
const after = await K.look(), apart = K.apart(held, after);
info.final = { wait: fin, sheets: await ev('(() => { const d = __cmwLandSheets().drawn; return d ? d.K : null; })()'), unlike: +after.unlike.toFixed(3), apart: +apart.toFixed(3) };
const finalTitle = await ev("document.querySelector('#svHead .sv-role').textContent");
ok('once the sheets are drawn the head says both sheets (it is rebuilt when they arrive)', /both sheets/.test(finalTitle), finalTitle);
ok(`the GPU picture draws both sheets (${SHEETS})`, fin.ok && info.final.sheets === SHEETS, info.final);
ok(`the stand-in is the GPU picture's principal branch: at most ${DIFF_FRAC * 100} % of the ${K.BLOCK} px blocks differ by more than ${K.LEVELS} levels`, apart <= DIFF_FRAC, info.final);
return { pass: fails.length === 0, fails, info };
