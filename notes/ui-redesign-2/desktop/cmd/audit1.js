const ST = { shapes: [
  { id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' },
  { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] },
  { id: 's3', kind: 'point', p: [0, 0], label: 'z₀' } ],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5, -0.5i', poles: '1.6' }, on: true }],
  srcView: { cx: 0, cy: 0, s: 52 }, pattern: 'checker' };
await view(1440, 900, false);
const r = await load('dsk1', ST);
await sleep(2500);
const m = await ev(`(()=>{const q=(s)=>__qa.vis(s);return {top:q('#top'),left:q('#leftPanel'),right:q('#rightPanel'),stage:q('#stage'),panes:q('#panes'),paneL:q('#paneL'),paneR:q('#paneR'),pipe:q('.pipe-wrap'),pipeHead:q('.pipe-head'),pipeline:q('#pipeline'),card1:q('#pipeline .card[data-k="1"]'),card3:q('#pipeline .card[data-k="3"]'),thumb:q('#pipeline .card[data-k="1"] .thumb'),params3:q('#pipeline .card[data-k="3"] .params'),props:q('#propsPanel')}})()`);
return { r, m, logs: logs().slice(0, 5) };
