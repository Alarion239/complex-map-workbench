# Builds notes/ui-redesign-2/phone/mockup.html (DESIGN.md). Not app code.
# Run from this folder: python3 build.py
# Inputs: the app copy's stylesheet (../../app-copy-phone/src/page.html) and the pictures in ../img/<theme>/, captured
# from the running app copy by cap.js (every plane, inset and chip picture is a real render). Pictures are embedded
# once each (JS map), so mockup.html is one self-contained file.
import base64, pathlib, re

here = pathlib.Path(__file__).parent
phone = here.parent
page = (phone.parent / 'app-copy-phone' / 'src' / 'page.html').read_text()
APP_CSS = re.search(r'<style>(.*?)</style>', page, re.S).group(1)
dark_block = re.search(r':root\[data-theme="dark"\] \{(.*?)\n\}', APP_CSS, re.S).group(1)
FONTS = re.search(r'(<link rel="preconnect".*?display=swap">)', page, re.S).group(1)

IMGS = {}
for th in ('light', 'dark'):
    for p in sorted((phone / 'img' / th).glob('*.png')):
        IMGS[f'{th}/{p.stem}'] = 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode()

def img(key, cls='', style=''):
    return f'<img class="{cls}" data-k="{key}" alt="" style="{style}">'

# ---------------- icons (16 px grid, 1.5 stroke, the app's glyph weight) ----------------
def sv(inner, size=18, sw=1.5, fill=False):
    return (f'<svg class="ic" viewBox="0 0 16 16" width="{size}" height="{size}" aria-hidden="true" fill="{"currentColor" if fill else "none"}" '
            f'stroke="{"none" if fill else "currentColor"}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{inner}</svg>')
IC = {
    'undo': sv('<path d="M5.5 3.5l-3 3 3 3M2.5 6.5h7a3.5 3.5 0 0 1 0 7H6"/>'),
    'redo': sv('<path d="M10.5 3.5l3 3-3 3M13.5 6.5h-7a3.5 3.5 0 0 0 0 7H10"/>'),
    'more': sv('<circle cx="3.5" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12.5" cy="8" r="1.2"/>', fill=True),
    'select': sv('<path d="M4 2.5l8 5.2-3.6.9 2 3.9-1.6.8-2-3.9L4 12z"/>'),
    'point': sv('<circle cx="8" cy="8" r="2.2" fill="currentColor"/><path d="M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5" stroke-opacity=".5"/>'),
    'disc': sv('<circle cx="8" cy="8" r="5.5" fill="currentColor" fill-opacity=".18"/>'),
    'circle': sv('<circle cx="8" cy="8" r="5.5"/>'),
    'polygon': sv('<path d="M3 5l5-2.5 5 3-1.5 7H4.5z" fill="currentColor" fill-opacity=".18"/>'),
    'segment': sv('<path d="M3 13L13 3"/><circle cx="3" cy="13" r="1.3" fill="currentColor"/><circle cx="13" cy="3" r="1.3" fill="currentColor"/>'),
    'line': sv('<path d="M1.5 14.5l13-13"/><circle cx="5" cy="11" r="1.2" fill="currentColor"/><circle cx="11" cy="5" r="1.2" fill="currentColor"/>'),
    'ray': sv('<path d="M3 13L14.5 1.5"/><circle cx="3" cy="13" r="1.3" fill="currentColor"/>'),
    'arc': sv('<path d="M2.5 12a6 6 0 0 1 11 0"/>'),
    'freehand': sv('<path d="M2 11c2-5 4 2 6-2s3-5 6-3"/>'),
    'rect': sv('<rect x="2.5" y="4" width="11" height="8" rx=".5" fill="currentColor" fill-opacity=".18"/>'),
    'lasso': sv('<path d="M8 3c3.5 0 6 1.6 6 3.6S11.5 10 8 10 2 8.6 2 6.6 4.5 3 8 3z"/><path d="M5 9.5c-.5 2 .5 3.5 2 4"/>'),
    'half': sv('<path d="M1.5 9.5h13"/><path d="M1.5 9.5h13V14h-13z" fill="currentColor" fill-opacity=".18" stroke="none"/><path d="M8 9.5V5M6.5 6.5L8 5l1.5 1.5"/>'),
    'annulus': sv('<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.8"/>'),
    'sector': sv('<path d="M8 13.5L2.5 5a7 7 0 0 1 11 0z" fill="currentColor" fill-opacity=".18"/>'),
    'formula': '<span class="fx"><i>f</i>=</span>',
    'grid': sv('<rect x="2" y="2" width="12" height="12"/><path d="M6 2v12M10 2v12M2 6h12M2 10h12"/>', sw=1.2),
    'polar': sv('<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><path d="M8 2v12M2 8h12M3.8 3.8l8.4 8.4M12.2 3.8l-8.4 8.4"/>', sw=1),
    'line2': sv('<path d="M1.5 12.5l13-9"/><circle cx="4.5" cy="10.4" r="1.6" fill="var(--surface)"/><circle cx="11.5" cy="5.6" r="1.6" fill="var(--surface)"/>'),
    'circle3': sv('<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="2.5" r="1.5" fill="var(--surface)"/><circle cx="3.2" cy="10.8" r="1.5" fill="var(--surface)"/><circle cx="12.8" cy="10.8" r="1.5" fill="var(--surface)"/>'),
    'mid': sv('<path d="M2 12L14 4"/><circle cx="2.8" cy="11.5" r="1.3" fill="currentColor"/><circle cx="13.2" cy="4.5" r="1.3" fill="currentColor"/><circle cx="8" cy="8" r="1.8" fill="var(--surface)"/>'),
    'glider': sv('<path d="M2 12c3-8 9-8 12 0"/><circle cx="5" cy="6.6" r="1.8" fill="var(--surface)"/>'),
    'sphere': sv('<circle cx="8" cy="8" r="6"/><path d="M2 8a6 2.2 0 0 0 12 0"/><ellipse cx="8" cy="8" rx="2.4" ry="6"/>', sw=1.3),
    'sliders': sv('<path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7"/><circle cx="11" cy="4.5" r="1.5"/><circle cx="5" cy="11.5" r="1.5"/>'),
    'fit': sv('<path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/><circle cx="8" cy="8" r="1.75"/>'),
    'morph': sv('<rect x="1.5" y="6" width="4" height="4"/><path d="M6.5 6.5c2-3 4.5-3 6 0"/><path d="M11.5 4.5l1 2-2.2.3"/><circle cx="12.5" cy="10.5" r="2" fill="currentColor" stroke="none"/>', sw=1.3),
    'play': sv('<path d="M5 3.2v9.6l7.5-4.8z" fill="currentColor"/>'),
    'pause': sv('<path d="M5.5 3.5v9M10.5 3.5v9"/>', sw=2),
    'paths': sv('<path d="M2.5 12.5c2-6 6-8 11-8"/><path d="M11 2.5l2.5 2-2.5 2"/><circle cx="2.5" cy="12.5" r="1.2" fill="currentColor"/>'),
    'x': sv('<path d="M4 4l8 8M12 4l-8 8"/>'),
    'plus': sv('<path d="M8 3v10M3 8h10"/>'),
    'chevR': sv('<path d="M6 3.5L10.5 8 6 12.5"/>', 14),
    'chevD': sv('<path d="M3.5 6l4.5 4.5L12.5 6"/>', 14),
    'copy': sv('<rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>', 16),
    'argand': sv('<path d="M8 1.5v13M1.5 8h13" stroke-opacity=".5"/><circle cx="11" cy="5" r="1.8"/>', 16),
    'lens': sv('<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25l3.25 3.25"/>', 16),
    'sound': sv('<path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5" stroke-opacity=".5"/>'),
    'theme': sv('<circle cx="8" cy="8" r="5.75"/><path d="M8 2.25a5.75 5.75 0 0 1 0 11.5z" fill="currentColor" stroke="none"/>'),
    'globe': sv('<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c-2.2 2-2.2 10 0 12M8 2c2.2 2 2.2 10 0 12"/>', sw=1.3),
    'examples': sv('<rect x="2" y="2" width="5" height="5" rx=".5"/><rect x="9" y="2" width="5" height="5" rx=".5"/><rect x="2" y="9" width="5" height="5" rx=".5"/><rect x="9" y="9" width="5" height="5" rx=".5"/>'),
    'download': sv('<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>'),
    'tex': '<span class="tx">T<sub>E</sub>X</span>',
    'search': sv('<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25l3.25 3.25"/>'),
    'tour': sv('<circle cx="8" cy="8" r="6"/><path d="M6.5 5.5l4 2.5-4 2.5z" fill="currentColor"/>'),
    'book': sv('<path d="M2.5 3.5h4a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 0-1.5-1.5h-4zM13.5 3.5h-4A1.5 1.5 0 0 0 8 5v8.5A1.5 1.5 0 0 1 9.5 12h4z"/>'),
    'snap': sv('<path d="M2 6h12M2 10h12M6 2v12M10 2v12" stroke-opacity=".45"/><circle cx="10" cy="6" r="1.8" fill="currentColor" stroke="none"/>'),
    'swap': sv('<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13"/>', 12),
}
TY = {
    'region': sv('<path d="M2 5.5h12M2 10.5h12"/><path d="M4 5.5v5M8 5.5v5M12 5.5v5" stroke-opacity=".45"/>', 13, 1.3),
    'exp': sv('<path d="M2 13.5c5 0 8-2.5 10.5-11"/><path d="M2 13.5h12" stroke-opacity=".45"/>', 13, 1.3),
    'mobius': sv('<circle cx="8" cy="8" r="5.5"/><path d="M2.6 9.6c3-1.8 7.6-1.8 10.8 0"/><path d="M8 2.5v11" stroke-opacity=".45"/>', 13, 1.3),
    'zp': sv('<circle cx="4.6" cy="8" r="2.2" fill="currentColor" stroke="none"/><path d="M9.6 5.6l4.8 4.8M14.4 5.6l-4.8 4.8"/>', 13, 1.4),
}
fsub = lambda k: f'<i>f</i><sub>{k}</sub>'
wsub = lambda k: f'<i>w</i><sub>{k}</sub>'

# ---------------- strings (English; Russian for the 360 px check, from the i18n table where it has them) ----------------
EN = dict(X='X', Y='Y', phase='Phase', land='Landscape', select='Select', point='Point', disc='Disc', polygon='Polygon', more='More',
          region='Region', exp='Exponential', mobius='Möbius', zp='Zeros and poles', analytic='Analytic', of8='1 of 8')
RU = dict(X='X', Y='Y', phase='Фаза', land='Рельеф', select='Выбор', point='Точка', disc='Круг', polygon='Многоуг.', more='Ещё',
          region='Область', exp='Экспонента', mobius='Дробно-­линейная', zp='Нули и полюсы', analytic='Аналитична', of8='1 из 8')

# ---------------- components ----------------
def status():
    return ('<div class="sb"><span>9:41</span><span class="sb-r"><svg width="17" height="11" viewBox="0 0 17 11"><g fill="currentColor">'
            '<rect x="0" y="7" width="3" height="4" rx=".6"/><rect x="4.5" y="5" width="3" height="6" rx=".6"/><rect x="9" y="2.5" width="3" height="8.5" rx=".6"/>'
            '<rect x="13.5" y="0" width="3" height="11" rx=".6"/></g></svg><svg width="25" height="12" viewBox="0 0 25 12"><rect x=".5" y=".5" width="21" height="11" rx="3" '
            'fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="1.6" fill="currentColor"/><rect x="22.5" y="4" width="1.6" height="4" rx=".8" '
            'fill="currentColor" fill-opacity=".4"/></svg></span></div>')

def header(view='X', deform=False, L=EN, redo=False):
    if deform:
        segs = (f'<button class="on merged" aria-checked="true"><i>X</i><span class="marr">→</span><i>Y</i></button>'
                f'<button>{L["phase"]}</button><button>{L["land"]}</button>')
    else:
        segs = ''.join(f'<button class="{"on" if view == k else ""}{" xy" if k in "XY" else ""}">{"<i>" + L[k] + "</i>" if k in "XY" else L[k]}</button>'
                       for k in ('X', 'Y', 'phase', 'land'))
    return (f'<header class="ph-top"><button class="ph-ib" aria-label="Undo">{IC["undo"]}</button>'
            f'<button class="ph-ib{"" if redo else " off"}" aria-label="Redo">{IC["redo"]}</button>'
            f'<div class="ph-seg" role="radiogroup" aria-label="View">{segs}</div>'
            f'<button class="ph-ib" aria-label="More">{IC["more"]}</button></header>')

def stage(pic, title, scale, sphere=True, inset=None, inset_lbl='Y', extra='', pos=None, legend=False, hint=None, shift=0):
    style = (f'object-position:{pos};' if pos else '') + (f'transform:translateY({shift}px);' if shift else '')
    ins = ''
    if inset:
        ins = (f'<button class="ov-inset" aria-label="Show {inset_lbl}">{img(inset)}<span class="in-lbl"><i>{inset_lbl}</i></span>'
               f'<span class="in-swap">{IC["swap"]}</span></button>')
    rt = (f'<div class="ov-rt">' + (f'<button class="ov-b" aria-label="Sphere" aria-pressed="false">{IC["sphere"]}</button>' if sphere else '')
          + f'<button class="ov-b" aria-label="Display">{IC["sliders"]}</button>'
          + ('<button class="ov-b wheel" aria-label="Colour key"><span class="wh"></span></button>' if legend else '') + '</div>')
    ttl = f'<div class="ov-title">{title}<span class="sc">{scale}</span></div>' if title else ''
    hn = f'<div class="ov-hint">{hint}</div>' if hint else ''
    return (f'<div class="ph-stage">{img(pic, "plimg", style)}{ttl}{hn}{rt}'
            f'<button class="ov-b ov-fit" aria-label="Fit">{IC["fit"]}</button>{ins}{extra}</div>')

def chip(idx, ty, name, pic, sel=False, alone=False, tbar=None, dim=False):
    cls = 'chip2' + (' sel' if sel else '') + (' dim' if dim else '')
    tb = f'<span class="tbar"><b style="width:{tbar * 100:.0f}%"></b></span>' if tbar is not None else ''
    al = f'<span class="lensb" title="Shown alone">{IC["lens"]}</span>' if alone else ''
    return (f'<button class="{cls}"><span class="th">{img(pic)}{tb}</span><span class="tx2"><span class="ix">{idx}<span class="ty">{TY[ty]}</span>{al}</span>'
            f'<span class="nm2">{name}</span></span></button>')

def conn():
    return '<span class="cnx"><svg viewBox="0 0 14 10" width="14" height="10"><path d="M0 5h12M9 2l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'

def chainbar(view='xy', sel=None, alone=0, deform=None, shift=0, L=EN):
    key = {'xy': 't-xy-{k}', 'phase': 't-phase-{k}', 'land': 't-land-{k}', 'def': 't-def-{k}'}[view]
    zpic = 't-xy-z'
    parts = [f'<button class="chip2 nums" aria-label="Numbers">{IC["sliders"]}</button>',
             chip('<i>z</i>', 'region', L['region'], '{T}/' + zpic, sel == 0)]
    names = {1: ('exp', L['exp']), 2: ('mobius', L['mobius']), 3: ('zp', L['zp'])}
    for k in (1, 2, 3):
        ty, nm = names[k]
        tb = deform[k] if deform else None
        parts += [conn(), chip(fsub(k), ty, nm, '{T}/' + key.format(k=k), sel == k, alone == k, tb, dim=bool(deform) and deform[k] == 0)]
    parts += [conn(), '<button class="chip2 add" aria-label="Add a step">' + IC['plus'] + '</button>']
    fpic = '{T}/' + key.format(k='F')
    parts.append(f'<button class="chip2 fchip{" sel" if sel == "F" else ""}"><span class="th">{img(fpic)}</span><span class="tx2"><span class="ix"><i>F</i></span>'
                 f'<span class="nm2"><span class="gd"></span>{L["analytic"]}<br><span class="cnt">{L["of8"]}</span></span></span></button>')
    dbtn = f'<button class="dfm{" on" if deform else ""}" aria-label="Deformation" aria-pressed="{str(bool(deform)).lower()}">{IC["morph"]}</button>'
    return (f'<div class="ph-chain"><div class="sc-wrap"><div class="sc-row" style="transform:translateX(-{shift}px)">{"".join(parts)}</div></div>'
            f'<div class="dfm-wrap">{dbtn}</div></div>')

def tools(active='select', L=EN):
    keys = [('select', L['select']), ('point', L['point']), ('disc', L['disc']), ('polygon', L['polygon']), ('more', L['more'])]
    return '<nav class="ph-tools">' + ''.join(f'<button class="tk{" on" if k == active else ""}">{IC[k]}<span>{lab}</span></button>' for k, lab in keys) + '</nav>'

def transport():
    ticks = ''.join(f'<span class="tk3" style="left:{p}%"><i>f</i><sub>{k}</sub></span>' for k, p in ((1, 16.7), (2, 50), (3, 83.3)))
    seps = ''.join(f'<span class="sep3" style="left:{p}%"></span>' for p in (33.3, 66.7))
    return (f'<nav class="ph-tools trans"><button class="tb" aria-label="Pause">{IC["pause"]}</button>'
            f'<div class="tscr"><span class="rd"><i>t</i> = 1.45 / 3</span><div class="trk">{seps}<b style="width:48.3%"></b><span class="kn" style="left:48.3%"></span></div>{ticks}</div>'
            f'<button class="tb sp">1×</button><button class="tb on" aria-label="Paths" aria-pressed="true">{IC["paths"]}</button>'
            f'<button class="tb" aria-label="Close the deformation">{IC["x"]}</button></nav>')

def home():
    return '<div class="hm"><span></span></div>'

def sheet(top, body, grab=True, cls=''):
    return f'<section class="ph-sheet {cls}" style="top:{top}px">' + ('<div class="grab"><span></span></div>' if grab else '') + body + '</section>'

def frac(a, b):
    return f'<span class="frac"><span>{a}</span><span>{b}</span></span>'

def insp_head(idx, ty, title, alone=None, extra=''):
    lens = (f'<button class="ph-ib sm{" pressed" if alone else ""}" aria-label="Show this step alone" aria-pressed="{str(bool(alone)).lower()}">{IC["lens"]}</button>' if alone is not None else '')
    return (f'<div class="ih"><span class="ix">{idx}</span><span class="ty">{TY[ty] if ty else ""}</span><span class="ttl">{title}</span>{extra}{lens}'
            f'<button class="ph-ib sm" aria-label="More actions">{IC["more"]}</button></div>')

def ed_zp():
    rows = [('a', '', '1', False), ('ζ<sub>1</sub>', 'zero', '0.5', True), ('ζ<sub>2</sub>', 'zero', '−0.5i', True), ('p<sub>1</sub>', 'pole', '−0.8 + 0.75i', True)]
    r = ''
    for lab, cls, val, rm in rows:
        mk = '<span class="mk z"></span>' if cls == 'zero' else '<span class="mk p"></span>' if cls == 'pole' else '<span class="mk"></span>'
        r += (f'<div class="prow">{mk}<label class="plab"><i>{lab}</i></label><input class="pin" value="{val}">'
              f'<button class="ph-ib sm" aria-label="Pick on an Argand diagram">{IC["argand"]}</button>'
              + (f'<button class="ph-ib sm" aria-label="Remove">{IC["x"]}</button>' if rm else '<span class="ph-ib sm hid"></span>') + '</div>')
    return (insp_head(fsub(3), 'zp', 'Zeros and poles', alone=True) +
            f'<div class="fm"><i>w</i><sub>3</sub> = {frac("(<i>w</i><sub>2</sub> − 0.5)(<i>w</i><sub>2</sub> + 0.5<i>i</i>)", "<i>w</i><sub>2</sub> + 0.8 − 0.75<i>i</i>")}</div>'
            f'<div class="zbtn2"><button class="zbtn"><span class="mk z"></span>Add zero</button><button class="zbtn"><span class="mk p"></span>Add pole</button></div>'
            f'<p class="hint">Or long-press the plane. Drag a mark to move it, off the plane to remove it.</p>'
            f'<div class="rows">{r}</div>')

def ed_F():
    nots = ['Entire', 'Rational', 'Polynomial', 'Möbius', 'Proper', 'Homeomorphism onto image', 'Conformal onto image']
    return (insp_head('<i>F</i>', None, 'The whole map', extra=f'<button class="ph-ib sm" aria-label="Copy F as LaTeX">{IC["copy"]}</button>') +
            f'<div class="fm"><i>F</i> = {fsub(3)} ∘ {fsub(2)} ∘ {fsub(1)}</div>'
            f'<div class="gsec"><div class="glbl">Guaranteed</div><div class="gon"><span class="gd"></span>Analytic</div>'
            f'<div class="glbl">Not implied (may still hold)</div><div class="goff">{" · ".join(nots)}</div>'
            f'<div class="glbl">Natural domain <i>D</i></div><div class="gdom">All <i>z</i> with <i>w</i><sub>1</sub> ≠ −1 and <i>w</i><sub>2</sub> ≠ −0.8 + 0.75<i>i</i>.</div>'
            f'<button class="disc-row">{IC["chevR"]}Step by step</button><button class="disc-row">{IC["chevR"]}How these are decided</button></div>')

def ctx_menu(x, y):
    return (f'<div class="lp-ring" style="left:{x}px;top:{y}px"></div>'
            f'<div class="ph-menu" style="left:{x - 150}px;top:{y + 30}px" role="menu"><div class="mh"><i>w</i><sub>2</sub> = 0.62 − 0.31<i>i</i></div>'
            f'<button class="mi2"><span class="mk z"></span>Add zero here</button>'
            f'<button class="mi2"><span class="mk p"></span>Add pole here</button>'
            f'<button class="mi2"><span class="micn">{IC["point"]}</span>Add point here</button><div class="ms"></div>'
            f'<button class="mi2"><span class="micn">{IC["copy"]}</span>Copy coordinates</button>'
            f'<button class="mi2"><span class="micn">{IC["fit"]}</span>Center view here</button></div>')

def more_sheet():
    rows = [('examples', 'Examples', True), ('download', 'Export figure', True), ('tex', 'Copy LaTeX with guarantees', False),
            ('search', 'Search functions and commands', False), ('tour', 'Guided tour', True), ('book', 'Reference guide', False)]
    rr = ''.join(f'<button class="mrow">{IC[i]}<span class="mrl">{t}</span>{IC["chevR"] if ch else ""}</button>' for i, t, ch in rows)
    sets = (f'<div class="mrow set">{IC["sound"]}<span class="mrl">Sound</span><button class="lnk">Settings</button><span class="msw"><span></span></span></div>'
            f'<div class="mrow set">{IC["theme"]}<span class="mrl">Theme</span><span class="seg3"><b class="on">Auto</b><b>Light</b><b>Dark</b></span></div>'
            f'<div class="mrow set">{IC["globe"]}<span class="mrl">Language</span><span class="seg3"><b class="on">Auto</b><b>English</b><b>Русский</b></span></div>')
    head = ('<div class="mhd"><svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true"><rect x="1.5" y="1.5" width="25" height="25" rx="2" fill="var(--plane)" stroke="var(--ink)" stroke-width="1.25"/>'
            '<g fill="none" stroke-width="1.15" stroke-linecap="round"><g stroke="var(--ink)"><path d="M6.51 25.62Q27.83 14 6.51 2.38"/><path d="M15.78 25.62Q25.76 14 15.78 2.38"/></g>'
            '<g stroke="var(--accent)"><path d="M21.49 25.62Q0.17 14 21.49 2.38"/><path d="M12.22 25.62Q2.24 14 12.22 2.38"/></g></g><circle cx="14" cy="14" r="1.4" fill="var(--ink)"/></svg>'
            '<span class="mt">Complex Map Workbench</span><button class="ph-ib sm" aria-label="Close">' + IC['x'] + '</button></div>')
    return head + f'<div class="sets">{sets}</div><div class="rows2">{rr}</div>'

def tools_sheet():
    T = [('select', 'Select'), ('point', 'Point'), ('segment', 'Segment'), ('line', 'Line'), ('ray', 'Ray'), ('circle', 'Circle'), ('arc', 'Arc'),
         ('freehand', 'Freehand'), ('disc', 'Disc'), ('rect', 'Rectangle'), ('polygon', 'Polygon'), ('lasso', 'Lasso'), ('half', 'Half-plane'),
         ('annulus', 'Annulus'), ('sector', 'Sector'), ('formula', 'Formula'), ('grid', 'Grid'), ('polar', 'Polar grid')]
    g = ''.join(f'<button class="tt{" on" if k == "disc" else ""}">{IC[k]}<span>{n}</span></button>' for k, n in T)
    C = [('line2', 'Line through 2 points'), ('circle3', 'Circle through 3 points'), ('mid', 'Midpoint'), ('glider', 'Point on a curve')]
    c = ''.join(f'<button class="tc">{IC[k]}<span>{n}</span></button>' for k, n in C)
    return (f'<div class="sh-h"><span class="ttl">Draw</span><button class="pill on">{IC["snap"]}Snap</button></div>'
            f'<div class="tgrid">{g}</div><div class="sh-sub">Constructions</div><div class="cgrid">{c}</div>')

def display_sheet():
    def chk(lbl, on): return f'<label class="ck"><span class="bx{" on" if on else ""}"></span>{lbl}</label>'
    def sld(lbl, v, p): return f'<div class="sl"><span>{lbl}</span><span class="tr"><b style="width:{p}%"></b><i style="left:{p}%"></i></span><span class="mono">{v}</span></div>'
    return (f'<div class="sh-h"><span class="ttl">Display</span><span class="sh-note">Y-plane</span></div>'
            f'<div class="sh-sub">This view</div><div class="cks">{chk("View outline", True)}{chk("Phase key", False)}{chk("Mini plane", True)}</div>'
            f'<div class="sh-sub">Pattern carried by the map</div><div class="pats">{img("{T}/patterns")}</div>'
            f'{sld("Cell", "×1", 50)}{sld("Opacity", "0.85", 81)}'
            f'<div class="sh-sub">Overlays</div><div class="cks">{chk("Unit circle", True)}{chk("Grid lines on regions", True)}{chk("Orientation chevrons", False)}</div>')

# ---------------- frames ----------------
def frame(T, body, w=390):
    return f'<div class="phone th-{T}" style="width:{w}px">{body.replace("{T}", T)}</div>'

def base(view, pic, title, scale, chain, tl, inset=None, inset_lbl='Y', extra='', sheet_html='', deform=False, sphere=True, L=EN, legend=False, pos=None, hint=None, scrim=False, shift=0):
    return (status() + header(view, deform, L) + stage(pic, title, scale, sphere, inset, inset_lbl, extra, pos, legend, hint, shift)
            + chain + tl + home() + ('<div class="scrim"></div>' if scrim else '') + sheet_html)

S = []  # (id, title, note, builder(T))
S.append(('home-x', '1 · X: the domain, one plane at a time',
  'The header is the view: <b>X · Y · Phase · Landscape</b> (one tap, 44 px, words not icons). The plane fills the screen; <b>the other plane is a live inset</b> (bottom-left), tap it to swap. The <b>chain bar</b> is the chain as small cards (picture, index, type) and the closed state of the editor sheet; the deformation toggle sits at its end. The <b>tool row</b> keeps four tools and More. 24 controls on screen, all 44 px or more (was 100 on a 3111 px page, 80 of them smaller).',
  lambda T: base('X', '{T}/stage-x', '<i>z</i>', '2 / div', chainbar('xy'), tools(), inset='{T}/inset-y', inset_lbl='Y')))
S.append(('home-y', '2 · Y: the image, with X in the inset',
  'Same frame, other plane. The title chip names the plane and its scale. Drawing in Y adds a target (as on desktop).',
  lambda T: base('Y', '{T}/stage-y', '<i>w</i> = <i>F</i>(<i>z</i>)', '2 / div', chainbar('xy'), tools(), inset='{T}/inset-x', inset_lbl='X', pos='60% 50%')))
S.append(('zp', '3 · Tap a chain card: the step editor sheet (Zeros and poles)',
  'The sheet opens at half height over the tool row; the chain bar rides on its top edge, so another card is one tap away. The plane stays live above it (here f₃ is shown alone: its input plane w₂ with ζ₁, ζ₂ and p₁). Big <b>Add zero / Add pole</b>, one 48 px row per value, 16 px fields (no zoom-on-focus on iPhone). Drag the grabber up for the full height.',
  lambda T: base('X', '{T}/stage-zp-x', '<i>w</i><sub>2</sub>', '0.5 / div', '', '', shift=-138,
                 sheet_html=sheet(398, chainbar('xy', sel=3, alone=3, shift=190) + '<div class="sbody">' + ed_zp() + '</div>', cls='insp'))))
S.append(('ctx', '4 · Long-press the plane: the context menu',
  'Hold 450 ms without moving (a ring fills under the finger), release: the menu opens, headed by the point. The same menu as the desktop right-click. Moving more than 8 px first pans or drags instead, so it never fights pan and pinch.',
  lambda T: base('X', '{T}/stage-zp-x', '<i>w</i><sub>2</sub>', '0.5 / div', chainbar('xy', sel=3, alone=3, shift=190), tools(), inset='{T}/inset-zp-y', inset_lbl='Y',
                 extra=ctx_menu(262, 260))))
S.append(('def', '5 · Deformation: X and Y merge, the tool row becomes the transport',
  'The toggle at the end of the chain bar. X and Y merge into one plane (and the two segments into one, <b>X → Y</b>). Drawing is off in the deformation, so its row is the transport: pause, the scrubber with the steps’ ticks, speed, Paths, close. Each card shows its step at the current t.',
  lambda T: base('Y', '{T}/stage-def', '<i>z</i> → <i>w</i>', '2 / div', chainbar('def', deform={1: 1, 2: 0.45, 3: 0}), transport(), deform=True, sphere=True)))
S.append(('phase', '6 · Phase: one tap in the header; the cards show each step’s phase portrait',
  'Each card pictures its step in the open view (here f₁ over z, f₂ over w₁, f₃ over w₂ with its zeros and pole). The colour key is the folded wheel under the plane’s buttons.',
  lambda T: base('phase', '{T}/stage-phase', 'phase of <i>F</i>', '2 / div', chainbar('phase'), tools(), legend=True)))
S.append(('land', '7 · Landscape',
  'One-finger orbit, pinch zoom. Height and colouring are in the Display sheet. Cards show each step’s own relief.',
  lambda T: base('land', '{T}/stage-land', 'landscape of |<i>F</i>|', '', chainbar('land'), tools(), sphere=False, hint='Drag to orbit, pinch to zoom')))
S.append(('more', '8 · More (⋯): everything that is not about the picture',
  'One sheet replaces the old menu, the sound popover and the language menu. Sound, Theme and Language are set right here (Language: one tap). Examples and Export open their own full-height sheets.',
  lambda T: base('X', '{T}/stage-x', '<i>z</i>', '2 / div', chainbar('xy'), tools(), inset='{T}/inset-y', inset_lbl='Y', scrim=True,
                 sheet_html=sheet(318, more_sheet(), cls='shm'))))
S.append(('guar', '9 · The F card: the guarantees, shrunk',
  'Guarantees are about the final map only, so they live on the F card at the end of the chain: “Analytic · 1 of 8”. Tapping it shows the lit ones, the rest on one muted line, and the natural domain. The per-step lamp rows and the 1000 px panel are gone.',
  lambda T: base('Y', '{T}/stage-y', '<i>w</i> = <i>F</i>(<i>z</i>)', '2 / div', '', '', shift=-60,
                 sheet_html=sheet(398, chainbar('xy', sel='F', shift=372) + '<div class="sbody">' + ed_F() + '</div>', cls='insp'))))
S.append(('tools', '10 · More tools: every tool and the constructions',
  'All 18 tools in one grid (4 columns, 56 px tiles), Snap in the head, then the constructions (tap the points in order). A tool picked here lights the More key with its own icon, so the row always shows the active tool.',
  lambda T: base('X', '{T}/stage-x', '<i>z</i>', '2 / div', '', '', sheet_html=sheet(300, tools_sheet(), cls='sht'))))
S.append(('display', '11 · Display: the plane’s options and the pattern',
  'The sliders button on the plane opens it. “This view” holds what the old options strip held (here Y’s view outline and phase key, and the inset). Pattern, cell, opacity and overlays follow. Non-modal: the plane updates live above it.',
  lambda T: base('Y', '{T}/stage-y', '<i>w</i> = <i>F</i>(<i>z</i>)', '2 / div', '', '', pos='60% 30%', sheet_html=sheet(372, display_sheet(), cls='disp'))))
S.append(('ru360', '12 · 360 px in Russian: the longest labels fit',
  'Header, chain cards and tool row with the strings of the Russian table (Дробно-линейная on two lines; the short tool label Многоуг.) at 360 px. Chain cards allow two lines for the type; tool labels allow one.',
  lambda T: base('X', '{T}/stage-x', '<i>z</i>', '2 / div', chainbar('xy', L=RU), tools(L=RU), inset='{T}/inset-y', inset_lbl='Y', L=RU)))

CSS = r"""
/* ---------- mockup page (not app CSS) ---------- */
html, body { height: auto; }
body { background: var(--bg); padding: 0 0 48px; }
.mock-bar { position: sticky; top: 0; z-index: 80; display: flex; align-items: center; gap: 16px; padding: 10px 20px; background: var(--inverse); color: var(--inverse-ink); font: var(--t-label); }
.mock-bar b { font: var(--t-heading); }
.intro { max-width: 1180px; margin: 18px 20px 4px; font: var(--t-body); color: var(--ink-2); }
.intro b { color: var(--ink); }
.grid { display: flex; flex-wrap: wrap; gap: 36px 48px; padding: 16px 20px; }
.scr { width: 800px; }
.scr > h2 { font: var(--t-title); color: var(--ink); margin: 0 0 4px; }
.scr > p { font: var(--t-body); color: var(--ink-2); margin: 0 0 12px; min-height: 54px; }
.scr > p b { color: var(--ink); }
.fpair { display: flex; gap: 20px; align-items: flex-start; }
.th-dark { color-scheme: dark; DARK_TOKENS --seg-on: var(--surface-2); }
.th-light { color-scheme: light; }

/* ---------- the phone frame ---------- */
.phone { position: relative; height: 844px; overflow: hidden; border-radius: 44px; background: var(--bg); color: var(--ink);
  box-shadow: 0 0 0 1px var(--line-strong), 0 0 0 9px #0B1014, 0 18px 40px #0000003D; font: var(--t-body); display: flex; flex-direction: column; }
.phone *, .phone *::before, .phone *::after { box-sizing: border-box; }
.phone button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.phone i { font-family: var(--f-math); font-style: italic; }
.phone sub { font-size: 0.72em; line-height: 0; }
.sb { flex: 0 0 47px; display: flex; align-items: center; justify-content: space-between; padding: 10px 30px 0 36px; font: 600 15px/1 var(--f-ui); color: var(--ink); }
.sb-r { display: inline-flex; gap: 6px; align-items: center; }
.hm { flex: 0 0 34px; display: grid; place-items: center; background: var(--panel); }
.hm span { width: 134px; height: 5px; border-radius: 3px; background: var(--ink); opacity: .85; }

/* header: Undo Redo | X Y Phase Landscape | More */
.ph-top { flex: 0 0 48px; display: flex; align-items: center; gap: 2px; padding: 0 6px; background: var(--bg); }
.ph-ib { width: 44px; height: 44px; display: inline-grid; place-items: center; flex: 0 0 44px; color: var(--ink-2); border-radius: var(--r-3); }
.ph-ib.off { color: var(--faint); }
.ph-ib.sm { width: 40px; height: 40px; flex-basis: 40px; }
.ph-ib.pressed { background: var(--accent-soft); color: var(--accent); }
.ph-ib.hid { visibility: hidden; }
.ph-seg { flex: 1 1 auto; min-width: 0; display: flex; height: 40px; margin: 0 4px; padding: 3px; gap: 2px; background: var(--well); border: 1px solid var(--line); border-radius: var(--r-4); }
.ph-seg > button { flex: 1 1 auto; min-width: 0; padding: 0 6px; border-radius: var(--r-3); border: 1px solid transparent; font: 600 13px/1 var(--f-ui); font-stretch: semi-condensed; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph-seg > button.xy { flex: 0 0 38px; }
.ph-seg > button.xy i { font: italic 500 16px/1 var(--f-math); }
.ph-seg > button.on { background: var(--seg-on); border-color: var(--line-strong); color: var(--ink); box-shadow: var(--shadow-1); }
.ph-seg > button.merged { flex: 0 0 80px; background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.ph-seg > button.merged i { font: italic 500 16px/1 var(--f-math); }
.ph-seg .marr { margin: 0 4px; font: var(--t-label); }

/* stage: one plane, chrome on top */
.ph-stage { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; background: var(--plane); }
.ph-stage > img.plimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ov-title { position: absolute; left: 22px; top: 8px; display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px;
  background: var(--overlay); border: 1px solid var(--line); border-radius: var(--r-3); font: italic 500 15px/1 var(--f-math); color: var(--ink); }
.ov-title sub { font-size: 10px; line-height: 1; vertical-align: -3px; }
.ov-title .sc { font: var(--t-readout); font-style: normal; color: var(--ink-2); }
.ov-hint { position: absolute; left: 50%; top: 48px; translate: -50% 0; padding: 6px 10px; border-radius: var(--r-3); background: var(--overlay); border: 1px solid var(--line); font: var(--t-label); color: var(--ink-2); white-space: nowrap; }
.ov-rt { position: absolute; right: 8px; top: 8px; display: flex; flex-direction: column; gap: 8px; }
.ov-b { width: 44px; height: 44px; display: grid; place-items: center; background: var(--overlay); border: 1px solid var(--line-strong) !important; border-radius: var(--r-4) !important; color: var(--ink-2); box-shadow: var(--shadow-1); }
.ov-fit { position: absolute; right: 8px; bottom: 22px; }
.ov-b.wheel .wh { width: 22px; height: 22px; border-radius: 50%; background: conic-gradient(from 90deg, #e8475f, #e3a23e, #d9d84a, #4bc28a, #3fb6d3, #5468e8, #b54fd6, #e8475f);
  -webkit-mask: radial-gradient(circle, transparent 5px, #000 5.5px); mask: radial-gradient(circle, transparent 5px, #000 5.5px); }
.ov-inset { position: absolute; left: 22px; bottom: 22px; width: 116px; height: 116px; padding: 0; border-radius: var(--r-4) !important; overflow: hidden;
  border: 1px solid var(--line-strong) !important; box-shadow: var(--shadow-3); background: var(--plane); }
.ov-inset img { display: block; width: 100%; height: 100%; }
.ov-inset .in-lbl { position: absolute; left: 4px; top: 4px; min-width: 20px; height: 20px; padding: 0 5px; display: grid; place-items: center; border-radius: var(--r-2); background: var(--inverse); color: var(--inverse-ink); }
.ov-inset .in-lbl i { font: italic 500 13px/1 var(--f-math); }
.ov-inset .in-swap { position: absolute; right: 4px; bottom: 4px; width: 20px; height: 20px; display: grid; place-items: center; border-radius: var(--r-2); background: var(--overlay); color: var(--ink-2); }

/* chain bar: the closed state of the editor sheet */
.ph-chain { flex: 0 0 64px; position: relative; display: flex; background: var(--panel); border-top: 1px solid var(--line); }
.sc-wrap { flex: 1 1 auto; min-width: 0; overflow: hidden; }
.sc-row { display: flex; align-items: center; gap: 0; height: 64px; padding: 0 8px; width: max-content; }
.chip2 { position: relative; height: 48px; display: inline-flex; align-items: stretch; gap: 7px; padding: 1px 8px 1px 1px; background: var(--surface) !important;
  border: 1px solid var(--line-strong) !important; border-radius: var(--r-4) !important; text-align: left; flex: 0 0 auto; }
.chip2.sel { box-shadow: 0 0 0 2px var(--accent); border-color: var(--accent) !important; }
.chip2.dim .th img { opacity: .55; }
.chip2 .th { position: relative; width: 44px; height: 44px; flex: 0 0 44px; border-radius: calc(var(--r-4) - 1px); overflow: hidden; background: var(--plane); }
.chip2 .th img { display: block; width: 44px; height: 44px; }
.chip2 .tbar { position: absolute; left: 3px; right: 3px; bottom: 3px; height: 3px; border-radius: 2px; background: #00000033; }
.chip2 .tbar b { display: block; height: 100%; border-radius: 2px; background: var(--accent); }
.chip2 .tx2 { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-width: 0; max-width: 72px; }
.chip2 .ix { display: inline-flex; align-items: center; gap: 5px; font: italic 500 15px/16px var(--f-math); color: var(--ink); }
.chip2 .ix sub { font-size: 10px; }
.chip2 .ty { display: inline-flex; color: var(--muted); }
.chip2 .lensb { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: var(--r-2); background: var(--accent); color: var(--accent-ink); }
.chip2 .lensb svg { width: 11px; height: 11px; }
.chip2 .nm2 { font: 500 11.5px/13px var(--f-ui); font-stretch: semi-condensed; color: var(--ink-2); hyphens: manual; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.chip2.nums { width: 40px; padding: 0; display: grid; place-items: center; color: var(--ink-2); margin-right: 8px; }
.chip2.add { width: 44px; padding: 0; display: grid; place-items: center; color: var(--ink-2); border-style: dashed !important; background: transparent !important; }
.chip2.fchip { margin-left: 8px; }
.chip2 .gd, .gsec .gd { display: inline-block; width: 8px; height: 8px; border-radius: var(--r-1); background: var(--good); margin-right: 5px; vertical-align: 0; }
.chip2 .cnt { font: var(--t-caption); color: var(--muted); }
.cnx { display: inline-grid; place-items: center; width: 18px; color: var(--faint); flex: 0 0 18px; }
.dfm-wrap { flex: 0 0 auto; display: grid; place-items: center; padding: 0 8px 0 10px; position: relative; background: var(--panel); }
.dfm-wrap::before { content: ""; position: absolute; left: -18px; top: 0; bottom: 0; width: 18px; background: linear-gradient(to right, transparent, var(--panel)); }
.dfm { width: 48px; height: 48px; display: grid; place-items: center; border: 1px solid var(--line-strong) !important; border-radius: var(--r-4) !important; background: var(--surface) !important; color: var(--ink-2); }
.dfm.on { background: var(--accent) !important; border-color: var(--accent) !important; color: var(--accent-ink); }

/* tool row */
.ph-tools { flex: 0 0 56px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2px; padding: 4px 6px; background: var(--panel); border-top: 1px solid var(--line-strong); }
.tk { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-width: 0; height: 48px; border-radius: var(--r-3); color: var(--ink-2); }
.tk span { max-width: 100%; padding: 0 2px; font: 500 11px/12px var(--f-ui); font-stretch: semi-condensed; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; hyphens: manual; }
.tk.on { background: var(--inverse); color: var(--inverse-ink); }
.ph-tools.trans { display: flex; align-items: center; gap: 2px; }
.tb { width: 44px; height: 44px; flex: 0 0 44px; display: grid; place-items: center; border-radius: var(--r-3); color: var(--ink-2); }
.tb.on { background: var(--accent-soft); color: var(--accent); }
.tb.sp { font: var(--t-readout); color: var(--ink); border: 1px solid var(--line-strong) !important; height: 32px; width: 40px; flex-basis: 40px; margin: 0 2px; }
.tscr { position: relative; flex: 1 1 auto; height: 48px; margin: 0 8px; }
.tscr .rd { position: absolute; left: 0; top: 3px; font: var(--t-readout); color: var(--ink-2); }
.tscr .rd i { font-family: var(--f-math); }
.trk { position: absolute; left: 0; right: 0; top: 27px; height: 3px; border-radius: 2px; background: var(--line-strong); }
.trk b { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; background: var(--accent); }
.trk .kn { position: absolute; top: 50%; width: 20px; height: 20px; translate: -50% -50%; border-radius: 50%; background: var(--surface); border: 2px solid var(--accent); box-shadow: var(--shadow-1); }
.trk .sep3 { position: absolute; top: -4px; width: 1px; height: 11px; background: var(--line-strong); }
.tscr .tk3 { position: absolute; top: 34px; translate: -50% 0; font: italic 500 11px/12px var(--f-math); color: var(--muted); }
.tscr .tk3 sub { font-size: 8px; }

/* sheets */
.scrim { position: absolute; inset: 0; background: var(--scrim); z-index: 30; }
.ph-sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 40; display: flex; flex-direction: column; background: var(--surface);
  border-top: 1px solid var(--line-strong); border-radius: 12px 12px 0 0; box-shadow: var(--shadow-3); overflow: hidden; padding-bottom: 34px; }
.ph-sheet .grab { flex: 0 0 18px; display: grid; place-items: center; }
.ph-sheet .grab span { width: 36px; height: 4px; border-radius: 2px; background: var(--line-strong); }
.ph-sheet.insp .ph-chain { background: var(--surface); border-top: 0; border-bottom: 1px solid var(--line); }
.ph-sheet.insp .dfm-wrap, .ph-sheet.insp .dfm-wrap::before { background: var(--surface); }
.ph-sheet.insp .dfm-wrap::before { background: linear-gradient(to right, transparent, var(--surface)); }
.sbody { flex: 1 1 auto; min-height: 0; overflow: hidden; padding: 0 12px; }
.ih { display: flex; align-items: center; gap: 6px; height: 48px; }
.ih .ix { font: italic 500 17px/1 var(--f-math); color: var(--ink); min-width: 22px; }
.ih .ix sub { font-size: 11px; }
.ih .ty { display: inline-flex; color: var(--muted); }
.ih .ttl { flex: 1 1 auto; min-width: 0; font: var(--t-heading); font-size: 15px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fm { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 4px 10px; margin-bottom: 10px; border-radius: var(--r-3); background: var(--well); font: italic 500 16px/1.2 var(--f-math); color: var(--ink); }
.fm sub { font-size: 11px; }
.frac { display: inline-flex; flex-direction: column; align-items: center; vertical-align: middle; font-size: 14px; }
.frac > span:first-child { border-bottom: 1px solid currentColor; padding: 0 3px 2px; }
.frac > span:last-child { padding: 2px 3px 0; }
.zbtn2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.zbtn { height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; border: 1px solid var(--line-strong) !important; border-radius: var(--r-4) !important;
  background: var(--surface-2) !important; font: 600 14px/1 var(--f-ui) !important; color: var(--ink) !important; }
.mk { display: inline-block; width: 12px; height: 12px; flex: 0 0 12px; }
.mk.z { border-radius: 50%; background: var(--zero); box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--zero); width: 9px; height: 9px; flex-basis: 9px; margin: 0 2px; }
.mk.p { position: relative; }
.mk.p::before, .mk.p::after { content: ""; position: absolute; left: 50%; top: 50%; width: 15px; height: 2.4px; border-radius: 1px; background: var(--pole); translate: -50% -50%; rotate: 45deg; }
.mk.p::after { rotate: -45deg; }
.hint { margin: 8px 2px 6px; font: var(--t-label); color: var(--muted); }
.rows { border-top: 1px solid var(--line); }
.prow { display: flex; align-items: center; gap: 8px; height: 50px; border-bottom: 1px solid var(--line); }
.prow .plab { width: 28px; font: italic 500 16px/1 var(--f-math); color: var(--ink); }
.prow .plab sub { font-size: 11px; }
.pin { flex: 1 1 auto; min-width: 0; height: 40px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: var(--r-3); background: var(--surface-2); color: var(--ink); font: 400 16px/1 var(--f-mono); }
.gsec { padding: 0 2px; }
.glbl { margin: 10px 0 4px; font: var(--t-caption); color: var(--muted); text-transform: none; }
.gon { font: var(--t-heading); font-size: 15px; color: var(--ink); }
.goff { font: var(--t-body); color: var(--muted); }
.gdom { font: var(--t-body); color: var(--ink-2); }
.gdom i, .goff i { font-family: var(--f-math); }
.disc-row { display: flex; align-items: center; gap: 6px; width: 100%; height: 44px; border-top: 1px solid var(--line) !important; margin-top: 8px; font: var(--t-body) !important; color: var(--ink-2) !important; }
.disc-row + .disc-row { margin-top: 0; }

/* context menu */
.lp-ring { position: absolute; z-index: 20; width: 44px; height: 44px; translate: -50% -50%; border-radius: 50%; border: 2.5px solid var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent); }
.ph-menu { position: absolute; z-index: 25; width: 236px; padding: 4px; background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r-4); box-shadow: var(--shadow-3); }
.ph-menu .mh { height: 34px; display: flex; align-items: center; padding: 0 10px; font: italic 500 14px/1 var(--f-math); color: var(--ink-2); border-bottom: 1px solid var(--line); margin-bottom: 4px; }
.ph-menu .mh sub { font-size: 10px; }
.mi2 { display: flex; align-items: center; gap: 12px; width: 100%; height: 44px; padding: 0 10px !important; border-radius: var(--r-3) !important; font: var(--t-body) !important; font-size: 14px !important; color: var(--ink) !important; text-align: left; }
.mi2:first-of-type { background: var(--well) !important; }
.mi2 .mk { margin: 0 3px; }
.micn { display: inline-grid; place-items: center; width: 18px; color: var(--ink-2); }
.micn svg { width: 16px; height: 16px; }
.ms { height: 1px; margin: 4px 0; background: var(--line); }

/* More sheet */
.mhd { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 6px 0 16px; border-bottom: 1px solid var(--line); }
.mhd .mt { flex: 1 1 auto; font: var(--t-wordmark); color: var(--ink); }
.sets { padding: 4px 0; border-bottom: 1px solid var(--line); }
.mrow { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 0 12px 0 16px !important; color: var(--ink-2) !important; text-align: left; }
.mrow .mrl { flex: 1 1 auto; font: var(--t-body); font-size: 14px; color: var(--ink); }
.mrow .tx { font: 600 11px/1 var(--f-math); width: 18px; color: var(--ink-2); }
.mrow .tx sub { font-size: 9px; vertical-align: -2px; }
.mrow.set .lnk { font: var(--t-label); color: var(--accent); height: 44px; padding: 0 8px; }
.msw { width: 44px; height: 26px; border-radius: 13px; background: var(--line-strong); position: relative; }
.msw span { position: absolute; left: 3px; top: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--surface); box-shadow: var(--shadow-1); }
.seg3 { display: inline-flex; height: 36px; padding: 2px; gap: 2px; background: var(--well); border: 1px solid var(--line); border-radius: var(--r-4); }
.seg3 b { display: grid; place-items: center; padding: 0 9px; border-radius: var(--r-3); font: 500 12.5px/1 var(--f-ui); font-stretch: semi-condensed; color: var(--ink-2); border: 1px solid transparent; }
.seg3 b.on { background: var(--seg-on); border-color: var(--line-strong); color: var(--ink); }
.rows2 { padding: 4px 0; }

/* tools sheet */
.sh-h { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px 0 16px; }
.sh-h .ttl { flex: 1 1 auto; font: var(--t-heading); font-size: 15px; color: var(--ink); }
.sh-note { font: var(--t-label); color: var(--muted); }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px !important; border: 1px solid var(--line-strong) !important; border-radius: 18px !important; font: var(--t-label) !important; color: var(--ink-2) !important; }
.pill.on { background: var(--accent-soft) !important; border-color: var(--accent) !important; color: var(--accent) !important; }
.tgrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 0 8px; }
.tt { height: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; border-radius: var(--r-3) !important; color: var(--ink-2) !important; }
.tt span { font: 500 11.5px/12px var(--f-ui); font-stretch: semi-condensed; }
.tt.on { background: var(--inverse) !important; color: var(--inverse-ink) !important; }
.tt .fx, .tc .fx { font: italic 600 15px/18px var(--f-math); }
.sh-sub { margin: 12px 16px 6px; font: var(--t-caption); color: var(--muted); }
.cgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; padding: 0 12px; }
.tc { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 10px !important; border: 1px solid var(--line) !important; border-radius: var(--r-3) !important; text-align: left; color: var(--ink-2) !important; }
.tc span { font: 500 12.5px/14px var(--f-ui); color: var(--ink); }

/* display sheet */
.cks { display: flex; flex-direction: column; padding: 0 16px; }
.ck { display: flex; align-items: center; gap: 12px; min-height: 44px; font: var(--t-body); font-size: 14px; color: var(--ink); }
.bx { width: 20px; height: 20px; border: 1.5px solid var(--line-strong); border-radius: var(--r-2); background: var(--surface); }
.bx.on { background: var(--ink); border-color: var(--ink); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E"); }
.th-dark .bx.on { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='%2312191E' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E"); }
.pats { padding: 0 16px; }
.pats img { display: block; width: 100%; }
.sl { display: grid; grid-template-columns: 70px 1fr 44px; align-items: center; gap: 12px; height: 44px; padding: 0 16px; font: var(--t-body); color: var(--ink); }
.sl .tr { position: relative; height: 3px; border-radius: 2px; background: var(--line-strong); }
.sl .tr b { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; background: var(--ink-2); }
.sl .tr i { position: absolute; top: 50%; width: 22px; height: 22px; translate: -50% -50%; border-radius: 50%; background: var(--surface); border: 1px solid var(--line-strong); box-shadow: var(--shadow-1); }
.sl .mono { font: var(--t-readout); color: var(--ink-2); text-align: right; }
"""

JS = r"""
<script>
const IMGS = __IMGS__;
for (const im of document.querySelectorAll('img[data-k]')) { const s = IMGS[im.dataset.k]; if (s) im.src = s; else im.style.background = 'repeating-linear-gradient(45deg,#f0f 0 4px,#000 4px 8px)'; }
</script>
"""

def build():
    import json
    cards = []
    for sid, title, note, fn in S:
        w = 360 if sid == 'ru360' else 390
        cards.append(f'<section class="scr" id="{sid}"><h2>{title}</h2><p>{note}</p><div class="fpair">{frame("light", fn("light"), w)}{frame("dark", fn("dark"), w)}</div></section>')
    css = CSS.replace('DARK_TOKENS', dark_block.strip())
    doc = (f'<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
           f'<title>Phone Redesign Mockup</title>{FONTS}<style>{APP_CSS}\n/* ===== phone mockup ===== */{css}</style></head><body>'
           f'<div class="mock-bar"><b>Complex Map Workbench · phone redesign</b><span>notes/ui-redesign-2/phone/DESIGN.md · every plane, inset and card picture is a real render of the app copy · light and dark side by side</span></div>'
           f'<p class="intro"><b>One screen, no page scroll.</b> Top to bottom: the view (header), one plane, the chain bar, the tool row. Everything else is one bottom sheet at a time: '
           f'the editor (from the chain bar), More tools, Display, More. Long-press is the right-click. 390 × 844 unless marked.</p>'
           f'<div class="grid">{"".join(cards)}</div>' + JS.replace('__IMGS__', json.dumps(IMGS)) + '</body></html>')
    (phone / 'mockup.html').write_text(doc)
    print('mockup.html', len(doc) // 1024, 'KB,', len(S), 'screens')


# =====================================================================================================================
# REVISION 2 (review-design.json, review-users.json): the definitions below replace the ones above (build() looks the
# names up when it runs). Each change names the finding it answers.
# =====================================================================================================================
import cmath
EN.update(xy='X → Y', undo='Undo', deform='Deformation', nums='Numbers', zp='Zeros and poles', mobius='Möbius', div='/ div',
          polygon='Polygon')
RU.update(xy='X → Y', undo='Отме­нить', deform='Дефор­мация', nums='Числа', zp='Нули и полюсы', mobius='Мёбиус', div='/ дел.',
          polygon='Много­угольник', exp='Экспонента', region='Область')
IC['numa'] = '<span class="numa"><i>a</i>&#8202;=</span>'                                      # design-10, users-21

def M(html):                      # one math run: a single flex item, so no gaps inside it (design-18)
    return f'<span class="mth">{html}</span>'

def header(view='xy', deform=False, L=EN, redo=False):
    # design-4: the desktop's switch, X → Y · Phase · Landscape, 44 px; users-17: Undo moved to the tool row
    segs = ''.join(f'<button role="radio" aria-checked="{str(view == k).lower()}" class="{"on" if view == k else ""}">{L[k] if k != "xy" else "<i>X</i><span class=marr>→</span><i>Y</i>"}</button>'
                   for k in ('xy', 'phase', 'land'))
    return (f'<header class="ph-top"><div class="ph-seg" role="radiogroup" aria-label="View">{segs}</div>'
            f'<button class="ph-ib" aria-label="More">{IC["more"]}</button></header>')

def stage(pic, title, scale, sphere=True, inset=None, inset_lbl='Y', extra='', pos=None, legend=False, hint=None, shift=0, alone=None):
    style = (f'object-position:{pos};' if pos else '') + (f'transform:translateY({shift}px);' if shift else '')
    ins = ''
    if inset:
        ins = (f'<button class="ov-inset" aria-label="Swap: show {inset_lbl} large">{img(inset)}<span class="in-lbl"><i>{inset_lbl}</i></span>'
               f'<span class="in-swap">{IC["swap"]}</span></button>')
    rt = (f'<div class="ov-rt">' + (f'<button class="ov-b" aria-label="Sphere" aria-pressed="false">{IC["sphere"]}</button>' if sphere else '')
          + f'<button class="ov-b" aria-label="Display">{IC["sliders"]}</button>'
          + ('<button class="ov-b wheel" aria-label="Colour key"><span class="wh"></span></button>' if legend else '') + '</div>')
    al = (f'<span class="al">{M(alone)} alone</span><button class="alx" aria-label="Show the whole chain">{IC["x"]}</button>') if alone else ''
    ttl = f'<div class="ov-title{" alone" if alone else ""}">{M(title)}<span class="sc">{scale}</span>{al}</div>' if title else ''
    hn = f'<div class="ov-hint">{hint}</div>' if hint else ''
    return (f'<div class="ph-stage">{img(pic, "plimg", style)}{ttl}{hn}{rt}'
            f'<button class="ov-b ov-fit" aria-label="Fit">{IC["fit"]}</button>{ins}' + (f'<div class="ovl">{extra}</div>' if extra else '') + '</div>')

def chip(idx, ty, name, pic, sel=False, alone=False, tbar=None, dim=False, play=False):
    cls = 'chip2' + (' sel' if sel else '') + (' dim' if dim else '') + (' play' if play else '')
    tb = f'<span class="tbar"><b style="width:{tbar * 100:.0f}%"></b></span>' if tbar is not None else ''
    al = f'<span class="lensb" title="Shown alone">{IC["lens"]}</span>' if alone else ''
    return (f'<button class="{cls}" aria-label="{name}"><span class="th">{img(pic)}{tb}</span><span class="tx2"><span class="ix">{M(idx)}<span class="ty">{TY[ty]}</span>{al}</span>'
            f'<span class="nm2">{name}</span></span></button>')

def chainbar(view='xy', sel=None, alone=0, deform=None, shift=0, L=EN, nums=('a', 'ρ'), play=0):
    key = {'xy': 'c-xy-{k}', 'phase': 'c-ph-{k}', 'land': 'c-la-{k}', 'def': 'c-df-{k}'}[view]
    nm = ''.join(f'<i>{n}</i>' for n in nums) if nums else ''
    parts = [f'<button class="chip2 nums{" sel" if sel == "N" else ""}" aria-label="{L["nums"]}">{IC["numa"]}<span class="nn">{nm or L["nums"]}</span></button>',
             chip('<i>z</i>', 'region', L['region'], '{T}/c-xy-0', sel == 0)]
    names = {1: ('exp', L['exp']), 2: ('mobius', L['mobius']), 3: ('zp', L['zp'])}
    for k in (1, 2, 3):
        ty, nmk = names[k]
        tb = deform[k] if deform else None
        parts += [conn(), chip(fsub(k), ty, nmk, '{T}/' + key.format(k=k), sel == k, alone == k, tb, dim=bool(deform) and deform[k] == 0, play=play == k)]
    parts += [conn(), '<button class="chip2 add" aria-label="Add a step">' + IC['plus'] + '</button>']
    # design-3/20/21: F is a small tile, "F" and the lamp only; its sheet holds the formula and the guarantees
    parts.append(f'<button class="chip2 fchip{" sel" if sel == "F" else ""}" aria-label="F, the whole map: analytic"><span class="fF"><i>F</i></span><span class="gd"></span></button>')
    dbtn = (f'<button class="dfm{" on" if deform else ""}" aria-label="{L["deform"]}" aria-pressed="{str(bool(deform)).lower()}">{IC["morph"]}'
            f'<span>{L["deform"]}</span></button>')                                           # design-11
    return (f'<div class="ph-chain"><div class="sc-wrap"><div class="sc-row" style="transform:translateX(-{shift}px)">{"".join(parts)}</div></div>'
            f'<div class="dfm-wrap">{dbtn}</div></div>')

def tools(active='select', L=EN):
    keys = [('undo', L['undo']), ('select', L['select']), ('point', L['point']), ('disc', L['disc']), ('polygon', L['polygon']), ('more', L['more'])]
    if active == 'circle3': keys[-1] = ('circle3', 'Circle (3)' if L is EN else 'Окр. (3)')
    return ('<nav class="ph-tools six">' + ''.join(f'<button class="tk{" on" if k == active or (k == "circle3") else ""}{" undo" if k == "undo" else ""}" aria-label="{lab}">{IC[k]}<span>{lab}</span></button>' for k, lab in keys) + '</nav>')

def transport():
    ticks = ''.join(f'<span class="tk3" style="left:{p}%"><i>f</i><sub>{k}</sub></span>' for k, p in ((1, 16.7), (2, 50), (3, 83.3)))
    seps = ''.join(f'<span class="sep3" style="left:{p}%"></span>' for p in (33.3, 66.7))
    return (f'<nav class="ph-tools trans"><button class="tb" aria-label="Pause">{IC["pause"]}</button>'
            f'<div class="tscr"><span class="rd"><i>t</i> = 1.45 / 3</span><div class="trk">{seps}<b style="width:48.3%"></b><span class="kn" style="left:48.3%"></span></div>{ticks}</div>'
            f'<button class="tb sp" aria-label="Speed">1×</button><button class="tb on" aria-label="Paths" aria-pressed="true">{IC["paths"]}</button>'
            f'<button class="tb" aria-label="Close the deformation">{IC["x"]}</button></nav>')

# ---- the planes while a sheet is open: X | Y side by side (users-3), 195 x 300 each, both live
SX = lambda z: (14 + 90.5 + 40 * z.real, 143 - 40 * z.imag)          # sbs-x: canvas at (14, 0), 181 x 286, s = 40
F2 = lambda z: cmath.tanh(z / 2)                                     # f2 o f1 = (e^z - 1)/(e^z + 1)
ZP = dict(z=[0.5, -0.5j], p=[-0.8 + 0.75j])
F3 = lambda w: (w - 0.5) * (w + 0.5j) / (w + 0.8 - 0.75j)
def cx(z, d=2):
    re, im = round(z.real, d), round(z.imag, d)
    if abs(im) < 10 ** -d / 2: return f'{re:.{d}f}'.replace('-', '−')
    sg = '−' if im < 0 else '+'
    return f'{re:.{d}f}'.replace('-', '−') + f' {sg} {abs(im):.{d}f}<i>i</i>'
def marks_x():
    out = ''
    for kind, ws in (('z', ZP['z']), ('p', ZP['p'])):
        for j, w in enumerate(ws):
            z = 2 * cmath.atanh(w)                                    # the preimage in the strip (k = 0)
            x, y = SX(z)
            lab = f'ζ<sub>{j + 1}</sub>' if kind == 'z' else f'p<sub>{j + 1}</sub>'
            mk = ('<span class="zm z"></span>' if kind == 'z' else '<span class="zm p"></span>')
            out += f'<span class="zmk" style="left:{x:.1f}px;top:{y:.1f}px">{mk}<i class="zl">{lab}</i></span>'
    return out
def sbs(T_, xchip='<i>z</i>', ychip='<i>w</i> = <i>F</i>(<i>z</i>)', marks=True, L=EN):
    return (f'<div class="ph-sbs"><div class="sb1">{img("{T}/sbs-x", "plimg")}<div class="ov-title sm">{M(xchip)}</div>{marks_x() if marks else ""}</div>'
            f'<div class="sb1">{img("{T}/sbs-y", "plimg")}<div class="ov-title sm">{M(ychip)}</div></div></div>')

def ed_zp():
    rows = [('a<sub>3</sub>', '', '1', False), ('ζ<sub>1</sub>', 'zero', '0.5', True), ('ζ<sub>2</sub>', 'zero', '−0.5i', True), ('p<sub>1</sub>', 'pole', '−0.8 + 0.75i', True)]
    r = ''
    for lab, cls, val, rm in rows:
        mk = '<span class="mk z"></span>' if cls == 'zero' else '<span class="mk p"></span>' if cls == 'pole' else '<span class="mk"></span>'
        r += (f'<div class="prow">{mk}<label class="plab"><i>{lab}</i></label><input class="pin" value="{val}" aria-label="{lab}">'
              f'<button class="ph-ib" aria-label="Pick on an Argand diagram">{IC["argand"]}</button>'
              + (f'<button class="ph-ib" aria-label="Remove">{IC["x"]}</button>' if rm else '<span class="ph-ib hid"></span>') + '</div>')
    return (insp_head(fsub(3), 'zp', 'Zeros and poles', alone=False) +
            f'<div class="zbtn2"><button class="zbtn"><span class="mk z"></span>Add zero</button><button class="zbtn"><span class="mk p"></span>Add pole</button></div>'
            f'<p class="hint">Or long-press a plane. New and dragged marks snap to 0.05.</p>'
            f'<div class="rows">{r}</div>')

def insp_head(idx, ty, title, alone=None, extra=''):
    lens = (f'<button class="ph-ib{" pressed" if alone else ""}" aria-label="Show this step alone" aria-pressed="{str(bool(alone)).lower()}">{IC["lens"]}</button>' if alone is not None else '')
    return (f'<div class="ih"><span class="ix">{M(idx)}</span><span class="ty">{TY[ty] if ty else ""}</span><span class="ttl">{title}</span>{extra}{lens}'
            f'<button class="ph-ib" aria-label="More actions">{IC["more"]}</button></div>')

def ed_F():
    nots = ['Entire', 'Rational', 'Polynomial', 'Möbius', 'Proper', 'One-to-one', 'Conformal onto image']
    fm = (f'<div class="fmF"><div>{M("<i>F</i>(<i>z</i>) = " + frac("(<i>w</i><sub>2</sub> − 0.5)(<i>w</i><sub>2</sub> + 0.5<i>i</i>)", "<i>w</i><sub>2</sub> + 0.8 − 0.75<i>i</i>"))}</div>'
          f'<div class="wl">{M("<i>w</i><sub>2</sub> = " + frac("<i>w</i><sub>1</sub> − 1", "<i>w</i><sub>1</sub> + 1"))}<span class="sp"></span>{M("<i>w</i><sub>1</sub> = <i>e</i><sup><i>z</i></sup>")}</div></div>')
    return (insp_head('<i>F</i>', None, 'The whole map', extra=f'<button class="ph-ib" aria-label="Copy F as LaTeX">{IC["copy"]}</button>') + fm +
            f'<div class="gsec"><div class="gon"><span class="gd"></span>Analytic</div>'
            f'<div class="goff">Not implied: {" · ".join(nots)}</div>'
            f'<div class="gdom">Natural domain: all {M("<i>z</i>")} with {M("<i>w</i><sub>1</sub> ≠ −1")} and {M("<i>w</i><sub>2</sub> ≠ −0.8 + 0.75<i>i</i>")}.</div>'
            f'<button class="disc-row">{IC["chevR"]}Step by step</button></div>')

def ed_nums():
    def row(n, v, pct, lo, hi, used):
        return (f'<div class="nrow"><div class="l1"><span class="plab"><i>{n}</i></span><span class="eq">=</span><input class="pin" value="{v}" aria-label="{n}">'
                f'<button class="ph-ib" aria-label="Play {n}">{IC["play"]}</button><button class="ph-ib" aria-label="More">{IC["more"]}</button></div>'
                f'<div class="l2"><span class="lim">{lo}</span><span class="tr"><b style="width:{pct}%"></b><i style="left:{pct}%"></i></span><span class="lim">{hi}</span></div>'
                f'<div class="used">{used}</div></div>')
    return (insp_head(IC['numa'], None, 'Numbers') +
            row('a', '0.80', 70, '−2', '2', f'used by Line 1: {M("Im <i>z</i> = <i>a</i>")}') +
            row('ρ', '1.20', 30, '0', '4', 'not used yet') +
            f'<button class="addn">{IC["plus"]}Number</button>')

def ctx_menu(x, y, z):
    w2, Fz = F2(z), F3(F2(z))
    return (f'<div class="lp-ring" style="left:{x:.1f}px;top:{y:.1f}px"></div>'
            f'<div class="ph-menu" style="left:{x - 150:.0f}px;top:{y + 30:.0f}px" role="menu" aria-label="At this point">'
            f'<div class="mh"><span>{M("<i>z</i> = " + cx(z))}</span><span class="mh2">{M("<i>F</i>(<i>z</i>) = " + cx(Fz))}</span></div>'
            f'<button class="mi2" role="menuitem"><span class="mk z"></span><span>Add zero of {M(fsub(3))} here<small>also at {M("<i>z</i> + 2π<i>ik</i>")}</small></span></button>'
            f'<button class="mi2" role="menuitem"><span class="mk p"></span><span>Add pole of {M(fsub(3))} here</span></button>'
            f'<button class="mi2" role="menuitem"><span class="micn">{IC["point"]}</span>Add point here</button><div class="ms" role="separator"></div>'
            f'<button class="mi2" role="menuitem"><span class="micn">{IC["copy"]}</span>Copy coordinates</button>'
            f'<button class="mi2" role="menuitem"><span class="micn">{IC["fit"]}</span>Center view here</button></div>')

def tools_sheet():
    T_ = [('select', 'Select'), ('point', 'Point'), ('segment', 'Segment'), ('line', 'Line'), ('ray', 'Ray'), ('circle', 'Circle'), ('arc', 'Arc'),
          ('freehand', 'Freehand'), ('disc', 'Disc'), ('rect', 'Rectangle'), ('polygon', 'Polygon'), ('lasso', 'Lasso'), ('half', 'Half-plane'),
          ('annulus', 'Annulus'), ('sector', 'Sector'), ('formula', 'Formula'), ('grid', 'Grid'), ('polar', 'Polar grid'),
          ('circle3', 'Circle (3 points)'), ('meet', 'Intersect')]
    IC.setdefault('meet', sv('<path d="M2 13L14 3"/><path d="M2 4c4 1 9 5 12 9"/><circle cx="8" cy="8" r="2" fill="var(--surface)"/>'))
    IC.setdefault('bis', sv('<path d="M3 11L13 5"/><path d="M6 3l4 10" stroke-dasharray="2 1.6"/><circle cx="3" cy="11" r="1.3" fill="currentColor"/><circle cx="13" cy="5" r="1.3" fill="currentColor"/>'))
    g = ''.join(f'<button class="tt{" on" if k == "disc" else ""}{" new" if k in ("circle3", "meet") else ""}">{IC[k]}<span>{n}</span></button>' for k, n in T_)
    C = [('mid', 'Midpoint'), ('bis', 'Bisector'), ('glider', 'Point on curve')]
    c = ''.join(f'<button class="tt">{IC[k]}<span>{n}</span></button>' for k, n in C)
    return (f'<div class="sh-h"><span class="ttl">Draw</span><button class="pill on" aria-pressed="true">{IC["snap"]}Snap</button></div>'
            f'<div class="tgrid">{g}</div><div class="sh-sub">More constructions</div><div class="tgrid">{c}</div>'
            f'<p class="hint" style="margin:8px 16px">Line, Segment, Circle, Disc… snap to existing points: a line through two points is the Line tool.</p>')

def display_sheet():
    def chk(lbl, on): return f'<label class="ck"><span class="bx{" on" if on else ""}"></span>{lbl}</label>'
    def sld(lbl, v, p): return f'<div class="sl2"><div class="t"><span>{lbl}</span><span class="mono">{v}</span></div><span class="tr"><b style="width:{p}%"></b><i style="left:{p}%"></i></span></div>'
    P = [('Checker', 0, 0, True), ('Log-polar', 186, 0, False), ('Tiles', 372, 0, False), ('Grid', 558, 0, False), ('Polar grid', 0, 130, False),
         ('Arg z', 186, 130, False), ('Stretch', 372, 130, False), ('Sphere checker', 558, 130, False), ('Solid', 0, 260, False)]
    pats = ''.join(f'<button class="pt{" on" if on else ""}"><span class="pi" style="background-image:var(--pat);background-position:-{x / 2:.0f}px -{y / 2:.0f}px"></span><span class="pn">{n}</span></button>' for n, x, y, on in P)
    return (f'<div class="sh-h"><span class="ttl">Display</span><span class="sh-note">Y-plane</span></div>'
            f'<div class="sh-sub">This view</div><div class="cks">{chk("View outline", True)}{chk("Phase key", False)}{chk("Mini plane", True)}</div>'
            f'<div class="sh-sub">Pattern carried by the map</div><div class="pats2">{pats}</div>'
            f'{sld("Cell", "×1", 50)}{sld("Opacity", "0.85", 81)}')

def ph_chip_construct():
    P = complex(-1.5, -0.75); x0, y0 = 14 + 188 + 52 * P.real, 290.5 - 52 * P.imag; x1, y1 = 14 + 188, 290.5
    dx, dy = x1 - x0, y1 - y0
    L = 900 / (dx * dx + dy * dy) ** 0.5
    return (f'<svg class="cons" viewBox="0 0 390 595" width="390" height="595"><path d="M{x0 - dx * L:.1f} {y0 - dy * L:.1f}L{x1 + dx * L:.1f} {y1 + dy * L:.1f}" class="prev"/>'
            f'<circle cx="{x0:.1f}" cy="{y0:.1f}" r="5.5" class="pt"/><circle cx="{x1:.1f}" cy="{y1:.1f}" r="22" class="snap"/></svg>'
            f'<span class="plab2" style="left:{x0 + 9:.0f}px;top:{y0 - 24:.0f}px"><i>P</i></span>'
            f'<span class="snapl" style="left:{x1 + 24:.0f}px;top:{y1 - 34:.0f}px">on {M("<i>z</i><sub>0</sub>")}</span>'
            f'<div class="pick-chip">Circle through 3 points · point 2 of 3<button class="alx" aria-label="Cancel">{IC["x"]}</button></div>')

def base(view, pic, title, scale, chain, tl, inset=None, inset_lbl='Y', extra='', sheet_html='', deform=False, sphere=True, L=EN, legend=False, pos=None, hint=None, scrim=False, shift=0, alone=None):
    return (status() + header(view, deform, L) + stage(pic, title, scale, sphere, inset, inset_lbl, extra, pos, legend, hint, shift, alone)
            + chain + tl + home() + ('<div class="scrim"></div>' if scrim else '') + sheet_html)

Z_CTX = complex(0.75, 0.6)
CX_, CY_ = 14 + 188 + 52 * Z_CTX.real, 290.5 - 52 * Z_CTX.imag   # stage-relative (the stage object-fit: cover keeps the centre)
S[:] = []
S.append(('home-x', '1 · X → Y: the domain large, the image in the inset',
  '<b>Header</b>: the desktop switch, <b>X → Y · Phase · Landscape</b>, 44 px (design-4); the inset decides which plane is large and the title chip names it. <b>Tool row</b>: Undo moved down to the thumb (users-17); Redo is Undo’s long-press. <b>Chain bar</b>: Numbers has its own glyph <i>a</i>&#8202;= with the names (design-10), the F tile is <i>F</i> and its lamp (design-3, 20), the Deformation toggle has its word (design-11). Card pictures: the image after each step, without the next step’s marks (users-23).',
  lambda T: base('xy', '{T}/stage-x', '<i>z</i>', EN['div'].replace('/', '2 /'), chainbar('xy'), tools(), inset='{T}/inset-y', inset_lbl='Y')))
S.append(('home-y', '2 · X → Y after a tap on the inset: the image large',
  'Same view, the planes swapped. The title chip says which plane this is, with proper math (design-18).',
  lambda T: base('xy', '{T}/stage-y', '<i>w</i> = <i>F</i>(<i>z</i>)', '2 / div', chainbar('xy'), tools(), inset='{T}/inset-x', inset_lbl='X', pos='60% 50%')))
S.append(('zp', '3 · Editing zeros and poles: X and Y stay in sight',
  'While a sheet is open, X and Y show <b>side by side</b> above it, both live (users-3): the zeros of <i>F</i> on X (the preimages of ζ₁, ζ₂ and the pole p₁), the image on Y. Selecting the step does not switch to Show alone (design-1). The step’s own coefficient is <i>a</i>₃, never a plain <i>a</i> (users-5). On touch a mark is removed by its × or the long-press menu, never by dragging it off (users-11); new marks snap to 0.05 (users-10). Every control is 44 px (design-5).',
  lambda T: status() + header('xy') + sbs(T) + sheet(403, chainbar('xy', sel=3, shift=190) + '<div class="sbody">' + ed_zp() + '</div>', cls='insp') + home()))
S.append(('ctx', '4 · Long-press on X: add a zero of f₃ right here',
  f'Hold 450 ms (the ring fills), then release without moving: the menu. Slide instead and it is the live probe (design-6, users-12). The head shows the pressed point and <i>F</i> there, computed at the ring (users-19). On X the menu offers <b>Add zero of f₃ here</b>: the zero is put at <i>w</i>₂ = <i>F</i>₂(<i>z</i>), so <i>z</i> becomes a zero of <i>F</i> (design-1); exp is periodic, so the muted line says it also appears at <i>z</i> + 2π<i>ik</i> (users-13).',
  lambda T: base('xy', '{T}/stage-x', '<i>z</i>', '2 / div', chainbar('xy'), tools(), inset='{T}/inset-y', inset_lbl='Y', extra=ctx_menu(CX_, CY_, Z_CTX))))
S.append(('def', '5 · Deformation: the transport replaces the tools',
  'Each card shows its step at the exact current <i>t</i> (users-14). Only the playing card is accent; the selected card’s outline turns neutral while it plays (design-24). Every transport control is 44 px.',
  lambda T: base('xy', '{T}/stage-def', '<i>z</i> → <i>w</i>', '2 / div', chainbar('def', deform={1: 1, 2: 0.45, 3: 0}, play=2), transport(), deform=True, sphere=True)))
S.append(('phase', '6 · Phase: card k shows arg Fₖ over the same z-window',
  'Cards are cumulative in every view (users-4): card k is <i>F</i>ₖ = <i>f</i>ₖ ∘ … ∘ <i>f</i>₁ over the main plane’s window, so the last card equals the main picture and you see arg <i>F</i> being built step by step. No letters on the cards (design-7).',
  lambda T: base('phase', '{T}/stage-phase', 'phase of <i>F</i>', '2 / div', chainbar('phase'), tools(), legend=True)))
S.append(('land', '7 · Landscape: card k is the relief of log|Fₖ|',
  'Same window and camera as the main view, no axes and no labels (design-7, users-24).',
  lambda T: base('land', '{T}/stage-land', 'landscape of |<i>F</i>|', '', chainbar('land'), tools(), sphere=False, hint='Drag to orbit, pinch to zoom')))
S.append(('guar', '8 · The F tile: the formula of F and its guarantees',
  'One home for <i>F</i> on both platforms (design-3): the tile at the end of the chain opens the expanded <i>F</i>(<i>z</i>) with the <i>w</i>ₖ list and Copy LaTeX, then the guarantees in one line each: the lit names (no “1 of 8”, design-21), what is not implied, the natural domain, and Step by step folded.',
  lambda T: status() + header('xy') + sbs(T, marks=False) + sheet(403, chainbar('xy', sel='F', shift=372) + '<div class="sbody">' + ed_F() + '</div>', cls='insp') + home()))
S.append(('nums', '9 · Numbers: a shared number drives the picture (new)',
  'The Numbers chip opens the shared numbers; the planes stay live above (users-15). <i>a</i> drives Line 1, Im <i>z</i> = <i>a</i>: drag the slider and both X and Y move. Rows are 44 px; the name, the value, Play and ⋯ on one line, the slider under it.',
  lambda T: status() + header('xy') + sbs(T, marks=False) + sheet(403, chainbar('xy', sel='N', shift=0) + '<div class="sbody">' + ed_nums() + '</div>', cls='insp') + home()))
S.append(('construct', '10 · Circle through 3 points, point 2 of 3 (new)',
  'Pick the tool, tap the points in order. The finger is on <i>z</i>₀, so it snaps (the ring, “on <i>z</i>₀”) and the circle will follow <i>z</i>₀. The chip says which point comes next and cancels. The More key shows the active tool. The circle is made as the disc whatever the order of the taps (design-15).',
  lambda T: base('xy', '{T}/stage-x', '<i>z</i>', '2 / div', chainbar('xy'), tools('circle3'), extra=ph_chip_construct())))
S.append(('tools', '11 · More tools: one tool set on phone and desktop',
  'Circle (3 points) and Intersect join the grid; Midpoint, Bisector and Point on curve follow in the same tile style (design-14, users-16). There is no separate “line through 2 points”: the Line tool snaps to points.',
  lambda T: base('xy', '{T}/stage-x', '<i>z</i>', '2 / div', '', '', sheet_html=sheet(250, tools_sheet(), cls='sht'))))
S.append(('display', '12 · Display, over a step shown alone',
  'Slider rows are 44 px with the name left and the value right; pattern names wrap to two lines (design-19). The plane behind shows f₃ alone: the title chip says so and its × returns to the whole chain in one tap (design-23).',
  lambda T: base('xy', '{T}/stage-zp-x', '<i>w</i><sub>2</sub>', '0.5 / div', '', '', alone=fsub(3), sheet_html=sheet(352, display_sheet(), cls='disp'))))
S.append(('more', '13 · More (⋯)',
  'Unchanged: Sound, Theme and Language set right here; Examples, Export, LaTeX, Search, Tour, Reference.',
  lambda T: base('xy', '{T}/stage-x', '<i>z</i>', '2 / div', chainbar('xy'), tools(), inset='{T}/inset-y', inset_lbl='Y', scrim=True,
                 sheet_html=sheet(318, more_sheet(), cls='shm'))))
S.append(('ru360', '14 · 360 px in Russian',
  'No abbreviations: tool labels may take two lines with soft hyphens («Много-угольник», design-20); card names wrap and never run into the arrow; the F tile is the letter and its lamp; the scale chip says «/ дел.» (users-25).',
  lambda T: base('xy', '{T}/stage-x', '<i>z</i>', '2 / дел.', chainbar('xy', L=RU), tools(L=RU), inset='{T}/inset-y', inset_lbl='Y', L=RU)))

CSS += r"""
/* ===== revision 2 ===== */
.mth { display: inline; white-space: nowrap; }
.mth sub { font-size: 0.7em; vertical-align: -0.25em; line-height: 0; }
.mth sup { font-size: 0.7em; vertical-align: 0.5em; line-height: 0; }
.ph-top { padding: 0 4px 0 8px; gap: 4px; flex-basis: 56px; }
.ph-seg { height: 50px; padding: 2px; margin: 0; }
.ph-ib.sm { width: 44px; height: 44px; flex-basis: 44px; }
.ph-seg > button { flex: 1 1 0; font-size: 13.5px; display: flex; align-items: center; justify-content: center; }
.ph-seg > button i { font: italic 500 16px/1 var(--f-math); }
.ph-seg .marr { margin: 0 3px; }
.ov-title { gap: 8px; height: 32px; }
.ov-title.alone { padding-right: 0; height: 46px; }
.ov-title .al { font: var(--t-label); font-style: normal; color: var(--accent); }
.ov-title .al .mth { font: italic 500 14px/1 var(--f-math); }
.ov-title .alx { width: 44px; height: 44px; display: grid; place-items: center; color: var(--ink-2); border-left: 1px solid var(--line) !important; }
.ov-title.sm { left: 18px; top: 6px; height: 28px; font-size: 14px; padding: 0 8px; }
.ph-sbs { position: relative; flex: 0 0 300px; display: grid; grid-template-columns: 1fr 1fr; gap: 0; background: var(--plane); }
.ph-sbs .sb1 { position: relative; overflow: hidden; }
.ph-sbs .sb1 + .sb1 { border-left: 1px solid var(--line-strong); }
.ph-sbs img.plimg { position: absolute; inset: 0; width: 100%; height: 100%; }
.zmk { position: absolute; width: 0; height: 0; z-index: 3; }
.zm.z { position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 2px var(--plane), 0 0 0 3px var(--ink); }
.zm.p::before, .zm.p::after { content: ""; position: absolute; left: -7px; top: -1.2px; width: 14px; height: 2.4px; border-radius: 1px; background: var(--pole); rotate: 45deg; }
.zm.p::after { rotate: -45deg; }
.zl { position: absolute; left: 8px; top: -20px; font: italic 500 13px/1 var(--f-math); color: var(--ink); text-shadow: 0 0 3px var(--plane), 0 0 3px var(--plane); white-space: nowrap; }
.zl sub { font-size: 9px; }
/* chain bar */
.chip2 .ix { gap: 4px; }
.chip2.nums { width: auto; min-width: 48px; padding: 0 10px; display: inline-flex; flex-direction: column; gap: 2px; justify-content: center; align-items: center; }
.numa { font: italic 500 16px/1 var(--f-math); color: var(--ink); }
.chip2.nums .nn { font: italic 500 11px/1 var(--f-math); color: var(--muted); letter-spacing: .04em; }
.chip2.nums .nn i + i::before { content: ", "; font-style: normal; }
.chip2.fchip { width: 48px; padding: 0; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.chip2.fchip .fF i { font: italic 500 19px/1 var(--f-math); color: var(--ink); }
.chip2.fchip .gd { margin: 0; }
.chip2.sel.play-off { box-shadow: 0 0 0 2px var(--line-strong); }
.chip2.play { box-shadow: 0 0 0 2px var(--accent); border-color: var(--accent) !important; }
.chip2 .nm2 { max-width: 76px; overflow-wrap: normal; word-break: normal; }
.dfm { width: 64px; height: 52px; flex-direction: column; gap: 2px; display: flex; align-items: center; justify-content: center; }
.dfm span { font: 500 10.5px/11px var(--f-ui); font-stretch: semi-condensed; text-align: center; hyphens: manual; max-width: 60px; }
/* tool row: six keys */
.ph-tools.six { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.tk { height: 52px; }
.tk span { white-space: normal; text-align: center; line-height: 11px; font-size: 10.5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tk.undo { color: var(--ink); }
.tb.sp { height: 44px; width: 44px; flex-basis: 44px; }
/* sheets */
.ph-ib { width: 44px; height: 44px; flex: 0 0 44px; }
.ih { height: 52px; gap: 4px; }
.ih .ix .mth { font: italic 500 17px/1 var(--f-math); }
.prow { height: 56px; gap: 4px; }
.pin { height: 44px; }
.rows { margin-top: 4px; }
.zbtn2 { margin-top: 2px; }
.fmF { padding: 8px 10px; margin-bottom: 8px; border-radius: var(--r-3); background: var(--well); font: italic 500 16px/1.3 var(--f-math); color: var(--ink); }
.fmF .wl { display: flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 14px; color: var(--ink-2); }
.fmF .wl .sp { width: 18px; }
.gsec .gon { margin: 6px 0 4px; }
.gsec .goff { font: var(--t-label); color: var(--muted); margin-bottom: 6px; }
.nrow { padding: 4px 0 6px; border-bottom: 1px solid var(--line); }
.nrow .l1 { display: flex; align-items: center; gap: 6px; height: 48px; }
.nrow .plab { width: 22px; font: italic 500 17px/1 var(--f-math); color: var(--ink); }
.nrow .eq { font: var(--t-math-s); color: var(--ink-2); }
.nrow .pin { flex: 1 1 auto; }
.nrow .l2 { display: grid; grid-template-columns: 26px 1fr 26px; gap: 10px; align-items: center; height: 44px; }
.nrow .lim { font: var(--t-micro); color: var(--muted); text-align: center; }
.nrow .tr, .sl2 .tr { position: relative; height: 4px; border-radius: 2px; background: var(--line-strong); }
.nrow .tr b, .sl2 .tr b { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; background: var(--accent); }
.nrow .tr i, .sl2 .tr i { position: absolute; top: 50%; width: 26px; height: 26px; translate: -50% -50%; border-radius: 50%; background: var(--surface); border: 1px solid var(--line-strong); box-shadow: var(--shadow-1); }
.nrow .used { font: var(--t-label); color: var(--muted); }
.addn { display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 4px !important; font: var(--t-body) !important; color: var(--ink-2) !important; }
/* the long-press menu: two-line head, 44 px rows */
.ph-menu { width: 252px; }
.ph-menu .mh { height: auto; flex-direction: column; align-items: flex-start; gap: 4px; padding: 8px 10px; font-size: 14px; color: var(--ink); }
.ph-menu .mh .mh2 { color: var(--ink-2); font-size: 13px; }
.mi2 { min-height: 44px; height: auto; padding: 6px 10px !important; }
.mi2 small { display: block; font: var(--t-label); color: var(--muted); margin-top: 1px; }
.mi2:first-of-type { background: var(--well) !important; }
/* tools sheet */
.tt { height: 60px; }
.tt span { text-align: center; line-height: 12px; padding: 0 2px; }
.tt.new::after { content: ""; position: absolute; }
.pill { height: 44px; }
/* display sheet */
.pats2 { --pat: url(PATIMG); display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px 4px; padding: 0 12px; }
.pt { display: flex; flex-direction: column; align-items: center; gap: 4px; min-height: 64px; padding: 2px 0 !important; border-radius: var(--r-3) !important; }
.pt .pi { width: 52px; height: 40px; border-radius: var(--r-2); background-size: 332px 187px; border: 1px solid var(--line); }
.pt.on .pi { outline: 2px solid var(--ink); outline-offset: 1px; }
.pt .pn { font: 500 10.5px/11px var(--f-ui); font-stretch: semi-condensed; color: var(--ink-2); text-align: center; max-width: 64px; }
.sl2 { display: grid; grid-template-rows: 22px 22px; padding: 0 16px; margin-top: 4px; }
.sl2 .t { display: flex; justify-content: space-between; font: var(--t-body); color: var(--ink); }
.sl2 .t .mono { font: var(--t-readout); color: var(--ink-2); }
.sl2 .tr { align-self: center; }
/* overlays in the picture's own coordinates (390 x 595, centred like object-fit: cover) */
.ovl { position: absolute; left: 0; top: 50%; width: 390px; height: 595px; translate: 0 -50%; z-index: 20; pointer-events: none; }
.ovl > * { pointer-events: auto; }
/* construction in progress */
.cons { position: absolute; left: 0; top: 0; z-index: 4; overflow: visible; pointer-events: none; }
.cons .prev { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 6 5; fill: none; }
.cons .pt { fill: var(--ink); stroke: var(--plane); stroke-width: 2; }
.cons .snap { fill: color-mix(in srgb, var(--accent) 16%, transparent); stroke: var(--accent); stroke-width: 2; }
.plab2 { position: absolute; z-index: 5; font: italic 500 15px/1 var(--f-math); color: var(--ink); text-shadow: 0 0 3px var(--plane), 0 0 3px var(--plane); }
.snapl { position: absolute; z-index: 5; padding: 3px 7px; border-radius: var(--r-2); background: var(--accent); color: var(--accent-ink); font: var(--t-label); }
.snapl .mth { font: italic 500 13px/1 var(--f-math); }
.pick-chip { position: absolute; left: 50%; top: 52px; translate: -50% 0; z-index: 6; display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 0 0 12px; border-radius: var(--r-4); background: var(--inverse); color: var(--inverse-ink); font: var(--t-label); white-space: nowrap; box-shadow: var(--shadow-3); }
.pick-chip .alx { width: 44px; height: 44px; display: grid; place-items: center; color: inherit; }
"""
_build0 = build
def build():
    global CSS
    import base64 as _b
    pat = 'data:image/png;base64,' + _b.b64encode((phone / 'img' / 'light' / 'patterns.png').read_bytes()).decode()
    CSS = CSS.replace('PATIMG', pat)
    _build0()

build()
