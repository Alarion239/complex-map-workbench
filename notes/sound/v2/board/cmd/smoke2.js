const r = await ev(`JSON.stringify({ a: __M.measure(await Sound.render((g,t)=>Sound.CATALOG.toggleOn.make(g,t,{pan:0}),1,{rate:48000,noClip:true})), b: __M.measure(await SoundB.render((e,t)=>{e.play("toggleOn",{t0:t,seed:1})},1,{noClip:true})) })`, 60000);
return { r, logs: logs() };
