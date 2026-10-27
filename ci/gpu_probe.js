'use strict';
// Which WebGL2 renderer the gate's headless Chrome gets on this machine (the same launcher and flags as the perf
// suite: test/regress/perf/cdp.js). Prints it and adds it to the job summary.
//   node ci/gpu_probe.js [--require-hardware] [--fallback]
// --require-hardware (the self-hosted GPU runners): exit 1 when Chrome renders in software (SwiftShader, WARP, the
//   Microsoft Basic Render Driver, llvmpipe) or has no WebGL2: the runner was started where Chrome cannot reach the GPU
//   (ci/RUNNERS.md, "Check the GPU").
// --fallback (GitHub's machines): when the platform's backend (Metal, Direct3D 11) gives no WebGL2 in that virtual
//   machine, try SwiftShader and, when it works, set CMW_ANGLE=swiftshader for the job's later steps.
const os = require('os');
const fs = require('fs');
const { summary, esc } = require('./lib');

const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render|warp|microsoft basic|software/i;

async function probe() {
  // (cdp.js reads CMW_ANGLE when it is loaded: a fresh copy for each probe)
  delete require.cache[require.resolve('../test/regress/perf/cdp')];
  const { launch } = require('../test/regress/perf/cdp');
  const B = await launch({ width: 800, height: 600 });
  try {
    const info = await B.ev(`(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return { webgl2: false };
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      return { webgl2: true, renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        parallelCompile: !!gl.getExtension('KHR_parallel_shader_compile'), floatTargets: !!gl.getExtension('EXT_color_buffer_float'),
        maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
    })()`);
    return Object.assign(info, { flags: B.flags.filter((f) => /angle|swiftshader|sandbox/.test(f)).join(' ') });
  } finally { await B.close(); }
}

(async () => {
  let info = await probe();
  if (!info.webgl2 && process.argv.includes('--fallback') && process.env.CMW_ANGLE !== 'swiftshader') {
    console.log(`no WebGL2 with ${info.flags}: trying SwiftShader`);
    process.env.CMW_ANGLE = 'swiftshader';
    info = await probe();
    if (info.webgl2 && process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, 'CMW_ANGLE=swiftshader\n');
  }
  const software = !info.webgl2 || SOFTWARE.test(`${info.renderer} ${info.vendor}`);
  const machine = `${os.platform()} ${os.arch()} · ${(os.cpus()[0] || {}).model} · ${os.cpus().length} cores`;
  console.log(JSON.stringify(Object.assign({ software, machine }, info), null, 1));
  summary(`**WebGL2:** ${info.webgl2 ? esc(info.renderer) : 'none'}${software ? ' (software rendering)' : ''} · parallel compile ${info.parallelCompile ? 'yes' : 'no'}  \n${esc(machine)} · \`${esc(info.flags)}\`\n`);
  if (!info.webgl2) { console.error('::error title=No WebGL2::headless Chrome has no WebGL2 on this machine'); process.exit(1); }
  if (process.argv.includes('--require-hardware') && software) {
    console.error('::error title=No GPU::Chrome renders in software on this runner. Start the runner in a logged-in desktop session (ci/RUNNERS.md, "Check the GPU").');
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(2); });
