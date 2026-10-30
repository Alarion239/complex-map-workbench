// Stand-ins for the app's modules that a test page or a node test loads without (issue #20, phase 3): the sources no
// longer check whether a module of theirs is there, so a page that inlines only part of src/ defines the missing ones
// here, before the sources. Each reads nothing and offers nothing, as the absent module did: the recognizer reads no
// formula (a custom step stays one step), curve formulas are not available. A module the page does load replaces its
// stand-in (its own declaration comes later and wins on the global).
if (typeof globalThis.Recognize === 'undefined') globalThis.Recognize = { key: () => '', hasParam: () => false, generic: (a) => a, chain() { throw new Error('no recognizer'); } };
if (typeof globalThis.Curves === 'undefined') globalThis.Curves = { fromFormula() { throw new Error('Curve formulas are not available in this build'); } };
