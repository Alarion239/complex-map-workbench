'use strict';
// GPU renderer (WebGL2). The function chain is compiled to GLSL (GLChain) and evaluated per vertex / per pixel.
// One shared offscreen WebGL2 context renders every view; results are blitted into the pane canvases.
//
// Colors passed in are sRGB floats [r, g, b] in 0..1 (hex strings are accepted too). 2D fills blend in sRGB like
// the rest of the page; 3D surfaces (landscape, sphere) are lit in linear light and encoded back to sRGB.
//
// Map cache (spec 8.1): drawRegion / drawLines with a non-empty st.cacheKey evaluate the chain once per unique
// template point into an RG32F texture (drawn as one-pixel points with EXT_color_buffer_float, else through a
// transform-feedback buffer) that later frames read with texelFetch. Those frames run a shader without the chain:
// panning changes uniforms only. Without a cacheKey (homotopy frames, thumbnails) the same evaluation goes to a
// per-resource scratch texture (tmpEntry), so 2D views need no per-vertex chain program.
//
// Precision: meshes and lines are sent relative to a per-resource origin O (float64 on the CPU); shaders evaluate
// the chain at O + local, with O as a hi/lo float pair, and identity views place the local coordinates directly.
//
// Compiles (spec 8.7): with KHR_parallel_shader_compile, chain programs compile in the background. Until a new
// chain's program is ready, the newest earlier chain whose program is ready keeps drawing (frameStatus().pending),
// and onReady fires when the compile lands. A failed compile is reported by frameStatus().error. Landed programs
// are taken into use one per FRESH_MS (canFinish). Side mode (GLR.side) draws another chain (example thumbnails)
// without touching the current one, its history or their programs.
const GLR = (() => {
  // @parts: src/gl/NN-*.js go here, in order (build.py; test/src_text.js joins them the same way)
})();
