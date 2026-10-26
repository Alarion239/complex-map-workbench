await nav('http://localhost:9507/test.html?ns=fx16smoke');
await sleep(2500);
const l = await logs();
return { title: await ev('document.title'), errs: l.filter((x) => x.t === 'EXC' || x.t === 'error').slice(0, 5), hooks: await ev('typeof __cmwMorph + typeof GLR.evalMap') };
