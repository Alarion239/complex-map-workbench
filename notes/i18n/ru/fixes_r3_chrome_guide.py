# -*- coding: utf-8 -*-
# Review round 3 (2026-10-22): the findings the round-2 reviser did not see (copy-11 … copy-28, and the i18n
# findings that need table text). Applied in place to ru/chrome.json and ru/guide-tour.json; idempotent.
# Run after fixes_r2_chrome_guide.py: python3 notes/i18n/ru/fixes_r3_chrome_guide.py
# The ledger is notes/i18n/ledger-tables.json.
import json, os, re
H = os.path.dirname(os.path.abspath(__file__))
N = ' '; D = N + '— '
C = json.load(open(os.path.join(H, 'chrome.json'), encoding='utf-8'))
G = json.load(open(os.path.join(H, 'guide-tour.json'), encoding='utf-8'))

def typo(s):
    # guide and tour typography (GLOSSARY 3.6): no-break space before an em dash and after one-letter words
    s = s.replace(' — ', D)
    return re.sub(r'(?<![\w\\{])([вВкКсСуУоОиИаАяЯ]) (?=\S)', r'\1' + N, s)

def dash(s):
    # chrome typography: no-break space before an em dash only
    return s.replace(' — ', D)

def fix(tab, k, ru=None, sub=None, **fields):
    e = tab[k]
    if ru is not None: e['ru'] = ru
    for a, b in (sub or []):
        assert a in e['ru'] or b in e['ru'], (k, a)
        e['ru'] = e['ru'].replace(a, b)
    for f, v in fields.items():
        if v is None: e.pop(f, None)
        else: e[f] = v

def add(tab, k, en, ru, note, **fields):
    e = tab.get(k, {})
    e.update(en=en, missing_from_inventory=True, ru=ru, note='Not in inventory.json (review i18n-1). ' + note)
    e.update(fields)
    tab[k] = e

TG = lambda k, s: fix(G, k, typo(s))

# ---------------- guide-tour.json ----------------
# copy-11: «изображения функции» reads as 'images of F'; «каждое» agreed with the wrong noun
TG('tour.x_y_shows_two', 'X → Y показывает две плоскости рядом. «Фаза» и «Рельеф» изображают саму функцию $F$ над X, каждый вид — на одной широкой панели. Клавиши {1} {2} {3}.')
TG('tour.x_y_shows_two_2', 'X → Y показывает две плоскости. «Фаза» и «Рельеф» изображают саму функцию $F$ над X, каждый вид — на одной широкой панели.')
# copy-12: «Предложение обзора» is a calque
TG('tour.tour_suggestion', 'Предложение пройти обзор')
TG('tour.dismiss_tour_suggestion', 'Скрыть предложение пройти обзор')
TG('tour.tour_suggestion_title_start', 'Предложение пройти обзор: {title}. Кнопки «Начать обзор» и «Не сейчас». Обзор всегда доступен в меню «{helpWhere}».')
# copy-16: «с зажатым Пробелом» is slang
fix(G, 'guide.switch_middle_top_bar', sub=[('средней кнопкой мыши, с' + N + 'зажатым Пробелом или двумя пальцами', 'средней кнопкой мыши, перетаскиванием с' + N + 'нажатым Пробелом или двумя пальцами')])
# copy-19: the keys list uses nouns; a shape is «выделить» (GLOSSARY 1.8, 1.15), so not «Выбор фигур»
fix(G, 'guide.select_move_shapes', 'Выделение и перемещение фигур', note='Keys list row: a noun phrase like its neighbours. Shapes are «выделить» (GLOSSARY 1.8); the tool itself is «Выбор».')
# copy-20: «дифференцирует всю цепочку до себя» is awkward
fix(G, 'guide.d_dz_step_too', sub=[('он дифференцирует всю цепочку до себя', 'он дифференцирует всю цепочку перед ним')])
fix(G, 'guide.f_1_on_card', sub=[('дифференцирует всю цепочку до себя', 'дифференцирует всю цепочку перед ним')])
fix(G, 'tour.d_dz_step_differentiates', sub=[('дифференцирует всю цепочку до себя:', 'дифференцирует всю цепочку перед ним:')])
# copy-21: three stiff phrases in the deformation guide
fix(G, 'guide.deformation_top_bar_x', sub=[
    ('и' + N + 'постоянная движутся по прямолинейной гомотопии.', 'и' + N + 'постоянная деформируются по прямолинейной гомотопии.'),
    ('Элементы воспроизведения под панелью перемещают <i>t</i>, задают скорость, а' + N + 'при двух шагах и' + N + 'более' + D + 'порядок:',
     'Элементы управления воспроизведением под панелью позволяют перемещать <i>t</i>, задавать скорость, а' + N + 'при двух шагах и' + N + 'более' + D + 'порядок:'),
    ('Если выбран текущий шаг, деформируется только он.', 'Если какой-то шаг сделан текущим, деформируется только он.')])
# copy-22: tour wording that sounds translated
fix(G, 'tour.worked_examples_from_joukowski', sub=[('Откройте любой, когда нужна отправная точка.', 'Откройте любой, когда понадобится отправная точка.')])
for k in ('tour.each_shape_listed_with', 'tour.each_shape_listed_with_2'):
    fix(G, k, sub=[('Каждая фигура указана в' + N + 'списке со своим уравнением; глаз скрывает её,', 'Каждая фигура есть в' + N + 'списке вместе со своим уравнением; значок глаза скрывает её,')])
TG('tour.pick_tool_drag_x', 'Выберите инструмент и проведите в X, чтобы добавить фигуру. Те же инструменты в Y добавляют цель в плоскости $w$.')
TG('tour.choose_disc_then_drag', 'Выберите «Круг» и проведите в X.')
fix(G, 'tour.x_shows_your_shapes', sub=[('а' + N + '{Z} вписывает обе плоскости.', 'а' + N + 'клавиша {Z} вписывает обе плоскости в' + N + 'окно.')])
# copy-23: «вернуть» twice
TG('tour.extra_work_not_back', 'Не удалось вернуть вашу работу на место, но она не потеряна: перезагрузите страницу.')
# copy-24: «и того, что слышно»
fix(G, 'guide.sound_top_bar_x', sub=[('открывает настройки громкости и' + N + 'того, что слышно:', 'открывает настройки громкости и' + N + 'состава звуков:')])
# copy-25: «раскрашивает интеграл Коши»; the wording follows tour.phase_style_cauchy_plots
fix(G, 'guide.right_click_curve_or', sub=[('Стиль <b>Интеграл Коши</b> фазового портрета раскрашивает интеграл Коши по выделенной замкнутой кривой:',
                                          'Стиль <b>Интеграл Коши</b> строит фазовый портрет интеграла Коши по выделенной замкнутой кривой:')])

# ---------------- chrome.json ----------------
# copy-16: «щипок» is not an interface word
fix(C, 'chrome.drag_orbit_pinch_zoom', dash('Перетаскивание вращает, двумя пальцами — масштаб'), note='Gesture words (GLOSSARY 3.9): «двумя пальцами», never «щипок».')
# copy-17: the no-break space belongs after «с», not before it (it tied «с» to the note name)
for k in ('sound.two_wooden_d4_knocks', 'sound.soft_wooden_a5_knock', 'sound.felt_thump_a4_a3', 'sound.three_quiet_glass_ticks'):
    C[k]['ru'] = re.sub(N + 'с ', ' с' + N, C[k]['ru'])
# copy-18: GLOSSARY 3.10 forbids «Макс»
fix(C, 'chrome.max', ru_short=None, note='«Максимум» in full (GLOSSARY 3.10: no «макс.»). It fits the mesh-quality stops at 390 and 1440 px (work/xl, headless Chrome, 2026-10-22: row scrollWidth = clientWidth).')
# copy-25: small wording fixes (the «разрыв» proposal for chrome.right_click_circle_around is rejected: mathematician-18)
fix(C, 'chrome.fh_vanishes_blows_up', 'На кривой функция {Fh} обращается в нуль или в бесконечность либо терпит разрыв, поэтому принцип аргумента неприменим.')
fix(C, 'chrome.step_constant_so_f', dash('Один из шагов — постоянная функция, поэтому функция F постоянна на D.'))
fix(C, 'chrome.list_sound_but_not', sub=[('но ни один из этих шагов не рационален,', 'но ни один из этих шагов не является рациональной функцией,')])
fix(C, 'chrome.circles_through_1_airfoils', 'Окружности, проходящие через ±1, переходят в профили крыла', note='«профиль (крыла)», GLOSSARY 1.9; a subject is named.')
# copy-26: the sibling hints use the present tense; «рельеф функции» as «фаза функции»
fix(C, 'chrome.adds_plan_what_z', 'Добавляет в плоскость z: {plan.what}')
fix(C, 'chrome.extra.adds_what', 'Добавляет: {what}.', split={'shape': 'Добавляет: {what}.', 'target': 'Добавляет в плоскость w: {what}.'},
    note='Not in inventory.json (found while translating). app.js 7656: `Adds ${plan.what}${as a target}.` plus notes. Colon keeps {what} nominative («прямая и 2 окружности»). '
         'target: whatever is added in w is a target (GLOSSARY 1.1), so «в плоскость w» says it without number agreement.')
fix(C, 'chrome.extra.role_landscape_of', 'рельеф функции {h}')
# copy-28: prose writes «Shift + M» (GLOSSARY 3.9); tooltip suffixes keep the keycap form «(Shift+M)», like «Отменить  ⌘Z»
fix(C, 'sound.shift_m_turns_sound', sub=[('Shift+M включает и выключает звук;', 'Shift + M включает и выключает звук;')])
fix(C, 'sound.sound_shift_m', note='Provisional (work/xs). Tooltip suffix: the key combination keeps the keycap form of the English (GLOSSARY 3.9); prose writes «Shift + M».')
fix(C, 'sound.sound_is_on_turn', note='Tooltip suffix: keycap form «(Shift+M)», as in English (GLOSSARY 3.9).')

# i18n-12: canvas legend text is never pseudo-localized; measured in work/xl (11px --f-ui, Roboto Flex for Cyrillic): the text starts at
# x = 30 in a 136 px canvas, so about 106 px are free. «видимая часть слева» is 109 px and was cut; «образ левого вида» is 97 px.
fix(C, 'chrome.left_view', 'образ левого вида', note='Canvas legend (app.js 7022): the dashed outline is the image of the left view under F, like «образ разреза» above it. '
    'Measured 97 px of the 106 px free (11px UI font); «видимая часть слева» (109 px) was cut. Never «вид слева» (a drawing term: the left side view).')

# i18n-17: identifiers are not UI text; they stay English in code and in the table
fix(C, 'chrome.export', 'export', keep=True, note='Not UI text: the reason code `why: \'export\'` passed to smFinish() (app.js 1306). Never shown; never translate. Drop from the inventory (review i18n-17).')

# i18n-1: visible strings the inventory lacks (app.js lines in the base src)
DC = 'app.js 6555 DC_STYLES (phase styles: label, tooltip). GLOSSARY 1.7.'
add(C, 'chrome.extra.dc_tiles_tip', 'Conformal tiles: phase sectors and modulus contours form squares',
    dash('Конформные плитки: секторы фазы и линии уровня модуля образуют сетку из почти квадратных клеток'), DC + ' Label «Плитки» is chrome.tiles.')
add(C, 'chrome.extra.dc_plain_tip', 'Phase only', 'Только фаза', DC + ' Label «Только фаза» is chrome.plain; the tooltip repeats it, as in English.')
add(C, 'chrome.extra.dc_modulus', 'Modulus', 'Модуль', DC)
add(C, 'chrome.extra.dc_modulus_tip', 'Brightness from |F|: zeros black, poles white', 'Яркость по |F|: нули чёрные, полюсы белые', DC)
add(C, 'chrome.extra.dc_contours', 'Contours', 'Линии уровня', DC + ' Never «контуры» (GLOSSARY 1.15).')
add(C, 'chrome.extra.dc_contours_tip', 'Level lines of |F| and arg F', 'Линии уровня |F| и arg F', DC)
add(C, 'chrome.extra.dc_grid_tip', 'Pull-back of the Re/Im grid of the image', 'Прообраз координатной сетки (Re, Im) плоскости образов', DC + ' Label «Сетка» is chrome.grid.')
add(C, 'chrome.extra.dc_cauchy', 'Cauchy', 'Интеграл Коши', DC + ' Same name as tour.phase_style_cauchy_plots and the guide.')
add(C, 'chrome.extra.dc_cauchy_tip', 'The Cauchy integral over the selected closed curve: F inside, 0 outside',
    'Интеграл Коши по выделенной замкнутой кривой: внутри F, снаружи 0', DC)
add(C, 'chrome.extra.tip_no_draw_deformation', '{base} · Turn off Deformation (M) to draw', '{base} · Чтобы рисовать, выключите деформацию (M)',
    'app.js 3014: tool tooltip suffix while the panes are merged by the deformation.')
add(C, 'chrome.extra.tip_draw_in_plane', '{base} · Draw in Plane', '{base} · Рисуйте в режиме «Плоскость»',
    'app.js 3014: tool tooltip suffix on a globe for Annulus, Sector and Polar grid. «Плоскость» is the Plane · Sphere switch.')
add(C, 'chrome.extra.image_after_adding', 'Image after adding {f}', 'Образ после добавления {f}',
    'app.js 8577: caption of the palette preview pane. {f} is f_k in HTML.')

for name, tab in (('chrome.json', C), ('guide-tour.json', G)):
    p = os.path.join(H, name)
    json.dump(tab, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.load(open(p, encoding='utf-8'))
print('r3 ok')
