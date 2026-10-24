#!/usr/bin/env python3
# Builds the shipped Russian table, src/i18n_ru.js, from the id-keyed tables of phase 1 (notes/i18n/ru/*.json), the
# inventory (notes/i18n/inventory.json), the prototype's sample table (notes/i18n/proto/ru.json) and this phase's own
# entries (tools/ru_extra.json). Re-run it whenever a table or a $t() call site changes:
#     python3 tools/make_ru_table.py            (writes src/i18n_ru.js and tools/ru_report.json)
#     python3 tools/make_ru_table.py --strict   (also fails when a call site has no Russian entry)
#
# Keys are the English source (notes/i18n/DESIGN.md 1): $t(s) -> s, $tx(ctx, s) -> ctx + U+0004 + s,
# $tn(one, many, n) -> one + U+0004 + many. Two kinds of entries:
#   1. every table entry, keyed by the template its phase-2 call site writes: en_key when the table gives one (round 4
#      of the review, notes/i18n/ru/ph.py: one identifier per value, %{name} with TeX), en_plural (one + U+0004 +
#      many) for a plural, else the inventory text (what page.html's walker looks up);
#   2. every $t/$tx/$tn literal in src/*.js (the call sites). A call site whose template differs from the entry's
#      template only in its placeholder names ('{n}' for '{nPts}', '%{a}' for '%{P}') is matched with the placeholders
#      replaced by a marker, and the Russian placeholders are renamed to the call site's: by name, or occurrence by
#      occurrence when one name stands for two values. Entries without en_key fall back to the inventory text, with
#      the names its context lists. The Russian always writes '%{name}', which i18n.js fills in any template.
#      tools/ru_extra.json wins over both (templates restructured in code, Russian-only messages).
# The table is written as one JSON string inside a JS call, I18N.define('ru', "..."): English never parses it.
import json, re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
notes = root / 'notes' / 'i18n'
CTX = '\u0004'
inv_doc = json.load(open(notes / 'inventory.json'))
inv = {e['id']: e for e in inv_doc['entries']}
C = json.load(open(notes / 'ru' / 'chrome.json'))
M = json.load(open(notes / 'ru' / 'math.json'))
G = json.load(open(notes / 'ru' / 'guide-tour.json'))
sample = json.load(open(notes / 'proto' / 'ru.json'))
extra_doc = json.load(open(root / 'tools' / 'ru_extra.json'))
extra = {k: v for k, v in extra_doc.items() if not k.startswith('_')}
# phase 2b's new strings (notes/i18n/ru/phase2b*.json): id -> {en, ru, plural, en_plural, ctx, note}. Keyed like the
# call sites ($tx: ctx + U+0004 + en; $tn: one + U+0004 + many), and they win like tools/ru_extra.json
# (v15: the redesign's strings, notes/i18n/ru/v15-<area>.json, after phase 2b's; a v15 table whose build is not merged
# into this tree yet is left out, so its strings and its changes to shared ones arrive with its sources)
# (v15.1: three tables were written after v15. The video preview (work/xvv) and the phone tour's step toggle
# (work/xvp) are merged now; the formula recognizer's sources are not in this tree yet, so its table waits for them.)
V15_NOT_HERE = {'v15-recognize.json'}
for f in sorted((notes / 'ru').glob('phase2b*.json'), key=lambda p: (p.name == 'phase2b-fixes.json', p.name)) + sorted(p for p in (notes / 'ru').glob('v15-*.json') if p.name not in V15_NOT_HERE):  # the review fixes last
    for k, v in json.load(open(f)).items():
        if k.startswith('_') or not isinstance(v, dict) or v.get('ru') is None and not v.get('plural'):
            continue
        pl = v.get('en_plural')
        key = pl[0] + CTX + pl[1] if v.get('plural') and isinstance(pl, list) else (v['ctx'] + CTX if v.get('ctx') else '') + v['en']
        extra[key] = v.get('plural') or v['ru']

entries = [(k, v) for k, v in C.items() if k != '_meta'] + list(M['entries'].items()) + list(G.items())
entries += [(k, v) for k, v in M.get('missing_from_inventory', {}).items()]

# ---------------- placeholders ----------------
PH_ID = r'[A-Za-z_][A-Za-z0-9_.]*'


def inv_names(k, v):
    """The placeholder names of an inventory text, in order of occurrence, from its context when it lists them."""
    ctx = inv.get(k, {}).get('context', '')
    m = re.search(r'placeholders: (.*)$', ctx)
    if m:
        return [n for n in re.findall(r'\{(' + PH_ID + r')\} = ', m.group(1))]
    return re.findall(r'\{(' + PH_ID + r')\}', v.get('en') or '')


def inv_split(text, names):
    """[(literal, name), ...] splitting text at its placeholders (names: the set the context lists)."""
    allowed = set(names)
    out, last = [], 0
    for m in re.finditer(r'\{(' + PH_ID + r')\}', text):
        if m.group(1) in allowed:
            out.append((text[last:m.start()], m.group(1)))
            last = m.end()
    out.append((text[last:], None))
    return out


def key_split(key):
    """The same for a call-site template, with i18n.js's rule: %{name} always, {name} only without TeX."""
    tex = re.search(r'[$\\]', key) is not None
    out, last = [], 0
    for m in re.finditer(r'%\{([A-Za-z_][A-Za-z0-9_]*)\}|\{([A-Za-z_][A-Za-z0-9_]*)\}', key):
        name = m.group(1) or (None if tex else m.group(2))
        if not name:
            continue
        out.append((key[last:m.start()], name))
        last = m.end()
    out.append((key[last:], None))
    return out


norm = lambda parts: '\u0000'.join(lit for lit, _ in parts)


def rename(ru, en_names, en_order, key_order):
    """Rename the Russian placeholders: the j-th occurrence of name N in the English is key_order[i] where
    en_order[i] is that occurrence; the Russian's j-th N takes the same target."""
    occ = {}
    for i, n in enumerate(en_order):
        occ.setdefault(n, []).append(key_order[i])
    seen = {}
    allowed = set(en_names)

    def sub(m):
        n = m.group(1)
        if n not in allowed or n not in occ:
            return m.group(0)
        j = seen.get(n, 0)
        seen[n] = j + 1
        lst = occ[n]
        return '%{' + lst[min(j, len(lst) - 1)] + '}'
    return re.sub(r'%?\{(' + PH_ID + r')\}', sub, ru)


def map_val(val, f):
    return {k: f(x) for k, x in val.items()} if isinstance(val, dict) else f(val)


# ---------------- 1. the inventory, keyed by English ----------------
table, by_en, collisions = {}, {}, {}
SHORT_KINDS = {'button', 'menu', 'placeholder', 'heading', 'palette'}
def en_pl(v):
    """en_plural as [one, many] (a split entry's en_plural is a dict of them: phase 2b keys those by hand)"""
    p = v.get('en_plural')
    return p if isinstance(p, list) and len(p) == 2 else None


def key_of(v):
    if en_pl(v) and v.get('plural'):
        return en_pl(v)[0] + CTX + en_pl(v)[1]
    return v.get('en_key') or v.get('en')


for k, v in entries:
    en, ru = v.get('en'), v.get('ru')
    if v.get('keep') or not en or ru is None:
        continue
    by_en.setdefault(key_of(v), []).append((k, v))
for en, lst in by_en.items():
    rus = {json.dumps(v.get('plural') or v['ru'], ensure_ascii=False) for _, v in lst}
    if len(rus) > 1:
        collisions[en] = [{'id': k, 'ru': v.get('plural') or v['ru'], 'kind': inv.get(k, {}).get('kind')} for k, v in lst]
    k, v = lst[0]
    val = v.get('plural') or v['ru']
    if val != en:
        table[en] = val
    for k2, v2 in lst:
        if v2.get('ru_short'):
            table['short' + CTX + en] = v2['ru_short']
for k, v in sample.items():
    table.setdefault(k, v)

# ---------------- 2. the call sites ----------------
ESC = {'n': '\n', 't': '\t', 'r': '\r', 'b': '\b', 'f': '\f', 'v': '\v', '0': '\0'}


def read_lit(s, i):
    """A JS string literal at s[i:] (after spaces): (value, end) or None (a template literal with ${...})."""
    while i < len(s) and s[i] in ' \t\n\r':
        i += 1
    if i >= len(s) or s[i] not in '\'"`':
        return None
    q, i, out = s[i], i + 1, []
    while i < len(s):
        c = s[i]
        if c == q:
            return ''.join(out), i + 1
        if q == '`' and c == '$' and s[i + 1:i + 2] == '{':
            return None
        if c == '\\':
            d = s[i + 1]
            if d == 'u':
                if s[i + 2] == '{':
                    j = s.index('}', i)
                    out.append(chr(int(s[i + 3:j], 16)))
                    i = j + 1
                else:
                    out.append(chr(int(s[i + 2:i + 6], 16)))
                    i += 6
                continue
            if d == 'x':
                out.append(chr(int(s[i + 2:i + 4], 16)))
                i += 4
                continue
            if d == '\n':
                i += 2
                continue
            out.append(ESC.get(d, d))
            i += 2
            continue
        out.append(c)
        i += 1
    return None


def call_sites(src):
    """[(kind, key, file:line)] for every $t / $tx / $tn whose arguments are string literals."""
    out = []
    for f in sorted(src.glob('*.js')):
        if f.name.startswith('i18n'):
            continue
        s = f.read_text()
        for m in re.finditer(r'(?<![A-Za-z0-9_$.])\$t(x|n)?\(', s):
            line = s.count('\n', 0, m.start()) + 1
            a = read_lit(s, m.end())
            if not a:
                continue
            if m.group(1):
                j = a[1]
                while s[j] in ' \t\n\r':
                    j += 1
                if s[j] != ',':
                    continue
                b = read_lit(s, j + 1)
                if not b:
                    continue
                key = (a[0] + CTX + b[0])
                out.append(('tx' if m.group(1) == 'x' else 'tn', key, a[0], b[0], f'{f.name}:{line}'))
            else:
                out.append(('t', a[0], a[0], None, f'{f.name}:{line}'))
    return out


# the inventory, indexed by its normalized English (placeholders as a marker)
norm_index = {}
for k, v in entries:
    en, ru = v.get('en'), v.get('ru')
    if v.get('keep') or not en or ru is None:
        continue
    # (a) the call-site template the table gives (en_key / en_plural): names are identifiers, i18n.js's rule
    tmpl = (en_pl(v) or [None, None])[1] or v.get('en_key')
    if tmpl:
        parts = key_split(tmpl)
        norm_index.setdefault(norm(parts), []).append((k, v, 'named', [n for _, n in parts if n]))
        continue
    # (b) the inventory text with the names its context lists (entries the round-4 pass did not rename)
    names = inv_names(k, v)
    parts = inv_split(en, names)
    norm_index.setdefault(norm(parts), []).append((k, v, names, [n for _, n in parts if n]))


def rename_named(ru, t_occ, k_occ):
    """Russian placeholders of a named template (%{name}; {name} too when the Russian has no TeX) -> %{call-site name}.
    By name; occurrence by occurrence when one template name stands for two call-site names."""
    m, conflict = {}, False
    for t, k in zip(t_occ, k_occ):
        if m.setdefault(t, k) != k:
            conflict = True
    queues = {}
    for t, k in zip(t_occ, k_occ):
        queues.setdefault(t, []).append(k)
    used = {}
    tex = re.search(r'[$\\]', ru) is not None

    def sub(mm):
        pct, n = mm.group(1), mm.group(2)
        if n not in m or (tex and not pct):
            return mm.group(0)
        if not conflict:
            return '%{' + m[n] + '}'
        j = used.get(n, 0)
        used[n] = j + 1
        q = queues[n]
        return '%{' + q[min(j, len(q) - 1)] + '}'
    return re.sub(r'(%?)\{([A-Za-z_][A-Za-z0-9_]*)\}', sub, ru)

sites = call_sites(root / 'src')
resolved, unresolved, how = {}, [], {}
for kind, key, a, b, where in sites:
    if key in resolved:
        continue
    if key in extra:
        resolved[key] = extra[key]
        how[key] = 'extra'
        continue
    src_en = a if kind == 't' else b if kind == 'tx' else b  # tn: the 'many' form carries the sentence
    kp = key_split(src_en)
    kn = [n for _, n in kp if n]
    hit = norm_index.get(norm(kp))
    if kind == 'tx':
        ctx_key = key
        if ctx_key in table:
            resolved[key] = table[ctx_key]
            how[key] = 'context'
            continue
    if hit:
        # one English text, several entries (a tool button and a shape name): the entry of the same file wins, then
        # the nearest line (the base's line numbers drift a little)
        cf, cl = where.split(':')[0], int(where.split(':')[1])
        def rank(h):
            f = inv.get(h[0], {}).get('file') or h[1].get('file') or ''
            fn, _, ln = f.partition(':')
            same = pathlib.Path(fn).name == cf
            try:
                dl = abs(int(ln.split(',')[0]) - cl)
            except ValueError:
                dl = 10 ** 6
            return (0 if same else 1, dl)
        k, v, names, order = sorted(hit, key=rank)[0]
        if len(order) != len(kn):
            unresolved.append({'key': key, 'where': where, 'why': f'placeholder count differs from {k}'})
            continue
        val = v.get('plural') or v['ru']
        if kind == 'tn' and not isinstance(val, dict):
            unresolved.append({'key': key, 'where': where, 'why': f'{k} has no plural forms'})
            continue
        if names == 'named':
            resolved[key] = map_val(val, lambda r: rename_named(r, order, kn))
        else:
            resolved[key] = map_val(val, lambda r: rename(r, names, order, kn))
        how[key] = k
        continue
    if kind == 't' and key in table and not kn:
        resolved[key] = table[key]
        how[key] = 'exact'
        continue
    unresolved.append({'key': key, 'where': where, 'why': 'no inventory text with this wording'})

# the English text equals the Russian (TeX, names): nothing to store
for key, val in list(resolved.items()):
    plain = key.split(CTX)[-1]
    if val == plain or val == key:
        del resolved[key]
table.update(extra)                      # this phase's entries (contexts the call sites of phase 2b will use too)
table.update(resolved)
# review eng-13: entries no lookup can reach hide real misses. A plural object under a key without the plural separator
# is left out ($tn never finds it; $t would show its 'other' form with a raw {n}). An entry whose key has a placeholder
# but no literal call site is only listed (tools/ru_report.json, 'orphans'): the tour's copy and other keys are looked
# up through a variable, which this script cannot see, so it is not dropped
site_keys = {s[1] for s in sites}
dropped, orphans = [], []
for k in sorted(table):
    v = table[k]
    if isinstance(v, dict) and CTX not in k:
        dropped.append({'key': k, 'why': 'plural object under a non-plural key'})
        del table[k]
    elif k not in site_keys and k not in extra and re.search(r'%?\{[A-Za-z_][A-Za-z0-9_]*\}', k.split(CTX)[-1]):
        orphans.append(k)

out = root / 'src' / 'i18n_ru.js'
blob = json.dumps(table, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
lit = json.dumps(blob, ensure_ascii=False).replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
out.write_text(
    "'use strict';\n"
    "// GENERATED by tools/make_ru_table.py from notes/i18n/ru/*.json, the inventory and tools/ru_extra.json: do not\n"
    "// edit. The Russian table as one JSON string; i18n.js parses it on the first Russian lookup, English never does.\n"
    f"I18N.define('ru', {lit});\n")
report = {
    'entries': len(table), 'call_sites': len({s[1] for s in sites}), 'resolved': len(resolved),
    'unresolved': unresolved, 'collisions': len(collisions), 'how': how, 'dropped': dropped, 'orphans': orphans,
}
json.dump(report, open(root / 'tools' / 'ru_report.json', 'w'), ensure_ascii=False, indent=1)
json.dump(collisions, open(root / 'tools' / 'ru_collisions.json', 'w'), ensure_ascii=False, indent=1)
print(f'{out.relative_to(root)}: {len(table)} entries, {out.stat().st_size} bytes; call sites {report["call_sites"]}, '
      f'unresolved {len(unresolved)}; collisions {len(collisions)} (tools/ru_collisions.json); dropped {len(dropped)}, orphans {len(orphans)}')
for u in unresolved:
    print('  UNRESOLVED', u['where'], json.dumps(u['key'], ensure_ascii=False)[:150], '-', u['why'])
if '--strict' in sys.argv and unresolved:
    sys.exit('unresolved call sites: add them to the tables or tools/ru_extra.json')
