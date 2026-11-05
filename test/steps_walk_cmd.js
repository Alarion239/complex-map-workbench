// The ‹ › walk of a step shown alone, in the steps view's thread after "Whole chain" (#945): with three active steps and a
// bypassed one, › › › then ‹ walks f1, f2, f4, f4, f2 skipping the bypassed f3; at the ends the buttons are aria-disabled
// with a tip and a press changes nothing; › from the end plane keeps the shown plane; Whole chain and Esc leave.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ns = 'swk' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'r1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2] }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 },
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '1' }, on: true }, { type: 'sin', params: {}, on: false }, { type: 'exp', params: {}, on: true }] };
const open = async (w, h, lang = 'en', extra = {}) => {
  await view(w, h, false, w < 500);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(Object.assign({}, st, extra)))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` }); await sleep(3000); await settle(500);
};
const walk = (d) => ev(`(() => { const b = document.querySelector('#svStrip .sv-awalk[data-d="${d}"]'); return b ? { off: b.getAttribute('aria-disabled'), tip: b.dataset.tip, label: b.getAttribute('aria-label'), w: b.getBoundingClientRect().width } : null; })()`);
const alone = () => ev(`(() => { if (!document.querySelector('#svStrip .sv-whole')) return 0; const P = __cmwSteps().planes; return P[P.length - 1]; })()`);
const press = async (d) => { await clickSel(`#svStrip .sv-awalk[data-d="${d}"]`); await settle(300); };
const pane = async () => { await settle(1500); return img(await ev(`(() => { const r = document.getElementById('paneL').getBoundingClientRect(); const h = document.querySelector('#paneL .pane-head'); const t = h ? h.getBoundingClientRect().bottom + 2 : r.top; return { x: Math.round(r.left) + 2, y: Math.round(t), width: Math.round(r.width) - 4, height: Math.round(r.bottom - t - 120) }; })()`)); };
const same = (a, b) => { if (a.w !== b.w || a.h !== b.h) return -1; let n = 0; for (let j = 0; j < a.data.length; j += a.ch) if (Math.abs(a.data[j] - b.data[j]) > 8 || Math.abs(a.data[j + 1] - b.data[j + 1]) > 8 || Math.abs(a.data[j + 2] - b.data[j + 2]) > 8) n++; return n; };

await open(1440, 900);
ok('no walk buttons on the whole chain', (await walk(1)) === null && (await walk(-1)) === null);
await clickSel('#svStrip .sv-step[data-k="1"] .sv-more'); await settle(300);
await ev(`(() => { const m = [...document.querySelectorAll('[role=menuitem], .menu button')].find((e) => /Show alone/.test(e.textContent)); if (m) m.click(); return 1; })()`); await settle(500);
const seq = [await alone()];
const tips = [await walk(-1), await walk(1)];
ok('f1 alone: ‹ is aria-disabled with its tip, › names f2', tips[0] && tips[0].off === 'true' && /f₁/.test(tips[0].tip) && /No step before/.test(tips[0].tip) && tips[1].off === 'false' && /f₂/.test(tips[1].tip) && tips[0].label === 'Previous step alone' && tips[1].label === 'Next step alone', tips);
await press(-1); seq.push(await alone());
for (let i = 0; i < 3; i++) { await press(1); seq.push(await alone()); }
await press(-1); seq.push(await alone());
ok('the walk 1, 1, 2, 4, 4, 2 (f3 bypassed)', seq.join() === '1,1,2,4,4,2', seq);
await press(1); const endTips = [await walk(1)];
ok('f4 alone: › aria-disabled, tip says no step after f₄', endTips[0].off === 'true' && /No step after f₄/.test(endTips[0].tip), endTips);
// › from the end plane keeps the picture: f2 alone on its last plane, › shows f4 alone on its first plane
await press(-1);
const pl = async () => ev('(() => { const q = __cmwSteps(); return { planes: q.planes, stage: q.stage }; })()');
const a = await pl(); await press(1); const b = await pl();
info.walk = [a, b];
ok('› from the end plane: the shown plane stays plane 2 (the colour plane is the step\'s own)', a.stage === 2 && b.stage === 2 && b.planes[0] === 2, info.walk);
await press(1); await press(-1); await press(-1);
await clickSel('#svStrip .sv-whole'); await settle(400);
ok('Whole chain leaves', (await alone()) === 0 && (await walk(1)) === null);
await open(360, 740, 'en', { sv: { at: 0, T: -1, scope: 'chain', surf: 'plane', speed: 1, alone: 2 } });
info.phone = await walk(1);
ok('phone: 44 px targets when a step is shown alone', info.phone && info.phone.w >= 44, info.phone);
return { pass, fails, info };
