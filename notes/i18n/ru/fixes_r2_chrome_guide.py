# -*- coding: utf-8 -*-
# Review round 2 (2026-10-22): fixes to ru/chrome.json and ru/guide-tour.json, applied in place (idempotent).
# Run: python3 notes/i18n/ru/fixes_r2_chrome_guide.py
import json, os, re
H = os.path.dirname(os.path.abspath(__file__))
N = ' '; D = N + '— '
C = json.load(open(os.path.join(H, 'chrome.json'), encoding='utf-8'))
G = json.load(open(os.path.join(H, 'guide-tour.json'), encoding='utf-8'))
EN_FIX = 'The English has the same error: fix it too ({}).'

def fix(tab, k, ru=None, sub=None, **fields):
    e = tab[k]
    if ru is not None: e['ru'] = ru
    for a, b in (sub or []):
        assert a in e['ru'] or b in e['ru'], (k, a)
        e['ru'] = e['ru'].replace(a, b)
    for f, v in fields.items():
        if v is None: e.pop(f, None)
        else: e[f] = v

# ---- chrome.json ----
fix(C, 'chrome.list_sound_but_not', 'Список верен, но не полон. Например, exp после ln даёт z, но ни один из этих шагов не рационален, поэтому «рациональная функция» не указана.',
    note='exp(ln z) = z on ℂ minus the cut (every branch), yet neither step is rational. The other order is false: ln(e^z) = z − 2πik in the strip (2k−1)π < Im z < (2k+1)π. ' + EN_FIX.format('«log followed by exp returns z»'))
fix(C, 'chrome.agrees_on_d_with', 'Совпадает на D с P(z)/Q(z), где P и Q' + D + 'многочлены.', note='«где P и Q — многочлены» (some polynomials), as export.agrees_on_d_with; «для многочленов P и Q» reads as «for all».')
fix(C, 'chrome.exp_opens_strip_im', 'exp отображает полосу |Im z| < π/2 на правую полуплоскость, а дробно-линейное отображение' + D + 'эту полуплоскость на круг.',
    note='«на» = onto, «в» = into (GLOSSARY 1.1).')
fix(C, 'chrome.first_quadrant_opens_onto', 'Первая четверть отображается на верхнюю полуплоскость; углы в точке 0 удваиваются.', note='«на» = onto (GLOSSARY 1.1).')
fix(C, 'chrome.analytic_injective_biholomorphism_d', 'Функция F голоморфна и однолистна, поэтому задаёт биголоморфное отображение D → F(D), причём F′ ≠ 0.',
    note='F′ ≠ 0 is a theorem for a univalent function (Шабат): «поэтому … причём», as export.holomorphic_injective_hence_biholomorphism.')
fix(C, 'chrome.right_click_circle_around', 'Щёлкните окружность правой кнопкой: при обходе полюса i интеграл с переменным верхним пределом не возвращается к начальному значению' + D + 'разность равна 2πi · Res = π.',
    note='The running integral is continuous; «разрыв» would say otherwise.')
fix(C, 'chrome.conformal_on_injective_on', 'Конформно на ℂ; однолистно в любой горизонтальной полосе ширины 2π')
fix(C, 'chrome.landscape_with_all_sheets', 'Рельеф, все листы: Im Ln z поднимается по геликоиду вокруг 0, а не терпит скачка на разрезе.')
fix(C, 'chrome.open_guide', 'Открыть руководство', note='The guide document is «Руководство» (GLOSSARY 1.13). The header button chrome.guide stays «Справка»: in work/xt it opens the help menu (the guide and the tour).')
fix(C, 'chrome.guide', note='Header button: a noun, «Справка» (GLOSSARY 3.1). In work/xt it opens the help menu (Tour.openHelpMenu: the guide and the tour), so «Справка» is the menu; the guide itself is «Руководство».')
fix(C, 'chrome.integrate_along_selected_curve', 'Вычислить интеграл по выделенной кривой')
fix(C, 'chrome.select_closed_curve_or', 'Выделите замкнутую кривую или ограниченную область' + D + 'будет показан интеграл Коши по этому контуру.', note='«выделить» for shapes (GLOSSARY 1.8); the integral is over the contour, not «её».')
fix(C, 'chrome.cauchy_style_select_closed', 'Стиль «Интеграл Коши»: выделите замкнутую кривую или ограниченную область, чтобы увидеть интеграл Коши по этому контуру.')
fix(C, 'chrome.circle_through_1_becomes', 'Окружность, проходящая через 1, переходит в профиль крыла с острой задней кромкой.', note='«профиль (крыла)», GLOSSARY 1.9 (Жуковский).')
fix(C, 'chrome.unbounded_drawn_about_200', 'Фигура не ограничена: она рисуется примерно на 200 ширин вида и бледнеет к краю.', note='«не ограничена»: short form, two words, one «н».')
LZ = 'Two $tn keys, like chrome.extra.n_preimages_of: split.exact when the search finished, split.atLeast when it was cut short ("or more"). {andMore} is sound.more (« и другие») or empty.'
fix(C, 'sound.extra.list_zeros', '{n} нулей: {items}{andMore}', plural=None, split={
    'exact': {'one': '{n} нуль: {items}{andMore}', 'few': '{n} нуля: {items}{andMore}', 'many': '{n} нулей: {items}{andMore}', 'other': '{n} нуля: {items}{andMore}'},
    'atLeast': {'one': 'не менее {n} нуля: {items}{andMore}', 'few': 'не менее {n} нулей: {items}{andMore}', 'many': 'не менее {n} нулей: {items}{andMore}', 'other': 'не менее {n} нуля: {items}{andMore}'}},
    note='Not in inventory.json (found while translating). work/xs app.js sndKey (D key) list(a, "zero"). ' + LZ)
fix(C, 'sound.extra.list_poles', '{n} полюсов: {items}{andMore}', plural=None, split={
    'exact': {'one': '{n} полюс: {items}{andMore}', 'few': '{n} полюса: {items}{andMore}', 'many': '{n} полюсов: {items}{andMore}', 'other': '{n} полюса: {items}{andMore}'},
    'atLeast': {'one': 'не менее {n} полюса: {items}{andMore}', 'few': 'не менее {n} полюсов: {items}{andMore}', 'many': 'не менее {n} полюсов: {items}{andMore}', 'other': 'не менее {n} полюса: {items}{andMore}'}},
    note='Not in inventory.json (found while translating). Same for poles. ' + LZ)
fix(C, 'sound.more', ' и другие', note='Ends a list: no comma before «и» (leading space kept).')
fix(C, 'sound.curve_cannot_be_played', 'Эту кривую здесь нельзя озвучить: функция F слишком трудоёмка для вычисления либо обращается в нуль или в бесконечность в начале кривой.',
    note='«проигрывать» also means «to lose»: use «воспроизвести», «звучит», «озвучить» (GLOSSARY 1.15).')
fix(C, 'sound.more_turns_than_can', 'Оборотов больше, чем можно сосчитать на ходу (в очереди больше 8): их число показывается, произносится и затем точно воспроизводится')
fix(C, 'sound.no_order_within_st0', 'Порядок в круге радиуса {st0} не определён: на его границе функция F терпит разрыв, обращается в нуль или в бесконечность.',
    note='«круг» (disc) and its «граница»: never «окружность» without an antecedent (GLOSSARY 1.1).')
fix(C, 'sound.double_tick_stepping_down', 'двойной щелчок вниз: 3,2' + N + 'кГц, затем 2,0' + N + 'кГц')
fix(C, 'sound.noise_band_passed_at', 'шум через полосовой фильтр: 1,9' + N + 'кГц; Q 1,4; 25' + N + 'мс', note='Provisional (work/xs). Decimal commas: list items separated by «;» (GLOSSARY 2.3).')

# ---- guide-tour.json ----
fix(G, 'tour.phase_style_cauchy_plots', 'Стиль «Интеграл Коши» строит фазовый портрет интеграла $\\frac{1}{2\\pi i}\\oint_\\gamma\\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta$ по замкнутой кривой $\\gamma$' + D + 'здесь это единичная окружность. Внутри он равен $F(z)=z^3-1$, снаружи' + D + '$0$; три нуля функции $F$ лежат на самой окружности $\\gamma$. Чтобы взять другую замкнутую кривую, выделите её.',
    note='Provisional (work/xt). The zeros of z³ − 1 are the cube roots of unity: they lie on γ (tour.js scene «roots», r = 1), not inside. ' + EN_FIX.format('«…; its three zeros lie on γ itself», or move the scene to r = 1.2 and keep «with its three zeros»'))
fix(G, 'tour.each_z_coloured_by', 'Каждая точка $z$ окрашена по $\\arg F(z)$ (здесь $F(z)=(z^2-1)/(z^2+1)$), а' + N + 'полосы яркости ограничены линиями уровня $|F|$. Все цвета сходятся в' + N + 'нулях $\\pm1$ и' + N + 'полюсах $\\pm i$: вокруг нуля они идут в' + N + 'одну сторону, вокруг полюса' + D + 'в' + N + 'другую.',
    note='A level set of |F| is a curve; the bands lie between such curves (Шабат, «линия уровня»). The English is loose («bands are level sets»): suggest «bands bounded by level curves of |F|».')
fix(G, 'tour.landscape_all_sheets_draws', sub=[('а' + N + 'не прыгает на разрезе', 'а' + N + 'не терпит скачка на разрезе')])
fix(G, 'guide.deformation_top_bar_x', sub=[('проигрывает гомотопию', 'воспроизводит гомотопию'), ('прилетают из бесконечности', 'приходят из бесконечности')])
fix(G, 'tour.pattern_painted_on_x', sub=[('; лог-полярные клетки при конформном', '; «Лог-полярные клетки» при конформном')])
fix(G, 'guide.sound_top_bar_x', sub=[('звуковысотный класс которого равен arg', 'звуковысотный класс которого задаётся значением arg')])
fix(G, 'tour.plays_homotopy_h_t', 'Эта кнопка воспроизводит гомотопию $H_t$ от тождественного отображения до $F$' + D + 'шаг за шагом, во всех видах. В' + N + 'виде X → Y две панели сливаются в' + N + 'одну плоскость.',
    note='«проигрывать» also means «to lose» (GLOSSARY 1.15). The subject is named: «Эта кнопка».')
for k in ('tour.sound_stays_off_until', 'tour.sound_stays_off_until_2', 'tour.sound_stays_off_until_3'):
    fix(G, k, sub=[('замкнутая петля проигрывает своё число оборотов', 'у' + N + 'замкнутой петли звучит её число оборотов')])
fix(G, 'tour.try', 'Задание', note='Bold label before the task line: «Задание» avoids two imperatives in a row («Попробуйте Нажмите …»).')
fix(G, 'tour.try_2', ' Задание. ', note='Screen-reader text; keep the leading and trailing spaces. A full stop, not a colon: the task sentence starts with a capital.')
fix(G, 'tour.cards_apply_order_f', sub=[('чтобы сделать её шаг текущим', 'чтобы сделать этот шаг текущим')])
fix(G, 'tour.cards_apply_order_f_2', sub=[('чтобы сделать её шаг текущим', 'чтобы сделать этот шаг текущим')])
fix(G, 'guide.add_step_with_x', sub=[('Шаг добавляется клавишей {x}, карточкой добавления или кнопкой вставки между карточками;', 'Добавить шаг можно клавишей {x}, карточкой «Добавить функцию» или кнопкой вставки между карточками;'),
                                      ('Нажмите на карточку, чтобы сделать её шаг текущим.', 'Нажмите на карточку шага, чтобы сделать его текущим.')],
    note='{x} = k(\'+\'). Terms: перемычка, кнопка вставки между карточками, сделать шаг текущим (glossary 1.8). The add card is named by its label «Добавить функцию» (chrome.add_function_3).')

for name, tab in (('chrome.json', C), ('guide-tour.json', G)):
    p = os.path.join(H, name)
    json.dump(tab, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.load(open(p, encoding='utf-8'))
print('ok')

# ---- screenshot round (shots-ru, 2026-10-22): the 4-column tool grid wraps Russian names at soft hyphens (DESIGN 8.1)
C = json.load(open(os.path.join(H, 'chrome.json'), encoding='utf-8'))
SHY = '­'
for k, ru in (('chrome.circle', 'Окруж' + SHY + 'ность'), ('chrome.rectangle', 'Прямо' + SHY + 'угольник'), ('chrome.polygon', 'Много' + SHY + 'угольник')):
    e = C[k]
    if e['ru'].replace(SHY, '') == ru.replace(SHY, ''):
        e['ru'] = ru
        e['note'] = 'Tool label: U+00AD soft hyphen at the morpheme break, so the 4-column grid wraps it (DESIGN 8.1). Invisible when not broken; screen readers ignore it.'
for k, e in C.items():
    if k != '_meta' and e.get('en') == 'Half-plane' and e['ru'] == 'Полуплоскость':
        e['ru'] = 'Полу' + SHY + 'плоскость'; e['note'] = 'Tool label with a soft hyphen (DESIGN 8.1).'
json.dump(C, open(os.path.join(H, 'chrome.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('soft hyphens ok')
