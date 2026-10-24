const P = async (z) => ev(`(()=>{const r=document.getElementById('plane').getBoundingClientRect(); const p=__demo.toPx(${JSON.stringify(z)}); return [r.left+p[0], r.top+p[1]];})()`);
const out = {};
await view(1440, 900, false);
await nav('file://<project>/notes/ui-redesign-2/constructions/poc/demo.html'); await sleep(600);
await shot('../../constructions/shots/01-light-default');
// hover X1: its ancestors at full strength, the rest dimmed; rows of its ancestors lit
let x1 = await ev(`__demo.G.val('X1')`); let p = await P(x1); await move(p[0], p[1]); await sleep(200);
await shot('../../constructions/shots/02-light-hover-dependencies');
// select a: its row says what uses it
await ev(`__demo.setHover(null); __demo.setSel('a')`); await sleep(100);
// drag R onto the line PQ (snapped to the 0.25 grid: exactly collinear)
const r0 = await P([-0.5, 1.5]); const r1 = await P([4, -1.5]);
await drag(r0[0], r0[1], r1[0], r1[1], 30, 16); await sleep(250);
out.collinear = await ev(`({A: __demo.G.val('c').A, shape: __demo.K.shapeOf(__demo.G.val('c'), true)})`);
await move(r1[0] + 40, r1[1] + 60); await sleep(150);
await shot('../../constructions/shots/03-light-collinear-halfplane');
// R below the line: clockwise, the area is the outside of the circle
const r2 = await P([0.75, -2.5]);
await drag(r1[0], r1[1], r2[0], r2[1], 30, 16); await sleep(250);
out.cw = await ev(`__demo.K.shapeOf(__demo.G.val('c'), true)`);
await move(r2[0] + 40, r2[1] + 60); await sleep(150);
await shot('../../constructions/shots/04-light-clockwise-complement');
// back, then the slider: g leaves the circle, X1 and X2 undefined with the reason
const r3 = await P([-0.5, 1.5]); await drag(r2[0], r2[1], r3[0], r3[1], 20, 16); await sleep(150);
const sl = await ev(`(()=>{const b=document.querySelector('input[data-param=a]').getBoundingClientRect(); return [b.left, b.top+b.height/2, b.width];})()`);
await drag(sl[0] + sl[2] * 0.5, sl[1], sl[0] + sl[2] * 0.93, sl[1], 25, 16); await sleep(250);
out.afterSlider = await ev(`({a: __demo.G.val('a'), X1: __demo.G.err('X1'), S: __demo.G.val('S')})`);
await shot('../../constructions/shots/05-light-slider-undefined');
// a construction tool in progress: circle through three points, 2 of 3 picked
await ev(`document.querySelector('input[data-param=a]').value=0.5; document.querySelector('input[data-param=a]').dispatchEvent(new Event('input',{bubbles:true})); __demo.setSel(null); __demo.setTool('circle3')`);
let a1 = await P([-3, 2]); await click(a1[0], a1[1]); await sleep(80);
let a2 = await P([-1, 3]); await click(a2[0], a2[1]); await sleep(80);
let a3 = await P([2.5, 2.25]); await move(a3[0], a3[1]); await sleep(200);
await shot('../../constructions/shots/06-light-tool-circle3-in-progress');
await click(a3[0], a3[1]); await sleep(150);
await ev(`__demo.setTool('move')`);
// the Add field: a new name becomes a slider
await clickSel('#addInp'); await type('Im z = b - 3'); await key('Enter'); await sleep(250);
out.added = await ev(`({names: __demo.G.names(), flash: document.getElementById('flash').textContent})`);
await shot('../../constructions/shots/07-light-add-auto-slider');
// dark
await view(1440, 900, true); await nav('file://<project>/notes/ui-redesign-2/constructions/poc/demo.html'); await sleep(600);
x1 = await ev(`__demo.G.val('X1')`); p = await P(x1); await move(p[0], p[1]); await sleep(150);
await shot('../../constructions/shots/08-dark-hover-dependencies');
await move(5, 5); await sleep(100);
await ev(`__demo.setSel('c')`); await sleep(100);
await shot('../../constructions/shots/09-dark-selected-circle');
// phone
await view(390, 844, false, true); await nav('file://<project>/notes/ui-redesign-2/constructions/poc/demo.html'); await sleep(600);
await shot('../../constructions/shots/10-phone-light');
out.logs = logs();
return out;
