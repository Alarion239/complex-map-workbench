// Shapes shared by the pure maths files (issue #20, phase 1). Global declarations: types/*.d.ts is part of the
// tsconfig, and the JSDoc of cx.js, parse.js, calc.js, funcs.js, region.js and inverse.js names them directly.

/** A complex number as the maths files pass it around. */
type Cx = { re: number, im: number };

/** A node of a parsed formula (parse.js): t is the node kind; the other fields depend on it (a, b: operands, f: function,
 *  n: a name or a root index, v: a value). */
type ParseNode = { t: string, [field: string]: any };

/** One step of a chain: its type and its parameters, written as the strings the interface shows. */
type ChainStep = { type: string, params: { [name: string]: any }, [field: string]: any };

/** A drawn region: its kind and the geometry of that kind (disc, rect, polygon, halfplane, annulus, sector, ...). */
type Region = { kind: string, [field: string]: any };

/** The zeros and poles found by Calc.zerosPoles: the list, with flags when the count or the work budget ran out. */
type ZeroPoleList = any[] & { truncated?: boolean, incomplete?: boolean, evals?: number };

/** An exact rational part of a polynomial (inverse.js): value n / d, n the [re, im] BigInt pairs (lowest degree first). */
type ExactPart = { n: Array<[bigint, bigint]>, d: bigint };

/** A Gaussian integer [re, im] as BigInts (inverse.js, the exact rational parts). */
type GInt = [bigint, bigint];

/** What the page's `$(id)` returns: an element, with the properties of the form controls, the details, the canvases and
 *  the range sliders the page reads through it (util.js: `$` is `getElementById`, whose element type the id does not
 *  narrow). Optional, so that a cast to the control's own type (HTMLInputElement, ...) still overlaps. */
type PageEl = HTMLElement & { value?: any, checked?: boolean, open?: boolean, disabled?: boolean, width?: any, height?: any, min?: any, max?: any, step?: any, select?: () => void, getContext?: (kind: string, opts?: any) => any };
