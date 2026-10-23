# Round 2: writes the four dialog states into mockup-template.html (after <!--SECTIONS-->); build_mockup.py then
# inlines the prototype figures and the typeset captions (cap-*.svg, from caps_cmd.js).
import pathlib, random
P = pathlib.Path(__file__).resolve().parent / 'mockup-template.html'
base = P.read_text().split('<!--SECTIONS-->')[0] + '<!--SECTIONS-->\n'
AC = ' aria-checked="true"'
chev = '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.3"/></svg>'
pen = '<svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 10l1-3 5-5 2 2-5 5z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>'
eye = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>'
loupe = '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 10.5l3.5 3.5" stroke="currentColor" stroke-width="1.5"/></svg>'
art = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="2.5" width="13" height="15" rx="1"/><path d="M6 6h3.5M6 8.5h3.5M6 11h3.5M11 6h3M11 8.5h3M6 14h8"/></svg>'
hw = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 3.5h12v13H4z"/><path d="M6.5 7l1.5 1.5L11 5.5M6.5 12.5h7"/></svg>'
sl = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="4" width="15" height="10" rx="1"/><path d="M10 14v3M7 17h6"/></svg>'
random.seed(7)
def text(lines, width, last=0.6):
    out = []
    for i in range(lines):
        w, ws = 0, []
        lim = width * (last if i == lines - 1 else 1)
        if i == 0: ws.append('<i style="width:14px;background:none"></i>'); w += 17
        while True:
            x = random.choice([10, 14, 18, 22, 26, 30, 34, 42, 48])
            if w + x > lim: break
            ws.append(f'<i style="width:{x}px"></i>'); w += x + 3.2
        out.append('<div class="txt">' + ''.join(ws) + '</div>')
    return ''.join(out)
def forrow(sel):
    b = lambda k, ic, t, s: f'<button{AC if sel == k else ""}>{ic}{t}<small>{s}</small></button>'
    return f'<div class="row"><div class="h">For</div><div class="seg big">{b("a", art, "Article", "journal, arXiv")}{b("h", hw, "Homework", "Overleaf, Docs")}{b("s", sl, "Slides", "Beamer, Keynote")}</div></div>'
def size(label, dim, txt='10 pt'):
    return f'<div class="row wide"><div class="h">Size</div><div class="pair"><div class="select"><span>{label} <span class="dim">· {dim}</span></span>{chev}</div><div class="select"><span>Text {txt}</span>{chev}</div></div></div>'
def ink(bw=False):
    return f'<div class="row"><div class="h">Ink</div><div class="seg"><button{"" if bw else AC}>Colour</button><button{AC if bw else ""}>B/W</button></div></div>'
fine = '<div class="disc"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M3.5 2l3 3-3 3" stroke="currentColor" fill="none" stroke-width="1.4"/></svg>Fine-tune <small>Crop · Axes · Panels · Points · Detail</small></div>'
def head(chip): return f'<div class="dhead"><h2>Export figure</h2><span class="chip">{chip}</span><span class="sp"></span><button class="x" aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5"/></svg></button></div>'
def foot(name, overleaf='For Overleaf', ovcls='primary'):
    return f'<div class="dfoot" style="position:relative"><span class="name">{name}<span class="ext">.pdf</span>{pen}</span><span class="sp"></span><button class="btn quiet">More formats {chev}</button><button class="btn dest">For Docs</button><button class="btn dest {ovcls}">{overleaf}</button></div>'
def bar(hint, grey=False):
    return f'<div class="stage-bar"><span class="hint">{hint}</span><span class="sp"></span><span class="ico{" on" if grey else ""}">{eye}See in grey</span><span class="ico">{loupe}Loupe</span></div>'
chipXY = 'X → Y · <i>F(z)=(z−i)/(z+i)</i>'
S = []
S.append(f'''<section class="state" id="sA"><div class="lbl">A · Article · amsart 360 pt (default) · Fit column · the caption is edited on the paper</div>
<div class="frame"><div class="dlg">{head(chipXY)}<div class="dbody"><div>
<div class="stage">{bar("amsart, 10 pt text · Fit column")}
<div class="paper" style="width:612px; padding:30px 40px 24px; zoom:.95; margin-top:30px">
{text(4, 532)}<div style="height:8px"></div>
<img alt="Article figure" src="{{{{cayley-amsart.svg}}}}" style="width:4.981in; margin:4px auto 0">
<div class="capimg editing" style="width:4.981in; margin:0 auto"><span class="edit">Click to edit · LaTeX source</span><img alt="caption" src="{{{{cap-amsart.svg}}}}" style="width:4.981in"></div>
<div style="height:12px"></div>{text(3, 532)}
</div></div>
<div class="facts"><b>4.98 × 2.34 in</b> · labels match 10 pt text · PDF 70 KB<span class="det">Details</span></div>
</div><div class="ctl">{forrow("a")}{size("amsart", "360 pt")}{ink()}{fine}</div></div>
{foot("cayley-halfplane")}</div></div></section>''')
menuB = '''<div class="menu" style="right:0; top:118px; min-width:280px">
<div class="mh">Overleaf’s default article</div>
<div class="mi"><span>article · 10 pt</span><kbd>345 pt</kbd></div>
<div class="mi hl"><span>✓ article · 11 pt</span><kbd>360 pt</kbd><small>Overleaf’s blank project at 11 pt · remembered</small></div>
<div class="mi"><span>article · 12 pt</span><kbd>390 pt</kbd></div>
<div class="sep"></div>
<div class="mi"><span>1 in margins · Letter</span><kbd>469.75 pt</kbd></div>
<div class="mi"><span>2.5 cm margins · A4</span><kbd>455.24 pt</kbd></div>
<div class="sep"></div>
<div class="mi"><span>Paste <span style="font-family:var(--f-mono)">\\the\\linewidth</span>…</span><kbd>exact</kbd><small>type it once in your document and paste the number it prints</small></div></div>'''
S.append(f'''<section class="state" id="sB"><div class="lbl">B · Homework · Size menu (default-margin widths first) · after For Overleaf: the LaTeX is copied first, then the PDF is saved</div>
<div class="frame"><div class="dlg">{head(chipXY)}<div class="dbody"><div>
<div class="stage">{bar("article, 11 pt · Fit column")}
<div class="paper" style="width:612px; padding:34px 72px 26px; zoom:1.05; margin-top:30px">
<div style="font:700 14px/18px 'Latin Modern Roman','STIX Two Text',serif;margin-bottom:6px;color:#222">Problem 3.</div>{text(3, 468)}<div style="height:6px"></div>
<img alt="Homework figure" src="{{{{cayley-hw.svg}}}}" style="width:4.981in; margin:0 auto">
<div class="capimg" style="width:4.981in; margin:0 auto"><img alt="caption" src="{{{{cap-hw.svg}}}}" style="width:4.981in"></div>
<div style="height:10px"></div>{text(2, 468)}
</div></div>
<div class="facts"><b>4.98 × 1.49 in</b> · labels match 11 pt text · points A–E named · PDF 58 KB<span class="det">Details</span></div>
</div><div class="ctl" style="position:relative">{forrow("h")}{size("article · 11 pt", "360 pt", "11 pt")}{ink()}{fine}{menuB}</div></div>
{foot("cayley-halfplane", overleaf="✓ Saved · LaTeX copied", ovcls="done")}
<div class="hint2" style="padding:0 20px 14px"><span>First time only: <b>drop cayley-halfplane.pdf into Overleaf’s file tree, then paste.</b> The snippet keeps the figure under your solution and shrinks it only if your page is narrower.</span></div>
</div></div></section>''')
menuC = '''<div class="menu" style="right:214px; bottom:56px; min-width:290px">
<div class="mh">This figure</div>
<div class="mi"><span>PDF</span><kbd>vector · 148 KB</kbd></div>
<div class="mi"><span>SVG</span><kbd>vector · 204 KB</kbd></div>
<div class="mi"><span>PNG</span><kbd>300 · 600 dpi</kbd></div>
<div class="mi"><span>Copy LaTeX only</span><kbd>⇧⌘C</kbd></div>
<div class="sep"></div>
<div class="mi"><span>All views (.zip)</span><kbd>PDFs + figures.tex</kbd><small>X → Y, Phase, Landscape and Deformation in this preset</small></div></div>'''
S.append(f'''<section class="state" id="sC"><div class="lbl">C · Deformation · Article full width 510 pt · the print filmstrip · More formats</div>
<div class="frame"><div class="dlg">{head("Deformation · <i>H<sub>t</sub></i>, 0 ≤ <i>t</i> ≤ 1")}<div class="dbody"><div>
<div class="stage">{bar("REVTeX full width (figure*) · Fit")}
<div class="paper" style="width:7.6in; padding:26px 0.27in 22px; zoom:.96; margin-top:30px">
{text(2, 690)}<div style="height:6px"></div>
<img alt="Filmstrip" src="{{{{cayley-deformation.svg}}}}" style="width:7.057in">
<div class="capimg"><img alt="caption" src="{{{{cap-film.svg}}}}" style="width:7.057in"></div>
</div></div>
<div class="facts"><b>7.06 × 2.25 in</b> · 4 frames, 3 tracked points · PDF 148 KB<span class="det">Details</span></div>
</div><div class="ctl">{forrow("a")}<div class="row wide"><div class="h">Deformation</div><div class="seg"><button{AC}>Filmstrip</button><button>Paths</button></div></div>{size("Full width", "510 pt")}{ink()}{fine}</div></div>
{foot("cayley-deformation")}{menuC}</div></div></section>''')
ft = '''<div class="ft">
<div class="fr"><span>Crop</span><div class="seg"><button aria-checked="true">Features</button><button>Screen</button><button>Custom</button></div></div>
<div class="fr"><span>Axes</span><div class="seg"><button aria-checked="true">Box</button><button>Cross</button><button>None</button></div></div>
<div class="fr"><span>Points</span><div class="seg"><button aria-checked="true">Zeros, poles</button><button>Named</button></div></div>
<div class="fr"><span>Labels</span><span class="sw"><span class="t"></span>Set by LaTeX (overlay)</span></div></div>'''
S.append(f'''<section class="state" id="sD"><div class="lbl">D · Phase view · Black &amp; white (contour portrait) · See in grey on · Fine-tune open</div>
<div class="frame"><div class="dlg">{head("Phase · <i>f(z)=(z³−1)/(z²+1)</i>")}<div class="dbody"><div>
<div class="stage">{bar("REVTeX column, 10 pt · Fit", grey=True)}
<div class="paper grey" style="width:5.2in; padding:22px 0.45in 18px; zoom:1.05; margin-top:30px">
<div style="display:grid; grid-template-columns:3.404in 1fr; gap:0.25in">
<div><img alt="Phase B/W" src="{{{{phase-bw.svg}}}}" style="width:3.404in"><div class="capimg"><img alt="caption" src="{{{{cap-phasebw.svg}}}}" style="width:3.404in"></div></div>
<div>{text(17, 60, 0.5)}</div></div>
</div></div>
<div class="facts"><b>3.40 × 3.52 in</b> · gray only · PDF 38 KB<span class="det">Details</span></div>
</div><div class="ctl">{forrow("a")}{size("Column", "246 pt · REVTeX")}{ink(True)}<div class="disc"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.4"/></svg>Fine-tune</div>{ft}</div></div>
{foot("phase-z3")}</div></div></section>''')
P.write_text(base + '\n'.join(S) + '\n</body></html>\n')
print('sections', len(S))
