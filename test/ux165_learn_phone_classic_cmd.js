// The classic phone's learn checks: the note after a target (Y's chip "Shaded in X (the inset)", the inset's pulse) and
// the message row under the chain bar, clear of the inset, Fit and the key column. The steps view's phone has no
// inset and no chain bar. Phone (412 x 860, Android Chrome emulation, real touch events through
// Input.dispatchTouchEvent). A command file for a CDP daemon (test/cdp_kit README): python3 build.py &&
// test/<you>_cdp/q.sh test/ux165_learn_phone_classic_cmd.js. Prints { pass, of, fails: [[name, false, detail]], exc }.
const { U, R, check, exc, grab, UA0, laptop, fresh, ready, firstVisit } = await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'ux165_kit.js'), 'utf8'));
const box = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; })()`);
const meet = (a, b) => !!a && !!b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
const mid = (b) => [b.l + b.w / 2, b.t + b.h / 2];
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const phone = async (w, h, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, platform: 'Linux armv8l' }); await view(w, h, dark, true); };
const tap = async (x, y, hold = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(hold); /* standards-ok: the press length is the gesture, not a wait */ await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settled({}); };
const tdrag = async (x0, y0, x1, y1, n = 14) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); for (let i = 1; i <= n; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] }); await sleep(16); /* standards-ok: the finger's move pacing, not a wait */ } await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settled({}); };
const tapSel = async (sel) => { const b = await box(sel); if (!b) return false; await tap(...mid(b)); return true; };
logs();
let g = null;
// ---------------------------------------------------------------- phone: the target's note
await phone(412, 860);
await fresh('ux165c'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
// (a pulse is the class going on: a record that only rewrites the pane's classes, as a resize does, is not one)
await ev(`(() => { const L = document.querySelector('#paneL'); window.__olds = []; new MutationObserver((ms) => { for (const m of ms) window.__olds.push(m.oldValue || ''); }).observe(L, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }); return 1; })()`);
await tapSel('.pane.ph-inset .ph-swap'); await settled({});
await tapSel('#secDraw [data-tool="disc"]'); await settled({ until: "!!document.querySelector('#secDraw [data-tool=\"disc\"].on, #secDraw [data-tool=\"disc\"][aria-pressed=\"true\"]')" });
await tdrag(200, 330, 250, 380); await settled({ until: "__cmwState().targets === 1" });
g = await ev(`({ ro: __qa.txt('#rightReadout'), calc: (document.querySelector('#calcChip') || {}).hidden, pulse: (() => { const v = window.__olds.concat(document.querySelector('#paneL').className); let n = 0; for (let i = 0; i + 1 < v.length; i++) if (!/ph-pulse/.test(v[i]) && /ph-pulse/.test(v[i + 1])) n++; return n; })(), targets: __cmwState().targets })`);
check('V01 phone: after a target, Y\'s chip says "Shaded in X (the inset)", no note over Y, and the inset pulsed once', g.targets === 1 && /Shaded in X \(the inset\)/.test(g.ro) && g.calc === true && g.pulse === 1, g);
await shot('ux165-v01-phone');

// ---------------------------------------------------------------- phone: the message row
await phone(412, 860);
const clearChain = async () => { await key('k', 4); await settled({ until: "!!document.getElementById('palInput')", max: 8000 }); await type('Clear chain'); await settled({ until: "document.getElementById('palInput').value === 'Clear chain'", max: 8000 }); await key('Enter'); await settled({ until: '__cmwP().steps.length === 0', max: 8000 }); };
await fresh('ux165f'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
await clearChain(); await settled({ until: "!!document.querySelector('#toastHost .toast')" });
g = await ev(`(() => { const r = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }; return { t: r(document.querySelector('#toastHost .toast')), inset: r(document.querySelector('.pane.ph-inset')), fit: r(document.querySelector('.pane:not(.ph-inset) .viewstack')), col: r(document.querySelector('.pane:not(.ph-inset) .ph-col')), chain: r(document.querySelector('.pipe-wrap')) }; })()`);
// (#66: a phone's message takes the row over the tool row, under the chain bar, and the planes give that row up: it covers none of them)
check('UX80 phone: the message sits in its own row under the chain bar, clear of the inset, Fit and the key column', g.t && !meet(g.t, g.inset) && !meet(g.t, g.fit) && !meet(g.t, g.col) && g.t.t >= g.chain.b - 1 && g.t.b - g.t.t >= 44, g);
await shot('ux165-ux80-phone');
grab();


await laptop(1440, 900, false);
await send('Emulation.setUserAgentOverride', { userAgent: UA0 });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails, exc };
