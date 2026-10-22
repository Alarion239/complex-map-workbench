# inverse-first prototype (design: notes/sphere-design/inverse-first.md)

    node notes/proto/inverse-first/inv.js [case...]   # per-pixel inverse renderer, f64 and f32-emulated, all cases/views
    node notes/proto/inverse-first/fwd.js [case...]   # forward fallback: sphere mesh + image-metric refinement + saturation
    node notes/proto/inverse-first/deepzoom.js        # float32 precision at deep zoom, plain vs anchored first step

common.js: cases (chains, regions, source/image views, exact truth), arithmetic (float64 / float32 by rounding every
operation), the sheet key D(z). Results: out/*_results.txt; renders: out/inv_*.png (pattern + solid), out/fwd_*.png,
out/sph_*.png (spherical checker), out/sphere_checker_sheet.png.
