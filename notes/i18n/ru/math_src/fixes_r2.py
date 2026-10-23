# -*- coding: utf-8 -*-
# Review round 2 (2026-10-22): fixes applied on top of tr1..tr4 and extras.
# FIX: id -> str (new ru, note kept) or dict (fields replaced; ru_short=None drops it; note=... replaces the note).
# EXTRA_FIX / EXTRA_ADD: the same for the entries missing from the inventory (extras.py).
NBSP = ' '
D = NBSP + '— '   # no-break space before an em dash (typo() would add it too)

PREAMBLE_NOTE = ('LaTeX comment, written only when the caption language is Russian (the English snippet keeps its own line). '
                 'Tested 2026-10-22: pdfLaTeX with T2A + babel-russian; XeLaTeX and LuaLaTeX with fontspec and the CMU files '
                 '(XeLaTeX does not find «CMU Serif» by name in TeX Live, so the file names are given).')

FIX = {
 # «сравнение» is a congruence mod m in Russian mathematics: «неравенство», or «знак сравнения» for the symbol
 'math.function_cannot_contain_comparisons': 'Функция не может содержать знаков <, >, =',
 'math.combine_comparisons_with_or': 'Соединяйте неравенства словами and / or / not',
 'math.combine_comparisons_with_or_2': 'Соединяйте неравенства словами and / or / not',
 'math.combine_comparisons_with_or_3': 'Соединяйте неравенства словами and / or / not',
 'math.comparisons_are_only_allowed': 'Неравенства и уравнения допустимы только в формулах областей',
 'math.region_needs_comparison_e': 'Область задаётся неравенством, например |z| < 1',
 'math.region_needs_comparison_e_2': 'Область задаётся неравенством, например |z| < 1, а кривая' + D + 'уравнением, например Re z = 0',
 'math.comparison_has_no_derivative': 'У неравенства нет производной',
 'math.comparison_has_no_inverse': 'У неравенства нет обратного',
 # dotted = точечная, dashed = штриховая (ГОСТ 2.303); «пунктирная» is avoided
 'export.solid_paths_t_h': ' Сплошные линии' + D + 'пути $t\\mapsto H_t(z)$ отмеченных точек до значения $t$ в кадре; точечные' + D + 'оставшаяся часть каждого пути; штриховая' + D + 'граница при $t=0$.',
 # a homotopy deforms id into F («переводит … в …» would mean f(A) ⊂ B)
 'export.shown_at_t_2': ' Показан кадр при $t={2}$. Здесь $H_t$ непрерывно деформирует тождественное отображение ($t=0$) в {map} ($t={hom.m}$); это {hom.tex}.',
 'export.deformation_h_t_choice': 'Деформация $H_t${choice}{choice} Показан кадр при $t={2}$. Здесь $H_t$ непрерывно деформирует тождественное отображение ($t=0$) в {map} ($t={hom.m}$); это {hom.tex}.',
 # preamble comments: the Cyrillic packages; «надписи» are the labels in the figure, «подпись» is the caption
 'export.if_your_l_narrower': dict(ru='% Если у вас {L} меньше, укажите [width={L}] (надписи уменьшатся). Преамбула (pdfLaTeX): \\usepackage[T2A]{fontenc}\\usepackage[russian]{babel}\\usepackage{graphicx,amsmath,amssymb}; в XeLaTeX и LuaLaTeX вместо fontenc' + D + '\\usepackage{fontspec}\\setmainfont{cmunrm.otf}[BoldFont=cmunbx.otf,ItalicFont=cmunti.otf]', note=PREAMBLE_NOTE),
 'export.n_pdf_made_for_2': dict(ru='% Файл {n}.pdf рассчитан на \\textwidth = {w}pt ({size.label}); на более узком слайде он уменьшается. Преамбула: \\usepackage[T2A]{fontenc}\\usepackage[russian]{babel}\\usepackage{graphicx}', note='LaTeX comment (Beamer). ' + PREAMBLE_NOTE),
 'export.labels_x_x_pt': ' · надписи {x}/{x} пт, как в тексте {tsz} пт · {choice} · {choice}',
 'export.snippet_includes_figure_at': 'Фрагмент вставляет рисунок в натуральную величину, поэтому надписи на нём совпадают по размеру с вашим текстом.',
 'export.n_pdf_made_for_3': '% Файл {n}.pdf рассчитан на {L} = {w}pt ({size.label}); вставляйте его без масштабирования, чтобы надписи совпадали по размеру с текстом.',
 'export.figure_2': 'На рисунке',
 # interval punctuation (GLOSSARY 2.3): «;» only when an endpoint has a decimal comma, decided per bracket pair where the
 # numbers are formatted (review mathematician-13, i18n-7). One name per value: the x and y ranges differ (review i18n-4).
 'math.grid_math_min_math': dict(ru='\\text{сетка } [%{xMin}%{xSep}%{xMax}]\\times[%{yMin}%{ySep}%{yMax}]',
   en_key='\\text{grid } [%{xMin}%{xSep}%{xMax}]\\times[%{yMin}%{ySep}%{yMax}]',
   ph={'xMin': '{Math.min}', 'xMax': '{Math.max}', 'yMin': '{Math.min}', 'yMax': '{Math.max}', 'xSep': ',', 'ySep': ','},
   note='Cyrillic inside \\text: on screen and in figures it needs the CMU path (DESIGN 5, cyrWord); MathJax alone draws <text> in a system font. The call site passes xMin, xMax, yMin, yMax from I18N.texNum and xSep = I18N.texSep([xMin, xMax]), ySep = I18N.texSep([yMin, yMax]) (GLOSSARY 2.3): [−1, 1] keeps its comma, [0{,}5;\\,1] gets the semicolon. English passes «,», so its output is unchanged.'),
 'export.w_k_w_k': '  w_{{k}} &= w_{{k}} && \\text{(шаг {k} отключён)}',
 'export.color_shows_f_key': ': цвет показывает $\\arg {f}$ (шкала справа); проведены линии уровня $|{f}|$ и $\\arg {f}$.',
 'export.order_r_mult': dict(ru=' (порядок {r.mult})', note='After a point in a list («Нули: $0$ (порядок 2)»): nominative, as sound.order_p_mult. In running text the genitive stays: «нуль порядка 2» (GLOSSARY 1.4). No plural needed.'),
 # the next word is a formula: a one-letter preposition keeps it on its line (GLOSSARY 3.6)
 'export.brightness_increases_with': 'яркость растёт вместе с' + NBSP,
 'export.by_factors': ' растёт в' + NBSP,
 'export.here_chain_built_step': ' Здесь цепочка строится по шагам, начиная с' + NBSP,
 'math.m_bius': dict(ru='Дробно-линейная', ru_short=None, note='Test code uses the English literal. No short form: «Мёбиус» contradicts GLOSSARY 1.2 (the TFKP books say «дробно-линейное»). The card fits «Дробно-линейная» with the Russian semi-condensed card names (shots-ru, 1440 px; phone cards have the same width); the tooltip and the palette say «Дробно-линейное отображение».'),
 'math.what_not_holomorphic_has': '{what} не является голоморфной функцией (у неё нет комплексной производной), поэтому эту формулу нельзя дифференцировать по z',
 'math.formula_undefined_for_every': 'Формула не определена ни при каком z (проверьте, нет ли деления на нуль или логарифма нуля)',
 'export.typesetter_still_loading_try': 'Модуль вёрстки формул ещё загружается; попробуйте чуть позже.',
 'export.figure_at_printed_size': 'Рисунок в печатном размере',
 'export.snippet_keeps_figure_under': 'Фрагмент оставляет рисунок под вашим решением и уменьшает его, только если ширина страницы меньше ширины рисунка.',
}

# ids whose ru deliberately adds TeX commands (the Russian preamble lines)
PREAMBLE_IDS = {'export.if_your_l_narrower', 'export.n_pdf_made_for_2'}

TWO_NOTE = ('work/xr figure.js captionFor(), X → Y. One template per sentence (Russian word order). {list} is the shape list in '
            'the nominative, lower case (A.segsTex(c.shapeList)); {list_gen} the same list in the genitive (needs the genitive '
            'forms of the shape phrases). {lvar} is c.lvar. split: single = one shape (c.nShapes == 1), several = more. '
            'Subfigure letters «а», «б» are Cyrillic and italic (GLOSSARY 11): segsOf() must map \\textit{…} to an italic '
            'segment and ~ to U+00A0. No gendered «его/её» for the shape: its noun is unknown.')
EXTRA_FIX = {
 'export.extra.hom_def': dict(ru=' Показан кадр при {t}. Здесь {H} непрерывно деформирует тождественное отображение ({t0}) в {map} ({t1}); это {hom}.'),
 'export.extra.fig_two_panels': dict(
   en='(a) {cap1} in the ${lvar}$-plane. (b) {Its image} under {map}.{pat}',
   ru='\\textit{а}~--- {list} в~плоскости~${lvar}$; \\textit{б}~--- образ при отображении {map}.{pat}',
   split={'single': '\\textit{а}~--- {list} в~плоскости~${lvar}$; \\textit{б}~--- образ при отображении {map}.{pat}',
          'several': '\\textit{а}~--- {list} в~плоскости~${lvar}$; \\textit{б}~--- образы при отображении {map}.{pat}'},
   note='Article caption, two panels (figure.js 1324). Lower-case {list} after «а —». ' + TWO_NOTE),
 'export.extra.fig_left_right': dict(
   en='{cap1} (left) and {its image} under {wmap} (right).',
   ru='Слева' + D + '{list}, справа' + D + 'образ при отображении {wmap}.',
   split={'single': 'Слева' + D + '{list}, справа' + D + 'образ при отображении {wmap}.',
          'several': 'Слева' + D + '{list}, справа' + D + 'образы при отображении {wmap}.'},
   note='Homework caption, two panels (figure.js 1316). ' + TWO_NOTE),
 'export.extra.fig_images_of': dict(
   en='The image{s} of {list} under {wmap}.',
   ru='Образ {list_gen} при отображении {wmap}.',
   split={'single': 'Образ {list_gen} при отображении {wmap}.', 'several': 'Образы {list_gen} при отображении {wmap}.'},
   note='Right panel only (figure.js 1317 homework, 1326 article; the article adds {pat}). ' + TWO_NOTE),
}
EXTRA_ADD = {
 'export.extra.fig_two_panels_plane': dict(file='work/xr/src/figure.js:1324', en='(a) The {lvar}-plane. (b) The image under {map}.{pat}',
   ru='\\textit{а}~--- плоскость~${lvar}$; \\textit{б}~--- её образ при отображении {map}.{pat}',
   note='Article caption, two panels, no shapes drawn. «её» is the plane (feminine, known). ' + TWO_NOTE),
 'export.extra.fig_left_only': dict(file='work/xr/src/figure.js:1317', en='{cap1} in the {lvar}-plane.', ru='{cap1} в~плоскости~${lvar}$.',
   note='Left panel only (homework and article). {cap1}: the list with a capital. ' + TWO_NOTE),
 'export.extra.fig_left_only_plane': dict(file='work/xr/src/figure.js:1325', en='The {lvar}-plane.', ru='Плоскость~${lvar}$.', note='Left panel only, no shapes.'),
 'export.extra.fig_right_only_plane': dict(file='work/xr/src/figure.js:1326', en='The image under {map}.{pat}', ru='Образ при отображении {map}.{pat}', note='Right panel only, no shapes.'),
 'export.extra.fig_the_map': dict(file='work/xr/src/figure.js:1316', en='The map {wmap}.', ru='Отображение {wmap}.', note='Homework caption with no shapes.'),
}

# ---------------------------------------------------------------------------------------------------------------
# Review round 3 (2026-10-22): the findings the round-2 reviser did not see. Ledger: notes/i18n/ledger-tables.json.
FIX.update({
 # copy-13 (verifier): the note on export.ink matches the fix and GLOSSARY 1.11
 'export.ink': dict(note='GLOSSARY 1.11. The B/W option is export.extra.ink_bw: «Оттенки серого» (ru_short «Ч/б» only if the control overflows).'),
 # copy-26: «Значение не конечно» is stiff
 'math.value_not_finite': 'Значение бесконечно или не определено',
 # copy-27: lines form a net of cells, not squares
 'export.so_phase_lines_modulus': ' раза, поэтому там, где отображение конформно, линии фазы и линии уровня модуля образуют сетку из почти квадратных клеток.',
 # i18n-17: an identifier (region.js CAP_FAMILY value), not UI text
 'math.circle_2': dict(ru='circle', note='Math or code only: an identifier (region.js 1552, CAP_FAMILY value), never shown. Never translate; drop from the inventory (review i18n-17).'),
 'export.amsart': dict(note='Math or code only: the LaTeX class name amsart (figure.js 463, an option id). Product and class names stay in Latin (GLOSSARY 3.11).'),
})

EXTRA_FIX.update({
 # copy-13: «Серая печать» is not idiomatic; GLOSSARY 1.11 says «оттенки серого»
 'export.extra.ink_bw': dict(ru='Оттенки серого', ru_short='Ч/б',
   note='Ink option next to «Цвет» (GLOSSARY 1.11: «Печать: цветная, оттенки серого»). ru_short «Ч/б» only if the segmented control overflows; it is the usual print-dialog label.'),
})

# i18n-21: the homework snippet's preamble comment, and the line for an English main document
PREAMBLE_IDS |= {'extra export.extra.preamble_homework', 'extra export.extra.preamble_english_main'}

SHAPE = ('app.js 8976–8996 shapePhrase(): shape phrases in figure captions (review i18n-1: not in the inventory). '
         'split.nom: after «а —», in lists, after «Слева —»; split.gen: after «Образ», «Образы», «дополнение» ({list_gen} in '
         'export.extra.fig_images_of). Lower case; cap1() capitalizes. Lists join with «, » and a final « и » (no comma).')
PAT = 'app.js 9018–9025 patternSegs(): the sentence on the image\'s shading (review i18n-1: not in the inventory).'
def _shape(src, en, nom, gen, note=''):
    return dict(file=src, en=en, ru=nom, split={'nom': nom, 'gen': gen}, note=(SHAPE + ' ' + note).strip())
EXTRA_ADD.update({
 'export.extra.shape_point': _shape('app.js:8981', 'the point {m}', 'точка {m}', 'точки {m}'),
 'export.extra.shape_segment': _shape('app.js:8983', 'the segment {m}', 'отрезок {m}', 'отрезка {m}'),
 'export.extra.shape_line': _shape('app.js:8985', 'the line {m}', 'прямая {m}', 'прямой {m}'),
 'export.extra.shape_line_through': _shape('app.js:8985', 'the line through {a} and {b}', 'прямая через точки {a} и {b}', 'прямой через точки {a} и {b}'),
 'export.extra.shape_ray': _shape('app.js:8986', 'the ray from {a} through {b}', 'луч из точки {a} через точку {b}', 'луча из точки {a} через точку {b}'),
 'export.extra.shape_circle': _shape('app.js:8987', 'the circle {m}', 'окружность {m}', 'окружности {m}'),
 'export.extra.shape_arc': _shape('app.js:8988', 'the arc from {a} through {m} to {b}', 'дуга от {a} через {m} до {b}', 'дуги от {a} через {m} до {b}'),
 'export.extra.shape_curve': _shape('app.js:8989', 'a freehand curve', 'нарисованная от руки кривая', 'нарисованной от руки кривой'),
 'export.extra.shape_disc': _shape('app.js:8990', 'the disc {m}', 'круг {m}', 'круга {m}'),
 'export.extra.shape_rect': _shape('app.js:8991', 'the rectangle {m}', 'прямоугольник {m}', 'прямоугольника {m}'),
 'export.extra.shape_polygon': dict(file='app.js:8992', en='a polygon with {n} vertices', ru='многоугольник с {n} вершинами',
   plural={'one': 'многоугольник с {n} вершиной', 'few': 'многоугольник с {n} вершинами', 'many': 'многоугольник с {n} вершинами', 'other': 'многоугольник с {n} вершинами'},
   note=SHAPE + ' Nominative. Plural forms by Intl.PluralRules("ru"): «с 21 вершиной», «с 5 вершинами». The genitive is export.extra.shape_polygon_gen.'),
 'export.extra.shape_polygon_gen': dict(file='app.js:8992', en='a polygon with {n} vertices', ru='многоугольника с {n} вершинами',
   plural={'one': 'многоугольника с {n} вершиной', 'few': 'многоугольника с {n} вершинами', 'many': 'многоугольника с {n} вершинами', 'other': 'многоугольника с {n} вершинами'},
   note=SHAPE + ' Genitive of export.extra.shape_polygon.'),
 'export.extra.shape_halfplane': _shape('app.js:8993', 'the half-plane {m}', 'полуплоскость {m}', 'полуплоскости {m}'),
 'export.extra.shape_annulus': _shape('app.js:8994', 'the annulus {m}', 'кольцо {m}', 'кольца {m}'),
 'export.extra.shape_sector': dict(file='app.js:8995', en='the sector {m}', ru='сектор {m}',
   split={'nom': 'сектор {m}', 'gen': 'сектора {m}', 'nom_unbounded': 'угол {m}', 'gen_unbounded': 'угла {m}'},
   note=SHAPE + ' An unbounded sector (radius 0) is «угол» in Russian books (GLOSSARY 1.1).'),
 'export.extra.shape_set': _shape('app.js:8996', 'the set {m}', 'множество {m}', 'множества {m}'),
 'export.extra.shape_fcurve': _shape('app.js:8997', 'the curve {m}', 'кривая {m}', 'кривой {m}'),
 'export.extra.shape_cgrid': _shape('app.js:8998', 'a Cartesian grid on {m}', 'декартова сетка на {m}', 'декартовой сетки на {m}'),
 'export.extra.shape_pgrid': _shape('app.js:8999', 'a polar grid in {m}', 'полярная сетка в {m}', 'полярной сетки в {m}'),
 'export.extra.shape_other': _shape('app.js:9000', 'a {kind}', '{kind}', '{kind}', '{kind} is the tool label in lower case, nominative; the genitive needs one form per kind.'),
 'export.extra.shape_complement': _shape('app.js:9003', 'the complement of {segs}', 'дополнение {segs}', 'дополнения {segs}', '{segs} is the shape phrase in the genitive (split.gen): «дополнение круга $|z|<1$».'),
 'export.extra.list_and': dict(file='app.js:9009', en=', and ', ru=' и ', note='joinList(): the last joiner. Russian puts no comma before the final «и» (« и » for two items and for more).'),
 'export.extra.pat_checker': dict(file='app.js:9018', en=' Regions are shaded by a checkerboard of cell ${cell}$ in the $z$-plane, carried by the map.',
   ru=' Области раскрашены в клетку размера ${cell}$: это шахматная раскраска плоскости $z$, перенесённая отображением.', note=PAT),
 'export.extra.pat_polar': dict(file='app.js:9019', en=' Regions are shaded by a log-polar checkerboard in the $z$-plane, whose cells stay square under conformal maps.',
   ru=' Области раскрашены лог-полярными клетками плоскости $z$; при конформном отображении малые клетки остаются почти квадратными.', note=PAT + ' «почти квадратными»: exact for small cells (the English says «stay square»).'),
 'export.extra.pat_tiles': dict(file='app.js:9020', en=' Regions are shaded by tiles marked with the letter F, which show rotation, scaling and reflection.',
   ru=' Области покрыты плитками с буквой F; плитки показывают поворот, растяжение и отражение.', note=PAT),
 'export.extra.pat_grid': dict(file='app.js:9021', en=' Lines are the coordinate lines of the $z$-plane, spaced ${cell}$.',
   ru=' Линии — координатные линии плоскости $z$ с шагом ${cell}$.', note=PAT),
 'export.extra.pat_polargrid': dict(file='app.js:9022', en=' Lines are circles about 0 and rays from 0 in the $z$-plane.',
   ru=' Линии — окружности с центром в точке 0 и лучи, выходящие из 0, в плоскости $z$.', note=PAT),
 'export.extra.pat_phase': dict(file='app.js:9023', en=' Regions are coloured by the argument of the source point.',
   ru=' Области окрашены по аргументу исходной точки.', note=PAT + ' «аргумент» is arg z here (GLOSSARY 1.15).'),
 'export.extra.pat_stretch': dict(file='app.js:9024', en=" The colour shows the local scale factor $|{F}'|$ (bar).",
   ru=" Цвет показывает коэффициент растяжения $|{F}'|$ (шкала).", note=PAT + ' GLOSSARY 1.2: «коэффициент растяжения».'),
 'export.extra.pat_sphere': dict(file='app.js:9025', en=' Regions are shaded by a checkerboard of ${n}$ longitude sectors and ${n2}$ latitude bands of the Riemann sphere of the $z$-plane, carried by the map.',
   ru=' Области раскрашены в шахматном порядке: сфера Римана плоскости $z$ разбита на долготные секторы (${n}$) и широтные пояса (${n2}$); раскраска перенесена отображением.',
   note=PAT + ' The counts stand in brackets, so no plural forms are needed.'),
 'export.extra.shown_for': dict(file='app.js:4794', en=', shown for ${range}$', ru=', показан участок ${range}$',
   note='morphHomSegs() stop segment (review i18n-1): the homotopy is drawn only up to the frame\'s t: «…, показан участок $0\\le t\\le 1{,}5$».'),
 'export.extra.after_first_step': dict(file='app.js:4856', en='The image of {set} after the first step', ru='Образ {set} после первого шага',
   note='Sibling of export.extra.image_after_steps (n = 1 in the English code). {set} in the genitive (split.gen of the shape phrases).'),
 'export.extra.fig_morph_two_panels': dict(file='app.js:9324', en='(a) {list} in the $z$-plane. (b) The deformation ${H}$: {rest}',
   ru='\\textit{а}~--- {list} в~плоскости~$z$; \\textit{б}~--- деформация~${H}$: {rest}',
   note='Deformation figure, two panels (review i18n-1). {list}: shape phrases, nominative, lower case. {H} = H_t,\\ 0\\le t\\le T. {rest}: morphCaption(…, {both: true}). ' + TWO_NOTE),
 'export.extra.fig_morph_two_panels_plane': dict(file='app.js:9324', en='(a) The plane in the $z$-plane. (b) The deformation ${H}$: {rest}',
   ru='\\textit{а}~--- плоскость~$z$; \\textit{б}~--- деформация~${H}$: {rest}', note='The same with no shapes drawn. ' + TWO_NOTE),
 'export.extra.power_homotopy': dict(file='funcs.js:323', en='the power homotopy $H_t({v})={lead}{at}{base}^{{e}}${parts} (principal branch)',
   ru='степенная гомотопия $H_t({v})={lead}{at}{base}^{{e}}${parts} (главная ветвь)',
   note='Homotopy phrase (review i18n-1), nominative like its siblings. {parts} lists $a=…$, $c=…$ with «, »; when a value has a decimal comma the separator is «; » (GLOSSARY 2.3).'),
 'export.extra.preamble_homework': dict(file='work/xr/src/figure.js:1446', en='% Preamble: \\usepackage{graphicx,amsmath,amssymb,float}',
   ru='% Преамбула (pdfLaTeX): \\usepackage[T2A]{fontenc}\\usepackage[russian]{babel}\\usepackage{graphicx,amsmath,amssymb,float}; в XeLaTeX и LuaLaTeX вместо fontenc — \\usepackage{fontspec}\\setmainfont{cmunrm.otf}[BoldFont=cmunbx.otf,ItalicFont=cmunti.otf]',
   note='Homework snippet (review i18n-21). ' + PREAMBLE_NOTE),
 'export.extra.preamble_english_main': dict(file='work/xr/src/figure.js:1446,1462', en='',
   ru='% Если основной язык документа английский: \\usepackage[T2A,T1]{fontenc}\\usepackage[russian,english]{babel}, а подпись — внутри \\foreignlanguage{russian}{…}',
   note='Review i18n-21: an English document with a Russian caption. One more comment line after the preamble line, written only when the caption is Russian (no English source). '
        'Tested 2026-10-22 with pdfLaTeX: 0 errors, English hyphenation in the text, Russian in the caption.'),
})

# ---------------------------------------------------------------------------------------------------------------
# Review round 4 (2026-10-22): the verifier's items. Ledger: notes/i18n/ledger-tables.json.
EXTRA_FIX.update({
 # i18n-5: "the set" / "the sets" has no count, so Intl plural forms are wrong (21 sets would read «множество»)
 'export.extra.set_of_a': dict(plural=None, en_split={'single': 'the set of (a)', 'several': 'the sets of (a)'},
   split={'single': 'множество на рис. а', 'several': 'множества на рис. а'},
   note='No count: split.single when nSets == 1, split.several when nSets > 1 (app.js 4851). Panel letter Cyrillic, italic in print.'),
})
