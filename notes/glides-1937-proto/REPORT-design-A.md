# Design A: one program per plane (closed-form, op-parametrised glides), #1937
(Saved by the coordinator from designer A's final message; the designer's own write was blocked.)

**In one line.** Each step gets a λ-skeleton: a fixed set of op kinds whose parameters vary with λ (uniforms). λ = 1 is the step itself, λ → 0 the identity. Every plane past the colour plane and every glide is drawn by these skeletons.
- The chain has **one inverse program** (the program already selects its steps by `uIxA/uIxB`).
- The glide into plane b is plane b's program with λ_b = u.
- Newton is replaced by closed forms where they exist (cubic, cos).

**What it does not do.** A glide frame does not get cheaper. The per-pixel inverse walk stays 3–4× a rest frame on lavapipe and 20–40× on SwiftShader. ζ, Γ, degree ≥ 5 and series stay on Newton or the carried mesh.

## Key table
REAL renders from the app: 1200×800, Everywhere, colour plane = the last plane.
- "today" is the pristine integration head a6463d4b (`design-A/base`); "A" is the patched worktree (`prototype.diff`).
- Lavapipe rows ran back to back under the lock at load about 2 (tags B2/A2); the other rows come from the batch at load 5–8.
- ms = `__cmwTime` of the left pane, median over the held frames.
- pop = u = .999 vs rest1; peak = u = .5 vs .5556; both frac32 (share of pixels more than 32/255 apart).
- unreal = held_frames `judge`, maximum over u.
- "worst frame at a new u" = the slowest of 8 frames, each at a new u (fresh plan, link on first use).

| case | ops: today → A | lvp glide ms, today → A (rest 13–16) | SS glide ms, today → A (rest 40–95) | worst frame at a new u, lvp | peak | pop | unreal |
|---|---|---|---|---|---|---|---|
| z² | glide ROOTPOW in both; rest IPOW → ROOTPOW | 47 → 56* | 2055 → 3019* | 57 → 80 | .139 | .000 | 0 |
| z³−2z+1 | NEWT^3 + roots pass → AFF·CUB·AFF | **73 → 62** | 1875 → 1709 | 86 → 68 | .281 | .000 | .08 (judge's seeds; frames pixel-identical) |
| Joukowski | MOB·ROOTPOW·MOB with tracked key → same ops, closed-form key | 51 → 117* | 1956 → 1748 | 66 → 201* | .079 | .000 | .026 |
| exp | AFF·EXP·AFF (rest EXP → skeleton) | 57 → 85* | 1308 → 1077 | 71 → 175* | .393 | .000 | 0 |
| tan | AFF·TAN·AFF (rest TAN → skeleton) | 97 → 144* | 2349 → 1803 | 100 → 205* | .577 | .049 | 0 |
| z⁻² | ROOTPOW then IPOW·MOB (2 programs) → ROOTPOW·MOB (1 program) | 42 → 52 | 842 → 1754 | **314 → 62** | .677 | .014 | 0 |
| Möbius | MOB | 33 → 52* | 390 → 315 | 35 → 89* | .227 | .003 | 0 |
| cos | **NEWT, drawn by the carried mesh** → AFF·SIN·AFF (inverse pass) | **293 → 95** | **2698 → 1947** | 405 → 142 | .545 → .655 | .001 | – → .002 |
| Γ, ζ | NEWT → carried mesh (A does not change them) | Γ 151–351, ζ 339–861 | ζ several s | – | Γ .70, ζ .25 | Γ .005, ζ .018 | n/a |

\* The two sides come from different sessions; A's ran at load 6–8. The ops are identical, so the gap is load, not the design. At equal load (B2/A2), z² is 47 against 56.

**Measured:** all ms figures, image metrics and program counts. **Designed only:** the quartic, Box–Cox log, bypass and All-at-once rows. The quartic is checked in float32 emulation only.

**After the colour plane** (T = z, so plane 1 at rest is drawn by the inverse pass; lavapipe, tags BT0/AT0):

| case | arrival pop, today → A | rest1 ms, today → A | first glide frame wait (link), today → A |
|---|---|---|---|
| z² | .001 → .001 | 39 → 51 | 681 → **63** ms |
| Joukowski | **.005 → .000** | 35 → 53 | 623 → **63** |
| tan | .000 → .000 | 106 → 137 | 573 → **81** |
| z⁻² | .008 → .008 | 35 → 55 | 453 → **64** |
| cubic | .000 → .000 | 77 → 85 | 165 → **114** |

- **Same picture at rest:** A's ROOTPOW-based skeletons draw the rest plane within 2/255 of today's IPOW/JOUK/TAN.
- **Rest costs more:** 1.1–1.6×, because a log-family ROOTPOW and extra AFF ops replace a finite op.
- **No link wait on the first glide frame:** the glide's program is the one the plane at rest already linked.

**Programs per chain** (node, `Inverse.inverseKey` over the planes at rest and the glides at u ∈ {.001, ¼, ½, ¾, .999}, `work/progs.js`):
- z²›exp›tan›z⁻²›Jouk›Möb: 8 → **1**.
- cubic›cos›z³›sin: 5 → **1**.
- z²›ζ›log: 4 → 2 (log still switches between LOG and ROOTPOW·AFF; a Box–Cox op would make it 1).

Lavapipe and SwiftShader link synchronously, so each extra program costs a 0.4–0.7 s hitch on its first frame (z⁻² today: 314 ms at u = .5 while IPOW·MOB links).

## 1. The design
**λ-skeleton per step.** `Inverse.homOps(b, λ)` has fixed op kinds for λ ∈ (0,1]. `homOps(b,1)` replaces `stepOps(b)` for every picture the inverse pass draws, rest planes included. The glide into b sets λ_b = u and every other step λ = 1.

**Frame.** One inverse pass per pixel, as today: the same GLSL walker and members. Only the program and the uniforms differ; one program serves every plane past T and every glide.

**Sheet key.** `Inverse.keySing` of the λ-plan, in closed form per frame (each op's poles pulled back), with two additions:
- a pole of order k is listed k times, so simple poles that merge at λ = 1 keep the key continuous;
- an op can mark a pole `keyless` when it cancels inside the skeleton (the Cayley pole at −1 in Joukowski's).

Pole tracks (`svPoleTracks`, the `svTracksMissing` holds) are then needed only for NEWT ops.

| step type | λ-skeleton (glide and rest) | status |
|---|---|---|
| Möbius / affine | MOB, one-parameter group at λ | as today |
| zⁿ, n > 0 | ROOTPOW(1+(n−1)λ); rest ROOTPOW(n) | built |
| z⁻ⁿ | ROOTPOW(s(λ))·MOB(M(λ)): today's two phases in one program (MOB = id for λ ≤ ½, s held at n after) | built |
| root, powa | ROOTPOW | as today |
| exp | AFF·EXP·AFF, rest at λ = 1; needs an EXPL op with clog1p below λ ≈ 1e-4 (float32 error ≈ 6e-8/λ) | built; EXPL designed |
| log | today ROOTPOW·AFF, switching to LOG at u > 1−1e-6; A: one BOXCOX op (w^μ−1)/μ+μ via log1p, μ → 0 limit = LOG | designed |
| sin, tan, sinh, tanh, arc* (zoom about 0) | AFF·f·AFF zoom, rest included | built (rest) |
| **cos** | AFF·SIN·AFF: NatPaths' zoom about π/2, H = (1−λ)π/2 + e^{iπλ} sin(λ(z−π/2))/λ; today NEWT, drawn by the mesh | **built** |
| cosh, arccos, arcosh | AFF·COSH·AFF about arsinh 1; AFF·ASIN·AFF; AFF·ACOSH·AFF about √2 | designed |
| Joukowski | MOB·ROOTPOW(1+λ)·MOB, key in closed form (no tracks); rest the same at λ = 1 | built |
| polynomial, degree 2 | QUAD, zoom AFF·QUAD·AFF | as today |
| **polynomial, degree 3** | AFF·**CUB**·AFF: Cardano on the depressed cubic, cube root of the larger-modulus sum, cofactor −p/3S, then 2 Newton polish steps | **built** (CPU + GLSL) |
| polynomial degree 4; rational degree 3–4 (z³+1/z → u⁴ − wu + 1) | QRT / RAT3 / RAT4: Ferrari through CUB, two stable quadratics, polish; float32 emulation over 32k roots: max error 1.7e-7·(1+\|z\|), none above 1e-4 | emulated |
| degree ≥ 5, rational ≥ 5, series, recurrence, Böttcher, dh, ζ, Γ | **no closed form**: NEWT at t = λ, the same program at rest (t = 1) and moving; cost and mesh fallback unchanged | not simple |
| recognised chains | the sub-steps' skeletons concatenated, λ_i = clamp(nu − i); needs a **bypass** uniform per op group (λ = 0 → identity, one member) | designed |
| All at once | every λ_k on its own schedule in the same program; exact inverse frames instead of the mode-3 mesh (#1771) | designed |
| d/dz | not covered; the generic case keeps today's cross-fade, which blends colours (against the hard rule) | gap |

### Where it is NOT simple, continuous or faithful
1. **Cost.** A glide frame is still the inverse walk.
   - Lavapipe: 3–4× a rest frame (z² 47–56 ms against 12–16).
   - SwiftShader: 20–40× (z² 2–3 s against 66–98 ms); the frame drawn without the inverse pass shows the walk is about 95 % of it.
   - A only removes Newton (cubic −16 %, cos −68 % on lavapipe) and the link hitches. Nothing reaches 60 fps on SwiftShader.
2. **Hard steps.** ζ, Γ, degree ≥ 5 and series keep Newton; today they draw with the carried mesh (Γ peak .70, departure 13 %).
3. **Even maps** (cos, cosh, even polynomials, and z⁻² if both parts move at once):
   - at rest, mirror-pair points tie and the tie rule (larger Im) picks the front;
   - the glide breaks the symmetry, so the front as λ → 1 follows the path, not the tie rule;
   - CPU twin (`work/keycont.js`), after the colour plane at u = .999: the front differs on 36 % of the grid for cos (82 % today with Newton) and 5.8 % for simultaneous z⁻² (hence A keeps z⁻²'s two phases: 0 %);
   - this shows only after the colour plane or with layers: on a coloured plane every member at u = 1 has the same colour.
4. **u → 0⁺ with layers.** For λ > 0 the homotopy is not one-to-one (lattice copies at 2πi/λ, extra roots near infinity). These far points show behind the front at the Opacity slider; at opacity 1 they are invisible.
5. **Small λ in float32.** Error ≈ 6e-8/λ, about 0.1–0.2 px at the first 60 fps frame (λ ≈ 2.5e-5). Scrubbing closer to 0 needs log1p/expm1 forms and the bypass.
6. **The z² seam** along the image of the power path's cut is unchanged. Both members have equal |z|, so the tie rule puts the seam on a ray that turns with s; it is continuous in u and fades as s → 2 on coloured planes.
7. **Rest after the colour plane** costs 1.1–1.6× more (ROOTPOW and extra AFF ops in place of IPOW, TAN or JOUK).

## 2. Strips (all REAL, lavapipe, u = 0, ¼, ½, ¾, 1, in design-A/)
- `strip-z2.png`, `strip-cubic.png`, `strip-jouk.png`, `strip-exp.png`, `strip-tan.png`, `strip-negpow.png`, `strip-mob.png`, `strip-cos.png`: a "today" row and a "design A" row.
  - Where the ops are the same, A's frames are pixel-identical to today's.
  - The cubic's closed-form frames match today's Newton frames to within 1/255 at every u.
  - cos changes from the carried mesh to an exact inverse.
- `strip-negpow-variants.png`: today, A with today's two phases, and A with both parts at once (rejected).
- `strip-T0-jouk.png`, `strip-T0-tan.png`: planes after the colour plane.
- `strip-gamma.png`: the coordinator's baseline frames; A does not change Γ.

## 3. Build plan (PR-sized)
1. **Closed-form cubic (CUB), plus RAT3.** Size S–M.
   - `src/invops.js`: opCub; polyOps and ratOps for degree 3.
   - `src/glsl.js`: CUB in IX_SLOTS, IX_FIN, the op functions and the uniform values.
   - `src/inverse.js`: opDisc.
   - Parity in `test/glsl_inverse_test.js`.
   - Retires NEWT^3, its roots pass and the track holds for cubics.
2. **QRT / RAT4** (Ferrari via CUB): a closed form for z³+1/z and every quartic. Size M.
3. **cos / cosh / arccos / arcosh zooms** in `homOps`; retires cos's Newton and mesh. Size S.
4. **One program per chain.** Size M–L.
   - `homOps(b,1)` at rest: `invOneSkeleton` in `03-exact-images.js`, the rest branch of `svInvPaths`, and smKeyOf/svSheetKey from the same plan.
   - z⁻ⁿ in one program; the `keyless` Cayley pole; pole multiplicity in `keySing`; `svSheetKeyAt` = keySing(plan_λ) unless NEWT.
   - Retires `glideKey`, the IPOW↔ROOTPOW and z⁻ⁿ program switches, and pole tracks for closed-form glides.
   - Fixes #1879's key (the glide record's and the mesh's; the inverse frames already used the plan's key) and Joukowski's arrival pop after the colour plane.
5. **Small-λ ops and bypass:** EXPL (clog1p), BOXCOX (log), a bypass uniform per op group; then recognised chains and All at once run on the one program. Size L.
6. **Browser suite `steps_glide_program`** (in `ci/browser_shards.js`). Every row is red today and green with A.
   - Continuity rows: arrival pop ≤ .002 after the colour plane for z², Joukowski, tan, z⁻², cubic, cos (Joukowski is .005 today).
   - Program row: walking a 4-step closed-form chain links at most 1 inverse program (5 today).
   - No-Newton rows: the cubic and cos glide plans contain no NEWT op and record path 'inverse' (cos is 'mesh' today).
   - Cost row: the cubic glide costs at most 1.1× the z² glide on lavapipe in the same session (1.6× today).

**Risks:** the `keyless` and multiplicity changes touch `singular`/`keySing`, which line and region code also read; rest frames after the colour plane cost more; the one program per chain is bigger, so its first link takes longer; even-map ties remain.

## 4. Open questions for Alexander
1. May planes after the colour plane be drawn by the glide's ops at λ = 1? Same picture (within 2/255), about 1.3× the rest cost, no first-glide link wait (0.5–0.7 s → 0.06–0.1 s on lavapipe). **Recommend yes.**
2. Should z⁻ⁿ keep today's two-phase motion inside one program, rather than moving both parts at once? **Recommend two phases:** calmer, and the arrival front stays continuous (0 % against 5.8 %).
3. ζ, Γ, degree ≥ 5 and series have no closed-form inverse, so A leaves them on Newton or the mesh. **Recommend adopting A for the closed-form steps and pairing it with whichever other design draws the non-invertible steps cheaply.**
4. Even maps' arrival front after the colour plane: accept the jump (never visible on coloured planes), or break ties at rest by the glide's limit? **Recommend accepting it for now and filing an issue.**
5. Should cos (with cosh, arccos, arcosh) get its exact zoom inverse now, as a small standalone PR? It fixes today's mesh glide (293 → 95 ms, exact colours). **Recommend yes, first.**

## Files (in design-A/)
- `prototype.diff`: 6 files of `src/`, +125/−10.
- `frames/`: raw RGBA and JSON for tags A-lvp/ss, B-lvp/ss, A2/B2-lvp, AT0/BT0-lvp, and A (the both-at-once z⁻² run).
- `work/`: copies of the probes (`zz_glides_probe_cmd.js` with GP_T, GP_FLAGS, GP_SPLIT, GP_MOVE; `zz_glides_links_cmd.js`) and node scripts `keycont.js`, `progs.js`, `visits.js`, `f32roots.js`.
