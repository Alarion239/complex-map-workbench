#!/usr/bin/env python3
# Phase 2b review fixes (2026-10-23, notes/i18n/ledger-2b.json): typography passes over the Russian of every table,
# idempotent. Run from notes/i18n/ru: python3 fixes_2b.py [--check]. With --check it only reports what it would change.
#   ui-12 (GLOSSARY 3.5, 3.6): a no-break space before an em dash: «X — Y» -> «X — Y»; in LaTeX «X ---» -> «X~---»
#   ui-14 (GLOSSARY 3.6, 3.8): a no-break space between a number (or a %{slot}) and its unit: «8,9 см», «%{x} пт»
#   ui-19 (GLOSSARY 3.5): control names in the guide's Views paragraph in «»
# Then re-run work/xb/tools/make_ru_table.py. math_src/build.py's typo() applies the same two passes on a rebuild.
import json, re, sys, pathlib
NB = ' '
here = pathlib.Path(__file__).resolve().parent
FILES = ['chrome.json', 'guide-tour.json', 'math.json'] + sorted(p.name for p in here.glob('phase2b*.json'))
EXTRA = here.parent.parent.parent / 'work' / 'xb' / 'tools' / 'ru_extra.json'
UNITS = r'(см|мм|пт|дюйм|дюйма|дюймов|dpi|Гц|кГц|мс|мин)'
EDITS = [  # (old, new): exact substrings of one Russian value
    ('режим <b>Все листы</b> рисует', 'флажок <b>«Все листы»</b> рисует'),
    ('флажок «Все листы» рисует', 'флажок <b>«Все листы»</b> рисует'),
    ('Кольцо, Сектор и Полярная сетка рисуются', '«Кольцо», «Сектор» и «Полярная сетка» рисуются'),
    ('): Круг на сфере' + NB + '— это шапочка, Окружность' + NB + '— её край', '): «Круг» на сфере' + NB + '— это шапочка, «Окружность»' + NB + '— её край'),
    ('): Круг на сфере — это шапочка, Окружность — её край', '): «Круг» на сфере' + NB + '— это шапочка, «Окружность»' + NB + '— её край'),
]


def typo(s):
    if not isinstance(s, str):
        return s
    s = re.sub(r'(?<=[^\s~' + NB + r']) (—)', NB + r'\1', s)
    s = re.sub(r'(?<=[^\s~' + NB + r']) (---)', r'~\1', s)
    s = re.sub(r'(?<=[\d}]) ' + UNITS + r'(?![0-9A-Za-zА-Яа-яЁё])', NB + r'\1', s)
    for a, b in EDITS:
        s = s.replace(a, b)
    return s


def fix_val(v):
    if isinstance(v, str):
        return typo(v)
    if isinstance(v, dict):
        out = dict(v)
        for f in ('ru', 'ru_short'):
            if isinstance(out.get(f), str):
                out[f] = typo(out[f])
        if isinstance(out.get('plural'), dict):
            out['plural'] = {k: typo(x) for k, x in out['plural'].items()}
        if isinstance(out.get('split'), dict):
            out['split'] = {k: (typo(x) if isinstance(x, str) else x) for k, x in out['split'].items()}
        return out
    return v


def fix_map(d, skip_en=True):
    n = 0
    for k in list(d):
        if k.startswith('_'):
            continue
        v = d[k]
        nv = fix_val(v)
        if nv != v:
            n += 1
            d[k] = nv
    return n


def dump(doc, p):  # the files' own format: indent 1, a final newline only where there was one
    nl = open(p).read().endswith('\n')
    open(p, 'w').write(json.dumps(doc, ensure_ascii=False, indent=1) + ('\n' if nl else ''))


check = '--check' in sys.argv
total = 0
for name in FILES:
    p = here / name
    doc = json.load(open(p))
    if name == 'math.json':
        n = fix_map(doc['entries']) + fix_map(doc.get('missing_from_inventory', {}))
    else:
        n = fix_map(doc)
    total += n
    print(f'{name}: {n} entries changed')
    if n and not check:
        dump(doc, p)
# tools/ru_extra.json: key -> Russian string (or a plural object)
doc = json.load(open(EXTRA))
n = 0
for k in list(doc):
    if k.startswith('_'):
        continue
    v = doc[k]
    nv = {f: typo(x) for f, x in v.items()} if isinstance(v, dict) and 'other' in v else fix_val(v)
    if nv != v:
        n += 1
        doc[k] = nv
total += n
print(f'ru_extra.json: {n} entries changed')
if n and not check:
    dump(doc, EXTRA)
print('total', total)
