import json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ph, fixes_r4   # review round 4: %{name} in TeX templates (i18n-4), plural pairs (i18n-5)
OUT = json.load(open(sys.argv[1], encoding='utf-8'))
INV = json.load(open(sys.argv[2], encoding='utf-8'))
kinds = {x['id']: x['kind'] for x in INV['entries']}
PH = re.compile(r'\{([A-Za-z_][\w.]*)\}')   # {name} placeholders (not TeX like {z^2}, {0})
TAG = re.compile(r'</?([a-zA-Z]+)[^>]*>')
SC = re.compile(r'  (\S+)$')                 # shortcut suffix "  M"
problems = []
def forms(e):
    out = [('ru', e['ru'])]
    if 'plural' in e: out += [('plural.' + k, v) for k, v in e['plural'].items()]
    if 'ru_short' in e: out += [('ru_short', e['ru_short'])]
    for k, v in e.get('split', {}).items():
        if isinstance(v, dict): out += [('split.%s.%s' % (k, kk), vv) for kk, vv in v.items()]
        else: out.append(('split.' + k, v))
    return out
YO = re.compile(r'\b(еще|ее|черн\w*|темн\w*|удален|перемещен|учет\w*|заменен|отключен|сохранен\w*|определен|найден\w*)\b', re.I)
# words that legitimately keep «е»: найдено/найдены/найден? no: found = найдено (no ё). fine-tune list
YO_OK = {'найдено', 'найденные', 'черновая', 'найден', 'найдены', 'найдена', 'определена', 'определено', 'определены', 'включена', 'выключена', 'отключена', 'сохранено', 'сохранены', 'сохранена', 'удалена', 'удалены', 'удалено', 'заменена', 'включено', 'выключено', 'включены', 'выключены'}
LATIN_OK = set('''Esc Enter Shift Ctrl Alt Tab Delete Backspace Space WebGL2 WebGL LaTeX PDF SVG PNG GPU Web Audio iPhone iPad Complex Map Workbench Re Im arg Arg ln Ln exp sin cos tg sh ch th arctg arcsin arccos const ms kHz Q D4 D5 D6 E5 E6 A3 A4 A5 B5 F H_t t z w f F p r i e x y a b c d m n D K H W M Z O L X Y P G V S R C A B N T text pi theta div class span sw pole int part cn ch cl cm cv cs style color TH ICONS MODE_ICONS morph paths Fh fnText fxHtml yHtml dv name val where choice nz sols length shown cp out label q def k kk s st sym one what kind Funcs ZP_MAX MAX r mult note plan BADGES nOn i hid ms total CX abs Math atan2 snd kz st0 lat audio rate engine latency turns cuts zs ps loadDropped others na nc tex palState sel wm pre Fn lab tool tg ru items dz Res arcctg lg ad bc az cz h orMore off sub up upTo place used min rk lk deg ctx ui g'''.split())
for i, e in OUT.items():
    if i == '_meta': continue
    en = e.get('en')
    if e.get('keep'):
        if en is not None and e['ru'] != en: problems.append((i, 'keep but ru != en'))
        continue
    for x in fixes_r4.plural_problems(i, e): problems.append((i, 'plural', x))
    if not ph.roundtrip(e): problems.append((i, 'en_key does not give en back'))
    for where, ru in forms(e):
        if en is None: continue
        # review i18n-4: in a template with TeX every slot is %{name} (tour.js fills the tour's key chips itself)
        if not i.startswith('tour.'):
            b = ph.bare_in_tex(ru)
            if b: problems.append((i, where, 'bare {name} in a TeX template', b))
        # placeholders: against the phase-2 key (en_key) when the slots were renamed; %{x} counts as {x}
        src = e.get('en_key', en).replace('%{', '{')
        pe, pr = sorted(set(PH.findall(src))), sorted(set(PH.findall(ru.replace('%{', '{'))))
        if pe != pr and '.extra.' not in i and where != 'ru_short' and 'Both {choice}' not in e.get('note','') and 'is dropped' not in e.get('note','') and 'split' not in e and not e.get('note', '').startswith(('The two', 'Two different', 'Three different', 'The source has two')):
            # allow renamed/added count placeholder only when declared
            if not (set(pr) - set(pe) <= {'n', 'k', 'x1', 'x2'} and set(pe) - set(pr) <= set()):
                problems.append((i, where, 'placeholders', pe, pr))
        # tags
        te, tr = [t.lower() for t in TAG.findall(en)], [t.lower() for t in TAG.findall(ru)]
        if sorted(te) != sorted(tr): problems.append((i, where, 'tags', te, tr))
        # shortcut suffix
        me, mr = SC.search(en), SC.search(ru)
        if me and (not mr or me.group(1) != mr.group(1)): problems.append((i, where, 'shortcut', en, ru))
        # leading / trailing spaces
        if i not in ('chrome.x_4',) and (en[:1] == ' ') != (ru[:1] == ' ') or (en[-1:] == ' ') != (ru[-1:] == ' '):
            problems.append((i, where, 'edge spaces', repr(en[:12]), repr(ru[:12])))
        # TeX commands kept
        ce, cr = sorted(re.findall(r'\\[a-zA-Z]+', en)), sorted(re.findall(r'\\[a-zA-Z]+', ru))
        if ce != cr and not (set(ce) - set(cr) <= {'\\log'}): problems.append((i, where, 'tex', ce, cr))
        # ё lint
        for w in YO.findall(ru):
            if w.lower() not in YO_OK: problems.append((i, where, 'yo?', w))
        # stray latin words
        txt = TAG.sub(' ', ru); txt = PH.sub(' ', txt); txt = re.sub(r'\\[a-zA-Z]+', ' ', txt)
        for w in re.findall(r'[A-Za-z][A-Za-z_0-9]*', txt):
            if w not in LATIN_OK and not ('keywords' in e.get('note', '') or 'Hidden search' in e.get('note', '')):
                problems.append((i, where, 'latin', w))
        # mixed script inside one word
        for w in re.findall(r'\w+', txt):
            if re.search('[A-Za-z]', w) and re.search('[А-Яа-яЁё]', w): problems.append((i, where, 'mixed', w))
        # double spaces other than the shortcut gap
        if re.search(r'\S  \S', ru) and not SC.search(ru): problems.append((i, where, 'double space'))
    # length for short labels
    k = kinds.get(i)
    if k in ('button', 'menu', 'tooltip', 'aria', 'palette', 'heading') and en:
        L = len(re.sub(r'<[^>]+>|\{[^}]+\}', '', e['ru'])); Le = len(re.sub(r'<[^>]+>|\{[^}]+\}', '', en))
        if k in ('button',) and L > Le * 1.2 + 2 and 'ru_short' not in e and 'Length' not in e.get('note','') and 'length' not in e.get('note','') and 'width' not in e.get('note','') and 'fit' not in e.get('note',''):
            problems.append((i, 'length', k, Le, L, en, e['ru']))
for p in problems: print(p)
print(len(problems), 'problems')
