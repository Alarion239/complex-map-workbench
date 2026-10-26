# Russian localization: glossary and style guide

Scope: every term, label and message style for the Russian interface of Complex Map Workbench.
Base read: `notes/gate-morph-zp-r1/src` (funcs.js, parse.js, app.js, page.html, tour.js, the guide).
In-flight features read: `work/xr/src/figure.js` (export dialog), `work/xs` (sound), `work/xt` (tour wired in).
English stays exactly as it is. Every rule here applies only when the interface language is Russian.

Sources, by short name:
- **Шабат**: Б. В. Шабат, «Введение в комплексный анализ».
- **ЛШ**: М. А. Лаврентьев, Б. В. Шабат, «Методы теории функций комплексного переменного».
- **СТ**: А. Г. Свешников, А. Н. Тихонов, «Теория функций комплексной переменной».
- **Евграфов**: М. А. Евграфов, «Аналитические функции».
- **Привалов**: И. И. Привалов, «Введение в теорию функций комплексного переменного».
- **Маркушевич**: А. И. Маркушевич, «Теория аналитических функций».
- **ВЛА**: Л. И. Волковыский, Г. Л. Лунц, И. Г. Араманович, «Сборник задач по теории функций комплексного переменного».
- **БС**: И. Н. Бронштейн, К. А. Семендяев, «Справочник по математике».

"Standard" below means: the usage shared by these books and by Russian university courses. No page numbers are given; the terms are the common vocabulary of these books, not quotations.

---

## 0. Decisions at a glance

These are the chosen defaults. Where a line names a switch, the choice lives in one place and can be reversed there.

1. **Function names**: Russian notation (tg, ctg, sh, ch, th, cth, arctg, arcctg, arsh, arch, arth, arcth, cosec, ln) in rendered formulas and LaTeX. Switch: `ruNotation`.
2. **LaTeX for these names**: always `\operatorname{tg}` and so on, never `\tg`. Reason in 2.5 (babel-russian prints «arctg» for `\th` without amsmath; tested).
3. **Logarithm**: `ln z` for the principal branch and for any branch named in words; `Ln z` only for the multivalued function ("All sheets"). Section 2.2.
4. **Re, Im, arg**: unchanged (`Re z`, `Im z`, `arg z`, upright). `Arg z` is the multivalued argument. Principal value `−π < arg z ≤ π`, as the app computes.
5. **Decimal comma** in Russian text, readouts, captions, figure tick labels and LaTeX (`0{,}5`). Input fields keep the point. Lists of decimals use «;». Switch: `decimalComma`.
6. **ё** is always written (ещё, всё, её, чёрный, тёмная). Switch: none needed; a lint checks it.
7. **«вы»**, lower case. Imperative plural in hints and the tour («Перетащите», «Нажмите»). Impersonal errors («Не удалось…»).
8. **Buttons and menu items**: perfective infinitive («Сохранить», «Скопировать», «Удалить»). Buttons that open a panel or menu: a noun («Экспорт», «Вид», «Ещё», «Справка»).
9. **Quotes** «ёлочки», inner „лапки“. **Dash** «—» with a no-break space before it.
10. **Key names**: as printed on the key (Shift, Ctrl, ⌘, Esc, Enter, Tab), except Space = «Пробел». Letter shortcuts show the Latin letter.
11. **Subfigure letters** in Russian captions: Cyrillic «а», «б» («а — круг; б — образ при отображении F»; no gendered «его/её»: the templates do not know the shape's noun). Figure label «Рис. 1». Switch: follows the caption language.
12. **UI font**: Archivo has no Cyrillic on Google Fonts (checked). In Russian, switch `--f-ui` to a Cyrillic family (recommended: Roboto Flex, which also has the width axis). Section 3.12.

---

## 1. Terms

Columns: English · Russian · source or reason · note.

### 1.1 Planes, points and sets

| English | Russian | Source / reason | Note |
|---|---|---|---|
| complex plane | комплексная плоскость | standard | |
| extended plane | расширенная комплексная плоскость | Шабат, СТ | |
| point at infinity, ∞ | бесконечно удалённая точка, ∞ | standard | |
| z-plane, w-plane | плоскость z, плоскость w | Шабат, ЛШ | Not «z-плоскость» (engineering style). Variable in italic. |
| input plane, left plane (X) | исходная плоскость; в подписях кнопок «плоскость X» | ЛШ say «исходная область» | Never «плоскость аргумента»: «аргумент» means arg z here. |
| image plane, right plane (Y) | плоскость образов; «плоскость Y» | | |
| image | образ | standard | «Образ круга при отображении F». Never «изображение» for the math sense. |
| preimage | прообраз | standard | «прообразы точки w». |
| under F | при отображении F | Шабат, ЛШ | «образ области D при отображении w = f(z)». |
| maps D onto G / into G | отображает D на G / в G | standard | «на» = onto, «в» = into. Keep the difference exactly. |
| becomes, goes to | переходит в | ЛШ (classical phrasing) | «полоса переходит в единичный круг». |
| one-to-one | взаимно однозначно | standard | |
| region (a drawn 2D set) | область | Шабат: область = open connected set | In UI labels «область» is fine. In captions name a non-open set exactly («замкнутый круг», «множество»). |
| set | множество | | |
| complement | дополнение | | |
| boundary | граница | | |
| interior point / boundary point | внутренняя точка / граничная точка | | |
| shape (any drawn object) | фигура | | Points, curves and regions are all «фигуры». |
| target (a set drawn in w) | цель | app term, no textbook equivalent | UI only. In captions: «множество в плоскости w», «его прообраз». |
| disc / disk | круг | standard | **Not** «диск». |
| unit disk | единичный круг | standard | |
| closed disc | замкнутый круг | standard | |
| circle | окружность | standard | **Not** «круг». The tools «Круг» and «Окружность» are different on purpose. |
| unit circle | единичная окружность | standard | |
| line | прямая | standard | **Not** «линия». |
| segment | отрезок | | |
| ray | луч | | |
| arc | дуга | | |
| curve | кривая | | |
| closed curve, contour | замкнутая кривая, контур | Шабат | «контур» only for a closed curve of integration. |
| polygon | многоугольник | | |
| rectangle | прямоугольник | | |
| vertex | вершина | | |
| half-plane, upper half-plane | полуплоскость, верхняя полуплоскость | standard | |
| right half-plane | правая полуплоскость | | |
| strip | полоса | standard | Collision with brightness "bands": see 1.15. |
| half-strip | полуполоса | ЛШ | |
| annulus | кольцо | Шабат, ЛШ | |
| sector | сектор; when unbounded: угол | Russian books call {α < arg z < β} «угол» (ЛШ, ВЛА) | Tool name «Сектор». Caption says «угол» when the radius is 0 (unbounded). Plural «секторы» (technical), not «сектора». |
| quarter plane, first quadrant | первая четверть | school and ЛШ usage | |
| slit plane | плоскость с разрезом | standard | |
| slit sphere | сфера с разрезом | | |
| grid (coordinate lines) | сетка | | |
| polar grid | полярная сетка | | |
| level line, level curve | линия уровня | Шабат | |
| level set | множество уровня | | |
| handle (on a shape) | маркер | Russian graphics editors | |
| marked point | отмеченная точка | | |

### 1.2 Maps and their properties

| English | Russian | Source / reason | Note |
|---|---|---|---|
| map, mapping | отображение | standard | Reserved for the math sense. Never for "display" (1.15). |
| function | функция | | |
| identity map | тождественное отображение | | |
| composite map, composition | композиция | | Panel header «Композиция». |
| F in closed form | F в явном виде | | |
| conformal | конформный | standard | |
| conformal onto its image | конформно отображает на свой образ | | Lamp: see 1.10. |
| holomorphic | голоморфный | Шабат | |
| analytic | аналитический | ЛШ, СТ | The app's lamp is «аналитическая»; tooltip says «голоморфна». Both are standard. |
| entire function | целая функция | standard | |
| meromorphic | мероморфный | | |
| rational function | рациональная функция | | |
| polynomial | многочлен | standard in Шабат, Привалов | «полином» is understood but less classical. |
| degree | степень | | «многочлен степени 3». |
| coefficient(s) | коэффициент(ы) | | |
| numerator / denominator | числитель / знаменатель | | |
| injective | инъективный; for analytic maps: однолистный | Шабат (однолистная функция) | Lamp keeps the general word; the conformal tooltip says «однолистная». |
| homeomorphism onto image | гомеоморфизм на образ | | |
| biholomorphism | биголоморфное отображение | Шабат | |
| proper map | собственное отображение | standard | Never «собственная функция»: that is an eigenfunction. |
| compact set | компакт | Шабат | |
| invariance of domain | теорема об инвариантности области | | |
| natural domain | естественная область определения | school and university usage for exactly this set | Short form on phones: «Область определения». Not «область существования» (that is the maximal continuation). |
| Möbius transformation | дробно-линейное отображение (функция) | Шабат, ЛШ, СТ | «преобразование Мёбиуса» exists in geometry; the TFKP books say «дробно-линейное». Card label «Дробно-линейная»; no short «Мёбиус». |
| elliptic / hyperbolic / parabolic / loxodromic | эллиптическое / гиперболическое / параболическое / локсодромическое | Шабат | |
| fixed point | неподвижная точка | | |
| one-parameter group | однопараметрическая группа | | |
| circles to circles | окружности переходят в окружности | круговое свойство, standard | Lines count as circles; say «(прямые — тоже окружности)» once in the guide. |
| linear map az + b | линейная функция | Шабат, СТ call az + b «линейная» | English label "Affine". Russian label «Линейная»; menu formula shows az + b. |
| 1/z | функция 1/z | Шабат | Not «инверсия»: in Russian books инверсия is z ↦ 1/z̄. |
| translation | сдвиг | | |
| rotation, scaling | поворот, растяжение | | |
| reflection | симметрия, отражение | | «симметрия относительно вещественной оси». |
| conjugation | сопряжение | | |
| Joukowski function | функция Жуковского | ЛШ | Russian spelling «Жуковский». |
| Joukowski airfoil | профиль Жуковского | ЛШ | «профиль крыла». |
| trailing edge | задняя кромка | aerodynamics | |
| Cayley transform | преобразование Кэли | standard spelling «Кэли» | |
| Blaschke product | произведение Бляшке | standard | |
| disk automorphism | автоморфизм круга | Шабат | |
| derivative | производная | | |
| inverse (function) | обратная функция, обратное отображение | | |
| no single inverse | нет однозначной обратной | | |
| critical point / value | критическая точка / критическое значение | | |
| local scale factor \|F′\| | коэффициент растяжения \|F′\| | ЛШ | Pattern "Stretch" = «Растяжение». |
| cube roots of unity | кубические корни из единицы | | |
| helicoid | геликоид (винтовая поверхность) | | |

### 1.3 Multivalued functions

| English | Russian | Source / reason | Note |
|---|---|---|---|
| branch | ветвь | standard | |
| principal branch | главная ветвь | standard | |
| principal value | главное значение | standard | |
| branch cut, cut | разрез | Шабат, ЛШ | |
| seam (position of the cut) | линия разреза | | Avoid «шов». |
| cut angle | угол разреза | | |
| sheet | лист | standard | «лист k», «все листы». |
| sheet (branch index) | лист (номер ветви) | | |
| Riemann surface | риманова поверхность | standard | Adjective form here, unlike «сфера Римана». |
| multivalued | многозначный | standard | |
| single-valued | однозначный | | |
| movable cut | подвижный разрез | | |
| hatched side (the side the cut belongs to) | заштрихованная сторона | | |
| exterior / interior branch (inverse Joukowski) | внешняя / внутренняя ветвь | | |

### 1.4 Zeros, singularities, integrals

| English | Russian | Source / reason | Note |
|---|---|---|---|
| zero | нуль | standard math form | «нуль функции», «нуль порядка m». Use «ноль» only for the digit in everyday words; in this app always «нуль». |
| zero of order m | нуль порядка m | Шабат | «кратность» = multiplicity. |
| multiplicity | кратность | | «с учётом кратности». |
| pole | полюс; plural **полюсы** | standard math plural | Not «полюса» (that plural is geographic). «2 полюса» (gen. sg.) is correct. |
| pole of order m | полюс порядка m | | |
| singular point, singularity | особая точка | standard | |
| isolated / removable | изолированная / устранимая особая точка | | |
| essential singularity | существенно особая точка | Шабат, ЛШ | |
| residue | вычет; Res | standard | `\operatorname{Res}` unchanged. Decided (review i18n-8): Шабат and ЛШ write res, СТ write выч; Res is also usual in Russian courses, is read the same way, and keeps Cyrillic out of formulas. Never «выч». |
| line integral ∫ F dz | интеграл по кривой | Шабат | Not «криволинейный интеграл» (that is the real-variable term). |
| contour integral ∮ | интеграл по контуру | standard | |
| running integral | интеграл с переменным верхним пределом | standard | |
| Cauchy integral | интеграл Коши | standard | |
| argument principle | принцип аргумента | standard | |
| winding number | число оборотов | common in Russian courses with the argument principle | Books also say «индекс кривой относительно точки». One term in the app: «число оборотов». |
| root (of F(z) = p) | корень уравнения F(z) = p | | |
| solve | решить | | |

### 1.5 Deformation

| English | Russian | Source / reason | Note |
|---|---|---|---|
| homotopy | гомотопия | Шабат | |
| deformation | деформация | | Toggle label «Деформация». |
| natural path | естественный путь | app term | |
| paths t ↦ H_t(z) | пути t ↦ H_t(z) | Шабат: путь = continuous map of a segment | Toggle «Пути». «траектории» is a palette synonym only. |
| straight-line homotopy | прямолинейная гомотопия | | |
| zoom homotopy | гомотопия масштабирования | app term, no textbook form | |
| power homotopy | степенная гомотопия | app term | |
| all steps at once | все шаги сразу | | |
| one after another | по очереди | | |
| play / pause | воспроизвести / пауза | | |
| scrub t | перемещать t | | «Перетащите t». |
| speed | скорость | | |
| loop (repeat playback) | повтор | | Not «петля»: that is the sound loop (1.12). |
| time | время | | |
| frame | кадр | | |

### 1.6 Views and display

| English | Russian | Source / reason | Note |
|---|---|---|---|
| view | вид | | |
| X → Y | X → Y | | Unchanged. |
| Phase (view) | Фаза | | Short tab label. |
| phase portrait | фазовый портрет | Wegert's term | Collides with ODE phase portraits; "of a function F" removes doubt. Always «фазовый портрет функции F» on first use. |
| domain colouring (the method) | раскраска области | Russian online usage | Palette synonym; the picture is still «фазовый портрет». |
| phase (of a value), arg F as colour | фаза, цвет фазы | physics usage | In formulas always «arg F». |
| phase sectors | секторы фазы | | |
| phase key | шкала фазы | | Checkbox in Y options. Figure note "(key at right)" = «(шкала справа)». |
| Landscape (view), the 3D graph of \|F\| | Рельеф; рельеф модуля | classical Russian term «рельеф модуля аналитической функции» | The app already calls its lit style «the relief». |
| plaster (lit relief style) | гипс | | |
| height | высота | | |
| height scale | масштаб высоты | | |
| unit level | уровень 1 | | |
| pits / peaks | ямы / пики | | «нули — ямы, полюсы — пики». |
| Plane / Sphere | Плоскость / Сфера | | |
| Riemann sphere | сфера Римана | Шабат, СТ | «риманова сфера» is also used; pick one: «сфера Римана». |
| north pole | северный полюс | | |
| equator | экватор | | |
| stereographic projection | стереографическая проекция | | |
| globe (the sphere on screen) | сфера | | Avoid «глобус» in UI text. |
| longitude / latitude | долгота / широта | | «долготные секторы, широтные пояса». |
| flat view | плоский вид | | |
| in view | в видимой части | | Not «в поле зрения». |
| fit (view) | вписать | | «Вписать обе плоскости  Z». |
| zoom in / out | увеличить / уменьшить | | |
| pan | сдвигать вид | | |
| orbit, turn | вращать | | |
| reset camera | сбросить камеру | | |
| top / front | сверху / спереди | | |
| probe, pointer | указатель | | «Наведите указатель на точку». |
| readout, readings | показания | | |
| derivative gauge | индикатор производной | | |
| mesh (triangles) | триангуляция | | Never «сетка» (that is grid). |
| mesh quality | детализация | | Options: Черновая · Обычная · Высокая · Ультра · Максимум. |
| opacity | непрозрачность | | |
| unit circle (toggle) | единичная окружность | | |
| orientation chevrons | стрелки ориентации | | |
| grid lines on regions | линии сетки на областях | | |
| snap while drawing | привязка при рисовании | | |
| theme: Auto / Light / Dark | Тема: Авто / Светлая / Тёмная | | |

### 1.7 Patterns and phase styles

Patterns (left panel, "Pattern carried by the map" = «Узор, переносимый отображением»):

| English | Russian | Note |
|---|---|---|
| Checker | Клетки | «тетрадь в клетку»; tooltip «Шахматная раскраска в координатах z». |
| Log-polar | Лог-полярные клетки | Cells in ln \|z\| and arg z. |
| Tiles | Плитки | Tiles with the letter F. |
| Grid | Сетка | |
| Polar grid | Полярная сетка | |
| Arg z | arg z | Lower case: «Arg z» is the multivalued argument in Russian notation. |
| Stretch | Растяжение | «синий — сжатие, янтарный — растяжение». |
| Sphere checker | Клетки сферы | |
| Solid | Заливка | |
| cell, cell size | клетка, размер клетки | |

Phase styles:

| English | Russian |
|---|---|
| Tiles | Плитки |
| Plain / Phase only | Только фаза |
| Modulus | Модуль |
| Contours | Линии уровня |
| Grid | Сетка |
| Cauchy | Интеграл Коши |
| Colouring | Раскраска |
| Phase colours with modulus contours | Цвет фазы и линии уровня модуля |

### 1.8 Chain, steps, tools

| English | Russian | Note |
|---|---|---|
| function chain, chain | цепочка функций, цепочка | |
| step | шаг | «шаг f₂». |
| focus a step, focused step | сделать шаг текущим, текущий шаг | Not «фокус», not «выделить» (selection is for shapes). |
| card | карточка | |
| cards: normal / compact | карточки: обычные / компактные | |
| whole chain | вся цепочка | |
| connector, insert button | кнопка вставки между карточками | |
| jumper, bypass a step | перемычка; отключить шаг | «Включить шаг снова». |
| parameters | параметры | |
| presets | готовые варианты | Not «пресеты», not «предустановки». |
| custom formula | своя формула | |
| write by zeros and poles | задать нулями и полюсами | |
| write by coefficients | задать коэффициентами | |
| replace with derivative / inverse | заменить производной / обратной | |
| insert d/dz after it | вставить d/dz после него | |
| move left / right | сдвинуть влево / вправо | |
| select (tool), selected shape | Выбор; выделенная фигура | |
| point, segment, line, ray | Точка, Отрезок, Прямая, Луч | Tool names. |
| circle, arc, freehand | Окружность, Дуга, От руки | |
| disc, rectangle, polygon, lasso | Круг, Прямоугольник, Многоугольник, Лассо | |
| half-plane, annulus, sector | Полуплоскость, Кольцо, Сектор | |
| formula (tool), region from a formula | Формула; область по формуле | |
| region tools (panel) | Инструменты | |
| drawing tools | инструменты рисования | |
| draw (section) | Рисование | |
| display (section) | Вид | Never «Отображение». |
| shapes / targets (lists) | Фигуры / Цели | |
| show / hide | показать / скрыть | |
| duplicate | дублировать | |
| bring forward / send backward | переместить вперёд / назад | As in Russian office suites. |
| color, custom color… | цвет, другой цвет… | |
| use complement / use the set itself | взять дополнение / взять само множество | |
| integrate along it | вычислить интеграл по кривой | |
| Argand diagram (value picker) | комплексная плоскость | «диаграмма Арганда» is rare in Russian books. |
| pick a complex value | выбрать комплексное число | |

### 1.9 Function catalog

Groups and labels. Menu formulas follow section 2.

| English | Russian |
|---|---|
| Linear & Möbius | Линейные и дробно-линейные |
| Multiply by c | Умножение на c |
| Translate by c | Сдвиг на c |
| Affine | Линейная |
| Inversion (1/z) | Функция 1/z |
| Möbius | Дробно-линейная |
| Cayley (z−i)/(z+i) | Преобразование Кэли (z − i)/(z + i) |
| Inverse Cayley | Обратное преобразование Кэли |
| Half-plane → disk | Полуплоскость → круг |
| Disk → right half-plane | Круг → правая полуплоскость |
| Disk automorphism | Автоморфизм круга |
| Powers & roots | Степени и корни |
| Integer power | Целая степень |
| n-th root | Корень n-й степени |
| Complex power | Комплексная степень |
| Exponential & log | Экспонента и логарифм |
| Exponential | Экспонента |
| Logarithm | Логарифм |
| Trigonometric | Тригонометрические |
| Sine, Cosine, Tangent | Синус, Косинус, Тангенс |
| Hyperbolic sine, cosine, tangent | Гиперболический синус, косинус, тангенс |
| Inverse trigonometric | Обратные тригонометрические |
| Arcsine, Arccosine, Arctangent | Арксинус, Арккосинус, Арктангенс |
| Inverse sinh, cosh, tanh | Ареасинус, Ареакосинус, Ареатангенс (БС) |
| Special | Специальные |
| Joukowski | Функция Жуковского |
| Inverse Joukowski | Обратная к функции Жуковского |
| Conjugation | Сопряжение |
| Polynomial & custom | Многочлены и свои формулы |
| Polynomial | Многочлен |
| Rational | Рациональная |
| Zeros and poles | Нули и полюсы |
| Custom formula | Своя формула |
| Calculus | Анализ |
| d/dz | d/dz |
| Recently used | Недавние |
| Examples | Примеры |
| Steps | Шаги |
| Actions | Действия |

Palette keywords: keep every English keyword and add the Russian ones («логарифм ln lg», «синус sin», «Жуковский», «Кэли», «дробно-линейная мёбиус», «нули полюсы корни», «вычет интеграл»). Russian users often type English names.

### 1.10 Guarantees

Lamp labels are noun phrases. Each is the class name a Russian textbook uses, so its noun carries its own gender.

| English lamp | Russian lamp | Chip (was) | Tooltip, Russian |
|---|---|---|---|
| Analytic | Аналитическая функция | А (A) | Функция F голоморфна в каждой точке естественной области определения D. |
| Entire | Целая функция | Ц (E) | D = ℂ, и функция F голоморфна всюду. |
| Rational | Рациональная функция | Р (R) | Совпадает на D с P(z)/Q(z), где P и Q — многочлены. |
| Polynomial | Многочлен | М (P) | Многочлен от z. |
| Möbius | Дробно-линейная функция | ДЛ (M) | F(z) = (az + b)/(cz + d), ad − bc ≠ 0. |
| Proper | Собственное отображение | С (Pr) | Прообразы компактов в ℂ компактны в D, поэтому \|F(z)\| → ∞ при z → ∂D или z → ∞. |
| Homeomorphism onto image | Гомеоморфизм на образ | И (I) | Отображение F инъективно и непрерывно на открытом множестве D, поэтому по теореме об инвариантности области оно — гомеоморфизм D → F(D). |
| Conformal onto image | Конформное отображение на образ | | Функция F голоморфна и однолистна, поэтому задаёт биголоморфное отображение D → F(D), причём F′ ≠ 0. |

Other guarantee strings:
- Guarantees → «Гарантии»; Guaranteed properties → «Гарантированные свойства».
- guaranteed / not guaranteed → «гарантировано» / «не гарантировано».
- lit / unlit lamp → «лампа горит» / «лампа не горит».
- Step by step → «По шагам». How these are decided → «Как это определяется».
- "An operator, not a map" (d/dz) → «Оператор, а не отображение».

### 1.11 Export and figures

| English | Russian | Note |
|---|---|---|
| Export (button) | Экспорт | Opens the dialog. |
| Export figure (dialog title) | Экспорт рисунка | |
| figure | рисунок | |
| Figure for an article… | Рисунок для статьи… | |
| caption | подпись | |
| caption language | язык подписи: Русский · English | Endonyms. |
| in the figure / LaTeX only | на рисунке / только в LaTeX | «на рисунке», as «на рис. 1». |
| labels in the figure (ticks, axis titles) | надписи | «подпись» is only the caption (Мильчин, Чельцова). |
| solid · dotted · dashed (lines) | сплошная · точечная · штриховая | ГОСТ 2.303. Never «пунктирная»: readers take «пунктир» for dashed. |
| For: Article · Homework · Slides | Для: Статья · Задание · Слайды | "Homework" = «домашнее задание»; the short label is «Задание». |
| Problem 3. | Задача 3. | |
| One column · Two column | Одна колонка · Две колонки | |
| Single column / Double column | В одну колонку / Во всю ширину | |
| figure* across both columns | figure* на обе колонки | |
| REVTeX column, IEEE full width | Колонка REVTeX, IEEE во всю ширину | |
| 1 in margins · Letter | Поля 1 дюйм · Letter | |
| 2.5 cm margins · A4 | Поля 2,5 см · A4 | |
| Overleaf article · 11 pt | Статья Overleaf · 11 пт | |
| Columns, Width, Size, Text size | Колонки, Ширина, Размер, Размер текста | |
| Colour / Ink: print colour, gray only | Цвет / Печать: цветная, оттенки серого | |
| Ink option B/W | Оттенки серого (short «Ч/б» only if the control overflows) | Not «Серая»: «серая печать» is not idiomatic. |
| See in grey | Проверить в оттенках серого | |
| Panels: Both · Left · Right | Панели: Обе · Левая · Правая | |
| Time: Whole · Up to t | Время: Целиком · До t | |
| Filmstrip | Раскадровка | |
| Paths / Arrows / None | Пути / Стрелки / Нет | |
| Crop: Fit content · As on screen | Обрезка: По содержимому · Как на экране | |
| Axes: Box · Cross · None | Оси: Рамка · Крест · Нет | |
| Loupe | Лупа | |
| File name | Имя файла | |
| More formats | Другие форматы | |
| Regenerate | Создать заново | |
| Edit the caption | Изменить подпись | |
| Copy LaTeX figure | Скопировать LaTeX-код рисунка | |
| Copy LaTeX only | Скопировать только LaTeX-код | |
| Save figure | Сохранить рисунок | |
| Copy image | Скопировать как изображение | «изображение» = picture; never «образ». |
| For Overleaf / Docs / Slides / Beamer | Для Overleaf / Docs / Slides / Beamer | Product names stay. |
| Copy LaTeX with guarantees | Скопировать LaTeX-код с гарантиями | |
| Save LaTeX (.txt) | Сохранить LaTeX (.txt) | |
| The map / Natural domain / Guaranteed properties (LaTeX sections) | Отображение / Естественная область определения / Гарантированные свойства | |
| % Exported from Complex Map Workbench | % Экспортировано из Complex Map Workbench | |

Captions in Russian:
- Label «Рис. 1.» Subfigures «а», «б» in italic: «Рис. 1. а — круг |z| < 1; б — образ при отображении F». Lower case after the dash; «в плоскости z» (locative); «образ» / «образы», never «его/её образ» (the shape's gender is unknown to the template). Templates: `math.json` `missing_from_inventory` `export.extra.fig_*`.
- LaTeX `\caption` with babel-russian prints «Рис. 1:» in the article class. Authors who want «Рис. 1.» add `\usepackage[labelsep=period]{caption}`. The snippet comment may say so once.
- Russian snippet preamble line (comment in the snippet, written only for a Russian caption): pdfLaTeX `\usepackage[T2A]{fontenc}\usepackage[russian]{babel}\usepackage{graphicx,amsmath,amssymb}`; XeLaTeX or LuaLaTeX `\usepackage{fontspec}\setmainfont{cmunrm.otf}[BoldFont=cmunbx.otf,ItalicFont=cmunti.otf]` instead of fontenc. Beamer: `\usepackage[T2A]{fontenc}\usepackage[russian]{babel}\usepackage{graphicx}`. Tested 2026-10-22 with pdflatex, xelatex, lualatex and beamer: 0 errors, 0 missing characters. XeLaTeX does not find `CMU Serif` by name in TeX Live (7 errors), so the file names are given; LuaLaTeX finds both.
- English main document with a Russian caption: `\usepackage[T2A,T1]{fontenc}\usepackage[russian,english]{babel}` and the caption inside `\foreignlanguage{russian}{…}` (one more comment line, `export.extra.preamble_english_main`). Tested 2026-10-22 with pdfLaTeX: 0 errors.
- Shape phrases in captions (`export.extra.shape_*`) carry the nominative (after «а —», in lists) and the genitive (after «Образ», «дополнение»). Lists join with «, » and a final « и », with no comma before it.
- Tick labels inside the figure follow the caption language (decimal comma in Russian).

### 1.12 Sound

| English | Russian | Note |
|---|---|---|
| Sound | Звук | |
| Sound settings | Настройки звука | |
| Sound on / off | Звук включён / выключен | Toast: «Звук включён.» |
| Hear the function | Слушать функцию | Toggle. |
| Hear the function under the pointer | Слушать функцию под указателем | |
| Listen along the curve | Слушать вдоль кривой | |
| Stop listening / Stop sound | Остановить прослушивание / Выключить звук | |
| tone | тон | |
| cue | сигнал | |
| pitch, pitch class | высота звука, звуковысотный класс | |
| register, loudness | регистр, громкость | |
| Volume | Громкость | |
| Snap ticks | Щелчки привязки | |
| Interface / Mathematical events | Интерфейс / Математические события | |
| What you hear | Что слышно | |
| loop (keyboard loop) | петля | |
| Loop closed | Петля замкнута | |
| one full turn / many turns | полный оборот / много оборотов | |
| Preimages collide | Прообразы сливаются | |
| Audio engine: not started | Звук: ещё не запущен | |
| Saved on this device only, never in your work or a shared link. | Хранится только на этом устройстве — не в работе и не в ссылке. | |

### 1.13 Tour, help, palette, settings

| English | Russian | Note |
|---|---|---|
| tour | обучение | (v16.5, UX93 of notes/ux-audit/REPORT.md, approved by the user: «обзор» read as "overview", not a tutorial; it was «обзор» to v16.4.) «экскурсия» too playful; «тур» an anglicism. |
| chapter | глава | |
| End the tour | Завершить обучение | |
| Back / Next: <chapter> / Done | Назад / Далее: <глава> / Готово | |
| New (badge) | Новое | |
| Help (menu) | Справка | |
| Guide (reference) | Руководство | |
| Using the Workbench | Как работать с Complex Map Workbench | |
| Keys | Клавиши | |
| Command palette | Палитра команд | As in Russian VS Code. |
| Search | Поиск | |
| Add function or command (placeholder) | Функция или команда | |
| More | Ещё | |
| Examples | Примеры | |
| Language: Auto · English · Русский | Язык: Авто · English · Русский | Endonyms in both interfaces. Tooltip «Авто — язык системы. Хранится только на этом устройстве.» |
| Tour suggestion | Предложение пройти обучение | Not «Предложение обучения» (a calque). |
| Try it (tour task label) | Задание | Avoids two imperatives in a row. |
| Undo / Redo | Отменить / Повторить | |
| Close / Done / Cancel | Закрыть / Готово / Отмена | |
| Copy / Copied | Скопировать / Скопировано | |
| Delete / Remove | Удалить | |
| Clear | Очистить | |
| Add | Добавить | |
| Up to date | Актуально | |
| Refining near cuts and poles | Уточнение у разрезов и полюсов | |
| Evaluation failed | Не удалось вычислить | |

Chapter names: Basics «Основы»; Views «Виды»; Deformation «Деформация»; Analysis «Анализ»; Branches and inverses «Ветви и обратные функции»; Export and LaTeX «Экспорт и LaTeX»; Palette and keys «Палитра и клавиши».
Durations: «2 мин», «1,5 мин», «30 с».

### 1.14 Examples

| English | Russian |
|---|---|
| Empty canvas | Пустой холст |
| Strip to disk | Полоса на круг |
| Quarter plane squared | Квадрат первой четверти |
| Joukowski airfoil | Профиль Жуковского |
| Logarithm of an annulus | Логарифм кольца |
| Disk automorphism | Автоморфизм круга |
| Sine of a half-strip | Синус полуполосы |
| Square root and its sheets | Квадратный корень и его листы |
| Cayley, then cube | Кэли, затем куб |
| A formula in LaTeX | Формула в LaTeX |
| Roots as preimages | Корни как прообразы |
| A residue by integration | Вычет через интеграл |
| The derivative in the chain | Производная в цепочке |
| Every sheet of the logarithm | Все листы логарифма |

### 1.15 Collisions: words with one meaning only

| Russian word | Means only | For the other sense use |
|---|---|---|
| отображение | a map | display → «вид», «показ»; rendering → «отрисовка» |
| образ | image of a set | a picture → «изображение», «картинка» |
| аргумент | arg z | the input of a function → «переменная», «точка z» |
| модуль | \|z\| | |
| область | a region, a set in the plane | domain of definition → «область определения» |
| сетка | coordinate grid | mesh → «триангуляция»; mesh quality → «детализация» |
| контур | closed curve of integration | modulus contours → «линии уровня модуля» |
| полоса | a strip {a < Im z < b} | brightness bands → «полосы яркости» (always with the noun) |
| порядок | order of a zero or pole | order of deformation steps → «по очереди / все сразу» |
| петля | the keyboard loop (sound) | repeat playback → «повтор» |
| шаг | a step of the chain | grid spacing → «шаг сетки» (context is clear) |
| полюс | pole of F; «северный полюс» on the sphere | context is clear; plural of the math pole is «полюсы» |
| Arg | multivalued argument | the pattern label is «arg z» |
| сравнение | a congruence a ≡ b (mod m) | an inequality → «неравенство»; the symbol → «знак сравнения»; «<, >, =» in errors |
| подпись | the caption under a figure | text inside the figure → «надписи» |
| пунктирная (линия) | (avoid) | dotted → «точечная»; dashed → «штриховая» |
| проигрывать | (avoid: also «to lose») | play → «воспроизводить», «звучит», «озвучить» |
| переводит … в … | f(A) ⊂ B | a homotopy from id to F → «деформирует id в F» |
| выбрать | a tool, an option | a shape → «выделить», «выделенная фигура» (1.8) |
| до себя | (avoid) | the chain before a d/dz step → «вся цепочка перед ним», «до этого места» |
| изображение функции | a picture, not the math image | Phase and Landscape → «изображают саму функцию F» |

---

## 2. Notation

### 2.1 Function names

| Function | English UI and LaTeX (unchanged) | Russian UI | Russian LaTeX | Parser accepts (both languages) |
|---|---|---|---|---|
| tangent | tan, `\tan` | tg | `\operatorname{tg}` | tan, tg, `\tan`, `\tg` |
| cotangent | cot, `\cot` | ctg | `\operatorname{ctg}` | cot, ctg, `\cot`, `\ctg` |
| cosecant | csc, `\csc` | cosec | `\operatorname{cosec}` | csc, cosec, `\csc`, `\cosec` |
| secant | sec | sec | `\sec` | sec |
| hyperbolic sine | sinh, `\sinh` | sh | `\operatorname{sh}` | sinh, sh, `\sinh`, `\sh` |
| hyperbolic cosine | cosh | ch | `\operatorname{ch}` | cosh, ch, `\cosh`, `\ch` |
| hyperbolic tangent | tanh | th | `\operatorname{th}` | tanh, th, `\tanh`, `\th` |
| hyperbolic cotangent | coth | cth | `\operatorname{cth}` | coth, cth, `\coth`, `\cth` |
| arcsine, arccosine | arcsin, arccos | arcsin, arccos | `\arcsin`, `\arccos` | unchanged |
| arctangent | arctan | arctg | `\operatorname{arctg}` | arctan, arctg, atan |
| arccotangent | (none yet) | arcctg | `\operatorname{arcctg}` | arcctg, arccot (only if the function is added) |
| inverse sinh | arsinh, `\operatorname{arsinh}` | arsh | `\operatorname{arsh}` | arsinh, arcsinh, asinh, arsh |
| inverse cosh | arcosh | arch | `\operatorname{arch}` | arcosh, arccosh, acosh, arch |
| inverse tanh | artanh | arth | `\operatorname{arth}` | artanh, arctanh, atanh, arth |
| inverse coth | arcoth (homotopy captions) | arcth | `\operatorname{arcth}` | arcoth, arcth |
| exponential | exp, e^z | exp, e^z | unchanged | unchanged |
| logarithm, principal or named branch | log, `\log` | ln | `\ln` | log, ln, Log, Ln |
| logarithm, multivalued (All sheets) | log | Ln | `\operatorname{Ln}` | |
| real and imaginary part | Re, Im | Re, Im | `\operatorname{Re}`, `\operatorname{Im}` | unchanged |
| argument, principal | arg | arg | `\arg` | arg, Arg |
| argument, multivalued | | Arg | `\operatorname{Arg}` | |
| decimal logarithm | | lg | `\lg` | not added now (see 2.4) |

Sources: tg, ctg, sh, ch, th, cth, arctg, arcctg are the notation of all the Russian books listed (Шабат, ЛШ, СТ, Привалов, ВЛА) and of Russian school mathematics. Inverse hyperbolic: the names «ареасинус», «ареакосинус», «ареатангенс» are those of БС. Lower-case arsh, arch, arth, arcth mark single-valued branches; capitalized Arsh, Arch, Arth, Arcth mark the multivalued functions, following the Russian TFKP convention that multivalued functions are capitalized (Ln, Arg, Arcsin, Arctg: СТ, ВЛА). The app's inverses are principal branches, so the lower-case forms are right.

### 2.2 Re, Im, arg, Ln: the decisions

- **Re z, Im z**: upright, as in Шабат, ЛШ, СТ. LaTeX `\operatorname{Re}`, never `\Re` (that gives Fraktur ℜ, foreign to Russian books).
- **arg z**: one value, the principal one, `−π < arg z ≤ π`. This is what the app computes and what ВЛА and most current courses use. Some books take `0 ≤ arg z < 2π`; so where the interval matters (the guide, captions about the cut), state it.
- **Arg z**: the multivalued argument, `Arg z = arg z + 2πk`. Shown only where the app means all values. The parser keeps reading typed `Arg` as the principal value: a formula field cannot hold a set of values.
- **ln z**: the principal logarithm, `ln z = ln |z| + i arg z`. For another branch (moved cut or sheet k ≠ 0) the formula still reads `ln z`, and the card and the caption name the branch in words: «ветвь с разрезом по лучу arg z = 90°, лист 1». This mirrors the English, which writes `\log z` plus a branch note.
- **Ln z**: the multivalued logarithm, `Ln z = ln |z| + i Arg z`. Used in "All sheets" captions: «Im Ln z поднимается по геликоиду вокруг 0». The English writes `log` there too (tour.js 176), so a blanket `\log` → `\ln` is wrong for these strings: the tables write `Ln` themselves (chrome.landscape_with_all_sheets, tour.landscape_all_sheets_draws), and new multivalued uses must be marked in the source (review i18n-8).
- **log**: only with a base (`log₂ |F|` stays). The English `log |F|` (natural) becomes `ln |F|`.
- **Powers**: «главное значение степени» for z^α; the formula is unchanged.
- **Unchanged**: i, e (italic), ℂ, `\bar z`, `\overline{z}`, d/dz, F′, Res, ∮, ∞, °.

### 2.3 Numbers in formulas and text

- Decimal comma: `0,5`, `1,2 + 0,3i`. LaTeX `0{,}5` (works with no package; with `icomma` it is also fine).
- When decimals stand in a list, separate by «;»: «при t = 0; 0,5; 1», «нули в точках 0,5; −1,2». In LaTeX: `$t=0$; $0{,}5$; $1$`.
- Intervals: `(0; 1]` only when an endpoint has a decimal comma; otherwise `(0, 1]` as in Russian books. I18N.texInterval(a, b) and I18N.texSep(values) apply this where the numbers are formatted; templates take a %{sep} slot. So one caption can hold `[-1, 1]` and `[0{,}5;\,1]` without mixing styles inside a pair (example: math.grid_math_min_math, one separator slot per bracket pair).
- Two numbers in one readout are separated by «; »: «(0,5; 0,3)», never «(0,5, 0,3)».
- The comma is a number format, not a text substitution. It is written where a number is formatted for a caption or a readout. Never in TeX dimensions, the snippet body or the preamble: `\ifdim\linewidth<469.75pt` stays as it is (review i18n-7).
- Input fields keep the point: the comma separates list items in coefficient and zero lists. Error text tells the user: «Дробную часть отделяйте точкой: 0.5». Today the parser answers `z^0,5` with «Здесь не ожидалось «,»» (review i18n-14), so this hint must be added when a comma stands between two digits.
- The parser should accept `{,}` between digits as a decimal point, so LaTeX copied from the Russian interface pastes back.
- "Copy value" from a readout copies the machine form (point), so it can be pasted into a field.
- Minus is U+2212 «−» in text, never a hyphen.

### 2.4 Parser additions and the conflict check

To add, in both languages: plain `tg ctg cosec sh ch th cth arctg arcctg arsh arch arth arcth Ln`; LaTeX `\tg \ctg \cosec \sh \ch \th \cth \arctg \arcctg \arsh \arch \arth \arcth \Ln`.

Checked against `parse.js` (longest-prefix match over the names, then single letters z w x y r i e):
- None of the new names starts with a variable letter (z w x y r i e) or with a letter that is currently valid on its own (t, c, s, a, L are not variables). So no input that parses today changes meaning.
- `th` vs `theta`: the list is matched longest first, so `theta` still wins. `th` cannot be followed by `eta` in a valid input today.
- `cosec` vs `cos`: longest first, `cosec` wins. `cosec` is invalid today, so nothing changes.
- `arctg`, `arcctg`, `arcth` vs `arctan`, `arccos`, `arctanh`: they differ by the fifth letter at the latest; no prefix relation.
- `arsh` vs `arsinh`, `arth` vs `artanh`, `arch` vs `arccos`: no prefix relation.
- `sh`, `ch`, `tg`, `ctg`, `cth`: not a prefix of any existing name, and no existing name is a prefix of them.
- LaTeX: `\th`, `\sh`, `\ch`, `\tg` are unknown commands today, so nothing changes. `\chi` is read as the whole word and is not affected.
- `lg`: Russian readers take it as log₁₀. Do not map it to ln. Add it only together with a true log₁₀.
- The "Try \sin or \sinh" suggestion list should include the new names, and a Russian message: «Неизвестная команда \tgh. Возможно, \tg или \th.»
- Parser gaps found in review i18n-8 (probed): `Ln z` and `lg z` fail with «Неизвестный символ», and `arcctg` is accepted in no form (there is no acot). Messages until they are added, Russian interface only:
  - `lg`: «lg — десятичный логарифм; здесь его нет. Натуральный логарифм: ln z.»
  - `arcctg`, `arccot`: «Функции arcctg здесь нет.» (no formula hint: arcctg z = arctg(1/z) depends on the branch convention).
  - `Ln`: accept it as the principal branch, as `Log` is accepted, and say so in the guide.

### 2.5 LaTeX: why `\operatorname`

- babel-russian defines `\tg \ctg \sh \ch \th \cth \arctg \arcctg \cosec` when babel loads `russian` (as the main or a secondary language), and then in every language of the document. Without babel-russian they are undefined. Re-tested 2026-10-22: `[russian,english]` (English main) prints `$\tg x$` in English text; `[english]` alone stops with «Undefined control sequence». A snippet pasted into an English article without babel-russian would fail. DESIGN.md 5 says the same.
- babel-russian 1.3m (installed here) defines `\th` in math as **arctg** when amsmath is not loaded (`russianb.ldf`, the `\math@th` line). Tested: `$\th z$` prints «arctg z».
- It defines no `\arsh`, `\arch`, `\arth`, `\arcth`.
- `\operatorname{tg}` and the rest work with amsmath alone, in any language setup, and give operator spacing like `\sin`. Tested with pdflatex (T2A, babel russian) and xelatex (fontspec, STIX Two Text).
- The export already uses `\operatorname{Re}`, so amsmath is already assumed.

---

## 3. UI style

### 3.1 Commands and labels
- Commands: perfective infinitive, as in Russian macOS: «Сохранить», «Скопировать», «Удалить», «Добавить», «Очистить», «Закрыть», «Отменить», «Повторить», «Экспортировать…».
- Buttons that open a menu, panel or dialog: a noun. «Экспорт», «Вид», «Ещё», «Справка», «Звук».
- Toggles and modes: a noun. «Деформация», «Пути», «Привязка», «Звук».
- Sentence case always. Only the first word and proper names are capitalized: «Вся цепочка», «Функция Жуковского».
- Labels stay short. If Russian runs much longer than English, shorten the Russian; do not shrink the font.
- Ellipsis «…» (one character) when a command opens a dialog: «Другой цвет…», «Рисунок для статьи…».
- No period at the end of a label or a fragment tooltip. Full sentences end with a period, as in English.
- Shortcut in a tooltip: two spaces, then the key, exactly as in English: «Отменить  ⌘Z», «Деформация  M».

### 3.2 Addressing the user
- «вы», lower case. Capital «Вы» belongs to personal letters, not to an interface.
- Hints and tour: imperative plural. «Перетащите», «Нажмите», «Наведите указатель», «Выберите».
- No «мы», no «давайте», no exclamation marks, no jokes.
- Descriptions in the present tense: «X показывает ваши фигуры», «Полоса переходит в единичный круг».
- Tour titles: a noun phrase or «X — исходная плоскость» (the dash replaces the English colon in definitions).

### 3.3 Messages
- Errors: impersonal and calm. «Не удалось сохранить рисунок.» «Не удалось загрузить библиотеку PDF.»
- Say what to do next when there is something to do: «Попробуйте SVG.»
- Toasts: short past participle. «Фигура удалена.» «Цепочка очищена.» «Скопировано.»
- Name the thing, not the pronoun: write «LaTeX-код скопирован», not «LaTeX скопирован(а)». The gender of a product name is never guessed. Use «LaTeX-код» for every copy of LaTeX.
- With F alone as a subject, add the noun: «отображение F конформно», «функция F голоморфна». Never a bare «F конформна».
- Templates must not glue sentence pieces (English captions are built from fragments). Each Russian sentence is one template, with the case forms supplied: «образ круга», «образы кругов», «при отображении F».

### 3.4 Plurals
- Russian has three forms. Use `Intl.PluralRules('ru')` (one, few, many), never `n === 1`.
- Forms to keep in the string table: нуль/нуля/нулей; полюс/полюса/полюсов; прообраз/прообраза/прообразов; корень/корня/корней; лист/листа/листов; шаг/шага/шагов; точка/точки/точек; фигура/фигуры/фигур; вершина/вершины/вершин; оборот/оборота/оборотов; клетка/клетки/клеток.
- The form depends on the governing word: «не менее 21 прообраза», «не менее 5 прообразов». Give each message its own forms.

### 3.5 Punctuation
- Quotes: «ёлочки»; inside them „лапки“. A button name in prose goes in «»: Нажмите «Добавить». Prefer rephrasing to quotes inside quotes.
- Em dash «—»: a no-break space before, a normal space after. «X — исходная плоскость». In LaTeX: `~--- `.
- En dash «–» for ranges with no spaces: «8–9 пт», «шаги 1–3».
- Colon: lower case after it, as in English.
- Comma before «что», «чтобы», «который», «если», «когда» as the rules require. Check every template.

### 3.6 No-break spaces (U+00A0; `~` in LaTeX)
- Between a number and its unit: «8,9 см», «300 dpi», «70 %».
- Before an em dash.
- After one-letter words in the guide, tour and captions: «в», «к», «с», «и», «а», «о», «у».
- «Рис. 1», «Задача 3», «шаг 2».
- Between a short word and a following short formula when a break would leave the formula alone: «в точке~$z_0$».
- These rules hold for captions the app sets itself (on screen and in exported figures), not only in LaTeX. The tables already carry U+00A0; the caption layout must not break there (review i18n-11).

### 3.7 ё
- Always written: ещё, всё, её, чёрный, тёмная, жёлтый, перемещён, удалён, учёт.
- Reason: «все»/«всё» and «удален»/«удалён» are real ambiguities in an interface. The font has ё.
- A build lint greps the Russian table for common words written with «е» where «ё» belongs.

### 3.8 Numbers and units
- Decimal comma (2.3). Thousands: thin no-break space U+202F, rarely needed.
- Percent: «70 %» with a no-break space (the sound panel already does this).
- Degrees: «15°», no space.
- Units: мм, см, пт, дюйм, dpi, Гц, кГц, мс, с, мин. No period after them.
- Figure sizes: centimetres, one decimal: «8,9 × 6,6 см» instead of «3,50 × 2,60 in». Paper presets keep their own unit: «Поля 1 дюйм · Letter».
- Multiplication in sizes: «×» with spaces. Multiplicity marker: «×2» stays.
- Times: «2 мин», «1,5 мин», «30 с».

### 3.9 Keys and gestures
- Key names as printed on the key: Shift, Ctrl, Alt, Esc, Enter, Tab, Delete, Backspace; ⌘ ⇧ ⌥ on Mac exactly as the English interface shows them.
- Space: «Пробел».
- Combinations in prose: «Shift + щелчок», «⌘ + K». Keycap chips stay as in English, and so do tooltip suffixes: «Звук (Shift+M)», like «Отменить  ⌘Z».
- Letter shortcuts show the Latin letter (Z, M, P). Every Russian keyboard prints it, and the shortcuts must bind the physical key (`e.code`). The guide says once: «Сочетания клавиш работают и в русской раскладке».
- Implementer notes: `[` and `]` are Х and Ъ in the Russian layout, so they need `BracketLeft`/`BracketRight`. `?` is Shift+7 in the Russian layout; accept `e.key === '?'` or `Shift` + `Slash`. Undo needs `KeyZ`. The same holds for the export and sound keys (review i18n-6): ⌘E, ⇧M, and the sound keys Z, O, D, L (on ЙЦУКЕН they type я, щ, в, д).
- Gestures: «щёлкните» (mouse on a point of a plane), «нажмите» (buttons and keys), «щелчок правой кнопкой», «долгое нажатие», «двумя пальцами», «средняя кнопка мыши», «перетащите», «перетаскивание с нажатым Пробелом», «наведите указатель», «прокрутка — масштаб». Never «кликните», «щипок», «зажать».

### 3.10 Abbreviations to avoid
- In the UI and the tour: «т. е.», «т. к.», «и т. д.», «и т. п.», «напр.», «стр.», «кол-во», «ф-ция». Write in full: «то есть», «так как», «например».
- Allowed: units (3.8), «Рис.» before a number in captions (babel uses it too), «Res», standard function names.
- No «макс.», «мин.» as words: «Максимум».

### 3.11 Brand and product names
- «Complex Map Workbench» stays in Latin and is not declined: «в Complex Map Workbench».
- Overleaf, LaTeX, Beamer, REVTeX, IEEE, PDF, SVG, PNG, WebGL2 stay in Latin.
- Language names are endonyms in both interfaces: «English», «Русский».

### 3.12 Typography
- Archivo (UI) and B612 Mono have no Cyrillic on Google Fonts; STIX Two Text has it. Checked through the Google Fonts CSS API.
- Today Cyrillic would fall back to Helvetica Neue or Arial, with different metrics from Archivo.
- Recommendation: in Russian, set `--f-ui` to one Cyrillic family for the whole interface, so a line never mixes two typefaces. Roboto Flex (Cyrillic subset, width axis like Archivo's semi-condensed use) is the first choice; Golos Text is the second. English keeps Archivo, so its golden images do not change. The prototype still falls back per character (Archivo Latin and digits, Roboto Flex Cyrillic in one label: «Формула 1», «LaTeX-код»); review i18n-13 confirms this is not good enough.
- Canvas text (the legend, plot labels) is never reached by pseudo-localization. Measure the Russian: in the legend (136 px canvas, 11px UI font) a label drawn at x = 30 has about 106 px. «видимая часть слева» (109 px) was cut, so the label is «образ левого вида» (97 px).
- Mono readouts: digits stay in B612 Mono; Cyrillic in mono contexts falls back to the system monospace. Keep Cyrillic out of mono fields.
- Formulas inside Russian text: math letters in STIX Two italic, Cyrillic words upright. Function names upright (2.1).
- Russian text runs about 15–25 % longer. Check the top bar, the segmented controls and the chips at 360 px.

---

## 4. Twenty example strings

| # | English (from the app) | Russian | Rule shown |
|---|---|---|---|
| 1 | Undo  ⌘Z | Отменить  ⌘Z | infinitive; shortcut kept |
| 2 | Show guarantees  ] | Показать гарантии  ] | infinitive |
| 3 | Shape deleted. | Фигура удалена. | short participle toast |
| 4 | No shapes yet. Draw one in the *z*-plane. | Фигур пока нет. Нарисуйте фигуру в плоскости *z*. | «плоскость z»; noun instead of pronoun |
| 5 | Drawing is off in the deformation: press M to turn it off. | Во время деформации рисовать нельзя: нажмите M, чтобы выключить её. | Latin key letter |
| 6 | Expected a number like 1+2i or e^{i\pi/4} | Нужно число, например 1+2i или e^{i\pi/4} | input keeps the point |
| 7 | The radius must be 0 (unbounded) or more | Радиус должен быть не меньше 0 (0 — без ограничения) | dash in a definition |
| 8 | Branch of the logarithm with a movable cut | Ветвь логарифма с подвижным разрезом | ветвь, разрез |
| 9 | Principal branch; cuts on the imaginary axis beyond ±i | Главная ветвь; разрезы по лучам мнимой оси от ±i до ∞ | exact wording |
| 10 | Circles to circles; ad − bc ≠ 0 | Окружности переходят в окружности; ad − bc ≠ 0 | «переходят в» |
| 11 | Exponential takes some values more than once, so it has no single inverse. | Экспонента принимает некоторые значения более одного раза, поэтому однозначной обратной функции нет. | no gendered pronoun |
| 12 | The counts differ: F has a branch cut or an essential singularity inside the curve, where the argument principle does not apply. | Числа не совпадают: внутри кривой у F есть разрез или существенно особая точка, и принцип аргумента неприменим. | terms 1.4 |
| 13 | Lit: guaranteed by the chain. Unlit: not implied by the steps (it may still hold). | Горит — гарантировано цепочкой. Не горит — из шагов не следует (но может выполняться). | dash with no-break space |
| 14 | Preimages of compact sets in ℂ are compact in D, so \|F(z)\| → ∞ as z → ∂D or z → ∞. | Прообразы компактов в ℂ компактны в D, поэтому \|F(z)\| → ∞ при z → ∂D или z → ∞. | «компакт» |
| 15 | Single column: 3.50 × 2.60 in, text 8–9 pt, plots at 600 dpi. | Одна колонка: 8,9 × 6,6 см, текст 8–9 пт, графика 600 dpi. | units, decimal comma |
| 16 | LaTeX figure copied. Export without the caption in the image to avoid printing it twice. | LaTeX-код рисунка скопирован. Чтобы подпись не напечаталась дважды, экспортируйте рисунок без подписи на изображении. | no guessed gender for LaTeX |
| 17 | The deformation $H_t$ from the identity ($t=0$) to $F$ ($t=1$), at $t = 0, 0.5, 1$. | Деформация~$H_t$ от тождественного отображения ($t=0$) до~$F$ ($t=1$) при $t=0$; $0{,}5$; $1$. | decimal comma, «;» in lists, `~` |
| 18 | Phase portrait of $F$: the color shows $\arg F$ (key at right); the lines are level curves of $\lvert F\rvert$ and of $\arg F$. | Фазовый портрет функции~$F$: цвет показывает $\arg F$ (шкала справа); проведены линии уровня $\lvert F\rvert$ и $\arg F$. | «шкала», «линии уровня» |
| 19 | Y shows the image under $F(z)=(e^z-1)/(e^z+1)$: the strip becomes the unit disc. $F$ is conformal there: grid lines still cross at right angles, and tiny squares map to near-squares. | Y показывает образ при отображении $F(z)=(e^z-1)/(e^z+1)$: полоса переходит в единичный круг. Здесь отображение $F$ конформно: линии сетки по-прежнему пересекаются под прямым углом, а малые квадраты переходят почти в квадраты. | tour voice, «при отображении», noun with F |
| 20 | Sound stays off until you turn it on here or with Shift M. Then quiet cues confirm what you do, a closed loop plays its winding number, and an optional tone plays arg F as pitch. | Звук выключен, пока вы его не включите — здесь или клавишами Shift M. Тогда тихие сигналы подтверждают ваши действия, у замкнутой петли звучит её число оборотов, а тон по желанию передаёт arg F высотой звука. | «вы», ё, «число оборотов» |


---

## 5. Open points

- **Phase view name**: «Фаза» chosen. Alternative «Аргумент». Ask a Russian teacher if in doubt; it is one string.
- **Chips**: Cyrillic letters А Ц Р М ДЛ С И chosen. Alternative: keep A E R P M Pr I (Latin codes with Russian tooltips).
- **Tour name**: «обучение» (v16.5, UX93; «обзор» until v16.4). Alternative «экскурсия».
- **Decimal comma in readouts**: chosen on, not yet confirmed by the user. Review i18n-14: readouts show «0,5» while the parser rejects «0,5», so users may type what they see. Either keep the point on screen and use the comma only in captions and LaTeX (turn `decimalComma` off for readouts), or keep the comma and add the parser hint of 2.3. To decide with the user.
- **Figure units**: centimetres chosen for Russian. Presets for US journals keep inches.
- **UI font**: needs a decision and a check at 360 px (3.12).
- **Not covered here**: debug and status strings that never reach the user (for example "cost guard", "shape record").
