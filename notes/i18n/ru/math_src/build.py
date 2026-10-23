# -*- coding: utf-8 -*-
# Merge the four translation parts with the inventory, normalize typography, validate, write ru/math.json.
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import tr1, tr2, tr3, tr4
from extras import EXTRA
import fixes_r2
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import ph, fixes_r4   # review round 4: placeholders (%{name}, en_key) and plural pairs (en_plural)
NOTES = sys.argv[1]
inv = json.load(open(os.path.join(NOTES, 'i18n/inventory.json')))
mine = [e for e in inv['entries'] if e['area'] in ('math', 'export')]
T = {}
for part in (tr1.T, tr2.T, tr3.T, tr4.T):
    for k, v in part.items():
        assert k not in T, 'duplicate id ' + k
        T[k] = v
# review round 2 (fixes_r2.py): replace ru (and the listed fields) on top of the four parts and the extras
def _apply(dst, k, v):
    cur = dst[k]
    cur = dict(ru=cur) if isinstance(cur, str) else dict(cur)
    if isinstance(v, str): v = dict(ru=v)
    for f, x in v.items():
        if x is None: cur.pop(f, None)
        else: cur[f] = x
    dst[k] = cur
for k, v in fixes_r2.FIX.items():
    assert k in T, 'fixes_r2: unknown id ' + k
    _apply(T, k, v)
for k, v in fixes_r2.EXTRA_FIX.items():
    assert k in EXTRA, 'fixes_r2: unknown extra ' + k
    _apply(EXTRA, k, v)
for k, v in fixes_r2.EXTRA_ADD.items():
    assert k not in EXTRA, 'fixes_r2: extra exists ' + k
    EXTRA[k] = dict(v)
ids = [e['id'] for e in mine]
missing = [i for i in ids if i not in T]
extra_ids = [k for k in T if k not in set(ids)]
print('entries', len(ids), 'translated', len(T), 'missing', missing, 'unknown', extra_ids)

NBSP = '\u00a0'
def typo(s):
    if s is None: return s
    s = s.replace(' — ', NBSP + '— ')                      # no-break space before an em dash
    # phase 2b review (ui-12, ui-14; ru/fixes_2b.py): before any em dash and LaTeX ---, and between a number and its unit
    s = re.sub(r'(?<=[^\s~' + NBSP + r']) (—)', NBSP + r'\1', s)
    s = re.sub(r'(?<=[^\s~' + NBSP + r']) (---)', r'~\1', s)
    s = re.sub(r'(?<=[\d}]) (см|мм|пт|дюйм|дюйма|дюймов|dpi|Гц|кГц|мс|мин)(?![0-9A-Za-zА-Яа-яЁё])', NBSP + r'\1', s)
    s = re.sub(r'(?<![\w\\{])([вВкКсСуУоОиИаАяЯ]) (?=\S)', r'\1' + NBSP, s)  # after one-letter words
    s = re.sub(r'Рис\. (\d)', 'Рис.' + NBSP + r'\1', s)
    return s

PH = re.compile(r'\{[A-Za-z_][A-Za-z0-9_]*\}'); TAG = re.compile(r'</?[a-z][a-z0-9]*'); CMD = re.compile(r'\\[A-Za-z]+'); MATH = re.compile(r'\$[^$]*\$')
toks = lambda s, rx: ' '.join(sorted(rx.findall(s)))
ALLOW = set('Enter Esc Shift Delete Tab Ctrl Alt Space LaTeX TeX PDF PNG SVG English Complex Map Workbench Re Im arg ln tg ctg sh ch th cth arctg arsh arch arth cosec'.split())
ALLOW |= set('Overleaf Docs Slides Beamer Keynote REVTeX IEEE arXiv MathJax Letter amsart article dpi pdf png svg txt latex NaN and or not figure pt icon btn xf xlink href NS key tbp'.split())
ALLOW |= set('az cz nz Math min max sub CX lvar mapTex Fn dz ad bc width'.split())  # math/placeholder residue
YO = [r'\bеще\b', r'\bее\b', r'\bчерн', r'\bтемн', r'\bучет', r'сошелся', r'развернут', r'изображенн', r'остается', r'\bидет', r'\bдает', r'\bзадает', r'\bсохранен\b', r'\bудален\b', r'\bвключен\b', r'\bвыключен\b', r'\bвсе же\b', r'\bпроведен\b']
problems = []
INTENDED_SPACE = {'export.outlined', 'export.so_phase_lines_modulus', 'extra export.extra.with_mark'}
def check(k, src, f, plural_new_n=False):
    if k in fixes_r2.PREAMBLE_IDS or k.startswith('extra export.extra.fig_'):
        return  # reviewed by hand: the Russian preamble adds packages; the figure templates rename their slots (notes)
    TXT = re.compile(r'\\(?:text|textbf|section\*?)\{[^{}]*\}')
    pct = lambda s: s.replace('%{', '{')
    if not plural_new_n:
        if toks(TXT.sub(' ', pct(f)), PH) != toks(TXT.sub(' ', pct(src)), PH): problems.append((k, 'placeholders', f))
    # review i18n-4: a template with TeX writes every slot as %{name}; a bare {name} would never be filled
    b = ph.bare_in_tex(f)
    if b: problems.append((k, 'bare {name} in a TeX template: ' + ','.join(b), f))
    if toks(f, TAG) != toks(src, TAG): problems.append((k, 'tags', f))
    if toks(f, CMD) != toks(src, CMD) and k not in fixes_r2.PREAMBLE_IDS: problems.append((k, 'tex commands', f))
    if toks(f, MATH) != toks(src, MATH): problems.append((k, 'inline math', f))
    if re.search(r'^\s|\s$', f) and not re.search(r'^\s|\s$', src) and k not in INTENDED_SPACE: problems.append((k, 'stray space', f))
    rest = MATH.sub(' ', f); rest = re.sub(r'<[^>]*>', ' ', rest); rest = PH.sub(' ', rest); rest = re.sub(r'\{[A-Za-z_.0-9]+\}', ' ', rest); rest = re.sub(r'\\[A-Za-z]+(\{[^}]*\})?', ' ', rest)
    lat = [w for w in re.findall(r'[A-Za-z]{2,}', rest) if w not in ALLOW]
    if lat and re.search('[а-яё]', f, re.I): problems.append((k, 'english left: ' + ','.join(lat), f))
    if re.search(r'[a-zA-Z][а-яё]|[а-яё][a-zA-Z]', rest, re.I): problems.append((k, 'mixed script', f))
    for w in YO:
        if re.search(w, f.lower()): problems.append((k, 'ё? ' + w, f))

out = {}
for e in mine:
    v = T[e['id']]
    if isinstance(v, str): v = {'ru': v}
    v = dict(v)
    if v.get('note', '').startswith('Math or code only'):
        v['ru'] = e['text']  # identical by construction
    rec = {'en': e['text'], 'ru': typo(v['ru'])}
    if 'ru_short' in v: rec['ru_short'] = typo(v['ru_short'])
    if 'plural' in v: rec['plural'] = {f: typo(s) for f, s in v['plural'].items()}
    if v.get('note'): rec['note'] = v['note']
    for f in ('en_key', 'ph', 'en_plural', 'en_split'):
        if f in v: rec[f] = v[f]
    if e.get('provisional'): rec['provisional'] = True
    for x in fixes_r4.convert_entry(e['id'], rec, e): problems.append((e['id'], x, ''))
    if not ph.roundtrip(rec): problems.append((e['id'], 'en_key does not give en back', rec.get('en_key')))
    for x in fixes_r4.plural_problems(e['id'], rec): problems.append((e['id'], x, ''))
    out[e['id']] = rec
    src_key = rec.get('en_key', e['text'])
    check(e['id'], src_key, rec['ru'], 'en_plural' in rec)
    if 'plural' in rec:
        newn = True   # the count is {n} in every form (en_plural)
        for f in ('one', 'few', 'many', 'other'):
            if f not in rec['plural']: problems.append((e['id'], 'plural form ' + f, ''))
            else: check(e['id'], src_key, rec['plural'][f], newn)
    if 'ru_short' in rec:
        if len(rec['ru_short']) > len(e['text']) * 1.25 + 2: problems.append((e['id'], 'ru_short still long', rec['ru_short']))

# length report for labels
long = []
for e in mine:
    r = out[e['id']]
    if e['kind'] in ('menu', 'heading', 'caption', 'aria', 'tooltip') and len(e['text']) <= 40 and 'ru_short' not in r and not r['ru'] == e['text']:
        if len(r['ru']) > len(e['text']) * 1.2 + 3: long.append((e['id'], e['text'], r['ru']))
ext = {}
typo_any = lambda x: {f: typo_any(y) for f, y in x.items()} if isinstance(x, dict) else typo(x)
for k, v in EXTRA.items():
    v = dict(v); v['ru'] = typo(v['ru'])
    if 'plural' in v: v['plural'] = {f: typo(s) for f, s in v['plural'].items()}
    if 'split' in v: v['split'] = {f: typo_any(s) for f, s in v['split'].items()}
    for x in fixes_r4.convert_entry(k, v, None): problems.append(('extra ' + k, x, ''))
    for x in fixes_r4.plural_problems(k, v): problems.append(('extra ' + k, x, ''))
    ext[k] = v
    check('extra ' + k, v.get('en_key', v['en']), v['ru'], 'en_plural' in v)

doc = {
    'about': 'Russian strings for the math and export areas of notes/i18n/inventory.json (299 math + 221 export base + 171 export provisional from work/xr). Keyed by inventory id. ru follows GLOSSARY.md. Review round 2 fixes: math_src/fixes_r2.py. LaTeX, $…$ math, TeX commands and {placeholders} are identical to en; Russian notation (tg, sh, ln, …) is applied by I18N.notation() at the display boundary, so the table keeps \\tan, \\sinh, \\log. U+00A0 marks no-break spaces (before an em dash, after one-letter words, «Рис. 1»). plural: Intl.PluralRules("ru") forms; where en has no {n}, the plural forms introduce {n} and the key must become a $tn() key. ru_short: proposed shorter label where the full one risks overflow. Fragment entries (kind caption/latex with leading or trailing spaces) are written so that, glued in the English order, they read as correct Russian; notes say where a whole-sentence template or a case form is still needed.',
    'generated': '2026-10-22',
    'counts': {'entries': len(out), 'math': sum(1 for e in mine if e['area'] == 'math'), 'export': sum(1 for e in mine if e['area'] == 'export'), 'provisional': sum(1 for e in mine if e.get('provisional')), 'with_plural': sum(1 for r in out.values() if 'plural' in r), 'with_ru_short': sum(1 for r in out.values() if 'ru_short' in r), 'identical_code_or_math': sum(1 for e in mine if out[e['id']]['ru'] == e['text'])},
    'entries': out,
    'missing_from_inventory': ext,
}
os.makedirs(os.path.join(NOTES, 'i18n/ru'), exist_ok=True)
p = os.path.join(NOTES, 'i18n/ru/math.json')
json.dump(doc, open(p, 'w'), ensure_ascii=False, indent=1)
json.load(open(p))
print('wrote', p, doc['counts'])
print('problems', len(problems))
for x in problems: print(' ', x)
print('long labels without ru_short', len(long))
for x in long: print(' ', x)
