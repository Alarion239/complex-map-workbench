# Hear the function: four options to choose from

> **v2 note (2026-10-24, after the reviews).** The page now differs from this note in two places. Option 3's note is
> the small ring's exact winding number, with the Taylor coefficients only as colour. Option 4 plays its phase
> compressed, so W is also the loudest harmonic. See [`PROTOTYPE.md`](PROTOTYPE.md) and [`README.md`](README.md).

The user (2026-10-24): "I still think it is not the same … Maybe we don't need each point sound? Maybe it should be
composite of a curve or a function? … Just please see what is done and give me a few options to choose."

This note proposes four ways for the function to sound. Each one is built on the research in
[`research-literature.md`](research-literature.md) and [`research-practice.md`](research-practice.md). Nobody here has
listened to any of them. Every "sounds like" is a prediction from acoustics, from the code of similar work, or from
the spectra computed for this note (§6). The choice is meant to be made by ear, on the seven scenes of §7.

**In short.** There are four ways the function could sound:

1. **Sung point.** Today's idea played on a real instrument (cello, choir, glass, reed). It sounds only while you move.
2. **Phase harp.** Each colour line you cross plucks one note of a scale. When you stop, it is silent.
3. **The ring.** A singer holds a low D under the pointer, and a whistled overtone tells you what is there: a third
   above for a simple zero, a fifth for a double zero, lower notes for poles.
4. **Curves sing.** A closed curve sings one note, and the note is its winding number. During the deformation the
   note steps when a zero crosses the curve.

Options 1, 2 and 3 are for the pointer; choose one. Option 4 is for curves and goes with any of them.

## 0. Why today's tone feels "not the same"

Today: a Shepard tone whose pitch class is arg F at the pointer (DESIGN §2.5). The research points to four causes:

1. **The sound itself is synthetic.** It is nine pure sines. A plain sine sonification was rated annoying in user
   studies (Sonification Handbook ch. 7). The timbre work (`v2/timbres.js`: cello, choir, glass, reed) fixes this.
2. **The illusion is uneasy by design.** An endless glide with no home is the effect film composers use for tension
   (Zimmer, *Dunkirk*). Nothing in it says "here is 0".
3. **It runs as long as you hover.** Sound that only starts when you act is reported as less tiring (Handbook ch. 16).
   Good explorables also play sound on demand (research-practice §7).
4. **One number, but the picture is a field.** The phase portrait shows how colour is arranged around a point: zeros,
   poles, cuts. The tone gives only one value, arg F, at one point. The strongest mathematical sonifications (2swap's
   pendulums, CodeParade's fractals, the zeta function) let the ear hear a **whole periodic shape as a timbre**.

Timbres fix cause 1 only. The options differ in how they handle causes 2 to 4.

## 1. The four options at a glance

| | **1. Sung point** | **2. Phase harp** | **3. The ring** | **4. Curves sing** |
|---|---|---|---|---|
| What sounds | arg F at the pointer, as a continuous glide | arg F at the pointer, as notes plucked when you cross colour lines | F on a small circle around the pointer, played as one waveform | F along a closed curve (a loop, a shape, a growing circle), played as one waveform |
| What you hear about F | the value of arg F and how it turns | how fast arg F turns, which way, and how many turns | the order of a zero or pole under the pointer, and how close a pole or cut is | the winding number of the curve, as a pitch; how it changes during the deformation |
| Natural model | a cello or choir sliding over a drone (as in a raga) | a harp playing a pentatonic scale | overtone singing: a held low D with a whistled overtone | the same singer; the loop chooses the overtone |
| When it sounds | while you move; rings down in about 1 s | only at a crossing; each note rings for 1.8 s | while you move; fades in 0.9 s | when a loop is drawn or released, on request, and while the deformation plays |
| Family (research) | parameter mapping | parameter mapping, played as event notes | wave-terrain: F read around a closed path | audification of a curve |
| New work | small (timbres.js exists) | medium | medium-large | medium-large (shares 3's engine) |
| Main risk | still the endless illusion | no sound between notes | mostly a steady tone between zeros | needs a curve; new idea, untested |

How each option meets the research findings (research-literature §6–7, research-practice §8):

| | 1. Sung point | 2. Phase harp | 3. The ring | 4. Curves sing |
|---|---|---|---|---|
| A real or natural timbre | yes (timbres.js) | yes (plucked string) | yes (overtone voice) | yes (overtone voice) |
| Silent when you stop | rings down in about 1 s | yes | fades in 0.9 s | yes, after the note |
| Notes on a scale, not between | no (continuous glide) | yes (D pentatonic) | yes (harmonic series) | yes (harmonic series) |
| A fixed home to compare with | the drone | the low D | the hum | the hum |
| Hears arg F itself | yes | in 5 steps per turn | no | no |
| Hears the structure around a point | no | how fast arg F turns | yes (order, nearby poles) | no |
| Winding number by ear | bells | count the low Ds | only of the small ring (the order) | one note |
| Uses the 2swap / CodeParade idea (a shape played as a waveform) | no | no | yes | yes |

The options are not exclusive. The pointer can use **1, 2 or 3**. Option **4** is about curves, so it pairs with any of
them, or with none. In all four, D is home, so they fit palette B's D-pentatonic cues.

---

## 2. Option 1: the sung point (today's mapping, made natural)

**Idea.** Keep what works today: arg F is the pitch class, tracked exactly, with the turn bell. Change what the sound
is made of and when it plays. It sounds like a real instrument, played by your motion, over a quiet drone that marks
arg 0.

**What you hear about F**
- arg F as the interval above the drone. 0° is unison, 210° a fifth (A over D), 90° a minor third.
- The drone makes these intervals *absolute*. Reference tones are what let listeners read values from an auditory
  graph, not only trends (Smith & Walker 2005, [doi:10.1002/acp.1146](https://doi.org/10.1002/acp.1146)).
- Winding is heard as today. A loop around a zero of order m climbs m cycles, with a bell on each turn. A pole falls.

**What it sounds like** (prediction)
- A cello, or a small choir, sliding between notes over a held low D.
- Slow glides between notes are a normal ornament in Hindustani music, sung and played on sarangi, sitar and bansuri
  ([meend](https://en.wikipedia.org/wiki/Meend)). So the glide itself can sound musical. What stays unusual is that
  the glide never ends.
- Arg F = 0 is consonant: the voice lands in unison with the drone. Near 0, at ±30°, it rubs against the drone a
  semitone away.
- Still: the voice rings down in about a second.
- The endless climb around a zero remains a Shepard glide. The drone gives it a home, but it does not make it less
  endless.

**Interaction.** As today: hover in X, the landscape probe, the deformation under a still probe, loops, and "Listen
along γ".

**Build spec**
- **Pitch.** Unchanged: DESIGN §2.5 and `src/sound.js` SH. pc = arg F / 2π, arg 0 = D. The bell has σ 0.95 octave and
  centre 4.1 + 0.3·tanh(ln|F|/2.5). The exact tracker and the 0.17 s half-turn glide stay.
- **Timbre.** `Timbres.ShepardVoice(G, 'sonify', kind)`, kind ∈ {cello, choir, glass, reed}. The user picks one by
  ear.
- **Bowed by activity**, replacing the 1.6 s hold, the fade and the 6 s release:
  - activity a = max(pointer speed / 300 px s⁻¹, |Δ arg F| / Δt / 0.5 turn s⁻¹), clamped to [0, 1]. Under a still
    probe during the deformation, the same is measured from H_t.
  - Level = 0.45 + 0.55·√a while a > 0.02. Attack through the existing two one-pole smoothers, τ 40 ms.
  - If a < 0.02 for 120 ms, the bow lifts: the level decays with a T60 of 1.2 s.
- **|F|** keeps the register (±0.3 octave). It **leaves loudness**, because activity now sets loudness. Pitch and
  loudness also bias each other's perception (Neuhoff et al. 2002).
- **Drone.** A Shepard D (pc 0) in the same timbre and under the same bell, 15 dB under the voice, with no vibrato and
  the voice's own gate. It has an on/off switch and is on by default in this option.
- **Cost.** About +9 partials (+27 for choir), +1 to 3 % of one core. The bowing is about 20 lines in `app.js` and
  the worklet's gate.

**Risks.** The uneasiness of the endless glide is built into this option. The drone can clash at intervals near 0.
This option still answers only "what is arg F here".

---

## 3. Option 2: the phase harp (notes where colour changes)

**Idea.** Every line of the phase portrait you cross is a plucked note. The note is the line's pitch class, on the
D-major pentatonic scale. Between crossings the harp is silent. Model-based sonification works the same way: the
object sounds only when you excite it, and that is what makes it less tiring (Handbook ch. 16). Desmos marks crossings
with "pops" in the same spirit.

**What you hear about F**
- **Direction.** An upward run means arg F is increasing (counter-clockwise around a zero). A downward run means it is
  decreasing (around a pole).
- **Speed.** The note rate is 5 × (turns of arg F per second). Near a zero or pole the lines crowd, and a run becomes
  a glissando.
- **Order.** Circling a zero of order m plays the scale m times per lap.
- **Turns, exactly.** Each crossing of arg F = 0 is a D. It is accented, with a low D under it. Along a closed loop,
  the number of upward Ds minus downward Ds is **exactly the winding number**, by the argument principle.
- **|F**|. It moves the harp's register up or down by up to half an octave: lower near zeros, higher near poles.

**What it sounds like** (prediction)
- Silence until you move.
- Drifting across a smooth region gives an occasional single harp note.
- Passing a zero gives a quick 2 to 3 note run up or down. Circling one gives a rising pentatonic scale with a low D
  at each lap.
- A pentatonic scale has no semitones and no tritone, so overlapping notes always blend, as in wind chimes or a harp
  glissando. They never form a cluster.

**Interaction**
- Hover, the landscape probe, and the deformation under a still probe (notes as arg H_t crosses the lines).
- Loops: the runs play while you draw. The loop-closed pings and "Listen along γ" play the same notes.
- Keyboard probe: each step plays the notes it crossed. A step that crossed none plucks the current note softly (the
  scale note just below arg F), so every step answers.

**Build spec**
- **Note angles.** arg F ∈ {0°, 60°, 120°, 210°, 270°}, which are D, E, F♯, A and B. With 12 sectors (the default) or
  24, these lie on sector lines: lines 0, 2, 4, 7 and 9 of 12. With 8 or 16 sectors they do not; the notes still
  follow the angles.
- **Trigger.** Use the unwrapped arg Φ (in turns) from the existing tracker (`Calc.argStep`, as in `sndHover`).
  - For each probe update Φ₀ → Φ₁, fire every crossing of θⱼ + n, in order and once each.
  - Interpolate each note's time linearly across the update interval (at least 16 ms).
  - Direction = sign(Φ₁ − Φ₀).
  - Hysteresis is a Schmitt trigger on each line θ, with h = 1/96 turn (3.75°). An upward note fires when Φ rises
    past θ + h, having last been below θ − h. A downward note fires when Φ falls past θ − h, having last been above
    θ + h. A tremor that swings less than 7.5° across a line then plays nothing.
    - Unlike a "do not fire again for a while" rule, this keeps the count exact: up Ds minus down Ds equals the
      winding number whenever the loop starts more than 3.75° from arg 0.
    - The spoken W still comes from the tracker, as today.
  - **Near a zero or pole.** Within 8 px of a zero or pole (the radius of DESIGN §2.4, where its ping has already
    sounded), arg F swings far with every tremor. Only the D notes sound there, so the count stays exact without a
    flutter of notes.
  - A jump (tracker `why: 'jump'`, a cut) plays the cut cue and **no** notes.
- **Rate.**
  - Up to 14 notes/s: every note at its own velocity.
  - From 14 to 24 notes/s: velocity × 14/rate, so a glissando is a soft wash.
  - Above 24 notes/s: only the D crossings sound (one per turn), so the count survives.
- **Velocity.** 0.4 at |dΦ/dt| ≤ 0.1 turn/s, rising log-linearly to 0.85 at ≥ 1 turn/s.
- **The note.** Octave copies of the pitch class from D2 to D7, weighted by a Gaussian over log₂ f.
  - Centre: D5 (587 Hz) + 0.5·tanh(ln|F|/2.5) octave.
  - σ 0.7 octave. Copies under −30 dB are dropped, which usually leaves 3.
  - Each copy is a Karplus–Strong string (palette B's `pluck()`), with T60 1.8 s at D5 scaled by (f/587)^−0.5 and
    brightness 0.35 to 0.65 from velocity.
  - D notes add a D3 string at 0.5 and are +2 dB.
- **Polyphony.** At most 12 strings. The oldest is stolen with a 30 ms fade.
- **Levels.**
  - One note at velocity 0.7 is −32 LUFS-M. That matches the Shepard voice at |F| = 1: −32.0 measured in palette B,
    −32.8 today.
  - A run of 10 notes/s is about −30.
- **Cues.**
  - The turn bell is **off** in this option: the accented D is the turn.
  - Zero and pole pings, the cut, and loop closed stay as in palette B.
- **Optional, off by default: "tile edges".** Crossing a contour of |F| (|F| = e^(2πk/S)) adds a soft felt tap,
  higher when |F| grows. With the Tiles style, every edge of every tile then sounds.
- **Cost.** A string is a delay line and a one-pole filter. 36 strings take under 1 % of a core. Add a `pluck` message
  to the worklet and about 60 lines in `sndHover` to enumerate the crossings.

**Risks**
- arg F between the lines is not heard. The resolution is 60° to 90°.
- Only 5 of the 12 lines sound, which may surprise. An option could highlight those lines while sound is on.
- A 12-notes-per-turn chromatic variant would match every line, but a chromatic Shepard scale is the classic eerie
  illusion again. It is not recommended.

---

## 4. Option 3: the ring (the function around the pointer, as one tone)

**Idea**
- A small circle of radius r (20 px) travels with the pointer. F on that circle, read once per period, is the
  waveform. This is wave-terrain synthesis (research-practice §4), with the phase portrait as the terrain.
- For holomorphic F, the harmonics of this waveform are **the Taylor or Laurent coefficients at the pointer**:
  F(a + r e^{iθ}) = Σ c_k r^k e^{ikθ}.
- So the ear hears the local structure of F, not one value. This is the idea behind Grond's SonicFunction, which
  sonified the first Taylor terms at the cursor
  ([ICAD 2010](https://pub.uni-bielefeld.de/record/2017190)).

**The harmonic map** (this is what makes zeros and poles audible on one speaker)

- **The problem.** Played raw, with Re on the left and Im on the right, a zero (e^{+iθ}) and a pole (e^{−iθ}) differ
  only in their sense of rotation. On a phone speaker or one earbud they sound the same.
- **The fix.** Play Re[F̂(θ) · e^{4iθ}], where F̂ is F on the ring scaled to unit RMS. This shifts every coefficient
  up by 4 harmonics.
- With f₀ = D3 (146.8 Hz), the harmonic series becomes a scale for the order at the pointer:

| Inside the ring | Dominant harmonic | Note | Interval from home |
|---|---|---|---|
| no zero or pole | 4 | D5 (587 Hz) | home |
| a simple zero | 5 | F♯5 | major third up |
| a double zero | 6 | A5 | fifth up |
| a triple zero | 7 | C6 (−31 cents) | "blue" seventh |
| zeros of order 4 | 8 | D6 | octave up |
| a simple pole | 3 | A4 | fourth down |
| a double pole | 2 | D4 | octave down |
| a triple pole | 1 | D3 | two octaves down |

- Zeros climb a major chord and poles fall through the harmonic series. One harmonic dominates exactly when Rouché's
  theorem applies: if |c_m r^m| exceeds the sum of the other terms, F winds m times on the ring.
- **Why harmonics 1 to 8.** The ear can pick out a single harmonic of a tone only up to about the 5th to 8th. Above
  the 8th, harmonics are poorly resolved, if at all ([Moore & Gockel 2011](https://www.mrc-cbu.cam.ac.uk/bibliography/articles/7215),
  abstract). Orders from −3 to +4 land on harmonics 1 to 8, so the common cases are in the range the ear resolves.
  Higher orders still sound as a whistle when one harmonic clearly dominates, as overtone singers show (below).
- **Why this is natural: overtone singing.** In a Western overtone-singing demonstration the singer holds a fixed
  fundamental of about 130 Hz and sings a scale on overtones 4 to 16. Listeners hear "a whistle over the drone of the
  fundamental and lower harmonics" ([Utrecht phonetics](https://audiufon.hum.uu.nl/data/e_boventoon.html)). Our f₀
  (D3, 147 Hz) and harmonics (1 to 8) sit in the same range. The overtone peak in this singing is unusually narrow
  ([Bloothooft et al., ICPhS 1991](https://www.coli.uni-saarland.de/Phonetics/icphs/ICPhS1991/12_ICPhS_1991_Vol_5/p12.5_014.pdf);
  full study: JASA 92, 1827–1836, 1992). The jaw harp works the same way: the reed holds the fundamental and the
  mouth picks the harmonic ([Wikipedia](https://en.wikipedia.org/wiki/Jew%27s_harp)). So "a fixed low note whose
  overtone moves" is an old, natural sound, not a synthetic one.

**What you hear about F** (computed, §6)
- **A simple zero nearby.** Its harmonic (F♯5) fades in as you approach, relative to home. A zero of order m passes
  through the lower steps on the way: for z², the third leads at δ = r and the fifth takes over inside r/2 (§6).

  | Distance δ | Level relative to home |
  |---|---|
  | 3r (60 px) | −9.5 dB |
  | 2r | −6 dB |
  | r | equal (a major-third dyad) |
  | r/2 | +6 dB |
  | 0 | alone |

- **A nearby pole or cut makes the tone brighter.** Harmonics fall off by 20·log₁₀(δ/r) dB per step:

  | Distance δ to the pole | Fall-off per harmonic | Character |
  |---|---|---|
  | 5r | 14 dB | pure |
  | 1.5r | 3.5 dB | rich |
  | 1.1r | 0.8 dB | a buzz |

  The tone "opens up" as you near a pole.
- **A branch point inside the ring** (√z) gives no clean note: harmonics 4 and 5 are equal, with sidebands at −9.5
  and −14 dB on both sides. It is a rough, reedy sound that means "something non-integer is here".
- **An essential singularity** (e^{1/z}, ring centred on it) has its energy on negative k, and it moves further down as
  r shrinks.
  - At r = 0.5, k = −1 and −2 lead. These play as A4 and D4, a chord of "pole" notes.
  - At r = 0.25, five coefficients lie within 6 dB (k = −2 to −6). Most of them fold onto harmonic 1 (see the build
    spec below), so you hear a loud low D3 growl with D4 above it, not a clear note.
  - This is honest, but it tells you little. The readout on screen has to say what the point is.
- **arg F itself is not heard.** The colours are not heard, only the arrangement of colours around the point.

**What it sounds like** (prediction)
- A singer humming a low D3 ("oo") with a whistled overtone above it, as in overtone singing or a jaw harp.
- At an ordinary point the overtone is D5, steady.
- Gliding toward a zero, F♯5 swells in until the overtone has moved up a third.
- Toward a pole it brightens into a reedy buzz, then drops to A4.
- Still: it fades.

**Interaction**
- Hover, the landscape probe, and the keyboard probe (a 280 ms sample per step, as today).
- During the deformation the ring is re-read every frame. A zero of H_t passing through the ring is heard as a
  crossfade between two harmonics.
- The ring is drawn (1 px, 35 % ink) while it sounds, so you can see what you hear.

**Build spec**
- **Ring.** Centre a = the probe. r = 20 CSS px converted to z units, so it scales with zoom like the picture.
  M = 64 samples, or 128 when max|F| / median|F| > 8 on the ring.
- **Samples.** w_j = F(a + r e^{2πij/M}).
  - Clamp |w_j| ≤ 30 × median|w|, keeping the phase, so a pole on the ring is a loud click, not infinity.
  - Normalise to unit RMS, then take an M-point DFT to get c_k.
- **Harmonic amplitudes.** A_n = |c_{n−4}| for n = 1 … 24.
  - A Lanczos taper applies above n = 12.
  - Energy with n ≤ 0 (poles of order ≥ 4, rare) is added to n = 1.
  - **The phases of c_k are ignored.** Harmonic n keeps its own fixed offset φ_n (see the voice), so moving the
    pointer never clicks.
  - Amplitudes slew over 30 ms.
- **Voice: one overtone singer** (a new `HarmonicVoice` in the worklet, shared with option 4):
  - **One phase for all harmonics.** A single phase Φ runs at f₀ = D3. Harmonic n is A_n·sin(n·Φ + φ_n), with φ_n
    random but fixed. Every harmonic therefore shares the singer's pitch wobble, and they fuse as one voice. Do not
    detune harmonics against each other: that would sound like a chorus and blur the whistle.
  - **A living f₀.** Jitter is a 0.2 % random walk with a 30 ms time constant, and shimmer ±0.5 dB. Vibrato (5 Hz,
    ±8 cents) fades in only after the spectrum has been steady for 0.4 s. timbres.js's choir already has these
    generators.
  - **The drone (the hum).** Harmonics 1 to 3 at weights 1, 0.3 and 0.1, a closed "oo", 18 dB under the overtone. It
    is fixed, so it is the reference: the overtone's interval to it is what you read.
  - **Breath.** Aspiration noise band-passed at the strongest harmonic, q 6, −24 dB, gated by the glottal phase
    (the noise is louder in the open half of each period, as in timbres.js's choir).
  - **Room.** The short stereo FDN from timbres.js.
  - **Coinciding notes.** A pole of order 3 lands on harmonic 1, inside the drone. There the whistle disappears into
    a louder hum. That is acceptable for a rare case, which the readout names anyway.
- **Gate.** The same activity measure as option 1. It fades with a T60 of 0.9 s after activity stops.
- **Level.** −32 LUFS-M, the Shepard voice's level at |F| = 1 (RMS-normalised, so constant). **|F| is not heard.**
- **Cues.** Palette B's zero and pole pings and the cut stay.
- **Cost.**
  - 64 evaluations of F per frame, 3,840 per second. That is well under 1 ms a frame for typical chains.
  - Guard: if a frame's evaluations take more than 1.5 ms, drop to M = 32 and 30 Hz updates.
  - The worklet runs about 27 table sines plus noise, about 1 % of a core.

**Risks**
- Between zeros and poles it is mostly a steady D5 with a hum. It is the "plain sine" problem again, softened only by
  the voicing and the gate. This is the main risk, and only listening can settle it.
  - One knob to try by ear: play the home harmonic 9 dB under the others.
  - Then at an ordinary point the singer mostly hums, and the whistle appears as structure comes near: a zero's
    third, or a pole's brightness.
  - The levels in the table above then shift by 9 dB in favour of the zero's harmonic. For example, at δ = 3r the
    third is about level with home instead of 9.5 dB under it.
- It does not hear arg F, so the climbing-around-a-zero experience is gone. Circling a zero at a constant distance
  sounds constant.
- Many zeros inside the ring (z⁵⁰ − 1 when zoomed out) push the tone up to harmonic 24, which is shrill. Cap the
  level of n > 12.

---

## 5. Option 4: curves sing (the winding number is a pitch)

**Idea**
- Any closed curve γ is played as one period of a waveform: its **phase signal** e^{2πiφ(s)}, where φ is arg F / 2π
  along γ, tracked exactly.
- This is the 2swap and CodeParade move. In 2swap's double-pendulum video, viewers heard that two periodic orbits
  form a perfect twelfth without being told (research-practice §1.1).
- The signal is the image curve F(γ) that the app draws in Y, pushed onto the unit circle. So **the sound is the
  picture in Y**, wound around 0, played 147 times a second.

**The exact fact behind it.** For the phase signal, Σ k |b_k|² = W exactly, by Parseval: the mean of dφ/ds over one
period is the winding number. So **the centre of the spectrum is the winding number**. With the shift of option 3, a
loop's note is centred on harmonic 4 + W of D3:

| W | Note |
|---|---|
| 0 | D5 (home) |
| 1 | F♯5 |
| 2 | A5 |
| 3 | C6 |
| 4 | D6 |
| −1 | A4 |
| −2 | D4 |

The raw F does not have this property. For z − 0.6 on the unit circle, its spectral centre is 0.735, not 1 (§6). That
is why loops use the phase signal and the ring uses raw F.

**What the ear takes from it.** The ear does not hear a spectral centre as a pitch. It hears the strongest resolved
harmonic as the whistle and the rest as colour. In every ordinary loop of §6 the strongest harmonic is W itself, with
56 % to 99.7 % of the energy: a bean, a square, z³ − 1, sin z, and a zero near the edge. They part only when arg F
turns very unevenly, as for e^z on a large circle. Then there is no clear whistle, only a broad sound centred on home.
The exact W is still spoken, as today.

**What you hear about F**
- **The argument principle as a note.** The pitch centre is the number of zeros minus poles inside γ. The spread
  around it shows how unevenly arg F turns.

  | Curve | Spectrum |
  |---|---|
  | a circle around a simple zero at its centre | a pure F♯5 |
  | the same circle, with the zero 0.9 r off centre | 56 % of the energy on F♯5; the centre is still exactly 1 |

- **The deformation by ear.**
  - While H_t plays, the loop's note changes colour continuously.
  - Its centre cannot move until a zero or pole of H_t touches γ (Rouché and homotopy invariance). Then it steps one
    harmonic, through a short buzz: a zero on γ makes φ jump by half a turn.
- **"Hear the view."** A circle grows from the centre of the view to its corner in 4 s. The note steps up one harmonic
  for each zero it swallows and down one for each pole. This is N − P as a staircase on the harmonic series: one
  glance at the whole function.

**What it sounds like** (prediction)
- Each loop has its own sung note.
- Loops with the same W share a pitch centre. Their shape and the positions of the zeros colour it.
- A loop around nothing is the home D5.
- While drawing, the note steps D5 → F♯5 → A5 as the loop closes around each zero.
- Released, it sings for about 2.4 s, like a held chord, voiced as in option 3.

**Interaction**
1. Drawing a loop: the note sounds live, closed by the chord back to the start, 6 dB under the release note. It is
   silent for strokes under 30 px.
2. On release: a 2.4 s note. When Hear the function is on, it **replaces the |W| pings**; the spoken message stays.
3. The menu of any closed shape (circle, polygon, region boundary) gets **"Play as a note"**. "Listen along γ" stays:
   it is the slow melody; the note is the glance.
4. Deformation, playing or scrubbed: the selected or last loop sounds continuously under H_t.
5. "Hear the view": in the command palette and the Sound popover. Its circle is drawn as it grows.

**Build spec**
- **Samples.** Use `sndSample(F, pts, true)` (app.js). It gives M = 900 points evenly spaced in arc length, with φ
  unwrapped by the exact tracker. If it returns null or a cut, there is no note; play the cut cue, as today's "No
  winding number".
- **Coefficients.** b_k = DFT of e^{2πiφ_j} for k = −8 … 20, about 26 k multiply-adds.
  - The amplitude of harmonic n = 4 + k is |b_k|.
  - A Lanczos taper applies for |k − W| > 6.
  - Phases are ignored, as in option 3.
- **Voice.** Option 3's `HarmonicVoice`.
  - Release envelope: bowed attack 60 ms, hold 1.2 s, then a T60 of 1.2 s.
  - Level −31 LUFS-M, the level of palette B's events.
- **Deformation.** Each frame, sample γ under H_t with M = 256. The image curve in Y already evaluates γ under H_t;
  reuse those values where they exist. Coefficients slew over 50 ms.
- **Hear the view.** Circles centred at the view centre, r from 2 px to the half-diagonal over 4 s, sampled at 30 Hz
  with M = 256. Under reduced motion the circle is drawn without growing, and the sound still plays (the user asked
  for it).
- **Cost.**
  - Release: nothing new; `sndSample` already runs on release.
  - Deformation: 256 evaluations per frame, about what the image curve costs, plus the tracker's refinements where
    arg F turns fast between samples.
  - Hear the view: 256 × 30 × 4 ≈ 31,000 evaluations over 4 s, plus refinements.
    - Each frame gets a budget of calls of F, as `sndHover` has. A frame that runs out holds the last spectrum.
    - If half the frames run out, it stops, plays the cut cue and says why.

**Risks**
- It needs a curve. With nothing drawn it is silent, except for Hear the view.
- W ≤ −4 folds below harmonic 1. It is rare (poles of order ≥ 4) and is announced anyway.
- For fast-growing functions the spectrum is wide. On |z| = 4, e^z has phase signal e^{4i sin θ}. Its coefficients
  are the Bessel values J_k(4): the centre is exactly 0, but only 17 % of the energy is within one harmonic of home,
  and the peaks are at k = ±3 (§6). So Hear the view on e^z or tan z is a broad sound spread around home.
  - That is honest: arg F swings wildly.
  - If it is unpleasant, cap the circle where the spread exceeds 6 harmonics.
- It is a new idea. No published work does this for winding numbers (research-literature §4).

---

## 6. Numbers behind the predictions

These come from an exact DFT (1,024 samples) of F on circles and loops: `node tools/spectra.js` (in this folder).
`tools/s6.js` finds when the zeros of scene S6's deformation cross the probe and the loop. "Raw" means F scaled to
unit RMS; "phase" means F/|F|.

| Case | Normalisation | Dominant k | Spectral centre | Notes |
|---|---|---|---|---|
| ring, F = z, zero at δ = 3r | raw | 0 | 0.10 | k = 1 at −9.5 dB |
| ring, F = z, δ = r | raw | 0 and 1 | 0.50 | equal dyad |
| ring, F = z, δ = r/2 | raw | 1 | 0.80 | k = 0 at −6 dB |
| ring, F = z, δ = r | phase | 0 and 1 | 0.50 | 14 % beyond ±1: buzzier than raw at the crossing |
| ring, F = 1/z, pole at δ = 1.5r | raw | 0 | 0.80 | −3.5 dB per harmonic: bright |
| ring, F = 1/z, δ = 1.1r | raw | 0 | 4.5 | −0.8 dB per harmonic: buzz |
| ring, F = 1/z, δ = 0.5r | raw | −1 | −1.33 | the pole's harmonic, −6 dB per step below |
| ring centred on √z's branch point | raw | 0 and 1 | 0.50 | sidebands −9.5, −14, −17 dB both sides |
| ring, e^{1/z}, r = 0.5 | raw | −2 and −1 | −1.7 | k = 0 at −6 dB, k = −3 at −3.5 dB |
| ring, e^{1/z}, r = 0.25 | raw | −4 and −3 | −3.7 | 5 coefficients within 6 dB (k = −2 … −6); after the shift most fold onto harmonic 1 |
| loop: unit circle, F = z − 0.6 | raw / phase | 1 / 1 | 0.735 / **1.000** | phase centre exact |
| loop: unit circle, F = z − 0.9 | raw / phase | 1 / 1 | 0.552 / **0.998** | phase: 56 % on k = 1 |
| loop: wobbly hand-drawn bean around one zero | phase | 1 | **1.000** | 88 % on k = 1 |
| loop: square ±1, F = z | phase | 1 | **1.000** | 99.7 % on k = 1: corners barely matter |
| loop: circle r 1.5, F = z³ − 1 | phase | 3 | **3.000** | 96 % on k = 3 |
| loop: (z − ½)/(z + ½) on the unit circle (W = 0) | phase | 0 | **0.000** | symmetric sidebands at −4.7 dB |
| circle \|z\| = 4, F = e^z | phase | ±3 | **0.000** | J_k(4): 17 % within k = −1 … 1; wide and symmetric |
| circle \|z\| = 3.5, F = sin z (3 zeros inside) | phase | 3 | **2.997** | 94.5 % within ±1 |

## 7. How to choose by ear: seven scenes

Each option should be rendered offline on the **same scripted pointer paths** (the method of `v2/listen.html`), with
the phase portrait and the path shown beside each button. Suggested page: `hearf/listen.html` (not built yet). What
each option should sound like:

| Scene | 1. Sung point | 2. Phase harp | 3. The ring | 4. Curves sing |
|---|---|---|---|---|
| **S1** cross F = z, 30 px from the zero, 400 px/s | a quick half-turn glide (0.17 s), zero ping | a 2 to 3 note run, zero ping | D5; F♯5 swells to −3.5 dB under it (closest δ = 1.5r), then fades | silent |
| **S2** circle z²'s double zero at 60 px, two laps, 1 lap/s | 4 rising cycles, 4 bells | the scale 4 times, 4 low Ds | a steady D5 with F♯5 at −3.5 dB (the ring does not enclose the zero) | (drawn as a loop) A5 on release |
| **S3** approach and cross 1/z's pole | a falling glide, pole thump | a falling run, thump | brightening to a buzz, then A4 | silent |
| **S4** cross √z's cut, then circle 0 | a jump plus the cut cue; half a cycle per lap | the cut cue, half the scale per lap | rough reed near 0 | no note, cut cue ("no winding number") |
| **S5** draw a loop around two zeros of z³ − 1 | 2 cycles while drawing; pings on release | 2 runs while drawing; pings | dyads near each zero as the pen passes | D5 → F♯5 → A5 while drawing; A5 held on release |
| **S6** straight-line deformation H_t = (1 − t)z + t(z³ − 1) over 4 s; probe still at 0.5 + 0.03i (just above the axis, so arg H_t turns +½ and never passes through an exact zero); loop \|z − 1\| = ½ | the real zero of H_t passes under the probe at t ≈ 0.36: a rising half-turn glide and a zero ping | a rising 2 to 3 note run and a zero ping at t ≈ 0.36 | at t ≈ 0.36 the overtone moves D5 → F♯5 → D5 as the zero passes through the ring | the same zero enters the loop at t ≈ 0.36: the note steps D5 → F♯5 through a short buzz and stays there |
| **S7** rest for 3 s | rings down in ≈ 1 s | the last notes ring out (1.8 s) | fades in 0.9 s | silent |

Listen for:
- which one you would leave on;
- which one makes a zero, a pole and a winding number obvious without looking;
- which one still feels "not the same".

The page should offer only a few settings, each one a real choice:
- for option 1, the timbre (cello, choir, glass, reed) and the drone on or off;
- for option 2, string or glass for the note;
- for option 3, the home whistle at 0 or −9 dB.

Each scene should also have a "today" button that plays the current Shepard voice, so every option can be compared
with what the user already knows.

## 8. Considered and set aside

- **A constellation of zeros and poles as voices**, panned and pitched by position.
  - Pitch by position is arbitrary.
  - It needs the list of zeros, which only some chains have.
  - Many voices make the "saturated sound environment" that confused listeners in
    [Middleton et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10448511).
  - Option 4's "Hear the view" keeps the useful part: the count.
- **arg F as a direction in stereo.** Headphones carry left versus right reliably, not a full circle (front and back
  are confused; Wenzel et al. 1993).
- **Raw Re/Im stereo audification without the harmonic shift.** A zero and a pole sound identical on one speaker.
- **A chromatic harp (12 notes per turn).** This is the classic eerie Shepard scale.
- **|F| as wind noise** (the vector-field style). It is not central for a holomorphic F, and it would add another
  sound that is always on.

## 9. My recommendation (to be overruled by ear)

- **For the pointer: option 2, the phase harp.**
  - It uses a real instrument and a consonant scale.
  - It is silent when you are still.
  - The winding number is still exact: count the low Ds.
- **For curves and the deformation: option 4.** It is the most mathematical of the four (the argument principle and
  homotopy invariance as a pitch) and the most novel, and it is closest to the user's "composite of a curve".
- **Option 1** is the fallback if you prefer the continuous glide with the new timbres.
- **Option 3** is the boldest. It is worth building only if its render convinces.

Options 3 and 4 share one engine, so choosing either makes the other cheap.

**Not done:** nothing was built, rendered or heard. The levels are targets, not measurements, and the spectra in §6
are of the waveforms only: no voicing, no room, no ear.
