'use strict';
// Which WebGL2 renderer the gate's headless Chrome gets on this machine (the same launcher and flags as the perf
// suite: test/regress/perf/cdp.js). Prints it and adds it to the job summary.
//   node ci/gpu_probe.js [--require-hardware] [--fallback] [--require-angle BACKEND]
// --require-hardware (the self-hosted GPU runners): exit 1 when Chrome renders in software (SwiftShader, WARP, the
//   Microsoft Basic Render Driver, llvmpipe) or has no WebGL2: the runner was started where Chrome cannot reach the GPU
//   (ci/RUNNERS.md, "Check the GPU"); and on a Mac when the job runs under Rosetta, whose timings are not the machine's.
// --fallback (GitHub's machines): when the platform's backend (Metal, Direct3D 11) gives no WebGL2 in that virtual
//   machine, try SwiftShader and, when it works, set CMW_ANGLE=swiftshader for the job's later steps.
// --require-angle BACKEND (e.g. d3d11): exit 1 unless the renderer string names that ANGLE back end (Direct3D11 for
//   d3d11, Metal, Vulkan, OpenGL), in software too: GitHub's Windows machine for glprof, whose link times are FXC's only
//   on Direct3D 11 (WARP), not on a SwiftShader fallback (gpu-gate.yml, machines windows-hosted)
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

// A Windows laptop loses the job it runs when it sleeps (#169): warn when it runs on battery, or when closing its lid
// sleeps it even on power (ci/RUNNERS.md, section 2, "Power"). A machine without a battery gets no warning.
function windowsPower() {
  const cp = require('child_process');
  let online;
  try {
    online = cp.execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      '(Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus -ErrorAction Stop | Select-Object -First 1).PowerOnline'],
    { encoding: 'utf8', timeout: 30000 }).trim();
  } catch (e) { return []; }
  if (online !== 'True' && online !== 'False') return [];
  const notes = [];
  if (online === 'False') notes.push('the laptop runs on battery: it sleeps when its lid closes or after a few idle minutes, and the job is lost. Plug it in.');
  try {
    // the lid action on AC, then on battery (0 do nothing, 1 sleep, 2 hibernate, 3 shut down); by GUID, since powercfg's
    // aliases and text are localized
    const out = cp.execFileSync('powercfg', ['/qh', 'SCHEME_CURRENT', '4f971e89-eebd-4455-a8de-9e59040e7347', '5ca83367-6e45-459f-a27b-476b1d01c936'], { encoding: 'utf8', timeout: 30000 });
    const ac = [...out.matchAll(/:\s*0x([0-9a-f]+)/gi)].map((m) => parseInt(m[1], 16))[0];
    if (ac > 0) notes.push(`closing the lid ${['', 'sleeps', 'hibernates', 'shuts down'][ac] || 'stops'} the laptop even on power, and the job is lost. In an administrator PowerShell: powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0; powercfg /setactive SCHEME_CURRENT`);
  } catch (e) { /* no powercfg */ }
  return notes;
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
  // an Intel build on Apple silicon (the x64 runner package, whose setup-node fetches an x64 Node): translated by
  // Rosetta, Chrome included, so timings are not the machine's (ci/RUNNERS.md, "Replacing an x64 runner with the arm64
  // build"; #62)
  let rosetta = false;
  if (os.platform() === 'darwin') {
    try { rosetta = require('child_process').execFileSync('sysctl', ['-n', 'sysctl.proc_translated'], { encoding: 'utf8' }).trim() === '1'; } catch (e) { /* not on Apple silicon */ }
    if (rosetta) summary('**Rosetta:** this job runs as an x64 process on Apple silicon; its timings are not the machine\'s (ci/RUNNERS.md).\n');
  }
  console.log(JSON.stringify(Object.assign({ software, rosetta, machine }, info), null, 1));
  summary(`**WebGL2:** ${info.webgl2 ? esc(info.renderer) : 'none'}${software ? ' (software rendering)' : ''} · parallel compile ${info.parallelCompile ? 'yes' : 'no'}  \n${esc(machine)} · \`${esc(info.flags)}\`\n`);
  if (!info.webgl2) { console.error('::error title=No WebGL2::headless Chrome has no WebGL2 on this machine'); process.exit(1); }
  const ai = process.argv.indexOf('--require-angle');
  if (ai >= 0) {
    const want = String(process.argv[ai + 1] || '').toLowerCase();
    const names = { d3d11: /direct3d ?11|d3d11/i, metal: /metal/i, vulkan: /vulkan/i, gl: /opengl/i };
    if (!names[want] || !names[want].test(info.renderer || '')) {
      console.error(`::error title=Not ANGLE ${want}::the renderer is "${info.renderer}", not ANGLE's ${want} back end`);
      process.exit(1);
    }
  }
  if (process.argv.includes('--require-hardware') && software) {
    console.error('::error title=No GPU::Chrome renders in software on this runner. Start the runner in a logged-in desktop session (ci/RUNNERS.md, "Check the GPU").');
    process.exit(1);
  }
  const rosettaMsg = 'title=Rosetta::this job runs under Rosetta (the x64 runner package on Apple silicon): install the arm64 runner (ci/RUNNERS.md, "Replacing an x64 runner with the arm64 build")';
  if (rosetta && process.argv.includes('--require-hardware')) { console.error(`::error ${rosettaMsg}`); process.exit(1); }
  if (rosetta) console.log(`::warning ${rosettaMsg}`);
  if (os.platform() === 'win32' && process.argv.includes('--require-hardware')) {
    for (const note of windowsPower()) {
      console.log(`::warning title=Sleep::${note}`);
      summary(`**Sleep:** ${esc(note)}\n`);
    }
  }
})().catch((e) => { console.error(e); process.exit(2); });
