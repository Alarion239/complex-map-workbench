  // =====================================================================================================
  // 4. Captions (journal register, en-US), the build, the LaTeX snippet
  // =====================================================================================================
  const numTex = (v) => (+v.toPrecision(3)).toString();
  // captions are built inside using(lang): $t and I18N.lang give the caption's language
  const capRu = () => !!I18 && I18.lang === 'ru';
  // a caption language with a decimal comma (Russian, Italian): numbers, points and lists of decimals as GLOSSARY 2.3
  const capComma = () => !!I18 && !!I18.comma && I18.comma();
  // ---- F's formula as a displayed equation (round 3: "it might be too complicated to fit inline") ----
  // LaTeX first sets a caption in one line (an \hbox) to see whether it fits, and display math cannot go there: the
  // display is guarded so that, in that trial, it is a gap of a full line (the caption is then set as a paragraph),
  // and in the paragraph it is \[ \displaystyle F(z) = ... \]. Every class compiles it (article, amsart, REVTeX, the
  // Homework letter, pdfLaTeX and XeLaTeX); no package is needed.
  const MAPTOK = '\u0001';
  const DISP_OPEN = '\\ifinner\\hskip\\hsize\\else\\[ ', DISP_CLOSE = ' \\]\\fi';
  const DISP_RE = /\\ifinner\\hskip\\hsize\\else\\\[\s*([\s\S]*?)\s*\\\]\\fi/;
  // a caption whose map is MAPTOK: F named in the text ($F$), its formula displayed at the end of the sentence that
  // names it first (", where \[ F(z) = ... . \]"); when that sentence is long, right after the phrase that names F
  // (see displayF); called inside using(lang)
  // (export review r3) CHAINTOK ends the sentence that names the steps f_1, f_2, ...: the display there gives the chain
  // (F(z) = ..., F = f_2 o f_1, f_1(z) = ..., f_2(w_1) = ...), so the steps the caption names are defined
  const CHAINTOK = '\u0002';
  // a literal a+bi (or a real) of the app's TeX, negated: -0.5-0.3i -> 0.5+0.3i; null when it is not one
  const negLit = (x) => {
    const m = /^(-?)(\d+(?:\.\d+)?)(?:([+-])(\d+(?:\.\d+)?)?i)?$/.exec(x.replace(/\s+/g, ''));
    if (!m) { const im = /^(-?)(\d+(?:\.\d+)?)?i$/.exec(x.replace(/\s+/g, '')); return im ? `${im[1] ? '' : '-'}${im[2] || ''}i` : null; }
    return `${m[1] ? '' : '-'}${m[2]}${m[3] ? `${m[3] === '+' ? '-' : '+'}${m[4] || ''}i` : ''}`;
  };
  // the display in normal form (export review r3, editor-16): "+ (-a)" is "- a", and a linear denominator starts
  // with its constant: \frac{z+\left(-0.5-0.3i\right)}{\left(-0.5+0.3i\right)\,z+1} -> \frac{z-\left(0.5+0.3i\right)}{1-\left(0.5-0.3i\right)\,z}
  function tidyTex(t) {
    let out = String(t || '');
    // a denominator c z + 1 -> 1 + c z
    out = out.replace(/\{\\left\(([^()]*?)\\right\)\\,([a-z](?:_\{\d+\})?)\+(\d+(?:\.\d+)?)\}/g, (m0, c, v, k) => `{${k}+\\left(${c}\\right)\\,${v}}`);
    // + (-a) -> - a (a complex literal keeps its parentheses, a real drops them)
    out = out.replace(/\+\\left\((-[^()]*?)\\right\)/g, (m0, a) => { const n = negLit(a); if (n == null || /^-/.test(n)) return m0; return /i/.test(n) && /[+-]/.test(n.slice(1)) ? `-\\left(${n}\\right)` : `-${n}`; });
    return out;
  }
  // the chain as a display: gathered lines, each in \displaystyle, packed to the caption's measure
  function chainDisplay(c, maxW, pt) {
    const F = `${c.Fname}(${c.lvar})=${tidyTex(c.raw)}`, comp = `${c.Fname}=${c.chain.map((q) => q.f).reverse().join('\\circ ')}`;
    const steps = c.chain.map((q) => `${q.f}(${q.v})=${tidyTex(q.tex)}`);
    const wOf = (x) => { try { return XD.tex(`\\displaystyle ${x}`, pt).w; } catch (e) { return 0; } };
    const gap = ',\\qquad ', lines = [];
    if (wOf(F + gap + comp) <= maxW) lines.push(F + gap + comp); else lines.push(F, comp);
    let cur = '';
    for (const q of steps) { const t2 = cur ? cur + gap + q : q; if (cur && wOf(t2) > maxW) { lines.push(cur); cur = q; } else cur = t2; }
    if (cur) lines.push(cur);
    return `\\begin{gathered}${lines.map((l) => `\\displaystyle ${l}`).join(',\\\\ ')}.\\end{gathered}`;
  }
  // the ends of the sentences of a caption: each '.' outside math before a space or the end
  const sentenceEnds = (cap) => {
    const ends = [];
    for (let q = 0, inM = false; q < cap.length; q++) { const ch = cap[q]; if (ch === '$') inM = !inM; else if (!inM && ch === '.' && (q + 1 === cap.length || /\s/.test(cap[q + 1]))) ends.push(q); }
    return ends;
  };
  // the lead-in of a display that ends the text cap[0, p): ", where", or, when the sentence already has its own "where"
  // («где», outside math: the homotopy's "..., где H'(p) = ..."), the sentence is closed and the display is "Here \[ ... \]"
  // (export review r3, verify-editor-13: never «где …, где»)
  function leadIn(cap, p) {
    const st = Math.max(0, ...sentenceEnds(cap).filter((q) => q < p).map((q) => q + 1));
    const word = $t(', where').replace(/^[\s,]+/, '').trim();
    const text = cap.slice(st, p).replace(/\$[^$]*\$/g, ' ');
    return new RegExp(`(^|[^\\p{L}])${word}(?![\\p{L}])`, 'u').test(text) ? `.${$t(' Here')}` : $t(', where');
  }
  // the first letter of a sentence made from a clause, in capitals (not inside math)
  const upperFirst = (s) => s.replace(/^(\s*)(\p{Ll})/u, (m0, sp0, ch) => sp0 + ch.toUpperCase());
  // multi: the figure draws the multivalued function (a landscape with All sheets), so the display writes it as one
  // (Ln in Russian, GLOSSARY 2.2; English unchanged), as the inline map of the same caption does (v16.1 user-5)
  function displayF(cap, c, maxW = 300, pt = 10, multi = false) {
    const iC = cap.indexOf(CHAINTOK);
    if (iC >= 0) {
      if (c.raw && c.chain) {
        const disp = `${DISP_OPEN}${chainDisplay(c, maxW, pt)}${DISP_CLOSE}`;
        return (cap.slice(0, iC) + leadIn(cap, iC) + disp + cap.slice(iC + 1 + (cap[iC + 1] === '.' ? 1 : 0))).split(MAPTOK).join(`$${c.Fname}$`);
      }
      cap = cap.split(CHAINTOK).join('');
    }
    const i = cap.indexOf(MAPTOK);
    if (i < 0) return cap;
    // the end of the sentence that names F (the next '.' outside math before a space or the end)
    const j = sentenceEnds(cap).find((q) => q > i);
    const disp = `${DISP_OPEN}\\displaystyle ${c.Fname}(${c.lvar})=${tidyTex(multi && I18 ? I18.notation(c.raw, undefined, { multi: true }) : c.raw)}.${DISP_CLOSE}`;
    // (export review r3, verify-editor-13) the display follows the phrase that names F: at the first ':' or ';' after F
    // (outside math and brackets, within 100 characters: "Phase portrait of $F$ on $[-7,7]\times[-5,5]$: the color
    // ...", "Landscape of $F$ over ...: the height ..."), and the rest of that sentence becomes a sentence of its own;
    // else at the end of the sentence. Never a lead-in of its own ("The map is") far from F's name, and never ", where"
    // after a clause about something else ("dashed: arg F = pi, where ...")
    let k = null;
    if (j != null) for (let q = i + 1, inM = false, dep = 0; q < Math.min(j, i + 100); q++) {
      const ch = cap[q];
      if (ch === '$') inM = !inM;
      else if (!inM && '([{'.includes(ch)) dep++;
      else if (!inM && ')]}'.includes(ch)) dep--;
      else if (!inM && !dep && (ch === ':' || ch === ';')) { k = q; break; }
    }
    let out;
    if (j == null) out = cap + leadIn(cap, cap.length) + disp;
    else if (k != null) out = cap.slice(0, k) + leadIn(cap, k) + disp + ' ' + upperFirst(cap.slice(k + 1).trimStart());
    else out = cap.slice(0, j) + leadIn(cap, j) + disp + cap.slice(j + 1);
    return out.split(MAPTOK).join(`$${c.Fname}$`);
  }
  // an edited caption may hold a plain \[ ... \]: guarded as above, so it compiles
  const guardDisplays = (tex) => String(tex || '').replace(/(\\else)?\\\[([\s\S]*?)\\\](\\fi)?/g, (m0, el, body, fi) => (el ? m0 : `${DISP_OPEN}${body.trim()}${DISP_CLOSE}`));
  // the caption for the list of figures (\caption[short]{long}): the text before the display (its sentence closed),
  // else the first sentence; null when the caption has no display
  function shortCaption(tex) {
    const m = DISP_RE.exec(tex || '');
    if (!m) return null;
    // (the lead-in of the display, ", where" or ". Here", is not part of the short caption)
    let head = tex.slice(0, m.index).trimEnd();
    for (const l of [$t(', where'), $t(' Here')].map((x) => x.trim())) if (head.endsWith(l)) { head = head.slice(0, -l.length); break; }
    head = head.trim();
    if (head.length > 220) { const k = head.search(/\.\s/); if (k > 0) head = head.slice(0, k); }
    return head.replace(/[.,;:]$/, '') + '.';
  }
  // [x0,x1]x[y0,y1]; in Russian and Italian a semicolon inside a bracket pair when an endpoint is a decimal (GLOSSARY 2.3)
  // (export review r3, editor-19: one separator for the whole product, ';' in both intervals once an endpoint is a decimal)
  const winTex = (b) => { if (!b) return ''; if (!capComma()) return `[${numTex(b.x0)},${numTex(b.x1)}]\\times[${numTex(b.y0)},${numTex(b.y1)}]`; const v = [b.x0, b.x1, b.y0, b.y1].map(numTex), sep = I18.texSep(v), n = (x) => I18.texNum(x); return `[${n(v[0])}${sep}${n(v[1])}]\\times[${n(v[2])}${sep}${n(v[3])}]`; };
  const us = (segs) => segs.map((s) => (s.t != null ? Object.assign({}, s, { t: s.t.replace(/colour/g, 'color').replace(/Colour/g, 'Color').replace(/grey/g, 'gray').replace(/ \(bar\)/g, '') }) : s));   // (a phrase's closing comma keeps its pc mark)
  // a point of the plane in a Russian or Italian caption: the decimal comma (a short number formula, never a snippet)
  const cxTexL = (z) => { const s = cxTex(z); return capComma() ? s.replace(/(\d)\.(\d)/g, '$1{,}$2') : s; };
  const listTex = (zs) => zs.map((r) => `$${cxTexL(r.z)}$${(r.mult || 1) > 1 ? $t(' (order {mult})', { mult: r.mult }) : ''}`);
  const joinWords = (a) => (a.length <= 1 ? a.join('') : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')}, and ${a[a.length - 1]}`);
  // Russian: «a, b и c», Italian: «a, b e c», with «;» between decimals («$0{,}5$; $1$ и $2$»)
  const joinL = (a) => (!capComma() ? joinWords(a) : a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(a.some((x) => /\{,\}/.test(x)) ? '; ' : ', ')} ${capRu() ? 'и' : $t('and')} ${a[a.length - 1]}`);
  // the homotopy as a sentence (export review r3, editor-13): "Here H_t, 0 <= t <= m, deforms the identity (t = 0)
  // into F (t = m) and runs the steps in turn (...): for f_1, ...; for f_2, ..." rather than "... along the homotopy
  // H_t, ..., that runs the steps in turn"; CHAINTOK ends it when the chain is displayed. Called inside using(lang)
  // (v16.1, verify-2) " Here w_d = ...": a bracket's start written with the stage of a d/dz in its pre, defined in z
  const wDefS = (d) => (d && d.wdef ? $t(' Here $%{w}$.', { w: d.wdef }) : '');
  function homSentence(c, map) {
    if (!c.hom) return '';
    const m = tnum(c.hom.m), tail = c.chain && c.raw ? CHAINTOK : '';
    // (v16, SPEC 8: a bracket with a pre or a post: H_t = Q o G_t o P, and G_t is the bracketed part)
    const d = A.defo ? A.defo() : null;
    if (d && d.qp && c.hom.inner) {
      const hom = (c.hom.inner.length > 360 && c.hom.innerShort ? c.hom.innerShort.replace(/:\s*$/, '') : c.hom.inner) + tail;
      if (d.pre && d.post) return $t(' Here $H_t=%{Q}\\circ G_t\\circ %{P}$, $0\\le t\\le %{m}$, deforms $%{QP}$ ($t=0$) into %{map} ($t=%{m}$): $%{P}$ acts first and $%{Q}$ last, both in full, and $G_t$ is %{hom}.', { Q: d.post, P: d.pre, QP: d.qp, m, map, hom }) + wDefS(d);
      if (d.pre) return $t(' Here $H_t=G_t\\circ %{P}$, $0\\le t\\le %{m}$, deforms $%{P}$ ($t=0$) into %{map} ($t=%{m}$): $%{P}$ acts first, in full, and $G_t$ is %{hom}.', { P: d.pre, m, map, hom }) + wDefS(d);
      return $t(' Here $H_t=%{Q}\\circ G_t$, $0\\le t\\le %{m}$, deforms $%{Q}$ ($t=0$) into %{map} ($t=%{m}$): $%{Q}$ acts last, in full, and $G_t$ is %{hom}.', { Q: d.post, m, map, hom });
    }
    const vals = { H: 'H_t', range: `0\\le t\\le ${c.hom.m}`, def: 'H_t=H^{(k)}_{t-k+1}', interval: 'k-1\\le t\\le k' };
    let pref = '';
    try {
      const tpl = $t('the homotopy {H}, {range}, that runs the steps in turn ({def} on {interval}): ');
      pref = A.segsTex(tpl.split(/(%?\{\w+\})/).filter(Boolean).map((q) => { const k = /^%?\{(\w+)\}$/.exec(q); return k && vals[k[1]] != null ? { m: vals[k[1]] } : { t: q }; })).trim();
    } catch (e) { pref = ''; }
    if (pref && c.hom.tex.indexOf(pref) === 0) {
      const rest = c.hom.tex.slice(pref.length).trim();
      return $t(' Here $H_t$, $0\\le t\\le %{m}$, deforms the identity ($t=0$) into %{map} ($t=%{m}$) and runs the steps in turn ($H_t=H^{(k)}_{t-k+1}$ on $k-1\\le t\\le k$): %{rest}.', { m, map, rest: rest + tail });
    }
    return $t(' Here $H_t$ deforms the identity ($t=0$) into %{map} ($t=%{m}$) along %{hom}.', { map, m, hom: c.hom.tex + tail });
  }
  // the landscape's clause on its sheets (app's sheetsClause, 'tex'): the window k and H, F as math, then the sentence on
  // the deformed pieces' paths on a sheet (v16.1 review math-2), if any
  const sheetsTex = (shc) => (shc.src ? $t(shc.src, Object.fromEntries(Object.entries(shc.p).map(([q, v]) => [q, q === 'k' || q === 'H' || q === 'F' ? `$${v}$` : v]))) : shc.p.text) + (shc.then ? $t(shc.then.src, shc.then.p) : '');
  // one template per sentence (Russian word order, notes/i18n/GLOSSARY.md 1.11); called inside using(lang)
  // the thread of a steps-view filmstrip, z → w₁ → w₂ with each step's name over its arrow, in TeX
  const svChain = (frames) => `$${frames.map((f) => (f.f ? `\\xrightarrow{${f.f}} ${f.name}` : f.name)).join(' ')}$`;
  function captionFor(o, view, body) {
    const ru = capRu();
    const fi = body.info || {};
    if (fi.svFilm) return $t('The planes along %{chain}.', { chain: svChain(fi.frames) });
    // (export review r3, verify2-new-1: a globe figure's points on the far side are not in its list of what it shows)
    const c = A.capParts({ letters: !!PRESET[o.for].named, skip: (fi.globePaths || fi.film === 'globe') && fi.hidden && fi.hidden.length ? fi.hidden.map((x) => x.z) : null });
    // (round 3) F's formula is displayed, not inline: the caption names F (MAPTOK), and displayF sets
    // F(z) = ... as a displayed equation after the sentence that names F first
    const map = c.raw ? MAPTOK : c.mapTex ? `$${c.mapTex}$` : `$${c.Fname}$`;
    // Phase and Landscape of the deformation: the picture is H_t at the current t
    const hm = c.hm && (view === 'phase' || view === 'land' || view === 'xyL');
    if (fi.film || fi.globePaths) {
      const ts = joinL(fi.ts ? fi.ts.map((t, k) => $t('(%{letter}) $t=%{t}$', { letter: ru ? RU_LETTERS[k] : String.fromCharCode(97 + k), t: fi.labs[k] })) : []);
      const along = homSentence(c, map);
      const list = c.shapeListGen ? A.segsTex(us(c.shapeListGen)) : A.segsTex(us(c.shapeList));
      // (the points a globe figure marks are named; a listed point on the far side is said to be hidden)
      const marks = [$t('dot'), $t('square'), $t('triangle'), $t('diamond')];
      const named = (fi.pts || []).map((q, k) => `$${cxTexL(q.z)}$ (${marks[k % 4]})`);
      const hp = (h2) => `$${h2.lab ? `${h2.lab}=` : ''}${cxTexL(h2.z)}$`;
      const hidden = (fi.hidden || []).length ? (fi.hidden.length === 1 ? $t(' The point %{p} is on the far side of the sphere and is not shown.', { p: hp(fi.hidden[0]) }) : $t(' The points %{list} are on the far side of the sphere and are not shown.', { list: joinL(fi.hidden.map(hp)) })) : '';
      const dashed = fi.open ? $t(' Dashed: boundary not included.') : '';
      const plainN = (fi.pts || []).map((q) => `$${cxTexL(q.z)}$`);
      const qT = A.pathTimesTex ? A.pathTimesTex(fi.m || 1) : ['1/4', '1/2', '3/4'];
      const mx = A.pathMarksTex ? A.pathMarksTex(fi.m || 1) : { seq: false };
      // (steps one after another: an arrowhead in the middle of each step, a bar where the steps meet)
      const marksS = !mx.seq ? $t(' Small dots mark $t=%{a}$ and $t=%{c}$, an arrowhead $t=%{b}$.', { a: qT[0], b: qT[1], c: qT[2] }) : mx.nodes ? $t(' Arrowheads mark $t=%{a}$, the middle of each step, and bars $t=%{n}$, where one step ends and the next begins.', { a: mx.arrows, n: mx.nodes }) : $t(' An arrowhead marks $t=%{a}$.', { a: mx.arrows });
      // (export review r3, verify-editor-3) the other point shapes, named by their marker; the frames where one is on the
      // far side ((a) and (d))
      const fl = (i) => (ru ? `\\textit{${RU_LETTERS[i]}}` : `(${String.fromCharCode(97 + i)})`);
      const markS = (fi.marks || []).map((x) => (fi.globePaths ? $t(' The %{mark} is the image of the point %{p} under $%{F}$.', { mark: marks[x.mk], p: hp(x), F: c.Fname })
        : x.hiddenIn && x.hiddenIn.length ? $t(' The %{mark} is the image of the point %{p}; in %{frames} it is on the far side of the sphere.', { mark: marks[x.mk], p: hp(x), frames: joinL(x.hiddenIn.map(fl)) })
          : $t(' The %{mark} is the image of the point %{p}.', { mark: marks[x.mk], p: hp(x) }))).join('');
      // (verify-editor-13) the sentence that names F is short, so its display follows it at once ("..., where \[ F(z) = ... \]")
      const dq = A.defo ? A.defo() : null, z0 = dq && dq.qp ? `H_0(z)=${dq.qpz}` : 'z';   // (v16: a bracket's start)
      if (fi.globePaths) return (dq && dq.qp ? $t('The deformation $H_t$ on the Riemann sphere, with $\\infty$ at the north pole, from $%{QP}$ ($t=0$) to %{map} ($t=%{m}$). The figure shows the image of %{list} under $%{F}$ over the boundary of its image at $t=0$ (gray).', { QP: dq.qp, list, map, m: tnum(fi.m), F: c.Fname }) + wDefS(dq) : $t('The deformation $H_t$ on the Riemann sphere, with $\\infty$ at the north pole, from the identity ($t=0$) to %{map} ($t=%{m}$). The figure shows the image of %{list} under $%{F}$ over its boundary at $t=0$ (gray).', { list, map, m: tnum(fi.m), F: c.Fname })) + (plainN.length ? (plainN.length === 1 ? $t(' The curve is the path $t\\mapsto H_t(z)$ of the point %{p}, from $%{z0}$ (circle) to $%{F}(z)$ (dot).', { p: plainN[0], F: c.Fname, z0 }) : plainN.length <= 3 ? $t(' Curves are the paths $t\\mapsto H_t(z)$ of the points %{list}, from $%{z0}$ (circle) to $%{F}(z)$ (dot).', { list: joinL(plainN), F: c.Fname, z0 }) : $t(' Curves are the paths $t\\mapsto H_t(z)$ of %{n} points, from $%{z0}$ (circle) to $%{F}(z)$ (dot).', { n: String(plainN.length), F: c.Fname, z0 })) + marksS : '') + markS + hidden + dashed;
      if (fi.film === 'globe') return (dq && dq.qp ? $t('The deformation $H_t$ on the Riemann sphere, with $\\infty$ at the north pole, from $%{QP}$ ($t=0$) to %{map} ($t=%{m}$). At %{ts}, the frames show the image of %{list} under $H_t$.', { QP: dq.qp, map, m: tnum(fi.m), ts, list }) + wDefS(dq) : $t('The deformation $H_t$ on the Riemann sphere, with $\\infty$ at the north pole, from the identity ($t=0$) to %{map} ($t=%{m}$). At %{ts}, the frames show the image of %{list} under $H_t$.', { map, m: tnum(fi.m), ts, list })) + (named.length === 1 ? $t(" Solid: the path $t\\mapsto H_t(z)$ of the point %{p} up to the frame's $t$; dotted: the rest of the path; gray: the boundary at $t=0$.", { p: named[0] }) : named.length ? $t(" Solid: the paths $t\\mapsto H_t(z)$ of the points %{list} up to the frame's $t$; dotted: the rest of each path; gray: the boundary at $t=0$.", { list: joinL(named) }) : $t(' Gray: the boundary at $t=0$.')) + markS + hidden + dashed;
      if (fi.film === 'phaseGlobe') return $t('Phase portraits of $H_t$ on the Riemann sphere, with $\\infty$ at the north pole, at %{ts}: the color shows $\\arg H_t$ (key at right).', { ts }) + (fi.outline ? $t(' Black: the boundary of $X$.') : '') + along;
      if (fi.film === 'land') {
        const ht = { log: '\\log|H_t|', abs: '|H_t|', re: '\\operatorname{Re} H_t', im: '\\operatorname{Im} H_t' }[c.height || 'log'];
        let s2 = $t('Landscapes of $H_t$%{over} at %{ts}: the height is $%{ht}$', { over: fi.box ? $t(' over $%{box}$', { box: winTex(fi.box) }) : '', ts, ht });
        if (c.phase && o.ink !== 'bw') s2 += $t(' and the color shows $\\arg %{f}$', { f: 'H_t' });
        // (v16.1 review user-1: the frames draw H_t on F's sheets, as the single frame; its clause says so)
        const shf = c.sheets && c.sheets.hom && A.sheetsClause ? A.sheetsClause(c.sheets, 'tex', c.Fname) : null;
        s2 += shf ? sheetsTex(shf) : c.height === 'log' || c.height === 'abs' || !c.height ? $t('; zeros are pits and poles are peaks.') : '.';
        return s2 + along;
      }
      if (fi.film === 'phase') {
        const f = 'H_t', dc = fi.dc || 'enhanced', lv = $t('the thin lines are the level sets $\\arg %{f}\\in\\frac{\\pi}{6}\\mathbb{Z}$', { f });
        let s2 = $t('Phase portraits of $H_t$ on $%{box}$ at %{ts}', { box: winTex(fi.box), ts });
        if (fi.bw) s2 += $t(', drawn as level sets of $\\arg %{f}$ at multiples of $\\pi/6$; heavy: $\\arg %{f}=0$, dashed: $\\arg %{f}=\\pi$. Bands: $\\lfloor\\log_2|%{f}|\\rfloor$ even (gray) or odd (white).', { f });
        else if (dc === 'classic') s2 += $t(': brightness increases with $|%{f}|$, so zeros are black and poles white.', { f });
        else if (dc === 'modulus') s2 += $t(': the color shows $\\arg %{f}$ (key at right); the lines are level curves of $|%{f}|$ and of $\\arg %{f}$.', { f });
        else if (dc === 'grid') s2 += $t(': the color shows $\\arg %{f}$ (key at right); the lines are the preimages of the coordinate lines of the image plane.', { f });
        else if (dc === 'phase') s2 += $t(': the color shows $\\arg %{f}$ (key at right) and %{lv}.', { f, lv });
        else if (dc === 'cauchy') s2 += '.';
        else { const n = c.sectors || 12; s2 += $t(': the color shows $\\arg %{f}$ (key at right), %{lv}, and the shading steps in $|%{f}|$ by factors of $e^{2\\pi/%{n}}\\approx %{x}$; the white line is $|%{f}|=1$.', { f, lv, n, x: tnum(+Math.exp(2 * Math.PI / n).toFixed(2)) }); }
        if (fi.zp && fi.zp.some((z) => z.length)) s2 += $t(' Zeros are dots and poles are open circles.');
        return s2 + along;
      }
    }
    const homDef = () => (hm && c.hom ? $t(' Shown at $t=%{t}$.', { t: tnum(c.hom.T.toFixed(2)) }) + homSentence(c, map) : '');
    if (view === 'phase') {
      const f = hm ? 'H_t' : c.Fname, i = body.info, zs = i.zp.filter((r) => r.kind !== 'pole'), ps = i.zp.filter((r) => r.kind === 'pole');
      let s = $t('Phase portrait of %{map} on $%{box}$', { map: hm ? '$H_t$' : map, box: winTex(i.box) });
      if (i.bw) s += $t(', drawn as level sets of $\\arg %{f}$ at multiples of $\\pi/6$; heavy: $\\arg %{f}=0$, dashed: $\\arg %{f}=\\pi$. Bands: $\\lfloor\\log_2|%{f}|\\rfloor$ even (gray) or odd (white).', { f });
      else {
        const dc = c.dc || 'enhanced', lv = $t('the thin lines are the level sets $\\arg %{f}\\in\\frac{\\pi}{6}\\mathbb{Z}$', { f });
        if (dc === 'classic') s += $t(': brightness increases with $|%{f}|$, so zeros are black and poles white.', { f });
        else if (dc === 'cauchy') {
          const cc = c.cauchy, I = '\\frac{1}{2\\pi i}\\oint_\\gamma \\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta';
          if (cc && cc.kind === 'split' && cc.show === 'in') s += $t(': the Cauchy integral $%{I}$ over the selected closed curve, shown inside the curve, where it equals $f_+ = F$ minus its principal parts at the poles inside.', { I });
          else if (cc && cc.kind === 'split' && cc.show === 'out') s += $t(': the Cauchy integral $%{I}$ over the selected closed curve, shown outside the curve, where it equals $%{fm}$, the sum of the principal parts of $F$ at its poles inside the curve.', { I, fm: cc.plus ? '-f_-' : 'f_-' });
          else if (cc && cc.kind === 'split') s += $t(': the Cauchy integral $%{I}$ over the selected closed curve, which equals $f_+$ inside and $%{fm}$ outside, where $F = f_+ + f_-$ and $f_-$ is the sum of the principal parts of $F$ at its poles inside the curve.', { I, fm: cc.plus ? '-f_-' : 'f_-' });
          else if (cc && cc.kind === 'numeric') s += $t(': the Cauchy integral $%{I}$ over the selected closed curve, computed numerically ($F$ has a singularity inside the curve that is not a pole).', { I });
          else s += $t(': the Cauchy integral $\\frac{1}{2\\pi i}\\oint_\\gamma \\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta$ over the selected closed curve, which equals $F$ inside and $0$ outside.');
        }
        else if (dc === 'modulus') s += $t(': the color shows $\\arg %{f}$ (key at right); the lines are level curves of $|%{f}|$ and of $\\arg %{f}$.', { f });
        else if (dc === 'grid') s += $t(': the color shows $\\arg %{f}$ (key at right); the lines are the preimages of the coordinate lines of the image plane.', { f });
        else if (dc === 'phase') s += $t(': the color shows $\\arg %{f}$ (key at right) and %{lv}.', { f, lv });
        // (the white line is |F| = 1: the renderer's unit level, on screen as in print)
        else { const n = c.sectors || 12; s += $t(': the color shows $\\arg %{f}$ (key at right), %{lv}, and the shading steps in $|%{f}|$ by factors of $e^{2\\pi/%{n}}\\approx %{x}$; the white line is $|%{f}|=1$.', { f, lv, n, x: tnum(+Math.exp(2 * Math.PI / n).toFixed(2)) }); }
      }
      if (zs.length) s += zs.length <= 4 ? $t(' Zeros (dots) at %{list}.', { list: joinL(listTex(zs)) }) : $tn(' {n} zeros (dots).', ' {n} zeros (dots).', zs.length);
      if (ps.length) s += ps.length <= 4 ? $t(' Poles (open circles) at %{list}.', { list: joinL(listTex(ps)) }) : $tn(' {n} poles (open circles).', ' {n} poles (open circles).', ps.length);
      return s + homDef();
    }
    if (view === 'land') {
      const f = hm ? 'H_t' : c.Fname, ht = { log: `\\log|${f}|`, abs: `|${f}|`, re: `\\operatorname{Re} ${f}`, im: `\\operatorname{Im} ${f}` }[c.height || 'log'];
      // (all sheets: the multivalued function, Ln in Russian: GLOSSARY 2.2, review math-8; c.sheets: what the landscape
      // draws, null for the principal branch; the clause says exactly which sheets, also of H_t while deforming: v16.1 user-5)
      const shc = c.sheets && (hm || !c.sheets.hom) && A.sheetsClause ? A.sheetsClause(c.sheets, 'tex', c.Fname) : null;
      let s = $t('Landscape of %{map}%{over}: the height is $%{ht}$', { map: hm ? '$H_t$' : shc && I18 ? I18.notation(map, undefined, { multi: true }) : map, over: body.info.box ? $t(' over $%{box}$', { box: winTex(body.info.box) }) : '', ht });
      if (c.phase && o.ink !== 'bw') s += $t(' and the color shows $\\arg %{f}$', { f });
      // (while deforming, c.sheets.hom: the sheets of H_t that become those of F, notes/v16-user5/SHEETS-DESIGN.md; the
      // window k and H, F are math)
      s += shc ? sheetsTex(shc) : c.height === 'log' || c.height === 'abs' || !c.height ? $t('; zeros are pits and poles are peaks.') : '.';
      return s + homDef();
    }
    if (view === 'morph') {
      // (the paths figure keeps the morph figure's own caption: its inline F(z) = ... is displayed as everywhere)
      if (body.captionTex) {
        let cap = c.raw && c.mapTex ? body.captionTex.split(`$${c.mapTex}$`).join(MAPTOK) : body.captionTex;
        // (the steps it names are defined in the display that ends the homotopy's sentence: export review r3, editor-1)
        const hi = c.chain && c.raw && c.hom ? cap.indexOf(c.hom.tex) : -1;
        if (hi >= 0) cap = cap.slice(0, hi + c.hom.tex.length) + CHAINTOK + cap.slice(hi + c.hom.tex.length);
        return cap;
      }
      const i = body.info, ts = i.ts.map((t, k) => $t('(%{letter}) $t=%{t}$', { letter: ru ? RU_LETTERS[k] : String.fromCharCode(97 + k), t: i.labs[k] }));
      const dq = A.defo ? A.defo() : null;
      let s = dq && dq.qp ? $t('The deformation $H_t$ from $%{QP}$ ($t=0$) to %{map} ($t=%{m}$), at %{ts}.', { QP: dq.qp, map, m: tnum(i.m), ts: joinL(ts) }) + wDefS(dq) : $t('The deformation $H_t$ from the identity ($t=0$) to %{map} ($t=%{m}$), at %{ts}.', { map, m: tnum(i.m), ts: joinL(ts) });
      s += i.tracked.length ? $t(" Solid: the paths $t\\mapsto H_t(z)$ of the marked points up to the frame's $t$; dotted: the rest of each path; gray: the boundary at $t=0$.") : $t(' Gray: the boundary at $t=0$.');
      if (i.open) s += $t(' Dashed: boundary not included.');
      return s;
    }
    // the shape list in the genitive («образ круга»): the app gives it as shapeListGen; English has one form
    const genOf = () => (c.shapeListGen ? A.segsTex(us(c.shapeListGen)) : A.segsTex(us(c.shapeList)));
    // one merged panel: the deformation H_t (on the globe, or over a d/dz step), or Phase on the Riemann sphere
    const g = A.state();
    if (view === 'xyR' && c.hom) {
      const list0 = A.segsTex(us(c.shapeList));
      return $t('The deformation $H_t$%{choice}%{choice2}', {
        choice: g.rGlobe ? $t(' on the Riemann sphere, with $\\infty$ at the north pole') : '',
        choice2: list0 ? $t(': the image of %{list0} under $H_t$.', { list0: genOf() }) : '.' }) + $t(' Shown at $t=%{t}$.', { t: tnum(c.hom.T.toFixed(2)) }) + homSentence(c, map);
    }
    if (view === 'xyL' && g.main === 'phase') return $t('Phase portrait of %{choice} on the Riemann sphere, with $\\infty$ at the north pole: the color shows $\\arg %{choice2}$.%{homDef}', { choice: c.hm ? '$H_t$' : map, choice2: c.hm ? 'H_t' : c.Fname, homDef: homDef() });
    // X -> Y
    const i = body.info, two = i.panels.length === 2;
    const list = A.segsTex(us(c.shapeList));
    const cap1 = list ? list.charAt(0).toUpperCase() + list.slice(1) : '';
    const many = c.nShapes > 1, lvar = c.lvar;
    if (o.for === 'homework' || o.for === 'slides') {
      if (o.for === 'slides') return '';
      const wmap = c.raw ? MAPTOK : c.formula ? `$${A.panelVar('R')}=${c.formula}$` : map;
      let s = list ? (many ? $t('Left: %{list}. Right: their images under %{wmap}.', { list, wmap }) : $t('Left: %{list}. Right: its image under %{wmap}.', { list, wmap })) : $t('The map %{wmap}.', { wmap });
      if (!two) s = list ? (i.panels[0] === 'L' && !c.carried ? $t('%{cap1} in the $%{lvar}$-plane.', { cap1, lvar }) : many ? $t('The images of %{list} under %{map}.%{pat}', { list: genOf(), map: wmap, pat: '' }) : $t('The image of %{list} under %{map}.%{pat}', { list: genOf(), map: wmap, pat: '' })) : $t('The map %{wmap}.', { wmap });
      if (i.named && two) { const n = c.nPoints; const L = (k) => String.fromCharCode(65 + k); s += n === 1 ? $t(" The point $A$ goes to $A'$.") : $t(" The points $%{first}$--$%{n}$ go to $%{first}'$--$%{n}'$.", { first: L(0), n: L(n - 1) }); }
      if (i.open && PRESET[o.for].dashOpen) s += $t(' Dashed: boundary not included.');
      if (i.chevrons) s += $t(' Arrowheads: orientation.');
      return s;
    }
    const pat0 = A.segsTex(us(c.pattern)), pat = pat0 ? ' ' + pat0 : '';
    // (a) and (b): in Russian «а — круг …; б — образ …», the list in lower case after the dash
    const head = ru ? list : cap1;
    if (two) return list ? (many ? $t('(a) %{head} in the $%{lvar}$-plane. (b) Their images under %{map}.%{pat}', { head, lvar, map, pat }) : $t('(a) %{head} in the $%{lvar}$-plane. (b) Its image under %{map}.%{pat}', { head, lvar, map, pat })) : $t('(a) The %{lvar}-plane. (b) The image under %{map}.%{pat}', { lvar, map, pat });
    // (the steps view past its colour plane: the left panel shows the shapes carried there, their images)
    if (i.panels[0] === 'L' && !c.carried) return list ? $t('%{cap1} in the $%{lvar}$-plane.', { cap1, lvar }) : $t('The $%{lvar}$-plane.', { lvar });
    return list ? (many ? $t('The images of %{list} under %{map}.%{pat}', { list: genOf(), map, pat }) : $t('The image of %{list} under %{map}.%{pat}', { list: genOf(), map, pat })) : $t('The image under %{map}.%{pat}', { map, pat });
  }
  // a Russian caption as LaTeX: Russian notation (tg, sh, ln), no-break spaces (GLOSSARY 3.6) written as ~
  // ([v16.4 review user-2] first the closing comma a shape list left open (U+2063, app.js pcTidy): a comma before more
  // words, nothing before punctuation, an opening bracket, the English "and" or the end)
  const pcOut = (tex) => (typeof tex === 'string' && tex.includes('\u2063') ? tex.replace(/\u2063(?=\s*(?:[,.;:()]|and\b|$))/g, '').replace(/\u2063/g, ',') : tex);
  const polish = (tex, lang) => { tex = pcOut(tex); return lang === 'ru' && I18 && tex ? I18.nbspTeX(I18.nbsp(I18.notation(tex, 'ru'), 'ru')).replace(/—/g, '---') : tex; };
  // LaTeX caption -> typesetting segments ({t}, {m}, {b}; a Russian caption also {i}: the italic panel letters, and
  // ~ is a no-break space)
  function segsOf(tex, lang) {
    const out = [];
    const ru = (lang || XD.lang) === 'ru' || /[Ѐ-ӿ]/.test(String(tex || ''));
    // (a displayed formula, guarded or plain \[ ... \]: a segment {d} of its own)
    const parts = String(tex || '').split(/(\\ifinner\\hskip\\hsize\\else\\\[[\s\S]*?\\\]\\fi|\\\[[\s\S]*?\\\])/);
    for (const pt of parts) {
      const dm = /^(?:\\ifinner\\hskip\\hsize\\else)?\\\[([\s\S]*?)\\\](?:\\fi)?$/.exec(pt);
      if (dm) { out.push({ d: dm[1].trim() }); continue; }
      for (const part of pt.split(/(\$[^$]*\$)/)) segOne(part);
    }
    return out;
    function segOne(part) {
      if (!part) return;
      if (part[0] === '$' && part.length > 1 && part[part.length - 1] === '$') { out.push({ m: part.slice(1, -1) }); return; }
      for (const q of part.split(ru ? /(\\textbf\{[^}]*\}|\\textit\{[^}]*\})/ : /(\\textbf\{[^}]*\})/)) {
        if (!q) continue;
        const b = /^\\textbf\{([^}]*)\}$/.exec(q), it = ru ? /^\\textit\{([^}]*)\}$/.exec(q) : null;
        const un = (s) => s.replace(/---/g, '—').replace(/--/g, '–').replace(/\\"o/g, 'ö').replace(/\\"u/g, 'ü').replace(/\\"a/g, 'ä').replace(/\\([#$%&_{}])/g, '$1').replace(/~/g, ru ? ' ' : ' ').replace(/``|''/g, '"');
        out.push(b ? { b: un(b[1]) } : it ? { i: un(it[1]) } : { t: un(q) });
      }
    }
  }
  const plainOf = (tex, lang) => segsOf(tex, lang).map((s) => (s.d != null ? ` ${plainMath(s.d.replace(/\\displaystyle\s*/g, ''))} ` : s.m != null ? plainMath(s.m) : s.b != null ? s.b : s.i != null ? s.i : s.t)).join('').replace(/ {2,}/g, ' ');
  const plainMath = (m) => m.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\(operatorname|mathrm|text)\{([^}]*)\}/g, '$2').replace(/\\[a-zA-Z]+/g, (m) => ({ '\\pi': 'π', '\\infty': '∞', '\\arg': 'arg', '\\log': 'log', '\\times': '×', '\\mapsto': '↦', '\\in': '∈', '\\le': '≤', '\\pm': '±' }[m] || '')).replace(/[{}]/g, '');
  // (the steps view: the stage's window, As on screen, unless a crop is asked for)
  const defaults = () => ({ for: 'article', cols: 1, sizeId: null, text: null, ink: 'colour', crop: A && A.svOn && A.svOn() ? 'screen' : 'fit', axes: null, panels: 'both', deform: 'film' });
  // (export review r3, editor-2) the default file name and \label: the scene, the view and the kind of figure, so two
  // different figures never share a file or a label (strip-to-disk-phase-film, strip-to-disk-globe-paths, ...); the
  // name stays the same for the same figure, so a new export replaces only its own file
  function defaultName(view, deform, fmt) {
    // (the app's scene name ends with the tag of the view on screen: the base is the scene alone)
    const sn = (A && A.sceneName()) || 'figure', suf = { phase: '-phase', land: '-landscape', morph: '-deformation' }[A.viewKind()];
    const base = suf && sn.endsWith(suf) ? sn.slice(0, -suf.length) : sn;
    const defo = defoOf(view), tag = { plane: 'deformation', deriv: 'deformation', globe: 'globe', phase: 'phase', phaseGlobe: 'phase-sphere', land: 'landscape' }[defo];
    if (fmt === 'video') return defo ? `${base}-${tag}-video` : base;
    if (defo) return `${base}-${tag}-${deform === 'paths' && PATHS_OK.has(defo) ? 'paths' : deform === 'frame' && defo !== 'plane' ? 'frame' : 'film'}`;
    if (view === 'svFilm') return `${base}-filmstrip`;
    if (view === 'phase') return `${base}-phase`;
    if (view === 'land') return `${base}-landscape`;
    if (view === 'xyL' && A.state().main === 'phase') return `${base}-phase-sphere`;
    return base;
  }
  // (export review r3, editor-4) the list-of-figures entry of a caption with a display: a template of its own, under
  // about 100 characters; null: the text before the display (shortCaption). Called inside using(lang)
  function shortFor(view, body) {
    const fi = body.info || {}, c = A.capParts(), ts = fi.labs ? `$t=${fi.labs.join(',\\,')}$` : '';
    if (fi.svFilm) return $t('The planes along %{chain}.', { chain: svChain(fi.frames) });
    const at = c.hom ? `$t=${tnum(c.hom.T.toFixed(2))}$` : '';
    if (fi.globePaths) return $t('Paths of the deformation $H_t$ on the Riemann sphere.');
    if (fi.film === 'globe') return $t('The deformation $H_t$ on the Riemann sphere at %{ts}.', { ts });
    if (fi.film === 'phaseGlobe') return $t('Phase portraits of $H_t$ on the Riemann sphere at %{ts}.', { ts });
    if (fi.film === 'land') return $t('Landscapes of $H_t$ at %{ts}.', { ts });
    if (fi.film === 'phase') return $t('Phase portraits of $H_t$ at %{ts}.', { ts });
    if (view === 'morph') return fi.labs ? $t('The deformation $H_t$ at %{ts}.', { ts }) : $t('Paths of the deformation $H_t$.');
    if (view === 'xyR' && c.hom) return A.state().rGlobe ? $t('The deformation $H_t$ on the Riemann sphere at %{ts}.', { ts: at }) : $t('The deformation $H_t$ at %{ts}.', { ts: at });
    if (c.hm && c.hom && view === 'phase') return $t('Phase portrait of $H_t$ at %{ts}.', { ts: at });
    if (c.hm && c.hom && view === 'land') return $t('Landscape of $H_t$ at %{ts}.', { ts: at });
    if (c.hm && c.hom && view === 'xyL') return $t('Phase portrait of $H_t$ on the Riemann sphere at %{ts}.', { ts: at });
    if (view === 'phase') return $t('Phase portrait of $%{F}$.', { F: c.Fname });
    if (view === 'land') return $t('Landscape of $%{F}$.', { F: c.Fname });
    return $t('The image under $%{F}$.', { F: c.Fname });
  }
  // build(o): the figure for the current view. o: {for, cols, sizeId, customPt, text, ink, crop, axes, panels, deform,
  // name, captionTex (an edited caption), capInImage, view, alive}. -> {svg, W, H, boxes, lines, glyphs, meta,
  // captionTex, name, view, Wtex, ...} or null when cancelled
  // (#288) a pass that met a range of MathJax's STIX2 font not yet loaded (XD.waits, 01-composer.js) is built again
  // once the ranges are in, at most 8 passes (a range that cannot load: its formulas print as their TeX source)
  async function build(opts) {
    for (let pass = 0; ; pass++) {
      XD.waits = [];
      const fig = await buildOnce(opts);
      if (!fig || !XD.waits.length || pass >= 7) return fig;
      await Promise.all(XD.waits.map((p) => p.catch(() => {})));
      if (opts && opts.alive && !opts.alive()) return null;
    }
  }
  async function buildOnce(opts) {
    if (!A) throw new Error('Figure is not attached');
    // (an export or a rebuild that comes before MathJax is ready waits for it; null when the caller has gone, an error after the timeout)
    if (!XD.ready() && !(await XD.whenReady(20000, (opts && opts.alive) || undefined))) {
      if (opts && opts.alive && !opts.alive()) return null;
      throw new Error('MathJax did not load in time');
    }
    const o = Object.assign(defaults(), opts || {});
    const P = Object.assign({}, PRESET[o.for] || PRESET.article);
    const size = sizeOf(o), Wtex = size.pt, W = XD.bp(Wtex);
    const tsz = o.text || (o.for === 'homework' || o.for === 'slides' ? 11 : 10);
    const T = TYPE[o.for][tsz] || TYPE.article[10];
    if (o.axes) P.axes = o.axes;
    // a slide's figure fits under the frame title (16:9: about half its width tall)
    P.maxH = o.for === 'slides' ? 0.5 * W : Infinity;
    const view = o.view || (o.svPic === 'film' && A.svOn && A.svOn() ? 'svFilm' : A.viewKind());
    const name = (o.name || defaultName(view, o.deform) || 'figure').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'figure';
    // the caption language: o.lang ('en' | 'ru' | 'it'), else the interface's
    const lang = o.lang === 'en' || o.lang === 'ru' || o.lang === 'it' ? o.lang : uiLang();
    XD.begin(name, lang);
    const t0 = performance.now();
    let body;
    // (round 3) the deformation is exported as a deformation in every view: the filmstrip, the paths (plane, globe),
    // or the frame at the current t (o.deform 'frame', the earlier one-panel figure)
    const defo = defoOf(view);
    if (defo && defo !== 'plane' && o.deform !== 'frame') body = null;
    else if (view === 'svFilm') body = await figSvFilm(o, P, W, T);
    else if (view === 'phase') body = await figPhase(o, P, W, T);
    else if (view === 'land') body = await figLand(o, P, W, T);
    if (body) { /* made */ }
    else if (view === 'morph') body = o.deform === 'paths' ? await figPaths(o, P, W, T) : await figFilm(o, P, W, T);
    else if (defo && o.deform !== 'frame') body = defo === 'globe' && o.deform === 'paths' ? await figGlobePaths(o, P, W, T) : defo === 'phase' ? await figFilmPhase(o, P, W, T) : defo === 'deriv' ? await figFilm(o, P, W, T) : await figFilmPic(o, P, W, T, defo);
    else body = await figXY(view === 'xyL' || view === 'xyR' ? Object.assign({}, o, { panels: view === 'xyL' ? 'L' : 'R' }) : o, P, W, T, view);
    if (!body || (o.alive && !o.alive())) return null;
    const autoCap = polish(using(lang, () => { const cp = A.capParts(); return displayF(captionFor(o, view, body), cp, 0.88 * W, T[2], view === 'land' && !cp.hm && !!cp.sheets); }), lang);
    const shortCap = polish(using(lang, () => shortFor(view, body)), lang);
    const cp = using(lang, () => A.capParts()), Fn = view === 'morph' || (cp.hm && (view === 'phase' || view === 'land')) ? 'H_t' : cp.Fname;
    const film = view === 'morph' || (body.info && (body.info.film || body.info.globePaths));
    // (export review r3, editor-14) a slide names F: in its title when the formula is short, else displayed under the figure
    const slideF = cp.raw ? `${cp.Fname}(${cp.lvar})=${tidyTex(cp.raw)}` : null, slideFin = !!slideF && slideF.length <= 48;
    const slideTitle = polish(using(lang, () => (film ? (slideFin ? $t('The deformation $H_t$ to $%{F}$', { F: slideF }) : $t('The deformation $H_t$')) : view === 'phase' ? $t('Phase portrait of $%{Fn}$', { Fn }) : view === 'land' ? $t('Landscape of $%{Fn}$', { Fn }) : view === 'morph' ? $t('The deformation $H_t$') : cp.mapTex && cp.mapTex.length < 60 ? $t('The map $%{mapTex}$', { mapTex: cp.mapTex }) : $t('The map $%{Fn}$', { Fn }))), lang);
    const captionTex = o.captionTex != null ? o.captionTex : autoCap;
    let H = body.H;
    const items = body.items.slice();
    if (o.capInImage && captionTex) {
      await warmCaption(captionTex, T[2], lang);
      if (o.alive && !o.alive()) return null;
      const c = XD.caption([{ b: using(lang, () => $t('Figure 1.')) }, { t: ' ' }, ...segsOf(captionTex, lang)], 0, H + 7, W, T[2]);
      items.push(c.markup); H += 7 + c.h + 2;
    }
    const meta = { app: 'Complex Map Workbench', name, preset: o.for, ink: o.ink, view, width: `${Wtex}pt`, scene: A.sceneMeta() };
    const fig = XD.svg({ W, H, items, defs: body.defs, lines: body.lines, meta });
    // (box: the picture's world window, a plane panel's, for a check against the screen)
    return Object.assign(fig, { box: (body.info && (body.info.box || (body.info.boxes && body.info.boxes.L))) || null, name, captionTex, autoCaption: autoCap, shortCap, slideTitle, slideF: slideF && !(film ? slideFin : cp.mapTex && cp.mapTex.length < 60) ? polish(slideF, lang) : null, view, for: o.for, Wtex, size, T, star: !!size.star, cols: o.cols, ink: o.ink, ms: Math.round(performance.now() - t0), info: body.info, opts: o, lang });
  }
  // the caption typeset alone, as LaTeX would set it under the figure ("Figure 1." in bold), for the paper preview
  // (round 3) a caption's words typeset ahead, in slices with a yield once 8 ms have passed: the cache then serves
  // captionSVG and the image's own caption at once (a long caption is a hundred MathJax calls, 30-50 ms in one task)
  async function warmCaption(tex, pt, lang) {
    const segs = [{ b: using(lang, () => $t('Figure 1.')) }, ...segsOf(tex, lang)], items = [];
    for (const s of segs) {
      if (s.d != null) { items.push(`\\displaystyle ${s.d.replace(/^\\displaystyle\s*/, '')}`); continue; }
      if (s.m != null) { items.push(s.m); continue; }
      const text = s.b != null ? s.b : s.i != null ? s.i : s.t;
      for (const p of String(text).split(lang === 'ru' ? /([ \t\r\n]+)/ : /(\s+)/)) {
        if (!p || (lang === 'ru' ? /^[ \t\r\n]+$/.test(p) : /^\s+$/.test(p))) continue;
        const esc = p.replace(/[\\#$%&_{}]/g, (c) => (c === '\\' ? '' : '\\' + c));
        items.push(s.b != null ? `\\textbf{${esc}}` : s.i != null ? `\\textit{${esc}}` : `\\text{${esc}}`);
      }
    }
    let t0 = performance.now();
    for (const it of items) {
      const keep = XD.lang;
      XD.lang = lang || 'en';
      try { XD.tex(it, pt); } finally { XD.lang = keep; }
      if (performance.now() - t0 > 8) { await breathe(); t0 = performance.now(); }
    }
  }
  function captionSVG(tex, Wbp, pt, lang) {
    const keep = { name: XD.name, ns: XD.ns, glyphs: XD.glyphs, boxes: XD.boxes, lang: XD.lang };
    try {
      XD.begin('caption', lang || 'en');
      const c = XD.caption([{ b: using(lang, () => $t('Figure 1.')) }, { t: ' ' }, ...segsOf(tex, lang)], 0, 0, Wbp, pt);
      return XD.svg({ W: Wbp, H: c.h + pt * 0.3, items: [c.markup] });
    } finally { Object.assign(XD, keep); }
  }
  const layoutOf = (fig) => (fig.for === 'homework' ? '\\linewidth' : fig.star ? '\\textwidth' : fig.cols === 2 ? '\\columnwidth' : '\\linewidth');
  // the snippet for a format: 'pdf' (natural size), 'png' (an explicit width: a raster has no size of its own that every
  // engine reads), 'svg' (\includesvg: the svg package runs Inkscape). F's displayed formula keeps the list of figures
  // working through \caption[short]{long}
  const latex = (fig, captionTex, fmt = 'pdf', dpi = 300) => using(fig.lang, () => latexIn(fig, captionTex, fmt, dpi));
  function latexIn(fig, captionTex, fmt = 'pdf', dpi = 300) {
    const cap0 = guardDisplays(captionTex != null ? captionTex : fig.captionTex);
    const n = fig.name, w = +fig.Wtex.toFixed(2), size = $t(fig.size.label).replace(/^[А-ЯЁ]/, (c) => c.toLowerCase());
    const engMain = fig.lang === 'ru' ? [$t('% English main document: \\usepackage[T2A,T1]{fontenc}\\usepackage[russian,english]{babel}')] : [];
    const ru = (t) => (fig.lang === 'ru' && t ? `\\foreignlanguage{russian}{${t}}` : t);
    const sc0 = shortCaption(cap0), sc = sc0 && fig.shortCap && (fig.view !== 'xy' || sc0.length > 100) ? fig.shortCap : sc0, cap = ru(cap0);
    // (the short caption in braces: a window [a,b] x [c,d] in it would end the optional argument early)
    const capLine = sc ? `  \\caption[{${ru(sc)}}]{${cap}}` : `  \\caption{${cap}}`;
    const ext = fmt === 'png' ? '.png' : fmt === 'svg' ? '.svg' : '.pdf';
    const file = `${n}${ext}`;
    const shrink = `\\ifdim\\linewidth<${w}pt \\linewidth\\else ${w}pt\\fi`;
    const inc = (width) => (fmt === 'svg' ? `  \\includesvg[width=${width}]{${n}}` : fmt === 'png' ? `  \\includegraphics[width=${width}]{${file}}` : width ? `  \\includegraphics[width=${width}]{${n}}` : `  \\includegraphics{${n}}`);
    const pre = (more) => (fmt === 'svg' ? $t('% Preamble: \\usepackage{graphicx,amsmath,amssymb,svg%{more}} (svg runs Inkscape: compile with --shell-escape; Overleaf does both)', { more }) : $t('% Preamble: \\usepackage{graphicx,amsmath,amssymb%{more}}', { more }));
    const upload = fmt === 'pdf' ? [] : [fmt === 'png' ? $t('% Upload %{file} (PNG, %{dpi} dpi) next to your .tex file (Overleaf: the file tree).', { file, dpi }) : $t('% Upload %{file} next to your .tex file (Overleaf: the file tree).', { file })];
    if (fig.for === 'homework') return [
      $t('% %{n}.pdf is made for \\linewidth = %{w}pt (%{size}); natural size wherever it fits, shrunk only on a narrower page.', { n, w, size }).replace(`${n}.pdf`, file),
      ...upload,
      pre(',float'),
      ...engMain,
      '\\begin{figure}[H]',
      '  \\centering',
      inc(shrink),
      capLine,
      `  \\label{fig:${n}}`,
      '\\end{figure}', ''].join('\n');
    if (fig.for === 'slides') return [
      $t('% %{n}.pdf is made for \\textwidth = %{w}pt (%{size}); shrunk only on a narrower frame. Preamble: \\usepackage{graphicx}', { n, w, size }).replace(`${n}.pdf`, file),
      ...upload,
      ...(fmt === 'svg' ? [pre('')] : []),
      // (a Russian title too sits in \\foreignlanguage: an English-main document sets it in T2A)
      `\\begin{frame}{${fig.slideTitle ? ru(fig.slideTitle) : n}}`,
      '  \\centering',
      inc(shrink),
      ...(fig.slideF ? [`  \\[ \\displaystyle ${fig.slideF} \\]`] : []),
      '\\end{frame}', ''].join('\n');
    const L = layoutOf(fig), env = fig.star ? 'figure*' : 'figure';
    return [
      $t('% %{n}.pdf is made for %{L} = %{w}pt (%{size}); include it unscaled so its labels match your text.', { n, L, w, size }).replace(`${n}.pdf`, file),
      ...upload,
      fmt === 'pdf' ? $t('% If your %{L} is narrower, use [width=%{L}] (the labels will shrink). Preamble: \\usepackage{graphicx,amsmath,amssymb}', { L }) : pre(''),
      ...engMain,
      `\\begin{${env}}[tbp]`,
      '  \\centering',
      inc(fmt === 'pdf' ? null : shrink),
      capLine,
      `  \\label{fig:${n}}`,
      `\\end{${env}}`, ''].join('\n');
  }
  const pdf = (fig) => XD.pdf(fig);
  async function png(fig, dpi = 300) { const r = await XD.pngBytes(fig, dpi, fig.ink === 'bw'); return new Blob([r.bytes], { type: 'image/png' }); }
  const svgBlob = (fig) => new Blob([fig.svg], { type: 'image/svg+xml' });
  async function greyProof(fig, dpi = 150) { const r = await XD.pngBytes(fig, dpi, true); return new Blob([r.bytes], { type: 'image/png' }); }
  // For Docs: image/png + text/html (an <img> at its printed width, the caption as its alt text); else a selection
  // copy of the image; else false (the caller saves the PNG)
  async function copyImage(fig) {
    const blob = await png(fig, 300);
    const url = 'data:image/png;base64,' + b64(new Uint8Array(await blob.arrayBuffer()));
    const wpx = Math.round(fig.W / 72 * 96);
    const alt = plainOf(fig.captionTex || '', fig.lang).replace(/"/g, '&quot;');
    const html = `<img src="${url}" width="${wpx}" style="width:${(fig.W / 72).toFixed(2)}in" alt="${alt}">`;
    try {
      if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob, 'text/html': new Blob([html], { type: 'text/html' }) })]);
        return 'clipboard';
      }
    } catch (e) { /* fall through to a selection copy */ }
    try {
      const host = document.createElement('div');
      host.contentEditable = 'true';
      host.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
      host.innerHTML = html;
      document.body.append(host);
      const r = document.createRange(); r.selectNodeContents(host);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      const ok = document.execCommand && document.execCommand('copy');
      sel.removeAllRanges(); host.remove();
      if (ok) return 'selection';
    } catch (e) { /* fall through */ }
    return false;
  }

