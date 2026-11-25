// The classic phone's learn checks: the message row under the chain bar, clear of Fit and the key column. The steps view's
// phone has no chain bar. (standards-ok: the note after a target drawn in Y and the inset's pulse went with Y's pane, not
// drawn since #994: the classic phone shows X alone) Phone (412 x 860, Android Chrome emulation, real touch events through
// Input.dispatchTouchEvent). A command file for a CDP daemon (test/cdp_kit README): python3 build.py &&
// test/<you>_cdp/q.sh test/ux165_learn_phone_classic_cmd.js. Prints { pass, of, fails: [[name, false, detail]], exc }.
const { U, R, check, exc, grab, UA0, laptop, fresh, ready, firstVisit } = await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'ux165_kit.js'), 'utf8'));
const meet = (a, b) => !!a && !!b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const phone = async (w, h, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, platform: 'Linux armv8l' }); await view(w, h, dark, true); };
logs();
let g = null;
// ---------------------------------------------------------------- phone: the message row
await phone(412, 860);
const clearChain = async () => { await key('k', 4); await settled({ until: "!!document.getElementById('palInput')", max: 8000 }); await type('Clear chain'); await settled({ until: "document.getElementById('palInput').value === 'Clear chain'", max: 8000 }); await key('Enter'); await settled({ until: '__cmwP().steps.length === 0', max: 8000 }); };
await fresh('ux165f'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
await clearChain(); await settled({ until: "!!document.querySelector('#toastHost .toast')" });
g = await ev(`(() => { const r = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }; return { t: r(document.querySelector('#toastHost .toast')), inset: r(document.querySelector('.pane.ph-inset')), fit: r(document.querySelector('.pane:not(.ph-inset) .viewstack')), col: r(document.querySelector('.pane:not(.ph-inset) .ph-col')), chain: r(document.querySelector('.pipe-wrap')) }; })()`);
// (#66: a phone's message takes the row over the tool row, under the chain bar, and the planes give that row up: it covers none of them)
check('UX80 phone: the message sits in its own row under the chain bar, clear of Fit and the key column', g.t && !meet(g.t, g.fit) && !meet(g.t, g.col) && g.t.t >= g.chain.b - 1 && g.t.b - g.t.t >= 44, g);
await shot('ux165-ux80-phone');
grab();


await laptop(1440, 900, false);
await send('Emulation.setUserAgentOverride', { userAgent: UA0 });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails, exc };
