// Static fixture for the stylesheet in src/page.html. It fills every JS-owned host with the DOM the
// app contract describes (no app logic), so the CSS can be checked in isolation.
(function () {
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const S = (inner, fill) => `<svg class="ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const I = {
    plus: S('<path d="M8 3.5v9M3.5 8h9"/>'), minus: S('<path d="M3.5 8h9"/>'), close: S('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
    chevL: S('<path d="M10 3.5L5.5 8l4.5 4.5"/>'), chevR: S('<path d="M6 3.5L10.5 8 6 12.5"/>'), chevD: S('<path d="M3.5 6l4.5 4.5L12.5 6"/>'),
    more: S('<circle cx="3.5" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12.5" cy="8" r="1.1"/>', true),
    eye: S('<path d="M1.75 8s2.3-4.25 6.25-4.25S14.25 8 14.25 8s-2.3 4.25-6.25 4.25S1.75 8 1.75 8z"/><circle cx="8" cy="8" r="2"/>'),
    eyeOff: S('<path d="M1.75 8s2.3-4.25 6.25-4.25S14.25 8 14.25 8s-2.3 4.25-6.25 4.25S1.75 8 1.75 8z"/><circle cx="8" cy="8" r="2"/><path d="M2.5 13.5l11-11"/>'),
    fit: S('<path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/><circle cx="8" cy="8" r="1.75"/>'),
    expand: S('<path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9"/>'),
    undo: S('<path d="M5.5 3.5l-3 3 3 3M2.5 6.5h7a3.5 3.5 0 0 1 0 7H6"/>'), redo: S('<path d="M10.5 3.5l3 3-3 3M13.5 6.5h-7a3.5 3.5 0 0 0 0 7H10"/>'),
    theme: S('<circle cx="8" cy="8" r="5.75"/><path d="M8 2.25a5.75 5.75 0 0 1 0 11.5z" fill="currentColor" stroke="none"/>'),
    bypass: S('<path d="M1.5 11h3.5M11 11h3.5M5 11C5 5 11 5 11 11"/><rect x="6.5" y="9.5" width="3" height="3"/>'),
    play: S('<path d="M5 3.5v9l7.5-4.5z"/>', true), search: S('<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25l3.25 3.25"/>'),
    grip: S('<circle cx="6" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/>', true),
    panelL: S('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 2.5v11"/>'), panelR: S('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M10 2.5v11"/>'),
    snap: S('<path d="M4 2.5v5.5a4 4 0 0 0 8 0V2.5M4 5h2.5M9.5 5H12"/>'),
    unit: S('<circle cx="8" cy="8" r="5.5" stroke-dasharray="2 2"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/>'),
    orbit: S('<ellipse cx="8" cy="8" rx="6" ry="2.75"/><path d="M12 4.2l2 1.3-1.6 1.8"/><circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none"/>'),
    copy: S('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.75c0-.7-.55-1.25-1.25-1.25h-5.5c-.7 0-1.25.55-1.25 1.25v5.5c0 .7.55 1.25 1.25 1.25H5.5"/>'),
    warning: S('<path d="M8 2.5l6 10.5H2zM8 6.5v3"/><circle cx="8" cy="11.25" r=".8" fill="currentColor" stroke="none"/>'),
    help: S('<circle cx="8" cy="8" r="6"/><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.4"/><circle cx="8" cy="11.6" r=".8" fill="currentColor" stroke="none"/>'),
    sliders: S('<path d="M2.5 5h11M2.5 11h11"/><circle cx="6" cy="5" r="1.75" fill="var(--surface)"/><circle cx="10" cy="11" r="1.75" fill="var(--surface)"/>'),
    argand: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 8h12M8 2v12" stroke="var(--line)" stroke-width="1"/><circle cx="8" cy="8" r="6" fill="none" stroke="var(--line-strong)" stroke-width="1"/><circle cx="11.5" cy="5" r="1.5" fill="var(--accent)"/></svg>',
  };
  for (const s of document.querySelectorAll('.ic-slot[data-icon]')) if (I[s.dataset.icon]) s.innerHTML = I[s.dataset.icon];
  const T = (p, area) => `<svg class="tic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${area ? p.replace('/>', ' fill="currentColor" fill-opacity=".16"/>') : p}</svg>`;
  const g = (x, y) => `<rect x="${x - 1.75}" y="${y - 1.75}" width="3.5" height="3.5" fill="currentColor" stroke="none"/>`;
  const TOOLS = [
    ['select', 'Select', T('<path d="M5.5 3.5V15l3.1-2.9 2.1 4.5 1.9-.8-2.1-4.5h4.1z"/>')],
    ['point', 'Point', T('<circle cx="10" cy="10" r="2.25" fill="currentColor"/><path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2"/>')],
    ['segment', 'Segment', T('<path d="M5 15L15 5"/>' + g(5, 15) + g(15, 5))],
    ['line', 'Line', T('<path d="M1 17.9L19 2.1"/>' + g(7, 12.6) + g(13, 7.4))],
    ['ray', 'Ray', T('<path d="M5 15L19 2.7"/>' + g(5, 15))],
    ['circle', 'Circle', T('<circle cx="10" cy="10" r="6.5"/><path d="M8.75 10h2.5M10 8.75v2.5" stroke-width="1"/>')],
    ['arc', 'Arc', T('<path d="M3.5 14.5A7.5 7.5 0 0 1 16.5 14.5"/>' + g(3.5, 14.5) + g(16.5, 14.5) + g(10, 7))],
    ['curve', 'Freehand', T('<path d="M3 14c2.2-4.8 4.2-.4 6.2-3.6S13 5.6 17 7.5"/>')],
    ['disc', 'Disc', T('<circle cx="10" cy="10" r="6.5"/>', true)],
    ['rect', 'Rectangle', T('<rect x="3.5" y="5.5" width="13" height="9" rx=".5"/>', true)],
    ['polygon', 'Polygon', T('<path d="M4 14.5L6.5 5 14 4.5l2.5 7L10 16z"/>', true)],
    ['lasso', 'Lasso', T('<path d="M5.2 12.8C3 9.6 5 4.8 9.6 4.5s7.4 2.6 6.4 6.2-5.6 4.9-8.6 4.3c-1-.2-1.7-1-2.2-2.2z"/>', true)],
    ['halfplane', 'Half-plane', T('<rect x="0" y="0" width="20" height="10.5" fill="currentColor" fill-opacity=".16" stroke="none"/><path d="M0 10.5h20M14.5 8.5l2 2-2 2"/>')],
    ['annulus', 'Annulus', T('<path fill-rule="evenodd" d="M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14zm0 3.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 1 0 0-6.5z"/>', true)],
    ['sector', 'Sector', T('<path d="M4 16h13A13 13 0 0 0 13.2 6.8z"/>', true)],
    ['formula', 'Formula', '<svg class="tic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><text x="3" y="15" font-family="STIX Two Text" font-style="italic" font-size="14" fill="currentColor" stroke="none">f</text><path d="M12 7h5M12 11h5"/></svg>'],
    ['cgrid', 'Grid', T('<path stroke-width="1" d="M4 4v12M8 4v12M12 4v12M16 4v12M4 4h12M4 8h12M4 12h12M4 16h12"/>')],
    ['pgrid', 'Polar grid', T('<g stroke-width="1"><circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5v13M3.5 10h13M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2"/></g>')],
  ];
  const active = q.get('tool') || 'circle';
  $('tools').innerHTML = TOOLS.map(([id, l, svg]) => `<button class="tool${id === active ? ' on' : ''}" data-tool="${id}" title="${l}">${svg}<span>${l}</span></button>`).join('');
  $('railTools').innerHTML = TOOLS.map(([id, l, svg]) => `<button class="tool rail-tool${id === active ? ' on' : ''}" data-tool="${id}" title="${l}">${svg}</button>`).join('');
  $('railCount').textContent = '3';
  $('toolHint').innerHTML = '<b>Circle</b> Drag from the center outward. Shift snaps the radius.';
  $('formulaInput').value = '|z-1| < 2';
  $('formulaPrev').innerHTML = '<span class="tex-fallback">|z − 1| &lt; 2</span>';
  const tags = ['|z|<1', '0<\\Im z<\\pi', '1<|z|<2', '\\Re z>0', '|\\arg z|<\\pi/4', '|z-1|+|z+1|<3'];
  $('formulaChips').innerHTML = tags.map((t) => `<button class="chip ftag" data-tex="${t}"><span class="tex-fallback">${t.replace(/\\\\/g, '')}</span></button>`).join('') + '<button class="chip more">More examples</button>';
  // shapes
  const sw = (n, kind) => `<span class="swatch" data-kind="${kind}" style="--c0: var(--c${n}); --c1: var(--c${n}-alt); --k: var(--c${n}-edge)"></span>`;
  const row = (n, kind, name, tex, cls, eye) => `<div class="shape ${cls || ''}"><div class="shape-row">${sw(n, kind)}<div class="shape-name"><span class="k">${name}</span><span class="d" data-tex="${tex}"><span class="tex-fallback">${tex}</span></span></div><button class="icon-btn eye" aria-label="Hide">${eye ? I.eyeOff : I.eye}</button><button class="icon-btn more" aria-label="More">${I.more}</button></div>`;
  $('shapeList').innerHTML = q.has('noshapes') ? '<div class="empty-note">No shapes yet. Pick a tool or type a set such as |z − 1| &lt; 2.<div class="row"><button class="btn ghost small">Unit disc</button><button class="btn ghost small">Upper half-plane</button><button class="btn ghost small">Examples</button></div></div>' :
    row(1, 'area', 'Disc 1', '|z - 0.5| < 1', 'sel') +
    '<div class="shape-edit"><div class="field"><label>center <i>c</i></label><input class="inp" value="0.5"></div><div class="field"><label>radius <i>r</i></label><input class="inp" value="1"></div><label class="check"><input type="checkbox"><span>Use complement</span></label></div></div>' +
    row(2, 'area', 'Half-plane 2', '\\Im z > 0', '') + '</div>' +
    row(3, 'curve', 'Line 3', 'line through 0, 1+i', '') + '</div>' +
    row(4, 'point', 'Point a', '0.5+0.5i', 'hidden-shape', true) + '</div>';
  // patterns (#363: the page has none since the regions' fill is the phase alone)
  if ($('patternSeg')) {
    const PATS = ['Checker', 'Conformal', 'Graph paper', 'Polar web', 'Tiles', 'Phase', 'Area scale', 'Solid'];
    $('patternSeg').innerHTML = PATS.map((p, i) => `<button class="pat${i === 0 ? ' on' : ''}" role="radio" aria-checked="${i === 0}"><canvas width="104" height="80"></canvas><span>${p}</span></button>`).join('');
    const cs = getComputedStyle(document.documentElement);
    const tok = (n) => cs.getPropertyValue(n).trim();
    [...$('patternSeg').querySelectorAll('canvas')].forEach((c, i) => {
      const x = c.getContext('2d');
      x.fillStyle = tok('--c1-alt'); x.fillRect(0, 0, 104, 80);
      x.fillStyle = tok('--c1');
      if (i === 7) { x.fillRect(0, 0, 104, 80); return; }
      for (let a = 0; a < 104; a += 16) for (let b = 0; b < 80; b += 16) if (((a + b) / 16) % 2 === 0) x.fillRect(a + (i * 3) % 8, b, 16, 16);
    });
  }
  $('patDesc').textContent = 'Squares stay squares under conformal maps.';
  $('patScale').value = 0; $('patScaleVal').textContent = '×1';
  $('alphaRange').value = 0.85; $('alphaVal').textContent = '0.85';
  $('meshRange').min = 80; $('meshRange').max = 1280; $('meshRange').value = 240; $('meshVal').textContent = '240 cells';
  $('meshPresets').children[1].classList.add('on');
  $('linesChk').checked = false; $('chevChk').checked = true;
  for (const r of document.querySelectorAll('input[type=range]')) {
    const f = () => r.style.setProperty('--fill', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
    f(); r.addEventListener('input', f);
  }
  // titles and chrome
  $('leftTitle').innerHTML = '<span class="ptitle"><i>z</i>-plane</span><span class="prole">domain</span>';
  $('rightTitle').innerHTML = '<span class="ptitle"><i>w</i> = <i>F</i>(<i>z</i>)</span><span class="prole">after 2 steps</span>';
  const MODES = [['image', 'Image'], ['color', 'Phase'], ['3d', 'Landscape'], ['sphere', 'Sphere'], ['morph', 'Morph']];
  const mic = '<svg class="mic" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.25"><circle cx="7" cy="7" r="5.5"/><path d="M7 7h5.5M7 7l-2.75 4.76M7 7L4.25 2.24"/></svg>';
  const mode = q.get('mode') || 'color';
  $('rightTabs').innerHTML = MODES.map(([m, l]) => `<button data-mode="${m}" role="radio" class="${m === mode ? 'on' : ''}" aria-checked="${m === mode}">${mic}<span>${l}</span></button>`).join('');
  $('leftLed').className = 'led ok'; $('rightLed').className = 'led ' + (q.get('led') || 'busy');
  $('rightLed').title = 'Refining';
  $('cornerL').innerHTML = '<i>z</i>'; $('cornerR').innerHTML = '<i>w</i>';
  $('leftReadout').innerHTML = '<span class="rk">z</span> <span class="rv">0.4210 + 1.2034<i>i</i></span><span class="rk">|z|</span> <span class="rv">1.2749</span><span class="rk">arg</span> <span class="rv">72.08°</span>';
  $('rightReadout').innerHTML = '<span class="rk">w</span> <span class="rv">−0.3127 + 0.8810<i>i</i></span><span class="rk">|w|</span> <span class="rv">0.9349</span>';
  $('rightLegend').hidden = false;
  $('hairR').hidden = false;
  for (const [s, ic] of [['ZoomIn', 'plus'], ['ZoomOut', 'minus'], ['Fit', 'fit'], ['Solo', 'expand']]) { $('left' + s).innerHTML = I[ic]; $('right' + s).innerHTML = I[ic]; }
  const seg = (opts, on, id) => `<div class="seg small" ${id ? `id="${id}"` : ''} role="radiogroup">${opts.map((o) => `<button data-v="${o}" role="radio" class="${o === on ? 'on' : ''}" aria-checked="${o === on}">${o}</button>`).join('')}</div>`;
  if (mode === 'morph') {
    $('rightFoot').className = 'options transport';
    $('rightFoot').innerHTML = `<button class="icon-btn play" aria-label="Play">${I.play}</button><div class="tscrub"><input type="range" min="0" max="2" step="0.001" value="1.37"><div class="tticks"><span class="ttick" style="left:25%"><i>f</i><sub>1</sub></span><span class="ttick" style="left:75%"><i>f</i><sub>2</sub></span></div></div><span class="tread mono">t = 1.37 / 2</span>${seg(['0.5×', '1×', '2×'], '1×')}<select class="sel"><option>One after another</option><option>All at once</option></select>`;
  } else if (mode === 'image') {
    $('rightFoot').innerHTML = '<label class="check"><input type="checkbox" checked><span>View outline</span></label>';
  } else {
    $('rightFoot').innerHTML = seg(['Tiles', 'Phase', 'Modulus', 'Contours', 'Grid'], 'Tiles', 'dcSeg') + '<div class="scrub"><span class="pl scrub">n</span><select class="sel"><option>12</option></select></div><label class="check"><input type="checkbox" checked><span>Region outline</span></label>';
  }
  if (q.has('empty')) {
    $('emptyState').hidden = false;
    $('emptyState').innerHTML = '<div><b>No shapes yet</b><span class="lbl">Draw a region with the tools, or type a set such as |z − 1| &lt; 2</span><div class="row"><button class="chip ftag">|z| &lt; 1</button><button class="chip ftag">Im z &gt; 0</button><button class="chip ftag">1 &lt; |z| &lt; 2</button></div></div>';
    $('emptyRight').hidden = false;
    $('emptyRight').innerHTML = '<span>Add a function to map the region</span><button class="btn primary small">Add function</button>';
  }
  // canvases: graph paper and a fake region so the chrome reads against real content
  function paper(c, phase) {
    const r = c.getBoundingClientRect(), d = devicePixelRatio || 1;
    c.width = Math.max(1, r.width * d); c.height = Math.max(1, r.height * d);
    const x = c.getContext('2d'); x.scale(d, d);
    const W = r.width, H = r.height;
    if (phase) {
      for (let i = 0; i < W; i += 4) for (let j = 0; j < H; j += 4) {
        const a = Math.atan2(H / 2 - j, i - W / 2); x.fillStyle = `oklch(0.75 0.12 ${29 + a * 180 / Math.PI})`; x.fillRect(i, j, 4, 4);
      }
      return;
    }
    x.fillStyle = tok('--plane'); x.fillRect(0, 0, W, H);
    for (const [st, col] of [[10, '--grid-minor'], [50, '--grid-medium'], [100, '--grid-major']]) {
      x.strokeStyle = tok(col); x.lineWidth = 1; x.beginPath();
      for (let i = (W / 2) % st; i < W; i += st) { x.moveTo(Math.round(i) + 0.5, 0); x.lineTo(Math.round(i) + 0.5, H); }
      for (let j = (H / 2) % st; j < H; j += st) { x.moveTo(0, Math.round(j) + 0.5); x.lineTo(W, Math.round(j) + 0.5); }
      x.stroke();
    }
    x.strokeStyle = tok('--axis'); x.lineWidth = 1.25; x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke();
    x.fillStyle = tok('--c1'); x.globalAlpha = 0.85; x.beginPath(); x.arc(W / 2 + 40, H / 2 - 20, Math.min(W, H) * 0.25, 0, 7); x.fill(); x.globalAlpha = 1;
    x.strokeStyle = tok('--c1-edge'); x.lineWidth = 1.5; x.stroke();
  }
  function ruler(c, vertical) {
    const r = c.getBoundingClientRect(), d = devicePixelRatio || 1;
    c.width = Math.max(1, c.clientWidth * d); c.height = Math.max(1, c.clientHeight * d);
    const x = c.getContext('2d'); x.scale(d, d);
    const L = vertical ? c.clientHeight : c.clientWidth, Wd = vertical ? c.clientWidth : c.clientHeight;
    x.strokeStyle = tok('--ruler-tick'); x.fillStyle = tok('--axis-label'); x.font = '10px "JetBrains Mono"'; x.lineWidth = 1;
    x.beginPath();
    for (let i = 0, k = 0; i < L; i += 10, k++) {
      const len = k % 10 === 0 ? 7 : k % 5 === 0 ? 5 : 3, p = Math.round(i) + 0.5;
      if (vertical) { x.moveTo(Wd - len, p); x.lineTo(Wd, p); } else { x.moveTo(p, 0); x.lineTo(p, len); }
    }
    x.stroke();
    for (let i = 100, k = 1; i < L - 12; i += 100, k++) {
      if (vertical) { x.save(); x.translate(9, i); x.rotate(-Math.PI / 2); x.textAlign = 'center'; x.fillText(String(k / 2), 0, 0); x.restore(); }
      else { x.textAlign = 'center'; x.fillText(String(k / 2), i, 15); }
    }
  }
  function lg() {
    const c = $('legendCanvas'), x = c.getContext('2d'); x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, 136, 72);
    for (let a = 0; a < 360; a += 2) { x.strokeStyle = `oklch(0.75 0.12 ${29 - a})`; x.lineWidth = 10; x.beginPath(); x.arc(36, 36, 19, a * Math.PI / 180, (a + 3) * Math.PI / 180); x.stroke(); }
    x.fillStyle = tok('--ink-2'); x.font = '11px "Roboto Flex"'; x.fillText('×1.69 per band', 66, 58);
    const gr = x.createLinearGradient(66, 0, 130, 0); gr.addColorStop(0, tok('--plane')); gr.addColorStop(1, tok('--ink')); x.fillStyle = gr; x.fillRect(66, 30, 64, 8);
  }
  function paint() {
    paper($('canvasL')); paper($('canvasR'), mode === 'color');
    for (const id of ['rulerLX', 'rulerRX']) ruler($(id), false);
    for (const id of ['rulerLY', 'rulerRY']) ruler($(id), true);
    lg();
    for (const c of document.querySelectorAll('.thumb canvas')) paper(c);
    for (const c of document.querySelectorAll('.ex-thumb, .pal-preview canvas, .pad canvas')) paper(c);
  }
  // chain
  const thumb = (v) => `<div class="thumb"><canvas></canvas><span class="thumb-var">${v}</span></div>`;
  const pchips = (on) => `<div class="pchips">${['A', 'E', 'R', 'P', 'M', 'Pr', 'I'].map((p, i) => `<span class="pchip${on[i] ? ' on' : ''}" title="${p}">${p}</span>`).join('')}</div>`;
  const head = (k, name, extra) => `<div class="card-head"><span class="grip">${I.grip}</span><span class="idx"><i>f</i><sub>${k}</sub></span><span class="nm">${name}</span><span class="acts"><button class="icon-btn txt" aria-label="Invert"><i>f</i><sup>−1</sup></button><button class="icon-btn bypass" aria-pressed="${extra === 'off'}" aria-label="Bypass">${I.bypass}</button><button class="icon-btn more" aria-label="More">${I.more}</button></span></div>`;
  const conn = (v, f, last) => `<div class="conn${last ? ' conn-last' : ''}"><span class="conn-var"><i>${v}</i></span><span class="conn-line"><svg viewBox="0 0 40 12" fill="none" stroke="currentColor" stroke-width="1"><path d="M2 6h36"/><path d="M17 3l3 3-3 3" stroke-linejoin="round"/></svg></span><span class="conn-f">${f}</span><button class="conn-add" aria-label="Insert">${I.plus}</button></div>`;
  const pf = (l, v, cx) => `<div class="pf${cx ? ' cx' : ''}"><label class="pl scrub">${l}</label>${cx ? `<div class="pair"><input class="inp" value="${v}"><button class="icon-btn argand" aria-label="Argand pad">${I.argand}</button></div>` : `<input class="inp" value="${v}">`}</div>`;
  $('pipeline').innerHTML =
    `<div class="card region-card" tabindex="0"><div class="card-head"><span class="idx"><i>z</i></span><span class="nm">Region</span></div>${thumb('<i>z</i>')}<div class="note">3 shapes, 1 hidden</div><div class="swatches">${sw(1, 'area')}${sw(2, 'area')}${sw(3, 'curve')}</div></div>` +
    conn('z', '<i>f</i><sub>1</sub>') +
    `<div class="card" tabindex="0">${head(1, 'Exponential')}${thumb('<i>w</i><sub>1</sub>')}<div class="ftex-row"><div class="ftex"><span class="tex-fallback">w₁ = e^{z}</span></div><span class="btag">sheet 0/2</span></div><div class="params"><div class="pf wide"><label class="pl">scale</label><input class="inp" value="1"></div></div><div class="note">Principal branch. Drag the seam in the input plane.</div>${pchips([1, 1, 0, 0, 0, 0, 0])}</div>` +
    conn('w<sub>1</sub>', '<i>f</i><sub>2</sub>') +
    `<div class="card focus" tabindex="0">${head(2, 'Möbius')}${thumb('<i>w</i><sub>2</sub>')}<div class="ftex-row"><div class="ftex"><span class="tex-fallback">w₂ = (a w₁ + b)/(c w₁ + d)</span></div></div><div class="params matrix2">${pf('a', '1+i', 1)}${pf('b', '0', 1)}${pf('c', '1', 1)}${pf('d', '−i', 1)}</div>${pchips([1, 0, 1, 0, 1, 0, 1])}</div>` +
    conn('w<sub>2</sub>', '<i>f</i><sub>3</sub>') +
    `<div class="card off" tabindex="0">${head(3, 'Square root', 'off')}${thumb('<i>w</i><sub>3</sub>')}<div class="ftex-row"><div class="ftex"><span class="tex-fallback">w₃ = √w₂</span></div><span class="btag">cut 180°</span></div><div class="params"><div class="pf"><label class="pl scrub">θ</label><input class="inp" value="180°"></div></div><div class="note">Principal branch.</div>${pchips([1, 0, 0, 0, 0, 0, 0])}</div>` +
    conn('w<sub>3</sub>', '<i>f</i><sub>4</sub>') +
    `<div class="card bad" tabindex="0">${head(4, 'Custom formula')}${thumb('<i>w</i><sub>4</sub>')}<div class="ftex-row"><div class="ftex"><span class="tex-fallback">\\sinc(w)</span></div></div><div class="params"><div class="pf wide"><label class="pl">expr</label><input class="inp bad" value="\\sinc(w)"></div></div><div class="err-msg">f₄ (Custom formula): unknown symbol \\sinc. Try \\sin or \\sinh.</div>${pchips([0, 0, 0, 0, 0, 0, 0])}</div>` +
    conn('w<sub>4</sub>', '', true) +
    `<button class="add-card">${I.plus}<span>Add function</span><span class="kbd">+</span></button>`;
  if (q.has('compact')) { $('pipeline').classList.add('compact'); $('stage').style.setProperty('--chain-h', '112px'); }
  $('composeTex').innerHTML = '<span class="tex-fallback">F = f₄ ∘ f₃ ∘ f₂ ∘ f₁</span>';
  // properties
  const LAMPS = [['Analytic', 1, ''], ['Entire', 0, ''], ['Rational', 1, 'deg 2'], ['Polynomial', 0, ''], ['Möbius', 0, ''], ['Proper', 1, ''], ['Homeomorphism onto image', 1, ''], ['Conformal onto image', 0, '']];
  $('propsPanel').innerHTML =
    `<section class="psec"><h2><span class="grow">Composite map</span><button class="icon-btn" aria-label="Copy LaTeX">${I.copy}</button><button class="collapse-btn" aria-label="Hide guarantees">${I.chevR}</button></h2><div class="fbox well"><div class="ftex-main"><span class="tex-fallback">F(z) = (e^z + i)/(e^z − i)</span></div><ol class="chainlist"><li data-k="1"><span class="idx"><i>w</i><sub>1</sub></span><span class="tex-fallback">= e^z</span></li><li data-k="2" class="hi"><span class="idx"><i>w</i><sub>2</sub></span><span class="tex-fallback">= (w₁ + i)/(w₁ − i)</span></li><li data-k="3"><span class="idx"><i>w</i><sub>3</sub></span><span class="bypassed"><i>f</i><sub>3</sub> bypassed</span></li></ol></div></section>` +
    `<section class="psec"><h2>Guarantees</h2><div class="warnrow"><span class="wi">${I.warning}</span><div>Step 4 has an error and is skipped until fixed.</div></div><ul class="lamps">${LAMPS.map(([n, on, qq], i) => `<li class="lamp${on ? ' on' : ''}${i === 2 ? ' open' : ''}${i === 5 ? ' flash' : ''}"><span class="lampmark"></span><span class="lampname">${n}</span><span class="lampq">${qq}</span><span class="lampchev"></span>${i === 2 ? '<div class="lampdesc">A ratio of two polynomials. Every step is rational, so the composite is too.</div>' : ''}</li>`).join('')}</ul><div class="lamp-key">Lit: guaranteed by the chain. Unlit: not implied by the steps (it may still hold).</div></section>` +
    `<section class="psec"><h2>Natural domain <i>D</i></h2><div class="well domain"><div class="lbl">All <i>z</i> for which:</div><ul class="domlist"><li><span class="tex-fallback">w₁ ≠ i</span></li></ul></div><div class="lbl foot"><i>w</i><sub>k</sub> is the value after step <i>k</i>; <i>w</i><sub>0</sub> = <i>z</i>.</div></section>` +
    `<section class="psec"><h2>Step by step</h2><table class="matrix"><tr><th>step</th>${['A', 'E', 'R', 'P', 'M', 'Pr', 'I'].map((x) => `<th title="${x}">${x}</th>`).join('')}</tr>` +
    [[1, 'Exponential', [1, 1, 0, 0, 0, 0, 0]], [2, 'Möbius', [1, 0, 1, 0, 1, 1, 1]], [3, 'Square root', [1, 0, 0, 0, 0, 0, 1]]].map(([k, n, v]) => `<tr data-k="${k}"${k === 2 ? ' class="hi"' : ''}><td><span class="idx"><i>f</i><sub>${k}</sub></span>${n}</td>${v.map((y, i) => `<td class="${y ? 'y' : 'n'}${i === 2 ? ' hi-col' : ''}"><span class="sq"></span></td>`).join('')}</tr>`).join('') +
    `<tr class="total"><td>F</td>${[1, 0, 0, 0, 0, 0, 1].map((y, i) => `<td class="${y ? 'y' : 'n'}${i === 2 ? ' hi-col' : ''}"><span class="sq"></span></td>`).join('')}</tr></table><details class="how"><summary>How these are decided</summary><p>Each step reports what it preserves. A property holds for the chain when every active step has it and the composition rule applies.</p></details></section>`;
  $('railLamps').innerHTML = LAMPS.map(([n, on]) => `<span class="rl${on ? ' on' : ''}" title="${n}"></span>`).join('');
  // layout toggles
  const lay = document.querySelector('.layout');
  if (q.has('hideLeft')) lay.classList.add('hide-left');
  if (q.has('hideRight')) lay.classList.add('hide-right');
  if (q.has('drawerRight')) lay.classList.add('drawer-right');
  if (q.has('drawerLeft')) lay.classList.add('drawer-left');
  if (q.has('solo')) $('panes').classList.add('solo-' + q.get('solo'));
  if (q.get('theme')) document.documentElement.dataset.theme = q.get('theme');
  // segmented thumb (as setSeg does)
  function thumbs() { for (const el of document.querySelectorAll('.seg')) { const on = el.querySelector('.on'); if (on) { el.style.setProperty('--seg-x', on.offsetLeft + 'px'); el.style.setProperty('--seg-w', on.offsetWidth + 'px'); } } }
  document.addEventListener('click', (e) => { const b = e.target.closest('.seg > button'); if (!b) return; for (const s of b.parentNode.children) s.classList.toggle('on', s === b); thumbs(); });
  // floating layers on demand
  const show = (q.get('show') || '').split(',');
  const host = $('popHost');
  if (show.includes('palette')) {
    host.insertAdjacentHTML('beforeend', `<div class="pop palette" role="dialog"><div class="pal-head"><span class="pal-icon">${I.search}</span><input class="pal-input" placeholder="Search functions, regions, examples, commands"><span class="pal-ctx">Insert after <i>f</i><sub>1</sub></span><span class="kbd">Esc</span></div><div class="pal-body"><div class="pal-list">` +
      '<div class="pal-group">Recently used</div>' +
      [['e^{z}', 'Exponential', 'Conformal on ℂ; injective on strips of height 2π', [1, 1, 0, 0, 0, 0, 0], 1], ['\\frac{az+b}{cz+d}', 'Möbius', 'Circles to circles; ad − bc ≠ 0', [1, 0, 1, 0, 1, 1, 1]], ['z^{2}', 'Square', 'Doubles angles at 0', [1, 1, 1, 1, 0, 1, 0]]].map(([t, n, d, p, s]) => `<div class="pal-item${s ? ' sel' : ''}"><span class="pal-tex"><span class="tex-fallback">${t}</span></span><span class="pal-main"><span class="pal-label">${n}</span><span class="pal-desc">${d}</span></span><span class="pal-props">${['A', 'E', 'R', 'P', 'M', 'Pr', 'I'].map((x, i) => `<span class="pp${p[i] ? ' on' : ''}">${x}</span>`).join('')}</span></div>`).join('') +
      '<div class="pal-group">Functions</div>' +
      [['\\log z', 'Logarithm', 'Principal branch, cut along the negative reals'], ['\\sqrt{z}', 'Square root', 'Principal branch'], ['\\sin z', 'Sine', 'Entire, periodic'], ['z + 1/z', 'Joukowsky', 'Circle to segment; airfoils']].map(([t, n, d]) => `<div class="pal-item"><span class="pal-tex"><span class="tex-fallback">${t}</span></span><span class="pal-main"><span class="pal-label">${n}</span><span class="pal-desc">${d}</span></span><span class="pal-props">${['A', 'E', 'R', 'P', 'M', 'Pr', 'I'].map((x, i) => `<span class="pp${i === 0 ? ' on' : ''}">${x}</span>`).join('')}</span></div>`).join('') +
      `</div><div class="pal-preview"><canvas></canvas><div class="pal-cap">Image after adding <i>f</i><sub>3</sub></div></div></div><div class="pal-foot"><span>↑ ↓ to move</span><span>Enter to add</span><span>Shift Enter to insert before</span><span>Esc to close</span></div></div>`);
  }
  if (show.includes('menu')) {
    host.insertAdjacentHTML('beforeend', `<div class="pop menu" style="left:${innerWidth - 560}px; top:340px"><button class="mi"><span class="mi-ic">${I.chevL}</span><span class="mi-label">Move left</span><span class="mi-key">⌥←</span></button><button class="mi"><span class="mi-ic">${I.chevR}</span><span class="mi-label">Move right</span><span class="mi-key">⌥→</span></button><button class="mi"><span class="mi-ic">${I.copy}</span><span class="mi-label">Duplicate</span><span class="mi-key">⌘D</span></button><button class="mi has-sub"><span class="mi-ic"></span><span class="mi-label">Presets</span></button><div class="msep"></div><button class="mi danger"><span class="mi-ic">${I.close}</span><span class="mi-label">Remove</span><span class="mi-key">⌫</span></button></div>`);
  }
  if (show.includes('examples')) {
    host.insertAdjacentHTML('beforeend', `<div class="pop menu examples" style="left:180px; top:42px">${[['Joukowsky airfoil', 'Circle through −1, offset ↦ wing profile'], ['Cayley transform', 'Upper half-plane to the unit disc'], ['Strip to slit plane', 'exp maps a strip of height 2π'], ['Square root seam', 'Branch cut along the negative reals']].map(([n, b], i) => `<button class="ex-item${i === 0 ? ' on' : ''}"><canvas class="ex-thumb"></canvas><span class="ex-text"><span class="ex-name">${n}</span><span class="ex-blurb">${b}</span></span></button>`).join('')}</div>`);
  }
  if (show.includes('pad')) {
    host.insertAdjacentHTML('beforeend', `<div class="pop pad" style="left:${innerWidth - 820}px; top:300px"><canvas></canvas><div class="pad-read">1.0000 + 1.0000<i>i</i></div><div class="row"><div class="scrub"><span class="pl scrub">Re</span><input class="inp" value="1"></div><div class="scrub"><span class="pl scrub">Im</span><input class="inp" value="1"></div><div class="scrub"><span class="pl scrub">|c|</span><input class="inp" value="1.4142"></div><div class="scrub"><span class="pl scrub">arg°</span><input class="inp" value="45"></div></div></div>`);
  }
  if (show.includes('toast')) $('toastHost').innerHTML = '<div class="toast"><span>Chain cleared.</span><button class="toast-act">Undo</button></div>';
  if (show.includes('tip')) { const t = $('tip'); t.hidden = false; t.innerHTML = 'Disc<span class="tip-key">D</span>'; t.style.left = '40px'; t.style.top = '130px'; }
  if (show.includes('modal')) {
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-bg"><div class="modal" role="dialog"><h2>${document.querySelector('.mark').outerHTML}Using the Workbench</h2><p>Draw a region in the <i>z</i>-plane, then build a chain of functions. The right plane shows the image.</p><h3>Shortcuts</h3><table class="keys"><tr><td><span class="kbd">⌘</span> <span class="kbd">K</span></td><td>Command palette</td><td><span class="kbd">Z</span></td><td>Fit both planes</td></tr><tr><td><span class="kbd">[</span> <span class="kbd">]</span></td><td>Toggle panels</td><td><span class="kbd">1</span>–<span class="kbd">5</span></td><td>Right-plane modes</td></tr></table></div></div>`);
  }
  if (show.includes('dragging')) document.querySelectorAll('.card')[2].classList.add('dragging');
  requestAnimationFrame(() => { thumbs(); paint(); });
  addEventListener('resize', () => { thumbs(); paint(); });
  document.fonts && document.fonts.ready.then(() => { thumbs(); paint(); });
  window.__fixtureReady = true;
})();
