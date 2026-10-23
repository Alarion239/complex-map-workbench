# -*- coding: utf-8 -*-
# Placeholders in the Russian tables (review i18n-4, i18n-5; DESIGN.md 1). Shared by math_src/build.py and fixes_r4.py.
#
# I18N.fill() fills %{name} always, and {name} only in a template with no TeX ($ or a backslash), because TeX writes
# ^{n}, _{k}, e^{t} as groups. A name is an identifier. The inventory shows each `${expr}` of the source as {label}
# (for example {2}, {hom.m}, or {x} twice for two values), so the tables need:
#   - in every Russian string (ru, ru_short, plural forms, split values) of a template with TeX: %{name};
#   - one identifier per value (renamed labels);
#   - en_key: the English template the phase-2 call site writes (the same names, %{} with TeX). It renders exactly the
#     English text; the table key is en_key, not the inventory text. ph maps each renamed name to what it stands for
#     in en ("{2}", or a literal such as "," for a slot English fills with a constant).
#   - en_plural: [one, many] for every plural entry (the $tn key is one + U+0004 + many); the count is {n}.
# The pass is idempotent.
import re

HAS_TEX = re.compile(r'[$\\]')
IDENT = re.compile(r'[A-Za-z_][A-Za-z0-9_]*$')
TEX_ARG = re.compile(r'\\[A-Za-z]+\*?$')   # {x} right after a TeX command is its argument, not a placeholder

def labels_of(inv_entry):
    """[(label, value)] in order of occurrence, from the inventory context ("placeholders: {a} = …; {b} = …")."""
    if not inv_entry: return None
    m = re.search(r'placeholders: (.*)$', inv_entry.get('context', ''))
    if not m: return []
    return re.findall(r'\{([^{}]+?)\} = (.*?)(?=; \{[^{}]+?\} = |$)', m.group(1))

# names for labels that are not identifiers, by value (most specific) or by label
BY_VALUE = {
    'c.hom.T.toFixed(2)': 't', 't.toFixed(2)': 't', 'c.hom.m': 'tEnd', 'c.hom.tex': 'hom',
    'L(0)': 'first', "a.slice(0, -1).join(', ')": 'head', 'expoTex(1 + 2 * (an - 1))': 'odd',
    'String.fromCharCode(97 + i)': 'letter',
    'num(Math.min(s.a[0], s.b[0]))': 'xMin', 'num(Math.max(s.a[0], s.b[0]))': 'xMax',
    'num(Math.min(s.a[1], s.b[1]))': 'yMin', 'num(Math.max(s.a[1], s.b[1]))': 'yMax',
    'num(s.t1)': 't1', 'num(s.t1 + span)': 't1End',
}
BY_LABEL = {
    'Math.atan2': 'deg', 'Math.exp': 'k', 'CX.abs': 'modulus', 'CX.sub': 'diff', 'snd.kz': 'z', 'BADGES.length': 'nBadges',
    'ICONS.paths': 'iconPaths', 'MODE_ICONS.morph': 'iconMorph', 'Funcs.ZP_MAX': 'zpMax', 'TH.pole': 'poleColor',
    'XD.ns': 'ns', 'alpha.re': 'alphaRe', 'cp.mapTex': 'mapTex', 'cp.name': 'name', 'def.label': 'label', 'gone.length': 'nGone',
    'info.box': 'box', 'items.parseErr': 'parseErr', 'ms.K': 'K', 'ms.total': 'total', 'nb.error': 'error',
    'nextCh.title': 'nextTitle', 'palState.sel': 'sel', 'plan.what': 'what', 'ps.length': 'nPoles', 'pts.length': 'nPts',
    'resume.title': 'resumeTitle', 'sols.length': 'nSols', 'size.label': 'size', 'step.type': 'type', 'sz.pt': 'pt',
    'zs.length': 'nZeros', 's.id': 'name', 'hom.m': 'tEnd', 'hom.tex': 'hom',
}

def name_for(label, value):
    if value in BY_VALUE: return BY_VALUE[value]
    if label in BY_LABEL: return BY_LABEL[label]
    if IDENT.match(label): return label
    parts = [p for p in re.split(r'[^A-Za-z0-9_]+', label) if p]
    if len(parts) >= 2 and len(parts[0]) == 1: parts = parts[1:]          # c.lvar -> lvar, r.mult -> mult
    if not parts: return 'v'
    out = parts[0][0].lower() + parts[0][1:] + ''.join(p[:1].upper() + p[1:] for p in parts[1:])
    return out if IDENT.match(out) else 'v' + out

def plan(labels, count_label=None):
    """[(label, name)] per occurrence: one identifier per distinct value; the plural count becomes n."""
    out, seen_val, used = [], {}, set()
    for label, value in labels:
        key = (label, value)
        if key in seen_val: out.append((label, seen_val[key])); continue
        nm = 'n' if count_label is not None and label == count_label else name_for(label, value)
        base, i = nm, 2
        while nm in used: nm = f'{base}{i}'; i += 1
        used.add(nm); seen_val[key] = nm; out.append((label, nm))
    return out

def _sub_seq(s, pairs, tex):
    """replace the placeholder occurrences of s, label by label in order, with the planned names"""
    queues = {}
    for label, nm in pairs: queues.setdefault(label, []).append(nm)
    used = {k: 0 for k in queues}
    def rep(m):
        pre, label = s[:m.start()], m.group(1)
        if label not in queues or pre.endswith('%') or (tex and TEX_ARG.search(pre)): return m.group(0)
        q = queues[label]; nm = q[min(used[label], len(q) - 1)]; used[label] += 1
        return ('%{' if tex else '{') + nm + '}'
    return re.sub(r'\{([^{}\s]+?)\}', rep, s)

def _names_seq(pairs):
    return [nm for _, nm in pairs]

def ru_strings(rec):
    """(container, key) for every Russian string of a record"""
    out = []
    for f in ('ru', 'ru_short'):
        if isinstance(rec.get(f), str): out.append((rec, f))
    for f in ('plural',):
        if isinstance(rec.get(f), dict): out += [(rec[f], k) for k in rec[f]]
    if isinstance(rec.get('split'), dict):
        for k, v in rec['split'].items():
            if isinstance(v, str): out.append((rec['split'], k))
            elif isinstance(v, dict): out += [(v, f) for f in v]
    return out

def convert(rec, inv_entry, count_label=None, chips=False):
    """the pass for one record; returns a list of problems (strings)"""
    en = rec.get('en') or ''
    if chips or rec.get('keep'): return []
    labels = labels_of(inv_entry)
    probs = []
    if labels is None:
        # an entry the inventory lacks (.extra.): its slots are already identifiers; only the %{} form changes
        for c, k in ru_strings(rec):
            s = c[k]
            if HAS_TEX.search(s):
                c[k] = re.sub(r'(?<![%\w])\{([A-Za-z_][A-Za-z0-9_]*)\}', lambda m: m.group(0) if TEX_ARG.search(s[:m.start()]) else '%{' + m.group(1) + '}', s)
        if HAS_TEX.search(en) and 'en_key' not in rec and 'en_split' not in rec:
            k2 = re.sub(r'(?<![%\w])\{([A-Za-z_][A-Za-z0-9_]*)\}', lambda m: m.group(0) if TEX_ARG.search(en[:m.start()]) else '%{' + m.group(1) + '}', en)
            if k2 != en: rec['en_key'] = k2
        return probs
    if not labels: return probs
    occ = [m.group(1) for m in re.finditer(r'\{([^{}\s]+?)\}', en)]
    # every label occurrence must be a {label} of en, in order
    i = 0
    for o in occ:
        if i < len(labels) and o == labels[i][0]: i += 1
    if i != len(labels): return ['labels do not match en']
    pairs = plan(labels, count_label)
    renamed = any(lb != nm for lb, nm in pairs)
    tex_en = bool(HAS_TEX.search(en))
    if not renamed and not tex_en: return probs
    for c, k in ru_strings(rec):
        s = c[k]
        c[k] = _sub_seq(s, pairs, bool(HAS_TEX.search(s)))
    if 'en_key' not in rec:
        key = _sub_seq(en, pairs, tex_en)
        if key != en: rec['en_key'] = key
        ph = {nm: '{' + lb + '}' for lb, nm in pairs if lb != nm}
        if ph: rec['ph'] = dict(sorted(ph.items()))
    return probs

def roundtrip(rec):
    """en_key with every slot put back must give en exactly (English unchanged)"""
    k = rec.get('en_key')
    if not k: return True
    ph = rec.get('ph') or {}
    tex = bool(HAS_TEX.search(k))
    def back(m):
        nm = m.group(2)
        if m.group(1) or not tex: return ph.get(nm, '{' + nm + '}')
        return m.group(0)
    return re.sub(r'(%?)\{([A-Za-z_][A-Za-z0-9_]*)\}', lambda m: back(m) if (m.group(1) or not tex) else m.group(0), k) == rec['en']

def bare_in_tex(s, allowed=()):
    """bare {ident} slots left in a TeX-bearing Russian string (TeX command arguments excluded)"""
    if not HAS_TEX.search(s): return []
    out = []
    for m in re.finditer(r'(?<![%\w])\{([A-Za-z_][A-Za-z0-9_]*)\}', s):
        if TEX_ARG.search(s[:m.start()]) or m.group(1) in allowed: continue
        out.append(m.group(1))
    return out
