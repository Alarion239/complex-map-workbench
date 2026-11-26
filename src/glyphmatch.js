// @ts-check
'use strict';
// The glide tile's formula morph (#2409): which glyphs of one typeset formula are the same glyphs of the next, so the
// tile can slide and resize them and fade only the rest. A glyph is { k, x, y }: its class (glyphClass: the same font
// glyph, a horizontal or vertical rule, or a delimiter whatever its size) and the point it is placed at, in the two
// formulas' shared units (each formula from its own left edge and baseline). match() pairs glyphs of one class so that
// as many as can be are paired, and of those pairings the one that moves them least: an assignment problem, solved
// exactly (hungarian). It is pure: the tile typesets, reads the glyphs and draws (src/app/19-glide-tile.js).
const GlyphMatch = (() => {
  // the delimiters MathJax draws at several sizes, each size its own glyph: one class for each, whatever the size
  const DELIMS = new Set(['28', '29', '5B', '5D', '7B', '7D', '7C', '2016', '27E8', '27E9', '230A', '230B', '2308', '2309', '2223', '2225']);
  // the class of a glyph drawn by a <use>: MathJax's glyph id less its per-formula prefix ("MJX-3-STX-I-1D467" →
  // "STX-I-1D467", the face's variant and code point), or for a delimiter "delim:" and its code point (hex, upper case)
  function glyphClass(href, c) {
    const id = String(href || '').replace(/^#/, '').replace(/^MJX-\d+-/, '');
    const cp = (c ? String(c) : (/-([0-9A-F]+)$/i.exec(id) || [])[1] || '').toUpperCase();
    return DELIMS.has(cp) ? 'delim:' + cp : id || 'c:' + cp;
  }
  // the class of a rule (a fraction's bar, a root's vinculum, a stretched delimiter's piece) of width w and height h
  const ruleClass = (w, h) => (w >= h ? 'ruleH' : 'ruleV');
  // the assignment of least cost in a square matrix (cost[i][j], n x n): row i goes to column col[i]. The Hungarian
  // method with potentials, O(n³)
  function hungarian(cost) {
    const n = cost.length, INF = Infinity;
    const u = new Float64Array(n + 1), v = new Float64Array(n + 1), p = new Int32Array(n + 1), way = new Int32Array(n + 1);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(n + 1).fill(INF), used = new Uint8Array(n + 1);
      do {
        used[j0] = 1;
        const i0 = p[j0];
        let delta = INF, j1 = 0;
        for (let j = 1; j <= n; j++) {
          if (used[j]) continue;
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const col = new Array(n).fill(-1);
    for (let j = 1; j <= n; j++) if (p[j]) col[p[j] - 1] = j - 1;
    return col;
  }
  // the glyphs of a and b paired: { pairs: [[i, j], …], gone: [i …] (a's with no partner), come: [j …] (b's) }. A pair
  // of different classes costs FORBID, more than every allowed pairing's moves together, so the least cost pairs as many
  // glyphs as it can and then moves them least; a glyph left alone (the square matrix's padding) costs nothing
  function match(a, b) {
    const n = Math.max(a.length, b.length);
    if (!n) return { pairs: [], gone: [], come: [] };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const g of a.concat(b)) { x0 = Math.min(x0, g.x); x1 = Math.max(x1, g.x); y0 = Math.min(y0, g.y); y1 = Math.max(y1, g.y); }
    const FORBID = (Math.hypot(x1 - x0, y1 - y0) + 1) * (Math.min(a.length, b.length) + 1);
    const cost = [];
    for (let i = 0; i < n; i++) {
      const row = new Array(n);
      for (let j = 0; j < n; j++) row[j] = i < a.length && j < b.length ? (a[i].k === b[j].k ? Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y) : FORBID) : 0;
      cost.push(row);
    }
    const col = hungarian(cost), pairs = [], gone = [], seen = new Set();
    for (let i = 0; i < a.length; i++) {
      const j = col[i];
      if (j >= 0 && j < b.length && a[i].k === b[j].k) { pairs.push([i, j]); seen.add(j); } else gone.push(i);
    }
    const come = [];
    for (let j = 0; j < b.length; j++) if (!seen.has(j)) come.push(j);
    return { pairs, gone, come };
  }
  // the affine [a, b, c, d, e, f] part way, t, from m to n (each entry in a straight line: a glyph slides and scales)
  const lerpM = (m, n, t) => m.map((v, i) => v + (n[i] - v) * t);
  // an ease in and out over 0…1, so what moves or fades leaves and arrives at rest
  const ease = (u) => { const t = Math.min(1, Math.max(0, u)); return t * t * (3 - 2 * t); };
  // the morph in three parts of the thread's way u from the first plane to the second, one after another, so what fades
  // never lies over what moves: the first's glyphs alone fade out (0…OUT), then the pairs move (OUT…IN), then the
  // second's alone fade in (IN…1). The plane's name's index (w_k's k, another for each plane) changes over in place as the
  // second's glyphs start to come in (NAME_A…NAME_B, about IN), so the tile names the first plane while it shows the first's
  // formula and the second once the second's comes, and always has an index: the old one at least half there up to IN,
  // the new one from it
  const OUT = 0.25, IN = 0.75, NAME_A = 0.7, NAME_B = 0.8;
  const span = (u, a, b) => ease((u - a) / (b - a));
  const move = (u) => span(u, OUT, IN), fadeOut = (u) => 1 - span(u, 0, OUT), fadeIn = (u) => span(u, IN, 1);
  const nameOut = (u) => 1 - span(u, NAME_A, NAME_B), nameIn = (u) => span(u, NAME_A, NAME_B);
  return { glyphClass, ruleClass, hungarian, match, lerpM, ease, move, fadeOut, fadeIn, nameOut, nameIn, OUT, IN, NAME_A, NAME_B };
})();
export { GlyphMatch };
