// X's readout chip is a reading, not a target, on every touch device, not only on the phone layout: a tablet (820 × 1180, touch
// emulation, the desktop layout) gives the chip pointer-events: none, so a touch on it goes to the plane under it and copies nothing;
// with a mouse (1280 × 800) the chip still copies a press. copyReadout hands the value to navigator.clipboard.writeText inside the click,
// so a spy on it counts the copies at once; the plane is read first (a pointer move over it) so there is a value to copy.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const CHIP = `document.getElementById('leftReadout')`;
// a press near the chip's left end after the plane is read: how many copies it made
const press = async () => {
  const [px, py] = await ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(), c = ${CHIP}.getBoundingClientRect(); return [r.left + r.width * 0.5, Math.max(c.bottom + 40, r.top + r.height * 0.6)]; })()`);
  await ev(`window.__writes = 0; navigator.clipboard.writeText = () => { window.__writes++; return Promise.resolve(); }, 1`);
  await move(px, py);
  await settled({ max: 8000, only: true, until: `!!${CHIP}.querySelector('.rv')` });
  const read = await ev(`!!${CHIP}.querySelector('.rv')`);
  const at = await ev(`(() => { const r = ${CHIP}.getBoundingClientRect(); return [r.left + 12, (r.top + r.bottom) / 2]; })()`);
  await click(at[0], at[1]);
  return { read, writes: await ev('window.__writes'), pe: await ev(`getComputedStyle(${CHIP}).pointerEvents`) };
};
const open = async (name, w, h, touch) => {
  await view(w, h, false, touch);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=rdtab${w}${Date.now()}`);
  await settled({ max: 30000, until: `typeof __cmwSteps === "function" && !!${CHIP} && ${CHIP}.getClientRects().length > 0 && (${CHIP}.textContent || '').trim().length > 0` });
  return ev(`({ ph: document.documentElement.classList.contains('ph'), coarse: matchMedia('(pointer: coarse)').matches, h: Math.round(${CHIP}.getBoundingClientRect().height) })`);
};

const tab = info.tablet = await open('tablet', 820, 1180, true);
ok('820x1180: the desktop layout (no .ph) on a coarse pointer', !tab.ph && tab.coarse, tab);
const t = info.tabletPress = await press();
ok('820x1180: the plane read, so there is a value to copy', t.read, t);
ok('820x1180: the chip has pointer-events none', t.pe === 'none', t);
ok('820x1180: a press on the chip copies nothing', t.writes === 0, t);

const desk = info.desktop = await open('desktop', 1280, 800, false);
ok('1280x800 with a mouse: the desktop layout on a fine pointer', !desk.ph && !desk.coarse, desk);
const d = info.deskPress = await press();
ok('1280x800: the plane read, so there is a value to copy', d.read, d);
ok('1280x800: the chip keeps its pointer events', d.pe === 'auto', d);
ok('1280x800: a press on the chip copies the readout once', d.writes === 1, d);
return { pass: fails.length === 0, fails, info };
