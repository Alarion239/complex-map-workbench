# Sound effects for Complex Map Workbench

## Is it possible?

**Yes.** Sound works inside the claude.ai artifact frame and on GitHub Pages. No audio files are needed: every sound
is synthesised in the page, which adds about 10 KB to the app (about 0.5 %).

Sound is **off until you turn it on**. When it is off, no audio is created at all. After that:

- **Off is one click** (or Shift+M), and it is silent.
- **Esc** stops anything that is playing.
- The setting stays on your device. It is never saved with your work or passed on in a shared link.

## What it would sound like

There are three groups of sounds. You can switch each group on or off.

1. **Interface** (on when you turn sound on). Short, quiet clicks and keys for things you do: adding or removing a step,
   toggles, switching views, an export being ready, an error. Ticks when a point snaps to the grid have their own
   switch, and it starts off.
2. **Mathematical events** (on when you turn sound on). These sound only when you start something:
   - the deformation playing, and arriving;
   - a closed loop's winding number, played as that many soft pings, rising or falling;
   - "Listen along γ", which plays *F* along a curve.
3. **Hear the function under the pointer** (you switch this on separately). A continuous tone follows *F* as you move.
   - **arg *F* is the pitch.** It is a Shepard tone, so one full turn of the argument is one seamless cycle of pitch
     that can rise forever.
   - **|*F*| sets the loudness and moves the register a little.**
   - **Loops.** A loop around two zeros climbs two cycles. A loop around a pole descends one. A soft bell rings at each
     completed turn.
   - **Pings and thumps.** A zero of order *m* is *m* pings, and a pole is a thump. The order comes from the argument
     principle.
   - **Height mode.** One contour of |*F*| is one step of a scale, so the landscape is a staircase you can hear.

The mathematical cues are always exact. Bells are never dropped, the pitch never runs backwards, and the winding number
can be read back from the audio alone.

Sound is never required. Everything it says is also on screen.

It also helps people who use a screen reader. With the keyboard you can:

- move a probe in round steps;
- jump to the next zero or pole (Z);
- ask for the order at the probe (O);
- draw a loop and hear its winding number announced.

## What is worth building, and the cost

- **Stage 1: Interface, mathematical events, the controls and tests.** About one work round. It is low-risk and useful
  on its own.
- **Stage 2: hearing the function in the app.** This covers the continuous tone, loops, Height mode, "listen along a
  curve" and the keyboard probe. About one to one and a half rounds. It is the part that teaches, and it gives
  non-visual users access to the pictures.

Both stages should come after the current deformation and export work.

The main risk is taste, not code, so please listen first.

## Revision 3: the snaps are gone

You heard snaps while moving the pointer. They were real. I recorded the prototype in Chrome while a script moved the
pointer along 13 paths, at 60, 120 and 240 events a second. A detector found 2,797 snaps in 36 recordings, some as loud
as the tone itself.

The cause was how the engine scheduled its volume and pitch changes. Chrome followed the rules, but the engine's
assumption was wrong. The tone is now computed sample by sample in an AudioWorklet, so a change can only glide.

After the fix, 117 recordings have no snaps, including the fallback used where an AudioWorklet is not allowed. The
timbre, the mapping and the levels are unchanged. The pitch follows the pointer within 14 to 24 ms. The details are in
`DESIGN.md` §7.

A second, independent check then recorded the tone again, with its own tools, on a main thread slowed 6× (a low-end
laptop) and with all cues on. The hover tone itself was clean. Two snaps were left, both when sound stops while you
keep moving: pressing **Esc**, and stopping **Listen along γ** by moving the pointer. Each was nearly as loud as the
tone. Both now fade out smoothly, and those cases measure clean too (`DESIGN.md` §7.6).

## How to try the prototype

1. Open `notes/sound/prototype.html` in a browser. It is one file and needs nothing else.
2. Click **Sound** at the top right. You should hear one soft key.
3. Click **Hear *F*** (the headphones button). Then hover the coloured plane and drag a loop around the double zero
   at −1. The first loop plays itself back. **Listen along γ** plays any loop again.
4. Try the other functions:
   - e^z: move up, and the tone rises forever;
   - √z: cross the cut;
   - the **Height** mode.
5. The **sound board** on the right plays every cue. **Measurements** at the bottom shows each cue's loudness and how it
   holds up on a phone speaker.

Use headphones or laptop speakers at a moderate volume. A phone works too.

The full design, the measurements and the answers to two reviews are in `DESIGN.md`.

## Questions for you

1. **After listening:** do the sounds and their balance feel right? Is the slight register change of the hover tone
   helpful or distracting?
2. **Scope:** build Stage 1 only, or both stages?
3. **Testing in claude.ai:** should I publish the prototype as a private artifact, so you can try it inside claude.ai
   itself?

## The user's decision (2026-10-22)

"I like the sound, but there are bad artifacts that sound like snaps when I move. They disappear if I stay still.
Otherwise really nice." → the clicks are being removed (click-free synthesis). Scope: **both stages** (interface and
mathematical-event sounds with the controls; and hearing the function: the Shepard tone under the pointer, audible
winding, listen along a curve, the keyboard probe).

## The user's request (2026-10-23)

"During deformation, sounds must also follow the deformation. Now they only change during deformation if I move my
mouse." → built in `work/xvs`: the tone and its cues follow H_t under a still pointer, and any change of the function
under a still pointer re-evaluates the tone through one hook. See `DEFORMATION.md`.

## The user's decision on defaults (2026-10-23, for v15)

"Make the default for sound to not include function sounds, since it may be annoying for some. But by default include
sounds for different events. And you can turn on the sound by default then, as the small clicks are fine."

So from v15: Sound is ON by default; Interface sounds ON (Snap ticks stay off); Mathematical events ON; Hear the
function under the pointer OFF (the user turns it on). Browsers allow audio only after the first click or key press
on the page, so the audio context is created on that first gesture and nothing plays before it. A user's own stored
choice (lsk('cmw-sound')) always wins over the default; the default applies only when nothing is stored. Test pages
under ?ns= keep sound off unless a test turns it on, so the quality and perf suites are unaffected.

## The user's verdict on palette B (2026-10-24)

"I like everything except for hearing the function. It still feels quite synthetic. Нет тембра" (no timbre). So:
keep palette B as it was sent at 01:45 (copy: notes/sound/v2/board-sent-0145.html); change only "hear the function"
(the continuous tone under the pointer and in the deformation), which needs a real, natural timbre.

## The user on hearing the function (2026-10-24, later)

"Wait, this sounds better, but I still think it is not the same. I am not really understanding how the audio version
should sound: can you research it on the web. Maybe there is any research about using sound for math? Look at 2swap
github. Maybe we don't need each point sound? Maybe it should be composite of a curve or a function? I don't really
know. Maybe each point is fine. It just feels weird, maybe because of its weird non-natural sound and your new version
resolves that. Just please see what is done and give me a few options to choose. Try to make them as nice and good
as possible." -> research and an options board in notes/sound/hearf/.

## The user's choice for hearing the function (2026-10-24)

"Option 2 (phase harp) for the pointer, plus option 4 (curves sing) for loops and the deformation." (notes/sound/hearf/
options.html, README.md there). With palette B for every other cue (liked earlier: "I like everything except for
hearing the function"). Defaults stay: sound on, interface and event cues on, hearing the function off until turned on.
Built into v15.2.

## Decision (2026-10-25 02:20)
The user accepted the open items: loops with W = 3 and W = 7 keep their notes (v15.2 sound-6), and no change after the phone listen (sound-7). Quote: "I like everything that is waiting on mee, you can proceed. No need to change anything".

## The user's decision: hear the function (2026-10-28)

"i want to hear the function, not actively just make music fit the math." Everything audible under Hear the function
is caused by F through a fixed, documented map, plus declared timbre choices and declared safety limits. Built from
the offline prototype's variants `final-notes` (a marimba note at each colour line arg F crosses, pitch class 12k/n
semitones above D, loudness from |F|, the held note repeated at band edges of |F|, a crack and two muted notes at a
branch cut, zero and pole order cues) and `final-glide` (one continuous voice whose pitch class is arg F), plus a
declared limiter: every constant and its reason is in perfwin/sound/polish/FINAL.md and compare.js; the build plan is
perfwin/sound/impl/SOUND-PLAN.md. The phase harp (option 2 above) is superseded; curves sing (option 4) stays.

The app side: the probe follows the hand through a rope (3 px behind a mouse or pen, 5 px behind a finger) so a
resting hand's tremor plays nothing; a click on a still point (on touch the long press, on the keyboard Q) plays that
point; the sound menu chooses Notes or Glide (a preference of this device, never in the work or a link); Listen along
plays the function at 250 screen pixels a second, and a composed curve's score is "Play the composition".
