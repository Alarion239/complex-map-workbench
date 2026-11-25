// The Stack's chains (19-stack-chain.js, #1990): a glass level for each plane between the floor and the disc's plane,
// read from the page (__cmwStack().drawn, __cmwStackLinks()) at the Stack's opening camera (Tilt), on the plan's M4
// z → z² → w₁² − 1 with the disc |w − 0.5 − 0.5i| < 0.2 on w₂ and the floor on z:
//  - three levels, z, w₁ and w₂, at heights 0, ½ and 1, with 4, 2 and 1 pieces; the floor's pieces are the tubes' and
//    the card's (Pieces.count's);
//  - each w₁ piece holds two z pieces, and the disc both w₁ pieces: every root of the centre on z maps by z² into a root
//    of its parent piece, and every root on w₁ maps by w₁² − 1 to the centre;
//  - the middle level w₁ is drawn: its pieces' outlines lie on the preimage of the rim on w₁ (|w² − 1 − c| = r) and are
//    drawn where the level's map at ½ puts them;
//  - the straight connectors meet the middle level: half way up, each floor point of a tube is at its image on w₁, and a
//    pick's strand from a floor point is at its image there; the level is named w₁ beside its frame;
//  - All at once, the glide from z to w₂ passes no plane: two levels, no middle one, the 4 tubes straight to the glass;
//  - [eᶻ, z²], whose first step has infinitely many preimages: no levels, no tubes, and the card says so of step 1;
//    [z + eᶻ, z²], whose first step has no exact inverse: the card says that of step 1;
//  - straight down no middle level is drawn, so the frame is Look down's.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MS = 40000, READY_MS = 60000;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = READY_MS) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const DEG = Math.PI / 180;
const M4 = [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'custom', params: { expr: 'z^2-1' }, on: true }];
const EXPZ = [{ type: 'exp', params: {}, on: true }, { type: 'pown', params: { n: 2 }, on: true }];
const ZEXPZ = [{ type: 'custom', params: { expr: 'z+exp(z)' }, on: true }, { type: 'pown', params: { n: 2 }, on: true }];
const C0 = [0.5, 0.5], R = 0.2;
const TOL = 1e-6;                  // plane units: a root's image on the next level's root, a loop on the rim
const PX = 0.75;                   // css px: a point drawn where the level's map puts it
const hooked = () => ev('typeof __cmwStack === "function"');
const open = async (steps, { c = C0, homAll = false } = {}) => {
  const ns = `chain-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'd', kind: 'disc', c, r: R, stage: 2 }], steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 110 }, homAll };
  await view(1440, 900, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  await ev(`__cmwSelect('d'); 1`);
  await until(`__cmwShapes().selected === 'd' && typeof __cmwLookDown === 'function' && !!__cmwLookDown()`);
  await ev(`__cmwSteps({ surf: 'stack' }); 1`);
  if (await hooked()) await until(`__cmwSteps().surf === 'stack' && !!__cmwStack().drawn && __cmwStack().drawn.marks`, 20000);
  await frames();
};
const drawn = async () => ((await hooked()) ? (await ev('__cmwStack()')).drawn : null);
const flat = async (re, im) => { const [x, y] = await ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`), o = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left, r.top]; })()`); return [x - o[0], y - o[1]]; };
const through = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const sq = ([x, y]) => [x * x - y * y, 2 * x * y];
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const card = () => ev(`(() => { const e = document.querySelector('.ro-card .ro-counts'); return e ? e.textContent : null; })()`);

await open(M4);
ok('the page has the Stack', await hooked(), null);
const d = await drawn(), L = (d && d.levels) || [];
info.levels = L.map((l) => ({ stage: l.stage, up: l.up, pieces: l.pieces.map((P) => ({ parent: P.parent, roots: P.roots.length, ink: P.ink })) }));
ok('M4: three levels, z, w₁ and w₂, at heights 0, ½ and 1', JSON.stringify(L.map((l) => [l.stage, l.up])) === '[[0,0],[1,0.5],[2,1]]', info.levels);
ok('M4: 4, 2 and 1 pieces', JSON.stringify(L.map((l) => l.pieces.length)) === '[4,2,1]', info.levels);
const cardText = await card();
info.card = cardText;
ok('M4: the floor\'s pieces are the tubes\' and the card\'s', L.length === 3 && !!d.tubes && d.tubes.pieces.length === L[0].pieces.length && /\b4 pieces\b/.test(cardText || ''), { tubes: d && d.tubes && d.tubes.pieces.length, card: cardText });
if (L.length === 3) {
  ok('M4: each w₁ piece holds two z pieces, the disc both w₁ pieces', [0, 1].every((j) => L[0].pieces.filter((P) => P.parent === j).length === 2) && L[1].pieces.every((P) => P.parent === 0) && L[2].pieces[0].parent === -1,
    L.map((l) => l.pieces.map((P) => P.parent)));
  const intoW1 = L[0].pieces.every((P) => P.roots.every((z) => L[1].pieces[P.parent].roots.some((w) => dist(sq(z), w) < TOL)));
  const intoC = L[1].pieces.every((P) => P.roots.every((w) => { const v = sq(w); return dist([v[0] - 1, v[1]], C0) < TOL; }));
  ok('M4: every root on z maps by z² into a root of its parent piece, every root on w₁ by w₁² − 1 to the centre', intoW1 && intoC, { intoW1, intoC });
  ok('M4: a tube keeps its colour into the w₁ piece it joins', L[1].pieces.every((P, j) => L[0].pieces.some((Q) => Q.parent === j && Q.ink === P.ink)), info.levels);
}
// the middle level drawn: on the rim's preimage on w₁, where the level's map at ½ puts it
const mid = d && d.mids && d.mids[0];
info.mid = mid && { stage: mid.stage, up: mid.up, pieces: mid.pieces.length };
ok('M4: the middle level w₁ is drawn, at ½, with its 2 pieces', !!d && Array.isArray(d.mids) && d.mids.length === 1 && mid.stage === 1 && mid.up === 0.5 && mid.pieces.length === 2, info.mid);
if (mid) {
  const M = d.floor.map((v, i) => v + 0.5 * (d.glass[i] - v));
  let n = 0, onRim = 0, atPx = 0;
  for (const P of mid.pieces) for (const lp of P.loops) for (const q of lp) {
    n++;
    const v = sq(q.p);
    if (Math.abs(dist([v[0] - 1, v[1]], C0) - R) < 1e-4) onRim++;
    if (dist(through(M, await flat(...q.p)), q.px) <= PX) atPx++;
  }
  ok('M4: the middle level\'s outlines lie on the preimage of the rim on w₁', n > 0 && onRim === n, { n, onRim });
  ok('M4: the middle level\'s outlines are drawn where its map at ½ puts them', n > 0 && atPx === n, { n, atPx });
}
// the straight connectors meet the middle level: half way up, each floor point is at its image on w₁ (z²)
const ln = await ev('typeof __cmwStackLinks === "function" ? __cmwStackLinks({ links: "straight" }) : null');
let lN = 0, lAt = 0;
if (ln && ln.data) for (const P of ln.data.pieces) for (const lev of P.loops) for (let i = 0; i < lev[0].length; i += 8) { lN++; if (dist(lev[ln.n / 2][i], sq(lev[0][i])) < TOL) lAt++; }
ok('M4: half way up, each tube\'s floor point is at its image on w₁', lN > 0 && lAt === lN, { lN, lAt });
// the middle level's name, beside its frame, inside the pane
const pw = await ev(`document.getElementById('overlayL').getBoundingClientRect().width`), ph = await ev(`document.getElementById('overlayL').getBoundingClientRect().height`);
ok('M4: the middle level is named w₁, beside its frame, inside the pane', !!mid && !!mid.name && mid.name.text === 'w₁' && mid.name.box[0] >= 0 && mid.name.box[1] >= 0 && mid.name.box[2] <= pw && mid.name.box[3] <= ph, mid && mid.name);
// a pick's strand rises along the straight connector: half way up, at the point's image on w₁
if (L.length === 3) {
  const z = L[0].pieces[0].roots[0], st = await ev(`typeof __cmwStackLinks === 'function' ? __cmwStackLinks({ flat: [${z[0]}, ${z[1]}, ${C0[0]}, ${C0[1]}] }).flat : null`);
  const half = st && st.find((q) => Math.abs(q[2] - 0.5) < 1e-9), want = await flat(...sq(z));
  info.pick = { z, n: st && st.length, half, want };
  ok('M4: a pick\'s strand passes the point\'s image on w₁ half way up', !!half && dist(half, want) <= PX, info.pick);
}
// straight down: no middle level
if (await hooked()) {
  await ev(`__cmwCam('L', { yaw: 0, pitch: ${90 * DEG} }); 1`);
  await until(`(() => { const d = __cmwStack().drawn; return !!d && d.camera.pitch >= ${90 * DEG} - 1e-9; })()`, 10000);
}
const top = await drawn();
ok('straight down no middle level is drawn', !!top && Array.isArray(top.mids) && top.mids.length === 0, top && top.mids);

// All at once: no plane between z and w₂
await open(M4, { homAll: true });
const a = await drawn(), aL = (a && a.levels) || [];
info.all = { levels: aL.map((l) => [l.stage, l.up, l.pieces.length]), mids: a && a.mids && a.mids.length, tubes: a && a.tubes && a.tubes.pieces.length };
ok('All at once: two levels, z and w₂, the 4 floor pieces each in the disc', JSON.stringify(aL.map((l) => [l.stage, l.up, l.pieces.length])) === '[[0,0,4],[2,1,1]]' && aL[0].pieces.every((P) => P.parent === 0), info.all);
ok('All at once: no middle level, the 4 tubes', !!a && Array.isArray(a.mids) && a.mids.length === 0 && !!a.tubes && a.tubes.pieces.length === 4, info.all);

// a step with no exact inverse: no levels, no tubes, and the card names it
await open(EXPZ, { c: [1, 0.5] });
const x = await drawn(), xCard = await card();
info.exp = { levels: x && x.levels, why: x && x.why, tubes: x && x.tubes, card: xCard };
ok('[eᶻ, z²]: no levels and no tubes, with the reason', !!x && Array.isArray(x.levels) && x.levels.length === 0 && typeof x.why === 'string' && x.tubes === null, info.exp);
ok('[eᶻ, z²]: the card says step 1 has infinitely many preimages', /step 1 \(f₁\) has infinitely many preimages/.test(xCard || ''), xCard);
await open(ZEXPZ, { c: [1, 0.5] });
const yCard = await card();
info.zexp = yCard;
ok('[z + eᶻ, z²]: the card says step 1 has no exact inverse', /step 1 \(f₁\) has no exact inverse/.test(yCard || ''), yCard);

const errs = (await logs()).filter((e) => (e.t === 'EXC' || e.t === 'error' || e.t === 'log-error') && !/Failed to load resource|favicon/.test(e.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info, n: pass + fails.length };
