window.__mock = (() => {
  const S = {
    enhanced: '<svg viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="6" height="6" rx="1" fill="#F58C7E"/><rect x="8.5" y="1.5" width="6" height="6" rx="1" fill="#53B8F7"/><rect x="1.5" y="8.5" width="6" height="6" rx="1" fill="#6EC580"/><rect x="8.5" y="8.5" width="6" height="6" rx="1" fill="#CFA93E"/></svg>',
    phase: '<svg viewBox="0 0 16 16"><path d="M8 8V1.5A6.5 6.5 0 0 1 14.5 8z" fill="#F58C7E"/><path d="M8 8h6.5A6.5 6.5 0 0 1 8 14.5z" fill="#CFA93E"/><path d="M8 8v6.5A6.5 6.5 0 0 1 1.5 8z" fill="#6EC580"/><path d="M8 8H1.5A6.5 6.5 0 0 1 8 1.5z" fill="#53B8F7"/></svg>',
    classic: '<svg viewBox="0 0 16 16"><defs><radialGradient id="mSg"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient></defs><circle cx="8" cy="8" r="6.5" fill="url(#mSg)" stroke="currentColor" stroke-opacity=".5"/></svg>',
    modulus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="6.3"/><circle cx="8" cy="8" r="3.8"/><circle cx="8" cy="8" r="1.4"/></svg>',
    grid: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M2 4.5c4 1.5 8-1.5 12 0M2 8c4 1.5 8-1.5 12 0M2 11.5c4 1.5 8-1.5 12 0M4.5 2c-1.5 4 1.5 8 0 12M8 2c-1.5 4 1.5 8 0 12M11.5 2c-1.5 4 1.5 8 0 12"/></svg>',
    cauchy: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="#53B8F7" fill-opacity=".35" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/></svg>',
  };
  const NAMES = { en: ['Tiles', 'Plain', 'Modulus', 'Contours', 'Grid', 'Cauchy'], ru: ['Плитки', 'Простая', 'Модуль', 'Линии уровня', 'Сетка', 'Коши'] };
  const IDS = ['enhanced', 'phase', 'classic', 'modulus', 'grid', 'cauchy'];
  const I = {
    outline: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 12.5 2.5 6 8 2.5l5.5 3.5-1 6.5z" stroke-dasharray="2.2 1.6"/></svg>',
    unit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="5.2"/><path d="M8 1.5v13M1.5 8h13" stroke-opacity=".45"/></svg>',
    view: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="3.5" width="11" height="9" rx="1" stroke-dasharray="2.4 1.6"/></svg>',
    key: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:conic-gradient(from 90deg,#F58C7E,#CFA93E,#6EC580,#1CC3D8,#8EAAFD,#DB8FD6,#F58C7E)"></span>',
    more: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>',
  };
  const css = document.createElement('style');
  css.textContent = `
  .mk-row { display: inline-flex; align-items: center; gap: 6px; margin-left: 4px; }
  .mk-seg { display: inline-flex; padding: 2px; gap: 1px; border: 1px solid var(--line); border-radius: 6px; background: var(--well); }
  .mk-seg button { display: inline-flex; align-items: center; gap: 5px; height: 22px; min-width: 24px; padding: 0 4px; justify-content: center; border: 1px solid transparent; border-radius: 4px; background: none; color: var(--ink-2); font: 500 12px/1 var(--f-ui); }
  .mk-seg button svg, .mk-tg svg { width: 15px; height: 15px; display: block; }
  .mk-seg button[aria-checked=true] { background: var(--seg-on, #fff); border-color: var(--line-strong); color: var(--ink); padding: 0 7px 0 5px; }
  .mk-tg { width: 26px; height: 26px; display: inline-grid; place-items: center; border: 1px solid transparent; border-radius: 6px; background: none; color: var(--ink-2); }
  .mk-tg[aria-pressed=true] { background: var(--seg-on, #fff); border-color: var(--line-strong); color: var(--accent, #2563eb); }
  .mk-n { display: inline-flex; align-items: center; gap: 3px; height: 26px; padding: 0 2px 0 6px; border: 1px solid var(--line); border-radius: 6px; font: italic 13px/1 var(--f-math, serif); color: var(--ink-2); }
  .mk-n select { border: 0; background: none; font: 500 12px var(--f-ui); color: var(--ink); }
  .mk-sep { width: 1px; height: 16px; background: var(--line); }
  .mk-pat { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 4px; border: 1px solid var(--line); border-radius: 6px; background: none; color: var(--ink-2); }
  .mk-pat canvas, .mk-pat .sw { width: 18px; height: 14px; border-radius: 2px; background: repeating-conic-gradient(#3b6fd8 0 25%, #a8bff0 0 50%) 0 0/8px 8px; }
  .mk-sec { padding: 12px 16px 14px; border-bottom: 1px solid var(--line); }
  .mk-sec h3 { font: 600 13px/18px var(--f-ui); margin: 0 0 8px; }
  .mk-sec .mk-row { margin: 0; flex-wrap: wrap; gap: 8px; }
  .mk-pop { position: fixed; z-index: 50; background: var(--panel, #fff); border: 1px solid var(--line-strong); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.15); padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; font: 13px var(--f-ui); color: var(--ink); }
  .mk-pop label { display: flex; align-items: center; gap: 8px; height: 26px; }
  .mk-ph { display: flex; gap: 0; }
  .mk-ph button { flex: 1 1 0; height: 48px; min-width: 44px; display: grid; place-items: center; gap: 2px; border: 1px solid var(--line); background: var(--well); color: var(--ink-2); font: 500 11px/1 var(--f-ui); }
  .mk-ph button:first-child { border-radius: 8px 0 0 8px } .mk-ph button:last-child { border-radius: 0 8px 8px 0 }
  .mk-ph button[aria-checked=true] { background: var(--seg-on, #fff); border-color: var(--line-strong); color: var(--ink); }
  .mk-ph button svg { width: 20px; height: 20px; }
  .mk-phtg { display: flex; gap: 8px; margin-top: 10px; }
  .mk-phtg > * { flex: 1 1 0; height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--line); border-radius: 8px; background: none; color: var(--ink); font: 14px var(--f-ui); }
  .mk-phtg > [aria-pressed=true] { background: var(--seg-on,#fff); border-color: var(--line-strong); }
  .mk-phtg svg { width: 18px; height: 18px; }
  `;
  document.head.append(css);
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  const lang = document.documentElement.lang && document.documentElement.lang.startsWith('ru') ? 'ru' : 'en';
  const N = NAMES[lang];
  const T = lang === 'ru' ? { out: 'Контуры', unit: 'Единичная окружность', n: 'Секторы фазы', more: 'Ещё', style: 'Стиль', view: 'Вид', vo: 'Контур вида', key: 'Ключ фазы' } : { out: 'Outlines', unit: 'Unit circle', n: 'Phase sectors', more: 'More display options', style: 'Phase style', view: 'View', vo: 'View outline', key: 'Phase key' };
  const styleSeg = (cls = 'mk-seg', labelAll = false) => `<div class="${cls}" role="radiogroup" aria-label="${T.style}">${IDS.map((id, i) => `<button role="radio" aria-checked="${i === 0}" aria-label="${N[i]}" data-tip="${N[i]}">${S[id]}${i === 0 || labelAll ? `<span>${N[i]}</span>` : ''}</button>`).join('')}</div>`;
  const nSel = `<label class="mk-n" data-tip="${T.n}"><span>n</span><select aria-label="${T.n}"><option>8</option><option selected>12</option><option>16</option><option>24</option></select></label>`;
  const tg = (ic, lab, on = true) => `<button class="mk-tg" aria-pressed="${on}" aria-label="${lab}" data-tip="${lab}">${I[ic]}</button>`;
  const hideDisp = (side) => { for (const b of document.querySelectorAll(`#${side} .disp-btn`)) b.style.display = 'none'; };
  return {
    // A: inline in the pane head
    A() {
      hideDisp('paneL');
      const head = document.querySelector('#paneL .pane-head'), ft = head.querySelector('.options');
      head.insertBefore(el(`<div class="mk-row">${styleSeg()}${nSel}<span class="mk-sep"></span>${tg('outline', T.out)}${tg('unit', T.unit)}</div>`), ft);
    },
    AX() {
      hideDisp('paneL'); hideDisp('paneR');
      let head = document.querySelector('#paneR .pane-head'), ft = head.querySelector('.options');
      head.insertBefore(el(`<div class="mk-row"><button class="mk-pat" aria-haspopup="dialog" aria-label="Pattern: Checker" data-tip="Pattern: Checker"><span class="sw"></span><svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4"/></svg></button>${tg('view', T.vo)}${tg('key', T.key, false)}${tg('unit', T.unit)}</div>`), ft);
      head = document.querySelector('#paneL .pane-head'); ft = head.querySelector('.options');
      head.insertBefore(el(`<div class="mk-row">${tg('unit', T.unit)}</div>`), ft);
      const c = head.parentElement.querySelector('.legend-chip'); 
    },
    // B: a View section in the right-hand panel
    B() {
      hideDisp('paneL');
      const insp = document.querySelector('#inspector, .insp, #rightPanel, aside.right') ;
      const nums = [...document.querySelectorAll('h2, h3, .sec-h, div')].find((e) => e.children.length < 3 && /^(Numbers|Числа)$/.test(e.textContent.trim()));
      const sec = el(`<section class="mk-sec"><h3>${T.view}</h3><div class="mk-row">${styleSeg('mk-seg', false)}</div><div class="mk-row" style="margin-top:8px">${nSel}${tg('outline', T.out)}${tg('unit', T.unit)}</div></section>`);
      let host = nums; while (host && host.parentElement && !host.parentElement.querySelector(':scope > *:nth-child(2)')) host = host.parentElement;
      (nums.closest('section') || nums.parentElement).before(sec);
    },
    // C: a slim pop-up, title and style gone
    C() {
      const b = document.querySelector('#paneL .disp-btn'); const r = b.getBoundingClientRect();
      b.style.background = 'var(--seg-on)';
      const p = el(`<div class="mk-pop" role="dialog" aria-label="Display options"><label>${nSel}</label><label><input type="checkbox" checked> ${T.out}</label><label><input type="checkbox" checked> ${T.unit}</label></div>`);
      document.body.append(p); p.style.top = (r.bottom + 6) + 'px'; p.style.left = (r.right - p.offsetWidth) + 'px';
    },
    // phone: the Display sheet, title gone, styles as one icon row, toggles as two buttons
    PH() {
      const box = document.querySelector('.ph-sheet:not([hidden]) .ph-body, .ph-sheet .ph-body');
      const sheet = [...document.querySelectorAll('.ph-style')][0];
      if (!sheet) return 'nosheet';
      const body = sheet.parentElement;
      for (const hh of body.querySelectorAll(':scope > h3')) if (/This view|Этот вид/.test(hh.textContent)) hh.remove();
      sheet.replaceWith(el(`<div><div class="mk-ph" role="radiogroup" aria-label="${T.style}">${IDS.map((id, i) => `<button role="radio" aria-checked="${i === 0}" aria-label="${N[i]}">${S[id]}<span>${N[i]}</span></button>`).join('')}</div><div class="mk-phtg"><label style="font:14px var(--f-ui)">n <select style="height:36px;font:15px var(--f-ui)"><option>8</option><option selected>12</option><option>16</option><option>24</option></select></label><button aria-pressed="true">${I.outline}${T.out}</button><button aria-pressed="true">${I.unit}${lang === 'ru' ? 'Окружность' : 'Unit circle'}</button></div></div>`));
      const vo = body.querySelector('.ph-vopts'); if (vo) vo.style.display = 'none';
      return 'ok';
    },
  };
})();
