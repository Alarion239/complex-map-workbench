await nav('http://127.0.0.1:9053/notes/sound/v2/board.html'); await sleep(500);
await view(1200, 900, false);
const l0 = logs();
await click(600, 300); await sleep(800);
const st = await ev('JSON.stringify(__board.state())');
const m = fs.readFileSync(path.join(DIR, '../measure.js'), 'utf8'); await ev(m + '; 1');
const one = await ev('(async () => { const a = await __M.measure(await (async()=>Sound.render((g,t)=>Sound.CATALOG.toggleOn.make(g,t,{pan:0}),1,{rate:48000,noClip:true}))()); const b = __M.measure(await SoundB.render((e,t)=>{e.play("toggleOn",{t0:t,seed:1})},1,{noClip:true})); return JSON.stringify({a,b}); })()', 60000);
await shot('smoke');
return { l0, st, one, logs: logs() };
