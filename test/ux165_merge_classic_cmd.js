// v16.5 wave 1 merge, classic view only: Y's head carries the "Y · " tag (the plane) and is not cut. Y is the classic
// view's right pane; the steps view has one plane and no such head. The rest of the merge look is ux165_merge_cmd.js.
// A command file for a CDP daemon (test/cdp_kit README).
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const NS = 'w1mc' + (Date.now() % 100000);
await view(1366, 768, false, false);
await load(NS, { v3: true, v4: true, unit: true, snap: true, shapes: [], steps: [], nextId: 10, focus: 0 });
await settled({ until: `!!document.getElementById('rightTitle')` });
const h = await ev(`(() => { const t = document.getElementById('rightTitle'), p = t && t.querySelector('.ptitle');
  return { title: t ? t.textContent.trim() : null, cut: p ? p.scrollWidth > p.clientWidth + 1 : null, tiny: document.getElementById('paneR').classList.contains('tiny') }; })()`);
info.head = h;
ok('L1 Y\'s head carries the Y tag, whole', h.title && /^Y ·/.test(h.title) && !h.cut && !h.tiny, h);
return { pass: fails.length === 0, fails, info };
