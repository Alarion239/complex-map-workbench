# Deforming part of the chain: mathematics and pictures

Mathematics and pictures designer, 2026-10-24. Read against v15.1 + the merged paths and recognizer
(`work/xv152-merged-snap/src`), formula-steps/DESIGN.md, sound/AS-BUILT-v152.md, paths-aesthetics/AS-BUILT.md and
constructions-v16/SPEC.md. It uses the interface design's names (`design-ui.md`, same folder): the bracket
`S.homRange = {a, b}` (1-based, inclusive, focus 0 only) and **G_t** for the deformation of the bracketed steps.
The node experiments are in `scratch-math/` (`rangeModel.js` is a working model of §3; `exp1`–`exp5` are the
examples of §10).

The user writes F = f1 ∘ f2 ∘ f3 with f3 acting first. Below, as in the app, f₁ acts first: w_k = f_k(w_{k−1}),
F = fₙ ∘ … ∘ f₁.

## 0. Decisions in short

1. **The homotopy.** For a bracket a…b: pre P = f_{a−1} ∘ … ∘ f₁, post Q = fₙ ∘ … ∘ f_{b+1}, and
   **H_t = Q ∘ G_t ∘ P**. G_t is today's deformation of the bracketed steps (one after another on [0, m], or all at
   once on [0, 1]). H₀ = Q ∘ P and H_end = F, **bit for bit** on the CPU (§3).
2. **No new map mode.** Modes 1 and 3 get one more stage, `post` (uniform `uPost`): the steps (b, post] applied in
   full after the homotopy. Mode 1 also carries b (`uB`), so the bracket's steps not yet begun are skipped. A map
   without `post` is today's map, exactly. The pre is already in modes 1 and 3 (`chainRange(s, uBase, …)`).
3. **Exact ends.** G_t is the identity at t ≤ 0 and f at t ≥ 1 for every step, on the CPU (`homF`) and on the GPU
   (`uT <= 0.0` skips the homotopy). Today only some homotopies are exact at their ends (5 of 24 bracket/order cases
   bitwise without this, 24 of 24 with it).
4. **d/dz.** It may sit in the pre (a fixed function of z) or inside the bracket (its straight line, One after
   another, no paths: today's rule). It may not sit in the post: b ≥ the last active d/dz.
5. **Pictures.** The merged plane shows the start H₀(X) = Q(P(X)) as an outline (today's focused-step start), the
   moving image H_t(X), the end F(X) dotted while t < end, and the paths from H₀(z) (ring) to F(z) (dot). Phase,
   Landscape and the globes paint H_t over z. Nothing else changes.
6. **Seams.** The images of the cuts of the pre and post steps are drawn in the merged plane, dashed as in Y: the
   post's seams stay put; the pre's seams move with H_t. The bracketed steps' seams are not drawn, as today.
7. **Pullbacks: zero and pole tracks** in Phase (plane and globe), off by default, one toggle in the Phase dock.
   They show the zeros and poles of H_t moving over z, and where one leaves or enters through a cut or at ∞.
8. **Speed.** The GPU cost per pixel is never above today's worst frame (the last segment of the whole chain). Every
   CPU addition runs off the frame or is cached per bracket. 60 fps holds with long pre and post chains.

## 1. Terms

- n steps; the bracket a…b, 1 ≤ a ≤ b ≤ n; `lo = a − 1` is the stage the bracket starts from.
- Pre P = G_{0→lo} (stage lo as a function of z; with a d/dz in it, P is that stage's function of z, as today).
- Post Q = G_{b→n} (maps only; §2.3). Bypassed steps are the identity wherever they are.
- The bracket's active steps k₁ < … < k_m. m ≥ 1, or the setting is dropped (design-ui §1).
- **Push-forward** (the user's "(f1∘f2) transforms f3(image)"): a pre, no post: H_t = G_t ∘ P. The picture is the
  image P(X) being deformed.
- **Pullback** (the user's "f2∘f3 transforms under f1", and the first question "from f(z) to f(√z)"): a post, no pre:
  H_t = Q ∘ G_t. Over z, the portrait of Q is pulled back by G_t: arg H_t(z) = arg Q(G_t(z)), and the zeros and poles
  of H_t are G_t⁻¹ of those of Q.
- **Focus k** stays today's: the step alone, deformed after its pre (G_{k−1}) and with no post (Y is w_k). In this
  file's terms it is the bracket k…k with the post cut at k. The bracket is ignored at focus k.

## 2. What H_t is

### 2.1 One after another (t ∈ [0, m])

On segment j (j = ⌊t⌋ clamped to m − 1, s = t − j), with k = k_{j+1}:

  H_t = Q ∘ h_{k,s} ∘ G_{0→k−1},

where G_{0→k−1} = (finished bracketed steps) ∘ P and h_{k,s} is step k's natural homotopy. The bracketed steps not yet
begun (k_{j+2}…) are skipped, not applied. At t = j the segment ends exactly where the next begins (both are
Q ∘ G_{0→k_j}); measured jump across t = 1 for ε = 10⁻⁹: 2·10⁻⁹ to 7·10⁻⁸ (`exp3.js`), i.e. |∂H/∂t|·ε.

### 2.2 All at once (t ∈ [0, 1])

  H_t = Q ∘ h_{k_m,t} ∘ … ∘ h_{k_1,t} ∘ P.

Offered for m ≥ 2 and no d/dz in the bracket (today's rule).

### 2.3 d/dz

- **In the pre:** P = G_lo, a function of z (exact chain rule or circle formula, as `stageF` and `chainStage`). Paths
  exist (H_t is a family of maps of z): the paths are allowed when the bracket itself has no d/dz.
- **In the bracket:** its segment is the straight line from Q(G_{k−1}(z)) to Q(G_k(z)), both functions of z. One after
  another only, no paths (today).
- **After the bracket:** not allowed. A d/dz after the bracket would differentiate the deforming function, so it is
  not a fixed map of w_b that "acts in full". (d/dz of the homotopy is well defined, but it is another feature; the GPU
  would need the circle formula around a homotopy.) The bracket's end moves up to the last active d/dz.

## 3. The CPU function (app.js)

Proven in `scratch-math/rangeModel.js` (24 bracket/order cases over three chains: H₀ = Q ∘ P bitwise, H_end = F
bitwise, `cpuMap(map)` = `morphState().F` bitwise at t = 0.37·end).

```js
// the deformation's range: the steps that deform (lo, b], the stage its plot starts from and p1, the stage it ends at
function morphRange() {
  if (S.focus > 0) return { lo: S.focus - 1, b: S.focus, p1: S.focus, steps: stepActive(S.focus) ? [S.focus] : [] };
  const r = homRangeOk();                          // S.homRange in normal form (design-ui §1, §8), else null
  const lo = r ? r.a - 1 : 0, b = r ? r.b : nSteps();
  return { lo, b, p1: nSteps(), steps: activeSteps().filter((k) => k > lo && k <= b) };
}
// every homotopy is exact at its ends (the identity at t <= 0, f at t >= 1): H_0 = Q o P, H_end = F bit for bit
function homF(k, t) {
  const f = stepFn(k);
  if (t <= 0) return (z) => z;
  if (t >= 1 && f) return f;
  const b = built[k - 1];
  if (b && b.hom) return b.hom(t);
  const g = f || ((z) => z);
  return (z) => { const w = g(z); return C((1 - t) * z.re + t * w.re, (1 - t) * z.im + t * w.im); };
}
function morphState(rel) {
  const { lo, b, p1, steps } = morphRange(), m = steps.length;
  const pb = rel ? leftStage() : 0;                // focus 0: 0 either way
  const live = (() => { for (let k = b + 1; k <= p1; k++) if (stepFn(k)) return true; return false; })();
  const Q = live ? rangeF(b, p1) : null;           // never a d/dz (the bracket rule)
  const wrap = (F) => (Q ? (z) => Q(F(z)) : F);
  const tag = (map) => { if (pb) map.base = pb; if (Q) { map.post = p1; map.b = b; } return map; };
  const key = `${lo}|${b}|${p1}`;
  if (m === 0) return { map: tag({ mode: 0, a: pb, b: lo }), F: wrap(rangeF(pb, lo)), key: `none|${pb}|${key}`, label: … };
  if (allAtOnce()) {
    const t = clamp01(morph.T), F0 = rangeF(pb, lo), Hs = steps.map((k) => homF(k, t));
    return { map: tag({ mode: 3, a: lo, b, t }), F: wrap((z) => { let w = F0(z); for (const H of Hs) w = H(w); return w; }),
      key: `all|${pb}|${key}|${t}`, label: … };
  }
  const T = clamp(morph.T, 0, m), j = Math.min(m - 1, Math.floor(T)), t = T - j, k = steps[j];
  const Fprev = rangeF(pb, k - 1);
  const inner = isDeriv(k) ? lerpF(Fprev, rangeF(pb, k), t) : ((Ht) => (z) => Ht(Fprev(z)))(homF(k, t));
  return { map: tag({ mode: 1, hi: k, t }), F: wrap(inner), key: `nat|${pb}|${key}|${k}|${t}`, label: … };
}
```

- At the default (no bracket) and at focus k, `Q` is null and `tag` adds nothing: the maps and keys equal today's
  (the key gains `|lo|b|p1`, so caches built before a bracket change are not reused).
- `homView()` adds `{ range: {lo, b, p1}, H0F, H0Map }`: `H0F = wrap(rangeF(pb, lo))` (exact: the bracket is the
  identity at t = 0) and `H0Map = tag({mode: 1, hi: steps[0], t: 0})`.
- `cpuMap(map)` (the GPU twin) applies the post after modes 1 and 3:

```js
const top = mode === 1 ? (map.b || map.hi) : map.b;        // mode 1 without post: map.b is absent
const post = (map.post || 0) > top ? rangeF(top, map.post) : null;
return post ? (z) => post(inner(z)) : inner;
```

  With `top = map.hi` in mode 1 the post would apply the bracket's later steps in full during the segment; the model
  caught this (0 of 6 twin points agreed); hence `b` in the spec.
- `mapKeyOf` (app.js) gains `|${map.post || 0}` and uses `chainSig[max(b, hi, post)]`.
- `morphPrimes` = (lo) + (steps begun) + (p1 − b), indices as today's `S.focus − 1`; equals today's at the default
  and at focus k, and n at the end.

## 4. The GPU map spec (gl.js) and its parity tests

### 4.1 The spec

`{ mode: 1, hi, t, base?, b?, post? }` = G_{b→post} ∘ h_{hi,t} ∘ G_{base→hi−1}
`{ mode: 3, a, b, t, base?, post? }` = G_{b→post} ∘ h_{b,t} ∘ … ∘ h_{a+1,t} ∘ G_{base→a}
Post applies only when post > b. Modes 0 and 2 are unchanged.

```glsl
uniform int uMode; uniform int uA; uniform int uB; uniform int uHi; uniform float uT; uniform int uBase; uniform int uPost;
// the steps after the bracket, in full: (uB, uPost] (maps only: the app's bracket rule); none when uPost <= uB
vec2 postOf(vec2 w) { return uPost > uB ? chainRange(w, uB, uPost) : w; }
vec2 mapPoint(vec2 s) {                                    // MAP_STAGE; MAP_PLAIN the same without the d/dz line
  if (uMode == 1) {
    vec2 z = chainRange(s, uBase, uHi - 1);
    if (chainIsDeriv(uHi)) return postOf(mix(z, chainStage(uHi, s), uT));
    return postOf(uT <= 0.0 ? z : chainHom(uHi, z, uT));
  }
  if (uMode == 2) { … unchanged … }
  if (uMode == 3) { vec2 z = chainRange(s, uBase, uA); return postOf(uT <= 0.0 ? z : chainHomAll(z, uA, uB, uT)); }
  return chainRange(s, uA, uB);
}
```

- `chainRange(w, uB, uPost)` starts at uB ≥ 1, so it is `cxs0_raw` (maps only) when the chain has a d/dz; it already
  returns NaN across a d/dz, which the bracket rule excludes.
- No new program text per chain and no new compile: `chainRange` is already in every program. One branch more.
- The `uT <= 0.0` guard makes H₀ = Q ∘ P on the GPU run exactly the steps' own functions, as F's picture does;
  today some `_h(z, 0)` round (a power through exp(1·log z)). The nodes t = j of one after another become exact the
  same way. For today's maps at t > 0 nothing changes.
- **gl.js:** `use()` uploads `uPost` (`u1i(P, 'uPost', m.post || 0)`); `mapKeyOf` adds `,${m.post || 0}` (the
  landscape's height cache and every cacheKey go through it); `isIdent` takes hi = max(hi, post), else a map whose
  bracketed steps are all off but whose post is live would be drawn as the identity; `mapFor` (an older program while
  a new chain compiles): when the first changed step p+1 ≤ post, draw `{mode: 0, a: base, b: min(lo, p)}` (the start
  of the part the old program has right) for those few frames, as today's rule does for modes 1 and 3.
- `sheetInfo` stays mode 0 only (All sheets is off while the deformation is open, §5.6).

### 4.2 Parity tests

1. **`test/glsl_test.js` (GLChain GPU vs CPU)**: new rows `{mode: 'post', top, post}` after the hom rows: the
   shader computes `chainRange(chainHom(hi, chainRange(z, 0, hi−1), t), b, post)` and, for all at once,
   `chainRange(chainHomAll(chainRange(z, 0, lo), lo, b, t), b, post)`. For every fixture chain with n ≥ 2, every
   bracket a…b obeying the d/dz rule, t ∈ {0, 0.25, 0.5, 0.999, 1}, against the CPU twin. Same tolerance and seam
   exclusions as the existing hom rows. The rows at t = end must equal the mode-0 row (0, n), and the rows at t = 0
   the composition of the pre's and post's `chainStep` rows, to the mode-0 tolerance (they run the same functions).
2. **gl.js level** (new test hook `GLR.evalMap(map, pts)` through `runTF` and the vertex program's `mapPoint`): for
   chain3, sin∘√ and Möbius-log (§10) and every bracket: `evalMap(spec) ≈ cpuMap(spec)` at 64 probes;
   `mapKeyOf` differs for two specs that differ only in post; `isIdent({mode: 1, hi: 1, t: .5, b: 1, post: 3})` is
   false when f₁ is off; `mapFor` with a changed step inside the post does not throw.
3. **Node (`test/t_deform_range.js`, from `rangeModel.js`)**: H₀ = Q ∘ P and H_end = F bitwise; `cpuMap(map)` =
   `morphState().F` bitwise; continuity at every node t = j (jump ≤ 10⁻⁶ at ε = 10⁻⁹); the default and focus-k maps
   deep-equal v15.1's.
4. **Frames (CDP)**: with any bracket, the merged plane at t = end equals the rest Y frame of the same view (0 px off
   by more than 8/255, as formula-steps test 5); with no bracket, frames at t ∈ {0, 0.5, end} equal v15.1's.

## 5. The views

| view | what it shows with a bracket | grey / reference | new marks |
|---|---|---|---|
| X → Y merged plane | H_t(X) in the w-plane (w_n) | outline of H₀(X) = Q(P(X)) over the image, dashed ghost under it; F(X) dotted while t < end | pre and post seams; paths from H₀(z) |
| paths t ↦ H_t(z) | image side, in w | ring at H₀(z) | none (rules of AS-BUILT) |
| Phase (plane) | portrait of H_t over z | X's outline (Outlines on), as today | zero and pole tracks (toggle, off) |
| Phase on the sphere | the same on the z-sphere | as today | the same tracks |
| Landscape | relief of H_t over z | as today | none |
| Y Sphere (images) | H_t(X) on the w-sphere | H₀(X)'s boundary, gray | pre and post seams where the globe draws Y's; paths |
| X Sphere (shapes) | X itself | unchanged | none |
| All sheets | off while the deformation is open | as today | none |

### 5.1 The merged plane (renderMorph)

- **Start.** With a pre or a post, H₀ ≠ id and X is not part of the picture: X lives in the z-plane, the merged plane
  is the w-plane. The start is drawn as a focused step's start is today: no tint; X's outline carried by H₀
  (`drawMorphOutline(pane, X, hv.H0F)`, TH.faint, dashed for an open set) over the image; the start ghost
  (dashed [4, 3]) through `hv.H0Map` under it; the end ghost (dotted [1, 2]) through `stageMap(n)` while t < end.
  With no pre and no post: today's tint and outline, unchanged.
- **Why not a tint of H₀(X).** It would need the forward mesh with a neutral ink (H₀ skips the bracket, so it is not a
  mode-0 map with an exact inverse), cached per bracket. Possible later; then for focus k too, so both starts look
  alike. Not in this build.
- **Image.** `drawScene(pane, ms.map, …)` with the spec of §4: exact per pixel through the forward mesh and its
  fix-ups (at rest), as today for modes 1 and 3.
- **Seams** (new, only when the bracket leaves steps outside it, so the default picture is today's):
  - post step j (b < j ≤ n) with a ray cut: its two banks under f_n ∘ … ∘ f_j, exactly as Y draws them at rest
    (`drawCutBanks`' tail from j). **t-independent**: sampled once per (chain, bracket, view) and cached. The moving
    image tears along these fixed lines when G_t(P(X)) crosses that cut.
  - pre step j (j < a) with a ray cut: the banks under f_{a−1} ∘ … ∘ f_j (cached, t-independent), then under Q ∘ G_t per
    frame. At t = end they are Y's banks of step j.
  - bracketed steps: not drawn (today). Their tear shows in the image; at t = 0 they are the identity and do not tear.
  - Style and legend: TH.cut, dashed [4, 3], 1 px, alpha 0.7; the legend's "image of a cut" row appears with them.
    Light and dark through TH.cut.
- **Auto-fit:** `defKey` includes the bracket; the first fit frames H₀(X) ∪ F(X) (design-ui §5).

### 5.2 The paths t ↦ H_t(z)

- Image side, as today, of `homView().imageF`. Ring at H₀(z) = Q(P(z)) (`pathMarksW` already uses `at(0)`), dot at
  F(z), the moving point H_t(z), arrowheads and step bars of the bracket's steps (t = j − ½ and t = j).
- **Seeds:** chosen on X's boundary and inside X, in z (design-ui), but **spaced at their starts**: the boundary seeds
  every sep/3 px along H₀(∂X) (the polylines drawMorphOutline maps), and the interior candidates on a z-grid of X
  refined (quadtree, at most 4096 candidates) until neighbouring starts H₀(z) are under 12 px apart, then thinned
  farthest-first at 24 px in screen px. Today the seeds are measured on X's outline as drawn with the identity, which
  is wrong as soon as H₀ ≠ id (it already is at focus k > 1). A non-injective P or Q can put two seeds on one start:
  the 34 px start spacing keeps one.
- All AS-BUILT rules hold for the drawn paths (spacing, cuts and poles split runs, chevrons, stability, caps).
- **Speed:** a path is traced once per choice. P(z) is t-independent: compute u = P(z) once per seed and trace
  Q(G_t(u)); on each segment the finished bracketed steps are constant too.
- Available when the bracket has no d/dz (a d/dz in the pre is fine).

### 5.3 Phase: the portrait of H_t over z, and the tracks of its zeros and poles

- The portrait of H_t over the z-plane (`homView().map`, rel = the left plane, z at focus 0). In a pullback it is the
  portrait of Q pulled back by G_t: its colours move with G_t⁻¹. Exact per pixel; the post's cuts appear as seams at
  their true pulled-back place (they are not drawn as lines). Step 1's cut handle (drawCuts in the z-plane) stays as
  today; it is exact during the deformation only when step 1 is in the pre or its homotopy keeps the ray (powers,
  roots, log; the zoom paths of arcsin and the like move their cuts: open item).
- **Tracks** (new). The curves t ↦ ζ(t) of the zeros and poles of H_t in the view. In a pullback they are
  G_t⁻¹(zeros and poles of Q), and they say where a zero leaves or enters through a cut: in sin(z^{1−t/2}) (§10.1)
  the zeros −kπ leave through the cut at t = 0⁺ while kπ moves to k²π².
  - **Computation** (an idle job in ≤ 5 ms slices, like the paths' choice; never in a frame): `zerosPolesTimed(H_t,
    view box + 10 %, {max: 40}, 30 ms)` at 33 times; each solution is continued in t by Newton on H_t with adaptive
    steps (dt ≤ end/200, halved on failure down to 10⁻⁶·end; a step must converge to |H_t| ≤ 10⁻⁹(1 + |H_t′|·|z|) for a
    zero, |1/H_t| for a pole, and move less than 0.5 + 2|z|dt). A track **ends** where the continuation fails: on a cut
    of H_t (the seam test: |H_t(z + δn) − H_t(z − δn)| over 10³ times the step's change, δ = 10⁻⁷(1 + |z|)) it ends
    with a bar across the cut; at the view's edge with a chevron; with |z| → ∞ with a chevron at the edge. A solution
    found at a sample time and reached by no track is continued backwards; where that fails it **enters** (bar or
    chevron, pointing in). Cached per (chain, parameters, bracket, order, view box); a pan or zoom recomputes and
    cross-fades in 150 ms as the paths do.
  - **Marks** (the paths' grammar): ring at t = 0, dot at t = end (only where the track is alive then), one arrowhead
    at the middle of its time, bars where it leaves or enters through a cut. Zeros in TH.ink, poles in TH.pole, 1.4 px
    on a 3.6 px TH.halo at 55 %; a multiple zero is one track (the multiplicity in its row of the figure's caption).
  - **When:** off by default (`S.morphTracks = false`, saved), toggled in the Phase dock (the Paths button's place
    there, key P in Phase). Shown for any bracket, also the default, since zeros move in every deformation.
  - A search cut short (`.incomplete`) draws what it found; the figure caption then says "the zeros and poles found
    in the frame".

### 5.4 Landscape

The relief of H_t over z (`hv.map`); at t = 0 the relief of Q ∘ P. No tracks (the pits and peaks are their heads).
The heights cache keys through `mapKeyOf`, now with post.

### 5.5 The globes

- **Y Sphere** (the images, role R): H_t(X) on the w-sphere through the same spec; H₀(X)'s boundary is the figure's
  "gray: the boundary at t = 0" (already true as written); the paths start at H₀(z); seams of §5.1 if and where the
  globe draws Y's cut banks at rest (it does not today: then none).
- **Phase on the sphere** (X Sphere + Phase): the portrait of H_t on the z-sphere; tracks as §5.3, projected
  (`gScreen`), hidden on the far side with a limb chevron as the globe's paths.
- **X Sphere with the shapes**: X itself, unchanged.

### 5.6 All sheets

Off while the transport is open, as today (`sheets: !hv && …`). Reason: `sheetInfo` describes the sheets of a mode-0
map; the sheets of G_t change with t (z^s has infinitely many for irrational s), so there is no fixed covering to
draw. After the transport closes, the sheets of F come back.

## 6. Labels

- **Plane title** (design-ui §5): `start → w` with start = Q(w_{a−1}), w₀ = z. Same in both languages.
- **Ticks** under the scrubber: the bracket's steps, as today; "f₁ →" before and "→ f₄" after (design-ui §4). Their
  tooltip and the readout's aria text: "H_t = f₄ ∘ G_t ∘ f₁".
- **State label** (`morphState().label`): "step {k} · {name} · t = {t}" as today; all at once: "f₂–f₃ at once · t =
  {t}" when the bracket is not the whole chain.
- **Point labels:** primes = lo + steps begun + (n − b) (§3).
- **Formula notation** (captions, tooltips): H_t = Q ∘ G_t ∘ P with step names, bypassed steps left out, three or more
  written f₆ ∘ ⋯ ∘ f₄. One bracketed step: G_t is that step's homotopy H^{(k)}_t, and the caption may write
  H_t = f₃ ∘ H^{(2)}_t ∘ f₁ directly. All at once: G_t = H^{(b)}_t ∘ ⋯ ∘ H^{(a)}_t. One after another with m ≥ 2:
  G_t runs the steps in turn, G_t = H^{(k_{j+1})}_{t−j} ∘ f_{k_j} ∘ ⋯ ∘ f_{k_1} on j ≤ t ≤ j + 1 (today's phrase
  "H_t = H^{(k)}_{t−k+1} on k−1 ≤ t ≤ k", renamed G and counted from the bracket's first step).

## 7. Export (figure.js) and captions

- `A.homF(T)` and `A.plotFAt(T)` already go through `homView()`: the filmstrip, the paths figure, the globe figure and
  the video follow the bracket. `A.defo()` gains `{range: {a, b} | null, pre: 'f_1', post: 'f_3'}` (TeX, null when
  empty) for the captions. Every place that took the start of a path as z must take `A.homF(0)(z)`: `pathItem`
  already does (mk.z = at(0)); the video's `plan.paths` draws `Hu(z)` from u = 0, so it is right once Hu is H_u.
- Figures draw no cuts today; they draw no seams with a bracket either (open item, for both).
- **Captions**, only when something is outside the bracket (EN, then RU; the RU text keeps a no-break space before
  each em dash, notation by `I18N.notation`):
  - homotopy sentence (`homSentence`): " Here $H_t=%{Q}\circ G_t\circ %{P}$, $0\le t\le %{m}$, deforms $%{QP}$ ($t=0$)
    into %{map} ($t=%{m}$): $%{P}$ acts first and $%{Q}$ last, both in full, and $G_t$ is %{hom}."
    RU « Здесь $H_t=%{Q}\circ G_t\circ %{P}$, $0\le t\le %{m}$, непрерывно деформирует $%{QP}$ ($t=0$) в %{map}
    ($t=%{m}$): $%{P}$ действует первым, $%{Q}$ — последним, оба полностью, а $G_t$ — это %{hom}.» Variants with only
    P ("$%{P}$ acts first, in full" / «$%{P}$ действует первым и полностью») and only Q ("$%{Q}$ acts last, in full" /
    «$%{Q}$ действует последним и полностью»).
  - film: "The deformation $H_t$ from $%{QP}$ ($t=0$) to %{map} ($t=%{m}$), at %{ts}." RU «Деформация $H_t$ от
    $%{QP}$ ($t=0$) до %{map} ($t=%{m}$) при %{ts}.» ("gray: the boundary at t = 0" stays: it is H₀(∂X)).
  - globe: "… from $%{QP}$ ($t=0$) to %{map} …" in the two globe templates, the same way.
  - paths: "from $H_0(z)=%{QPz}$ (circle) to $F(z)$ (dot)", e.g. $H_0(z)=f_3(f_1(z))$; RU «от $H_0(z)=%{QPz}$
    (кружок) до $F(z)$ (точка)».
  - head (morphCaption, design-ui §9): "The image of X under $f_3\circ f_1$ (outlined)".
  - tracks (Phase film, when on): " Curves are the tracks of the zeros (solid) and poles (dashed) of $H_t$ in the
    frame, from $t=0$ (circle) to $t=%{m}$ (dot); a bar marks where one leaves or enters through a branch cut."
    RU « Кривые — траектории нулей (сплошные) и полюсов (штриховые) $H_t$ в кадре: от $t=0$ (кружок) до $t=%{m}$
    (точка); черта отмечает, где траектория уходит за разрез или выходит из-за него.» Print: 0.5 pt on a 1 pt white
    casing, poles dashed 1.5/1 pt (B/W has no red).
  - The 700-character rule holds; the QP text is the short form (§6).

## 8. Sound

- Hear the function (Phase, Landscape, X globe) plays H_t(z) through `sndF = morphState(true).F`: nothing to add. The
  harp follows the pulled-back phase lines as they sweep under a still pointer; a zero track crossing the probe gives
  the rising scale, a seam the cut tick.
- **The merged plane's probe** (src 'merged') reads its point as the start of a path, z, which is only right when
  H₀ = id. With a pre only, read the point as u ∈ w_{a−1} and play G_t(u) (the rel form with base lo; this is what
  focus k does today). With a post, the point is Q(u) and has no single source: the merged probe is silent, as on a
  focused d/dz step; Phase is where H_t is heard.
- The last loop sings W(H_t ∘ γ) for the loop γ in X: with tracks on, its note changes exactly when a zero or pole track
  crosses γ (or a seam does, by the singer's cut rule).
- Keys: `sndFKey` and `sndFrameKey` include `lo|b` (a bracket change is a new function). Slider landmarks and the
  motion bed are relative to `morphLen()`: unchanged.

## 9. Speed at 60 fps

- **GPU per pixel / vertex:** one after another, segment k: (k − 1 maps) + 1 homotopy + (n − b maps) ≤ n − 1 maps +
  1 homotopy = today's last segment of the whole chain. All at once: (a − 1) maps + m homotopies + (n − b) maps ≤
  today's all-at-once over n. So no frame costs more than a frame today can.
- **CPU per frame:** pre seams only: 2 × 100 samples per cut through Q ∘ G_t while playing, 200 at rest, from cached
  pre-tail points (≤ 1 ms with a 10-step post); post seams cached. Paths, tracks and fix-ups are idle jobs (fix-ups
  never run while playing, as today).
- **Test:** `deform_nat_fps_cmd.js` with a 12-step chain (pre 5 heavy steps, bracket 2, post 5; the erf/tan/log chain
  of the sound tests) playing, one after another and all at once, tracks on in Phase: p95 ≤ 18.4 ms and 60 fps, as
  AS-BUILT's runs; the same on a 390 × 844 pane.

## 10. Worked examples (numbers from `scratch-math/`)

### 10.1 From f(z) to f(√z), f = sin (`exp1.js`, `exp2.js`)

Chain f₁ = √z (root 2, cut 180°), f₂ = sin. Bracket 1…1 (a pullback): H_t(z) = sin(z^{1−t/2}), 0 ≤ t ≤ 1; spec
`{mode: 1, hi: 1, t, b: 1, post: 2}`. H₀ = sin z, H₁ = sin √z.

- Merged plane: X (say the rectangle 0 ≤ Re z ≤ 40, |Im z| ≤ 2) outlined at sin(X); the image sin(X^{1−t/2}); sin(√X)
  dotted. No seams (sin has no cut; √'s cut is bracketed). If X crosses the negative real axis, the image tears there
  for t > 0 (√'s seam, not drawn, as today).
- Phase, tracks: zeros of H_t are (kπ)^{1/s}, s = 1 − t/2. For k ≥ 1 they move right: π → 3.70 (t = ¼) → 4.60 (½) →
  6.24 (¾) → π² = 9.87; 2π → 39.48. For k ≤ −1 they sit on the cut at t = 0 and **leave through it at once** (their
  argument π/s > π). The zero at 0 stays (a branch-point zero of order s).
- **With the cut at −90°** the story flips: the negative zeros sweep through the lower half-plane to k²π², and the
  positive ones **leave through the cut at t = 0.4** (s = 4/5), at −i(kπ)^{5/4} = −4.18i and −9.95i (`exp2.js`,
  Newton continuation: |H| ≤ 10⁻⁹ along the tracks). Both end at the zeros k²π² of sin √z: the cut decides which
  zeros of sin get there.
- Bracket 2…2 instead (pre √, the push-forward): H_t = (sin's zoom path)(√z) = sin(t√z)/t, start √X outlined.

### 10.2 F = f₃ ∘ f₂ ∘ f₁ = (C(e^z))², C(w) = (w − 1)/(w + 1) (`exp3.js`, `exp5.js`)

The test scene chain3 (X = [−1.5, 1.5] × [−1.2, 1.2] with a grid). E_t = (e^{tz} − 1)/t + t is exp's zoom path, C^t
the Möbius path of C (elliptic, C⁴ = id, fixed points ±i, a quarter turn at t = 1), p_t(w) = w^{1+t} (principal).

| bracket | H_t | start (outlined) | notes |
|---|---|---|---|
| 1…3 (today) | G_t | X (tinted) | unchanged |
| 1…1 | (C(E_t z))² | C(X)², unbounded: X contains the pole −1 of C | pullback; poles move (below) |
| 2…2 | (C^t(e^z))² | (e^X)² = e^{2X}, an annular sector of angle 4.8 rad | push-forward by C^t, then squared |
| 3…3 | (C(e^z))^{1+t} | C(e^X), a curved quadrilateral in the unit disk | = today's focus-3 image; it tears on (−1, 0) for 0 < t < 1 and heals at 1 |
| 1…2 | (G_t z)² | X² | one after another: E then C^t; or all at once C^t ∘ E_t |
| 2…3 | G_t(e^z) | e^X | the user's "(f1∘f2) transforms f3(image)" |

Tracks for 1…1: the double pole at z = −1 (H₀ = C(z)², pole at −1) runs left along the real axis,
z = log(1 − t − t²)/t (−1.65 at t = 0.3, −2.77 at 0.5, −5.37 at 0.6), and **leaves to −∞ at t = (√5 − 1)/2 = 0.618**; a
pair of double poles comes back from −∞ at Im z = ±π/t and arrives at ±πi at t = 1 (−1.03 ± 3.93i at t = 0.8).
The double zero moves from 1 to 0, z = log(1 + t − t²)/t. Nothing crosses a cut: E_t is entire, so the poles leave and
come back through ∞ (chevrons at the frame's edge). All values checked at |H| ≥ 10¹² next to the poles and |H| ≤ 10⁻²⁸
at the zero (`exp5.js`).

All 12 bracket/order cases: H₀ = Q ∘ P and H_end = F bitwise, twin = morphState bitwise (`exp3.js`).

### 10.3 A Möbius pre with a log post: F = log M, M(z) = (z − i)/(z + i) (`exp4.js`)

M is elliptic of order 3 (i → 0 → −1 → i), with fixed points q = (1 − i)(1 − √3)/2 = −0.366 + 0.366i and
p = 1.366 − 1.366i; its path M^t turns by −120° t about q (multiplier e^{−2πit/3}, measured). X = the upper half-plane.

- **Bracket 1…1 (pullback by log):** H_t = log(M^t z). Start log(X) = the strip 0 < Im w < π; end log(M X) =
  log(unit disk) = {Re w < 0, −π < Im w ≤ π}. The paths are log-images of circular arcs about q and p.
  - **Post seams stay put:** log's banks are the lines Im w = ±π, drawn dashed for every t. For t > 0 the branch
    point M^{−t}(0) is inside X (0.070 + 0.081i at t = 1/8, 0.2 + 0.4i at ½, i at 1), so 0 ∈ M^t(X): H_t(X) runs off to
    the left and tears along both seam lines at once, a sliver appearing at Im w ≈ −π for every t > 0.
  - Phase over z: the portrait of log pulled back by M^t. The zero M^{−t}(1) runs 1 → 1.16 + 0.16i (⅛) → 1.37 + 0.37i
    (¼) → 2 + i (½) → 3.73 + 2.73i (¾) → ∞ at t = 1 (|z| = 117 at 0.99), leaving the view; the logarithmic points
    M^{−t}(0): 0 → i and M^{−t}(∞): ∞ → −i (−1 − 2i at ½) are not zeros or poles, so they have no tracks; the pulled-back
    cut is the circular arc between them (M^{−t} of the negative axis), a seam of the portrait, exact per pixel.
- **Bracket 2…2 (push-forward of M(X) by the log path):** H_t = ((Mz)^{1−t} − 1)/(1 − t) + 1 − t. Start M(X) = the unit
  disk (outlined); end the half-strip. The unit circle e^{iφ} unrolls onto the segment {iφ : −π < φ ≤ π}; the centre
  M(i) = 0 runs left to −∞ (chevron). For t > 0 the disk tears along the radius (−1, 0] (the bracketed step's cut: not
  drawn, the tear shows). M has no cut, so no seams.

## 11. Tests (beyond §4.2 and §9)

1. Node `t_deform_range.js` (§4.2.3) and the examples' numbers: the tracks of §10.1 (both cuts) and §10.2 to 10⁻⁹,
   the exit times 0.4 and 0.618 to 10⁻⁶.
2. CDP `deform_range_cmd.js`: for chain3 and every bracket, at t ∈ {0, ½·end, end}: `homView().map` is the spec of §4;
   the start outline is H₀(∂X) (sampled points within 0.5 px); paths' rings at H₀(z) and dots at F(z) (0 px);
   seams present only with a pre or post cut; tracks (toggle on) match the node numbers within 1 px; a d/dz in the
   post is refused (bracket end moved); the default and focus k: `__cmwState().homView` deep-equals v15.1's.
3. Export: Article B/W and colour, EN and RU, of §10.1 (bracket 1…1) and §10.2 (2…3): captions ≤ 700 characters, the
   new phrases present, preflight 0 failures.
4. Sound: `sound_v152_cmd.js` with bracket 1…1 of §10.1: under a still probe at z = 5 in Phase the harp plays the
   zero passing (π^{1/s} = 5 at s = 0.711, t = 0.578); the merged probe is silent with a post.

## 12. Open items

- A grey tint of H₀(X) (for brackets and focus k alike): needs the forward mesh with a neutral ink, cached.
- Seams of the bracketed steps during the deformation (today none; they would appear at t > 0 and, for an integer
  power, vanish again at t = end).
- The z-plane cut handle of step 1 is exact during the deformation only for ray-keeping homotopies.
- Figures draw no cuts or seams, with or without a bracket.
- d/dz after the bracket (the derivative of the homotopy): mathematically sound, not offered.
- Tracks of logarithmic points (log's 0 and ∞) are not zeros or poles; they are not tracked.
