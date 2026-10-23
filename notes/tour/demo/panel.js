// The harness panel of notes/tour/harness.html: start any chapter, show the first-run suggestion or the help menu,
// forget the tour's memory, switch the theme, and watch what the tour asks of the app (api calls) and what the app
// tells it (events). Hidden with ?bare=1 and in the URL modes used for screenshots (?tour=...).
(() => {
  const qs = new URLSearchParams(location.search);
  if (qs.get('bare') === '1' || qs.get('tour')) return;
  const css = `
.th-panel { position: fixed; left: 12px; bottom: 12px; z-index: 60; width: 300px; max-width: calc(100vw - 24px);
  background: var(--surface); color: var(--ink); border: 1px solid var(--line-strong); border-radius: var(--r-4, 6px);
  box-shadow: var(--shadow-3); font: 400 12px/16px var(--f-ui); }
.th-panel header { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 6px 0 12px; border-bottom: 1px solid var(--line); }
.th-panel header b { flex: 1 1 auto; font: 600 12px/16px var(--f-ui); }
.th-panel.min .th-body { display: none; } .th-panel.min header { border-bottom: 0; }
.th-body { padding: 8px 10px 10px; display: grid; gap: 8px; }
.th-row { display: flex; flex-wrap: wrap; gap: 4px; }
.th-row .btn { height: 24px; padding: 0 8px; font-size: 12px; }
.th-lbl { font: var(--t-caption); color: var(--muted); }
.th-log { height: 120px; overflow: auto; margin: 0; padding: 6px 8px; background: var(--surface-2, var(--bg)); border: 1px solid var(--line); border-radius: var(--r-3, 4px);
  font: 400 11px/15px var(--f-mono); color: var(--ink-2); white-space: pre-wrap; }
.th-log i { font-style: normal; color: var(--accent); }
@media (max-width: 639px) { .th-panel { width: auto; right: 12px; } .th-log { height: 72px; } }`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const box = document.createElement('section');
  box.className = 'th-panel'; box.setAttribute('aria-label', 'Tour harness');
  box.innerHTML = `<header><b>Tour harness</b><button class="icon-btn small" type="button" data-a="min" aria-label="Collapse the harness panel" title="Collapse">–</button></header>
<div class="th-body">
  <div class="th-lbl">Start a chapter</div><div class="th-row" data-chapters></div>
  <div class="th-lbl">First run and help</div>
  <div class="th-row"><button class="btn ghost" data-a="suggest">Suggestion</button><button class="btn ghost" data-a="menu">Help menu</button><button class="btn ghost" data-a="reset">Forget the tour</button></div>
  <div class="th-lbl">Theme</div>
  <div class="th-row"><button class="btn ghost" data-a="light">Light</button><button class="btn ghost" data-a="dark">Dark</button><button class="btn ghost" data-a="system">System</button></div>
  <div class="th-lbl">Calls into the app and its events</div><pre class="th-log" aria-live="off"></pre>
</div>`;
  document.body.append(box);
  const log = box.querySelector('.th-log');
  const line = (kind, name, arg) => {
    const a = arg === undefined ? '' : JSON.stringify(arg, (k, v) => (v && v.nodeType ? '<el>' : v));
    const row = document.createElement('div');
    row.innerHTML = `<i>${kind === 'event' ? '◂' : '▸'}</i> `;
    row.append(`${name}${a && a !== '[]' && a !== '{}' ? ' ' + (a.length > 90 ? a.slice(0, 88) + '…' : a) : ''}`);
    log.append(row);
    while (log.childNodes.length > 60) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  };
  const ready = () => {
    if (window.__tourTap) window.__tourTap((kind, name, arg) => line(kind, name, kind === 'call' ? arg : arg));
    const row = box.querySelector('[data-chapters]');
    for (const c of Tour.chapters()) {
      const b = document.createElement('button');
      b.className = 'btn ghost'; b.type = 'button'; b.textContent = c.title;
      b.addEventListener('click', () => Tour.start({ chapter: c.id }));
      row.append(b);
    }
  };
  if (window.__tourApi) ready(); else addEventListener('tour-harness-ready', ready, { once: true });
  box.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    const k = a.dataset.a;
    if (k === 'min') box.classList.toggle('min');
    else if (k === 'suggest') { Tour.reset(); Tour.suggest({ delay: 0, force: true }); }
    else if (k === 'menu') Tour.openHelpMenu(document.querySelector('#helpBtn') || document.querySelector('#hdrMoreBtn'));
    else if (k === 'reset') { Tour.reset(); line('call', 'Tour.reset()'); }
    else if (k === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = k;
  });
})();
