// scratch (not for a PR): the Newton case of land_exact.js at a subset of u, to compare the rows with and without a drop of the out-of-box layers
let src = fs.readFileSync(path.join(DIR, '..', 'lib', 'land_exact.js'), 'utf8');
const a = "const GLIDE_U = [END_U, 0.002, MID_U[0], GLIDE_MID, MID_U[1], 0.998, 1 - END_U];";
if (!src.includes(a)) return { pass: false, fails: [{ name: 'patch anchor missing' }], info: {} };
src = src.replace(a, "const GLIDE_U = [END_U, 0.002, 0.25, 0.75, 1 - END_U];");
src = src.replace('const setU = async (x) => {', 'const setU = async (x) => { await ev("window.__zDrop = " + (process.env.ZDROP ? 1 : 0)); ');
return await eval(src)([false, true]);
