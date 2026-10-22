// body of a Function(ev, sleep) returning evp(asyncExpr, timeoutMs): evaluates an async expression in the page,
// polling a window global for its JSON result (the daemon's ev does not await page promises here)
return async (expr, timeout = 600000) => {
  const id = '__evp' + Math.floor(Math.random() * 1e9);
  await ev(`(() => { window.${id} = undefined; Promise.resolve().then(async () => (${expr})).then((v) => { window.${id} = JSON.stringify({ v }); }, (e) => { window.${id} = JSON.stringify({ err: String(e && e.stack || e) }); }); return 1; })()`);
  const t0 = Date.now();
  for (;;) {
    const r = await ev(`window.${id}`);
    if (typeof r === 'string') { const o = JSON.parse(r); if (o.err) throw new Error(o.err); return o.v; }
    if (Date.now() - t0 > timeout) throw new Error('evp timeout');
    await sleep(100);
  }
};
