// The steps view's Landscape glide, exact: the count of the cells the block's planes cross (the clipped draw's list) changes by at most the bound between continuous
// frames, in every case, with and without All sheets; the cases and checks are test/lib/land_exact.js's (its stradOnly part).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js), in parts by CMW_ONLY (ci/browser_suites.js).
// Prints {pass, fails, info}.
return await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'land_exact.js'), 'utf8'))([false, true], { stradOnly: true });
