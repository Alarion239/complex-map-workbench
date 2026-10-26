const R = {}; const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const MOB = { a: '1', b: '-1', c: '1', d: '1' };
const chain3 = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: MOB, on: true }, { type: 'pown', params: { n: 2 }, on: true }];
await view(1440, 900, false, false);
await load('fx16ui1', { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.5 }, { id: 's2', kind: 'point', p: [0.3, 0.2] }], steps: chain3, srcView: { cx: 0, cy: 0, s: 80 } });
await settle(1500);
// user-1: arm the 3-point circle tool, open the deformation from a card's menu
await ev(`(() => { const b = document.querySelector('.tool[data-tool="circle3"]'); if (b) b.click(); return !!b; })()`); await settle(200);
R.toolBefore = await ev(`[...document.querySelectorAll('.tool[data-tool].on')].map((b) => b.dataset.tool)`);
await ev(`(() => { document.querySelector('#pipeline .card[data-k="2"] .more').click(); return 1; })()`); await settle(250);
const parentRect = await ev(`(() => { const p = document.querySelector('.pop.menu'); const r = p.getBoundingClientRect(); return [r.left, r.top, r.width]; })()`);
await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => /^Deformation$/.test(x.querySelector('.mi-label').textContent.trim())); b.click(); return 1; })()`); await settle(300);
R.sub = await ev(`(() => { const p = document.querySelector('.pop.menu'); const r = p.getBoundingClientRect(); return { rect: [r.left, r.top, r.width], items: [...p.querySelectorAll('.mi')].map((x) => ({ label: x.querySelector('.mi-label').innerHTML, key: x.querySelector('.mi-key').innerHTML, keyFont: getComputedStyle(x.querySelector('.mi-key')).fontFamily.slice(0, 30), keyColor: getComputedStyle(x.querySelector('.mi-key')).color })) }; })()`);
R.parentRect = parentRect;
await shot('fx-submenu', { x: Math.round(R.sub.rect[0]) - 20, y: Math.round(R.sub.rect[1]) - 20, width: 420, height: 220 });
await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => /Steps/.test(x.querySelector('.mi-label').textContent) && /f2/.test(x.querySelector('.mi-label').textContent.replace(/\\s/g,'')) && /f1/.test(x.querySelector('.mi-label').textContent.replace(/\\s/g,''))); if (b) b.click(); return !!b; })()`); await settle(800);
R.afterOpen = await ev(`({ tools: [...document.querySelectorAll('.tool[data-tool].on')].map((b) => b.dataset.tool), chipR: (() => { const c = document.getElementById('sphereChipR'); return c ? { hidden: c.hidden, text: c.textContent } : null; })(), range: __cmwRange().stored, morph: __cmwMorph({}) })`);
await ev('__cmwMorph({ playing: false, T: 0 })'); await settle(600);
// math-4: the moving point's label in a pullback (post live): Hₜ(z₀)
R.labels = await ev(`(() => { try { return __cmwState().homView ? 'hv' : 'none'; } catch (e) { return String(e); } })()`);
await shot('fx-pull-t0');
const br = await ev(`(() => { const r = document.getElementById('chainBracket'); const l = r && r.querySelector('.br-line').getBoundingClientRect(); return l ? [l.left, l.top, l.width] : null; })()`);
R.br = br;
if (br) await shot('fx-bracket', { x: Math.max(0, Math.round(br[0]) - 40), y: Math.max(0, Math.round(br[1]) - 10), width: Math.round(br[2]) + 80, height: 120 });
R.handle = await ev(`(() => { const e = document.querySelector('#chainBracket .br-end.l'); const s = getComputedStyle(e, '::before'); return { w: s.width, h: s.height, bg: s.backgroundColor, bd: s.borderTopColor, content: s.content }; })()`);
R.lineTip = await ev(`document.querySelector('#chainBracket .br-line').dataset.tip`);
// dark submenu shot
await view(1440, 900, true, false); await settle(500);
await ev(`(() => { document.querySelector('#pipeline .card[data-k="3"] .more').click(); return 1; })()`); await settle(250);
await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => /^Deformation$/.test(x.querySelector('.mi-label').textContent.trim())); b.click(); return 1; })()`); await settle(300);
const sr = await ev(`(() => { const r = document.querySelector('.pop.menu').getBoundingClientRect(); return [r.left, r.top]; })()`);
await shot('fx-submenu-dark', { x: Math.round(sr[0]) - 20, y: Math.round(sr[1]) - 20, width: 420, height: 220 });
R.darkKeyColor = await ev(`getComputedStyle(document.querySelector('.pop.menu .mi-key.mi-math') || document.body).color`);
await key('Escape'); await settle(200);
await view(1440, 900, false, false);
// user-5: the Mountain King example opens with a hint toast
const ei = await ev(`(() => { const ex = [...document.querySelectorAll('#examplesBtn')].length; return ex; })()`);
R.mk = await ev(`(() => { const i = (window.__cmwExamples ? __cmwExamples() : null); return i; })()`);
R.logs = (await logs()).filter((x) => x.t === 'EXC' || x.t === 'error').slice(0, 5);
return R;
