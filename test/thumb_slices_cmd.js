// The chain's step cards are drawn in idle slices (issue #326): the card of the selected step first, not while an input
// is going on, a newer request (another chain) drops the pending slices so no card shows the old chain's picture, and
// __cmwCardsNow still draws them all at once.
// A command file for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const cards = () => ev(`__cmwCards().cards.map((c) => (c.sig ? 1 : 0)).join('')`);
const hash = () => ev(`[...document.querySelectorAll('#pipeline .card canvas')].map((c) => { let h = 0; const d = c.toDataURL(); for (let i = 0; i < d.length; i += 7) h = (h * 31 + d.charCodeAt(i)) | 0; return h; }).join(',')`);
const fresh = async () => {
  await view(1440, 900, false, false);
  await load('thumbs' + Date.now() + Math.floor(Math.random() * 1000), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
  await settle(1500);
};
// the examples by name: Strip to disk (two steps, three cards) and another with a chain
const names = async () => ev(`(() => { const out = []; for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { break; } const l = document.querySelector('#examplesBtn .exlabel'); out.push(l ? l.textContent : ''); } return out; })()`);
await fresh();
const nm = await names();
const iStrip = nm.findIndex((n) => /^Strip to disk/.test(n)), iJ = nm.findIndex((n) => /^Joukowski/.test(n));
ok('the examples exist', iStrip > 0 && iJ > 0, nm.slice(0, 5));

// A: the selected step's card is first in the job, then the others by distance
await fresh();
await ev(`__cmwExample(${iStrip}); 1`);
await settle(2500);
const sel = await ev('__cmwCards().sel'), job = await ev('__cmwThumbJob()');
ok('A the job lists every card', job.order.length >= 3 && new Set(job.order).size === job.order.length, job);
ok('A the selected step\'s card is first', job.order[0] === sel, { job, sel });
ok('A the cards come by distance from the selected step', job.order.every((k, i) => i === 0 || Math.abs(job.order[i - 1] - sel) <= Math.abs(k - sel)), { job, sel });
ok('A every card is drawn within a few seconds and nothing is left of the job', !/0/.test(await cards()) && job.left === 0, { cards: await cards(), job });

// B: another chain asked for while slices are pending: no card keeps the first chain's picture
await fresh();
await ev(`__cmwExample(${iStrip}); 1`);
await settle(4000);
const hS = (await hash()).split(',');
await fresh();
await ev(`__cmwExample(${iStrip}); 1`); await sleep(150);
await ev(`__cmwExample(${iJ}); 1`);
await settle(5000);
const hB = (await hash()).split(','), cB = await cards();
ok('B all cards of the second chain are drawn', !/0/.test(cB), cB);
ok('B no card shows the first chain\'s picture', hB.every((h, k) => k >= hS.length || h !== hS[k]), { hS, hB });

// C: no card is drawn while an input goes on (pointermove events, as the window hears them); they follow once it stops
await fresh();
await ev(`__cmwExample(${iStrip}); 1`);
const c0 = (await cards()).split('1').length - 1;
await ev(`(() => { let n = 0; const id = setInterval(() => { window.dispatchEvent(new PointerEvent('pointermove', { clientX: 300 + (n % 5), clientY: 300 })); if (++n > 30) clearInterval(id); }, 30); return 1; })()`);
await sleep(700);
const c1 = (await cards()).split('1').length - 1;
ok('C no card drawn while inputs arrive', c1 === c0, { c0, c1 });
await settle(3500);
ok('C the cards follow once the input stops', !/0/.test(await cards()), await cards());

// D: __cmwCardsNow runs the whole job in the same task
await fresh();
await ev(`__cmwExample(${iStrip}); 1`);
const dLeft = await ev(`(() => { __cmwCardsNow(); return __cmwThumbJob(); })()`);
ok('D __cmwCardsNow leaves nothing of the job for later', dLeft.order.length >= 3 && dLeft.left === 0, dLeft);
return { pass: fails.length === 0, fails };
