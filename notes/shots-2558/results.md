# The degree cap (NEWT_POLY_MAX = 12): pictures and checks for #2558

Integration 54e5c2826, lavapipe, 1200 × 800 at 1×, the steps view's Plane, Everywhere.
- **The scenes:** a rational formula `(z^d+z)/(z^2+2)` for d = 13 and 16, over a disc, at 90 px a unit.
- **The frames:** the glide z → w₁ at u = ¼, ½ and ¾ (`__cmwSteps({ x: u })`), the left pane alone.

Two runs, the same scenes:
- **`*-mesh.png`, today:** the cap is 12. These glides plan as a Newton op with neither seeds nor every root, so their frames are the carried mesh (record: path `mesh`, "Everywhere under a Newton inverse with neither seeds nor every root").
- **`*-exact.png`, with the cap raised to 24** (a local patch, not committed): the frames are the inverse pass, ops AFF·RAT13·AFF and AFF·RAT16·AFF (every root by Aberth's iteration). Each frame took 1.5–2.3 s on lavapipe after the first, 6.5–6.7 s for the first (its link included).

| d | u | today (mesh) | cap raised (exact) |
|---|---|---|---|
| 13 | ¼ | `deg13-u0.25-mesh.png` | `deg13-u0.25-exact.png` |
| 13 | ½ | `deg13-u0.5-mesh.png` | `deg13-u0.5-exact.png` |
| 13 | ¾ | `deg13-u0.75-mesh.png` | `deg13-u0.75-exact.png` |
| 16 | ¼ | `deg16-u0.25-mesh.png` | `deg16-u0.25-exact.png` |
| 16 | ½ | `deg16-u0.5-mesh.png` | `deg16-u0.5-exact.png` |
| 16 | ¾ | `deg16-u0.75-mesh.png` | `deg16-u0.75-exact.png` |

What you see: the mesh frames are faceted (polygon patches and torn edges in the outer bands, where the mesh's cells stretch), and the exact frames are smooth everywhere.

## The three checks, with the cap raised
1. **The pictures are right at degree 16.** `steps_glide_look`'s bar, with a temporary case "rational of degree 16, Everywhere" at 270 px a unit, its ends at 2e-6:
   - at u = ¼, ½ and ¾, 0 pixels more than 3 levels off the exact picture (3,764, 2,498 and 1,970 compared; at most 2 levels apart);
   - both ends 0 over (151,135 and 425,483 pixels);
   - path `inverse`, ops AFF·RAT16·AFF.
2. **Aberth converges.** The CPU op (`InvOps.opRatN`, float64) at 200 points w with |w| from e^−2 to e^2, against numpy's roots of p − w q:
   - d = 13, 16 and 24: all d roots returned at 200 of 200 w;
   - no reference root missed;
   - the worst relative distance is 2.0e-15, 1.9e-15 and 2.7e-15.

   On the GPU (float32, fixed iterations), check 1 is the evidence.
3. **Unit with the cap raised:** 144 of 148 files pass. The 4 that fail are rows that encode the cap itself, so they would change with it, not numerical failures:
   - `t_inverse.js`: "ineligible rational" (degree 13) and "ineligible custom" (z¹² + 1/z);
   - `t_inverse_rational.js`: the eligibility table expects degree 13 and 17 to be refused;
   - `t_point_pre_poly.js`: "z¹³ + z: not exact";
   - `t_zp.js`: "degree 13 with poles: forward".

## Cost (measured earlier, the same patch, lavapipe, at u = 0.5, the next frame after the first)

| step | first frame (link included) | next frame |
|---|---|---|
| poly, degree 12 | 5.7 s | 0.85 s |
| poly, degree 16 | 17.7 s | 6.6 s |
| poly, degree 24 | 110 s | 97 s |
| rational, degree 12 | 4.3 s | 1.7 s |
| rational, degree 16 | 6.4 s | 2.1 s |
| rational, degree 24 | 12.2 s | 5.2 s |

The program barely grows: 11.2k characters and 8 uniform slots at degree 12; 11.6k and 10 at 16; 12.5k and 14 at 24. Polynomials (Aberth over every root at every pixel) slow down steeply past 12; rationals slow mildly.
