# Hearing a function: what the literature says

Research A for "hear the function" (2026-10-24). This note asks what is already known about making mathematics
audible, what listeners can actually hear, and what they find tiresome. Nobody here can listen, so every claim
comes from a source or from acoustics. Where only an abstract or a secondary summary was read, the note says so.
Chapters of *The Sonification Handbook* (Hermann, Hunt & Neuhoff, eds., 2011) were downloaded as PDFs and read
directly. They are cited as **HB ch. N**.

## 0. The short answer

1. **Mathematical sound comes in three families**, and the app now uses only one:
   - **Parameter mapping (PMSon).** A value moves pitch, loudness or timbre. Today's Shepard tone is this.
   - **Audification.** The data *is* the waveform. A curve played fast becomes a sound.
   - **Model-based sonification (MBS).** The data becomes an object that sounds only when you excite it: you tap
     it, shake it or drag across it.

   2swap's renderer uses audification for its double pendulums (§4.1).
2. **No published sonification of phase portraits, of arg F, or of winding numbers turned up.** Several searches
   found only visual phase plots. This is open ground. The closest relatives are the orbit and zeta-function
   audifications, oscilloscope music, and vector-field probes (§4).
3. **Graphing tools all do the same thing.** Desmos, SAS, Highcharts, MathTrax and Apple map **y to pitch and x to
   time and stereo position**. They add **short discrete cues at landmarks**: static below the axis, a pop at an
   intersection. They offer both "play the whole curve" and "scrub it yourself". Listeners pick up shape features
   (monotonicity, symmetry, extrema) **80 to 95 %** of the time (§2).
4. **What listeners complain about:** plain sine tones, sound that never stops, and pitch that does not follow
   musical steps. MBS is said to be less annoying because it is **silent until the user acts** (HB ch. 16, ch. 7,
   ch. 4; §6). A sine-partial drone that is always on and hovers between notes matches the "weird, non-natural"
   description well.
5. **Perception limits that matter here** (§5):
   - Pitch and loudness interact, so arg F and |F| on those two dimensions leak into each other.
   - The ear tracks pitch *change* and *contour* far better than absolute value.
   - Stereo position can show only left to right, not a full circle.
   - A Shepard tone cannot say which way a half-turn went (the tritone paradox).

---

## 1. The three families, and interaction

| Family | Idea | Strength | Known weakness | Source |
|---|---|---|---|---|
| Parameter mapping (PMSon) | data value → pitch, loudness, timbre, pan, tempo | flexible, precise for one variable | arbitrary; dimensions interact; can sound synthetic | HB ch. 15 (Grond & Berger) |
| Audification | "the direct translation of a data waveform into sound" (Kramer, quoted in HB ch. 12) | the ear's own skills (periodicity, rhythm, noise vs tone) do the analysis | needs many samples per second; data must be shifted into roughly 40 Hz to 10 kHz | HB ch. 12 (Dombois & Eckel) |
| Model-based (MBS) | data → virtual physical object; the user excites it and the sound comes from its dynamics | natural sound and less annoying: "sonification models remain typically silent in the absence of excitation" | the model must be designed; it costs computation | HB ch. 16 (Hermann) |
| Interactive sonification | "data exploration by interactively manipulating the data's transformation into sound" | the tight control loop is what makes instruments learnable | needs low latency and a direct mapping | HB ch. 11; [Hunt & Hermann, ICAD 2004](https://pub.uni-bielefeld.de/record/2017438) |

- **Audification facts (HB ch. 12):**
  - Usable band is about **40 Hz to 10 kHz**, 8 octaves.
  - Frequency resolution is about **4 Hz at 1 to 2 kHz**.
  - Separate events need **20 to 50 ms** between them.
  - The usable dynamic range in practice is **50 to 80 dB**.
- **Why MBS is pleasanter (HB ch. 16):**
  - Its sound appears only after excitation, which "prevents never-ending sound which would be annoying after some
    time".
  - Because the sound sits inside a closed loop with the user, it "may reduce fatigue".
  - Shaking a box to learn what is inside, or clapping to hear a room, are the everyday models.
- **Interaction (HB ch. 11):** "the more direct an interaction is, the lower the latency until the effect becomes
  perceivable". The pleasure of making sound comes from being "in a very tightly responsive control loop". The
  app's pointer probe is already interactive PMSon, which is the right family for exploring.

Handbook chapter PDFs: [2](https://sonification.de/handbook/download/TheSonificationHandbook-chapter2.pdf),
[4](https://sonification.de/handbook/download/TheSonificationHandbook-chapter4.pdf),
[7](https://sonification.de/handbook/download/TheSonificationHandbook-chapter7.pdf),
[11](https://sonification.de/handbook/download/TheSonificationHandbook-chapter11.pdf),
[12](https://sonification.de/handbook/download/TheSonificationHandbook-chapter12.pdf),
[15](https://sonification.de/handbook/download/TheSonificationHandbook-chapter15.pdf),
[16](https://sonification.de/handbook/download/TheSonificationHandbook-chapter16.pdf),
[17](https://sonification.de/handbook/download/TheSonificationHandbook-chapter17.pdf). Book home:
[sonification.de/handbook](https://sonification.de/handbook/).

## 2. Auditory graphs: how functions are made audible today

### 2.1 Research results

- **Mansur, Blattner & Joy (1985), "Sound-Graphs".**
  - Each graph was **3 s of continuously varying pitch**.
  - Fourteen subjects compared sound graphs with tactile graphs.
  - Symmetry, monotonicity and slope "could be determined quickly using sound", with **79 to 95 %** recognition of
    such features (abstract and a thesis summary).
  - [Springer](https://link.springer.com/doi/10.1007/BF00996201)
- **Brown & Brewster (2003), "Drawing by ear".**
  - Listeners heard two-series line graphs and sketched them.
  - They captured **over 80 %** of key features.
  - Piano + piano did no worse than piano + trumpet.
  - The authors recommend letting users choose the presentation (summary).
  - [Glasgow eprint](https://eprints.gla.ac.uk/3194)
- **Flowers (2005), "Thirteen years of reflection on auditory graphing".** The early 1990s pitfalls persist. Most
  come from misunderstanding auditory perception and attention, and from "inappropriate borrowing" of visual
  practice (abstract only). [hdl 1853/50188](https://hdl.handle.net/1853/50188)
- **Context cues (Smith & Walker 2005).**
  - A sound graph without reference cues is like a graph without axes. Trends survive, but point values do not.
  - Adding reference tones and ticks helps listeners estimate values (HB ch. 2 §"Context"; paper
    [doi:10.1002/acp.1146](https://doi.org/10.1002/acp.1146)).
  - Follow-up on reference markers: [PeerJ CS 51](https://peerj.com/articles/cs-51).
- **Polarity (Walker 2002 and later).**
  - Listeners agree on the direction of some mappings ("more" = higher pitch) and disagree on others.
  - Agreement is a measure of how natural a mapping feels (HB ch. 2).
  - One study found that whether polarities followed magnitude estimation made no substantial difference to
    performance ([Ferguson & Brewster, Glasgow](https://eprints.gla.ac.uk/160589); summary).
  - [Walker's dissertation page](https://sonify.psych.gatech.edu/walkerb/research/phd/index.html)
- **Derivatives as timbre: the closest thing to "the sound of a function, not of a point".**
  - Edwards & Stevens let users hear the **derivative** to find turning points: at a turning point the pitch
    stops moving (HB ch. 17 §17.6.1).
  - Grond, Drossard & Hermann's **SonicFunction** (ICAD 2010) sonifies the **first m terms of the Taylor series**
    at the cursor. Users with experience of auditory media found it "very supportive to grasp important
    characteristics of a mathematical function" (HB ch. 17).
    [Record](https://pub.uni-bielefeld.de/record/2017190)
  - Grond & Hermann's **Singing Function** (JMUI 2012) maps f(x) to pitch, f′ to a vowel glide [a:]→[i:], and f″ to
    vowel brightness. It is all one voice, and they report it as the first vowel-based function sonification.
    [Record](https://pub.uni-bielefeld.de/record/2277129)
- **The glance (HB ch. 17).** "Playing the waveform of the soundgraph curve … gives a similar overall impression of
  the curve's shape": an audification of the curve itself works as an auditory overview.

### 2.2 Tools

| Tool | Mapping | Landmarks | Mode | Source |
|---|---|---|---|---|
| **Desmos audio trace** | pitch = y; stereo pans left→right with x | **static** while y < 0; timbre change (added overtone) while x > 0; **pop** at intersections | H plays the whole graph; arrows step along; speed adjustable | [Desmos help](https://help.desmos.com/hc/en-us/articles/37064105800333-Audio-Trace) (via search summary; direct fetch blocked), [Illinois CITL guide](https://citl.illinois.edu/node/623), [Perkins lessons](https://www.perkins.org/resource/understanding-desmos-sonification-lessons/) |
| **SAS Graphics Accelerator** | pitch = y (high = more); **stereo** = x position | describe first, then drill into points | summary then exploration | [SAS blog](https://blogs.sas.com/content/sascom/2017/02/22/getting-started-sas-graphics-accelerator/), [press release](https://www.sas.com/da_dk/news/press-releases/2017/february/sas-graphics-accelerator-education.html) |
| **Highcharts sonification** | y → pitch by default; any parameter mappable; preset instruments (piano, vibraphone, flute, saxophone, noise …) | **earcons** for points of interest and threshold crossings; speech tracks | play, or `Point.sonify` | [Highcharts docs](https://www.highcharts.com/docs/sonification/getting-started); [HSS paper, ICAD 2021](https://icad2021.icad.org/wp-content/uploads/2021/06/ICAD_2021_5.pdf) (its findings are about the UI, not the sound) |
| **MathTrax (NASA)** | a vertical line sweeps; pitch follows y | settings signal positive vs negative and **axis crossings** | sweep | [NASA NTRS](https://ntrs.nasa.gov/citations/20100019596), [W3C wiki](https://www.w3.org/dpub/IG/wiki/MathSonifyA11y) |
| **Apple Audio Graphs** | x → time, y → pitch; **continuous tone** for series, **separate tones** for scatter and bars | VoiceOver reads the value where you pause | play, or touch-and-drag to scrub at your own pace | [Apple docs](https://developer.apple.com/documentation/accessibility/audio-graphs), [WWDC21 10122](https://developer.apple.com/videos/play/wwdc2021/10122/) |

Every tool converges on four parts:

1. One continuous voice for the value.
2. Short, distinct **landmark cues** for sign changes and crossings.
3. A **whole-curve playback** of a few seconds for the overview.
4. Manual **scrubbing** for detail.

The app already has 2 (zero and pole pings, the turn bell), 3 ("Listen along γ") and 4 (hover). The difference is
in 1: these tools sonify a **real** y on a **line**. The app sonifies a **circular** quantity, arg F, on a
**plane**.

## 3. Angles, phase and circular quantities

- **Shepard and Risset circularity.**
  - Octave-spaced partials under a fixed spectral envelope give a pitch with clear **chroma** but no clear
    **height**, so a pitch can rise forever (Shepard 1964).
  - The pitch helix (Shepard 1982) is the geometry behind this: chroma goes round the circle, height goes up the
    axis.
  - [Wikipedia: pitch circularity](https://en.wikipedia.org/wiki/Pitch_circularity);
    [AudioLabs Erlangen notebook](https://audiolabs-erlangen.de/resources/MIR/FMP/C1/C1S1_ChromaShepard.html);
    [CCRMA, ASA demo 27](https://ccrma.stanford.edu/%7Emalcolm/correlograms/text/52%20Circularity%20In%20Pitch%20Judgment.html)
  - Accessibility guides recommend Shepard tones for compass and rotation data because they avoid the jump at
    360° → 0° (secondary glossary).
  - A 2023 surgical-guidance prototype uses a Shepard-tone core for spatial direction.
    [arXiv 2310.09070](https://arxiv.org/pdf/2310.09070)
  - No study was found that compares Shepard chroma with other circular mappings for reading angles. The
    perceptual effects "are still not entirely understood".
- **The tritone paradox (Deutsch).**
  - Two Shepard tones a half-octave apart have no proximity cue.
  - Whether the step sounds up or down **varies from listener to listener** and depends on the pitch class.
  - So a half-turn jump in arg F cannot be heard as a direction. The app's 0.17 s glide is the right fix: it
    gives the ear a proximity path.
  - [Malek 2018, Frontiers in Psychology](https://doi.org/10.3389/fpsyg.2018.01590)
- **Chroma is relative.** Without absolute pitch, a listener hears chroma *changes*, not chroma values. The app
  already says this in §2.5: "the chroma of a Shepard tone is heard relatively".
- **Space as an angle.**
  - The minimum audible angle is about **1° straight ahead** and grows to about **7° at 75°** (Mills 1958).
    [PMC7156409](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7156409/)
  - Over headphones with generic HRTFs, **front/back and up/down confusions are frequent**. Left/right cues stay
    robust (Wenzel et al. 1993). [NASA NTRS](https://ntrs.nasa.gov/citations/19930067961)
  - So stereo position can carry **left to right (a half-circle)** reliably, but **not a full 360° angle**.
- **Interaural phase.**
  - The ear uses the fine-structure phase difference between the ears only **below about 1.4 to 1.5 kHz**.
    [DGA 2020 abstract](https://www.egms.de/static/en/meetings/dga2020/20dga131.shtml)
  - The absolute phase of a single tone is inaudible.
  - A *change* of phase over time is a *change of frequency*: instantaneous frequency = (dφ/dt)/2π. That is the
    textbook definition.
  - So "hearing arg F as phase" is possible only in two ways:
    - (a) as a **frequency shift** while arg F is changing;
    - (b) as an **interaural phase difference** of a low carrier, over headphones.

## 4. Complex numbers, fields and curves specifically

Searches for sonification of phase portraits, of complex arg and modulus, and of winding numbers found **no prior
work**. The relatives below are what exists.

### 4.1 2swap

- 2swap's repositories ([github.com/2swap](https://github.com/2swap)) are mostly about video, puzzles and
  languages, plus [LittlewoodFractal](https://github.com/2swap/LittlewoodFractal).
- The renderer [swaptube](https://github.com/2swap/swaptube) has no "sonification" module. It does have
  hand-written audio, read in its source:
  - **The double pendulum is audified, not mapped.** This is read from the source. That this exact routine made
    the video's soundtrack is likely but not confirmed.
    [`PendulumScene::generate_audio`](https://github.com/2swap/swaptube/blob/HEAD/src/Scenes/Physics/PendulumScene.cpp)
    integrates the pendulum with RK4 at many steps per audio sample.
    - It writes **left = 0.05·sin θ₁, right = 0.05·sin θ₂** as the waveform.
    - The physics *is* the sound: a periodic pendulum is a pitch, and a chaotic one is noise.
    - A separate `generate_tone` adds a sine whose loudness follows the pendulum's energy.
    - Video: "Double Pendulums are Chaoticn't" (noted on
      [Cleve Moler's MathWorks blog](https://blogs.mathworks.com/cleve/2026/02/01/double-pendulum/)).
    - A fan-made interactive map lets you **click a point of the parameter plane and hear that pendulum**, "just
      like in the video" ([Tildes thread](https://tildes.net/~science/1p90/double_pendulum_parameter_space_visualizer)).
    - So in 2swap's work each point *does* have its own sound, but that sound is generated by the point's own
      dynamics, not chosen by a mapping.
  - **Event sounds are tiny synths.** [`SFX.cpp`](https://github.com/2swap/swaptube/blob/HEAD/src/IO/SFX.cpp)
    has `sfx_boink` (a sine with exponential decay, set by its half-life) and `sfx_clap` (decaying noise).
    - Recent commits (Aug 2026) export all scene sounds and continuous tones to **MIDI** "for a DAW", so they can
      be re-voiced with real instruments.
    - Commits from Mar 2025 read "Fourier sound analysis for sfx" and "Having trouble reconstructing natural
      sounds".
    - Even 2swap moved from raw sines toward sampled or real timbres for the final mix.

### 4.2 Other relatives

- **Orbits as stereo audio.**
  - North Coast Synthesis sonified Mandelbrot orbits with **Re z on the left channel and Im z on the right**.
    [Post](https://northcoastsynthesis.com/news/listening-to-the-mandelbrot-set)
  - JMSL's MandelInstrument maps orbit values to frequency and pan.
    [Example](https://algomusic.com/jmsl/examples/MandelInstructions.html)
  - This is the most direct precedent for "a complex value is a stereo sample".
- **The zeta function.**
  - Collins (ICAD 2019) sonifies both the zeros on the critical line and "values of the zeta function in the
    complex plane", including direct audification.
    [Durham record](https://durham-repository.worktribe.com/output/1144201) (abstract via search; PDF blocked)
  - Kulsha renders the Riemann–Siegel Z(t) directly as audio samples.
    [Watkins' zeta pages](https://empslocal.ex.ac.uk/people/staff/mrwatkin/zeta/kulsha.htm)
- **Oscilloscope music.** Left drives X and right drives Y, so a **closed curve played at audio rate is a stereo
  waveform**. A sine on one channel and a cosine on the other draws a circle. Composers (Jerobeam Fenderson) write
  music whose waveform *is* the picture.
  [Uni Passau maths museum](https://www.mathe-museum.uni-passau.de/fileadmin/dokumente/fakultaeten/fim/lehrstuhl/forster-heinlein/oscilloscope-music/index.html),
  [xythobuz explainer](https://xythobuz.de/osci_music_player.html).
- **Vector fields.**
  - A UC technique for 3-D vector fields maps the nearby vectors at a probe to **smooth, wind-like aerodynamic
    sound**, conveying direction, speed, vorticity and local flow patterns. It is usually attributed to Klein &
    Staadt, but the fetched page did not show the authors.
    [eScholarship](https://escholarship.org/uc/item/0p94c1gj)
  - Natural noise-based timbres beat tones for flow.
- **Quantum states.** Yamada et al. (2023) map Wigner-function grid points to wave phase, frequency and amplitude.
  They report no listening results and do not sonify the complex phase of ψ itself.
  [arXiv 2311.13313](https://arxiv.org/abs/2311.13313)
- **Shapes and edges.**
  - EdgeSonic (touch exploration) sonifies the local edge gradient and the distance to the nearest edge. It works
    for line drawings after training. [UCSD](https://vision.ucsd.edu/node/544)
  - ShapeSonic (SIGGRAPH Asia 2023) uses zones plus pitch, volume, timbre and spatialisation.
    [Slides](https://cragl.cs.gmu.edu/shapesonic/)

## 5. What listeners can actually hear (constraints for any option)

- **Pitch and loudness interact.**
  - Loudness changes bend perceived pitch change and the reverse. Rising intensity is judged larger than an equal
    fall.
  - In a stock-price sonification this "distorted the data relations"
    ([Neuhoff, Kramer & Wayand 2002](https://doi.org/10.1037/1076-898X.8.1.17), abstract; HB ch. 4).
  - For the app: arg F on chroma and ln|F| on loudness and register are two *integral* dimensions carrying two
    *different* variables, which is the case the literature warns about.
  - The current design keeps the register swing small (±0.3 oct), which is the right instinct.
- **Redundancy helps.** Mapping *one* variable to two integral dimensions (pitch and loudness together) makes its
  changes more salient. Mapping it to separable ones (pitch and tempo) does not help (Peres & Lane 2005, in HB ch. 4
  §4.2.6).
- **Musical steps sound better.** "Musical scales … may be perceived as more pleasant and less annoying than
  frequency change that is not constrained to musical scales" (HB ch. 4). HB ch. 15's examples include quantising
  pitch to a pentatonic scale.
- **Resolution** (HB ch. 12):
  - About 4 Hz at 1 to 2 kHz.
  - Events need 20 to 50 ms between them.
  - Pitch *contour* (up, down, turning) is what auditory-graph users report best (§2.1).
- **Training and context matter.** Performance improves with brief training and with reference cues. Individual
  differences are large (HB ch. 2 §2.6.2).

## 6. What people found annoying

- **Pure sine tones.** In a rowing-machine study "a sine-wave sonification became annoying" (HB ch. 7). The
  current Shepard voice is nine pure sine partials.
- **Sound that never stops.**
  - MBS avoids it by design (HB ch. 16).
  - A condition-monitoring study avoided music altogether over "continuous monitoring fatigue" (Hildebrandt et al.
    2016, as cited by Middleton et al.,
    [Data-to-music sonification and user engagement, Frontiers in Big Data 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10448511)).
    The same paper warns that a "saturated sound environment" confused participants.
- **Aesthetics are not optional.** Vickers lists "intrusiveness, distraction, listener fatigue, annoyance" as *the*
  larger design questions. Leplâtre & McGregor found that "functional and aesthetic properties … cannot be dealt
  with independently" (HB ch. 7).
- **Comfort and accuracy trade off.**
  - In a 2026 phonon-spectra study (Whalley, Vickers et al.), the spectral method, closest to audification, gave
    the highest performance but was "less comfortable to listen to". Musical mappings were more comfortable but
    conveyed one relation less well (summary). [arXiv 2603.29037](https://arxiv.org/pdf/2603.29037)
  - In an 18-person guidance study, musical strategies earned better user-experience ratings at **comparable
    performance**.
    [Aalborg](https://vbn.aau.dk/da/publications/comparing-sonification-strategies-applied-to-musical-and-non-musi)
- **Carry the information on a pleasant sound.** One flight display filtered and panned *any* audio (pilots chose
  their own music) to show attitude, with "greatly reduced annoyance and listener fatigue as well as higher
  compliance" (HB ch. 4).

## 7. What this suggests for "hear the function" (input to the options, not the options)

1. **The user's unease is predicted by the literature.** The voice is synthetic sines, always on, moving between
   scale steps, with two variables on interacting dimensions. Natural timbres address the first point only. The
   other three are about *what* is sonified and *when*.
2. **"Each point" is not wrong**, since it is how Desmos, Apple's scrubbing and 2swap's clickable map work. But
   the point sounds best when it **sounds only on contact or motion** (MBS, interaction), and when its sound
   **comes from the mathematics at that point**, not from an arbitrary tone. One candidate: the spectrum of F on a
   tiny circle around the point is exactly its Taylor or Laurent coefficients, the idea in Grond's SonicFunction.
3. **"A composite of a curve" has strong precedent.** Audifying a *closed loop* means playing F(γ(t)) at audio
   rate, Re to the left channel and Im to the right, as in oscilloscope music, orbit audio and 2swap's pendulum.
   This is pure reasoning, not tested; the claims below follow from the maths and §3:
   - Take a signal F/|F| that winds **n** times around 0 at a steady rate. It is a pure tone at **n** times the
     loop rate, so winding number 1, 2, 3 is heard as root, octave, twelfth. An uneven winding spreads energy to
     nearby harmonics but keeps n as the strongest one only roughly.
   - A zero and a pole differ only in the sign of the rotation. Mono cannot tell them apart. In stereo, the ±90°
     left/right phase lateralises them to opposite sides, as long as the fundamental stays below about 1.4 kHz.
   - Winding is measured about the *centre* of the curve, so the signal should be F/|F|, or have its mean
     removed with that limitation stated.
4. **Keep the parts every tool agrees on:**
   - landmark cues: the zero and pole pings and the turn bell, like Desmos pops;
   - a few-second "play the whole thing" overview, as in "Listen along γ";
   - reference or context sounds: a fixed "arg 0" home pitch, like axis ticks;
   - musical quantisation of whatever is continuous.
5. **Do not use stereo position for arg F over a full circle.** It reads only as left and right. It can carry the
   x position (as in Desmos and SAS) or the zero-versus-pole sign.
