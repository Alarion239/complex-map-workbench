window.__qa = {
  ns: () => new URLSearchParams(location.search).get('ns'),
  key: () => 'complex-map-workbench-v1:' + new URLSearchParams(location.search).get('ns'),
  state: () => JSON.parse(localStorage.getItem(__qa.key()) || 'null'),
  put: (o) => { localStorage.setItem(__qa.key(), JSON.stringify(Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, o))); },
  // (v15: the lamps live on the F tile at the end of the chain; the old Guarantees panel's when there is no tile)
  lamps: () => [...document.querySelectorAll(document.querySelector('#pipeline .ftile .lamp') ? '#pipeline .ftile .lamp' : '#propsPanel .lamp')].map((l) => (l.classList.contains('on') ? '●' : '○') + l.dataset.lamp + (l.querySelector('.lampq') && l.querySelector('.lampq').textContent ? '(' + l.querySelector('.lampq').textContent + ')' : '')).join(' '),
  warns: () => [...document.querySelectorAll('#propsPanel .warn, #propsPanel [class*=warn]')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 4),
  cards: () => [...document.querySelectorAll('.pipeline .card')].map((c) => c.getAttribute('aria-label') + (c.classList.contains('focus') ? '*' : '') + (c.querySelector('.err, .card-err') ? ' ERR:' + c.querySelector('.err, .card-err').textContent : '')),
  modeBtn: (name) => [...document.querySelectorAll('button,[role=radio]')].find((b) => (b.getAttribute('aria-label') || b.title || '') === name),
  toasts: () => [...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.trim()),
  vis: (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; },
  center: (el) => { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  txt: (sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; },
  frames: async (ms) => { const t = []; const t0 = performance.now(); await new Promise((res) => { const f = () => { t.push(performance.now()); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); const d = t.slice(1).map((x, i) => x - t[i]); d.sort((a, b) => a - b); return { n: d.length, fps: +(1000 * d.length / (t[t.length - 1] - t[0])).toFixed(1), p50: +d[d.length >> 1].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), max: +d[d.length - 1].toFixed(1) }; },
};
