// The app's modules bundled into one script (issue #20, phase 4): esbuild from src/main.js, the split files joined.
//   node tools/bundle.mjs --mode test|pub --out FILE
import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
// (fileURLToPath, not the URL's pathname: on Windows that is /D:/..., and a space is %20)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { source, parts } = require(path.join(ROOT, 'test', 'src_text.js'));
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const mode = arg('--mode', 'test'), out = arg('--out', path.join(ROOT, 'dist', `bundle-${mode}.js`));
const HOOK = /\n[ \t]*\/\/ TEMP-DEBUG-HOOK \(removed before publishing\).*?\/\/ TEMP-DEBUG-HOOK\n/gs;
const SRC = path.join(ROOT, 'src');
const plugin = {
  name: 'cmw-src',
  setup(b) {
    // a split file (src/app/, src/gl/) resolves to src/<name>.js, which onLoad joins from its parts (src/gl.js, a stand-in
    // for node, is never read)
    b.onResolve({ filter: /^\.\/[^/]+\.js$/ }, (a) => (parts(a.path.slice(2), SRC) ? { path: path.join(SRC, a.path.slice(2)) } : undefined));
    b.onLoad({ filter: /[\\/]src[\\/][^\\/]+\.js$/ }, (a) => {
      const f = path.basename(a.path);
      let text = parts(f, SRC) ? source(f, SRC) : fs.readFileSync(a.path, 'utf8');
      if (f === 'expose.js' && mode === 'pub') return { contents: '', loader: 'js' };   // the test page's globals only
      if (mode === 'pub') text = text.replace(HOOK, '\n');
      return { contents: text, loader: 'js' };
    });
  },
};
const r = await build({ entryPoints: [path.join(SRC, 'main.js')], bundle: true, format: 'iife', target: 'es2022', charset: 'utf8', write: false, plugins: [plugin], logLevel: 'warning', legalComments: 'none' });
fs.writeFileSync(out, r.outputFiles[0].text);
console.log(`bundle ${mode}: ${r.outputFiles[0].text.length} bytes -> ${path.relative(ROOT, out)}`);
