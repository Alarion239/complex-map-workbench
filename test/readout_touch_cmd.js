// X's readout chip on a phone is not a touch target: the phone layout gives it pointer-events: none, so a touch on it goes to the
// plane under it and the click that copies the readout never fires there. At 360 and 412 px portrait and 740×360 landscape the chip
// is on the page with its text; at its centre the topmost element is not the chip; a press there copies nothing (a spy on the clipboard's writeText counts the copies, with the plane read first so there is a value to copy); and with
// pointer-events given back the chip is the topmost element, so the check can fail. A command file for a CDP daemon
// (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const CHIP = `document.getElementById('leftReadout')`;
const top = () => ev(`(() => { const c = ${CHIP}, r = c.getBoundingClientRect(), e = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return { chip: c.getClientRects().length > 0 && (c.textContent || '').trim().length > 0, h: Math.round(r.height), pe: getComputedStyle(c).pointerEvents, top: e && (e.id || e.className || e.tagName), isChip: !!e && (e === c || c.contains(e)), xy: [Math.round((r.left + r.right) / 2), Math.round((r.top + r.bottom) / 2)] }; })()`);
for (const [w, h] of [[360, 780], [412, 915], [740, 360]]) {
  const name = `${w}x${h}`;
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=rdtouch${w}${Date.now()}`);
  await settled({ max: 30000, until: `typeof __cmwSteps === "function" && !!${CHIP} && ${CHIP}.getClientRects().length > 0 && (${CHIP}.textContent || '').trim().length > 0` });
  const t = info[name] = await top();
  ok(`${name}: the chip is on the page with its text`, t.chip, t);
  ok(`${name}: the chip has pointer-events none`, t.pe === 'none', t);
  ok(`${name}: at the chip's centre the topmost element is not the chip`, !t.isChip, t);
  // (the plane read first, so the readout has a value to copy: a press that did reach the chip would copy it. copyReadout hands the value to
  // navigator.clipboard.writeText inside the click, so a spy on it counts the copies at once; the "Copied" class comes later, from the promise)
  const [px, py] = await ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(), c = ${CHIP}.getBoundingClientRect(); return [r.left + r.width * 0.5, Math.max(c.bottom + 40, r.top + r.height * 0.6)]; })()`);
  await ev(`window.__writes = 0; navigator.clipboard.writeText = () => { window.__writes++; return Promise.resolve(); }, 1`);
  await move(px, py);
  await settled({ max: 8000, only: true, until: `!!${CHIP}.querySelector('.rv')` });
  const read = await ev(`!!${CHIP}.querySelector('.rv')`);
  ok(`${name}: the plane's reading is in the chip (so there is a value to copy)`, read, null);
  const at = await ev(`(() => { const r = ${CHIP}.getBoundingClientRect(); return [r.left + 12, (r.top + r.bottom) / 2]; })()`);   // (near its left end: the chip idles, and shrinks, once the pointer leaves the plane)
  await click(at[0], at[1]);
  ok(`${name}: a press on the chip does not copy the readout`, (await ev('window.__writes')) === 0, await ev('window.__writes'));
  // (the control: with pointer-events given back the chip is what a touch reaches and the same press copies the readout, so the two checks above can fail)
  await ev(`${CHIP}.style.pointerEvents = 'auto', 1`);
  await move(px, py);
  await settled({ max: 8000, only: true, until: `!!${CHIP}.querySelector('.rv')` });
  const c = await ev(`(() => { const r = ${CHIP}.getBoundingClientRect(), e = document.elementFromPoint(r.left + 12, (r.top + r.bottom) / 2); return !!e && (e === ${CHIP} || ${CHIP}.contains(e)); })()`);
  ok(`${name}: with pointer-events auto the chip is the topmost element`, c, c);
  await click(at[0], at[1]);
  ok(`${name}: with pointer-events auto the same press copies the readout`, (await ev('window.__writes')) === 1, await ev('window.__writes'));
}
return { pass: fails.length === 0, fails, info };
