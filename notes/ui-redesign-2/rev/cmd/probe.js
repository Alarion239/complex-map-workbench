const ST = { shapes: [
  { id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' },
  { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] } ],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }],
  srcView: { cx: 0, cy: 0, s: 52 }, pattern: 'checker' };
await view(1440, 900, false, false);
await load('rev1', ST);
await sleep(1500);
await ev(`__cmwSetMain('phase')`); await sleep(1500);
return { cv: await ev(`[...document.querySelectorAll('#plotL canvas, #plotL > *')].map(c=>c.tagName+'#'+c.id+'.'+c.className+' '+c.width+'x'+c.height)`), st: await ev(`Object.keys(__cmwState())`), lay: await ev('__cmwLayout()'), logs: logs().slice(0,5) };
