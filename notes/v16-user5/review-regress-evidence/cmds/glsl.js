const out = {};
await send('Page.navigate', { url: 'http://localhost:9507/glsl-test.html' });
let r = null;
for (let i = 0; i < 2400; i++) { await sleep(500); r = await ev('window.__glslTest && window.__glslTest.done ? JSON.parse(JSON.stringify({done: __glslTest.done, chains: __glslTest.chains, total: __glslTest.total, compared: __glslTest.compared, failCount: __glslTest.failCount, errors: __glslTest.errors, failByChain: __glslTest.failByChain, singularBad: __glslTest.singular.badCount, rangeRows: __glslTest.rangeRows, skippedRangeF32: __glslTest.skippedRangeF32, skippedRangeCut: __glslTest.skippedRangeCut, failures: __glslTest.failures.slice(0, 3)})) : null'); if (r) break; }
out.glsl = r;
out.logs = logs().filter((l) => l.t === 'EXC' || /error/.test(l.t)).slice(0, 10);
return out;
