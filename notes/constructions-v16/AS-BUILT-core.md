# Constructions v16: CORE as built

Built in `work/xvc` (a copy of v15.1) on 2026-10-24, about 3 hours. This is the model part of `SPEC.md` (rev 2,
§20 CORE). There are no new strings: undefined reasons are codes. The interface (snapping, tools, rows, the
Inspector, menus, toasts, Russian, the tour) is INTERFACE's job and builds on the API below.

## Files

| File | Change |
|---|---|
| `src/constr.js` (new, 1715 lines) | Part 1 is the PoC, kept whole. Part 2 holds refs, step ids, pieces, meets, gliders, the graph, recompute, validate, plans and the M(ℝ) sampler. No DOM. `window.Constr` / `module.exports`. |
| `src/construct.js` (new, stub) | `Construct.init(api)` and `Construct.on(type, data)`, which records the last 50 events. INTERFACE replaces it. |
| `src/region.js` | `formOf`, `formLevel`. `levelOf` uses the form for gcircle areas. `curvesOf` and `sampleCurve` use M(ℝ) for huge circles and gcircles (r > 50 × window diagonal). Adds a `clipPrimitive`/`shapeClip` piece `'g'`. `capOf` uses the form. |
| `src/inverse.js` | `kindLevel` evaluates the form relative to `o`. Adds a Λ rule for gcircle discs: through 0 by incidence, the tangent half-plane. |
| `src/gl.js` | Adds `TKIND` gdisc 8 and gcurve 20 (`gKind`, `packForm`). Adds GLSL `areaLevel` 8, `curveNear` 20, `ixKindLevel` 8, the kind-8 Λ rule and the `ixClipPiece` type 4 (`'g'`). `packPrim` packs `'g'`. thru0 comes from `_g.thru0`. Adds `GLR.setFormAnchor(xy)` (re-anchoring), `GLR.packShape` and `GLR.TKIND`. |
| `src/app.js` | One `cm` block next to `bindsAll` (functions `cmOn`, `cmEnv`, `cmEmit`, `cmSync`, `cmChain`, `cmShapes`, `cmLoad`, `cmDeletePlan`, `cmZeroRemoved`, `cmApi`), plus one guarded line in each of: `applyBinds` (two owners), `shapesChanged`, `targetsChanged`, `chainChanged`, `zpRemove`, `sanitizeState` (keeps `uid`/`zpIds`, then `cmLoad`), `deleteShape`, `sceneMeta`, init (`Construct.init`). The test hook `__cmwC` is inside the TEMP-DEBUG-HOOK block. |
| `build.py` (xvc) | Loads `constr.js` after `region.js` and `construct.js` after `planemenu.js`. |
| `test/t_constr.js`, `test/constr_core_tests.js` | The 66 + 18 PoC tests and 54 CORE tests. |

## Data (SPEC §1)

- `s.at = {key: ref}`: bound handles. Position keys are `p a b m c vN`. Radius keys `r r1 r2` set r = |pt − c| and are not
  clamped (§1.1 [C15]).
- `s.def = {op, args, ...}`. The ops are `circle3` (`fill: 'none'|'in'`, `flip`), `meet` (`index: 0|1|'finite'`, `seed`),
  `glider` (`args: [curve]`; **t is stored at `s.t`**, so v15's `bind.t = 'a'` works unchanged), `midpoint` and
  `bisector`.
- Refs: `{s}`, `{s, h}`, `{zp: uid, kind, id, i}`, `{inf: 1}`, `{s, part}` (curves) and `{img: id}` (targets only).
- Fields written by CORE: the concrete geometry, `cundef {code, args}`, `cHid`, the runtime `_g`, `_atInf` and `_note`
  (`'parallel'`), and on steps `uid` (`'f'+n`) and `zpIds {zeros, poles}` (`'q'+n`, from `S.nextId`).
- Reason codes: `coincide`, `coincide3`, `nomeet`, `argUndef {x}`, `lineInf`, `zpNotF1 {mark, f}`, `zpRemoved {mark}` and
  `stepRemoved {mark}`, with `mark = {kind, i, step}`. **New, not in §3.1:** `tRange {t}` (a glider's t is outside a
  bounded piece) and `handleInf {key}` (a non-line handle bound to ∞). INTERFACE needs strings for these two.
- `flip` is decided by the first recompute when it is missing: the disc, whatever the tap order (§2.3).

## API (SPEC §20.2)

`Constr` (pure). Points are `[x, y]`; ∞ is `Constr.INF`:

```js
Constr.orient(p, q, r); Constr.formOf(s); Constr.formOfFields(s); Constr.level(G, z) // [f, fx, fy]
Constr.reanchor(G, z0); Constr.mob3(p, q, r) // {map, inv}; Constr.mR(G, tau); Constr.sampleMR(G, win, step)
Constr.pieces(shape, env)            // [{part, kind: 'line'|'circle'|'traced', G, a, b, lo, hi, c, r, a0, span, closed, period, poly}]
Constr.meets(pa, pb)                 // pieces: [{z | INF, index: 0|1|'finite'}]; forms (PoC): [z0, z1]
Constr.meetNear(pa, pb, z, box)      // {z, index} | {z, seed} | null
Constr.project(piece, z)             // {t, z} | {seed, z};  Constr.glide(piece, t, pts3?)
Constr.resolve(state, ref, plane, env)   // {z} | {inf: true} | {undef: {code, args}}
Constr.graph(state)                  // {order, cyclic, users(id), sources(id), roots(id), excluded(id, key?), has(id)}
Constr.recompute(state, changed, env)    // {ids, kindChanged, undefChanged, order}; changed {all} | {shapes, zp, zpAny, chain}
Constr.validate(state, env)          // {freed}: refs, types, cycles, fallbacks [C29]
Constr.syncSteps(state, env); Constr.zpRemoveId(step, kind, i)
Constr.deletePlan(state, ids)        // {del, freed: [{id, key}], undef: []}; Constr.applyFreed(state, freed)
Constr.zeroRemovePlan(state, zref)   // {undef, freed}
Constr.moveRoots(state, id)          // [free point ids] (list order) | null
Constr.describe(state, id)           // {op, args, at, fill, flip, index, family, t, inf, undef, note}
```

`env = {zp(st, kind, i), zpAll(st, kind), F(z), trace(s)}`. The app's version is `cmEnv()`.

`cm` (`Construct.init({cm})`): `create(shapes, {target, select}) → ids`, `bind(id, key, ref, {live})`, `unbind`,
`setDef(id, {fill, flip, index, t, seed, def, live})`, `makeFree`, `moved(changed, {live})`, `end()`, `remove(ids) →
plan`, `state(id)`, `describe`, `graph`, `env`. Calls outside a gesture commit one undo step. Between
`moved({live: true})` and `end()`, nothing commits.

Events sent to `Construct.on`: `'recomputed'`, `'deleted'`, `'zpRemoved'`, `'loadFreed'`.

## How recompute is driven

`shapesChanged` and `targetsChanged` start with a full recompute. It is O(nodes), and only shapes whose fields
changed rebuild their meshes, through `shapeKey`. `chainChanged` runs `syncSteps` and then recomputes what is built on
zeros and on F(z₀). So drags, numbers (`applyBinds` → `shapesChanged`), zero drags, undo and load all follow, and
v15's own gestures keep one undo step each. 50 dependent discs take under 1 ms of CPU per recompute (node).

## Tests

- `node test/t_constr.js`: PoC 66/66, bridge 18/18, CORE 54/54. The CORE tests cover:
  - refs and ids: remove, text edit, stripped-state fallback, handles, ∞, image refs;
  - incidence: 4 × 2000 random cases;
  - continuity and exactness: disc → half-plane → complement; sign(A) against the exact predicate in 10⁵ cases;
    level sign against an exact BigInt incircle at r = 1, 1e3, 1e6, 1e9 and a line, and at a view 1e4 away after
    re-anchoring;
  - thru0 and the Λ rule at |z| = e⁻⁷⁰;
  - M(ℝ) sampling at r = 1e9;
  - capOf at A = 1e−15;
  - meets: `'finite'` through parallel, off-segment, meetNear against all pairs, freehand;
  - gliders: wrap on circle3, polygon and circle, tRange, a 1e−6 radius;
  - the graph: order, closure, excluded, moveRoots, cycles, bad refs;
  - plans, save/load (bitwise), the two visibility owners, and speed.
- **All 28 existing node tests:** all pass except `t_tour` (1101/1103). Its 2 failures (`splitOffer`,
  `formula-split` in notes/tour/INTEGRATION.md) also fail on the frozen v15.1 sources, so they are not from this
  round.
- **glsl-test:** 0 failures. **glsl-test-adv:** 304, v14's accepted count. Both test only glsl.js, which is unchanged.
- **Quality suite** (`run.sh --no-build --base-url http://localhost:9202`): 81 runs, 0 failed, PASS. Targets: 259 met.
  Baselines and goldens are untouched.
- **Build:** twice, identical bytes (sha256 5927f3f4…). The published page has no `__cmw`.
- **App smoke** in headless Chrome, 1440 × 900:
  - a disc through 3 points with r = 1.5e7, a circle on ζ₁, a line bound to z₀ and ζ₁, and a meet;
  - a stripped zero ref rebinds to f₁;
  - dragging ζ₁ moves the circle and the line;
  - gdisc and gcurve targets draw in Y and as preimages in X, with no console errors besides the kit's 404.

## Not done (open)

1. **Live-path perf [C3]** is not done: no Y auto-fit skip while live, no off-screen mesh skip.
   `test/constr_core_cmd.js` is not written, so there is no CDP perf gate for 1, 10 and 50 dependents and no per-pixel
   GPU vs CPU readback.
2. **glsl_test rows** for gdisc and gcurve are not added. `glsl_test.js` tests GLChain (glsl.js) only, while the shape
   GLSL is in gl.js, so the right place is `glsl_inverse_test.js`'s clip and walk sections. The GLSL inverse parity
   test (`glsl_inverse_cmd.js`) was not run this round.
3. **Re-anchoring per view** works in gl.js (`GLR.setFormAnchor`), but the app does not call it yet. Forms are packed
   at their own anchor, the first defining point. It needs one line before `GLR.packShapes`:
   `GLR.setFormAnchor([V.left.cx, V.left.cy])`.
4. **Formula-curve meets** use a polyline crossing on `env.trace`'s fixed window (−8…8), with no Newton step.
5. **Not touched:**
   - zero swap (v15.1 has no swap action);
   - the tour's step copies;
   - `duplicateStep` (`syncSteps` gives the copy a fresh uid);
   - INTERFACE's delete toast: `deleteShape` applies the plan but keeps v15's toast.

## Smoke-check files

`work/xvc/test/core_cdp/shots/` holds `core_x_y.png` and `core_targets.png`. Daemon, server and Chrome profiles are
stopped and deleted.
