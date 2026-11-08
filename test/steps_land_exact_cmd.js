// The steps view's Landscape glide is exact, with the Inside regions' sheets off: the cases and checks are test/lib/land_exact.js's.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
return await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'land_exact.js'), 'utf8'))([false]);
