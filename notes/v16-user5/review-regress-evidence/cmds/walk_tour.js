// The walk's tour section alone (RU, 1440), each call timestamped to a log file, after Sound on as in the walk.
const LOG = '<tmp>';
const B = globalThis.__WB || '';
const lg = (m) => fs.appendFileSync(LOG, `${new Date().toISOString().slice(11, 19)} ${m}\n`);
await view(1440, 900, false, false);
await nav(`http://localhost:9707/${B}test.html?ns=rrwt${Date.now()}&lang=ru`); await sleep(4000);
lg('loaded ' + B);
await key('M', 8); await sleep(1500); await key('M', 8); await sleep(400);
lg('sound toggled');
const chapters = await ev(`Tour.chapters().map((c) => c.id)`);
for (const ch of chapters) {
  lg('start ' + ch);
  await ev(`Tour.start({ chapter: ${JSON.stringify(ch)} }), 1`); await sleep(1500);
  for (let s = 0; s < 40; s++) {
    const cur = await ev(`JSON.stringify(Tour.current())`);
    lg('  cur ' + cur);
    if (cur === 'null' || !cur.includes(`"${ch}"`)) break;
    await sleep(700);
    await ev(`Tour.next(), 1`); await sleep(900);
  }
  await ev(`Tour.stop(), 1`); await sleep(800);
  lg('stopped ' + ch);
}
lg('DONE');
return { ok: true, logs: logs().filter((l) => l.t === 'EXC' || l.t === 'error').slice(0, 10) };
