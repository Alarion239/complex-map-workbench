# Round 2: the LaTeX side of the prototype. Writes what the new "For Overleaf" button copies (snippets.txt), the label
# overlay (cayley-overlay.tex), and three demo documents that include the prototype figures at natural size:
#   paper-demo.tex     REVTeX two-column (Article: [tbp] floats, figure* for full width)
#   homework-demo.tex  Overleaf's default article at 11 pt (Homework: non-floating [H], shrink-only width guard)
#   newtx-demo.tex     a Times (newtx) document: outline labels next to the overlay set by the document (M2)
# Run: python3 make_tex.py && latexmk -pdf paper-demo.tex homework-demo.tex newtx-demo.tex
import json, pathlib
HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / 'out'
cap = json.loads((OUT / 'captions.json').read_text())

# ---- the overlay: the art PDF (no text) with every label set by the document itself (B8) ----
lab = json.loads((OUT / 'cayley-labels.json').read_text())
W, H = lab['W'], lab['H']
ANCH = {('start', 'base'): 'base west', ('middle', 'base'): 'base', ('end', 'base'): 'base east',
        ('start', 'mid'): 'west', ('middle', 'mid'): 'center', ('end', 'mid'): 'east',
        ('start', 'top'): 'north west', ('middle', 'top'): 'north', ('end', 'top'): 'north east',
        ('start', 'bottom'): 'south west', ('middle', 'bottom'): 'south', ('end', 'bottom'): 'south east'}
SIZE = {8: r'\footnotesize', 9: r'\small', 10: r'\small', 10.95: r'\normalsize'}
lines = [
    '% cayley: labels typeset by your document, over cayley-art.pdf. Made for \\columnwidth = 246pt.',
    '% Needs \\usepackage{tikz,graphicx,amsmath,contour}. If the art lives in a folder, \\def\\cmwdir{figs/} first.',
    '\\providecommand\\cmwdir{}',
    '\\begin{tikzpicture}[x=1bp,y=1bp,inner sep=0pt,outer sep=0pt]',
    f'  \\useasboundingbox (0,0) rectangle ({W:.2f},{H:.2f});',
    '  \\node[anchor=south west] at (0,0) {\\includegraphics{\\cmwdir cayley-art.pdf}};',
]
for l in lab['labels']:
    t = l['tex']
    if not t: continue
    body = t[len('\\text{'):-1] if t.startswith('\\text{') else f'${t}$'
    if l.get('halo'): body = f'\\contour{{white}}{{{body}}}'
    lines.append(f'  \\node[anchor={ANCH[(l["ax"], l["ay"])]},font={SIZE.get(round(l["pt"], 2), chr(92) + "small")}] at ({l["x"]:.2f},{H - l["y"]:.2f}) {{{body}}};')
lines += ['\\end{tikzpicture}', '']
(HERE / 'cayley-overlay.tex').write_text('\n'.join(lines))

# ---- the snippets: name from the scene (B10), natural size, a width guard, caption in \caption ----
def article(name, caption, width_pt, star=False, layout='\\columnwidth'):
    env = 'figure*' if star else 'figure'
    return '\n'.join([
        f'% {name}.pdf is made for {layout} = {width_pt}pt; include it unscaled so its labels match your text.',
        f'% If your {layout} is narrower, use [width={layout}] (the labels will shrink). Preamble: \\usepackage{{graphicx,amsmath,amssymb}}',
        f'\\begin{{{env}}}[tbp]',
        '  \\centering',
        f'  \\includegraphics{{{name}}}',
        f'  \\caption{{{caption}}}',
        f'  \\label{{fig:{name}}}',
        f'\\end{{{env}}}', ''])
def homework(name, caption, width_pt):
    # A4 / P0-3: [H] keeps the figure right after the solution; P0-4: shrink-only, never enlarged
    return '\n'.join([
        f'% {name}.pdf is made for \\linewidth = {width_pt}pt (article, 11pt, default margins); natural size wherever it fits.',
        '% Preamble: \\usepackage{graphicx,amsmath,amssymb,float}',
        '\\begin{figure}[H]',
        '  \\centering',
        f'  \\includegraphics[width=\\ifdim\\linewidth<{width_pt}pt \\linewidth\\else {width_pt}pt\\fi]{{{name}}}',
        f'  \\caption{{{caption}}}',
        f'  \\label{{fig:{name}}}',
        '\\end{figure}', ''])
snips = {
    'cayley': article('cayley', cap['cayley'], 246),
    'bw': article('cayley-bw', cap['cayley'], 246),
    'wide': article('cayley-wide', cap['wide'], 510, star=True, layout='\\textwidth'),
    'film': article('cayley-deformation', cap['film'], 510, star=True, layout='\\textwidth'),
    'phase': article('phase', cap['phase'], 246),
    'phasebw': article('phase-bw', cap['phaseBW'], 246),
    'hw': homework('cayley-hw', cap['homework'], 360),
}
(HERE / 'snippets.txt').write_text('\n'.join(snips.values()))

para = ('Every figure here is placed at its natural size: tick labels are \\verb|\\footnotesize| and panel labels \\verb|\\small| '
        'of this 10\\,pt text, set in the same Latin Modern as this paragraph. Lines are vector strokes of at least 0.5\\,pt; only '
        'the shading is an image (flat tones at 600\\,dpi in indexed color, continuous tone at 300\\,dpi), and no file declares a font '
        'or uses transparency.')
paper = r'''% Demo: the round-2 figures in a REVTeX two-column paper (10 pt, \columnwidth = 246pt, \textwidth = 510pt)
\documentclass[aps,prl,twocolumn,10pt,nofootinbib]{revtex4-2}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{graphicx,amsmath,amssymb,tikz,contour}
\graphicspath{{../out/}}
\def\cmwdir{../out/}
\begin{document}
\title{Prototype figures from the new export (round 2)}
\author{Complex Map Workbench}
\maketitle
The Cayley transform $F(z)=(z-i)/(z+i)$ takes the upper half-plane $\mathbb{H}$ onto the unit disk $\mathbb{D}$; it sends $i$ to the center and the point at infinity to $1$. ''' + para + r'''

''' + snips['cayley'] + r'''
Figure~\ref{fig:cayley} is the column preset. ''' + para + r'''

''' + snips['wide'] + snips['film'] + r'''
Figure~\ref{fig:cayley-wide} is the full-width preset with a detail panel, and Fig.~\ref{fig:cayley-deformation} prints the deformation as a filmstrip whose panels can be cited, e.g.\ Fig.~\ref{fig:cayley-deformation}(b). ''' + para + r'''

''' + snips['bw'] + r'''
Figure~\ref{fig:cayley-bw} is the black-and-white version: 8-bit gray images, 45\,\% and 14\,\% gray. ''' + para + r'''

''' + snips['phase'] + snips['phasebw'] + r'''
Figures~\ref{fig:phase} and~\ref{fig:phase-bw} are the Phase view in color and in black and white. ''' + para + r'''

\begin{figure}[tbp]
  \centering
  \input{cayley-overlay.tex}
  \caption{The overlay format: the art of Fig.~\ref{fig:cayley} with every label typeset by this document. ''' + cap['cayley'] + r'''}
  \label{fig:overlay}
\end{figure}
Figure~\ref{fig:overlay} uses the overlay. ''' + para + r'''

\end{document}
'''
(HERE / 'paper-demo.tex').write_text(paper)

hw = r'''% Demo: the Homework preset in Overleaf's default article at 11 pt (no geometry: \linewidth = 360pt)
\documentclass[11pt]{article}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{graphicx,amsmath,amssymb,float}
\graphicspath{{../out/}}
\begin{document}
\noindent\textbf{Problem 2.} Find a M\"obius map that sends $0,1,\infty$ to $1,i,-1$.

\medskip\noindent\textit{Solution.} \dots\ so $T(z)=(z+i)/(iz+1)$ hmm, a short solution paragraph stands here; the figure of the next problem must not float above this one.

\bigskip\noindent\textbf{Problem 3.} Show that $F(z)=\dfrac{z-i}{z+i}$ maps the upper half-plane $\mathbb{H}$ conformally onto the unit disk $\mathbb{D}$.

\medskip\noindent\textit{Solution.} For real $x$ we have $|x-i|=|x+i|$, so $F$ maps $\mathbb{R}$ into the unit circle; since $F(i)=0\in\mathbb{D}$ and $\mathbb{H}$ is connected, $F(\mathbb{H})=\mathbb{D}$. In Figure~\ref{fig:cayley-hw}, walking along $\mathbb{R}$ from $A$ to $C$ keeps $\mathbb{H}$ on the left, and its image keeps $\mathbb{D}$ on the left.

''' + snips['hw'] + r'''
The figure stays here, right after the solution that cites it.
\end{document}
'''
(HERE / 'homework-demo.tex').write_text(hw.replace(r'\dots\ so $T(z)=(z+i)/(iz+1)$ hmm, a short solution paragraph stands here; the figure of the next problem must not float above this one.', r'A short solution stands here. The figure of the next problem must not float above it.'))

newtx = r'''% Demo (M2): a Times document (newtx). Left: the figure with Computer Modern outline labels (the default).
% Right: the overlay, whose labels are set by this document in Times.
\documentclass[10pt,twocolumn]{article}
\usepackage[T1]{fontenc}
\usepackage{newtxtext,newtxmath}
\usepackage[textwidth=510pt,columnsep=18pt]{geometry}
\usepackage{graphicx,tikz,contour}
\graphicspath{{../out/}}
\def\cmwdir{../out/}
\begin{document}
\noindent In a Times document the default outline labels are Computer Modern (Fig.~\ref{fig:a}), which a careful reader notices next to Times text: compare the digits $0,1,2$ here. The overlay (Fig.~\ref{fig:b}) sets every label in the document's own font and size, at the cost of one \verb|\input| and the \verb|tikz| and \verb|contour| packages.
\begin{figure}[h]\centering\includegraphics{cayley}\caption{Outline labels (Computer Modern), at natural size in this 246\,pt column.}\label{fig:a}\end{figure}
\begin{figure}[h]\centering\input{cayley-overlay.tex}\caption{The overlay: labels in newtx Times.}\label{fig:b}\end{figure}
\end{document}
'''
(HERE / 'newtx-demo.tex').write_text(newtx)
print('wrote', sorted(p.name for p in HERE.glob('*.tex')), 'labels', len(lab['labels']))
