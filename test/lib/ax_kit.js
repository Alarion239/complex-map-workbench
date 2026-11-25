// A control's role, name and state as Chrome's accessibility tree has them (what a screen reader or a voice-control user gets), for a
// command file for a CDP daemon:
//   const { axOf } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'ax_kit.js'), 'utf8'))({ send });
// axOf(selector, i = 0) answers null when the i-th element that selector matches (document order) is missing or left out of the tree,
// else { role, name, state }: its role ('button', 'switch', 'slider', ...), its accessible name, and its pressed, checked or expanded value as a
// string ('true', 'false', 'mixed'), null when it has none. It turns the Accessibility domain on at its first call.
({ send }) => {
  let enabled = false;
  const axOf = async (selector, i = 0) => {
    if (!enabled) { await send('Accessibility.enable', {}); enabled = true; }
    const { root } = await send('DOM.getDocument', { depth: 0 });
    const { nodeIds } = await send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
    if (!nodeIds[i]) return null;
    const { nodes } = await send('Accessibility.getPartialAXTree', { nodeId: nodeIds[i], fetchRelatives: false });
    const n = nodes && nodes[0];
    if (!n || n.ignored) return null;
    const st = (n.properties || []).find((p) => p.name === 'pressed' || p.name === 'checked' || p.name === 'expanded');
    return { role: n.role && n.role.value, name: n.name ? n.name.value : '', state: st ? String(st.value.value) : null };
  };
  return { axOf };
}
