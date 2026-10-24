# Hearing F: what people actually do (practice, 2swap, oscilloscope music, fractals, zeta)

Research B for the user's question of 2026-10-24: "I am not really understanding how the audio version should sound ...
Maybe we don't need each point sound? Maybe it should be composite of a curve or a function?"

Nobody here can listen. "Sounds like" below comes from the code (exact numbers worked out from it), from published
descriptions, or from acoustics, and each one says which.

## 0. The short answer

People who make mathematics audible use three families of mapping. The app uses only the first today.

| Family | What becomes sound | Who does it | Typical sound |
|---|---|---|---|
| **A. Parameter mapping (one point at a time)** | a value at the cursor sets the pitch, loudness or pan of a fixed instrument | Desmos Audio Trace, Apple Audio Graphs, Highcharts, 2swap's pendulum "hum" and Turing-machine notes, **our Shepard tone** | a melody or a glide on one instrument; as natural as the instrument |
| **B. Audification of a curve (the curve is the waveform)** | a closed or repeating path is played at audio rate: x is the left channel, y is the right | 2swap's double-pendulum "islands", CodeParade's Fractal Sound Explorer, oscilloscope music, zeta Z(t) as samples | a buzzy, synth-like tone whose **pitch is the repeat rate** and whose **timbre is the shape**; chaos sounds like noise |
| **C. Scanning a function along an orbit** | a function of two variables is read along a closed path at audio rate, and the path moves slowly | wave-terrain synthesis, scanned synthesis | a tone whose timbre morphs as you move the path ("a wavetable you steer") |

Family B (and C) is the "composite of a curve or a function" the user is asking about. It is what 2swap and
CodeParade do, and it is how their videos get sounds that commenters call striking. For a holomorphic F it has an exact
mathematical meaning, worked out in §8: a small circle traversed at f₀ Hz plays the Taylor or Laurent coefficients of F
as harmonics. A zero of order m sounds the m-th harmonic, and the nearer the closest pole or cut, the brighter the tone.

## 1. 2swap: the swaptube engine (github.com/2swap/swaptube)

2swap's videos are rendered by **swaptube**, a C++/CUDA engine on FFmpeg. It is public domain (Unlicense), 1.8k stars.
Narration is recorded per sentence (`record_audios.py`). Everything else that sounds is synthesised in code, sample by
sample, and mixed into an `sfx_buffer` (`src/IO/AudioWriter.cpp`, `add_sfx`). I read the whole audio path at
`master` and at commit `da533e7` (2025-02-22, "No remaining open items on pendulum video"). The engine uses four
techniques.

### 1.1 Audification of an orbit: "Double pendulums are Chaoticn't" (Jul 2025)

Video: <https://www.youtube.com/watch?v=dtjb2OhEQcU>. Each "island of stability" (a periodic pendulum in the chaotic
sea) is shown with its path and **played as audio**. The two angles of the pendulum are the two stereo channels, sampled
at audio rate (`src/Scenes/Physics/PendulumScene.cpp`):

```cpp
void PendulumScene::generate_audio(double duration, vector<sample_t>& left, vector<sample_t>& right, double volume_mult){
    PendulumState ps = start_state;
    for(int i = 0; i < duration*get_audio_samplerate_hz(); i++) {
        for(int j = 0; j < 10; j++) ps = rk4Step(rk4Step(rk4Step(ps, 0.001), 0.001), 0.001);
        left.push_back(float_to_sample(.05*volume_mult*sin(ps.theta1)));
        right.push_back(float_to_sample(.05*volume_mult*sin(ps.theta2)));
    }
}
```

- **Technically.** 30 RK4 steps of 0.001 per sample: 0.03 simulated time units per sample, 1323 per second at
  44.1 kHz. A periodic orbit of period T therefore sounds at 1323/T Hz. The video script
  (`src/Projects/DoublePendulum.cpp` at `da533e7`) plays 3 to 5 s of each island and says of one of them that its period
  is very long, so its sound is very deep.
- **What it sounds like.** A stable island is a steady pitched tone with a timbre set by the shape of its path (a
  Lissajous-like path is nearly two sines). A chaotic pendulum is hiss. Viewers liked it: on Tildes, one commenter singled
  out the sound, another called it synth-like tones derived from the swinging, and a third heard that two islands form a
  perfect twelfth (a 1:3 frequency ratio) ([thread](https://tildes.net/~science/1p22/double_pendulums_are_not_chaotic)).
  **The pitch interval is a mathematical fact (a 1:3 resonance) that people heard without being told.** That is the
  strength of family B.

### 1.2 Parameter mapping: the pendulum hum

In the same scene, `generate_tone()` plays a fixed sine (`sin(n·2200·tone/44100)`, ≈ 350 Hz × `tone`), with loudness
proportional to the square of the pendulum's kinetic energy, interpolated across each frame. Plain family A: one sine,
one parameter. It is a background hum under the animation, not the main event.

### 1.3 Event notes: the busy-beaver Turing machines

`src/Scenes/Math/Beavers/TuringMachineScene.cpp`. Each (state, symbol) transition has its own fixed pitch, and each step
of the machine plucks it:

```cpp
void beep(int state, int symbol, int num_states){
    int tone_number = state + symbol * num_states;
    vector<double> notes{12, 5, 17, 22, 21, 15, 9, 29, 25, 27, 19};   // semitones above A4
    sfx_boink(get_global_state("t"), 440 * pow(2, notes[tone_number]/12.), .05, 1);
}
```

`sfx_boink` (`src/IO/SFX.cpp`) is a sine under an exponential decay, `0.5^(i/halflife)`, 50 ms half-life, cut after
5 half-lives (250 ms). Pitches: A5, D5, D6, G6, F♯6, C6, F♯5, D7, A♯6, C7, E6, hand-picked. **What it sounds like** (from
the code): a marimba-like blip per step. The machine's rhythm becomes a tune, and a loop in the machine becomes a
repeating riff. Only the pitch identity carries information, and it is quantised to notes, which is why it is pleasant.

### 1.4 The newest engine: MIDI out, sound designed afterwards (Aug 2026)

Commit `4c869e9`, "Replace audio hints with new MIDI engine" (`src/IO/MidiWriter.cpp`, `src/Scenes/Media/MidiSoundScene.cpp`,
demo `src/Projects/Demos/MidiDemo.cpp`). Every sound effect also writes a MIDI note on its own fixed lane ("like a drum
map", one semitone per voice from middle C). Every continuous state variable becomes an automation-only track: a CC1
curve scaled to its own range. The demo plays a pentatonic scale of `boink`s and a drone that glides.

**What this tells us:** 2swap keeps the math-driven sine synthesis as a guide, but exports its events and curves so
that the final sound can be made in a DAW with real instruments. In other words, he also found raw synthesis too plain
for the finished video, and moved timbre out of the math code. That matches what the user is hearing in our Shepard
tone, and the parallel `v2/timbres.js` work (cello, choir, glass, reed) is the same move.

Other 2swap repos (Klotski-Webpage, WeakC4, LittlewoodFractal) have no audio. The Mandelbrot-family video (XSet) has
narration only.

## 2. CodeParade: Fractal Sound Explorer (2021)

Repo <https://github.com/HackerPoet/FractalSoundExplorer> (MIT, 1.25k stars), video <https://youtu.be/GiAj9WW1OfQ>. It
is the closest existing thing to "hear a complex map". Click a point c: the orbit z → z² + c (or Burning Ship, Hénon,
Duffing, Ikeda, Chirikov, Julia sets) is played as stereo audio, **one iteration per 12 samples** (48 kHz / 4000).
Excerpt from `Main.cpp`, `Synth::onGetData`:

```cpp
const int steps = sample_rate / max_freq;          // 48000 / 4000 = 12 samples per iteration
if (j == 0) {                                      // next iterate
  play_px = play_x; play_py = play_y;
  fractal(play_x, play_y, play_cx, play_cy);
  dx = play_x - mean_x;  dy = play_y - mean_y;     // remove DC: subtract a running mean
  mean_x = mean_x*0.99 + play_x*0.01;  ...
  if (!sustain) volume *= 0.9992;                  // slow decay unless "sustain"
}
double t = 0.5 - 0.5*cos(j/(double)steps * 3.14159); // cosine interpolation between iterates
left  = (t*dx + (1-t)*dpx) * volume;  right = (t*dy + (1-t)*dpy) * volume;
```

A second mode (`normalized`) plays only the direction of z − c (unit length): the phase alone.

**What it sounds like** (worked out from the code, consistent with the video):
- An orbit that settles on a cycle of period p is a steady tone at **4000/p Hz**: period 2 is 2000 Hz, period 3 is
  1333 Hz, period 10 is 400 Hz, period 40 is 100 Hz. Each bulb of the Mandelbrot set has its own pitch, and the period
  doubling cascade is heard as **octave drops**.
- An orbit attracted to a fixed point (the main cardioid) is silent after the transient, because the DC is removed.
- A chaotic orbit (on the boundary, Hénon, Chirikov) is noise or a gritty buzz. An escaping orbit stops.
- The decay of 0.9992 per iteration is a 0.22 s half-life, −60 dB after 2.2 s: every click is a plucked, gong-like
  note, and "D" toggles sustain.
- The timbre comes from the shape of the cycle: a p-gon of points with smooth (cosine) joins. It is rich and buzzy,
  "electronic". Dragging the point gives continuous timbre morphs and sudden pitch jumps at bulb boundaries.

## 3. Oscilloscope music (XY audio)

- **Jerobeam Fenderson** (<https://oscilloscopemusic.com/>, the album *Oscilloscope Music* and the EP *N-SPHERES*,
  2024) with **Hansi Raber** (OsciStudio). Left channel = x, right = y. Every track is made of parametric functions, so
  that the same stereo signal is both the music and an analog-scope picture. A track can even be a small program
  (*FUNCTION* is about 41 KB). Tools: Pure Data, Max, OsciStudio (Blender scenes to audio)
  ([Hackaday](https://hackaday.com/tag/jerobeam), [Wikipedia, oscilloscope music](https://en.wikipedia.org/wiki/Oscilloscope_Music)).
- **osci-render** by James Ball (<https://github.com/jameshball/osci-render>): a synth plugin (VST3/AU/standalone) that
  draws .obj, .svg, text and Lua scripts. Its default patch is a circle, which is a sine.
- **woscope** (<https://github.com/m1el/woscope>): a WebGL XY oscilloscope in the browser, a viewer for such audio.
- **Uni Passau Mathe-Museum** (<https://mathe-museum.uni-passau.de/fileadmin/dokumente/fakultaeten/fim/lehrstuhl/forster-heinlein/oscilloscope-music/index.html>):
  an explorable on Lissajous figures, wave sums and flowers, with a playground (`x = 0.5 cos(220 Hz), y = 0.5 sin(440 Hz)`).

**Technically.** A figure redrawn f times a second is a periodic signal: pitch f. Its timbre is its Fourier series,
which is exactly its epicycles. A circle is a pure sine on both channels, 90° apart. Corners and jumps add strong high
harmonics: a jump falls at −6 dB per octave, a corner at −12 dB per octave. Line drawings are full of both.

**What it sounds like:** buzzy, square-ish synth tones, often harsh, made musical by careful composition (pitch is
chosen as notes, shapes rotate in time with the music). Musicians point out that the visual constraint fights the
sound. The music has to sound good and look good at once, which needed new synthesis and mixing methods. For us the
lesson is that a raw curve-as-waveform is only as pleasant as the curve is smooth, and that a smooth curve sounds pure.

## 4. A function of two variables read along a moving orbit

- **Wave-terrain synthesis** (term from Rich Gold, 1978, per an ICMC 2014 paper
  <https://speech.di.uoa.gr/ICMC-SMC-2014/images/VOL_2/1437.pdf>; thesis by Stuart James, ECU,
  <https://ro.ecu.edu.au/theses_ebooks/4>). A surface w(x, y) (the terrain) is read along a closed 2-D path (the orbit)
  at audio rate. The path's repeat rate is the pitch and the terrain gives the timbre. Implementations: SuperCollider
  `WaveTerrain`, Csound `wterrain2` (<https://csound.com/manual/opcodes/wterrain2/>), Aaron Anderson's free *Terrain*
  plugin. **This is our app's situation exactly:** the terrain is the landscape or phase of F, and the orbit is a loop
  in X.
- **Scanned synthesis** (Verplank, Mathews, Shaw, Interval Research, 1998–2000;
  <https://en.wikipedia.org/wiki/Scanned_synthesis>, Csound opcodes by Paris Smaragdis, <https://www.csounds.com/scanned/>).
  A shape that moves slowly (below about 15 Hz, a mass-spring model) is scanned along a closed path at audio rate. The
  scan rate sets the pitch independently of the shape, and the shape's slow motion is heard as a living timbre. This is
  the deformation H_t: the shape changes slowly with t while it is played at a fixed pitch.

**What they sound like:** evolving, "breathing" tones, like a wavetable synth pad. With smooth terrains (sums of sines)
the result is mellow. Sharp terrains buzz.

## 5. The Riemann zeta function as sound

- **Z(t) as raw samples** (Andrey Kulsha, after Robert Munafo; <https://empslocal.ex.ac.uk/people/staff/mrwatkin/zeta/kulsha.htm>).
  The Riemann–Siegel Z(t) is computed at t = i/4 and written as 16-bit mono at 8 kHz (2000 units of t per second), in
  four 50 s clips from t = 0 and from 10⁷, 10⁹ and 10¹¹. My estimate: the main term cos θ(t) has frequency
  ln(t/2π)/4π per unit t, which is ≈ 159·ln(t/2π) Hz at this speed. That is about 1.5 kHz near t = 10⁵ and 3.7 kHz near
  10¹¹ (just under the 4 kHz Nyquist, which fits his choice of rate). The terms n ≥ 2 add lower partials. So it sounds
  like a slowly rising chirp-chord with beating, and each zero is a zero crossing.
- **Nick Collins, "Sonification of the Riemann Zeta Function"**, ICAD 2019, DOI 10.21785/icad2019.003 (CC BY-NC).
  Abstract via OpenAlex. He sonifies the positions of the zeros (as frequencies: "the Riemann spectrum"), values of ζ in
  the complex plane, and approximations to the prime spectrum. He points out that the Dirichlet series itself is
  additive synthesis, a sum of partials n^(−s). He credits earlier zero syntheses to Jeffrey Stopple.
- **Jonathan Love (Leiden), "Sonification in number theory: listening to the Riemann zeta function"**, IHP, 24 Mar 2026
  (<https://www.carmin.tv/en/video/sonification-in-number-theory-listening-to-the-riemann-zeta-function>). He argues that the ear
  hears Fourier components, so one can hear properties one cannot see. Two demonstrations: hearing the analytic
  continuation inside the sound of a divergent sum, and what the primes would sound like if RH were false.

**Lesson:** the strongest zeta sonifications use the ear as a **spectrum analyser**, family B or a spectral mapping,
and not as a pitch meter for one value at a time.

## 6. Function graphs by ear in shipping products (family A)

- **Desmos Audio Trace** (<https://help.desmos.com/hc/en-us/articles/37064105800333-Audio-Trace>; Perkins School for the
  Blind lessons, <https://www.perkins.org/resource/graph-it-out-understanding-linear-equations-with-desmos-and-jaws/>).
  Pitch is y, stereo pan is x (headphones advised), and a **static noise layer plays while y < 0**. Playback speed is
  adjustable, and slower helps people hear the shape. Desmos also has `tone(frequency, gain)`, a sine with gain capped at
  min(10, 660/f) (<https://help.desmos.com/hc/en-us/articles/21373904717197>), and people build music with it
  (<https://cl.desmos.com/t/play-music-in-desmos/7612>).
- **Apple Audio Graphs** (VoiceOver, `AXChartDescriptor`;
  <https://developer.apple.com/documentation/accessibility/representing-chart-data-as-an-audio-graph>, WWDC21 10122).
  x is time and y is pitch, and you can scrub it and hear values read out.
- **Highcharts Sonification** (<https://www.highcharts.com/docs/sonification/mapping>). Pitch for amount, sampled
  instruments (piano, saxophone, flute ...), and an advised narrow range of **G4 to F6** for accuracy. Pan is never the
  only cue.
- **TwoTone** (Datavized / Google News Initiative, <https://github.com/sonifydata/twotone>). A CSV becomes MIDI-like
  pitches on chosen scales and instruments.

**What they sound like:** a glide or melody on one instrument. They are pleasant when the instrument is a real (sampled)
one and the pitches are quantised to a scale. They are tiring when the voice is a raw sine. None of them tries to make
**phase** audible. Our Shepard tone is the only family-A design I found for a circular quantity.

## 7. Explorables with sound

- **Jez Swanson, *An Interactive Introduction to Fourier Transforms*** (<https://www.jezzamon.com/fourier/>). Play
  buttons for a wave and its components, and a square wave rebuilt from n sines that sounds duller as n drops.
- **Bartosz Ciechanowski, *Sound*** (<https://ciechanow.ski/sound/>, Oct 2026). Keyboards that play pops,
  rectangles, triangles and **waveforms you draw**, plus pure-tone sweeps, beats and plucked-string harmonics. Sound
  starts only on a key press, and the article warns to keep the volume moderate.
- **Chrome Music Lab**-style toys and the Passau museum page (§3) work the same way: **you trigger the sound, it is
  short, and it is about one shape at a time.**

**Pattern:** good explorables make sound **on demand**, for a few seconds, with a clear "this shape → this sound". They
do not run a sound continuously under the pointer.

## 8. What this suggests for "hear F" (input to the options)

The facts below are exact mathematics or standard acoustics. The sound descriptions are predictions until someone
listens.

1. **Why the current tone feels "weird"** (family A with a Shepard voice). A Shepard glide is built to be endless and
   ambiguous. In film it is used *because* it makes people anxious: Zimmer's *Dunkirk* score stacks three of them for
   tension ([Kottke](https://kottke.org/18/05/hans-zimmers-clever-use-of-the-shepard-scale-in-dunkirk),
   [Wikipedia](https://en.wikipedia.org/wiki/Dunkirk_(soundtrack))). With sine partials it is also an unnatural
   spectrum: nine octaves and no other harmonics. New timbres (`v2/timbres.js`) fix the second problem. The first,
   unease, comes with the illusion itself, and is worst while the tone climbs for a long time.

2. **A loop as a waveform (family B, the 2swap and CodeParade move).** Play the loop γ at f₀ Hz, with Re as left and
   Im as right, and remove the mean (as CodeParade does). For a circle |z − a| = r in an annulus where F is holomorphic,
   F(a + r e^{iωt}) = Σ c_k r^k e^{ikωt}. **The harmonics of the sound are the Laurent coefficients.**
   - A zero of order m at a: F ≈ c(z − a)^m, so a nearly pure **m-th harmonic** (m = 2 an octave up, m = 3 a twelfth up,
     the 2swap interval).
   - **Brightness is the distance to the nearest singularity.** Harmonic k falls by 20·log₁₀(R/r) dB per step (R: the
     nearest pole or branch point). r/R = 0.2 gives −14 dB per harmonic (almost a pure tone), 0.5 gives −6 dB per
     harmonic (warm), 0.9 gives −0.9 dB per harmonic (buzzy). Dragging a loop toward a pole is heard as the tone
     opening up.
   - Holomorphic F on a smooth loop gives a real-analytic waveform, with no corners and no −6 or −12 dB/octave buzz.
     So **this is the mellow case of oscilloscope music**, unless the loop runs close to a pole or a cut.
   - Zero versus pole is a sign of frequency. In mono they sound the same. In stereo the image rotates the other way: R
     lags L by 90° for a zero and leads for a pole. Below about 1.5 kHz, on headphones, the interaural phase difference
     lateralises the tone toward the leading ear. That is a weak cue, so it needs a second one.
3. **The phase alone as a waveform** (CodeParade's `normalized` mode): play e^{i·arg F(γ(t))}. Its mean instantaneous
   frequency over one traversal is exactly **W·f₀**, where W is the winding number (the argument principle). For clean
   loops the W-th harmonic dominates. In general you hear f₀ with energy around W·f₀, an FM "wah" where arg F moves
   fast near zeros and poles. This is the phase portrait turned into a timbre.
4. **A ring under the pointer (family C, no loop needed).** Scan a small virtual circle of radius r around the pointer
   at f₀, as wave-terrain synthesis does. Phase-only (3): far from zeros and poles the phase barely moves along the ring,
   so the tone is faint. When the ring encloses a simple zero, it sounds a full tone at f₀. A double zero sounds the
   octave, and a pole sounds at f₀ with the image reversed. Raw F (2): brightness tracks the distance to poles and
   cuts. Either way the pointer hears the **local structure of F**, not one number.
5. **Sound on demand, notes in a scale, a real instrument.** These are the habits of everything people enjoy (§1.3, §6,
   §7). Event notes (2swap's per-transition pitches, quantised to a key) and short triggered sounds suit an explorable
   better than an endless drone. Family B/C tones, if chosen, should be quantised: f₀ is a note (for example D3 =
   146.8 Hz), so the winding harmonics land on D3, D4, A4 and D5, and the result is consonant by construction.

## Sources

- 2swap, swaptube (public domain): <https://github.com/2swap/swaptube>. Files cited: `src/Scenes/Physics/PendulumScene.cpp`,
  `src/IO/SFX.cpp`, `src/IO/AudioWriter.cpp`, `src/IO/MidiWriter.cpp`, `src/Scenes/Media/MidiSoundScene.cpp`,
  `src/Scenes/Math/Beavers/TuringMachineScene.cpp`, `src/Projects/Demos/{GeneratedBlockDemo,MidiDemo}.cpp`, and
  `src/Projects/DoublePendulum.cpp` at commit `da533e7`. Video: <https://www.youtube.com/watch?v=dtjb2OhEQcU>.
  Discussion: <https://tildes.net/~science/1p22/double_pendulums_are_not_chaotic>.
- CodeParade (HackerPoet), Fractal Sound Explorer (MIT): <https://github.com/HackerPoet/FractalSoundExplorer>, `Main.cpp`.
  Video: <https://youtu.be/GiAj9WW1OfQ>.
- Oscilloscope music: <https://oscilloscopemusic.com/>, <https://en.wikipedia.org/wiki/Oscilloscope_Music>,
  <https://hackaday.com/tag/jerobeam>, <https://github.com/jameshball/osci-render>, <https://github.com/m1el/woscope>,
  Uni Passau Mathe-Museum page (link in §3).
- Wave-terrain and scanned synthesis: links in §4.
- Zeta: Kulsha page (§5); Collins, ICAD 2019, <https://doi.org/10.21785/icad2019.003> (record
  <https://repository.gatech.edu/entities/publication/11819e2a-1624-4bfb-88c2-f69360ba4847>); Love, IHP 2026 (§5).
- Products: Desmos, Apple, Highcharts, TwoTone (links in §6).
- Explorables: Swanson, Ciechanowski (§7).
- Shepard tone in film: <https://kottke.org/18/05/hans-zimmers-clever-use-of-the-shepard-scale-in-dunkirk>,
  <https://en.wikipedia.org/wiki/Dunkirk_(soundtrack)>.

Not reached: the full texts of Collins 2019 (both mirrors refused the download; the abstract came via OpenAlex) and the
Desmos Audio Trace help page (403; its content here is from search snippets and Perkins).
