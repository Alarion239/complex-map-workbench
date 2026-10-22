# Builds notes/ui-design/mockup-*.html. Run: python3 notes/ui-design/mockup-src/build_mockups.py <project root>
import pathlib, sys
proj = pathlib.Path(sys.argv[1])
here = pathlib.Path(__file__).parent
out = proj / 'notes' / 'ui-design'
lines = (proj / 'src' / 'page.html').read_text().split('\n')
app_css = '\n'.join(lines[6:1302])          # tokens, base, frame and components (no breakpoints: the mockup is a desktop frame)
render_js = (here / 'render.js').read_text()

MOCK_CSS = r"""
/* ---------- mockup frame (not app CSS) ---------- */
html, body { height: auto; }
body { min-width: 1280px; }
.mock-bar { position: sticky; top: 0; z-index: 60; display: flex; align-items: center; gap: 16px; padding: 8px 16px; background: var(--inverse); color: var(--inverse-ink); font: var(--t-label); }
.mock-bar b { font: var(--t-heading); }
.mock-bar .sp { flex: 1 1 auto; }
.mock-bar a, .mock-bar button { color: inherit; opacity: .85; text-decoration: none; border: 1px solid currentColor; border-radius: var(--r-2); padding: 2px 8px; font: var(--t-label); }
.mock-bar a.cur { opacity: 1; background: color-mix(in srgb, var(--inverse-ink) 18%, transparent); }
#app { height: 860px; }
.layout.hide-right { --rw: 36px; }
.layout.hide-right > .panel.right > .rail { display: flex; }
/* ---------- NEW: the view control. Surface radios in a well (both panes); Phase is a separate toggle on X only (P1, B1) ---------- */
.vgrp { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.phbtn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; background: var(--panel); border: 1px solid var(--line-strong); border-radius: var(--r-2);
  font: var(--t-label); color: var(--muted); white-space: nowrap; }
.phbtn:hover { color: var(--ink); }
.phbtn[aria-pressed="true"] { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
.phbtn svg { width: 14px; height: 14px; flex: 0 0 14px; display: block; }
@container pane (max-width: 519px) { .phbtn > span { display: none; } .phbtn { padding: 0 7px; } }
.tool[aria-disabled="true"] { opacity: .38; }
.vctl { position: relative; display: inline-flex; align-items: stretch; flex: 0 0 auto; height: 28px; padding: 2px; gap: 0;
  background: var(--well); border: 1px solid var(--line); border-radius: var(--r-2); }
.vctl .vseg { display: inline-flex; align-items: stretch; }
.vctl button { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border: 1px solid transparent; border-radius: var(--r-1);
  font: var(--t-label); color: var(--muted); white-space: nowrap; transition: color var(--t-fast) var(--ease-out); }
.vctl button:hover { color: var(--ink); }
.vctl button.on, .vctl button[aria-pressed="true"] { color: var(--ink); background: var(--seg-on); border-color: var(--line-strong); }
.vctl .vdiv { flex: 0 0 1px; width: 1px; margin: 3px 3px; background: var(--line-strong); }
.vctl svg { width: 14px; height: 14px; flex: 0 0 14px; display: block; }
@container pane (max-width: 519px) { .vctl button > span { display: none; } .vctl button { padding: 0 7px; } }
.pane-head.v2 { padding: 0 6px 0 2px; gap: 4px; }
.pane-head.v2 .pane-title { margin-left: 6px; flex-shrink: 1000; }
.pane-head .icon-btn svg { width: 16px; height: 16px; }
/* the Draw heading carries Snap and Unit circle */
.panel h2 .icon-btn.small { width: 24px; height: 24px; margin: -2px 0; }
/* ---------- annotation pins ---------- */
.pin { position: absolute; z-index: 40; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%;
  background: var(--accent); color: var(--accent-ink); font: 600 11px/1 var(--f-ui); box-shadow: 0 0 0 2px var(--panel); pointer-events: none; }
.rel { position: relative; }
.notes { max-width: 1180px; margin: 20px auto 32px; padding: 0 16px; font: var(--t-body); color: var(--ink-2); }
.notes h2 { font: var(--t-title); color: var(--ink); margin: 8px 0 10px; }
.notes h3 { font: var(--t-heading); color: var(--ink); margin: 18px 0 6px; }
.notes ol { padding-left: 0; list-style: none; display: grid; gap: 6px; counter-reset: n; }
.notes ol > li { counter-increment: n; display: grid; grid-template-columns: 26px minmax(0, 1fr); align-items: start; }
.notes ol > li::before { content: counter(n); display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font: 600 11px/1 var(--f-ui); margin-top: 1px; }
.notes i { font: var(--t-math-s); }
.notes p { margin: 6px 0; max-width: 900px; text-wrap: pretty; }
.spec-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin-top: 8px; }
.spec { background: var(--panel); border: 1px solid var(--line-strong); border-radius: var(--r-3); overflow: hidden; container: pane / inline-size; }
.spec .pane-head { height: 32px; border-bottom: 1px solid var(--line); }
.spec .cap { padding: 6px 10px 8px; font: var(--t-label); color: var(--muted); }
.spec.narrow { width: 430px; }
.chip-demo { display: inline-flex; align-items: center; gap: 10px; height: 32px; padding: 0 10px; background: var(--overlay); border: 1px solid var(--line-strong); box-shadow: var(--shadow-1); border-radius: var(--r-2); font: var(--t-body); color: var(--ink-2); }
.sidebar-demo { width: 252px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-3); }
.tagline { font: var(--t-caption); color: var(--muted); text-transform: none; margin: 0 0 4px; }
.draw-chip { position: absolute; z-index: 10; top: 40px; left: 50%; translate: -50% 0; display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 10px;
  background: var(--overlay); border: 1px solid var(--line-strong); box-shadow: var(--shadow-1); border-radius: var(--r-2); font: var(--t-body); color: var(--ink-2); white-space: nowrap; }
.draw-chip i { font: var(--t-math-s); color: var(--ink); }
"""

ICONS_JS = r"""
const msvg = (inner) => `<svg class="mic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const svgI = (inner, fill) => `<svg class="ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const tsvg = (inner) => `<svg class="tic" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const grip = (x, y) => `<rect x="${x - 1.75}" y="${y - 1.75}" width="3.5" height="3.5" fill="currentColor" stroke="none"/>`;
const AREA = 'fill="currentColor" fill-opacity=".16"';
const plusC = (x, y) => `<path d="M${x - 2.5} ${y}h5M${x} ${y - 2.5}v5" stroke-width="1"/>`;
const IC = {
  plane: msvg('<rect x="2" y="2" width="12" height="12" rx="1"/><rect x="2" y="2" width="6" height="6" fill="currentColor" fill-opacity=".35" stroke="none"/><rect x="8" y="8" width="6" height="6" fill="currentColor" fill-opacity=".35" stroke="none"/>'),
  phase: msvg('<circle cx="8" cy="8" r="5.5"/><path d="M8 8h5.5M8 8l-2.75 4.76M8 8l-2.75-4.76"/>'),
  land: msvg('<path d="M1.5 12.5c2.5 0 3.5-6 6.5-6s4 6 6.5 6"/><path d="M1.5 14h13"/>'),
  sphere: msvg('<circle cx="8" cy="8" r="6"/><path d="M2 8a6 2.2 0 0 0 12 0"/><ellipse cx="8" cy="8" rx="2.4" ry="6"/>'),
  morph: msvg('<rect x="1.5" y="6" width="4" height="4"/><path d="M6.5 6.5c2-3 4.5-3 6 0"/><path d="M11.5 4.5l1 2-2.2.3"/><circle cx="12.5" cy="10.5" r="2" fill="currentColor" stroke="none"/>'),
  plus: svgI('<path d="M8 3.5v9M3.5 8h9"/>'), minus: svgI('<path d="M3.5 8h9"/>'),
  fit: svgI('<path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/><circle cx="8" cy="8" r="1.75"/>'),
  expand: svgI('<path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9"/>'),
  orbit: svgI('<path d="M2.75 8A5.25 5.25 0 1 0 8 2.75a5.7 5.7 0 0 0-3.95 1.65L2.75 5.7"/><path d="M2.75 2.75v2.95H5.7"/>'),
  snap: svgI('<path d="M4 2.5v5.5a4 4 0 0 0 8 0V2.5M4 5h2.5M9.5 5H12"/>'),
  unit: svgI('<circle cx="8" cy="8" r="5.5" stroke-dasharray="2 2"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/>'),
  chevL: svgI('<path d="M10 3.5L5.5 8l4.5 4.5"/>'), chevD: svgI('<path d="M3.5 6l4.5 4.5L12.5 6"/>'), chevR: svgI('<path d="M6 3.5L10.5 8 6 12.5"/>'),
  eye: svgI('<path d="M1.75 8s2.3-4.25 6.25-4.25S14.25 8 14.25 8s-2.3 4.25-6.25 4.25S1.75 8 1.75 8z"/><circle cx="8" cy="8" r="2"/>'),
  more: svgI('<circle cx="3.5" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12.5" cy="8" r="1.1"/>', true),
  undo: svgI('<path d="M5.5 3.5l-3 3 3 3M2.5 6.5h7a3.5 3.5 0 0 1 0 7H6"/>'), redo: svgI('<path d="M10.5 3.5l3 3-3 3M13.5 6.5h-7a3.5 3.5 0 0 0 0 7H10"/>'),
  search: svgI('<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25l3.25 3.25"/>'),
  panelL: svgI('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 2.5v11"/>'), panelR: svgI('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M10 2.5v11"/>'),
  download: svgI('<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>'),
  theme: svgI('<circle cx="8" cy="8" r="5.75"/><path d="M8 2.25a5.75 5.75 0 0 1 0 11.5z" fill="currentColor" stroke="none"/>'),
  help: svgI('<circle cx="8" cy="8" r="6"/><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.4"/><circle cx="8" cy="11.6" r=".8" fill="currentColor" stroke="none"/>'),
  sliders: svgI('<path d="M2.5 5h11M2.5 11h11"/><circle cx="6" cy="5" r="1.75" fill="var(--surface)"/><circle cx="10" cy="11" r="1.75" fill="var(--surface)"/>'),
  close: svgI('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
  grip: svgI('<circle cx="6" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/>', true),
  t_select: tsvg('<path d="M5.5 3.5V15l3.1-2.9 2.1 4.5 1.9-.8-2.1-4.5h4.1z"/>'),
  t_point: tsvg('<circle cx="10" cy="10" r="2.25" fill="currentColor" stroke="none"/><path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2"/>'),
  t_segment: tsvg('<path d="M5 15L15 5"/>' + grip(5, 15) + grip(15, 5)),
  t_line: tsvg('<path d="M1 17.9L19 2.1"/>' + grip(7, 12.6) + grip(13, 7.4)),
  t_ray: tsvg('<path d="M5 15L19 2.7"/>' + grip(5, 15)),
  t_circle: tsvg('<circle cx="10" cy="10" r="6.5"/>' + plusC(10, 10)),
  t_arc: tsvg('<path d="M3.5 14.5A7.5 7.5 0 0 1 16.5 14.5"/>' + grip(3.5, 14.5) + grip(16.5, 14.5) + grip(10, 7)),
  t_curve: tsvg('<path d="M3 14c2.2-4.8 4.2-.4 6.2-3.6S13 5.6 17 7.5"/>'),
  t_disc: tsvg(`<circle cx="10" cy="10" r="6.5" ${AREA}/>`),
  t_rect: tsvg(`<rect x="3.5" y="5.5" width="13" height="9" rx=".5" ${AREA}/>` + grip(3.5, 5.5) + grip(16.5, 14.5)),
  t_polygon: tsvg(`<path d="M4 14.5L6.5 5 14 4.5l2.5 7L10 16z" ${AREA}/>` + grip(4, 14.5) + grip(6.5, 5) + grip(14, 4.5) + grip(16.5, 11.5) + grip(10, 16)),
  t_lasso: tsvg(`<path d="M5.2 12.8C3 9.6 5 4.8 9.6 4.5s7.4 2.6 6.4 6.2-5.6 4.9-8.6 4.3c-1-.2-1.7-1-2.2-2.2z" ${AREA}/><path d="M5 13l-1.5 3.5"/>`),
  t_halfplane: tsvg('<rect x="0" y="0" width="20" height="10.5" fill="currentColor" fill-opacity=".16" stroke="none"/><path d="M0 10.5h20M14.5 8.5l2 2-2 2"/>'),
  t_annulus: tsvg(`<path fill-rule="evenodd" d="M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14zm0 3.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 1 0 0-6.5z" ${AREA}/>`),
  t_sector: tsvg(`<path d="M4 16h13A13 13 0 0 0 13.2 6.8z" ${AREA}/>` + grip(4, 16)),
  t_formula: tsvg('<text x="3" y="15" font-family="STIX Two Text, serif" font-style="italic" font-size="14" fill="currentColor" stroke="none">f</text><path d="M12 7h5M12 11h5"/>'),
  t_cgrid: tsvg('<path stroke-width="1" d="M4 4v12M8 4v12M12 4v12M16 4v12M4 4h12M4 8h12M4 12h12M4 16h12"/>'),
  t_pgrid: tsvg('<g stroke-width="1"><circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5v13M3.5 10h13M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2"/></g>'),
};
function fillIcons() { document.querySelectorAll('[data-ic]').forEach((el) => { if (!el.dataset.done) { el.insertAdjacentHTML('afterbegin', IC[el.dataset.ic] || ''); el.dataset.done = 1; } }); }
function inkSwatches() {
  document.querySelectorAll('[data-ci]').forEach((el) => { const c = el.dataset.ci; el.style.setProperty('--c0', MK.css(`--c${c}`)); el.style.setProperty('--c1', MK.css(`--c${c}-alt`)); el.style.setProperty('--k', MK.css(`--c${c}-edge`)); });
}
// pattern swatches (Display): small static drawings in the first shape colour
function patternSwatches() {
  document.querySelectorAll('canvas[data-pat]').forEach((cv) => {
    const dpr = 2, W = 52, H = 40; cv.width = W * dpr; cv.height = H * dpr;
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c0 = MK.css('--c1'), c1 = MK.css('--c1-alt'), e = MK.css('--c1-edge'), pl = MK.css('--plane');
    x.fillStyle = pl; x.fillRect(0, 0, W, H);
    const id = cv.dataset.pat;
    if (id === 'checker') { for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) { x.fillStyle = (i + j) % 2 ? c1 : c0; x.fillRect(i * 8, j * 8, 8, 8); } }
    else if (id === 'polar') { for (let r = 0; r < 6; r++) for (let a = 0; a < 16; a++) { x.fillStyle = (r + a) % 2 ? c1 : c0; x.beginPath(); x.moveTo(26, 20); x.arc(26, 20, 40 * Math.pow(0.62, r), a * Math.PI / 8, (a + 1) * Math.PI / 8); x.fill(); } }
    else if (id === 'tiles') { for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { x.fillStyle = (i + j) % 2 ? c1 : c0; x.fillRect(i * 14, j * 14, 14, 14); x.fillStyle = e; x.font = 'italic 600 11px serif'; x.fillText('F', i * 14 + 4, j * 14 + 11); } }
    else if (id === 'grid') { x.fillStyle = c1; x.fillRect(0, 0, W, H); x.strokeStyle = e; x.lineWidth = 1; for (let i = 0; i <= 52; i += 8) { x.beginPath(); x.moveTo(i + .5, 0); x.lineTo(i + .5, H); x.stroke(); } for (let j = 0; j <= 40; j += 8) { x.beginPath(); x.moveTo(0, j + .5); x.lineTo(W, j + .5); x.stroke(); } }
    else if (id === 'polargrid') { x.fillStyle = c1; x.fillRect(0, 0, W, H); x.strokeStyle = e; for (let r = 5; r < 40; r += 7) { x.beginPath(); x.arc(26, 20, r, 0, 7); x.stroke(); } for (let a = 0; a < 12; a++) { x.beginPath(); x.moveTo(26, 20); x.lineTo(26 + 40 * Math.cos(a * Math.PI / 6), 20 + 40 * Math.sin(a * Math.PI / 6)); x.stroke(); } }
    else if (id === 'phase') { const g = x.createConicGradient ? x.createConicGradient(0, 26, 20) : null; if (g) { ['#F58C7E', '#CFA93E', '#6EC580', '#1CC3D8', '#8EAAFD', '#DB8FD6', '#F58C7E'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c)); x.fillStyle = g; x.fillRect(0, 0, W, H); } }
    else if (id === 'stretch') { const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, MK.css('--stretch-shrink')); g.addColorStop(.5, MK.css('--stretch-mid')); g.addColorStop(1, MK.css('--stretch-grow')); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    else if (id === 'solid') { x.fillStyle = c0; x.fillRect(0, 0, W, H); }
    else if (id === 'sphere') { x.fillStyle = c1; x.fillRect(0, 0, W, H); for (let b = 0; b < 4; b++) for (let a = 0; a < 16; a++) { if ((a + b) % 2) continue; x.fillStyle = c0; x.beginPath(); const r0 = 6 + b * 7, r1 = r0 + 7 + b * 2; x.arc(26, 34, r1, Math.PI + a * Math.PI / 16, Math.PI + (a + 1) * Math.PI / 16); x.arc(26, 34, r0, Math.PI + (a + 1) * Math.PI / 16, Math.PI + a * Math.PI / 16, true); x.fill(); } }
  });
}
function themeCycle() { const r = document.documentElement, t = r.getAttribute('data-theme'); r.setAttribute('data-theme', t === 'dark' ? 'light' : 'dark'); setTimeout(redraw, 30); }
let redrawT = 0;
function redraw() { inkSwatches(); patternSwatches(); if (typeof draw === 'function') draw(); }
window.addEventListener('resize', () => { clearTimeout(redrawT); redrawT = setTimeout(redraw, 200); });
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fillIcons(); redraw(); });
fillIcons();
"""

def vctl(side, surf, phase, pins=None):
    btns = [('plane', 'Plane', '1'), ('sphere', 'Sphere', '2')] + ([('land', 'Landscape', '3')] if side == 'X' else [])
    sh = '' if side == 'X' else '⇧'
    h = f'<div class="vgrp"><div class="vctl" role="radiogroup" aria-label="{"Left" if side == "X" else "Right"} pane surface"><div class="vseg">'
    for k, lab, key in btns:
        on = k == surf
        h += f'<button role="radio" aria-checked="{str(on).lower()}" class="{"on" if on else ""}" title="{lab}  {sh}{key}" data-ic="{k}"><span>{lab}</span></button>'
    h += '</div>' + (pins or '') + '</div>'
    if side == 'X':
        h += f'<button class="phbtn" aria-pressed="{str(phase).lower()}" title="Phase colouring of F  4" data-ic="phase"><span>Phase</span></button>'
    return h + '</div>'

def head(side, surf, phase, title, role, actions='', pins=''):
    return (f'<div class="pane-head v2 rel">{vctl(side, surf, phase)}{pins}'
            f'<div class="pane-title"><span class="ptitle">{title}</span><span class="prole">{role}</span></div>'
            f'<div class="grow"></div>{actions}<span class="led" title="Up to date"></span></div>')

def viewstack(fit=True):
    return ('<div class="viewstack"><div class="vgroup"><button class="vbtn" data-ic="plus"></button><button class="vbtn" data-ic="minus"></button></div>'
            f'<div class="vgroup">{"<button class=vbtn data-ic=fit></button>" if fit else ""}<button class="vbtn" data-ic="expand"></button></div></div>')

def pane(pid, headhtml, plot_inner, var='z', rulers=True, extra_cls=''):
    cls = 'pane' + ('' if rulers else ' no-rulers') + (' ' + extra_cls if extra_cls else '')
    return (f'<div class="{cls}" id="{pid}">{headhtml}<div class="pane-body">'
            f'<canvas class="ruler ruler-y" id="{pid}RY"></canvas><div class="plot rel">'
            f'<canvas id="{pid}C"></canvas>{plot_inner}</div>'
            f'<div class="ruler-corner">{var}</div><canvas class="ruler ruler-x" id="{pid}RX"></canvas></div></div>')

TOOLS = [('select', 'Select', 'V'), ('point', 'Point', 'P'), ('segment', 'Segment', 'S'), ('line', 'Line', 'L'), ('ray', 'Ray', 'R'), ('circle', 'Circle', 'C'), ('arc', 'Arc', 'A'), ('curve', 'Freehand', 'F'), ('disc', 'Disc', 'D'), ('rect', 'Rectangle', 'B'), ('polygon', 'Polygon', 'G'), ('lasso', 'Lasso', 'O'), ('halfplane', 'Half-plane', 'H'), ('annulus', 'Annulus', 'N'), ('sector', 'Sector', 'K'), ('formula', 'Formula', 'T'), ('cgrid', 'Grid', ''), ('pgrid', 'Polar grid', '')]
DESC = {'select': 'Drag a shape to move it and its handles to reshape. Drag empty space to pan.', 'disc': 'Drag from the centre outward. On a sphere: a cap; through ∞ a half-plane.', 'circle': 'Drag from the centre outward. On a sphere: through ∞ it becomes a line.'}

def shape_row(ci, kind, name, d, sel=False, swkind=None):
    sk = f' data-kind="{swkind}"' if swkind else ''
    return (f'<div class="shape{" sel" if sel else ""}"><div class="shape-row"><span class="swatch" data-ci="{ci}"{sk}></span>'
            f'<span class="shape-name"><span class="k">{name}</span><span class="d"><span class="tex-fallback">{d}</span></span></span>'
            f'<button class="icon-btn eye" data-ic="eye"></button><button class="icon-btn" data-ic="more"></button></div></div>')

def sidebar(tool='select', formula_val='', formula_tag='', shapes_html='', targets_html='', pins=None, wlabel='<i>w</i>', disabled=()):
    p = pins or {}
    tools = ''.join(f'<button class="tool{" on" if t == tool else ""}" aria-pressed="{str(t == tool).lower()}"{" aria-disabled=true" if t in disabled else ""} title="{l}{"  " + k if k else ""} · {"Draw in Plane" if t in disabled else DESC.get(t, "")}" data-ic="t_{t}"><span>{l}</span></button>' for t, l, k in TOOLS)
    prev = (f'<div class="texprev" style="justify-content:space-between;gap:8px"><span class="tex-fallback">{formula_val}</span><span class="btag">{formula_tag}</span></div>' if formula_val else '<div class="texprev"></div>')
    pats = ''.join(f'<button class="pat{" on" if v == "checker" else ""}" role="radio" title="{tip}"><canvas data-pat="{v}"></canvas><span>{l}</span></button>' for v, l, tip in [
        ('checker', 'Checker', 'Checkerboard in z-coordinates: shows how squares are bent and scaled'), ('polar', 'Log-polar', 'Checkerboard in log|z| and arg z'), ('tiles', 'Tiles', 'Tiles with an F glyph: shows rotation, scaling and reflection'), ('grid', 'Grid', 'Cartesian grid lines of z carried by the map'),
        ('polargrid', 'Polar grid', 'Circles and rays carried by the map'), ('phase', 'Arg z', 'Coloured by the argument of the source point z'), ('stretch', 'Stretch', 'Local scale factor |F′(z)|'), ('solid', 'Solid', 'Flat fill'), ('sphere', 'Sphere', 'Sphere checker (P3): longitude and latitude cells of the Riemann sphere; 128 cells cover the plane and ∞')])
    return f'''<aside class="panel left" aria-label="Region tools">
  <section class="psec rel">{p.get('draw', '')}
    <h2><span class="grow">Draw</span><button class="icon-btn small" aria-pressed="true" title="Snap while drawing (both panes and globes; also in the collapsed rail)" data-ic="snap"></button><button class="icon-btn" title="Hide this panel  [" data-ic="chevL"></button></h2>
    <div class="tools" role="toolbar">{tools}</div>
  </section>
  <details class="psec rel" open>{p.get('formula', '')}<summary><h2>Region from a formula</h2></summary><div class="psec-body">
    <div class="formula-row"><input class="inp math-src" placeholder="|z-1| < 2" value="{formula_val.replace('<i>', '').replace('</i>', '')}"><button class="btn primary">Add</button></div>{prev}
  </div></details>
  <details class="psec rel" open>{p.get('shapes', '')}<summary><h2><span class="grow">Shapes</span><button class="btn ghost small">Clear</button></h2></summary><div class="psec-body"><div class="shapes">
    <div class="shapes-sub" role="heading" aria-level="3" style="margin-top:0"><span><i>z</i>-plane</span></div>{shapes_html or '<div class="empty-note"><div>No shapes yet. Draw one in the <i>z</i>-plane.</div></div>'}
    <div class="shapes-sub" role="heading" aria-level="3"><span>{wlabel}-plane</span></div>{targets_html or f'<div class="empty-note"><div>No targets yet. Draw one in the {wlabel}-plane.</div></div>'}
  </div></div></details>
  <details class="psec rel" open>{p.get('display', '')}<summary><h2>Display</h2></summary><div class="psec-body field-col">
    <div class="lbl">Pattern carried by the map</div><div class="patterns" role="radiogroup">{pats}</div>
    <label class="fader-row"><span class="fl">Cell</span><input type="range" min="-2" max="2" value="0" style="--fill:50%"><span class="fval mono">×1</span></label>
    <label class="check"><input type="checkbox" checked><span>Unit circle</span></label>
    <label class="check"><input type="checkbox" checked><span>Grid lines on regions</span></label>
    <label class="check"><input type="checkbox"><span>Orientation chevrons</span></label>
    <label class="fader-row"><span class="fl">Opacity</span><input type="range" min="0.2" max="1" step="0.01" value="0.85" style="--fill:81%"><span class="fval mono">0.85</span></label>
  </div></details>
</aside>'''

TOP = '''<header class="top">
  <svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true" class="mark"><defs><clipPath id="mk"><rect x="2.25" y="2.25" width="23.5" height="23.5" rx="1.25"/></clipPath></defs><rect x="1.5" y="1.5" width="25" height="25" rx="2" fill="var(--plane)" stroke="var(--ink)" stroke-width="1.25"/><g clip-path="url(#mk)" fill="none" stroke-width="1.15" stroke-linecap="round"><g stroke="var(--ink)"><path d="M6.51 25.62Q27.83 14 6.51 2.38"/><path d="M15.78 25.62Q25.76 14 15.78 2.38"/><path d="M21.67 25.62Q27.93 14 21.67 2.38"/></g><g stroke="var(--accent)"><path d="M21.49 25.62Q0.17 14 21.49 2.38"/><path d="M12.22 25.62Q2.24 14 12.22 2.38"/><path d="M6.33 25.62Q0.07 14 6.33 2.38"/></g></g><circle cx="14" cy="14" r="1.4" fill="var(--ink)"/></svg>
  <h1 class="wordmark">Complex Map Workbench</h1><span class="hdiv"></span>
  <button class="icon-btn" id="undoBtn" data-ic="undo"></button><button class="icon-btn" id="redoBtn" data-ic="redo"></button>
  <div class="spacer"></div>
  <div class="hdr-menu"><button class="btn ghost menu-btn" id="examplesBtn"><span class="exlabel">Examples</span><span class="ic-slot" data-ic="chevD"></span></button>
  <button class="cmd-field" id="cmdBtn"><span class="ic-slot" data-ic="search"></span><span class="cmd-text">Add function or command</span><span class="kbd">⌘K</span></button>
  <button class="icon-btn" id="toggleLeft" aria-pressed="true" data-ic="panelL"></button><button class="icon-btn" id="toggleRight" aria-pressed="false" data-ic="panelR"></button>
  <button class="icon-btn" id="exportBtn" data-ic="download"></button><button class="icon-btn" id="themeBtn" onclick="themeCycle()" title="Theme" data-ic="theme"></button><button class="icon-btn" id="helpBtn" data-ic="help"></button></div>
</header>'''

RIGHT = '''<aside class="panel right" aria-label="Guarantees"><div class="rail"><button class="icon-btn rail-open" data-ic="chevL"></button><div class="rail-lamps"><span class="rl on"></span><span class="rl on"></span><span class="rl"></span><span class="rl on"></span></div><span class="rail-label">Guarantees</span></div></aside>'''

CHAIN = '''<div class="pipe-wrap"><div class="pipe-head"><h2>Function chain</h2><div class="compose"><span class="tex-fallback">F = f<sub>1</sub></span></div><div class="grow"></div>
<div class="seg small" role="radiogroup"><button role="radio">Cards</button><button class="on" role="radio" aria-checked="true">Compact</button></div><button class="btn small" aria-pressed="true">Whole chain</button><button class="btn ghost small">Clear chain</button></div>
<div class="pipeline compact"><div class="conn" style="--conn-y:28px"><div class="conn-var"><i>z</i></div><div class="conn-line"><svg viewBox="0 0 40 12"><path d="M2 6h34M32 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.25"/></svg></div></div>
<div class="card{focus}"><div class="card-head"><span class="grip" data-ic="grip"></span><span class="idx"><i>f</i><sub>1</sub></span><span class="nm">Möbius (Cayley)</span></div><div class="ftex-row"><div class="ftex"><span class="tex-fallback">w = (z − i)/(z + i)</span></div></div></div>
<div class="conn" style="--conn-y:28px"><div class="conn-var"><i>w</i></div><div class="conn-line"><svg viewBox="0 0 40 12"><path d="M2 6h34M32 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.25"/></svg></div></div>
<button class="add-card"><span data-ic="plus"></span><span>Add function</span></button></div></div>'''

def page(title, body, script, nav_cur):
    nav = ''.join(f'<a href="mockup-{n}.html" class="{"cur" if n == nav_cur else ""}">{lab}</a>' for n, lab in [('1-planes', '1 · Planes'), ('2-phase', '2 · Phase on X'), ('3-globe', '3 · Globes')])
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..700&family=B612+Mono:wght@400;700&family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap">
<style>
{app_css}
{MOCK_CSS}
</style></head><body>
<div class="mock-bar"><b>Panels mockup</b><span>X on the left, Y on the right · notes/ui-design/panels.md</span><span class="sp"></span>{nav}<button onclick="themeCycle()">Light / dark</button></div>
{body}
<script>
{render_js}
{ICONS_JS}
{script}
</script>
</body></html>
'''

SHAPES_JS = r"""
const SH = [
  { kind: 'disc', c: [0.6, 1.2], r: 0.7, ci: 1 },
  { kind: 'rect', a: [-2.1, 0.35], b: [-0.75, 1.35], ci: 2 },
  { kind: 'line', a: [-1, 0], b: [1, 0], ci: 4 },
  { kind: 'point', p: [1.55, 0.45], ci: 5 },
];
const TG = [{ kind: 'disc', c: [-0.35, -0.45], r: 0.22, ci: 6 }];
const VX = { cx: -0.2, cy: 0.75, s: 92 }, VY = { cx: 0, cy: -0.05, s: 128 };
const probeMark = (ctx, x, y) => { const arms = () => { ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x - 4, y); ctx.moveTo(x + 4, y); ctx.lineTo(x + 11, y); ctx.moveTo(x, y - 11); ctx.lineTo(x, y - 4); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 11); ctx.stroke(); }; ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = MK.css('--halo'); arms(); ctx.lineWidth = 1.25; ctx.strokeStyle = MK.css('--probe'); arms(); ctx.restore(); };
const probeX = (ctx, toS) => probeMark(ctx, ...toS(0.421, 1.2034));
const probeY = (ctx, toS) => { const w = MK.F(0.421, 1.2034); probeMark(ctx, ...toS(w[0], w[1])); };
function planePane(id, o) { const cv = document.getElementById(id + 'C'); MK.plane(cv, o); MK.ruler(document.getElementById(id + 'RX'), o.view, 'x'); MK.ruler(document.getElementById(id + 'RY'), o.view, 'y'); }
"""

ROWS1 = (shape_row(1, 'disc', 'Disc 1', '|z − 0.6 − 1.2i| &lt; 0.7', sel=True) + shape_row(2, 'rect', 'Rectangle 1', '−2.1 &lt; Re z &lt; −0.75, …') +
         shape_row(4, 'line', 'Line 1', 'Im z = 0', swkind='curve') + shape_row(5, 'point', 'a', '1.55 + 0.45i', swkind='point'))
TROWS = shape_row(6, 'disc', 'Target disc 1', '|w + 0.35 + 0.45i| &lt; 0.22')

def pin(n, style):
    return f'<span class="pin" style="{style}">{n}</span>'

def ipin(n):
    return f'<span class="pin" style="position:static;flex:0 0 18px;margin:0 2px">{n}</span>'

# ======================= mockup 1: default, planes =======================
legY = '<div class="legend-chip"><canvas style="width:136px;height:40px" id="legY"></canvas></div>'
m1_body = f'''<div id="app">{TOP}
<main class="layout hide-right">
{sidebar(tool='select', formula_val='|<i>w</i> + 0.35 + 0.45i| &lt; 0.22', formula_tag='w-plane', shapes_html=ROWS1, targets_html=TROWS,
         pins={'draw': pin(5, 'top:10px;left:60px'), 'formula': pin(6, 'top:10px;left:178px'), 'shapes': pin(7, 'top:10px;left:70px'), 'display': pin(8, 'top:10px;left:70px')})}
<section class="stage" style="--chain-h:112px">
  <div class="panes" style="--split:0.5">
    {pane('pL', head('X', 'plane', False, '<i>z</i>-plane', 'domain of <i>F</i>', pins=ipin(1)),
           '<div class="chip readout"><span class="rk"><i>z</i></span>  <span class="rv">0.4210 + 1.2034i</span>  <span class="rk">|z|</span> <span class="rv">1.2749</span></div>' + viewstack())}
    <div class="gutter gutter-col"></div>
    {pane('pR', head('Y', 'plane', False, '<i>w</i> = <i>F</i>(<i>z</i>)', 'image, after 1 step', actions=ipin(3) + '<button class="icon-btn small" aria-pressed="false" title="Deformation  M" data-ic="morph"></button>', pins=ipin(2)),
           '<div class="chip readout"><span class="rk"><i>w</i></span>  <span class="rv">0.1243 − 0.1673i</span>  <span class="rk">F′</span> <span class="rv">0.3974 ∠ −68.4°</span></div>'
           '<div class="options" style="max-width:calc(100% - 52px)"><label class="check"><input type="checkbox" checked><span>View outline</span></label></div>' + viewstack() + pin(4, 'left:150px;bottom:14px'), var='w')}
  </div>
  <div class="gutter gutter-row"></div>
  {CHAIN.replace('{focus}', '')}
</section>
{RIGHT}
</main></div>
<div class="notes">
<h2>Default: X Plane, Y Plane</h2>
<ol>
<li><div><b>One view control per pane, same place, same order.</b> Surface radios (Plane · Sphere · Landscape) in a well, then, 6px apart and outlined on its own, the <b>Phase</b> toggle (the phase portrait of <i>F</i>, a plot over X). The left pane is always X: the <i>z</i>-plane, with the shapes themselves. Keys 1, 2, 3 and 4.</div></li>
<li><div><b>The right pane is always Y</b> and has the same radios where they apply: Plane · Sphere (keys ⇧1, ⇧2). No Landscape and no Phase: both would be the same picture for every <i>F</i>. It shows the images: the disc and the rectangle, the real axis as the unit circle, <i>a</i>′, and the target in the <i>w</i>-plane (dashed, hatched); its preimage is hatched on the left.</div></li>
<li><div>Pane actions sit at the right of the head: the deformation button stays on Y. Snap and Unit circle left the X head (see 5 and 8).</div></li>
<li><div>Each pane has its own options strip. Y Plane: "View outline". X Plane has none, so its strip is hidden.</div></li>
<li><div><b>Item 3:</b> no hint line under the tools. Descriptions are in the tooltips (hover a tool; on touch, long-press it). Snap is in the Draw heading and in the collapsed rail, because it applies to drawing in both panes and on the globes.</div></li>
<li><div><b>Item 4:</b> no example chips. One Add button: the variable decides where the set goes. The preview names the plane (<i>w</i> here, so this adds a target).</div></li>
<li><div><b>Item 5:</b> shapes and targets are listed under "<i>z</i>-plane" and "<i>w</i>-plane", with empty notes of the same form (see mockup 3 for the empty case).</div></li>
<li><div><b>Item 6:</b> no description line under the pattern swatches; it is the swatch tooltip (long-press on touch). The pattern formerly called Phase is <b>Arg z</b>, so "Phase" names only the pane toggle. The Sphere checker (P3) is the ninth swatch. <b>Unit circle</b> moved here: it is a display setting for both planes.</div></li>
</ol>
<h3>The view control in every state</h3>
<div class="spec-grid" id="specs"></div>
<h3>Narrow panes (both panes at a 1440px window, about 430px each): icons only</h3>
<div class="spec-grid" id="specsNarrow" style="grid-template-columns: 430px 430px"></div>
<h3>A step in focus (f<sub>2</sub> of a 3-step chain): only the titles change</h3>
<div class="spec-grid" id="specsFocus"></div>
<p>Every picture on this page is an exact per-pixel render of the Cayley map <i>F</i>(<i>z</i>) = (<i>z</i> − i)/(<i>z</i> + i) (the left plane at <i>z</i>, the right plane through <i>z</i> = <i>F</i><sup>−1</sup>(<i>w</i>)), with the app's tokens, pattern (checker, cell 0.5 in <i>z</i>) and grid.</p>
</div>'''

SPEC_JS = r"""
function specs() {
  const rows = [
    ['X', 'plane', false, '<i>z</i>-plane', 'domain of <i>F</i>', 'X Plane: the shapes'],
    ['Y', 'plane', false, '<i>w</i> = <i>F</i>(<i>z</i>)', 'image, after 1 step', 'Y Plane: their images (today: Image)'],
    ['X', 'plane', true, '<i>z</i>-plane', 'phase of <i>F</i>', 'X Plane + Phase: the phase portrait (today: Phase, on the right)'],
    ['X', 'sphere', false, '<i>z</i>-sphere', 'domain of <i>F</i>', 'X Sphere (today: the left sphere toggle)'],
    ['Y', 'sphere', false, '<i>w</i>-sphere', 'image', 'Y Sphere (today: Sphere › Regions)'],
    ['X', 'sphere', true, '<i>z</i>-sphere', 'phase of <i>F</i>', 'X Sphere + Phase (today: Sphere › Phase)'],
    ['X', 'land', false, '<i>z</i>-plane', 'landscape of log|<i>F</i>|', 'X Landscape, Phase off = Plaster (today: Landscape › Plaster)'],
    ['X', 'land', true, '<i>z</i>-plane', 'landscape of log|<i>F</i>|', 'X Landscape + Phase (today: Landscape › Phase / Tiles)'],
  ];
  const mk = (r, narrow) => {
    const [side, surf, ph, t, role, cap] = r;
    const btns = [['plane', 'Plane', '1'], ['sphere', 'Sphere', '2']].concat(side === 'X' ? [['land', 'Landscape', '3']] : []);
    const sh = side === 'X' ? '' : '⇧';
    let v = '<div class="vgrp"><div class="vctl"><div class="vseg">' + btns.map(([k, l, key]) => `<button class="${k === surf ? 'on' : ''}" title="${l}  ${sh}${key}" data-ic="${k}"><span>${l}</span></button>`).join('') + '</div></div>'
      + (side === 'X' ? `<button class="phbtn" aria-pressed="${ph}" title="Phase colouring of F  4" data-ic="phase"><span>Phase</span></button>` : '') + '</div>';
    const act = side === 'Y' ? '<button class="icon-btn small" data-ic="morph"></button>' : '';
    return `<div class="spec${narrow ? ' narrow' : ''}"><div class="pane-head v2">${v}<div class="pane-title"><span class="ptitle">${t}</span><span class="prole">${role}</span></div><div class="grow"></div>${act}<span class="led"></span></div><div class="cap">${side} · ${cap}</div></div>`;
  };
  document.getElementById('specs').innerHTML = rows.map((r) => mk(r)).join('');
  document.getElementById('specsNarrow').innerHTML = [rows[2], rows[1]].map((r) => mk(r, true)).join('');
  document.getElementById('specsFocus').innerHTML = [
    ['X', 'plane', false, '<i>w</i><sub>1</sub>-plane', 'domain of <i>f</i><sub>2</sub>', 'X at focus 2: the stage images G₁(S), read-only'],
    ['Y', 'plane', false, '<i>w</i><sub>2</sub> = <i>f</i><sub>2</sub>(<i>w</i><sub>1</sub>)', 'image', 'Y at focus 2'],
  ].map((r) => mk(r)).join('');
  fillIcons();
}
specs();
"""

m1_script = SHAPES_JS + r"""
function draw() {
  planePane('pL', { space: 'X', view: VX, shapes: SH, targets: TG, after: probeX, handlesOf: [[0.6, 1.2, true], [1.3, 1.2, false]], handleInk: MK.css('--c1-edge') });
  planePane('pR', { space: 'Y', view: VY, shapes: SH, targets: TG, after: probeY });
}
""" + SPEC_JS

(out / 'mockup-1-planes.html').write_text(page('Panels: planes', m1_body, m1_script, '1-planes'))

# ======================= mockup 2: Phase on X =======================
optsPh = ('<div class="options" style="max-width:calc(100% - 52px)"><div class="seg small" role="radiogroup"><button class="on" aria-checked="true">Tiles</button><button>Plain</button><button>Modulus</button><button>Contours</button><button>Grid</button><button>Cauchy</button>'
          '</div><div class="scrub"><span class="pl">n</span><select class="sel"><option>12</option></select></div><label class="check"><input type="checkbox" checked><span>Outlines</span></label></div>')
m2_body = f'''<div id="app">{TOP}
<main class="layout hide-right">
{sidebar(tool='select', shapes_html=ROWS1, targets_html=TROWS)}
<section class="stage" style="--chain-h:112px">
  <div class="panes" style="--split:0.5">
    {pane('pL', head('X', 'plane', True, '<i>z</i>-plane', 'phase of <i>F</i>', pins=ipin(1)),
           '<div class="chip readout"><span class="rk"><i>z</i></span>  <span class="rv">0.4210 + 1.2034i</span>  <span class="rk"><i>F</i></span> <span class="rv">0.2084 ∠ −53.4°</span> <span class="sw" id="swL"></span></div>'
           '<div class="legend-chip"><canvas style="width:136px;height:48px;display:block" id="legL"></canvas></div>' + optsPh + viewstack() + pin(3, 'left:12px;bottom:46px') + pin(4, 'right:14px;top:62px'))}
    <div class="gutter gutter-col"></div>
    {pane('pR', head('Y', 'plane', False, '<i>w</i> = <i>F</i>(<i>z</i>)', 'image, after 1 step', actions='<button class="icon-btn small" aria-pressed="false" title="Deformation  M" data-ic="morph"></button>', pins=ipin(2)),
           '<div class="chip readout"><span class="rk"><i>w</i></span>  <span class="rv">0.1243 − 0.1673i</span>  <span class="rk">F′</span> <span class="rv">0.3974 ∠ −68.4°</span></div>'
           '<div class="options" style="max-width:calc(100% - 52px)"><label class="check"><input type="checkbox" checked><span>View outline</span></label></div>' + viewstack() + pin(5, 'left:12px;bottom:46px'), var='w')}
  </div>
  <div class="gutter gutter-row"></div>
  {CHAIN.replace('{focus}', '')}
</section>
{RIGHT}
</main></div>
<div class="notes">
<h2>Phase on X: the portrait on the left, the images on the right</h2>
<ol>
<li><div><b>X Plane + Phase</b> is today's Phase view, moved to the left because it is a plot over X: arg <i>F</i>(<i>z</i>) and |<i>F</i>(<i>z</i>)| in the Tiles style, the shapes outlined (white casing, "Outlines"). The Phase toggle is pressed (accent); it sits apart from the surface radios, so the two never read as one multi-select control.</div></li>
<li><div><b>Y stays Plane</b> and keeps showing the images of the shapes, filled with the pattern. Y has no Phase: the colouring of the <i>w</i>-plane would be the same colour wheel for every <i>F</i>. The colour key is the legend chip on X (4).</div></li>
<li><div>The style control lives only in the X strip, so it is shown once and is one setting: Tiles · Plain · Modulus · Contours · Grid · Cauchy (the style formerly called Phase is now <b>Plain</b>). On Landscape, styles the relief cannot paint are shown disabled ("On the landscape: Tiles or Plain") without changing the setting.</div></li>
<li><div>The legend chip (wheel and modulus strip) shows on X whenever Phase is on.</div></li>
<li><div>Y's strip is the one it has in mockup 1 ("View outline"). The pair X Phase + Y Plane is today's Image + Phase pairing with the sides put right.</div></li>
</ol>
<p>The same Tiles shader formula as the app (conformal squares, modulus × e<sup>2π/n</sup>, phase 2π/n, white unit circle, OKLCH wheel with h = 29° + arg), evaluated per pixel here.</p>
</div>'''
m2_script = SHAPES_JS + r"""
function draw() {
  planePane('pL', { space: 'X', view: VX, shapes: SH, targets: TG, paint: 'phase', after: probeX });
  planePane('pR', { space: 'Y', view: VY, shapes: SH, targets: TG, after: probeY });
  MK.legend(document.getElementById('legL'), '|F|');
  for (const [id, w] of [['swL', MK.F(0.421, 1.2034)]]) { const el = document.getElementById(id); if (el) el.style.background = 'rgb(' + MK.phaseRGB(w[0], w[1]).join(',') + ')'; }
}
"""
(out / 'mockup-2-phase.html').write_text(page('Panels: phase', m2_body, m2_script, '2-phase'))

# ======================= mockup 3: drawing on the globes =======================
m3_body = f'''<div id="app">{TOP}
<main class="layout hide-right">
{sidebar(tool='disc', disabled=('annulus', 'sector', 'pgrid'), shapes_html=shape_row(1, 'disc', 'Disc 1', '|z − 0.6 − 1.2i| &lt; 0.7') + shape_row(3, 'halfplane', 'Half-plane 1', 'Im z &gt; 1.5', sel=True), targets_html='', pins={'shapes': pin(6, 'top:10px;left:70px')})}
<section class="stage" style="--chain-h:112px">
  <div class="panes" style="--split:0.5">
    {pane('pL', head('X', 'sphere', False, '<i>z</i>-sphere', 'domain of <i>F</i>', pins=ipin(1)),
           '<div class="chip readout"><span class="rv"><i>Im z</i> &gt; 1.50</span> <span class="btag">half-plane</span></div>' +
           '<div class="options"><label class="check" title="Equatorial plane and projection ray"><input type="checkbox"><span>Equator</span></label><button class="icon-btn small" data-ic="orbit"></button></div>' + viewstack(fit=False) + pin(2, 'left:56%;top:23%') + pin(3, 'left:30%;top:70%'), rulers=False)}
    <div class="gutter gutter-col"></div>
    {pane('pR', head('Y', 'sphere', False, '<i>w</i>-sphere', 'image', actions='<button class="icon-btn small" aria-pressed="false" title="Deformation  M" data-ic="morph"></button>', pins=ipin(4)),
           '<div class="chip readout"><span class="rhint">Disc: drag from the centre · Space-drag or two fingers turn</span></div>'
           '<div class="options"><label class="check" title="Equatorial plane and projection ray"><input type="checkbox"><span>Equator</span></label><button class="icon-btn small" data-ic="orbit"></button></div>' + viewstack(fit=False) + pin(5, 'left:44%;top:72%'), var='w', rulers=False)}
  </div>
  <div class="gutter gutter-row"></div>
  {CHAIN.replace('{focus}', '')}
</section>
{RIGHT}
</main></div>
<div class="notes">
<h2>Drawing on the globes (item 8, phase P3b)</h2>
<ol>
<li><div><b>X Sphere</b> is the <i>z</i>-plane on the Riemann sphere (0 at the south pole, ∞ at the north). The globe is drawn with the conjugate lift, so it is <b>not a mirror image</b> of the plane: a half-plane lies to the left of its arrow, arcs and sectors turn counter-clockwise, the Tiles F reads correctly. Tools draw on it and store ordinary planar shapes. The graticule is the snap net: meridians every 15°, parallels |<i>z</i>| = ⅛ … 8.</div></li>
<li><div><b>A Disc on the sphere is a cap</b> (press at its centre on the sphere, drag the rim). Here the rim has snapped through ∞ (the accent ring at the north pole), so the cap is stored as the half-plane Im <i>z</i> &gt; 1.5; the readout says so, with the kind tag, while dragging. Dragged further, ∞ falls inside and it becomes the complement of a disc. Handles: the cap's centre on the sphere (round) and its rim point (square).</div></li>
<li><div>The disc |<i>z</i> − 0.6 − 1.2i| &lt; 0.7 drawn earlier, exact on the globe (per-pixel test at stage 0: no hole near ∞ for unbounded shapes).</div></li>
<li><div><b>Y Sphere</b> shows the images on the <i>w</i>-sphere, exact through <i>F</i><sup>−1</sup>: the half-plane's image is a disc whose rim passes through <i>F</i>(∞) = 1. Targets are drawn here the same way. The hint follows the tool (here Disc); the globe turns with Space-drag, the middle button or two fingers in every tool.</div></li>
<li><div>The draft's image follows on Y as you drag (both panes draw the same shape list).</div></li>
<li><div><b>Item 5, empty case:</b> no targets yet, so the <i>w</i>-plane group shows "No targets yet. Draw one in the <i>w</i>-plane.", the same form as the shapes' note. Annulus, Sector and Polar grid are dimmed on globes (tooltip "Draw in Plane"): built around a planar centre they would not look concentric with a Disc drawn at the same press.</div></li>
</ol>
</div>'''
m3_script = SHAPES_JS + r"""
const HP = { kind: 'halfplane', a: [-1, 1.5], b: [1, 1.5], ci: 3 };   // Im z > 1.5 (region left of a -> b)
const D1 = SH[0];
function draw() {
  // cameras mirrored with the lift (B2): the same parts of each plane face the viewer as before, now not mirror-imaged
  const camX = { yaw: -90 * Math.PI / 180, pitch: 22 * Math.PI / 180 };
  const camY = { yaw: 60 * Math.PI / 180, pitch: -30 * Math.PI / 180 };
  MK.globe(document.getElementById('pLC'), { space: 'X', cam: camX, shapes: [D1, HP], alpha: 0.85, radius: 0.37, dy: 6,
    after: (ctx, proj, g) => {
      // the cap's centre and rim handles, and the snap ring at infinity
      // half-plane Im z > 1.5 as a cap with the conjugate lift: C = mu (0, -1, 1.5), h = 1.5 mu (B = C_x - i C_y = i mu)
      const mu = 1 / Math.hypot(1, 1.5), C = [0, -mu, 1.5 * mu];
      const sC = proj(C), sN = proj([0, 0, 1]);
      ctx.save();
      ctx.strokeStyle = MK.css('--accent'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sN[0], sN[1], 9, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.35; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(sN[0], sN[1], 9, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.setLineDash([4, 3]); ctx.strokeStyle = MK.css('--c3-edge'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sC[0], sC[1]); ctx.lineTo(sN[0], sN[1]); ctx.stroke(); ctx.setLineDash([]);
      const hd = (s, round) => { ctx.fillStyle = MK.css('--surface'); ctx.strokeStyle = MK.css('--c3-edge'); ctx.lineWidth = 1.5; ctx.beginPath(); if (round) ctx.arc(s[0], s[1], 3.5, 0, Math.PI * 2); else ctx.rect(s[0] - 3.5, s[1] - 3.5, 7, 7); ctx.fill(); ctx.stroke(); };
      hd(sC, true); hd(sN, false);
      ctx.restore();
    } });
  MK.globe(document.getElementById('pRC'), { space: 'Y', cam: camY, shapes: [D1, HP], alpha: 0.85, radius: 0.37, dy: 6 });
}
"""
(out / 'mockup-3-globe.html').write_text(page('Panels: globes', m3_body, m3_script, '3-globe'))
print('ok')
