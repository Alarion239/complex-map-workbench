const SRC = "<project>/work/xv152-merged-snap/src/";
globalThis.CX = require(SRC + 'cx.js');
try { globalThis.Expr = require(SRC + 'parse.js'); } catch (e) { console.error('parse', e.message); }
try { globalThis.Recognize = require(SRC + 'recognize.js'); } catch (e) { }
globalThis.Funcs = require(SRC + 'funcs.js');
module.exports = { CX: globalThis.CX, Funcs: globalThis.Funcs };
