// A closed polygon gains a vertex by a double-click on an edge and loses one from the vertex's menu or the shape's vertex
// list; it keeps at least three (issue #42). A command file for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('polyv' + Date.now(), { shapes: [{ id: 'a', kind: 'polygon', pts: [[-1, -1], [1, -1], [1, 1], [-1, 1]] }], steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1500);
const pts = () => ev(`__cmwPlaneMenu().shapes()[0].pts.length`);
const at = (re, im) => ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`);
ok('it starts as a square', (await pts()) === 4, await pts());
// double-click the middle of the bottom edge: a fifth vertex
const e1 = await at(0, -1);
await ev(`document.getElementById('overlayL').dispatchEvent(new MouseEvent('dblclick', { clientX: ${e1[0]}, clientY: ${e1[1]}, bubbles: true }))`); await settle(500);
ok('a double-click on an edge adds a vertex', (await pts()) === 5, await pts());
const added = await ev(`__cmwPlaneMenu().shapes()[0].pts[1]`);
ok('the new vertex lies on the edge, after the first', Math.abs(added[0]) < 0.2 && Math.abs(added[1] + 1) < 0.05, added);
// the closing edge (last to first)
const e2 = await at(-1, 0);
await ev(`document.getElementById('overlayL').dispatchEvent(new MouseEvent('dblclick', { clientX: ${e2[0]}, clientY: ${e2[1]}, bubbles: true }))`); await settle(500);
ok('the closing edge takes one too', (await pts()) === 6, await pts());
// remove a vertex from its menu
const v = await at(1, 1);
await ev(`PlaneMenu.open('L', null, { clientX: ${v[0]}, clientY: ${v[1]} })`); await settle(400);
const clicked = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .pop.menu button, #popHost .pop.menu [role="menuitem"]')].find((x) => /Remove vertex/.test(x.textContent)); if (b) b.click(); return !!b; })()`); await settle(500);
ok('the vertex menu has Remove vertex, which removes it', clicked && (await pts()) === 5, [clicked, await pts()]);
// down to three: the item is then disabled, and the list's buttons too
for (let i = 0; i < 4 && (await pts()) > 3; i++) {
  const p = await ev(`(() => { const s = __cmwPlaneMenu().shapes()[0]; return __cmwPlaneMenu().w2s('L', s.pts[0][0], s.pts[0][1]); })()`);
  await ev(`PlaneMenu.open('L', null, { clientX: ${p[0]}, clientY: ${p[1]} })`); await settle(300);
  await ev(`(() => { const b = [...document.querySelectorAll('#popHost .pop.menu button, #popHost .pop.menu [role="menuitem"]')].find((x) => /Remove vertex/.test(x.textContent)); if (b) b.click(); return 1; })()`); await settle(300);
}
ok('it stops at three vertices', (await pts()) === 3, await pts());
const p0 = await ev(`(() => { const s = __cmwPlaneMenu().shapes()[0]; return __cmwPlaneMenu().w2s('L', s.pts[0][0], s.pts[0][1]); })()`);
await ev(`PlaneMenu.open('L', null, { clientX: ${p0[0]}, clientY: ${p0[1]} })`); await settle(300);
const dis = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .pop.menu button, #popHost .pop.menu [role="menuitem"]')].find((x) => /Remove vertex/.test(x.textContent)); return !!b && (b.disabled || b.getAttribute('aria-disabled') === 'true'); })()`);
ok('Remove vertex is disabled on a triangle', dis, dis);
await key('Escape'); await settle(300);
// the vertex list in the shape's editor
await settle(600);
const det = await ev(`(() => { const d = document.querySelector('.poly-det'); return d ? { n: d.querySelectorAll('.poly-vert').length, sum: d.querySelector('summary').textContent } : null; })()`);
ok('the editor lists the three vertices in a folded list', det && det.n === 3 && /3/.test(det.sum), det);
return { pass: fails.length === 0, fails };
