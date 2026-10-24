# Sound for Complex Map Workbench: investigation, design, prototype (revision 3)

The user asked (2026-10-22): "I am curious whether it is possible some sound effects? Togglable. Of course. Can you
investigate this?"

**Answer: yes.** It is cheap and safe, and it works inside the claude.ai artifact frame. Everything is synthesised with
the Web Audio API: no audio files, about 10 KB gzipped of code. Sound is off by default. It has one toggle (Shift+M),
a volume control, and three tiers, split by **what triggers a cue**:

1. **Interface** (on with sound): short, dry confirmations of controls you operate. Snap ticks are a separate switch,
   off by default.
2. **Mathematical events** (on with sound): things you start. The deformation plays and arrives, a closed loop sounds
   its winding number, "Listen along γ" plays *F* along a curve.
3. **Hear the function under the pointer** (opt-in): a continuous Shepard tone whose pitch class is arg *F* (a full
   turn of the argument is one seamless pitch cycle), with |*F*| as register and loudness; and every cue driven by
   pointer position (branch cut, zero or pole with its order, contour, turn bells). Dragging a loop makes its winding
   audible: around two zeros the tone climbs two cycles, around a pole it descends one.

Nothing outside `notes/sound/` was touched. Revision 2 answers two reviews: `review-sound.md` (a sound designer,
measured offline) and `review-a11y.md` (accessibility, and a maths user who dislikes noise). §6 maps every finding to
what changed.

**Revision 3** answers the user's listening test: "I like the sound, but there are bad artifacts that sound like snaps
when I move. They disappear if I stay still." The snaps were real and are gone. §7 has the cause, the fix and the
measurements. An independent check (§7.6) then found two more snaps, both from stopping sound while the pointer moves
(Esc, and stopping "Listen along γ" by moving); they are fixed too. The timbre, the mapping and the levels are
unchanged.

## Look at these, in this order

1. **`README.md`**: the short version for the user, and how to try it.
2. **`prototype.html`**: open it in a browser (one file, no dependencies) and click **Sound** at the top right.
   - Turn on **Hear *F*** (the headphones button), hover the phase portrait, and drag a loop around the double zero.
   - Try e^z (move up: the tone rises forever), √z (cross the cut), and the Height mode (the landscape probe).
   - The sound board auditions every cue. The Measurements section renders each one silently and checks its loudness,
     its level on a phone-speaker model, its envelope and the balance against the continuous voice.
   - Keyboard: focus the plane; the arrows move the probe in steps of 0.1; Z jumps to the next zero or pole; O tells
     the order here; Enter starts and closes a loop; L listens; Esc stops.
3. **`shots/`**: `desk-light-loop.png` (a loop around the double zero, W = 2), `desk-light-hover.png`,
   `desk-dark-popover.png` (the settings), `desk-dark-board.png`, `desk-dark-lab.png` (the measurements),
   `phone-top.png`, and `t3-host-C.png` (revision 1, inside a cross-origin sandboxed frame).

---

## 1. Feasibility

### 1.1 Autoplay, and the artifact's sandboxed cross-origin frame

Every current browser follows the same model (Chrome: `document-user-activation-required`; WebKit and Firefox
equivalents):

- An `AudioContext` created before the user has interacted with *its own frame* starts `suspended`. Chrome also logs
  "The AudioContext was not allowed to start".
- After an activation-triggering input in that frame, the context may be created or resumed. Those inputs are:
  - `keydown` (but not Esc);
  - `pointerdown` / `mousedown` with a mouse;
  - `pointerup` / `touchend` for touch;
  - `click`.
- User activation is **per frame**. Chromium's `AutoplayPolicy::IsDocumentAllowedToPlay` first checks the frame's own
  sticky activation. Only when the frame has none does the Permissions Policy `autoplay` feature matter: with
  `allow="autoplay"`, the frame may inherit its parent's activation; without it, it may not.
- So the artifact needs **no `allow="autoplay"`**: a click inside the artifact is enough, and a click in claude.ai
  outside it never is.
- `sandbox` flags do not gate Web Audio. Without `allow-same-origin` the frame has an opaque origin, so
  `localStorage` throws; the engine then just doesn't remember the setting.

**Verified in headless Chrome 155** (`cdp/cmd/t3.js`; the autoplay policy set explicitly to the desktop default). The
host page was served as `http://localhost:8871/host`, framing `http://127.0.0.1:8871/prototype.html`: another site, so
another renderer process, like claude.ai and its artifact domain.

| Variant (frame) | At load | Click in the host page | Sound set "on" with no gesture in the frame | Click inside the frame |
|---|---|---|---|---|
| A `sandbox="allow-scripts"` (opaque origin) | no context | no context | no context | **running**; settings not saved (storage blocked) |
| B `sandbox="allow-scripts allow-same-origin"` | no context | no context | no context | **running** |
| C = B + response header `Permissions-Policy: autoplay=()` | no context (remembered "on" waits) | no context | no context | **running** |

No variant needed `allow="autoplay"`, and the frame's console stayed empty.

I don't know the exact flags of the claude.ai artifact frame. The artifact docs say `localStorage` works per artifact
origin, which is variant B. Variant A covers a stricter frame.

**GitHub Pages** is the ordinary top-level case. The same rules apply and nothing special is needed.

**A detail found in testing.** Chrome carries a frame's sticky activation across a reload. With only the browser's
gate, a *remembered* "on" could start sounding on a plain hover after a reload, before any click on the new page. The
engine therefore also requires a click or key in the current page load (its own listeners) before it creates or resumes
anything. The lifecycle test checks this.

**Safari / iOS** (not testable here: driving Safari needs "Allow Remote Automation", a system setting I did not
change). From WebKit's documented behaviour:

- The context must be started inside a gesture handler. The engine starts it synchronously in its `pointerup` /
  `touchend` / `click` / `keydown` listener.
- After the first start, later `resume()` calls (after idle sleep, or after a hidden tab) are allowed.
- The **ring/silent switch mutes Web Audio**. The engine sets `navigator.audioSession.type = 'ambient'` (Safari
  16.4+). That obeys the switch and mixes with the user's music instead of stopping it, which is polite for interface
  sounds. `playback`, which would ignore the switch, is deliberately not used. The popover says so on iPhone and iPad.
- A phone call or Siri puts the context in the `interrupted` state. The next tap resumes it through the same listener.
- `StereoPannerNode` needs Safari 14.1; without it the code falls back to mono.

**Firefox:** the same activation model. Revision 3 no longer uses `AudioParam.cancelAndHoldAtTime` (§7), so Firefox
needs no special path. AudioWorklet is in Firefox 76+ and Safari 14.1+.

### 1.2 Never without consent: the rules the engine enforces

1. **Off by default.** No `AudioContext` object exists until the user turns sound on: no audio device, no speaker badge
   on the tab, no console warnings. Verified: hovering, dragging and clicking board cards with sound off create nothing.
2. **A remembered "on" waits for the first click or key of each page load.**
3. **Nothing is ever queued on a clock that is not running.** A sound is scheduled only when the context is
   `running`. A suspended or iOS-`interrupted` context would otherwise release its backlog as a burst on the next tap.
   The one exception is a single sound inside an active gesture (`navigator.userActivation.isActive`), so that the
   "on" confirmation is heard. Verified with a context whose `resume()` never resolves: 24 requests over 1.2 s, none
   scheduled, no voice created.
4. **Off is immediate and silent.** Turning sound off cuts the bus within about 10 ms, stops every scheduled source and
   sleeps. No "off" sound: people mute because they need silence. The icon and `aria-pressed` confirm it.
5. **Esc is a panic key.** It stops any playback, queued bell or tone at once and leaves the setting alone.
6. **The setting belongs to the viewer and the device**, under its own `localStorage` key, never in `S`, the saved
   session, share links or exports. Where storage is blocked or empty, sound is off.
7. **Hidden tab or page put away:** everything stops (the same hush), and the context is suspended.
8. **An idle engine sleeps** after 30 s with no sound.
9. **Safety ceiling:** a soft clipper on the master, linear below −6 dBFS, never above −1.6 dBFS. At 100 % volume no
   sound reaches it (the lab checks every cue's peak against −6 dBFS).

### 1.3 Cost

- **Size.** The engine (`Sound` in `prototype.html`, the proposed `src/sound.js`) is 818 lines, 59 KB with comments,
  **about 20 KB gzipped with its comments** (revision 2, measured the same way: 41 KB and 14 KB; revision 3 adds the
  AudioWorklet and the node fallback, §7). The built app is 1.88 MB, so this adds about 1 % before minification. No
  assets: the noise and the room's impulse response come from a seeded PRNG at start-up.
- **Main thread.** A probe update is the exact arg tracking along the pointer's segment plus one message to the voice's
  AudioWorklet. The node fallback schedules 18 anchored linear ramps instead, more for a glide of more than 1/16 turn.
  Revision 1 measured 0.085 ms for z² − 1. Near a zero or pole, the order test adds two 16-gon trackings, only where
  |*F*′/*F*| says one is within 8 px. App chains can be much costlier per evaluation, so the tracker runs only when the
  "Hear the function" tier is on and gets a per-event budget (§4.3).
- **Audio thread:** about 1.1 % of one core for the Shepard voice in its AudioWorklet (revision 2's oscillators: 1.4 %),
  0.9 % for the Height voice (§7.5); nothing when sound is off or asleep.
- **Latency.** 5 to 40 ms on laptops, 150 to 250 ms on Bluetooth: sounds confirm and describe, never time.

---

## 2. Design

### 2.1 Controls

- **Header.** A split button between Theme and Guide. Its visible label is "**Sound**" (the accessible name matches
  the visible text, WCAG 2.5.3). The state is shown by the icon (speaker with waves, or crossed) and `aria-pressed`.
  The title is "Sound (Shift+M)", with `aria-keyshortcuts="Shift+M"`. The caret opens the popover:
  - the Sound switch and **Volume** (squared taper: the default 70 % is −6.2 dB);
  - the tiers, each with one line on what it plays: Interface (with "Snap ticks" indented under it, off), Mathematical
    events, Hear the function under the pointer;
  - while sound is off, the line "Sound is off: these take effect when it is on" (no opacity dimming: dimmed text
    measured 2.4:1, and these controls stay operable);
  - the iPhone silent-switch note and a one-line engine status.
- **Phones.** While sound is on, the speaker button sits in the phone header, so silencing is one tap. When sound is
  off it returns to the More menu.
- **Shift+M.** The hook goes **after** the dispatcher's guards (modal, `#popHost`, typing), first among the character
  shortcuts. In NVDA/JAWS browse mode M is the frame quick key, so Shift+M may not reach the page; the button is the
  way there, and the guide says so.
- **Command palette:** "Sound on/off", "Hear the function on/off", "Stop sound".
- **Remembered** in `lsk('cmw-sound')` = `{on, vol, ui, snap, events, sonify}`.
- **First turned on:** Interface on, Snap ticks off, Mathematical events on, Hear the function **off**.
- **Hear *F* per plane.** When sound is on, a headphones toggle appears in each plane's view controls; it mirrors the
  third tier.
- **Confirmation:** turning sound on plays the "toggle on" key; the volume slider plays it on release. Off is silent.

### 2.2 The sound language

The cues share one palette, **D major pentatonic** (D E F♯ A B). The palette is consonant against the continuous
voice too: while the Shepard voice sounds, every pitched cue of the events and pointer tiers is transposed to the
voice's current chroma (at most ±6 semitones), and arg *F* = 0 sounds D, the tonic.

| Tier | Family | Character |
|---|---|---|
| Interface | dry keys (a sine with a breath of 2nd and 3rd harmonic), soft band-passed ticks, a "written" swish | 2–3 ms attacks, ≥ 28 dB direct-to-room |
| Mathematical events | glass and bells (struck-bar partials 1 : 2.756 : 5.404), swells | a small dark room (T60 0.75 s) heard as a short ring, 15–18 dB under the direct sound |
| Under the pointer | the Shepard organ; an organ tone on the Height scale; felt thumps, wooden ticks | continuous, ducked by 6 dB under every cue |

**Every cue goes through an equal-power stereo panner, always** (revision 1 skipped it at pan 0, so the centre was
3 dB louder than its neighbours and "Listen along γ" 3 dB louder than the live voice). Pan is capped at ±0.4 for cues
(about −6 dB in the far ear) and ±0.3 for the voices (about −4 dB): one earbud, or a one-sided hearing loss, keeps
everything. Panning is always redundant.

**Envelopes.** A linear attack (≥ 2 ms for tones, 0.8 ms for noise), an exponential decay to −60 dB, a linear ramp to
exactly 0 before the source stops. Measured: every cue's last scheduled sample is exactly 0; energy above 14 kHz is
−44 dB or less. Partials above 0.45·fs are left out, so 16 and 22.05 kHz contexts (Bluetooth hands-free, some Android
devices) do not alias.

**Levels at 100 % volume, through the panner, as in use** (LUFS-M: the loudest 400 ms momentary loudness, BS.1770
K-weighting; phone: the same through a 4th-order high-pass at 550 Hz; all 6.2 dB lower at the default volume):

| Group | Cues | LUFS-M | Phone (loss) | Target |
|---|---|---|---|---|
| Detents | snap −43.3, scrub −42.2 (landmark −42.5, end −35.3), cut −38.1, contour −41.1 / −39.5 / −37.1 (A3 / D5 / A6 ticks) | −35 … −43 | ≤ 4.7 dB | −40 ± 2 (snap 3 dB lower: it is the most frequent) |
| Interface keys | toggle on −32.9, off −33.8, add −31.5, remove −32.2, view −33.1, edge −38.5 | −31.5 … −34 | ≤ 2.0 dB | −32 ± 2 |
| Events | zero −30.9 (order 2: −29.4, order 4: −28.3), pole −30.0, deformation plays −32.0 / arrives −31.2, loop closed (W = 2) −31.3, collide −32.1 | −28 … −32 | ≤ 4.1 dB | −30 ± 2 |
| Export ready, Error | −29.1, −30.1 | | 0.1, 3.2 dB | −29 ± 1, phone ≤ 5 |
| Turn bell (alone) | −29.3 (down −29.2); over the voice: **+17.1 dB in its own band** | | 0 | −29; ≥ 5 dB over the voice |
| Shepard voice | **−32.9 at \|F\| = 1**, −36.7 near a zero, −31.8 near a pole: range 4.9 dB | | phone range 7.1 dB | −33 ± 1, range ≤ 6 (phone ≤ 8) |
| Height voice | −30.6 (A3) / −32.5 (D5) / −33.9 (A6) | | phone −38.9 / −33.7 / −33.9 | ≈ −33, phone range ≤ 8 |

The quiet "many zeros" (−42) and "many turns" (−38) cues are deliberately soft. Error and Pole now keep their
identity on a phone: Error lost 15.5 dB there in revision 1 and loses 3.2 now; Pole lost 11.5 and loses 4.1.

### 2.3 Catalog

| Tier | Cue | When (in the app) | Recipe | Limit |
|---|---|---|---|---|
| Interface | Toggle on / off | panels, snap, Paths, a step's eye, loop, theme | key A5 / key E5 (shorter) | 60 ms gap |
| | Add / remove a step | `addStep` / `removeStep` | keys D5 → A5 / A5 → D5, 55 ms apart | 80 ms |
| | Switch view | X → Y, Phase, Landscape | soft tick and key D5 / F♯5 / A5 | 80 ms |
| | Export ready | a file saved, a figure or LaTeX copied | a swish (noise swept 1 → 3 kHz over 120 ms), then key A5: "written" | 300 ms |
| | Error | a toast that reports a failure (with it, never instead) | two wooden D4 knocks, each with a 1.2 kHz noise body and a D5 overtone | 250 ms |
| | Edge | the keyboard probe hits the edge of the view | soft wooden A5 knock with a 1.5 kHz contact | 150 ms |
| | Snap (own switch, off) | a drawn point **settles** on a new grid point | noise band-passed at 1.9 kHz, Q 1.4, 25 ms; no sine | 125 ms (≤ 8/s) |
| Events | Deformation plays / arrives | **once per play the user starts** (M, Play); never on loop repeats | D5 + A5 triangle swell with a low-pass opening 700 Hz → 3.5 kHz / glass D6 + F♯6 | 200 / 300 ms |
| | Deformation scrub | each 0.05 of t while scrubbing | an unpitched tick; t = 0, ¼, ½, ¾, 1 add a key on D5 F♯5 A5 B5 D6; the ends ring | 40 ms |
| | Loop closed | a loop is released (when it is not auto-played) | **\|W\| glass pings** 125 ms apart, rising for W > 0, falling for W < 0, the first accented; W = 0: one soft knock; > 8: 8 and a flourish | |
| | Listen along γ | the button, L, or the curve menu | §2.5; its bells and cut ticks go through this tier too | |
| Pointer | (continuous) | hover in X, the landscape probe | §2.5 | |
| | Branch cut | the probe crosses a cut (*F* jumps) | a double tick stepping down, 3.2 then 2.0 kHz | 120 ms |
| | Zero / pole of order m | the probe comes within 8 px (§2.4) | zero: bell D6 × m; pole: felt thump A4 → A3 with its octave at −6 dB and a 1.5 kHz felt contact, × m. 110–120 ms apart, **150 ms for m ≥ 3**, the first +3 dB | 250 ms shared; clusters → "dense" |
| | Many zeros or poles | ≥ 3 entries within 300 ms (z⁵⁰ − 1, sin(1/z), Blaschke products) | three quiet glass ticks; then 600 ms of silence for zeros and poles | |
| | Contour | the probe crosses a level line of \|F\| (Height) | the Height tone's own note, an octave up (organ tick) | queued ≤ 12/s |
| | One full turn | arg F completes a turn during a loop | "home": the loop's **starting pitch class**, 1.7–3.4 kHz (two octaves above the tone), reached from a fifth below (up) or a fourth above (down) | queued ≤ 8/s, never dropped |
| | Many turns | more than 8 bells queued | a quick run of five glass notes, up or down | |
| | Preimages collide | (right-plane hover) w crosses a critical value: a preimage of multiplicity ≥ 2 appears | two glass tones a whole tone apart gliding into one | 300 ms |

Removed: "preimage found / lost". The count of visible preimages changes when one crosses the view's edge, when the
root tracker loses one, or when a later search finds one: none of these is an event in the function (a rational map of
degree d always has d preimages with multiplicity). The real event is a collision at a critical value, which is what
the new cue marks. Undo and redo stay silent.

### 2.4 Never chatters, and never miscounts

- **Nothing sounds on plain hover unless the user turned on "Hear the function under the pointer".** Measured with the
  default tiers: hovering across √z's cut 40 times and circling a zero produced **no cue at all** (revision 1: 29 cut
  ticks in 3.9 s).
- **Decorative cues** have per-cue gaps and a storm guard (at most 14 a second, all cues together; an error always gets
  through).
- **Count-bearing cues are never dropped by a rate limit.** Turn bells and contour ticks queue on the audio clock
  (bells ≤ 8/s, ticks ≤ 12/s). Beyond 8 queued bells, one "many turns" flourish plays, and the exact count is shown,
  announced, and played back by "Listen along γ" (scheduled, exact). Contour ticks beyond 0.5 s of backlog coalesce:
  the Height tone itself is the staircase. Queued and scheduled cues neither count against the storm guard nor are
  refused by it (revision 1: a W = 16 playback blocked Interface cues for a second). Measured: 5 turns in one pointer
  event → 5 bells; 12 → 8 bells and the flourish; Interface cues right after still play.
- **Zeros and poles** are never forced: one shared 250 ms gap; a cluster becomes one "dense" cue. Measured: 20
  entries at 40 ms → 3 pings and the dense cue.
- **Order by the argument principle.** Proximity is tested only where |*F*′/*F*| > 1/(8 px). The order is then N − P on
  a 16-gon of radius 8 px around the probe, tracked exactly (`Calc.argStep`); the cue fires when that is non-zero and
  is held until the 14 px circle no longer gives the same order. This is exact for any m (revision 1's Newton test is
  wrong for m ≥ 2: from z near a zero of order m, z − F/F′ lands at a + (1 − 1/m)(z − a)). It needs no list of zeros,
  and a branch point gives no order (the tracker fails on the circle), so √z stays silent there.
- **View gestures (app):** probe-driven event cues are suppressed while pan, zoom, orbit or pinch is active and for
  250 ms after.
- **The function changes under a still probe (app, 2026-10-23; `DEFORMATION.md`).** While the deformation plays or is
  scrubbed, the tone follows H_t at the resting probe every frame, and so do its cues. The step from frame to frame is
  a path in (z, t), tracked exactly like a pointer segment, so the cues are right: a zero or pole of H_t sweeping
  across the probe pings once with its order, a cut of H_t ticks, each full turn rings a bell, Height contours tick.
  The same guards and queues apply. (Until then pointer cues were held while the deformation played, because the
  tracker could not follow t.) A swap with no path between the functions (the transport opening or closing, a loop
  repeat) is a glide to the nearest turn with no cue. Any other change of the function (a dragged zero, a parameter)
  re-evaluates through one hook, `soundFunctionChanged()`, once a frame at most; given a path (`{ at }`), it is tracked
  exactly too. When the plane under a still pointer changes (the panes merge, another view, a fit, a resize), the
  probe is the point now under the pointer, read once the new layout is drawn (a fresh start, no cue); on the relief
  and X's globe the needle stays while only the camera refits. Esc stops the tone until the pointer moves, layout
  changes included. A click keeps the probe; a drag or pan ends it. Zero and pole speech follows the ping actually
  played (review 2026-10-23, `ledger-deformation.json`).
- **The continuous tone** fades after 1.6 s of stillness (of the probe and of the function under it) and is released
  after 6 s. In keyboard mode each step sounds a 280 ms sample, so the tone does not talk over the screen reader.

### 2.5 Sonification: hearing the function

**The merged deformation plane (X → Y with the Deformation open; 2026-10-23).** The point p under the pointer is read as
a point of X, where the paths t → H_t(z) start. The tone is H_t(p), the head of the path from p (the same tone as the
Phase view at p). While it sounds, that path and the probe's cross at its head are drawn. A zero ping means H_t(p) = 0:
the head crosses 0. Rejected: the w under the pointer (arg w does not change with t, so the tone would never move), and
the preimage of w under H_t (several, colliding at critical values, too costly per frame). Details: `DEFORMATION.md`.

**Phase (hover in X).**

- **Pitch class = arg F / 2π, exactly; arg 0 is D.** With 12 phase sectors, each colour sector is one semitone. The dial
  is the phase wheel, labelled in degrees: the chroma of a Shepard tone is heard relatively, so no note names are shown
  or announced.
- **The Shepard tone.** Nine sine partials at f_lo·2^p, p ∈ [0, 9), f_lo = D1 (36.7 Hz), under a Gaussian envelope
  (σ = 0.95 octave, centre about 630 Hz). One turn of arg *F* moves every partial up one octave into its upper
  neighbour's place, so the tone can rise forever. Measured stationarity: 0.86 dB level ripple over 3 cycles; the
  pitch class read back from the audio is within 5.5 cents.
- **Register.** ln|*F*| moves the envelope ±0.3 octave (`c0 + 0.3·tanh(ln|F|/2.5)`) and the loudness from 60 % to
  100 %. This is log *F* on the pitch helix: arg as chroma, ln|*F*| as a little height. The swing is small on purpose:
  the chroma climb carries the winding number, and a large register swing was heard as a competing pitch (revision 1:
  ±0.85 octave). Full-range level span 4.9 dB, phone 7.1 dB. Whether ±0.3 is right is a listening question (§5).
- **Direction is never reversed.** Between two pointer events arg *F* is tracked exactly along the segment. The voice
  plays the change with its **true sign**, over the frame interval plus 0.3 s per turn (≈ 3 turns/s at most). A backlog
  beyond one turn drops whole turns, which by construction sound identical (the same set of partials); the remainder
  still moves the right way. Measured: 8 steps of +0.625 turn (z⁵ in eight 45° steps) → the voice never moved down
  (revision 1: it fell 3 octaves). A pass straight by a simple zero is still a half-turn jump within one event; it is
  now played as a 0.17 s upward or downward glide, not a tritone jump.
- **Smooth, and click-free (revision 3, §7).** The voice is rendered sample by sample in an AudioWorklet. The chroma
  moves by linear slews over the event interval (no scallop at the update rate), and register, loudness, pan, gate and
  ducking move by one-pole smoothers. Each partial is a phase accumulator. The bell is exactly zero, with zero slope, at
  both band edges, so a partial wraps from the top to the bottom at exactly zero gain.
- **Cuts.** If the tracker cannot converge while *F* stays finite and non-zero, *F* jumps: a branch cut. The cut cue
  fires and the tone jumps, as *F* does. This needs no knowledge of the chain's cut geometry.
- **Ducking.** Every one-shot lowers the live voices by 6 dB for its first 250 ms.
- **What it teaches:** the argument principle by ear (a loop around a zero of order m spins the tone m cycles up,
  around a pole down); e^z's periodicity (the Shepard illusion *is* the periodicity of exp); the jump at a cut; and
  multiplicity (a double zero: two cycles, two pings).

**Loops.**

- Drag a closed loop: the tone follows, and a bell rings "home" at each completed turn: the loop's starting pitch
  class, two octaves above the tone, where the voice is 17 dB weaker in that band. It is consonant by construction,
  because the tone is back on that pitch class when it rings.
- On release, the winding number is computed exactly and checked against N − P (the polygon's winding around each zero
  and pole, times the order).
- The **first loop of a session** plays itself back ("Listen along γ", 2.6–7 s, a dot travelling the loop); later loops
  sound their winding as |W| pings and wait for the button. Under reduced motion nothing plays by itself.
- **Stop.** While playing, the button reads Stop (`aria-pressed`); Esc stops; moving the pointer more than 4 px ends
  the playback and resumes the probe.

**Height (the landscape probe).**

- One contour of the drawn lines (|F| = e^(2πk/S), S = `S.sectors`) is **one step of the pentatonic scale**:
  u = ln|*F*| / (2π/S), and the pitch interpolates the scale in log-frequency, |*F*| = 1 on D5, from A3 (u = −7) to
  A6 (u = 8), clamped beyond. The landscape becomes a staircase you can hear.
- The contour tick is the tone's own note an octave up, so tone and tick are always an octave apart (revision 1: near
  tritones and out-of-tune thirds).
- An organ tone (harmonics 1–4 at 1/n) with a slight tilt toward low notes keeps the phone level within 5.2 dB from
  A3 to A6 (revision 1: 29 dB).

**Listen along a curve, in the app.** Curve shapes get "Listen along this curve" in their right-click / long-press
menu. It plays *F* along the curve, with the probe dot on the curve in X and on its image in Y; for a closed curve it
announces the winding number.

### 2.6 Accessibility

- **Never required.** Every cue has a visual counterpart that exists already. The error cue accompanies the toast's
  announcement and never replaces it.
- **Live regions.** The result panel is no longer a live region (revision 1 re-read 35 words on every click). Only
  short messages go through one polite region: "Winding number 2: 2 zeros and 0 poles inside, counted with
  multiplicity", "Zero of order 2 here", "Sound on".
- **A keyboard probe with landmarks** (useful without sound too):
  - it starts at the view centre and says so;
  - steps of 0.1 in z (0.02 with Shift; 0.25 on wide views), announced;
  - an edge bump: a sound and "Edge of the view";
  - **Z / Shift+Z:** the next or previous zero or pole (the chain's list from `calc.js`), announced with its order;
  - **O, order here:** N − P on a circle of one step's radius, by the argument principle, with its pings;
  - Enter starts and closes a loop; L listens; Esc stops.
  - In the app, add **D, describe the view**: zeros and poles with orders, and the cuts.
- **Reduced motion.** Nothing starts by itself; deformation sounds follow the deformation's own motion rules.
- **Comfort.** The continuous voices sit under the cues (−33 LUFS), there is a ceiling, a volume, per-tier switches,
  snap ticks are off by default, and panning is narrow.
- **Hidden tab:** silent. **iOS:** obeys the silent switch. A collapsed claude.ai artifact panel still reports
  "visible"; an `IntersectionObserver` on the root can mute it (low priority: hover cannot happen then).

---

## 3. The prototype and how it was verified

`prototype.html` contains the engine verbatim as proposed for `src/sound.js`, the header control and popover, the
"Hear the function" demo (an enhanced phase portrait in the app's style for z, z² − 1, 1/z,
(z−1)(z+1)²/(z²+1), e^z and √z; Phase and Height modes; loops; the keyboard probe), the sound board, and the
Measurements section (every cue rendered with an `OfflineAudioContext` and measured in the page: LUFS-M, the phone
model, envelope edges, HF energy, the voice balance, and the read-back of the winding from the audio alone).

**Verified in headless Chrome 155** (`cdp/`, a copy of `test/cdp_kit` with the autoplay policy set explicitly; this
revision's command files are `cdp/cmd/r1.js` … `r3.js`; the daemon is stopped and its profile deleted). The console
stayed empty in every run.

| Check | Result |
|---|---|
| Load | no AudioContext; every lab row passes |
| Sound off: hover, drag, click a board card | no AudioContext created |
| Click Sound | `running`; the button reads "Sound", `aria-pressed="true"` |
| Default tiers: hover across √z's cut ×40, circle a zero | **no cue** |
| Voice driven like z⁵ in 8 steps of +0.625 turn | never moves down |
| 5 turns in one event / 12 turns | 5 bells / 8 bells + flourish; Interface cues right after still play |
| 20 zero entries at 40 ms | 3 pings + one "dense" cue |
| First loop around both zeros of z² − 1 | W = 2, playback, the button reads Stop; Esc → stopped, no source left, sound still on |
| Second loop | no auto-playback; the "loop closed" cue (2 rising pings) |
| Listen, then move the pointer | the playback ends |
| Context suspended, `resume()` never resolves | 24 requests, none scheduled, no voice |
| Keyboard | "Probe at the centre, z = 0. Steps of 0.1"; Z → "Zero 1 of 4: order 2 at −1"; O → "Pole within 0.1: net order 1" |
| Sound off while 6 sources sound | 0 sources after 150 ms, no off sound, then `suspended` |
| Reload with "on" remembered | no context until a gesture; a hover creates none |
| Phone width (390 px) | no horizontal overflow |
| Cross-origin sandboxed frames | revision 1 (§1.1); the engine's lifecycle code is unchanged |
| Moving the pointer (revision 3, §7) | 0 clicks in 117 live recordings: 13 trajectories at 60, 120 and 240 Hz, with the AudioWorklet, the node fallback, and all cues |

**Sonification read back from the audio alone** (pitch class = the magnitude-weighted circular mean of chroma per FFT
frame; no access to the engine's state):

| Check | Expected | Measured |
|---|---|---|
| Live voice, 60 Hz updates, rising / falling 3 turns | ±2.635 turns over the analysed span | **+2.635 / −2.634**; ripple 0.86 dB; ≤ 5.5 cents |
| Listen along \|z\| = 2 for z² − 1 | +1.948 over the analysed 98 % (W = 2) | **+1.931** |
| Listen along \|z\| = 1 for 1/z | −0.973 (W = −1) | **−0.965** |
| Around the zero 1 and the pole i | −0.014 (W = 0) | **−0.019** |
| Around the double zero −1 | +1.959 (W = 2) | **+1.946** |

**Not verified:** how it sounds (I cannot listen; loudness, spectra, envelopes and the read-back are the proxy);
Safari and iOS; Firefox's fallback path; the screenshots were taken before a last cosmetic change (the dial's ring was
narrowed so that "180°" is not clipped).

---

## 4. Integration estimate

### 4.1 Changes

- **`src/sound.js` (new):** the engine from the prototype. Add it to `build.py` before `app.js`.
- **`src/calc.js`:** export `Calc.argStep(F, z0, g0, z1, g1)` (its `track()` exists) and `Calc.orderAt(F, z, r)` (N − P
  on a 16-gon).
- **`src/page.html`:** the header split button, the popover, the phone header button while sound is on, the More-menu
  rows, about 60 lines of CSS reusing `.icon-btn`, the popover and switch styles.
- **`src/app.js` hooks**, by function name (other workflows are editing the file). `pan` = the control's or probe's x
  mapped to ±0.4.

| Cue | Where |
|---|---|
| toggleOn/Off, stepAdd/Remove, view, exportDone, error | as before: `setPanels()`, `addStep()`, `removeStep()`, `setMain()`, `saveFile()` success and Copy, failure toasts (`toast(msg, …, {error: true})`, about 8 of 19 calls) |
| snap (own switch) | where the drawn point **settles** on a new grid point (pointer up, or 120 ms still) |
| morphStart / morphEnd | `openTransport()` / `toggleTransport()` **when the user starts a play**; the arrival once per such play; never on loop repeats |
| morphTick | the `morphRange` slider's `oninput` at each 0.05 of t / morphLen() |
| loopDone, Listen along a curve | the loop/curve tools; `openIntegralMenu()` gets the curve item |
| cut, zero/pole, contour, turn, voices (pointer tier) | `setReadouts(z)` (the hover path), only when the tier is on, never during pan/zoom/orbit/pinch (+250 ms); cut from `argStep`, order from `orderAt`. While the deformation plays, a path in (z, t) (`Sound.pathStep`) |
| the function changes under a still probe (2026-10-23, `DEFORMATION.md`) | `soundFunctionChanged()` (once a frame at most): `frame()` while the deformation plays and the morph slider (`'t'`), `chainChanged()`, `openTransport()`, `closeTransport()`; v15: its Params change event. The merged deformation plane's hover calls `sndMove(…, 'merged')` |
| collide | `hoverReadout()`: when an entry of `hov.list` has `mult ≥ 2` (never on a change of the count) |
| Esc | after the dispatcher's own Esc handling (closing a modal first) |
| keyboard probe | a focused plane canvas: arrows, Z, O, D, Enter, L, Esc |

- **Tests.** A CDP regression in `test/` built from `cdp/cmd/r1–r3.js` and the lab: no context before consent, the
  default tiers silent on hover, the queue and cluster guards, the suspended-context rule, the silent off, Esc, and
  the LUFS and phone targets of §2.2 as assertions.

### 4.2 Effort

- **Stage 1** (engine, controls, Interface and Events cues, Esc, tests): about one workflow round.
- **Stage 2** (the pointer tier in the app, `argStep`/`orderAt`, the Height voice, listen along a curve, the keyboard
  probe with landmarks): about one to one and a half rounds.

Stage 1 is low-risk and useful on its own. Schedule both after the deformation and export rounds land.

### 4.3 Risks

1. **Taste.** The main risk is annoyance, not code. Mitigations: off by default, the pointer tier opt-in, snap ticks
   off, gaps, voices under the cues, a silent off and Esc. The user should audition the board before anything is built.
2. **Main-thread cost of the tracker** on heavy chains: run it only when the pointer tier is on, with a per-event
   evaluation budget; when the budget runs out the voice holds and no cue fires.
3. **A busy main thread** delays parameter updates; the ramps glide over the delay, and playback runs on the audio
   clock.
4. **iOS and Firefox are unverified** (silent switch, `interrupted`). Where a Content-Security-Policy refuses `blob:`
   and `data:` scripts, the voices use the native-node fallback, which is also click-free but follows the pointer about
   10 ms later (§7.4). The browser logs the refusal (two console lines) once per page.
5. **Merge contention in `app.js`:** the hooks are small and spread out.
6. **Ship hygiene:** the prototype's `embedtest` message hook (test-only, now limited to the test host's origin) is not
   part of `src/sound.js`.

---

## 5. Questions for the user

1. After listening: are the palette, the timbres and the balance right? In particular, is the register swing of the
   hover tone (±0.3 octave) helpful or distracting?
2. Build Stage 1 only, or both stages?
3. Publish the prototype as a private artifact, so you can try it inside claude.ai itself (the real frame)?

---

## 6. What changed in revision 2 (review → resolution)

| Finding | Resolution |
|---|---|
| a11y P1-1: "on" enables hover chatter | Tiers split by trigger; every pointer-driven cue moved to the opt-in tier; measured silent on hover |
| a11y P1-2, sound P2.8: the voice runs backwards | True sign always; whole turns beyond one are dropped (identical sound); measured monotone |
| a11y P1-3, sound P1.2: bells and ticks dropped | Count-bearing queue on the audio clock (≤ 8/s, ≤ 12/s), flourish beyond 8; exact playback |
| a11y P1-4: preimage found/lost are artefacts | Removed; "preimages collide" at a critical value instead |
| a11y P1-5, sound P1.6: zero/pole forced; Newton order wrong | No force, shared gap, cluster → "dense"; order by the argument principle on a circle |
| a11y P1-6: a suspended context queues a burst | Schedule only on a running clock; one sound inside an active gesture |
| a11y P1-7: off makes a sound | Silent, immediate off |
| a11y P1-8: the arrival chime repeats | Once per user-started play |
| sound P1.1, a11y P2-9: voices too loud | Shepard −32.9 LUFS, Height −32.5; 6 dB ducking; bell +17 dB in its band |
| sound P1.3: panner skipped at 0 | Always a panner (fallback √½); recalibrated through it |
| sound P1.4: inaudible room | Wet 0.5 → 2.0 (bells ring 15–18 dB under the direct sound) |
| sound P1.5: Error and Pole vanish on phones | New recipes; phone loss 3.2 and 4.1 dB; pole on A4 → A3 (in the palette) |
| sound P2.7, a11y P2-15: register vs pitch | ±0.3 octave, loudness 60–100 %, renamed "register" |
| sound P2.9: setTarget scallops | Linear ramps over the event interval |
| sound P2.10: Height out of tune | One contour = one pentatonic step; tick = the tone an octave up; organ timbre |
| sound P2.11: cues clash with the voice | Cues transposed to the voice's chroma; the bell is "home"; arg 0 = D |
| sound P3.12: confusable cues | Export → swish + key; deformation plays → filtered swell; turn bell → home figure in its own register |
| sound P3.13–P3.16 | Export at −29; scrub detents +7 dB, landmarks only pitched; snap at 1.9 kHz without the sine; order pings 150 ms for m ≥ 3, first +3 dB |
| sound P3.18: aliasing | Partials above 0.45·fs omitted (voice, curve buffer, bells) |
| sound P3.17: σ 1.2, N 10 | Not changed: worth an A/B in the listening test; σ 0.95 keeps energy above 300 Hz for small speakers |
| a11y P2-10: snap ratchet | Own switch, off; ≤ 8/s; 1.9 kHz, 3 dB under the other detents |
| a11y P2-11: cues during gestures | App rule in §2.4 and §4.1 (the prototype has no pan or zoom) |
| a11y P2-12: queued cues poison the guard | Scheduled and forced cues are outside the storm guard |
| a11y P2-13: no Stop | Stop button, Esc, pointer move > 4 px; auto-play only for the first loop |
| a11y P2-14: live-region churn | `#result` no longer live; short messages only |
| a11y P2-16: two taps on phones | The speaker in the phone header while sound is on (app) |
| a11y P2-17: dimmed text | No opacity; an explicit "Sound is off" line |
| a11y P2-18: panning too wide | Cues ±0.4, voices ±0.3 |
| a11y P3-19–P3-21 | Visible label "Sound", `aria-keyshortcuts`; hook after the guards; no note names |
| a11y P3-22: landmarks | Centre start, round steps, edge bump, Z, O (D proposed for the app) |
| a11y P3-23: tone over speech | 280 ms samples per keyboard step |
| a11y P3-24: playback ticks in the wrong tier | Playback, its bells and its ticks share the Events tier |
| a11y P3-25: test hook | Origin-checked; not shipped. Tracker budget in §4.3 |
| a11y P3-26: collapsed panel | `IntersectionObserver` proposed (low priority) |

## 7. Click-free synthesis (revision 3)

The user wrote: "I like the sound, but there are bad artifacts that sound like snaps when I move. They disappear if I
stay still." This was measured, not guessed. The snaps came from the engine's parameter scheduling, not from the
cues, the wraps or the clipper.

### 7.1 How it was measured

- **Live reproduction** (`cdp2/cmd/rt.js`): headless Chrome 155 ran the prototype's own page and engine.
  - Pointer events were dispatched on the plane at 60, 120 and 240 Hz, with ±25 % timing jitter and 2 % main-thread
    stalls of 20–45 ms.
  - There were 13 trajectories: a slow line, a fast back-and-forth, flicks, a circle around a zero, a pass 0.012 from a
    zero, a circle around the pole of 1/*z*, a walk over (*z*−1)(*z*+1)²/(*z*²+1), crossing √*z*'s cut, rising in
    e^*z*, a random walk, a 1-px creep, a dragged loop around both zeros, and a walk in Height mode.
  - The output was recorded sample-exact after the soft clipper by an AudioWorklet tap (`cdp2/rec_inject.js`). No
    recording had a gap.
- **Detector** (`cdp2/clicks.py`):
  - It uses a zero-phase 8th-order high-pass at 10 kHz, where the voice itself is below −75 dB.
  - A click is a 1.3 ms block whose peak is at least 12 dB over the high band's local median, and at least −60 dB re
    the local full-band RMS.
  - Calibration: gain steps of the whole signal were injected into clean recordings. It found 3 % steps (−30 dB) 29
    times in 30, 1 % steps 24/30, 0.3 % steps 13/30 and 0.1 % steps 0/30. Steps it misses are those that fall near a
    zero crossing, where the discontinuity really is small.
  - With all cues on, every scheduled cue is logged. A detection inside a cue's own sound is that cue's designed attack
    (a cut tick, a ping), which the lab already checks.
- **Offline** (`cdp2/cmd/cah.js`, `cah2.js`): each scheduling pattern was driven on a ConstantSource in an
  OfflineAudioContext, with events exactly on the render clock.

### 7.2 What it found

Revision 2, live, gave **2,797 clicks in 36 recordings**, up to 121 a second. The loudest was +1.8 dB re the voice's
RMS, as loud as the voice itself. Even the slow line at 60 Hz clicked 12 times in 4 s.

| Trajectory | Revision 2 (60 / 120 / 240 Hz) | Revision 3, AudioWorklet | Revision 3, node fallback | Revision 3, all cues on |
|---|---|---|---|---|
| slow line | 12 / 40 / 73 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| fast | 31 / 76 / 41 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| flicks | 3 / 35 / 115 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| circle a zero | 45 / 75 / 74 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| pass by a zero | 36 / 46 / 35 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| circle a pole | 8 / 68 / 119 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| rational walk | 26 / 77 / 156 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| √*z*'s cut | 88 / 98 / 72 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| e^*z* rising | 2 / 4 / 18 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| random walk | 2 / 7 / 19 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| 1-px creep | 5 / 52 / 106 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| dragged loop | (not run) | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Height walk | 238 / 374 / 521 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |

Notes on the table:

- The revision 2 counts include the few designed cue attacks in the cut, pass-by-a-zero and rational-walk runs. The
  ablation below, with cues off, still gave 1,619 clicks in 12 recordings.
- The worklet and fallback runs had cues off. Their worst impulsive block was −65 and −63.5 dB, below the −60 dB floor.
- With all cues on, 125 cues were scheduled. Every one of the 544 detections fell inside a cue's own sound.

**Ablation** (live, voice only; 6 trajectories at 120 and 240 Hz):

| Change | Clicks |
|---|---|
| Cues off (the voice alone) | 1,619 |
| Gate opened once instead of at every event | 626 (Height mostly fixed) |
| No panner | 1,642 |
| No `cancelAndHoldAtTime` (`cancelScheduledValues` + `setValueAtTime(p.value)` instead) | 183, worst −33 dB |

**The mechanism** (offline, exactly on the render clock, so this is not a main-thread timing problem):

- Revision 2's `ramp()` was `cancelAndHoldAtTime(t)` + `linearRampToValueAtTime(v, t + d)`, for every partial's
  detune and gain at every pointer event. Each ramp lasted one event interval, so about every other event found the
  previous ramp already ended.
- Then nothing lies after `t`, so `cancelAndHoldAtTime` inserts no anchor. The spec says so: it holds only when an
  event follows the cancel time.
- The new linear ramp then starts from the previous event's time and value, in the past. The value jumps forward along
  it. On an idle parameter (Chrome drops processed events) the ramp starts from time 0 and the value jumps almost to its
  target.
- Measured: jumps of up to **75 % of the ramp's range**, 4,776 times the largest step the intended curve allows.
- The Firefox path, `cancelScheduledValues` + `setValueAtTime(p.value)`, gives 454 times, because `p.value` is stale by
  up to a render callback.
- Chains of `setTargetAtTime` gave 3.7–5.3 times: a change of slope, not a jump.
- The Height voice also mixed `ramp()` and the gate's `cancelAndHoldAtTime` + `setTargetAtTime` on one gain, at every
  event.
- The partials' wraps, the clipper and the cues were not the cause. Removing the cues or the panner changed nothing.

**Scheduling lead** (`cdp2/cmd/lead.js`, live):

- `currentTime` advances in 256-frame steps (5.3 ms).
- A `setValueAtTime` at `currentTime` + 0 to 6 ms sometimes landed late, by up to 4 ms (1 to 6 cases in 120).
- At +10 ms or more it never landed late (0 of 352).

### 7.3 The fix

1. **The continuous voices run in an AudioWorklet** (`WORKLET_SRC` in the engine), loaded from a Blob URL, else a
   `data:` URL.
   - Every sample is computed from per-sample-smoothed controls.
   - The chroma moves by linear slews. They are sent as deltas, so whole turns never matter.
   - Register, loudness, pan, gate and duck move by one-pole smoothers.
   - Each partial is a phase accumulator.
   - Commands are time-stamped and applied at their sample, or on arrival when late. A late or bunched message adds
     latency; it can never step a value.
   - In an offline render, the commands go into the node's options, so lab renders stay exact and deterministic.
2. **The bell is exactly zero, with zero slope, at both band edges.** It is the Gaussian times sin² over the outer half
   octave, where the Gaussian is already below −52 dB. A partial wraps at exactly zero gain.
3. **The fallback** is native nodes with anchored, append-only automation. It is used where a CSP refuses `blob:` and
   `data:` scripts, where there is no AudioWorklet, and while the module loads.
   - Each moving parameter has its own timeline (a `Lane`).
   - A move starts at max(now + LEAD, the lane's end), anchored with `setValueAtTime(end value)`, and is never
     cancelled.
   - A move has a breakpoint every 1/16 turn, so the gains follow the bell, and an exact split where a partial wraps.
   - A move ends one event interval after now + LEAD, so no queue builds up. A newer target waits while the queue is
     more than 20 ms ahead.
4. **Every other parameter** (volume, tiers, pan and duck in the fallback) only ever gets `setTargetAtTime`, from
   now + LEAD (`follow`). LEAD is twice the callback period, at least 12 ms. (The hush bus now uses raised-cosine value
   curves instead: §7.6.)
5. **One-shots start at now + LEAD**, so an anchored attack never begins in the past. This adds 7 ms to cue latency.
6. **No `cancelAndHoldAtTime` anywhere.** A cut's jump is a 12 ms glide; the cut tick marks it. Partials fade out
   between 0.40 and 0.45·fs instead of being cut.
7. **Event cues** needed no new limits. With all cues on, no detection fell outside a cue's own sound. The existing
   limits stand: a 120 ms gap for the cut tick, a shared 250 ms gap and the cluster rule for zeros and poles, and queues
   for bells and ticks.

### 7.4 What stayed the same, and the cost

- **Levels (the lab, offline, worklet):**
  - Shepard −32.9 LUFS at |F| = 1, range 4.9 dB, phone 7.1 dB.
  - Height −30.6 / −32.5 / −33.9.
  - Level ripple 0.85 dB, pitch class within 5.5 cents.
  - Turn bell over the voice +17.2 dB.
  - The "listen along" read-backs are identical.
  - All of these match revision 2 to 0.1 dB. All 30 lab rows pass.
  - The fallback renders within 0.01 dB of the worklet.
- **Pitch latency** (from the pointer event to the pitch in the output, read back from the audio on the e^*z* rise;
  device output latency not included):

  | Engine | 60 Hz | 120 Hz | 240 Hz |
  |---|---|---|---|
  | Worklet | 24 ms | 14 ms | 14 ms |
  | Fallback (median; p90 at 240 Hz: 51 ms) | 33 ms | 25 ms | 34 ms |

- **CPU** (20 s rendered offline, as a share of one core): Shepard 1.09 % in the worklet (revision 2: 1.41 %), 1.34 %
  in the fallback; Height 0.90 % (revision 2: 0.85 %).
- **Sandboxed cross-origin frames** (`cdp2/cmd/frames.js`):
  - Variants A (`allow-scripts`, opaque origin), B (+ `allow-same-origin`) and C (B + `Permissions-Policy:
    autoplay=()`) load the worklet from its Blob URL.
  - Variant D (B + a CSP with `script-src 'self' 'unsafe-inline'`) refuses both URLs and plays through the fallback.
    The browser logs two CSP lines, once per page.
- **Size:** the engine grew from 41 to 59 KB with comments, and from 14 to 20 KB gzipped (§1.3).

### 7.5 For `src/sound.js`

- Take the engine as it is now.
- `build.py` needs nothing new: the worklet's source is a string inside the engine.
- The CDP regression in §4.1 should include `cdp2/cmd/rt.js` with `clicks.py`, expecting 0 clicks with cues off, on at
  least the slow line, the circle around a zero and the Height walk, at 60 and 240 Hz.
- Not verified: how it sounds (I cannot listen), Safari and iOS, and Firefox.

### 7.6 Independent verification, and two more snaps fixed

A second engineer re-tested revision 3 with **nothing shared** with §7.1: a new harness (`cdp3/`), a new recorder, new
detectors and new trajectories. It also added what §7.1 did not cover: a **CPU-throttled main thread**
(`Emulation.setCPUThrottlingRate` 6×, a low-end laptop), **all cues on** (the user's setting), and **actions while
moving**: switching Phase/Height, turning Hear F off and on, switching the function, Esc, the pointer leaving and
re-entering, and "Listen along γ" stopped by moving.

**How** (`cdp3/README.md`):

- **Recorder** (`cdp3/inj.js`): an AudioWorklet tap on everything the page connects to the destination (after the
  clipper), sample-exact, in the order the quanta were rendered. It also logs every source start/stop (requested time
  and clock at the call), every automation call already behind the clock, every command posted to the voices' worklet,
  and every pointer event and action.
- **Driver**: a precomputed schedule at 60, 120 or 240 Hz with ±35 % jitter and 2 % main-thread stalls of 20–60 ms.
  Events whose time has passed are dispatched together, as a busy main thread does.
- **Trajectories** (18 cases): erratic scribble (to ~4,000 px/s), flicks, fast tight orbits around a zero (2–7 turns/s),
  orbits over the double zero, passes grazing the poles at 0.004–0.05, a 6 Hz zigzag across √*z*'s cut, fast e^*z*
  sweeps, a 3-px tremor, stop-and-go with pauses past the 1.6 s stillness fade, a slow line, Height scribble and pole
  grazes; and the six action cases above.
- **Detector A** (`cdp3/det.py`): a zero-phase raised-cosine high-pass (9 → 11 kHz; the voices are below −80 dB there),
  0.5 ms blocks, a click is ≥ 15 dB over the ±40 ms median and ≥ −66 dB re the local RMS.
- **Detector B**: forward linear prediction (order 24, fitted on the previous 25 ms). A sum of slowly moving partials
  is predicted almost exactly; a step in a value or a slope is not. It is far more sensitive than A.
- **Calibration** (`cdp3/calib2.py`, whole-signal gain steps injected into a clean recording, 12 each):

  | Step | A found | A level | B found | B level |
  |---|---|---|---|---|
  | 0.1 % (−60 dB) | 1 | −65 dB | 11 | −44 dB |
  | 0.3 % | 9 | −63 dB | 12 | −37 dB |
  | 1 % | 11 | −51 dB | 12 | −21 dB |
  | 10 % | 12 | −33 dB | 12 | −2 dB |

  A hit is counted as a **snap** when A finds it at ≥ −50 dB re the local RMS (about a 1 % step or more), outside every
  cue's own sound (its start to its stop) and outside the recorder's quantum-label glitches (below).

**What it found in revision 3** (72 recordings, 322 s, 34,700 pointer events, 2,380 cues; throttle 1× at 60 and
120 Hz, 6× at 120 and 240 Hz):

- **The hover tone itself is clean.** Every trajectory, both throttles, every rate: no snap. The worst A hit outside
  the action cases was −59 dB, B's −48 dB (under a 0.1 % step). No automation call landed behind the clock, and no cue
  started late, even at 6×.
- **Esc while moving snapped, every time** (−7 to −10 dB re the voice's RMS, nearly as loud as the voice). `hush()`
  faded the bus and stepped it back to 1 with `setValueAtTime(1, t + 50 ms)`. The pointer, still moving, re-gates the
  hover voice within those 50 ms, so the step landed under a sounding voice. The recording shows the bus at exactly 0
  for ~5 ms, then the step.
- **Stopping "Listen along γ" by moving snapped** (−3 to −17 dB). A move of more than 4 px calls `stopPlay(true)`. That
  called the curve's `src.stop()` with no time, which cuts the buffer mid-waveform, then `hush()` with the same step.
  Pressing the button while it plays did the same. The user may well have heard these as "snaps when I move".
- Not snaps, but removed anyway: the voices' one-pole gate starts with a corner (slope 1/τ). B saw it at every onset,
  at −18 to −22 dB from silence and about −48 dB at mode switches. A did not.
- (The first 120 Hz run of √*z*'s cut showed 37 hits: the logger had missed `AudioBufferSourceNode.start`, which has its
  own method, so the cut ticks were not known as cues. With that fixed, the same case has no snap.)

**The fix** (in `prototype.html`, i.e. the proposed `src/sound.js`):

1. **`hush()`** moves the bus on raised-cosine value curves: down in 12 ms from now + LEAD, sources stopped inside the
   silent window that follows, and back up in 30 ms from 50 ms after the start. No step, and no corner. A hush during a
   hush joins its silent window or, during the return, starts a new one after it, so the curves never overlap (if one
   ever were refused, it falls back to target curves).
2. **"Listen along" stops on a 12 ms raised-cosine fade** of its own gain, and its source is stopped 20 ms later, never
   mid-waveform. This covers every caller: moving, the button, Esc, a new loop, Clear.
3. **`hush()` fades the voices from now**, not from now + LEAD. Under 6× throttling a 200 ms stall bunched 13 pointer
   events behind the stop. Their gate-on commands, stamped "now", ran before a fade stamped now + 12 ms, so the voice
   swelled for 10 ms and was then cut: A −43.5 dB. In command order, any later event simply re-gates the voice under
   the bus's silent window.
4. **The worklet's gate and duck are two cascaded one-poles** (τ/2 each). An onset, a fade or a duck now starts with
   zero slope. The step response reaches 59 % at τ, against 63 %; the half-level point of an onset moves from 14 to
   17 ms. Pitch following is unchanged (the chroma slews are untouched).

An intermediate version with target curves (τ 4–5 ms) instead of value curves left −57 to −43 dB (A) and −35 to
−19 dB (B) at each stop: up to a 1 % step's worth. That corner is why the fades are raised cosines.

**After the fix** (the final version, the same 18 cases; which runs are pooled is under the table):

| Case | Revision 3: runs, snaps, worst A, worst B | Fixed: runs, snaps, worst A, worst B |
|---|---|---|
| √*z*: 6 Hz zigzag across the cut | 3, **0**, —, -19 | 4, **0**, —, -35 |
| e^*z*: fast sweeps | 4, **0**, —, -20 | 4, **0**, —, -47 |
| flicks | 4, **0**, —, -22 | 4, **0**, —, -55 |
| switching the function | 4, **0**, —, -20 | 4, **0**, —, -53 |
| Height: grazing the poles | 4, **0**, —, -18 | 4, **0**, —, — |
| Height: scribble | 4, **0**, —, -57 | 4, **0**, —, — |
| Hear F off and on | 4, **0**, —, -20 | 4, **0**, —, -60 |
| leaving and re-entering | 4, **0**, —, -20 | 4, **0**, —, -53 |
| Phase ↔ Height | 4, **0**, —, -48 | 4, **0**, —, -60 |
| orbits over the double zero | 4, **0**, —, — | 4, **0**, —, — |
| fast orbits around a zero | 4, **0**, —, -22 | 4, **0**, —, -59 |
| grazing the poles | 4, **0**, —, -19 | 4, **0**, —, — |
| erratic scribble | 4, **0**, —, — | 4, **0**, —, -57 |
| slow line | 4, **0**, —, -19 | 4, **0**, —, -58 |
| stop-and-go | 4, **0**, —, -21 | 4, **0**, —, — |
| 3-px tremor | 4, **0**, —, -18 | 4, **0**, —, — |
| **Esc while moving** | 4, **8**, -7, 9 | 6, **0**, —, -41 |
| **stopping Listen along by moving** | 4, **8**, -3, 29 | 6, **0**, -64, -31 |

Levels are dB re the local RMS; "—" means no hit at all. The revision 3 column pools throttle 1× at 60 and 120 Hz and
6× at 120 and 240 Hz; the fixed column pools 1× at 120 and 240 Hz and 6× at 60 and 240 Hz, and for the two stop cases
1× and 6× at all three rates. Revision 3's worst B values of −18 to −22 dB are the one-pole gate's corner at the
voice's first onset from silence; A does not see them.

- **Worklet, all 18 cases: 0 snaps** in 76 recordings (339 s, 43,500 pointer events, 2,560 cues), against 16 in
  revision 3. The two stop cases went from −3 and −7 dB to nothing above −64 dB.
- **Node fallback** (6×, 120 Hz, all 18 cases): **0 snaps** in 18 recordings. Its gate is still a native target curve,
  so B sees corners at onsets (to −26 dB from silence) and A once reached −50.3 dB, at a stop of Listen along with
  bunched events.
- No automation call landed behind the clock and no cue started late, in any run.

**Not the engine:**

- **Quantum labels.** Under load Chrome sometimes gave two consecutive render quanta the same `currentFrame` (and then
  skipped one label): 108 times in the 66 recordings that log it. `playbackStats` reported 0 underruns in every run that
  logged it, so this looks like a label glitch, not lost audio. The first runs placed quanta by label, which made holes
  in 28 recordings; hits there were excluded (±30 ms). The last runs place quanta in rendering order. No engine hit
  fell on a label glitch; the 21 hits that did were all inside cue sounds (Height contour ticks), so this check cannot
  rule out a real glitch there.
- **The cut glide.** At √*z*'s cut, B sees −35 to −56 dB (about a 0.1 % step), 3–8 ms after each jump. That is the
  start of the designed 12 ms half-turn glide, 4–9 ms before the cut tick, which covers it. A sees nothing (< −62 dB).

**Unchanged:** the lab's 30 rows all pass. The largest difference from revision 3 in any of their numbers is 0.0001,
and all ten Shepard and Height read-backs are identical. The worklet costs 9.5 µs per 128-frame quantum for the
Shepard voice and 3.8 µs for Height (0.36 % and 0.14 % of one core, in node on this machine), the same as before.

**Open:**

- "Listen along γ" builds its buffer on the main thread (`curveBuffer`: every sample, 9 partials). At 6× that blocked
  the page for about 200 ms per press, which is what bunched the events above. It is jank, not a click. It could
  render in an OfflineAudioContext or in the voices' worklet.
- The fallback's gate keeps native target curves, so its onsets and stops have corners up to about −50 dB (A).
- Not verified: how it sounds (I cannot listen), Safari, iOS and Firefox. A rapid-fire hush test (ten calls 0–400 ms
  apart) raised no exception and left the bus at 1.

**For `src/sound.js`:** take the engine as it is now. Add `cdp3/cmd/run.js` with `det.py` to the CDP regression,
expecting no snap in the Esc and listen-along cases at 6×.

## Files

- `README.md`: the short version.
- `prototype.html`: the playable prototype (engine, demo, sound board, measurements).
- `DESIGN.md`: this document.
- `shots/`: screenshots.
- `cdp/`: the headless-Chrome kit (a copy of `test/cdp_kit`); `cmd/t1–t9.js` (revision 1), `cmd/r1–r3.js` (revision
  2), `cmd/a11y1–4.js` (the accessibility review).
- `cdp3/`: the independent click verification (§7.6): its own daemon and server (port 8874), the recorder and driver
  (`inj.js`), the detectors (`det.py`, `calib2.py`, `sum.py`), `cmd/run.js` with its case files, and the working copies
  `rev3_before.html` (revision 3 as verified) and `fix.html` (the fixed engine, now `prototype.html`).
- `cdp2/`: the click investigation (revision 3, §7). It has its own daemon and server (port 8872), the recording tap
  (`rec_inject.js`), the detector (`clicks.py`), the latency read-back (`latency.py`) and the command files in `cmd/`.
- `review-sound.md`, `review-sound/`, `review-a11y.md`: the two reviews and their scripts.
