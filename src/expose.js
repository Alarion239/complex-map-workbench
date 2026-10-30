// The test page's globals (issue #20, phase 4; written by tools/to_esm.js): the names a classic script made global, for
// the browser suites that reach them by name. Only in the test bundle: tools/bundle.mjs gives this file no text in the
// published one.
import { $, DEG, TAU, h } from './util.js';
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { Funcs } from './funcs.js';
import { HomRange } from './homrange.js';
import { Inverse } from './inverse.js';
import { Recognize } from './recognize.js';
import { Calc } from './calc.js';
import { GLChain } from './glsl.js';
import { Lines, Region } from './region.js';
import { Constr } from './constr.js';
import { Curves } from './curves.js';
import { SphereMesh } from './sphere.js';
import { Palette } from './palette.js';
import { GLR } from './gl.js';
import { Axes, Pane, Views } from './view.js';
import { Figure } from './figure.js';
import { HT_LIB, SND_LIB, Sound } from './sound.js';
import { Tour } from './tour.js';
import { Inspector } from './inspector.js';
import { PlaneMenu } from './planemenu.js';
import { Construct } from './construct.js';
import { Params } from './params.js';
import { Phone } from './phone.js';
import { SEASONG } from './seasong.js';
import { Commands } from './commands.js';
import { SoundHooks } from './soundhooks.js';
import { Export } from './export.js';
import { MorphPaths } from './morphpaths.js';
import { Integrals } from './integrals.js';
import { Examples } from './examples.js';
Object.assign(globalThis, { $, DEG, TAU, h, CX, Expr, Funcs, HomRange, Inverse, Recognize, Calc, GLChain, Lines, Region, Constr, Curves, SphereMesh, Palette, GLR, Axes, Pane, Views, Figure, HT_LIB, SND_LIB, Sound, Tour, Inspector, PlaneMenu, Construct, Params, Phone, SEASONG, Commands, SoundHooks, Export, MorphPaths, Integrals, Examples });
