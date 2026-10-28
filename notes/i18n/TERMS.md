# One name for each thing (issue #35, UX28)

One thing had many names, so the help, the tour and the tooltips did not match what is on screen
(plan/ux-audit/REPORT.md, UX28). This is the list of names: each thing has one term, and a short form where a
tile or a narrow button has no room for it. Labels, tooltips, the guide, the tour and the phone's sheets use these.
`test/t_terms.js` keeps the retired names from coming back: their counts in the sources may only go down.

Russian follows notes/i18n/GLOSSARY.md, Italian the terms already in tools/it_table.json (Pietro's). A term whose
Russian or Italian changes here is marked *(new)* and goes through tools/ru_extra.json / tools/it_table.json.

| Thing | Term | Short form | Russian | Italian | Retired names |
|---|---|---|---|---|---|
| The left panel (drawing tools, the formula, the shapes) | Draw | | Рисование | Disegna | Region tools, region tools panel |
| A region the user draws | Shape | | Фигура | Figura | region (in UI text), figure (for a shape) |
| Clearing the shapes | Clear shapes | Clear (in the Shapes head) | Очистить фигуры | Cancella figure | Empty canvas |
| Clearing the chain | Clear chain | Clear (in the chain head) | Очистить цепочку | Svuota catena | Clear the chain |
| The header's function field and the palette's add mode | Add function | | Добавить функцию | Aggiungi funzione | Add function or command |
| The palette's insert position at the end of the chain | Insert at the end | | Вставить в конец | Inserisci alla fine | Append to the chain |
| The phone's search row | Search | | Поиск | Cerca | Search functions and commands |
| The ? menu | Help | | Справка | Aiuto | |
| The reference document | Guide | | Руководство | Guida | Reference guide, Using the Workbench |
| The tour | Guided tour | Tour | Обучение | Tour guidato | |
| The Construct tool through three points | Circle through 3 points | 3-pt circle | Окружность по трём точкам | Circonferenza per 3 punti | 3 points (as the tile's name) |
| The Construct tool for a circle meeting another at right angles | Perpendicular circle | Perpendicular | Ортогональная окружность (the Russian mathematical term stays) | Circonferenza ortogonale | Orthogonal (in English) |
| The view toggle | Deformation | | Деформация | Deformazione | |
| A pane's display options, and Settings' Display | Display | | Оформление *(new for the plain key; «Вид» is the view switch only)* | Aspetto *(new for the plain key, review)* | |
| The header's rarely changed settings | Settings | | Настройки | Impostazioni | |
| The link and the scene files | Share | | Поделиться | Condividi | |
| Figures, LaTeX | Export | | Экспорт | Esporta | |
| The gallery | Examples | | Примеры | Esempi | |

Order of work: 1. this list and `test/t_terms.js`; 2. labels and tooltips (page.html, the app parts, phone.js,
commands.js) with the tables regenerated and the suites that match on these words; 3. the guide and the tour, after
the tour rework (#34), and `test/t_terms.js` then strict (every count 0).

## Italian changes for review (Pietro, #60)

Written by us, not by Pietro; each keeps his existing term where one exists. Please confirm or correct. Confirmed for
v17 (2026-10-28): Display = Aspetto in Italian, and the Russian Perpendicular circle keeps «Ортогональная окружность»,
the mathematical term.

| English | Italian now | Note |
|---|---|---|
| Display (plain key, Settings and the pane's popover) | Aspetto | was Visualizzazione; the button already said Aspetto |
| Draw panel | Pannello Disegna | the palette row, was "Strumenti per le regioni" |
| Show or hide the Draw panel | Mostra o nascondi il pannello Disegna | the [ key's tooltip |
| Insert at the end | Inserisci alla fine | the palette's position, was "Append to the chain" |
| 3-pt circle | Per 3 punti | the Construct tile (his "Per 3 punti" kept) |
| Perpendicular (tile) | Ortogonale / Ortogon. | his "Ortogonale" kept for the tool |
| Add function (the header field) | Aggiungi funzione; short form Cerca | |
| Share; Share: a link to this figure, scene files | Condividi; Condividi: un link a questa figura, file di scena | v17 D5 |
| Sound settings… | Impostazioni del suono… | v17 D5 |
