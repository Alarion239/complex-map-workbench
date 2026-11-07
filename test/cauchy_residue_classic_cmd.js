// The Cauchy options of the classic views when the residue theorem gives no choice: with no pole inside the curve, or
// with an essential singularity (computed numerically), the pop-up has no Both | Inside | Outside control at all. The
// steps view keeps the control, disabled (test/cauchy_residue_cmd.js).
// A command file for the CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const PNG = process.mainModule.require(path.join(DIR, 'png.js'));
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
const stateOf = (shapes, steps) => ({ shapes, steps, srcView: { cx: 0, cy: 0, s: 110 }, nextId: 50, pattern: 'checker' });
const CIRCLE = [{ id: 's1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }];
const custom = (expr) => [{ type: 'custom', params: { expr, cut: 180 }, on: true }];
const open = async (shapes, steps) => {
  await view(1440, 900, false, false);
  await load('cr' + Date.now() + Math.floor(Math.random() * 1000), stateOf(shapes, steps));
  await settle(1200);
  // (the steps view offers Cauchy while z is the colour plane: the curve lies on z)
  await ev(`typeof __cmwSteps === 'function' && __cmwSteps().on ? (__cmwSteps({ T: 0 }), 1) : 0`);
  await ev(`__cmwSetMain('phase'); __cmwSelect('s1'); document.querySelector('[id="dcSeg"] [data-v="cauchy"]').click(); 1`);
  await settle(1500);
};
const optsText = () => ev(`(() => { const b = document.querySelector('#leftFoot .opts-btn:not(.pat-btn)'); if (b) b.click(); const p = document.querySelector('.opts-pop'); const t = p ? p.textContent : ''; const seg = document.getElementById('cauchySeg') || (p && p.querySelector('#cauchySeg')); const o = { text: t, seg: seg ? [...seg.children].map((x) => x.textContent.trim() + (x.classList.contains('on') ? '*' : '')) : null, segId: !!seg, off: seg ? [...seg.children].every((x) => x.disabled) : null }; if (p) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return o; })()`);
const SV = await ev(`typeof __cmwSteps === 'function' && !!__cmwSteps().on`);
ok('the classic view is shown', !SV, SV);
await open(CIRCLE, custom('z^{2}'));
await settle(1500);
const A3 = await optsText();
ok('no pole inside: no choice at all, and the old note ("F inside, 0 outside")', !A3.segId && /inside, 0 outside/.test(A3.text), A3);
await open(CIRCLE, custom('\\exp\\left(\\frac{1}{z}\\right)'));
const A4 = await optsText();
ok('e^(1/z): computed numerically, no choice at all', !A4.segId && /computed numerically/.test(A4.text), A4);
const e = errs(await logs());
ok('no page errors', !e.length, e.slice(0, 4).map((x) => String(x.m).slice(0, 200)));
return { pass: !fails.length, fails, info };
