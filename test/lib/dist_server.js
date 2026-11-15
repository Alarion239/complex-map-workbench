// A server for dist/ whose test.html can arrive late, for the kit's tests of a document that stalls (kit_load_wait_cmd.js,
// kit_go_link_cmd.js). An expression for eval in a suite (http, fs, path and DIR are the suite's):
// `const { serveDist } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'dist_server.js'), 'utf8'))({ http, fs, path, DIR })`.
// - serveDist(late, o): resolves to the listening server once it is up. late(n) says whether the n-th test.html it serves arrives
//   late: o.partial bytes (default 1 MB) at once and the rest o.holdMs later, or never when there is no o.holdMs; every other file
//   is served whole. The answers are not cached (no-store), so a navigation again is another request. srv.origin is its address,
//   srv.tests the test.html requests so far, srv.log each one as 'ms since the server began: #n url'; the caller ends it with
//   srv.closeAllConnections(); srv.close().
({ http, fs, path, DIR }) => {
  const DIST = path.join(DIR, '..', '..', 'dist');
  const serveDist = async (late, o = {}) => {
    const partial = o.partial || 1 << 20;
    const srv = http.createServer((req, res) => {
      const buf = fs.readFileSync(path.join(DIST, req.url.split('?')[0])), isTest = req.url.startsWith('/test.html');
      res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Length', buf.length); res.setHeader('Cache-Control', 'no-store');
      if (isTest) { srv.tests++; srv.log.push(`${Date.now() - srv.t0} ms: #${srv.tests} ${req.url.slice(0, 40)}`); }
      if (!(isTest && late(srv.tests))) { res.end(buf); return; }
      res.write(buf.subarray(0, partial));
      if (o.holdMs) setTimeout(() => res.end(buf.subarray(partial)), o.holdMs);
    });
    srv.tests = 0; srv.log = []; srv.t0 = Date.now();
    await new Promise((done) => srv.listen(0, done));
    srv.origin = 'http://localhost:' + srv.address().port;
    return srv;
  };
  return { serveDist };
}
