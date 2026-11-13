'use strict';
// The size of a GLSL stage as Direct3D 11's shader compiler sees it (issue #1545). ANGLE hands FXC each stage with
// every function call inlined, and FXC's compile time grows about as the 2.9th power of that inlined size (#238), so a
// stage is sized by expanding every call site reached from its main. The input is a stage's source as the app passes
// it to shaderSource; nothing here needs a browser.
//   preprocess(src) -> { text, defines }
//     comments removed; #if, #ifdef, #ifndef, #elif, #else and #endif resolved with the source's own #define and
//     #undef, as the compiler does before it parses; the directive lines dropped. defines: name -> value (null for a
//     function-like macro). Macro uses in the code are left as they are (the app's function-like macros call nothing).
//   inline(src, root = 'main') -> { size, own, copies, loops }
//     size    characters of root with every call expanded: each function's own text (its header and body, in the
//             preprocessed text) once per copy
//     own     Map: function -> its own text's length
//     copies  Map: function -> how many copies of it the expansion holds (root: 1)
//     loops   the `for` loops with a constant trip bound (a literal, a #define or a const) whose body calls into the
//             chain: FXC unrolls those, and the chain with them (#414). Each { fn, bound, trip (null when the bound
//             does not evaluate), copies (of fn), size (one iteration inlined), chain (the body's callees that reach
//             the chain) }
// A function defined more than once (an overload) is taken at its largest definition; the app's programs have none.
// The chain is what GLChain writes for a chain (src/glsl.js): its dispatch (chainStep, chainRange, chainHom, ...) and
// its steps' functions (cxs1_f, cxs2r0_s, ...).
const CHAIN = /^(?:chain[A-Z]\w*|cxs\d+_\w+)$/;
// (the built-in functions a constant loop bound may use)
const CONST_FNS = new Set(['int', 'uint', 'float', 'min', 'max', 'abs', 'clamp']);

// a block comment keeps its line breaks, so every directive stays on a line of its own
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, '')).replace(/\/\/[^\n]*/g, '');

// the integer value of a constant expression: each identifier replaced by value(name) (a string, evaluated in its turn,
// or null: not a constant); -> a number, or null. What is left must be integer arithmetic of the operators the
// whitelist allows, which JavaScript evaluates as GLSL does (no division: JavaScript's is not integer division).
function evaluate(expr, value, depth = 0) {
  if (depth > 32) return null;
  let constant = true;
  const s = expr.replace(/\b[A-Za-z_]\w*\b/g, (name) => {
    const v = value(name);
    const n = v === null ? null : evaluate(v, value, depth + 1);
    if (n === null) constant = false;
    return ` (${n}) `;
  }).replace(/\b(\d+)[uU]\b/g, '$1');
  if (!constant || !/^[\d\s()!~*%+\-<>=&|^]*$/.test(s)) return null;
  try { return Number(Function(`return (${s});`)()); } catch (e) { return null; }
}

function preprocess(src) {
  const defines = new Map(), out = [], open = [];   // open: one { on, taken, outer } per #if level
  const live = () => open.every((f) => f.on);
  // (#if's rules: defined(X) is 1 or 0, an undefined name is 0, an empty macro is 1)
  const truth = (expr) => {
    const e = expr.replace(/\bdefined\s*(?:\(\s*(\w+)\s*\)|(\w+))/g, (m, a, b) => (defines.has(a || b) ? '1' : '0'));
    const n = evaluate(e, (name) => (defines.has(name) ? defines.get(name) || '1' : '0'));
    if (n === null) throw new Error(`#if ${expr}: not an integer expression`);
    return n !== 0;
  };
  for (const line of stripComments(src).split('\n')) {
    const d = /^\s*#\s*(\w+)\s*(.*?)\s*$/.exec(line);
    if (!d) { if (live()) out.push(line); continue; }
    const [, word, rest] = d;
    if (word === 'if' || word === 'ifdef' || word === 'ifndef') {
      const outer = live();
      const on = outer && (word === 'if' ? truth(rest) : defines.has(rest.split(/\s/)[0]) === (word === 'ifdef'));
      open.push({ on, taken: on, outer });
    } else if (word === 'elif' || word === 'else') {
      const f = open[open.length - 1];
      if (!f) throw new Error(`#${word} without #if`);
      f.on = f.outer && !f.taken && (word === 'else' || truth(rest));
      f.taken = f.taken || f.on;
    } else if (word === 'endif') {
      if (!open.pop()) throw new Error('#endif without #if');
    } else if (live() && word === 'define') {
      const m = /^(\w+)(\()?\s*(.*)$/.exec(rest);
      defines.set(m[1], m[2] ? null : m[3]);
    } else if (live() && word === 'undef') defines.delete(rest);
    // (#version, #extension, #pragma and #line are not code)
  }
  if (open.length) throw new Error('#if without #endif');
  return { text: out.join('\n'), defines };
}

// the index of the bracket that closes the one at i
function closing(text, i) {
  const o = text[i], c = { '{': '}', '(': ')' }[o];
  for (let d = 0, j = i; j < text.length; j++) {
    if (text[j] === o) d++;
    else if (text[j] === c && --d === 0) return j;
  }
  throw new Error(`unbalanced ${o} at ${i}`);
}

// the top-level function definitions: name -> { text (header and body), body }; a definition at depth 0 is the only
// block that follows a header `name(params)` (a struct's or an interface block's name has no parentheses)
function functions(text) {
  const fns = new Map();
  for (let i = 0, start = 0; i < text.length; i++) {
    if (text[i] === ';') start = i + 1;
    else if (text[i] === '{') {
      const end = closing(text, i);
      const head = /([A-Za-z_]\w*)\s*\([^()]*\)\s*$/.exec(text.slice(start, i));
      if (head) {
        const f = { text: text.slice(start, end + 1).trim(), body: text.slice(i, end + 1) };
        const had = fns.get(head[1]);
        if (!had || had.text.length < f.text.length) fns.set(head[1], f);
      }
      i = end; start = end + 1;
    }
  }
  return fns;
}

// the calls of known functions in a piece of code: callee -> count
function callsIn(code, fns) {
  const out = new Map();
  for (const m of code.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) if (fns.has(m[1])) out.set(m[1], (out.get(m[1]) || 0) + 1);
  return out;
}

// the end of the statement that starts at i, exclusive: a block, or a statement up to its `;` or up to the block that
// ends it (`if (c) { ... }`, unless an `else` follows)
function statementEnd(code, i) {
  while (/\s/.test(code[i])) i++;
  if (code[i] === '{') return closing(code, i) + 1;
  for (let paren = 0, brace = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '(') paren++;
    else if (c === ')') paren--;
    else if (c === '{') brace++;
    else if (c === '}' && --brace === 0 && paren === 0 && !/^\s*else\b/.test(code.slice(i + 1))) return i + 1;
    else if (c === ';' && paren === 0 && brace === 0) return i + 1;
  }
  return i;
}

function inline(src, root = 'main') {
  const { text, defines } = preprocess(src);
  const fns = functions(text);
  if (!fns.has(root)) throw new Error(`no function ${root}`);
  const calls = new Map([...fns].map(([name, f]) => [name, callsIn(f.body, fns)]));
  const own = new Map([...fns].map(([name, f]) => [name, f.text.length]));
  // each function's inlined size, and the order callers before callees (a reversed depth-first post-order)
  const sized = new Map(), order = [];
  const sizeOf = (name, path = []) => {
    if (sized.has(name)) return sized.get(name);
    if (path.includes(name)) throw new Error(`recursion through ${name}`);
    let s = own.get(name);
    for (const [callee, k] of calls.get(name)) s += k * sizeOf(callee, path.concat(name));
    sized.set(name, s);
    order.push(name);
    return s;
  };
  const size = sizeOf(root);
  const copies = new Map([[root, 1]]);
  for (const name of order.reverse()) {
    for (const [callee, k] of calls.get(name)) copies.set(callee, (copies.get(callee) || 0) + copies.get(name) * k);
  }
  return { size, own: new Map([...copies.keys()].map((name) => [name, own.get(name)])), copies, loops: constantLoops(text, defines, fns, calls, sizeOf, copies) };
}

// the loops of the functions in copies whose trip bound is constant and whose body reaches the chain (inline's loops)
function constantLoops(text, defines, fns, calls, sizeOf, copies) {
  const consts = new Map();
  for (const m of text.matchAll(/\bconst\s+(?:(?:highp|mediump|lowp)\s+)?\w+\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g)) consts.set(m[1], m[2]);
  const constant = (name) => (defines.get(name) || consts.get(name) || null);
  const reach = new Map();
  const reaches = (name) => {
    if (!reach.has(name)) reach.set(name, CHAIN.test(name) || [...calls.get(name).keys()].some(reaches));
    return reach.get(name);
  };
  const loops = [];
  for (const name of copies.keys()) {
    const body = fns.get(name).body;
    for (const m of body.matchAll(/\bfor\s*\(/g)) {
      const open = m.index + m[0].length - 1, close = closing(body, open);
      const [init, cond = ''] = body.slice(open + 1, close).split(';');
      const start = /(\w+)\s*=\s*(.+?)\s*$/.exec(init);
      if (!start || !new RegExp(`\\b${start[1]}\\b`).test(cond)) continue;
      const names = (cond.match(/\b[A-Za-z_]\w*\b/g) || []).filter((n) => n !== start[1] && !CONST_FNS.has(n));
      if (!names.every((n) => evaluate(n, constant) !== null)) continue;
      const code = body.slice(close + 1, statementEnd(body, close + 1));
      const inner = callsIn(code, fns);
      const chain = [...inner.keys()].filter(reaches);
      if (!chain.length) continue;
      // (i < N from i = a: N - a trips; <= one more)
      const b = /^\s*(\w+)\s*(<=?)\s*(.+?)\s*$/.exec(cond), from = evaluate(start[2], constant);
      const to = b && b[1] === start[1] ? evaluate(b[3], constant) : null;
      const trip = to === null || from === null ? null : to - from + (b[2] === '<=' ? 1 : 0);
      let size = code.length;
      for (const [callee, k] of inner) size += k * sizeOf(callee);
      loops.push({ fn: name, bound: cond.trim(), trip, copies: copies.get(name), size, chain });
    }
  }
  return loops;
}

module.exports = { preprocess, inline };
