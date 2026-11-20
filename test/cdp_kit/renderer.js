'use strict';
// The renderer a local run draws WebGL2 with: Chrome's ANGLE back end, the Chrome flags it needs and the environment it runs in.
// The browser suites' Chrome launcher reads it (test/cdp_kit/cdpd.js), and ci/browser.js prints it, so a report says which renderer a
// result came from. The GLSL, Quality and Perf jobs of CI draw with SwiftShader on Linux (not lavapipe), so their launcher
// (test/regress/perf/cdp.js) keeps the platform's defaults and does not read this.
//   resolveRenderer({ env, platform, arch, fsx }) -> { angle, args, env, source, warning }
// - angle: the value of --use-angle; args: flags the choice needs, put before CMW_CHROME_ARGS; env: variables to add to Chrome's
//   environment (none that the caller already set: the cap on the instructions llvmpipe emits, and the Vulkan loader's ICD file, which
//   is the lavapipe one so that a GPU's ICD in the same package does not draw instead); source: what chose it ('CMW_ANGLE', 'platform', 'lavapipe' or 'swiftshader');
//   warning: one line for the log when a Linux machine falls back to SwiftShader, else null.
// CI's browser jobs draw with Mesa's lavapipe through ANGLE's Vulkan back end (CMW_ANGLE=vulkan, GALLIUM_OVERRIDE_CPU_CAPS=avx, the
// Vulkan flags: .github/workflows/gate.yml). A local run on Linux draws the same way when the machine has lavapipe (its Vulkan ICD
// and library), so that a red here is the red CI sees; else with SwiftShader, which CI does not use and which is slower, and says so.
// CMW_ANGLE overrides all of it (CMW_ANGLE=swiftshader opts out of lavapipe).
const fs = require('fs');
const os = require('os');
const path = require('path');

// where the Vulkan loader looks for ICD files, and for the libraries they name that are not an absolute path
const ICD_DIRS = ['/usr/share/vulkan/icd.d', '/etc/vulkan/icd.d', '/usr/local/share/vulkan/icd.d'];
const LIB_ARCH = { x64: 'x86_64', arm64: 'aarch64', ia32: 'i386' };
const libDirs = (arch) => [`/usr/lib/${LIB_ARCH[arch] || arch}-linux-gnu`, `/lib/${LIB_ARCH[arch] || arch}-linux-gnu`, '/usr/lib64', '/usr/lib', '/usr/local/lib'];
// the Vulkan flags of CI's browser jobs, and the cap on the instructions llvmpipe emits (LLVM 21 on AMD Zen 4/5 went wrong: ci/README.md)
const VULKAN_FLAGS = ['--enable-features=Vulkan', '--use-vulkan=native', '--disable-vulkan-surface'];
const LLVMPIPE_CAPS = 'avx';

// the lavapipe ICD file whose library exists, or null
function lavapipeIcd(fsx, arch) {
  for (const dir of ICD_DIRS) {
    let names;
    try { names = fsx.readdirSync(dir); } catch (e) { continue; }
    for (const name of names.filter((n) => /^lvp_icd.*\.json$/.test(n)).sort()) {
      let lib;
      try { lib = JSON.parse(fsx.readFileSync(path.join(dir, name), 'utf8')).ICD.library_path; } catch (e) { continue; }
      if (typeof lib !== 'string') continue;
      const found = path.isAbsolute(lib) ? fsx.existsSync(lib) : libDirs(arch).some((d) => fsx.existsSync(path.join(d, lib)));
      if (found) return path.join(dir, name);
    }
  }
  return null;
}

function resolveRenderer({ env = process.env, platform = process.platform, arch = os.arch(), fsx = fs } = {}) {
  if (env.CMW_ANGLE) return { angle: env.CMW_ANGLE, args: [], env: {}, source: 'CMW_ANGLE', warning: null };
  if (platform === 'win32') return { angle: 'd3d11', args: [], env: {}, source: 'platform', warning: null };
  if (platform === 'darwin') return { angle: 'metal', args: [], env: {}, source: 'platform', warning: null };
  const icd = lavapipeIcd(fsx, arch);
  if (icd) {
    // (the package mesa-vulkan-drivers also installs the GPU drivers' ICDs: a machine with a GPU would draw on it, not on lavapipe, so
    // the loader is pointed at the lavapipe ICD found, unless the caller points it somewhere)
    const pin = env.VK_ICD_FILENAMES || env.VK_DRIVER_FILES ? {} : { VK_ICD_FILENAMES: icd, VK_DRIVER_FILES: icd };
    return { angle: 'vulkan', args: VULKAN_FLAGS.slice(), env: Object.assign(env.GALLIUM_OVERRIDE_CPU_CAPS ? {} : { GALLIUM_OVERRIDE_CPU_CAPS: LLVMPIPE_CAPS }, pin), source: 'lavapipe', warning: null };
  }
  return {
    angle: 'swiftshader', args: [], env: {}, source: 'swiftshader',
    warning: 'lavapipe (the package mesa-vulkan-drivers) is not installed: Chrome draws with SwiftShader, which CI does not use, so a suite that fails here may pass in CI (ci/README.md, Locally)',
  };
}

module.exports = { resolveRenderer, lavapipeIcd };
