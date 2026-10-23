# -*- coding: utf-8 -*-
# Review round 4 (2026-10-22): the verifier's items i18n-4, i18n-5, i18n-14, i18n-17, copy-18, copy-26.
# Run: python3 notes/i18n/ru/fixes_r4.py  (edits ru/chrome.json and ru/guide-tour.json in place; idempotent).
# math.json takes the same data through math_src/build.py (it imports PLURALS and ph).
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ph

# i18n-5: the English pair of every plural entry ($tn key = one + U+0004 + many) and the label that is the count
# (it becomes {n}). One and many are what English prints today: where English does not vary, they are equal, so the
# English output never changes. Split entries give one pair per variant.
PLURALS = {
 'chrome.at_most_max_kind': dict(count='MAX', split={'zeros': ['At most {n} zeros', 'At most {n} zeros'], 'poles': ['At most {n} poles', 'At most {n} poles']}),
 'chrome.shown_more': dict(count='shown', pair=['and {n} more', 'and {n} more']),
 'chrome.lines': dict(pair=['{n} line', '{n} lines']),
 'chrome.loaddropped_saved_choice_could': dict(count='loadDropped', pair=['{n} saved item could not be restored by this version and was left out.', '{n} saved items could not be restored by this version and were left out.']),
 'chrome.choice_nz_root_choice': dict(count='nz', split={
     'exact': ['<div class="ch">{n} root of {fxHtml} = {val} {where}{choice}</div>', '<div class="ch">{n} roots of {fxHtml} = {val} {where}{choice}</div>'],
     'atLeast': ['<div class="ch">at least {n} root of {fxHtml} = {val} {where}{choice}</div>', '<div class="ch">at least {n} roots of {fxHtml} = {val} {where}{choice}</div>']}),
 'chrome.first_sols_length': dict(count='sols.length', pair=[' (first {n})', ' (first {n})']),
 'chrome.shown_more_2': dict(count='shown', pair=['<div class="cm">and {n} more</div>', '<div class="cm">and {n} more</div>']),
 'chrome.target_area': dict(count='k', pair=['{n} target area', '{n} target areas']),
 'chrome.target_curve': dict(count='k', pair=['{n} target curve', '{n} target curves']),
 'chrome.others_targets': dict(count='others', pair=['the {n} target', 'the {n} targets']),
 'chrome.traced_curves': dict(pair=['{n} traced curve', '{n} traced curves']),
 'chrome.longitude_latitude_cells_riemann': dict(count='x', pair=['Longitude and latitude cells of the Riemann sphere: {n} cells cover the plane and ∞', 'Longitude and latitude cells of the Riemann sphere: {n} cells cover the plane and ∞']),
 'sound.listening_along_loop_turns': dict(count='turns', pair=['Listening along the loop: {n} turn of arg F. Esc stops.', 'Listening along the loop: {n} turns of arg F. Esc stops.']),
 'sound.z_snd_kz_modulus': dict(count='Math.atan2', pair=['z {z}. Modulus {modulus}, argument {n} degrees.', 'z {z}. Modulus {modulus}, argument {n} degrees.']),
 'sound.branch_cuts_from_cuts': dict(count='cuts', pair=['; branch cuts from {n} step, drawn in red', '; branch cuts from {n} steps, drawn in red']),
 'chrome.extra.n_preimages_of': dict(split={'exact': ['{n} preimage{where} of', '{n} preimages{where} of'], 'atLeast': ['at least {n} preimage{where} of', 'at least {n} preimages{where} of']}),
 'chrome.extra.n_shapes': dict(pair=['{n} shape', '{n} shapes']),
 'chrome.extra.role_image_after_steps': dict(pair=['image, after {n} step', 'image, after {n} steps']),
 'sound.extra.list_zeros': dict(split={'exact': ['{n} zero: {items}{andMore}', '{n} zeros: {items}{andMore}'], 'atLeast': ['{n} or more zero: {items}{andMore}', '{n} or more zeros: {items}{andMore}']}),
 'sound.extra.list_poles': dict(split={'exact': ['{n} pole: {items}{andMore}', '{n} poles: {items}{andMore}'], 'atLeast': ['{n} or more pole: {items}{andMore}', '{n} or more poles: {items}{andMore}']}),
 # math.json (math_src/build.py)
 'math.at_most_zp_max': dict(count='ZP_MAX', pair=['At most {n} zeros and {n} poles', 'At most {n} zeros and {n} poles']),
 'math.z_occurs_nz_times': dict(count='nz', pair=['z occurs {n} times in the formula, so it cannot be solved for z one operation at a time; the Preimage view shows every solution of f(z) = w', 'z occurs {n} times in the formula, so it cannot be solved for z one operation at a time; the Preimage view shows every solution of f(z) = w']),
 'export.boundary_point': dict(pair=['{n} boundary point', '{n} boundary points']),
 'export.interior_point': dict(pair=['{n} interior point', '{n} interior points']),
 'export.marked_point': dict(pair=['{n} marked point', '{n} marked points']),
 'math.gone_length_zero_pole': dict(count='gone.length', pair=['{n} zero–pole pairs cancel', '{n} zero–pole pairs cancel']),
 'math.curve_pts_length_points': dict(count='pts.length', pair=['\\text{curve, %{n} points}', '\\text{curve, %{n} points}']),
 'math.polygon_pts_length_vertices': dict(count='pts.length', pair=['\\text{polygon, %{n} vertices}', '\\text{polygon, %{n} vertices}']),
 'export.zs_length_zeros_dots': dict(count='zs.length', pair=[' {n} zeros (dots).', ' {n} zeros (dots).']),
 'export.ps_length_poles_open': dict(count='ps.length', pair=[' {n} poles (open circles).', ' {n} poles (open circles).']),
 'export.extra.image_after_steps': dict(pair=['The image of {set} after {n} steps', 'The image of {set} after {n} steps']),
 'export.extra.shape_polygon': dict(pair=['a polygon with {n} vertices', 'a polygon with {n} vertices']),
 'export.extra.shape_polygon_gen': dict(pair=['a polygon with {n} vertices', 'a polygon with {n} vertices'], ctx='gen'),
}

def plural_problems(k, v):
    """a plural entry must carry its English pair; every Russian form carries {n} (or %{n})"""
    out = []
    has_forms = isinstance(v.get('plural'), dict) or (isinstance(v.get('split'), dict) and any(isinstance(x, dict) for x in v['split'].values()))
    if not has_forms: return out
    pairs = v.get('en_plural')
    if not pairs: return [k + ': plural without en_plural']
    variants = pairs if isinstance(pairs, dict) else {'': pairs}
    for var, pr in variants.items():
        if not (isinstance(pr, list) and len(pr) == 2 and all('{n}' in s for s in pr)): out.append(f'{k} {var}: en_plural must be [one, many] with {{n}}')
    forms = []
    if isinstance(v.get('plural'), dict): forms += list(v['plural'].values())
    if isinstance(v.get('split'), dict):
        for x in v['split'].values():
            if isinstance(x, dict): forms += list(x.values())
    for s in forms:
        if '{n}' not in s: out.append(f'{k}: a Russian plural form has no {{n}}: {s[:60]}')
    return out

def apply_plural(k, v):
    cfg = PLURALS.get(k)
    if not cfg: return
    if 'pair' in cfg: v['en_plural'] = list(cfg['pair'])
    else: v['en_plural'] = {var: list(p) for var, p in cfg['split'].items()}
    if cfg.get('ctx'): v['ctx'] = cfg['ctx']
    # a count the inventory does not list as a placeholder of en (k in 'target area'): rename it in the forms here
    c = cfg.get('count')
    if c and c == 'k':
        for cont, f in ph.ru_strings(v):
            cont[f] = cont[f].replace('{k}', '{n}')

def convert_entry(k, v, inv_entry):
    chips = k.startswith('tour.')        # tour.js fills its key chips ({Z}, {Shift}{M}) itself, not I18N.fill
    apply_plural(k, v)
    cfg = PLURALS.get(k) or {}
    if k == 'chrome.choice_nz_root_choice':
        # the Russian keeps only the third {choice} (the " (first N)" suffix, chrome.first_sols_length); the first two
        # (at least, s) are the two $tn keys. Its key is en_plural, so it has no en_key.
        v.pop('en_key', None); v['ph'] = {'n': '{nz}'}
        for c, f in ph.ru_strings(v): c[f] = c[f].replace('{nz}', '{n}')
        return []
    return ph.convert(v, inv_entry, cfg.get('count'), chips)

# i18n-14: messages the engineering round added (parse.js, app.js) that show mainly in the Russian interface
NEW_CHROME = {
 'chrome.extra.arcctg_not_available': dict(en='arcctg is not available', ru='Функции arcctg здесь нет.', file='work/xl/src/parse.js',
   note='Review i18n-8, i18n-14: typed arcctg, arccot or acot. No formula hint: arctg(1/z) is not arcctg z for Re z < 0 under the Russian convention arcctg x ∈ (0, π) (GLOSSARY 2.4).'),
 'chrome.extra.arccot_not_available': dict(en='arccot is not available', ru='Функции arcctg здесь нет.', file='work/xl/src/parse.js', note='As chrome.extra.arcctg_not_available (the Russian names the Russian spelling).'),
 'chrome.extra.acot_not_available': dict(en='acot is not available', ru='Функции arcctg здесь нет.', file='work/xl/src/parse.js', note='As chrome.extra.arcctg_not_available.'),
 'chrome.extra.lg_not_available': dict(en='lg is the base-10 logarithm, which is not available; the natural logarithm is ln z', ru='lg — десятичный логарифм; здесь его нет. Натуральный логарифм: ln z.', file='work/xl/src/parse.js', note='Review i18n-8, i18n-14 (GLOSSARY 2.4).'),
 'chrome.extra.use_decimal_point': dict(en='Use a decimal point: 0.5, not 0,5 (a comma separates conditions)', ru='Дробную часть отделяйте точкой: 0.5, а не 0,5 (запятая разделяет условия)', file='work/xl/src/parse.js', note='Review i18n-14. Shown when a formula has a decimal comma (z^0,5). The point is the formula language\'s (GLOSSARY 2.3).'),
 'chrome.extra.language_cannot_change': dict(en='The language cannot change: this browser blocks site storage, and a reload would lose your work.', ru='Язык не удалось переключить: браузер блокирует хранилище сайта, а перезагрузка стёрла бы вашу работу.', file='work/xl/src/app.js', note='Review i18n-3: toast when the switch cannot save the work.'),
}

def main():
    inv = {e['id']: e for e in json.load(open(os.path.join(HERE, '..', 'inventory.json')))['entries']}
    probs = []
    for name in ('chrome.json', 'guide-tour.json'):
        p = os.path.join(HERE, name)
        d = json.load(open(p))
        if name == 'chrome.json':
            # i18n-17: chrome.export is an identifier (a `why` reason code), dropped from the inventory
            d.pop('chrome.export', None)
            for k, v in NEW_CHROME.items():
                d[k] = dict(v, missing_from_inventory=True)
            # copy-18: the short set has no «Макс»
            d['chrome.draft']['note'] = ('Mesh quality segment (5 segments). Glossary options: Черновая · Обычная · Высокая · Ультра · Максимум. '
                                         'If the row overflows at 360 px, use the ru_short set: Эскиз · Обычная · Высокая · Ультра · Максимум (GLOSSARY 3.10: no «Макс»).')
            # copy-26: the note matches the present-tense strings and names ids that exist
            d['chrome.as_target']['note'] = ('Piece of `Adds ${plan.what}${as a target}.` (app.js 7656). Russian uses whole sentences: '
                                             'chrome.extra.adds_what split.shape «Добавляет: {what}.» and split.target «Добавляет в плоскость w: {what}.»')
        for k, v in d.items():
            if k == '_meta' or not isinstance(v, dict): continue
            for x in convert_entry(k, v, inv.get(k)): probs.append(f'{k}: {x}')
            probs += plural_problems(k, v)
            if not ph.roundtrip(v): probs.append(f'{k}: en_key does not give en back')
            for c, f in ph.ru_strings(v):
                if not k.startswith('tour.'):
                    b = ph.bare_in_tex(c[f])
                    if b: probs.append(f'{k}: bare {b} in a TeX template')
        if name == 'chrome.json':
            d['_meta']['fields'].update({
                'en_key': 'the English template the phase-2 call site writes when it differs from en: identifier names, %{name} in a template with TeX (review i18n-4). It renders exactly en. The table key is en_key.',
                'ph': 'for a renamed slot, what it stands for in en ("{2}", or a literal such as "," that English always fills in)',
                'en_plural': '[one, many]: the English pair of a plural entry ($tn key one + U+0004 + many); per split variant when the entry splits (review i18n-5). The count is {n}.',
                'ctx': 'a $tx/$tn context, when two entries share one English text',
            })
        json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
        json.load(open(p))
    print('problems', len(probs))
    for x in probs: print(' ', x)
    return probs

if __name__ == '__main__':
    sys.exit(1 if main() else 0)
