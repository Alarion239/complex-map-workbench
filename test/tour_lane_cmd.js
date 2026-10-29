// The learning lane's lines and the chapter's end (issue #34, D7): a tour cut short by a reload offers "Continue the
// tour: <chapter>" in the docked slot (UX76), Continue picks it up at the step it stopped at and × forgets it; the end
// of a chapter says "<chapter> done ✓" (UX75); the examples menu gives a description two lines (UX41). A command file
// for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const lane = () => ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="continue"]'); if (!l) return null; const b = l.getBoundingClientRect(); return { vis: b.height > 0, text: l.querySelector('.tl-text').textContent.replace(/\\s+/g, ' ').trim(), acts: [...l.querySelectorAll('.tl-act .tl-long')].map((a) => a.textContent.trim()), x: !!l.querySelector('.tl-x') }; })()`);
await view(1440, 900, false, false);
const ns = 'tourlane' + Date.now();
await load(ns, { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1500);

// ---- UX76: a reload in the middle of the Views chapter
await ev(`Tour.start({ chapter: 'views' })`); await settle(1500);
await ev(`Tour.next()`); await settle(1500);
const at = await ev(`Tour.current()`);
await ev(`location.reload(); 1`); await sleep(3500); await settle(800);
ok('after the reload no tour runs', !(await ev(`Tour.isActive()`)), at);
ok('the page knows the tour was cut short', await ev(`Tour._t.cutShort()`), at);
ok('the line is offered', await ev(`Tour.offerContinue()`), at);
await settle(400);
let l = await lane();
ok('the line says Continue the tour: Views, with Continue and ×', l && l.vis && /^Continue the tour: Views/.test(l.text) && l.acts.includes('Continue') && l.x, l);
await ev(`document.querySelector('.tour-lane[data-lane="continue"] .tl-act').click()`); await settle(2000);
const cur = await ev(`Tour.current()`);
ok('Continue picks the tour up at the step it stopped at', cur && at && cur.chapter === 'views' && cur.step === at.step, { cur, at });
ok('... and the line is gone', !(await lane()), null);
await ev(`Tour.stop()`); await settle(600);
ok('a tour ended by the user is not offered after a reload', await (async () => { await ev(`location.reload(); 1`); await sleep(3500); await settle(500); return !(await ev(`Tour._t.cutShort()`)); })(), null);
// × forgets where it stopped: the help menu has no Continue the tour any more
await ev(`Tour.start({ chapter: 'views' })`); await settle(1500);
await ev(`location.reload(); 1`); await sleep(3500); await settle(800);
await ev(`Tour.offerContinue()`); await settle(400);
await ev(`document.querySelector('.tour-lane[data-lane="continue"] .tl-x').click()`); await settle(400);
ok('× closes the line', !(await lane()), null);
await ev(`Tour.openHelpMenu(document.getElementById('helpBtn'))`); await settle(400);
const items = await ev(`[...document.querySelectorAll('.tour-menu .mi')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim())`);
ok('... and forgets it: the help menu offers no Continue the tour', Array.isArray(items) && items.length > 0 && !items.some((t) => /^Continue the tour/.test(t)), items);
await ev(`Tour.closeHelpMenu()`); await settle(300);

// ---- UX75: crossing into the next chapter says the chapter is done
const n0 = await ev(`Tour.chapters()[0].steps`);
await ev(`Tour.start({ chapter: 'basics', step: ${n0 - 1} })`); await settle(1500);
await ev(`Tour.next()`); await settle(1200);
const said = await ev(`[...document.querySelectorAll('.tour-sr, [aria-live]')].map((e) => e.textContent).join(' | ')`);
ok('Next out of Basics says "Basics done ✓"', /Basics done ✓/.test(said), said.slice(0, 300));
ok('... and the tour is in the next chapter', (await ev(`Tour.current().chapter`)) !== 'basics', null);
await ev(`Tour.stop()`); await settle(600);

// ---- UX41: the examples menu's descriptions have two lines, not one cut short
await clickSel('#examplesBtn'); await settle(600);
const bl = await ev(`[...document.querySelectorAll('#popHost .examples .ex-blurb')].map((e) => ({ h: e.getBoundingClientRect().height, full: e.scrollHeight <= e.clientHeight + 1, t: e.textContent.slice(0, 40) }))`);
ok('the menu has descriptions', Array.isArray(bl) && bl.length >= 10, bl);
ok('a long description takes two lines (16 px each)', bl.some((b) => b.h > 24 && b.h <= 33), bl);
ok('no description is taller than two lines', bl.every((b) => b.h <= 33), bl);
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await settle(300);
return { pass: fails.length === 0, fails };
