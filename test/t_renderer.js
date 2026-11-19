// The renderer a local run picks (test/cdp_kit/renderer.js): CI's lavapipe through ANGLE/Vulkan where the machine has it, else
// SwiftShader with a warning; CMW_ANGLE overrides; macOS and Windows keep their own back ends. Checked on a made-up file system (a
// map of path -> file text), so the result does not depend on this machine. And the two Chrome launchers take the choice from it,
// with no table of their own. Run: node test/t_renderer.js
const fs = require('fs');
const path = require('path');
const { resolveRenderer, lavapipeIcd } = require('./cdp_kit/renderer.js');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info === '' ? '' : JSON.stringify(info)); } };
// a file system of `files` (path -> text; a directory is any prefix of a path)
const fake = (files) => ({
  readdirSync: (d) => { const kids = Object.keys(files).filter((f) => path.dirname(f) === d).map((f) => path.basename(f)); if (!kids.length) throw new Error('ENOENT'); return kids; },
  readFileSync: (f) => { if (!(f in files)) throw new Error('ENOENT'); return files[f]; },
  existsSync: (f) => f in files,
});
const ICD = '/usr/share/vulkan/icd.d/lvp_icd.json', LIB = '/usr/lib/x86_64-linux-gnu/libvulkan_lvp.so';
const icd = (lib) => JSON.stringify({ file_format_version: '1.0.1', ICD: { library_path: lib, api_version: '1.4.318' } });
const withLvp = fake({ [ICD]: icd('libvulkan_lvp.so'), [LIB]: '' });
const linux = (extra = {}) => resolveRenderer(Object.assign({ env: {}, platform: 'linux', arch: 'x64', fsx: withLvp }, extra));

// Linux with lavapipe: CI's renderer
let r = linux();
check('Linux with lavapipe: ANGLE Vulkan', r.angle === 'vulkan' && r.source === 'lavapipe', r);
check('… with the three Vulkan flags of CI\'s browser jobs', JSON.stringify(r.args) === JSON.stringify(['--enable-features=Vulkan', '--use-vulkan=native', '--disable-vulkan-surface']), r.args);
check('… and llvmpipe capped to AVX, as CI does', r.env.GALLIUM_OVERRIDE_CPU_CAPS === 'avx', r.env);
check('… with no warning', r.warning === null, r);
r = linux({ env: { GALLIUM_OVERRIDE_CPU_CAPS: 'avx2' } });
check('a cap the caller set is left alone', r.angle === 'vulkan' && !('GALLIUM_OVERRIDE_CPU_CAPS' in r.env), r.env);
check('an ICD whose library is an absolute path is found', !!lavapipeIcd(fake({ [ICD]: icd('/opt/lvp/libvulkan_lvp.so'), '/opt/lvp/libvulkan_lvp.so': '' }), 'x64'));
check('on arm64 the library is looked for in the aarch64 folder', !!lavapipeIcd(fake({ [ICD]: icd('libvulkan_lvp.so'), '/usr/lib/aarch64-linux-gnu/libvulkan_lvp.so': '' }), 'arm64') && !lavapipeIcd(withLvp, 'arm64'));

// Linux without lavapipe: SwiftShader, and the log says so
r = linux({ fsx: fake({}) });
check('Linux with no Vulkan ICD: SwiftShader, flags and environment as before', r.angle === 'swiftshader' && r.source === 'swiftshader' && r.args.length === 0 && Object.keys(r.env).length === 0, r);
check('… with a one-line warning that names the package', typeof r.warning === 'string' && /mesa-vulkan-drivers/.test(r.warning) && !/\n/.test(r.warning), r.warning);
r = linux({ fsx: fake({ [ICD]: icd('libvulkan_lvp.so') }) });
check('an ICD file whose library is missing does not count', r.angle === 'swiftshader' && !!r.warning, r);
r = linux({ fsx: fake({ '/usr/share/vulkan/icd.d/intel_icd.json': icd('libvulkan_intel.so'), '/usr/lib/x86_64-linux-gnu/libvulkan_intel.so': '' }) });
check('another Vulkan driver is not lavapipe', r.angle === 'swiftshader', r);

// overrides and the other platforms
r = linux({ env: { CMW_ANGLE: 'swiftshader' } });
check('CMW_ANGLE=swiftshader opts out of lavapipe, with no warning', r.angle === 'swiftshader' && r.source === 'CMW_ANGLE' && r.warning === null && r.args.length === 0, r);
r = linux({ env: { CMW_ANGLE: 'vulkan' } });
check('CMW_ANGLE=vulkan adds no flag of its own (CI passes its own in CMW_CHROME_ARGS)', r.angle === 'vulkan' && r.args.length === 0 && Object.keys(r.env).length === 0, r);
r = resolveRenderer({ env: {}, platform: 'darwin', fsx: withLvp });
check('macOS: Metal, whatever the file system holds', r.angle === 'metal' && r.args.length === 0 && r.warning === null, r);
r = resolveRenderer({ env: {}, platform: 'win32', fsx: withLvp });
check('Windows: Direct3D 11', r.angle === 'd3d11' && r.args.length === 0 && r.warning === null, r);

// the browser suites' launcher has no table of its own: the choice is made in one place. The GLSL, Quality and Perf launcher does not
// use it (CI draws those with SwiftShader on Linux, not lavapipe)
{
  const src = fs.readFileSync(path.join(__dirname, 'cdp_kit/cdpd.js'), 'utf8');
  check('cdp_kit/cdpd.js takes the renderer from renderer.js', /require\('[^']*renderer(\.js)?'\)/.test(src) && /resolveRenderer\(/.test(src));
  check('cdp_kit/cdpd.js has no platform table of its own', !/CMW_ANGLE \|\| \(WIN \?/.test(src));
  check('the GLSL, Quality and Perf launcher keeps SwiftShader on Linux, as CI does', !/renderer\.js/.test(fs.readFileSync(path.join(__dirname, 'regress/perf/cdp.js'), 'utf8')));
}
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
